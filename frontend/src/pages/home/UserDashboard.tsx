import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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

    useEffect(() => {
        const fetchData = async () => {
            const userId = getUserId();
            if (!userId) {
                setLoading(false);
                return;
            }

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

                console.log("Full Allocations Response:", allocRes.data);
                if (allocRes.data.length > 0 && allocRes.data[0].task_details) {
                    console.log("Sample Task Detail:", allocRes.data[0].task_details[0]);
                }

                setAllocations(mappedAllocations);
                calculateStats(mappedAllocations);
                extractRecentTasks(mappedAllocations);
                extractUpcomingDeadlines(mappedAllocations);
            } catch (error) {
                console.error("Error fetching data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        fetchTodayAttendance();
    }, []);

    const calculateStats = (allocations: Allocation[]) => {
        let total = 0, approved = 0, rejected = 0, submitted = 0, inProgress = 0, pending = 0;

        allocations.forEach(alloc => {
            // New logic: Iterate directly over task_details (data_work is legacy/deprecated)
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

        console.log("Calculated Stats:", { total, approved, rejected, submitted, inProgress, pending });
        setStats({ total, approved, rejected, submitted, inProgress, pending });
    };

    const extractRecentTasks = (allocations: Allocation[]) => {
        const allTasks: any[] = [];

        allocations.forEach(alloc => {
            const tasks = alloc.task_details || [];
            tasks.forEach(td => {
                allTasks.push({
                    id: td.id, // Use task detail ID
                    projectName: alloc.project?.project_name || 'N/A',
                    categoryName: td.child_category?.main_category?.name || 'N/A',
                    itemName: td.child_category?.name || 'N/A',
                    status: getTaskStatus(td),
                    timestamp: td.updated_at || alloc.data_work?.timestamp, // Fallback to alloc timestamp if needed
                    startTime: alloc.start_time,
                    endTime: alloc.end_time
                });
            });
        });

        // Sort by timestamp desc (most recent first)
        allTasks.sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeB - timeA;
        });

        setRecentTasks(allTasks.slice(0, 5));
    };

    const extractUpcomingDeadlines = (allocations: Allocation[]) => {
        const deadlines = allocations
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
    };

    const fetchTodayAttendance = async () => {
        const userId = getUserId();
        if (!userId) return;
        try {
            const res = await api.get(`/attendance/today/${userId}`);
            setAttendance(res.data);
        } catch (error) {
            setAttendance(null);
        }
    };

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
                ...photos
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

    const handleRequestCheckout = async () => {
        const userId = getUserId();
        if (!userId) return;

        setAttendanceLoading(true);
        try {
            const res = await api.post('/attendance/request-checkout', { user_id: userId });
            setAttendance(res.data);
            alert('Yêu cầu check-out đã được gửi! Vui lòng đợi manager duyệt.');
        } catch (error: any) {
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
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pb-10"
        >
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

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { icon: BarChart3, value: stats.total, label: 'Tổng số', gradient: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-200' },
                    { icon: CheckCircle2, value: stats.approved, label: 'Đã duyệt', gradient: 'from-emerald-500 to-green-600', shadow: 'shadow-emerald-200' },
                    { icon: XCircle, value: stats.rejected, label: 'Từ chối', gradient: 'from-red-500 to-rose-600', shadow: 'shadow-red-200' },
                    { icon: Award, value: stats.submitted, label: 'Đã nộp', gradient: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-200' },
                    { icon: TrendingUp, value: stats.inProgress, label: 'Đang làm', gradient: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200' },
                    { icon: Clock, value: stats.pending, label: 'Chưa làm', gradient: 'from-slate-500 to-gray-600', shadow: 'shadow-slate-200' }
                ].map((stat, idx) => (
                    <GlassCard
                        key={idx}
                        className="group relative overflow-hidden !p-5 hover:-translate-y-1 transition-all duration-300 hover:shadow-lg cursor-pointer"
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
                        <div className="relative z-10">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                                <stat.icon className="w-6 h-6 text-white" />
                            </div>
                            <p className="text-3xl font-black text-slate-800 mb-1">{stat.value}</p>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{stat.label}</p>
                        </div>
                    </GlassCard>
                ))}
            </div>

            {/* Attendance Card */}
            <GlassCard className="relative overflow-hidden shadow-2xl shadow-green-900/5 !border-green-100/50">
                <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-green-400/10 to-emerald-600/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8 border-b border-green-100 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-200">
                                <UserCheck className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">Chấm công hôm nay</h2>
                                <p className="text-sm font-medium text-slate-500">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                        </div>
                        {attendance && attendance.site_status === 1 && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl font-bold border border-green-200 animate-pulse">
                                <div className="w-2 h-2 rounded-full bg-green-600"></div>
                                Đang ở site
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Check-in */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><LogIn className="w-5 h-5 text-green-600" /> Check-in</h3>
                                {attendance?.status_checkin === 1 && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                            </div>
                            {attendance?.date_checkin ? (
                                <div className="p-6 bg-green-50/50 rounded-2xl border border-green-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-green-600 uppercase mb-1">Thời gian check-in</p>
                                        <p className="text-2xl font-black text-green-700 tracking-tight">{new Date(attendance.date_checkin).toLocaleTimeString('vi-VN')}</p>
                                    </div>
                                    <div className="p-3 bg-green-100 rounded-xl"><Clock className="w-6 h-6 text-green-600" /></div>
                                </div>
                            ) : (
                                <PremiumButton onClick={handleCheckIn} disabled={attendanceLoading} className="w-full h-16 text-lg shadow-green-200 bg-gradient-to-r from-green-500 to-emerald-600 text-white border-none hover:shadow-lg" icon={<LogIn className="w-5 h-5" />}>
                                    {attendanceLoading ? 'Đang xử lý...' : 'Check-in ngay'}
                                </PremiumButton>
                            )}
                        </div>

                        {/* Check-out */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><LogOut className="w-5 h-5 text-orange-600" /> Check-out</h3>
                                {attendance?.status_checkout === 1 && <CheckCircle2 className="w-5 h-5 text-orange-600" />}
                            </div>

                            {/* Statuses */}
                            {attendance?.checkout_requested && !attendance?.checkout_approved && !attendance?.checkout_rejected && (
                                <div className="flex items-center gap-2 p-4 bg-amber-50 text-amber-700 rounded-xl font-bold border border-amber-200">
                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>Đang chờ duyệt
                                </div>
                            )}
                            {attendance?.checkout_rejected && (
                                <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-red-700">
                                    <div className="flex items-center gap-2 font-bold mb-1"><X className="w-4 h-4" /> Yêu cầu bị từ chối</div>
                                    <p className="text-sm font-medium opacity-90">{attendance.checkout_reject_reason}</p>
                                </div>
                            )}

                            {attendance?.date_checkout ? (
                                <div className="p-6 bg-orange-50/50 rounded-2xl border border-orange-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-orange-600 uppercase mb-1">Thời gian check-out</p>
                                        <p className="text-2xl font-black text-orange-700 tracking-tight">{new Date(attendance.date_checkout).toLocaleTimeString('vi-VN')}</p>
                                    </div>
                                    <div className="p-3 bg-orange-100 rounded-xl"><Clock className="w-6 h-6 text-orange-600" /></div>
                                </div>
                            ) : attendance?.checkout_approved ? (
                                <PremiumButton onClick={handleCheckOut} disabled={attendanceLoading} className="w-full h-16 text-lg shadow-orange-200 bg-gradient-to-r from-orange-500 to-red-600 text-white border-none hover:shadow-lg" icon={<LogOut className="w-5 h-5" />}>
                                    {attendanceLoading ? 'Đang xử lý...' : 'Check-out ngay'}
                                </PremiumButton>
                            ) : attendance?.checkout_requested ? (
                                <button disabled className="w-full h-16 flex items-center justify-center gap-2 bg-slate-100 text-slate-400 rounded-xl font-bold cursor-not-allowed border border-slate-200">
                                    <Clock className="w-5 h-5" />Đang chờ duyệt...
                                </button>
                            ) : (
                                <PremiumButton onClick={handleRequestCheckout} disabled={attendanceLoading || !attendance?.status_checkin} className="w-full h-16 text-lg shadow-indigo-200 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none hover:shadow-lg" icon={<LogOut className="w-5 h-5" />}>
                                    {attendanceLoading ? 'Đang xử lý...' : attendance?.status_checkin ? 'Yêu cầu Check-out' : 'Chưa check-in'}
                                </PremiumButton>
                            )}
                        </div>
                    </div>
                </div>
            </GlassCard>

            {/* Quick Actions */}
            <GlassCard className="relative overflow-hidden shadow-2xl shadow-indigo-500/10">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-400/10 to-purple-600/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><LayoutGrid className="w-6 h-6 text-indigo-600" /> Thao tác nhanh</h2>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard className="flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg"><Activity className="w-5 h-5 text-white" /></div>
                        <h2 className="text-xl font-bold text-slate-800">Tiến độ công việc</h2>
                    </div>
                    {chartData.length > 0 ? (
                        <div className="flex-1 w-full min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={chartData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`} outerRadius={80} dataKey="value">
                                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={2} stroke="#fff" />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex-1 flex items-center justify-center text-slate-400 min-h-[250px]"><p className="font-medium">Chưa có dữ liệu</p></div>}
                </GlassCard>

                <GlassCard className="flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg"><Zap className="w-5 h-5 text-white" /></div>
                        <h2 className="text-xl font-bold text-slate-800">Hoạt động tuần này</h2>
                    </div>
                    <div className="flex-1 w-full min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="day" stroke="#64748b" tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: '#f1f5f9', radius: 4 }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="completed" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>
            </div>

            {/* Recent Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard className="flex flex-col gap-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg"><FileText className="w-5 h-5 text-white" /></div>
                            <h2 className="text-xl font-bold text-slate-800">Công việc gần đây</h2>
                        </div>
                        <PremiumButton variant="ghost" size="sm" onClick={() => navigate('/user/environment')} icon={<ChevronRight className="w-4 h-4" />}>Xem tất cả</PremiumButton>
                    </div>
                    <div className="space-y-3">
                        {recentTasks.length > 0 ? recentTasks.map((task, idx) => (
                            <div key={idx} className="group p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-purple-200 hover:bg-white hover:shadow-md transition-all duration-300 cursor-pointer" onClick={() => navigate('/user/environment')}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h3 className="font-bold text-slate-800 truncate">{task.projectName}</h3>
                                        <p className="text-sm text-slate-500 truncate mt-0.5">{task.categoryName} - {task.itemName}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${task.status === 'approved' ? 'bg-green-100 text-green-700' : task.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {task.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-medium text-slate-400 pt-2 border-t border-slate-100">
                                    {task.startTime && <span>Bắt đầu: {new Date(task.startTime).toLocaleDateString()}</span>}
                                    {task.endTime && <span>Kết thúc: {new Date(task.endTime).toLocaleDateString()}</span>}
                                </div>
                            </div>
                        )) : <p className="text-center text-slate-400 py-10">Chưa có công việc nào</p>}
                    </div>
                </GlassCard>

                {/* Deadlines */}
                <GlassCard className="flex flex-col gap-4">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg"><Bell className="w-5 h-5 text-white" /></div>
                        <h2 className="text-xl font-bold text-slate-800">Deadline sắp tới</h2>
                    </div>
                    <div className="space-y-3">
                        {upcomingDeadlines.length > 0 ? upcomingDeadlines.map((dl, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-orange-200 hover:bg-white transition-all">
                                <div className="flex justify-between mb-2">
                                    <h3 className="font-bold text-slate-800">{dl.projectName}</h3>
                                    <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full">{dl.daysLeft} ngày</span>
                                </div>
                                <p className="text-xs text-slate-500"><MapPin className="w-3 h-3 inline mr-1" /> {dl.location}</p>
                            </div>
                        )) : <p className="text-center text-slate-400 py-10">Không có deadline</p>}
                    </div>
                </GlassCard>
            </div>



            <CheckInModal isOpen={showCheckInModal} onClose={() => setShowCheckInModal(false)} onSubmit={handleCheckInSubmit} loading={attendanceLoading} />
        </motion.div>
    );
};

export default UserDashboard;
