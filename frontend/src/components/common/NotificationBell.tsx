import React, { useRef, useEffect, useState } from 'react';
import { Bell, Check, Clock, X, ChevronRight, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, Notification } from '../../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const NotificationItem = ({ notification, onClick }: { notification: Notification; onClick: (n: Notification) => void }) => {
    const isRead = notification.is_read;

    return (
        <div
            className={`p-3 border-b border-slate-100 dark:border-slate-700 transition-colors group relative ${!isRead ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
        >
            <div className="flex gap-3">
                <div className={`shrink-0 mt-1 w-2 h-2 rounded-full ${!isRead ? 'bg-indigo-500' : 'bg-transparent'}`} />
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
                    <div style={{ marginTop: '8px', pointerEvents: 'auto' }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log('Click details');
                                onClick(notification);
                            }}
                            className="text-xs font-bold flex items-center gap-1 hover:underline"
                            style={{
                                color: '#4f46e5', // INDIGO-600
                                display: 'flex',
                                alignItems: 'center',
                                zIndex: 10,
                                position: 'relative',
                                cursor: 'pointer'
                            }}
                        >
                            Xem chi tiết <ChevronRight style={{ width: '14px', height: '14px' }} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

import NotificationDetailModal from './NotificationDetailModal';

const NotificationBell = () => {
    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        fetchNotifications,
        deleteNotification,
        deleteAllNotifications
    } = useNotifications();

    const [isOpen, setIsOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Modal State
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    // Handle initial permission check (optional integration with existing push logic)
    const handleBellClick = async () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            fetchNotifications(); // Refresh on open
        }
    };

    const handleOpenDetail = (notification: Notification) => {
        // Mark as read when opening details
        if (!notification.is_read) {
            markAsRead(notification.id);
        }
        setSelectedNotification(notification);
        setIsModalOpen(true);
        setIsOpen(false); // Close the dropdown
    };

    const handleNavigate = (notification: Notification) => {
        setIsModalOpen(false); // Close modal

        // Parse Metadata
        let metadata: any = {};
        if (notification.metadata) {
            if (typeof notification.metadata === 'string') {
                try {
                    metadata = JSON.parse(notification.metadata);
                } catch (e) {
                    console.error("Failed to parse metadata", e);
                }
            } else {
                metadata = notification.metadata;
            }
        }

        // Navigate Logic
        const type = metadata.type || notification.type;

        console.log("Notification Click:", type, metadata);

        if (type === 'submission') {
            if (metadata.task_id) {
                navigate(`/manager/operations?taskId=${metadata.task_id}`);
            } else {
                navigate('/manager/operations');
            }
        } else if (type === 'assignment') {
            if (metadata.assign_id) {
                navigate(`/user/environment?assignId=${metadata.assign_id}`);
            } else {
                navigate('/user/environment');
            }
        } else if (type === 'task_status') {
            const isApproved = notification.title.toLowerCase().includes('duyệt');
            if (isApproved && metadata.task_id) {
                navigate(`/user/statistics?taskId=${metadata.task_id}`);
            } else if (metadata.assign_id) {
                navigate(`/user/environment?assignId=${metadata.assign_id}`);
            } else {
                navigate('/user/environment');
            }
        } else if (type === 'checkout_status') {
            if (metadata.attendance_id) {
                navigate(`/user/history?attendanceId=${metadata.attendance_id}`);
            } else {
                navigate('/user/history');
            }
        } else if (type === 'checkin' || type === 'checkout_request') {
            if (metadata.attendance_id) {
                navigate(`/manager/history?tab=work_schedule&attendanceId=${metadata.attendance_id}`);
            } else {
                navigate('/manager/operations');
            }
        } else {
            // Legacy Support or Fallback
            const title = notification.title.toLowerCase();
            if (title.includes('phân công') || title.includes('dự án')) {
                navigate('/user/environment');
            } else if (title.includes('nộp bài') || title.includes('yêu cầu')) {
                navigate('/manager/operations');
            } else if (title.includes('duyệt') || title.includes('từ chối')) {
                navigate('/user/environment');
            }
        }
    };

    const handleDelete = (id: string) => {
        deleteNotification(id);
        // If deleting from modal, close modal
        if (isModalOpen && selectedNotification?.id === id) {
            setIsModalOpen(false);
            setSelectedNotification(null);
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={handleBellClick}
                className={`p-2 rounded-xl transition-all relative ${isOpen
                    ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 origin-top-right"
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200">Thông báo</h3>
                            <div className="flex items-center gap-3">
                                {notifications.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm('Bạn có chắc chắn muốn xóa tất cả thông báo?')) {
                                                deleteAllNotifications();
                                            }
                                        }}
                                        className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 flex items-center gap-1"
                                        title="Xóa tất cả thông báo"
                                    >
                                        <Trash2 className="w-3 h-3" /> Xóa hết
                                    </button>
                                )}
                                {unreadCount > 0 && (
                                    <button
                                        onClick={() => markAllAsRead()}
                                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
                                    >
                                        <Check className="w-3 h-3" /> Đã đọc tất cả
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* List */}
                        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                            {loading && notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                                    Đang tải...
                                </div>
                            ) : notifications.length > 0 ? (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {notifications.map(n => (
                                        <NotificationItem
                                            key={n.id}
                                            notification={n}
                                            onClick={handleOpenDetail}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-slate-400">
                                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">Không có thông báo mới</p>
                                </div>
                            )}
                        </div>

                        {/* Footer (Optional) */}
                        <div className="p-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 text-center">
                            <span className="text-[10px] text-slate-400">Chỉ hiển thị thông báo trong 7 ngày gần nhất</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <NotificationDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                notification={selectedNotification}
                onNavigate={handleNavigate}
                onDelete={handleDelete}
            />
        </div>
    );
};

export default NotificationBell;
