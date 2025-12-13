import * as path from 'path';
import { PlatformId } from './platforms';

/**
 * Content transformers for converting between platform formats
 * 
 * Each transform function converts content FROM a source platform TO a target platform.
 * Transform key format: `${sourceId}-to-${targetId}`
 */

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

// Simple YAML frontmatter parser
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
        return { frontmatter: {}, body: content };
    }
    
    const frontmatterStr = match[1];
    const body = match[2];
    const frontmatter: Record<string, unknown> = {};
    
    for (const line of frontmatterStr.split(/\r?\n/)) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value: unknown = line.substring(colonIndex + 1).trim();
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
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

// Cursor → Antigravity
function cursorToAntigravityRule(content: string, hasExistingFrontmatter: boolean): string {
    if (!hasExistingFrontmatter) {
        return `---\ntrigger: glob\n---\n${content}`;
    }
    
    const { frontmatter, body } = parseFrontmatter(content);
    const cursor = frontmatter as CursorFrontmatter;
    
    let trigger: AntigravityTrigger;
    if (cursor.alwaysApply === true) {
        trigger = 'always';
    } else if (cursor.globs) {
        trigger = 'glob';
    } else if (cursor.description) {
        trigger = 'model_decision';
    } else {
        trigger = 'glob';
    }
    
    const antigravity: AntigravityFrontmatter = { trigger };
    if (cursor.globs) antigravity.globs = cursor.globs;
    if (cursor.description && trigger === 'model_decision') {
        antigravity.description = cursor.description;
    }
    
    return stringifyFrontmatter(antigravity as unknown as Record<string, unknown>) + body;
}

// Antigravity → Cursor
function antigravityToCursorRule(content: string): string {
    const { frontmatter, body } = parseFrontmatter(content);
    const trigger = frontmatter.trigger as string | undefined;
    const globs = frontmatter.globs as string | undefined;
    const description = frontmatter.description as string | undefined;
    
    const cursor: CursorFrontmatter = {};
    
    if (trigger === 'always') {
        cursor.alwaysApply = true;
    } else {
        cursor.alwaysApply = false;
    }
    
    if (globs) cursor.globs = globs;
    if (description) cursor.description = description;
    
    return stringifyFrontmatter(cursor as unknown as Record<string, unknown>) + body;
}

// Workflow transforms (simpler - just ensure description exists)
function cursorToAntigravityWorkflow(content: string, sourcePath: string): string {
    const { frontmatter, body } = parseFrontmatter(content);
    if (frontmatter.description) return content;
    
    const basename = path.basename(sourcePath, path.extname(sourcePath));
    const description = basename.replace(/[-_]/g, ' ');
    return `---\ndescription: ${description}\n---\n${body || content}`;
}

function antigravityToCursorWorkflow(content: string): string {
    // Cursor commands don't require specific frontmatter
    return content;
}

/**
 * Transform content from source platform to target platform
 */
export function transformContent(
    content: string,
    sourcePath: string,
    source: PlatformId,
    target: PlatformId,
    isWorkflow: boolean
): string {
    const key = `${source}-to-${target}`;
    
    if (isWorkflow) {
        switch (key) {
            case 'cursor-to-antigravity':
                return cursorToAntigravityWorkflow(content, sourcePath);
            case 'antigravity-to-cursor':
                return antigravityToCursorWorkflow(content);
            default:
                return content;
        }
    } else {
        const hasFrontmatter = content.trimStart().startsWith('---');
        switch (key) {
            case 'cursor-to-antigravity':
                return cursorToAntigravityRule(content, hasFrontmatter);
            case 'antigravity-to-cursor':
                return antigravityToCursorRule(content);
            default:
                return content;
        }
    }
}
