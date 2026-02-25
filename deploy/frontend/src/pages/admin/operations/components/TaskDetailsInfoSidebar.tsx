import React from 'react';
import { Users, CalendarClock, FileText } from 'lucide-react';
import { format } from 'date-fns';
import GlassCard from '../../../../components/common/GlassCard';
import { TaskRow } from '../types';

interface TaskDetailsInfoSidebarProps {
    task: TaskRow;
}

const TaskDetailsInfoSidebar: React.FC<TaskDetailsInfoSidebarProps> = ({ task }) => {
    return (
        <div className="lg:col-span-4 space-y-4">
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

            <GlassCard className="!p-5 !bg-slate-50/50 !border-slate-100">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <CalendarClock className="w-4 h-4 text-indigo-500" /> Thời gian
                </h3>
                <div className="space-y-4 text-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Ngày nộp báo cáo</span>
                        <span className="font-bold text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                            {task.submittedAt && !isNaN(new Date(task.submittedAt).getTime()) ? format(new Date(task.submittedAt), 'dd/MM/yyyy HH:mm') : '-'}
                        </span>
                    </div>
                    {task.approvalAt && !isNaN(new Date(task.approvalAt).getTime()) ? (
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Ngày phê duyệt</span>
                            <span className="font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-100">{format(new Date(task.approvalAt), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                    ) : task.rejectedAt && !isNaN(new Date(task.rejectedAt).getTime()) ? (
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Ngày từ chối</span>
                            <span className="font-bold text-red-700 bg-red-50 px-2 py-1 rounded-md border border-red-100">{format(new Date(task.rejectedAt), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                    ) : null}
                </div>
            </GlassCard>

            {/* Note Display */}
            {task.note && (
                <div className={`p-5 rounded-2xl border ${task.accept === -1 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                    <h4 className={`font-bold mb-2 flex items-center gap-2 text-sm uppercase tracking-wide ${task.accept === -1 ? 'text-red-700' : 'text-slate-700'}`}>
                        <FileText className="w-4 h-4" /> Ghi chú {task.accept === -1 ? 'từ chối' : ''}
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed italic">
                        "{task.note}"
                    </p>
                </div>
            )}
        </div>
    );
};

export default TaskDetailsInfoSidebar;
