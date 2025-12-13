import * as vscode from 'vscode';
import { syncFile, syncFileByUri, handleDeletion, handleRename, syncAllExistingFiles } from './fileSync';
import { syncQueue } from './syncQueue';
import { getConfig } from './config';

export function activate(context: vscode.ExtensionContext) {
    console.log('Rules Sync extension activated');
    
    // Initial sync of existing files
    syncAllExistingFiles().then(count => {
        if (count > 0 && getConfig().enabled) {
            console.log(`Rules Sync: Synced ${count} existing files on activation`);
        }
    });

    // Register sync all command (command palette)
    const syncAllCommand = vscode.commands.registerCommand(
        'rulesSync.syncAll',
        async () => {
            if (!getConfig().enabled) {
                vscode.window.showWarningMessage('Rules Sync is disabled. Enable it in settings first.');
                return;
            }
            const count = await syncAllExistingFiles();
            vscode.window.showInformationMessage(`Rules Sync: Synced ${count} files`);
        }
    );

    // Register force sync all command (ignores journal, syncs everything)
    const forceSyncAllCommand = vscode.commands.registerCommand(
        'rulesSync.forceSyncAll',
        async () => {
            if (!getConfig().enabled) {
                vscode.window.showWarningMessage('Rules Sync is disabled. Enable it in settings first.');
                return;
            }
            const count = await syncAllExistingFiles(true);
            vscode.window.showInformationMessage(`Rules Sync: Force synced ${count} files`);
        }
    );

    // Register sync folder command (for context menu)
    const syncFolderCommand = vscode.commands.registerCommand(
        'rulesSync.syncFolder',
        async () => {
            if (!getConfig().enabled) {
                vscode.window.showWarningMessage('Rules Sync is disabled. Enable it in settings first.');
                return;
            }
            const count = await syncAllExistingFiles();
            vscode.window.showInformationMessage(`Rules Sync: Synced ${count} files`);
        }
    );

    // Monitor file saves (primary sync trigger)
    const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
        syncQueue.queueSync(document.uri.fsPath, () => syncFile(document));
    });

    // Monitor file creations
    const createDisposable = vscode.workspace.onDidCreateFiles(async (event) => {
        for (const uri of event.files) {
            syncQueue.queueSync(uri.fsPath, () => syncFileByUri(uri));
        }
    });

    // Monitor file renames/moves
    const renameDisposable = vscode.workspace.onDidRenameFiles(async (event) => {
        for (const { oldUri, newUri } of event.files) {
            syncQueue.clearMetadata(oldUri.fsPath);
            try {
                await handleRename(oldUri, newUri);
            } catch (error) {
                console.error('Rules Sync: Error handling rename', error);
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
                console.error('Rules Sync: Error handling deletion', error);
            }
        }
    });
    
    // File watcher for external changes (git restore, external editors, etc.)
    const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
            vscode.workspace.workspaceFolders?.[0] || '',
            '{.cursorrules,.cursor/rules/**/*.mdc,.cursor/commands/**/*.md}'
        )
    );

    const watcherChangeDisposable = watcher.onDidChange(async (uri) => {
        syncQueue.queueSync(uri.fsPath, () => syncFileByUri(uri));
    });

    const watcherCreateDisposable = watcher.onDidCreate(async (uri) => {
        syncQueue.queueSync(uri.fsPath, () => syncFileByUri(uri));
    });

    const watcherDeleteDisposable = watcher.onDidDelete(async (uri) => {
        syncQueue.clearMetadata(uri.fsPath);
        try {
            await handleDeletion(uri);
        } catch (error) {
            console.error('Rules Sync: Error handling external deletion', error);
        }
    });

    context.subscriptions.push(
        syncAllCommand,
        forceSyncAllCommand,
        syncFolderCommand,
        saveDisposable,
        createDisposable,
        renameDisposable,
        deleteDisposable,
        watcher,
        watcherChangeDisposable,
        watcherCreateDisposable,
        watcherDeleteDisposable
    );
}

export function deactivate() {
    console.log('Rules Sync extension deactivated');
}
