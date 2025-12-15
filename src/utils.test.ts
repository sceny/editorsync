import { normalizePath, ensureDir, safeUnlink } from './utils';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
        expect(normalizePath('foo\\bar\\baz')).toBe('foo/bar/baz');
    });

    it('should leave forward slashes unchanged', () => {
        expect(normalizePath('foo/bar/baz')).toBe('foo/bar/baz');
    });

    it('should handle mixed slashes', () => {
        expect(normalizePath('foo\\bar/baz\\qux')).toBe('foo/bar/baz/qux');
    });

    it('should handle empty string', () => {
        expect(normalizePath('')).toBe('');
    });
});

describe('ensureDir', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = path.join(os.tmpdir(), 'sceny-test-' + Date.now());
    });

    afterEach(() => {
        // Cleanup
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    it('should create directory if it does not exist', () => {
        const testDir = path.join(tempDir, 'subdir');
        
        ensureDir(testDir);
        
        expect(fs.existsSync(testDir)).toBe(true);
    });

    it('should not throw if directory already exists', () => {
        fs.mkdirSync(tempDir, { recursive: true });
        
        expect(() => ensureDir(tempDir)).not.toThrow();
    });

    it('should create nested directories', () => {
        const nestedDir = path.join(tempDir, 'a', 'b', 'c');
        
        ensureDir(nestedDir);
        
        expect(fs.existsSync(nestedDir)).toBe(true);
    });
});

describe('safeUnlink', () => {
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

    it('should delete existing file and return true', () => {
        const filePath = path.join(tempDir, 'test.txt');
        fs.writeFileSync(filePath, 'content');
        
        const result = safeUnlink(filePath);
        
        expect(result).toBe(true);
        expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should return false for non-existent file', () => {
        const filePath = path.join(tempDir, 'nonexistent.txt');
        
        const result = safeUnlink(filePath);
        
        expect(result).toBe(false);
    });
});
