import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
 Camera as CameraIcon, Save, X, RotateCcw,
 AlertOctagon as OctagonAlertIcon, CheckCircle2, ScrollText,
 AlertCircle, CalendarCheck, Clock, ChevronDown, MessageSquarePlus,
 Image as ImageIcon, BookOpen
} from 'lucide-react';
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
  onOpenGuide?: () => void;
 usersMap?: Record<string, string>;
}

/** Which completed states trigger the Micro-Card */
const isCompletedState = (task: DetailAssign) =>
 task.status_approve === 1 ||
 (task.status_submit === 1 && task.status_reject !== 1);

const getStatusBadge = (task: DetailAssign) => {
 if (task.status_approve === 1) return { label: 'Đã duyệt', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' };
 if (task.status_reject === 1 && task.status_submit === 1) return { label: 'Đã nộp lại', bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' };
 if (task.status_reject === 1) return { label: 'Bị từ chối', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' };
 if (task.status_submit === 1) return { label: 'Chờ duyệt', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' };
 if ((task.status_work || 0) > 0) return { label: 'Đang làm', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' };
 return { label: 'Chưa làm', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-300' };
};

// ─── Thumbnail ────────────────────────────────────────────
const Thumbnail: React.FC<{
 item: string | Blob;
 url: string;
 isEditing: boolean;
 onDelete: () => void;
 onClick: () => void;
}> = ({ item, url, isEditing, onDelete, onClick }) => {
 const [hasError, setHasError] = useState(false);
 const isVideoString = typeof item === 'string' && (item.includes('.webm') || item.includes('.mp4') || item.includes('#video'));
 const isVideoBlob = item instanceof Blob && item.type.startsWith('video/');
 const isVideo = isVideoString || isVideoBlob;
 const isLocal = item instanceof Blob || (typeof item === 'string' && item.startsWith('blob:'));

 return (
 <div
 className={`relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-slate-200 cursor-pointer transition-all ${isEditing ? 'ring-2 ring-red-400' : 'hover:opacity-80'}`}
 onClick={onClick}
 >
 {isVideo ? (
 <video src={url} className="w-full h-full object-cover" />
 ) : hasError ? (
 <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-1">
 <AlertCircle className="w-5 h-5 text-slate-400" />
 </div>
 ) : (
 <img src={url} alt="draft" className="w-full h-full object-cover" onError={() => setHasError(true)} />
 )}

 {isLocal && (
 <div className="absolute bottom-0.5 right-0.5 bg-amber-500 rounded-full p-0.5 shadow-sm" title="Đang chờ đồng bộ">
 <RotateCcw className="w-2 h-2 text-white animate-spin-slow" />
 </div>
 )}
 {isEditing && (
 <button
 onClick={(e) => { e.stopPropagation(); onDelete(); }}
 className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 shadow text-white hover:bg-red-600 z-10"
 >
 <X className="w-3 h-3" strokeWidth={3} />
 </button>
 )}
 </div>
 );
};

// ─── Status Banner (Rejected / Approved / Submitted) ─────
const parseLatestEvent = (timesStr: any, actorsStr: any) => {
 let times: Date[] = [];
 if (Array.isArray(timesStr)) times = timesStr.map(t => new Date(t));
 else if (typeof timesStr === 'string') {
 try { times = JSON.parse(timesStr).map((t: string) => new Date(t)); }
 catch { times = [new Date(timesStr)]; }
 }
 let actors: string[] = [];
 if (Array.isArray(actorsStr)) actors = actorsStr;
 else if (typeof actorsStr === 'string') {
 try { actors = JSON.parse(actorsStr); }
 catch { actors = [actorsStr]; }
 }
 const validTimes = times.filter(t => !isNaN(t.getTime()));
 const latestTime = validTimes.length > 0 ? validTimes[validTimes.length - 1] : null;
 const latestActor = actors.length > 0 ? actors[actors.length - 1] : null;
 return { latestTime, latestActor };
};

const StatusBanner: React.FC<{ task: DetailAssign; usersMap: Record<string, string> }> = ({ task, usersMap }) => {
 if (task.status_reject === 1 && task.status_submit !== 1) {
 const { latestTime, latestActor } = parseLatestEvent(task.rejected_at, task.id_person_reject);
 return (
 <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex flex-col gap-1">
 <div className="flex items-start gap-1.5">
 <OctagonAlertIcon className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
 <div>
 <span className="text-[10px] font-bold text-red-700 uppercase tracking-wide">Yêu cầu sửa</span>
 <div className="text-xs font-semibold text-red-800 leading-snug">"{task.note_reject || 'Không có lý do'}"</div>
 </div>
 </div>
 {(latestTime || latestActor) && (
 <div className="flex items-center gap-1 text-[10px] text-red-600 ml-5">
 <Clock className="w-2.5 h-2.5 shrink-0" />
 <span className="truncate">
 {latestTime ? latestTime.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
 {latestActor ? ` bởi ${usersMap[latestActor] || latestActor.slice(0, 8)}` : ''}
 </span>
 </div>
 )}
 </div>
 );
 }

 if (task.status_approve === 1) {
 const { latestTime, latestActor } = parseLatestEvent(task.approval_at, task.id_person_approve);
 return (
 <div className="mt-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col gap-0.5">
 <div className="flex items-center gap-1.5">
 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
 <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Đã nghiệm thu</span>
 </div>
 {(latestTime || latestActor) && (
 <div className="flex items-center gap-1 text-[10px] text-emerald-700 ml-5">
 <CalendarCheck className="w-2.5 h-2.5 shrink-0" />
 <span className="truncate">
 {latestTime ? latestTime.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
 {latestActor ? ` bởi ${usersMap[latestActor] || latestActor.slice(0, 8)}` : ''}
 </span>
 </div>
 )}
 </div>
 );
 }

 if (task.status_submit === 1) {
 const { latestTime } = parseLatestEvent(task.submitted_at, null);
 const isResubmit = task.status_reject === 1;
 return (
 <div className="mt-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-1.5">
 <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
 <span className="text-[10px] font-medium text-indigo-800 truncate">
 <span className="font-bold">{isResubmit ? 'Đã nộp lại' : 'Đã nộp'}</span>
 {latestTime ? ` lúc ${latestTime.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : ''}
 </span>
 </div>
 );
 }

 return null;
};

// ──────────────────────────────────────────────────────────────────────────────
// MICRO-CARD — collapsed 1-row preview for Done tasks
// ──────────────────────────────────────────────────────────────────────────────
const MicroCard: React.FC<{
 task: DetailAssign;
 processName: string;
 draftCaptures: (string | Blob)[];
 draftNote?: string;
 onExpand: () => void;
 onEdit: () => void;
  onOpenGuide?: () => void;
  usersMap: Record<string, string>;
}> = ({ task, processName, draftCaptures, draftNote, onExpand, onEdit, usersMap, onOpenGuide }) => {
 const badge = getStatusBadge(task);
 const imageCount = draftCaptures.length;
 const hasNote = !!(draftNote && draftNote.trim());

 return (
 <button
 onClick={onExpand}
 className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors group"
 >
 {/* Status dot */}
 <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dot}`} />

 {/* Name */}
 <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 truncate">
 {processName}
 </span>

 {/* Chips */}
 <div className="flex items-center gap-2 shrink-0">
 {imageCount > 0 && (
 <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
 <ImageIcon className="w-3 h-3" />
 {imageCount}
 </span>
 )}
 {hasNote && (
 <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
 <ScrollText className="w-3 h-3" />
 </span>
 )}
 
      {task.has_guide && onOpenGuide && (
        <span onClick={(e) => { e.stopPropagation(); onOpenGuide(); }} className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full hover:bg-teal-100 transition-colors" title="Xem hướng dẫn">
          <BookOpen className="w-3 h-3" />
        </span>
      )}
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
 {badge.label}
 </span>
 <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
 </div>
 </button>
 );
};

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────
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
  onOpenGuide,
}) => {
 const badge = getStatusBadge(task);
 const [localNote, setLocalNote] = useState(draftNote || '');
 const [showNoteInput, setShowNoteInput] = useState(false);
 // Controls whether Micro-Card is expanded (in-place) or collapsed
 const [microExpanded, setMicroExpanded] = useState(false);

 React.useEffect(() => {
 setLocalNote(draftNote || '');
 }, [draftNote]);

 const canDelete = isEditing || (task.status_reject === 1 && task.status_submit === 0);
 const isDoneState = isCompletedState(task);

 // ── MICRO-CARD MODE (collapsed by default) ────────────────────
 if (isDoneState && !isEditing) {
 return (
 <div className="border-b border-slate-100 last:border-b-0">
 <MicroCard
 task={task}
 processName={processName}
 draftCaptures={draftCaptures}
 draftNote={draftNote}
 onExpand={() => setMicroExpanded(v => !v)}
 onEdit={onEdit}
 usersMap={usersMap}
          onOpenGuide={onOpenGuide}
        />

        <AnimatePresence>
 {microExpanded && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.22, ease: 'easeInOut' }}
 className="overflow-hidden"
 >
 <div className="px-4 pb-4 pt-2 bg-slate-50/60 border-t border-slate-100 ">
 {/* Status Banner */}
 <StatusBanner task={task} usersMap={usersMap} />

 {/* Photo strip */}
 {draftCaptures.length > 0 && (
 <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
 {draftCaptures.map((item, idx) => (
 <Thumbnail
 key={idx}
 item={item}
 url={getImageUrl(item)}
 isEditing={false}
 onClick={() => onViewImage(draftCaptures, idx)}
 onDelete={() => {}}
 />
 ))}
 </div>
 )}

 {/* Note preview */}
 {draftNote && draftNote.trim() && (
 <p className="mt-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 line-clamp-3">
 <ScrollText className="w-3 h-3 inline mr-1 text-slate-400" />
 {draftNote}
 </p>
 )}

 {/* Edit button */}
 <div className="mt-3 flex justify-end">
 <button
 onClick={onEdit}
 className="text-xs font-bold text-slate-500 underline underline-offset-2 hover:text-indigo-600 transition-colors"
 >
 Chỉnh sửa / Nộp lại
 </button>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
 }

 // ── FULL CARD MODE (tasks đang làm / bị từ chối / editing) ───
 return (
 <div className="p-4 flex flex-col gap-3 border-b border-slate-100 last:border-b-0">
 {/* Header row */}
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2 min-w-0">
 <CameraIcon className="w-4 h-4 text-slate-400 shrink-0" />
 <span className="text-sm font-semibold text-slate-800 truncate">{processName}</span>
 </div>
 <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${badge.bg} ${badge.text}`}>
 {badge.label}
 </span>
 </div>

 {/* Status Banner */}
 <StatusBanner task={task} usersMap={usersMap} />

 {/* Photo strip (if any drafts) */}
 {draftCaptures.length > 0 && (
 <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
 <AnimatePresence mode="popLayout">
 {draftCaptures.map((item, idx) => {
 const url = getImageUrl(item);
 // Dùng url hoặc base64 string nếu là string, dùng fallback idx kết hợp chuỗi cho Blob để tránh unmount sai
 const key = typeof item === 'string' ? item : `blob-${idx}`; 
 
 return (
 <motion.div
 layout
 initial={{ opacity: 0, scale: 0.8 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.5, width: 0, padding: 0, marginRight: 0 }}
 transition={{ duration: 0.2, ease: "easeInOut" }}
 key={key}
 >
 <Thumbnail
 item={item}
 url={url}
 isEditing={canDelete}
 onClick={() => onViewImage(draftCaptures, idx)}
 onDelete={() => onDeleteImage(item, idx)}
 />
 </motion.div>
 );
 })}
 </AnimatePresence>
 </div>
 )}

 {/* Note area — collapsed by default, expand on tap */}
 <AnimatePresence>
 {showNoteInput && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.18, ease: 'easeInOut' }}
 className="overflow-hidden"
 >
 <div className="flex gap-2">
 <textarea
 value={localNote}
 onChange={(e) => setLocalNote(e.target.value)}
 onBlur={() => { onSaveNote(localNote); }}
 placeholder="Nhập chú thích cho công việc này..."
 className="flex-1 px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none outline-none text-slate-800 "
 rows={2}
 autoFocus
 />
 <button
 onClick={() => setShowNoteInput(false)}
 className="text-slate-400 hover:text-slate-600 self-start mt-1"
 title="Đóng"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Action row */}
 <div className="flex flex-nowrap items-center justify-between gap-y-3 gap-x-2 pt-2 pb-1 border-t border-slate-100 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
 {/* Left: image count + add note toggle */}
 <div className="flex items-center gap-2">
 {(() => {
 const maxImages = config?.status_set_image_count && config.image_count && config.image_count > 0 ? config.image_count : null;
 const currentCount = draftCaptures.length;
 const overLimit = maxImages !== null && currentCount > maxImages;
 if (maxImages !== null) {
 return (
 <span className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border whitespace-nowrap shrink-0 ${overLimit ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
 {currentCount}/{maxImages} ảnh{overLimit && ' ⚠️'}
 </span>
 );
 }
 if (currentCount > 0) {
 return <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0">{currentCount} ảnh</span>;
 }
 return null;
 })()}

 {/* Note toggle button */}
 <button
 onClick={() => setShowNoteInput(v => !v)}
 className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1.5 rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
 localNote.trim()
 ? 'bg-amber-50 border-amber-200 text-amber-700'
 : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
 }`}
 title="Thêm/Xem ghi chú"
 >
 <MessageSquarePlus className="w-3.5 h-3.5" />
 <span className="hidden sm:inline">{localNote.trim() ? 'Ghi chú' : 'Thêm ghi chú'}</span>
 <span className="sm:hidden">Ghi chú</span>
 </button>
 </div>

 {/* Right: Camera / Submit controls */}
 <div className="flex items-center gap-2 shrink-0 ml-auto">
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
 </div>
 );
});

export default TaskItem;
