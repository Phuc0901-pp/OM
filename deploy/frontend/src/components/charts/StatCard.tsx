import React from 'react';
import { LucideIcon } from 'lucide-react';
import GlassCard from '../common/GlassCard';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    trendUp?: boolean;
    color: string;
}

const StatCard = ({ title, value, icon: Icon, trend, trendUp, color }: StatCardProps) => {
    // Extract background color class or default to a gradient
    const bgClass = color.includes('bg-') ? color : 'bg-primary-500';

    return (
        <GlassCard className="!p-6 flex items-start justify-between group cursor-default hover:scale-[1.02] transition-transform duration-300">
            <div>
                <h3 className="text-slate-500 text-sm font-medium mb-1 uppercase tracking-wider">{title}</h3>
                <div className="text-3xl font-bold text-slate-800 my-2">{value}</div>
                {trend && (
                    <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full w-fit ${trendUp ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-rose-700 bg-rose-50 border border-rose-100'
                        }`}>
                        <span>{trendUp ? '↑' : '↓'} {trend}</span>
                        <span className="text-slate-400 font-normal">vs tháng trước</span>
                    </div>
                )}
            </div>
            <div className={`p-3.5 rounded-xl shadow-lg ${bgClass} shadow-current/20 text-white transform group-hover:rotate-6 transition-transform duration-300`}>
                <Icon className="w-6 h-6" />
            </div>
        </GlassCard>
    );
};

export default StatCard;
