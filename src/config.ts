import * as vscode from 'vscode';
import { PlatformId } from './platforms/index';

export type DeletionBehavior = 'ignore' | 'delete' | 'ask';
export type LimitBehavior = 'warn' | 'silent';

export interface SyncConfig {
    enabled: boolean;
    deletionBehavior: DeletionBehavior;
    limitBehavior: LimitBehavior;
    syncPlatforms: PlatformId[];
}

export const ANTIGRAVITY_CHAR_LIMIT = 12000;

export function getConfig(): SyncConfig {
    const config = vscode.workspace.getConfiguration('scenyEditorSync');
    return {
        enabled: config.get<boolean>('enabled', false),
        deletionBehavior: config.get<DeletionBehavior>('deletionBehavior', 'ask'),
        limitBehavior: config.get<LimitBehavior>('limitBehavior', 'warn'),
        syncPlatforms: config.get<PlatformId[]>('syncPlatforms', [])
    };
}
