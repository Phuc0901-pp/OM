import { useEffect, useState } from 'react';
import {
    ShieldCheck, Users, Briefcase, Activity,
    BarChart3, PieChart as PieIcon, LayoutGrid, TrendingUp
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import api from '../../services/api';
import GlassCard from '../../components/common/GlassCard';
import { motion } from 'framer-motion';

interface AdminStats {
    total_projects: number;
    total_users: number;
    total_teams: number;
    active_assigns: number;
    task_status_stats: { status: string; count: number }[];
    team_performance_stats: { user_id: string; full_name: string; role: string; tasks_done: number }[];
    category_stats: { category_name: string; task_count: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const AdminDashboard = () => {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/admin/stats');
                setStats(res.data);
            } catch (error) {
                console.error("Failed to fetch admin stats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">Đang tải dữ liệu thống kê...</p>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <GlassCard className="text-center p-8 !bg-red-50 !border-red-100">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Activity className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-red-700 mb-2">Không thể tải dữ liệu</h3>
                    <p className="text-red-600/80">Vui lòng thử lại sau hoặc liên hệ hỗ trợ.</p>
                </GlassCard>
            </div>
        );
    }

    // Process Pie Data for Recharts
    const pieData = stats.task_status_stats.map(item => ({
        name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
        value: item.count
    }));

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pb-10"
        >
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl shadow-indigo-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 opacity-90"></div>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ShieldCheck className="w-64 h-64" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner border border-white/30">
                            <ShieldCheck className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Bảng điều khiển quản trị</h1>
                            <p className="text-indigo-100 font-medium text-lg opacity-90">Tổng quan hệ thống & Hiệu suất vận hành</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Tổng Dự Án"
                    value={stats.total_projects}
                    icon={<Briefcase className="w-6 h-6" />}
                    gradient="from-blue-500 to-cyan-500"
                    shadow="shadow-blue-200"
                />
                <StatCard
                    title="Nhân Sự"
                    value={stats.total_users}
                    icon={<Users className="w-6 h-6" />}
                    gradient="from-emerald-500 to-teal-500"
                    shadow="shadow-emerald-200"
                />
                <StatCard
                    title="Nhiệm Vụ Đang Chạy"
                    value={stats.active_assigns}
                    icon={<Activity className="w-6 h-6" />}
                    gradient="from-amber-400 to-orange-500"
                    shadow="shadow-amber-200"
                />
                <StatCard
                    title="Tổng Đội Nhóm"
                    value={stats.total_teams}
                    icon={<LayoutGrid className="w-6 h-6" />}
                    gradient="from-purple-500 to-pink-500"
                    shadow="shadow-purple-200"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Task Status Distribution (Pie) */}
                <GlassCard className="flex flex-col">
                    <div className="flex items-center gap-3 mb-6 px-2">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <PieIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">Trạng Thái Công Việc</h3>
                    </div>
                    <div className="flex-1 w-full min-h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={2} stroke="#fff" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                {/* 2. Team Performance (Bar) */}
                <GlassCard className="flex flex-col">
                    <div className="flex items-center gap-3 mb-6 px-2">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">Top Hiệu Suất Nhân Sự</h3>
                    </div>
                    <div className="flex-1 w-full min-h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.team_performance_stats} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis dataKey="full_name" type="category" width={100} style={{ fontSize: '12px' }} stroke="#64748b" tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9', radius: 4 }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="tasks_done" name="Công việc hoàn thành" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                {/* 3. Category Distribution (Bar) - Full Width */}
                <GlassCard className="flex flex-col lg:col-span-2">
                    <div className="flex items-center gap-3 mb-6 px-2">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">Phân Bố Công Việc Theo Hạng Mục</h3>
                    </div>
                    <div className="flex-1 w-full min-h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.category_stats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="category_name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9', radius: 4 }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="task_count" name="Số lượng nhiệm vụ" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>
            </div>
        </motion.div>
    );
};

const StatCard = ({ title, value, icon, gradient, shadow }: { title: string, value: number, icon: React.ReactNode, gradient: string, shadow: string }) => (
    <GlassCard className="!p-6 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} opacity-10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
        <div className="flex items-start justify-between relative z-10">
            <div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {title}
                </p>
                <p className={`text-4xl font-black text-slate-800 tracking-tight group-hover:bg-clip-text group-hover:text-transparent group-hover:bg-gradient-to-br group-hover:${gradient} transition-all`}>
                    {value}
                </p>
            </div>
            <div className={`p-3 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg ${shadow} group-hover:shadow-xl transition-all`}>
                {icon}
            </div>
        </div>
    </GlassCard>
);

export default AdminDashboard;
