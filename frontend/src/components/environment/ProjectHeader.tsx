import React, { useMemo } from 'react';
import { MapPin, Calendar, Clock, AlertCircle } from 'lucide-react';
import GlassCard from '../common/GlassCard';

interface TaskDetail {
    id: string;
    assign_id: string;
    child_category_id?: string;
    status_approve: number;
    // Add other properties as needed from the main interface
}

interface Assign {
    id: string;
    start_time?: string;
    end_time?: string;
    note?: string;
    project?: {
        project_name: string;
        location: string;
    };
    classification?: {
        name: string;
    };
}

interface ProjectHeaderProps {
    selectedAssign: Assign;
    taskDetails: TaskDetail[];
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({ selectedAssign, taskDetails }) => {
    // Logic: Group tasks by Child Category to calculate progress
    // Logic: Group tasks by Child Category to calculate progress
    const { totalChildCats, completedChildCats, progressPercent } = useMemo(() => {
        const tasksByChildCat: Record<string, TaskDetail[]> = {};
        taskDetails.forEach(task => {
            const childId = task.child_category_id || 'uncategorized';
            if (!tasksByChildCat[childId]) {
                tasksByChildCat[childId] = [];
            }
            tasksByChildCat[childId].push(task);
        });

        const total = Object.keys(tasksByChildCat).length;
        const completed = Object.values(tasksByChildCat).filter(group =>
            group.length > 0 && group.every(t => t.status_approve === 1)
        ).length;

        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { totalChildCats: total, completedChildCats: completed, progressPercent: percent };
    }, [taskDetails]);

    // Logic: Deadline Countdown
    let deadlineElement = null;
    if (selectedAssign.end_time) {
        const end = new Date(selectedAssign.end_time);
        const now = new Date();
        const diff = end.getTime() - now.getTime();

        if (diff < 0) {
            deadlineElement = (
                <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full text-rose-100 bg-rose-500/20 border border-rose-500/30 backdrop-blur-md animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    Đã hết hạn
                </span>
            );
        } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            deadlineElement = (
                <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full text-emerald-100 bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-md">
                    <Clock className="w-3 h-3" />
                    Còn lại: {days} ngày {hours} giờ
                </span>
            );
        }
    } else {
        deadlineElement = (
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-white/5 px-2 py-1 rounded-md">
                <Clock className="w-3 h-3" />
                Cập nhật: {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
        );
    }

    return (
        <div className="mb-8 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
            <GlassCard className="!p-0 overflow-hidden relative border-0 ring-1 ring-white/20">
                {/* Header with animated gradient */}
                <div className="relative overflow-hidden bg-slate-900 p-6 sm:p-8 text-white">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-purple-500 rounded-full blur-3xl opacity-20"></div>

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-4 flex-1">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    {selectedAssign.classification?.name && (
                                        <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-400/30 rounded-full text-xs font-semibold uppercase tracking-wider text-indigo-100 backdrop-blur-md">
                                            {selectedAssign.classification.name}
                                        </span>
                                    )}
                                    {deadlineElement}
                                </div>
                                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-200 drop-shadow-sm">
                                    {selectedAssign.project?.project_name || 'Dự án'}
                                </h2>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-300 text-sm font-medium">
                                {selectedAssign.project?.location && (
                                    <div className="flex items-center gap-2 group/item">
                                        <div className="p-1.5 bg-white/10 rounded-lg group-hover/item:bg-white/20 transition-colors">
                                            <MapPin className="w-4 h-4 text-indigo-300" />
                                        </div>
                                        <span>{selectedAssign.project.location}</span>
                                    </div>
                                )}
                                {selectedAssign.start_time && (
                                    <div className="flex items-center gap-2 group/item">
                                        <div className="p-1.5 bg-white/10 rounded-lg group-hover/item:bg-white/20 transition-colors">
                                            <Calendar className="w-4 h-4 text-purple-300" />
                                        </div>
                                        <span>{new Date(selectedAssign.start_time).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Card */}
                        <div className="flex items-center gap-6 bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 shadow-xl">
                            <div className="text-right">
                                <span className="block text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Tiến độ hạng mục</span>
                                <div className="flex items-baseline justify-end gap-1.5">
                                    <span className="text-2xl font-black text-white">{completedChildCats}</span>
                                    <span className="text-sm font-medium text-white/50">/ {totalChildCats}</span>
                                </div>
                                <span className="text-xs font-medium text-emerald-400">Hoàn thành 100%</span>
                            </div>

                            <div className="relative w-20 h-20">
                                <svg className="w-full h-full -rotate-90 transform">
                                    <circle cx="40" cy="40" r="36" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                                    <circle
                                        cx="40" cy="40" r="36" fill="transparent"
                                        stroke="url(#progressGradient)" strokeWidth="6"
                                        strokeLinecap="round"
                                        strokeDasharray={`${progressPercent * 2.26} 226`}
                                        className="transition-all duration-1000 ease-out"
                                    />
                                    <defs>
                                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#6366f1" />
                                            <stop offset="100%" stopColor="#a855f7" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-lg font-bold text-white leading-none">{progressPercent}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Manager Note Section */}
                {selectedAssign.note && (
                    <div className="bg-amber-50/80 backdrop-blur-sm border-t border-amber-100/50 p-4 px-6 flex items-start gap-4">
                        <div className="p-2 bg-amber-100/50 rounded-full shrink-0 animate-bounce">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold uppercase text-amber-600 tracking-wider mb-1">Lưu ý từ quản lý</h4>
                            <p className="text-sm font-medium text-amber-900 leading-relaxed">{selectedAssign.note}</p>
                        </div>
                    </div>
                )}
            </GlassCard>
        </div>
    );
};

export default ProjectHeader;
