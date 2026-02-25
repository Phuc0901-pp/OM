import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import {
    Wrench, Clock, CheckCircle2, XCircle, AlertCircle, TrendingUp,
    Calendar, MapPin, FileText, Award, Target, ArrowRight,
    BarChart3, Activity, Zap, Bell, ChevronRight, LogIn, LogOut, UserCheck, X,
    LayoutGrid
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import api from '../../services/api';
import { getUserId } from '../../utils/userUtils';
import { determineTaskStatus } from '../../utils/statusUtils';
import type { Allocation, TaskStats } from '../../types/allocation';
import CheckInModal, { CheckInPhotos } from '../../components/CheckInModal';
import GlassCard from '../../components/common/GlassCard';
import PremiumButton from '../../components/common/PremiumButton';
import { motion } from 'framer-motion';

// Helper to determine status based on new fields
const getTaskStatus = (td: any) => {
    if (!td) return 'pending';
    // Logic ưu tiên: Approved > Rejected > Submitted > In Progress > Pending
    if (td.status_approve === 1) return 'approved';
    if (td.status_reject === 1) return 'rejected';
    if (td.status_submit === 1) return 'submitted';
    if (td.status_work === 1) return 'in_progress';
    return 'pending';
};

const UserDashboard = () => {
    const navigate = useNavigate();
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<TaskStats>({
        total: 0,
        approved: 0,
        rejected: 0,
        submitted: 0,
        inProgress: 0,
        pending: 0
    });
    const [recentTasks, setRecentTasks] = useState<any[]>([]);
    const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<any>(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);

    // Get Device Location for Attendance
    const { location: deviceLocation } = useDeviceLocation({ immediate: true, enableHighAccuracy: true });

    const fetchTodayAttendance = useCallback(async () => {
        const userId = getUserId();
        if (!userId) return;
        try {
            const res = await api.get(`/attendance/today/${userId}`);
            setAttendance(res.data);
        } catch (error) {
            setAttendance(null);
        }
    }, []);

    const fetchData = useCallback(async (isBackground = false) => {
        const userId = getUserId();
        if (!userId) {
            setLoading(false);
            return;
        }

        if (!isBackground) setLoading(true);

        try {
            const [allocRes, projRes] = await Promise.all([
                api.get(`/allocations/user/${userId}`),
                api.get('/projects')
            ]);

            if (!Array.isArray(allocRes.data)) throw new Error("Invalid data format");

            const projectsMap = new Map();
            if (Array.isArray(projRes.data)) {
                projRes.data.forEach((p: any) => projectsMap.set(p.project_id, p));
            }

            const mappedAllocations: Allocation[] = allocRes.data.map((alloc: any) => {
                if (!alloc.project && alloc.id_project) {
                    const foundProject = projectsMap.get(alloc.id_project);
                    if (foundProject) {
                        return {
                            ...alloc,
                            project: {
                                project_name: foundProject.project_name,
                                location: foundProject.location
                            }
                        };
                    }
                }
                return alloc;
            });

            setAllocations(mappedAllocations);
            // Calculate stats logic inline or separate? Separating is cleaner but keeping inline for now to match structure
            // Moving calculateStats logic call here

            let total = 0, approved = 0, rejected = 0, submitted = 0, inProgress = 0, pending = 0;
            mappedAllocations.forEach(alloc => {
                const tasks = alloc.task_details || [];
                total += tasks.length;
                tasks.forEach(td => {
                    const status = getTaskStatus(td);
                    switch (status) {
                        case 'approved': approved++; break;
                        case 'rejected': rejected++; break;
                        case 'submitted': submitted++; break;
                        case 'in_progress': inProgress++; break;
                        default: pending++; break;
                    }
                });
            });
            setStats({ total, approved, rejected, submitted, inProgress, pending });

            // Extract Recent Tasks Logic
            const allTasks: any[] = [];
            mappedAllocations.forEach(alloc => {
                const tasks = alloc.task_details || [];
                tasks.forEach(td => {
                    allTasks.push({
                        id: td.id,
                        projectName: alloc.project?.project_name || 'N/A',
                        categoryName: td.child_category?.main_category?.name || 'N/A',
                        itemName: td.child_category?.name || 'N/A',
                        status: getTaskStatus(td),
                        timestamp: td.updated_at || alloc.data_work?.timestamp,
                        startTime: alloc.start_time,
                        endTime: alloc.end_time,
                        // Pass through specific timestamps for display
                        submitted_at: td.submitted_at,
                        approval_at: td.approval_at,
                        reject_at: td.reject_at
                    });
                });
            });
            allTasks.sort((a, b) => {
                const timeA = new Date(a.timestamp || 0).getTime();
                const timeB = new Date(b.timestamp || 0).getTime();
                return timeB - timeA;
            });
            setRecentTasks(allTasks.slice(0, 5));

            // Extract Upcoming Deadlines
            const deadlines = mappedAllocations
                .filter(alloc => alloc.data_work?.timestamp)
                .map(alloc => ({
                    id: alloc.id,
                    projectName: alloc.project?.project_name || 'N/A',
                    location: alloc.project?.location || 'N/A',
                    timestamp: alloc.data_work?.timestamp,
                    daysLeft: Math.ceil((new Date(alloc.data_work.timestamp).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                }))
                .sort((a, b) => a.daysLeft - b.daysLeft)
                .slice(0, 5);
            setUpcomingDeadlines(deadlines);

        } catch (error) {
            console.error("Error fetching data", error);
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(false);
        fetchTodayAttendance();

        // Auto-refresh every 60 seconds
        const intervalId = setInterval(() => {
            fetchData(true);
            fetchTodayAttendance();
        }, 60000);

        return () => clearInterval(intervalId);
    }, [fetchData, fetchTodayAttendance]);



    const handleCheckIn = () => setShowCheckInModal(true);

    const handleCheckInSubmit = async (photos: CheckInPhotos) => {
        const userId = getUserId();
        if (!userId) return;

        setAttendanceLoading(true);
        try {
            // Get active project ID from first allocation (or allow user to select in future)
            const activeProjectId = allocations.length > 0 ? allocations[0].id_project : undefined;

            const res = await api.post('/attendance/checkin-with-photos', {
                user_id: userId,
                project_id: activeProjectId || null,
                ...photos,
                address: deviceLocation?.address || '' // Send address
            });
            setAttendance(res.data);
            setShowCheckInModal(false);
            alert('Check-in thành công!');
        } catch (error) {
            console.error('Check-in error:', error);
            alert('Lỗi khi check-in. Vui lòng thử lại.');
        } finally {
            setAttendanceLoading(false);
        }
    };

    const handleRequestCheckout = () => {
        setShowCheckoutModal(true);
    };

    const handleCheckoutSubmit = async (photos: CheckInPhotos) => {
        const userId = getUserId();
        if (!userId) return;

        setAttendanceLoading(true);
        try {
            // Send request with photos and address
            const res = await api.post('/attendance/request-checkout', {
                user_id: userId,
                ...photos,
                address: deviceLocation?.address || '' // Send address
            });
            setAttendance(res.data);
            setShowCheckoutModal(false);
            alert('Yêu cầu check-out đã được gửi! Vui lòng đợi manager duyệt.');
        } catch (error: any) {
            console.error('Check-out error:', error);
            alert(error.response?.data?.error || 'Lỗi khi yêu cầu check-out.');
        } finally {
            setAttendanceLoading(false);
        }
    };

    const handleCheckOut = async () => {
        const userId = getUserId();
        if (!userId) return;

        setAttendanceLoading(true);
        try {
            const res = await api.post('/attendance/checkout', { user_id: userId });
            setAttendance(res.data);
            alert('Check-out thành công!');
        } catch (error) {
            alert('Lỗi khi check-out.');
        } finally {
            setAttendanceLoading(false);
        }
    };

    const chartData = useMemo(() => [
        { name: 'Đã duyệt', value: stats.approved, color: '#10b981' },
        { name: 'Từ chối', value: stats.rejected, color: '#ef4444' },
        { name: 'Đã nộp', value: stats.submitted, color: '#3b82f6' },
        { name: 'Đang làm', value: stats.inProgress, color: '#f59e0b' },
        { name: 'Chưa làm', value: stats.pending, color: '#6b7280' }
    ].filter(item => item.value > 0), [stats]);

    const weeklyData = useMemo(() => [
        { day: 'T2', completed: 5 },
        { day: 'T3', completed: 8 },
        { day: 'T4', completed: 12 },
        { day: 'T5', completed: 7 },
        { day: 'T6', completed: 10 },
        { day: 'T7', completed: 3 },
        { day: 'CN', completed: 0 }
    ], []);

    const completionRate = stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : '0';

    if (loading) {
        return (
            <div className="flex bg-slate-50 dark:bg-slate-950 items-center justify-center min-h-screen">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-purple-600 animate-spin"></div>
                    <Activity className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-purple-600 animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300"
        >
            {/* Header Section */}
            <div>
                <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2">Tổng quan</h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Chào mừng trở lại, {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            {/* Premium Header */}
            <div className="relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl shadow-emerald-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 opacity-90"></div>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Wrench className="w-64 h-64" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner border border-white/30">
                            <Wrench className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Không gian làm việc</h1>
                            <p className="text-emerald-100 font-medium text-lg opacity-90">Nhiệm vụ & Lịch trình của tôi</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 shadow-lg">
                        <div className="flex items-center gap-2">
                            <Target className="w-6 h-6 text-emerald-200" />
                            <span className="text-3xl font-black">{completionRate}%</span>
                        </div>
                        <p className="text-sm text-emerald-100 font-medium opacity-80">Hoàn thành</p>
                    </div>
                </div>
            </div>





            {/* Quick Actions */}
            <GlassCard className="relative overflow-hidden shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-900/10 dark:bg-slate-900/60 dark:border-slate-800">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-400/10 to-purple-600/10 dark:from-indigo-400/5 dark:to-purple-600/5 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><LayoutGrid className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Thao tác nhanh</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <button onClick={() => navigate('/user/environment')} className="group relative overflow-hidden p-1 rounded-2xl transition-all duration-300 hover:-translate-y-1 text-left">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl transition-all"></div>
                            <div className="relative h-full bg-white/10 backdrop-blur-sm p-6 flex flex-col items-start text-white">
                                <Wrench className="w-8 h-8 mb-4 p-1.5 bg-white/20 rounded-lg" />
                                <h3 className="font-bold text-lg mb-1">Bắt đầu làm việc</h3>
                                <p className="text-sm opacity-90">Xem danh sách và thực hiện</p>
                                <ArrowRight className="absolute bottom-6 right-6 w-5 h-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </div>
                        </button>
                        <button onClick={() => navigate('/user/statistics')} className="group relative overflow-hidden p-1 rounded-2xl transition-all duration-300 hover:-translate-y-1 text-left">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl transition-all"></div>
                            <div className="relative h-full bg-white/10 backdrop-blur-sm p-6 flex flex-col items-start text-white">
                                <BarChart3 className="w-8 h-8 mb-4 p-1.5 bg-white/20 rounded-lg" />
                                <h3 className="font-bold text-lg mb-1">Xem thống kê</h3>
                                <p className="text-sm opacity-90">Báo cáo hiệu suất</p>
                                <ArrowRight className="absolute bottom-6 right-6 w-5 h-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </div>
                        </button>
                        <button onClick={() => navigate('/user/settings')} className="group relative overflow-hidden p-1 rounded-2xl transition-all duration-300 hover:-translate-y-1 text-left">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl transition-all"></div>
                            <div className="relative h-full bg-white/10 backdrop-blur-sm p-6 flex flex-col items-start text-white">
                                <AlertCircle className="w-8 h-8 mb-4 p-1.5 bg-white/20 rounded-lg" />
                                <h3 className="font-bold text-lg mb-1">Cài đặt</h3>
                                <p className="text-sm opacity-90">Quản lý tài khoản</p>
                                <ArrowRight className="absolute bottom-6 right-6 w-5 h-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </div>
                        </button>
                    </div>
                </div>
            </GlassCard>

            {/* Charts & Recent Tasks */}
            {/* Recent Tasks */}
            <div className="grid grid-cols-1 gap-6">
                <GlassCard className="flex flex-col gap-4 dark:bg-slate-900/60 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg"><FileText className="w-5 h-5 text-white" /></div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Công việc gần đây</h2>
                        </div>
                        <PremiumButton variant="ghost" size="sm" onClick={() => navigate('/user/environment')} icon={<ChevronRight className="w-4 h-4" />}>Xem tất cả</PremiumButton>
                    </div>
                    <div className="space-y-3">
                        {recentTasks.length > 0 ? recentTasks.map((task, idx) => (
                            <div key={idx} className="group p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-transparent dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-500/30 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all duration-300 cursor-pointer" onClick={() => navigate('/user/environment')}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h3 className="font-bold text-slate-800 dark:text-white truncate">{task.projectName}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">{task.categoryName} - {task.itemName}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${task.status === 'approved' ? 'bg-green-100 text-green-700' : task.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>
                                            {task.status}
                                        </span>
                                        {/* Status Timestamp */}
                                        <span className="text-[10px] font-mono text-slate-400">
                                            {(() => {
                                                const d = (task as any); // Type assertion if needed
                                                let time = '';
                                                if (task.status === 'submitted' && d.submitted_at) time = d.submitted_at;
                                                else if (task.status === 'approved' && d.approval_at) time = d.approval_at;
                                                else if (task.status === 'rejected' && d.reject_at) time = d.reject_at;

                                                return time ? new Date(time).toLocaleDateString('vi-VN') : '';
                                            })()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-medium text-slate-400 pt-2 border-t border-slate-100">
                                    {task.startTime && <span>Bắt đầu: {new Date(task.startTime).toLocaleDateString()}</span>}
                                    {task.endTime && <span>Kết thúc: {new Date(task.endTime).toLocaleDateString()}</span>}
                                </div>
                            </div>
                        )) : <p className="text-center text-slate-400 py-10">Chưa có công việc nào</p>}
                    </div>
                </GlassCard>
            </div>



            <CheckInModal isOpen={showCheckInModal} onClose={() => setShowCheckInModal(false)} onSubmit={handleCheckInSubmit} loading={attendanceLoading} mode="checkin" />
            <CheckInModal isOpen={showCheckoutModal} onClose={() => setShowCheckoutModal(false)} onSubmit={handleCheckoutSubmit} loading={attendanceLoading} mode="checkout" />
        </motion.div>
    );
};

export default UserDashboard;
