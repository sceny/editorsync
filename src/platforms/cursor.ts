/**
 * Cursor Platform Implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import { IntermediateRule, IntermediateWorkflow } from '../model';
import { parseFrontmatter } from '../transforms';
import { Platform } from './types';
import { findFilesRecursive, ensureDir } from './helpers';

function exportRules(workspaceRoot: string): IntermediateRule[] {
    const rules: IntermediateRule[] = [];

    // .cursorrules (legacy)
    const legacyPath = path.join(workspaceRoot, '.cursorrules');
    if (fs.existsSync(legacyPath)) {
        const content = fs.readFileSync(legacyPath, 'utf8');
        rules.push({
            name: 'cursorrules',
            trigger: 'glob',
            content: content,
            source: 'cursor',
            sourcePath: legacyPath
        });
    }

    // .cursor/rules/*.mdc and *.md
    const rulesDir = path.join(workspaceRoot, '.cursor', 'rules');
    const files = [
        ...findFilesRecursive(rulesDir, '.mdc'),
        ...findFilesRecursive(rulesDir, '.md')
    ];

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const { frontmatter, body } = parseFrontmatter(content);
        const name = path.relative(rulesDir, file).replace(/(\\.mdc|\\.md)$/, '');

        let trigger: 'always' | 'glob' | 'model_decision' = 'glob';
        if (frontmatter.alwaysApply === true) trigger = 'always';
        else if (frontmatter.description && !frontmatter.globs) trigger = 'model_decision';

        rules.push({
            name,
            trigger,
            globs: frontmatter.globs ? [frontmatter.globs as string] : undefined,
            description: frontmatter.description as string | undefined,
            content: body,
            source: 'cursor',
            sourcePath: file
        });
    }

    return rules;
}

function exportWorkflows(workspaceRoot: string): IntermediateWorkflow[] {
    const workflows: IntermediateWorkflow[] = [];
    const commandsDir = path.join(workspaceRoot, '.cursor', 'commands');
    const files = findFilesRecursive(commandsDir, '.md');

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const { frontmatter, body } = parseFrontmatter(content);
        const name = path.relative(commandsDir, file).replace(/\\.md$/, '');

        workflows.push({
            name,
            description: (frontmatter.description as string) || name.replace(/[-_]/g, ' '),
            content: body || content,
            source: 'cursor',
            sourcePath: file
        });
    }

    return workflows;
}

function importRules(rules: IntermediateRule[], workspaceRoot: string): string[] {
    const rulesDir = path.join(workspaceRoot, '.cursor', 'rules');
    ensureDir(rulesDir);
    const writtenPaths: string[] = [];

    for (const rule of rules) {
        if (rule.source === 'cursor') continue;

        const lines: string[] = [];
        if (rule.trigger === 'always') lines.push('alwaysApply: true');
        else lines.push('alwaysApply: false');
        if (rule.globs?.length) lines.push(`globs: ${rule.globs[0]}`);
        if (rule.description) lines.push(`description: ${rule.description}`);

        const frontmatter = lines.length ? `---\\n${lines.join('\\n')}\\n---\\n` : '';
        const content = frontmatter + rule.content;

        const filePath = path.join(rulesDir, `${rule.name}.mdc`);
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, content, 'utf8');
        writtenPaths.push(filePath);
    }
    return writtenPaths;
}

function importWorkflows(workflows: IntermediateWorkflow[], workspaceRoot: string): string[] {
    const commandsDir = path.join(workspaceRoot, '.cursor', 'commands');
    ensureDir(commandsDir);
    const writtenPaths: string[] = [];

    for (const wf of workflows) {
        if (wf.source === 'cursor') continue;

        const content = `---\\ndescription: ${wf.description}\\n---\\n${wf.content}`;
        const filePath = path.join(commandsDir, `${wf.name}.md`);
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, content, 'utf8');
        writtenPaths.push(filePath);
    }
    return writtenPaths;
}

export const cursorPlatform: Platform = {
    id: 'cursor',
    name: 'Cursor',
    rulesDir: '.cursor/rules',
    workflowsDir: '.cursor/commands',
    exportRules,
    exportWorkflows,
    importRules,
    importWorkflows
};
