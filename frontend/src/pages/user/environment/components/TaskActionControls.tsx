import React from 'react';
import { Camera as CameraIcon, CheckCircle2, RefreshCw } from 'lucide-react';
import PremiumButton from '../../../../components/common/PremiumButton';
import { DetailAssign } from '../types';

interface TaskActionControlsProps {
    task: DetailAssign;
    isEditing: boolean;
    draftCount: number;
    isSubmitting?: boolean;
    onEdit: () => void;
    onSubmit: () => void;
    onCamera: () => void;
}

const TaskActionControls: React.FC<TaskActionControlsProps> = ({ task, isEditing, draftCount, isSubmitting, onEdit, onSubmit, onCamera }) => {
    // 1. Submitted State
    if (task.status_submit === 1) {
        // Editing Mode
        if (isEditing) {
            const isRejected = task.status_reject === 1;
            return (
                <>
                    <button
                        onClick={onCamera}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors inline-flex items-center gap-1"
                    >
                        <CameraIcon className="w-3 h-3" /> Thêm ảnh
                    </button>

                    {isRejected ? (
                        <PremiumButton
                            onClick={onSubmit}
                            className={`px-4 py-1.5 text-sm !rounded-lg !bg-amber-600 !hover:bg-amber-700 !border-amber-600 focus:!ring-amber-200 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            variant="primary"
                            disabled={isSubmitting}
                        >
                            <RefreshCw className={`w-4 h-4 mr-1 ${isSubmitting ? 'animate-spin' : ''}`} /> {isSubmitting ? 'Đang nộp...' : 'Nộp lại'}
                        </PremiumButton>
                    ) : (
                        <PremiumButton
                            onClick={onSubmit}
                            className={`px-4 py-1.5 text-sm !rounded-lg ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            variant="primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-1"><RefreshCw className="w-4 h-4 animate-spin" /> Đang lưu...</span>
                            ) : (
                                'Lưu thay đổi'
                            )}
                        </PremiumButton>
                    )}
                </>
            );
        }

        // View Mode - same for submitted (approved / normal / rejected-after-submit)
        return (
            <>
                <span className="text-sm font-bold text-green-600 flex items-center gap-1 mr-auto">
                    <CheckCircle2 className="w-4 h-4" /> Đã nộp
                    {task.submitted_at && (
                        <span className="text-xs font-normal text-slate-500 ml-1">
                            ({
                                Array.isArray(task.submitted_at)
                                    ? new Date(task.submitted_at[0]).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
                                    : new Date(task.submitted_at as string).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
                            })
                        </span>
                    )}
                </span>
                <button
                    onClick={onEdit}
                    className="px-3 py-1.5 bg-white text-slate-600 border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                    Chỉnh sửa
                </button>
            </>
        );
    }

    // 2. Not Submitted State
    //    - If status_reject === 1 (rejected) with existing drafts → enter edit mode first (don't open camera)
    //    - Otherwise (fresh / no submission yet) → open camera directly as "start working"
    const isRejectedNoSubmit = task.status_reject === 1 && task.status_submit === 0;

    if (draftCount > 0) {
        // Has draft captures: show edit controls with camera + submit buttons
        if (isEditing || isRejectedNoSubmit) {
            return (
                <>
                    <button
                        onClick={onCamera}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors inline-flex items-center gap-1"
                    >
                        <CameraIcon className="w-3 h-3" /> Thêm ảnh
                    </button>
                    <PremiumButton
                        onClick={onSubmit}
                        className={`px-4 py-1.5 text-sm !rounded-lg ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        variant="primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-1"><RefreshCw className="w-4 h-4 animate-spin" /> Đang nộp...</span>
                        ) : (
                            `Nộp (${draftCount})`
                        )}
                    </PremiumButton>
                </>
            );
        }
        return (
            <>
                <button
                    onClick={onEdit}
                    className="px-3 py-1.5 bg-white text-slate-600 border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                    Chỉnh sửa
                </button>
                <PremiumButton
                    onClick={onSubmit}
                    className={`px-4 py-1.5 text-sm !rounded-lg ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    variant="primary"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <span className="flex items-center gap-1"><RefreshCw className="w-4 h-4 animate-spin" /> Đang nộp...</span>
                    ) : (
                        `Nộp (${draftCount})`
                    )}
                </PremiumButton>
            </>
        );
    }

    // No draft captures
    if (isRejectedNoSubmit) {
        // Rejected but no local drafts: show "Chỉnh sửa" → triggers onEdit so parent loads server images
        return (
            <>
                <button
                    onClick={onEdit}
                    className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-300 rounded-lg text-sm font-bold hover:bg-amber-100 transition-colors"
                >
                    Chỉnh sửa &amp; Nộp lại
                </button>
            </>
        );
    }

    return (
        <>
            <button
                onClick={onCamera} // Fresh task: open camera to take first photo
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors inline-flex items-center gap-1 ml-auto"
            >
                <CameraIcon className="w-3 h-3" /> Chụp ảnh
            </button>
        </>
    );
};

export default TaskActionControls;
