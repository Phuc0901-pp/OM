import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import {
    History, Briefcase, Clock, Search, AlertCircle, CheckCircle2, X, MapPin, Trash2, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../../components/common/GlassCard';
import PremiumTable, { ColumnDef } from '../../../components/common/PremiumTable';
import PremiumButton from '../../../components/common/PremiumButton';
import ModernInput from '../../../components/common/ModernInput';

interface DeletedAssign {
    id: string;
    project: { project_name: string; location: string };
    user: { full_name: string; email: string };
    classification: { name: string };
    deleted_at: string;
}

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
}

const HistoryPage = () => {
    const [activeTab, setActiveTab] = useState<'deleted_assignments' | 'work_schedule'>('deleted_assignments');
    const [searchTerm, setSearchTerm] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState<{ show: boolean, type: 'delete' | 'restore' | 'deleteAll', id: string, name: string }>({ show: false, type: 'delete', id: '', name: '' });

    const queryClient = useQueryClient();

    // ==================== QUERIES ====================
    const { data: history = [], isLoading: loadingHistory, error: historyError } = useQuery({
        queryKey: ['deletedAssignments'],
        queryFn: () => api.get('/allocations/history').then(res => res.data || []),
        enabled: activeTab === 'deleted_assignments', // Only fetch active tab
    });

    const { data: schedule = [], isLoading: loadingSchedule, error: scheduleError } = useQuery({
        queryKey: ['attendanceHistory'],
        queryFn: () => api.get('/attendance/history/all?limit=100').then(res => res.data || []),
        enabled: activeTab === 'work_schedule',
    });

    // ==================== MUTATIONS ====================
    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/allocations/${id}/permanent`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedAssignments'] }),
        onError: () => alert("Xóa thất bại.")
    });

    const restoreMutation = useMutation({
        mutationFn: (id: string) => api.post(`/allocations/${id}/restore`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedAssignments'] }),
        onError: () => alert("Khôi phục thất bại.")
    });

    const deleteAllMutation = useMutation({
        mutationFn: () => Promise.all(history.map((item: DeletedAssign) => api.delete(`/allocations/${item.id}/permanent`))),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deletedAssignments'] });
            alert("Đã xóa tất cả.");
        },
        onError: () => {
            queryClient.invalidateQueries({ queryKey: ['deletedAssignments'] }); // Sync anyway
            alert("Có lỗi khi xóa tất cả.");
        }
    });


    // ==================== ACTIONS ====================
    const handlePermanentDelete = (id: string, name: string) => setShowConfirm({ show: true, type: 'delete', id, name });
    const handleRestore = (id: string, name: string) => setShowConfirm({ show: true, type: 'restore', id, name });
    const handleDeleteAll = () => {
        if (history.length === 0) return alert("Không có dữ liệu.");
        setShowConfirm({ show: true, type: 'deleteAll', id: '', name: `${history.length} mục` });
    };

    const confirmAction = () => {
        const { type, id } = showConfirm;
        setShowConfirm({ show: false, type: 'delete', id: '', name: '' });

        if (type === 'delete') deleteMutation.mutate(id);
        else if (type === 'restore') restoreMutation.mutate(id);
        else if (type === 'deleteAll') deleteAllMutation.mutate();
    };

    // ==================== HELPERS & COLUMNS ====================
    // Image Preview Helper
    const ImageCell = ({ src, label }: { src?: string, label: string }) => {
        if (!src) return <span className="text-xs text-slate-400 italic">No Img</span>;
        let objectKey = src;
        try {
            if (src.startsWith('http')) {
                const urlObj = new URL(src);
                const parts = urlObj.pathname.split('/');
                if (parts.length > 2) objectKey = parts.slice(2).join('/');
            }
        } catch (e) { console.error("Failed to parse URL:", src); }

        return (
            <div
                className="group relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm cursor-zoom-in hover:ring-2 hover:ring-indigo-500 transition-all"
                onClick={() => setPreviewImage(objectKey)}
            >
                <img
                    src={`/api/media/proxy?key=${encodeURIComponent(objectKey)}`}
                    alt={label}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
            </div>
        );
    };

    const scheduleColumns: ColumnDef<AttendanceRecord>[] = useMemo(() => [
        {
            header: 'Nhân sự',
            accessor: (item) => item.user?.full_name,
            cell: (val: any, row: any) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                        {(row.user?.full_name || '?').charAt(0)}
                    </div>
                    <div>
                        <div className="font-bold text-slate-700">{row.user?.full_name}</div>
                        <div className="text-xs text-slate-400">{row.user?.email}</div>
                    </div>
                </div>
            )
        },
        {
            header: 'Địa điểm',
            accessor: (item) => item.project?.project_name,
            cell: (val: any, row: any) => (
                <div>
                    <div className="font-bold text-slate-800 flex items-center gap-1"><Briefcase className="w-3 h-3 text-slate-400" /> {row.project?.project_name || 'Văn phòng / Khác'}</div>
                    <div className="text-xs text-slate-500 ml-4">{row.project?.location || '---'}</div>
                </div>
            )
        },
        {
            header: 'Check-in',
            accessor: 'personnel_photo',
            cell: (val: any, row: any) => (
                <div className="flex items-center gap-3">
                    <ImageCell src={row.personnel_photo} label="Checkin" />
                    <div>
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mb-1 w-fit">
                            <Clock className="w-3 h-3" />
                            {row.date_checkin ? new Date(row.date_checkin).toLocaleTimeString('vi-VN') : '---'}
                        </div>
                        <div className="text-[10px] text-slate-400">{row.date_checkin ? new Date(row.date_checkin).toLocaleDateString() : ''}</div>
                    </div>
                </div>
            )
        },
        {
            header: 'Check-out',
            accessor: 'checkout_img_url',
            cell: (val: any, row: any) => (
                <div className="flex items-center gap-3">
                    <ImageCell src={row.checkout_img_url} label="Checkout" />
                    <div>
                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md mb-1 w-fit ${row.status_checkout ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                            <Clock className="w-3 h-3" />
                            {row.date_checkout ? new Date(row.date_checkout).toLocaleTimeString('vi-VN') : 'Đang làm việc'}
                        </div>
                        {row.date_checkout && <div className="text-[10px] text-slate-400">{new Date(row.date_checkout).toLocaleDateString()}</div>}
                    </div>
                </div>
            )
        }
    ], []);

    const historyColumns: ColumnDef<DeletedAssign>[] = useMemo(() => [
        {
            header: 'Dự án',
            accessor: (item) => item.project?.project_name,
            cell: (val: any, row: any) => (
                <div>
                    <div className="font-bold text-slate-800">{row.project?.project_name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {row.project?.location || 'N/A'}</div>
                </div>
            )
        },
        {
            header: 'Nhân sự',
            accessor: (item) => item.user?.full_name,
            cell: (val: any, row: any) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                        {(row.user?.full_name || '?').charAt(0)}
                    </div>
                    <div>
                        <div className="font-bold text-slate-700">{row.user?.full_name}</div>
                        <div className="text-xs text-slate-400">{row.user?.email}</div>
                    </div>
                </div>
            )
        },
        {
            header: 'Phân loại',
            accessor: (item) => item.classification?.name,
            cell: (val: any) => <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{val || 'General'}</span>
        },
        {
            header: 'Thời gian xóa',
            accessor: 'deleted_at',
            cell: (val: any) => (
                <div className="flex items-center gap-2 text-red-500 font-medium bg-red-50 px-2 py-1 rounded-lg w-fit">
                    <Trash2 className="w-3 h-3" />
                    <span className="text-xs">{val ? new Date(val).toLocaleString('vi-VN') : 'N/A'}</span>
                </div>
            )
        },
        {
            header: 'Thao tác',
            accessor: 'id',
            cell: (_: any, row: any) => (
                <div className="flex items-center gap-2">
                    <PremiumButton size="sm" variant="success" onClick={() => handleRestore(row.id, row.project.project_name)} icon={<RotateCcw className="w-3 h-3" />}>Khôi phục</PremiumButton>
                    <PremiumButton size="sm" variant="danger" onClick={() => handlePermanentDelete(row.id, row.project.project_name)} icon={<Trash2 className="w-3 h-3" />}>Xóa</PremiumButton>
                </div>
            )
        }
    ], []);

    // Filter Logic
    const filteredHistory = useMemo(() => history.filter((item: DeletedAssign) =>
        item.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [history, searchTerm]);

    const filteredSchedule = useMemo(() => schedule.filter((item: AttendanceRecord) =>
        item.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [schedule, searchTerm]);

    return (
        <div className="p-4 md:p-8 space-y-6 pb-24">
            <GlassCard className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <History className="w-8 h-8 text-blue-600" />
                        Lịch sử & Theo dõi
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Quản lý lịch sử phân công và nhật ký công tác</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-100/50 p-1.5 rounded-xl border border-white/50">
                    <button onClick={() => setActiveTab('deleted_assignments')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'deleted_assignments' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Lịch sử Xóa
                    </button>
                    <button onClick={() => setActiveTab('work_schedule')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'work_schedule' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Lịch trình
                    </button>
                </div>
            </GlassCard>

            <GlassCard className="!p-0 overflow-hidden flex flex-col min-h-[600px]">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
                    <ModernInput
                        placeholder="Tìm kiếm..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        icon={<Search className="w-4 h-4" />}
                        className="max-w-md"
                    />
                    {activeTab === 'deleted_assignments' && filteredHistory.length > 0 && (
                        <PremiumButton variant="danger" size="sm" onClick={handleDeleteAll} icon={<Trash2 className="w-3 h-3" />}>
                            Xóa tất cả
                        </PremiumButton>
                    )}
                </div>

                <div className="flex-1 p-4">
                    <AnimatePresence mode="wait">
                        {activeTab === 'deleted_assignments' ? (
                            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <PremiumTable columns={historyColumns} data={filteredHistory} isLoading={loadingHistory} keyField="id" />
                                {historyError && <div className="text-center text-red-500 p-4">Không thể tải lịch sử</div>}
                            </motion.div>
                        ) : (
                            <motion.div key="schedule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <PremiumTable columns={scheduleColumns} data={filteredSchedule} isLoading={loadingSchedule} keyField="id" />
                                {scheduleError && <div className="text-center text-red-500 p-4">Không thể tải lịch trình</div>}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </GlassCard>

            {/* Confirm Modal */}
            <AnimatePresence>
                {showConfirm.show && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
                            <GlassCard className="w-full max-w-md p-6">
                                <div className="flex flex-col items-center text-center mb-6">
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${showConfirm.type === 'restore' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                        {showConfirm.type === 'restore' ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800">
                                        {showConfirm.type === 'restore' ? 'Xác nhận khôi phục' : 'Xác nhận xóa vĩnh viễn'}
                                    </h3>
                                    <p className="text-slate-500 mt-2 text-sm">
                                        {showConfirm.type === 'restore' ? (
                                            <>Khôi phục <strong>"{showConfirm.name}"</strong>? Dữ liệu sẽ xuất hiện lại trong danh sách.</>
                                        ) : (
                                            <>
                                                Xóa vĩnh viễn <strong>"{showConfirm.name}"</strong>?<br />
                                                <span className="text-red-500 font-bold">Hành động này không thể hoàn tác!</span>
                                            </>
                                        )}
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <PremiumButton variant="ghost" className="flex-1" onClick={() => setShowConfirm({ show: false, type: 'delete', id: '', name: '' })}>Hủy bỏ</PremiumButton>
                                    <PremiumButton
                                        variant={showConfirm.type === 'restore' ? 'success' : 'danger'}
                                        className="flex-1"
                                        onClick={confirmAction}
                                    >
                                        {showConfirm.type === 'restore' ? 'Khôi phục ngay' : 'Xóa vĩnh viễn'}
                                    </PremiumButton>
                                </div>
                            </GlassCard>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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
        </div>
    );
};

export default HistoryPage;
