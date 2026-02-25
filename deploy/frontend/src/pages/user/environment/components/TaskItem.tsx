import React, { useState } from 'react';
import { Camera as CameraIcon, Save, X, RotateCcw, AlertOctagon as OctagonAlertIcon, CheckCircle2, ScrollText, AlertCircle, Trash2 } from 'lucide-react';
import TaskActionControls from './TaskActionControls';
import { StationChildConfig, TaskDetail } from '../types';
import { getImageUrl } from '../../../../utils/imageUtils';

interface TaskItemProps {
    task: TaskDetail;
    processName: string;
    config?: StationChildConfig;
    isEditing: boolean;
    onSubmit: () => void;
    onCamera: () => void;
    onReset: () => void;
    onSaveNote: (note: string) => void;
    onDeleteImage: (val: string | Blob, index: number) => void;
    onViewImage: (images: (string | Blob)[], index: number) => void;
    draftCaptures?: (string | Blob)[];
    draftNote?: string;
    onEdit: () => void;
}

const getStatusBadge = (task: TaskDetail) => {
    const check = task.check || task.status_work || 0;

    // Status Logic
    if (task.status_approve === 1) return { label: 'Đã duyệt', bg: 'bg-green-100', text: 'text-green-700' };
    if (task.status_reject === -1) return { label: 'Đã chỉnh sửa và nộp lại', bg: 'bg-indigo-100', text: 'text-indigo-700' }; // Black/Dark Indigo for text
    if (task.status_reject === 1) return { label: 'Bị từ chối', bg: 'bg-red-100', text: 'text-red-700' };
    if (task.status_submit === 1) return { label: 'Chờ duyệt', bg: 'bg-amber-100', text: 'text-amber-700' };
    if (check > 0) return { label: 'Đang làm', bg: 'bg-blue-100', text: 'text-blue-700' };

    return { label: 'Chưa làm', bg: 'bg-slate-100', text: 'text-slate-600' };
};

// Helper Component for Thumbnails
const Thumbnail: React.FC<{
    item: string | Blob;
    url: string;
    isEditing: boolean;
    onDelete: () => void;
    onClick: () => void;
}> = ({ item, url, isEditing, onDelete, onClick }) => {
    const [hasError, setHasError] = useState(false);
    const isVideo = typeof item === 'string' && !item.startsWith('blob:') && item.includes('.webm');
    const isLocal = item instanceof Blob || (typeof item === 'string' && item.startsWith('blob:'));

    return (
        <div
            className={`relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-200 cursor-pointer transition-all ${isEditing ? 'ring-2 ring-red-400' : 'hover:opacity-80'}`}
            onClick={onClick}
        >
            {isVideo ? (
                <video src={url} className="w-full h-full object-cover" />
            ) : hasError ? (
                <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-1">
                    <AlertCircle className="w-6 h-6 text-slate-400" />
                    <span className="text-[8px] text-slate-500 font-medium mt-1">Lỗi ảnh</span>
                </div>
            ) : (
                <img
                    src={url}
                    alt="draft"
                    className="w-full h-full object-cover"
                    onError={() => setHasError(true)}
                />
            )}

            {isLocal && (
                <div className="absolute bottom-1 right-1 bg-amber-500 rounded-full p-0.5 shadow-sm" title="Đang chờ đồng bộ">
                    <RotateCcw className="w-2.5 h-2.5 text-white animate-spin-slow" />
                </div>
            )}

            {isEditing && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="absolute inset-0 bg-red-600/80 flex flex-col items-center justify-center text-white opacity-100 hover:bg-red-700/90 transition-colors gap-1"
                >
                    {typeof item === 'string' && !item.startsWith('blob:') ? (
                        <>
                            <AlertCircle className="w-5 h-5" />
                            <span className="text-[10px] font-bold px-1 text-center leading-tight">Xóa vĩnh viễn</span>
                        </>
                    ) : (
                        <Trash2 className="w-6 h-6" />
                    )}
                </button>
            )}
        </div>
    );
};

const TaskItem: React.FC<TaskItemProps> = React.memo(({
    task,
    processName,
    config,
    isEditing,
    draftCaptures = [],
    draftNote,
    onEdit,
    onSubmit,
    onCamera,
    onReset,
    onSaveNote,
    onDeleteImage,
    onViewImage
}) => {
    const badge = getStatusBadge(task);
    const [localNote, setLocalNote] = useState(draftNote || '');
    const apiUrl = import.meta.env.VITE_API_URL || '/api';




    // Sync local note if prop changes (e.g. initial load)
    React.useEffect(() => {
        setLocalNote(draftNote || '');
    }, [draftNote]);

    return (
        <div className="ml-4 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 flex items-center gap-2">
                        <CameraIcon className="w-4 h-4 text-slate-500" />
                        {processName}
                    </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
                    {badge.label}
                </span>
            </div>

            {/* Rejection Note */}
            {task.note_reject && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <OctagonAlertIcon className="w-4 h-4" />
                    {task.note_reject}
                </p>
            )}

            {/* Note Input Section */}
            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1 mb-2">
                    <ScrollText className="w-3 h-3" />
                    Chú thích
                </label>
                <div className="flex gap-2">
                    <textarea
                        value={localNote}
                        onChange={(e) => setLocalNote(e.target.value)}
                        placeholder="Nhập chú thích cho công việc này..."
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none"
                        rows={2}
                    />
                    <button
                        onClick={() => onSaveNote(localNote)}
                        className="px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center justify-center"
                        title="Lưu chú thích"
                    >
                        <Save className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Action Buttons & Draft UI */}
            <div className="mt-3">
                {draftCaptures.length > 0 ? (
                    <div className="space-y-3">
                        {/* Draft Thumbnails */}
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {draftCaptures.map((item, idx) => {
                                const url = getImageUrl(item);
                                return (
                                    <Thumbnail
                                        key={idx}
                                        item={item}
                                        url={url}
                                        isEditing={isEditing}
                                        onClick={() => !isEditing && onViewImage(draftCaptures, idx)}
                                        onDelete={() => onDeleteImage(item, idx)}
                                    />
                                );
                            })}
                        </div>

                        {/* Submit/Edit Buttons */}
                        <div className="flex items-center justify-end gap-3">
                            <TaskActionControls
                                task={task}
                                isEditing={isEditing}
                                draftCount={draftCaptures.length}
                                onEdit={onEdit}
                                onSubmit={onSubmit}
                                onCamera={onCamera}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-end gap-3">
                        {config?.image_count && config.image_count > 0 && (
                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                                Yêu cầu: {config.image_count} ảnh
                            </span>
                        )}

                        {task.status_submit === 1 ? (
                            <span className="text-sm font-bold text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" /> Đã nộp
                                {task.submitted_at && (
                                    <span className="text-xs font-normal text-slate-500 ml-1">
                                        ({new Date(task.submitted_at).toLocaleString('vi-VN')})
                                    </span>
                                )}
                                <button
                                    onClick={onReset}
                                    className="ml-2 text-slate-400 hover:text-red-500 text-xs underline"
                                    title="Nộp lại từ đầu (Reset)"
                                >
                                    (Reset)
                                </button>
                            </span>
                        ) : (
                            <button
                                onClick={onCamera}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors inline-flex items-center gap-1"
                            >
                                <CameraIcon className="w-3 h-3" /> Chụp ảnh
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});
export default TaskItem;
