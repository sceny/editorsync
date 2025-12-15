/**
 * VS Code Platform Implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import { IntermediateRule, IntermediateWorkflow } from '../model';
import { parseFrontmatter } from '../transforms';
import { Platform } from './types';
import { findFilesRecursive, ensureDir } from './helpers';

function exportRules(workspaceRoot: string): IntermediateRule[] {
    const rules: IntermediateRule[] = [];

    // .github/copilot-instructions.md (global instructions)
    const globalPath = path.join(workspaceRoot, '.github', 'copilot-instructions.md');
    if (fs.existsSync(globalPath)) {
        const content = fs.readFileSync(globalPath, 'utf8');
        rules.push({
            name: 'copilot-instructions',
            trigger: 'always',
            content: content,
            source: 'vscode',
            sourcePath: globalPath
        });
    }

    // .github/instructions/*.instructions.md (scoped instructions)
    const instructionsDir = path.join(workspaceRoot, '.github', 'instructions');
    const files = findFilesRecursive(instructionsDir, '.instructions.md');

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const { frontmatter, body } = parseFrontmatter(content);
        const name = path.relative(instructionsDir, file).replace(/\.instructions\.md$/, '');

        const applyTo = frontmatter.applyTo as string | undefined;

        rules.push({
            name,
            trigger: applyTo ? 'glob' : 'always',
            globs: applyTo ? [applyTo] : undefined,
            description: frontmatter.description as string | undefined,
            content: body || content,
            source: 'vscode',
            sourcePath: file
        });
    }

    return rules;
}

function exportWorkflows(_workspaceRoot: string): IntermediateWorkflow[] {
    // VS Code doesn't have a workflows concept
    return [];
}

function importRules(rules: IntermediateRule[], workspaceRoot: string): string[] {
    const writtenPaths: string[] = [];
    if (rules.length === 0) return writtenPaths;

    const rulesToImport = rules.filter(r => r.source !== 'vscode');
    if (rulesToImport.length === 0) return writtenPaths;

    const instructionsDir = path.join(workspaceRoot, '.github', 'instructions');
    ensureDir(instructionsDir);

    for (const rule of rulesToImport) {
        const lines: string[] = [];

        if (rule.trigger === 'glob' && rule.globs?.length) {
            lines.push(`applyTo: "${rule.globs.join(',')}"`);
        }

        if (rule.description) {
            lines.push(`description: "${rule.description}"`);
        }

        const frontmatter = lines.length ? `---\n${lines.join('\n')}\n---\n` : '';
        const content = frontmatter + rule.content;

        const filePath = path.join(instructionsDir, `${rule.name}.instructions.md`);
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, content, 'utf8');
        writtenPaths.push(filePath);
    }
    return writtenPaths;
}

function importWorkflows(_workflows: IntermediateWorkflow[], _workspaceRoot: string): string[] {
    // VS Code doesn't have a workflows concept
    return [];
}

export const vscodePlatform: Platform = {
    id: 'vscode',
    name: 'VS Code',
    rulesDir: '.github',
    exportRules,
    exportWorkflows,
    importRules,
    importWorkflows
};
