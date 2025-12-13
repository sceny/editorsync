import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * SyncQueue: Manages async sync operations per file
 * - Queues syncs per file path to prevent concurrency
 * - Skips to latest if multiple syncs pending
 * - Tracks file metadata to skip unchanged files
 */

interface FileMetadata {
    size: number;
    mtime: number;
}

interface QueuedSync {
    execute: () => Promise<void>;
    timestamp: number;
}

class SyncQueue {
    // Per-file async chains
    private chains: Map<string, Promise<void>> = new Map();
    
    // Latest sync metadata per file (to skip unchanged)
    private lastSynced: Map<string, FileMetadata> = new Map();
    
    // Pending syncs per file (only latest matters)
    private pending: Map<string, QueuedSync> = new Map();

    /**
     * Queue a sync operation for a file
     * - If file metadata unchanged, skip
     * - If already pending, replace with latest
     * - Chain operations to prevent concurrency
     */
    async queueSync(filePath: string, syncFn: () => Promise<void>): Promise<void> {
        // Check if file exists and get metadata
        const metadata = this.getFileMetadata(filePath);
        if (!metadata) {
            return; // File doesn't exist
        }
        
        // Skip if metadata unchanged since last sync
        const lastMeta = this.lastSynced.get(filePath);
        if (lastMeta && lastMeta.size === metadata.size && lastMeta.mtime === metadata.mtime) {
            return; // No change
        }
        
        // Store as pending (overwrites any previous pending sync for this file)
        const now = Date.now();
        this.pending.set(filePath, { execute: syncFn, timestamp: now });
        
        // Get or create the chain for this file
        const existingChain = this.chains.get(filePath) || Promise.resolve();
        
        // Add to chain
        const newChain = existingChain.then(async () => {
            // Check if this is still the latest pending sync
            const pendingSync = this.pending.get(filePath);
            if (!pendingSync || pendingSync.timestamp !== now) {
                return; // Skip - newer sync is pending
            }
            
            // Remove from pending
            this.pending.delete(filePath);
            
            // Re-check metadata (may have changed while queued)
            const currentMeta = this.getFileMetadata(filePath);
            if (!currentMeta) {
                return; // File deleted
            }
            
            const lastSyncedMeta = this.lastSynced.get(filePath);
            if (lastSyncedMeta && 
                lastSyncedMeta.size === currentMeta.size && 
                lastSyncedMeta.mtime === currentMeta.mtime) {
                return; // Already synced this version
            }
            
            try {
                await pendingSync.execute();
                // Update last synced metadata
                this.lastSynced.set(filePath, currentMeta);
            } catch (error) {
                console.error(`SyncQueue: Error syncing ${filePath}`, error);
            }
        });
        
        this.chains.set(filePath, newChain);
        
        // Cleanup completed chains
        newChain.finally(() => {
            if (this.chains.get(filePath) === newChain) {
                this.chains.delete(filePath);
            }
        });
    }
    
    /**
     * Clear metadata for a file (e.g., after deletion)
     */
    clearMetadata(filePath: string): void {
        this.lastSynced.delete(filePath);
        this.pending.delete(filePath);
    }
    
    private getFileMetadata(filePath: string): FileMetadata | null {
        try {
            const stats = fs.statSync(filePath);
            return {
                size: stats.size,
                mtime: stats.mtimeMs
            };
        } catch {
            return null;
        }
    }
}

// Singleton instance
export const syncQueue = new SyncQueue();
