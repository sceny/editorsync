/**
 * Shared helpers for platform implementations
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Recursively find files with specific extension
 */
export function findFilesRecursive(dir: string, ext: string): string[] {
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
 * Ensure directory exists, creating recursively if needed
 */
export function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Normalize path separators to forward slashes
 */
export function normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
}
