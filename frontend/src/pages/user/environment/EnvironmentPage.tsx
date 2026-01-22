import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../services/api';
import useAutoRefresh from '../../../hooks/useAutoRefresh';
import {
    ChevronDown, ChevronRight, ClipboardList, Briefcase, Network, Workflow,
    AlertCircle, RefreshCw
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import CameraModal from '../../../components/common/CameraModal';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';
import ProjectHeader from '../../../components/environment/ProjectHeader';
import ProjectSelector from '../../../components/environment/ProjectSelector';

// Imported Components
import StationGroup from './components/StationGroup';
import GuidePopup from './components/GuidePopup';
import ImagePreviewModal from './components/ImagePreviewModal';
import OfflineIndicator from '../../../components/common/OfflineIndicator';
import SyncStatusBadge from '../../../components/common/SyncStatusBadge';

// Hooks
import { useOfflineStorage } from '../../../hooks/useOfflineStorage';
import { syncQueue } from '../../../services/offline';

// Types
import { Assign, TaskDetail, StationChildConfig, GuidePopupData, ViewImageData } from './types';

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

// --- Main Content Component ---
const EnvironmentPageContent = () => {
    // GPS Permission
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(() => { }, (err) => console.log("GPS Info:", err), { enableHighAccuracy: true });
        }
    }, []);

    // State
    const [assigns, setAssigns] = useState<Assign[]>([]);
    const [selectedAssignId, setSelectedAssignId] = useState<string>(() => {
        return localStorage.getItem('lastSelectedAssignId') || '';
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedMain, setExpandedMain] = useState<Record<string, boolean>>({});
    const [expandedChild, setExpandedChild] = useState<Record<string, boolean>>({});
    const [expandedStation, setExpandedStation] = useState<Record<string, boolean>>({});
    const [viewImage, setViewImage] = useState<ViewImageData | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    // Lookup Maps (id -> name)
    const [stationMap, setStationMap] = useState<Record<string, string>>({});
    const [childCategoryMap, setChildCategoryMap] = useState<Record<string, { id: string, name: string, id_main_categories?: string }>>({}); // Fixed Type
    const [mainCategoryMap, setMainCategoryMap] = useState<Record<string, string>>({});
    const [processMap, setProcessMap] = useState<Record<string, string>>({});
    const [stationConfigsMap, setStationConfigsMap] = useState<Record<string, StationChildConfig>>({});

    // UI State
    const [guidePopup, setGuidePopup] = useState<GuidePopupData | null>(null);
    const [draftCaptures, setDraftCaptures] = useState<Record<string, (string | Blob)[]>>({});
    const [syncedTasks, setSyncedTasks] = useState<Set<string>>(new Set());
    const [editingTasks, setEditingTasks] = useState<Set<string>>(new Set());
    const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
    const [syncedNotes, setSyncedNotes] = useState<Set<string>>(new Set());

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const captureContext = useRef<{ assignId: string, taskId: string, stage: string } | null>(null);

    // Offline Storage Hook
    const { saveImage, getTaskCaptures, isOnline: syncOnline } = useOfflineStorage();

    // --- Helpers ---
    const getUserId = () => {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr).id : null;
        } catch { return null; }
    };

    // --- Effects (Data Sync) ---
    const fetchTaskEvidence = async (taskId: string) => {
        if (syncedTasks.has(taskId)) return;
        try {
            // Fetch from server
            const res = await api.get(`/monitoring/evidence/${taskId}`);
            const serverEvidence = (res.data && Array.isArray(res.data)) ? res.data : [];

            // Fetch from offline storage
            const offlineEvidence = await getTaskCaptures(taskId);
            const offlineUrls = offlineEvidence.map(c => URL.createObjectURL(c.imageBlob));

            setDraftCaptures(prev => ({
                ...prev,
                [taskId]: [...serverEvidence, ...offlineUrls]
            }));

            setSyncedTasks(prev => new Set(prev).add(taskId));
        } catch (err) {
            console.error("Failed to fetch evidence for", taskId, err);
            setSyncedTasks(prev => new Set(prev).add(taskId)); // Avoid retry spam
        }
    };

    const fetchTaskNote = async (taskId: string) => {
        if (syncedNotes.has(taskId)) return;
        try {
            const res = await api.get(`/monitoring/note/${taskId}`);
            if (res.data && res.data.note) {
                setDraftNotes(prev => ({ ...prev, [taskId]: res.data.note }));
            }
            setSyncedNotes(prev => new Set(prev).add(taskId));
        } catch (err) {
            console.error("Failed to fetch note for", taskId, err);
            setSyncedNotes(prev => new Set(prev).add(taskId));
        }
    };

    // Auto-fetch evidence and notes for submitted/existing tasks
    useEffect(() => {
        assigns.forEach(assign => {
            assign.task_details?.forEach(task => {
                const hasEvidence = task.status_submit === 1; // Or check logic
                if (hasEvidence && !syncedTasks.has(task.id) && !draftCaptures[task.id]) {
                    fetchTaskEvidence(task.id);
                }
                if (!syncedNotes.has(task.id) && !draftNotes[task.id]) {
                    fetchTaskNote(task.id);
                }
            });
        });
    }, [assigns]);

    // Save Note Handler
    const handleSaveNote = useCallback(async (taskId: string, noteContent: string) => {
        // Update local state first for immediate feel (redundant if child handles it, but keeps sync)
        setDraftNotes(prev => ({ ...prev, [taskId]: noteContent }));
        try {
            await api.put('/monitoring/note', { task_details_id: taskId, note: noteContent });
            alert('Chú thích đã được lưu!');
        } catch (err) {
            console.error('Failed to save note:', err);
            alert('Lỗi khi lưu chú thích: ' + err);
        }
    }, []);

    // --- Data Fetching ---
    const fetchData = async () => {
        const userId = getUserId();
        if (!userId) {
            setLoading(false);
            setError("Không tìm thấy thông tin người dùng");
            return;
        }

        try {
            // Parallel Fetch
            const [assignsRes, stationsRes, childCatsRes, mainCatsRes, processesRes, configsRes] = await Promise.all([
                api.get(`/allocations/user/${userId}`),
                api.get('/admin/tables/stations').catch(() => ({ data: [] })),
                api.get('/admin/tables/child_categories').catch(() => ({ data: [] })),
                api.get('/main-categories').catch(() => ({ data: [] })),
                api.get('/admin/tables/process').catch(() => ({ data: [] })),
                api.get('/admin/tables/station_child_configs').catch(() => ({ data: [] }))
            ]);

            const assignsData: Assign[] = Array.isArray(assignsRes.data) ? assignsRes.data : [];
            setAssigns(assignsData);

            // Maps Construction
            const sMap: Record<string, string> = {};
            (stationsRes.data || []).forEach((s: any) => s.id && (sMap[s.id] = s.name || 'Station'));
            setStationMap(sMap);

            const ccMap: Record<string, any> = {};
            (childCatsRes.data || []).forEach((c: any) => c.id && (ccMap[c.id] = c));
            setChildCategoryMap(ccMap);

            const mcMap: Record<string, string> = {};
            (mainCatsRes.data || []).forEach((m: any) => m.id && (mcMap[m.id] = m.name || 'Main Category'));
            setMainCategoryMap(mcMap);

            const pMap: Record<string, string> = {};
            (processesRes.data || []).forEach((p: any) => p.id && (pMap[p.id] = p.name || 'Process'));
            setProcessMap(pMap);

            // Config Map
            const cMap: Record<string, StationChildConfig> = {};
            (configsRes?.data || []).forEach((c: any) => {
                if (c.station_id && c.child_category_id) {
                    const key = `${c.station_id}_${c.child_category_id}`;
                    let imgs: string[] = [];
                    if (Array.isArray(c.guide_images)) imgs = c.guide_images;
                    else if (typeof c.guide_images === 'string') { try { imgs = JSON.parse(c.guide_images) } catch { } }

                    cMap[key] = {
                        id: c.id,
                        station_id: c.station_id,
                        child_category_id: c.child_category_id,
                        guide_text: c.guide_text,
                        guide_images: imgs,
                        image_count: c.image_count
                    };
                }
            });
            setStationConfigsMap(cMap);

            if (assignsData.length > 0) {
                // If we have a saved ID, verify it exists in the new list
                const savedId = localStorage.getItem('lastSelectedAssignId');
                const exists = assignsData.some(a => a.id === savedId);

                if (savedId && exists) {
                    setSelectedAssignId(savedId);
                } else if (!selectedAssignId) {
                    // Fallback to first if no saved ID or saved ID is invalid
                    setSelectedAssignId(assignsData[0].id);
                }
            }
        } catch (err) {
            console.error("Error fetching data:", err);
            setError("Không thể tải danh sách phân công");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Auto-refresh every 5 minutes
    useAutoRefresh(() => fetchData(), 5 * 60 * 1000);

    // Persist Selection Effect
    useEffect(() => {
        if (selectedAssignId) {
            localStorage.setItem('lastSelectedAssignId', selectedAssignId);
        }
    }, [selectedAssignId]);

    // --- Grouping Logic ---
    // Derived Selection
    const selectedAssign = assigns.find(a => a.id === selectedAssignId);
    const taskDetails = selectedAssign?.task_details || [];

    // --- Grouping Logic - Memoized ---
    const groupedTasks = useMemo(() => {
        const grouped: Record<string, Record<string, Record<string, TaskDetail[]>>> = {};

        // Avoid re-grouping if maps aren't ready
        // if (Object.keys(childCategoryMap).length === 0) return grouped; 

        (selectedAssign?.task_details || []).forEach(task => { // Use selectedAssign directly or pass as dependency
            const childCat = childCategoryMap[task.child_category_id || ''];
            const mainCatId = childCat?.id_main_categories || 'unknown';
            const childCatId = task.child_category_id || 'unknown';
            const stationId = task.station_id || 'unknown';

            if (!grouped[mainCatId]) grouped[mainCatId] = {};
            if (!grouped[mainCatId][childCatId]) grouped[mainCatId][childCatId] = {};
            if (!grouped[mainCatId][childCatId][stationId]) grouped[mainCatId][childCatId][stationId] = [];
            grouped[mainCatId][childCatId][stationId].push(task);
        });
        return grouped;
    }, [selectedAssign, childCategoryMap]);

    // --- Handlers ---
    // --- Handlers - Memoized ---
    const openCamera = useCallback(async (assignId: string, taskId: string, stage: string) => {
        captureContext.current = { assignId, taskId, stage };
        if (Capacitor.isNativePlatform()) {
            try {
                const image = await Camera.getPhoto({
                    quality: 60, width: 1024, allowEditing: false, resultType: CameraResultType.DataUrl, source: CameraSource.Camera, saveToGallery: false
                });
                if (image.dataUrl) {
                    const data = [image.dataUrl];
                    handleCameraCapture(data); // Immediate save
                }
            } catch (e) { console.error('Native Camera failed:', e); }
        } else {
            setIsCameraOpen(true);
        }
    }, [/* dependencies if handleCameraCapture is also memoized, otherwise recursive deps. Ideally handleCameraCapture should be first */]);

    const handleCameraCapture = useCallback(async (data: (string | Blob)[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        if (captureContext.current) {
            const { taskId, assignId, stage } = captureContext.current;

            // Save to memory for immediate UI update
            setDraftCaptures(prev => ({
                ...prev,
                [taskId]: [...(prev[taskId] || []), ...data]
            }));

            // Save to offline storage for persistence and background sync
            try {
                for (const item of data) {
                    let blob: Blob;
                    if (typeof item === 'string') {
                        const response = await fetch(item);
                        blob = await response.blob();
                    } else {
                        blob = item;
                    }
                    await saveImage(taskId, assignId, blob, stage);
                }
                console.log('[Offline] Captured images saved to offline storage');
            } catch (err) {
                console.error('[Offline] Failed to save to offline storage:', err);
            }

            setIsCameraOpen(false);
        }
    }, [saveImage]);

    const handleDeleteImage = useCallback(async (taskId: string, item: string | Blob, index: number) => {
        if (!confirm("Bạn có chắc chắn muốn xóa ảnh này?")) return;
        try {
            // Server-side delete
            if (typeof item === 'string' && !item.startsWith('blob:') && item.includes('http')) {
                await api.delete('/monitoring/evidence', {
                    data: { task_details_id: taskId, object_name: item }
                });
            } else {
                // Offline/Local delete
                console.log('[Offline] Deleting local/pending capture');
            }

            setDraftCaptures(prev => {
                const current = prev[taskId] || [];
                const next = [...current];
                next.splice(index, 1);
                return { ...prev, [taskId]: next };
            });
        } catch (err) {
            console.error(err);
            alert("Không thể xóa ảnh: " + err);
        }
    }, []);

    const handleSubmitDraft = useCallback(async (taskId: string, assignId: string) => {
        // 1. Get offline captures for this task
        const offlineCaptures = await getTaskCaptures(taskId);

        // 2. If offline, we can't do much on the server, just inform the user
        if (!navigator.onLine) {
            alert("Đã lưu yêu cầu nộp bài offline. Dữ liệu sẽ được gửi khi có mạng.");
            setEditingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });
            return;
        }

        // 3. If online, trigger a sync now to ensure latest captures are sent
        if (offlineCaptures.length > 0) {
            setLoading(true);
            try {
                // Background sync service handles the POST /monitoring/submit
                const { success, failed } = await syncQueue.processQueue();

                // If failed > 0, we have a problem. 
                // If success == 0, it might mean sync is already in progress (handled by auto-sync) or empty queue.
                // We should only error if we have failures.
                if (failed > 0) {
                    throw new Error(`Có ${failed} ảnh không thể đồng bộ. Vui lòng thử lại.`);
                }
            } catch (err) {
                alert("Lỗi đồng bộ: " + err);
                setLoading(false);
                return;
            }
        }

        // 4. Perform a final "submit" call to update status on server 
        try {
            // Strict ID check with user feedback
            if (!assignId || !taskId) {
                alert(`Lỗi: Thiếu ID. AssignID: ${assignId}, TaskID: ${taskId}`);
                console.error("Missing IDs:", { assignId, taskId });
                return;
            }

            setLoading(true);
            const formData = new FormData();
            formData.append('assign_id', assignId);
            formData.append('task_details_id', taskId);

            // DEBUG LOGGING - Log actual FormData content
            // @ts-ignore
            const formEntries = Array.from(formData.entries());
            console.log("Submitting Draft (Final Payload):", formEntries);

            await api.post('/monitoring/submit', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert("Nộp bài thành công!");
            setEditingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });
            await fetchData(); // Refresh data from server
        } catch (err) {
            console.error("Submit Error:", err);

            // Check if error response helps
            // @ts-ignore
            if (err.response && err.response.data) {
                // @ts-ignore
                console.error("Server Error Details:", err.response.data);
            }

            alert("Lỗi khi nộp bài: " + (err instanceof Error ? err.message : String(err)));
        } finally {
            setLoading(false);
        }
    }, [fetchData, getTaskCaptures]);

    const handleResetTask = useCallback(async (taskId: string) => {
        if (!confirm("Bạn có muốn nộp lại? (Dữ liệu cũ sẽ bị reset)")) return;
        try {
            const formData = new FormData();
            formData.append('task_details_id', taskId);
            await api.post('/monitoring/reset', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setDraftCaptures(prev => { const next = { ...prev }; delete next[taskId]; return next; });
            window.location.reload();
        } catch (err) {
            alert("Lỗi khi reset: " + err);
        }
    }, []);

    // File Input Helper
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && captureContext.current) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (captureContext.current && reader.result) {
                    const { taskId } = captureContext.current;
                    setDraftCaptures(prev => ({
                        ...prev,
                        [taskId]: [...(prev[taskId] || []), reader.result as string]
                    }));
                }
                captureContext.current = null;
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            reader.readAsDataURL(file);
        }
    };

    // Current Guide Config
    const getCurrentConfig = () => {
        if (!captureContext.current || !selectedAssign) return null;
        const { taskId } = captureContext.current;
        const task = selectedAssign.task_details?.find(t => t.id === taskId);
        if (!task || !task.station_id || !task.child_category_id) return null;
        return stationConfigsMap[`${task.station_id}_${task.child_category_id}`];
    };



    if (loading) return (
        <div className="min-h-[50vh] flex items-center justify-center">
            <div className="text-center">
                <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Đang tải dữ liệu...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-[50vh] flex items-center justify-center">
            <GlassCard className="text-center p-8 max-w-md mx-4">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Lỗi</h2>
                <p className="text-slate-600 mb-6">{error}</p>
                <PremiumButton onClick={() => window.location.reload()} variant="primary">Thử lại</PremiumButton>
            </GlassCard>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-4 md:p-6 lg:p-8">
            {/* Offline Indicator */}
            <OfflineIndicator position="bottom" />

            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Briefcase className="w-7 h-7 text-indigo-600" />
                        Môi trường làm việc
                    </h1>
                    <p className="text-slate-500 mt-1">Quản lý và thực hiện công việc được phân công</p>
                </div>
                {/* Sync Status Badge */}
                <SyncStatusBadge />
            </div>

            {assigns.length > 0 && (
                <ProjectSelector
                    assigns={assigns}
                    selectedAssignId={selectedAssignId}
                    onSelect={setSelectedAssignId}
                />
            )}

            {selectedAssign && (
                <ProjectHeader
                    selectedAssign={selectedAssign}
                    taskDetails={taskDetails}
                />
            )}

            {/* Hierarchical Task List */}
            <div className="space-y-4">
                {Object.entries(groupedTasks).map(([mainCatId, childGroups]) => {
                    const mainCatName = mainCategoryMap[mainCatId] || 'Danh mục chính';
                    const isMainExpanded = expandedMain[mainCatId] ?? true;

                    return (
                        <GlassCard key={mainCatId} className="!p-0 overflow-hidden">
                            {/* Main Category Header */}
                            <div
                                onClick={() => setExpandedMain(prev => ({ ...prev, [mainCatId]: !prev[mainCatId] }))}
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/50 transition-colors bg-gradient-to-r from-indigo-50 to-purple-50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500 text-white rounded-lg">
                                        <Network className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-lg">{mainCatName}</h3>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isMainExpanded ? 'rotate-180' : ''}`} />
                            </div>

                            {/* Child Categories */}
                            <AnimatePresence>
                                {isMainExpanded && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        className="border-t border-slate-100"
                                    >
                                        {Object.entries(childGroups).map(([childCatId, stationGroups]) => {
                                            const childCatName = childCategoryMap[childCatId]?.name || 'Danh mục con';
                                            const isChildExpanded = expandedChild[childCatId] ?? true;

                                            return (
                                                <div key={childCatId} className="border-b border-slate-100 last:border-b-0">
                                                    {/* Child Category Header */}
                                                    <div
                                                        onClick={() => setExpandedChild(prev => ({ ...prev, [childCatId]: !prev[childCatId] }))}
                                                        className="p-3 pl-8 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Workflow className="w-4 h-4 text-purple-500" />
                                                            <span className="font-semibold text-slate-700">{childCatName}</span>
                                                        </div>
                                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isChildExpanded ? 'rotate-90' : ''}`} />
                                                    </div>

                                                    {/* Stations */}
                                                    {isChildExpanded && Object.entries(stationGroups).map(([stationId, tasks]) => {
                                                        const stationName = stationMap[stationId] || 'Station';
                                                        const configKey = `${stationId}_${childCatId}`;

                                                        return (
                                                            <StationGroup
                                                                key={stationId}
                                                                stationId={stationId}
                                                                stationName={stationName}
                                                                childCatName={childCatName}
                                                                tasks={tasks}
                                                                isExpanded={expandedStation[stationId] ?? true}
                                                                config={stationConfigsMap[configKey]}
                                                                processMap={processMap}
                                                                draftCaptures={draftCaptures}
                                                                draftNotes={draftNotes}
                                                                editingTasks={editingTasks}
                                                                onToggle={() => setExpandedStation(prev => ({ ...prev, [stationId]: !prev[stationId] }))}
                                                                onGuide={() => {
                                                                    const conf = stationConfigsMap[configKey];
                                                                    if (conf) setGuidePopup({ title: `${stationName} - ${childCatName}`, text: conf.guide_text || '', images: conf.guide_images || [] });
                                                                }}
                                                                onTaskEdit={(tid) => setEditingTasks(prev => new Set(prev).add(tid))}
                                                                onTaskSubmit={(tid) => handleSubmitDraft(tid, selectedAssignId)}
                                                                onTaskCamera={(tid) => openCamera(selectedAssignId, tid, 'execution')}
                                                                onTaskReset={handleResetTask}

                                                                onTaskSaveNote={handleSaveNote}
                                                                onTaskDeleteImage={handleDeleteImage}
                                                                onTaskViewImage={(tid, imgs, idx) => setViewImage({ images: imgs.map(i => typeof i === 'string' ? i : URL.createObjectURL(i)), currentIndex: idx })}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </GlassCard >
                    );
                })}

                {Object.keys(groupedTasks).length === 0 && selectedAssign && (
                    <GlassCard className="text-center py-12">
                        <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-600 mb-2">Chưa có công việc</h3>
                        <p className="text-slate-400">Liên hệ quản lý để được phân công công việc chi tiết</p>
                    </GlassCard>
                )}

                {assigns.length === 0 && !loading && (
                    <GlassCard className="text-center py-12">
                        <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-600 mb-2">Chưa có phân công</h3>
                        <p className="text-slate-400">Bạn chưa được phân công dự án nào</p>
                    </GlassCard>
                )}
            </div>

            {/* Modals */}
            {isCameraOpen && (
                <CameraModal
                    isOpen={isCameraOpen}
                    onClose={() => setIsCameraOpen(false)}
                    onCapture={handleCameraCapture}
                    requiredImageCount={getCurrentConfig()?.image_count || 0}
                    existingImageCount={captureContext.current ? (draftCaptures[captureContext.current.taskId]?.length || 0) : 0}
                />
            )}
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

            <AnimatePresence>
                {guidePopup && <GuidePopup data={guidePopup} onClose={() => setGuidePopup(null)} />}
            </AnimatePresence>

            {ReactDOM.createPortal(
                <AnimatePresence>
                    {viewImage && <ImagePreviewModal viewImage={viewImage} onClose={() => setViewImage(null)} onChangeIndex={(idx) => setViewImage(prev => prev ? { ...prev, currentIndex: idx } : null)} />}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

// Main Export
const EnvironmentPage = () => (
    <ErrorBoundary>
        <EnvironmentPageContent />
    </ErrorBoundary>
);

export default EnvironmentPage;
