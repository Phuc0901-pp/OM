import React, { useMemo } from 'react';
import { MapPin, Calendar, Clock, AlertCircle, CheckCircle2, Zap, Activity } from 'lucide-react';
import { useSyncedTime } from '../../utils/timeUtils';
import { DetailAssign, Assign } from '../../pages/user/environment/types';

interface ProjectHeaderProps {
 selectedAssign: Assign;
 taskDetails: DetailAssign[];
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({ selectedAssign, taskDetails }) => {
 const { time: now } = useSyncedTime();

 // Task progress
 const { totalTaskDetails, completedTasks, submittedTasks, progressPercent } = useMemo(() => {
 const total = taskDetails.length;
 const completed = taskDetails.filter(t => t.status_approve === 1).length;
 const submitted = taskDetails.filter(t => t.status_submit === 1 && t.status_approve !== 1 && t.status_reject !== 1).length;
 const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
 return { totalTaskDetails: total, completedTasks: completed, submittedTasks: submitted, progressPercent: percent };
 }, [taskDetails]);

 // Deadline
 let deadlineBadge: React.ReactNode = null;
 let urgencyLevel: 'overdue' | 'urgent' | 'normal' | 'none' = 'none';

 if (selectedAssign.end_time) {
 const end = new Date(selectedAssign.end_time);
 const diff = end.getTime() - now.getTime();
 const days = Math.floor(diff / (1000 * 60 * 60 * 24));
 const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

 if (diff < 0) {
 urgencyLevel = 'overdue';
 deadlineBadge = (
 <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse">
 <AlertCircle className="w-3 h-3" /> Đã hết hạn
 </span>
 );
 } else if (days <= 2) {
 urgencyLevel = 'urgent';
 deadlineBadge = (
 <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
 <Zap className="w-3 h-3" /> {days > 0 ? `Còn ${days}n ${hours}g` : `Còn ${hours}g`}
 </span>
 );
 } else {
 urgencyLevel = 'normal';
 deadlineBadge = (
 <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
 <Clock className="w-3 h-3" /> Còn {days} ngày
 </span>
 );
 }
 }

 const accentColor = urgencyLevel === 'overdue'
 ? 'from-rose-600 to-rose-800'
 : urgencyLevel === 'urgent'
 ? 'from-amber-600 to-orange-700'
 : 'from-violet-600 to-indigo-700';

 const progressBarColor = progressPercent === 100
 ? 'from-emerald-400 to-emerald-500'
 : progressPercent >= 70
 ? 'from-indigo-400 to-violet-500'
 : progressPercent >= 30
 ? 'from-amber-400 to-orange-400'
 : 'from-slate-400 to-slate-500';

 return (
 <div className="mb-4">
 <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 shadow-2xl`}>
 {/* Accent bar on top */}
 <div className={`h-0.5 w-full bg-gradient-to-r ${accentColor}`} />

 {/* Subtle background glow */}
 <div className={`absolute top-0 right-0 w-56 h-56 bg-gradient-to-br ${accentColor} opacity-10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none`} />

 <div className="relative z-10 p-4 sm:p-5">
 {/* ── Row 1: Title + Deadline badge ── */}
 <div className="flex items-start justify-between gap-3 mb-3">
 <div className="min-w-0 flex-1">
 <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight truncate">
 {selectedAssign.project?.name || 'Dự án'}
 </h2>
 </div>
 {deadlineBadge && (
 <div className="shrink-0 mt-0.5">{deadlineBadge}</div>
 )}
 </div>

 {/* ── Row 2: Meta info (location + date), compact 1 line ── */}
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
 {selectedAssign.project?.location && (
 <div className="flex items-center gap-1.5 text-slate-400 min-w-0">
 <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
 <span className="text-xs font-medium truncate max-w-[240px]">{selectedAssign.project.location}</span>
 </div>
 )}
 {selectedAssign.start_time && (
 <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
 <Calendar className="w-3.5 h-3.5 text-violet-400" />
 <span className="text-xs font-medium">
 {new Date(selectedAssign.start_time).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })}
 </span>
 </div>
 )}
 </div>

 {/* ── Row 3: Progress section ── */}
 <div className="bg-white/5 rounded-xl border border-white/8 p-3 space-y-2.5">
 {/* Labels row */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <Activity className="w-3.5 h-3.5 text-indigo-400" />
 <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tiến độ công việc</span>
 </div>
 <div className="flex items-center gap-3 text-right">
 <div className="flex items-center gap-1">
 <span className="text-xl font-black text-white">{completedTasks}</span>
 <span className="text-xs text-slate-500 font-semibold">/{totalTaskDetails}</span>
 </div>
 <span className={`text-sm font-black tabular-nums ${progressPercent === 100 ? 'text-emerald-400' : progressPercent >= 70 ? 'text-indigo-400' : progressPercent >= 30 ? 'text-amber-400' : 'text-slate-400'}`}>
 {progressPercent}%
 </span>
 </div>
 </div>

 {/* Progress bar */}
 <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full bg-gradient-to-r ${progressBarColor} transition-all duration-1000 ease-out`}
 style={{ width: `${progressPercent}%` }}
 />
 </div>

 {/* Sub-stats */}
 <div className="flex items-center gap-4 pt-0.5">
 {completedTasks === totalTaskDetails && totalTaskDetails > 0 ? (
 <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
 <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn thành toàn bộ
 </span>
 ) : (
 <>
 <span className="flex items-center gap-1 text-[11px] text-slate-500">
 <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
 <span className="font-semibold text-emerald-400">{completedTasks}</span> đã duyệt
 </span>
 {submittedTasks > 0 && (
 <span className="flex items-center gap-1 text-[11px] text-slate-500">
 <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
 <span className="font-semibold text-amber-400">{submittedTasks}</span> chờ duyệt
 </span>
 )}
 <span className="flex items-center gap-1 text-[11px] text-slate-500 ml-auto">
 Còn <span className="font-bold text-slate-300">{totalTaskDetails - completedTasks}</span> việc
 </span>
 </>
 )}
 </div>
 </div>
 </div>

 {/* Manager Note */}
 {selectedAssign.note_assign && (
 <div className="border-t border-white/8 px-4 sm:px-5 py-3 flex items-start gap-3 bg-amber-500/5">
 <div className="p-1.5 bg-amber-400/15 rounded-lg shrink-0 mt-0.5">
 <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
 </div>
 <div className="min-w-0">
 <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-0.5">Lưu ý từ quản lý</p>
 <p className="text-sm text-amber-200/80 leading-relaxed">{selectedAssign.note_assign}</p>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

export default ProjectHeader;
