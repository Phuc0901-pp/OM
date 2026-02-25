/**
 * SyncStatusBadge Component
 * Displays the number of pending offline captures and sync status
 */

import React, { useState, useRef, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check, X } from 'lucide-react';
import { useOfflineStorage } from '../../hooks/useOfflineStorage';

interface SyncStatusBadgeProps {
    /** Show detailed popup on click */
    showDetails?: boolean;
    /** Additional CSS classes */
    className?: string;
}

const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
    showDetails = true,
    className = ''
}) => {
    const {
        pendingCount,
        failedCount,
        isSyncing,
        isOnline,
        syncNow,
        retryFailed
    } = useOfflineStorage();

    const [showPopup, setShowPopup] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                setShowPopup(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Don't show if nothing pending
    if (pendingCount === 0 && failedCount === 0 && !isSyncing) {
        return null;
    }

    const totalPending = pendingCount + failedCount;

    const getBadgeColor = () => {
        if (isSyncing) return 'bg-blue-500';
        if (failedCount > 0) return 'bg-red-500';
        if (!isOnline) return 'bg-amber-500';
        return 'bg-indigo-500';
    };

    const getIcon = () => {
        if (isSyncing) {
            return <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
        }
        if (failedCount > 0) {
            return <AlertTriangle className="w-3.5 h-3.5" />;
        }
        if (!isOnline) {
            return <CloudOff className="w-3.5 h-3.5" />;
        }
        return <Cloud className="w-3.5 h-3.5" />;
    };

    const handleClick = () => {
        if (showDetails) {
            setShowPopup(!showPopup);
        }
    };

    const handleSync = async () => {
        await syncNow();
        setShowPopup(false);
    };

    const handleRetry = async () => {
        await retryFailed();
        setShowPopup(false);
    };

    return (
        <div className={`relative ${className}`} ref={popupRef}>
            {/* Badge Button */}
            <button
                onClick={handleClick}
                className={`
                    flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
                    text-white text-xs font-bold
                    shadow-md hover:shadow-lg
                    transition-all duration-200
                    ${getBadgeColor()}
                `}
                title={`${totalPending} ảnh chờ đồng bộ`}
            >
                {getIcon()}
                <span>{totalPending}</span>
            </button>

            {/* Details Popup */}
            {showPopup && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-scale-up">
                    {/* Header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <h4 className="font-bold text-slate-800 text-sm">Đồng bộ Offline</h4>
                        <button
                            onClick={() => setShowPopup(false)}
                            className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>

                    {/* Status */}
                    <div className="p-4 space-y-3">
                        {/* Network Status */}
                        <div className="flex items-center gap-2 text-sm">
                            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-amber-500'}`} />
                            <span className="text-slate-600">
                                {isOnline ? 'Đã kết nối mạng' : 'Không có mạng'}
                            </span>
                        </div>

                        {/* Pending Count */}
                        {pendingCount > 0 && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Đang chờ:</span>
                                <span className="font-bold text-indigo-600">{pendingCount} ảnh</span>
                            </div>
                        )}

                        {/* Failed Count */}
                        {failedCount > 0 && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Thất bại:</span>
                                <span className="font-bold text-red-600">{failedCount} ảnh</span>
                            </div>
                        )}

                        {/* Syncing Status */}
                        {isSyncing && (
                            <div className="flex items-center gap-2 text-sm text-blue-600">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Đang đồng bộ...</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                        {isOnline && pendingCount > 0 && !isSyncing && (
                            <button
                                onClick={handleSync}
                                className="flex-1 px-3 py-2 bg-indigo-500 text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Đồng bộ ngay
                            </button>
                        )}

                        {isOnline && failedCount > 0 && !isSyncing && (
                            <button
                                onClick={handleRetry}
                                className="flex-1 px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Thử lại
                            </button>
                        )}

                        {!isOnline && (
                            <div className="flex-1 text-center text-xs text-slate-500 py-2">
                                Sẽ tự động đồng bộ khi có mạng
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SyncStatusBadge;
