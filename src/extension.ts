import * as vscode from 'vscode';
import { syncFile, syncFileByUri, handleDeletion, handleRename, syncAllExistingFiles, syncAllFromPlatform } from './fileSync';
import { syncQueue } from './syncQueue';
import { getConfig } from './config';
import { detectPlatformFromPath } from './platforms';
import { logger, updateLogLevel, closeLoggers } from './logger';

export function activate(context: vscode.ExtensionContext) {
    logger.info('Sceny AI Editor Rules Sync activated');
    
    // Initial sync of existing files
    syncAllExistingFiles().then(count => {
        if (count > 0 && getConfig().enabled) {
            logger.info(`Synced ${count} existing files on activation`);
        }
    });

    // Listen for config changes to update log level
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('scenyEditorSync.logLevel')) {
            updateLogLevel();
            logger.info('Log level updated');
        }
    });

    // Register sync all command
    const syncAllCommand = vscode.commands.registerCommand(
        'scenyEditorSync.syncAll',
        async () => {
            if (!getConfig().enabled) {
                vscode.window.showWarningMessage('Sceny is disabled. Enable it in settings first.');
                return;
            }
            const count = await syncAllExistingFiles();
            vscode.window.showInformationMessage(`Sceny: Synced ${count} files`);
        }
    );

    // Force sync all command
    const forceSyncAllCommand = vscode.commands.registerCommand(
        'scenyEditorSync.forceSyncAll',
        async () => {
            if (!getConfig().enabled) {
                vscode.window.showWarningMessage('Sceny is disabled. Enable it in settings first.');
                return;
            }
            const count = await syncAllExistingFiles(true);
            vscode.window.showInformationMessage(`Sceny: Force synced ${count} files`);
        }
    );

    // Sync from Cursor
    const syncFromCursorCommand = vscode.commands.registerCommand(
        'scenyEditorSync.syncFromCursor',
        async () => {
            if (!getConfig().enabled) {
                vscode.window.showWarningMessage('Sceny is disabled. Enable it in settings first.');
                return;
            }
            const count = await syncAllFromPlatform('cursor', false);
            vscode.window.showInformationMessage(`Sceny: Synced ${count} files from Cursor`);
        }
    );

    // Sync from Antigravity
    const syncFromAntigravityCommand = vscode.commands.registerCommand(
        'scenyEditorSync.syncFromAntigravity',
        async () => {
            if (!getConfig().enabled) {
                vscode.window.showWarningMessage('Sceny is disabled. Enable it in settings first.');
                return;
            }
            const count = await syncAllFromPlatform('antigravity', false);
            vscode.window.showInformationMessage(`Sceny: Synced ${count} files from Antigravity`);
        }
    );

    // Sync from VS Code
    const syncFromVSCodeCommand = vscode.commands.registerCommand(
        'scenyEditorSync.syncFromVSCode',
        async () => {
            if (!getConfig().enabled) {
                vscode.window.showWarningMessage('Sceny is disabled. Enable it in settings first.');
                return;
            }
            const count = await syncAllFromPlatform('vscode', false);
            vscode.window.showInformationMessage(`Sceny: Synced ${count} files from VS Code`);
        }
    );

    // Sync folder context menu command
    const syncFolderCommand = vscode.commands.registerCommand(
        'scenyEditorSync.syncFolder',
        async (uri: vscode.Uri) => {
            if (!getConfig().enabled) {
                vscode.window.showWarningMessage('Sceny is disabled. Enable it in settings first.');
                return;
            }

            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            if (!workspaceFolder) return;

            const relativePath = uri.fsPath.replace(workspaceFolder.uri.fsPath, '').replace(/^[\/\\]/, '');
            const sourceId = detectPlatformFromPath(relativePath);

            if (sourceId) {
                const count = await syncAllFromPlatform(sourceId, false);
                vscode.window.showInformationMessage(`Sceny: Synced ${count} files from ${sourceId}`);
            } else {
                const count = await syncAllExistingFiles();
                vscode.window.showInformationMessage(`Sceny: Synced ${count} files`);
            }
        }
    );

    // Monitor file saves
    const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
        try {
            logger.info('File saved event', { file: document.uri.fsPath });
            syncQueue.queueSync(document.uri.fsPath, () => syncFile(document));
        } catch (error) {
            logger.error('Error in save handler', { error: String(error) });
        }
    });

    // Monitor file creations
    const createDisposable = vscode.workspace.onDidCreateFiles(async (event) => {
        for (const uri of event.files) {
            try {
                logger.info('File created event', { file: uri.fsPath });
                syncQueue.queueSync(uri.fsPath, () => syncFileByUri(uri));
            } catch (error) {
                logger.error('Error in create handler', { error: String(error) });
            }
        }
    });

    // Monitor file renames/moves
    const renameDisposable = vscode.workspace.onDidRenameFiles(async (event) => {
        for (const { oldUri, newUri } of event.files) {
            syncQueue.clearMetadata(oldUri.fsPath);
            try {
                await handleRename(oldUri, newUri);
            } catch (error) {
                logger.error('Error handling rename', { error: String(error) });
            }
        }
    });
    
    // Monitor file deletions
    const deleteDisposable = vscode.workspace.onDidDeleteFiles(async (event) => {
        for (const uri of event.files) {
            syncQueue.clearMetadata(uri.fsPath);
            try {
                await handleDeletion(uri);
            } catch (error) {
                logger.error('Error handling deletion', { error: String(error) });
            }
        }
    });
    
    // File watchers for external changes - one per workspace folder
    const watcherDisposables: vscode.Disposable[] = [];
    for (const folder of vscode.workspace.workspaceFolders || []) {
        logger.info('Setting up watcher for workspace', { folder: folder.uri.fsPath });
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(
                folder,
                '{.cursorrules,.cursor/rules/**/*.mdc,.cursor/rules/**/*.md,.cursor/commands/**/*.md,.agent/rules/**/*.md,.agent/workflows/**/*.md,.github/instructions/**/*.md}'
            )
        );

        watcherDisposables.push(
            watcher.onDidChange(async (uri) => {
                try {
                    logger.info('File changed (external)', { file: uri.fsPath });
                    syncQueue.queueSync(uri.fsPath, () => syncFileByUri(uri));
                } catch (error) {
                    logger.error('Error in external change handler', { error: String(error) });
                }
            }),
            watcher.onDidCreate(async (uri) => {
                try {
                    logger.info('File created (external)', { file: uri.fsPath });
                    syncQueue.queueSync(uri.fsPath, () => syncFileByUri(uri));
                } catch (error) {
                    logger.error('Error in external create handler', { error: String(error) });
                }
            }),
            watcher.onDidDelete(async (uri) => {
                logger.info('File deleted (external)', { file: uri.fsPath });
                syncQueue.clearMetadata(uri.fsPath);
                try {
                    await handleDeletion(uri);
                } catch (error) {
                    logger.error('Error handling external deletion', { error: String(error) });
                }
            }),
            watcher
        );
    }


    context.subscriptions.push(
        syncAllCommand,
        forceSyncAllCommand,
        syncFromCursorCommand,
        syncFromAntigravityCommand,
        syncFromVSCodeCommand,
        syncFolderCommand,
        configChangeDisposable,
        saveDisposable,
        createDisposable,
        renameDisposable,
        deleteDisposable,
        ...watcherDisposables
    );
}

export function deactivate() {
    logger.info('Sceny AI Editor Rules Sync deactivated');
    closeLoggers();
}
