import React, { useMemo, useState } from 'react';
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, eachDayOfInterval, isSameDay,
    isWithinInterval, isSameMonth, addWeeks, subWeeks
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import GlassCard from '../../../../components/common/GlassCard';
import { Allocation, TaskDetail } from '../../../../types/allocation';
import api from '../../../../services/api';

interface ProjectScheduleProps {
    allocations: Allocation[];
    selectedProject?: string;
    processes: { id: string; name: string }[];
    stations: { id: string; name: string }[];
    loading: boolean;
}

// Pastel Color Palette for Projects
const PROJECT_COLORS = [
    { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
    { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700' },
    { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
    { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
    { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
    { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
    { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700' },
    { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
];

const getProjectColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
};

const ProjectSchedule: React.FC<ProjectScheduleProps> = ({ allocations, selectedProject, processes, stations, loading }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewType, setViewType] = useState<'month' | 'week'>('month'); // Responsive View State

    // Auto-switch based on screen size
    React.useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) setViewType('week'); // Tablet/Mobile -> Week View
            else setViewType('month');
        };
        handleResize(); // Init
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 1. Process & Station Maps (O(1) Lookup)
    const processMap = useMemo(() => {
        const map: Record<string, string> = {};
        processes.forEach(p => { map[p.id] = p.name; });
        return map;
    }, [processes]);

    const stationMap = useMemo(() => {
        const map: Record<string, string> = {};
        stations.forEach(s => { map[s.id] = s.name; });
        return map;
    }, [stations]);

    // 2. Filter Allocations
    const filteredAllocations = useMemo(() => {
        let filtered = allocations;
        if (selectedProject) {
            filtered = filtered.filter(a => a.id_project === selectedProject);
        }
        return filtered;
    }, [allocations, selectedProject]);

    // 3. Calendar Grid Generation
    const calendarDays = useMemo(() => {
        if (viewType === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end });
        }

        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentDate, viewType]);

    // 4. Navigation
    const nextPeriod = () => {
        if (viewType === 'week') setCurrentDate(addWeeks(currentDate, 1));
        else setCurrentDate(addMonths(currentDate, 1));
    };
    const prevPeriod = () => {
        if (viewType === 'week') setCurrentDate(subWeeks(currentDate, 1));
        else setCurrentDate(subMonths(currentDate, 1));
    };
    const isToday = (day: Date) => isSameDay(day, new Date());

    // --- NEW: Fetch Metadata for Detailed Tooltip ---
    const [metaData, setMetaData] = useState<{
        childCats: any[],
        mainCats: any[],
        stations: any[]
    }>({ childCats: [], mainCats: [], stations: [] });

    React.useEffect(() => {
        const loadMeta = async () => {
            try {
                // Fetch raw tables to get relations (station -> main_cat)
                const [cRes, mRes, sRes] = await Promise.all([
                    api.get('/admin/tables/child_categories'),
                    api.get('/admin/tables/main_categories'),
                    api.get('/admin/tables/stations')
                ]);

                // Handle various response formats (sometimes { data: [] } or just [])
                const getArr = (res: any) => Array.isArray(res.data) ? res.data : (res.data?.data || []);

                setMetaData({
                    childCats: getArr(cRes),
                    mainCats: getArr(mRes),
                    stations: getArr(sRes)
                });
            } catch (e) { console.error("Metadata fetch error", e); }
        };
        loadMeta();
    }, []);

    // Meta Maps for O(1) Lookup
    const metaMaps = useMemo(() => {
        const cMap: Record<string, string> = {};
        metaData.childCats.forEach(c => cMap[String(c.id)] = c.name);

        const mMap: Record<string, string> = {};
        metaData.mainCats.forEach(m => mMap[String(m.id)] = m.name);

        const sMap: Record<string, { name: string, mainId: string }> = {};
        metaData.stations.forEach(s => {
            sMap[String(s.id)] = {
                name: s.name,
                mainId: String(s.id_main_category) // Key field from User request
            };
        });

        return { cMap, mMap, sMap };
    }, [metaData]);
    // ------------------------------------------------

    // Tooltip State
    const [hoveredAlloc, setHoveredAlloc] = useState<Allocation | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number, y: number, align: 'left' | 'right' } | null>(null);

    const handleMouseEnter = (e: React.MouseEvent, alloc: Allocation, colIdx: number) => {
        if (viewType === 'week') return; // Disable hover on mobile

        const rect = e.currentTarget.getBoundingClientRect();

        // Force Left alignment for Friday (4), Saturday (5), Sunday (6)
        // Or if close to right edge
        const align = colIdx >= 4 ? 'left' : 'right';

        setTooltipPos({
            x: align === 'right' ? rect.right + 10 : rect.left - 10,
            y: rect.top,
            align
        });
        setHoveredAlloc(alloc);
    };

    const handleMouseLeave = () => {
        setHoveredAlloc(null);
        setTooltipPos(null);
    };

    // Mobile: Click handler
    const handleProjectClick = (e: React.MouseEvent, alloc: Allocation) => {
        if (viewType === 'week') {
            e.stopPropagation();
            setHoveredAlloc(alloc); // Triggers Modal
        }
    };

    // 5. Helper to get tasks status summary for a specific allocation
    const getTaskSummary = (tasks: TaskDetail[] = []) => {
        const { cMap, mMap, sMap } = metaMaps;

        // Group tasks by Unique Key: ChildID_StationID
        // This gathers all 'processes' for a specific item
        const groups: Record<string, {
            mainName: string;
            childName: string;
            stationName: string;
            tasks: TaskDetail[];
        }> = {};

        tasks.forEach(t => {
            if (!t.child_category_id) return;

            // Generate Key
            const stationId = t.station_id ? String(t.station_id) : 'unknown';
            const childId = String(t.child_category_id);
            const key = `${childId}_${stationId}`;

            if (!groups[key]) {
                // 1. Child Name
                const childName = cMap[childId] || t.child_category?.name || 'Hạng mục';

                // 2. Station Name & Main Category Logic
                let stationName = 'Trạm';
                let mainName = 'Dự án';

                if (t.station_id && sMap[stationId]) {
                    const stationObj = sMap[stationId];
                    stationName = stationObj.name;
                    // 3. Main Category from Station
                    if (stationObj.mainId && mMap[stationObj.mainId]) {
                        mainName = mMap[stationObj.mainId];
                    }
                } else if (t.child_category?.station) {
                    stationName = t.child_category.station.name;
                    // Fallback if Main Cat inside child?
                    if (t.child_category?.main_category) mainName = t.child_category.main_category.name;
                } else if (t.station_name) {
                    stationName = t.station_name;
                }

                groups[key] = { mainName, childName, stationName, tasks: [] };
            }
            groups[key].tasks.push(t);
        });

        // Determine Status for each Group
        const completed: { name: string }[] = [];
        const inProgress: { name: string }[] = [];

        Object.values(groups).forEach(g => {
            // "Đã làm": ALL processes in this group must be approved (status_approve === 1)
            const allApproved = g.tasks.every(t => t.status_approve === 1);

            // Formatted Name: "{Main}_{Child}_{Station}"
            // Note: User format request: "{main_category}_{child_category}_{station}"
            const fullName = `${g.mainName} - ${g.childName} - ${g.stationName}`; // Using " - " for readability based on Img, or User requested "_" 
            // User text: "{main_category}_{child_category}_{station}" -> I will use " - " for UI aesthetics, or just follow user exactly?
            // "nó nên hiển thị tên công việc như sau: {main_category}_{child_category}_{station}"
            // I'll use " - " as chips usually look better, but let's stick to the structure.

            // Wait, standard UI usually separators are clear. I'll use " | " or special formatting.
            // Let's use user's request structure: Main - Child - Station

            const displayObj = {
                name: g.mainName,
                desc: `${g.childName} (${g.stationName})`, // Split for better UI?
                // Or just one string as requested:
                fullLabel: `${g.mainName} | ${g.childName} | ${g.stationName}`
            };

            if (allApproved) {
                completed.push({ name: displayObj.fullLabel });
            } else {
                inProgress.push({ name: displayObj.fullLabel });
            }
        });

        return { completed, inProgress };
    };

    if (loading && allocations.length === 0) {
        return (
            <GlassCard className="h-[500px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                    <CalendarDays className="w-8 h-8 animate-pulse" />
                    <span className="font-medium">Đang tải lịch trình...</span>
                </div>
            </GlassCard>
        );
    }

    const weekDays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

    return (
        <GlassCard className="p-0 overflow-hidden flex flex-col h-full min-h-[600px] relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 md:p-6 border-b border-slate-100 bg-white gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm shrink-0">
                        <CalendarDays className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight leading-tight">Lịch trình dự án</h2>
                        <p className="text-xs md:text-sm text-slate-500 font-medium hidden md:block">Theo dõi tiến độ và thời gian thực hiện</p>
                    </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
                    <button
                        onClick={prevPeriod}
                        className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm md:text-base font-bold text-slate-800 w-full md:w-40 text-center capitalize select-none truncate">
                        {viewType === 'week'
                            ? `Tuần ${format(currentDate, 'w')} - ${format(currentDate, 'MM/yyyy')}`
                            : format(currentDate, 'MMMM yyyy', { locale: vi })
                        }
                    </span>
                    <button
                        onClick={nextPeriod}
                        className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all active:scale-95"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto bg-slate-50">
                <div className="min-w-full md:min-w-[1000px] pb-20"> {/* Full width on mobile, Fixed min-width on Desktop */}

                    {/* Week Header (Hidden on Mobile Week View) */}
                    <div className={`${viewType === 'week' ? 'hidden' : 'grid'} grid-cols-7 border-b border-slate-200 bg-slate-50 sticky top-0 z-20 shadow-sm`}>
                        {weekDays.map((day, i) => (
                            <div key={i} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className={`
                        grid gap-px border-b border-slate-200 bg-slate-200
                        ${viewType === 'week' ? 'grid-cols-1 gap-2 p-2 bg-slate-50 border-0' : 'grid-cols-7 auto-rows-fr'}
                    `}>

                        {calendarDays.map((day, dayIdx) => {
                            const isCurrentMonth = isSameMonth(day, currentDate);
                            const isTodayDate = isToday(day);

                            // Find allocations active on this day
                            const activeAllocations = filteredAllocations.filter(alloc => {
                                const start = alloc.start_time ? new Date(alloc.start_time) : null;
                                const end = alloc.end_time ? new Date(alloc.end_time) : null;
                                return start && end && isWithinInterval(day, { start, end });
                            });

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={`
                                        min-h-[100px] md:min-h-[140px] bg-white p-2 md:p-3 flex flex-col gap-2 relative transition-colors
                                        ${viewType === 'week' ? 'rounded-xl border border-slate-100 shadow-sm' : '' /* Mobile Card Style */}
                                        ${!isCurrentMonth && viewType === 'month' ? 'bg-slate-50/50' : ''}
                                        ${isTodayDate ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}
                                    `}
                                >
                                    {/* Date Number */}
                                    <div className="flex justify-between items-center md:items-start">
                                        <div className="flex items-center gap-2">
                                            {/* Mobile: Show Day Name (T2, T3...) */}
                                            {viewType === 'week' && (
                                                <span className="text-xs font-bold text-slate-500 uppercase">
                                                    {format(day, 'EEEE', { locale: vi })}
                                                </span>
                                            )}
                                            <span className={`
                                                text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full
                                                ${isTodayDate ? 'bg-indigo-600 text-white shadow-md' : (isCurrentMonth ? 'text-slate-700' : 'text-slate-400')}
                                            `}>
                                                {format(day, 'd')}
                                            </span>
                                        </div>

                                        {activeAllocations.length > 0 && (
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                                {activeAllocations.length} dự án
                                            </span>
                                        )}
                                    </div>

                                    {/* Projects List */}
                                    <div className="flex flex-col gap-1.5 mt-1 overflow-y-auto max-h-[110px] custom-scrollbar pr-1">
                                        {activeAllocations.map(alloc => {
                                            const { completed, inProgress } = getTaskSummary(alloc.task_details);
                                            const hasTasks = completed.length > 0 || inProgress.length > 0;
                                            // Use Project ID for color consistency
                                            const color = getProjectColor(alloc.project_id || alloc.id);

                                            return (
                                                <div
                                                    key={alloc.id}
                                                    className="group/item relative"
                                                    onMouseEnter={(e) => handleMouseEnter(e, alloc, dayIdx % 7)}
                                                    onMouseLeave={handleMouseLeave}
                                                    onClick={(e) => handleProjectClick(e, alloc)}
                                                >
                                                    {/* Chip */}
                                                    <div className={`
                                                        px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition-all shadow-sm hover:shadow-md
                                                        ${color.bg} ${color.border}
                                                    `}>
                                                        <div className={`font-bold truncate leading-tight ${color.text}`}>
                                                            {alloc.project?.project_name}
                                                        </div>
                                                        <div className={`text-[9px] truncate mt-0.5 opacity-80 ${color.text}`}>
                                                            {alloc.classification?.name}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Global Tooltip Portal */}
            {hoveredAlloc && (
                viewType === 'week' ? (
                    // --- MOBILE MODAL ---
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                        onClick={handleMouseLeave} // Click outside to close
                    >
                        <div
                            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 animate-in zoom-in-95 duration-200"
                            onClick={e => e.stopPropagation()} // Prevent close on content click
                        >
                            {/* Header */}
                            <div className="pb-4 border-b border-slate-100 mb-4">
                                <h4 className="font-bold text-slate-800 text-lg mb-1">{hoveredAlloc.project?.project_name}</h4>
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Clock className="w-4 h-4" />
                                    <span>
                                        {hoveredAlloc.start_time ? format(new Date(hoveredAlloc.start_time), 'dd/MM') : '?'} - {hoveredAlloc.end_time ? format(new Date(hoveredAlloc.end_time), 'dd/MM') : '?'}
                                    </span>
                                </div>
                            </div>

                            {/* Mobile Content Reuse logic */}
                            {(() => {
                                const { completed, inProgress } = getTaskSummary(hoveredAlloc.task_details);
                                return (
                                    <div className="space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                        {/* Completed */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </div>
                                                <span className="font-bold text-slate-700">Đã làm ({completed.length})</span>
                                            </div>
                                            {completed.length > 0 ? (
                                                <ul className="pl-3 space-y-2 border-l-2 border-emerald-100 ml-2">
                                                    {completed.map((t, idx) => (
                                                        <li key={idx} className="text-sm text-slate-600 pl-3">
                                                            {t.name}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p className="text-sm text-slate-400 italic pl-5">Chưa có công việc hoàn thành</p>}
                                        </div>

                                        {/* In Progress */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600">
                                                    <Clock className="w-4 h-4" />
                                                </div>
                                                <span className="font-bold text-slate-700">Đang thực hiện ({inProgress.length})</span>
                                            </div>
                                            {inProgress.length > 0 ? (
                                                <ul className="pl-3 space-y-2 border-l-2 border-amber-100 ml-2">
                                                    {inProgress.map((t, idx) => (
                                                        <li key={idx} className="text-sm text-slate-600 pl-3">
                                                            {t.name}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p className="text-sm text-slate-400 italic pl-5">Không có công việc đang làm</p>}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Close Button Hint */}
                            <div className="mt-5 pt-3 border-t border-slate-50 text-center">
                                <button onClick={handleMouseLeave} className="text-sm font-medium text-slate-500 hover:text-slate-800">
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // --- DESKTOP TOOLTIP ---
                    tooltipPos && (
                        <div
                            className="fixed z-[9999] w-72 bg-white rounded-xl shadow-2xl border border-slate-100 p-4 animate-in fade-in zoom-in-95 duration-200"
                            style={{
                                top: tooltipPos.y,
                                left: tooltipPos.align === 'left' ? undefined : tooltipPos.x,
                                right: tooltipPos.align === 'left' ? (window.innerWidth - tooltipPos.x) : undefined,
                                // Initial offset adjustment
                                transform: tooltipPos.align === 'left' ? 'translateX(-100%)' : 'none'
                            }}
                        >
                            {/* Tooltip Header */}
                            <div className="pb-3 border-b border-slate-100 mb-3">
                                <h4 className="font-bold text-slate-800 text-sm mb-1">{hoveredAlloc.project?.project_name}</h4>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>
                                        {hoveredAlloc.start_time ? format(new Date(hoveredAlloc.start_time), 'dd/MM') : '?'} - {hoveredAlloc.end_time ? format(new Date(hoveredAlloc.end_time), 'dd/MM') : '?'}
                                    </span>
                                </div>
                            </div>

                            {/* Tasks Section */}
                            {(() => {
                                const { completed, inProgress } = getTaskSummary(hoveredAlloc.task_details);
                                return (
                                    <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                        {/* Completed */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1 rounded bg-emerald-100 text-emerald-600">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">Đã làm ({completed.length})</span>
                                            </div>
                                            {completed.length > 0 ? (
                                                <ul className="pl-7 space-y-1.5">
                                                    {completed.slice(0, 5).map((t, idx) => (
                                                        <li key={idx} className="text-[11px] text-slate-600 leading-tight list-disc marker:text-emerald-400">
                                                            {t.name}
                                                        </li>
                                                    ))}
                                                    {completed.length > 5 && <li className="text-[10px] text-slate-400 italic">...và {completed.length - 5} khác</li>}
                                                </ul>
                                            ) : (
                                                <p className="pl-7 text-[11px] text-slate-400 italic">Chưa có công việc hoàn thành</p>
                                            )}
                                        </div>

                                        {/* In Progress */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1 rounded bg-amber-100 text-amber-600">
                                                    <Clock className="w-3 h-3" />
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">Đang thực hiện ({inProgress.length})</span>
                                            </div>
                                            {inProgress.length > 0 ? (
                                                <ul className="pl-7 space-y-1.5">
                                                    {inProgress.slice(0, 5).map((t, idx) => (
                                                        <li key={idx} className="text-[11px] text-slate-600 leading-tight list-disc marker:text-amber-400">
                                                            {t.name}
                                                        </li>
                                                    ))}
                                                    {inProgress.length > 5 && <li className="text-[10px] text-slate-400 italic">...và {inProgress.length - 5} khác</li>}
                                                </ul>
                                            ) : (
                                                <p className="pl-7 text-[11px] text-slate-400 italic">Không có công việc đang làm</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Tooltip Arrow (Optional visual flair - might be tricky with fixed pos, skipping specifically for cleaner look) */}
                        </div>
                    )
                )
            )}
        </GlassCard>
    );
};

export default ProjectSchedule;
