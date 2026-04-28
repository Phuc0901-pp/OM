import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
 Users, Clock, MapPin, Image as ImageIcon,
 CheckCircle2, AlertCircle, Loader2, Printer, X
} from 'lucide-react';
import { getImageUrl } from '../../utils/imageUtils';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const extractAllImages = (field: any): string[] => {
 if (!field) return [];
 let images: string[] = [];
 let trimmed = '';

 if (typeof field === 'string') {
 trimmed = field.trim();
 } else if (Array.isArray(field)) {
 return field.filter(f => typeof f === 'string');
 } else {
 return [];
 }

 if (trimmed.startsWith('{')) {
 try {
 const parsedObject = JSON.parse(trimmed);
 Object.values(parsedObject).forEach((val: any) => {
 if (typeof val === 'string') {
 if (val.trim().startsWith('[')) {
 try {
 const subArr = JSON.parse(val);
 if (Array.isArray(subArr)) {
 images.push(...subArr.filter((item: any) => typeof item === 'string'));
 }
 } catch {
 images.push(val);
 }
 } else {
 images.push(val);
 }
 } else if (Array.isArray(val)) {
 images.push(...val.filter((item: any) => typeof item === 'string'));
 }
 });
 } catch { /* ignore */ }
 } else if (trimmed.startsWith('[')) {
 try {
 const parsed = JSON.parse(trimmed);
 if (Array.isArray(parsed) && parsed.length > 0) {
 images.push(...parsed.filter((item: any) => typeof item === 'string'));
 }
 } catch {
 let cleanedStr = trimmed.substring(1, trimmed.length - 1);
 const parts = cleanedStr.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
 images.push(...parts.filter(Boolean));
 }
 } else {
 images.push(trimmed);
 }

 return images.map(u => u.replace(/^['"]|['"]$/g, '')).filter(Boolean);
};


interface AttendanceRecord {
 id: string;
 id_user: string;
 id_assign: string;
 id_project: string;
 date_checkin: string | null;
 date_checkout: string | null;
 address_checkin: string;
 address_checkout: string;
 personnel_photo: string;
 id_card_front?: string;
 id_card_back?: string;
 safety_card_front?: string;
 safety_card_back?: string;
 tools_photos?: string;
 documents_photos?: string;
 checkout_img_url?: string;
 checkout_approved: boolean;
 checkout_approved_time: string | null;
 user: { id: string; name: string; email: string };
}

// Recreate the TaskRow structure that the report needs
interface GroupedTask {
 id: string;
 workName: string;
 subWorkName: string;
 assetName: string;
 approvalAt: string | null;
 noteData: string;
 images: string[];
 subTasks: any[]; // The processes
}

const PublicBulkReportPage: React.FC = () => {
 const { assignId, reportId } = useParams<{ assignId?: string; reportId?: string }>();
 const [searchParams] = useSearchParams();
 const itemsParam = searchParams.get('items'); // Fallback for old URL
 const reportType = searchParams.get('type') || 'approve'; // Fallback
 const commentParam = searchParams.get('comment') || '';
 
 const [dynamicIsReject, setDynamicIsReject] = useState(reportType === 'reject');
 const [conclusionText, setConclusionText] = useState(commentParam);
 const [customTitle, setCustomTitle] = useState('');
 
 const [data, setData] = useState<any>(null);
 const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [selectedImage, setSelectedImage] = useState<string | null>(null);
 const printRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 const fetchReportData = async () => {
 try {
 let rAssignId = assignId;
 let rItemsParam = itemsParam;
 let rType = reportType;

 if (reportId) {
 const metaRes = await fetch(`${API_BASE}/api/public/generic-report/${reportId}`);
 if (!metaRes.ok) throw new Error('Báo cáo không tồn tại hoặc đã bị xóa.');
 const metaBody = await metaRes.json();
 if (!metaBody.success) throw new Error('Báo cáo không tồn tại.');
 const meta = metaBody.data;

 rAssignId = meta.id_assign;
 rType = meta.type || 'approve';
 setDynamicIsReject(rType === 'reject');
 setConclusionText(meta.conclusion || '');
 setCustomTitle(meta.title || '');

 try {
 let parsedKeys = typeof meta.item_keys === 'string' ? JSON.parse(meta.item_keys) : meta.item_keys;
 if (Array.isArray(parsedKeys) && parsedKeys.length > 0) {
 if (parsedKeys[0] === 'all') rItemsParam = 'all';
 else rItemsParam = parsedKeys.join(',');
 }
 } catch {}
 }

 if (!rAssignId) {
 throw new Error('Thiếu ID Báo cáo hoặc Assign.');
 }

 let currentIsReject = rType === 'reject';

 // 1. Fetch Assign Data
 const res = await fetch(`${API_BASE}/api/public/report/${rAssignId}`);
 if (!res.ok) throw new Error('Không tìm thấy báo cáo phân công này.');
 const assignData = await res.json();

 // 2. Filter details by itemsParam
 const details = assignData.assign?.details || [];

 const showAll = !rItemsParam || rItemsParam === 'all';
 let allowedSet = new Set<string>();
 if (!showAll) {
 allowedSet = new Set(rItemsParam!.split(','));
 }

 const filteredDetails = details.filter((d: any) => {
 if (showAll) return true;
 const key = `${d.config?.asset?.id}_${d.config?.sub_work?.id}`;
 return allowedSet.has(key);
 });

 if (filteredDetails.length === 0) {
 throw new Error('Không có hạng mục nào khớp với link báo cáo.');
 }

 // Group details by asset_subWork (recreating OperationsPage grouping)
 const groupedMap = new Map<string, GroupedTask>();
 const dateSet = new Set<string>();

 filteredDetails.forEach((d: any) => {
 const statusApprove = d.status_approve || 0;
 // For repair report: only show rejected items. For approval report: only approved.
 if (currentIsReject) {
 if (statusApprove !== -1 && d.status_reject !== 1) return;
 } else {
 if (statusApprove !== 1) return;
 }

 const groupKey = `${d.config?.asset?.id}_${d.config?.sub_work?.id}`;

 const approvalDate = currentIsReject ? (d.rejected_at || d.submitted_at) : (d.approval_at || d.submitted_at);
 if (approvalDate) {
 try {
 const parsed = typeof approvalDate === 'string' && approvalDate.startsWith('[')
 ? JSON.parse(approvalDate).pop()
 : approvalDate;
 if (parsed) {
 dateSet.add(format(new Date(parsed), 'yyyy-MM-dd'));
 }
 } catch { }
 }

 // Extract Images properly using getImageUrl
 const imgs: string[] = [];
 if (d.data) {
 try {
 const parsedData = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
 const arr = Array.isArray(parsedData) ? parsedData : [parsedData];
 arr.forEach((url: string) => {
 if (url) imgs.push(getImageUrl(url));
 });
 } catch { }
 }

 const note = d.note_data || d.noteData || d.note || '';

 if (groupedMap.has(groupKey)) {
 const existing = groupedMap.get(groupKey)!;
 existing.subTasks.push({
 ...d,
 processName: d.process?.name || 'Khác',
 statusApprove,
 extractedImages: [...imgs],
 extractedNote: note,
 rejectionNote: d.note_approval || d.noteApproval || ''
 });
 if (note && !existing.noteData) existing.noteData = note;
 existing.images = [...existing.images, ...imgs];
 // Update approval At to latest
 const dt1 = currentIsReject ? (d.rejected_at || d.submitted_at) : (d.approval_at || d.submitted_at);
 if (dt1 && existing.approvalAt) {
 try {
 const parsed1 = typeof dt1 === 'string' && dt1.startsWith('[') ? JSON.parse(dt1).pop() : dt1;
 const parsed2 = typeof existing.approvalAt === 'string' && existing.approvalAt.startsWith('[') ? JSON.parse(existing.approvalAt).pop() : existing.approvalAt;
 if (new Date(parsed1) > new Date(parsed2)) {
 existing.approvalAt = dt1;
 }
 } catch {}
 }
 } else {
 groupedMap.set(groupKey, {
 id: d.id,
 workName: d.config?.sub_work?.work?.name || '—',
 subWorkName: d.config?.sub_work?.name || '—',
 assetName: d.config?.asset?.parent?.name ? `${d.config.asset.parent.name} - ${d.config.asset.name}` : (d.config?.asset?.name || '—'),
 approvalAt: currentIsReject ? (d.rejected_at || d.submitted_at || null) : (d.approval_at || d.submitted_at || null),
 noteData: note,
 images: [...imgs],
 subTasks: [{
 ...d,
 processName: d.process?.name || 'Khác',
 statusApprove,
 extractedImages: [...imgs],
 extractedNote: note,
 rejectionNote: d.note_approval || d.noteApproval || ''
 }]
 });
 }
 });

 const finalTasks = Array.from(groupedMap.values()).sort((a, b) => {
 const wCmp = a.workName.localeCompare(b.workName, undefined, { numeric: true, sensitivity: 'base' });
 if (wCmp !== 0) return wCmp;
 const swCmp = a.subWorkName.localeCompare(b.subWorkName, undefined, { numeric: true, sensitivity: 'base' });
 if (swCmp !== 0) return swCmp;
 return a.assetName.localeCompare(b.assetName, undefined, { numeric: true, sensitivity: 'base' });
 });
 const datesArray = Array.from(dateSet).sort();

 setData({
 projectName: assignData.assign?.project?.name || '—',
 ownerName: assignData.owner?.name || 'CĐT',
 templateName: assignData.assign?.template?.name || '',
 tasks: finalTasks,
 dates: datesArray,
 users: assignData.users || [],
 approvers: assignData.approvers || []
 });

 // 3. Fetch Attendance
 if (datesArray.length > 0) {
 const params = new URLSearchParams({ assign_id: rAssignId || '' });
 datesArray.forEach(d => params.append('dates[]', d));

 const attRes = await fetch(`${API_BASE}/api/public/attendance-by-assign?${params.toString()}`);
 if (attRes.ok) {
 const attData = await attRes.json();
 setAttendances(attData || []);
 }
 }

 } catch (err: any) {
 setError(err.message || 'Lỗi tải báo cáo.');
 } finally {
 setLoading(false);
 }
 };

 fetchReportData();
 }, [assignId, reportId, itemsParam]);

 const handlePrint = () => window.print();

 const formatDate = (d: string | null) => {
 if (!d) return '—';
 try {
 const parsed = typeof d === 'string' && d.startsWith('[') ? JSON.parse(d).pop() : d;
 return format(new Date(parsed), 'dd/MM/yyyy HH:mm', { locale: vi });
 } catch { return d; }
 };

 // Move early returns out of the way for Hooks
 // Returns tasks grouped by date, and inside each date — grouped by workName -> subWorkName -> [tasks]
 const tasksByDate = React.useMemo(() => {
 const map: Record<string, GroupedTask[]> = {};
 if (!data?.tasks) return map;
 data.tasks.forEach((t: GroupedTask) => {
 const d = t.approvalAt;
 if (!d) return;
 try {
 const parsed = typeof d === 'string' && d.startsWith('[') ? JSON.parse(d).pop() : d;
 const day = format(new Date(parsed), 'yyyy-MM-dd');
 if (!map[day]) map[day] = [];
 map[day].push(t);
 } catch { }
 });
 return map;
 }, [data?.tasks]);

 // Smart group by Work -> SubWork -> [asset tasks]
 const groupTasksHierarchically = (tasks: GroupedTask[]) => {
 const workMap: Map<string, Map<string, GroupedTask[]>> = new Map();
 tasks.forEach(t => {
 if (!workMap.has(t.workName)) workMap.set(t.workName, new Map());
 const swMap = workMap.get(t.workName)!;
 if (!swMap.has(t.subWorkName)) swMap.set(t.subWorkName, []);
 swMap.get(t.subWorkName)!.push(t);
 });
 // Sort asset tasks inside each subWork group alphanumerically
 workMap.forEach(swMap => {
 swMap.forEach(assetList => {
 assetList.sort((a, b) =>
 a.assetName.localeCompare(b.assetName, undefined, { numeric: true, sensitivity: 'base' })
 );
 });
 });
 return workMap;
 };

 const attendanceByDate = React.useMemo(() => {
 const map: Record<string, AttendanceRecord[]> = {};
 attendances.forEach(a => {
 const d = a.date_checkin;
 if (!d) return;
 try {
 const day = format(new Date(d), 'yyyy-MM-dd');
 if (!map[day]) map[day] = [];
 map[day].push(a);
 } catch { }
 });
 return map;
 }, [attendances]);

 if (loading) return (
 <div className="min-h-screen flex items-center justify-center bg-slate-100">
 <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
 </div>
 );

 if (error) return (
 <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-100 text-slate-600">
 <AlertCircle className="w-10 h-10 text-rose-400" />
 <p className="font-semibold">{error}</p>
 </div>
 );

 const { projectName, ownerName, templateName, dates, users = [], approvers = [] } = data;
 const tasks = data?.tasks || [];

 return (
 <div className="min-h-screen bg-slate-100 p-4 sm:p-8 flex justify-center">
 <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col overflow-hidden">
 {/* Header */}
 <div className="flex items-center justify-between p-5 border-b border-slate-100 print:hidden bg-slate-50">
 <div>
 <h2 className="text-xl font-black text-slate-800">Báo cáo Tổng hợp</h2>
 <p className="text-sm font-semibold text-slate-500 mt-0.5 uppercase tracking-wide">{projectName} — {ownerName}</p>
 </div>
 <button
 onClick={handlePrint}
 className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
 >
 <Printer className="w-4 h-4" /> In / Xuất PDF
 </button>
 </div>

 {/* Printable Content */}
 <div ref={printRef} className="p-6 md:p-10 space-y-10 print:p-0">
 {/* Report Title */}
 <div className="text-center border-b border-slate-200 pb-8">
 <h1 className={`text-2xl md:text-3xl font-black uppercase tracking-widest mb-2 ${dynamicIsReject ? 'text-rose-700' : 'text-slate-800'}`}>
 {customTitle ? customTitle : (dynamicIsReject ? 'Báo Cáo Yêu Cầu Sửa Chữa' : 'Biên bản Nghiệm thu Công việc')}
 </h1>
 <p className={`text-lg font-bold uppercase ${dynamicIsReject ? 'text-rose-500' : 'text-indigo-600'}`}>{templateName || projectName}</p>
 <p className="text-sm font-semibold text-slate-500 mt-2">Dự án: <span className="text-slate-700">{projectName}</span> | Ngày trích xuất: {format(new Date(), 'dd/MM/yyyy', { locale: vi })} | Tổng số hạng mục: {tasks.length}</p>
 {dynamicIsReject && (
 <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-full text-xs font-bold text-rose-700">
 <AlertCircle className="w-3.5 h-3.5" />
 Các hạng mục dưới đây bị từ chối và yêu cầu sửa lại
 </div>
 )}
 </div>

 {/* Iterate by Date */}
 {dates.map((day: string) => (
 <div key={day} className="space-y-6">
 {/* Date Header */}
 <div className="flex items-center gap-3">
 <div className={`h-8 w-1.5 bg-gradient-to-b ${dynamicIsReject ? 'from-rose-500 to-orange-500' : 'from-indigo-500 to-purple-600'} rounded-full`} />
 <h2 className="text-xl font-black text-slate-800 tracking-tight">
 {format(new Date(day), 'EEEE, dd/MM/yyyy', { locale: vi })}
 </h2>
 </div>

 {/* 1. Check-In Section */}
 <div className="bg-emerald-50/40 rounded-2xl border border-emerald-100/60 p-5 page-break-inside-avoid">
 <h3 className="font-bold text-emerald-800 flex items-center gap-2 text-sm mb-4">
 <Clock className="w-4 h-4" />
 Chấm công Vào
 </h3>
 {!attendanceByDate[day] || attendanceByDate[day].length === 0 ? (
 <p className="text-sm text-slate-400 italic">Không có dữ liệu chấm công vào cho ngày này.</p>
 ) : (
 <div className="grid grid-cols-1 gap-6">
 {attendanceByDate[day].map(att => {
 const checkinPhotos = [
 ...extractAllImages(att.personnel_photo),
 ...extractAllImages(att.id_card_front),
 ...extractAllImages(att.id_card_back),
 ...extractAllImages(att.safety_card_front),
 ...extractAllImages(att.safety_card_back),
 ...extractAllImages(att.tools_photos),
 ...extractAllImages(att.documents_photos),
 ];

 return (
 <div key={`in-${att.id}`} className="bg-white rounded-xl border border-emerald-100/80 p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
 {/* User Info & Checkin Time */}
 <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
 <div className="flex gap-3 items-center w-full sm:w-1/3 shrink-0">
 <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
 <Users className="w-4 h-4 text-emerald-500" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-bold text-slate-800 text-sm truncate">{att.user?.name || '—'}</p>
 <p className="text-xs text-slate-500 truncate">{att.user?.email || '—'}</p>
 </div>
 </div>
 <div className="flex-1 min-w-0 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
 <div className="flex items-center gap-1.5 font-bold text-emerald-600 mb-1 text-xs">
 <Clock className="w-3.5 h-3.5" /> THỜI GIAN VÀO
 </div>
 <p className="text-slate-700 font-semibold mb-1 text-sm">{formatDate(att.date_checkin) || '—'}</p>
 {att.address_checkin && (
 <p className="text-[11px] text-slate-500 flex items-start gap-1 line-clamp-2" title={att.address_checkin}>
 <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" /> {att.address_checkin}
 </p>
 )}
 </div>
 </div>

 {/* Photos Grid */}
 {checkinPhotos.length > 0 && (
 <div className="pt-3 border-t border-slate-100">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
 <ImageIcon className="w-3.5 h-3.5" /> Hình ảnh bằng chứng vào ({checkinPhotos.length})
 </p>
 <div className="flex flex-wrap gap-2">
 {checkinPhotos.map((img, i) => (
 <img
 key={`in-img-${i}`}
 src={getImageUrl(img)}
 alt={`checkin ${i + 1}`}
 className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
 onClick={() => setSelectedImage(getImageUrl(img))}
 />
 ))}
 </div>
 </div>
 )}
 </div>
 )
 })}
 </div>
 )}
 </div>

 {/* 2. Tasks for this date — Smart Grouped: Work > SubWork > Assets */}
 <div className="bg-slate-50/50 rounded-2xl border border-slate-200 p-5 page-break-inside-avoid">
 <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-5">
 <CheckCircle2 className="w-4 h-4 text-emerald-500" />
 Công việc thực hiện ({tasksByDate[day]?.length || 0} hạng mục)
 </h3>
 {!tasksByDate[day] || tasksByDate[day].length === 0 ? (
 <p className="text-sm text-slate-400 italic">Không có hạng mục hoàn thành trong ngày này.</p>
 ) : (
 <div className="space-y-6">
 {Array.from(groupTasksHierarchically(tasksByDate[day]).entries()).map(([workName, subWorkMap]) => (
 <div key={workName} className="space-y-4">
 {/* Level 1: Work Name */}
 <div className="flex items-center gap-3">
 <div className="h-5 w-1 bg-orange-400 rounded-full shrink-0" />
 <span className="text-[12px] font-black text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-lg">{workName}</span>
 </div>

 {Array.from(subWorkMap.entries()).map(([subWorkName, assetTasks]) => (
 <div key={subWorkName} className="ml-4 space-y-3">
 {/* Level 2: SubWork Name */}
 <div className="flex items-center gap-2">
 <div className="h-px flex-1 bg-slate-200" />
 <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full whitespace-nowrap">{subWorkName}</span>
 <div className="h-px flex-1 bg-slate-200" />
 </div>

 {/* Level 3: Asset Cards */}
 <div className="grid grid-cols-1 gap-3">
 {assetTasks.map(task => (
 <div key={task.id} className={`bg-white rounded-xl border ${dynamicIsReject ? 'border-rose-200' : 'border-slate-200'} overflow-hidden shadow-sm page-break-inside-avoid`}>
 {/* Asset Header */}
 <div className={`px-4 py-3 ${dynamicIsReject ? 'bg-gradient-to-r from-rose-50/80 to-orange-50' : 'bg-gradient-to-r from-indigo-50/80 to-slate-50'} border-b ${dynamicIsReject ? 'border-rose-100' : 'border-slate-100'} flex flex-wrap items-center justify-between gap-2`}>
 <div className="flex items-center gap-2">
 <div className={`w-2 h-2 rounded-full ${dynamicIsReject ? 'bg-rose-400' : 'bg-indigo-400'} shrink-0`} />
 <span className="text-[13px] font-black text-slate-800">{task.assetName}</span>
 </div>
 <div className="flex flex-col items-end">
 <span className={`text-[10px] ${dynamicIsReject ? 'text-rose-400' : 'text-slate-400'} font-semibold uppercase tracking-wider`}>
 {dynamicIsReject ? 'Bị từ chối lúc' : 'Hoàn tất duyệt'}
 </span>
 <span className={`text-xs ${dynamicIsReject ? 'text-rose-600' : 'text-emerald-600'} font-bold`}>{formatDate(task.approvalAt)}</span>
 </div>
 </div>

 {/* Process rows (images + note) */}
 <div className="divide-y divide-slate-100">
 {task.subTasks.map((st, idx) => (
 <div key={st.id || idx} className="p-4 flex flex-col md:flex-row gap-4">
 {/* Left: Images */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-2">
 <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shadow-sm whitespace-nowrap">{st.processName}</span>
 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
 <ImageIcon className="w-3 h-3" /> Ảnh chụp
 </span>
 </div>
 {st.extractedImages && st.extractedImages.length > 0 ? (
 <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
 {st.extractedImages.map((src: string, i: number) => (
 <div
 key={i}
 className={`aspect-square bg-slate-100 rounded-lg overflow-hidden border-2 ${dynamicIsReject ? 'border-rose-100' : 'border-white'} shadow-sm hover:scale-[1.03] transition-transform cursor-pointer`}
 onClick={() => setSelectedImage(src)}
 >
 <img src={src} alt={`evidence-${st.processName}-${i + 1}`} className="w-full h-full object-cover" />
 </div>
 ))}
 </div>
 ) : (
 <div className="bg-slate-50 border border-slate-100 border-dashed rounded-lg p-2 text-center text-xs text-slate-400">
 Không có hình ảnh
 </div>
 )}
 </div>

 {/* Right: Note + Rejection reason */}
 <div className="w-full md:w-1/4 shrink-0 flex flex-col gap-2">
 {st.extractedNote && (
 <div>
 <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Ghi chú</p>
 <div className="p-2.5 bg-amber-50/60 border border-amber-100 rounded-lg text-xs text-slate-700 leading-relaxed">
 {st.extractedNote}
 </div>
 </div>
 )}
 {dynamicIsReject && st.rejectionNote && (
 <div>
 <p className="text-[10px] font-bold text-rose-400 mb-1 uppercase tracking-widest flex items-center gap-1">
 <AlertCircle className="w-3 h-3" /> Lý do từ chối
 </p>
 <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 leading-relaxed font-semibold">
 {st.rejectionNote}
 </div>
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 ))}
 </div>
 )}
 </div>

 {/* 3. Check-out Section */}
 <div className="bg-rose-50/40 rounded-2xl border border-rose-100/60 p-5 page-break-inside-avoid">
 <h3 className="font-bold text-rose-800 flex items-center gap-2 text-sm mb-4">
 <Clock className="w-4 h-4" />
 Chấm công Ra
 </h3>
 {!attendanceByDate[day] || attendanceByDate[day].filter(a => a.date_checkout).length === 0 ? (
 <p className="text-sm text-slate-400 italic">Chưa có ai chấm công ra trong ngày này.</p>
 ) : (
 <div className="grid grid-cols-1 gap-6">
 {attendanceByDate[day].filter(a => a.date_checkout).map(att => {
 const checkoutPhotos = extractAllImages(att.checkout_img_url);

 return (
 <div key={`out-${att.id}`} className="bg-white rounded-xl border border-rose-100/80 p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
 {/* User Info & Checkout Time */}
 <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
 <div className="flex gap-3 items-center w-full sm:w-1/3 shrink-0">
 <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
 <Users className="w-4 h-4 text-rose-500" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-bold text-slate-800 text-sm truncate">{att.user?.name || '—'}</p>
 <p className="text-xs text-slate-500 truncate">{att.user?.email || '—'}</p>
 </div>
 </div>
 <div className="flex-1 min-w-0 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
 <div className="flex items-center gap-1.5 font-bold text-rose-600 mb-1 text-xs">
 <Clock className="w-3.5 h-3.5" /> THỜI GIAN RA
 </div>
 <p className="text-slate-700 font-semibold mb-1 text-sm">{formatDate(att.date_checkout) || '—'}</p>
 {att.address_checkout && (
 <p className="text-[11px] text-slate-500 flex items-start gap-1 line-clamp-2" title={att.address_checkout}>
 <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" /> {att.address_checkout}
 </p>
 )}
 </div>
 </div>

 {/* Photos Grid */}
 {checkoutPhotos.length > 0 && (
 <div className="pt-3 border-t border-slate-100">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
 <ImageIcon className="w-3.5 h-3.5" /> Hình ảnh bằng chứng ra ({checkoutPhotos.length})
 </p>
 <div className="flex flex-wrap gap-2">
 {checkoutPhotos.map((img, i) => (
 <img
 key={`out-img-${i}`}
 src={getImageUrl(img)}
 alt={`checkout ${i + 1}`}
 className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
 onClick={() => setSelectedImage(getImageUrl(img))}
 />
 ))}
 </div>
 </div>
 )}
 </div>
 )
 })}
 </div>
 )}
 </div>

 {/* Divider between dates */}
 {dates.indexOf(day) !== dates.length - 1 && (
 <hr className="border-slate-200 my-8" />
 )}
 </div>
 ))}

 {/* Manager's Conclusion Block */}
 {conclusionText && (
 <div className="mt-12 bg-white border-2 border-slate-800 rounded-2xl p-6 shadow-[4px_4px_0_0_#1e293b] print:shadow-none print:border-slate-300 page-break-inside-avoid">
 <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
 <AlertCircle className="w-4 h-4 text-indigo-600" /> Ý kiến / Đánh giá chung của Cán bộ Kỹ thuật (Quản lý)
 </h3>
 <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
 {conclusionText}
 </div>
 </div>
 )}

 {/* Signature Block */}
 <div className="grid grid-cols-2 gap-8 mt-16 pt-16 border-t-2 border-slate-800 break-inside-avoid">
 <div className="text-center">
 <h4 className="font-bold text-slate-800 uppercase tracking-widest text-sm mb-24">Kỹ sư thực hiện</h4>
 {users && users.length > 0 && (
 <p className="font-bold text-slate-700 text-lg mb-1">{users.map((u: any) => u.name).join(', ')}</p>
 )}
 <p className="text-slate-400 text-sm">(Ký, ghi rõ họ tên)</p>
 </div>
 <div className="text-center">
 <h4 className="font-bold text-slate-800 uppercase tracking-widest text-sm mb-24">Quản lý dự án</h4>
 {approvers && approvers.length > 0 && (
 <p className="font-bold text-slate-700 text-lg mb-1">{approvers.map((u: any) => u.name).join(', ')}</p>
 )}
 <p className="text-slate-400 text-sm">(Ký, ghi rõ họ tên)</p>
 </div>
 </div>
 </div>

 {/* Modal View Image */}
 {selectedImage && (
 <div
 className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 print:hidden cursor-zoom-out"
 onClick={() => setSelectedImage(null)}
 >
 <button
 onClick={() => setSelectedImage(null)}
 className="absolute top-4 right-4 p-2 text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full transition-colors z-10"
 >
 <X className="w-6 h-6" />
 </button>
 <img
 src={selectedImage}
 className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl cursor-default"
 onClick={e => e.stopPropagation()}
 alt="Phóng to"
 />
 </div>
 )}

 <style>{`
 @media print {
 body { background: white; }
 .min-h-screen { min-height: 0; padding: 0; }
 .shadow-xl { box-shadow: none; border-radius: 0; }
 .print\\:hidden { display: none !important; }
 .print\\:p-0 { padding: 0 !important; }
 .page-break-inside-avoid { break-inside: avoid; }
 }
 `}</style>
 </div>
 </div>
 );
};

export default PublicBulkReportPage;
