import React from 'react';
import { Target, CheckCircle2, Timer, AlertOctagon, TrendingUp, Sparkles } from 'lucide-react';
import GlassCard from '../../../../components/common/GlassCard';

interface OverviewCardsProps {
    assigned: number;
    completed: number;
    pendingReview: number;
    rejected: number;
}

const OverviewCards: React.FC<OverviewCardsProps> = ({
    assigned,
    completed,
    pendingReview,
    rejected
}) => {
    const completionRate = assigned > 0 ? ((completed / assigned) * 100).toFixed(1) : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Assigned */}
            <GlassCard className="relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 !border-blue-100 bg-blue-50/30">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Target className="w-16 h-16 text-blue-600" />
                </div>
                <div className="relative z-10">
                    <p className="text-blue-500 text-xs font-black uppercase tracking-wider mb-1">Tổng nhiệm vụ</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-black text-slate-800">{assigned}</h3>
                        <span className="text-xs font-bold text-blue-400 bg-blue-100 px-2 py-0.5 rounded-full">All time</span>
                    </div>
                </div>
                <div className="mt-3 h-1 w-full bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-full"></div>
                </div>
            </GlassCard>

            {/* Completed (Approved) */}
            <GlassCard className="relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 !border-emerald-100 bg-emerald-50/30">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <CheckCircle2 className="w-16 h-16 text-emerald-600" />
                </div>
                <div className="relative z-10">
                    <p className="text-emerald-600 text-xs font-black uppercase tracking-wider mb-1">Đã hoàn thành</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-black text-slate-800">{completed}</h3>
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <TrendingUp className="w-3 h-3" />
                            {completionRate}%
                        </div>
                    </div>
                </div>
                <div className="mt-3 h-1 w-full bg-emerald-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${completionRate}%` }}></div>
                </div>
            </GlassCard>

            {/* Pending Review */}
            <GlassCard className="relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 !border-amber-100 bg-amber-50/30">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Timer className="w-16 h-16 text-amber-500" />
                </div>
                <div className="relative z-10">
                    <p className="text-amber-600 text-xs font-black uppercase tracking-wider mb-1">Đang chờ duyệt</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-black text-slate-800">{pendingReview}</h3>
                        {pendingReview > 0 && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse">
                                Reviewing
                            </span>
                        )}
                    </div>
                </div>
                <div className="mt-3 h-1 w-full bg-amber-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: '60%' }}></div>
                </div>
            </GlassCard>

            {/* Rejected (Needs Fix) */}
            <GlassCard className="relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 !border-rose-100 bg-rose-50/30">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <AlertOctagon className="w-16 h-16 text-rose-500" />
                </div>
                <div className="relative z-10">
                    <p className="text-rose-600 text-xs font-black uppercase tracking-wider mb-1">Yêu cầu sửa lại</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-black text-slate-800">{rejected}</h3>
                        {rejected > 0 && (
                            <span className="text-xs font-bold text-white bg-rose-500 px-2 py-0.5 rounded-full shadow-sm shadow-rose-200 animate-bounce">
                                Action Needed
                            </span>
                        )}
                    </div>
                </div>
                <div className="mt-3 h-1 w-full bg-rose-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500" style={{ width: '100%' }}></div>
                </div>
            </GlassCard>
        </div>
    );
};

export default OverviewCards;
