import React from 'react';
import { Camera as CameraIcon, CheckCircle2, RefreshCw } from 'lucide-react';
import PremiumButton from '../../../../components/common/PremiumButton';
import { TaskDetail } from '../types';

interface TaskActionControlsProps {
    task: TaskDetail;
    isEditing: boolean;
    draftCount: number;
    onEdit: () => void;
    onSubmit: () => void;
    onCamera: () => void;
}

const TaskActionControls: React.FC<TaskActionControlsProps> = ({ task, isEditing, draftCount, onEdit, onSubmit, onCamera }) => {
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
                            className="px-4 py-1.5 text-sm !rounded-lg !bg-amber-600 !hover:bg-amber-700 !border-amber-600 focus:!ring-amber-200"
                            variant="primary"
                        >
                            <RefreshCw className="w-4 h-4 mr-1" /> Nộp lại
                        </PremiumButton>
                    ) : (
                        <PremiumButton
                            onClick={onSubmit}
                            className="px-4 py-1.5 text-sm !rounded-lg"
                            variant="primary"
                        >
                            Lưu thay đổi
                        </PremiumButton>
                    )}
                </>
            );
        }

        // View Mode
        return (
            <>
                <span className="text-sm font-bold text-green-600 flex items-center gap-1 mr-auto">
                    <CheckCircle2 className="w-4 h-4" /> Đã nộp
                    {task.submitted_at && (
                        <span className="text-xs font-normal text-slate-500 ml-1">
                            ({new Date(task.submitted_at).toLocaleString('vi-VN')})
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
    return (
        <>
            <button
                onClick={onCamera} // Re-open camera acts as "Edit"
                className="px-3 py-1.5 bg-white text-slate-600 border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
            >
                Chỉnh sửa
            </button>
            <PremiumButton
                onClick={onSubmit}
                className="px-4 py-1.5 text-sm !rounded-lg"
                variant="primary"
            >
                Nộp ({draftCount})
            </PremiumButton>
        </>
    );
};

export default TaskActionControls;
