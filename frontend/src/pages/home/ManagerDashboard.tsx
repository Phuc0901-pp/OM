import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import ReactDOM from 'react-dom';
import {
    Briefcase, Users, CheckCircle2, Clock, TrendingUp, FileText, FolderPlus,
    History, BarChart3, ArrowRight, Activity, ChevronRight, Zap, LayoutGrid, X, ZoomIn, Trophy
} from 'lucide-react';
import GlassCard from '../../components/common/GlassCard';
import PremiumButton from '../../components/common/PremiumButton';
import { useDashboardStats } from '../../hooks/manager/useDashboardStats';
import type { PendingCheckout } from '../../types/models';
import { getImageUrl } from '../../utils/imageUtils';

import bgImage from '../../../assets/Background1.jpg';
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
    return date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
};

const getManagerId = () => {
    try {
        const u = sessionStorage.getItem('user');
        return u ? JSON.parse(u).id : null;
    } catch { return null; }
};

const getFirstImage = (urlOrJson?: string): string | null => {
    if (!urlOrJson) return null;
    let parsed: any;

    // Try to parse as JSON (array or object)
    if (urlOrJson.trim().startsWith('[') || urlOrJson.trim().startsWith('{')) {
        try {
            parsed = JSON.parse(urlOrJson);
        } catch {
            return urlOrJson; // fallback to raw string
        }
    } else {
        return urlOrJson; // plain string
    }

    // Handle string array: ["url1", "url2"]
    if (Array.isArray(parsed)) {
        return parsed.length > 0 ? parsed[0] : null;
    }

    // Handle our new object format: { "personnel_photo": "[\"urls\"]", "id_card_front": "..." }
    if (typeof parsed === 'object' && parsed !== null) {
        // Try getting personnel photo first
        let targetArrString = parsed["personnel_photo"];

        // Fallback to the first available key if no personnel photo
        const keys = Object.keys(parsed);
        if (!targetArrString && keys.length > 0) {
            targetArrString = parsed[keys[0]];
        }

        if (targetArrString) {
            // targetArrString is likely another JSON string array inside the object
            try {
                const innerArr = JSON.parse(targetArrString);
                if (Array.isArray(innerArr) && innerArr.length > 0) return innerArr[0];
                return typeof innerArr === 'string' ? innerArr : null;
            } catch {
                return targetArrString; // If it was just a plain URL string
            }
        }
    }

    return null;
};

const ManagerDashboard = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // All data fetching & derived state lives in the custom hook
    const { managerId, stats, recentActivities, completionRate, topPerformers, pendingCheckouts, isLoading } = useDashboardStats();

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


    if (isLoading) return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 font-medium animate-pulse">Đang tải dữ liệu...</p>
            </div>
        </div>
    );

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-10">
            {/* Premium Header */}
            <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl dark:shadow-2xl border border-white/20 dark:border-white/5 transition-colors">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-400/20 to-purple-600/20 rounded-full blur-3xl -z-10"></div>
                <div className="relative z-10 flex flex-col gap-1">
                    <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Bảng điều khiển
                    </h1>
                    <p className="text-gray-600 dark:text-slate-400 font-medium">Chào mừng người Quản lý vào hệ thống<br />
                        <span className="font-bold">{new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </p>
                </div>
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
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center font-bold text-white text-lg shadow-md shadow-orange-200">{(req.user?.name || 'U').charAt(0)}</div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-slate-800 truncate text-base">{req.user?.name}</p>
                                            <p className="text-xs text-slate-500 truncate font-medium">{req.user?.email}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 mb-5 px-3 py-3 bg-slate-50/50 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-indigo-500" /><span className="truncate">{req.user?.team?.name}</span></div>
                                        <div className="flex items-center gap-2 text-sm"><Briefcase className="w-4 h-4 text-orange-500" /><span className="truncate">{req.project?.name}</span></div>
                                        <div className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-slate-400" /><span>{formatRelativeDate(req.checkout_request_time)}</span></div>
                                    </div>

                                    {/* Checkout Image Preview */}
                                    {req.checkout_img_url && getFirstImage(req.checkout_img_url) && (
                                        <div className="mb-4 relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200" onClick={() => setSelectedImage(getFirstImage(req.checkout_img_url))}>
                                            <img src={getImageUrl(getFirstImage(req.checkout_img_url))} alt="Checkout" className="w-full h-32 object-cover transition-transform group-hover:scale-105" />
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

            {/* Dashboard Footer Image */}
            <div className="mt-8 rounded-3xl overflow-hidden shadow-2xl border border-white/20 relative group">
                <img
                    src={bgImage}
                    alt="Dashboard Background"
                    className="w-full h-auto object-cover rounded-3xl max-h-[400px] transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none rounded-3xl"></div>
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
                        src={getImageUrl(selectedImage)}
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
