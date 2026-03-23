import type { DetailAssign } from '../types/models';

export type TaskStatus = 'approved' | 'rejected' | 'resubmitted' | 'submitted' | 'pending';

export interface StatusBadge {
    label: string;
    color: string;
}

export const STATUS_BADGES: Record<TaskStatus, StatusBadge> = {
    approved: { label: 'ĐÃ ĐƯỢC DUYỆT', color: 'bg-green-100 text-green-800 border-green-300' },
    rejected: { label: 'YÊU CẦU SỬA', color: 'bg-red-100 text-red-800 border-red-300' },
    resubmitted: { label: 'ĐÃ NỘP LẠI', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
    submitted: { label: 'ĐÃ NỘP', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    pending: { label: 'CHƯA NỘP', color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export const getStatusBadge = (status: TaskStatus): StatusBadge => STATUS_BADGES[status];

/**
 * Determine the status of a DetailAssign.
 *
 * Priority order:
 * 1. approved  → status_approve === 1  OR  approval_at has entries
 * 2. resubmitted → status_reject === 1 AND status_submit === 1 (submitted after rejection)
 * 3. rejected  → status_reject === 1  OR  rejected_at has entries
 * 4. submitted → status_submit === 1  OR  submitted_at has entries
 * 5. pending   → fallback
 *
 * NOTE: Backend JSON key for approval timestamp is "approval_at" (NOT "approved_at").
 */
const hasEntries = (field: any): boolean => {
    if (!field) return false;
    if (Array.isArray(field)) return field.length > 0;
    if (typeof field === 'string') {
        if (field === '[]' || field === '') return false;
        if (field.startsWith('[')) {
            try { return (JSON.parse(field) as any[]).length > 0; } catch { return false; }
        }
        // Single ISO string
        return field.length > 0;
    }
    return false;
};

export const determineDetailStatus = (detail: DetailAssign | undefined): TaskStatus => {
    if (!detail) return 'pending';

    // 1. Approved — PRIMARY: status_approve flag, SECONDARY: approval_at array
    if (detail.status_approve === 1 || hasEntries(detail.approval_at)) return 'approved';

    // 2. Resubmitted (submitted again after rejection)
    if (detail.status_reject === 1 && detail.status_submit === 1 && hasEntries(detail.rejected_at)) return 'resubmitted';

    // 3. Rejected
    if (detail.status_reject === 1 || hasEntries(detail.rejected_at)) return 'rejected';

    // 4. Submitted
    if (detail.status_submit === 1 || hasEntries(detail.submitted_at)) return 'submitted';

    return 'pending';
};
