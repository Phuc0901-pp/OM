import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';
import { getUserId } from '../../../utils/userUtils';
import {
    History, Briefcase, Clock, Search, MapPin, X, CalendarDays, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../../components/common/GlassCard';
import PremiumTable, { ColumnDef } from '../../../components/common/PremiumTable';
import ModernInput from '../../../components/common/ModernInput';
import { createPortal } from 'react-dom';

interface AttendanceRecord {
    id: string;
    user: { id: string; full_name: string; email: string };
    project?: { project_name: string; location: string };
    status_checkin: number;
    date_checkin: string;
    status_checkout: number;
    date_checkout: string;
    created_at: string;
    personnel_photo?: string;
    checkout_img_url?: string;
    checkout_approved_at?: string;
    checkout_rejected_at?: string;
    checkout_reject_reason?: string;
}

const UserHistoryPage = () => {
    const userId = getUserId();
    const [searchParams] = useSearchParams();
    const highlightId = searchParams.get('attendanceId');

    const [searchTerm, setSearchTerm] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // ==================== QUERIES ====================
    const { data: history = [], isLoading, error } = useQuery({
        queryKey: ['userAttendanceHistory', userId],
        queryFn: () => api.get(`/attendance/history/${userId}?limit=100`).then(res => res.data || []),
        enabled: !!userId,
    });

    // ==================== HELPERS & COLUMNS ====================
    const MultiImageCell = ({ src, label }: { src?: string, label: string }) => {
        if (!src) return <span className="text-xs text-slate-400 italic">No Img</span>;

        let images: string[] = [];

        if (src.trim().startsWith('[')) {
            try {
                const parsed = JSON.parse(src);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    images = parsed;
                } else {
                    // Fallback if it's not a valid array or empty
                    if (src.length > 5) images = [src];
                }
            } catch (e) {
                console.error("Failed to parse image array:", e);
                images = [src];
            }
        } else {
            images = [src];
        }

        if (images.length === 0) return <span className="text-xs text-slate-400 italic">No Img</span>;

        return (
            <div className="flex flex-wrap gap-2">
                {images.map((imgSrc, index) => {
                    let objectKey = imgSrc;
                    try {
                        if (imgSrc.startsWith('http')) {
                            const urlObj = new URL(imgSrc);
                            const parts = urlObj.pathname.split('/');
                            if (parts.length > 2) objectKey = parts.slice(2).join('/');
                        }
                    } catch (e) { console.error("Failed to parse URL:", imgSrc); }

                    return (
                        <div key={index} className="relative cursor-pointer" onClick={() => setPreviewImage(objectKey)}>
                            <div className="group relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:ring-2 hover:ring-indigo-500 transition-all">
                                <img
                                    src={`/api/media/proxy?key=${encodeURIComponent(objectKey)}`}
                                    alt={`${label} ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const columns: ColumnDef<AttendanceRecord>[] = useMemo(() => [
        {
            header: 'Thời gian',
            accessor: 'created_at',
            cell: (val: any) => (
                <div className="flex flex-col">
                    <span className="font-bold text-slate-700">{new Date(val).toLocaleDateString('vi-VN')}</span>
                    <span className="text-xs text-slate-400">{new Date(val).toLocaleTimeString('vi-VN')}</span>
                </div>
            )
        },
        {
            header: 'Địa điểm',
            accessor: (item) => item.project?.project_name,
            cell: (val: any, row: any) => (
                <div>
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-slate-400" />
                        {row.project?.project_name || 'Văn phòng / Khác'}
                    </div>
                    <div className="text-xs text-slate-500 ml-4">{row.project?.location || '---'}</div>
                </div>
            )
        },
        {
            header: 'Check-in',
            accessor: 'personnel_photo',
            cell: (val: any, row: any) => (
                <div className="flex items-center gap-3">
                    <MultiImageCell src={row.personnel_photo} label="Checkin" />
                    <div>
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mb-1 w-fit">
                            <Clock className="w-3 h-3" />
                            {row.date_checkin ? new Date(row.date_checkin).toLocaleTimeString('vi-VN') : '---'}
                        </div>
                    </div>
                </div>
            )
        },
        {
            header: 'Check-out',
            accessor: 'checkout_img_url',
            cell: (val: any, row: any) => {
                const isRejected = !!row.checkout_rejected_at;
                const isApproved = !!row.checkout_approved_at;

                return (
                    <div className="flex items-center gap-3">
                        <MultiImageCell src={row.checkout_img_url} label="Checkout" />
                        <div>
                            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md mb-1 w-fit ${isRejected ? 'bg-red-50 text-red-700' :
                                isApproved ? 'bg-indigo-50 text-indigo-700' :
                                    'bg-amber-50 text-amber-700'
                                }`}>
                                <Clock className="w-3 h-3" />
                                {row.date_checkout ? new Date(row.date_checkout).toLocaleTimeString('vi-VN') :
                                    isRejected ? 'Bị từ chối' : 'Đang làm việc'}
                            </div>
                            {isRejected && row.checkout_reject_reason && (
                                <div className="text-[10px] text-red-500 max-w-[100px] truncate" title={row.checkout_reject_reason}>
                                    Lý do: {row.checkout_reject_reason}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
        }
    ], []);

    const [showAllDays, setShowAllDays] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const filteredData = useMemo(() => {
        let data = history;

        // Filter by specific attendance ID (from notification click)
        if (highlightId) {
            return data.filter((item: AttendanceRecord) => item.id === highlightId);
        }

        // Filter to today only (default behavior)
        if (!showAllDays) {
            const today = new Date();
            const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
            data = data.filter((item: AttendanceRecord) => {
                const itemDate = new Date(item.created_at).toISOString().slice(0, 10);
                return itemDate === todayStr;
            });
        }

        // Search filter
        return data.filter((item: AttendanceRecord) =>
            item.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.project?.location || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [history, searchTerm, highlightId, showAllDays]);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, page]);

    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 md:p-8 space-y-6 pb-24"
        >
            <GlassCard className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <History className="w-8 h-8 text-indigo-600" />
                        Lịch sử Điểm danh
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Xem lại lịch sử check-in và check-out cá nhân</p>
                </div>
                <div className="flex items-center gap-3">
                    {highlightId && (
                        <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                            Đang xem bản ghi: {highlightId.slice(0, 8)}...
                            <button onClick={() => window.history.pushState({}, '', '/user/history')} className="ml-2 hover:underline">Xóa lọc</button>
                        </div>
                    )}
                    {!highlightId && (
                        <button
                            onClick={() => { setShowAllDays(!showAllDays); setPage(1); }}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${showAllDays
                                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                }`}
                        >
                            {showAllDays ? (
                                <>
                                    <CalendarDays className="w-4 h-4" />
                                    Xem tất cả
                                </>
                            ) : (
                                <>
                                    <Calendar className="w-4 h-4" />
                                    Chỉ hôm nay
                                </>
                            )}
                        </button>
                    )}
                </div>
            </GlassCard>

            <GlassCard className="!p-0 overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-4 border-b border-slate-100">
                    <ModernInput
                        placeholder="Tìm kiếm theo dự án, địa điểm..."
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                        icon={<Search className="w-4 h-4" />}
                        className="max-w-md"
                        disabled={!!highlightId}
                    />
                </div>

                <div className="flex-1 p-4">
                    <PremiumTable
                        columns={columns}
                        data={paginatedData}
                        isLoading={isLoading}
                        keyField="id"
                    />
                    {error && <div className="text-center text-red-500 p-4">Không thể tải dữ liệu</div>}
                </div>

                {/* Pagination Controls */}
                {!highlightId && (
                    <div className="p-4 border-t border-slate-100 flex justify-center items-center gap-4">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-50 text-sm font-medium"
                        >
                            Trước
                        </button>
                        <span className="text-sm font-bold text-slate-600">Trang {page} / {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-50 text-sm font-medium"
                        >
                            Sau
                        </button>
                    </div>
                )}
            </GlassCard>

            {/* IMAGE PREVIEW MODAL */}
            {createPortal(
                <AnimatePresence>
                    {previewImage && (
                        <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
                            <motion.img
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                src={`/api/media/proxy?key=${encodeURIComponent(previewImage)}`}
                                className="max-w-[95vw] max-h-[95vh] rounded-lg shadow-2xl object-contain select-none"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button
                                className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/20 hover:bg-red-500/80 p-2 rounded-full transition-all backdrop-blur-sm"
                                onClick={() => setPreviewImage(null)}
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </motion.div>
    );
};

export default UserHistoryPage;
