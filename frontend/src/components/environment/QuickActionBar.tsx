import React from 'react';
import { LogIn, LogOut, BarChart2, History, LucideIcon } from 'lucide-react';

interface ActionCardProps {
    icon: LucideIcon;
    title: string;
    subtitle?: string;
    colorClass: string;
    iconBgClass: string;
    onClick: () => void;
    disabled?: boolean;
    badge?: string;
}

const ActionCard: React.FC<ActionCardProps> = ({
    icon: Icon,
    title,
    subtitle,
    colorClass,
    iconBgClass,
    onClick,
    disabled,
    badge,
}) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`
            relative flex flex-col items-start gap-2 p-4 h-full rounded-2xl border
            bg-white/80 backdrop-blur-sm shadow-sm
            transition-all duration-200
            ${disabled
                ? 'opacity-50 cursor-not-allowed border-slate-100'
                : `cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-95 border-slate-100 hover:border-${colorClass}-200`
            }
        `}
    >
        {/* Badge */}
        {badge && (
            <span className={`absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-${colorClass}-100 text-${colorClass}-700`}>
                {badge}
            </span>
        )}

        {/* Icon */}
        <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${iconBgClass}`}>
            <Icon className="w-5 h-5" />
        </div>

        {/* Text */}
        <div className="text-left mt-0.5">
            <div className={`text-sm font-bold text-slate-700`}>{title}</div>
            {subtitle && <div className="text-xs text-slate-400 mt-0.5 leading-tight">{subtitle}</div>}
        </div>
    </button>
);

const formatDateTime = (dateString?: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${time} ${date}`;
};

interface QuickActionBarProps {
    attendance: {
        date_checkin?: string;
        date_checkout?: string;
        checkout_requested?: boolean;
        checkout_approved?: boolean;
        checkout_approved_time?: string;
    } | null;
    onCheckIn: () => void;
    onCheckOut: () => void;
    onStatistics: () => void;
    onHistory: () => void;
}

const QuickActionBar: React.FC<QuickActionBarProps> = ({
    attendance,
    onCheckIn,
    onCheckOut,
    onStatistics,
    onHistory,
}) => {
    const hasCheckedIn = !!attendance?.date_checkin;
    // Check-out is true either if officially checked out previously OR if newly approved
    const hasCheckedOut = !!attendance?.date_checkout || !!attendance?.checkout_approved;
    const isPendingCheckout = !hasCheckedOut && !!attendance?.checkout_requested;

    const renderCheckoutSubtitle = () => {
        if (hasCheckedOut) {
            // Use date_checkout (old standard) or fallback to newly added checkout_approved_time 
            const finalTime = attendance?.date_checkout || attendance?.checkout_approved_time;
            return finalTime ? formatDateTime(finalTime) : 'Đã ra ca';
        }
        if (isPendingCheckout) return 'Đang chờ duyệt...';
        return 'Ghi nhận ra ca';
    };

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
            {/* Check-in */}
            <ActionCard
                icon={LogIn}
                title="Check-in"
                subtitle={hasCheckedIn ? formatDateTime(attendance!.date_checkin) : 'Ghi nhận vào ca'}
                colorClass="green"
                iconBgClass={hasCheckedIn ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"}
                onClick={onCheckIn}
                disabled={hasCheckedIn}
                badge={hasCheckedIn ? 'Đã vào' : undefined}
            />

            {/* Check-out */}
            <ActionCard
                icon={LogOut}
                title="Check-out"
                subtitle={renderCheckoutSubtitle()}
                colorClass={hasCheckedOut ? "rose" : isPendingCheckout ? "amber" : "rose"}
                iconBgClass={hasCheckedOut ? "bg-rose-100 text-rose-600" : isPendingCheckout ? "bg-amber-100 text-amber-600 animate-pulse" : "bg-slate-100 text-slate-500"}
                onClick={onCheckOut}
                disabled={!hasCheckedIn || hasCheckedOut || isPendingCheckout}
                badge={hasCheckedOut ? 'Đã ra' : isPendingCheckout ? 'Chờ duyệt' : undefined}
            />

            {/* Statistics */}
            <ActionCard
                icon={BarChart2}
                title="Thống kê"
                subtitle="Xem tiến độ công việc"
                colorClass="indigo"
                iconBgClass="bg-indigo-50 text-indigo-600"
                onClick={onStatistics}
            />

            {/* History */}
            <ActionCard
                icon={History}
                title="Lịch sử"
                subtitle="Điểm danh & công việc"
                colorClass="amber"
                iconBgClass="bg-amber-50 text-amber-600"
                onClick={onHistory}
            />
        </div>
    );
};

export default QuickActionBar;
