import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../services/api';
import useAutoRefresh from '../../../hooks/useAutoRefresh';
import { useWebSocket } from '../../../hooks/useWebSocket';
// Components
import OverallStatsCards from '../../../components/operations/OverallStatsCards';
import PendingReviewSection from './components/PendingReviewSection';
import ProjectListSidebar from './components/ProjectListSidebar';
import TaskTable from './components/TaskTable';
import TaskDetailsModal from './components/TaskDetailsModal';
import RejectModal from './components/RejectModal';
import { getImageUrl } from '../../../utils/imageUtils';
// Types
import { TaskRow, ProjectStat } from './types';

const ManagerOperationsPage = () => {
 const [searchParams] = useSearchParams();
 const queryTaskId = searchParams.get('taskId');

 // State
 const [tasks, setTasks] = useState<TaskRow[]>([]);
 const [deletedTasks, setDeletedTasks] = useState<TaskRow[]>([]);
 const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');

 // WebSocket Hook
 const { lastMessage } = useWebSocket();

 useEffect(() => {
 if (lastMessage?.event === 'task_updated') {
 console.log('[WebSocket] Nhận event cập nhật Task. Refresh in background...');
 fetchTasks(true);
 fetchDeletedTasks(true);
 }
 }, [lastMessage]);

 const [stations, setStations] = useState<{ id: string; name: string }[]>([]);
 const [users, setUsers] = useState<any[]>([]);
 const [owners, setOwners] = useState<any[]>([]);
 const usersRef = useRef<any[]>([]);
 const ownersRef = useRef<any[]>([]);
 const [loading, setLoading] = useState(true); // Kept for potential loading UI
 const [selectedAssignId, setSelectedAssignId] = useState<string | null>(null);
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
 const fetchInitialData = async () => {
 try {
 const [stationsRes, usersRes, ownersRes] = await Promise.all([
 api.get('/assets'),
 api.get('/users'),
 api.get('/owners')
 ]);
 setStations(stationsRes.data || []);
 setUsers(usersRes.data || []);
 setOwners(ownersRes.data || []);
 usersRef.current = usersRes.data || [];
 ownersRef.current = ownersRes.data || [];

 // Fetch tasks ONLY AFTER users are loaded to prevent "Unknown user" race condition
 await Promise.all([fetchTasks(), fetchDeletedTasks()]);
 } catch (err) {
 console.error('Failed to fetch initial data:', err);
 }
 };
 fetchInitialData();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // --- Owner Map for Priority Lookup ---
 const ownerMap = useMemo(() => {
 const map: Record<string, string> = {};
 owners.forEach(o => { map[o.id] = o.name; });
 return map;
 }, [owners]);

 const fetchTasks = async (silent = false) => {
 if (!silent) setLoading(true);
 try {
 const response = await api.get('/assigns');
 const data = response.data || [];
 const flattenedTasks: TaskRow[] = [];

 data.forEach((assign: any) => {
 const detailAssigns = assign.details || assign.detail_assigns || [];

 // Get users string
 let usersString = 'Unknown User';
 let emailsString = '';
 try {
 // id_user can be JSON string or parsed array
 let userIds: string[] = [];
 if (typeof assign.id_user === 'string') {
 userIds = JSON.parse(assign.id_user);
 } else if (Array.isArray(assign.id_user)) {
 userIds = assign.id_user;
 } else if (assign.id_users && Array.isArray(assign.id_users)) {
 userIds = assign.id_users;
 }

 if (userIds.length > 0) {
 const matchedUsers = userIds.map(id => usersRef.current.find(u => u.id === id)).filter(Boolean);
 if (matchedUsers.length > 0) {
 usersString = matchedUsers.map(u => u.name).join(', ');
 emailsString = matchedUsers.map(u => u.email).join(', ');
 }
 }
 } catch (e) {
 console.error("Error parsing assign.id_user", e);
 }

 if (detailAssigns.length > 0) {
 detailAssigns.forEach((t: any) => {
 // Extract basic info
 const statusWork = t.status_work || 0;
 const statusSubmit = t.status_submit || 0;
 const statusApprove = t.status_approve || 0;
 const statusReject = t.status_reject || 0;

 // Calculate statusString
 let statusString = '0000';
 if (statusApprove === 1) statusString = '1110'; // Approved
 else if (statusReject === 1 && statusSubmit === 1) statusString = '1001'; // Resubmitted after rejection
 else if (statusReject === 1) statusString = '1101'; // Rejected - waiting for resubmit
 else if (statusSubmit === 1) statusString = '1100'; // Pending Review
 else if (statusWork === 1) statusString = '1000'; // Doing

 // Images
 const imageUrls: string[] = [];
 if (t.data) {
 try {
 const parsed = typeof t.data === 'string' ? JSON.parse(t.data) : t.data;
 const urlArray = Array.isArray(parsed) ? parsed : [parsed];
 urlArray.forEach(url => {
 if (url && typeof url === 'string') imageUrls.push(getImageUrl(url));
 });
 } catch (e) {
 // Ignore json parse errors
 }
 }

 // Helper to parse JSON array dates safely
 const getLastDate = (dateField: any) => {
 if (!dateField) return null;
 if (Array.isArray(dateField)) {
 return dateField.length > 0 ? dateField[dateField.length - 1] : null;
 } else if (typeof dateField === 'string') {
 if (dateField.startsWith('[')) {
 try {
 const arr = JSON.parse(dateField);
 return arr.length > 0 ? arr[arr.length - 1] : null;
 } catch (e) {
 return dateField;
 }
 }
 return dateField;
 }
 return null;
 };

 const ownerId = assign.project?.id_owner || '';
 const ownerObj = ownerId ? ownersRef.current.find(o => o.id === ownerId) : null;
 const ownerName = ownerObj?.name || '';

 flattenedTasks.push({
 id: t.id,
 assignId: assign.id,
 projectName: assign.project?.name || assign.project?.project_name || 'Unknown Project',
 projectLocation: assign.project?.location || '',
 projectOwnerId: ownerId,
 ownerName: ownerName,
 modelProjectName: assign.model_project?.name || 'Bảo dưỡng phòng ngừa',
 templateName: assign.template?.name || '',
 startTime: assign.start_time || null,
 endTime: assign.end_time || null,
 userName: usersString,
 userEmail: emailsString,

 // V2 Taxonomy
 assetName: t.config?.asset?.name || t.asset?.name || 'Unknown Asset',
 assetId: t.config?.asset?.id || t.asset?.id || 'unknown-asset',
 parentAssetName: t.config?.asset?.parent?.name || undefined,
 workName: t.config?.sub_work?.work?.name || 'Unknown sub-Work name',
 workId: t.config?.sub_work?.work?.id || 'Unknown sub-work id',
 subWorkName: t.config?.sub_work?.name || 'Unknown config',
 subWorkId: t.config?.sub_work?.id || t.config?.id_sub_work || 'unknown-subwork',
 processName: t.process?.name || null,

 // Status
 statusWork: statusWork,
 statusSubmit: statusSubmit,
 statusApprove: statusApprove,
 statusReject: statusReject,
 statusString: statusString,
 statusAssign: assign.status_assign || false,

 updatedAt: t.updated_at || assign.updated_at,
 submittedAt: getLastDate(t.submitted_at),
 approvalAt: getLastDate(t.approval_at),
 rejectedAt: getLastDate(t.rejected_at),

 noteData: t.note_data || "",
 noteApproval: t.note_approval || "",
 noteReject: t.note_reject || "",

 // Person tracking arrays
 idPersonApprove: Array.isArray(t.id_person_approve) ? t.id_person_approve : [],
 idPersonReject: Array.isArray(t.id_person_reject) ? t.id_person_reject : [],

 images: imageUrls,

 // Subtasks: Initial self
 subTasks: []
 });
 });
 }
 });

 // --- Grouping Logic ---
 const groupedMap = new Map<string, TaskRow>();

 flattenedTasks.forEach(task => {
 // Key: AssignID + AssetID + WorkID + SubWorkID (to separate different sub-works of same asset)
 const groupKey = `${task.assignId}_${task.assetId}_${task.workId}_${task.subWorkId}`;

 if (groupedMap.has(groupKey)) {
 const existing = groupedMap.get(groupKey)!;

 // Add to subTasks
 if (!existing.subTasks) {
 existing.subTasks = [];
 }
 existing.subTasks.push(task);

 // Update Parent Representative (Latest updated wins visually)
 if (new Date(task.updatedAt) > new Date(existing.updatedAt)) {
 // Update display timestamps/status to latest
 existing.updatedAt = task.updatedAt;
 existing.statusWork = task.statusWork;
 existing.statusSubmit = task.statusSubmit;
 existing.statusApprove = task.statusApprove;
 existing.statusReject = task.statusReject;
 existing.statusString = task.statusString;
 // Keep content and dates from latest
 existing.noteData = task.noteData;
 existing.submittedAt = task.submittedAt;
 existing.approvalAt = task.approvalAt;
 existing.rejectedAt = task.rejectedAt;
 }

 } else {
 // New Group (Create a shallow clone to avoid mutating the child directly)
 const parentTask = { ...task, subTasks: [task] };
 groupedMap.set(groupKey, parentTask);
 }
 });

 // Convert back to array
 const finalTasks = Array.from(groupedMap.values());

 // Sort by updated_at (newest first)
 finalTasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
 setTasks(finalTasks);

 // Auto-select project
 if (!selectedAssignId && finalTasks.length > 0) {
 setSelectedAssignId(finalTasks[0].assignId);
 }

 } catch (err) {
 console.error("Failed to fetch operational tasks:", err);
 } finally {
 if (!silent) setLoading(false);
 }
 };

 const fetchDeletedTasks = async (silent = false) => {
 if (!silent) setLoading(true);
 try {
 const response = await api.get('/assigns/history');
 const data = response.data || [];
 const flattenedTasks: TaskRow[] = [];

 data.forEach((assign: any) => {
 const detailAssigns = assign.details || assign.detail_assigns || [];

 // Get users string
 let usersString = 'Unknown User';
 let emailsString = '';
 try {
 let userIds: string[] = [];
 if (typeof assign.id_user === 'string') {
 userIds = JSON.parse(assign.id_user);
 } else if (Array.isArray(assign.id_user)) {
 userIds = assign.id_user;
 } else if (assign.id_users && Array.isArray(assign.id_users)) {
 userIds = assign.id_users;
 }

 if (userIds.length > 0) {
 const matchedUsers = userIds.map(id => usersRef.current.find(u => u.id === id)).filter(Boolean);
 if (matchedUsers.length > 0) {
 usersString = matchedUsers.map(u => u.name).join(', ');
 emailsString = matchedUsers.map(u => u.email).join(', ');
 }
 }
 } catch (e) { }

 if (detailAssigns.length > 0) {
 detailAssigns.forEach((t: any) => {
 const statusWork = t.status_work || 0;
 const statusSubmit = t.status_submit || 0;
 const statusApprove = t.status_approve || 0;
 const statusReject = t.status_reject || 0;

 let statusString = '0000';
 if (statusApprove === 1) statusString = '1110';
 else if (statusReject === 1 && statusSubmit === 1) statusString = '1001'; // Resubmitted
 else if (statusReject === 1) statusString = '1101';
 else if (statusSubmit === 1) statusString = '1100';
 else if (statusWork === 1) statusString = '1000';

 // Helper to parse JSON array dates safely
 const getLastDate = (dateField: any) => {
 if (!dateField) return null;
 if (Array.isArray(dateField)) {
 return dateField.length > 0 ? dateField[dateField.length - 1] : null;
 } else if (typeof dateField === 'string') {
 if (dateField.startsWith('[')) {
 try {
 const arr = JSON.parse(dateField);
 return arr.length > 0 ? arr[arr.length - 1] : null;
 } catch (e) {
 return dateField;
 }
 }
 return dateField;
 }
 return null;
 };

 const ownerIdD = assign.project?.id_owner || '';
 const ownerObjD = ownerIdD ? ownersRef.current.find(o => o.id === ownerIdD) : null;
 const ownerNameD = ownerObjD?.name || '';

 flattenedTasks.push({
 id: t.id,
 assignId: assign.id,
 projectName: assign.project?.name || assign.project?.project_name || 'Unknown Project',
 projectLocation: assign.project?.location || '',
 projectOwnerId: ownerIdD,
 ownerName: ownerNameD,
 modelProjectName: assign.model_project?.name || 'Bảo dưỡng phòng ngừa',
 templateName: assign.template?.name || '',
 startTime: assign.start_time || null,
 endTime: assign.end_time || null,
 userName: usersString,
 userEmail: emailsString,
 assetName: t.config?.asset?.name || t.asset?.name || 'Unknown Asset',
 assetId: t.config?.asset?.id || t.asset?.id || 'unknown-asset',
 parentAssetName: t.config?.asset?.parent?.name || undefined,
 workName: t.config?.sub_work?.work?.name || 'Unknown sub-Work name',
 workId: t.config?.sub_work?.work?.id || 'Unknown sub-work id',
 subWorkName: t.config?.sub_work?.name || 'Unknown config',
 subWorkId: t.config?.sub_work?.id || t.config?.id_sub_work || 'unknown-subwork',
 processName: t.process?.name || null,
 statusWork: statusWork,
 statusSubmit: statusSubmit,
 statusApprove: statusApprove,
 statusReject: statusReject,
 statusString: statusString,
 statusAssign: assign.status_assign || false,
 updatedAt: t.updated_at || assign.updated_at,
 submittedAt: getLastDate(t.submitted_at),
 rawSubmittedAt: t.submitted_at,
 approvalAt: getLastDate(t.approval_at),
 rawApprovalAt: t.approval_at,
 rejectedAt: getLastDate(t.rejected_at),
 rawRejectedAt: t.rejected_at,
 noteData: t.note_data || "",
 noteApproval: t.note_approval || "",
 noteReject: t.note_reject || "",
 images: [],
 subTasks: []
 });
 });
 } else {
 // Xử lý Assign nhưng mất DetailAssign do rỗng / đã xoá detail (hiếm)
 flattenedTasks.push({
 id: assign.id, // Fake ID
 assignId: assign.id,
 projectName: assign.project?.name || assign.project?.project_name || 'Unknown Project',
 projectLocation: assign.project?.location || '',
 projectOwnerId: assign.project?.id_owner || '',
 modelProjectName: assign.model_project?.name || 'Bảo dưỡng phòng ngừa',
 templateName: assign.template?.name || '',
 userName: usersString,
 userEmail: emailsString,
 assetName: 'Unknown',
 assetId: 'unknown',
 workName: 'Unknown',
 workId: 'unknown',
 subWorkName: 'Unknown',
 subWorkId: 'unknown',
 processName: null,
 statusWork: 0,
 statusSubmit: 0,
 statusApprove: 0,
 statusReject: 0,
 statusString: '0000',
 statusAssign: assign.status_assign || false,
 updatedAt: assign.updated_at,
 submittedAt: null,
 approvalAt: null,
 rejectedAt: null,
 noteData: "",
 noteApproval: "",
 noteReject: "",
 images: [],
 subTasks: []
 });
 }
 });

 // Grouping Logic
 const groupedMap = new Map<string, TaskRow>();
 flattenedTasks.forEach(task => {
 const groupKey = `${task.assignId}_${task.assetId}_${task.workId}_${task.subWorkId}`;
 if (groupedMap.has(groupKey)) {
 const existing = groupedMap.get(groupKey)!;
 if (!existing.subTasks) existing.subTasks = [];
 existing.subTasks.push(task);
 if (new Date(task.updatedAt) > new Date(existing.updatedAt)) {
 existing.updatedAt = task.updatedAt;
 existing.statusWork = task.statusWork;
 existing.statusSubmit = task.statusSubmit;
 existing.statusApprove = task.statusApprove;
 existing.statusReject = task.statusReject;
 existing.statusString = task.statusString;
 existing.noteData = task.noteData;
 existing.submittedAt = task.submittedAt;
 existing.approvalAt = task.approvalAt;
 existing.rejectedAt = task.rejectedAt;
 }
 } else {
 const parentTask = { ...task, subTasks: [task] };
 groupedMap.set(groupKey, parentTask);
 }
 });

 const finalTasks = Array.from(groupedMap.values());
 finalTasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
 setDeletedTasks(finalTasks);

 } catch (err) {
 console.error("Failed to fetch deleted operations:", err);
 } finally {
 if (!silent) setLoading(false);
 }
 };


 // Auto-refresh: 5-min polling + immediate refresh on any WebSocket event
 useAutoRefresh(() => { fetchTasks(true); fetchDeletedTasks(true); }, 5 * 60 * 1000, true, true);

 // Auto-open task from URL
 useEffect(() => {
 if (queryTaskId && tasks.length > 0) {
 const foundTask = tasks.find(t =>
 t.id === queryTaskId ||
 (t.subTasks && t.subTasks.some(sub => sub.id === queryTaskId))
 );
 if (foundTask) {
 setSelectedTask(foundTask);
 // Optional: Clear param after opening? 
 // window.history.replaceState(null, '', window.location.pathname);
 }
 }
 }, [queryTaskId, tasks]);

 // --- Derived Data ---
 const activeDataList = viewMode === 'active' ? tasks : deletedTasks;

 const projectStats = useMemo(() => {
 const statsMap: Record<string, ProjectStat> = {}; // Key is now assignId
 activeDataList.forEach(t => {
 if (!statsMap[t.assignId]) {
 const ownerNameValue = t.projectOwnerId ? (ownerMap[t.projectOwnerId] || 'Chưa cập nhật') : 'Chưa cập nhật';

 statsMap[t.assignId] = {
 name: t.projectName,
 location: t.projectLocation,
 ownerName: ownerNameValue,
 modelProjectName: t.modelProjectName,
 templateName: t.templateName,
 assignId: t.assignId,
 statusAssign: t.statusAssign,
 total: 0,
 completed: 0,
 pending: 0
 };
 }
 statsMap[t.assignId].total++;
 if (t.statusApprove === 1) statsMap[t.assignId].completed++;
 if (t.statusWork > 0 && t.statusApprove === 0) statsMap[t.assignId].pending++;
 });
 return Object.values(statsMap).sort((a, b) => b.pending - a.pending);
 }, [activeDataList, ownerMap]);

 const pendingReviewTasks = useMemo(() => {
 return activeDataList.filter(t => t.statusSubmit === 1 && t.statusApprove === 0);
 }, [activeDataList]);

 const currentProjectTasks = useMemo(() => {
 if (!selectedAssignId) return [];
 let filtered = activeDataList.filter(t => t.assignId === selectedAssignId);
 if (searchTerm) {
 const lowerTerm = searchTerm.toLowerCase();
 filtered = filtered.filter(t =>
 (t.workName && t.workName.toLowerCase().includes(lowerTerm)) ||
 (t.subWorkName && t.subWorkName.toLowerCase().includes(lowerTerm)) ||
 t.userName.toLowerCase().includes(lowerTerm) ||
 (t.assetName && t.assetName.toLowerCase().includes(lowerTerm))
 );
 }
 return filtered;
 }, [activeDataList, selectedAssignId, searchTerm]);

 // --- Handlers ---
 const handleUpdateStatus = async (taskId: string, status: number) => {
 if (status === -1 && !isRejectModalOpen) {
 // Should initiate rejection flow (open modal)
 setIsRejectModalOpen(true);
 return;
 }

 try {
 if (status === 1) {
 await api.post(`/details/${taskId}/approve`, {
 note_approval: "Duyệt",
 frontend_url: window.location.origin
 });
 } else if (status === -1) {
 // If the modal was open but we somehow directly call this 
 await api.post(`/details/${taskId}/reject`, {
 note_reject: "Từ chối",
 frontend_url: window.location.origin
 });
 }

 // Refresh
 await fetchTasks(true);

 // Close modals if applicable
 if (status === 0) {
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
 api.post(`/details/${r.id}/reject`, {
 note_reject: r.note,
 frontend_url: window.location.origin
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
 // In V2, we might not have a dedicated bulk API yet. We can use Promise.all 
 if (status === 1) {
 await Promise.all(ids.map(id => api.post(`/details/${id}/approve`, { note_approval: note || "Duyệt", frontend_url: window.location.origin })));
 } else if (status === -1) {
 await Promise.all(ids.map(id => api.post(`/details/${id}/reject`, { note_reject: note || "Từ chối", frontend_url: window.location.origin })));
 }
 return Promise.resolve();
 } catch (error) {
 console.error('Failed to update tasks in bulk:', error);
 alert('Có lỗi xảy ra khi cập nhật hàng loạt.');
 return Promise.reject(error);
 }
 };

 const handleCloseProject = async (assignId: string) => {
 if (!window.confirm("Bạn có chắc chắn muốn đóng dự án này? Thao tác này sẽ cập nhật trạng thái kết thúc.")) return;
 setLoading(true);
 try {
 await api.put(`/assigns/${assignId}`, { status_assign: true });
 await fetchTasks(true);
 } catch (error) {
 console.error("Failed to close project", error);
 alert("Lỗi khi đóng dự án");
 } finally {
 setLoading(false);
 }
 };

 const handleDeleteAssign = async (assignId: string) => {
 if (!window.confirm("Bạn có chắc chắn muốn bỏ đợt phân bổ (Assign) này vào thùng rác?")) return;
 setLoading(true);
 try {
 await api.delete(`/assigns/${assignId}`);
 await Promise.all([fetchTasks(true), fetchDeletedTasks(true)]);
 setSelectedAssignId(null);
 } catch (error) {
 console.error("Failed to delete assign", error);
 alert("Lỗi khi xóa đợt phân bổ.");
 } finally {
 setLoading(false);
 }
 };

 const handleRestoreAssign = async (assignId: string) => {
 setLoading(true);
 try {
 await api.post(`/assigns/${assignId}/restore`);
 await Promise.all([fetchTasks(true), fetchDeletedTasks(true)]);
 setSelectedAssignId(null);
 } catch (error) {
 console.error("Failed to restore assign", error);
 alert("Lỗi khi khôi phục đợt phân bổ.");
 } finally {
 setLoading(false);
 }
 };

 const handleReopenProject = async (assignId: string) => {
 if (!window.confirm("Bạn có chắc chắn muốn mở lại dự án này?")) return;
 setLoading(true);
 try {
 await api.put(`/assigns/${assignId}`, { status_assign: false });
 await fetchTasks(true);
 } catch (error) {
 console.error("Failed to reopen project", error);
 alert("Lỗi khi mở lại dự án");
 } finally {
 setLoading(false);
 }
 };

 const handlePermanentDeleteAssign = async (assignId: string) => {
 if (!window.confirm("Cảnh báo: Hành động này KHÔNG THỂ HOÀN TÁC! Xóa sổ đợt phân bổ này cùng toàn dữ liệu/hình ảnh liên quan?")) return;
 setLoading(true);
 try {
 await api.delete(`/assigns/${assignId}/permanent`);
 await fetchDeletedTasks(true);
 setSelectedAssignId(null);
 } catch (error) {
 console.error("Failed to permanently delete assign", error);
 alert("Lỗi khi xóa vĩnh viễn đợt phân bổ.");
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans text-slate-600">
 {/* Header / Stats */}
 <div className="max-w-7xl mx-auto space-y-8">
 {/* Premium Header */}
 <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl border border-white/20 transition-colors">
 <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-teal-600/20 rounded-full blur-3xl -z-10"></div>
 <div className="relative z-10 flex flex-col gap-1">
 <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
 Vận hành
 </h1>
 <p className="text-gray-600 font-medium">Bảng theo dõi và vận hành công việc</p>
 </div>
 </div>

 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div className="flex bg-slate-100 p-1.5 rounded-xl">
 <button
 onClick={() => { setViewMode('active'); setSelectedAssignId(null); }}
 className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'active' ? 'bg-white text-indigo-600 shadow border border-indigo-100/50' : 'text-slate-500 hover:text-slate-700'
 }`}
 >
 Đang hoạt động
 </button>
 <button
 onClick={() => { setViewMode('trash'); setSelectedAssignId(null); }}
 className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'trash' ? 'bg-white text-rose-500 shadow border border-rose-100/50' : 'text-slate-500 hover:text-rose-400'
 }`}
 >
 Thùng rác
 </button>
 </div>
 </div>

 <OverallStatsCards tasks={activeDataList} />

 <PendingReviewSection
 pendingReviewTasks={pendingReviewTasks}
 setSelectedTask={setSelectedTask}
 stations={stations}
 />

 {/* Main Content Grid */}
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
 <ProjectListSidebar
 projectStats={projectStats}
 selectedAssignId={selectedAssignId}
 setSelectedAssignId={setSelectedAssignId}
 onCloseProject={handleCloseProject}
 viewMode={viewMode}
 onDelete={handleDeleteAssign}
 onRestore={handleRestoreAssign}
 onPermanentDelete={handlePermanentDeleteAssign}
 onReopen={handleReopenProject}
 />

 <TaskTable
 tasks={currentProjectTasks}
 selectedAssignId={selectedAssignId}
 searchTerm={searchTerm}
 setSearchTerm={setSearchTerm}
 setSelectedTask={setSelectedTask}
 stations={stations}
 onBulkUpdateStatus={handleBulkUpdateStatus}
 fetchTasks={() => fetchTasks(true)}
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
 selectedAssignId={selectedAssignId}
 />
 </div>
 );
};

export default ManagerOperationsPage;
