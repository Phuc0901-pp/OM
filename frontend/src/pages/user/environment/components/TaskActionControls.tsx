import React from 'react';
import { Camera as CameraIcon, CheckCircle2, RefreshCw, Save, Edit3 } from 'lucide-react';
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
                        className="px-2.5 py-1.5 sm:px-3 text-[11px] sm:text-xs bg-indigo-50 text-indigo-600 font-bold rounded-lg hover:bg-indigo-100 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                        <CameraIcon className="w-3.5 h-3.5" /> 
                        <span className="hidden sm:inline">Thêm ảnh</span>
                        <span className="sm:hidden">Ảnh</span>
                    </button>

                    {isRejected ? (
                        <PremiumButton
                            onClick={onSubmit}
                            className={`px-3 py-1.5 sm:px-4 text-xs sm:text-sm !rounded-lg !bg-amber-600 !hover:bg-amber-700 !border-amber-600 focus:!ring-amber-200 whitespace-nowrap shrink-0 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            variant="primary"
                            disabled={isSubmitting}
                        >
                            <span className="flex items-center gap-1">
                                <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} /> 
                                <span className="hidden sm:inline">{isSubmitting ? 'Đang nộp...' : 'Nộp lại'}</span>
                                <span className="sm:hidden">{isSubmitting ? 'Đang nộp' : 'Nộp lại'}</span>
                            </span>
                        </PremiumButton>
                    ) : (
                        <PremiumButton
                            onClick={onSubmit}
                            className={`px-3 py-1.5 sm:px-4 text-xs sm:text-sm !rounded-lg whitespace-nowrap shrink-0 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            variant="primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> <span className="hidden sm:inline">Đang lưu...</span><span className="sm:hidden">Đang lưu</span></span>
                            ) : (
                                <span className="flex items-center gap-1"><Save className="w-3.5 h-3.5 sm:hidden" /> <span className="hidden sm:inline">Lưu thay đổi</span><span className="sm:hidden">Lưu</span></span>
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
                    <CheckCircle2 className="w-4 h-4" /> {task.status_reject === 1 ? 'Đã nộp lại' : 'Đã nộp'}
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
                    className="px-2.5 py-1.5 sm:px-3 bg-white text-slate-600 border border-slate-300 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                    <Edit3 className="w-3.5 h-3.5 sm:hidden" />
                    <span className="hidden sm:inline">Chỉnh sửa</span>
                    <span className="sm:hidden">Sửa</span>
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
                        className="px-2.5 py-1.5 sm:px-3 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                        <CameraIcon className="w-3.5 h-3.5" /> 
                        <span className="hidden sm:inline">Thêm ảnh</span>
                        <span className="sm:hidden">Ảnh</span>
                    </button>
                    <PremiumButton
                        onClick={onSubmit}
                        className={`px-3 py-1.5 sm:px-4 text-xs sm:text-sm !rounded-lg whitespace-nowrap shrink-0 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        variant="primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> <span className="hidden sm:inline">Đang nộp...</span><span className="sm:hidden">Đang nộp</span></span>
                        ) : (
                            <span className="flex items-center gap-1"><span className="hidden sm:inline">Nộp ({draftCount})</span><span className="sm:hidden">Nộp</span></span>
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
        if (isEditing) {
            return (
                <button
                    onClick={onCamera}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors inline-flex items-center gap-1 ml-auto"
                >
                    <CameraIcon className="w-3 h-3" /> Chụp ảnh
                </button>
            );
        }

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
