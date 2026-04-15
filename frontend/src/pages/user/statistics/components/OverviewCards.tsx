import React from 'react';
import { Target, CheckCircle2, Clock, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

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
    const completionRate = assigned > 0 ? ((completed / assigned) * 100).toFixed(1) : '0.0';
    const pendingRate = assigned > 0 ? ((pendingReview / assigned) * 100).toFixed(1) : '0.0';
    const rejectedRate = assigned > 0 ? ((rejected / assigned) * 100).toFixed(1) : '0.0';
    const inProgress = assigned - completed - pendingReview - rejected;

    const cards = [
        {
            key: 'total',
            label: 'Tổng nhiệm vụ',
            value: assigned,
            icon: Target,
            iconColor: 'text-indigo-500',
            iconBg: 'bg-indigo-50 dark:bg-indigo-900/30',
            accent: 'border-l-indigo-500',
            badge: null,
            sub: `${inProgress > 0 ? `${inProgress} đang thực hiện` : 'Toàn bộ nhiệm vụ'}`,
            subColor: 'text-slate-400',
        },
        {
            key: 'completed',
            label: 'Đã hoàn thành',
            value: completed,
            icon: CheckCircle2,
            iconColor: 'text-emerald-500',
            iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',
            accent: 'border-l-emerald-500',
            badge: {
                text: `↑ ${completionRate}%`,
                color: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400',
            },
            sub: 'Tỷ lệ hoàn thành',
            subColor: 'text-emerald-600 dark:text-emerald-500',
        },
        {
            key: 'pending',
            label: 'Chờ phê duyệt',
            value: pendingReview,
            icon: Clock,
            iconColor: 'text-amber-500',
            iconBg: 'bg-amber-50 dark:bg-amber-900/30',
            accent: 'border-l-amber-500',
            badge: pendingReview > 0
                ? { text: `${pendingRate}%`, color: 'text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400' }
                : null,
            sub: pendingReview > 0 ? 'Chờ quản lý duyệt' : 'Không có task chờ',
            subColor: pendingReview > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-slate-400',
        },
        {
            key: 'rejected',
            label: 'Yêu cầu sửa lại',
            value: rejected,
            icon: AlertTriangle,
            iconColor: 'text-rose-500',
            iconBg: 'bg-rose-50 dark:bg-rose-900/30',
            accent: 'border-l-rose-500',
            badge: rejected > 0
                ? { text: `${rejectedRate}%`, color: 'text-rose-700 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400' }
                : null,
            sub: rejected > 0 ? 'Cần xem lại và chỉnh sửa' : 'Không có phản hồi lỗi',
            subColor: rejected > 0 ? 'text-rose-600 dark:text-rose-500' : 'text-slate-400',
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {cards.map((card) => {
                const Icon = card.icon;
                return (
                    <div
                        key={card.key}
                        className={`
                            relative bg-white dark:bg-slate-900
                            border border-slate-200 dark:border-slate-700/60
                            border-l-[3px] ${card.accent}
                            rounded-xl shadow-sm
                            p-3 sm:p-4
                            hover:shadow-md transition-shadow
                        `}
                    >
                        {/* Row 1: Icon & Label & Badge */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <div className={`p-1 sm:p-1.5 rounded-md sm:rounded-lg ${card.iconBg} shrink-0`}>
                                    <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${card.iconColor}`} strokeWidth={2.5} />
                                </div>
                                <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-widest truncate">
                                    {card.label}
                                </p>
                            </div>
                            {card.badge && (
                                <span className={`shrink-0 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded ${card.badge.color}`}>
                                    {card.badge.text}
                                </span>
                            )}
                        </div>

                        {/* Row 2: Value & Sub-text */}
                        <div className="flex items-end justify-between gap-2 mt-1">
                            <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white leading-none tracking-tight">
                                {card.value.toLocaleString()}
                            </p>
                            <p className={`text-[9px] sm:text-[11px] font-semibold ${card.subColor} truncate mt-1 text-right max-w-[50%]`}>
                                {card.sub}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default OverviewCards;
