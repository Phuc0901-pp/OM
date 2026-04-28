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
 private syncPromise: Promise<{ success: number; failed: number }> | null = null;
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
 * Process ONLY a specific task's captures (Priority execution for manual "Nộp" clicks)
 * This avoids making the user wait for other tasks' captures to upload.
 */
 async processTask(targetTaskId: string): Promise<{ success: number; failed: number; updatedUrls: string[] }> {
 if (this.isTokenExpired || !navigator.onLine) {
 return { success: 0, failed: 0, updatedUrls: [] };
 }

 const reachable = await this.isNetworkReachable();
 if (!reachable) {
 return { success: 0, failed: 0, updatedUrls: [] };
 }

 try {
 const pendingCaptures = await offlineStorage.getPendingCaptures();
 const failedCaptures = await offlineStorage.getFailedCaptures();
 const retryable = failedCaptures.filter(c => c.retryCount < this.config.maxRetryAttempts);

 const allCapturesToSync = [...pendingCaptures, ...retryable].filter(c => c.taskId === targetTaskId);

 if (allCapturesToSync.length === 0) {
 return { success: 0, failed: 0, updatedUrls: [] };
 }

 return await this.syncTaskCaptures(targetTaskId, allCapturesToSync);
 } catch (error) {
 console.error(`[SyncQueue] processTask error for ${targetTaskId}:`, error);
 return { success: 0, failed: 0, updatedUrls: [] };
 }
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
 const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
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
 if (this.syncPromise) {
 console.log('[SyncQueue] Sync already in progress, waiting for it to finish...');
 return this.syncPromise;
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

 this.syncPromise = (async () => {
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
 })();

 try {
 return await this.syncPromise;
 } finally {
 this.syncPromise = null;
 }
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
 * Sync captures for a specific task.
 * Uploads in parallel (max CONCURRENT_UPLOADS at a time) then submits as draft once.
 * Returns updatedUrls so callers can skip re-fetching from server.
 */
 private static readonly CONCURRENT_UPLOADS = 3;

 private async syncTaskCaptures(
 taskId: string,
 captures: PendingCapture[]
 ): Promise<{ success: number; failed: number; updatedUrls: string[] }> {
 let success = 0;
 let failed = 0;

 if (captures.length === 0) return { success, failed, updatedUrls: [] };

 console.log(`[SyncQueue] Syncing ${captures.length} captures for task ${taskId} (parallel batch)`);

 const _assignId = captures[0].assignId; // kept for potential future use
 // NOTE: We intentionally do NOT pre-fetch currentData from the server here.
 // The backend's submit endpoint already performs a safe UNION merge of
 // (existingURLs in DB ∪ incoming new URLs). Pre-fetching and re-sending
 // old data risks a race condition: if a user deleted an image after we
 // fetched but before we submit, we would silently restore the deleted image.

 // Helper: upload a single capture, returns url on success or null on failure
 const uploadOne = async (capture: PendingCapture): Promise<{ capture: PendingCapture; url: string | null; tokenExpired: boolean }> => {
 try {
 await offlineStorage.updateCaptureStatus(capture.id, 'syncing');
 const formData = new FormData();
 formData.append('file', new File([capture.imageBlob], capture.filename, { type: capture.mimeType }));
 const res = await api.post(`/details/${taskId}/upload-image`, formData, {
 headers: { 'Content-Type': 'multipart/form-data' },
 timeout: 60000,
 });
 const url = res.data?.url;
 if (!url) throw new Error('Upload succeeded but no URL returned');
 return { capture, url, tokenExpired: false };
 } catch (error: any) {
 if (error?.response?.status === 401) {
 await offlineStorage.updateCaptureStatus(capture.id, 'pending', 'Token expired');
 return { capture, url: null, tokenExpired: true };
 }
 console.error(`[SyncQueue] Failed to upload capture ${capture.id}:`, error);
 await offlineStorage.updateCaptureStatus(
 capture.id, 'failed',
 error instanceof Error ? error.message : 'Upload failed'
 );
 return { capture, url: null, tokenExpired: false };
 }
 };

 // 2. Upload in parallel chunks (max CONCURRENT_UPLOADS at a time)
 const uploadedUrls: string[] = [];
 const successfullyUploaded: PendingCapture[] = [];
 const concurrency = SyncQueueService.CONCURRENT_UPLOADS;
 let tokenExpiredFlag = false;

 for (let i = 0; i < captures.length && !tokenExpiredFlag; i += concurrency) {
 const chunk = captures.slice(i, i + concurrency);
 const results = await Promise.allSettled(chunk.map(c => uploadOne(c)));

 for (const result of results) {
 if (result.status === 'fulfilled') {
 const { capture, url, tokenExpired } = result.value;
 if (tokenExpired) {
 this.isTokenExpired = true;
 tokenExpiredFlag = true;
 console.error('[SyncQueue] 401 — token expired. Halting sync. Photos are safe.');
 failed++;
 } else if (url) {
 uploadedUrls.push(url);
 successfullyUploaded.push(capture);
 } else {
 failed++;
 }
 } else {
 // Promise itself rejected (shouldn't happen since uploadOne catches all, but be safe)
 failed++;
 }
 }
 }

 // 3. If at least one upload succeeded, commit as draft ONCE
 if (successfullyUploaded.length > 0) {
 // Send ONLY the newly uploaded URLs. The backend's SubmitDetail handler
 // performs a safe UNION merge: (existingURLs in DB ∪ incoming newURLs).
 // We MUST NOT send pre-fetched currentData here — doing so would risk
 // restoring images the user has already deleted from the DB.
 try {
 // draft=true: saves URLs to DB without flipping status_submit=1
 await api.post(`/details/${taskId}/submit?draft=true`, {
 data: uploadedUrls,
 note_data: '',
 });

 for (const capture of successfullyUploaded) {
 await offlineStorage.deleteCapture(capture.id);
 success++;
 }
 console.log(`[SyncQueue] Draft saved: ${successfullyUploaded.length} new images for task ${taskId}`);

 // Return only the new URLs — caller (handleSubmitDraft) will fetch a fresh
 // state from the server, which is the source of truth.
 return { success, failed, updatedUrls: uploadedUrls };
 } catch (submitError) {
 console.error(`[SyncQueue] Failed to draft-submit task ${taskId}:`, submitError);
 for (const capture of successfullyUploaded) {
 await offlineStorage.updateCaptureStatus(
 capture.id, 'failed',
 submitError instanceof Error ? submitError.message : 'Submit failed'
 );
 failed++;
 }
 }
 }

 return { success, failed, updatedUrls: [] };
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
