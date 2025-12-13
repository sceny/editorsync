import * as vscode from 'vscode';

export type DeletionBehavior = 'ignore' | 'delete' | 'ask';
export type LimitBehavior = 'warn' | 'silent';

export interface SyncConfig {
    enabled: boolean;
    deletionBehavior: DeletionBehavior;
    limitBehavior: LimitBehavior;
}

export const ANTIGRAVITY_CHAR_LIMIT = 12000;

export function getConfig(): SyncConfig {
    const config = vscode.workspace.getConfiguration('agentSync');
    return {
        enabled: config.get<boolean>('enabled', false),
        deletionBehavior: config.get<DeletionBehavior>('deletionBehavior', 'ask'),
        limitBehavior: config.get<LimitBehavior>('limitBehavior', 'warn')
    };
}
