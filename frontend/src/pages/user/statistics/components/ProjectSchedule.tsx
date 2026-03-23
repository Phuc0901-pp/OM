import React from 'react';
import { Calendar, Clock, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import GlassCard from '../../../../components/common/GlassCard';
import type { Assign } from '../../../../types/models';
import { determineDetailStatus } from '../../../../utils/statusUtils';

interface ProjectScheduleProps {
    assigns: Assign[];
    selectedProject: string;
    loading: boolean;
}

const fmtDate = (d: Date) => d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const ProjectSchedule: React.FC<ProjectScheduleProps> = ({ assigns, loading }) => {
    if (loading) {
        return (
            <GlassCard>
                <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
                </div>
            </GlassCard>
        );
    }

    return (
        <GlassCard className="!p-5">
            <div className="flex items-center gap-2 mb-5">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-800">Lịch công việc</h3>
                <span className="ml-auto text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold border border-indigo-100">
                    {assigns.length} đợt
                </span>
            </div>

            {assigns.length === 0 ? (
                <p className="text-center text-slate-400 py-10 text-sm">Chưa có công việc nào được phân công.</p>
            ) : (
                <div className="space-y-3">
                    {assigns.map(assign => {
                        const details = assign.details || [];
                        const total = details.length;
                        const approved = details.filter(d => determineDetailStatus(d) === 'approved').length;
                        const submitted = details.filter(d => determineDetailStatus(d) === 'submitted').length;
                        const rejected = details.filter(d => determineDetailStatus(d) === 'rejected').length;
                        const progress = total > 0 ? Math.round((approved / total) * 100) : 0;

                        const startDate = assign.start_time ? new Date(assign.start_time) : null;
                        const endDate = assign.end_time ? new Date(assign.end_time) : null;
                        const now = new Date();

                        let daysLeft: number | null = null;
                        let isOverdue = false;
                        if (endDate) {
                            daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            isOverdue = daysLeft < 0;
                        }

                        let progressColor = 'from-indigo-400 to-indigo-600';
                        if (progress === 100) progressColor = 'from-emerald-400 to-emerald-600';
                        else if (isOverdue) progressColor = 'from-rose-400 to-rose-600';

                        const workName = assign.template?.name || assign.model_project?.name || 'Công tác bảo trì';

                        return (
                            <div
                                key={assign.id}
                                className={`rounded-xl border p-4 transition-all ${isOverdue
                                        ? 'border-rose-100 bg-rose-50/30'
                                        : progress === 100
                                            ? 'border-emerald-100 bg-emerald-50/20'
                                            : 'border-slate-100 bg-white hover:border-indigo-100 hover:bg-indigo-50/10'
                                    }`}
                            >
                                {/* Header Row */}
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-bold text-slate-800 text-sm truncate">{workName}</h4>
                                        <p className="text-xs text-slate-500 mt-0.5 truncate">{assign.project?.name}</p>
                                        
                                        {/* Date row moved under title for better layout */}
                                        {(startDate || endDate) && (
                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-2">
                                                <Calendar className="w-3 h-3" />
                                                <span>{startDate ? fmtDate(startDate) : '?'}</span>
                                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                                <span className={endDate && isOverdue ? 'text-rose-600 font-semibold' : ''}>{endDate ? fmtDate(endDate) : '?'}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0 flex-wrap">
                                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 whitespace-nowrap">
                                            {approved}/{total} hoàn thành
                                        </span>
                                        {progress === 100 ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                <CheckCircle2 className="w-3 h-3" /> Hoàn thành
                                            </span>
                                        ) : isOverdue ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full animate-pulse whitespace-nowrap">
                                                <AlertCircle className="w-3 h-3" /> Quá hạn {Math.abs(daysLeft!)} ngày
                                            </span>
                                        ) : daysLeft !== null ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                <Clock className="w-3 h-3" /> Còn {daysLeft} ngày
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-2">
                                    <div
                                        className={`bg-gradient-to-r ${progressColor} h-2 rounded-full transition-all duration-700`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                {/* Stats Row */}
                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                    {submitted > 0 && (
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                            {submitted} chờ duyệt
                                        </span>
                                    )}
                                    {rejected > 0 && (
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                                            {rejected} bị từ chối
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                                        {total - approved - submitted} chưa nộp
                                    </span>
                                    <span className="ml-auto font-bold text-slate-600">{progress}%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </GlassCard>
    );
};

export default ProjectSchedule;
