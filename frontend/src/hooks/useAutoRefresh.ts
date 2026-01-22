import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for auto-refreshing data in the background
 * @param fetchFunction - The function to call for refreshing data
 * @param intervalMs - Interval in milliseconds (default: 5 minutes = 300000)
 * @param enabled - Whether auto-refresh is enabled (default: true)
 */
export const useAutoRefresh = (
    fetchFunction: () => void | Promise<void>,
    intervalMs: number = 5 * 60 * 1000, // 5 minutes
    enabled: boolean = true
) => {
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const fetchRef = useRef(fetchFunction);

    // Keep fetchFunction ref updated
    useEffect(() => {
        fetchRef.current = fetchFunction;
    }, [fetchFunction]);

    const startAutoRefresh = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            console.log('[AutoRefresh] Refreshing data silently...');
            fetchRef.current();
        }, intervalMs);
    }, [intervalMs]);

    const stopAutoRefresh = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // Auto-start on mount, cleanup on unmount
    useEffect(() => {
        if (enabled) {
            startAutoRefresh();
        }

        return () => {
            stopAutoRefresh();
        };
    }, [enabled, startAutoRefresh, stopAutoRefresh]);

    // Pause when tab is hidden, resume when visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopAutoRefresh();
            } else if (enabled) {
                // Refresh immediately when tab becomes visible, then restart interval
                fetchRef.current();
                startAutoRefresh();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, startAutoRefresh, stopAutoRefresh]);

    return { startAutoRefresh, stopAutoRefresh };
};

export default useAutoRefresh;
