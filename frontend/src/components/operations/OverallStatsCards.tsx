import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    CheckCircle2,
    Timer,
    AlertOctagon,
    Circle,
    Layers,
    ChevronDown,
    TrendingUp,
    TrendingDown,
    Minus,
} from 'lucide-react';
import { format, subDays, startOfDay, isSameDay, isAfter, subMonths, subQuarters, subYears } from 'date-fns';
import { vi } from 'date-fns/locale';
import { motion } from 'framer-motion';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TaskRow {
    id: string;
    projectName: string;
    statusWork?: number;
    statusSubmit?: number;
    statusApprove?: number;
    statusReject?: number;
    approvalAt?: string | null;
    submittedAt?: string | null;
    [key: string]: any;
}

interface OverallStatsCardsProps {
    tasks: TaskRow[];
}

type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year';

const TIME_RANGES: { key: TimeRange; label: string; days: number }[] = [
    { key: 'day',     label: '1 Ngày', days: 1   },
    { key: 'week',    label: '1 Tuần', days: 7   },
    { key: 'month',   label: '1 Tháng', days: 30 },
    { key: 'quarter', label: '1 Quý', days: 90   },
    { key: 'year',    label: '1 Năm', days: 365  },
];

// ─── Animated counter ──────────────────────────────────────────────────────────
const useCountUp = (target: number, duration = 600) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (target === 0) { setCount(0); return; }
        const start = Date.now();
        const tick = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [target, duration]);
    return count;
};

// ─── Single Stat Card ──────────────────────────────────────────────────────────
interface StatCardConfig {
    value: number;
    label: string;
    sublabel: string;
    icon: React.ElementType;
    accentClass: string;          // Tailwind color for icon + number text
    glowClass: string;            // Tailwind class for the decorative glow blob
    borderHoverClass: string;     // hover border color
    badgeClass: string;           // label badge bg
    index: number;
}

const StatCard: React.FC<StatCardConfig> = ({
    value,
    label,
    sublabel,
    icon: Icon,
    accentClass,
    glowClass,
    borderHoverClass,
    badgeClass,
    index,
}) => {
    const displayValue = useCountUp(value);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07, duration: 0.28, ease: 'easeOut' }}
            className={`group relative overflow-hidden bg-white rounded-2xl border border-slate-100
                shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]
                hover:shadow-[0_8px_28px_-6px_rgba(0,0,0,0.14)]
                hover:${borderHoverClass}
                transition-all duration-300 cursor-default p-5 flex flex-col gap-4`}
        >
            {/* Decorative glow blob */}
            <div className={`absolute -top-5 -right-5 w-24 h-24 rounded-full blur-2xl ${glowClass} opacity-0 group-hover:opacity-60 transition-opacity duration-500`} />

            {/* Top row: label + icon */}
            <div className="flex items-center justify-between">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${badgeClass}`}>
                    {label}
                </div>
                <div className={`p-2 rounded-xl bg-slate-50 group-hover:bg-opacity-100 transition-colors ${accentClass}`}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>

            {/* Value */}
            <div className="flex items-end gap-2">
                <span className={`text-[2.75rem] leading-none font-extrabold tracking-tight ${accentClass}`}>
                    {displayValue}
                </span>
                <span className="text-xs font-semibold text-slate-400 mb-1.5 leading-snug pb-0.5">{sublabel}</span>
            </div>

            {/* Bottom accent bar */}
            <div className={`absolute bottom-0 left-0 right-0 h-[3px] rounded-b-2xl ${glowClass} scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`} />
        </motion.div>
    );
};

// ─── Main component ────────────────────────────────────────────────────────────
const OverallStatsCards: React.FC<OverallStatsCardsProps> = ({ tasks }) => {
    const [timeRange, setTimeRange]               = useState<TimeRange>('month');
    const [selectedProject, setSelectedProject]   = useState<string | null>(null);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const projectDropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
                setShowProjectDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const projects = useMemo(() => [...new Set(tasks.map(t => t.projectName))].sort(), [tasks]);

    const filteredTasks = useMemo(() =>
        selectedProject ? tasks.filter(t => t.projectName === selectedProject) : tasks,
        [tasks, selectedProject]
    );

    const dateRange = useMemo(() => {
        const now = new Date();
        let startDate: Date;
        switch (timeRange) {
            case 'month':   startDate = subMonths(now, 1); break;
            case 'quarter': startDate = subQuarters(now, 1); break;
            case 'year':    startDate = subYears(now, 1); break;
            default:        startDate = subDays(now, TIME_RANGES.find(r => r.key === timeRange)!.days);
        }
        return { start: startDate, end: now, days: Math.ceil((now.getTime() - startDate.getTime()) / 86400000) };
    }, [timeRange]);

    const stats = useMemo(() => {
        const completed = filteredTasks.filter(t => {
            if ((t.statusApprove ?? 0) !== 1 || !t.approvalAt) return false;
            const d = new Date(t.approvalAt);
            return !isNaN(d.getTime()) && (isSameDay(d, dateRange.start) || isAfter(d, dateRange.start));
        }).length;

        const pendingReview = filteredTasks.filter(t =>
            (t.statusApprove ?? 0) === 0 && (t.statusReject ?? 0) === 0 && (t.statusSubmit ?? 0) === 1
        ).length;

        const needsChanges = filteredTasks.filter(t =>
            (t.statusApprove ?? 0) === 0 && (t.statusReject ?? 0) === 1
        ).length;

        const notStarted = filteredTasks.filter(t =>
            (t.statusWork ?? 0) === 0 && (t.statusSubmit ?? 0) === 0 && (t.statusApprove ?? 0) === 0
        ).length;

        return { completed, pendingReview, needsChanges, notStarted, total: filteredTasks.length };
    }, [filteredTasks, dateRange]);

    const CARDS: Omit<StatCardConfig, 'index'>[] = [
        {
            value:            stats.completed,
            label:            'Hoàn thành',
            sublabel:         'đã phê duyệt',
            icon:             CheckCircle2,
            accentClass:      'text-emerald-600',
            glowClass:        'bg-emerald-400',
            borderHoverClass: 'border-emerald-200',
            badgeClass:       'bg-emerald-50 text-emerald-700',
        },
        {
            value:            stats.pendingReview,
            label:            'Chờ duyệt',
            sublabel:         'cần phê duyệt',
            icon:             Timer,
            accentClass:      'text-amber-600',
            glowClass:        'bg-amber-400',
            borderHoverClass: 'border-amber-200',
            badgeClass:       'bg-amber-50 text-amber-700',
        },
        {
            value:            stats.needsChanges,
            label:            'Cần sửa',
            sublabel:         'bị từ chối',
            icon:             AlertOctagon,
            accentClass:      'text-rose-600',
            glowClass:        'bg-rose-400',
            borderHoverClass: 'border-rose-200',
            badgeClass:       'bg-rose-50 text-rose-700',
        },
        {
            value:            stats.notStarted,
            label:            'Chưa làm',
            sublabel:         'chờ thực hiện',
            icon:             Circle,
            accentClass:      'text-slate-500',
            glowClass:        'bg-slate-300',
            borderHoverClass: 'border-slate-300',
            badgeClass:       'bg-slate-100 text-slate-600',
        },
    ];

    return (
        <div className="space-y-4">
            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Project filter */}
                <div className="relative" ref={projectDropdownRef}>
                    <button
                        onClick={() => setShowProjectDropdown(v => !v)}
                        className="flex items-center gap-2 h-9 px-3.5 bg-white border border-slate-200 rounded-xl
                            text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:shadow-sm
                            transition-all shadow-xs"
                    >
                        <Layers className="w-4 h-4 text-indigo-500" />
                        <span className="max-w-[160px] truncate">{selectedProject || 'Tất cả dự án'}</span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showProjectDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showProjectDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                            <div className="max-h-56 overflow-y-auto py-1">
                                <button
                                    onClick={() => { setSelectedProject(null); setShowProjectDropdown(false); }}
                                    className={`w-full px-4 py-2.5 text-left text-[13px] font-medium transition-colors
                                        ${!selectedProject ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    Tất cả dự án
                                </button>
                                {projects.map(project => (
                                    <button
                                        key={project}
                                        onClick={() => { setSelectedProject(project); setShowProjectDropdown(false); }}
                                        className={`w-full px-4 py-2.5 text-left text-[13px] font-medium truncate transition-colors
                                            ${selectedProject === project ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        {project}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Time range pills */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    {TIME_RANGES.map(r => (
                        <button
                            key={r.key}
                            onClick={() => setTimeRange(r.key)}
                            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-200
                                ${timeRange === r.key
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                {/* Total badge (pushed to right) */}
                <div className="ml-auto flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-xs">
                    <span className="text-[12px] text-slate-400 font-semibold">Tổng</span>
                    <span className="text-[14px] font-extrabold text-slate-800">{stats.total}</span>
                    <span className="text-[12px] text-slate-400">task</span>
                </div>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {CARDS.map((card, i) => (
                    <StatCard key={card.label} {...card} index={i} />
                ))}
            </div>
        </div>
    );
};

export default OverallStatsCards;
