import { findFilesRecursive, normalizePath, ensureDir } from './helpers';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('findFilesRecursive', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = path.join(os.tmpdir(), 'sceny-test-' + Date.now());
        fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    it('should find files with matching extension', () => {
        fs.writeFileSync(path.join(tempDir, 'file1.md'), 'content');
        fs.writeFileSync(path.join(tempDir, 'file2.md'), 'content');
        fs.writeFileSync(path.join(tempDir, 'file3.txt'), 'content');

        const result = findFilesRecursive(tempDir, '.md');

        expect(result).toHaveLength(2);
        expect(result.every(f => f.endsWith('.md'))).toBe(true);
    });

    it('should find files in subdirectories', () => {
        const subDir = path.join(tempDir, 'sub');
        fs.mkdirSync(subDir);
        fs.writeFileSync(path.join(tempDir, 'root.md'), 'content');
        fs.writeFileSync(path.join(subDir, 'nested.md'), 'content');

        const result = findFilesRecursive(tempDir, '.md');

        expect(result).toHaveLength(2);
    });

    it('should return empty array for non-existent directory', () => {
        const result = findFilesRecursive('/nonexistent/path', '.md');
        
        expect(result).toEqual([]);
    });

    it('should return empty array when no matching files', () => {
        fs.writeFileSync(path.join(tempDir, 'file.txt'), 'content');

        const result = findFilesRecursive(tempDir, '.md');

        expect(result).toEqual([]);
    });
});

describe('normalizePath (helpers)', () => {
    it('should convert backslashes to forward slashes', () => {
        expect(normalizePath('.cursor\\rules\\foo')).toBe('.cursor/rules/foo');
    });
});

describe('ensureDir (helpers)', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = path.join(os.tmpdir(), 'sceny-test-' + Date.now());
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    it('should create directory recursively', () => {
        const nested = path.join(tempDir, 'a', 'b');
        
        ensureDir(nested);
        
        expect(fs.existsSync(nested)).toBe(true);
    });
});
