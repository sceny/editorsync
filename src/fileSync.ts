import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig, ANTIGRAVITY_CHAR_LIMIT } from './config';
import { getJournal } from './journal';
import { PlatformId, PLATFORMS, detectAvailablePlatforms, detectPlatformFromPath, exportFromPlatform, importToPlatform, getOtherPlatforms } from './platforms/index';
import { IntermediateModel } from './model';
import { logger } from './logger';
import { getSyncLock } from './syncLock';
import { normalizePath } from './utils';

/**
 * Get target platforms based on config or auto-detection
 */
function getTargetPlatforms(workspaceRoot: string, sourceId?: PlatformId): PlatformId[] {
    const config = getConfig();

    // If explicit platforms configured, use them (excluding source)
    if (config.syncPlatforms.length > 0) {
        return config.syncPlatforms.filter(id => id !== sourceId);
    }

    // Auto-detect from available folders
    const available = detectAvailablePlatforms(workspaceRoot);
    return available.filter(id => id !== sourceId);
}

/**
 * Sync all files from a source platform to target platforms
 * Uses intermediate model: Source → Model → Targets
 */
export async function syncAllFromPlatform(
    sourceId: PlatformId,
    force: boolean = false
): Promise<number> {
    const config = getConfig();
    if (!config.enabled) {
        logger.debug('Sync disabled, skipping');
        return 0;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return 0;

    let syncedCount = 0;
    logger.info(`Starting sync from ${sourceId}`, { force });

    for (const folder of workspaceFolders) {
        const root = folder.uri.fsPath;
        const lock = getSyncLock(root);

        const result = await lock.withLock(async () => {
            const journal = getJournal(root);

            // Export from source platform to intermediate model
            const model = exportFromPlatform(sourceId, root);

            if (model.rules.length === 0 && model.workflows.length === 0) {
                logger.debug('No rules/workflows found', { source: sourceId });
                return 0;
            }

            logger.debug('Exported model', {
                source: sourceId,
                rules: model.rules.length,
                workflows: model.workflows.length
            });

            // Record source files (so the other editor won't sync these back)
            for (const rule of model.rules) {
                if (rule.sourcePath) {
                    journal.recordWrite(rule.sourcePath);
                }
            }
            for (const wf of model.workflows) {
                if (wf.sourcePath) {
                    journal.recordWrite(wf.sourcePath);
                }
            }

            // Get target platforms
            const targets = getTargetPlatforms(root, sourceId);
            logger.debug('Target platforms', { targets: targets.join(', ') });

            let count = 0;
            // Import to each target platform and record written files
            for (const targetId of targets) {
                try {
                    // Check limits for Antigravity
                    if (targetId === 'antigravity' && config.limitBehavior === 'warn') {
                        for (const rule of model.rules) {
                            if (rule.content.length > ANTIGRAVITY_CHAR_LIMIT) {
                                vscode.window.showWarningMessage(
                                    `Rule "${rule.name}" exceeds Antigravity's 12k limit (${rule.content.length} chars).`
                                );
                            }
                        }
                    }

                    const writtenPaths = importToPlatform(model, targetId, root);
                    logger.debug(`Wrote ${writtenPaths.length} files to ${targetId}`);

                    // Record all written files for loop detection
                    for (const writtenPath of writtenPaths) {
                        journal.recordWrite(writtenPath);
                    }

                    count += writtenPaths.length;
                } catch (error) {
                    logger.error(`Error importing to ${targetId}`, { error: String(error) });
                }
            }

            journal.save();
            return count;
        });

        syncedCount += result ?? 0;
    }

    logger.info(`Sync from ${sourceId} finished`, { totalFiles: syncedCount });
    return syncedCount;
}

/**
 * Sync all existing source files
 */
export async function syncAllExistingFiles(
    force: boolean = false,
    sourceId?: PlatformId
): Promise<number> {
    const effectiveSource = sourceId || 'cursor';
    return syncAllFromPlatform(effectiveSource, force);
}

/**
 * Sync a single file (from document save event)
 */
export async function syncFile(document: vscode.TextDocument): Promise<void> {
    logger.info('syncFile triggered', { file: document.uri.fsPath });
    const config = getConfig();
    if (!config.enabled) {
        logger.info('Sync disabled, ignoring');
        return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        logger.info('No workspace folder, ignoring', { file: document.uri.fsPath });
        return;
    }

    const root = workspaceFolder.uri.fsPath;
    const lock = getSyncLock(root);
    logger.info('Acquiring lock', { root });

    await lock.withLock(async () => {
        logger.info('Lock acquired, checking journal');
        const journal = getJournal(root);

        // Skip if this file was just written by us (prevents loops)
        if (journal.wasWrittenByUs(document.uri.fsPath)) {
            logger.info('Skipping bounceback (file was written by us)', { file: document.uri.fsPath });
            return;
        }

        const relativePath = path.relative(root, document.uri.fsPath);
        const sourceId = detectPlatformFromPath(relativePath);
        logger.info('Platform detection', { relativePath, sourceId: sourceId || 'none' });

        if (!sourceId) {
            logger.info('Not a platform file, ignoring');
            return;
        }

        logger.info('Syncing file', { file: relativePath, source: sourceId });

        // Export this file's platform to model
        const model = exportFromPlatform(sourceId, root);

        // Record source files (so the other editor won't sync these back)
        for (const rule of model.rules) {
            if (rule.sourcePath) {
                journal.recordWrite(rule.sourcePath);
            }
        }
        for (const wf of model.workflows) {
            if (wf.sourcePath) {
                journal.recordWrite(wf.sourcePath);
            }
        }

        // Get targets
        const targets = getTargetPlatforms(root, sourceId);

        // Import to targets and record written files
        for (const targetId of targets) {
            const writtenPaths = importToPlatform(model, targetId, root);
            for (const writtenPath of writtenPaths) {
                journal.recordWrite(writtenPath);
            }
        }

        journal.save();
    });
}

/**
 * Sync a file by URI (for create/change events)
 */
export async function syncFileByUri(uri: vscode.Uri): Promise<void> {
    logger.debug('syncFileByUri triggered', { file: uri.fsPath });
    const config = getConfig();
    if (!config.enabled) {
        logger.debug('Sync disabled, ignoring');
        return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        logger.debug('No workspace folder found', { file: uri.fsPath });
        return;
    }

    if (!fs.existsSync(uri.fsPath)) {
        logger.debug('File does not exist', { file: uri.fsPath });
        return;
    }

    const root = workspaceFolder.uri.fsPath;
    const lock = getSyncLock(root);

    await lock.withLock(async () => {
        const journal = getJournal(root);

        // Skip if this file was just written by us (prevents loops)
        if (journal.wasWrittenByUs(uri.fsPath)) {
            logger.debug('Skipping bounceback (file written by us)', { file: path.relative(root, uri.fsPath) });
            return;
        }

        const relativePath = path.relative(root, uri.fsPath);
        const sourceId = detectPlatformFromPath(relativePath);

        if (!sourceId) {
            logger.debug('Ignoring file (not a platform file)', { file: relativePath });
            return;
        }

        logger.info('Syncing file change', { file: relativePath, source: sourceId });

        // Export and import
        const model = exportFromPlatform(sourceId, root);
        logger.debug('Exported model', { rules: model.rules.length, workflows: model.workflows.length });

        // Record source files (so the other editor won't sync these back)
        for (const rule of model.rules) {
            if (rule.sourcePath) {
                journal.recordWrite(rule.sourcePath);
            }
        }
        for (const wf of model.workflows) {
            if (wf.sourcePath) {
                journal.recordWrite(wf.sourcePath);
            }
        }

        const targets = getTargetPlatforms(root, sourceId);
        logger.debug('Target platforms', { targets: targets.join(', ') });

        // Import and record written files
        for (const targetId of targets) {
            const writtenPaths = importToPlatform(model, targetId, root);
            logger.debug(`Wrote ${writtenPaths.length} files to ${targetId}`);
            for (const writtenPath of writtenPaths) {
                journal.recordWrite(writtenPath);
            }
        }

        journal.save();
        logger.info('Sync complete', { source: sourceId, targets: targets.join(', ') });
    });
}

/**
 * Handle file rename/move
 */
export async function handleRename(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
    logger.info('handleRename triggered', { old: oldUri.fsPath, new: newUri.fsPath });
    await handleDeletion(oldUri, true);
    await syncFileByUri(newUri);
}

/**
 * Handle file deletion - delete corresponding target files
 */
export async function handleDeletion(deletedUri: vscode.Uri, forceDelete: boolean = false): Promise<void> {
    const config = getConfig();
    if (!config.enabled) return;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(deletedUri);
    if (!workspaceFolder) return;

    const root = workspaceFolder.uri.fsPath;
    const relativePath = normalizePath(path.relative(root, deletedUri.fsPath));
    const sourceId = detectPlatformFromPath(relativePath);
    
    logger.info('handleDeletion triggered', { file: relativePath, sourceId: sourceId || 'none', forceDelete });

    if (!sourceId) return;

    const behavior = forceDelete ? 'delete' : config.deletionBehavior;

    if (behavior === 'ignore') {
        logger.info('Deletion behavior is ignore, skipping');
        return;
    }

    // Determine the file name (without platform-specific path and extension)
    const platform = PLATFORMS[sourceId];
    const rulesDir = Array.isArray(platform.rulesDir) ? platform.rulesDir[0] : platform.rulesDir;
    const workflowsDir = platform.workflowsDir;

    let baseName: string | null = null;
    let isWorkflow = false;

    // Check if it's a rules file
    if (relativePath.startsWith(normalizePath(rulesDir))) {
        const relToRules = relativePath.slice(rulesDir.length + 1);
        baseName = relToRules.replace(/\.(mdc|md)$/, '');
    } else if (workflowsDir && relativePath.startsWith(normalizePath(workflowsDir))) {
        const relToWorkflows = relativePath.slice(workflowsDir.length + 1);
        baseName = relToWorkflows.replace(/\.md$/, '');
        isWorkflow = true;
    }

    if (!baseName) {
        logger.info('Could not determine base name for deletion');
        return;
    }

    logger.info('Deleting corresponding target files', { baseName, isWorkflow });

    // Get target platforms and delete corresponding files
    const targets = getTargetPlatforms(root, sourceId);
    const journal = getJournal(root);

    for (const targetId of targets) {
        const targetPlatform = PLATFORMS[targetId];
        const targetRulesDir = Array.isArray(targetPlatform.rulesDir) ? targetPlatform.rulesDir[0] : targetPlatform.rulesDir;
        const targetWorkflowsDir = targetPlatform.workflowsDir;

        let targetPath: string;
        if (isWorkflow && targetWorkflowsDir) {
            // Determine extension based on target platform
            targetPath = path.join(root, targetWorkflowsDir, `${baseName}.md`);
        } else if (!isWorkflow) {
            // Determine extension based on target platform
            const ext = targetId === 'cursor' ? '.mdc' : '.md';
            targetPath = path.join(root, targetRulesDir, `${baseName}${ext}`);
        } else {
            continue;
        }

        if (fs.existsSync(targetPath)) {
            try {
                fs.unlinkSync(targetPath);
                logger.info('Deleted target file', { file: targetPath });
                journal.removeFile(targetPath);
            } catch (error) {
                logger.error('Failed to delete target file', { file: targetPath, error: String(error) });
            }
        }
    }

    journal.removeFile(deletedUri.fsPath);
    journal.save();
}

