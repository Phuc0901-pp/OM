import React from 'react';
import { AlertCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import GlassCard from '../../../../components/common/GlassCard';
import PremiumButton from '../../../../components/common/PremiumButton';
import { TaskRow } from '../types';

interface PendingReviewSectionProps {
    pendingReviewTasks: TaskRow[];
    setSelectedTask: (task: TaskRow) => void;
}

const PendingReviewSection: React.FC<PendingReviewSectionProps> = ({ pendingReviewTasks, setSelectedTask }) => {
    if (pendingReviewTasks.length === 0) return null;

    return (
        <GlassCard className="relative overflow-hidden !border-amber-200/50 !bg-gradient-to-br !from-white/90 !to-amber-50/50">
            <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-12 -translate-y-6 pointer-events-none">
                <AlertCircle className="w-48 h-48 text-amber-500" />
            </div>

            <div className="relative z-10">
                <div className="px-4 py-4 md:px-8 md:py-6 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-2xl shadow-lg shadow-amber-300/50 animate-pulse">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Cần phê duyệt ngay</h2>
                            <p className="text-sm font-medium text-slate-500 mt-1">Các hạng mục đã nộp đang chờ xác nhận.</p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md text-amber-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm border border-amber-100/50">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                        </span>
                        {pendingReviewTasks.length} yêu cầu
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-amber-50/30 border-b border-amber-100/50">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Dự án</th>
                                <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Hạng mục</th>
                                <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Nhân sự</th>
                                <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Thời gian chờ</th>
                                <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100/30">
                            {pendingReviewTasks.map(task => (
                                <tr key={task.id} className="hover:bg-amber-50/40 transition-all duration-200 group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1 h-8 bg-amber-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                                            <span className="text-sm font-bold text-slate-700">{task.projectName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <h3 className="text-sm font-bold text-slate-800">{task.categoryName}</h3>
                                        <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5">
                                            <span className="w-1 lg:w-1.5 h-1 lg:h-1.5 rounded-full bg-slate-300"></span>
                                            {task.stationName} {task.inverterName ? `— ${task.inverterName}` : ''}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-white border border-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-700 shadow-sm">
                                                {task.userName.charAt(0)}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-600">{task.userName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            {task.submittedAt && !isNaN(new Date(task.submittedAt).getTime()) ? (
                                                <>
                                                    <span className="text-sm font-bold text-amber-600 bg-amber-50/80 w-fit px-2 py-0.5 rounded-md border border-amber-100">
                                                        {formatDistanceToNow(new Date(task.submittedAt), { addSuffix: true, locale: vi })}
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-slate-400 mt-1 pl-1">
                                                        {format(new Date(task.submittedAt), 'dd/MM/yyyy HH:mm')}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-slate-400 text-xs">-</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <PremiumButton
                                            onClick={() => setSelectedTask(task)}
                                            size="sm"
                                            className="!rounded-lg !px-4 !py-2 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                                        >
                                            Kiểm tra
                                        </PremiumButton>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </GlassCard>
    );
};

export default PendingReviewSection;
