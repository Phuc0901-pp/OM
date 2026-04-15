import { useEffect, useRef, useCallback } from 'react';
import { onWsMessage } from '../services/websocketService';

/**
 * Custom hook for auto-refreshing data.
 * - Polls on a fixed interval.
 * - Optionally subscribes to WebSocket messages and triggers an immediate
 *   silent refresh whenever a relevant event arrives (debounced).
 *
 * @param fetchFunction  The async function to call for refreshing data
 * @param intervalMs     Polling interval in ms (default: 5 minutes)
 * @param enabled        Whether polling is enabled (default: true)
 * @param listenToWs     Subscribe to WebSocket events for instant refresh (default: false)
 * @param wsDebounceMs   Minimum gap between WS-triggered refreshes (default: 1500 ms)
 */
export const useAutoRefresh = (
    fetchFunction: () => void | Promise<void>,
    intervalMs: number = 5 * 60 * 1000,
    enabled: boolean = true,
    listenToWs: boolean = false,
    wsDebounceMs: number = 1500
) => {
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const fetchRef = useRef(fetchFunction);

    // Keep fetchFunction ref fresh
    useEffect(() => {
        fetchRef.current = fetchFunction;
    }, [fetchFunction]);

    const startAutoRefresh = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            console.log('[AutoRefresh] Polling refresh...');
            fetchRef.current();
        }, intervalMs);
    }, [intervalMs]);

    const stopAutoRefresh = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // Polling lifecycle
    useEffect(() => {
        if (enabled) startAutoRefresh();
        return () => stopAutoRefresh();
    }, [enabled, startAutoRefresh, stopAutoRefresh]);

    // Pause/resume when tab visibility changes
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopAutoRefresh();
            } else if (enabled) {
                fetchRef.current(); // immediate refresh when tab re-focused
                startAutoRefresh();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [enabled, startAutoRefresh, stopAutoRefresh]);

    // WebSocket-driven refresh (instant, debounced)
    useEffect(() => {
        if (!listenToWs) return;

        const unsubscribe = onWsMessage(() => {
            // Debounce: coalesce multiple rapid WS messages into one fetch
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                console.log('[AutoRefresh] WebSocket event → silent refresh');
                fetchRef.current();
                debounceRef.current = null;
            }, wsDebounceMs);
        });

        return () => {
            unsubscribe();
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, [listenToWs, wsDebounceMs]);

    return { startAutoRefresh, stopAutoRefresh };
};

export default useAutoRefresh;
