import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, Briefcase, Wrench, User, Clock, CalendarCheck, CalendarRange, CheckCircle2, FileText, Image as ImageIcon, ChevronRight, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { TaskRow } from '../types';
import { getImageUrl } from '../../../../utils/imageUtils';
import { parseSafeDate } from '../../../../utils/timeUtils';


interface TaskReportModalProps {
 task: TaskRow;
 isOpen: boolean;
 onClose: () => void;
 usersMap?: Record<string, string>;
 onViewImage: (images: string[], index: number) => void;
 evidenceMap?: Record<string, string[]>;
 noteMap?: Record<string, string>;
}

const formatDateSafe = (val: any) => {
 if (!val) return '—';
 const arr = Array.isArray(val) ? val : typeof val === 'string' && val.startsWith('[') ? (() => { try { return JSON.parse(val); } catch { return [val]; } })() : [val];
 const last = arr[arr.length - 1];
 const d = parseSafeDate(last);
 return isNaN(d.getTime()) ? '—' : format(d, 'HH:mm, dd/MM/yyyy');
};

// InfoRow is currently unused because we switched to a highly custom 3-col card layout, but we can keep it around if needed elsewhere

const TaskReportModal: React.FC<TaskReportModalProps> = ({
 task,
 isOpen,
 onClose,
 usersMap = {},
 onViewImage,
 evidenceMap = {},
 noteMap = {},
}) => {
 const [copied, setCopied] = useState(false);
 const handleCopyLink = () => {
 const base = window.location.origin;
 const queryParams = new URLSearchParams();
 if (task.assetId) queryParams.set('asset', task.assetId);
 if (task.subWorkId) queryParams.set('sub', task.subWorkId);
 
 const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
 const url = `${base}/share/report/${task.assignId}${queryString}`;
 
 navigator.clipboard.writeText(url).then(() => {
 setCopied(true);
 setTimeout(() => setCopied(false), 2500);
 });
 };

 if (!isOpen || !task) return null;

 // Determine approver name(s)
 const parseJsonArray = (field: any): any[] => {
 if (!field) return [];
 if (Array.isArray(field)) return field;
 if (typeof field === 'string') { try { return JSON.parse(field); } catch { } }
 return [];
 };
 const approverIds = parseJsonArray((task as any).idPersonApprove || (task as any).id_person_approve);
 
 // Only get the most recent approver to avoid duplication
 const latestApproverId = approverIds.length > 0 ? approverIds[approverIds.length - 1] : null;
 const approverNames = latestApproverId ? [usersMap[latestApproverId] || latestApproverId.slice(0, 8) + '…'] : [];

 const subTasks = task.subTasks && task.subTasks.length > 0 ? task.subTasks : [task];

 return ReactDOM.createPortal(
 <AnimatePresence>
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-lg">
 <motion.div
 initial={{ opacity: 0, scale: 0.96, y: 16 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.96 }}
 transition={{ duration: 0.25, ease: 'easeOut' }}
 className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-white/40 flex flex-col overflow-hidden"
 style={{ maxHeight: '90vh' }}
 >
 {/* Header */}
 <div className="relative flex flex-col sm:flex-row sm:items-center justify-between px-8 py-5 border-b border-indigo-700 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 overflow-hidden flex-shrink-0 gap-4">
 <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_70%_50%,white,transparent)]"></div>
 <div className="relative flex-1 min-w-0">
 {/* Header Label Removed */}
 <h2 className="text-xl md:text-2xl font-black text-white tracking-tight leading-snug flex items-center flex-wrap gap-2">
 {task.templateName || task.modelProjectName || 'Nội dung CV'}
 <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 mx-1 opacity-70"></span>
 <span className="text-indigo-50">{task.subWorkName}</span>
 <span className="text-xs md:text-sm font-bold text-indigo-50 bg-black/15 px-3 py-1 rounded-lg border border-white/20 ml-1 whitespace-nowrap">
 {task.workName}
 </span>
 </h2>
 </div>
 <button onClick={onClose} className="relative p-2 rounded-lg bg-white/10 text-white/90 hover:bg-white/25 hover:text-white transition-all shrink-0">
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Body */}
 <div className="overflow-y-auto flex-1 p-5 md:p-8 custom-scrollbar bg-slate-50/60 space-y-8">

 {/* Information Dashboard */}
 <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
 {/* Dashboard Header: Project & Owner */}
 <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
 <Building2 className="w-6 h-6" />
 </div>
 <div>
 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Dự án & Chủ Đầu Tư</div>
 <div className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 flex-wrap">
 {task.projectName || '—'}
 <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
 <span className="text-indigo-600 truncate max-w-[200px]" title={task.ownerName}>{task.ownerName || '—'}</span>
 </div>
 </div>
 </div>
 <div className="hidden sm:block">
 <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1.5">
 <CheckCircle2 className="w-4 h-4" /> Đã nghiệm thu
 </div>
 </div>
 </div>

 {/* Dashboard Body: 3 Columns layout (Row-aligned) */}
 <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6 items-start">
 {/* --- ROW 1 --- */}
 <div>
 <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
 <FileText className="w-3.5 h-3.5 text-slate-400" /> Nội dung công việc
 </div>
 <div className="text-[13px] font-semibold text-slate-800 leading-snug">
 {task.templateName || task.modelProjectName || '—'}
 </div>
 </div>

 <div>
 <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
 <Briefcase className="w-3.5 h-3.5 text-slate-400" /> Công việc
 </div>
 <div className="text-[13px] font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
 {task.workName} 
 <ChevronRight className="w-3.5 h-3.5 text-slate-300" /> 
 <span className="text-indigo-600 font-bold">{task.subWorkName}</span>
 </div>
 </div>

 {/* Implementer Card */}
 <div className="relative p-3.5 rounded-xl border border-slate-200/60 bg-slate-50 hover:bg-slate-100/50 transition-colors group">
 <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
 <User className="w-12 h-12" />
 </div>
 <div className="relative z-10">
 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Người thực hiện</div>
 <div className="text-[13px] font-bold text-slate-800 mb-2 leading-snug line-clamp-2" title={task.userName}>
 {task.userName || '—'}
 </div>
 <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-white px-2 py-1 inline-flex rounded border border-slate-200 shadow-sm">
 <Clock className="w-3.5 h-3.5" /> Nộp: {formatDateSafe(task.submittedAt)}
 </div>
 </div>
 </div>

 {/* --- ROW 2 --- */}
 <div>
 <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
 <Wrench className="w-3.5 h-3.5 text-slate-400" /> Thiết bị / Khu vực
 </div>
 <div className="text-[13px] font-semibold text-slate-800">
 {(() => {
 const parent = (task as any).parentAssetName || (task as any).parent_asset_name;
 const assetName = task.assetName || '—';
 return parent ? `${parent} - ${assetName}` : assetName;
 })()}
 </div>
 </div>

 <div>
 <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
 <CalendarRange className="w-3.5 h-3.5 text-slate-400" /> Thời gian kế hoạch
 </div>
 <div className="text-[12px] font-bold text-slate-700">
 {task.startTime || task.endTime ? (
 <div className="inline-flex flex-col gap-1.5 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 w-full">
 <span className="flex items-center gap-2 text-slate-600">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Bắt đầu: {formatDateSafe(task.startTime)}
 </span>
 <span className="flex items-center gap-2 text-slate-600">
 <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div> Kết thúc: {formatDateSafe(task.endTime)}
 </span>
 </div>
 ) : '—'}
 </div>
 </div>

 {/* Approver Card */}
 <div className="relative p-3.5 rounded-xl border border-emerald-200/60 bg-emerald-50/50 hover:bg-emerald-50 transition-colors group h-full">
 <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
 <CheckCircle2 className="w-12 h-12 text-emerald-600" />
 </div>
 <div className="relative z-10">
 <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1.5">Người duyệt</div>
 <div className="text-[13px] font-bold text-emerald-950 mb-2 leading-snug line-clamp-2" title={approverNames.join(', ')}>
 {approverNames.length > 0 ? approverNames.join(', ') : '—'}
 </div>
 <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-white/60 px-2 py-1 inline-flex rounded border border-emerald-200 shadow-sm">
 <CalendarCheck className="w-3.5 h-3.5" /> Duyệt: {formatDateSafe(task.approvalAt)}
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Process Image Sections */}
 <div className="space-y-5">
 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
 <ImageIcon className="w-3.5 h-3.5" /> Hình ảnh minh chứng theo quy trình
 </h3>
 {subTasks.map((subTask: any, tIdx: number) => {
 const dr = subTask.dataResult || (subTask.data_result ? (() => { try { return JSON.parse(subTask.data_result); } catch { return null; } })() : null);
 const processLabel = subTask.processName || `Quy trình ${tIdx + 1}`;

 let dbImages: string[] = [];
 if (Array.isArray(dr)) dbImages = dr;
 else if (dr && dr.data && Array.isArray(dr.data)) dbImages = dr.data;
 // V2 schema: URLs are stored in subTask.data (a JSON array of MinIO URLs)
 // This is the primary source — must be checked before legacy fields.
 else if (subTask.data) {
 try {
 const parsed = typeof subTask.data === 'string' ? JSON.parse(subTask.data) : subTask.data;
 if (Array.isArray(parsed)) dbImages = parsed;
 } catch { /* ignore parse errors */ }
 }
 else if (subTask.images && Array.isArray(subTask.images)) dbImages = subTask.images;
 else if (subTask.beforeImages && Array.isArray(subTask.beforeImages)) dbImages = subTask.beforeImages;
 dbImages = dbImages.filter((i: any) => typeof i === 'string');
 dbImages = dbImages.map(img => img.startsWith('/media/proxy') ? `/api${img}` : img);

 const currentEvidence = (evidenceMap[subTask.id] || []).map(img =>
 img.startsWith('/media/proxy') ? `/api${img}` : img
 );
 const existingSet = new Set(dbImages);
 const allImages = [...dbImages, ...currentEvidence.filter(img => !existingSet.has(img))];

 let noteStr = '';
 if (subTask.noteData) noteStr = subTask.noteData;
 else if (subTask.note_data) noteStr = subTask.note_data;
 else if (dr && dr.note) noteStr = dr.note;
 const displayNote = noteMap[subTask.id] || noteStr;

 const visibleImages = allImages;

 return (
 <div key={subTask.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
 <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100 flex-wrap gap-2">
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
 <span className="text-sm font-bold text-slate-700">{processLabel}</span>
 </div>
 <div className="flex items-center gap-2 flex-wrap">
 {displayNote && (
 <div className="flex items-center gap-1.5 text-xs text-slate-500 italic bg-white border border-slate-200 px-3 py-1 rounded-full max-w-xs truncate">
 <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
 <span className="truncate">"{displayNote}"</span>
 </div>
 )}
 {/* Delete button removed */}
 </div>
 </div>
 <div className="p-4">
 {visibleImages.length > 0 ? (
 <div className="columns-2 md:columns-3 gap-3">
 {visibleImages.map((img: string, idx: number) => {
 const isVideo = img.toLowerCase().endsWith('.webm') || img.toLowerCase().endsWith('.mp4');
 return (
 <div
 key={idx}
 className="break-inside-avoid mb-3 rounded-lg overflow-hidden border border-slate-200 shadow-sm cursor-pointer group bg-slate-50 relative"
 onClick={() => onViewImage(visibleImages.map(getImageUrl), idx)}
 >
 {isVideo ? (
 <video
 src={getImageUrl(img)}
 className="w-full h-auto object-contain block bg-black"
 muted
 playsInline
 />
 ) : (
 <img
 src={getImageUrl(img)}
 className="w-full h-auto object-contain block transition-transform duration-300 group-hover:scale-105"
 alt={processLabel}
 />
 )}
 {isVideo && (
 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
 <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20">
 <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 ) : (
 <div className="text-center py-8 text-xs text-slate-400 italic">
 Không có hình ảnh cho quy trình này.
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Footer */}
 <div className="px-8 py-4 border-t border-slate-100 bg-white flex items-center justify-between flex-shrink-0">
 <button
 onClick={handleCopyLink}
 className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
 copied
 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
 : 'bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100'
 }`}
 >
 <Link2 className="w-4 h-4" />
 {copied ? 'Đã sao chép!' : 'Xuất báo cáo'}
 </button>
 <button
 onClick={onClose}
 className="px-6 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-sm transition-all"
 >
 Đóng
 </button>
 </div>
 </motion.div>
 </div>
 </AnimatePresence>,
 document.body
 );
};

export default TaskReportModal;
