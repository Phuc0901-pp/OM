import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    is_read: boolean;
    created_at: string;
    metadata?: any;
}

export const useNotifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/notifications');
            setNotifications(res.data.data || []);
            setUnreadCount(res.data.unread || 0);
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const markAsRead = async (id: string) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));

            await api.put(`/notifications/${id}/read`);
        } catch (error) {
            console.error("Failed to mark as read", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
            await api.put('/notifications/read-all');
        } catch (error) {
            console.error("Failed to mark all read", error);
        }
    };

    // Sound Effect Ref
    const audioRef = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'))[0]; // Simple Bell Sound

    // Auto refresh every minute if open, or on mount
    useEffect(() => {
        const checkNotifications = async () => {
            try {
                // Don't set loading here to avoid flickering
                const res = await api.get('/notifications');
                const newNotifications = res.data.data || [];
                const newUnread = res.data.unread || 0;

                // Play sound if unread count increased
                setUnreadCount(prev => {
                    if (newUnread > prev) {
                        // Play sound
                        audioRef.play().catch(e => console.warn("Audio play failed (user interaction needed first)", e));
                    }
                    return newUnread;
                });
                setNotifications(newNotifications);
            } catch (error) {
                console.error("Failed to fetch notifications", error);
            }
        };

        checkNotifications();
        const interval = setInterval(checkNotifications, 15000); // Check every 15s instead of 60s
        return () => clearInterval(interval);
    }, [audioRef]);

    return {
        notifications,
        unreadCount,
        loading,
        isOpen,
        setIsOpen,
        fetchNotifications,
        markAsRead,
        markAllAsRead
    };
};
