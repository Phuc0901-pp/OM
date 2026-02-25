import React from 'react';
import OfflineIndicator from '../common/OfflineIndicator';
import SyncStatusBadge from '../common/SyncStatusBadge';

const OfflineSyncStatus = () => {
    return (
        <>
            <OfflineIndicator position="bottom" />
            <SyncStatusBadge />
        </>
    );
};

export default OfflineSyncStatus;
