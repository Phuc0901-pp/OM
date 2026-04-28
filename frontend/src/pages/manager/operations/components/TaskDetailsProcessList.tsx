import React from 'react';
import { LayoutGrid, AlertCircle, CheckCircle2, FileText, PlayCircle } from 'lucide-react';
import { TaskRow } from '../types';
import { getImageUrl } from '../../../../utils/imageUtils';

const isVideoUrl = (url: string) => {
 if (!url) return false;
 const lower = url.toLowerCase();
 return ['.mp4', '.mov', '.webm', '.avi', '#video'].some(ext => lower.includes(ext));
};


interface TaskDetailsProcessListProps {
 task: TaskRow;
 evidenceMap: Record<string, string[]>;
 noteMap: Record<string, string>;
 onViewImage: (images: string[], index: number) => void;
 selectedTaskIds: Set<string>;
 onToggleSelection: (id: string) => void;
}

const TaskDetailsProcessList: React.FC<TaskDetailsProcessListProps> = ({
 task,
 evidenceMap,
 noteMap,
 onViewImage,
 selectedTaskIds,
 onToggleSelection,
}) => {

 return (
 <div className="lg:col-span-8 space-y-6">
 <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide px-1">
 <LayoutGrid className="w-4 h-4 text-indigo-500" /> Hình ảnh &amp; Ghi chú
 </h3>

 {(() => {
 const subTasks = task.subTasks && task.subTasks.length > 0
 ? task.subTasks
 : [task];

 return subTasks.map((subTask: any, tIdx: number) => {
 const dr = subTask.dataResult || (subTask.data_result ? JSON.parse(subTask.data_result) : null);
 const processLabel = subTask.processName || `Quy trình ${tIdx + 1}`;

 // Image parsing — V2 schema stores URLs in subTask.data
 let dbImages: string[] = [];
 if (Array.isArray(dr)) dbImages = dr;
 else if (dr && dr.data && Array.isArray(dr.data)) dbImages = dr.data;
 // V2 primary source: subTask.data contains the JSON array of MinIO URLs
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

 const existingImages = new Set([...dbImages]);
 const newEvidence = currentEvidence.filter(img => !existingImages.has(img));
 const allProcessImages = [...dbImages, ...newEvidence];

 // Note parsing
 let dbNoteStr = '';
 if (subTask.noteData) dbNoteStr = subTask.noteData;
 else if (subTask.note_data) dbNoteStr = subTask.note_data;
 else if (dr && dr.note) dbNoteStr = dr.note;
 const minioNote = noteMap[subTask.id] || '';
 const displayNote = minioNote || dbNoteStr;

 return (
 <div
 key={subTask.id}
 className={`bg-white rounded-xl border p-4 shadow-sm relative overflow-hidden transition-all border-slate-200 hover:border-indigo-300`}
 >
 <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

 {/* Header with Title + Note */}
 <div className="mb-4 pl-3 pr-2 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
 <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 shrink-0">
 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div> {processLabel}
 </h4>
 {displayNote && (
 <div className="bg-indigo-50/80 px-3 py-1.5 rounded-md border border-indigo-100 flex items-start gap-2 max-w-full xl:max-w-[60%] text-left">
 <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
 <span className="text-xs text-slate-700 italic border-l border-indigo-200 pl-2 leading-relaxed">
 "{displayNote}"
 </span>
 </div>
 )}
 </div>


 {/* Status Display */}
 {subTask.statusApprove === 1 ? (
 <div className="mb-4 px-3 py-2 bg-green-50 text-green-700 text-xs rounded-lg flex items-center gap-2 border border-green-100">
 <CheckCircle2 className="w-3.5 h-3.5" /> Đã duyệt: "{subTask.noteApproval}"
 </div>
 ) : subTask.statusReject === 1 ? (
 <div className={`mb-4 px-3 py-2 text-xs rounded-lg flex flex-col gap-1 border ${subTask.statusSubmit === 1 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
 <div className="flex items-center gap-2">
 {subTask.statusSubmit === 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
 <span className="font-semibold tracking-wide">{subTask.statusSubmit === 1 ? 'Đã nộp lại' : 'Bị từ chối'}</span>
 </div>
 <span className={`pl-5 italic ${subTask.statusSubmit === 1 ? 'text-indigo-600/80' : 'text-red-600/80'}`}>
 {subTask.statusSubmit === 1 ? '(Lý do từ chối trước đó): ' : 'Lý do: '}"{subTask.noteReject}"
 </span>
 </div>
 ) : null}

 {/* Images Grid */}
 {allProcessImages.length > 0 ? (
 <div className="columns-2 lg:columns-3 gap-3 mt-1">
 {allProcessImages.map((img: string, idx: number) => {
 const url = getImageUrl(img);
 const isVideo = isVideoUrl(url) || isVideoUrl(img);
 return (
 <div key={idx} className="break-inside-avoid mb-3 relative w-full rounded-md overflow-hidden border border-slate-200 shadow-sm cursor-pointer group bg-slate-50" onClick={(e) => { e.stopPropagation(); onViewImage(allProcessImages.map(getImageUrl), idx); }}>
 {isVideo ? (
 <div className="relative w-full aspect-video bg-black flex items-center justify-center">
 <video src={url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
 <PlayCircle className="absolute w-12 h-12 text-white/90 group-hover:scale-110 transition-transform drop-shadow-md" />
 </div>
 ) : (
 <img
 src={url}
 className="w-full h-auto object-contain block transition-transform duration-300 group-hover:scale-105"
 alt={processLabel}
 />
 )}
 </div>
 );
 })}
 </div>
 ) : (
 <div className="text-center py-6 text-xs text-slate-400 italic bg-slate-50/50 rounded-lg border border-dashed border-slate-200 mt-2">
 Không có dữ liệu hình ảnh cho quy trình này.
 </div>
 )}
 </div>
 );
 });
 })()}
 </div>
 );
};

export default TaskDetailsProcessList;
