/**
 * Shared utility functions
 */

import * as fs from 'fs';

/**
 * Normalize path separators to forward slashes
 * Ensures consistent path keys across Windows and Unix
 */
export function normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
}

/**
 * Ensure a directory exists, creating it recursively if needed
 */
export function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Safely delete a file, ignoring ENOENT errors
 */
export function safeUnlink(filePath: string): boolean {
    try {
        fs.unlinkSync(filePath);
        return true;
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            return false; // File didn't exist
        }
        throw e;
    }
}

/**
 * Ensure .gitignore in a directory contains specified entries
 */
export function ensureGitignore(dir: string, entries: string[]): void {
    ensureDir(dir);
    
    const gitignorePath = `${dir}/.gitignore`;
    let content = '';
    
    if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, 'utf8');
    }
    
    const linesToAdd = entries.filter(entry => !content.includes(entry));
    
    if (linesToAdd.length > 0) {
        content = content.trimEnd() + '\n' + linesToAdd.join('\n') + '\n';
        fs.writeFileSync(gitignorePath, content, 'utf8');
    }
}
