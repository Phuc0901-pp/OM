import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import {
    Wrench, Target, BarChart3, Activity, ChevronRight, LayoutGrid, Settings,
    Calendar, Clock, AlertTriangle, CheckCircle, FileText, ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import { getUserId } from '../../utils/userUtils';
import { determineDetailStatus } from '../../utils/statusUtils';
import type { TaskStats } from '../../types/allocation';
import type { Assign, DetailAssign } from '../../types/models';
import CheckInModal, { CheckInPhotos } from '../../components/CheckInModal';
import { motion } from 'framer-motion';
import bgImage from '../../../assets/Background2.jpg';


const UserDashboard = () => {
    const navigate = useNavigate();
    const [assigns, setAssigns] = useState<Assign[]>([]);
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
    const [projectTimeline, setProjectTimeline] = useState<{
        id: string;
        projectName: string;
        templateName: string;
        startTime: Date | null;
        endTime: Date | null;
        remainingMs: number | null; // negative = time remaining
    }[]>([]);
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
            const assignRes = await api.get(`/assigns`, { params: { user_id: userId } });
            if (!Array.isArray(assignRes.data)) throw new Error('Invalid data format');
            
            // Chỉ lấy các dự án chưa hoàn thành (status_assign != true) theo yêu cầu
            const assignsData = assignRes.data.filter((a: Assign) => a.status_assign !== true);
            
            setAssigns(assignsData);
            let total = 0, approved = 0, rejected = 0, submitted = 0, inProgress = 0, pending = 0;
            assignsData.forEach((assign: Assign) => {
                const details = assign.details || [];
                total += details.length;
                details.forEach((d: DetailAssign) => {
                    const status = determineDetailStatus(d);
                    switch (status) {
                        case 'approved': approved++; break;
                        case 'rejected': rejected++; break;
                        case 'submitted': submitted++; break;
                        default: pending++; break;
                    }
                });
            });
            setStats({ total, approved, rejected, submitted, inProgress: 0, pending });

            // Compute project timeline entries
            const now = Date.now();
            const timeline = assignsData.map((assign: Assign) => {
                const endTime = assign.end_time ? new Date(assign.end_time) : null;
                const startTime = assign.start_time ? new Date(assign.start_time) : null;
                // remainingMs: negative value means time is REMAINING (endTime is in future)
                const remainingMs = endTime ? now - endTime.getTime() : null;
                return {
                    id: assign.id,
                    projectName: assign.project?.name || 'Không tên dự án',
                    templateName: assign.template?.name || assign.model_project?.name || '',
                    startTime,
                    endTime,
                    remainingMs,
                };
            });
            // Sort: soonest deadline first (smallest absolute remaining, i.e. most negative or closest to 0)
            timeline.sort((a: any, b: any) => {
                if (a.remainingMs === null && b.remainingMs === null) return 0;
                if (a.remainingMs === null) return 1;
                if (b.remainingMs === null) return -1;
                return a.remainingMs - b.remainingMs;
            });
            setProjectTimeline(timeline);

            // Extract Recent Tasks from assigns
            const allTasks: any[] = [];
            assignsData.forEach((assign: Assign) => {
                const details = assign.details || [];
                details.forEach((d: DetailAssign) => {
                    allTasks.push({
                        id: d.id,
                        projectName: assign.project?.name || 'N/A',
                        categoryName: d.config?.asset?.name || d.config?.sub_work?.work?.asset?.name || 'N/A',
                        itemName: d.config?.sub_work?.name || d.config?.sub_work?.work?.name || 'N/A',
                        status: determineDetailStatus(d),
                        timestamp: d.updated_at,
                        submitted_at: d.submitted_at,

                        rejected_at: d.rejected_at,
                    });
                });
            });
            allTasks.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
            setRecentTasks(allTasks.slice(0, 5));
            setUpcomingDeadlines([]);

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
            // Get active assign and project from first allocation
            const activeAssign = assigns.length > 0 ? assigns[0] : undefined;
            const activeProjectId = activeAssign?.id_project;
            const activeAssignId = activeAssign?.id;

            const res = await api.post('/attendance/checkin-with-photos', {
                user_id: userId,
                project_id: activeProjectId || null,
                assign_id: activeAssignId || null, // Bind to first assignment
                ...photos,
                address: deviceLocation?.address || ''
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

    // Quick action config
    const quickActions = [
        {
            label: 'Bắt đầu làm việc',
            desc: 'Xem danh sách nhiệm vụ và thực hiện',
            tag: 'Môi trường',
            icon: Wrench,
            gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
            glow: 'shadow-emerald-500/40',
            bgDot: 'bg-emerald-400/20',
            iconBg: 'bg-white/15',
            route: '/user/environment',
        },
        {
            label: 'Xem thống kê',
            desc: 'Báo cáo hiệu suất và tiến độ',
            tag: 'Phân tích',
            icon: BarChart3,
            gradient: 'from-blue-500 via-indigo-500 to-violet-500',
            glow: 'shadow-blue-500/40',
            bgDot: 'bg-blue-400/20',
            iconBg: 'bg-white/15',
            route: '/user/statistics',
        },
        {
            label: 'Cài đặt',
            desc: 'Quản lý tài khoản và hệ thống',
            tag: 'Tài khoản',
            icon: Settings,
            gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
            glow: 'shadow-purple-500/40',
            bgDot: 'bg-purple-400/20',
            iconBg: 'bg-white/15',
            route: '/user/settings',
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300"
        >
            {/* Premium Header */}
            <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl dark:shadow-2xl border border-white/20 dark:border-white/5 transition-colors">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-400/20 to-teal-600/20 rounded-full blur-3xl -z-10"></div>
                <div className="relative z-10 flex flex-col gap-1">
                    <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                        Tổng quan
                    </h1>
                    <p className="text-gray-600 dark:text-slate-400 font-medium">Chào mừng trở lại <br />
                        <span className="font-bold">{new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </p>
                </div>
            </div>
            {/* Workspace Banner */}
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
                            <p className="text-emerald-100 font-medium text-lg opacity-90">Nhiệm vụ &amp; Lịch trình của tôi</p>
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

            {/* ==== PROJECT TIMELINE WIDGET – REDESIGNED ==== */}
            {projectTimeline.length > 0 && (() => {
                // ── Framer Motion Variants ──
                const containerVariants = {
                    hidden: {},
                    show: { transition: { staggerChildren: 0.08 } }
                };
                const cardVariants = {
                    hidden: { opacity: 0, y: 20, scale: 0.97 },
                    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 260, damping: 22 } }
                };

                return (
                    <div className="relative">
                        {/* ── Section header ── */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
                                    <Calendar className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">Dự án đang phụ trách</h2>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">Nhấn vào thẻ để vào môi trường làm việc</p>
                                </div>
                            </div>
                            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {projectTimeline.length} dự án
                            </span>
                        </div>

                        {/* ── Cards grid ── */}
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                        >
                            {projectTimeline.map((entry) => {
                                const isOverdue = entry.remainingMs !== null && entry.remainingMs > 0;
                                const hasDeadline = entry.endTime !== null;

                                // ── Status label ──
                                let remainingLabel = 'Chưa đặt hạn';
                                if (hasDeadline && entry.remainingMs !== null) {
                                    if (isOverdue) {
                                        const overDays = Math.floor(entry.remainingMs / (1000 * 60 * 60 * 24));
                                        remainingLabel = overDays > 0 ? `Quá hạn ${overDays} ngày` : 'Quá hạn hôm nay';
                                    } else {
                                        const leftMs = -entry.remainingMs;
                                        const days = Math.floor(leftMs / (1000 * 60 * 60 * 24));
                                        const hours = Math.floor((leftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                        if (days === 0) remainingLabel = hours > 0 ? `Còn ${hours} giờ` : 'Còn < 1 giờ';
                                        else if (days <= 3) remainingLabel = `Còn ${days} ngày ${hours} giờ`;
                                        else remainingLabel = `Còn ${days} ngày`;
                                    }
                                }

                                // ── Timeline % ──
                                let timelinePercent = 0;
                                if (entry.startTime && entry.endTime) {
                                    const totalMs = entry.endTime.getTime() - entry.startTime.getTime();
                                    const elapsedMs = Date.now() - entry.startTime.getTime();
                                    timelinePercent = totalMs > 0 ? Math.min(Math.max((elapsedMs / totalMs) * 100, 0), 100) : 0;
                                }

                                // ── Derived style tokens ──
                                const isWarning = !isOverdue && timelinePercent > 75;
                                const barGradient = isOverdue ? 'from-rose-500 to-red-600' : isWarning ? 'from-amber-400 to-orange-500' : 'from-emerald-400 to-teal-500';
                                const glowShadow = isOverdue ? 'hover:shadow-rose-500/20' : isWarning ? 'hover:shadow-amber-400/20' : 'hover:shadow-emerald-400/20';
                                const accentLine = isOverdue ? 'from-rose-500 to-red-600' : isWarning ? 'from-amber-400 to-orange-500' : 'from-emerald-400 to-teal-500';
                                const badgeCls = isOverdue
                                    ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                    : isWarning
                                        ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                        : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
                                const markerColor = isOverdue ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981';
                                const markerGlow = isOverdue ? 'rgba(244,63,94,0.5)' : isWarning ? 'rgba(245,158,11,0.5)' : 'rgba(16,185,129,0.5)';

                                return (
                                    <motion.div
                                        key={entry.id}
                                        variants={cardVariants}
                                        whileHover={{ y: -5, scale: 1.01 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => navigate(`/user/environment?assignId=${entry.id}`)}
                                        className={`group relative bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden
                                            border border-slate-200/70 dark:border-slate-700/60
                                            shadow-[0_2px_12px_-3px_rgba(0,0,0,0.08)]
                                            hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.15)] ${glowShadow}
                                            cursor-pointer transition-all duration-300`}
                                    >
                                        {/* Gradient accent top bar */}
                                        <div className={`h-[3px] w-full bg-gradient-to-r ${accentLine}`} />

                                        {/* Subtle mesh bg overlay */}
                                        <div className="absolute inset-0 opacity-[0.025] bg-[radial-gradient(ellipse_at_top_right,_#6366f1_0%,_transparent_60%)] pointer-events-none" />

                                        <div className="p-4 flex flex-col gap-3">

                                            {/* Row 1: Template pill + Status badge */}
                                            <div className="flex items-start justify-between gap-2">
                                                {entry.templateName ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[8.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 overflow-hidden flex-1 mr-2">
                                                        <FileText className="w-2.5 h-2.5 shrink-0 text-indigo-400" />
                                                        <span className="truncate">{entry.templateName}</span>
                                                    </span>
                                                ) : <span className="flex-1" />}
                                                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${badgeCls} ${isOverdue ? 'animate-pulse' : ''}`}>
                                                    {isOverdue ? <AlertTriangle className="w-2.5 h-2.5" /> : isWarning ? <Clock className="w-2.5 h-2.5" /> : <CheckCircle className="w-2.5 h-2.5" />}
                                                    {remainingLabel}
                                                </span>
                                            </div>

                                            {/* Row 2: Project name + Arrow CTA */}
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="text-[15px] font-black text-slate-800 dark:text-white leading-tight tracking-tight truncate flex-1" title={entry.projectName}>
                                                    {entry.projectName}
                                                </h3>
                                                <div className="shrink-0 w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40">
                                                    <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                                                </div>
                                            </div>

                                            {/* Row 3: Mini Timeline Progress */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                                                        {entry.startTime?.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) ?? '?'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{Math.round(timelinePercent)}%</span>
                                                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                        {entry.endTime?.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) ?? '?'}
                                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOverdue ? 'bg-rose-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                                    </span>
                                                </div>

                                                {/* Progress track */}
                                                <div className="relative h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className={`h-full rounded-full bg-gradient-to-r ${barGradient}`}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${timelinePercent}%` }}
                                                        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
                                                    />
                                                    {/* Today marker (glowing dot) */}
                                                    {timelinePercent > 2 && timelinePercent < 99 && (
                                                        <div
                                                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2"
                                                            style={{
                                                                left: `calc(${timelinePercent}% - 7px)`,
                                                                borderColor: markerColor,
                                                                boxShadow: `0 0 8px 2px ${markerGlow}`
                                                            }}
                                                            title="Hôm nay"
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </div>
                );
            })()}

            {/* ===== QUICK ACTIONS – REDESIGNED ===== */}
            <div className="relative overflow-hidden">
                {/* Section header */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
                        <LayoutGrid className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-none">Thao tác nhanh</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Truy cập các tính năng chính</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {quickActions.map((action, idx) => {
                        const Icon = action.icon;
                        return (
                            <motion.button
                                key={idx}
                                onClick={() => navigate(action.route)}
                                whileHover={{ y: -4, scale: 1.015 }}
                                whileTap={{ scale: 0.98 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                className={`group relative overflow-hidden rounded-2xl text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50 shadow-xl hover:shadow-2xl ${action.glow} transition-shadow duration-300`}
                            >
                                {/* Gradient background */}
                                <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient}`} />

                                {/* Subtle noise/mesh texture overlay */}
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_80%_20%,white_0%,transparent_60%)]" />

                                {/* Large decorative background dot */}
                                <div className={`absolute -bottom-8 -right-8 w-40 h-40 rounded-full ${action.bgDot} blur-2xl`} />

                                {/* Content */}
                                <div className="relative z-10 p-6 flex flex-col h-full min-h-[160px]">
                                    {/* Top row: icon + tag */}
                                    <div className="flex items-start justify-between mb-5">
                                        <div className={`p-3 rounded-xl ${action.iconBg} backdrop-blur-sm border border-white/20 shadow-inner`}>
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white/90 px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/20">
                                            {action.tag}
                                        </span>
                                    </div>

                                    {/* Text */}
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-white leading-tight mb-1">{action.label}</h3>
                                        <p className="text-sm text-white/75 leading-relaxed">{action.desc}</p>
                                    </div>

                                    {/* Bottom CTA */}
                                    <div className="mt-4 flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors">Truy cập</span>
                                        <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
                                    </div>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* Dashboard Footer Image */}
            <div className="mt-8 rounded-3xl overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800 relative group">
                <img
                    src={bgImage}
                    alt="Dashboard Background"
                    className="w-full h-auto object-cover rounded-3xl max-h-[400px] transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none rounded-3xl"></div>
            </div>

            {/* Charts & Recent Tasks Removed */}
            <CheckInModal isOpen={showCheckInModal} onClose={() => setShowCheckInModal(false)} onSubmit={handleCheckInSubmit} loading={attendanceLoading} mode="checkin" />
            <CheckInModal isOpen={showCheckoutModal} onClose={() => setShowCheckoutModal(false)} onSubmit={handleCheckoutSubmit} loading={attendanceLoading} mode="checkout" />
        </motion.div>
    );
};

export default UserDashboard;
