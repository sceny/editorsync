import * as path from 'path';

/**
 * Platform Registry - Extensible architecture for adding future platforms
 * 
 * To add a new platform:
 * 1. Add to PlatformId type
 * 2. Add Platform config to PLATFORMS array
 * 3. Add transform functions as needed
 */

export type PlatformId = 'cursor' | 'antigravity';

export interface Platform {
    id: PlatformId;
    name: string;
    rulesDir: string;
    workflowsDir: string;
    ruleExt: string;
    workflowExt: string;
}

// Platform configurations
export const PLATFORMS: Record<PlatformId, Platform> = {
    cursor: {
        id: 'cursor',
        name: 'Cursor',
        rulesDir: '.cursor/rules',
        workflowsDir: '.cursor/commands',
        ruleExt: '.mdc',
        workflowExt: '.md'
    },
    antigravity: {
        id: 'antigravity',
        name: 'Antigravity',
        rulesDir: '.agent/rules',
        workflowsDir: '.agent/workflows',
        ruleExt: '.md',
        workflowExt: '.md'
    }
};

/**
 * Get all platform IDs except the specified one
 */
export function getOtherPlatforms(sourceId: PlatformId): PlatformId[] {
    return (Object.keys(PLATFORMS) as PlatformId[]).filter(id => id !== sourceId);
}

/**
 * Detect platform from folder path
 */
export function detectPlatformFromPath(relativePath: string): PlatformId | null {
    if (relativePath.startsWith('.cursor/') || relativePath === '.cursorrules') {
        return 'cursor';
    }
    if (relativePath.startsWith('.agent/')) {
        return 'antigravity';
    }
    return null;
}

/**
 * Detect current editor platform from VS Code app name
 */
export function detectEditorPlatform(appName: string): PlatformId {
    const name = appName.toLowerCase();
    if (name.includes('cursor')) {
        return 'cursor';
    }
    // Antigravity runs as VS Code fork
    if (name.includes('antigravity') || name.includes('code')) {
        return 'antigravity';
    }
    return 'cursor'; // default
}

/**
 * Get destination path for a source file
 */
export function getDestinationPath(
    sourceRelPath: string,
    sourcePlatform: Platform,
    targetPlatform: Platform,
    workspaceRoot: string
): string | null {
    // Determine if this is a rule or workflow
    const isRule = sourceRelPath.startsWith(sourcePlatform.rulesDir) || 
                   sourceRelPath === '.cursorrules';
    const isWorkflow = sourceRelPath.startsWith(sourcePlatform.workflowsDir);
    
    if (!isRule && !isWorkflow) {
        return null;
    }
    
    let relativeName: string;
    
    if (sourceRelPath === '.cursorrules') {
        relativeName = 'cursorrules';
    } else {
        const sourceDir = isRule ? sourcePlatform.rulesDir : sourcePlatform.workflowsDir;
        const sourceExt = isRule ? sourcePlatform.ruleExt : sourcePlatform.workflowExt;
        
        // Extract relative name without directory prefix and extension
        relativeName = sourceRelPath
            .replace(/^\.cursor[\\/]rules[\\/]|^\.cursor[\\/]commands[\\/]|^\.agent[\\/]rules[\\/]|^\.agent[\\/]workflows[\\/]/, '')
            .replace(new RegExp(sourceExt.replace('.', '\\.') + '$'), '');
    }
    
    const targetDir = isRule ? targetPlatform.rulesDir : targetPlatform.workflowsDir;
    const targetExt = isRule ? targetPlatform.ruleExt : targetPlatform.workflowExt;
    
    return path.join(workspaceRoot, targetDir, `${relativeName}${targetExt}`);
}

/**
 * Check if a path matches a platform's source patterns
 */
export function matchesPlatform(relativePath: string, platform: Platform): boolean {
    if (platform.id === 'cursor' && relativePath === '.cursorrules') {
        return true;
    }
    
    const rulesPattern = new RegExp(`^${platform.rulesDir.replace(/\//g, '[\\\\/]')}[\\\\/].+\\${platform.ruleExt}$`);
    const workflowsPattern = new RegExp(`^${platform.workflowsDir.replace(/\//g, '[\\\\/]')}[\\\\/].+\\${platform.workflowExt}$`);
    
    return rulesPattern.test(relativePath) || workflowsPattern.test(relativePath);
}
