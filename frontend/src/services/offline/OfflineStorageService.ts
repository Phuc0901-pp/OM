/**
 * OfflineStorageService
 * IndexedDB wrapper for storing offline captures
 * Provides CRUD operations for pending image/video captures
 */

import {
    PendingCapture,
    CaptureStatus,
    OfflineStorageState,
    OfflineStorageConfig,
    DEFAULT_OFFLINE_CONFIG,
    DB_NAME,
    DB_VERSION,
    STORE_PENDING_CAPTURES
} from './types';

class OfflineStorageService {
    private db: IDBDatabase | null = null;
    private config: OfflineStorageConfig;
    private initialized: boolean = false;

    constructor(config: Partial<OfflineStorageConfig> = {}) {
        this.config = { ...DEFAULT_OFFLINE_CONFIG, ...config };
    }

    /**
     * Initialize the IndexedDB database
     */
    async init(): Promise<void> {
        if (this.initialized && this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[OfflineStorage] Failed to open database:', request.error);
                reject(new Error('Failed to open offline storage database'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.initialized = true;
                console.log('[OfflineStorage] Database initialized');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create pending_captures store
                if (!db.objectStoreNames.contains(STORE_PENDING_CAPTURES)) {
                    const store = db.createObjectStore(STORE_PENDING_CAPTURES, { keyPath: 'id' });

                    // Create indexes for efficient querying
                    store.createIndex('taskId', 'taskId', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('assignId', 'assignId', { unique: false });

                    console.log('[OfflineStorage] Created object store and indexes');
                }
            };
        });
    }

    /**
     * Ensure database is initialized before operations
     */
    private async ensureInitialized(): Promise<IDBDatabase> {
        if (!this.initialized || !this.db) {
            await this.init();
        }
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        return this.db;
    }

    /**
     * Generate a UUID for new captures
     */
    private generateId(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * Save a new capture to offline storage
     */
    async saveCapture(
        taskId: string,
        assignId: string,
        imageBlob: Blob,
        stage: string = 'after'
    ): Promise<string> {
        const db = await this.ensureInitialized();

        // Check storage limits
        const state = await this.getStorageState();
        if (state.pendingCount >= this.config.maxPendingCaptures) {
            throw new Error('Đã đạt giới hạn số lượng ảnh chờ đồng bộ');
        }
        if (state.totalSize + imageBlob.size > this.config.maxStorageSize) {
            throw new Error('Đã đạt giới hạn dung lượng lưu trữ offline');
        }

        const capture: PendingCapture = {
            id: this.generateId(),
            taskId,
            assignId,
            imageBlob,
            mimeType: imageBlob.type || 'image/jpeg',
            filename: `capture_${Date.now()}.${imageBlob.type?.includes('video') ? 'webm' : 'jpg'}`,
            timestamp: Date.now(),
            status: 'pending',
            retryCount: 0,
            stage
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PENDING_CAPTURES], 'readwrite');
            const store = transaction.objectStore(STORE_PENDING_CAPTURES);
            const request = store.add(capture);

            request.onsuccess = () => {
                console.log('[OfflineStorage] Capture saved:', capture.id);
                resolve(capture.id);
            };

            request.onerror = () => {
                console.error('[OfflineStorage] Failed to save capture:', request.error);
                reject(new Error('Failed to save capture to offline storage'));
            };
        });
    }

    /**
     * Get all captures for a specific task
     */
    async getCapturesByTask(taskId: string): Promise<PendingCapture[]> {
        const db = await this.ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PENDING_CAPTURES], 'readonly');
            const store = transaction.objectStore(STORE_PENDING_CAPTURES);
            const index = store.index('taskId');
            const request = index.getAll(taskId);

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error('[OfflineStorage] Failed to get captures:', request.error);
                reject(new Error('Failed to get captures from offline storage'));
            };
        });
    }

    /**
     * Get all pending captures (status = 'pending')
     */
    async getPendingCaptures(): Promise<PendingCapture[]> {
        const db = await this.ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PENDING_CAPTURES], 'readonly');
            const store = transaction.objectStore(STORE_PENDING_CAPTURES);
            const index = store.index('status');
            const request = index.getAll('pending');

            request.onsuccess = () => {
                // Sort by timestamp (oldest first)
                const captures = (request.result || []).sort((a, b) => a.timestamp - b.timestamp);
                resolve(captures);
            };

            request.onerror = () => {
                console.error('[OfflineStorage] Failed to get pending captures:', request.error);
                reject(new Error('Failed to get pending captures'));
            };
        });
    }

    /**
     * Get all failed captures
     */
    async getFailedCaptures(): Promise<PendingCapture[]> {
        const db = await this.ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PENDING_CAPTURES], 'readonly');
            const store = transaction.objectStore(STORE_PENDING_CAPTURES);
            const index = store.index('status');
            const request = index.getAll('failed');

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(new Error('Failed to get failed captures'));
            };
        });
    }

    /**
     * Get a single capture by ID
     */
    async getCaptureById(id: string): Promise<PendingCapture | null> {
        const db = await this.ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PENDING_CAPTURES], 'readonly');
            const store = transaction.objectStore(STORE_PENDING_CAPTURES);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(new Error('Failed to get capture'));
            };
        });
    }

    /**
     * Update capture status
     */
    async updateCaptureStatus(
        id: string,
        status: CaptureStatus,
        error?: string
    ): Promise<void> {
        const db = await this.ensureInitialized();

        const capture = await this.getCaptureById(id);
        if (!capture) {
            throw new Error('Capture not found');
        }

        capture.status = status;
        if (status === 'failed') {
            capture.retryCount += 1;
            capture.lastError = error;
        }

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PENDING_CAPTURES], 'readwrite');
            const store = transaction.objectStore(STORE_PENDING_CAPTURES);
            const request = store.put(capture);

            request.onsuccess = () => {
                console.log(`[OfflineStorage] Capture ${id} status updated to ${status}`);
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to update capture status'));
            };
        });
    }

    /**
     * Delete a capture by ID
     */
    async deleteCapture(id: string): Promise<void> {
        const db = await this.ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PENDING_CAPTURES], 'readwrite');
            const store = transaction.objectStore(STORE_PENDING_CAPTURES);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log('[OfflineStorage] Capture deleted:', id);
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to delete capture'));
            };
        });
    }

    /**
     * Delete all captures for a specific task
     */
    async deleteCapturesByTask(taskId: string): Promise<void> {
        const captures = await this.getCapturesByTask(taskId);
        for (const capture of captures) {
            await this.deleteCapture(capture.id);
        }
    }

    /**
     * Get current storage state/statistics
     */
    async getStorageState(): Promise<OfflineStorageState> {
        const db = await this.ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PENDING_CAPTURES], 'readonly');
            const store = transaction.objectStore(STORE_PENDING_CAPTURES);
            const request = store.getAll();

            request.onsuccess = () => {
                const captures = request.result || [];

                let totalSize = 0;
                let pendingCount = 0;
                let failedCount = 0;

                captures.forEach((capture: PendingCapture) => {
                    totalSize += capture.imageBlob?.size || 0;
                    if (capture.status === 'pending') pendingCount++;
                    if (capture.status === 'failed') failedCount++;
                });

                resolve({
                    pendingCount,
                    totalSize,
                    isSyncing: false, // This will be managed by SyncService
                    failedCount,
                    lastSyncAt: null
                });
            };

            request.onerror = () => {
                reject(new Error('Failed to get storage state'));
            };
        });
    }

    /**
     * Cleanup old captures (older than autoCleanupDays)
     */
    async cleanupOldCaptures(): Promise<number> {
        const db = await this.ensureInitialized();
        const cutoffTime = Date.now() - (this.config.autoCleanupDays * 24 * 60 * 60 * 1000);

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PENDING_CAPTURES], 'readwrite');
            const store = transaction.objectStore(STORE_PENDING_CAPTURES);
            const index = store.index('timestamp');
            const range = IDBKeyRange.upperBound(cutoffTime);
            const request = index.openCursor(range);
            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    console.log(`[OfflineStorage] Cleaned up ${deletedCount} old captures`);
                    resolve(deletedCount);
                }
            };

            request.onerror = () => {
                reject(new Error('Failed to cleanup old captures'));
            };
        });
    }

    /**
     * Clear all data (for testing/reset)
     */
    async clearAll(): Promise<void> {
        const db = await this.ensureInitialized();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_PENDING_CAPTURES], 'readwrite');
            const store = transaction.objectStore(STORE_PENDING_CAPTURES);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('[OfflineStorage] All data cleared');
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to clear storage'));
            };
        });
    }

    /**
     * Check if IndexedDB is supported
     */
    static isSupported(): boolean {
        return 'indexedDB' in window;
    }
}

// Export singleton instance
export const offlineStorage = new OfflineStorageService();

export default OfflineStorageService;
