import React, { useState, useMemo, useCallback } from 'react';
import { Search, ChevronRight, LayoutGrid, CheckSquare, Square, Check, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import GlassCard from '../../../../components/common/GlassCard';
import ModernInput from '../../../../components/common/ModernInput';
import { TaskRow } from '../types';

interface TaskTableProps {
    tasks: TaskRow[];
    selectedProjectName: string | null;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    setSelectedTask: (task: TaskRow) => void;
    stationMap: Record<string, string>;
    onBulkUpdateStatus: (ids: string[], status: number, note?: string) => Promise<void>;
    fetchTasks: () => void;
}

const getStatusBadge = (statusString?: string) => {
    switch (statusString || "0000") {
        case '0000': return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">Chưa thực hiện</span>;
        case '1000': return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">Đang làm</span>;
        case '1100': return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">Chờ duyệt</span>;
        case '1101': return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">Từ chối / Chờ nộp lại</span>;
        case '1110': return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">Đã xong</span>;
        case '1111': return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-200">Đã điều chỉnh xong</span>;
        default: return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-gray-50 text-gray-400 border border-gray-200">Khác ({statusString})</span>;
    }
};

const TaskTable: React.FC<TaskTableProps> = ({
    tasks,
    selectedProjectName,
    searchTerm,
    setSearchTerm,
    setSelectedTask,
    stationMap,
    onBulkUpdateStatus,
    fetchTasks,
}) => {
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);

    // Approvable tasks only (status 1100 = Pending Review)
    const approvableTasks = useMemo(() => tasks.filter(t => t.statusString === '1100'), [tasks]);
    const isAllChecked = approvableTasks.length > 0 && approvableTasks.every(t => checkedIds.has(t.id));
    const isIndeterminate = !isAllChecked && approvableTasks.some(t => checkedIds.has(t.id));

    const toggleMaster = useCallback(() => {
        if (isAllChecked) {
            setCheckedIds(new Set());
        } else {
            setCheckedIds(new Set(approvableTasks.map(t => t.id)));
        }
    }, [isAllChecked, approvableTasks]);

    const toggleOne = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCheckedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const expandedPendingIds = useMemo(() => {
        const allIds: string[] = [];
        tasks.forEach(t => {
            if (checkedIds.has(t.id)) {
                if (t.subTasks && t.subTasks.length > 0) {
                    t.subTasks.forEach(st => {
                        if (st.statusString === '1100') allIds.push(st.id);
                    });
                } else {
                    if (t.statusString === '1100') allIds.push(t.id);
                }
            }
        });
        return allIds;
    }, [tasks, checkedIds]);

    const handleBulkApprove = async () => {
        const ids = expandedPendingIds;
        if (ids.length === 0) return;
        setBulkLoading(true);
        try {
            await onBulkUpdateStatus(ids, 1, 'Bulk Approved');
            setCheckedIds(new Set());
            fetchTasks();
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkReject = async () => {
        const ids = expandedPendingIds;
        if (ids.length === 0) return;
        const reason = prompt(`Nhập lý do từ chối cho ${ids.length} quy trình (thuộc ${checkedIds.size} hạng mục):`);
        if (reason === null) return;
        setBulkLoading(true);
        try {
            await onBulkUpdateStatus(ids, -1, reason || 'Từ chối hàng loạt');
            setCheckedIds(new Set());
            fetchTasks();
        } finally {
            setBulkLoading(false);
        }
    };

    return (
        <GlassCard className="lg:col-span-9 !p-0 flex flex-col h-full overflow-hidden min-h-[600px] relative border-slate-200/60 shadow-xl shadow-slate-200/40">
            <AnimatePresence mode='wait'>
                {selectedProjectName ? (
                    <motion.div
                        key="project-details"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col h-full"
                    >
                        {/* Toolbar */}
                        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md sticky top-0 z-20">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-1.5 bg-gradient-to-b from-primary-500 to-indigo-600 rounded-full"></div>
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">{selectedProjectName}</h2>
                                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 rounded-lg mt-0.5">
                                        <div className="flex -space-x-1">
                                            {[...Array(3)].map((_, i) => (
                                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary-400 ring-1 ring-white"></div>
                                            ))}
                                        </div>
                                        {tasks.length} hạng mục trong danh sách
                                    </span>
                                </div>
                            </div>
                            <div className="w-full md:w-80">
                                <ModernInput
                                    placeholder="Tìm hạng mục, nhân sự..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    icon={<Search className="w-4 h-4" />}
                                    className="!bg-white"
                                />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/80 sticky top-0 z-10 text-[10px] md:text-[11px] font-extrabold text-slate-400 uppercase tracking-wider backdrop-blur-sm border-b border-slate-200">
                                    <tr>
                                        {/* Master Checkbox */}
                                        <th className="px-3 py-3 md:px-4 md:py-4 w-10">
                                            <button
                                                onClick={toggleMaster}
                                                className="flex items-center justify-center w-5 h-5 rounded border-2 border-slate-300 hover:border-indigo-500 transition-colors"
                                                style={{ background: isAllChecked ? '#6366f1' : isIndeterminate ? '#e0e7ff' : 'white', borderColor: (isAllChecked || isIndeterminate) ? '#6366f1' : undefined }}
                                                title="Chọn tất cả Chờ duyệt"
                                            >
                                                {isAllChecked && <Check className="w-3 h-3 text-white" />}
                                                {isIndeterminate && <div className="w-2 h-0.5 bg-indigo-500 rounded" />}
                                            </button>
                                        </th>
                                        <th className="px-3 py-3 md:px-6 md:py-4">Hạng mục</th>
                                        <th className="px-3 py-3 md:px-6 md:py-4">Công việc</th>
                                        <th className="px-3 py-3 md:px-6 md:py-4">Khu vực</th>
                                        <th className="px-3 py-3 md:px-6 md:py-4">Nhân sự</th>
                                        <th className="px-3 py-3 md:px-6 md:py-4 hidden md:table-cell">Ngày nộp</th>
                                        <th className="px-3 py-3 md:px-6 md:py-4 hidden md:table-cell">Ngày duyệt/từ chối</th>
                                        <th className="px-3 py-3 md:px-6 md:py-4 text-center">Trạng thái</th>
                                        <th className="px-3 py-3 md:px-6 md:py-4 text-center">Chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <AnimatePresence>
                                        {tasks.map((task, index) => {
                                            const displayStationName = task.stationName
                                                || (task.stationId && stationMap[task.stationId])
                                                || '-';
                                            const isChecked = checkedIds.has(task.id);
                                            const isApprovable = task.statusString === '1100';

                                            return (
                                                <motion.tr
                                                    key={task.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.02 }}
                                                    onClick={() => setSelectedTask(task)}
                                                    className={`hover:bg-slate-50/80 group transition-all duration-200 cursor-pointer ${isChecked ? 'bg-indigo-50/60' : ''}`}
                                                >
                                                    {/* CHECKBOX */}
                                                    <td className="px-3 py-3 md:px-4 md:py-4 w-10" onClick={e => isApprovable && toggleOne(task.id, e)}>
                                                        {isApprovable ? (
                                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isChecked ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 hover:border-indigo-400 bg-white'}`}>
                                                                {isChecked && <Check className="w-3 h-3 text-white" />}
                                                            </div>
                                                        ) : (
                                                            <div className="w-5 h-5" />
                                                        )}
                                                    </td>

                                                    {/* HẠNG MỤC */}
                                                    <td className="px-3 py-3 md:px-6 md:py-4 min-w-[150px]">
                                                        <div className="text-sm font-bold text-slate-700">{task.mainCategoryName}</div>
                                                    </td>

                                                    {/* CÔNG VIỆC */}
                                                    <td className="px-3 py-3 md:px-6 md:py-4 min-w-[200px]">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-sm font-medium text-slate-600">{task.categoryName}</div>
                                                            {task.inverterName && <span className="text-xs text-slate-400">{task.inverterName}</span>}
                                                        </div>
                                                    </td>

                                                    {/* KHU VỰC */}
                                                    <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">
                                                        <div className="text-sm text-slate-500 font-medium">{displayStationName}</div>
                                                    </td>

                                                    {/* NHÂN SỰ */}
                                                    <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                                {task.userName.charAt(0)}
                                                            </div>
                                                            <div className="text-sm font-semibold text-slate-700">{task.userName}</div>
                                                        </div>
                                                    </td>

                                                    {/* NGÀY NỘP */}
                                                    <td className="px-3 py-3 md:px-6 md:py-4 hidden md:table-cell text-xs whitespace-nowrap">
                                                        {task.submittedAt && !isNaN(new Date(task.submittedAt).getTime()) ? (
                                                            <span className="font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{format(new Date(task.submittedAt), 'dd/MM/yyyy HH:mm')}</span>
                                                        ) : <span className="text-slate-300 italic">-</span>}
                                                    </td>

                                                    {/* NGÀY DUYỆT/TỪ CHỐI */}
                                                    <td className="px-3 py-3 md:px-6 md:py-4 hidden md:table-cell text-xs whitespace-nowrap">
                                                        {task.approvalAt && !isNaN(new Date(task.approvalAt).getTime()) ? (
                                                            <span className="text-emerald-600 font-medium">{format(new Date(task.approvalAt), 'dd/MM/yyyy HH:mm')}</span>
                                                        ) : task.rejectedAt && !isNaN(new Date(task.rejectedAt).getTime()) ? (
                                                            <span className="text-rose-600 font-medium">{format(new Date(task.rejectedAt), 'dd/MM/yyyy HH:mm')}</span>
                                                        ) : <span className="text-slate-300 italic">-</span>}
                                                    </td>

                                                    {/* TRẠNG THÁI */}
                                                    <td className="px-3 py-3 md:px-6 md:py-4 text-center whitespace-nowrap">
                                                        {getStatusBadge(task.statusString)}
                                                    </td>

                                                    {/* CHI TIẾT */}
                                                    <td className="px-3 py-3 md:px-6 md:py-4 text-center">
                                                        <button
                                                            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                            title="Xem chi tiết"
                                                        >
                                                            <ChevronRight className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            )
                                        })}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty-state"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center text-slate-400 relative h-full"
                    >
                        <div className="absolute inset-0 bg-slate-50/50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
                        <div className="relative z-10 bg-white p-6 rounded-full shadow-xl shadow-slate-200 mb-6 border border-slate-100">
                            <div className="bg-slate-50 p-4 rounded-full">
                                <LayoutGrid className="w-10 h-10 text-slate-300" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-slate-600 relative z-10">Chọn dự án để bắt đầu quản lý</p>
                        <p className="text-sm text-slate-400 mt-2 relative z-10">Dữ liệu vận hành sẽ được hiển thị chi tiết tại đây</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Floating Bulk Action Bar ── */}
            <AnimatePresence>
                {checkedIds.size > 0 && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-slate-900/40 border border-white/10 backdrop-blur-md"
                    >
                        <div className="flex items-center gap-2 pr-3 border-r border-white/20">
                            <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-black">
                                {checkedIds.size}
                            </div>
                            <span className="text-sm font-semibold text-slate-300">
                                hạng mục ({expandedPendingIds.length} quy trình)
                            </span>
                        </div>

                        <button
                            onClick={handleBulkApprove}
                            disabled={bulkLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/30"
                        >
                            {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Duyệt tất cả
                        </button>

                        <button
                            onClick={handleBulkReject}
                            disabled={bulkLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-60 rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-500/30"
                        >
                            <X className="w-4 h-4" />
                            Từ chối
                        </button>

                        <button
                            onClick={() => setCheckedIds(new Set())}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                            title="Bỏ chọn tất cả"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </GlassCard>
    );
};

export default TaskTable;
