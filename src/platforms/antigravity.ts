/**
 * Antigravity Platform Implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import { IntermediateRule, IntermediateWorkflow } from '../model';
import { parseFrontmatter } from '../transforms';
import { Platform } from './types';
import { findFilesRecursive, ensureDir } from './helpers';

function exportRules(workspaceRoot: string): IntermediateRule[] {
    const rules: IntermediateRule[] = [];
    const rulesDir = path.join(workspaceRoot, '.agent', 'rules');
    const files = findFilesRecursive(rulesDir, '.md');

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const { frontmatter, body } = parseFrontmatter(content);
        const name = path.relative(rulesDir, file).replace(/\.md$/, '');

        rules.push({
            name,
            trigger: (frontmatter.trigger as 'always' | 'glob' | 'model_decision' | 'manual') || 'glob',
            globs: frontmatter.globs ? [frontmatter.globs as string] : undefined,
            description: frontmatter.description as string | undefined,
            content: body,
            source: 'antigravity',
            sourcePath: file
        });
    }

    return rules;
}

function exportWorkflows(workspaceRoot: string): IntermediateWorkflow[] {
    const workflows: IntermediateWorkflow[] = [];
    const workflowsDir = path.join(workspaceRoot, '.agent', 'workflows');
    const files = findFilesRecursive(workflowsDir, '.md');

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const { frontmatter, body } = parseFrontmatter(content);
        const name = path.relative(workflowsDir, file).replace(/\.md$/, '');

        workflows.push({
            name,
            description: (frontmatter.description as string) || name.replace(/[-_]/g, ' '),
            content: body || content,
            source: 'antigravity',
            sourcePath: file
        });
    }

    return workflows;
}

function importRules(rules: IntermediateRule[], workspaceRoot: string): string[] {
    const rulesDir = path.join(workspaceRoot, '.agent', 'rules');
    ensureDir(rulesDir);
    const writtenPaths: string[] = [];

    for (const rule of rules) {
        if (rule.source === 'antigravity') continue;

        const lines: string[] = [`trigger: ${rule.trigger}`];
        if (rule.globs?.length) lines.push(`globs: ${rule.globs[0]}`);
        if (rule.description && rule.trigger === 'model_decision') {
            lines.push(`description: ${rule.description}`);
        }

        const frontmatter = `---\n${lines.join('\n')}\n---\n`;
        const content = frontmatter + rule.content;

        const filePath = path.join(rulesDir, `${rule.name}.md`);
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, content, 'utf8');
        writtenPaths.push(filePath);
    }
    return writtenPaths;
}

function importWorkflows(workflows: IntermediateWorkflow[], workspaceRoot: string): string[] {
    const workflowsDir = path.join(workspaceRoot, '.agent', 'workflows');
    ensureDir(workflowsDir);
    const writtenPaths: string[] = [];

    for (const wf of workflows) {
        if (wf.source === 'antigravity') continue;

        const content = `---\ndescription: ${wf.description}\n---\n${wf.content}`;
        const filePath = path.join(workflowsDir, `${wf.name}.md`);
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, content, 'utf8');
        writtenPaths.push(filePath);
    }
    return writtenPaths;
}

export const antigravityPlatform: Platform = {
    id: 'antigravity',
    name: 'Antigravity',
    rulesDir: '.agent/rules',
    workflowsDir: '.agent/workflows',
    exportRules,
    exportWorkflows,
    importRules,
    importWorkflows
};
