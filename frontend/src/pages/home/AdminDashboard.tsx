import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../services/api';
import {
    Briefcase, Users, CheckCircle2, TrendingUp, FileText, FolderPlus,
    History, BarChart3, ArrowRight, Activity, ChevronRight, Zap, LayoutGrid
} from 'lucide-react';
import GlassCard from '../../components/common/GlassCard';
import PremiumButton from '../../components/common/PremiumButton';

// ==================== INTERFACES ====================
interface DashboardStats {
    totalProjects: number;
    activeAssignments: number;
    completedTasks: number;
    totalUsers: number;
    totalTasks: number;
}
interface RecentActivity {
    id: string;
    project_name: string;
    user_name: string;
    action: string;
    timestamp: string;
}

const formatRelativeDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats>({
        totalProjects: 0, activeAssignments: 0, completedTasks: 0, totalUsers: 0, totalTasks: 0
    });
    const [loading, setLoading] = useState(true);
    const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

    const fetchDashboardData = useCallback(async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            // Fetch ALL data for Admin view
            const [proj, assign, comp, users] = await Promise.all([
                api.get('/projects'),
                api.get('/allocations'),
                api.get('/manager/completed-tasks'), // Assuming this returns global completed tasks or we might need an admin endpoint
                api.get('/users')
            ]);

            const allAssignments = assign.data || [];
            const allUsers = users.data || [];

            // Collect ALL task details from ALL assignments
            const allTaskDetails: any[] = [];
            allAssignments.forEach((a: any) => {
                if (a.task_details && Array.isArray(a.task_details)) {
                    allTaskDetails.push(...a.task_details);
                }
            });

            // Count System-Wide Approved/Completed Tasks
            const approvedCount = allTaskDetails.filter((t: any) =>
                t.status_approve === 1
            ).length;

            setStats({
                totalProjects: proj.data?.length || 0,
                activeAssignments: allAssignments.length,
                completedTasks: approvedCount,
                totalUsers: allUsers.length,
                totalTasks: allTaskDetails.length
            });

            // For Admin, we might show recent completions globally
            // If the endpoint is restricted, this might need an update
            setRecentActivities((comp.data || []).slice(0, 5).map((t: any) => ({
                id: t.id, project_name: t.project_name, user_name: t.user_name, action: 'Hoàn thành công việc', timestamp: t.completed_at
            })));

        } catch (err) { console.error("Failed to fetch admin dashboard data", err); }
        finally { if (!isBackground) setLoading(false); }
    }, []);

    useEffect(() => {
        fetchDashboardData(false);

        const interval = setInterval(() => {
            fetchDashboardData(true);
        }, 60000);

        return () => clearInterval(interval);
    }, [fetchDashboardData]);

    const completionRate = useMemo(() => {
        const total = stats.completedTasks + stats.activeAssignments; // Approximation of total workflow volume
        // Or strictly: completed / (completed + pending + in_progress)
        // Using same logic as Manager for consistency:
        const denominator = stats.totalTasks || 1;
        return stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;
    }, [stats]);

    const teamPerformance = useMemo(() => stats.totalTasks > 0 ? (stats.completedTasks / stats.totalUsers).toFixed(2) : '0', [stats]);

    if (loading) return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 font-medium animate-pulse">Đang tải dữ liệu tổng quan...</p>
            </div>
        </div>
    );

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-10">
            {/* Header */}
            <div className="relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl shadow-indigo-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-violet-800 to-purple-800 opacity-95"></div>
                <div className="absolute top-0 right-0 p-4 opacity-10"><Activity className="w-64 h-64" /></div>
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner border border-white/30"><Briefcase className="w-10 h-10 text-white" /></div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Admin Dashboard</h1>
                            <p className="text-indigo-100 font-medium text-lg opacity-90">Tổng quan hệ thống & Hiệu suất toàn cục</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { title: 'Tổng dự án', value: stats.totalProjects, icon: Briefcase, gradient: 'from-blue-600 to-indigo-700', shadow: 'shadow-blue-200', text: 'text-blue-700' },
                    { title: 'Tổng phân công', value: stats.activeAssignments, icon: Zap, gradient: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-200', text: 'text-amber-700' },
                    { title: 'Tổng hoàn thành', value: stats.completedTasks, icon: CheckCircle2, gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-200', text: 'text-emerald-700' },
                    { title: 'Tổng nhân sự', value: stats.totalUsers, icon: Users, gradient: 'from-purple-600 to-pink-700', shadow: 'shadow-purple-200', text: 'text-purple-700' }
                ].map((stat, idx) => (
                    <GlassCard key={idx} className="!p-6 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{stat.title}</p>
                                <p className={`text-4xl font-black ${stat.text} tracking-tight`}>{stat.value}</p>
                            </div>
                            <div className={`p-3 rounded-2xl bg-gradient-to-br ${stat.gradient} text-white shadow-lg ${stat.shadow}`}><stat.icon className="w-6 h-6" /></div>
                        </div>
                    </GlassCard>
                ))}
            </div>

            {/* Quick Actions (Admin Routes) */}
            <div>
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3"><TrendingUp className="w-6 h-6 text-indigo-600" /> Quản trị nhanh</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { title: 'Quản lý dự án & nhân sự', desc: 'Thiết lập dự án, nhân viên', icon: LayoutGrid, gradient: 'from-blue-600 to-indigo-600', path: '/admin/management' },
                        { title: 'Cấu hình Database', desc: 'Bảng, Concepts, Schema', icon: FolderPlus, gradient: 'from-violet-600 to-purple-600', path: '/admin/database' },
                        { title: 'Báo cáo hệ thống', desc: 'Thống kê chi tiết', icon: FileText, gradient: 'from-emerald-600 to-teal-600', path: '/admin/reports' },
                        { title: 'Hồ sơ Admin', desc: 'Thông tin tài khoản', icon: Users, gradient: 'from-slate-700 to-slate-900', path: '/admin/profile' }
                    ].map((action, index) => (
                        <button key={index} onClick={() => navigate(action.path)} className="group relative bg-white p-1 rounded-3xl transition-all duration-300 hover:-translate-y-1 text-left">
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100 rounded-3xl blur opacity-40 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative h-full bg-white/60 backdrop-blur-xl p-6 rounded-[22px] border border-white/60 shadow-glass group-hover:shadow-glass-strong flex flex-col">
                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${action.gradient} p-0.5 shadow-lg mb-5 group-hover:scale-110 transition-transform duration-300`}>
                                    <div className="w-full h-full bg-white/10 backdrop-blur-sm rounded-[14px] flex items-center justify-center"><action.icon className="w-7 h-7 text-white" /></div>
                                </div>
                                <h3 className="font-bold text-lg text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">{action.title}</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed">{action.desc}</p>
                                <div className="mt-auto pt-6 flex items-center gap-2 text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 group-hover:from-indigo-600 group-hover:to-purple-600 transition-all opacity-80 group-hover:opacity-100">
                                    Truy cập <ChevronRight className="w-4 h-4 text-indigo-500" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Activities & Progress */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <GlassCard className="flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3"><Activity className="w-6 h-6 text-indigo-600" /> Hoạt động hệ thống</h2>
                        {/* <PremiumButton variant="glass" size="sm" onClick={() => navigate('/admin/reports')} icon={<ArrowRight className="w-4 h-4" />}>Xem tất cả</PremiumButton> */}
                    </div>
                    <div className="space-y-4 flex-1">
                        {recentActivities.length > 0 ? recentActivities.map((act) => (
                            <div key={act.id} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group cursor-pointer">
                                <div className="hidden sm:block p-3 bg-indigo-100 rounded-xl group-hover:scale-110 transition-transform"><History className="w-5 h-5 text-indigo-600" /></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between">
                                        <p className="font-bold text-slate-800 truncate">{act.user_name}</p>
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{formatRelativeDate(act.timestamp)}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 mt-1">{act.action} <span className="text-slate-400">•</span> <span className="text-indigo-600 font-medium">{act.project_name}</span></p>
                                </div>
                            </div>
                        )) : <p className="text-center py-10 text-slate-400">Chưa có hoạt động nào được ghi nhận</p>}
                    </div>
                </GlassCard>

                <GlassCard className="flex flex-col">
                    <div className="mb-6"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-3"><BarChart3 className="w-6 h-6 text-indigo-600" /> Hiệu suất vận hành</h2></div>
                    <div className="space-y-8 p-4">
                        <div>
                            <div className="flex justify-between mb-3 font-bold"><span className="text-slate-700 uppercase text-sm">Tỷ lệ hoàn thành toàn hệ thống</span><span className="text-emerald-600 text-xl">{completionRate}%</span></div>
                            <div className="w-full bg-slate-100 rounded-full h-4 shadow-inner overflow-hidden"><div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-1000 shadow-lg shadow-emerald-200" style={{ width: `${completionRate}%` }} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                                <div className="flex items-center gap-2 mb-2 text-blue-800 font-bold text-xs uppercase"><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />Tổng nhiệm vụ</div>
                                <p className="text-3xl font-black text-blue-600">{stats.totalTasks}</p>
                            </div>
                            <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                                <div className="flex items-center gap-2 mb-2 text-emerald-800 font-bold text-xs uppercase"><div className="w-2 h-2 rounded-full bg-emerald-500" />Đã duyệt</div>
                                <p className="text-3xl font-black text-emerald-600">{stats.completedTasks}</p>
                            </div>
                        </div>
                        <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-6 rounded-2xl text-white shadow-xl shadow-slate-300 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp className="w-24 h-24" /></div>
                            <div className="relative z-10 flex justify-between items-center">
                                <div><p className="text-xs font-bold text-slate-300 uppercase mb-2">Hiệu suất trung bình</p><p className="text-3xl font-black">{teamPerformance}</p><p className="text-xs text-slate-400 mt-1 opacity-80">Công việc / Nhân sự</p></div>
                                <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl"><TrendingUp className="w-8 h-8 text-white" /></div>
                            </div>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </motion.div>
    );
};

export default AdminDashboard;
