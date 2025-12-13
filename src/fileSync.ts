import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig, ANTIGRAVITY_CHAR_LIMIT } from './config';
import { getJournal } from './journal';
import { PlatformId, PLATFORMS, getOtherPlatforms, getDestinationPath, matchesPlatform, detectPlatformFromPath } from './platforms';
import { transformContent } from './transforms';

/**
 * Recursively find all files in a directory with given extension
 */
function findFilesRecursive(dir: string, ext: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            results.push(...findFilesRecursive(fullPath, ext));
        } else if (item.name.endsWith(ext)) {
            results.push(fullPath);
        }
    }
    return results;
}

/**
 * Sync all files from a source platform to all target platforms
 */
export async function syncAllFromPlatform(
    sourceId: PlatformId,
    force: boolean = false
): Promise<number> {
    const config = getConfig();
    if (!config.enabled) {
        return 0;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return 0;
    }

    const sourcePlatform = PLATFORMS[sourceId];
    const targetIds = getOtherPlatforms(sourceId);
    let syncedCount = 0;

    for (const folder of workspaceFolders) {
        const root = folder.uri.fsPath;
        const journal = getJournal(root);
        const isFirstSync = journal.isEmpty();
        const shouldForce = force || isFirstSync;

        // Collect source files
        const sourceFiles: string[] = [];

        // Check .cursorrules (Cursor-specific)
        if (sourceId === 'cursor') {
            const cursorrules = path.join(root, '.cursorrules');
            if (fs.existsSync(cursorrules)) {
                sourceFiles.push(cursorrules);
            }
        }

        // Rules
        const rulesDir = path.join(root, sourcePlatform.rulesDir);
        sourceFiles.push(...findFilesRecursive(rulesDir, sourcePlatform.ruleExt));

        // Workflows
        const workflowsDir = path.join(root, sourcePlatform.workflowsDir);
        sourceFiles.push(...findFilesRecursive(workflowsDir, sourcePlatform.workflowExt));

        // Sync each source file to all targets
        for (const sourceFile of sourceFiles) {
            if (!shouldForce && !journal.needsSync(sourceFile)) {
                continue;
            }

            const relativePath = path.relative(root, sourceFile);
            const isWorkflow = relativePath.startsWith(sourcePlatform.workflowsDir);
            const content = fs.readFileSync(sourceFile, 'utf8');

            for (const targetId of targetIds) {
                const targetPlatform = PLATFORMS[targetId];
                const destPath = getDestinationPath(relativePath, sourcePlatform, targetPlatform, root);

                if (!destPath) continue;

                const transformedContent = transformContent(content, relativePath, sourceId, targetId, isWorkflow);

                // Check character limit for Antigravity
                if (targetId === 'antigravity' && transformedContent.length > ANTIGRAVITY_CHAR_LIMIT && config.limitBehavior === 'warn') {
                    vscode.window.showWarningMessage(
                        `Rule "${path.basename(destPath)}" exceeds Antigravity's 12k limit (${transformedContent.length} chars).`
                    );
                }

                // Ensure destination directory exists
                const destDir = path.dirname(destPath);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }

                fs.writeFileSync(destPath, transformedContent, 'utf8');
            }

            journal.recordSync(sourceFile);
            syncedCount++;
        }

        journal.save();
    }

    return syncedCount;
}

/**
 * Sync all existing source files (auto-detects source based on context)
 * @param force - If true, sync all files regardless of journal state
 * @param sourceId - Optional explicit source platform
 */
export async function syncAllExistingFiles(
    force: boolean = false,
    sourceId?: PlatformId
): Promise<number> {
    // If no explicit source, sync from detected editor or default to cursor
    const effectiveSource = sourceId || 'cursor';
    return syncAllFromPlatform(effectiveSource, force);
}

/**
 * Sync a single file (from document save event)
 */
export async function syncFile(document: vscode.TextDocument): Promise<void> {
    const config = getConfig();
    if (!config.enabled) return;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return;

    const root = workspaceFolder.uri.fsPath;
    const relativePath = path.relative(root, document.uri.fsPath);
    const sourceId = detectPlatformFromPath(relativePath);
    
    if (!sourceId) return;

    const sourcePlatform = PLATFORMS[sourceId];
    if (!matchesPlatform(relativePath, sourcePlatform)) return;

    const isWorkflow = relativePath.startsWith(sourcePlatform.workflowsDir);
    const content = document.getText();
    const targetIds = getOtherPlatforms(sourceId);

    for (const targetId of targetIds) {
        const targetPlatform = PLATFORMS[targetId];
        const destPath = getDestinationPath(relativePath, sourcePlatform, targetPlatform, root);

        if (!destPath) continue;

        const transformedContent = transformContent(content, relativePath, sourceId, targetId, isWorkflow);

        if (targetId === 'antigravity' && transformedContent.length > ANTIGRAVITY_CHAR_LIMIT && config.limitBehavior === 'warn') {
            vscode.window.showWarningMessage(
                `Rule "${path.basename(destPath)}" exceeds Antigravity's 12k limit.`
            );
        }

        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.writeFileSync(destPath, transformedContent, 'utf8');
    }

    const journal = getJournal(root);
    journal.recordSync(document.uri.fsPath);
    journal.save();
}

/**
 * Sync a file by URI (for create/change events)
 */
export async function syncFileByUri(uri: vscode.Uri): Promise<void> {
    const config = getConfig();
    if (!config.enabled) return;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) return;

    if (!fs.existsSync(uri.fsPath)) return;

    const root = workspaceFolder.uri.fsPath;
    const relativePath = path.relative(root, uri.fsPath);
    const sourceId = detectPlatformFromPath(relativePath);

    if (!sourceId) return;

    const sourcePlatform = PLATFORMS[sourceId];
    if (!matchesPlatform(relativePath, sourcePlatform)) return;

    const isWorkflow = relativePath.startsWith(sourcePlatform.workflowsDir);
    const content = fs.readFileSync(uri.fsPath, 'utf8');
    const targetIds = getOtherPlatforms(sourceId);

    for (const targetId of targetIds) {
        const targetPlatform = PLATFORMS[targetId];
        const destPath = getDestinationPath(relativePath, sourcePlatform, targetPlatform, root);

        if (!destPath) continue;

        const transformedContent = transformContent(content, relativePath, sourceId, targetId, isWorkflow);

        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.writeFileSync(destPath, transformedContent, 'utf8');
    }

    const journal = getJournal(root);
    journal.recordSync(uri.fsPath);
    journal.save();
}

/**
 * Handle file rename/move
 */
export async function handleRename(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
    await handleDeletion(oldUri, true);
    await syncFileByUri(newUri);
}

/**
 * Handle file deletion
 */
export async function handleDeletion(deletedUri: vscode.Uri, forceDelete: boolean = false): Promise<void> {
    const config = getConfig();
    if (!config.enabled) return;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(deletedUri);
    if (!workspaceFolder) return;

    const root = workspaceFolder.uri.fsPath;
    const relativePath = path.relative(root, deletedUri.fsPath);
    const sourceId = detectPlatformFromPath(relativePath);
    
    if (!sourceId) return;

    const sourcePlatform = PLATFORMS[sourceId];
    const targetIds = getOtherPlatforms(sourceId);
    const behavior = forceDelete ? 'delete' : config.deletionBehavior;

    for (const targetId of targetIds) {
        const targetPlatform = PLATFORMS[targetId];
        const destPath = getDestinationPath(relativePath, sourcePlatform, targetPlatform, root);

        if (!destPath || !fs.existsSync(destPath)) continue;

        switch (behavior) {
            case 'ignore':
                break;
            case 'delete':
                fs.unlinkSync(destPath);
                break;
            case 'ask':
                const answer = await vscode.window.showInformationMessage(
                    `Source "${path.basename(relativePath)}" deleted. Delete synced file "${path.basename(destPath)}"?`,
                    'Yes', 'No'
                );
                if (answer === 'Yes') {
                    fs.unlinkSync(destPath);
                }
                break;
        }
    }

    const journal = getJournal(root);
    journal.removeEntry(deletedUri.fsPath);
    journal.save();
}
