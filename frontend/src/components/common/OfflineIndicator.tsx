/**
 * OfflineIndicator Component
 * Displays a banner when the app is offline
 */

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

interface OfflineIndicatorProps {
    /** Additional CSS classes */
    className?: string;
    /** Position of the indicator */
    position?: 'top' | 'bottom';
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
    className = '',
    position = 'bottom'
}) => {
    const { isOnline } = useNetworkStatus();

    if (isOnline) {
        return null;
    }

    const positionClasses = position === 'top'
        ? 'top-0 left-0 right-0'
        : 'bottom-0 left-0 right-0';

    return (
        <div
            className={`
                fixed ${positionClasses} z-[9998]
                bg-gradient-to-r from-amber-500 to-orange-500
                text-white px-4 py-2
                shadow-lg shadow-amber-500/30
                animate-slide-up
                ${className}
            `}
        >
            <div className="max-w-4xl mx-auto flex items-center justify-center gap-3">
                <WifiOff className="w-4 h-4 animate-pulse" />
                <span className="text-sm font-medium">
                    Không có kết nối mạng - Dữ liệu sẽ được lưu offline
                </span>
                <RefreshCw className="w-4 h-4 opacity-60" />
            </div>
        </div>
    );
};

export default OfflineIndicator;
