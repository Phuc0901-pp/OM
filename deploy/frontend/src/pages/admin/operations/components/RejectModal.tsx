import React from 'react';
import ReactDOM from 'react-dom';
import { AlertCircle, X } from 'lucide-react';
import GlassCard from '../../../../components/common/GlassCard';
import PremiumButton from '../../../../components/common/PremiumButton';
import { TaskRow } from '../types';

interface RejectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (rejections: { id: string; note: string }[]) => void;
    task: TaskRow | null;
    selectedProjectName: string | null;
}

const RejectModal: React.FC<RejectModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    task,
    selectedProjectName
}) => {
    const [rejectNote, setRejectNote] = React.useState('');
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

    // Initialize selection when task opens
    React.useEffect(() => {
        if (isOpen && task) {
            const subTasks = task.subTasks && task.subTasks.length > 0 ? task.subTasks : [task];
            // Default: Select all that are not already rejected? Or just all?
            // User likely wants to reject the current set. Let's select all by default.
            const ids = subTasks.map((t: any) => t.id);
            setSelectedIds(new Set(ids));
            setRejectNote('');
        }
    }, [isOpen, task]);

    const handleConfirm = () => {
        if (!task) return;
        const rejections = Array.from(selectedIds).map(id => ({
            id,
            note: rejectNote
        }));
        onConfirm(rejections);
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (!task) return;
        const subTasks = task.subTasks && task.subTasks.length > 0 ? task.subTasks : [task];
        if (selectedIds.size === subTasks.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(subTasks.map((t: any) => t.id)));
        }
    };

    if (!isOpen || !task) return null;

    const subTasks = task.subTasks && task.subTasks.length > 0 ? task.subTasks : [task];

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <GlassCard className="w-full max-w-2xl overflow-hidden flex flex-col !p-0 animation-zoom-in max-h-[90vh]">
                <div className="px-8 py-6 bg-gradient-to-r from-red-50 to-white border-b border-red-100 flex justify-between items-center flex-shrink-0">
                    <h3 className="font-extrabold text-xl text-red-600 flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                        </div>
                        Từ chối / Yêu cầu sửa
                    </h3>
                    <button onClick={onClose} className="text-red-400 hover:text-red-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    <div className="text-sm text-slate-600">
                        Bạn đang từ chối hạng mục <strong className="text-slate-900">{task.categoryName}</strong> tại dự án <strong className="text-slate-900">{selectedProjectName}</strong>.
                        <br />Vui lòng chọn các quy trình cần từ chối:
                    </div>

                    {/* Process List */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center gap-3">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                checked={subTasks.length > 0 && selectedIds.size === subTasks.length}
                                onChange={toggleAll}
                            />
                            <span className="font-bold text-xs text-slate-500 uppercase tracking-wide">Chọn tất cả ({subTasks.length})</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            {subTasks.map((t: any, idx: number) => {
                                const isChecked = selectedIds.has(t.id);
                                return (
                                    <div
                                        key={t.id}
                                        className={`p-3 border-b border-slate-100 last:border-0 flex items-center gap-3 hover:bg-red-50/50 transition-colors cursor-pointer ${isChecked ? 'bg-red-50/30' : ''}`}
                                        onClick={() => toggleSelection(t.id)}
                                    >
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer pointer-events-none" // Controlled by div click
                                            checked={isChecked}
                                            readOnly
                                        />
                                        <div>
                                            <div className="font-medium text-slate-800 text-sm">
                                                {t.processName || `Quy trình ${idx + 1}`}
                                            </div>
                                            <div className="text-xs text-slate-400 font-mono mt-0.5">{t.id.slice(0, 8)}...</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Lý do từ chối (áp dụng cho các mục đã chọn):</label>
                        <textarea
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Ví dụ: Hình ảnh bị mờ, chưa chụp tem inverter..."
                            className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none text-sm transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end flex-shrink-0">
                    <PremiumButton
                        variant="secondary"
                        onClick={onClose}
                        className="!bg-white !border-slate-300 !text-slate-600 hover:!bg-slate-50 hover:!text-slate-800"
                    >
                        Hủy bỏ
                    </PremiumButton>
                    <PremiumButton
                        variant="danger"
                        onClick={handleConfirm}
                        disabled={selectedIds.size === 0 || !rejectNote.trim()}
                        className="shadow-red-200"
                    >
                        Xác nhận từ chối ({selectedIds.size})
                    </PremiumButton>
                </div>
            </GlassCard>
        </div>,
        document.body
    );
};

export default RejectModal;
