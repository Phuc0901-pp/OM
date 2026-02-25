import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import api from '../services/api';
import {
    connectWebSocket,
    disconnectWebSocket,
    onWsMessage,
} from '../services/websocketService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    is_read: boolean;
    created_at: string;
    metadata?: any;
}

// ─── Sound map (per notification type) ───────────────────────────────────────

const SOUND_MAP: Record<string, string> = {
    submission: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    checkin: 'https://assets.mixkit.co/active_storage/sfx/1/1-preview.mp3',
    checkout: 'https://assets.mixkit.co/active_storage/sfx/2/2-preview.mp3',
    checkout_request: 'https://assets.mixkit.co/active_storage/sfx/2/2-preview.mp3',
    checkout_status: 'https://assets.mixkit.co/active_storage/sfx/2/2-preview.mp3',
    task_status: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    reminder: 'https://assets.mixkit.co/active_storage/sfx/948/948-preview.mp3',
    default: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
};

function getSound(type?: string): string {
    if (!type) return SOUND_MAP.default;
    // If the type includes "approve" or "duyệt" play approve sound
    if (type.includes('approv') || type.includes('duyệt')) return SOUND_MAP.task_status;
    if (type.includes('reject') || type.includes('từ chối')) return SOUND_MAP.task_status;
    return SOUND_MAP[type] ?? SOUND_MAP.default;
}

function playSound(url: string) {
    try {
        const audio = new Audio(url);
        audio.play().catch(e => console.warn('[Notification] Audio play blocked:', e));
    } catch (e) {
        console.warn('[Notification] Audio error:', e);
    }
}

// ─── Context interface (isOpen REMOVED — each UI owns its own open state) ────

interface NotificationContextValue {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    deleteAllNotifications: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    // ── Core fetch ──────────────────────────────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/notifications');
            setNotifications(res.data.data || []);
            setUnreadCount(res.data.unread || 0);
        } catch (error) {
            console.error('[NotificationContext] Failed to fetch notifications', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Background polling & sound ──────────────────────────────────────────
    useEffect(() => {
        const poll = async () => {
            try {
                const res = await api.get('/notifications');
                const newNotifications: Notification[] = res.data.data || [];
                const newUnread: number = res.data.unread || 0;

                setUnreadCount(prev => {
                    if (newUnread > prev) {
                        // Generic sound for polling — we don't know the type here
                        playSound(SOUND_MAP.default);
                    }
                    return newUnread;
                });
                setNotifications(newNotifications);
            } catch {
                // Silently fail to avoid log spam
            }
        };

        poll();
        const intervalId = setInterval(poll, 15_000);
        return () => clearInterval(intervalId);
    }, []);

    // ── Service Worker message listener (instant push trigger) ───────────────
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handleSWMessage = (event: MessageEvent) => {
            if (event.data?.type === 'NEW_NOTIFICATION') {
                console.log('[NotificationContext] SW signalled new notification, refreshing...');
                fetchNotifications();
            }
        };

        navigator.serviceWorker.addEventListener('message', handleSWMessage);
        return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    }, [fetchNotifications]);

    // ── WebSocket real-time listener ─────────────────────────────────────────
    useEffect(() => {
        connectWebSocket();
        const unsubscribe = onWsMessage((data) => {
            const newNotif = data as Notification;
            if (!newNotif?.id) return;

            setNotifications(prev => {
                if (prev.some(n => n.id === newNotif.id)) return prev;
                return [newNotif, ...prev];
            });

            setUnreadCount(prev => prev + 1);

            // ── Play type-specific sound ──────────────────────────────────
            let type: string | undefined;
            if (newNotif.metadata) {
                const meta = typeof newNotif.metadata === 'string'
                    ? (() => { try { return JSON.parse(newNotif.metadata); } catch { return {}; } })()
                    : newNotif.metadata;
                type = meta?.type || newNotif.type;
            } else {
                type = newNotif.type;
            }
            playSound(getSound(type));
        });

        return () => {
            unsubscribe();
            disconnectWebSocket();
        };
    }, []);

    // ── Actions ─────────────────────────────────────────────────────────────

    const markAsRead = useCallback(async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
        try {
            await api.put(`/notifications/${id}/read`);
        } catch (error) {
            console.error('[NotificationContext] markAsRead failed', error);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        try {
            await api.put('/notifications/read-all');
        } catch (error) {
            console.error('[NotificationContext] markAllAsRead failed', error);
        }
    }, []);

    const deleteNotification = useCallback(async (id: string) => {
        const target = notifications.find(n => n.id === id);
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (target && !target.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
        try {
            await api.delete(`/notifications/${id}`);
        } catch (error) {
            console.error('[NotificationContext] deleteNotification failed', error);
            fetchNotifications();
        }
    }, [notifications, fetchNotifications]);

    const deleteAllNotifications = useCallback(async () => {
        setNotifications([]);
        setUnreadCount(0);
        try {
            await api.delete('/notifications/delete-all');
        } catch (error) {
            console.error('[NotificationContext] deleteAllNotifications failed', error);
            fetchNotifications();
        }
    }, [fetchNotifications]);

    // ── Context value ────────────────────────────────────────────────────────

    const value: NotificationContextValue = {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

// ─── Consumer Hook ────────────────────────────────────────────────────────────

export const useNotificationContext = (): NotificationContextValue => {
    const ctx = useContext(NotificationContext);
    if (!ctx) {
        throw new Error('useNotificationContext must be used inside <NotificationProvider>');
    }
    return ctx;
};
