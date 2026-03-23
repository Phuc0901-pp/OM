import {
    useState,
    useMemo
} from 'react';
import {
    useSearchParams
} from 'react-router-dom';
import {
    useQuery
} from '@tanstack/react-query';
import api from '../../../services/api';
import {
    getUserId
} from '../../../utils/userUtils';
import {
    Briefcase,
    Clock,
    Search,
    X,
    CalendarDays,
    Calendar,
    CheckCircle2,
    XCircle,
    Loader2
} from 'lucide-react';
import {
    addHours
} from 'date-fns';
import {
    motion,
    AnimatePresence
} from 'framer-motion';
import GlassCard from '../../../components/common/GlassCard';
import PremiumTable, {
    ColumnDef
} from '../../../components/common/PremiumTable';
import ModernInput from '../../../components/common/ModernInput';
import {
    createPortal
} from 'react-dom';
import {
    parseSafeDate
} from '../../../utils/timeUtils';
import { getImageUrl } from '../../../utils/imageUtils';

interface AttendanceRecord {
    id: string;
    user: { id: string; full_name: string; email: string };
    project?: { name?: string; project_name?: string; location?: string };
    assign?: { template?: { name: string } };
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

// ==================== PARSE IMAGES HELPER ====================
const parseImageUrls = (src?: string): string[] => {
    if (!src) return [];
    const trimmed = src.trim();
    let images: string[] = [];

    if (trimmed.startsWith('{')) {
        // JSON Object map (checkout format: { "personnel_photo": "[\"url\"]", ... })
        try {
            const parsedObject = JSON.parse(trimmed);
            Object.values(parsedObject).forEach((val: any) => {
                if (typeof val === 'string') {
                    if (val.trim().startsWith('[')) {
                        try {
                            const subArr = JSON.parse(val);
                            if (Array.isArray(subArr)) images.push(...subArr.filter((i: any) => typeof i === 'string'));
                        } catch { images.push(val); }
                    } else {
                        images.push(val);
                    }
                } else if (Array.isArray(val)) {
                    images.push(...val.filter((i: any) => typeof i === 'string'));
                }
            });
        } catch { /* ignore */ }
    } else if (trimmed.startsWith('[')) {
        // JSON Array (checkin format)
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) images = parsed.filter((i: any) => typeof i === 'string');
        } catch {
            let cleanedStr = trimmed.substring(1, trimmed.length - 1);
            const parts = cleanedStr.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
            images = parts.filter(Boolean);
        }
    } else {
        images = [trimmed];
    }

    // Strip any leftover JSON quotes
    return images.map(u => u.replace(/^['"]|['"]$/g, '')).filter(Boolean);
};

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
        const images = parseImageUrls(src);
        if (images.length === 0) return <span className="text-xs text-slate-400 italic">No Img</span>;
        return (
            <div className="flex flex-wrap gap-2">
                {images.map((imgSrc, index) => (
                    <div key={index} className="relative cursor-pointer" onClick={() => setPreviewImage(getImageUrl(imgSrc))}>
                        <div className="group relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:ring-2 hover:ring-indigo-500 transition-all">
                            <img src={getImageUrl(imgSrc)} alt={`${label} ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const columns: ColumnDef<AttendanceRecord>[] = useMemo(() => [
        {
            header: 'Thời gian',
            accessor: 'created_at',
            cell: (val: string) => (
                <div className="flex flex-col">
                    <span className="font-bold text-slate-700">{parseSafeDate(val).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                    <span className="text-xs text-slate-400">{parseSafeDate(val).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                </div>
            )
        },
        {
            header: 'Dự án',
            accessor: (item) => item.project?.name || item.project?.project_name,
            cell: (_val: string | undefined, row: AttendanceRecord) => (
                <div>
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-slate-400" />
                        {row.project?.name || row.project?.project_name || 'Văn phòng / Khác'}
                    </div>
                </div>
            )
        },
        {
            header: 'Nội dung công việc',
            accessor: (item) => item.assign?.template?.name,
            cell: (_val: string | undefined, row: AttendanceRecord) => (
                <div>
                    <div className="font-bold text-slate-800 flex items-center gap-1 line-clamp-2">
                        {row.assign?.template?.name ? (
                            <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-xs">{row.assign.template.name}</span>
                        ) : (
                            <span className="text-slate-400 text-xs italic">Không phân bổ cụ thể</span>
                        )}
                    </div>
                </div>
            )
        },
        {
            header: 'Check-in',
            accessor: 'personnel_photo',
            cell: (_val: string | undefined, row: AttendanceRecord) => (
                <div className="flex items-center gap-3">
                    <MultiImageCell src={row.personnel_photo} label="Checkin" />
                    <div>
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mb-1 w-fit">
                            <Clock className="w-3 h-3" />
                            {row.date_checkin ? addHours(parseSafeDate(row.date_checkin), 7).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '---'}
                        </div>
                    </div>
                </div>
            )
        },
        {
            header: 'Check-out',
            accessor: 'checkout_img_url',
            cell: (_val: string | undefined, row: AttendanceRecord) => {
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
                                {row.date_checkout ? addHours(parseSafeDate(row.date_checkout), 7).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) :
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

        if (highlightId) {
            return data.filter((item: AttendanceRecord) => item.id === highlightId);
        }

        if (!showAllDays) {
            const today = new Date();
            const todayStr = today.toISOString().slice(0, 10);
            data = data.filter((item: AttendanceRecord) => {
                const itemDate = parseSafeDate(item.created_at).toISOString().slice(0, 10);
                return itemDate === todayStr;
            });
        }

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

    // ==================== MOBILE CARD COMPONENT ====================
    const MobileCard = ({ row }: { row: AttendanceRecord }) => {
        const isRejected = !!row.checkout_rejected_at;
        const isApproved = !!row.checkout_approved_at;
        const checkinImages = parseImageUrls(row.personnel_photo);
        const checkoutImages = parseImageUrls(row.checkout_img_url);

        return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 space-y-3 shadow-sm">
                {/* Date & Location */}
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-slate-400">{parseSafeDate(row.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
                        <p className="font-bold text-slate-800 dark:text-white flex items-center gap-1 mt-0.5">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                            {row.project?.name || row.project?.project_name || 'Văn phòng / Khác'}
                        </p>
                        {row.assign?.template?.name && (
                            <p className="text-xs text-indigo-600 font-medium ml-5 mt-0.5">{row.assign.template.name}</p>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        {isApproved && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" />Đã duyệt</span>}
                        {isRejected && <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />Từ chối</span>}
                        {!isApproved && !isRejected && row.checkout_img_url && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Chờ duyệt</span>}
                    </div>
                </div>

                {/* Check-in / Check-out row */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Check-in */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase mb-2">Check-in</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mb-2">
                            <Clock className="w-3.5 h-3.5 text-emerald-500" />
                            {row.date_checkin ? addHours(parseSafeDate(row.date_checkin), 7).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '---'}
                        </p>
                        {checkinImages.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {checkinImages.map((imgSrc, i) => (
                                    <img
                                        key={i}
                                        src={getImageUrl(imgSrc)}
                                        alt={`Checkin ${i + 1}`}
                                        className="w-14 h-14 object-cover rounded-lg border-2 border-emerald-200 cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all"
                                        onClick={() => setPreviewImage(getImageUrl(imgSrc))}
                                    />
                                ))}
                            </div>
                        ) : (
                            <span className="text-xs text-slate-400 italic">Không có ảnh</span>
                        )}
                    </div>

                    {/* Check-out */}
                    <div className={`rounded-xl p-3 ${isRejected ? 'bg-red-50 dark:bg-red-900/20' : isApproved ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-amber-50 dark:bg-amber-900/10'}`}>
                        <p className={`text-[10px] font-bold uppercase mb-2 ${isRejected ? 'text-red-600' : isApproved ? 'text-indigo-600' : 'text-amber-600'}`}>Check-out</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mb-2">
                            <Clock className={`w-3.5 h-3.5 ${isRejected ? 'text-red-500' : isApproved ? 'text-indigo-500' : 'text-amber-500'}`} />
                            {row.date_checkout
                                ? addHours(parseSafeDate(row.date_checkout), 7).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                : isRejected ? 'Từ chối' : '---'
                            }
                        </p>
                        {checkoutImages.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {checkoutImages.map((imgSrc, i) => (
                                    <img
                                        key={i}
                                        src={getImageUrl(imgSrc)}
                                        alt={`Checkout ${i + 1}`}
                                        className={`w-14 h-14 object-cover rounded-lg border-2 cursor-pointer hover:ring-2 transition-all ${isRejected ? 'border-red-200 hover:ring-red-400' : 'border-indigo-200 hover:ring-indigo-400'}`}
                                        onClick={() => setPreviewImage(getImageUrl(imgSrc))}
                                    />
                                ))}
                            </div>
                        ) : (
                            <span className="text-xs text-slate-400 italic">Không có ảnh</span>
                        )}
                        {isRejected && row.checkout_reject_reason && (
                            <p className="text-[10px] text-red-600 mt-1 font-medium">📋 {row.checkout_reject_reason}</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 md:p-8 space-y-6 pb-24"
        >
            {/* Premium Header */}
            <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl dark:shadow-2xl border border-white/20 dark:border-white/5 transition-colors">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-400/20 to-rose-600/20 rounded-full blur-3xl -z-10"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                            Lịch sử Điểm danh
                        </h1>
                        <p className="text-gray-600 dark:text-slate-400 font-medium">Xem lại lịch sử check-in và check-out cá nhân</p>
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
                </div>
            </div>

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

                {/* Loading state */}
                {isLoading && (
                    <div className="flex-1 flex items-center justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                )}

                {error && <div className="text-center text-red-500 p-4">Không thể tải dữ liệu</div>}

                {!isLoading && (
                    <>
                        {/* MOBILE: Card view (hidden on md+) */}
                        <div className="md:hidden flex-1 p-3 space-y-3">
                            {paginatedData.length === 0 ? (
                                <div className="text-center text-slate-400 py-12">Không có dữ liệu</div>
                            ) : (
                                paginatedData.map((row: AttendanceRecord) => (
                                    <MobileCard key={row.id} row={row} />
                                ))
                            )}
                        </div>

                        {/* DESKTOP: Table view (hidden on mobile) */}
                        <div className="hidden md:block flex-1 p-4">
                            <PremiumTable
                                columns={columns}
                                data={paginatedData}
                                isLoading={false}
                                keyField="id"
                            />
                        </div>
                    </>
                )}

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
                                src={previewImage}
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
