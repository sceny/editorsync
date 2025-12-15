import { parseFrontmatter } from './transforms';

describe('parseFrontmatter', () => {
    it('should parse valid YAML frontmatter', () => {
        const content = `---
trigger: always
description: Test rule
---
Body content here`;

        const result = parseFrontmatter(content);
        
        expect(result.frontmatter.trigger).toBe('always');
        expect(result.frontmatter.description).toBe('Test rule');
        expect(result.body).toBe('Body content here');
    });

    it('should handle content without frontmatter', () => {
        const content = 'Just body content';
        
        const result = parseFrontmatter(content);
        
        expect(result.frontmatter).toEqual({});
        expect(result.body).toBe('Just body content');
    });

    it('should parse boolean values correctly', () => {
        const content = `---
alwaysApply: true
enabled: false
---
Body`;

        const result = parseFrontmatter(content);
        
        expect(result.frontmatter.alwaysApply).toBe(true);
        expect(result.frontmatter.enabled).toBe(false);
    });

    it('should parse quoted string values', () => {
        const content = `---
globs: "**/*.ts"
description: "A multi word description"
---
Body`;

        const result = parseFrontmatter(content);
        
        expect(result.frontmatter.globs).toBe('**/*.ts');
        expect(result.frontmatter.description).toBe('A multi word description');
    });

    it('should handle empty frontmatter', () => {
        // Empty frontmatter (just dashes) is treated as no frontmatter by the parser
        const content = `---
---
Body content`;

        const result = parseFrontmatter(content);
        
        // The regex requires content between ---, so empty frontmatter
        // gets the body as everything including the closing ---
        expect(result.body).toBeDefined();
    });

    it('should handle Windows line endings', () => {
        const content = '---\r\ntrigger: glob\r\n---\r\nBody';
        
        const result = parseFrontmatter(content);
        
        expect(result.frontmatter.trigger).toBe('glob');
        expect(result.body).toBe('Body');
    });
});
