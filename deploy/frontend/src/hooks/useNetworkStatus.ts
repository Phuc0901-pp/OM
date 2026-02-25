/**
 * useNetworkStatus Hook
 * Detects online/offline status and provides network state
 */

import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
    /** Whether the browser is online */
    isOnline: boolean;
    /** Timestamp when last went online */
    lastOnlineAt: Date | null;
    /** Timestamp when last went offline */
    lastOfflineAt: Date | null;
    /** Connection type if available (e.g., 'wifi', '4g') */
    connectionType: string | null;
    /** Effective connection type if available */
    effectiveType: string | null;
}

interface NetworkInfo {
    type?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
}

declare global {
    interface Navigator {
        connection?: NetworkInfo & EventTarget;
        mozConnection?: NetworkInfo & EventTarget;
        webkitConnection?: NetworkInfo & EventTarget;
    }
}

export function useNetworkStatus(): NetworkStatus {
    const getConnection = useCallback((): (NetworkInfo & EventTarget) | null => {
        return navigator.connection ||
            navigator.mozConnection ||
            navigator.webkitConnection ||
            null;
    }, []);

    const [status, setStatus] = useState<NetworkStatus>(() => {
        const connection = getConnection();
        return {
            isOnline: navigator.onLine,
            lastOnlineAt: navigator.onLine ? new Date() : null,
            lastOfflineAt: navigator.onLine ? null : new Date(),
            connectionType: connection?.type || null,
            effectiveType: connection?.effectiveType || null
        };
    });

    useEffect(() => {
        const handleOnline = () => {
            console.log('[Network] Online');
            setStatus(prev => ({
                ...prev,
                isOnline: true,
                lastOnlineAt: new Date()
            }));
        };

        const handleOffline = () => {
            console.log('[Network] Offline');
            setStatus(prev => ({
                ...prev,
                isOnline: false,
                lastOfflineAt: new Date()
            }));
        };

        const handleConnectionChange = () => {
            const connection = getConnection();
            if (connection) {
                setStatus(prev => ({
                    ...prev,
                    connectionType: connection.type || null,
                    effectiveType: connection.effectiveType || null
                }));
            }
        };

        // Add window event listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Add connection change listener if available
        const connection = getConnection();
        if (connection) {
            connection.addEventListener('change', handleConnectionChange);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);

            if (connection) {
                connection.removeEventListener('change', handleConnectionChange);
            }
        };
    }, [getConnection]);

    return status;
}

export default useNetworkStatus;
