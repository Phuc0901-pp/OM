import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../services/api';
import {
    Save, ChevronDown, ChevronRight, Clock, AlertCircle, ClipboardList, X, Trash2, RefreshCw, MapPin, Calendar, CheckCircle2,
    Camera as CameraIcon,
    ArrowRight
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import CameraModal from '../../../components/common/CameraModal';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';
import ModernInput from '../../../components/common/ModernInput';

// --- Variants ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
};

// --- Constants ---
const FIXED_QUANTITY_ITEMS = ["Utility Meter Reading", "Inspect for shattered solar panels"];
const toSnakeCase = (str: string): string => {
    const match = str && str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g);
    return match ? match.map((x) => x.toLowerCase()).join('_') : '';
};

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[50vh] flex items-center justify-center">
                    <GlassCard className="text-center p-8 max-w-md mx-4">
                        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Có lỗi xảy ra</h2>
                        <p className="text-slate-600 mb-6">Chúng tôi gặp sự cố khi tải trang này.</p>
                        <PremiumButton onClick={() => window.location.reload()} variant="primary">
                            Tải lại trang
                        </PremiumButton>
                    </GlassCard>
                </div>
            );
        }
        return this.props.children;
    }
}

// --- Interfaces ---
interface WorkItem {
    name: string;
    id: string;
    quantity: string;
}

interface MainCategory {
    name: string;
    id: string;
    num: string;
    child_categories: WorkItem[];
}

interface StageData {
    image?: string;
    images?: string[];
    note?: string;
    timestamp?: string;
}

interface Allocation {
    id: string;
    project_id: string;
    id_project: string;
    project: { project_name: string; location: string };
    classification: { name: string };
    data_work: {
        timestamp: string;
        main_categories: MainCategory[];
        specs?: {
            inverter_qty?: number | string;
            station_qty?: number | string;
        };
    };
    data_result?: Record<string, ItemResult>;
    task_details?: TaskDetail[];
    note?: string;
}

interface TaskDetail {
    id: string;
    child_category_id: string;
    station_name: string;
    inverter_name: string;
    status: string;
    check: number;
    accept: number;
    note: string;
    image_path: string;
}

interface ItemResult {
    before?: StageData;
    after?: StageData;
    status: 'pending' | 'in_progress' | 'completed' | 'waiting_for_approval' | 'editing' | 'approved';
    lastAction?: string;
    lastActionTime?: string;
    check?: number; // 1-7
    task_id?: string;
    station_name?: string;
    inverter_name?: string;
}

// --- Main Content Component ---
const EnvironmentPageContent = () => {
    // GPS Permission
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(() => { }, (err) => console.log("GPS Info:", err), { enableHighAccuracy: true });
        }
    }, []);

    // State
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [selectedAllocationId, setSelectedAllocationId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<Record<string, ItemResult | ItemResult[]>>({});
    const [expandedMain, setExpandedMain] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [characteristics, setCharacteristics] = useState<any>(null);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const captureContext = useRef<{ childId: string, index: number, stage: 'before' | 'after' } | null>(null);

    // --- Helpers ---
    const getUserId = () => {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr).id : null;
        } catch { return null; }
    };

    const loadResults = (alloc: Allocation) => {
        let currentResults: Record<string, any> = {};
        try {
            const saved = localStorage.getItem(`env_draft_${alloc.id}`);
            currentResults = saved ? JSON.parse(saved) : (alloc.data_result || {});
        } catch { currentResults = alloc.data_result || {}; }

        // Merge with Task Details (Source of Truth for IDs)
        if (alloc.task_details && alloc.task_details.length > 0) {
            // Group by Child Category
            const detailsMap: Record<string, TaskDetail[]> = {};
            alloc.task_details.forEach(td => {
                if (!detailsMap[td.child_category_id]) detailsMap[td.child_category_id] = [];
                detailsMap[td.child_category_id].push(td);
            });

            // Iterate and Merge
            Object.keys(detailsMap).forEach(childId => {
                const tasks = detailsMap[childId];
                // Natural Sort (Must match Render Logic)
                tasks.sort((a, b) => {
                    const nameA = (a.station_name || '') + (a.inverter_name || '');
                    const nameB = (b.station_name || '') + (b.inverter_name || '');
                    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                });

                // Ensure result list exists
                if (!currentResults[childId]) currentResults[childId] = [];
                if (!Array.isArray(currentResults[childId])) currentResults[childId] = [currentResults[childId]];

                // Map IDs
                tasks.forEach((task, idx) => {
                    if (!currentResults[childId][idx]) {
                        currentResults[childId][idx] = { status: 'pending' };
                    }
                    // Inject Identity
                    currentResults[childId][idx].task_id = task.id;
                    currentResults[childId][idx].station_name = task.station_name;
                    currentResults[childId][idx].inverter_name = task.inverter_name;

                    // Sync Status if pending in local but approved in DB
                    if (task.status === 'completed' || task.check === 3) {
                        // Optional: Sync check status back to UI if missing
                    }
                });
            });
        }
        return currentResults;
    };

    // --- Effects ---
    useEffect(() => {
        const fetchData = async () => {
            const userId = getUserId();
            if (!userId) { setLoading(false); return; }

            try {
                const [allocRes, projRes] = await Promise.all([
                    api.get(`/allocations/user/${userId}`),
                    api.get('/projects')
                ]);

                const projectsMap = new Map();
                if (Array.isArray(projRes.data)) {
                    projRes.data.forEach((p: any) => projectsMap.set(p.project_id, p));
                }

                const mappedAllocations: Allocation[] = (Array.isArray(allocRes.data) ? allocRes.data : []).map((alloc: any) => {
                    // Normalize images array
                    if (alloc.data_result) {
                        const migratedResult = { ...alloc.data_result };
                        Object.keys(migratedResult).forEach(key => {
                            const item = migratedResult[key];
                            if (!item) return;
                            ['before', 'after'].forEach(stage => {
                                if (item[stage]) {
                                    if (!item[stage].images) item[stage].images = [];
                                    if (item[stage].image && item[stage].images.length === 0) item[stage].images.push(item[stage].image);
                                }
                            });
                        });
                        alloc.data_result = migratedResult;
                    }

                    // Map Project Info
                    if (!alloc.project && alloc.id_project) {
                        const found = projectsMap.get(alloc.id_project);
                        if (found) {
                            return { ...alloc, project: { project_name: found.project_name, location: found.location } };
                        }
                    }
                    return alloc;
                });

                setAllocations(mappedAllocations);
                if (mappedAllocations.length > 0) {
                    setSelectedAllocationId(mappedAllocations[0].id);
                    setResults(loadResults(mappedAllocations[0]));
                }
            } catch (error) {
                console.error("Error fetching data", error);
                setError("Không thể tải danh sách phân công");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedAllocationId && Object.keys(results).length > 0) {
            localStorage.setItem(`env_draft_${selectedAllocationId}`, JSON.stringify(results));
        }
    }, [results, selectedAllocationId]);

    // Fetch Characteristics
    useEffect(() => {
        const fetchCharacteristics = async () => {
            const alloc = allocations.find(a => a.id === selectedAllocationId);
            if (alloc?.id_project) {
                try {
                    const res = await api.get(`/projects/${alloc.id_project}/characteristics`);
                    setCharacteristics(res.data);
                } catch (e) {
                    console.error("Failed to fetch characteristics", e);
                    setCharacteristics(null);
                }
            } else {
                setCharacteristics(null);
            }
        };
        fetchCharacteristics();
    }, [selectedAllocationId, allocations]);

    // --- Handlers ---
    const handleSelectAllocation = (id: string) => {
        setSelectedAllocationId(id);
        const alloc = allocations.find(a => a.id === id);
        setResults(alloc ? loadResults(alloc) : {});
    };

    const toggleMain = (id: string) => setExpandedMain(prev => ({ ...prev, [id]: !prev[id] }));

    const handleInputChange = (childId: string, index: number, stage: 'before' | 'after', field: 'note' | 'image', value: string) => {
        setResults(prev => {
            const currentItem = prev[childId];
            const itemList = Array.isArray(currentItem) ? currentItem : (currentItem ? [currentItem] : []);
            while (itemList.length <= index) itemList.push({ status: 'pending', check: 0 });

            const activeItem = itemList[index] || { status: 'pending', check: 0 };
            const currentStage = activeItem[stage] || { images: [] };

            let updatedStage = { ...currentStage, timestamp: new Date().toISOString() };
            let actionDesc = '';

            if (field === 'note') {
                updatedStage.note = value;
                actionDesc = stage === 'before' ? 'Cập nhật ghi chú (Trước)' : 'Cập nhật ghi chú (Sau)';
            } else {
                updatedStage.images = [...(currentStage.images || []), value];
                actionDesc = stage === 'before' ? 'Thêm ảnh (Trước)' : 'Thêm ảnh (Sau)';
            }

            let newCheck = activeItem.check || 0;
            let newStatus = activeItem.status;

            const hasBefore = stage === 'before' ? (updatedStage.images?.length || 0) > 0 : (activeItem.before?.images?.length || 0) > 0;
            const hasAfter = stage === 'after' ? (updatedStage.images?.length || 0) > 0 : (activeItem.after?.images?.length || 0) > 0;

            if (newCheck !== 7) { // Assuming 7 is Approved/Locked
                if (hasAfter) { newCheck = 2; newStatus = 'in_progress'; }
                else if (hasBefore) { newCheck = 1; newStatus = 'in_progress'; }
                else { newCheck = 0; newStatus = 'pending'; }
            }

            const updatedActiveItem: ItemResult = {
                ...activeItem,
                [stage]: updatedStage,
                status: newStatus,
                check: newCheck,
                lastAction: actionDesc,
                lastActionTime: new Date().toISOString()
            };

            const updatedList = [...itemList];
            updatedList[index] = updatedActiveItem;
            return { ...prev, [childId]: updatedList as any };
        });
    };

    const handleSubmitItem = async (childId: string, index: number) => {
        if (!selectedAllocationId) return;
        setSaving(true);
        try {
            // Optimistic Update
            setResults(prev => {
                const currentItem = prev[childId];
                if (!currentItem) return prev;
                const itemList = Array.isArray(currentItem) ? currentItem : [currentItem];
                if (!itemList[index]) return prev;

                const updatedActiveItem: ItemResult = {
                    ...itemList[index],
                    status: 'waiting_for_approval',
                    check: 3,
                    lastAction: 'Đã nộp',
                    lastActionTime: new Date().toISOString()
                };
                const updatedList = [...itemList];
                updatedList[index] = updatedActiveItem;
                return { ...prev, [childId]: updatedList as any };
            });

            // Prepare Data for API (since state update is async)
            const currentItem = results[childId];
            const itemList = Array.isArray(currentItem) ? currentItem : (currentItem ? [currentItem] : []);
            while (itemList.length <= index) itemList.push({ status: 'pending', check: 0 });

            const updatedItem = {
                ...itemList[index],
                status: 'waiting_for_approval',
                check: 3,
                lastAction: 'Đã nộp',
                lastActionTime: new Date().toISOString()
            };
            const updatedList = [...itemList];
            updatedList[index] = updatedItem as ItemResult;

            await saveProgress({ ...results, [childId]: updatedList });
            alert("Đã nộp thành công! Chờ duyệt.");
        } catch (error) {
            console.error("Submit failed", error);
            alert("Nộp thất bại. Vui lòng thử lại.");
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveImage = (childId: string, index: number, stage: 'before' | 'after', imageIndex: number) => {
        setResults(prev => {
            const currentItem = prev[childId];
            if (!currentItem) return prev;
            const itemList = Array.isArray(currentItem) ? currentItem : [currentItem];
            const activeItem = itemList[index];
            if (!activeItem || !activeItem[stage]?.images) return prev; // Safety

            const newImages = activeItem[stage]!.images!.filter((_, idx) => idx !== imageIndex);
            const updatedActiveItem = { ...activeItem, [stage]: { ...activeItem[stage], images: newImages } };
            const updatedList = [...itemList];
            updatedList[index] = updatedActiveItem as ItemResult;
            return { ...prev, [childId]: updatedList as any };
        });
    };

    const saveProgress = async (currentResults?: Record<string, ItemResult | ItemResult[]>) => {
        if (!selectedAllocationId) return;
        setSaving(true);
        try {
            const response = await api.put(`/allocations/${selectedAllocationId}/progress`, currentResults || results);
            if (response.data) setResults(response.data);
            localStorage.removeItem(`env_draft_${selectedAllocationId}`);
            if (!currentResults) alert("Lưu tiến độ thành công!"); // Only alert if manual save
        } catch (error) {
            console.error("Save failed", error);
            if (!currentResults) alert("Lưu thất bại.");
        } finally {
            setSaving(false);
        }
    };

    const syncProgress = async () => {
        if (!selectedAllocationId) return;
        setSaving(true);
        try {
            const response = await api.post(`/allocations/${selectedAllocationId}/sync`);
            if (response.data) setResults(response.data);
            alert("Đồng bộ dữ liệu thành công!");
        } catch (error) {
            console.error("Sync failed", error);
            alert("Đồng bộ thất bại.");
        } finally {
            setSaving(false);
        }
    };

    // --- Camera Handling ---
    const openCamera = async (childId: string, index: number, stage: 'before' | 'after') => {
        captureContext.current = { childId, index, stage };
        if (Capacitor.isNativePlatform()) {
            try {
                const image = await Camera.getPhoto({
                    quality: 60, width: 1024, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Camera, saveToGallery: false
                });
                if (image.dataUrl) handleInputChange(childId, index, stage, 'image', image.dataUrl);
            } catch (e) { console.error('Native Camera failed:', e); }
        } else {
            setIsCameraOpen(true);
        }
    };

    const handleCameraCapture = (data: string | Blob) => {
        if (typeof data !== 'string') return; // Ignore video/blob for now

        if (captureContext.current) {
            const { childId, index, stage } = captureContext.current;
            handleInputChange(childId, index, stage, 'image', data);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && captureContext.current) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const { childId, index, stage } = captureContext.current!;
                handleInputChange(childId, index, stage, 'image', reader.result as string);
                captureContext.current = null;
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Renders ---
    if (loading) return <div className="h-[50vh] flex items-center justify-center"><div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div></div>;
    if (error) return <GlassCard className="m-4 text-center text-red-500 p-8"> <AlertCircle className="w-12 h-12 mx-auto mb-2" />{error}</GlassCard>;
    if (allocations.length === 0) return <GlassCard className="m-4 text-center text-slate-500 p-12"> <ClipboardList className="w-16 h-16 mx-auto mb-4 text-slate-300" /> <h2 className="text-xl font-bold">Không tìm thấy công việc</h2></GlassCard>;

    const selectedAllocation = allocations.find(a => a.id === selectedAllocationId)!; // Safe bang because we handle length check above
    const mainCategories = selectedAllocation.data_work?.main_categories || [];

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-8 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-display font-black text-slate-800 tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                        Thực địa
                    </h1>
                    <p className="text-slate-500 font-medium">Kiểm tra & Báo cáo hiện trường</p>
                </div>

                {/* Project List / Selector */}
                <div className="w-full md:w-2/3 grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {allocations.map(a => {
                        const isSelected = a.id === selectedAllocationId;
                        return (
                            <GlassCard
                                key={a.id}
                                className={`
                                    !p-4 cursor-pointer transition-all duration-300 group
                                    ${isSelected ? 'border-indigo-500/30 ring-2 ring-indigo-500/10' : 'hover:border-indigo-200'}
                                `}
                                onClick={() => handleSelectAllocation(a.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`
                                        w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300
                                        ${isSelected
                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white scale-110'
                                            : 'bg-white text-indigo-500 group-hover:scale-110'
                                        }
                                    `}>
                                        <ClipboardList className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-bold text-lg truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                            {a.project?.project_name}
                                        </h3>
                                        <div className="flex items-center gap-3 text-xs font-medium text-slate-500 mt-1">
                                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {a.project?.location}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(a.data_work.timestamp).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center animate-scale-in">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                    )}
                                </div>
                            </GlassCard>
                        );
                    })}
                </div>
            </div>

            {/* Active Project Details & Actions */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={selectedAllocationId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                >
                    <GlassCard className="relative overflow-hidden !border-indigo-100/50">
                        {/* Background Glow */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-indigo-500/10 to-purple-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />

                        <div className="flex flex-col md:flex-row items-start justify-between gap-6 relative z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
                                    {selectedAllocation.project?.project_name}
                                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-wider rounded-lg border border-indigo-100">
                                        {selectedAllocation.classification?.name}
                                    </span>
                                </h2>
                                <div className="flex flex-wrap items-center gap-4 text-slate-500 text-sm">
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/50 rounded-lg border border-white/40">
                                        <MapPin className="w-4 h-4 text-indigo-500" /> {selectedAllocation.project?.location}
                                    </span>
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/50 rounded-lg border border-white/40">
                                        <Clock className="w-4 h-4 text-indigo-500" /> {new Date(selectedAllocation.data_work.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                                {selectedAllocation.note && (
                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="block text-xs font-bold uppercase text-amber-600 mb-0.5">Ghi chú từ quản lý:</span>
                                            <p className="font-medium text-sm leading-relaxed">{selectedAllocation.note}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <PremiumButton
                                    onClick={() => saveProgress()}
                                    loading={saving}
                                    variant="primary"
                                    icon={<Save className="w-4 h-4" />}
                                    className="flex-1 md:flex-none"
                                >
                                    Lưu tiến độ
                                </PremiumButton>
                                <PremiumButton
                                    onClick={syncProgress}
                                    loading={saving}
                                    variant="glass"
                                    icon={<RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />}
                                    className="flex-1 md:flex-none"
                                >
                                    Đồng bộ
                                </PremiumButton>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>
            </AnimatePresence>

            {/* Checklist */}
            <div className="space-y-4">
                {mainCategories.map((mainCat, idx) => {
                    const isExpanded = expandedMain[mainCat.id] === true;
                    // Logic for Progress Bar
                    const childCats = mainCat.child_categories || [];
                    const childIds = new Set(childCats.map(c => c.id));
                    const relevantTasks = selectedAllocation.task_details?.filter(td => childIds.has(td.child_category_id)) || [];
                    let totalItems = relevantTasks.length;
                    let completedItems = relevantTasks.filter(td => td.accept === 1).length;

                    // Fallback logic
                    if (totalItems === 0 && childCats.length > 0) {
                        totalItems = childCats.length;
                        completedItems = childCats.filter(c => {
                            const r = results[c.id];
                            return Array.isArray(r) ? (r.every(i => i?.status === 'completed') && r.length >= Number(c.quantity || 1)) : r?.status === 'completed';
                        }).length;
                    }

                    return (
                        <GlassCard key={mainCat.id || idx} className="!p-0 overflow-hidden">
                            {/* Accordion Header */}
                            <div
                                onClick={() => toggleMain(mainCat.id)}
                                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-white/40 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg transition-transform duration-300 ${isExpanded ? 'bg-indigo-50 rotate-90 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                                        <ChevronRight className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-lg">{mainCat.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hạng mục: {mainCat.num}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress */}
                                <div className="flex items-center gap-4 w-full md:w-auto pl-12 md:pl-0">
                                    <div className="flex-1 md:w-32 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                                            style={{ width: totalItems > 0 ? `${(completedItems / totalItems) * 100}%` : '0%' }}
                                        />
                                    </div>
                                    <span className="text-sm font-bold text-slate-600 min-w-[3rem] text-right">
                                        {completedItems}/{totalItems}
                                    </span>
                                </div>
                            </div>

                            {/* Accordion Body */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-slate-100 bg-slate-50/30"
                                    >
                                        <div className="p-4 space-y-6">
                                            {childCats.map(child => {
                                                const rawResult = results[child.id];
                                                const resultList = Array.isArray(rawResult) ? rawResult : (rawResult ? [rawResult] : []);

                                                // Extract Note
                                                const childKey = toSnakeCase(child.name);
                                                const childNote = characteristics?.child_category_data?.[childKey]?.note;

                                                // --- NEW LOGIC: Use Task Details ---
                                                const childTasks = selectedAllocation.task_details?.filter(td => td.child_category_id === child.id) || [];

                                                if (childTasks.length > 0) {
                                                    // Natural Sort (e.g. Mái 1, Mái 2, Mái 10)
                                                    childTasks.sort((a, b) => {
                                                        const nameA = (a.station_name || '') + (a.inverter_name || '');
                                                        const nameB = (b.station_name || '') + (b.inverter_name || '');
                                                        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                                                    });

                                                    return (
                                                        <div key={child.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                                            <h4 className="font-bold text-slate-700 text-lg flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                                                <span>{child.name}</span>
                                                                {childNote && <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{childNote}</span>}
                                                            </h4>
                                                            <div className="space-y-4">
                                                                {childTasks.map((task, idx) => {
                                                                    const itemResult = resultList[idx] || { status: 'pending' };

                                                                    // Construct Label
                                                                    let label = task.station_name || '';
                                                                    if (task.inverter_name) label += ` - ${task.inverter_name}`;
                                                                    if (!label) label = `Item ${idx + 1}`;

                                                                    return renderTaskItem(child, idx, itemResult, task, label);
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // --- FALLBACK LOGIC (Legacy) ---
                                                const quantity = FIXED_QUANTITY_ITEMS.includes(child.name) ? 1 : Number(child.quantity || 1);
                                                const nameLower = child.name.toLowerCase();
                                                const mainLower = mainCat.name.toLowerCase();
                                                let isNested = false;
                                                if (nameLower.includes('dc') && nameLower.includes('measurement') && nameLower.includes('voltage')) isNested = true;
                                                else if (nameLower.includes('ac') && nameLower.includes('inverter') && nameLower.includes('check')) isNested = true;
                                                else if (mainLower.includes('inverter') && !nameLower.includes('ac connect')) isNested = true;
                                                else if (nameLower.includes('dc') && nameLower.includes('wire') && !nameLower.includes('conduit')) isNested = true;

                                                const specs = selectedAllocation.data_work?.specs;
                                                let inverterQty = specs?.inverter_qty ? Number(specs.inverter_qty) : 0;
                                                const stationSpec = specs?.station_qty ? Number(specs.station_qty) : 0;

                                                // Render Nested Fallback
                                                if (isNested && inverterQty > 0) {
                                                    let stationCount = stationSpec > 0 ? stationSpec : quantity;
                                                    if (mainLower.includes('inverter') && stationSpec <= 0) stationCount = 1;

                                                    return Array.from({ length: stationCount }).map((_, stationIdx) => (
                                                        <div key={`${child.id}-station-${stationIdx}`} className="bg-white/50 rounded-2xl border border-indigo-100 p-4 md:p-6 shadow-sm">
                                                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-indigo-50">
                                                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-200">S{stationIdx + 1}</div>
                                                                <h4 className="text-xl font-bold text-slate-800">Nhà trạm {stationIdx + 1} - {child.name}</h4>
                                                            </div>
                                                            <div className="space-y-6">
                                                                {Array.from({ length: inverterQty }).map((_, invIdx) => {
                                                                    const index = (stationIdx * inverterQty) + invIdx;
                                                                    const itemResult = resultList[index] || { status: 'pending' };
                                                                    return renderTaskItem(child, index, itemResult, null, `Inverter ${invIdx + 1}`);
                                                                })}
                                                            </div>
                                                        </div>
                                                    ));
                                                }

                                                // Render Default Fallback
                                                return (
                                                    <div key={child.id} className="space-y-4">
                                                        <h4 className="font-bold text-slate-700 text-lg flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                                            <span>{child.name}</span>
                                                            {childNote && <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{childNote}</span>}
                                                        </h4>
                                                        <div className="space-y-4">
                                                            {Array.from({ length: quantity }).map((_, idx) => {
                                                                const itemResult = resultList[idx] || { status: 'pending' };
                                                                return renderTaskItem(child, idx, itemResult, null, `${mainCat.name.toLowerCase().includes('inverter') ? 'Inverter' : 'Nhà trạm'} ${idx + 1}`);
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </GlassCard>
                    );
                })}
            </div>

            {/* Modals & Inputs */}
            <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleCameraCapture} />
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
            {viewImage && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setViewImage(null)}>
                    <button className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"><X className="w-6 h-6" /></button>
                    <img src={viewImage} className="max-w-[85vw] max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                </div>,
                document.body
            )}
        </div>
    );

    // --- Render Item Helper ---
    function renderTaskItem(child: any, index: number, result: ItemResult, taskDetail: any, label: string) {
        const checkStatus = result?.check || taskDetail?.check || 0;

        let status: { text: string; color: string; icon: any } = { text: 'CHƯA LÀM', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: null };
        if (taskDetail?.accept === 1) status = { text: 'ĐÃ DUYỆT', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
        else if (taskDetail?.accept === -1) status = { text: 'YÊU CẦU SỬA', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle };
        else if (checkStatus === 3 || result?.status === 'waiting_for_approval') status = { text: 'CHỜ DUYỆT', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock };
        else if (checkStatus === 1 || checkStatus === 2 || result?.status === 'in_progress') status = { text: 'ĐANG LÀM', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: RefreshCw };

        const hasBefore = (result?.before?.images?.length || 0) > 0;
        const hasAfter = (result?.after?.images?.length || 0) > 0;
        const isReady = hasBefore && hasAfter && !['ĐÃ NỘP', 'ĐÃ DUYỆT', 'CHỜ DUYỆT'].includes(status.text);

        return (
            <div key={`${child.id}-${index}`} className={`bg-white rounded-xl border p-4 transition-all duration-300 ${taskDetail?.accept === -1 ? 'border-red-300 shadow-red-100 shadow-lg' : 'border-slate-200 shadow-sm hover:shadow-md'}`}>
                {/* Item Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-500 uppercase tracking-wider">{label}</span>
                            {result?.lastAction && (
                                <span className="text-xs font-normal text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(result.lastActionTime!).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isReady && (
                            <PremiumButton onClick={() => handleSubmitItem(child.id, index)} size="sm" variant="primary" icon={<CheckCircle2 className="w-3 h-3" />}>
                                Nộp
                            </PremiumButton>
                        )}
                        <div className={`px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-wider flex items-center gap-2 ${status.color}`}>
                            {status.icon && <status.icon className="w-3 h-3" />}
                            {status.text}
                        </div>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {['before', 'after'].map((stage) => (
                        <div key={stage} className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${stage === 'before' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {stage === 'before' ? '1' : '2'}
                                </div>
                                <span className="font-bold text-slate-700 text-sm uppercase">{stage === 'before' ? 'Trước khi làm' : 'Sau khi làm'}</span>
                            </div>

                            {/* Images */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {(result?.[stage as 'before' | 'after']?.images || []).map((img: string, i: number) => (
                                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                        <img src={img} className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform duration-500" onClick={() => setViewImage(img)} />
                                        <button
                                            onClick={() => handleRemoveImage(child.id, index, stage as 'before' | 'after', i)}
                                            className="absolute top-1 right-1 p-1 bg-white/90 text-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => openCamera(child.id, index, stage as 'before' | 'after')}
                                    className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${stage === 'before' ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-600' : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-600'}`}
                                >
                                    <CameraIcon className="w-6 h-6" />
                                    <span className="text-[10px] font-bold uppercase">Chụp</span>
                                </button>
                            </div>

                            <textarea
                                placeholder="Thêm ghi chú..."
                                value={result?.[stage as 'before' | 'after']?.note || ''}
                                onChange={e => handleInputChange(child.id, index, stage as 'before' | 'after', 'note', e.target.value)}
                                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all resize-none h-20"
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    }
};

const EnvironmentPage = () => <ErrorBoundary><EnvironmentPageContent /></ErrorBoundary>;
export default EnvironmentPage;
