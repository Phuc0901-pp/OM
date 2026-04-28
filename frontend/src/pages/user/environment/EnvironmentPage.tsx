import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useWebSocket } from '../../../hooks/useWebSocket';
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
import GuideLineModal from '../../manager/management/projectSetup/components/GuideLineModal';
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
    const cameraManagerRef = React.useRef<{
        openCamera: (aid: string, tid: string, stage: string) => Promise<void>;
        fileInputRef: React.RefObject<HTMLInputElement>;
        updateNextTask: (nextName: string | null, onNext: ((data: (string | Blob)[]) => void) | null) => void;
    }>(null);

    // Fetch users once for name resolution (id_person_reject -> name)
    React.useEffect(() => {
        api.get('/users').then(res => {
            const map: Record<string, string> = {};
            (res.data || []).forEach((u: any) => { if (u.id && u.name) map[u.id] = u.name; });
            setUsersMap(map);
        }).catch(() => { });
    }, []);

    // UI State - Interactions
    const [guidePopup, setGuidePopup] = useState<GuidePopupData | null>(null);
    const [draftCaptures, setDraftCaptures] = useState<Record<string, (string | Blob)[]>>({});
    const [syncedTasks, setSyncedTasks] = useState<Set<string>>(new Set());
    const [syncedNotes, setSyncedNotes] = useState<Set<string>>(new Set());
    const [editingTasks, setEditingTasks] = useState<Set<string>>(new Set());
    const [submittingTasks, setSubmittingTasks] = useState<Set<string>>(new Set());
    const submittingLockRef = React.useRef<Set<string>>(new Set());
    const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
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
    const { saveImage, getTaskCaptures, deletePendingCapture } = useOfflineStorage();
    const { t } = useLanguageStore();

    // --- WebSocket Real-time Sync ---
    const { lastMessage } = useWebSocket();
    useEffect(() => {
        if (lastMessage?.event === 'task_updated') {
            // Background refresh overrides local tasks with remote updates
            refreshData(() => {
                setSyncedTasks(new Set());
                setSyncedNotes(new Set());
            });
        }
    }, [lastMessage]);

    // Cache IndexedDB Blob URLs by their capture ID so they don't regenerate string URLs, allowing React to deduplicate
    const blobUrlCache = useRef<Record<string, string>>({});
    // Tombstone cache: store recently deleted server URLs so they don't immediately pop back up if the message queue lags behind
    const deletedUrlsCache = useRef<Set<string>>(new Set());

    // --- Effects (Data Sync) ---
    const fetchTaskEvidence = useCallback(async (taskId: string, parentData: any) => {
        try {
            // Read server evidence from DB
            let serverEvidence: string[] = [];
            if (parentData) {
                try {
                    const parsed = typeof parentData === 'string' ? JSON.parse(parentData) : parentData;
                    if (Array.isArray(parsed)) serverEvidence = parsed;
                } catch { }
            }

            // Fetch pending offline captures EVERY TIME to accurately reflect what hasn't synced yet!
            const offlineEvidence = await getTaskCaptures(taskId);
            const offlineUrls = offlineEvidence.map(c => {
                if (!blobUrlCache.current[c.id]) {
                    blobUrlCache.current[c.id] = URL.createObjectURL(c.imageBlob);
                }
                return blobUrlCache.current[c.id];
            });

            // SAFE MERGE: union of server data and local offline drafts (dedup by value)
            setDraftCaptures(prev => {
                const existing = prev[taskId] || [];

                // We DO NOT preserve raw memory `data:` strings here because if an image exists,
                // it is either in `serverEvidence` (S3 URL) or in `offlineUrls` (IndexedDB). 
                // Any lingering `data:` strings are duplicates that have already successfully synced to S3!
                const merged = [...serverEvidence, ...offlineUrls].filter(
                    (u, i, arr) => arr.indexOf(u) === i && !deletedUrlsCache.current.has(u as string) // deduplicate & ignore tombstones
                );
                // Only update if something actually changed
                if (merged.length === existing.length && merged.every((v, i) => v === existing[i])) {
                    return prev;
                }
                return { ...prev, [taskId]: merged };
            });

            setSyncedTasks(prev => new Set(prev).add(taskId));
        } catch (err) {
            console.error("Failed to parse evidence for", taskId, err);
            setSyncedTasks(prev => new Set(prev).add(taskId)); // Avoid retry spam
        }
    }, [getTaskCaptures]);

    const fetchTaskNote = useCallback(async (taskId: string, noteData: string) => {
        if (syncedNotes.has(taskId)) return;
        if (noteData) {
            setDraftNotes(prev => ({ ...prev, [taskId]: noteData }));
        }
        setSyncedNotes(prev => new Set(prev).add(taskId));
    }, [syncedNotes]);

    // Setup UI States from incoming assigns Data Matrix
    // Re-runs whenever assigns changes (including WebSocket-triggered refreshData)
    useEffect(() => {
        assigns.forEach(assign => {
            assign.details?.forEach(task => {
                // Always re-merge evidence when server data arrives (needed for real-time teammate sync)
                const hasEvidence = task.status_submit === 1 || task.status_reject === 1 || task.status_reject === -1 || task.status_approve === 1;
                const hasServerData = Array.isArray(task.data) ? task.data.length > 0 : !!task.data;
                if ((hasEvidence || hasServerData) && !syncedTasks.has(task.id)) {
                    fetchTaskEvidence(task.id, task.data);
                }
                if (!syncedNotes.has(task.id) && !draftNotes[task.id]) {
                    fetchTaskNote(task.id, task.note_data || "");
                }
            });
        });
    }, [assigns, fetchTaskEvidence, fetchTaskNote, syncedTasks, syncedNotes, draftNotes]);

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

    // Global Asset Map for resolving parent names (fetched per project)
    const [projectAssetsMap, setProjectAssetsMap] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!selectedAssign?.id_project) {
            setProjectAssetsMap({});
            return;
        }
        // Fetch all assets for this project to resolve parent_id to names
        api.get('/assets', { params: { project_id: selectedAssign.id_project } })
            .then(res => {
                const map: Record<string, string> = {};
                (res.data || []).forEach((a: any) => {
                    if (a.id && a.name) map[a.id] = a.name;
                });
                setProjectAssetsMap(map);
            })
            .catch(err => console.error("Failed to load project assets for names", err));
    }, [selectedAssign?.id_project]);

    // Grouping Logic - Memoized (Process-First Matrix Layout)
    const groupedTasks = useMemo(() => {
        // Build a fallback lookup map from assigned tasks just in case API fails
        const fallbackAssetMap: Record<string, string> = {};
        (processDetails || []).forEach(task => {
            const asset = task.config?.asset;
            if (asset?.id) fallbackAssetMap[asset.id] = asset.name || asset.id;
        });

        // Structure: mainCat -> childCat -> parentGroupKey -> processName -> tasks[]
        const grouped: Record<string, Record<string, Record<string, { parentName: string; processes: Record<string, any[]> }>>> = {};

        (processDetails || []).forEach(task => {
            const mainCatName = task.config?.sub_work?.work?.name || 'Danh mục chưa phân loại';
            const childCatName = task.config?.sub_work?.name || 'Công việc chưa phân loại';
            const asset = task.config?.asset;
            const stationName = asset?.name || 'Không có thiết bị';
            const processName = task.process?.name || 'Quy trình';

            // Determine parent group name
            const parentId = asset?.parent_id;
            const parentGroupKey = parentId ?? (asset?.id ?? stationName);
            const parentName = parentId
                ? (projectAssetsMap[parentId] || fallbackAssetMap[parentId] || 'Trạm chính')
                : stationName;

            if (!grouped[mainCatName]) grouped[mainCatName] = {};
            if (!grouped[mainCatName][childCatName]) grouped[mainCatName][childCatName] = {};
            if (!grouped[mainCatName][childCatName][parentGroupKey]) {
                grouped[mainCatName][childCatName][parentGroupKey] = { parentName, processes: {} };
            }
            if (!grouped[mainCatName][childCatName][parentGroupKey].processes[processName]) {
                grouped[mainCatName][childCatName][parentGroupKey].processes[processName] = [];
            }
            grouped[mainCatName][childCatName][parentGroupKey].processes[processName].push(task);
        });
        return grouped;
    }, [processDetails, projectAssetsMap]);

    // Capture Handler (Passed to CameraManager)
    const onCapture = useCallback(async (data: (string | Blob)[]) => { }, []);
    const captureContext = React.useRef<{ assignId: string, taskId: string, stage: string } | null>(null);
    const [activeCameraTaskId, setActiveCameraTaskId] = React.useState<string | null>(null);
    // Ref to avoid stale-closure / used-before-declaration issue with handleSubmitDraft
    const submitDraftRef = React.useRef<((taskId: string, assignId: string, directNote?: string, isSilent?: boolean) => Promise<void>) | null>(null);

    const handleCameraCapture = useCallback(async (data: (string | Blob)[], overrideContext?: { taskId: string, assignId: string, stage: string }) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const currentRef = overrideContext || captureContext.current;
        if (currentRef) {
            const { taskId, assignId, stage } = currentRef;

            // Save to memory (as-is: Blobs or blob: URLs)
            setDraftCaptures(prev => ({
                ...prev,
                [taskId]: [...(prev[taskId] || []), ...data]
            }));

            // Offline Save — now Data is always Blob, no Base64 decode needed
            try {
                for (const item of data) {
                    let blob: Blob;
                    if (item instanceof Blob) {
                        // Fast path: already a Blob (new Blob pipeline)
                        blob = item;
                    } else if (typeof item === 'string' && item.startsWith('blob:')) {
                        // blob: URL — fetch it to get the underlying Blob
                        const response = await fetch(item);
                        blob = await response.blob();
                    } else if (typeof item === 'string') {
                        // Legacy fallback: Base64 data URI
                        const response = await fetch(item);
                        blob = await response.blob();
                    } else {
                        continue;
                    }
                    await saveImage(taskId, assignId, blob, stage);
                }
            } catch (err) {
                console.error('[Offline] Failed to save:', err);
            }
        }
    }, [saveImage]);

    // Returns a flat ordered list of all tasks with same SubWork+Process as the given taskId
    // The order mirrors exactly the visual order in groupedTasks (main -> child -> [all stations] -> process)
    const getTaskSequence = useCallback((taskId: string): any[] => {
        const currentTask = processDetails.find((t: any) => t.id === taskId);
        if (!currentTask) return [];

        const mainCatName = currentTask.config?.sub_work?.work?.name || 'Danh mục chưa phân loại';
        const childCatName = currentTask.config?.sub_work?.name || 'Công việc chưa phân loại';
        const processName = currentTask.process?.name || 'Quy trình';

        const childGroup = groupedTasks[mainCatName]?.[childCatName];
        if (!childGroup) return [];

        const flatSequence: any[] = [];

        // Match exactly how TaskHierarchy renders: iterate parents, then processes, then SORT TASKS by asset name
        Object.entries(childGroup).forEach(([parentGroupKey, parentData]) => {
            const tasksInProcess = parentData.processes[processName];
            if (tasksInProcess && Array.isArray(tasksInProcess)) {
                // Ensure same sorting logic as TaskHierarchy.tsx
                const sortedTasks = [...tasksInProcess].sort((a, b) => {
                    const nameA = a.config?.asset?.name || '';
                    const nameB = b.config?.asset?.name || '';
                    return nameA.localeCompare(nameB, 'vi-VN', { numeric: true, sensitivity: 'base' });
                });
                flatSequence.push(...sortedTasks);
            }
        });

        // Optional debug logging to verify logic (can be observed if user has devtools open)
        console.log(`[TaskSequence] Process: "${processName}", Found ${flatSequence.length} tasks across ${Object.keys(childGroup).length} parents.`);

        return flatSequence;
    }, [processDetails, groupedTasks]);

    // This function is passed to TaskHierarchy -> calls CameraManager.open
    const handleOpenCamera = useCallback(async (taskId: string) => {
        if (selectedAssignId) {
            captureContext.current = { assignId: selectedAssignId, taskId, stage: 'execution' };
            setActiveCameraTaskId(taskId);
            cameraManagerRef.current?.openCamera(selectedAssignId, taskId, 'execution');

            // Compute the next task in the same SubWork+Process sequence and update CameraManager
            const flatSequence = getTaskSequence(taskId);
            const currentIdx = flatSequence.findIndex(t => t.id === taskId);
            const nextTask = currentIdx >= 0 && currentIdx < flatSequence.length - 1
                ? flatSequence[currentIdx + 1]
                : null;

            const nextName = nextTask
                ? (nextTask.config?.asset?.name || 'Tài sản kế tiếp')
                : null;

            cameraManagerRef.current?.updateNextTask(
                nextName,
                nextTask
                    ? (images: (string | Blob)[]) => handleNextTaskCapture(nextTask.id, images)
                    : null
            );
        }
    }, [selectedAssignId, getTaskSequence]);

    // Called by CameraManager's "Next Asset" button: save images for current task, then prime next task
    const handleNextTaskCapture = useCallback(async (nextTaskId: string, images: (string | Blob)[]) => {
        // 1. Capture the context synchronously before ANY awaits to prevent race conditions
        const stableContext = captureContext.current ? { ...captureContext.current } : undefined;

        // 2. Advance the UI context IMMEDIATELY so the user instantly sees the new Watermark and Task Name
        captureContext.current = { assignId: selectedAssignId || '', taskId: nextTaskId, stage: 'execution' };
        setActiveCameraTaskId(nextTaskId);

        // 3. Compute and update the Next Asset string for the button IMMEDIATELY
        const flatSequence = getTaskSequence(nextTaskId);
        const currentIdx = flatSequence.findIndex(t => t.id === nextTaskId);
        const afterNext = currentIdx >= 0 && currentIdx < flatSequence.length - 1
            ? flatSequence[currentIdx + 1]
            : null;

        const afterNextName = afterNext
            ? (afterNext.config?.asset?.name || 'Tài sản kế tiếp')
            : null;

        cameraManagerRef.current?.updateNextTask(
            afterNextName,
            afterNext
                ? (imgs: (string | Blob)[]) => handleNextTaskCapture(afterNext.id, imgs)
                : null
        );

        // 4. Save AND auto-submit the PREVIOUS task silently in the background
        if (stableContext) {
            await handleCameraCapture(images, stableContext);
            // Fire-and-forget via ref: avoids stale-closure and used-before-declaration issues
            submitDraftRef.current?.(stableContext.taskId, stableContext.assignId, undefined, true)
                ?.catch(err => console.error('[AutoSubmit] Background submit failed:', err));
        }
    }, [selectedAssignId, handleCameraCapture, getTaskSequence]);


    const handleDeleteImage = useCallback(async (taskId: string, item: string | Blob, index: number) => {
                const isServerImage = typeof item === 'string' && !item.startsWith('blob:') && !item.startsWith('data:');

        // Step 1: Optimistic UI update — remove image from state immediately.
        const prevCaptures = draftCaptures[taskId] || [];
        setDraftCaptures(prev => {
            const current = prev[taskId] || [];
            const next = [...current];
            next.splice(index, 1);
            return { ...prev, [taskId]: next };
        });

        // Add to Tombstone Cache so that if the DB syncs slowly via MQ, we don't accidentally restore it
        if (isServerImage) {
            deletedUrlsCache.current.add(item as string);
        }

        try {
            if (isServerImage) {
                // The backend strictly compares `imgUrl == body.Url` with what is in the DB JSON array.
                // We MUST send the exact raw string stored in the state, NOT the stripped objectName.
                const res = await api.delete(`/details/${taskId}/image`, {
                    data: { url: item as string }
                });

                // Force sync frontend state with the EXACT array the server successfully saved
                if (res.data && Array.isArray(res.data.data)) {
                    setDraftCaptures(prev => ({ ...prev, [taskId]: res.data.data }));
                }

                // Delay slightly so the server has time to commit the deletion before we re-fetch.
                // Reset sync guards safely in tandem with assigns state
                setTimeout(() => {
                    refreshData(() => {
                        setSyncedTasks(new Set());
                        setSyncedNotes(new Set());
                    }).catch(err => console.warn('[Delete] Background refresh failed (non-fatal):', err));
                }, 800);
            } else {
                // Xử lý xóa ảnh offline (IndexedDB) dựa vào blobUrlCache
                let captureIdToDelete = null;
                for (const [id, url] of Object.entries(blobUrlCache.current)) {
                    if (url === item) {
                        captureIdToDelete = id;
                        break;
                    }
                }

                if (captureIdToDelete) {
                    await deletePendingCapture(captureIdToDelete);
                    delete blobUrlCache.current[captureIdToDelete];
                }
            }

        } catch (err: any) {
            console.error('[Delete] Error:', err);
            
            // IF backend says it's 404 (not found), then it is ALREADY DELETED!
            // Do NOT restore the image. Just hide the warning or show a mild toast.
            if (err?.response?.status === 404) {
                 console.warn('[Delete] Image was already deleted on server, skipping restore');
                 return; // Do nothing, keep it removed on UI
            }

            // Restore state on API failure (only for network drops/500s)
            setDraftCaptures(prev => ({ ...prev, [taskId]: prevCaptures }));
            setSyncedTasks(prev => new Set(prev).add(taskId)); // Restore sync guard
            alert("Không thể xóa ảnh: " + (err?.response?.data?.error || err.message || err));
        }
    }, [draftCaptures, refreshData]);


    const handleSubmitDraft = useCallback(async (taskId: string, assignId: string, directNote?: string, isSilent?: boolean) => {
        if (!isSilent && submittingTasks.has(taskId)) return; // Prevent double manual submit
        if (submittingLockRef.current.has(taskId)) {
            if (isSilent) return; // Silent background submit already running
            // If manual submit but lock exists, it means background is running. Allow UI to spin.
        } else {
            submittingLockRef.current.add(taskId);
        }

        // Also update state for UI loading indicator only when user explicitly clicks
        if (!isSilent) {
            setSubmittingTasks(prev => new Set(prev).add(taskId));
        }

        if (!navigator.onLine) {
            if (!isSilent) alert("Đã lưu yêu cầu nộp dữ liệu offline. Dữ liệu sẽ được gửi khi có mạng.");
            setEditingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });
            setSubmittingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });
            submittingLockRef.current.delete(taskId);
            return;
        }

        try {
            if (!assignId || !taskId) {
                if (!isSilent) alert(`Lỗi: Thiếu ID. AssignID: ${assignId}, TaskID: ${taskId}`);
                return;
            }

            // 1. Upload all pending offline blobs for THIS task to S3 (parallel, max 3 concurrent)
            //    Returns updatedUrls = mergedData already committed as draft to DB
            const syncResult = await syncQueue.processTask(taskId);

            // 2. Check if any blobs failed to upload
            const pending = await offlineStorage.getPendingCaptures();
            const failed = await offlineStorage.getFailedCaptures();
            const allUnsynced = [...pending, ...failed].filter(c => c.taskId === taskId);

            if (allUnsynced.length > 0) {
                if (!isSilent) {
                    alert(`Lỗi: Còn ${allUnsynced.length} ảnh chưa tải lên máy chủ được. Hệ thống sẽ tiếp tục thử lại sau. Xin vui lòng thử nộp lại khi mạng ổn định hơn.`);
                } else {
                    console.warn(`[AutoSubmit] ${allUnsynced.length} captures still pending for task ${taskId}. Will retry on next sync.`);
                }
                return;
            }

            // 3. Determine final URL list:
            //    - If syncQueue uploaded new images, use its returned mergedData directly (ZERO extra fetch)
            //    - If no new offline blobs (already synced before), read from current draft state
            let currentData: string[] = syncResult.updatedUrls.length > 0
                ? syncResult.updatedUrls
                : (draftCaptures[taskId] || []).filter(
                    (u): u is string => typeof u === 'string' && !u.startsWith('blob:')
                );

            // 4. Final submission — flip status_submit = 1 on server
            const noteData = directNote !== undefined ? directNote : (draftNotes[taskId] || "");
            await api.post(`/details/${taskId}/submit`, {
                data: currentData,
                note_data: noteData
            });

            if (!isSilent) alert("Nộp dữ liệu thành công!");
            setEditingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });

            // 5. Optimistic UI update with the URLs we already have — no blocking fetch
            setDraftCaptures(prev => ({ ...prev, [taskId]: currentData }));

            // 6. Background refresh so status badge updates (non-blocking — WebSocket also triggers this)
            refreshData().catch(err => console.warn('[Submit] Background refresh failed (non-fatal):', err));

        } catch (err: unknown) {
            console.error("Submit Error:", err);
            if (!isSilent) alert("Lỗi khi nộp dữ liệu: " + (err instanceof Error ? err.message : String(err)));
        } finally {
            setSubmittingTasks(prev => { const next = new Set(prev); next.delete(taskId); return next; });
            submittingLockRef.current.delete(taskId);
        }
    }, [draftCaptures, draftNotes, refreshData]);

    // Keep ref always pointing at the latest version (avoids stale closure in handleNextTaskCapture)
    React.useEffect(() => {
        submitDraftRef.current = handleSubmitDraft;
    });

    const handleResetTask = useCallback(async (taskId: string) => {
        if (!confirm("Bạn có muốn nộp lại dữ liệu? (Dữ liệu cũ sẽ bị xóa)")) return;
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
        if (!activeCameraTaskId || !selectedAssign) return undefined;
        const task = selectedAssign.details?.find(t => t.id === activeCameraTaskId);
        return task?.config;
    }, [activeCameraTaskId, selectedAssign]);

    const getWatermarkInfo = useCallback(() => {
        if (!activeCameraTaskId || !selectedAssign) return [];
        const task = selectedAssign.details?.find(t => t.id === activeCameraTaskId);
        const info: string[] = [];

        try {
            const userStr = sessionStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                const name = user.full_name || user.name;
                if (name) info.push(`NV: ${name}`);
            }
        } catch (e) { }

        if (task) {
            const subWork = task.config?.sub_work?.name || '';
            const work = task.config?.sub_work?.work?.name || '';
            const asset = task.config?.asset;
            const processName = task.process?.name || '';

            if (subWork && work) info.push(`DA: ${subWork} - ${work}`);
            else if (subWork || work) info.push(`DA: ${subWork || work}`);

            if (asset) {
                let assetName = asset.name || '';
                const parentId = (asset as any).parent_id;
                if (parentId) {
                    // Try to resolve parent name from the pre-fetched map or fallback to tasks list
                    const parentName = projectAssetsMap[parentId] || processDetails?.find((t: any) => t.config?.asset?.id === parentId)?.config?.asset?.name || '';
                    if (parentName) {
                        assetName = `${parentName} - ${assetName}`;
                    }
                }
                info.push(`TS: ${assetName}`);
            }
            if (processName) info.push(`QT: ${processName}`);
        }

        return info;
    }, [activeCameraTaskId, selectedAssign, projectAssetsMap, processDetails]);


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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-4 md:p-6 lg:p-8 transition-colors duration-500">
            {/* Offline & Sync Status */}
            <OfflineSyncStatus />

            {/* Premium Header */}
            <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl border border-white/20 transition-colors mb-6">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-400/20 to-violet-600/20 rounded-full blur-3xl -z-10"></div>
                <div className="relative z-10 flex flex-col gap-1">
                    <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                        {t('sidebar.environment')}
                    </h1>
                    <p className="text-gray-600 font-medium">Quản lý và thực hiện công việc được phân công</p>
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
                onOpenGuide={(subWorkId, subWorkName, workName) => setGuidePopup({ subWorkId, subWorkName, workName })}
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
                watermarkInfo={getWatermarkInfo()}
            />

            {ReactDOM.createPortal(
                <>
                    <AnimatePresence>
                        {guidePopup && (
                            <GuideLineModal
                                key="guide-popup"
                                subWorkId={guidePopup.subWorkId}
                                subWorkName={guidePopup.subWorkName}
                                workName={guidePopup.workName}
                                onClose={() => setGuidePopup(null)}
                                readOnly={true}
                            />
                        )}
                    </AnimatePresence>
                    <AnimatePresence>
                        {viewImage && <ImagePreviewModal key="image-preview-modal" viewImage={viewImage} onClose={() => setViewImage(null)} onChangeIndex={(idx) => setViewImage(prev => prev ? { ...prev, currentIndex: idx } : null)} />}
                    </AnimatePresence>
                </>,
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
