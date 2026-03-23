import React from 'react';
import { Users, CalendarClock, FileText, UserCheck, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { parseSafeDate } from '../../../../utils/timeUtils';
import GlassCard from '../../../../components/common/GlassCard';
import { TaskRow } from '../types';

type TimelineEvent = {
    date: Date;
    type: 'submit' | 'approve' | 'reject';
    processName: string;
    actorId?: string; // UUID of who approved/rejected
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

const ActorBadge: React.FC<{ actorId?: string; type: 'approve' | 'reject'; usersMap?: Record<string, string> }> = ({ actorId, type, usersMap }) => {
    if (!actorId) return null;
    const Icon = type === 'approve' ? UserCheck : UserX;
    const color = type === 'approve'
        ? 'text-green-600 bg-green-50 border-green-100'
        : 'text-red-600 bg-red-50 border-red-100';
    // Prefer full name from usersMap, fallback to short UUID
    const name = usersMap?.[actorId];
    const display = name || (actorId.length > 8 ? actorId.slice(0, 8) + '…' : actorId);
    return (
        <div className={`flex items-center gap-1 text-[10px] font-medium border rounded-full px-2 py-0.5 mt-1 ${color}`}>
            <Icon className="w-3 h-3" />
            <span title={actorId}>{display}</span>
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
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-200">
                        {task.userName.charAt(0)}
                    </div>
                    <div>
                        <div className="font-bold text-slate-800">{task.userName}</div>
                        <div className="text-sm text-slate-500">{task.userEmail}</div>
                    </div>
                </div>
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
                            const submittedArr = parseJsonArray(st.submitted_at || st.submittedAt);
                            if (submittedArr.length > 0) {
                                submittedArr.forEach((dStr: string) => {
                                    const d = parseSafeDate(dStr);
                                    if (!isNaN(d.getTime())) events.push({ date: d, type: 'submit', processName: pName });
                                });
                            } else if (st.submittedAt && !isNaN(parseSafeDate(st.submittedAt).getTime())) {
                                events.push({ date: parseSafeDate(st.submittedAt), type: 'submit', processName: pName });
                            }

                            // Approval timestamps + actors
                            const approveArr = parseJsonArray(st.approval_at || st.approvalAt);
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
                            const rejectArr = parseJsonArray(st.rejected_at || st.rejectedAt);
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
                                <div className={`flex items-center justify-center w-4 h-4 rounded-full border-2 border-white shadow shrink-0 absolute left-0 top-1 text-[10px] ${
                                    ev.type === 'approve' ? 'bg-green-500' : ev.type === 'reject' ? 'bg-red-500' : 'bg-indigo-500'
                                }`} />

                                {/* Content card */}
                                <div className={`w-full p-2 rounded-xl border shadow-sm bg-white ${
                                    ev.type === 'approve' ? 'border-green-100' : ev.type === 'reject' ? 'border-red-100' : 'border-slate-100'
                                }`}>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="font-bold text-slate-700 text-xs">{format(ev.date, 'HH:mm dd/MM/yyyy')}</div>
                                        <div className="flex flex-col text-[11px]">
                                            <span className={`font-semibold ${
                                                ev.type === 'approve' ? 'text-green-600' : ev.type === 'reject' ? 'text-red-600' : 'text-indigo-600'
                                            }`}>
                                                {ev.type === 'approve' ? 'Đã duyệt' : ev.type === 'reject' ? 'Từ chối' : 'Nộp báo cáo'}
                                            </span>
                                            <span className="text-slate-500 truncate max-w-full" title={ev.processName}>{ev.processName}</span>
                                        </div>
                                        {/* Actor badge - only for approve/reject */}
                                        {ev.actorId && (ev.type === 'approve' || ev.type === 'reject') && (
                                            <ActorBadge actorId={ev.actorId} type={ev.type} usersMap={usersMap} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ));
                    })()}
                </div>
            </GlassCard>

            {/* Note Display */}
            {(task.noteData || task.noteReject) && (
                <div className={`p-5 rounded-2xl border ${task.statusReject === 1 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                    <h4 className={`font-bold mb-2 flex items-center gap-2 text-sm uppercase tracking-wide ${task.statusReject === 1 ? 'text-red-700' : 'text-slate-700'}`}>
                        <FileText className="w-4 h-4" /> Ghi chú {task.statusReject === 1 ? 'từ chối' : ''}
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed italic">
                        &ldquo;{task.statusReject === 1 ? task.noteReject : task.noteData}&rdquo;
                    </p>
                </div>
            )}
        </div>
    );
};

export default TaskDetailsInfoSidebar;
