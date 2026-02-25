import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import ReactDOM from 'react-dom';
import {
    Briefcase, Users, CheckCircle2, Clock, TrendingUp, FileText, FolderPlus,
    History, BarChart3, ArrowRight, Activity, ChevronRight, Zap, LayoutGrid, X, ZoomIn
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
    submittedTasks: number;
}
interface RecentActivity {
    id: string;
    project_name: string;
    user_name: string;
    action: string;
    timestamp: string;
}
interface PendingCheckout {
    id: string;
    user?: { full_name: string; email: string; team?: { name: string } };
    project?: { project_name: string };
    checkout_request_time: string;
    checkout_img_url?: string;
    address_checkout?: string;
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

const getManagerId = () => {
    try {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u).id : null;
    } catch { return null; }
};

const getFirstImage = (urlOrJson?: string): string | null => {
    if (!urlOrJson) return null;
    if (urlOrJson.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(urlOrJson);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
        } catch {
            return urlOrJson;
        }
    }
    return urlOrJson;
};

const ManagerDashboard = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const managerId = getManagerId();

    // ==================== QUERIES ====================
    const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => api.get('/projects').then(res => res.data) });
    const { data: allocations = [] } = useQuery({ queryKey: ['allocations'], queryFn: () => api.get('/allocations').then(res => res.data) });
    const { data: completedTasks = [] } = useQuery({ queryKey: ['completedTasks'], queryFn: () => api.get('/manager/completed-tasks').then(res => res.data) });
    const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(res => res.data) });

    // Pending Checkouts with Auto-refetch
    const { data: pendingCheckouts = [] } = useQuery({
        queryKey: ['pendingCheckouts'],
        queryFn: () => api.get('/attendance/pending-checkouts').then(res => res.data),
        refetchInterval: 60000 // 1 minute
    });

    const isLoading = !projects || !allocations || !completedTasks || !users;

    // ==================== MUTATIONS ====================
    const approveMutation = useMutation({
        mutationFn: (id: string) => api.post(`/attendance/approve-checkout/${id}`, { manager_id: managerId }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pendingCheckouts'] }),
        onError: () => alert("Lỗi khi duyệt.")
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string, reason: string }) => api.post(`/attendance/reject-checkout/${id}`, { manager_id: managerId, reason }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pendingCheckouts'] }),
        onError: () => alert("Lỗi khi từ chối.")
    });

    const handleApprove = (id: string) => {
        if (!managerId) return alert("Vui lòng đăng nhập lại.");
        approveMutation.mutate(id);
    };

    const handleReject = (id: string) => {
        const reason = prompt("Lý do từ chối:");
        if (!reason || !reason.trim()) return;
        if (!managerId) return alert("Vui lòng đăng nhập lại.");
        rejectMutation.mutate({ id, reason });
    };

    // ==================== DERIVED STATS ====================
    const stats: DashboardStats = useMemo(() => {
        if (!managerId) return { totalProjects: 0, activeAssignments: 0, completedTasks: 0, totalUsers: 0, totalTasks: 0, submittedTasks: 0 };

        // 1. Identify Managed Personnel (My Staff)
        const myStaff = users.filter((u: any) => u.leader_id === managerId);
        const myStaffIds = myStaff.map((u: any) => u.id);
        const myStaffCount = myStaff.length;

        // 2. Filter Assignments for My Staff
        const myStaffAssignments = allocations.filter((a: any) => myStaffIds.includes(a.id_user));

        // 3. Get Task Details from My Staff's Assignments
        const myStaffTaskDetails: any[] = [];
        myStaffAssignments.forEach((a: any) => {
            if (a.task_details && Array.isArray(a.task_details)) {
                myStaffTaskDetails.push(...a.task_details);
            }
        });

        // 4. Calculate Stats
        const approvedCount = myStaffTaskDetails.filter((t: any) => t.status_approve === 1).length;
        const submittedCount = myStaffTaskDetails.filter((t: any) => t.status_submit === 1).length;

        return {
            totalProjects: projects.length, // Projects is global? Or should filter? Assuming global is fine based on original code 'proj.data?.length'
            activeAssignments: myStaffAssignments.length,
            completedTasks: approvedCount,
            totalUsers: myStaffCount,
            totalTasks: myStaffTaskDetails.length,
            submittedTasks: submittedCount
        };
    }, [allocations, users, projects, managerId]);

    const recentActivities: RecentActivity[] = useMemo(() => {
        return completedTasks.slice(0, 5).map((t: any) => ({
            id: t.id, project_name: t.project_name, user_name: t.user_name, action: 'Hoàn thành công việc', timestamp: t.completed_at
        }));
    }, [completedTasks]);

    const completionRate = useMemo(() => {
        const total = stats.submittedTasks;
        return total > 0 ? Math.round((stats.completedTasks / total) * 100) : 0;
    }, [stats]);

    const teamPerformance = useMemo(() => stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks).toFixed(2) : '0', [stats]);


    if (isLoading && projects.length === 0 && users.length === 0) return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 font-medium animate-pulse">Đang tải dữ liệu...</p>
            </div>
        </div>
    );

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-10">
            {/* Header */}
            <div className="relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl shadow-indigo-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 opacity-90"></div>
                <div className="absolute top-0 right-0 p-4 opacity-10"><Activity className="w-64 h-64" /></div>
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner border border-white/30"><Briefcase className="w-10 h-10 text-white" /></div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Bảng điều khiển</h1>
                            <p className="text-indigo-100 font-medium text-lg opacity-90">Hiệu suất đội nhóm & Danh sách công việc</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { title: 'Tổng dự án', value: stats.totalProjects, icon: Briefcase, gradient: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-200', text: 'text-blue-600' },
                    { title: 'Phân công', value: stats.activeAssignments, icon: Zap, gradient: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200', text: 'text-amber-600' },
                    { title: 'Hoàn thành', value: stats.completedTasks, icon: CheckCircle2, gradient: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-200', text: 'text-emerald-600' },
                    { title: 'Tổng nhân sự', value: stats.totalUsers, icon: Users, gradient: 'from-purple-500 to-pink-600', shadow: 'shadow-purple-200', text: 'text-purple-600' }
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

            {/* Pending Checkouts */}
            {pendingCheckouts.length > 0 && (
                <GlassCard className="!p-0 border-orange-200/60 shadow-lg shadow-orange-100/50">
                    <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-white border-b border-orange-100 flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg"><Clock className="w-5 h-5 text-orange-600" /></div>
                        <h2 className="text-lg font-bold text-orange-900">Yêu cầu Checkout đang chờ ({pendingCheckouts.length})</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-orange-50/30">
                        {pendingCheckouts.map((req: PendingCheckout) => ( // Explicit type
                            <div key={req.id} className="p-5 bg-white/60 hover:bg-white rounded-2xl border border-orange-100 hover:border-orange-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between backdrop-blur-sm">
                                <div>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center font-bold text-white text-lg shadow-md shadow-orange-200">{(req.user?.full_name || 'U').charAt(0)}</div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-slate-800 truncate text-base">{req.user?.full_name}</p>
                                            <p className="text-xs text-slate-500 truncate font-medium">{req.user?.email}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 mb-5 px-3 py-3 bg-slate-50/50 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-indigo-500" /><span className="truncate">{req.user?.team?.name}</span></div>
                                        <div className="flex items-center gap-2 text-sm"><Briefcase className="w-4 h-4 text-orange-500" /><span className="truncate">{req.project?.project_name}</span></div>
                                        <div className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-slate-400" /><span>{formatRelativeDate(req.checkout_request_time)}</span></div>
                                    </div>

                                    {/* Checkout Image Preview */}
                                    {req.checkout_img_url && getFirstImage(req.checkout_img_url) && (
                                        <div className="mb-4 relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200" onClick={() => setSelectedImage(getFirstImage(req.checkout_img_url))}>
                                            <img src={getFirstImage(req.checkout_img_url) || ''} alt="Checkout" className="w-full h-32 object-cover transition-transform group-hover:scale-105" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <div className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white"><ZoomIn className="w-5 h-5" /></div>
                                                <span className="text-white font-medium text-sm">Xem ảnh</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <PremiumButton variant="danger" size="sm" onClick={() => handleReject(req.id)} className="flex-1 shadow-red-100 !bg-white !text-red-600 border border-red-100 hover:!bg-red-50">Từ chối</PremiumButton>
                                    <PremiumButton variant="success" size="sm" onClick={() => handleApprove(req.id)} className="flex-1 shadow-green-200">Duyệt</PremiumButton>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3"><TrendingUp className="w-6 h-6 text-indigo-600" /> Truy cập nhanh</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    {[
                        { title: 'Phân bổ công việc', desc: 'Tạo phân công mới', icon: FolderPlus, gradient: 'from-blue-500 to-indigo-600', path: '/manager/allocation' },
                        { title: 'Quản lý hệ thống', desc: 'Nhân sự, dự án', icon: LayoutGrid, gradient: 'from-violet-500 to-purple-600', path: '/manager/management' },
                        { title: 'Vận hành', desc: 'Quản lý công việc', icon: Activity, gradient: 'from-cyan-500 to-teal-500', path: '/manager/operations' },
                        { title: 'Báo cáo công việc', desc: 'Xem báo cáo chi tiết', icon: FileText, gradient: 'from-emerald-500 to-teal-600', path: '/manager/reports' },
                        { title: 'Lịch sử phân công', desc: 'Xem xác đã xóa', icon: History, gradient: 'from-amber-500 to-orange-600', path: '/manager/history' }
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
                                    Truy cập ngay <ChevronRight className="w-4 h-4 text-indigo-500" />
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
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3"><Activity className="w-6 h-6 text-indigo-600" /> Hoạt động gần đây</h2>
                        <PremiumButton variant="glass" size="sm" onClick={() => navigate('/manager/operations')} icon={<ArrowRight className="w-4 h-4" />}>Xem tất cả</PremiumButton>
                    </div>
                    <div className="space-y-4 flex-1">
                        {recentActivities.length > 0 ? recentActivities.map((act) => (
                            <div key={act.id} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group cursor-pointer">
                                <div className="p-3 bg-emerald-100 rounded-xl group-hover:scale-110 transition-transform"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between">
                                        <p className="font-bold text-slate-800 truncate">{act.user_name}</p>
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{formatRelativeDate(act.timestamp)}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 mt-1">{act.action} • <span className="text-indigo-600 font-medium">{act.project_name}</span></p>
                                </div>
                            </div>
                        )) : <p className="text-center py-10 text-slate-400">Chưa có hoạt động</p>}
                    </div>
                </GlassCard>

                <GlassCard className="flex flex-col">
                    <div className="mb-6"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-3"><BarChart3 className="w-6 h-6 text-indigo-600" /> Tổng quan tiến độ</h2></div>
                    <div className="space-y-8 p-4">
                        <div>
                            <div className="flex justify-between mb-3 font-bold"><span className="text-slate-700 uppercase text-sm">Tỷ lệ hoàn thành</span><span className="text-emerald-600 text-xl">{completionRate}%</span></div>
                            <div className="w-full bg-slate-100 rounded-full h-4 shadow-inner overflow-hidden"><div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-1000 shadow-lg shadow-emerald-200" style={{ width: `${completionRate}%` }} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100">
                                <div className="flex items-center gap-2 mb-2 text-indigo-800 font-bold text-xs uppercase"><div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />Đang thực hiện</div>
                                <p className="text-3xl font-black text-indigo-600">{stats.activeAssignments}</p>
                            </div>
                            <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                                <div className="flex items-center gap-2 mb-2 text-emerald-800 font-bold text-xs uppercase"><div className="w-2 h-2 rounded-full bg-emerald-500" />Hoàn thành</div>
                                <p className="text-3xl font-black text-emerald-600">{stats.completedTasks}</p>
                            </div>
                        </div>
                        <div className="bg-gradient-to-r from-violet-500 to-fuchsia-600 p-6 rounded-2xl text-white shadow-xl shadow-fuchsia-200 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp className="w-24 h-24" /></div>
                            <div className="relative z-10 flex justify-between items-center">
                                <div><p className="text-xs font-bold text-indigo-100 uppercase mb-2">Hiệu suất đội nhóm</p><p className="text-3xl font-black">{teamPerformance}</p><p className="text-xs text-indigo-100 mt-1 opacity-80">Công việc / Người</p></div>
                                <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl"><TrendingUp className="w-8 h-8 text-white" /></div>
                            </div>
                        </div>
                    </div>
                </GlassCard>
            </div>
            {/* Image Modal */}
            {selectedImage && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-red-600 rounded-full text-white/80 hover:text-white backdrop-blur-md transition-all shadow-2xl z-50 group border border-white/10"
                    >
                        <X className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Full Preview"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-zoom-in duration-300 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>,
                document.body
            )}
        </motion.div>
    );
};

export default ManagerDashboard;
