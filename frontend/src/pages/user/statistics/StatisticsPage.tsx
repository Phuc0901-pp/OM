import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../../services/api';
import {
    BarChart3, CheckCircle2, Clock, Activity, Target, TrendingUp, History, Timer, Sparkles
} from 'lucide-react';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, CartesianGrid, XAxis, YAxis
} from 'recharts';
import { getUserId } from '../../../utils/userUtils';
import { getStatusBadge, determineTaskStatus } from '../../../utils/statusUtils';
import type { Allocation, DetailedTask } from '../../../types/allocation';
import GlassCard from '../../../components/common/GlassCard';
import PremiumTable, { ColumnDef } from '../../../components/common/PremiumTable';

type TimeUnit = 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second';

interface TimeStat {
    time_point: string;
    assigned: number;
    completed: number;
    in_progress: number;
}

interface TimelineEvent {
    id: string;
    station_name?: string;
    inverter_name?: string;
    status: string;
    note: string;
    updated_at: string;
    submitted_at?: string;
    assign?: {
        user?: { full_name: string };
        project?: { project_name: string };
        classification?: { name: string };
    };
    child_category?: {
        name: string;
        main_category?: { name: string };
    };
}

const StatisticsPage = () => {
    // UI State
    const [timeUnit, setTimeUnit] = useState<TimeUnit>('day');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(true);
    // const [error, setError] = useState<string | null>(null);

    // Data State
    const [statsData, setStatsData] = useState<TimeStat[]>([]);
    const [timelineData, setTimelineData] = useState<TimelineEvent[]>([]);
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>('');

    // Real-time Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch Dashboard Data
    const fetchDashboardData = useCallback(async () => {
        const userId = getUserId();
        if (!userId) return;

        try {
            const params: any = { unit: timeUnit, user_id: userId };
            if (selectedProject) params.project_id = selectedProject;

            const [statsRes, timelineRes] = await Promise.all([
                api.get('/manager/stats/detailed', { params }),
                api.get('/manager/stats/timeline', { params: { ...params, limit: 50 } })
            ]);

            setStatsData(statsRes.data || []);
            setTimelineData(timelineRes.data || []);
        } catch (err) {
            console.error("Dashboard Fetch Error", err);
        }
    }, [timeUnit, selectedProject]);

    // Fetch Table Data
    const fetchTableData = useCallback(async () => {
        const userId = getUserId();
        if (!userId) return;

        try {
            const projRes = await api.get('/projects');
            const allProjects = projRes.data || [];

            const allocRes = await api.get(`/allocations/user/${userId}`);
            const projectsMap = new Map();
            allProjects.forEach((p: any) => projectsMap.set(p.project_id, p));
            const myProjectIds = new Set<string>();

            const mappedAllocations = (allocRes.data || []).map((alloc: any) => {
                let project = alloc.project;
                if (!project && alloc.id_project) {
                    const foundProject = projectsMap.get(alloc.id_project);
                    if (foundProject) project = { ...foundProject };
                }
                if (project?.project_id) myProjectIds.add(project.project_id);
                else if (alloc.id_project) myProjectIds.add(alloc.id_project);
                return { ...alloc, project };
            });

            setProjects(allProjects.filter((p: any) => myProjectIds.has(p.project_id)));
            setAllocations(mappedAllocations);
        } catch (err) {
            console.error("Table Data Error", err);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([fetchDashboardData(), fetchTableData()]);
            setLoading(false);
        };
        init();
    }, []);

    useEffect(() => {
        const intervalMs = timeUnit === 'second' ? 1000 : 30000;
        const timer = setInterval(fetchDashboardData, intervalMs);
        return () => clearInterval(timer);
    }, [fetchDashboardData, timeUnit]);

    // Derived Metrics
    const totalStats = useMemo(() => {
        const totalAssigned = statsData.reduce((acc, curr) => acc + curr.assigned, 0);
        const totalCompleted = statsData.reduce((acc, curr) => acc + curr.completed, 0);
        return { totalAssigned, totalCompleted };
    }, [statsData]);

    const pieData = useMemo(() => [
        { name: 'Hoàn thành', value: totalStats.totalCompleted, color: '#10b981' }, // Emerald-500
        { name: 'Đang làm', value: totalStats.totalAssigned - totalStats.totalCompleted, color: '#f59e0b' } // Amber-500
    ], [totalStats]);

    const completionRate = useMemo(() => {
        if (totalStats.totalAssigned === 0) return 0;
        return ((totalStats.totalCompleted / totalStats.totalAssigned) * 100).toFixed(1);
    }, [totalStats]);

    // Table Columns
    const tableColumns: ColumnDef<DetailedTask>[] = useMemo(() => [
        { header: 'Dự án', accessor: 'projectName', cell: (val: any) => <span className="font-bold text-slate-700">{val}</span> },
        { header: 'Hạng mục', accessor: 'categoryName', cell: (val: any) => <span className="font-medium text-slate-600">{val}</span> },
        { header: 'Công việc', accessor: 'itemName', cell: (val: any) => <span className="text-slate-600">{val}</span> },
        { header: 'Vị trí', accessor: 'stationName', cell: (val: any, row: any) => <span className="font-mono text-xs text-slate-500">{val || row.inverterName || '-'}</span> },
        {
            header: 'Trạng thái',
            accessor: 'status',
            cell: (val: any) => {
                const badge = getStatusBadge(val || 'pending');
                return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.color}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {badge.label}
                    </span>
                );
            }
        },
        { header: 'Nộp lúc', accessor: 'dateSubmitted', cell: (val: any) => <span className="text-xs text-slate-500">{val}</span> },
        { header: 'Ghi chú', accessor: 'note', cell: (val: any) => <span className="italic text-xs text-slate-400 truncate max-w-[150px] inline-block" title={val}>{val || '-'}</span> }
    ], []);

    const tableData = useMemo(() => {
        const rows: DetailedTask[] = [];
        allocations.forEach(alloc => {
            if (selectedProject && alloc.id_project !== selectedProject) return;
            const mainCats = alloc.data_work?.main_categories || [];

            const detailsMap = new Map<string, any[]>();
            alloc.task_details?.forEach((td: any) => {
                const list = detailsMap.get(td.child_category_id) || [];
                list.push(td);
                detailsMap.set(td.child_category_id, list);
            });

            mainCats.forEach(mc => {
                (mc.child_categories || []).forEach(cc => {
                    const currentDetails = detailsMap.get(cc.id) || [];
                    if (currentDetails.length > 0) {
                        currentDetails.forEach(d => {
                            rows.push({
                                id: d.id || `${alloc.id}-${cc.id}-${d.station_name || 'stat'}-${d.inverter_name || 'inv'}`,
                                projectName: alloc.project?.project_name || 'N/A',
                                classificationName: alloc.classification?.name || 'N/A',
                                categoryName: mc.name,
                                itemName: cc.name,
                                status: determineTaskStatus(d),
                                note: d.note,
                                stationName: d.station_name,
                                inverterName: d.inverter_name,
                                dateSubmitted: d.submitted_at ? new Date(d.submitted_at).toLocaleString('vi-VN') : '-',
                                dateReviewed: d.accept === -1 && d.rejected_at ? new Date(d.rejected_at).toLocaleString('vi-VN') : (d.check === 7 && d.approval_at ? new Date(d.approval_at).toLocaleString('vi-VN') : '-'),
                            });
                        });
                    } else {
                        // Pending items fallback
                        const qty = Number(cc.quantity || 1);
                        for (let i = 0; i < qty; i++) {
                            rows.push({
                                id: `${alloc.id}-${cc.id}-pending-${i}`,
                                projectName: alloc.project?.project_name || 'N/A',
                                classificationName: alloc.classification?.name || 'N/A',
                                categoryName: mc.name,
                                itemName: cc.name,
                                status: 'pending',
                                note: '',
                                dateSubmitted: '-',
                                dateReviewed: '-',
                            });
                        }
                    }
                });
            });
        });
        return rows;
    }, [allocations, selectedProject]);

    // Chart Data
    const getChartData = useCallback(() => {
        let limit = 30;
        switch (timeUnit) {
            case 'year': limit = 5; break;
            case 'quarter': limit = 8; break;
            case 'month': limit = 12; break;
            case 'week': limit = 12; break;
            case 'day': limit = 30; break;
            case 'hour': limit = 24; break;
            default: limit = 60;
        }
        return statsData.slice(0, limit).reverse();
    }, [statsData, timeUnit]);

    if (loading && statsData.length === 0) {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <GlassCard className="flex flex-col lg:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-indigo-600" />
                        Thống kê hiệu suất
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Theo dõi tiến độ thực và năng suất làm việc</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="bg-slate-900/5 backdrop-blur-sm px-4 py-2 rounded-xl flex items-center gap-2 border border-slate-200/50">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <span className="font-mono font-bold text-slate-700">{currentTime.toLocaleTimeString('vi-VN')}</span>
                    </div>
                    <select
                        className="px-4 py-2 bg-white/50 border border-white/40 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                    >
                        <option value="">Tất cả Dự án</option>
                        {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                    </select>
                </div>
            </GlassCard>

            {/* Time Unit Selector */}
            <div className="flex overflow-x-auto pb-2 gap-2 custom-scrollbar no-scrollbar">
                {(['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second'] as TimeUnit[]).map(unit => (
                    <button
                        key={unit}
                        onClick={() => setTimeUnit(unit)}
                        className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border
                            ${timeUnit === unit
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-200 scale-105'
                                : 'bg-white/40 text-slate-500 border-white/20 hover:bg-white hover:text-indigo-600'
                            }`}
                    >
                        {unit}
                    </button>
                ))}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Target className="w-16 h-16 text-indigo-600" /></div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Đã giao</p>
                    <h3 className="text-3xl font-black text-slate-800 mt-1">{totalStats.totalAssigned}</h3>
                    <div className="mt-2 text-xs text-emerald-600 font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +100% target</div>
                </GlassCard>

                <GlassCard className="relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle2 className="w-16 h-16 text-emerald-600" /></div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Hoàn thành</p>
                    <h3 className="text-3xl font-black text-slate-800 mt-1">{totalStats.totalCompleted}</h3>
                    <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${completionRate}%` }}></div>
                    </div>
                </GlassCard>

                <GlassCard className="relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Timer className="w-16 h-16 text-amber-500" /></div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Đang thực hiện</p>
                    <h3 className="text-3xl font-black text-slate-800 mt-1">{statsData.reduce((acc, c) => acc + c.in_progress, 0)}</h3>
                </GlassCard>

                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl shadow-xl shadow-indigo-200 text-white flex flex-col justify-center items-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity"></div>
                    <Sparkles className="w-6 h-6 absolute top-4 right-4 text-yellow-300 animate-pulse" />
                    <span className="text-5xl font-black tracking-tighter">{completionRate}%</span>
                    <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-2">Tổng hiệu suất</span>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <GlassCard className="lg:col-span-2 min-h-[400px]">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-6">
                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                        Biểu đồ tiến độ
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getChartData()} barSize={24}>
                                <defs>
                                    <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.6} />
                                    </linearGradient>
                                    <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.6} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                                <XAxis dataKey="time_point" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={12} />
                                <YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Bar dataKey="completed" name="Hoàn thành" stackId="a" fill="url(#gradSuccess)" radius={[0, 0, 4, 4]} animationDuration={1000} />
                                <Bar dataKey="in_progress" name="Đang làm" stackId="a" fill="url(#gradPending)" radius={[4, 4, 0, 0]} animationDuration={1000} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                <GlassCard className="min-h-[400px] flex flex-col justify-center items-center relative">
                    <h3 className="absolute top-6 left-6 font-bold text-slate-800 text-lg">Tỷ lệ trạng thái</h3>
                    <div className="w-[200px] h-[200px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    cornerRadius={10}
                                >
                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-black text-slate-800">{completionRate}%</span>
                            <span className="text-[10px] uppercase font-bold text-slate-400">Done</span>
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Bottom: Timeline & Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <GlassCard className="h-[600px] flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <History className="w-5 h-5 text-purple-600" />
                        Hoạt động gần đây
                        <span className="ml-auto bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md text-xs font-bold">{timelineData.length}</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                        {timelineData.map((event) => (
                            <div key={event.id} className="flex gap-4 relative">
                                <div className="absolute left-[7px] top-8 bottom-[-20px] w-[2px] bg-slate-100 last:hidden"></div>
                                <div className="w-3.5 h-3.5 rounded-full bg-white border-4 border-indigo-500 shadow-sm shrink-0 z-10 mt-1"></div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">
                                        {new Date(event.submitted_at || event.updated_at).toLocaleString('vi-VN')}
                                    </span>
                                    <p className="text-sm font-bold text-slate-800">{event.assign?.project?.project_name}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        <span className="text-slate-400">{event.child_category?.main_category?.name}</span> / <span className="text-indigo-600 font-medium">{event.child_category?.name}</span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>

                <div className="lg:col-span-2">
                    <GlassCard className="h-[600px] flex flex-col !p-0 overflow-hidden">
                        <div className="p-6 pb-2">
                            <h3 className="font-bold text-slate-800 text-lg">Chi tiết bảng công việc</h3>
                        </div>
                        <div className="flex-1 overflow-hidden p-4">
                            <PremiumTable
                                columns={tableColumns}
                                data={tableData}
                                isLoading={loading}
                                keyField="id"
                            />
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
};

export default StatisticsPage;
