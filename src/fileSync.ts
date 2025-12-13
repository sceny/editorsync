import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig, ANTIGRAVITY_CHAR_LIMIT } from './config';

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
    // .cursor/rules/*.mdc -> .agent/rules/*.md
    {
        sourcePattern: /^\.cursor[\/\\]rules[\/\\](.+)\.mdc$/,
        getDestPath: (sourcePath, root) => {
            const match = sourcePath.match(/^\.cursor[\/\\]rules[\/\\](.+)\.mdc$/);
            const basename = match ? match[1] : 'rule';
            return path.join(root, '.agent', 'rules', `${basename}.md`);
        },
        transformContent: (content) => transformCursorToAntigravity(content, true)
    },
    // .cursor/commands/*.md -> .agent/workflows/*.md
    {
        sourcePattern: /^\.cursor[\/\\]commands[\/\\](.+)\.md$/,
        getDestPath: (sourcePath, root) => {
            const match = sourcePath.match(/^\.cursor[\/\\]commands[\/\\](.+)\.md$/);
            const basename = match ? match[1] : 'workflow';
            return path.join(root, '.agent', 'workflows', `${basename}.md`);
        },
        transformContent: (content, sourcePath) => transformCommandToWorkflow(content, sourcePath)
    }
];

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
    const destPath = mapping.getDestPath(relativePath, workspaceFolder.uri.fsPath);
    const transformedContent = mapping.transformContent(content, relativePath);
    
    // Check character limit
    if (transformedContent.length > ANTIGRAVITY_CHAR_LIMIT && config.limitBehavior === 'warn') {
        vscode.window.showWarningMessage(
            `Rule "${path.basename(destPath)}" exceeds Antigravity's 12k character limit (${transformedContent.length} chars). Content synced but may not work correctly.`
        );
    }
    
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(destPath, transformedContent, 'utf8');
}

export async function handleDeletion(deletedUri: vscode.Uri): Promise<void> {
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
    
    switch (config.deletionBehavior) {
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
