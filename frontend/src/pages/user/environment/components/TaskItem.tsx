import React, { useState } from 'react';
import { Camera as CameraIcon, Save, X, RotateCcw, AlertOctagon as OctagonAlertIcon, CheckCircle2, ScrollText, AlertCircle, Trash2 } from 'lucide-react';
import TaskActionControls from './TaskActionControls';
import { Config, DetailAssign } from '../types';
import { getImageUrl } from '../../../../utils/imageUtils';

interface TaskItemProps {
    task: DetailAssign;
    processName: string;
    config?: Config;
    isEditing: boolean;
    isSubmitting: boolean;
    onSubmit: (overrideNote?: string) => void;
    onCamera: () => void;
    onReset: () => void;
    onSaveNote: (note: string) => void;
    onDeleteImage: (val: string | Blob, index: number) => void;
    onViewImage: (images: (string | Blob)[], index: number) => void;
    draftCaptures?: (string | Blob)[];
    draftNote?: string;
    onEdit: () => void;
    usersMap?: Record<string, string>; // uuid -> name
}

const getStatusBadge = (task: DetailAssign) => {
    const check = task.status_work || 0;

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
    const isVideo = typeof item === 'string' && !item.startsWith('blob:') && !item.startsWith('data:') && item.includes('.webm');
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
                    className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1 shadow shadow-red-500/50 text-white hover:bg-red-600 transition-colors z-10"
                    title={typeof item === 'string' && !item.startsWith('blob:') && !item.startsWith('data:') ? "Xóa vĩnh viễn" : "Xóa"}
                >
                    <X className="w-4 h-4" strokeWidth={3} />
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
    isSubmitting,
    draftCaptures = [],
    draftNote,
    onEdit,
    onSubmit,
    onCamera,
    onReset,
    onSaveNote,
    onDeleteImage,
    onViewImage,
    usersMap = {},
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
                        onBlur={() => onSaveNote(localNote)}
                        placeholder="Nhập chú thích cho công việc này..."
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none"
                        rows={2}
                    />
                </div>
            </div>

            {/* Action Buttons & Draft UI */}
            <div className="mt-3">
                {draftCaptures.length > 0 ? (() => {
                    const isRejected = task.status_reject === 1;
                    // Show delete on thumbnails if formally editing OR if task was rejected (need to fix images)
                    const canDelete = isEditing || isRejected;

                    // Parse rejection actor(s) and time(s)
                    let rejectActors: string[] = [];
                    let rejectTimes: Date[] = [];
                    if (isRejected) {
                        const rawActors = task.id_person_reject;
                        if (rawActors) {
                            if (Array.isArray(rawActors)) rejectActors = rawActors;
                            else { try { rejectActors = JSON.parse(rawActors as string); } catch { rejectActors = [rawActors as string]; } }
                        }
                        const rawTimes = task.rejected_at;
                        let timesArr: string[] = [];
                        if (rawTimes) {
                            if (Array.isArray(rawTimes)) timesArr = rawTimes as string[];
                            else { try { timesArr = JSON.parse(rawTimes as string); } catch { if (rawTimes) timesArr = [rawTimes as string]; } }
                        }
                        rejectTimes = timesArr.map(t => new Date(t)).filter(d => !isNaN(d.getTime()));
                    }
                    const latestRejectTime = rejectTimes.length > 0 ? rejectTimes[rejectTimes.length - 1] : null;
                    const latestRejectActor = rejectActors.length > 0 ? rejectActors[rejectActors.length - 1] : null;

                    // Image count info
                    const maxImages = config?.status_set_image_count && config.image_count && config.image_count > 0 ? config.image_count : null;
                    const currentCount = draftCaptures.length;
                    const overLimit = maxImages !== null && currentCount > maxImages;

                    return (
                        <div className="space-y-3">
                            {/* Rejection info banner */}
                            {isRejected && (latestRejectTime || latestRejectActor) && (
                                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs">
                                    <span className="font-bold text-red-700">Bị từ chối:</span>
                                    {latestRejectTime && (
                                        <span className="text-red-600">
                                            {latestRejectTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </span>
                                    )}
                                    {latestRejectActor && (
                                        <span className="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium" title={latestRejectActor}>
                                            Bởi: {usersMap[latestRejectActor] || (latestRejectActor.slice(0, 8) + '…')}
                                        </span>
                                    )}
                                    {maxImages !== null && (
                                        <span className={`ml-auto font-bold px-2 py-0.5 rounded-full border ${overLimit ? 'text-red-700 bg-red-100 border-red-300' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                                            {currentCount}/{maxImages} ảnh {overLimit ? '[WARNING] Vượt quá!' : ''}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Image count info (non-rejected) */}
                            {!isRejected && maxImages !== null && (
                                <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${overLimit ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                    <span>Số ảnh: <strong>{currentCount}</strong> / {maxImages}</span>
                                    {overLimit && <span className="font-bold">[WARNING] Vượt giới hạn!</span>}
                                </div>
                            )}

                            {/* Draft Thumbnails */}
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                {draftCaptures.map((item, idx) => {
                                    const url = getImageUrl(item);
                                    return (
                                        <Thumbnail
                                            key={idx}
                                            item={item}
                                            url={url}
                                            isEditing={canDelete}
                                            onClick={() => !canDelete && onViewImage(draftCaptures, idx)}
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
                                    isSubmitting={isSubmitting}
                                    draftCount={draftCaptures.length}
                                    onEdit={onEdit}
                                    onSubmit={() => onSubmit(localNote)}
                                    onCamera={onCamera}
                                />
                            </div>
                        </div>
                    );
                })() : (
                    <div className="flex items-center justify-end gap-3">
                        {config?.image_count && config.image_count > 0 && (
                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                                Yêu cầu: {config.image_count} ảnh
                            </span>
                        )}

                        {(() => {
                            const events: { date: Date, type: 'submit' | 'approve' | 'reject', actorId?: string }[] = [];

                            const uniqueDates = new Set<string>();

                            const addEvent = (dStr: string, type: 'submit' | 'approve' | 'reject', actorId?: string) => {
                                const d = new Date(dStr);
                                if (!isNaN(d.getTime())) {
                                    const timeKey = `${type}-${d.getFullYear()}${d.getMonth()}${d.getDate()}${d.getHours()}${d.getMinutes()}`;
                                    if (!uniqueDates.has(timeKey)) {
                                        uniqueDates.add(timeKey);
                                        events.push({ date: d, type, actorId });
                                    }
                                }
                            };

                            const parseDateArray = (field: any, type: 'submit' | 'approve' | 'reject', actors?: any) => {
                                if (!field) return;
                                let actorArr: string[] = [];
                                if (actors) {
                                    if (Array.isArray(actors)) actorArr = actors;
                                    else if (typeof actors === 'string') { try { actorArr = JSON.parse(actors); } catch { } }
                                }
                                let arr: string[] = [];
                                if (Array.isArray(field)) arr = field;
                                else if (typeof field === 'string') {
                                    try { arr = JSON.parse(field); } catch (e) {
                                        if (!isNaN(new Date(field).getTime())) addEvent(field, type, actorArr[0]);
                                        return;
                                    }
                                }
                                arr.forEach((dStr: string, i: number) => addEvent(dStr, type, actorArr[i]));
                            };

                            parseDateArray(task.submitted_at, 'submit');
                            parseDateArray(task.approval_at, 'approve', task.id_person_approve);
                            parseDateArray(task.rejected_at, 'reject', task.id_person_reject);

                            events.sort((a, b) => a.date.getTime() - b.date.getTime());

                            if (events.length > 0) {
                                return (
                                    <div className="flex flex-col items-end gap-1.5 ml-auto">
                                        <div className="space-y-1 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:to-transparent">
                                            {events.map((ev, idx) => (
                                                <div key={idx} className="relative flex items-center gap-2 text-xs pl-4">
                                                    <div className={`absolute left-0 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm shrink-0 ${ev.type === 'approve' ? 'bg-green-500' :
                                                        ev.type === 'reject' ? 'bg-red-500' : 'bg-indigo-500'
                                                        }`}></div>
                                                    <span className={`font-semibold ${ev.type === 'approve' ? 'text-green-600' :
                                                        ev.type === 'reject' ? 'text-red-600' : 'text-indigo-600'
                                                        }`}>
                                                        {ev.type === 'approve' ? 'Đã duyệt' : ev.type === 'reject' ? 'Từ chối' : 'Đã nộp'}
                                                    </span>
                                                    <span className="text-slate-500">
                                                        {ev.date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                    </span>
                                                    {ev.actorId && (ev.type === 'approve' || ev.type === 'reject') && (
                                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${ev.type === 'approve' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                                                            }`} title={ev.actorId}>
                                                            {ev.actorId.slice(0, 8)}…
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <button
                                    onClick={onCamera}
                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors inline-flex items-center gap-1 ml-auto"
                                >
                                    <CameraIcon className="w-3 h-3" /> Chụp ảnh
                                </button>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
});
export default TaskItem;
