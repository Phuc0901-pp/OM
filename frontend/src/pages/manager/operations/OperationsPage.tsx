import { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import api from '../../../services/api';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
    Activity,
    RefreshCw,
    MapPin,
    Zap,
    Users,
    CheckCircle2,
    Clock,
    AlertCircle,
    LayoutGrid,
    FileText,
    Search,
    List,
    X,
    CalendarClock,
    Target,
    BarChart3,
    ChevronRight,
    TrendingUp
} from 'lucide-react';
import OverallStatsCards from '../../../components/operations/OverallStatsCards';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';
import ModernInput from '../../../components/common/ModernInput';
import { AnimatePresence, motion } from 'framer-motion';

interface TaskRow {
    id: string;
    assignId: string;
    projectName: string;
    projectLocation: string;
    userName: string;
    userEmail: string;
    mainCategoryName: string;
    categoryName: string;
    stationName: string | null;
    inverterName: string | null;
    status: string;
    updatedAt: string;
    submittedAt: string | null;
    approvalAt: string | null;
    rejectedAt?: string | null;
    note?: string;
    dataResult?: any; // Using any for JSONB data structure
    check: number;
    accept: number;
    images: string[];
    beforeImages?: string[];
    afterImages?: string[];
    generalImages?: string[];
    beforeNote?: string;
    afterNote?: string;
}

const ManagerOperationsPage = () => {
    const [tasks, setTasks] = useState<TaskRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const fetchTasks = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await api.get('/allocations');
            const data = response.data || [];
            const flattenedTasks: TaskRow[] = [];

            // Helper constants
            const FIXED_QUANTITY_ITEMS = ["Utility Meter Reading", "Inspect for shattered solar panels"];

            data.forEach((assign: any) => {
                const taskDetails = assign.task_details || [];
                const dataResult = assign.data_result || {};
                const dataWork = assign.data_work || {};
                const mainCategories = dataWork.main_categories || [];
                const specs = dataWork.specs || {};

                // Index TaskDetails for fast lookup
                // Key: childId + stationName + inverterName
                const taskMap = new Map<string, any>();
                taskDetails.forEach((t: any) => {
                    // Create composite key
                    const key = `${t.child_category_id}-${t.station_name || ''}-${t.inverter_name || ''}`;
                    taskMap.set(key, t);
                });

                // Helper to add task to list
                const addTask = (childId: string, childName: string, mainName: string, stationName: string | null, inverterName: string | null, index: number) => {
                    // 1. Try find existing task detail
                    const key = `${childId}-${stationName || ''}-${inverterName || ''}`;
                    const existingTask = taskMap.get(key);

                    // 2. Try find DataResult (legacy or local sync)
                    // DataResult is array [childId] -> [ {status, check...}, ... ]
                    let resultItem = null;
                    if (Array.isArray(dataResult[childId]) && dataResult[childId][index]) {
                        resultItem = dataResult[childId][index];
                    }

                    // 3. Determine Status & Data
                    let status = 'pending';
                    let check = 0;
                    let accept = 0;
                    let note = "";
                    let updatedAt = assign.updated_at; // Default to assign time
                    let submittedAt = null;
                    let approvalAt = null;
                    let rejectedAt = null;
                    let imageUrls: string[] = [];
                    let beforeImages: string[] = [];
                    let afterImages: string[] = [];
                    let generalImages: string[] = [];
                    let beforeNote = "";
                    let afterNote = "";

                    // Priority: Existing Task Detail > Result Item > Default
                    if (existingTask) {
                        status = existingTask.status || 'pending';
                        check = existingTask.check || 0;
                        accept = existingTask.accept || 0;
                        note = existingTask.note || "";
                        updatedAt = existingTask.updated_at || updatedAt;
                        submittedAt = existingTask.submitted_at;
                        approvalAt = existingTask.approval_at;
                        rejectedAt = existingTask.rejected_at;

                        // CRITICAL: Use Backend Names if available
                        if (existingTask.station_name) stationName = existingTask.station_name;
                        if (existingTask.inverter_name) inverterName = existingTask.inverter_name;
                    } else if (resultItem) {
                        // Fallback for items synced but not yet in task_details (rare but possible)
                        if (resultItem.status === 'completed' || resultItem.check === 3) {
                            status = 'waiting_approval';
                            check = 3;
                        } else if (resultItem.status === 'in_progress') {
                            status = 'in_progress';
                            check = 1; // approx
                        }
                    }

                    // Extract Images from ResultItem (Source of Truth for Images usually)
                    // If existingTask has image_path, use it? actually DataResult is richer
                    if (resultItem) {
                        if (resultItem.images && Array.isArray(resultItem.images)) {
                            generalImages.push(...resultItem.images);
                            imageUrls.push(...resultItem.images);
                        }
                        const beforeDat = resultItem.before || resultItem.Before;
                        if (beforeDat) {
                            if (Array.isArray(beforeDat.images)) {
                                beforeImages.push(...beforeDat.images);
                                imageUrls.push(...beforeDat.images);
                            }
                            if (beforeDat.note) beforeNote = beforeDat.note;
                        }
                        const afterDat = resultItem.after || resultItem.After;
                        if (afterDat) {
                            if (Array.isArray(afterDat.images)) {
                                afterImages.push(...afterDat.images);
                                imageUrls.push(...afterDat.images);
                            }
                            if (afterDat.note) afterNote = afterDat.note;
                        }
                    } else if (existingTask && existingTask.image_path) {
                        // Legacy single image fallback
                        imageUrls.push(existingTask.image_path);
                    }

                    flattenedTasks.push({
                        id: existingTask?.id || key, // Use composite key if no ID
                        assignId: assign.id,
                        projectName: assign.project?.project_name || 'Unknown Project',
                        projectLocation: assign.project?.location || '',
                        userName: assign.user?.full_name || 'Unknown User',
                        userEmail: assign.user?.email || '',
                        mainCategoryName: mainName,
                        categoryName: childName,
                        stationName: stationName,
                        inverterName: inverterName,
                        status: status,
                        updatedAt: updatedAt,
                        submittedAt: submittedAt,
                        approvalAt: approvalAt,
                        rejectedAt: rejectedAt,
                        note: note,
                        dataResult: resultItem,
                        check: check,
                        accept: accept,
                        images: imageUrls,
                        beforeImages,
                        afterImages,
                        generalImages,
                        beforeNote,
                        afterNote
                    });
                };


                // Iterate Config (Main Categories)
                mainCategories.forEach((mainCat: any) => {
                    if (!mainCat.child_categories) return;

                    mainCat.child_categories.forEach((child: any) => {
                        // 1. Check if we have actual DB tasks for this child
                        // Filter tasks matching this child ID
                        // We need to handle case where tasks have Generated IDs vs Real IDs? 
                        // Actually assign.task_details comes from DB, so they have Real IDs (or created by Sync).

                        const dbTasksForChild = taskDetails.filter((t: any) => {
                            const cID = t.child_category_id || t.child_category?.id;
                            return cID === child.id;
                        });

                        if (dbTasksForChild.length > 0) {
                            // USE DB TASKS AS TRUTH
                            // Sort them if needed? Usually backend order is fine, or sort by index logic?
                            // Station Name / Inverter Name sorting:
                            // We can sort alphanumerically to keep display clean
                            dbTasksForChild.sort((a: any, b: any) => {
                                const sA = a.station_name || "";
                                const sB = b.station_name || "";
                                const iA = a.inverter_name || "";
                                const iB = b.inverter_name || "";
                                return sA.localeCompare(sB, undefined, { numeric: true }) || iA.localeCompare(iB, undefined, { numeric: true });
                            });

                            dbTasksForChild.forEach((t: any) => {
                                addTask(
                                    child.id,
                                    child.name,
                                    mainCat.name,
                                    t.station_name,
                                    t.inverter_name,
                                    0
                                );
                            });

                        } else {
                            // FALLBACK: Generate Theoretical Rows (Old Logic) - ONLY if no DB tasks found
                            // This handles "First Load" before backend sync if sync is lazy (but backend usually syncs on create).

                            // Determine Quantity and Nesting Logic (Same as EnvironmentPage)
                            const nameLower = child.name.toLowerCase();
                            const mainLower = mainCat.name.toLowerCase();

                            // Logic for Nested Structure (Station -> Inverter -> Item)
                            let isNested = false;
                            if (nameLower.includes('dc') && nameLower.includes('measurement') && nameLower.includes('voltage')) isNested = true;
                            else if (nameLower.includes('ac') && nameLower.includes('inverter') && nameLower.includes('check')) isNested = true;
                            else if (mainLower.includes('inverter') && !nameLower.includes('ac connect')) isNested = true;
                            else if (nameLower.includes('dc') && nameLower.includes('wire') && !nameLower.includes('conduit')) isNested = true;

                            const inverterQty = specs?.inverter_qty ? Number(specs.inverter_qty) : 0;
                            const stationSpec = specs?.station_qty ? Number(specs.station_qty) : 0;

                            if (isNested && inverterQty > 0) {
                                // CRITICAL: For "Inverter" category, 'quantity' is Inverter Count, NOT Station Count.
                                // Must not fallback to 'quantity' if stationSpec is missing.
                                let stationCount = stationSpec > 0 ? stationSpec : (Number(child.quantity) || 1);
                                if (mainLower.includes('inverter') && stationSpec <= 0) {
                                    stationCount = 1;
                                }
                                for (let s = 1; s <= stationCount; s++) {
                                    for (let i = 1; i <= inverterQty; i++) {
                                        const flatIndex = ((s - 1) * inverterQty) + (i - 1);
                                        addTask(child.id, child.name, mainCat.name, `Station ${s}`, `Inverter ${i}`, flatIndex);
                                    }
                                }
                            } else {
                                const qty = FIXED_QUANTITY_ITEMS.includes(child.name) ? 1 : (Number(child.quantity) || 1);
                                for (let i = 0; i < qty; i++) {
                                    let sName: string | null = `Station ${i + 1}`;
                                    let iName: string | null = null;
                                    addTask(child.id, child.name, mainCat.name, sName, iName, i);
                                }
                            }
                        }
                    });
                });
            });

            flattenedTasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setTasks(flattenedTasks);

            // Auto-select first project if none selected
            if (!selectedProjectName && flattenedTasks.length > 0) {
                // Logic to pick the project with most action or first one
                setSelectedProjectName(flattenedTasks[0].projectName);
            }

        } catch (err) {
            console.error("Failed to fetch operational tasks:", err);
            setMessage({ type: 'error', text: 'Lỗi tải danh sách công việc' });
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        // Clock Interval
        const clockInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        fetchTasks();
        const interval = setInterval(() => {
            fetchTasks(true);
        }, 300000); // 5 minutes

        return () => {
            clearInterval(clockInterval);
            clearInterval(interval);
        };
    }, []);

    const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectNote, setRejectNote] = useState('');

    const handleSync = async (assignId: string) => {
        setSyncing(true);
        try {
            await api.post(`/allocations/${assignId}/sync`);
            await fetchTasks(true);
            alert("Đồng bộ dữ liệu thành công!");
        } catch (error) {
            console.error(error);
            alert("Lỗi đồng bộ dữ liệu");
        } finally {
            setSyncing(false);
        }
    };

    const ensureTaskExists = async (task: TaskRow): Promise<string | null> => {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.id);
        if (isUUID) return task.id;

        if (!task.assignId) {
            alert("Lỗi: Không tìm thấy thông tin phân bổ.");
            return null;
        }

        setMessage({ type: 'success', text: 'Đang đồng bộ dữ liệu hệ thống (lần đầu)...' });
        try {
            const res = await api.post(`/allocations/${task.assignId}/sync`);
            const updatedAssign = res.data;
            if (updatedAssign && updatedAssign.task_details) {
                const matchingTask = updatedAssign.task_details.find((t: any) => {
                    const cID = t.child_category_id || t.child_category?.id;
                    const sNameMatch = (t.station_name || "") === (task.stationName || "");
                    const iNameMatch = (t.inverter_name || "") === (task.inverterName || "");
                    const originalChildId = task.id.split('-')[0];
                    return cID === originalChildId && sNameMatch && iNameMatch;
                });
                if (matchingTask) return matchingTask.id;
            }

            await fetchTasks(true);
            return null;
        } catch (error) {
            console.error("Auto-sync failed", error);
            alert("Lỗi: Không thể đồng bộ dữ liệu. Vui lòng thử nút 'Đồng bộ' thủ công.");
            return null;
        }
    };

    const handleUpdateStatus = async (taskId: string, acceptStatus: number) => {
        if (acceptStatus === -1) {
            setIsRejectModalOpen(true);
            setRejectNote('');
            return;
        }

        if (!confirm("Duyệt công việc này?")) return;

        let realId = taskId;
        let targetTask = selectedTask;
        if (!targetTask || targetTask.id !== taskId) {
            targetTask = tasks.find(t => t.id === taskId) || null;
        }

        if (targetTask) {
            const verifiedId = await ensureTaskExists(targetTask);
            if (!verifiedId) return;
            realId = verifiedId;
        }

        try {
            await api.put(`/task-details/${realId}/status`, { accept: acceptStatus, note: "" });
            await fetchTasks(true);
            setSelectedTask(null);
            setMessage({ type: 'success', text: 'Đã duyệt công việc.' });
        } catch (error) {
            console.error(error);
            alert("Có lỗi xảy ra khi duyệt.");
        }
    };




    const confirmRejection = async () => {
        if (!selectedTask) return;

        const realId = await ensureTaskExists(selectedTask);
        if (!realId) {
            alert("Không thể tìm thấy hoặc tạo công việc trên hệ thống.");
            return;
        }

        try {
            await api.put(`/task-details/${realId}/status`, { accept: -1, note: rejectNote });
            await fetchTasks(true);
            setSelectedTask(null);
            setIsRejectModalOpen(false);
            setMessage({ type: 'success', text: 'Đã từ chối công việc.' });
        } catch (error) {
            console.error(error);
            alert("Có lỗi xảy ra");
        }
    };

    // --- Computed Data ---
    // 1. Pending Review Tasks (High Priority)
    const pendingReviewTasks = useMemo(() => {
        return tasks.filter(t => t.check === 3 && t.accept === 0);
    }, [tasks]);

    // 2. Project List & Stats
    const projectStats = useMemo(() => {
        const stats: Record<string, { total: number, completed: number, pending: number, location: string }> = {};
        tasks.forEach(t => {
            const pName = t.projectName;
            if (!stats[pName]) stats[pName] = { total: 0, completed: 0, pending: 0, location: t.projectLocation };
            stats[pName].total++;
            if (t.accept === 1) stats[pName].completed++;
            if (t.check === 3 && t.accept === 0) stats[pName].pending++;
        });
        return Object.entries(stats).map(([name, stat]) => ({ name, ...stat })).sort((a, b) => b.pending - a.pending); // Prioritize projects with pending tasks
    }, [tasks]);

    // 3. Filtered Project Tasks (for Right Panel)
    const currentProjectTasks = useMemo(() => {
        if (!selectedProjectName) return [];
        return tasks.filter(t =>
            t.projectName === selectedProjectName &&
            (t.categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.userName.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [tasks, selectedProjectName, searchTerm]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium animate-pulse">Đang tải dữ liệu vận hành...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-mesh-light font-inter p-3 md:p-6 space-y-6 md:space-y-8">
            {/* Notification Toast */}
            <AnimatePresence>
                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: -20, x: "-50%" }}
                        className={`fixed top-24 left-1/2 z-[60] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md border ${message.type === 'success'
                            ? 'bg-emerald-600/90 text-white border-emerald-500 shadow-emerald-500/20'
                            : 'bg-rose-600/90 text-white border-rose-500 shadow-rose-500/20'
                            }`}
                    >
                        {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-bold text-sm">{message.text}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <GlassCard className="sticky top-2 md:top-4 z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 !p-4 md:!p-6 !bg-white/80 !backdrop-blur-xl border-white/40 shadow-xl shadow-slate-200/50">
                <div>
                    <h1 className="text-xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-primary-600 to-indigo-600 rounded-xl shadow-lg shadow-primary-500/30">
                            <Activity className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                            Vận hành & Giám sát
                        </span>
                    </h1>
                    <div className="flex items-center gap-2 text-slate-500 mt-2 text-sm font-medium pl-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        <Clock className="w-3.5 h-3.5" />
                        <span>Hệ thống: <span className="text-slate-700 font-bold tabular-nums">{currentTime.toLocaleTimeString('vi-VN')}</span></span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end mr-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái</span>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                            <Zap className="w-3 h-3 fill-emerald-500" /> Hoạt động tốt
                        </span>
                    </div>
                    {/* Sync Button */}
                    <PremiumButton
                        onClick={async () => {
                            setLoading(true);
                            try {
                                const res = await api.post('/allocations/sync-all');
                                setMessage({ type: 'success', text: `Đồng bộ hoàn tất: ${res.data.success_count} thành công.` });
                                await fetchTasks(false);
                            } catch (err) {
                                setMessage({ type: 'error', text: 'Lỗi đồng bộ dữ liệu.' });
                            } finally {
                                setLoading(false);
                            }
                        }}
                        variant="secondary"
                        icon={<RefreshCw className="w-5 h-5" />}
                        title="Đồng bộ dữ liệu MinIO"
                    >
                        <span className="hidden md:inline">Đồng bộ</span>
                    </PremiumButton>

                    <button
                        onClick={() => fetchTasks(false)}
                        className="p-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-primary-600 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/10 transition-all duration-300 shadow-sm group active:scale-95"
                    >
                        <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
                    </button>
                </div>
            </GlassCard>

            {/* Dashboard Overview Charts */}
            <OverallStatsCards tasks={tasks} />

            {/* PENDING REVIEW SECTION (High Priority) */}
            <AnimatePresence>
                {pendingReviewTasks.length > 0 && (
                    <GlassCard className="relative overflow-hidden !border-amber-200/50 !bg-gradient-to-br !from-white/90 !to-amber-50/50">
                        <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-12 -translate-y-6 pointer-events-none">
                            <AlertCircle className="w-48 h-48 text-amber-500" />
                        </div>

                        <div className="relative z-10">
                            <div className="px-4 py-4 md:px-8 md:py-6 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-2xl shadow-lg shadow-amber-300/50 animate-pulse">
                                        <AlertCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Cần phê duyệt ngay</h2>
                                        <p className="text-sm font-medium text-slate-500 mt-1">Các hạng mục đã nộp đang chờ xác nhận.</p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md text-amber-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm border border-amber-100/50">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                                    </span>
                                    {pendingReviewTasks.length} yêu cầu
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-amber-50/30 border-b border-amber-100/50">
                                        <tr>
                                            <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Dự án</th>
                                            <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Hạng mục</th>
                                            <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Nhân sự</th>
                                            <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Thời gian chờ</th>
                                            <th className="px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider text-center">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-amber-100/30">
                                        {pendingReviewTasks.map(task => (
                                            <tr key={task.id} className="hover:bg-amber-50/40 transition-all duration-200 group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-1 h-8 bg-amber-400 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
                                                        <span className="text-sm font-bold text-slate-700">{task.projectName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <h3 className="text-sm font-bold text-slate-800">{task.categoryName}</h3>
                                                    <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5">
                                                        <span className="w-1 lg:w-1.5 h-1 lg:h-1.5 rounded-full bg-slate-300"></span>
                                                        {task.stationName} {task.inverterName ? `— ${task.inverterName}` : ''}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-white border border-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-700 shadow-sm">
                                                            {task.userName.charAt(0)}
                                                        </div>
                                                        <span className="text-sm font-semibold text-slate-600">{task.userName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        {task.submittedAt ? (
                                                            <>
                                                                <span className="text-sm font-bold text-amber-600 bg-amber-50/80 w-fit px-2 py-0.5 rounded-md border border-amber-100">
                                                                    {formatDistanceToNow(new Date(task.submittedAt), { addSuffix: true, locale: vi })}
                                                                </span>
                                                                <span className="text-[10px] font-semibold text-slate-400 mt-1 pl-1">
                                                                    {format(new Date(task.submittedAt), 'dd/MM/yyyy HH:mm')}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">-</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <PremiumButton
                                                        onClick={() => setSelectedTask(task)}
                                                        size="sm"
                                                        className="!rounded-lg !px-4 !py-2 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                                                    >
                                                        Kiểm tra
                                                    </PremiumButton>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </GlassCard>
                )}
            </AnimatePresence>

            {/* MAIN CONTENT SPLIT VIEW */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
                {/* Left: Project List (3 Cols) */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="flex items-center justify-between mb-1 pl-1">
                        <h3 className="font-extrabold text-slate-700 flex items-center gap-2 uppercase tracking-wide text-xs">
                            <List className="w-4 h-4 text-primary-500" /> Danh sách dự án
                        </h3>
                    </div>

                    <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1 custom-scrollbar pb-4">
                        {projectStats.map(p => {
                            const isSelected = selectedProjectName === p.name;
                            const percentage = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;

                            return (
                                <GlassCard
                                    key={p.name}
                                    onClick={() => setSelectedProjectName(p.name)}
                                    className={`!p-5 cursor-pointer transition-all duration-300 group ${isSelected
                                        ? '!bg-gradient-to-br !from-primary-600 !to-indigo-600 !border-transparent ring-2 ring-primary-500/30 ring-offset-2'
                                        : 'hover:!bg-white/80 hover:!border-primary-200 hover:translate-x-1'
                                        }`}
                                >
                                    {isSelected && (
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                                    )}

                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                        <h4 className={`font-bold text-sm tracking-tight ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                            {p.name}
                                        </h4>
                                        {p.pending > 0 && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse ${isSelected ? 'bg-amber-400 text-amber-900 shadow-amber-900/10' : 'bg-amber-50 text-amber-600 border border-amber-100'
                                                }`}>
                                                {p.pending} chờ
                                            </span>
                                        )}
                                    </div>

                                    <div className={`text-xs mb-4 flex items-center gap-1.5 font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                        <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-200' : 'text-slate-300'}`} />
                                        {p.location}
                                    </div>

                                    {/* Progress Bar */}
                                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${isSelected ? 'bg-black/20' : 'bg-slate-100'}`}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentage}%` }}
                                            transition={{ duration: 1, ease: "easeOut" }}
                                            className={`h-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}
                                        />
                                    </div>

                                    <div className={`mt-2.5 flex justify-between text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                        <span>{p.completed}/{p.total} Hoàn thành</span>
                                        <span>{percentage}%</span>
                                    </div>
                                </GlassCard>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Task Details (9 Cols) */}
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
                                                {currentProjectTasks.length} hạng mục trong danh sách
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
                                                <th className="px-3 py-3 md:px-6 md:py-4">Hạng mục</th>
                                                <th className="px-3 py-3 md:px-6 md:py-4">Nhà trạm/ Inverter</th>
                                                <th className="px-3 py-3 md:px-6 md:py-4">Nhân sự</th>
                                                <th className="px-3 py-3 md:px-6 md:py-4 hidden md:table-cell">Ngày nộp</th>
                                                <th className="px-3 py-3 md:px-6 md:py-4 hidden md:table-cell">Ngày duyệt/từ chối</th>
                                                <th className="px-3 py-3 md:px-6 md:py-4 text-right">Trạng thái</th>
                                                <th className="px-3 py-3 md:px-6 md:py-4 text-center">Chi tiết</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            <AnimatePresence>
                                                {currentProjectTasks.map((task, index) => {
                                                    // Calculate latest action date
                                                    let latestActionDate: string | null = null;
                                                    let actionResult: 'approved' | 'rejected' | null = null;

                                                    if (task.approvalAt && task.rejectedAt) {
                                                        const approvalTime = new Date(task.approvalAt).getTime();
                                                        const rejectedTime = new Date(task.rejectedAt).getTime();
                                                        if (approvalTime > rejectedTime) {
                                                            latestActionDate = task.approvalAt;
                                                            actionResult = 'approved';
                                                        } else {
                                                            latestActionDate = task.rejectedAt;
                                                            actionResult = 'rejected';
                                                        }
                                                    } else if (task.approvalAt) {
                                                        latestActionDate = task.approvalAt;
                                                        actionResult = 'approved';
                                                    } else if (task.rejectedAt) {
                                                        latestActionDate = task.rejectedAt;
                                                        actionResult = 'rejected';
                                                    }

                                                    return (
                                                        <motion.tr
                                                            key={task.id}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: index * 0.03 }}
                                                            className="hover:bg-slate-50/80 group transition-all duration-200"
                                                        >
                                                            <td className="px-3 py-3 md:px-6 md:py-4">
                                                                <div className="text-sm font-bold text-slate-700 group-hover:text-primary-700 transition-colors">{task.mainCategoryName}</div>
                                                                <div className="text-xs text-slate-500 font-medium mt-0.5">{task.categoryName}</div>
                                                            </td>
                                                            <td className="px-3 py-3 md:px-6 md:py-4">
                                                                <div className="flex flex-col gap-1 text-xs">
                                                                    {task.stationName && <span className="font-semibold text-slate-600 flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-500"></span> {task.stationName}</span>}
                                                                    {task.inverterName && <span className="text-slate-500 pl-3 border-l-2 border-slate-100 ml-0.5">{task.inverterName}</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 md:px-6 md:py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 group-hover:bg-primary-100 group-hover:text-primary-600 transition-colors">
                                                                        {task.userName.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-semibold text-slate-700">{task.userName}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 md:px-6 md:py-4 hidden md:table-cell text-xs">
                                                                {task.submittedAt ? (
                                                                    <span className="font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{format(new Date(task.submittedAt), 'dd/MM/yyyy HH:mm')}</span>
                                                                ) : <span className="text-slate-300 italic">-</span>}
                                                            </td>
                                                            <td className="px-3 py-3 md:px-6 md:py-4 hidden md:table-cell text-xs text-slate-600">
                                                                {latestActionDate ? (
                                                                    <span className="font-medium">{format(new Date(latestActionDate), 'dd/MM/yyyy HH:mm')}</span>
                                                                ) : (
                                                                    <span className="text-slate-300 italic">-</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-3 md:px-6 md:py-4 text-right">
                                                                <div className="flex justify-end">
                                                                    {task.accept === 1 ? (
                                                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 tracking-wide">
                                                                            <CheckCircle2 className="w-3 h-3" /> Approved
                                                                        </div>
                                                                    ) : task.accept === -1 ? (
                                                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 tracking-wide">
                                                                            <AlertCircle className="w-3 h-3" /> Changes Req
                                                                        </div>
                                                                    ) : task.check === 3 ? (
                                                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 shadow-sm animate-pulse tracking-wide">
                                                                            <Clock className="w-3 h-3" /> Reviewing
                                                                        </div>
                                                                    ) : (task.check === 1 || task.check === 2) ? (
                                                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 tracking-wide">
                                                                            <Activity className="w-3 h-3" /> In Progress
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Pending</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 md:px-6 md:py-4 text-center">
                                                                <button
                                                                    onClick={() => setSelectedTask(task)}
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
                </GlassCard>
            </div>

            {/* Rejection Modal - Premium Glass Design */}
            <AnimatePresence>
                {isRejectModalOpen && selectedTask && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <GlassCard className="w-full max-w-lg overflow-hidden flex flex-col !p-0 animation-zoom-in">
                            <div className="px-8 py-6 bg-gradient-to-r from-red-50 to-white border-b border-red-100 flex justify-between items-center">
                                <h3 className="font-extrabold text-xl text-red-600 flex items-center gap-3">
                                    <div className="p-2 bg-red-100 rounded-xl">
                                        <AlertCircle className="w-5 h-5 text-red-600" />
                                    </div>
                                    Từ chối / Yêu cầu sửa
                                </h3>
                                <button onClick={() => setIsRejectModalOpen(false)} className="text-red-400 hover:text-red-600 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-slate-600">
                                    Bạn đang từ chối hạng mục con <strong className="text-slate-900">{selectedTask.categoryName}</strong>/<strong className="text-slate-900">{selectedTask.mainCategoryName}</strong> ở dự án <strong className="text-slate-900">{selectedProjectName}</strong> của <strong className="text-slate-900">{selectedTask.userName}</strong>.
                                    <br />Vui lòng nhập lý do hoặc yêu cầu chỉnh sửa:
                                </p>
                                <textarea
                                    value={rejectNote}
                                    onChange={(e) => setRejectNote(e.target.value)}
                                    placeholder="Ví dụ: Hình ảnh bị mờ, chưa chụp tem inverter..."
                                    className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none text-sm transition-all"
                                    autoFocus
                                />
                            </div>
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
                                <PremiumButton
                                    variant="secondary"
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="!bg-white !border-slate-300 !text-slate-600 hover:!bg-slate-50 hover:!text-slate-800"
                                >
                                    Hủy bỏ
                                </PremiumButton>
                                <PremiumButton
                                    variant="danger"
                                    onClick={confirmRejection}
                                    disabled={!rejectNote.trim()}
                                    className="shadow-red-200"
                                >
                                    Xác nhận từ chối
                                </PremiumButton>
                            </div>
                        </GlassCard>
                    </div>
                )}
            </AnimatePresence>

            {/* Task Details Modal Content - Using Portal to overlay sidebar */}
            {selectedTask && !isRejectModalOpen && ReactDOM.createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                        <GlassCard className="w-full max-w-4xl max-h-[90vh] flex flex-col !p-0 animation-slide-up relative">
                            {/* Header */}
                            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md z-10 flex-shrink-0">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{selectedTask.categoryName}</h2>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${selectedTask.accept === 1 ? 'bg-green-50 text-green-700 border-green-200' :
                                            selectedTask.accept === -1 ? 'bg-red-50 text-red-700 border-red-200' :
                                                selectedTask.check === 3 ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                                                    'bg-blue-50 text-blue-700 border-blue-200'
                                            }`}>
                                            {selectedTask.accept === 1 ? 'Đã duyệt' :
                                                selectedTask.accept === -1 ? 'Đã từ chối' :
                                                    selectedTask.check === 3 ? 'Chờ duyệt' : 'Đang thực hiện'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 font-medium">
                                        <span className="flex items-center gap-1.5"><List className="w-4 h-4 text-indigo-500" /> {selectedTask.mainCategoryName}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                        {selectedTask.stationName && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-emerald-500" /> {selectedTask.stationName}</span>}
                                        {selectedTask.inverterName && <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> {selectedTask.inverterName}</span>}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedTask(null)}
                                    className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Content Scrollable */}
                            <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    {/* Info Panel */}
                                    <div className="space-y-4">
                                        <GlassCard className="!p-5 !bg-slate-50/50 !border-slate-100">
                                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                                <Users className="w-4 h-4 text-indigo-500" /> Thông tin nhân sự
                                            </h3>
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-200">
                                                    {selectedTask.userName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">{selectedTask.userName}</div>
                                                    <div className="text-sm text-slate-500">{selectedTask.userEmail}</div>
                                                </div>
                                            </div>
                                        </GlassCard>

                                        <GlassCard className="!p-5 !bg-slate-50/50 !border-slate-100">
                                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                                <CalendarClock className="w-4 h-4 text-indigo-500" /> Thời gian
                                            </h3>
                                            <div className="space-y-4 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-500">Ngày nộp báo cáo</span>
                                                    <span className="font-bold text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">{selectedTask.submittedAt ? format(new Date(selectedTask.submittedAt), 'dd/MM/yyyy HH:mm') : '-'}</span>
                                                </div>
                                                {selectedTask.approvalAt && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500">Ngày phê duyệt</span>
                                                        <span className="font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-100">{format(new Date(selectedTask.approvalAt), 'dd/MM/yyyy HH:mm')}</span>
                                                    </div>
                                                )}
                                                {selectedTask.rejectedAt && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500">Ngày từ chối</span>
                                                        <span className="font-bold text-red-700 bg-red-50 px-2 py-1 rounded-md border border-red-100">{format(new Date(selectedTask.rejectedAt), 'dd/MM/yyyy HH:mm')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </GlassCard>

                                        {/* Note Display if Rejected/Approved with note */}
                                        {selectedTask.note && (
                                            <div className={`p-5 rounded-2xl border ${selectedTask.accept === -1 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                                <h4 className={`font-bold mb-2 flex items-center gap-2 text-sm uppercase tracking-wide ${selectedTask.accept === -1 ? 'text-red-700' : 'text-slate-700'}`}>
                                                    <FileText className="w-4 h-4" /> Ghi chú {selectedTask.accept === -1 ? 'từ chối' : ''}
                                                </h4>
                                                <p className="text-sm text-slate-600 leading-relaxed italic">
                                                    "{selectedTask.note}"
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Images Panel */}
                                    <div className="space-y-3">
                                        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide px-1">
                                            <LayoutGrid className="w-4 h-4 text-indigo-500" /> Hình ảnh & Ghi chú
                                        </h3>

                                        {(() => {
                                            const dr = selectedTask.dataResult as any;
                                            const getStageData = (stage: string) => {
                                                const data = dr?.[stage] || dr?.[stage.charAt(0).toUpperCase() + stage.slice(1)];
                                                let imgs: string[] = [];
                                                if (data?.images && Array.isArray(data.images)) {
                                                    imgs = data.images.filter((i: any) => typeof i === 'string');
                                                }
                                                return {
                                                    images: imgs,
                                                    note: data?.note as string || ''
                                                };
                                            };
                                            const before = getStageData('before');
                                            const after = getStageData('after');
                                            const generalImages = selectedTask.generalImages || [];
                                            const hasBefore = before.images.length > 0;
                                            const hasAfter = after.images.length > 0;
                                            const hasGeneral = !hasBefore && !hasAfter && generalImages.length > 0;
                                            const isEmpty = !hasBefore && !hasAfter && !hasGeneral;

                                            return (
                                                <>
                                                    {/* Before Images Section */}
                                                    {hasBefore && (
                                                        <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
                                                            <h4 className="font-bold text-amber-800 text-xs uppercase mb-3 flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-amber-500"></div> TRƯỚC KHI LÀM
                                                            </h4>
                                                            {before.note && (
                                                                <div className="mb-4 p-3 bg-white rounded-xl border border-amber-100 text-sm text-slate-600 italic shadow-sm">
                                                                    "{before.note}"
                                                                </div>
                                                            )}
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                                {before.images.map((img: string, idx: number) => (
                                                                    <div key={`before-${idx}`} className="group relative rounded-lg overflow-hidden cursor-zoom-in border border-amber-200 shadow-sm hover:shadow-md transition-all">
                                                                        <img src={img} alt={`Before ${idx}`} className="w-full h-24 md:h-28 object-cover transition-transform duration-500 group-hover:scale-110" />
                                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* After Images Section */}
                                                    {hasAfter && (
                                                        <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                                                            <h4 className="font-bold text-emerald-800 text-xs uppercase mb-3 flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div> SAU KHI LÀM
                                                            </h4>
                                                            {after.note && (
                                                                <div className="mb-4 p-3 bg-white rounded-xl border border-emerald-100 text-sm text-slate-600 italic shadow-sm">
                                                                    "{after.note}"
                                                                </div>
                                                            )}
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                                {after.images.map((img: string, idx: number) => (
                                                                    <div key={`after-${idx}`} className="group relative rounded-lg overflow-hidden cursor-zoom-in border border-emerald-200 shadow-sm hover:shadow-md transition-all">
                                                                        <img src={img} alt={`After ${idx}`} className="w-full h-24 md:h-28 object-cover transition-transform duration-500 group-hover:scale-110" />
                                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* General Images (Fallback) */}
                                                    {hasGeneral && (
                                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 min-h-[200px]">
                                                            <h4 className="font-bold text-slate-700 text-xs uppercase mb-3">Hình ảnh chung</h4>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {generalImages.map((img: string, idx: number) => (
                                                                    <div key={`general-${idx}`} className="group relative aspect-square rounded-xl overflow-hidden cursor-zoom-in border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                                                        <img src={img} alt={`General ${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Empty State */}
                                                    {isEmpty && (
                                                        <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 min-h-[300px] flex flex-col items-center justify-center text-slate-400 border-dashed">
                                                            <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                                                                <LayoutGrid className="w-8 h-8 text-slate-300" />
                                                            </div>
                                                            <span className="text-sm font-medium">Chưa có hình ảnh nào được tải lên</span>
                                                            {selectedTask.dataResult && (
                                                                <div className="mt-4 p-2 w-full bg-slate-100 rounded text-xs text-left overflow-auto max-h-40 font-mono text-slate-500">
                                                                    <p className="font-bold mb-1">Debug Info:</p>
                                                                    <pre>{JSON.stringify(selectedTask.dataResult, null, 2)}</pre>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Actions Footer - Floating Style */}
                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 flex-shrink-0">
                                <PremiumButton
                                    variant={selectedTask.accept === -1 ? 'danger' : 'secondary'}
                                    onClick={() => handleUpdateStatus(selectedTask.id, -1)}
                                    className={`flex-1 ${selectedTask.accept === -1 ? 'ring-4 ring-red-100' : ''}`}
                                >
                                    <AlertCircle className="w-5 h-5" />
                                    {selectedTask.accept === -1 ? 'Đã từ chối' : 'Từ chối / Yêu cầu sửa'}
                                </PremiumButton>
                                <PremiumButton
                                    variant={selectedTask.accept === 1 ? 'primary' : 'primary'}
                                    onClick={() => handleUpdateStatus(selectedTask.id, 1)}
                                    className={`flex-1 ${selectedTask.accept === 1 ? 'ring-4 ring-emerald-100 !bg-emerald-600 hover:!bg-emerald-700' : '!bg-emerald-600 hover:!bg-emerald-700'}`}
                                >
                                    <CheckCircle2 className="w-5 h-5" />
                                    {selectedTask.accept === 1 ? 'Đã duyệt hoàn thành' : 'Duyệt hoàn thành'}
                                </PremiumButton>
                            </div>
                        </GlassCard>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};
export default ManagerOperationsPage;
