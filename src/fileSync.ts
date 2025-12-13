import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig, ANTIGRAVITY_CHAR_LIMIT } from './config';
import { getJournal } from './journal';

// Trigger type mapping
type AntigravityTrigger = 'always' | 'glob' | 'model_decision';

interface CursorFrontmatter {
    description?: string;
    globs?: string;
    alwaysApply?: boolean;
}

interface AntigravityFrontmatter {
    trigger: AntigravityTrigger;
    globs?: string;
    description?: string;
}

// File mapping definitions
interface FileMapping {
    sourcePattern: RegExp;
    getDestPath: (sourcePath: string, workspaceRoot: string) => string;
    transformContent: (content: string, sourcePath: string) => string;
}

const FILE_MAPPINGS: FileMapping[] = [
    // .cursorrules -> .agent/rules/cursorrules.md
    {
        sourcePattern: /^\.cursorrules$/,
        getDestPath: (_, root) => path.join(root, '.agent', 'rules', 'cursorrules.md'),
        transformContent: (content) => transformCursorToAntigravity(content, false)
    },
    // .cursor/rules/**/*.mdc -> .agent/rules/**/*.md (supports subfolders)
    {
        sourcePattern: /^\.cursor[\/\\]rules[\/\\](.+)\.mdc$/,
        getDestPath: (sourcePath, root) => {
            const match = sourcePath.match(/^\.cursor[\/\\]rules[\/\\](.+)\.mdc$/);
            const relativeName = match ? match[1] : 'rule';
            return path.join(root, '.agent', 'rules', `${relativeName}.md`);
        },
        transformContent: (content) => transformCursorToAntigravity(content, true)
    },
    // .cursor/commands/**/*.md -> .agent/workflows/**/*.md (supports subfolders)
    {
        sourcePattern: /^\.cursor[\/\\]commands[\/\\](.+)\.md$/,
        getDestPath: (sourcePath, root) => {
            const match = sourcePath.match(/^\.cursor[\/\\]commands[\/\\](.+)\.md$/);
            const relativeName = match ? match[1] : 'workflow';
            return path.join(root, '.agent', 'workflows', `${relativeName}.md`);
        },
        transformContent: (content, sourcePath) => transformCommandToWorkflow(content, sourcePath)
    }
];

// Source directories to scan on activation
const SOURCE_SCAN_PATHS = [
    { dir: '.cursor/rules', ext: '.mdc' },
    { dir: '.cursor/commands', ext: '.md' }
];

// Recursively find all files in a directory with given extension
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

// Sync all existing source files (called on activation or manually)
// force: if true, sync all files regardless of journal state
export async function syncAllExistingFiles(force: boolean = false): Promise<number> {
    const config = getConfig();
    if (!config.enabled) {
        return 0;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return 0;
    }

    let syncedCount = 0;

    for (const folder of workspaceFolders) {
        const root = folder.uri.fsPath;
        const journal = getJournal(root);
        const isFirstSync = journal.isEmpty();
        const shouldForce = force || isFirstSync;

        // Check .cursorrules
        const cursorrules = path.join(root, '.cursorrules');
        if (fs.existsSync(cursorrules) && (shouldForce || journal.needsSync(cursorrules))) {
            await syncFileByPath(cursorrules, root);
            journal.recordSync(cursorrules);
            syncedCount++;
        }

        // Scan source directories
        for (const { dir, ext } of SOURCE_SCAN_PATHS) {
            const fullDir = path.join(root, dir);
            const files = findFilesRecursive(fullDir, ext);

            for (const file of files) {
                if (shouldForce || journal.needsSync(file)) {
                    await syncFileByPath(file, root);
                    journal.recordSync(file);
                    syncedCount++;
                }
            }
        }

        // Save journal after processing each workspace
        journal.save();
    }

    return syncedCount;
}

// Sync by absolute path (for initial sync)
async function syncFileByPath(absolutePath: string, workspaceRoot: string): Promise<void> {
    const config = getConfig();
    const relativePath = path.relative(workspaceRoot, absolutePath);
    const mapping = getMapping(relativePath);

    if (!mapping) return;

    const content = fs.readFileSync(absolutePath, 'utf8');
    await writeToDestination(content, relativePath, mapping, workspaceRoot, config);
}

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
        return { frontmatter: {}, body: content };
    }
    
    const frontmatterStr = match[1];
    const body = match[2];
    const frontmatter: Record<string, unknown> = {};
    
    // Simple YAML parsing for key: value pairs
    for (const line of frontmatterStr.split(/\r?\n/)) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value: unknown = line.substring(colonIndex + 1).trim();
            // Parse booleans
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            // Remove quotes from strings
            else if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            frontmatter[key] = value;
        }
    }
    
    return { frontmatter, body };
}

function stringifyFrontmatter(frontmatter: Record<string, unknown>): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(frontmatter)) {
        if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'string' && (value.includes(',') || value.includes(' '))) {
                lines.push(`${key}: "${value}"`);
            } else {
                lines.push(`${key}: ${value}`);
            }
        }
    }
    return `---\n${lines.join('\n')}\n---\n`;
}

function determineTrigger(cursor: CursorFrontmatter): AntigravityTrigger {
    if (cursor.alwaysApply === true) {
        return 'always';
    }
    if (cursor.globs) {
        return 'glob';
    }
    if (cursor.description) {
        return 'model_decision';
    }
    return 'glob'; // default
}

function transformCursorToAntigravity(content: string, hasFrontmatter: boolean): string {
    if (!hasFrontmatter) {
        // Plain .cursorrules file - wrap with default frontmatter
        return `---\ntrigger: glob\n---\n${content}`;
    }
    
    const { frontmatter, body } = parseFrontmatter(content);
    const cursor = frontmatter as CursorFrontmatter;
    
    const antigravity: AntigravityFrontmatter = {
        trigger: determineTrigger(cursor)
    };
    
    if (cursor.globs) {
        antigravity.globs = cursor.globs;
    }
    
    if (cursor.description && antigravity.trigger === 'model_decision') {
        antigravity.description = cursor.description;
    }
    
    return stringifyFrontmatter(antigravity as unknown as Record<string, unknown>) + body;
}

function transformCommandToWorkflow(content: string, sourcePath: string): string {
    const { frontmatter, body } = parseFrontmatter(content);
    
    // If already has description, keep it
    if (frontmatter.description) {
        return content;
    }
    
    // Generate description from filename
    const basename = path.basename(sourcePath, path.extname(sourcePath));
    const description = basename.replace(/[-_]/g, ' ');
    
    return `---\ndescription: ${description}\n---\n${body || content}`;
}

export function getMapping(relativePath: string): FileMapping | undefined {
    return FILE_MAPPINGS.find(m => m.sourcePattern.test(relativePath));
}

// Sync from TextDocument (for save events)
export async function syncFile(document: vscode.TextDocument): Promise<void> {
    const config = getConfig();
    if (!config.enabled) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        return;
    }
    
    const relativePath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);
    const mapping = getMapping(relativePath);
    
    if (!mapping) {
        return;
    }
    
    const content = document.getText();
    await writeToDestination(content, relativePath, mapping, workspaceFolder.uri.fsPath, config);
}

// Sync from URI (for create/change events - reads from disk)
export async function syncFileByUri(uri: vscode.Uri): Promise<void> {
    const config = getConfig();
    if (!config.enabled) {
        return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return;
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    const mapping = getMapping(relativePath);

    if (!mapping) {
        return;
    }

    // Read content from disk
    if (!fs.existsSync(uri.fsPath)) {
        return;
    }

    const content = fs.readFileSync(uri.fsPath, 'utf8');
    await writeToDestination(content, relativePath, mapping, workspaceFolder.uri.fsPath, config);
}

// Common write logic
async function writeToDestination(
    content: string,
    relativePath: string,
    mapping: FileMapping,
    workspaceRoot: string,
    config: ReturnType<typeof getConfig>
): Promise<void> {
    const destPath = mapping.getDestPath(relativePath, workspaceRoot);
    const transformedContent = mapping.transformContent(content, relativePath);
    
    // Check character limit
    if (transformedContent.length > ANTIGRAVITY_CHAR_LIMIT && config.limitBehavior === 'warn') {
        vscode.window.showWarningMessage(
            `Rule "${path.basename(destPath)}" exceeds Antigravity's 12k character limit (${transformedContent.length} chars). Content synced but may not work correctly.`
        );
    }
    
    // Ensure destination directory exists (supports subfolders)
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(destPath, transformedContent, 'utf8');
}

// Handle file rename/move
export async function handleRename(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
    const config = getConfig();
    if (!config.enabled) {
        return;
    }

    // Delete old destination
    await handleDeletion(oldUri, true); // force delete, no ask

    // Sync new location
    await syncFileByUri(newUri);
}

export async function handleDeletion(deletedUri: vscode.Uri, forceDelete: boolean = false): Promise<void> {
    const config = getConfig();
    if (!config.enabled) {
        return;
    }
    
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(deletedUri);
    if (!workspaceFolder) {
        return;
    }
    
    const relativePath = path.relative(workspaceFolder.uri.fsPath, deletedUri.fsPath);
    const mapping = getMapping(relativePath);
    
    if (!mapping) {
        return;
    }
    
    const destPath = mapping.getDestPath(relativePath, workspaceFolder.uri.fsPath);
    
    if (!fs.existsSync(destPath)) {
        return;
    }
    
    const behavior = forceDelete ? 'delete' : config.deletionBehavior;

    switch (behavior) {
        case 'ignore':
            // Do nothing
            break;
        case 'delete':
            fs.unlinkSync(destPath);
            break;
        case 'ask':
            const answer = await vscode.window.showInformationMessage(
                `Source file "${path.basename(relativePath)}" was deleted. Delete synced file "${path.basename(destPath)}"?`,
                'Yes', 'No'
            );
            if (answer === 'Yes') {
                fs.unlinkSync(destPath);
            }
            break;
    }
}
