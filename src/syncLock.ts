import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { ensureGitignore, ensureDir } from './utils';

const LOCK_FILE = '.rulessync/sync.lock';
const STALE_LOCK_MS = 60000; // 60 seconds = stale (safety net only)
const MAX_WAIT_MS = 120000; // 2 minute absolute max wait

/**
 * Sync lock manager - ensures only one sync operation runs at a time
 * 
 * Uses fs.watch to react immediately when the lock is released, instead of polling.
 * Handles multiple editors (3+) competing for the lock - first to create wins,
 * others wait for deletion and retry.
 */
export class SyncLock {
    private workspaceRoot: string;
    private lockPath: string;
    private held: boolean = false;
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.lockPath = path.join(workspaceRoot, LOCK_FILE);
    }
    
    /**
     * Ensure .gitignore includes lock file and other rulessync files
     */
    private setupGitignore(): void {
        const rulessyncDir = path.join(this.workspaceRoot, '.rulessync');
        ensureGitignore(rulessyncDir, ['logs/', 'sync.lock', 'journal.json']);
    }
    
    /**
     * Check if lock file exists and is not stale
     */
    private isLocked(): boolean {
        if (!fs.existsSync(this.lockPath)) {
            return false;
        }
        
        try {
            const stats = fs.statSync(this.lockPath);
            // If lock is older than STALE_LOCK_MS, consider it stale
            if (Date.now() - stats.mtimeMs > STALE_LOCK_MS) {
                logger.warn('Removing stale lock file', { age: Date.now() - stats.mtimeMs });
                try {
                    fs.unlinkSync(this.lockPath);
                } catch (e) {
                    // Someone else removed it, that's fine
                    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
                }
                return false;
            }
            return true;
        } catch (e) {
            // File doesn't exist or was removed
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
                return false;
            }
            throw e;
        }
    }
    
    /**
     * Wait for lock to be released using fs.watch
     * Returns immediately when the lock file is deleted
     */
    private waitForUnlock(): Promise<void> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const lockDir = path.dirname(this.lockPath);
            const lockFileName = path.basename(this.lockPath);
            
            // Ensure directory exists for watcher
            if (!fs.existsSync(lockDir)) {
                fs.mkdirSync(lockDir, { recursive: true });
            }
            
            // Double-check lock still exists
            if (!this.isLocked()) {
                resolve();
                return;
            }
            
            let watcher: fs.FSWatcher | null = null;
            let timeoutId: NodeJS.Timeout | null = null;
            
            const cleanup = () => {
                if (watcher) {
                    watcher.close();
                    watcher = null;
                }
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
            };
            
            // Watch the directory for changes to the lock file
            watcher = fs.watch(lockDir, (eventType, filename) => {
                if (filename === lockFileName) {
                    // Lock file changed - check if it was deleted
                    if (!this.isLocked()) {
                        cleanup();
                        resolve();
                    }
                }
            });
            
            watcher.on('error', (err) => {
                cleanup();
                logger.warn('Lock watcher error, falling back', { error: String(err) });
                resolve(); // Continue anyway
            });
            
            // Safety timeout - absolute max wait
            timeoutId = setTimeout(() => {
                cleanup();
                logger.warn('Lock wait timeout exceeded', { waited: Date.now() - startTime });
                reject(new Error('Lock wait timeout'));
            }, MAX_WAIT_MS);
            
            // Also poll occasionally as a fallback (in case watcher misses events)
            const fallbackCheck = setInterval(() => {
                if (!this.isLocked()) {
                    clearInterval(fallbackCheck);
                    cleanup();
                    resolve();
                }
            }, 1000);
            
            // Cleanup interval when done
            const originalCleanup = cleanup;
            const cleanupWithInterval = () => {
                clearInterval(fallbackCheck);
                originalCleanup();
            };
            // Replace cleanup
            watcher.on('close', () => clearInterval(fallbackCheck));
        });
    }
    
    /**
     * Try to atomically create the lock file
     * Returns true if we successfully created the lock
     */
    private tryCreateLock(): boolean {
        const lockDir = path.dirname(this.lockPath);
        if (!fs.existsSync(lockDir)) {
            fs.mkdirSync(lockDir, { recursive: true });
        }
        
        try {
            // Use 'wx' flag for exclusive create - fails if file exists
            fs.writeFileSync(this.lockPath, `${process.pid}\n${Date.now()}`, { flag: 'wx' });
            return true;
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
                return false; // Lock exists, someone else has it
            }
            throw e;
        }
    }
    
    /**
     * Acquire the lock - wait if necessary
     */
    async acquire(): Promise<boolean> {
        this.setupGitignore();
        
        const startTime = Date.now();
        let attempts = 0;
        
        while (true) {
            attempts++;
            
            // Try to create the lock
            if (this.tryCreateLock()) {
                this.held = true;
                logger.debug('Lock acquired', { attempts, waited: Date.now() - startTime });
                return true;
            }
            
            // Lock exists - check if it's stale
            if (!this.isLocked()) {
                // Lock was stale and removed, or doesn't exist - retry immediately
                continue;
            }
            
            // Wait for lock to be released
            logger.debug('Waiting for lock', { attempt: attempts });
            try {
                await this.waitForUnlock();
            } catch (e) {
                // Timeout or error - give up
                logger.error('Failed to acquire lock', { error: String(e) });
                return false;
            }
            
            // Loop back to try creating lock again
            // (another editor might have grabbed it before us)
        }
    }
    
    /**
     * Release the lock
     */
    release(): void {
        if (this.held) {
            try {
                fs.unlinkSync(this.lockPath);
            } catch (e) {
                // Ignore ENOENT - file already gone
                if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                    logger.warn('Error releasing lock', { error: String(e) });
                }
            }
            this.held = false;
            logger.debug('Lock released');
        }
    }
    
    /**
     * Run a function with the lock held
     */
    async withLock<T>(fn: () => Promise<T>): Promise<T | null> {
        const acquired = await this.acquire();
        if (!acquired) {
            return null;
        }
        
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
}

// Cache of locks per workspace
const locks: Map<string, SyncLock> = new Map();

export function getSyncLock(workspaceRoot: string): SyncLock {
    let lock = locks.get(workspaceRoot);
    if (!lock) {
        lock = new SyncLock(workspaceRoot);
        locks.set(workspaceRoot, lock);
    }
    return lock;
}
