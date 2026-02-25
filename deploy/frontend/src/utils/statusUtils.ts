import { TaskDetail } from '../types/allocation';

export type TaskStatus = 'approved' | 'rejected' | 'submitted' | 'in_progress' | 'pending';

export interface StatusBadge {
    label: string;
    color: string;
}

export const STATUS_BADGES: Record<TaskStatus, StatusBadge> = {
    approved: { label: 'ĐÃ DUYỆT', color: 'bg-green-100 text-green-800 border-green-300' },
    rejected: { label: 'YÊU CẦU SỬA', color: 'bg-red-100 text-red-800 border-red-300' },
    submitted: { label: 'ĐÃ NỘP', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    in_progress: { label: 'ĐANG LÀM', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    pending: { label: 'CHƯA LÀM', color: 'bg-gray-100 text-gray-500 border-gray-200' }
};

export const getStatusBadge = (status: TaskStatus): StatusBadge => {
    return STATUS_BADGES[status];
};

export const determineTaskStatus = (taskDetail: TaskDetail | undefined): TaskStatus => {
    if (!taskDetail) return 'pending';

    // New logic based on status_ fields
    if (taskDetail.status_approve === 1) return 'approved';
    if (taskDetail.status_reject === 1) return 'rejected';
    if (taskDetail.status_submit === 1) return 'submitted';
    if (taskDetail.status_work === 1) return 'in_progress';

    // Fallback to old logic if new fields are missing (though they should be present now)
    if (taskDetail.accept === 1) return 'approved';
    if (taskDetail.accept === -1) return 'rejected';
    if (taskDetail.check === 3) return 'submitted';
    if (taskDetail.check === 1 || taskDetail.check === 2) return 'in_progress';

    return 'pending';
};
