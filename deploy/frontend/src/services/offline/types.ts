/**
 * Offline Storage Types
 * Defines TypeScript interfaces for offline data storage
 */

/**
 * Status of a pending capture in the sync queue
 */
export type CaptureStatus = 'pending' | 'syncing' | 'failed' | 'synced';

/**
 * Represents a captured image/video waiting to be synced
 */
export interface PendingCapture {
    /** Unique identifier (UUID) */
    id: string;
    /** Associated task details ID */
    taskId: string;
    /** Associated assignment ID */
    assignId: string;
    /** The actual image/video data as Blob */
    imageBlob: Blob;
    /** MIME type of the file (e.g., 'image/jpeg', 'video/webm') */
    mimeType: string;
    /** Original filename */
    filename: string;
    /** Timestamp when captured */
    timestamp: number;
    /** Current sync status */
    status: CaptureStatus;
    /** Number of sync retry attempts */
    retryCount: number;
    /** Last error message if sync failed */
    lastError?: string;
    /** Stage: 'before' | 'after' | 'general' */
    stage: string;
}

/**
 * Summary of offline storage state
 */
export interface OfflineStorageState {
    /** Total number of pending captures */
    pendingCount: number;
    /** Total size in bytes */
    totalSize: number;
    /** Is currently syncing */
    isSyncing: boolean;
    /** Number of failed items */
    failedCount: number;
    /** Last sync attempt timestamp */
    lastSyncAt: number | null;
}

/**
 * Configuration for offline storage
 */
export interface OfflineStorageConfig {
    /** Maximum number of pending captures */
    maxPendingCaptures: number;
    /** Maximum total storage size in bytes */
    maxStorageSize: number;
    /** Maximum retry attempts before marking as failed */
    maxRetryAttempts: number;
    /** Auto-cleanup age in days */
    autoCleanupDays: number;
    /** Retry delays in milliseconds (exponential backoff) */
    retryDelays: number[];
}

/**
 * Default configuration values
 */
export const DEFAULT_OFFLINE_CONFIG: OfflineStorageConfig = {
    maxPendingCaptures: 50,
    maxStorageSize: 100 * 1024 * 1024, // 100MB
    maxRetryAttempts: 5,
    autoCleanupDays: 7,
    retryDelays: [0, 5000, 30000, 120000, 600000] // 0s, 5s, 30s, 2m, 10m
};

/**
 * Database schema constants
 */
export const DB_NAME = 'om_offline_storage';
export const DB_VERSION = 1;
export const STORE_PENDING_CAPTURES = 'pending_captures';

/**
 * Event types for offline storage events
 */
export type OfflineStorageEvent =
    | { type: 'capture_added'; capture: PendingCapture }
    | { type: 'capture_deleted'; captureId: string }
    | { type: 'sync_started' }
    | { type: 'sync_completed'; successCount: number; failedCount: number }
    | { type: 'sync_error'; error: string }
    | { type: 'storage_warning'; reason: 'quota_exceeded' | 'limit_reached' };
