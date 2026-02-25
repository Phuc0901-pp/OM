import React, { useRef, useEffect } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, Notification } from '../../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const NotificationItem = ({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) => {
    const isRead = notification.is_read;
    return (
        <div
            className={`p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group relative ${!isRead ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
            onClick={() => !isRead && onRead(notification.id)}
        >
            <div className="flex gap-3">
                <div className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${!isRead ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <p className={`text-sm font-semibold truncate ${!isRead ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                            {notification.title}
                        </p>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: vi })}
                        </span>
                    </div>
                    <p className={`text-sm mt-0.5 line-clamp-2 ${!isRead ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-500'}`}>
                        {notification.message}
                    </p>
                </div>
            </div>
        </div>
    );
};

const FloatingNotification = () => {
    const {
        notifications,
        unreadCount,
        loading,
        isOpen,
        setIsOpen,
        markAsRead,
        markAllAsRead,
        fetchNotifications
    } = useNotifications();

    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setIsOpen]);

    const handleBellClick = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            fetchNotifications();
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999]" ref={containerRef}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9, originY: 1, originX: 1 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="absolute bottom-16 right-0 w-80 md:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[70vh]"
                        style={{ transformOrigin: 'bottom right' }}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <Bell className="w-4 h-4 text-indigo-500" />
                                Thông báo
                                <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs">
                                    {notifications.length}
                                </span>
                            </h3>
                            <div className="flex gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={() => markAllAsRead()}
                                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                        title="Đánh dấu tất cả là đã đọc"
                                    >
                                        <Check className="w-3.5 h-3.5" /> Đã đọc
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-slate-100 rounded-full dark:hover:bg-slate-800 text-slate-400"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 flex-1 bg-slate-50/30 dark:bg-slate-900/30">
                            {loading && notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                                    Đang tải...
                                </div>
                            ) : notifications.length > 0 ? (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {notifications.map(n => (
                                        <NotificationItem key={n.id} notification={n} onRead={markAsRead} />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                        <Bell className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p className="font-medium text-slate-600 dark:text-slate-300">Không có thông báo mới</p>
                                    <p className="text-xs mt-1">Bạn đã cập nhật tất cả thông tin!</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBellClick}
                className={`p-4 rounded-full shadow-lg shadow-indigo-500/30 transition-all relative flex items-center justify-center ${isOpen
                        ? 'bg-white text-indigo-600 dark:bg-slate-800 dark:text-indigo-400 ring-2 ring-indigo-500'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500'
                    }`}
            >
                <Bell className={`w-6 h-6 ${isOpen ? 'fill-current' : ''}`} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow-sm animate-bounce-short">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </motion.button>
        </div>
    );
};

export default FloatingNotification;
