import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { normalizePath } from './utils';

/**
 * SyncJournal: Tracks files written by this extension
 * 
 * Simple approach: Any file written by the extension is tracked.
 * Before syncing, check if the triggering file was just written by us.
 * If file matches our recorded state, skip to prevent loops.
 */

interface FileRecord {
    size: number;
    mtime: number;
    writtenAt: number;
}

interface JournalData {
    version: 1;
    /** All files written by this extension (for loop detection) */
    files: Record<string, FileRecord>;
}

const JOURNAL_DIR = '.rulessync';
const JOURNAL_FILE = 'journal.json';

export class SyncJournal {
    private workspaceRoot: string;
    private data: JournalData;
    private dirty: boolean = false;
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.data = this.load();
    }
    
    private get journalPath(): string {
        return path.join(this.workspaceRoot, JOURNAL_DIR, JOURNAL_FILE);
    }
    
    private load(): JournalData {
        try {
            if (fs.existsSync(this.journalPath)) {
                const content = fs.readFileSync(this.journalPath, 'utf8');
                const data = JSON.parse(content);
                // Migrate older versions
                if (data.version < 1) {
                    return { version: 1, files: {} };
                }
                return data;
            }
        } catch (error) {
            console.error('SyncJournal: Error loading journal', error);
        }
        return { version: 1, files: {} };
    }
    
    /**
     * Check if a file change should be skipped (was just written by us)
     * Returns true if the file matches our recorded write state
     */
    wasWrittenByUs(filePath: string): boolean {
        const relativePath = normalizePath(path.relative(this.workspaceRoot, filePath));
        const record = this.data.files[relativePath];
        
        if (!record) {
            logger.info(`Journal: No record for ${relativePath}`);
            return false;
        }
        
        try {
            const stats = fs.statSync(filePath);
            const timeDiff = Math.abs(stats.mtimeMs - record.mtime);
            const sizeMatch = stats.size === record.size;
            const timeMatch = timeDiff < 2000;

            if (!sizeMatch || !timeMatch) {
                logger.info(`Journal mismatch for ${relativePath}:`, {
                    currentSize: stats.size,
                    recordedSize: record.size,
                    currentMtime: stats.mtimeMs,
                    recordedMtime: record.mtime,
                    timeDiff,
                    match: sizeMatch && timeMatch
                });
            }

            return sizeMatch && timeMatch;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Record that we wrote a file
     */
    recordWrite(filePath: string): void {
        const relativePath = normalizePath(path.relative(this.workspaceRoot, filePath));
        
        try {
            const stats = fs.statSync(filePath);
            this.data.files[relativePath] = {
                size: stats.size,
                mtime: stats.mtimeMs,
                writtenAt: Date.now()
            };
            this.dirty = true;
            logger.info(`Journal recorded ${relativePath}`, { size: stats.size, mtime: stats.mtimeMs });
        } catch (error) {
            console.error(`SyncJournal: Error recording write for ${filePath}`, error);
        }
    }
    
    /**
     * Remove a file from tracking (after deletion)
     */
    removeFile(filePath: string): void {
        const relativePath = normalizePath(path.relative(this.workspaceRoot, filePath));
        if (this.data.files[relativePath]) {
            delete this.data.files[relativePath];
            this.dirty = true;
        }
    }
    
    /**
     * Clean up old entries (files that no longer exist or are stale)
     */
    cleanup(): void {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [relativePath, record] of Object.entries(this.data.files)) {
            const fullPath = path.join(this.workspaceRoot, relativePath);
            // Remove if file doesn't exist or record is older than 24h
            if (!fs.existsSync(fullPath) || (now - record.writtenAt) > maxAge) {
                delete this.data.files[relativePath];
                this.dirty = true;
            }
        }
    }
    
    /**
     * Save the journal to disk
     */
    save(): void {
        if (!this.dirty) return;
        
        try {
            const dir = path.join(this.workspaceRoot, JOURNAL_DIR);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.journalPath, JSON.stringify(this.data, null, 2), 'utf8');
            this.dirty = false;
        } catch (error) {
            console.error('SyncJournal: Error saving journal', error);
        }
    }
}

// Cache of journals per workspace
const journals: Map<string, SyncJournal> = new Map();

export function getJournal(workspaceRoot: string): SyncJournal {
    let journal = journals.get(workspaceRoot);
    if (!journal) {
        journal = new SyncJournal(workspaceRoot);
        journals.set(workspaceRoot, journal);
    }
    return journal;
}
