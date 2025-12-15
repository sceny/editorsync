/**
 * Intermediate Model - Common format for all platforms
 * 
 * All platforms export to this format, and import from it.
 * This reduces N×(N-1) transforms to 2N transforms.
 */

export interface IntermediateRule {
    /** Unique name (typically filename without extension) */
    name: string;
    
    /** When this rule should be applied */
    trigger: 'always' | 'glob' | 'model_decision' | 'manual';
    
    /** Glob patterns for file-scoped rules */
    globs?: string[];
    
    /** Description for model_decision trigger */
    description?: string;
    
    /** Markdown content body */
    content: string;
    
    /** Source platform this rule came from */
    source: string;
    
    /** Absolute path of the source file (for journal tracking) */
    sourcePath?: string;
}

export interface IntermediateWorkflow {
    /** Unique name (typically filename without extension) */
    name: string;
    
    /** Description of what this workflow does */
    description: string;
    
    /** Markdown content body */
    content: string;
    
    /** Source platform this workflow came from */
    source: string;
    
    /** Absolute path of the source file (for journal tracking) */
    sourcePath?: string;
}

export interface IntermediateModel {
    rules: IntermediateRule[];
    workflows: IntermediateWorkflow[];
}

/**
 * Create an empty intermediate model
 */
export function createEmptyModel(): IntermediateModel {
    return { rules: [], workflows: [] };
}

/**
 * Merge multiple models (useful for combining from multiple sources)
 */
export function mergeModels(...models: IntermediateModel[]): IntermediateModel {
    const rules: IntermediateRule[] = [];
    const workflows: IntermediateWorkflow[] = [];
    
    for (const model of models) {
        rules.push(...model.rules);
        workflows.push(...model.workflows);
    }
    
    // Deduplicate by name (keep first occurrence)
    const uniqueRules = rules.filter((rule, index, self) => 
        index === self.findIndex(r => r.name === rule.name)
    );
    const uniqueWorkflows = workflows.filter((wf, index, self) => 
        index === self.findIndex(w => w.name === wf.name)
    );
    
    return { rules: uniqueRules, workflows: uniqueWorkflows };
}
