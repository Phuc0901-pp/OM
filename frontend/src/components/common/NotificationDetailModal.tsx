import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Trash2, Clock, MapPin, User as UserIcon, FileText } from 'lucide-react';
import GlobalImageLightbox from './GlobalImageLightbox';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Notification } from '../../hooks/useNotifications';
import api from '../../services/api';
import { getUserId } from '../../utils/userUtils';

// Imported Components
import AttendanceCard, { AttendanceDetail } from './AttendanceCard';
import NotificationSkeleton from './NotificationSkeleton';
import FilteredTaskContainer from './FilteredTaskContainer';

// Define TaskDetail interface locally as it's used for state
interface TaskDetail {
    id: string;
    station_id?: string;
    station?: { id: string; name: string };
    child_category?: { name: string; main_category?: { name: string } };
    station_name?: string;
    project?: { name: string };
    project_name?: string;
    [key: string]: any;
}

interface NotificationDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    notification: Notification | null;
    onNavigate: (n: Notification) => void;
    onDelete: (id: string) => void;
}

const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
    isOpen,
    onClose,
    notification,
    onNavigate,
    onDelete
}) => {
    const [attendanceData, setAttendanceData] = useState<AttendanceDetail | null>(null);
    const [taskData, setTaskData] = useState<TaskDetail[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [isNotFound, setIsNotFound] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

    // Parse metadata
    const metadata = React.useMemo(() => {
        if (!notification?.metadata) return {};
        if (typeof notification.metadata === 'string') {
            try { return JSON.parse(notification.metadata); } catch { return {}; }
        }
        return notification.metadata as any;
    }, [notification]);

    // Detect types
    const title = notification?.title?.toLowerCase() || '';
    const type = metadata.type || '';

    const isAttendanceType = ['checkin', 'checkout_status', 'checkout_request'].includes(type) ||
        title.includes('checkin') ||
        title.includes('checkout');

    const isTaskType = ['task_status', 'submission'].includes(type) ||
        title.includes('duyệt công việc') ||
        title.includes('nộp bài mới') ||
        title.includes('từ chối việc');

    // Context Info (Project, Main Category, Station, Job)
    const contextInfo = React.useMemo(() => {
        let project = '';
        let mainCat = '';
        let station = '';
        let childCat = '';

        // Extract expected info from notification (for matching)
        let expectedJob = '';
        const taskMatch = notification?.message?.match(/Công việc:\s*(.*?)(?:\n|$)/i);
        if (taskMatch && taskMatch[1]) {
            const parts = taskMatch[1].trim().split(' - ');
            expectedJob = parts[parts.length - 1].trim().toLowerCase();
        }

        let expectedStation = '';
        const stationMatch = notification?.message?.match(/Khu vực:\s*(.*?)(?:\n|$)/i);
        if (stationMatch && stationMatch[1]) {
            expectedStation = stationMatch[1].trim().toLowerCase();
        }

        // 1. Try to get from Task Data (Most accurate)
        if (taskData.length > 0) {
            // Find best matching task to show in header context
            let t = taskData[0];

            if (metadata.task_id) {
                const specificTask = taskData.find(task => task.id === metadata.task_id);
                if (specificTask) t = specificTask;
            } else if (metadata.station_id) {
                const stationIdStr = metadata.station_id.toLowerCase();
                const stationTask = taskData.find(task => {
                    const tSid = (task.station_id || '').toLowerCase();
                    const tSidFromObj = ((task.station as any)?.id || '').toLowerCase();
                    return tSid === stationIdStr || tSidFromObj === stationIdStr;
                });
                if (stationTask) t = stationTask;
            } else if (expectedJob || expectedStation) {
                const found = taskData.find((task) => {
                    let nameMatch = true;
                    let stationMatch = true;

                    if (expectedJob) {
                        const taskName = (task.child_category?.name || task.name || '').toLowerCase();
                        nameMatch = taskName.includes(expectedJob) || expectedJob.includes(taskName);
                    }
                    if (expectedStation) {
                        const sName = (task.station?.name || task.station_name || '').toLowerCase();
                        stationMatch = sName.includes(expectedStation) || expectedStation.includes(sName);
                    }
                    return nameMatch && stationMatch;
                });
                if (found) t = found;
            }

            project = t.project?.name || t.project_name || '';
            mainCat = t.child_category?.main_category?.name || '';
            station = t.station?.name || t.station_name || '';
            childCat = t.child_category?.name || '';
        }

        // 2. Fallback to Message Parsing (Legacy / Not Found)
        if (!project && !mainCat && !childCat && notification?.message) {
            const taskMatchFallback = notification.message.match(/Công việc:\s*(.*?)(?:\n|$)/i);
            if (taskMatchFallback && taskMatchFallback[1]) {
                const fullStr = taskMatchFallback[1].trim();
                // Try splitting by " - "
                const parts = fullStr.split(' - ');
                if (parts.length >= 3) {
                    project = parts[0].trim();
                    mainCat = parts[1].trim();
                    childCat = parts.slice(2).join(' - ').trim();
                } else if (parts.length === 2) {
                    mainCat = parts[0].trim(); // Guessing Main - Child or Project - Main? Usually Project - Job
                    childCat = parts[1].trim();
                } else {
                    childCat = fullStr;
                }
            }
        }

        if (!station && notification?.message) {
            const stationMatchFallback = notification.message.match(/Khu vực:\s*(.*?)(?:\n|$)/i);
            if (stationMatchFallback && stationMatchFallback[1]) {
                station = stationMatchFallback[1].trim();
            }
        }

        return { project, mainCat, station, childCat };
    }, [taskData, notification]);

    const attendanceId = metadata.attendance_id;
    const assignId = metadata.assign_id;

    // Fetch data when modal opens
    useEffect(() => {
        if (!isOpen || !notification) return;

        if (isAttendanceType) {
            setLoadingData(true);
            const userId = getUserId();
            const encodedDate = encodeURIComponent(notification.created_at || '');

            const fetchPromise = attendanceId
                ? api.get(`/attendance/detail/${attendanceId}`)
                : api.get(`/attendance/lookup?user_id=${userId}&date=${encodedDate}`);

            fetchPromise
                .then(res => setAttendanceData(res.data))
                .catch(err => {
                    console.error('Failed to fetch attendance:', err);
                    setAttendanceData(null);
                })
                .finally(() => setLoadingData(false));
        } else if (isTaskType) {
            setLoadingData(true);
            setIsNotFound(false); // Reset error state

            // Logic: 
            // 1. If we have assignId, use it (Strict).
            // 2. If no assignId (legacy/missing metadata), look it up by Task ID + User + Date.
            const fetchAssignment = assignId
                ? Promise.resolve({ data: { id: assignId } })
                : api.get(`/allocations/lookup?user_id=${getUserId()}&date=${encodeURIComponent(notification.created_at)}${metadata.task_id ? `&task_id=${metadata.task_id}` : ''}`);

            fetchAssignment
                .then(res => {
                    const finalAssignId = (res.data as any).id || (res.data as any).ID;
                    if (finalAssignId) {
                        return api.get(`/allocations/${finalAssignId}/tasks`);
                    }
                    throw new Error('No assign ID found'); // Triggers catch -> isNotFound
                })
                .then(res => {
                    const tasks = res.data || [];

                    // STRICT VERIFICATION FOR FALLBACK LOOKUP
                    // If we used lookup (no assignId), we MUST ensure the fetched tasks match the notification content.
                    // We check both Task Name and Station Name (if available) to distinguish between identical tasks in different stations.
                    if (!assignId && tasks.length > 0 && notification.message) {
                        // 1. Extract Task Name
                        let expectedJob = '';
                        const taskMatch = notification.message.match(/Công việc:\s*(.*?)(?:\n|$)/i);
                        if (taskMatch && taskMatch[1]) {
                            const fullStr = taskMatch[1].trim();
                            const parts = fullStr.split(' - ');
                            expectedJob = parts[parts.length - 1].trim().toLowerCase();
                        }

                        // 2. Extract Station Name
                        let expectedStation = '';
                        const stationMatch = notification.message.match(/Khu vực:\s*(.*?)(?:\n|$)/i);
                        if (stationMatch && stationMatch[1]) {
                            expectedStation = stationMatch[1].trim().toLowerCase();
                        }

                        // 3. Verify Match
                        if (expectedJob || expectedStation) {
                            const hasMatch = tasks.some((t: any) => {
                                let nameMatch = true;
                                let stationMatch = true;

                                if (expectedJob) {
                                    const taskName = (t.child_category?.name || t.name || '').toLowerCase();
                                    nameMatch = taskName.includes(expectedJob) || expectedJob.includes(taskName);
                                }

                                if (expectedStation) {
                                    const sName = (t.station?.name || t.station_name || '').toLowerCase();
                                    stationMatch = sName.includes(expectedStation) || expectedStation.includes(sName);
                                }

                                return nameMatch && stationMatch;
                            });

                            if (!hasMatch) {
                                console.warn(`Smart Match mismatch. Expected Job: "${expectedJob}", Station: "${expectedStation}"`);
                                throw new Error('Content mismatch'); // Treat as Not Found
                            }
                        }
                    }

                    setTaskData(tasks);
                })
                .catch(err => {
                    console.error('Failed to fetch task details:', err);
                    // Check if 404, specific error indicating deleted/not found, OR Content mismatch
                    if (err.response && (err.response.status === 404 || err.response.status === 400)) {
                        setIsNotFound(true);
                    } else if (err.message === 'No assign ID found' || err.message === 'Content mismatch') {
                        setIsNotFound(true);
                    }
                    setTaskData([]);
                })
                .finally(() => setLoadingData(false));
        } else {
            setAttendanceData(null);
            setTaskData([]);
        }
    }, [isOpen, attendanceId, assignId, isAttendanceType, isTaskType, notification]);

    if (!notification) return null;

    // Helper to get consistent styling for notification types
    const getNotificationStyle = (n: Notification) => {
        const title = n.title.toLowerCase();
        const type = n.type || '';

        if (title.includes('checkin') || title.includes('checkout')) return { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', icon: <Clock className="w-5 h-5" /> };
        if (title.includes('công việc') || title.includes('bài') || title.includes('duyệt') || title.includes('từ chối')) return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', icon: <MapPin className="w-5 h-5" /> };
        if (type === 'error') return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: <X className="w-5 h-5" /> };

        return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', icon: <UserIcon className="w-5 h-5" /> };
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-xl transition-all border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-start mb-4">
                                    <Dialog.Title
                                        as="h3"
                                        className="text-lg font-bold leading-6 text-slate-900 dark:text-white"
                                    >
                                        Chi tiết thông báo
                                    </Dialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="text-slate-400 hover:text-slate-500 transition-colors rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="mt-2 space-y-4">
                                    {loadingData ? (
                                        <NotificationSkeleton
                                            isTaskType={isTaskType}
                                            isAttendanceType={isAttendanceType}
                                        />
                                    ) : (
                                        <>
                                            {/* Header Info */}
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2">
                                                <div className="flex items-start gap-3">
                                                    {(() => {
                                                        const style = getNotificationStyle(notification);
                                                        return (
                                                            <div className={`p-2 rounded-lg ${style.bg} ${style.text}`}>
                                                                {style.icon}
                                                            </div>
                                                        );
                                                    })()}
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                                                            {notification.title.replace(/✅|❌|📋|📝/g, '').trim()}
                                                        </h4>
                                                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                {format(new Date(notification.created_at), "HH:mm, dd/MM/yyyy", { locale: vi })}
                                                            </span>
                                                        </div>

                                                        {/* Detailed Context Info */}
                                                        {(contextInfo.project || contextInfo.mainCat || contextInfo.station || contextInfo.childCat) && (
                                                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                                                {contextInfo.project && (
                                                                    <div className="flex gap-1.5 items-start">
                                                                        <span className="font-semibold text-slate-500 shrink-0">Dự án:</span>
                                                                        <span className="text-slate-800 dark:text-slate-200 font-medium line-clamp-1" title={contextInfo.project}>{contextInfo.project}</span>
                                                                    </div>
                                                                )}
                                                                {contextInfo.station && (
                                                                    <div className="flex gap-1.5 items-start">
                                                                        <span className="font-semibold text-slate-500 shrink-0">Khu vực:</span>
                                                                        <span className="text-slate-800 dark:text-slate-200 font-medium line-clamp-1" title={contextInfo.station}>{contextInfo.station}</span>
                                                                    </div>
                                                                )}
                                                                {contextInfo.mainCat && (
                                                                    <div className="flex gap-1.5 items-start">
                                                                        <span className="font-semibold text-slate-500 shrink-0">Hạng mục:</span>
                                                                        <span className="text-slate-800 dark:text-slate-200 font-medium line-clamp-1" title={contextInfo.mainCat}>{contextInfo.mainCat}</span>
                                                                    </div>
                                                                )}
                                                                {contextInfo.childCat && (
                                                                    <div className="flex gap-1.5 items-start">
                                                                        <span className="font-semibold text-slate-500 shrink-0">Công việc:</span>
                                                                        <span className="text-slate-800 dark:text-slate-200 font-medium line-clamp-1" title={contextInfo.childCat}>{contextInfo.childCat}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Content / Assignment Summary */}
                                            {isNotFound ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-center bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 p-6">
                                                    <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full mb-3">
                                                        <Trash2 className="w-6 h-6 text-red-500 dark:text-red-400" />
                                                    </div>
                                                    <h4 className="font-semibold text-red-600 dark:text-red-400 mb-1">
                                                        Công việc này không còn tồn tại
                                                    </h4>
                                                    <p className="text-sm text-red-500/80 dark:text-red-400/70 max-w-xs">
                                                        Có thể công việc đã bị xóa khỏi hệ thống. Bạn có thể xóa thông báo này.
                                                    </p>
                                                </div>
                                            ) : isTaskType && taskData.length > 0 ? (
                                                <FilteredTaskContainer
                                                    taskData={taskData}
                                                    metadata={metadata}
                                                    notification={notification}
                                                    onLightboxImage={(src, alt) => setLightboxImage({ src, alt })}
                                                />
                                            ) : (
                                                <>
                                                    {/* Show attendance card if available */}
                                                    {isAttendanceType && attendanceData && (
                                                        <AttendanceCard
                                                            data={attendanceData}
                                                            type={metadata.type}
                                                            onImageClick={(src, alt) => setLightboxImage({ src, alt })}
                                                        />
                                                    )}

                                                    {/* Message text (when no task/attendance card to show) */}
                                                    {!(isAttendanceType && attendanceData) && (
                                                        <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 whitespace-pre-line bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 min-h-[60px]">
                                                            {notification.message}
                                                        </div>
                                                    )}

                                                    {/* Empty state */}
                                                    {(isAttendanceType || isTaskType) && !attendanceData && taskData.length === 0 && (
                                                        <div className="text-center text-xs text-slate-400 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                                            Không có dữ liệu chi tiết để hiển thị
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="mt-6 flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        className="inline-flex justify-center rounded-xl px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 transition-colors gap-2 items-center"
                                        onClick={() => onDelete(notification.id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Xóa thông báo
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
            <GlobalImageLightbox
                src={lightboxImage?.src || null}
                alt={lightboxImage?.alt}
                onClose={() => setLightboxImage(null)}
            />
        </Transition >
    );
};

export default NotificationDetailModal;
