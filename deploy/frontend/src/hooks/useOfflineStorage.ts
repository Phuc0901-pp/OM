/**
 * useOfflineStorage Hook
 * Provides a simple API for components to interact with offline storage
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineStorage, syncQueue, PendingCapture, OfflineStorageState, OfflineStorageEvent } from '../services/offline';
import { useNetworkStatus } from './useNetworkStatus';

interface UseOfflineStorageResult {
    // State
    /** Whether the system is initialized */
    isReady: boolean;
    /** Number of pending captures */
    pendingCount: number;
    /** Number of failed captures */
    failedCount: number;
    /** Whether currently syncing */
    isSyncing: boolean;
    /** Whether browser is online */
    isOnline: boolean;
    /** Last error message */
    lastError: string | null;

    // Actions
    /** Save an image to offline storage */
    saveImage: (taskId: string, assignId: string, blob: Blob, stage?: string) => Promise<string>;
    /** Get all captures for a task (including offline pending) */
    getTaskCaptures: (taskId: string) => Promise<PendingCapture[]>;
    /** Delete a pending capture */
    deletePendingCapture: (captureId: string) => Promise<void>;
    /** Manually trigger sync */
    syncNow: () => Promise<void>;
    /** Retry all failed captures */
    retryFailed: () => Promise<void>;
    /** Get storage state */
    getState: () => Promise<OfflineStorageState>;
}

export function useOfflineStorage(): UseOfflineStorageResult {
    const { isOnline } = useNetworkStatus();

    const [isReady, setIsReady] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    const initRef = useRef(false);

    // Initialize storage
    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        const init = async () => {
            try {
                await offlineStorage.init();

                // Start auto-sync
                syncQueue.startAutoSync(30000); // Check every 30s

                // Get initial state
                const state = await offlineStorage.getStorageState();
                setPendingCount(state.pendingCount);
                setFailedCount(state.failedCount);

                setIsReady(true);
                console.log('[useOfflineStorage] Initialized');
            } catch (error) {
                console.error('[useOfflineStorage] Init error:', error);
                setLastError('Failed to initialize offline storage');
            }
        };

        init();

        return () => {
            syncQueue.stopAutoSync();
        };
    }, []);

    // Listen to sync events
    useEffect(() => {
        const handleEvent = (event: OfflineStorageEvent) => {
            switch (event.type) {
                case 'sync_started':
                    setIsSyncing(true);
                    break;
                case 'sync_completed':
                    setIsSyncing(false);
                    updateCounts();
                    break;
                case 'sync_error':
                    setIsSyncing(false);
                    setLastError(event.error);
                    break;
                case 'capture_added':
                case 'capture_deleted':
                    updateCounts();
                    break;
                case 'storage_warning':
                    setLastError(
                        event.reason === 'quota_exceeded'
                            ? 'Dung lượng lưu trữ đã đầy'
                            : 'Đã đạt giới hạn số lượng ảnh'
                    );
                    break;
            }
        };

        syncQueue.addEventListener(handleEvent);
        return () => syncQueue.removeEventListener(handleEvent);
    }, []);

    // Update counts when online status changes
    useEffect(() => {
        if (isOnline && isReady) {
            // Trigger sync when coming online
            syncQueue.processQueue();
        }
    }, [isOnline, isReady]);

    // Update pending/failed counts
    const updateCounts = useCallback(async () => {
        try {
            const state = await offlineStorage.getStorageState();
            setPendingCount(state.pendingCount);
            setFailedCount(state.failedCount);
        } catch (error) {
            console.error('[useOfflineStorage] Failed to update counts:', error);
        }
    }, []);

    // Save image to offline storage
    const saveImage = useCallback(async (
        taskId: string,
        assignId: string,
        blob: Blob,
        stage: string = 'after'
    ): Promise<string> => {
        try {
            const id = await offlineStorage.saveCapture(taskId, assignId, blob, stage);
            await updateCounts();

            // If online, trigger sync immediately
            if (navigator.onLine) {
                syncQueue.processQueue();
            }

            return id;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save image';
            setLastError(message);
            throw error;
        }
    }, [updateCounts]);

    // Get captures for a task
    const getTaskCaptures = useCallback(async (taskId: string): Promise<PendingCapture[]> => {
        try {
            return await offlineStorage.getCapturesByTask(taskId);
        } catch (error) {
            console.error('[useOfflineStorage] Failed to get task captures:', error);
            return [];
        }
    }, []);

    // Delete a pending capture
    const deletePendingCapture = useCallback(async (captureId: string): Promise<void> => {
        try {
            await offlineStorage.deleteCapture(captureId);
            await updateCounts();
        } catch (error) {
            console.error('[useOfflineStorage] Failed to delete capture:', error);
            throw error;
        }
    }, [updateCounts]);

    // Manually trigger sync
    const syncNow = useCallback(async (): Promise<void> => {
        if (!navigator.onLine) {
            setLastError('Không có kết nối mạng');
            return;
        }
        await syncQueue.processQueue();
    }, []);

    // Retry failed captures
    const retryFailed = useCallback(async (): Promise<void> => {
        if (!navigator.onLine) {
            setLastError('Không có kết nối mạng');
            return;
        }
        await syncQueue.retryAllFailed();
    }, []);

    // Get current storage state
    const getState = useCallback(async (): Promise<OfflineStorageState> => {
        return await offlineStorage.getStorageState();
    }, []);

    return {
        // State
        isReady,
        pendingCount,
        failedCount,
        isSyncing,
        isOnline,
        lastError,

        // Actions
        saveImage,
        getTaskCaptures,
        deletePendingCapture,
        syncNow,
        retryFailed,
        getState
    };
}

export default useOfflineStorage;
