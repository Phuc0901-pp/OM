import React from 'react';
import { Target, CheckCircle2, Clock, AlertTriangle, ClipboardList } from 'lucide-react';

interface OverviewCardsProps {
  assigned: number;
  completed: number;
  pendingReview: number;
  rejected: number;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
}

const OverviewCards: React.FC<OverviewCardsProps> = ({
  assigned,
  completed,
  pendingReview,
  rejected,
  selectedStatus,
  onSelectStatus,
}) => {
  const completionRate = assigned > 0 ? ((completed / assigned) * 100).toFixed(1) : '0.0';
  const pendingRate = assigned > 0 ? ((pendingReview / assigned) * 100).toFixed(1) : '0.0';
  const rejectedRate = assigned > 0 ? ((rejected / assigned) * 100).toFixed(1) : '0.0';
  const inProgress = assigned - completed - pendingReview - rejected;

  const cards = [
    {
      key: 'total',
      filterValue: 'all',
      label: 'Tổng nhiệm vụ',
      value: assigned,
      icon: Target,
      iconColor: 'text-indigo-500',
      iconBg: 'bg-indigo-50',
      accent: 'border-l-indigo-500',
      activeRing: 'ring-2 ring-indigo-400 ring-offset-1',
      activeBg: 'bg-indigo-50/60',
      badge: null,
      sub: `${inProgress > 0 ? `${inProgress} đang thực hiện` : 'Toàn bộ nhiệm vụ'}`,
      subColor: 'text-slate-400',
    },
    {
      key: 'completed',
      filterValue: 'approved',
      label: 'Đã hoàn thành',
      value: completed,
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50',
      accent: 'border-l-emerald-500',
      activeRing: 'ring-2 ring-emerald-400 ring-offset-1',
      activeBg: 'bg-emerald-50/60',
      badge: {
        text: `↑ ${completionRate}%`,
        color: 'text-emerald-700 bg-emerald-100',
      },
      sub: 'Tỷ lệ hoàn thành',
      subColor: 'text-emerald-600',
    },
    {
      key: 'pending',
      filterValue: 'submitted',
      label: 'Chờ phê duyệt',
      value: pendingReview,
      icon: Clock,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50',
      accent: 'border-l-amber-500',
      activeRing: 'ring-2 ring-amber-400 ring-offset-1',
      activeBg: 'bg-amber-50/60',
      badge: pendingReview > 0
        ? { text: `${pendingRate}%`, color: 'text-amber-700 bg-amber-100' }
        : null,
      sub: pendingReview > 0 ? 'Chờ quản lý duyệt' : 'Không có task chờ',
      subColor: pendingReview > 0 ? 'text-amber-600' : 'text-slate-400',
    },
    {
      key: 'rejected',
      filterValue: 'rejected',
      label: 'Yêu cầu sửa lại',
      value: rejected,
      icon: AlertTriangle,
      iconColor: 'text-rose-500',
      iconBg: 'bg-rose-50',
      accent: 'border-l-rose-500',
      activeRing: 'ring-2 ring-rose-400 ring-offset-1',
      activeBg: 'bg-rose-50/60',
      badge: rejected > 0
        ? { text: `${rejectedRate}%`, color: 'text-rose-700 bg-rose-100' }
        : null,
      sub: rejected > 0 ? 'Cần xem lại và chỉnh sửa' : 'Không có phản hồi lỗi',
      subColor: rejected > 0 ? 'text-rose-600' : 'text-slate-400',
    },
    {
      key: 'not_started',
      filterValue: 'pending',
      label: 'Chưa thực hiện',
      value: inProgress,
      icon: ClipboardList,
      iconColor: 'text-slate-500',
      iconBg: 'bg-slate-100',
      accent: 'border-l-slate-400',
      activeRing: 'ring-2 ring-slate-400 ring-offset-1',
      activeBg: 'bg-slate-100/60',
      badge: null,
      sub: inProgress > 0 ? 'Cần được xử lý' : 'Đã làm hết',
      subColor: 'text-slate-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = selectedStatus === card.filterValue;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelectStatus(isActive ? 'all' : card.filterValue)}
            className={`
              relative text-left w-full
              border border-slate-200
              border-l-[3px] ${card.accent}
              rounded-xl shadow-sm
              p-3 sm:p-4
              transition-all duration-200
              cursor-pointer select-none
              ${isActive
                ? `${card.activeRing} ${card.activeBg} shadow-md scale-[1.02]`
                : 'bg-white hover:shadow-md hover:scale-[1.01]'
              }
            `}
            aria-pressed={isActive}
            title={isActive ? `Bỏ lọc "${card.label}"` : `Lọc theo "${card.label}"`}
          >
            {/* Active indicator pill */}
            {isActive && (
              <span className="absolute top-1.5 right-1.5 text-[8px] font-black uppercase tracking-wider bg-indigo-500 text-white px-1.5 py-0.5 rounded-full">
                Đang lọc
              </span>
            )}

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
              <p className="text-2xl sm:text-3xl font-black text-slate-800 leading-none tracking-tight">
                {card.value.toLocaleString()}
              </p>
              <p className={`text-[9px] sm:text-[11px] font-semibold ${card.subColor} truncate mt-1 text-right max-w-[50%]`}>
                {card.sub}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default OverviewCards;
