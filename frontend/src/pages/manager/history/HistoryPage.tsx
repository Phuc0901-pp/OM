import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addHours } from 'date-fns';
import api from '../../../services/api';
import {
 History, Briefcase, Clock, Search, AlertCircle, CheckCircle2, X, MapPin,
 Trash2, RotateCcw, Building2, GitMerge, UserX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../../../components/common/GlassCard';
import PremiumTable, { ColumnDef } from '../../../components/common/PremiumTable';
import PremiumButton from '../../../components/common/PremiumButton';
import ModernInput from '../../../components/common/ModernInput';
import { parseSafeDate } from '../../../utils/timeUtils';

// ==================== INTERFACES ====================
interface DeletedProject {
 id: string;
 name: string;
 location?: string;
 owner?: { id: string; name: string } | string;
 created_at: string;
 deleted_at: string;
}

interface DeletedUser {
 id: string;
 name: string;
 email: string;
 number_phone?: string;
 role?: { id: string; name: string };
 role_name?: string;
 team?: { id: string; name: string };
 created_at: string;
 deleted_at: string;
}

interface DeletedAssign {
 id: string;
 project: { project_name: string; location: string };
 user: { full_name: string; email: string };
 classification: { name: string };
 deleted_at: string;
}

interface AttendanceRecord {
 id: string;
 user: { id: string; name: string; full_name?: string; email: string };
 project?: { name?: string; project_name?: string; location?: string };
 assign?: { template?: { name: string } };
 status_checkin: number;
 date_checkin: string;
 status_checkout: number;
 date_checkout: string;
 created_at: string;
 personnel_photo?: string;
 checkout_img_url?: string;
 address_checkin?: string;
 checkout_requested?: boolean;
 checkout_rejected?: boolean;
 checkout_approved?: boolean;
 checkout_approved_time?: string;
}

interface DeletedWork {
 id: string;
 name: string;
 deleted_at: string;
}

interface DeletedSubWork {
 id: string;
 name: string;
 work?: { name: string };
 deleted_at: string;
}

interface DeletedAsset {
 id: string;
 name: string;
 project?: { name: string };
 deleted_at: string;
}

type MainTab = 'deleted' | 'work_schedule';
type DeletedSubTab = 'projects' | 'users' | 'assigns' | 'works' | 'sub_works' | 'assets';

// ==================== CONFIRM MODAL ====================
interface ConfirmState {
 show: boolean;
 type: 'delete' | 'restore' | 'deleteAll' | 'restoreAll';
 ids: string[];
 label: string;
}

const defaultConfirm: ConfirmState = { show: false, type: 'delete', ids: [], label: '' };

// ==================== CHECKBOX ROW COMPONENT ====================
function SelectableTable<T extends { id: string }>({
 data, columns, isLoading, selectedIds, onToggleSelect, onToggleSelectAll
}: {
 data: T[];
 columns: ColumnDef<T>[];
 isLoading: boolean;
 selectedIds: Set<string>;
 onToggleSelect: (id: string) => void;
 onToggleSelectAll: (all: boolean) => void;
}) {
 const allSelected = data.length > 0 && data.every(item => selectedIds.has(item.id));
 const someSelected = data.some(item => selectedIds.has(item.id));

 const checkboxCol: ColumnDef<T> = {
 header: (
 <input type="checkbox"
 className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
 checked={allSelected}
 ref={el => { if (el) el.indeterminate = !allSelected && someSelected; }}
 onChange={e => onToggleSelectAll(e.target.checked)}
 />
 ) as any,
 accessor: 'id' as any,
 cell: (_: any, row: any) => (
 <input type="checkbox"
 className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
 checked={selectedIds.has(row.id)}
 onChange={() => onToggleSelect(row.id)}
 onClick={e => e.stopPropagation()}
 />
 ),
 };

 return <PremiumTable columns={[checkboxCol, ...columns]} data={data} isLoading={isLoading} keyField="id" />;
}

// ==================== BULK ACTION TOOLBAR ====================
function BulkToolbar({ count, onRestore, onDelete, onResetSelection }: {
 count: number;
 onRestore: () => void;
 onDelete: () => void;
 onResetSelection: () => void;
}) {
 if (count === 0) return null;
 return (
 <motion.div
 initial={{ opacity: 0, y: -8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl mb-3"
 >
 <span className="text-sm font-bold text-indigo-700">{count} mục đã chọn</span>
 <div className="flex-1" />
 <PremiumButton size="sm" variant="success" onClick={onRestore} icon={<RotateCcw className="w-3 h-3" />}>
 Khôi phục đã chọn
 </PremiumButton>
 <PremiumButton size="sm" variant="danger" onClick={onDelete} icon={<Trash2 className="w-3 h-3" />}>
 Xóa vĩnh viễn đã chọn
 </PremiumButton>
 <button onClick={onResetSelection} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
 <X className="w-4 h-4" />
 </button>
 </motion.div>
 );
}

// ==================== MAIN COMPONENT ====================
const HistoryPage = () => {
 const [searchParams] = useSearchParams();
 const tabParam = searchParams.get('tab');
 const attendanceIdParam = searchParams.get('attendanceId');

 const [activeTab, setActiveTab] = useState<MainTab>(tabParam === 'work_schedule' ? 'work_schedule' : 'deleted');
 const [deletedSubTab, setDeletedSubTab] = useState<DeletedSubTab>('projects');
 const [searchTerm, setSearchTerm] = useState('');
 const [previewImage, setPreviewImage] = useState<string | null>(null);
 const [confirmState, setConfirmState] = useState<ConfirmState>(defaultConfirm);

 // Multi-select state per sub-tab
 const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
 const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
 const [selectedAssignIds, setSelectedAssignIds] = useState<Set<string>>(new Set());
 const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());
 const [selectedSubWorkIds, setSelectedSubWorkIds] = useState<Set<string>>(new Set());
 const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());

 const [page, setPage] = useState(1);
 const pageSize = 10;

 useEffect(() => {
 if (tabParam === 'work_schedule') setActiveTab('work_schedule');
 }, [tabParam]);

 // Reset selection when switching sub-tabs
 useEffect(() => {
 setSelectedProjectIds(new Set());
 setSelectedUserIds(new Set());
 setSelectedAssignIds(new Set());
 setSelectedWorkIds(new Set());
 setSelectedSubWorkIds(new Set());
 setSelectedAssetIds(new Set());
 setPage(1);
 }, [deletedSubTab, activeTab]);

 const queryClient = useQueryClient();

 // ==================== QUERIES ====================
 const { data: deletedProjects = [], isLoading: loadingProjects } = useQuery({
 queryKey: ['deletedProjects'],
 queryFn: () => api.get('/projects/history').then(res => res.data || []),
 enabled: activeTab === 'deleted' && deletedSubTab === 'projects',
 });

 const { data: deletedUsers = [], isLoading: loadingUsers } = useQuery({
 queryKey: ['deletedUsers'],
 queryFn: () => api.get('/users/history').then(res => res.data || []),
 enabled: activeTab === 'deleted' && deletedSubTab === 'users',
 });

 const { data: deletedAssigns = [], isLoading: loadingAssigns } = useQuery({
 queryKey: ['deletedAssignments'],
 queryFn: () => api.get('/assigns/history').then(res => res.data || []),
 enabled: activeTab === 'deleted' && deletedSubTab === 'assigns',
 });

 const { data: schedule = [], isLoading: loadingSchedule, error: scheduleError } = useQuery({
 queryKey: ['attendanceHistory'],
 queryFn: () => api.get('/attendance/history/all?limit=100').then(res => res.data || []),
 enabled: activeTab === 'work_schedule',
 });

 // -- Works --
 const { data: deletedWorks = [], isLoading: loadingWorks } = useQuery({
 queryKey: ['deletedWorks'],
 queryFn: () => api.get('/works/history').then(res => res.data || []),
 enabled: activeTab === 'deleted' && deletedSubTab === 'works',
 });

 // -- SubWorks --
 const { data: deletedSubWorks = [], isLoading: loadingSubWorks } = useQuery({
 queryKey: ['deletedSubWorks'],
 queryFn: () => api.get('/sub-works/history').then(res => res.data || []),
 enabled: activeTab === 'deleted' && deletedSubTab === 'sub_works',
 });

 // -- Assets --
 const { data: deletedAssets = [], isLoading: loadingAssets } = useQuery({
 queryKey: ['deletedAssets'],
 queryFn: () => api.get('/assets/history').then(res => res.data || []),
 enabled: activeTab === 'deleted' && deletedSubTab === 'assets',
 });

 // ==================== MUTATIONS ====================
 // -- Projects --
 const restoreProjectMutation = useMutation({
 mutationFn: (id: string) => api.post(`/projects/${id}/restore`),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedProjects'] }); queryClient.invalidateQueries({ queryKey: ['projects'] }); },
 });
 const permDeleteProjectMutation = useMutation({
 mutationFn: (id: string) => api.delete(`/projects/${id}/permanent`),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedProjects'] }),
 });
 const bulkRestoreProjectsMutation = useMutation({
 mutationFn: (ids: string[]) => api.post('/projects/bulk-restore', { ids }),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedProjects'] }); setSelectedProjectIds(new Set()); },
 });
 const bulkDeleteProjectsMutation = useMutation({
 mutationFn: (ids: string[]) => api.delete('/projects/bulk-permanent', { data: { ids } }),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedProjects'] }); setSelectedProjectIds(new Set()); },
 });

 // -- Users --
 const restoreUserMutation = useMutation({
 mutationFn: (id: string) => api.post(`/users/${id}/restore`),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedUsers'] }); queryClient.invalidateQueries({ queryKey: ['users'] }); },
 });
 const permDeleteUserMutation = useMutation({
 mutationFn: (id: string) => api.delete(`/users/${id}/permanent`),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedUsers'] }),
 });
 const bulkRestoreUsersMutation = useMutation({
 mutationFn: (ids: string[]) => api.post('/users/bulk-restore', { ids }),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedUsers'] }); setSelectedUserIds(new Set()); },
 });
 const bulkDeleteUsersMutation = useMutation({
 mutationFn: (ids: string[]) => api.delete('/users/bulk-permanent', { data: { ids } }),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedUsers'] }); setSelectedUserIds(new Set()); },
 });

 // -- Assigns --
 const restoreAssignMutation = useMutation({
 mutationFn: (id: string) => api.post(`/assigns/${id}/restore`),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedAssignments'] }),
 });
 const permDeleteAssignMutation = useMutation({
 mutationFn: (id: string) => api.delete(`/assigns/${id}/permanent`),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedAssignments'] }),
 });
 const bulkRestoreAssignsMutation = useMutation({
 mutationFn: (ids: string[]) => Promise.all(ids.map(id => api.post(`/assigns/${id}/restore`))),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedAssignments'] }); setSelectedAssignIds(new Set()); },
 });
 const bulkDeleteAssignsMutation = useMutation({
 mutationFn: (ids: string[]) => Promise.all(ids.map(id => api.delete(`/assigns/${id}/permanent`))),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedAssignments'] }); setSelectedAssignIds(new Set()); },
 });

 // -- Works --
 const restoreWorkMutation = useMutation({
 mutationFn: (id: string) => api.post(`/works/${id}/restore`),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedWorks'] }),
 });
 const permDeleteWorkMutation = useMutation({
 mutationFn: (id: string) => api.delete(`/works/${id}/permanent`),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedWorks'] }),
 });
 const bulkRestoreWorksMutation = useMutation({
 mutationFn: (ids: string[]) => api.post('/works/bulk-restore', { ids }),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedWorks'] }); setSelectedWorkIds(new Set()); },
 });
 const bulkDeleteWorksMutation = useMutation({
 mutationFn: (ids: string[]) => api.delete('/works/bulk-permanent', { data: { ids } }),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedWorks'] }); setSelectedWorkIds(new Set()); },
 });

 // -- SubWorks --
 const restoreSubWorkMutation = useMutation({
 mutationFn: (id: string) => api.post(`/sub-works/${id}/restore`),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedSubWorks'] }),
 });
 const permDeleteSubWorkMutation = useMutation({
 mutationFn: (id: string) => api.delete(`/sub-works/${id}/permanent`),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedSubWorks'] }),
 });
 const bulkRestoreSubWorksMutation = useMutation({
 mutationFn: (ids: string[]) => api.post('/sub-works/bulk-restore', { ids }),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedSubWorks'] }); setSelectedSubWorkIds(new Set()); },
 });
 const bulkDeleteSubWorksMutation = useMutation({
 mutationFn: (ids: string[]) => api.delete('/sub-works/bulk-permanent', { data: { ids } }),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedSubWorks'] }); setSelectedSubWorkIds(new Set()); },
 });

 // -- Assets --
 const restoreAssetMutation = useMutation({
 mutationFn: (id: string) => api.post(`/assets/${id}/restore`),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedAssets'] }),
 });
 const permDeleteAssetMutation = useMutation({
 mutationFn: (id: string) => api.delete(`/assets/${id}/permanent`),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deletedAssets'] }),
 });
 const bulkRestoreAssetsMutation = useMutation({
 mutationFn: (ids: string[]) => api.post('/assets/bulk-restore', { ids }),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedAssets'] }); setSelectedAssetIds(new Set()); },
 });
 const bulkDeleteAssetsMutation = useMutation({
 mutationFn: (ids: string[]) => api.delete('/assets/bulk-permanent', { data: { ids } }),
 onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deletedAssets'] }); setSelectedAssetIds(new Set()); },
 });

 // ==================== CONFIRM ACTIONS ====================
 const confirmAction = () => {
 const { type, ids } = confirmState;
 setConfirmState(defaultConfirm);

 if (deletedSubTab === 'projects') {
 if (type === 'restore') ids.forEach(id => restoreProjectMutation.mutate(id));
 else if (type === 'delete') ids.forEach(id => permDeleteProjectMutation.mutate(id));
 else if (type === 'restoreAll') bulkRestoreProjectsMutation.mutate(ids);
 else if (type === 'deleteAll') bulkDeleteProjectsMutation.mutate(ids);
 } else if (deletedSubTab === 'users') {
 if (type === 'restore') ids.forEach(id => restoreUserMutation.mutate(id));
 else if (type === 'delete') ids.forEach(id => permDeleteUserMutation.mutate(id));
 else if (type === 'restoreAll') bulkRestoreUsersMutation.mutate(ids);
 else if (type === 'deleteAll') bulkDeleteUsersMutation.mutate(ids);
 } else if (deletedSubTab === 'assigns') {
 if (type === 'restore') ids.forEach(id => restoreAssignMutation.mutate(id));
 else if (type === 'delete') ids.forEach(id => permDeleteAssignMutation.mutate(id));
 else if (type === 'restoreAll') bulkRestoreAssignsMutation.mutate(ids);
 else if (type === 'deleteAll') bulkDeleteAssignsMutation.mutate(ids);
 } else if (deletedSubTab === 'works') {
 if (type === 'restore') ids.forEach(id => restoreWorkMutation.mutate(id));
 else if (type === 'delete') ids.forEach(id => permDeleteWorkMutation.mutate(id));
 else if (type === 'restoreAll') bulkRestoreWorksMutation.mutate(ids);
 else if (type === 'deleteAll') bulkDeleteWorksMutation.mutate(ids);
 } else if (deletedSubTab === 'sub_works') {
 if (type === 'restore') ids.forEach(id => restoreSubWorkMutation.mutate(id));
 else if (type === 'delete') ids.forEach(id => permDeleteSubWorkMutation.mutate(id));
 else if (type === 'restoreAll') bulkRestoreSubWorksMutation.mutate(ids);
 else if (type === 'deleteAll') bulkDeleteSubWorksMutation.mutate(ids);
 } else if (deletedSubTab === 'assets') {
 if (type === 'restore') ids.forEach(id => restoreAssetMutation.mutate(id));
 else if (type === 'delete') ids.forEach(id => permDeleteAssetMutation.mutate(id));
 else if (type === 'restoreAll') bulkRestoreAssetsMutation.mutate(ids);
 else if (type === 'deleteAll') bulkDeleteAssetsMutation.mutate(ids);
 }
 };
 // ==================== SELECTION HELPERS ====================
 const createToggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
 (id: string) => setter(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

 const createToggleAll = (
 setter: React.Dispatch<React.SetStateAction<Set<string>>>,
 data: { id: string }[]
 ) => (all: boolean) => setter(all ? new Set(data.map(d => d.id)) : new Set());

 const toggleProject = createToggle(setSelectedProjectIds);
 const toggleAllProjects = createToggleAll(setSelectedProjectIds, deletedProjects);
 const toggleUser = createToggle(setSelectedUserIds);
 const toggleAllUsers = createToggleAll(setSelectedUserIds, deletedUsers);
 const toggleAssign = createToggle(setSelectedAssignIds);
 const toggleAllAssigns = createToggleAll(setSelectedAssignIds, deletedAssigns);

 const toggleWork = createToggle(setSelectedWorkIds);
 const toggleAllWorks = createToggleAll(setSelectedWorkIds, deletedWorks);
 const toggleSubWork = createToggle(setSelectedSubWorkIds);
 const toggleAllSubWorks = createToggleAll(setSelectedSubWorkIds, deletedSubWorks);
 const toggleAsset = createToggle(setSelectedAssetIds);
 const toggleAllAssets = createToggleAll(setSelectedAssetIds, deletedAssets);

 // ==================== COLUMNS ====================
 const projectColumns: ColumnDef<DeletedProject>[] = useMemo(() => [
 {
 header: 'Dự án',
 accessor: 'name',
 cell: (val: any, row: any) => (
 <div>
 <div className="font-bold text-slate-800">{row.name}</div>
 <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {row.location || 'N/A'}</div>
 </div>
 )
 },
 {
 header: 'Chủ sở hữu',
 accessor: (item) => typeof item.owner === 'string' ? item.owner : item.owner?.name,
 cell: (val: any, row: any) => (
 <span className="text-sm text-slate-600">{typeof row.owner === 'string' ? row.owner : (row.owner?.name || '—')}</span>
 )
 },
 {
 header: 'Thời gian xóa',
 accessor: 'deleted_at',
 cell: (val: any) => (
 <div className="flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded-lg w-fit">
 <Trash2 className="w-3 h-3" />
 <span className="text-xs font-medium">{val ? parseSafeDate(val).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</span>
 </div>
 )
 },
 {
 header: 'Thao tác',
 accessor: 'id',
 cell: (_: any, row: any) => (
 <div className="flex items-center gap-2">
 <PremiumButton size="sm" variant="success" onClick={() => setConfirmState({ show: true, type: 'restore', ids: [row.id], label: row.name })} icon={<RotateCcw className="w-3 h-3" />}>Khôi phục</PremiumButton>
 <PremiumButton size="sm" variant="danger" onClick={() => setConfirmState({ show: true, type: 'delete', ids: [row.id], label: row.name })} icon={<Trash2 className="w-3 h-3" />}>Xóa</PremiumButton>
 </div>
 )
 }
 ], []);

 const userColumns: ColumnDef<DeletedUser>[] = useMemo(() => [
 {
 header: 'Nhân sự',
 accessor: 'name',
 cell: (val: any, row: any) => (
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-xs font-bold text-rose-600">
 {(row.name || '?').charAt(0)}
 </div>
 <div>
 <div className="font-bold text-slate-700">{row.name}</div>
 <div className="text-xs text-slate-400">{row.email}</div>
 </div>
 </div>
 )
 },
 {
 header: 'Vai trò / Nhóm',
 accessor: (item) => item.role?.name ?? item.role_name,
 cell: (val: any, row: any) => (
 <div>
 <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600">{row.role?.name || row.role_name || 'N/A'}</span>
 <div className="text-xs text-slate-400 mt-0.5">{row.team?.name || '—'}</div>
 </div>
 )
 },
 {
 header: 'SĐT',
 accessor: 'number_phone',
 cell: (val: any) => <span className="text-sm text-slate-500">{val || '—'}</span>
 },
 {
 header: 'Thời gian xóa',
 accessor: 'deleted_at',
 cell: (val: any) => (
 <div className="flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded-lg w-fit">
 <Trash2 className="w-3 h-3" />
 <span className="text-xs font-medium">{val ? parseSafeDate(val).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</span>
 </div>
 )
 },
 {
 header: 'Thao tác',
 accessor: 'id',
 cell: (_: any, row: any) => (
 <div className="flex items-center gap-2">
 <PremiumButton size="sm" variant="success" onClick={() => setConfirmState({ show: true, type: 'restore', ids: [row.id], label: row.name })} icon={<RotateCcw className="w-3 h-3" />}>Khôi phục</PremiumButton>
 <PremiumButton size="sm" variant="danger" onClick={() => setConfirmState({ show: true, type: 'delete', ids: [row.id], label: row.name })} icon={<Trash2 className="w-3 h-3" />}>Xóa</PremiumButton>
 </div>
 )
 }
 ], []);

 const assignColumns: ColumnDef<DeletedAssign>[] = useMemo(() => [
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
 <span className="text-xs">{val ? parseSafeDate(val).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</span>
 </div>
 )
 },
 {
 header: 'Thao tác',
 accessor: 'id',
 cell: (_: any, row: any) => (
 <div className="flex items-center gap-2">
 <PremiumButton size="sm" variant="success" onClick={() => setConfirmState({ show: true, type: 'restore', ids: [row.id], label: row.project?.project_name })} icon={<RotateCcw className="w-3 h-3" />}>Khôi phục</PremiumButton>
 <PremiumButton size="sm" variant="danger" onClick={() => setConfirmState({ show: true, type: 'delete', ids: [row.id], label: row.project?.project_name })} icon={<Trash2 className="w-3 h-3" />}>Xóa</PremiumButton>
 </div>
 )
 }
 ], []);

 const workColumns: ColumnDef<DeletedWork>[] = useMemo(() => [
 {
 header: 'Hạng mục',
 accessor: 'name',
 cell: (val: any) => <span className="font-bold text-slate-800">{val}</span>
 },
 {
 header: 'Thời gian xóa',
 accessor: 'deleted_at',
 cell: (val: any) => (
 <div className="flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded-lg w-fit">
 <Trash2 className="w-3 h-3" />
 <span className="text-xs font-medium">{val ? parseSafeDate(val).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</span>
 </div>
 )
 },
 {
 header: 'Thao tác',
 accessor: 'id',
 cell: (_: any, row: any) => (
 <div className="flex items-center gap-2">
 <PremiumButton size="sm" variant="success" onClick={() => setConfirmState({ show: true, type: 'restore', ids: [row.id], label: row.name })} icon={<RotateCcw className="w-3 h-3" />}>Khôi phục</PremiumButton>
 <PremiumButton size="sm" variant="danger" onClick={() => setConfirmState({ show: true, type: 'delete', ids: [row.id], label: row.name })} icon={<Trash2 className="w-3 h-3" />}>Xóa</PremiumButton>
 </div>
 )
 }
 ], []);

 const subWorkColumns: ColumnDef<DeletedSubWork>[] = useMemo(() => [
 {
 header: 'Công việc',
 accessor: 'name',
 cell: (val: any) => <span className="font-bold text-slate-800">{val}</span>
 },
 {
 header: 'Hạng mục gốc',
 accessor: (item) => item.work?.name,
 cell: (val: any) => <span className="text-sm text-slate-600">{val || '—'}</span>
 },
 {
 header: 'Thời gian xóa',
 accessor: 'deleted_at',
 cell: (val: any) => (
 <div className="flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded-lg w-fit">
 <Trash2 className="w-3 h-3" />
 <span className="text-xs font-medium">{val ? parseSafeDate(val).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</span>
 </div>
 )
 },
 {
 header: 'Thao tác',
 accessor: 'id',
 cell: (_: any, row: any) => (
 <div className="flex items-center gap-2">
 <PremiumButton size="sm" variant="success" onClick={() => setConfirmState({ show: true, type: 'restore', ids: [row.id], label: row.name })} icon={<RotateCcw className="w-3 h-3" />}>Khôi phục</PremiumButton>
 <PremiumButton size="sm" variant="danger" onClick={() => setConfirmState({ show: true, type: 'delete', ids: [row.id], label: row.name })} icon={<Trash2 className="w-3 h-3" />}>Xóa</PremiumButton>
 </div>
 )
 }
 ], []);

 const assetColumns: ColumnDef<DeletedAsset>[] = useMemo(() => [
 {
 header: 'Tài sản',
 accessor: 'name',
 cell: (val: any) => <span className="font-bold text-slate-800">{val}</span>
 },
 {
 header: 'Dự án',
 accessor: (item) => item.project?.name,
 cell: (val: any) => <span className="text-sm text-slate-600">{val || '—'}</span>
 },
 {
 header: 'Thời gian xóa',
 accessor: 'deleted_at',
 cell: (val: any) => (
 <div className="flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded-lg w-fit">
 <Trash2 className="w-3 h-3" />
 <span className="text-xs font-medium">{val ? parseSafeDate(val).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'}</span>
 </div>
 )
 },
 {
 header: 'Thao tác',
 accessor: 'id',
 cell: (_: any, row: any) => (
 <div className="flex items-center gap-2">
 <PremiumButton size="sm" variant="success" onClick={() => setConfirmState({ show: true, type: 'restore', ids: [row.id], label: row.name })} icon={<RotateCcw className="w-3 h-3" />}>Khôi phục</PremiumButton>
 <PremiumButton size="sm" variant="danger" onClick={() => setConfirmState({ show: true, type: 'delete', ids: [row.id], label: row.name })} icon={<Trash2 className="w-3 h-3" />}>Xóa</PremiumButton>
 </div>
 )
 }
 ], []);

 // Schedule columns
 const MultiImageCell = ({ src, label }: { src?: string, label: string }) => {
 if (!src) return <span className="text-xs text-slate-400 italic">No Img</span>;
 let images: string[] = [];
 if (src.trim().startsWith('[') || src.trim().startsWith('{')) {
 try {
 const parsed = JSON.parse(src);
 if (Array.isArray(parsed) && parsed.length > 0) {
 images = parsed;
 } else if (parsed && typeof parsed === 'object') {
 // Extract all images from the map of photo URLs
 Object.values(parsed).forEach(val => {
 if (typeof val === 'string') {
 // Some values might be JSON arrays themselves if they contain multiple photos
 if (val.trim().startsWith('[')) {
 try {
 const subParsed = JSON.parse(val);
 if (Array.isArray(subParsed)) {
 images = [...images, ...subParsed];
 }
 } catch (e) {
 images.push(val);
 }
 } else {
 images.push(val);
 }
 } else if (Array.isArray(val)) {
 images = [...images, ...val];
 }
 });
 } else if (src.length > 5) {
 images = [src];
 }
 } catch (e) {
 if (src.trim().startsWith('[')) {
 let cleanedStr = src.trim();
 cleanedStr = cleanedStr.substring(1, cleanedStr.length - 1);
 const parts = cleanedStr.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
 images = parts.filter(Boolean);
 }
 if (images.length === 0) images = [src];
 }
 } else {
 images = [src];
 }
 if (images.length === 0) return <span className="text-xs text-slate-400 italic">No Img</span>;
 return (
 <div className="flex flex-wrap gap-2">
 {images.map((imgSrcRaw, index) => {
 // Clean up any extra quotes that might have survived the JSON parse step
 const imgSrc = typeof imgSrcRaw === 'string' ? imgSrcRaw.replace(/^['"]|['"]$/g, '') : imgSrcRaw;
 let objectKey = imgSrc;
 try {
 if (imgSrc.startsWith('http')) {
 const urlObj = new URL(imgSrc);
 // pathname starts with '/' so split('/') results in ['', 'dev', 'raitek-office', ...]
 // we need to skip the bucket name ('dev') so we slice at index 2
 const parts = urlObj.pathname.split('/');
 if (parts.length > 2) objectKey = parts.slice(2).join('/');
 }
 } catch (e) { }
 return (
 <div key={index} className="relative cursor-pointer" onClick={() => setPreviewImage(objectKey)}>
 <div className="group relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:ring-2 hover:ring-indigo-500 transition-all">
 <img src={`/api/media/proxy?key=${encodeURIComponent(objectKey)}`} alt={`${label} ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
 </div>
 </div>
 );
 })}
 </div>
 );
 };

 const scheduleColumns: ColumnDef<AttendanceRecord>[] = useMemo(() => [
 {
 header: 'Thời gian', accessor: 'created_at',
 cell: (val: any) => (
 <div className="flex flex-col">
 <span className="font-bold text-slate-700">{parseSafeDate(val).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
 <span className="text-xs text-slate-400">{parseSafeDate(val).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
 </div>
 )
 },
 {
 header: 'Nhân sự', accessor: (item) => item.user?.name || item.user?.full_name,
 cell: (val: any, row: any) => (
 <div>
 <div className="font-bold text-slate-800">{row.user?.name || row.user?.full_name}</div>
 <div className="text-xs text-slate-500">{row.user?.email}</div>
 </div>
 )
 },
 {
 header: 'Dự án', accessor: (item) => item.project?.name || item.project?.project_name,
 cell: (val: any, row: any) => (
 <div>
 <div className="font-bold text-slate-800 flex items-center gap-1"><Briefcase className="w-3 h-3 text-slate-400" />{row.project?.name || row.project?.project_name || 'Văn phòng / Khác'}</div>
 {row.address_checkin && <div className="text-[10px] text-slate-400 italic ml-4 flex items-center gap-1"><MapPin className="w-3 h-3" /> {row.address_checkin}</div>}
 </div>
 )
 },
 {
 header: 'Nội dung công việc', accessor: (item: any) => item.assign?.template?.name,
 cell: (val: any, row: any) => (
 <div>
 <div className="font-bold text-slate-800 flex items-center gap-1 line-clamp-2">
 {row.assign?.template?.name ? (
 <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-xs">{row.assign.template.name}</span>
 ) : (
 <span className="text-slate-400 text-xs italic">Không phân bổ cụ thể</span>
 )}
 </div>
 </div>
 )
 },
 {
 header: 'Check-in', accessor: 'personnel_photo',
 cell: (val: any, row: any) => (
 <div className="flex items-center gap-3">
 <MultiImageCell src={row.personnel_photo} label="Checkin" />
 <div>
 <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mb-1 w-fit">
 <Clock className="w-3 h-3" />
 {row.date_checkin ? addHours(parseSafeDate(row.date_checkin), 7).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '---'}
 </div>
 </div>
 </div>
 )
 },
 {
 header: 'Check-out', accessor: 'checkout_img_url',
 cell: (val: any, row: any) => {
 const isRejected = !!row.checkout_rejected_at;
 const isApproved = !!row.checkout_approved_time;
 return (
 <div className="flex items-center gap-3">
 <MultiImageCell src={row.checkout_img_url} label="Checkout" />
 <div>
 <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md mb-1 w-fit ${isRejected ? 'bg-red-50 text-red-700' : isApproved ? 'bg-indigo-50 text-indigo-700' : row.checkout_requested ? 'bg-amber-50 text-amber-700' : 'text-slate-400'}`}>
 <Clock className="w-3 h-3" />
 {row.date_checkout ? addHours(parseSafeDate(row.date_checkout), 7).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : isRejected ? 'Bị từ chối' : row.checkout_requested ? 'Chờ duyệt' : '---'}
 </div>
 </div>
 </div>
 );
 }
 },
 ], []);

 // ==================== FILTERED DATA ====================
 const filteredProjects = useMemo(() => deletedProjects.filter((item: DeletedProject) =>
 item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 item.location?.toLowerCase().includes(searchTerm.toLowerCase())
 ), [deletedProjects, searchTerm]);

 const filteredUsers = useMemo(() => deletedUsers.filter((item: DeletedUser) =>
 item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 item.email?.toLowerCase().includes(searchTerm.toLowerCase())
 ), [deletedUsers, searchTerm]);

 const filteredAssigns = useMemo(() => deletedAssigns.filter((item: DeletedAssign) =>
 item.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 item.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
 ), [deletedAssigns, searchTerm]);

 const filteredSchedule = useMemo(() => {
 let data = schedule;
 if (attendanceIdParam) return data.filter((item: AttendanceRecord) => item.id === attendanceIdParam);
 return data.filter((item: AttendanceRecord) =>
 (item.user?.name || item.user?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
 (item.project?.name || item.project?.project_name || '').toLowerCase().includes(searchTerm.toLowerCase())
 );
 }, [schedule, searchTerm, attendanceIdParam]);

 // Pagination
 const getPageData = (arr: any[]) => {
 const start = (page - 1) * pageSize;
 return arr.slice(start, start + pageSize);
 };

 const filteredWorks = useMemo(() => deletedWorks.filter((item: DeletedWork) =>
 item.name?.toLowerCase().includes(searchTerm.toLowerCase())
 ), [deletedWorks, searchTerm]);

 const filteredSubWorks = useMemo(() => deletedSubWorks.filter((item: DeletedSubWork) =>
 item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 item.work?.name?.toLowerCase().includes(searchTerm.toLowerCase())
 ), [deletedSubWorks, searchTerm]);

 const filteredAssets = useMemo(() => deletedAssets.filter((item: DeletedAsset) =>
 item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 item.project?.name?.toLowerCase().includes(searchTerm.toLowerCase())
 ), [deletedAssets, searchTerm]);

 const currentData = deletedSubTab === 'projects' ? filteredProjects
 : deletedSubTab === 'users' ? filteredUsers
 : deletedSubTab === 'assigns' ? filteredAssigns
 : deletedSubTab === 'works' ? filteredWorks
 : deletedSubTab === 'sub_works' ? filteredSubWorks
 : filteredAssets;
 const totalPages = Math.ceil((activeTab === 'deleted' ? currentData.length : filteredSchedule.length) / pageSize) || 1;

 useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

 // Current selected ids for bulk toolbar
 const currentSelectedIds = deletedSubTab === 'projects' ? selectedProjectIds
 : deletedSubTab === 'users' ? selectedUserIds
 : deletedSubTab === 'assigns' ? selectedAssignIds
 : deletedSubTab === 'works' ? selectedWorkIds
 : deletedSubTab === 'sub_works' ? selectedSubWorkIds
 : selectedAssetIds;
 const currentSelectedArr = Array.from(currentSelectedIds);

 // ==================== RENDER ====================
 const subTabConfig: { key: DeletedSubTab, label: string, icon: React.ReactNode }[] = [
 { key: 'projects', label: 'Dự án', icon: <Building2 className="w-4 h-4" /> },
 { key: 'assets', label: 'Tài sản', icon: <Briefcase className="w-4 h-4" /> },
 { key: 'works', label: 'Hạng mục', icon: <GitMerge className="w-4 h-4" /> },
 { key: 'sub_works', label: 'Công việc', icon: <History className="w-4 h-4" /> },
 { key: 'users', label: 'Nhân sự', icon: <UserX className="w-4 h-4" /> },
 { key: 'assigns', label: 'Phân bổ', icon: <MapPin className="w-4 h-4" /> },
 ];

 return (
 <div className="p-4 md:p-8 space-y-6 pb-24">
 {/* Premium Header */}
 <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl border border-white/20 transition-colors">
 <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl -z-10"></div>
 <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="flex flex-col gap-1">
 <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
 Lịch sử & Theo dõi
 </h1>
 <p className="text-gray-600 font-medium">Quản lý lịch sử xóa và nhật ký công tác</p>
 </div>
 <div className="flex items-center gap-3 bg-white/40 p-1.5 rounded-xl border border-slate-200/50 shadow-sm backdrop-blur-md">
 <button
 onClick={() => { setActiveTab('deleted'); setPage(1); }}
 className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'deleted' ? 'bg-white shadow-md text-red-600 ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
 >
 Lịch sử Xóa
 </button>
 <button
 onClick={() => { setActiveTab('work_schedule'); setPage(1); }}
 className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'work_schedule' ? 'bg-white shadow-md text-indigo-600 ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
 >
 Lịch trình
 </button>
 </div>
 </div>
 </div>

 <GlassCard className="!p-0 overflow-hidden flex flex-col min-h-[600px]">
 {/* Tab-specific toolbar */}
 <div className="p-4 border-b border-slate-100">
 {activeTab === 'deleted' && (
 <div className="flex gap-2 mb-3">
 {subTabConfig.map(tab => (
 <button
 key={tab.key}
 onClick={() => { setDeletedSubTab(tab.key); setPage(1); }}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${deletedSubTab === tab.key
 ? 'bg-red-50 text-red-600 border-red-200 shadow-sm'
 : 'text-slate-500 border-transparent hover:bg-slate-100'
 }`}
 >
 {tab.icon}
 {tab.label}
 </button>
 ))}
 </div>
 )}

 <div className="flex items-center justify-between gap-4">
 <ModernInput
 placeholder="Tìm kiếm..."
 value={searchTerm}
 onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
 icon={<Search className="w-4 h-4" />}
 className="max-w-md"
 />
 {activeTab === 'deleted' && currentSelectedArr.length === 0 && currentData.length > 0 && (
 <div className="flex gap-2">
 <PremiumButton size="sm" variant="success" onClick={() => setConfirmState({ show: true, type: 'restoreAll', ids: currentData.map((d: any) => d.id), label: `${currentData.length} mục` })} icon={<RotateCcw className="w-3 h-3" />}>
 Khôi phục tất cả
 </PremiumButton>
 <PremiumButton size="sm" variant="danger" onClick={() => setConfirmState({ show: true, type: 'deleteAll', ids: currentData.map((d: any) => d.id), label: `${currentData.length} mục` })} icon={<Trash2 className="w-3 h-3" />}>
 Xóa tất cả
 </PremiumButton>
 </div>
 )}
 </div>
 </div>

 <div className="flex-1 p-4">
 {/* Bulk Selection Toolbar */}
 <AnimatePresence>
 {activeTab === 'deleted' && currentSelectedArr.length > 0 && (
 <BulkToolbar
 count={currentSelectedArr.length}
 onRestore={() => setConfirmState({ show: true, type: 'restoreAll', ids: currentSelectedArr, label: `${currentSelectedArr.length} mục đã chọn` })}
 onDelete={() => setConfirmState({ show: true, type: 'deleteAll', ids: currentSelectedArr, label: `${currentSelectedArr.length} mục đã chọn` })}
 onResetSelection={() => {
 setSelectedProjectIds(new Set());
 setSelectedUserIds(new Set());
 setSelectedAssignIds(new Set());
 }}
 />
 )}
 </AnimatePresence>

 <AnimatePresence mode="wait">
 {activeTab === 'deleted' ? (
 <motion.div key={`deleted-${deletedSubTab}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
 {deletedSubTab === 'projects' && (
 <SelectableTable
 data={getPageData(filteredProjects)}
 columns={projectColumns}
 isLoading={loadingProjects}
 selectedIds={selectedProjectIds}
 onToggleSelect={toggleProject}
 onToggleSelectAll={toggleAllProjects}
 />
 )}
 {deletedSubTab === 'users' && (
 <SelectableTable
 data={getPageData(filteredUsers)}
 columns={userColumns}
 isLoading={loadingUsers}
 selectedIds={selectedUserIds}
 onToggleSelect={toggleUser}
 onToggleSelectAll={toggleAllUsers}
 />
 )}
 {deletedSubTab === 'assigns' && (
 <SelectableTable
 data={getPageData(filteredAssigns)}
 columns={assignColumns}
 isLoading={loadingAssigns}
 selectedIds={selectedAssignIds}
 onToggleSelect={toggleAssign}
 onToggleSelectAll={toggleAllAssigns}
 />
 )}
 {deletedSubTab === 'works' && (
 <SelectableTable
 data={getPageData(filteredWorks)}
 columns={workColumns}
 isLoading={loadingWorks}
 selectedIds={selectedWorkIds}
 onToggleSelect={toggleWork}
 onToggleSelectAll={toggleAllWorks}
 />
 )}
 {deletedSubTab === 'sub_works' && (
 <SelectableTable
 data={getPageData(filteredSubWorks)}
 columns={subWorkColumns}
 isLoading={loadingSubWorks}
 selectedIds={selectedSubWorkIds}
 onToggleSelect={toggleSubWork}
 onToggleSelectAll={toggleAllSubWorks}
 />
 )}
 {deletedSubTab === 'assets' && (
 <SelectableTable
 data={getPageData(filteredAssets)}
 columns={assetColumns}
 isLoading={loadingAssets}
 selectedIds={selectedAssetIds}
 onToggleSelect={toggleAsset}
 onToggleSelectAll={toggleAllAssets}
 />
 )}
 </motion.div>
 ) : (
 <motion.div key="schedule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
 <PremiumTable columns={scheduleColumns} data={getPageData(filteredSchedule)} isLoading={loadingSchedule} keyField="id" />
 {scheduleError && <div className="text-center text-red-500 p-4">Không thể tải lịch trình</div>}
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 {/* Pagination */}
 <div className="p-4 border-t border-slate-100 flex justify-center items-center gap-4">
 <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-50 text-sm font-medium">Trước</button>
 <span className="text-sm font-bold text-slate-600">Trang {page} / {totalPages || 1}</span>
 <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-50 text-sm font-medium">Sau</button>
 </div>
 </GlassCard>

 {/* Confirm Modal */}
 <AnimatePresence>
 {confirmState.show && (
 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
 <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
 <GlassCard className="w-full max-w-md p-6">
 <div className="flex flex-col items-center text-center mb-6">
 <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${(confirmState.type === 'restore' || confirmState.type === 'restoreAll') ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
 {(confirmState.type === 'restore' || confirmState.type === 'restoreAll') ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
 </div>
 <h3 className="text-xl font-bold text-slate-800">
 {(confirmState.type === 'restore' || confirmState.type === 'restoreAll') ? 'Xác nhận khôi phục' : 'Xác nhận xóa vĩnh viễn'}
 </h3>
 <p className="text-slate-500 mt-2 text-sm">
 {(confirmState.type === 'restore' || confirmState.type === 'restoreAll')
 ? <><strong>"{confirmState.label}"</strong> sẽ xuất hiện trở lại.</>
 : <><strong>"{confirmState.label}"</strong> sẽ bị xóa khỏi database.<br /><span className="text-red-500 font-bold">Không thể hoàn tác!</span></>
 }
 </p>
 </div>
 <div className="flex gap-3">
 <PremiumButton variant="ghost" className="flex-1" onClick={() => setConfirmState(defaultConfirm)}>Hủy bỏ</PremiumButton>
 <PremiumButton
 variant={(confirmState.type === 'restore' || confirmState.type === 'restoreAll') ? 'success' : 'danger'}
 className="flex-1"
 onClick={confirmAction}
 >
 {(confirmState.type === 'restore' || confirmState.type === 'restoreAll') ? 'Khôi phục ngay' : 'Xóa vĩnh viễn'}
 </PremiumButton>
 </div>
 </GlassCard>
 </motion.div>
 </div>
 )}
 </AnimatePresence>

 {/* IMAGE PREVIEW MODAL */}
 {createPortal(
 <AnimatePresence>
 {previewImage && (
 <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
 <motion.img initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
 src={`/api/media/proxy?key=${encodeURIComponent(previewImage)}`}
 className="max-w-[95vw] max-h-[95vh] rounded-lg shadow-2xl object-contain select-none"
 onClick={e => e.stopPropagation()}
 />
 <button className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/20 hover:bg-red-500/80 p-2 rounded-full transition-all" onClick={() => setPreviewImage(null)}>
 <X className="w-6 h-6" />
 </button>
 </div>
 )}
 </AnimatePresence>,
 document.body
 )}
 </div>
 );
};

export default HistoryPage;
