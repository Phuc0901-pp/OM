import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
    Building2, Briefcase, Wrench, User, Clock, CalendarCheck,
    CalendarRange, CheckCircle2, FileText, ChevronRight,
    Image as ImageIcon, ZoomIn, AlertCircle, Loader2, X, ChevronLeft
} from 'lucide-react';
import ReactDOM from 'react-dom';
import { parseSafeDate } from '../../utils/timeUtils';
import { getImageUrl } from '../../utils/imageUtils';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const formatDateSafe = (val: any) => {
    if (!val) return '—';
    const arr = Array.isArray(val) ? val : typeof val === 'string' && val.startsWith('[')
        ? (() => { try { return JSON.parse(val); } catch { return [val]; } })()
        : [val];
    const last = arr[arr.length - 1];
    const d = parseSafeDate(last);
    return isNaN(d.getTime()) ? '—' : format(d, 'HH:mm, dd/MM/yyyy');
};

const parseJsonArray = (field: any): any[] => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') { try { return JSON.parse(field); } catch { } }
    return [];
};

const LightboxViewer: React.FC<{
    images: string[];
    index: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
}> = ({ images, index, onClose, onPrev, onNext }) => {
    return ReactDOM.createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
                onClick={onClose}
            >
                <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-[10001]">
                    <X className="w-8 h-8" />
                </button>
                {(() => {
                    const currentUrl = images[index];
                    const isVideo = currentUrl?.toLowerCase().endsWith('.webm') || currentUrl?.toLowerCase().endsWith('.mp4');
                    return isVideo ? (
                        <motion.video
                            key={`video-${index}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            src={currentUrl}
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            controls
                            autoPlay
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <motion.img
                            key={`img-${index}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            src={currentUrl}
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    );
                })()}
                {images.length > 1 && (
                    <>
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-[10001]"
                            onClick={(e) => { e.stopPropagation(); onPrev(); }}
                        >
                            <ChevronLeft className="w-8 h-8" />
                        </button>
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-[10001]"
                            onClick={(e) => { e.stopPropagation(); onNext(); }}
                        >
                            <ChevronRight className="w-8 h-8" />
                        </button>
                    </>
                )}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur text-white rounded-full text-sm font-medium border border-white/10">
                    {index + 1} / {images.length}
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

const PublicReportPage: React.FC = () => {
    const { assignId } = useParams<{ assignId: string }>();
    const [searchParams] = useSearchParams();
    const subWorkId = searchParams.get('sub');
    const assetId = searchParams.get('asset');
    const isRejectReport = searchParams.get('type') === 'reject';
    const isSubmitReport = searchParams.get('type') === 'submit';

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

    useEffect(() => {
        if (!assignId) { setError('Link không hợp lệ.'); setLoading(false); return; }
        fetch(`${API_BASE}/api/public/report/${assignId}`)
            .then(r => {
                if (!r.ok) throw new Error('Không tìm thấy báo cáo.');
                return r.json();
            })
            .then(setData)
            .catch((e) => setError(e.message || 'Lỗi tải báo cáo.'))
            .finally(() => setLoading(false));
    }, [assignId]);

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

    const { assign, owner, users, approvers } = data;

    // Build maps for quick lookup
    const usersMap: Record<string, string> = {};
    (users || []).forEach((u: any) => { usersMap[u.id] = u.name; });
    (approvers || []).forEach((u: any) => { usersMap[u.id] = u.name; });

    const assigneeNames = (users || []).map((u: any) => u.name).join(', ') || '—';

    // Find the target details by matching subWork and asset
    const details: any[] = assign.details || [];
    const targetDetails = details.filter((d: any) => {
        let match = true;
        if (subWorkId && d.config?.sub_work?.id !== subWorkId) match = false;
        if (assetId && d.config?.asset?.id !== assetId) match = false;
        return match;
    });

    // We can use the first matching detail for shared approver/status info
    const targetDetail = targetDetails[0];

    const personIdsStr = isRejectReport ? targetDetail?.id_person_reject : targetDetail?.id_person_approve;
    const approverIds: string[] = parseJsonArray(personIdsStr || []);

    // Only get the most recent approver/rejector to avoid duplication when history builds up
    const latestApproverId = approverIds.length > 0 ? approverIds[approverIds.length - 1] : null;
    const approverNames = latestApproverId ? [usersMap[latestApproverId] || latestApproverId.slice(0, 8) + '…'] : [];

    // Build grouped images by process, only for the target details
    const groupedByProcess: Record<string, { name: string; note: string; rejectionNote: string; images: string[] }> = {};
    for (const d of targetDetails) {
        const processName = d.process?.name || 'Chung';
        const processId = d.id_process || d.process?.id || 'default';
        const note = d.note_data || d.noteData || d.note || '';
        const rejectionNote = d.note_reject || d.noteReject || '';

        if (!groupedByProcess[processId]) {
            groupedByProcess[processId] = { name: processName, note: note, rejectionNote: rejectionNote, images: [] };
        } else {
            if (note && !groupedByProcess[processId].note) {
                groupedByProcess[processId].note = note;
            }
            if (rejectionNote && !groupedByProcess[processId].rejectionNote) {
                groupedByProcess[processId].rejectionNote = rejectionNote;
            }
        }

        const imgs: string[] = parseJsonArray(d.data);
        imgs.forEach(url => groupedByProcess[processId].images.push(getImageUrl(url)));
    }

    const project = assign.project;
    const template = assign.template;
    const modelProject = assign.model_project;
    const targetConfig = targetDetail?.config;
    const asset = targetConfig?.asset;
    const subWork = targetConfig?.sub_work;
    const work = subWork?.work;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/30 py-10 px-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Report Header */}
                <div className="relative rounded-2xl overflow-hidden shadow-xl">
                    <div className={`px-8 py-6 ${isRejectReport ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500' : isSubmitReport ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-orange-400' : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600'}`}>
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_50%,white,transparent)]"></div>
                        <div className="relative">
                            <div className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2 ${isRejectReport ? 'text-rose-100' : isSubmitReport ? 'text-amber-100' : 'text-indigo-200'}`}>
                                {isRejectReport ? <AlertCircle className="w-3.5 h-3.5" /> : isSubmitReport ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                {isRejectReport ? 'Báo cáo Sửa chữa' : isSubmitReport ? 'Báo cáo Chờ duyệt' : 'Báo cáo ngắn'}
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight flex items-center flex-wrap gap-2">
                                {template?.name || modelProject?.name || '—'}
                                <span className={`w-1.5 h-1.5 rounded-full opacity-70 ${isRejectReport ? 'bg-rose-200' : isSubmitReport ? 'bg-amber-200' : 'bg-indigo-300'}`}></span>
                                <span className={isRejectReport ? 'text-rose-100' : isSubmitReport ? 'text-amber-50' : 'text-indigo-100'}>{subWork?.name || '—'}</span>
                                <span className="text-sm font-bold bg-black/15 text-white px-3 py-1 rounded-lg border border-white/20 ml-1">
                                    {work?.name || '—'}
                                </span>
                            </h1>
                        </div>
                    </div>
                </div>

                {/* Information Dashboard */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    {/* Project & Owner header row */}
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Dự án</div>
                                <div className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 flex-wrap">
                                    {project?.name || '—'}
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                    <span className="text-indigo-600">{owner?.name || '—'}</span>
                                </div>
                            </div>
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto ${isRejectReport ? 'bg-rose-50 border-rose-100 text-rose-700' : isSubmitReport ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                            {isRejectReport ? <AlertCircle className="w-4 h-4" /> : isSubmitReport ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            {isRejectReport ? 'Bị từ chối' : isSubmitReport ? 'Chờ duyệt' : 'Đã hoàn tất'}
                        </div>
                    </div>

                    {/* 3-column body (Row-aligned) */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6 items-start">
                        {/* --- ROW 1 --- */}
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                <FileText className="w-3.5 h-3.5" /> Nội dung công việc
                            </div>
                            <div className="text-[13px] font-semibold text-slate-800 leading-snug">
                                {template?.name || modelProject?.name || '—'}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                <Briefcase className="w-3.5 h-3.5" /> Công việc
                            </div>
                            <div className="text-[13px] font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                {work?.name || '—'}
                                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                                <span className="text-indigo-600 font-bold">{subWork?.name || '—'}</span>
                            </div>
                        </div>

                        {/* Implementer Card */}
                        <div className="relative p-3.5 rounded-xl border border-slate-200/60 bg-slate-50 group">
                            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                                <User className="w-12 h-12" />
                            </div>
                            <div className="relative z-10">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Người thực hiện</div>
                                <div className="text-[13px] font-bold text-slate-800 mb-2 leading-snug">{assigneeNames}</div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-white px-2 py-1 inline-flex rounded border border-slate-200 shadow-sm">
                                    <Clock className="w-3.5 h-3.5" /> Nộp: {formatDateSafe(targetDetail?.submitted_at)}
                                </div>
                            </div>
                        </div>

                        {/* --- ROW 2 --- */}
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                <Wrench className="w-3.5 h-3.5" /> Thiết bị / Khu vực
                            </div>
                            <div className="text-[13px] font-semibold text-slate-800">
                                {asset?.parent?.name ? `${asset.parent.name} - ${asset.name}` : (asset?.name || '—')}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                <CalendarRange className="w-3.5 h-3.5" /> Thời gian kế hoạch
                            </div>
                            {assign.start_time || assign.end_time ? (
                                <div className="inline-flex flex-col gap-1.5 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 w-full text-[12px] font-bold text-slate-700">
                                    <span className="flex items-center gap-2 text-slate-600">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                        Bắt đầu: {formatDateSafe(assign.start_time)}
                                    </span>
                                    <span className="flex items-center gap-2 text-slate-600">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                                        Kết thúc: {formatDateSafe(assign.end_time)}
                                    </span>
                                </div>
                            ) : <span className="text-slate-400 text-sm">—</span>}
                        </div>

                        {/* Approver/Rejector Card */}
                        {!isSubmitReport && (
                            <div className={`relative p-3.5 rounded-xl border group h-full ${isRejectReport ? 'border-amber-200/60 bg-amber-50/50' : 'border-emerald-200/60 bg-emerald-50/50'}`}>
                                <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                                    {isRejectReport ? <AlertCircle className="w-12 h-12 text-amber-600" /> : <CheckCircle2 className="w-12 h-12 text-emerald-600" />}
                                </div>
                                <div className="relative z-10">
                                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isRejectReport ? 'text-amber-700' : 'text-emerald-700'}`}>
                                        {isRejectReport ? 'Người từ chối' : 'Người duyệt'}
                                    </div>
                                    <div className={`text-[13px] font-bold mb-2 leading-snug ${isRejectReport ? 'text-amber-950' : 'text-emerald-950'}`}>
                                        {approverNames.join(', ') || '—'}
                                    </div>
                                    <div className={`flex items-center gap-1.5 text-[11px] font-bold bg-white/60 px-2 py-1 inline-flex rounded border shadow-sm ${isRejectReport ? 'text-amber-700 border-amber-200' : 'text-emerald-700 border-emerald-200'}`}>
                                        <CalendarCheck className="w-3.5 h-3.5" />
                                        {isRejectReport ? 'Từ chối lúc' : 'Duyệt'}: {formatDateSafe(isRejectReport ? targetDetail?.rejected_at : targetDetail?.approval_at)}
                                    </div>
                                </div>
                            </div>
                        )}
                        {isSubmitReport && (
                            <div className="relative p-3.5 rounded-xl border group h-full border-amber-200/60 bg-amber-50/50">
                                <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Clock className="w-12 h-12 text-amber-600" />
                                </div>
                                <div className="relative z-10">
                                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-amber-700">
                                        Người duyệt
                                    </div>
                                    <div className="text-[13px] font-bold mb-2 leading-snug text-amber-950">
                                        Chưa phân công
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold bg-white/60 px-2 py-1 inline-flex rounded border shadow-sm text-amber-700 border-amber-200">
                                        <Clock className="w-3.5 h-3.5" />
                                        Trạng thái: Đang chờ duyệt
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Evidence Images by Process */}
                {Object.keys(groupedByProcess).length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30">
                            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                <ImageIcon className="w-3.5 h-3.5 text-indigo-500" /> Hình ảnh minh chứng
                            </h2>
                        </div>
                        <div className="p-6 space-y-6 bg-slate-50/30">
                            {Object.entries(groupedByProcess).map(([pid, proc]) => {
                                if (proc.images.length === 0) return null;
                                return (
                                    <div key={pid} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                                        <div className="flex items-center justify-between px-5 py-3 bg-slate-50/80 border-b border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                <span className="text-sm font-bold text-slate-700">{proc.name}</span>
                                            </div>
                                            {proc.note && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 italic bg-white border border-slate-200 px-3 py-1 rounded-full max-w-xs sm:max-w-sm lg:max-w-md truncate">
                                                    <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
                                                    <span className="truncate">Ghi chú KH: "{proc.note}"</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Rejection Note Display */}
                                        {isRejectReport && proc.rejectionNote && (
                                            <div className="px-5 py-3 bg-rose-50 border-b border-rose-100 flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                                                <div>
                                                    <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-0.5">Lý do từ chối / Yêu cầu sửa</div>
                                                    <div className="text-sm font-semibold text-rose-800 leading-snug">
                                                        {proc.rejectionNote}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                            {proc.images.map((imgUrl, imgIdx) => {
                                                const isVideo = imgUrl.toLowerCase().endsWith('.webm') || imgUrl.toLowerCase().endsWith('.mp4');
                                                return (
                                                    <div
                                                        key={imgIdx}
                                                        className="relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer group border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                                                        onClick={() => setLightbox({ images: proc.images, index: imgIdx })}
                                                    >
                                                        {isVideo ? (
                                                            <video
                                                                src={imgUrl}
                                                                className="w-full h-full object-cover bg-black"
                                                                muted
                                                                playsInline
                                                            />
                                                        ) : (
                                                            <img
                                                                src={imgUrl}
                                                                alt={`Ảnh ${imgIdx + 1}`}
                                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 bg-slate-100"
                                                            />
                                                        )}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <ZoomIn className="w-6 h-6 text-white drop-shadow-lg" />
                                                        </div>
                                                        {isVideo && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20">
                                                                    <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center text-xs text-slate-400 py-4">
                    Báo cáo được tạo bởi hệ thống <span className="font-bold text-slate-500">Raitek</span> · Version 6.4.3
                </div>
            </div>

            {/* Lightbox */}
            {lightbox && (
                <LightboxViewer
                    images={lightbox.images}
                    index={lightbox.index}
                    onClose={() => setLightbox(null)}
                    onPrev={() => setLightbox(prev => prev ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length } : null)}
                    onNext={() => setLightbox(prev => prev ? { ...prev, index: (prev.index + 1) % prev.images.length } : null)}
                />
            )}
        </div>
    );
};

export default PublicReportPage;
