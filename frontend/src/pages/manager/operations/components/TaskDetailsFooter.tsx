import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import PremiumButton from '../../../../components/common/PremiumButton';
import { TaskRow } from '../types';

interface TaskDetailsFooterProps {
    task: TaskRow;
    onUpdateStatus: (taskId: string, status: number) => Promise<void>;
    fetchTasks: () => void;
    setSelectedTask: (task: TaskRow | null) => void;
    onBulkUpdate?: (ids: string[], status: number) => Promise<void>;
    selectedTaskIds?: Set<string>;
    onClearSelection?: () => void;
    onReject?: () => void;
}

const TaskDetailsFooter: React.FC<TaskDetailsFooterProps> = ({
    task,
    onUpdateStatus,
    fetchTasks,
    setSelectedTask,
    onBulkUpdate,
    selectedTaskIds,
    onClearSelection,
    onReject
}) => {
    // Helper to get target IDs (now gets all sub-processes of the task)
    const getTargetIds = (): string[] => {
        if (!task) return [];
        const subTasks = task.subTasks && task.subTasks.length > 0 ? task.subTasks : [task];
        return subTasks.map((t: any) => t.id);
    };

    const handleAction = (status: number) => {
        const targetIds = getTargetIds();

        if (targetIds.length === 0) {
            alert("Không có quy trình nào để thực hiện thao tác này.");
            return;
        }

        if (onBulkUpdate) {
            onBulkUpdate(targetIds, status).then(() => {
                if (onClearSelection) onClearSelection();
                fetchTasks();
            });
        } else {
            // Fallback Legacy
            Promise.all(targetIds.map(id => onUpdateStatus(id, status))).then(() => {
                if (onClearSelection) onClearSelection();
                fetchTasks();
            });
        }
    };

    const count = getTargetIds().length;

    return (
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 flex-shrink-0 z-20">
            <PremiumButton
                variant={'danger'}
                onClick={onReject || (() => handleAction(-1))}
                className={`flex-1`}
            >
                <AlertCircle className="w-5 h-5" />
                Từ chối ({count})
            </PremiumButton>
            <PremiumButton
                variant={'primary'}
                onClick={() => handleAction(1)}
                className={`flex-1 !bg-emerald-600 hover:!bg-emerald-700`}
            >
                <CheckCircle2 className="w-5 h-5" />
                Duyệt ({count})
            </PremiumButton>
        </div>
    );
};

export default TaskDetailsFooter;
