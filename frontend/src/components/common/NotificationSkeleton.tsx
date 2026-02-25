import React from 'react';

interface NotificationSkeletonProps {
    isTaskType: boolean;
    isAttendanceType: boolean;
}

const NotificationSkeleton: React.FC<NotificationSkeletonProps> = ({ isTaskType, isAttendanceType }) => {
    return (
        <div className="space-y-4 animate-pulse">
            {/* Shimmer effect keyframes */}
            <style>{`
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .skeleton-shimmer {
                    background: linear-gradient(
                        90deg,
                        rgb(226 232 240 / 0.6) 25%,
                        rgb(241 245 249 / 0.9) 50%,
                        rgb(226 232 240 / 0.6) 75%
                    );
                    background-size: 200% 100%;
                    animation: shimmer 1.5s ease-in-out infinite;
                }
                .dark .skeleton-shimmer {
                    background: linear-gradient(
                        90deg,
                        rgb(51 65 85 / 0.6) 25%,
                        rgb(71 85 105 / 0.9) 50%,
                        rgb(51 65 85 / 0.6) 75%
                    );
                    background-size: 200% 100%;
                    animation: shimmer 1.5s ease-in-out infinite;
                }
            `}</style>

            {/* Header Skeleton */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex items-start gap-3 border border-slate-100 dark:border-slate-800">
                <div className="skeleton-shimmer h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="skeleton-shimmer h-5 w-2/3 rounded-md" />
                    <div className="skeleton-shimmer h-4 w-1/2 rounded-md" />
                    <div className="pt-2 grid grid-cols-2 gap-4">
                        <div className="skeleton-shimmer h-3 w-3/4 rounded-md" />
                        <div className="skeleton-shimmer h-3 w-3/4 rounded-md" />
                    </div>
                </div>
            </div>

            {/* Loading label */}
            <div className="flex items-center justify-center gap-3 py-2">
                <div className="relative flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-50" />
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-indigo-500 items-center justify-center">
                        <svg className="w-3 h-3 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    </span>
                </div>
                <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    Đang tải dữ liệu chi tiết...
                </span>
            </div>

            {isTaskType ? (
                /* ── Task Skeleton Cards ── */
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-3"
                            style={{ animationDelay: `${i * 150}ms` }}
                        >
                            {/* Badge row */}
                            <div className="flex items-center gap-2">
                                <div className="skeleton-shimmer h-5 w-20 rounded-full" />
                                <div className="skeleton-shimmer h-5 w-16 rounded-full" />
                                <div className="flex-1" />
                                <div className="skeleton-shimmer h-6 w-24 rounded-lg" />
                            </div>
                            {/* Title */}
                            <div className="skeleton-shimmer h-5 w-3/4 rounded-md" />
                            {/* Subtitle */}
                            <div className="skeleton-shimmer h-4 w-1/2 rounded-md" />
                            {/* Image placeholders */}
                            <div className="flex gap-2 pt-1">
                                <div className="skeleton-shimmer h-16 w-16 rounded-lg" />
                                <div className="skeleton-shimmer h-16 w-16 rounded-lg" />
                                <div className="skeleton-shimmer h-16 w-16 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : isAttendanceType ? (
                /* ── Attendance Skeleton Card ── */
                <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-800/50 dark:to-indigo-900/10 rounded-xl p-4 space-y-3 border border-slate-100 dark:border-slate-700">
                    {/* Header */}
                    <div className="skeleton-shimmer h-4 w-40 rounded-md" />
                    {/* Tags */}
                    <div className="flex gap-3">
                        <div className="skeleton-shimmer h-7 w-28 rounded-lg" />
                        <div className="skeleton-shimmer h-7 w-36 rounded-lg" />
                    </div>
                    {/* Time grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-600 space-y-2">
                            <div className="skeleton-shimmer h-3 w-16 rounded" />
                            <div className="skeleton-shimmer h-6 w-20 rounded-md" />
                            <div className="skeleton-shimmer h-3 w-full rounded" />
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-600 space-y-2">
                            <div className="skeleton-shimmer h-3 w-16 rounded" />
                            <div className="skeleton-shimmer h-6 w-20 rounded-md" />
                            <div className="skeleton-shimmer h-3 w-full rounded" />
                        </div>
                    </div>
                    {/* Photo placeholders */}
                    <div className="flex gap-3">
                        <div className="skeleton-shimmer h-20 w-20 rounded-lg" />
                        <div className="skeleton-shimmer h-20 w-20 rounded-lg" />
                    </div>
                </div>
            ) : (
                /* ── Generic Skeleton ── */
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="skeleton-shimmer h-4 w-full rounded-md" />
                    <div className="skeleton-shimmer h-4 w-5/6 rounded-md" />
                    <div className="skeleton-shimmer h-4 w-4/6 rounded-md" />
                </div>
            )}
        </div>
    );
};

export default NotificationSkeleton;
