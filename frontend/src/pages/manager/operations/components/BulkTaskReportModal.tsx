import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Copy, ExternalLink, CheckCircle2, Share2, UploadCloud, Loader2, FileCheck2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { TaskRow } from '../types';
import api from '../../../../services/api';

interface Props {
    tasks: TaskRow[];
    assignId: string;
    projectName: string;
    /** When true, generates a short ?items=all URL instead of listing every UUID */
    isAllSelected?: boolean;
    /** 'reject' = Báo cáo sửa chữa; default = báo cáo nghiệm thu */
    type?: 'reject' | 'approve';
    /** Optional conclusion pushed to the report */
    conclusionText?: string;
    onClose: () => void;
}

const BulkTaskReportModal: React.FC<Props> = ({ tasks, assignId, projectName, isAllSelected = false, type = 'approve', conclusionText = '', onClose }) => {
    const [copied, setCopied] = useState(false);
    const [isPushingLark, setIsPushingLark] = useState(false);
    const [pushSuccess, setPushSuccess] = useState(false);
    const [localConclusion, setLocalConclusion] = useState(conclusionText || '');
    const [reportId, setReportId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const isReject = type === 'reject';
    const reportLink = reportId ? `${window.location.origin}/share/generated-report/${reportId}` : '';

    const generateDatabaseReport = async () => {
        setIsCreating(true);
        try {
            const items = isAllSelected ? ['all'] : (() => {
                const itemSet = new Set<string>();
                tasks.forEach(t => {
                    if (t.assetId && t.subWorkId) itemSet.add(`${t.assetId}_${t.subWorkId}`);
                });
                return Array.from(itemSet);
            })();

            const res = await api.post('/reports', {
                assign_id: assignId,
                title: `${isReject ? 'Báo cáo Sửa chữa' : 'Báo cáo Nghiệm thu'} - ${projectName}`,
                type: type,
                item_keys: items,
                conclusion: localConclusion.trim(),
            });

            if (res.data && res.data.data && res.data.data.id) {
                setReportId(res.data.data.id);
            } else {
                alert('Tạo báo cáo thất bại, không nhận được ID.');
            }
        } catch (error) {
            console.error(error);
            alert('Lỗi khởi tạo báo cáo trên hệ thống! Vui lòng thử lại.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(reportLink).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handlePushToLark = async () => {
        setIsPushingLark(true);
        try {
            const userStr = sessionStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : { full_name: 'Quản lý dự án' };

            await api.post('/lark/push-report', {
                app_token: 'JbTBbo3QQaz7r5smJZilen5EgXg',
                table_id: 'tblg6S7XS3ME8MJc',
                project: projectName,
                template: tasks[0]?.templateName || tasks[0]?.modelProjectName || 'N/A',
                report_link: reportLink,
                submitter: user.full_name || 'Quản lý dự án',
            });
            setPushSuccess(true);
            setTimeout(() => setPushSuccess(false), 3000);
        } catch (error) {
            console.error('Lark Base Sync Error:', error);
            alert('Lỗi đẩy dữ liệu sang Lark Base! (Vui lòng kiểm tra lại cấu trúc Tên Cột trong Base có khớp không)');
        } finally {
            setIsPushingLark(false);
        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
                {/* Decorative background blobs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                    <div className={`absolute top-[-50%] left-[-20%] w-96 h-96 ${isReject ? 'bg-rose-500/20' : 'bg-indigo-500/20'} rounded-full blur-3xl`} />
                    <div className={`absolute bottom-[-50%] right-[-20%] w-96 h-96 ${isReject ? 'bg-orange-500/20' : 'bg-purple-500/20'} rounded-full blur-3xl`} />
                </div>
                <div className="p-8 text-center relative z-10">
                    {/* Icon */}
                    <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl ${isReject ? 'bg-rose-50 border-rose-100' : 'bg-indigo-50 border-indigo-100'} border mb-6 shadow-inner relative mt-4`}>
                        <Share2 className={`w-10 h-10 ${isReject ? 'text-rose-600' : 'text-indigo-600'} relative z-10`} />
                        <div className={`absolute inset-0 ${isReject ? 'bg-rose-400' : 'bg-indigo-400'} opacity-20 blur-xl rounded-full`} />
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-black text-slate-800 mb-2">
                        {isReject ? 'Báo cáo Sửa chữa đã sẵn sàng!' : 'Báo cáo đã sẵn sàng!'}
                    </h2>
                    <p className="text-slate-500 text-sm mb-6">
                        {isReject
                            ? <>Link công khai chứa danh sách hạng mục cần sửa cho dự án <strong className="text-slate-700">{projectName}</strong></>
                            : <>Báo cáo nghiệm thu cho dự án <strong className="text-slate-700">{projectName}</strong> với {tasks.length} hạng mục (ảnh đã tự động gộp vào trang).</>
                        }
                    </p>

                    {/* Comment/Conclusion Textarea */}
                    <div className="mb-6 text-left">
                        <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                            {isReject ? 'Ghi chú / Yêu cầu sửa chữa (Tuỳ chọn)' : 'Kết luận của Manager (Tuỳ chọn)'}
                        </label>
                        <textarea
                            className={`w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all resize-none h-24 shadow-inner ${reportId ? 'opacity-70 cursor-not-allowed' : ''} ${isReject ? 'focus:ring-rose-500/20 focus:border-rose-500' : 'focus:ring-indigo-500/20 focus:border-indigo-500'}`}
                            placeholder={isReject ? "Nhập chi tiết cần sửa, thời hạn hoàn thành... (Nội dung này sẽ hiển thị TO RÕ ngay đầu báo cáo)" : "Nhập nhận xét tổng thể về chất lượng, tiến độ... (Nội dung này sẽ hiển thị ngay khi mở link)"}
                            value={localConclusion}
                            onChange={(e) => setLocalConclusion(e.target.value)}
                            disabled={!!reportId}
                        />
                    </div>

                    {!reportId ? (
                        <div className="flex flex-col items-center">
                            <p className="text-xs text-slate-400 font-medium text-center w-full mb-3">Lưu ý: Link chia sẻ và tuỳ chọn Đồng bộ Lark Base sẽ xuất hiện sau khi Báo cáo được khởi tạo.</p>
                            <div className="flex items-center gap-3 w-full">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3.5 px-4 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    onClick={generateDatabaseReport}
                                    disabled={isCreating}
                                    className={`flex-1 py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-white group ${isReject ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'}`}
                                >
                                    {isCreating ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo...</>
                                    ) : (
                                        <><FileCheck2 className="w-5 h-5 group-hover:scale-110 transition-transform" /> Tạo Báo Cáo</>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Link Box */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3 mb-8 shadow-sm">
                                <div className="flex-1 overflow-hidden">
                                    <input
                                        type="text"
                                        readOnly
                                        value={reportLink}
                                        className="w-full bg-transparent text-[13px] font-medium text-slate-500 focus:outline-none truncate px-2"
                                        onClick={e => (e.target as HTMLInputElement).select()}
                                    />
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${copied
                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                        : isReject
                                            ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-500/20'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20'
                                        }`}
                                >
                                    {copied ? (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" /> Đã chép
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4" /> Copy Link
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-3">
                                {/* Lark Push Button */}
                                <button
                                    onClick={handlePushToLark}
                                    disabled={isPushingLark || pushSuccess}
                                    className={`w-full py-4 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${pushSuccess
                                        ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                        : isReject
                                            ? 'bg-gradient-to-r from-rose-600 to-orange-500 text-white hover:opacity-90 shadow-rose-500/30'
                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 shadow-blue-500/30'
                                        }`}
                                >
                                    {isPushingLark ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Đang tung lên Lark...</>
                                    ) : pushSuccess ? (
                                        <><CheckCircle2 className="w-5 h-5" /> Đã lưu thành công vào Lark Base!</>
                                    ) : (
                                        <><UploadCloud className="w-5 h-5" /> Đồng bộ & Lưu vào Lark Base</>
                                    )}
                                </button>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={onClose}
                                        className="flex-1 py-3 px-4 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors"
                                    >
                                        Đóng
                                    </button>
                                    <a
                                        href={reportLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-slate-800/20"
                                    >
                                        Xem báo cáo <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>,
        document.body
    );
};

export default BulkTaskReportModal;
