/**
 * SyncQueueService
 * Manages the synchronization queue for offline captures
 * Handles retry logic with exponential backoff
 */

import { offlineStorage } from './OfflineStorageService';
import { PendingCapture, DEFAULT_OFFLINE_CONFIG, OfflineStorageEvent } from './types';
import api from '../api';

type EventListener = (event: OfflineStorageEvent) => void;

class SyncQueueService {
    private isSyncing: boolean = false;
    private syncInterval: NodeJS.Timeout | null = null;
    private listeners: Set<EventListener> = new Set();
    private config = DEFAULT_OFFLINE_CONFIG;

    /**
     * Add event listener for sync events
     */
    addEventListener(listener: EventListener): void {
        this.listeners.add(listener);
    }

    /**
     * Remove event listener
     */
    removeEventListener(listener: EventListener): void {
        this.listeners.delete(listener);
    }

    /**
     * Emit event to all listeners
     */
    private emit(event: OfflineStorageEvent): void {
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('[SyncQueue] Error in event listener:', error);
            }
        });
    }

    /**
     * Check if currently syncing
     */
    getIsSyncing(): boolean {
        return this.isSyncing;
    }

    /**
     * Start auto-sync when online
     */
    startAutoSync(intervalMs: number = 30000): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        // Listen for online event
        window.addEventListener('online', this.handleOnline);

        // Periodic sync check
        this.syncInterval = setInterval(() => {
            if (navigator.onLine && !this.isSyncing) {
                this.processQueue();
            }
        }, intervalMs);

        console.log('[SyncQueue] Auto-sync started');

        // Initial sync if online
        if (navigator.onLine) {
            this.processQueue();
        }
    }

    /**
     * Stop auto-sync
     */
    stopAutoSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        window.removeEventListener('online', this.handleOnline);
        console.log('[SyncQueue] Auto-sync stopped');
    }

    /**
     * Handle online event
     */
    private handleOnline = (): void => {
        console.log('[SyncQueue] Network online, starting sync...');
        this.processQueue();
    };

    /**
     * Process the sync queue
     */
    async processQueue(): Promise<{ success: number; failed: number }> {
        if (this.isSyncing) {
            console.log('[SyncQueue] Sync already in progress');
            return { success: 0, failed: 0 };
        }

        if (!navigator.onLine) {
            console.log('[SyncQueue] Offline, skipping sync');
            return { success: 0, failed: 0 };
        }

        this.isSyncing = true;
        this.emit({ type: 'sync_started' });

        let successCount = 0;
        let failedCount = 0;

        try {
            // Get all pending captures
            const pendingCaptures = await offlineStorage.getPendingCaptures();
            console.log(`[SyncQueue] Processing ${pendingCaptures.length} pending captures`);

            // Group by task for batch processing
            const capturesByTask = this.groupByTask(pendingCaptures);

            for (const [taskId, captures] of Object.entries(capturesByTask)) {
                const result = await this.syncTaskCaptures(taskId, captures);
                successCount += result.success;
                failedCount += result.failed;
            }

            // Also retry failed captures
            const failedCaptures = await offlineStorage.getFailedCaptures();
            const retryable = failedCaptures.filter(
                c => c.retryCount < this.config.maxRetryAttempts
            );

            for (const capture of retryable) {
                const success = await this.syncSingleCapture(capture);
                if (success) successCount++;
                else failedCount++;
            }

            this.emit({
                type: 'sync_completed',
                successCount,
                failedCount
            });

        } catch (error) {
            console.error('[SyncQueue] Sync error:', error);
            this.emit({
                type: 'sync_error',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            this.isSyncing = false;
        }

        return { success: successCount, failed: failedCount };
    }

    /**
     * Group captures by task ID
     */
    private groupByTask(captures: PendingCapture[]): Record<string, PendingCapture[]> {
        return captures.reduce((acc, capture) => {
            if (!acc[capture.taskId]) {
                acc[capture.taskId] = [];
            }
            acc[capture.taskId].push(capture);
            return acc;
        }, {} as Record<string, PendingCapture[]>);
    }

    /**
     * Sync captures for a specific task (Individual upload for each file)
     */
    private async syncTaskCaptures(
        taskId: string,
        captures: PendingCapture[]
    ): Promise<{ success: number; failed: number }> {
        let success = 0;
        let failed = 0;

        console.log(`[SyncQueue] Syncing ${captures.length} captures for task ${taskId} individually`);

        for (const capture of captures) {
            const result = await this.syncSingleCapture(capture);
            if (result) {
                success++;
            } else {
                failed++;
            }
        }

        return { success, failed };
    }

    /**
     * Sync a single capture (for retry)
     */
    private async syncSingleCapture(capture: PendingCapture): Promise<boolean> {
        try {
            await offlineStorage.updateCaptureStatus(capture.id, 'syncing');

            const formData = new FormData();
            formData.append('assign_id', capture.assignId);
            formData.append('task_details_id', capture.taskId);

            const file = new File(
                [capture.imageBlob],
                capture.filename,
                { type: capture.mimeType }
            );
            formData.append('file', file);

            await api.post('/monitoring/submit', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 30000
            });

            await offlineStorage.deleteCapture(capture.id);
            console.log(`[SyncQueue] Successfully synced capture ${capture.id}`);
            return true;

        } catch (error) {
            console.error(`[SyncQueue] Failed to sync capture ${capture.id}:`, error);

            await offlineStorage.updateCaptureStatus(
                capture.id,
                'failed',
                error instanceof Error ? error.message : 'Sync failed'
            );
            return false;
        }
    }

    /**
     * Force retry all failed captures
     */
    async retryAllFailed(): Promise<{ success: number; failed: number }> {
        if (this.isSyncing) {
            return { success: 0, failed: 0 };
        }

        const failedCaptures = await offlineStorage.getFailedCaptures();

        // Reset retry count for manual retry
        for (const capture of failedCaptures) {
            capture.retryCount = 0;
            await offlineStorage.updateCaptureStatus(capture.id, 'pending');
        }

        return this.processQueue();
    }

    /**
     * Get current queue state
     */
    async getQueueState(): Promise<{
        pending: number;
        syncing: boolean;
        failed: number;
    }> {
        const state = await offlineStorage.getStorageState();
        return {
            pending: state.pendingCount,
            syncing: this.isSyncing,
            failed: state.failedCount
        };
    }
}

// Export singleton instance
export const syncQueue = new SyncQueueService();

export default SyncQueueService;
