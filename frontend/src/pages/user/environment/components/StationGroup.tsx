import React, { useState } from 'react';
import { MapPin, ScrollText as ScrollTextIcon } from 'lucide-react';
import TaskItem from './TaskItem';
import { TaskDetail, StationChildConfig } from '../types';

interface StationGroupProps {
    stationId: string;
    stationName: string;
    childCatName: string;
    tasks: TaskDetail[];
    isExpanded: boolean;
    config?: StationChildConfig;
    processMap: Record<string, string>;
    draftCaptures: Record<string, (string | Blob)[]>;
    draftNotes: Record<string, string>;
    editingTasks: Set<string>;
    onToggle: () => void;
    onGuide: () => void;
    // Task Handlers
    onTaskEdit: (taskId: string) => void;
    onTaskSubmit: (taskId: string) => void;
    onTaskCamera: (taskId: string) => void;
    onTaskReset: (taskId: string) => void;
    // onTaskNoteChange removed as it is now local to TaskItem
    onTaskSaveNote: (taskId: string, note: string) => void;
    onTaskDeleteImage: (taskId: string, val: string | Blob, idx: number) => void;
    onTaskViewImage: (taskId: string, images: (string | Blob)[], idx: number) => void;
}

const MapPinCheckIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M19.43 12.935c.357-.967.57-1.955.57-2.935a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32.197 32.197 0 0 0 .813-.728" />
        <circle cx="12" cy="10" r="3" />
        <path d="m16 18 2 2 4-4" />
    </svg>
);

const StationGroup: React.FC<StationGroupProps> = React.memo(({
    stationId,
    stationName,
    childCatName,
    tasks,
    isExpanded,
    config,
    processMap,
    draftCaptures,
    draftNotes,
    editingTasks,
    onToggle,
    onGuide,
    onTaskEdit,
    onTaskSubmit,
    onTaskCamera,
    onTaskReset,
    onTaskSaveNote,
    onTaskDeleteImage,
    onTaskViewImage
}) => {
    const hasGuide = config && (config.guide_text || (config.guide_images && config.guide_images.length > 0));

    // Sort tasks - Memoized
    const sortedTasks = React.useMemo(() => {
        return [...tasks].sort((a, b) => {
            const nameA = (processMap[a.process_id || ''] || '').toLowerCase();
            const nameB = (processMap[b.process_id || ''] || '').toLowerCase();
            if (nameA.includes('trước') && !nameB.includes('trước')) return -1;
            if (!nameA.includes('trước') && nameB.includes('trước')) return 1;
            return nameA.localeCompare(nameB);
        });
    }, [tasks, processMap]);

    return (
        <div className="ml-2 md:ml-8 border-l-2 border-indigo-100">
            {/* Station Header */}
            <div
                onClick={onToggle}
                className="p-2 pl-2 md:pl-4 flex flex-wrap items-center justify-between cursor-pointer hover:bg-indigo-50/50 transition-colors gap-y-2"
            >
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-indigo-700 flex items-center gap-1 whitespace-nowrap">
                        <MapPinCheckIcon className="w-4 h-4" />
                        {stationName}
                    </span>

                    {/* Status Columns */}
                    <div className="flex items-center gap-1 ml-0 md:ml-2 flex-wrap">
                        {tasks.map(t => {
                            let colorClass = "bg-slate-200"; // Default
                            const check = t.check || t.status_work || 0;

                            if (t.status_approve === 1) colorClass = "bg-green-500"; // Approved
                            else if (t.status_reject === -1) colorClass = "bg-black"; // Resubmitted
                            else if (t.status_reject === 1) colorClass = "bg-red-500"; // Rejected
                            else if (t.status_submit === 1) colorClass = "bg-blue-500"; // Submitted
                            else if (check > 0) colorClass = "bg-yellow-400"; // Doing

                            return (
                                <div
                                    key={t.id}
                                    className={`w-3 h-3 rounded-full ${colorClass}`}
                                    title={processMap[t.process_id || ''] || 'Quy trình'}
                                />
                            );
                        })}
                    </div>

                    {hasGuide && (
                        <div
                            onClick={(e) => { e.stopPropagation(); onGuide(); }}
                            className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors border border-indigo-200/50"
                            title="Xem hướng dẫn"
                        >
                            <ScrollTextIcon className="w-4 h-4" />
                            <span className="text-xs font-medium hidden sm:inline">Hướng dẫn</span>
                            <span className="text-xs font-medium sm:hidden">HD</span>
                        </div>
                    )}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap ml-auto">{tasks.length} quy trình</span>
            </div>

            {/* Process Tasks */}
            {isExpanded && (
                <div className="pl-4 pb-2 space-y-2">
                    {sortedTasks.map(task => (
                        <TaskItem
                            key={task.id}
                            task={task}
                            processName={processMap[task.process_id || ''] || 'Quy trình'}
                            config={config}
                            isEditing={editingTasks.has(task.id)}
                            draftCaptures={draftCaptures[task.id] || []}
                            draftNote={draftNotes[task.id]}
                            onEdit={() => onTaskEdit(task.id)}
                            onSubmit={() => onTaskSubmit(task.id)}
                            onCamera={() => onTaskCamera(task.id)}
                            onReset={() => onTaskReset(task.id)}
                            onSaveNote={(note) => onTaskSaveNote(task.id, note)}
                            onDeleteImage={(val, idx) => onTaskDeleteImage(task.id, val, idx)}
                            onViewImage={(imgs, idx) => onTaskViewImage(task.id, imgs, idx)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});
export default StationGroup;
