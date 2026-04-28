import React from 'react';
import { Users, CalendarClock, UserCheck, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { parseSafeDate } from '../../../../utils/timeUtils';
import GlassCard from '../../../../components/common/GlassCard';
import { TaskRow } from '../types';

type TimelineEvent = {
 date: Date;
 type: 'submit' | 'approve' | 'reject';
 processName: string;
 actorId?: string; // UUID of who approved/rejected
 fallbackName?: string; // Fallback for submitters
};

interface TaskDetailsInfoSidebarProps {
 task: TaskRow;
 usersMap?: Record<string, string>; // uuid -> name lookup
}

/** Parse a JSONB array field (may be raw array or stringified JSON array) */
const parseJsonArray = (field: any): any[] => {
 if (!field) return [];
 if (Array.isArray(field)) return field;
 if (typeof field === 'string') {
 try { return JSON.parse(field); } catch { }
 }
 return [];
};

const ActorBadge: React.FC<{ actorId?: string; type: 'approve' | 'reject' | 'submit'; usersMap?: Record<string, string>; fallbackName?: string }> = ({ actorId, type, usersMap, fallbackName }) => {
 const Icon = type === 'approve' ? UserCheck : type === 'submit' ? Users : UserX;
 const color = type === 'approve'
 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
 : type === 'submit'
 ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
 : 'text-rose-700 bg-rose-50 border-rose-200';
 
 const nameStr = (actorId ? usersMap?.[actorId] : null) || fallbackName;
 if (!nameStr && !actorId) return null;

 let names: string[] = [];
 if (nameStr) {
 names = nameStr.split(',').map(n => n.trim()).filter(Boolean);
 } else if (actorId) {
 names = [actorId.length > 8 ? actorId.slice(0, 8) + '…' : actorId];
 }

 return (
 <div className="flex flex-wrap gap-1.5 mt-2">
 {names.slice(0, 3).map((n, idx) => (
 <div key={idx} className={`flex items-center gap-1.5 text-[10.5px] font-bold border rounded-lg px-2 py-1 shadow-sm ${color}`}>
 <Icon className="w-3.5 h-3.5 shrink-0 opacity-75" />
 <span className="truncate max-w-[130px]" title={n}>{n}</span>
 </div>
 ))}
 {names.length > 3 && (
 <div className={`flex items-center text-[10.5px] font-bold border rounded-lg px-2 py-1 shadow-sm ${color}`} title={names.slice(3).join(', ')}>
 +{names.length - 3} người khác
 </div>
 )}
 </div>
 );
};

const TaskDetailsInfoSidebar: React.FC<TaskDetailsInfoSidebarProps> = ({ task, usersMap }) => {
 return (
 <div className="lg:col-span-4 space-y-4">
 {/* Personnel Info */}
 <GlassCard className="!p-5 !bg-slate-50/50 !border-slate-100">
 <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
 <Users className="w-4 h-4 text-indigo-500" /> Thông tin nhân sự
 </h3>
 {(() => {
 const userNames = task.userName ? task.userName.split(',').map(n => n.trim()).filter(Boolean) : [];
 const userEmails = task.userEmail ? task.userEmail.split(',').map(e => e.trim()).filter(Boolean) : [];
 
 if (userNames.length === 0) return <div className="text-sm text-slate-400 italic">Không có dữ liệu nhân sự</div>;

 return (
 <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1.5">
 {userNames.map((n, i) => {
 const gradients = [
 'from-indigo-500 to-purple-500',
 'from-blue-500 to-cyan-500',
 'from-emerald-400 to-teal-500',
 'from-amber-400 to-orange-500',
 'from-rose-400 to-red-500'
 ];
 const gradient = gradients[i % gradients.length];
 return (
 <div key={i} className="group flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors">
 <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} text-white shadow-inner flex items-center justify-center font-bold text-sm shrink-0`}>
 {n.charAt(0)}
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-bold text-slate-700 text-[13px] truncate group-hover:text-indigo-600 transition-colors">{n}</div>
 {userEmails[i] && <div className="text-[11px] font-medium text-slate-400 truncate mt-0.5">{userEmails[i]}</div>}
 </div>
 </div>
 );
 })}
 </div>
 );
 })()}
 </GlassCard>

 {/* Timeline – full scrollable, no height cap */}
 <GlassCard className="!p-5 !bg-slate-50/50 !border-slate-100">
 <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
 <CalendarClock className="w-4 h-4 text-indigo-500" /> Nhật ký thời gian
 </h3>
 <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
 {(() => {
 const events: TimelineEvent[] = [];
 const subTasks = task.subTasks && task.subTasks.length > 0 ? task.subTasks : [task];

 subTasks.forEach((st: any) => {
 const pName = st.processName || 'Công việc';
 const approveActors = parseJsonArray(st.idPersonApprove || st.id_person_approve);
 const rejectActors = parseJsonArray(st.idPersonReject || st.id_person_reject);

 // Submission timestamps (no actor tracking needed)
 const submittedArr = parseJsonArray(st.rawSubmittedAt || st.submitted_at || st.submittedAt);
 if (submittedArr.length > 0) {
 submittedArr.forEach((dStr: string) => {
 const d = parseSafeDate(dStr);
 if (!isNaN(d.getTime())) events.push({ date: d, type: 'submit', processName: pName, fallbackName: task.userName });
 });
 } else if (st.submittedAt && !isNaN(parseSafeDate(st.submittedAt).getTime())) {
 events.push({ date: parseSafeDate(st.submittedAt), type: 'submit', processName: pName, fallbackName: task.userName });
 }

 // Approval timestamps + actors
 const approveArr = parseJsonArray(st.rawApprovalAt || st.approval_at || st.approvalAt);
 if (approveArr.length > 0) {
 approveArr.forEach((dStr: string, i: number) => {
 const d = parseSafeDate(dStr);
 if (!isNaN(d.getTime())) {
 events.push({ date: d, type: 'approve', processName: pName, actorId: approveActors[i] });
 }
 });
 } else if (st.approvalAt && !isNaN(parseSafeDate(st.approvalAt).getTime())) {
 events.push({ date: parseSafeDate(st.approvalAt), type: 'approve', processName: pName, actorId: approveActors[0] });
 }

 // Rejection timestamps + actors
 const rejectArr = parseJsonArray(st.rawRejectedAt || st.rejected_at || st.rejectedAt);
 if (rejectArr.length > 0) {
 rejectArr.forEach((dStr: string, i: number) => {
 const d = parseSafeDate(dStr);
 if (!isNaN(d.getTime())) {
 events.push({ date: d, type: 'reject', processName: pName, actorId: rejectActors[i] });
 }
 });
 } else if (st.rejectedAt && !isNaN(parseSafeDate(st.rejectedAt).getTime())) {
 events.push({ date: parseSafeDate(st.rejectedAt), type: 'reject', processName: pName, actorId: rejectActors[0] });
 }
 });

 events.sort((a, b) => a.date.getTime() - b.date.getTime());

 if (events.length === 0) {
 return <div className="text-sm text-slate-400 italic text-center py-2">Chưa có nhật ký ghi nhận</div>;
 }

 return events.map((ev, idx) => (
 <div key={idx} className="relative flex items-start text-sm pl-6">
 {/* Dot marker */}
 <div className={`flex items-center justify-center w-4 h-4 rounded-full border-2 border-white shadow shrink-0 absolute left-0 top-1.5 text-[10px] ${
 ev.type === 'approve' ? 'bg-emerald-500' : ev.type === 'reject' ? 'bg-rose-500' : 'bg-indigo-500'
 }`} />

 {/* Content card */}
 <div className={`w-full p-2.5 rounded-xl border shadow-sm bg-white hover:shadow-md transition-shadow ${
 ev.type === 'approve' ? 'border-emerald-100' : ev.type === 'reject' ? 'border-rose-100' : 'border-indigo-100'
 }`}>
 <div className="flex flex-col gap-1">
 <div className="font-bold text-slate-700 text-xs flex items-center justify-between">
 <span>{format(ev.date, 'HH:mm dd/MM/yyyy')}</span>
 <span className={`font-extrabold uppercase text-[9px] tracking-wider px-2 py-0.5 rounded ${
 ev.type === 'approve' ? 'bg-emerald-100 text-emerald-700' : ev.type === 'reject' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
 }`}>
 {ev.type === 'approve' ? 'Đã duyệt' : ev.type === 'reject' ? 'Từ chối' : 'Nộp báo cáo'}
 </span>
 </div>
 <div className="flex flex-col text-[12px]">
 <span className="text-slate-600 font-medium truncate max-w-full" title={ev.processName}>{ev.processName}</span>
 </div>
 {/* Actor badge */}
 {(ev.actorId || ev.fallbackName) && (
 <ActorBadge actorId={ev.actorId} fallbackName={ev.fallbackName} type={ev.type} usersMap={usersMap} />
 )}
 </div>
 </div>
 </div>
 ));
 })()}
 </div>
 </GlassCard>

 </div>
 );
};

export default TaskDetailsInfoSidebar;
