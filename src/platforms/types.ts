/**
 * Platform type definitions
 */

import { IntermediateRule, IntermediateWorkflow } from '../model';

export type PlatformId = 'cursor' | 'antigravity' | 'vscode';

export interface Platform {
    id: PlatformId;
    name: string;

    /** Directories/files to scan for rules */
    rulesDir: string | string[];
    workflowsDir?: string;

    /** Export: Read platform files → Intermediate model */
    exportRules: (workspaceRoot: string) => IntermediateRule[];
    exportWorkflows: (workspaceRoot: string) => IntermediateWorkflow[];

    /** Import: Intermediate model → Write platform files, returns written paths */
    importRules: (rules: IntermediateRule[], workspaceRoot: string) => string[];
    importWorkflows: (workflows: IntermediateWorkflow[], workspaceRoot: string) => string[];
}
