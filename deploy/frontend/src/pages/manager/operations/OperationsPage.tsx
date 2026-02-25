import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../../services/api';
import useAutoRefresh from '../../../hooks/useAutoRefresh';
// Components
import OverallStatsCards from '../../../components/operations/OverallStatsCards';
import PendingReviewSection from './components/PendingReviewSection';
import ProjectListSidebar from './components/ProjectListSidebar';
import TaskTable from './components/TaskTable';
import TaskDetailsModal from './components/TaskDetailsModal';
import RejectModal from './components/RejectModal';
// Types
import { TaskRow, ProjectStat } from './types';

const ManagerOperationsPage = () => {
    // State
    const [tasks, setTasks] = useState<TaskRow[]>([]);
    const [stations, setStations] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true); // Kept for potential loading UI
    const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    // rejectNote removed - handled in Modal

    // --- Station Map for Priority Lookup ---
    const stationMap = useMemo(() => {
        const map: Record<string, string> = {};
        stations.forEach(s => { map[s.id] = s.name; });
        return map;
    }, [stations]);

    // --- Data Fetching ---
    useEffect(() => {
        const fetchStations = async () => {
            try {
                const res = await api.get('/stations');
                setStations(res.data || []);
            } catch (err) {
                console.error('Failed to fetch stations:', err);
            }
        };
        fetchStations();
    }, []);

    const fetchTasks = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await api.get('/allocations');
            const data = response.data || [];
            const flattenedTasks: TaskRow[] = [];

            data.forEach((assign: any) => {
                const taskDetails = assign.task_details || [];
                if (taskDetails.length > 0) {
                    taskDetails.forEach((t: any) => {
                        // Extract basic info
                        const status = t.status || 'pending';
                        const check = t.check || t.status_work || 0;
                        const accept = t.accept || t.status_approve || 0;
                        const statusReject = t.status_reject || 0; // NEW Standard
                        const note = t.note || t.data_note || "";
                        // Calculate statusString
                        let statusString = '0000';
                        const isSubmitted = t.status_submit === 1 || check === 3;

                        if (accept === 1) statusString = '1110'; // Approved (Clean)
                        else if (statusReject === 1) statusString = '1101'; // Rejected
                        else if (statusReject === -1) statusString = '1100'; // Resubmitted (Pending)
                        else if (isSubmitted) statusString = '1100'; // Pending Review
                        else if (check > 0) statusString = '1000'; // Doing

                        // Images
                        const imageUrls: string[] = [];
                        if (t.evidence?.after) imageUrls.push(...t.evidence.after);
                        if (t.image_path) imageUrls.push(t.image_path);

                        flattenedTasks.push({
                            id: t.id,
                            assignId: assign.id,
                            projectName: assign.project?.project_name || 'Unknown Project',
                            projectLocation: assign.project?.location || '',
                            userName: assign.user?.full_name || 'Unknown User',
                            userEmail: assign.user?.email || '',
                            mainCategoryName: t.child_category?.main_category?.name || 'Unknown Category',
                            childCategoryId: t.child_category?.id || 'unknown',
                            categoryName: t.child_category?.name || 'Unknown Item',

                            // Station Logic
                            stationId: t.station_id || t.station?.id, // Capture ID for lookup
                            stationName: t.station?.name || t.station_name || null,
                            inverterName: t.inverter_name || null,
                            processName: t.process?.name || null, // Map Process Name

                            status: status,
                            updatedAt: t.updated_at || assign.updated_at,
                            submittedAt: t.submitted_at,
                            approvalAt: t.approval_at,
                            rejectedAt: t.rejected_at || t.reject_at,
                            note: t.note || t.data_note || "",
                            dataResult: t.dataResult || t.data_result, // Handle both cases if needed
                            check: check,
                            accept: accept,

                            images: imageUrls,
                            beforeImages: t.evidence?.before || [],
                            afterImages: t.evidence?.after || [],
                            generalImages: imageUrls,
                            beforeNote: t.note_before || "",
                            afterNote: t.note_after || "",

                            status_reject: statusReject, // Added
                            statusString: statusString,

                            note_reject: t.note_reject,
                            note_approval: t.note_approval,

                            // Subtasks: Initial self
                            subTasks: []
                        });
                    });
                }
            });

            // --- Grouping Logic ---
            const groupedMap = new Map<string, TaskRow>();

            flattenedTasks.forEach(task => {
                // Key: AssignID + StationID + ChildCategoryID
                const groupKey = `${task.assignId}_${task.stationId || 'no-station'}_${task.childCategoryId}`;

                if (groupedMap.has(groupKey)) {
                    const existing = groupedMap.get(groupKey)!;

                    // Add to subTasks
                    if (!existing.subTasks || existing.subTasks.length === 0) {
                        existing.subTasks = [existing]; // Add initial self if not present
                    }
                    existing.subTasks.push(task);

                    // Update Parent Representative (Latest updated wins visually)
                    if (new Date(task.updatedAt) > new Date(existing.updatedAt)) {
                        // Update display timestamps/status to latest
                        existing.updatedAt = task.updatedAt;
                        existing.status = task.status;
                        existing.check = task.check;
                        existing.accept = task.accept;
                        existing.statusString = task.statusString;
                        // Keep content from latest
                        existing.note = task.note;
                    }

                } else {
                    // New Group
                    task.subTasks = [task]; // Initialize with self
                    groupedMap.set(groupKey, task);
                }
            });

            // Convert back to array
            const finalTasks = Array.from(groupedMap.values());

            // Sort by updated_at (newest first)
            finalTasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setTasks(finalTasks);

            // Auto-select project
            if (!selectedProjectName && finalTasks.length > 0) {
                setSelectedProjectName(finalTasks[0].projectName);
            }

        } catch (err) {
            console.error("Failed to fetch operational tasks:", err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-refresh every 5 minutes
    useAutoRefresh(() => fetchTasks(true), 5 * 60 * 1000);

    // --- Derived Data ---
    const projectStats = useMemo(() => {
        const statsMap: Record<string, ProjectStat> = {};
        tasks.forEach(t => {
            if (!statsMap[t.projectName]) {
                statsMap[t.projectName] = {
                    name: t.projectName,
                    location: t.projectLocation,
                    total: 0,
                    completed: 0,
                    pending: 0
                };
            }
            statsMap[t.projectName].total++;
            if (t.accept === 1) statsMap[t.projectName].completed++;
            if (t.check > 0 && t.accept === 0) statsMap[t.projectName].pending++;
        });
        return Object.values(statsMap).sort((a, b) => b.pending - a.pending);
    }, [tasks]);

    const pendingReviewTasks = useMemo(() => {
        return tasks.filter(t => t.check === 3 && t.accept === 0);
    }, [tasks]);

    const currentProjectTasks = useMemo(() => {
        if (!selectedProjectName) return [];
        let filtered = tasks.filter(t => t.projectName === selectedProjectName);
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(t =>
                t.categoryName.toLowerCase().includes(lowerTerm) ||
                t.userName.toLowerCase().includes(lowerTerm) ||
                (t.stationName && t.stationName.toLowerCase().includes(lowerTerm)) ||
                (t.stationId && stationMap[t.stationId]?.toLowerCase().includes(lowerTerm))
            );
        }
        return filtered;
    }, [tasks, selectedProjectName, searchTerm, stationMap]);

    // --- Handlers ---
    const handleUpdateStatus = async (taskId: string, status: number) => {
        if (status === -1 && !isRejectModalOpen) {
            // Should initiate rejection flow (open modal)
            setIsRejectModalOpen(true);
            return;
        }

        try {
            const noteToSave = status === 1 ? "Approved via Operations" : "Reset via Operations";
            await api.put(`/task-details/${taskId}/status`, {
                accept: status,
                note: noteToSave
            });

            // Refresh
            await fetchTasks(true);

            // Close modals if applicable
            if (status === 0) {
                // Reset action might need clearing selection?
                setSelectedTask(null);
            }
        } catch (error) {
            console.error('Failed to update task status:', error);
            alert('Có lỗi xảy ra khi cập nhật trạng thái.');
        }
    };

    const confirmRejection = async (rejections: { id: string; note: string }[]) => {
        if (!selectedTask) return;

        try {
            await Promise.all(rejections.map(r =>
                api.put(`/task-details/${r.id}/status`, {
                    accept: -1,
                    note: r.note
                })
            ));

            await fetchTasks(true);
            setIsRejectModalOpen(false);
            setSelectedTask(null);
        } catch (error) {
            console.error('Failed to reject tasks:', error);
            alert('Có lỗi xảy ra khi từ chối.');
        }
    };

    const handleBulkUpdateStatus = async (ids: string[], status: number, note?: string) => {
        try {
            await api.put('/task-details/bulk/status', {
                ids: ids,
                accept: status,
                note: note || (status === 1 ? "Approval" : "")
            });
            return Promise.resolve();
        } catch (error) {
            console.error('Failed to update tasks in bulk:', error);
            alert('Có lỗi xảy ra khi cập nhật hàng loạt.');
            return Promise.reject(error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans text-slate-600">
            {/* Header / Stats */}
            <div className="max-w-7xl mx-auto space-y-8">
                <OverallStatsCards tasks={tasks} />

                <PendingReviewSection
                    pendingReviewTasks={pendingReviewTasks}
                    setSelectedTask={setSelectedTask}
                />

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <ProjectListSidebar
                        projectStats={projectStats}
                        selectedProjectName={selectedProjectName}
                        setSelectedProjectName={setSelectedProjectName}
                    />

                    <TaskTable
                        tasks={currentProjectTasks}
                        selectedProjectName={selectedProjectName}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        setSelectedTask={setSelectedTask}
                        stationMap={stationMap}
                    />
                </div>
            </div>

            {selectedTask && (
                <TaskDetailsModal
                    task={selectedTask}
                    isOpen={true}
                    onClose={() => setSelectedTask(null)}
                    onUpdateStatus={handleUpdateStatus}
                    onBulkUpdateStatus={handleBulkUpdateStatus} // New Prop
                    fetchTasks={() => fetchTasks(true)}
                    setSelectedTask={setSelectedTask}
                />
            )}

            {/* Modals */}
            <RejectModal
                isOpen={isRejectModalOpen}
                onClose={() => setIsRejectModalOpen(false)}
                onConfirm={confirmRejection}
                task={selectedTask}
                selectedProjectName={selectedProjectName}
            />
        </div>
    );
};

export default ManagerOperationsPage;
