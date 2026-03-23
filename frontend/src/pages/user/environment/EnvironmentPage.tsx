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
import { useLanguageStore } from '../../../stores/useLanguageStore';
import { useEnvironmentData } from '../../../hooks/useEnvironmentData';
import { syncQueue } from '../../../services/offline';
import { offlineStorage } from '../../../services/offline/OfflineStorageService';
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
        selectedAssign,
        processDetails,
        refreshData
    } = useEnvironmentData();

    // UI State
    const [expandedMain, setExpandedMain] = useState<Record<string, boolean>>({});
    const [expandedChild, setExpandedChild] = useState<Record<string, boolean>>({});
    const [expandedStation, setExpandedStation] = useState<Record<string, boolean>>({});
    const [viewImage, setViewImage] = useState<ViewImageData | null>(null);

    // Camera Manager Ref
    const cameraManagerRef = React.useRef<{ openCamera: (aid: string, tid: string, stage: string) => Promise<void>; fileInputRef: React.RefObject<HTMLInputElement> }>(null);

    // Fetch users once for name resolution (id_person_reject -> name)
    React.useEffect(() => {
        api.get('/users').then(res => {
            const map: Record<string, string> = {};
            (res.data || []).forEach((u: any) => { if (u.id && u.name) map[u.id] = u.name; });
            setUsersMap(map);
        }).catch(() => {});
    }, []);

    // UI State - Interactions
    const [guidePopup, setGuidePopup] = useState<GuidePopupData | null>(null);
    const [draftCaptures, setDraftCaptures] = useState<Record<string, (string | Blob)[]>>({});
    const [syncedTasks, setSyncedTasks] = useState<Set<string>>(new Set());
    const [editingTasks, setEditingTasks] = useState<Set<string>>(new Set());
    const [submittingTasks, setSubmittingTasks] = useState<Set<string>>(new Set());
    const submittingLockRef = React.useRef<Set<string>>(new Set());
    const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
    const [syncedNotes, setSyncedNotes] = useState<Set<string>>(new Set());
    // Users map for name resolution (uuid -> name)
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});

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
    const { t } = useLanguageStore();

    // --- Effects (Data Sync) ---
    const fetchTaskEvidence = useCallback(async (taskId: string, parentData: any) => {
        if (syncedTasks.has(taskId)) return;
        try {
            // Read from DB Assign array directly
            let serverEvidence: string[] = [];
            if (parentData) {
                try {
                    serverEvidence = typeof parentData === 'string' ? JSON.parse(parentData) : parentData;
                } catch { }
            }

            // Fetch from offline storage
            const offlineEvidence = await getTaskCaptures(taskId);
            const offlineUrls = offlineEvidence.map(c => URL.createObjectURL(c.imageBlob));

            setDraftCaptures(prev => ({
                ...prev,
                [taskId]: [...serverEvidence, ...offlineUrls]
            }));

            setSyncedTasks(prev => new Set(prev).add(taskId));
        } catch (err) {
            console.error("Failed to parse evidence for", taskId, err);
            setSyncedTasks(prev => new Set(prev).add(taskId)); // Avoid retry spam
        }
    }, [syncedTasks, getTaskCaptures]);

    const fetchTaskNote = useCallback(async (taskId: string, noteData: string) => {
        if (syncedNotes.has(taskId)) return;
        if (noteData) {
            setDraftNotes(prev => ({ ...prev, [taskId]: noteData }));
        }
        setSyncedNotes(prev => new Set(prev).add(taskId));
    }, [syncedNotes]);

    // Setup UI States from incoming assigns Data Matrix
    useEffect(() => {
        assigns.forEach(assign => {
            assign.details?.forEach(task => {
                // Fetch previous evidence if it was submitted, approved, or rejected
                const hasEvidence = task.status_submit === 1 || task.status_reject === 1 || task.status_reject === -1 || task.status_approve === 1; 
                if (hasEvidence && !syncedTasks.has(task.id) && !draftCaptures[task.id]) {
                    fetchTaskEvidence(task.id, task.data);
                }
                if (!syncedNotes.has(task.id) && !draftNotes[task.id]) {
                    fetchTaskNote(task.id, task.note_data || "");
                }
            });
        });
    }, [assigns, fetchTaskEvidence, fetchTaskNote, syncedTasks, draftCaptures, syncedNotes, draftNotes]);

    // Save Note Handler
    const handleSaveNote = useCallback(async (taskId: string, noteContent: string) => {
        setDraftNotes(prev => ({ ...prev, [taskId]: noteContent }));
        try {
            await api.put(`/details/${taskId}/note`, { note: noteContent });
            alert('Chú thích đã được lưu!');
        } catch (err) {
            console.error('Failed to save note:', err);
            alert('Lỗi khi lưu chú thích: ' + err);
        }
    }, []);

    // --- Attendance Logic ---
    const fetchTodayAttendance = useCallback(async (assignId?: string) => {
        const userId = getUserId();
        if (!userId) return;
        try {
            const params: Record<string, string> = {};
            if (assignId) params['assign_id'] = assignId;
            const res = await api.get(`/attendance/today/${userId}`, { params });
            setAttendance(res.data);
        } catch {
            setAttendance(null);
        }
    }, []);

    useEffect(() => {
        fetchTodayAttendance(selectedAssignId || undefined);
    }, [fetchTodayAttendance, selectedAssignId]);

    const handleCheckInSubmit = async (photos: CheckInPhotos) => {
        const userId = getUserId();
        if (!userId) return;
        setAttendanceLoading(true);
        try {
            const res = await api.post('/attendance/checkin-with-photos', {
                user_id: userId,
                project_id: selectedAssign?.id_project,
                assign_id: selectedAssign?.id,  // Bind check-in to specific assignment
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

        (processDetails || []).forEach(task => {
            const mainCatName = task.config?.sub_work?.work?.name || 'Danh mục chưa phân loại';
            const childCatName = task.config?.sub_work?.name || 'Công việc chưa phân loại';
            const stationName = task.config?.asset?.name || 'Không có thiết bị';

            if (!grouped[mainCatName]) grouped[mainCatName] = {};
            if (!grouped[mainCatName][childCatName]) grouped[mainCatName][childCatName] = {};
            if (!grouped[mainCatName][childCatName][stationName]) grouped[mainCatName][childCatName][stationName] = [];
            grouped[mainCatName][childCatName][stationName].push(task);
        });
        return grouped;
    }, [processDetails]);

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
        const isServerImage = typeof item === 'string' && !item.startsWith('blob:') && !item.startsWith('data:');
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

                // Call to the new unified image deletion endpoint
                await api.delete(`/details/${taskId}/image`, {
                    data: { url: objectName }
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

    const handleSubmitDraft = useCallback(async (taskId: string, assignId: string, directNote?: string) => {
        if (submittingLockRef.current.has(taskId)) return; // Prevent double submit synchronously
        submittingLockRef.current.add(taskId);
        
        // Also update state for UI loading indicator
        setSubmittingTasks(prev => new Set(prev).add(taskId));

        if (!navigator.onLine) {
            alert("Đã lưu yêu cầu nộp bài offline. Dữ liệu sẽ được gửi khi có mạng.");
            setEditingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });
            setSubmittingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });
            submittingLockRef.current.delete(taskId);
            return;
        }

        // Block while auto-sync is running to avoid stepping on each other
        if (syncQueue.getIsSyncing()) {
            alert("Hệ thống đang đồng bộ dữ liệu khác, vui lòng thử lại sau giây lát.");
            setSubmittingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });
            submittingLockRef.current.delete(taskId);
            return;
        }

        try {
            if (!assignId || !taskId) {
                alert(`Lỗi: Thiếu ID. AssignID: ${assignId}, TaskID: ${taskId}`);
                return;
            }

            // Mảng URL trả về sau khi upload
            const uploadedUrls: string[] = [];

            // 1. Upload từng ảnh mới (blob/file local) thông qua API mới
            const captures = draftCaptures[taskId] || [];

            for (const item of captures) {
                // Nếu là string không phải blob (ảnh cũ từ server tải xuống - MinIO url đã lưu)
                if (typeof item === 'string' && !item.startsWith('blob:') && !item.startsWith('data:')) {
                    uploadedUrls.push(item);
                    continue;
                }

                // Nếu là base64 hoặc blob -> lấy Blob
                let blob: Blob;
                if (typeof item === 'string') {
                    const response = await fetch(item);
                    blob = await response.blob();
                } else {
                    blob = item;
                }

                // Append formData
                const formData = new FormData();
                const fileExt = blob.type === 'video/mp4' ? 'mp4' : 'jpg';
                formData.append('file', new File([blob], `capture-${Date.now()}.${fileExt}`, { type: blob.type }));

                // Gọi endpoint upload path mới
                const res = await api.post(`/details/${taskId}/upload-image`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (res.data?.url) {
                    uploadedUrls.push(res.data.url);
                }
            }

            // 2. Submit URL Array vào Data (CHỈ GỌI 1 LẦN)
            const noteData = directNote !== undefined ? directNote : (draftNotes[taskId] || "");
            await api.post(`/details/${taskId}/submit`, {
                data: uploadedUrls,
                note_data: noteData
            });

            // 3. QUAN TRỌNG: Xóa sạch offline storage cho task này
            //    Để Auto-Sync ngầm (30s interval) không thể bốc lại và tạo thêm thông báo trùng
            try {
                await offlineStorage.deleteCapturesByTask(taskId);
                console.log(`[Submit] Cleared offline queue for task ${taskId}`);
            } catch (cleanupErr) {
                console.warn('[Submit] Could not clear offline captures (non-fatal):', cleanupErr);
            }

            alert("Nộp bài thành công!");
            setEditingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });

            // Cập nhật state bằng URL chính thức thay vì xoá khỏi UI (Tránh accordion bị sụp mất)
            setDraftCaptures(prev => {
                const next = { ...prev };
                next[taskId] = uploadedUrls;
                return next;
            });

            // Không xoá khỏi syncedTasks nữa, để tránh mất trạng thái đã tải
            // Gọi refreshData để load lại badge trạng thái task
            await refreshData();
        } catch (err: unknown) {
            console.error("Submit Error:", err);
            alert("Lỗi khi nộp bài: " + (err instanceof Error ? err.message : String(err)));
        } finally {
            setSubmittingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });
            submittingLockRef.current.delete(taskId);
        }
    }, [draftCaptures, draftNotes, refreshData]);

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
        const task = selectedAssign.details?.find(t => t.id === taskId);
        return task?.config;
    }, [selectedAssign]);


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

            {/* Premium Header */}
            <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl dark:shadow-2xl border border-white/20 dark:border-white/5 transition-colors mb-6">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-400/20 to-violet-600/20 rounded-full blur-3xl -z-10"></div>
                <div className="relative z-10 flex flex-col gap-1">
                    <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                        {t('sidebar.environment')}
                    </h1>
                    <p className="text-gray-600 dark:text-slate-400 font-medium">Quản lý và thực hiện công việc được phân công</p>
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
                        <div>
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
                    taskDetails={processDetails}
                />
            )}

            {/* Hierarchical Task List */}
            <TaskHierarchy
                groupedTasks={groupedTasks}
                expandedMain={expandedMain}
                setExpandedMain={setExpandedMain}
                expandedChild={expandedChild}
                setExpandedChild={setExpandedChild}
                expandedStation={expandedStation}
                setExpandedStation={setExpandedStation}
                draftCaptures={draftCaptures}
                draftNotes={draftNotes}
                editingTasks={editingTasks}
                submittingTasks={submittingTasks}
                onGuide={(title, text, images) => setGuidePopup({ title, text, images })}
                onTaskEdit={(tid: string) => setEditingTasks(prev => new Set(prev).add(tid))}
                onTaskSubmit={(tid: string, overrideNote?: string) => {
                    handleSubmitDraft(tid, selectedAssignId || '', overrideNote).catch(console.error);
                }}
                onTaskCamera={handleOpenCamera}
                onTaskReset={handleResetTask}
                onTaskSaveNote={handleSaveNote}
                onTaskDeleteImage={handleDeleteImage}
                onTaskViewImage={(tid, imgs, idx) => {
                    const resolvedImages = imgs.map(i => getImageUrl(i));
                    setViewImage({ images: resolvedImages, currentIndex: idx });
                }}
                selectedAssignId={selectedAssignId}
                usersMap={usersMap}
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
