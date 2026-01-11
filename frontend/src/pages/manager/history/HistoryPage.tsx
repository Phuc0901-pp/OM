import { useState, useEffect, useMemo } from 'react';
import api from '../../../services/api';
import {
    History, Calendar, User, MapPin, Trash2, RotateCcw, Briefcase, Clock, Search, AlertCircle, CheckCircle2, X
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
}

const HistoryPage = () => {
    const [activeTab, setActiveTab] = useState<'deleted_assignments' | 'work_schedule'>('deleted_assignments');

    // Data States
    const [history, setHistory] = useState<DeletedAssign[]>([]);
    const [schedule, setSchedule] = useState<AttendanceRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingSchedule, setLoadingSchedule] = useState(false);

    // UI States
    const [error, setError] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState<{ show: boolean, type: 'delete' | 'restore' | 'deleteAll', id: string, name: string }>({ show: false, type: 'delete', id: '', name: '' });
    const [searchTerm, setSearchTerm] = useState('');

    const fetchHistory = async () => {
        setLoadingHistory(true);
        setError(null);
        try {
            const response = await api.get('/allocations/history');
            setHistory(response.data || []);
        } catch (err: any) {
            if (err.response?.status === 401) setError("Phiên đăng nhập hết hạn.");
            else setError("Không thể tải lịch sử.");
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchSchedule = async () => {
        setLoadingSchedule(true);
        setError(null);
        try {
            const response = await api.get('/attendance/history/all?limit=100');
            setSchedule(response.data || []);
        } catch (err: any) {
            setError("Không thể tải lịch trình.");
        } finally {
            setLoadingSchedule(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'deleted_assignments') fetchHistory();
        else fetchSchedule();
    }, [activeTab]);

    const handlePermanentDelete = (id: string, name: string) => setShowConfirm({ show: true, type: 'delete', id, name });
    const handleRestore = (id: string, name: string) => setShowConfirm({ show: true, type: 'restore', id, name });
    const handleDeleteAll = () => {
        if (history.length === 0) return alert("Không có dữ liệu.");
        setShowConfirm({ show: true, type: 'deleteAll', id: '', name: `${history.length} mục` });
    };

    const confirmAction = async () => {
        const { type, id } = showConfirm;
        setShowConfirm({ show: false, type: 'delete', id: '', name: '' });

        try {
            if (type === 'delete') {
                await api.delete(`/allocations/${id}/permanent`);
                setHistory(prev => prev.filter(item => item.id !== id));
            } else if (type === 'restore') {
                await api.post(`/allocations/${id}/restore`);
                setHistory(prev => prev.filter(item => item.id !== id));
            } else if (type === 'deleteAll') {
                await Promise.all(history.map(item => api.delete(`/allocations/${item.id}/permanent`)));
                setHistory([]);
                alert("Đã xóa tất cả.");
            }
        } catch (err) {
            alert(`Thao tác thất bại.`);
            if (type === 'deleteAll') fetchHistory();
        }
    };

    // Columns Definitions
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
            header: 'Ngày',
            accessor: 'date_checkin',
            cell: (val: any, row: any) => <div className="font-bold text-slate-700">{new Date(val || row.created_at).toLocaleDateString('vi-VN')}</div>
        },
        {
            header: 'Check-in',
            accessor: 'status_checkin',
            cell: (val: any, row: any) => (
                <div className={`flex items-center gap-2 w-fit px-2 py-1 rounded-lg text-xs font-bold ${val ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    <Clock className="w-3 h-3" />
                    {row.date_checkin ? new Date(row.date_checkin).toLocaleTimeString('vi-VN') : '---'}
                </div>
            )
        },
        {
            header: 'Check-out',
            accessor: 'status_checkout',
            cell: (val: any, row: any) => (
                <div className={`flex items-center gap-2 w-fit px-2 py-1 rounded-lg text-xs font-bold ${val ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                    <Clock className="w-3 h-3" />
                    {row.date_checkout ? new Date(row.date_checkout).toLocaleTimeString('vi-VN') : 'Đang làm việc'}
                </div>
            )
        }
    ], []);

    // Filter Data
    const filteredHistory = history.filter(item =>
        item.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredSchedule = schedule.filter(item =>
        item.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                                {error && <div className="text-center text-red-500 p-4">{error}</div>}
                            </motion.div>
                        ) : (
                            <motion.div key="schedule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <PremiumTable columns={scheduleColumns} data={filteredSchedule} isLoading={loadingSchedule} keyField="id" />
                                {error && <div className="text-center text-red-500 p-4">{error}</div>}
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
        </div>
    );
};

export default HistoryPage;
