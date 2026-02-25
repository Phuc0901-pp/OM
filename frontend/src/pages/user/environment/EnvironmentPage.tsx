import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import {
    Briefcase, AlertCircle, RefreshCw
} from 'lucide-react';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';
import ProjectHeader from '../../../components/environment/ProjectHeader';
import ProjectSelector from '../../../components/environment/ProjectSelector';
import QuickActionBar from '../../../components/environment/QuickActionBar';
import CheckInModal, { CheckInPhotos } from '../../../components/CheckInModal';

// Imported Components
import GuidePopup from './components/GuidePopup';
import ImagePreviewModal from './components/ImagePreviewModal';
import OfflineSyncStatus from '../../../components/environment/OfflineSyncStatus';
import CameraManager from '../../../components/environment/CameraManager';
import TaskHierarchy from '../../../components/environment/TaskHierarchy';

import { getImageUrl } from '../../../utils/imageUtils';

// Hooks
import { useOfflineStorage } from '../../../hooks/useOfflineStorage';
import { useLanguage } from '../../../context/LanguageContext';
import { useEnvironmentData } from '../../../hooks/useEnvironmentData';
import { syncQueue } from '../../../services/offline';
import { useDeviceLocation } from '../../../hooks/useDeviceLocation';
import { getUserId } from '../../../utils/userUtils';

// Types
import { GuidePopupData, ViewImageData } from './types';

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

    // Custom Hook for Data
    const {
        assigns,
        loading,
        error,
        selectedAssignId,
        setSelectedAssignId,
        stationMap,
        childCategoryMap,
        mainCategoryMap,
        processMap,
        stationConfigsMap,
        selectedAssign,
        taskDetails,
        refreshData
    } = useEnvironmentData();

    // UI State
    const [expandedMain, setExpandedMain] = useState<Record<string, boolean>>({});
    const [expandedChild, setExpandedChild] = useState<Record<string, boolean>>({});
    const [expandedStation, setExpandedStation] = useState<Record<string, boolean>>({});
    const [viewImage, setViewImage] = useState<ViewImageData | null>(null);

    // Camera Manager Ref
    const cameraManagerRef = React.useRef<{ openCamera: (aid: string, tid: string, stage: string) => Promise<void>; fileInputRef: React.RefObject<HTMLInputElement> }>(null);

    // UI State - Interactions
    const [guidePopup, setGuidePopup] = useState<GuidePopupData | null>(null);
    const [draftCaptures, setDraftCaptures] = useState<Record<string, (string | Blob)[]>>({});
    const [syncedTasks, setSyncedTasks] = useState<Set<string>>(new Set());
    const [editingTasks, setEditingTasks] = useState<Set<string>>(new Set());
    const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
    const [syncedNotes, setSyncedNotes] = useState<Set<string>>(new Set());

    // Attendance State
    const [attendance, setAttendance] = useState<{
        date_checkin?: string;
        date_checkout?: string;
        checkout_requested?: boolean;
        checkout_approved?: boolean;
        checkout_approved_time?: string;
    } | null>(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);

    // Navigation & Location
    const navigate = useNavigate();
    const { location: deviceLocation } = useDeviceLocation({ immediate: true, enableHighAccuracy: true });

    // Offline Storage Hook
    const { saveImage, getTaskCaptures } = useOfflineStorage();
    const { t } = useLanguage();

    // --- Effects (Data Sync) ---
    const fetchTaskEvidence = useCallback(async (taskId: string) => {
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
    }, [syncedTasks, getTaskCaptures]);

    const fetchTaskNote = useCallback(async (taskId: string) => {
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
    }, [syncedNotes]);

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
    }, [assigns, fetchTaskEvidence, fetchTaskNote, syncedTasks, draftCaptures, syncedNotes, draftNotes]);

    // Save Note Handler
    const handleSaveNote = useCallback(async (taskId: string, noteContent: string) => {
        setDraftNotes(prev => ({ ...prev, [taskId]: noteContent }));
        try {
            await api.put('/monitoring/note', { task_details_id: taskId, note: noteContent });
            alert('Chú thích đã được lưu!');
        } catch (err) {
            console.error('Failed to save note:', err);
            alert('Lỗi khi lưu chú thích: ' + err);
        }
    }, []);

    // --- Attendance Logic ---
    const fetchTodayAttendance = useCallback(async () => {
        const userId = getUserId();
        if (!userId) return;
        try {
            const res = await api.get(`/attendance/today/${userId}`);
            setAttendance(res.data);
        } catch {
            setAttendance(null);
        }
    }, []);

    useEffect(() => { fetchTodayAttendance(); }, [fetchTodayAttendance]);

    const handleCheckInSubmit = async (photos: CheckInPhotos) => {
        const userId = getUserId();
        if (!userId) return;
        setAttendanceLoading(true);
        try {
            const res = await api.post('/attendance/checkin-with-photos', {
                user_id: userId,
                project_id: selectedAssign?.id_project,
                ...photos,
                address: deviceLocation?.address || ''
            });
            setAttendance(res.data);
            setShowCheckInModal(false);
            alert('Check-in thành công!');
        } catch {
            alert('Lỗi khi check-in. Vui lòng thử lại.');
        } finally {
            setAttendanceLoading(false);
        }
    };

    const handleCheckoutSubmit = async (photos: CheckInPhotos) => {
        const userId = getUserId();
        if (!userId) return;
        setAttendanceLoading(true);
        try {
            const res = await api.post('/attendance/request-checkout', {
                user_id: userId,
                ...photos,
                address: deviceLocation?.address || ''
            });
            setAttendance(res.data);
            setShowCheckoutModal(false);
            alert('Yêu cầu check-out đã được gửi! Vui lòng đợi manager duyệt.');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Lỗi khi yêu cầu check-out.');
        } finally {
            setAttendanceLoading(false);
        }
    };

    // --- Components / Handlers ---

    // Grouping Logic - Memoized
    const groupedTasks = useMemo(() => {
        const grouped: Record<string, Record<string, Record<string, any[]>>> = {};

        (selectedAssign?.task_details || []).forEach(task => {
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

    // Capture Handler (Passed to CameraManager)
    const onCapture = useCallback(async (data: (string | Blob)[]) => {
        // This logic needs to know WHICH task we captured for.
        // CameraManager holds the ref context? Or should we pass it here?
        // In the previous code, handleCameraCapture used captureContext.current
        // But CameraManager has its own captureContext.

        // Wait! CameraManager is calling onCapture with data.
        // It should probably also handle the SAVE to storage/state?
        // Or pass the taskID back?
        // Let's look at CameraManager again. 
        // CameraManager has `captureContext`. But it calls `props.onCapture(data)`.
        // It doesn't pass back the taskId. 
        // We should update CameraManager to pass back the context or handle the state update itself?
        // No, parent manages state `draftCaptures`.

        // Refactor: We need to know the context here. 
        // Strategy: Let's assume CameraManager handles the Capture -> onCapture flow 
        // but we need to know for WHICH task.
        // Let's modify CameraManager to pass `captureContext.current` content along with data?
        // Or cleaner: Keep `captureContext` here in parent?
        // Yes, let's keep `captureContext` here to avoid dup state or complex passing.
    }, []);

    // RE-STRATEGY for Camera: 
    // To minimize complex refactoring, let's keep `captureContext` in `EnvironmentPage` 
    // and pass it (or a setter) to `CameraManager`?
    // Actually, `CameraManager` was designed to be independent.
    // Let's go back to basics.
    // `EnvironmentPage` knows about `draftCaptures` state.
    // `CameraManager` knows about Camera API.
    // When `openCamera(taskId)` is called, we store `taskId` in `captureContext`.
    // When `onCapture(data)` happens, we utilize `captureContext` to update state.

    const captureContext = React.useRef<{ assignId: string, taskId: string, stage: string } | null>(null);

    const handleCameraCapture = useCallback(async (data: (string | Blob)[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        if (captureContext.current) {
            const { taskId, assignId, stage } = captureContext.current;

            // Save to memory
            setDraftCaptures(prev => ({
                ...prev,
                [taskId]: [...(prev[taskId] || []), ...data]
            }));

            // Offline Save
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
            } catch (err) {
                console.error('[Offline] Failed to save:', err);
            }
        }
    }, [saveImage]);

    // This function is passed to TaskHierarchy -> calls CameraManager.open
    const handleOpenCamera = useCallback(async (taskId: string) => {
        // We need assignId. selectedAssignId is available.
        if (selectedAssignId) {
            // Update Context
            captureContext.current = { assignId: selectedAssignId, taskId, stage: 'execution' };
            // Trigger UI in CameraManager
            cameraManagerRef.current?.openCamera(selectedAssignId, taskId, 'execution');

            // Note: CameraManager needs to call `handleCameraCapture` when done.
            // But CameraManager has its own `captureContext`...
            // Let's make sure we align this.
            // If I use `ref` to call `openCamera` on CameraManager, CameraManager sets its OWN context.
            // Then calls `props.onCapture`.
            // So `handleCameraCapture` here DOES NOT need `captureContext` if CameraManager passes it back?
            // Currently CameraManager onCapture only returns `data`.
            // FIX: Use `captureContext` in Parent (Here) and just tell CameraManager to "Open".
            // CameraManager doesn't need to know TaskID if it just returns data.
            // Wait, CameraManager needs to know TaskID? No, just "Open UI".
            // So: 
            // 1. Parent sets `captureContext.current = { taskId... }`
            // 2. Parent calls `cameraManagerRef.current.open()` (just visual)
            // 3. CameraManager captures -> calls `props.onCapture(data)`
            // 4. Parent `onCapture` uses `captureContext.current` to save.
            // This works!
        }
    }, [selectedAssignId]);


    const handleDeleteImage = useCallback(async (taskId: string, item: string | Blob, index: number) => {
        const isServerImage = typeof item === 'string' && !item.startsWith('blob:');
        const confirmMessage = isServerImage
            ? "CẢNH BÁO: Ảnh sẽ bị xóa vĩnh viễn khỏi hệ thống!\n\nBạn có chắc chắn muốn xóa?"
            : "Bạn có chắc chắn muốn xóa ảnh này?";

        if (!confirm(confirmMessage)) return;

        try {
            if (isServerImage) {
                let objectName = item;
                if (item.includes('key=')) {
                    try {
                        const queryString = item.split('?')[1];
                        const params = new URLSearchParams(queryString);
                        const key = params.get('key');
                        if (key) objectName = key;
                    } catch (e) { console.error(e); }
                }

                await api.delete('/monitoring/evidence', {
                    data: { task_details_id: taskId, object_name: objectName }
                });
            }

            setDraftCaptures(prev => {
                const current = prev[taskId] || [];
                const next = [...current];
                next.splice(index, 1);
                return { ...prev, [taskId]: next };
            });

            if (isServerImage) await refreshData();

        } catch (err: any) {
            console.error('[Delete] Error:', err);
            alert("Không thể xóa ảnh: " + (err?.response?.data?.error || err.message || err));
        }
    }, [refreshData]);

    const handleSubmitDraft = useCallback(async (taskId: string, assignId: string) => {
        const offlineCaptures = await getTaskCaptures(taskId);

        if (!navigator.onLine) {
            alert("Đã lưu yêu cầu nộp bài offline. Dữ liệu sẽ được gửi khi có mạng.");
            setEditingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });
            return;
        }

        if (offlineCaptures.length > 0) {
            // Trigger Sync
            try {
                const { failed } = await syncQueue.processQueue();
                if (failed > 0) throw new Error(`Có ${failed} ảnh không thể đồng bộ.`);
            } catch (err) {
                alert("Lỗi đồng bộ: " + err);
                return;
            }
        }

        try {
            if (!assignId || !taskId) {
                alert(`Lỗi: Thiếu ID. AssignID: ${assignId}, TaskID: ${taskId}`);
                return;
            }

            const formData = new FormData();
            formData.append('assign_id', assignId);
            formData.append('task_details_id', taskId);

            await api.post('/monitoring/submit', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert("Nộp bài thành công!");
            setEditingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });

            // Clear local state to force re-fetch of server images
            setDraftCaptures(prev => {
                const next = { ...prev };
                delete next[taskId];
                return next;
            });
            setSyncedTasks(prev => {
                const next = new Set(prev);
                next.delete(taskId);
                return next;
            });

            await refreshData();
        } catch (err: unknown) {
            console.error("Submit Error:", err);
            alert("Lỗi khi nộp bài: " + (err instanceof Error ? err.message : String(err)));
        }
    }, [refreshData, getTaskCaptures]);

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

    // Get Current Config Helper (for CameraManager prop)
    const getCurrentConfig = useCallback(() => {
        if (!captureContext.current || !selectedAssign) return undefined;
        const { taskId } = captureContext.current;
        const task = selectedAssign.task_details?.find(t => t.id === taskId);
        if (!task || !task.station_id || !task.child_category_id) return undefined;
        return stationConfigsMap[`${task.station_id}_${task.child_category_id}`];
    }, [selectedAssign, stationConfigsMap]);


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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 p-4 md:p-6 lg:p-8 transition-colors duration-500">
            {/* Offline & Sync Status */}
            <OfflineSyncStatus />

            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        <Briefcase className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        {t('sidebar.environment')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Quản lý và thực hiện công việc được phân công</p>
                </div>
            </div>

            {/* Project Selector + Quick Action Cards */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 mb-6 relative z-50">
                {/* Left — Project Selector */}
                {assigns.length > 0 && (
                    <div className="col-span-1 flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-4 w-1 bg-indigo-500 rounded-full"></div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Lựa chọn dự án</h3>
                        </div>
                        <div className="flex-1">
                            <ProjectSelector
                                assigns={assigns}
                                selectedAssignId={selectedAssignId}
                                onSelect={setSelectedAssignId}
                            />
                        </div>
                    </div>
                )}

                {/* Right — Quick Action Cards */}
                <div className="col-span-1 xl:col-span-3 flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-4 w-1 bg-violet-500 rounded-full"></div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Thao tác nhanh</h3>
                    </div>
                    <div className="flex-1">
                        <QuickActionBar
                            attendance={attendance}
                            onCheckIn={() => setShowCheckInModal(true)}
                            onCheckOut={() => setShowCheckoutModal(true)}
                            onStatistics={() => navigate('/user/statistics')}
                            onHistory={() => navigate('/user/history')}
                        />
                    </div>
                </div>
            </div>

            {selectedAssign && (
                <ProjectHeader
                    selectedAssign={selectedAssign}
                    taskDetails={taskDetails}
                />
            )}

            {/* Hierarchical Task List */}
            <TaskHierarchy
                groupedTasks={groupedTasks}
                mainCategoryMap={mainCategoryMap}
                childCategoryMap={childCategoryMap}
                stationMap={stationMap}
                processMap={processMap}
                stationConfigsMap={stationConfigsMap}
                expandedMain={expandedMain}
                setExpandedMain={setExpandedMain}
                expandedChild={expandedChild}
                setExpandedChild={setExpandedChild}
                expandedStation={expandedStation}
                setExpandedStation={setExpandedStation}
                draftCaptures={draftCaptures}
                draftNotes={draftNotes}
                editingTasks={editingTasks}
                onGuide={(title, text, images) => setGuidePopup({ title, text, images })}
                onTaskEdit={(tid) => setEditingTasks(prev => new Set(prev).add(tid))}
                onTaskSubmit={(tid) => handleSubmitDraft(tid, selectedAssignId)}
                onTaskCamera={handleOpenCamera}
                onTaskReset={handleResetTask}
                onTaskSaveNote={handleSaveNote}
                onTaskDeleteImage={handleDeleteImage}
                onTaskViewImage={(tid, imgs, idx) => {
                    const resolvedImages = imgs.map(i => getImageUrl(i));
                    setViewImage({ images: resolvedImages, currentIndex: idx });
                }}
                selectedAssignId={selectedAssignId}
            />

            {/* Empty States handled inside TaskHierarchy */}

            {assigns.length === 0 && !loading && (
                <GlassCard className="text-center py-12">
                    <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-600 mb-2">Chưa có phân công</h3>
                    <p className="text-slate-400">Bạn chưa được phân công dự án nào</p>
                </GlassCard>
            )}

            {/* Modals */}
            <CameraManager
                ref={cameraManagerRef}
                onCapture={handleCameraCapture}
                existingImageCount={captureContext.current ? (draftCaptures[captureContext.current.taskId]?.length || 0) : 0}
                currentConfig={getCurrentConfig()}
            />

            <AnimatePresence>
                {guidePopup && <GuidePopup key="guide-popup" data={guidePopup} onClose={() => setGuidePopup(null)} />}
            </AnimatePresence>

            {ReactDOM.createPortal(
                <AnimatePresence>
                    {viewImage && <ImagePreviewModal key="image-preview-modal" viewImage={viewImage} onClose={() => setViewImage(null)} onChangeIndex={(idx) => setViewImage(prev => prev ? { ...prev, currentIndex: idx } : null)} />}
                </AnimatePresence>,
                document.body
            )}

            {/* Check-in / Check-out Modals */}
            <CheckInModal
                isOpen={showCheckInModal}
                onClose={() => setShowCheckInModal(false)}
                onSubmit={handleCheckInSubmit}
                loading={attendanceLoading}
                mode="checkin"
            />
            <CheckInModal
                isOpen={showCheckoutModal}
                onClose={() => setShowCheckoutModal(false)}
                onSubmit={handleCheckoutSubmit}
                loading={attendanceLoading}
                mode="checkout"
            />
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
