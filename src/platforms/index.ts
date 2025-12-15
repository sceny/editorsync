/**
 * Platform Registry - Main entry point
 */

import * as fs from 'fs';
import * as path from 'path';
import { IntermediateModel } from '../model';
import { Platform, PlatformId } from './types';
import { normalizePath } from './helpers';
import { cursorPlatform } from './cursor';
import { antigravityPlatform } from './antigravity';
import { vscodePlatform } from './vscode';

// Re-export types
export { Platform, PlatformId } from './types';

// Platform registry
export const PLATFORMS: Record<PlatformId, Platform> = {
    cursor: cursorPlatform,
    antigravity: antigravityPlatform,
    vscode: vscodePlatform
};

/**
 * Detect which platforms have existing folders in workspace
 */
export function detectAvailablePlatforms(workspaceRoot: string): PlatformId[] {
    const available: PlatformId[] = [];

    if (fs.existsSync(path.join(workspaceRoot, '.cursor')) ||
        fs.existsSync(path.join(workspaceRoot, '.cursorrules'))) {
        available.push('cursor');
    }

    if (fs.existsSync(path.join(workspaceRoot, '.agent'))) {
        available.push('antigravity');
    }

    if (fs.existsSync(path.join(workspaceRoot, '.github'))) {
        available.push('vscode');
    }

    return available;
}

/**
 * Get all platform IDs except the specified one(s)
 */
export function getOtherPlatforms(sourceId: PlatformId): PlatformId[] {
    return (Object.keys(PLATFORMS) as PlatformId[]).filter(id => id !== sourceId);
}

/**
 * Detect platform from folder path
 */
export function detectPlatformFromPath(relativePath: string): PlatformId | null {
    const normalized = normalizePath(relativePath);

    if (normalized.startsWith('.cursor/') || normalized === '.cursorrules') {
        return 'cursor';
    }
    if (normalized.startsWith('.agent/')) {
        return 'antigravity';
    }
    if (normalized.startsWith('.github/')) {
        return 'vscode';
    }
    return null;
}

/**
 * Export from a platform to intermediate model
 */
export function exportFromPlatform(platformId: PlatformId, workspaceRoot: string): IntermediateModel {
    const platform = PLATFORMS[platformId];
    return {
        rules: platform.exportRules(workspaceRoot),
        workflows: platform.exportWorkflows(workspaceRoot)
    };
}

/**
 * Import intermediate model to a platform, returns paths of written files
 */
export function importToPlatform(model: IntermediateModel, platformId: PlatformId, workspaceRoot: string): string[] {
    const platform = PLATFORMS[platformId];
    const paths: string[] = [];
    paths.push(...platform.importRules(model.rules, workspaceRoot));
    paths.push(...platform.importWorkflows(model.workflows, workspaceRoot));
    return paths;
}
