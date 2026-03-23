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
    // Tracks whether the last auth attempt failed due to 401 (token expired)
    private isTokenExpired: boolean = false;

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
            if (navigator.onLine && !this.isSyncing && !this.isTokenExpired) {
                this.processQueue();
            }
        }, intervalMs);

        console.log('[SyncQueue] Auto-sync started');

        // Run GC once on startup to remove aged/zombie captures from previous sessions
        offlineStorage.cleanupOldCaptures().catch(err =>
            console.warn('[Offline GC] Startup cleanup failed (non-fatal):', err)
        );

        // Initial sync if online (only reachable network)
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
    /**
     * Verify actual internet connectivity by pinging the server health endpoint.
     * navigator.onLine is unreliable — it returns true even when WiFi has no internet.
     */
    private async isNetworkReachable(): Promise<boolean> {
        try {
            // Use a lightweight HEAD request to avoid downloading any body
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
            await fetch('/api/health', { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
            clearTimeout(timeoutId);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Call this when the user logs in again after token expiration, to re-enable sync.
     */
    resetTokenExpired(): void {
        this.isTokenExpired = false;
        console.log('[SyncQueue] Token expiry flag cleared. Sync re-enabled.');
    }

    async processQueue(): Promise<{ success: number; failed: number }> {
        if (this.isSyncing) {
            console.log('[SyncQueue] Sync already in progress');
            return { success: 0, failed: 0 };
        }

        if (this.isTokenExpired) {
            console.log('[SyncQueue] Token expired. Sync halted — waiting for user to log in again.');
            return { success: 0, failed: 0 };
        }

        if (!navigator.onLine) {
            console.log('[SyncQueue] navigator reports offline, skipping sync');
            return { success: 0, failed: 0 };
        }

        // Active Ping: verify real internet, not just local network
        const reachable = await this.isNetworkReachable();
        if (!reachable) {
            console.log('[SyncQueue] Active ping failed — no real internet. Skipping sync.');
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

            // Also fetch failed captures to retry
            const failedCaptures = await offlineStorage.getFailedCaptures();
            const retryable = failedCaptures.filter(
                c => c.retryCount < this.config.maxRetryAttempts
            );

            // Group BOTH pending and retryable by task for batch processing
            const allCapturesToSync = [...pendingCaptures, ...retryable];
            const capturesByTask = this.groupByTask(allCapturesToSync);

            for (const [taskId, captures] of Object.entries(capturesByTask)) {
                const result = await this.syncTaskCaptures(taskId, captures);
                successCount += result.success;
                failedCount += result.failed;
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
     * Sync captures for a specific task (Batch upload, then ONE submit)
     */
    private async syncTaskCaptures(
        taskId: string,
        captures: PendingCapture[]
    ): Promise<{ success: number; failed: number }> {
        let success = 0;
        let failed = 0;

        if (captures.length === 0) return { success, failed };

        console.log(`[SyncQueue] Syncing ${captures.length} captures for task ${taskId} as a batch`);

        const uploadedUrls: string[] = [];
        const successfullyUploaded: PendingCapture[] = [];
        const assignId = captures[0].assignId;

        // 1. Fetch current task details from DB first so we know what to append to
        let currentData: string[] = [];
        let noteData = "";
        try {
            const taskRes = await api.get(`/assigns/${assignId}/details`);
            const details = taskRes.data || [];
            const taskConf = details.find((d: any) => d.id === taskId);
            if (taskConf && taskConf.data) {
                currentData = typeof taskConf.data === 'string' ? JSON.parse(taskConf.data) : taskConf.data;
            }
            noteData = taskConf?.note_data || "";
        } catch (err) {
            console.error(`[SyncQueue] Failed to fetch task details for ${taskId}:`, err);
            // If we can't fetch current details, fail all because we can't safely append
            for (const c of captures) {
                await offlineStorage.updateCaptureStatus(c.id, 'failed', 'Could not fetch current task data');
                failed++;
            }
            return { success, failed };
        }

        // 2. Upload images one by one
        for (const capture of captures) {
            try {
                await offlineStorage.updateCaptureStatus(capture.id, 'syncing');

                const formData = new FormData();
                const file = new File(
                    [capture.imageBlob],
                    capture.filename,
                    { type: capture.mimeType }
                );
                formData.append('file', file);

                const uploadRes = await api.post(`/details/${taskId}/upload-image`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 30000
                });

                const newUrl = uploadRes.data?.url;
                if (!newUrl) throw new Error("Upload failed, no URL returned");

                uploadedUrls.push(newUrl);
                successfullyUploaded.push(capture);
            } catch (error: any) {
                // 401 Unauthorized = JWT expired. STOP sync entirely, do NOT increment retryCount.
                // This prevents the GC from treating auth-failed captures as zombies and deleting them.
                const status = error?.response?.status;
                if (status === 401) {
                    this.isTokenExpired = true;
                    console.error('[SyncQueue] 401 Unauthorized — token expired. Halting sync queue. Photos are safe.');
                    // Revert to pending (not failed) so they sync again after login
                    await offlineStorage.updateCaptureStatus(capture.id, 'pending', 'Token expired');
                    failed++;
                    break; // Stop processing more captures for this task
                }
                console.error(`[SyncQueue] Failed to upload capture ${capture.id}:`, error);
                await offlineStorage.updateCaptureStatus(
                    capture.id,
                    'failed',
                    error instanceof Error ? error.message : 'Upload failed'
                );
                failed++;
            }
        }

        // 3. If at least one upload succeeded, submit ONE time
        if (successfullyUploaded.length > 0) {
            currentData.push(...uploadedUrls);
            try {
                await api.post(`/details/${taskId}/submit`, {
                    data: currentData,
                    note_data: noteData
                });

                // Delete ONLY the successfully uploaded ones
                for (const capture of successfullyUploaded) {
                    await offlineStorage.deleteCapture(capture.id);
                    success++;
                }
                console.log(`[SyncQueue] Successfully submitted ${successfullyUploaded.length} captures for task ${taskId}`);
            } catch (submitError) {
                console.error(`[SyncQueue] Failed to submit task ${taskId}:`, submitError);
                // Mark them back to failed so they can be retried later
                for (const capture of successfullyUploaded) {
                    await offlineStorage.updateCaptureStatus(
                        capture.id,
                        'failed',
                        submitError instanceof Error ? submitError.message : 'Submit failed'
                    );
                    failed++;
                }
            }
        }

        return { success, failed };
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
