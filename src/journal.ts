import * as fs from 'fs';
import * as path from 'path';

/**
 * SyncJournal: Persists sync metadata to .rulessync/journal.json
 * - Tracks file size/mtime for each synced file
 * - Used on activation to only sync files that have changed since last sync
 */

interface FileEntry {
    size: number;
    mtime: number;
    syncedAt: number;
}

interface JournalData {
    version: 1;
    files: Record<string, FileEntry>;
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
                return JSON.parse(content);
            }
        } catch (error) {
            console.error('SyncJournal: Error loading journal', error);
        }
        return { version: 1, files: {} };
    }
    
    /**
     * Check if a file needs syncing based on metadata
     */
    needsSync(filePath: string): boolean {
        const relativePath = path.relative(this.workspaceRoot, filePath);
        const entry = this.data.files[relativePath];
        
        if (!entry) {
            return true; // Never synced
        }
        
        try {
            const stats = fs.statSync(filePath);
            return stats.size !== entry.size || stats.mtimeMs !== entry.mtime;
        } catch {
            return false; // File doesn't exist
        }
    }
    
    /**
     * Record that a file was synced
     */
    recordSync(filePath: string): void {
        const relativePath = path.relative(this.workspaceRoot, filePath);
        
        try {
            const stats = fs.statSync(filePath);
            this.data.files[relativePath] = {
                size: stats.size,
                mtime: stats.mtimeMs,
                syncedAt: Date.now()
            };
            this.dirty = true;
        } catch (error) {
            console.error(`SyncJournal: Error recording sync for ${filePath}`, error);
        }
    }
    
    /**
     * Remove a file from the journal (after deletion)
     */
    removeEntry(filePath: string): void {
        const relativePath = path.relative(this.workspaceRoot, filePath);
        delete this.data.files[relativePath];
        this.dirty = true;
    }
    
    /**
     * Check if journal is empty (first sync scenario)
     */
    isEmpty(): boolean {
        return Object.keys(this.data.files).length === 0;
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
