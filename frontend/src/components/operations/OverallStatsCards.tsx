import { useState, useMemo, useEffect, useRef } from 'react';
import {
    Activity,
    CheckCircle2,
    Clock,
    Target,
    AlertCircle,
    TrendingUp,
    Calendar,
    ChevronDown,
    Layers,
    Info
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import GlassCard from '../common/GlassCard';
import { format, subDays, startOfDay, isSameDay, isAfter, subMonths, subQuarters, subYears } from 'date-fns';
import { vi } from 'date-fns/locale';

// Types
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
    { key: 'day', label: '1 Ngày', days: 1 },
    { key: 'week', label: '1 Tuần', days: 7 },
    { key: 'month', label: '1 Tháng', days: 30 },
    { key: 'quarter', label: '1 Quý', days: 90 },
    { key: 'year', label: '1 Năm', days: 365 },
];

const OverallStatsCards: React.FC<OverallStatsCardsProps> = ({ tasks }) => {
    const [timeRange, setTimeRange] = useState<TimeRange>('month');
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [showTimeDropdown, setShowTimeDropdown] = useState(false);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const timeDropdownRef = useRef<HTMLDivElement>(null);
    const projectDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target as Node)) {
                setShowTimeDropdown(false);
            }
            if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
                setShowProjectDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Get unique projects
    const projects = useMemo(() => {
        const uniqueProjects = [...new Set(tasks.map(t => t.projectName))];
        return uniqueProjects.sort();
    }, [tasks]);

    // Filter tasks by selected project
    const filteredTasks = useMemo(() => {
        if (!selectedProject) return tasks;
        return tasks.filter(t => t.projectName === selectedProject);
    }, [tasks, selectedProject]);

    const dateRange = useMemo(() => {
        const now = new Date();
        const rangeConfig = TIME_RANGES.find(r => r.key === timeRange)!;
        let startDate;

        switch (timeRange) {
            case 'month': startDate = subMonths(now, 1); break;
            case 'quarter': startDate = subQuarters(now, 1); break;
            case 'year': startDate = subYears(now, 1); break;
            default: startDate = subDays(now, rangeConfig.days);
        }

        const days = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        return { start: startDate, end: now, days: days };
    }, [timeRange]);

    // Compute stats
    const stats = useMemo(() => {
        // Completed: status_approve = 1 (filter by time range for completed)
        const completed = filteredTasks.filter(t => {
            const isApproved = t.statusApprove === 1 || t.accept === 1; // Fallback
            if (!isApproved || !t.approvalAt) return false;
            const approvalDate = new Date(t.approvalAt);
            if (isNaN(approvalDate.getTime())) return false;
            return isSameDay(approvalDate, dateRange.start) || isAfter(approvalDate, dateRange.start);
        }).length;

        // Pending Review: status_approve = 0, status_submit = 1
        const pendingReview = filteredTasks.filter(t => {
            const statusApprove = t.statusApprove ?? t.accept ?? 0;
            const statusReject = t.statusReject ?? t.status_reject ?? 0;
            const statusSubmit = t.statusSubmit ?? (t.check === 3 ? 1 : 0);
            return statusApprove === 0 && statusReject === 0 && statusSubmit === 1;
        }).length;

        // Needs Changes: status_approve = 0, status_reject = 1, status_submit = 1
        const needsChanges = filteredTasks.filter(t => {
            const statusApprove = t.statusApprove ?? t.accept ?? 0;
            const statusReject = t.statusReject ?? t.status_reject ?? 0;
            return statusApprove === 0 && statusReject === 1;
        }).length;

        // In Progress: status_approve = 0, status_work = 1
        const inProgress = filteredTasks.filter(t => {
            const statusApprove = t.statusApprove ?? t.accept ?? 0;
            const statusReject = t.statusReject ?? t.status_reject ?? 0;
            const statusSubmit = t.statusSubmit ?? (t.check === 3 ? 1 : 0);
            const statusWork = t.statusWork ?? t.check ?? 0;
            return statusApprove === 0 && statusWork > 0 && statusSubmit === 0 && statusReject === 0;
        }).length;

        // Not Started: status_work = 0
        const notStarted = filteredTasks.filter(t => {
            const statusApprove = t.statusApprove ?? t.accept ?? 0;
            const statusSubmit = t.statusSubmit ?? (t.check === 3 ? 1 : 0);
            const statusWork = t.statusWork ?? t.check ?? 0;
            return statusWork === 0 && statusSubmit === 0 && statusApprove === 0;
        }).length;

        const total = filteredTasks.length;

        return { completed, pendingReview, needsChanges, inProgress, notStarted, total };
    }, [filteredTasks, dateRange]);

    // Colors for projects
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6', '#f43f5e'];

    // Compute daily completion data for Area chart
    const chartData = useMemo(() => {
        const data: any[] = [];
        const now = new Date();

        for (let i = dateRange.days - 1; i >= 0; i--) {
            const date = subDays(now, i);
            const dayStart = startOfDay(date);

            // Filter tasks for this day once
            const dayTasks = filteredTasks.filter(t => {
                const isApproved = t.statusApprove === 1 || t.accept === 1;
                if (!t.approvalAt || !isApproved) return false;
                const approvalDate = new Date(t.approvalAt);
                if (isNaN(approvalDate.getTime())) return false;
                return isSameDay(approvalDate, dayStart);
            });

            const entry: any = {
                date: format(date, dateRange.days <= 7 ? 'EEE' : 'dd/MM', { locale: vi }),
                fullDate: date,
                total: dayTasks.length
            };

            // Fill per project
            projects.forEach(proj => {
                entry[proj] = dayTasks.filter(t => t.projectName === proj).length;
            });

            data.push(entry);
        }

        return data;
    }, [filteredTasks, dateRange, projects]);

    // Stat card component
    const StatCard = ({
        value,
        label,
        icon: Icon,
        gradient,
        textColor = 'text-white',
        bgClass
    }: {
        value: number;
        label: string;
        icon: any;
        gradient?: string;
        textColor?: string;
        bgClass?: string;
    }) => (
        <div className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${bgClass || ''}`}>
            {gradient && <div className={`absolute inset-0 ${gradient} opacity-90`}></div>}
            <div className="relative z-10">
                <div className={`p-2 rounded-xl inline-block ${gradient ? 'bg-white/20' : 'bg-slate-100'}`}>
                    <Icon className={`w-5 h-5 ${gradient ? 'text-white' : 'text-slate-600'}`} />
                </div>
                <div className="mt-3">
                    <span className={`text-3xl font-extrabold ${textColor}`}>{value}</span>
                    <p className={`text-xs font-bold uppercase mt-1 tracking-wide ${gradient ? 'opacity-90' : 'text-slate-400'} ${textColor}`}>
                        {label}
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">

                {/* Project Selector */}
                <div className="relative" ref={projectDropdownRef}>
                    <button
                        onClick={() => { setShowProjectDropdown(!showProjectDropdown); setShowTimeDropdown(false); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-primary-300 hover:shadow-md transition-all"
                    >
                        <Layers className="w-4 h-4 text-indigo-500" />
                        {selectedProject || 'Tất cả dự án'}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showProjectDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                            <button
                                onClick={() => { setSelectedProject(null); setShowProjectDropdown(false); }}
                                className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${!selectedProject
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                Tất cả dự án
                            </button>
                            {projects.map(project => (
                                <button
                                    key={project}
                                    onClick={() => { setSelectedProject(project); setShowProjectDropdown(false); }}
                                    className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors truncate ${selectedProject === project
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {project}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Summary badge */}
                <div className="ml-auto px-4 py-2 bg-slate-100 rounded-xl text-sm font-medium text-slate-600">
                    Tổng: <span className="font-bold text-slate-800">{stats.total}</span> task
                </div>
            </div>

            {/* Stats Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <StatCard
                    value={stats.completed}
                    label="Hoàn thành"
                    icon={CheckCircle2}
                    gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
                />
                <StatCard
                    value={stats.pendingReview}
                    label="Chờ duyệt"
                    icon={Clock}
                    gradient="bg-gradient-to-br from-amber-400 to-orange-500"
                />
                <StatCard
                    value={stats.needsChanges}
                    label="Cần sửa"
                    icon={AlertCircle}
                    gradient="bg-gradient-to-br from-rose-500 to-pink-600"
                />
                <StatCard
                    value={stats.notStarted}
                    label="Chưa làm"
                    icon={Target}
                    bgClass="bg-white border border-slate-200 shadow-sm"
                    textColor="text-slate-800"
                />
            </div>
        </div>
    );
};

export default OverallStatsCards;
