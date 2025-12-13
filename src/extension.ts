import * as vscode from 'vscode';
import { syncFile, handleDeletion } from './fileSync';
import { getConfig } from './config';

export function activate(context: vscode.ExtensionContext) {
    console.log('Rules Sync extension activated');
    
    // Monitor file saves
    const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
        try {
            await syncFile(document);
        } catch (error) {
            console.error('Rules Sync: Error syncing file', error);
            if (getConfig().enabled) {
                vscode.window.showErrorMessage(`Rules Sync: Failed to sync ${document.fileName}`);
            }
        }
    });
    
    // Monitor file deletions
    const deleteDisposable = vscode.workspace.onDidDeleteFiles(async (event) => {
        for (const uri of event.files) {
            try {
                await handleDeletion(uri);
            } catch (error) {
                console.error('Rules Sync: Error handling deletion', error);
            }
        }
    });
    
    context.subscriptions.push(saveDisposable, deleteDisposable);
}

export function deactivate() {
    console.log('Rules Sync extension deactivated');
}
