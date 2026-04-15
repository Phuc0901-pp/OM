import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HardHat, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../../services/api';

interface MaintenanceModalProps {
    isOpen: boolean;
    isActive: boolean;
    onClose: () => void;
    onSuccess: (active: boolean) => void;
}

const MaintenanceModal = ({ isOpen, isActive, onClose, onSuccess }: MaintenanceModalProps) => {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            await api.post('/admin/maintenance', {
                active: !isActive,
                message: message.trim() || undefined
            });
            onSuccess(!isActive);
            onClose();
            setMessage('');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.95 }}
                        className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700"
                    >
                        {/* Header */}
                        <div className={`p-6 ${isActive ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-amber-500 to-orange-600'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-white">
                                    <div className="p-2 bg-white/20 rounded-xl">
                                        {isActive ? <CheckCircle2 className="w-6 h-6" /> : <HardHat className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black">{isActive ? 'Tắt Chế độ Bảo trì' : 'Bật Chế độ Bảo trì'}</h3>
                                        <p className="text-white/80 text-sm font-medium">
                                            {isActive ? 'Hệ thống sẽ hoạt động trở lại bình thường' : 'Thông báo đến toàn bộ nhân sự'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all">
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            {!isActive && (
                                <>
                                    {/* Warning */}
                                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-700/50">
                                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                                            Khi bật chế độ bảo trì, toàn bộ nhân sự sẽ nhận được thông báo và không thể sử dụng hệ thống cho đến khi bạn tắt chế độ này.
                                        </p>
                                    </div>

                                    {/* Message */}
                                    <div>
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                                            Nội dung thông báo <span className="text-slate-400 font-normal">(không bắt buộc)</span>
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={message}
                                            onChange={e => setMessage(e.target.value)}
                                            placeholder="VD: Hệ thống bảo trì từ 12:00 đến 13:00 để nâng cấp cơ sở dữ liệu..."
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none transition-all"
                                        />
                                    </div>
                                </>
                            )}

                            {isActive && (
                                <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-700/50">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                                        Tắt chế độ bảo trì sẽ gửi thông báo "Hệ thống đã phục hồi" đến toàn bộ nhân sự.
                                    </p>
                                </div>
                            )}

                            {error && (
                                <p className="text-sm text-red-600 dark:text-red-400 font-medium px-1">{error}</p>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                >
                                    Huỷ
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className={`flex-1 px-4 py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                                        loading ? 'opacity-70 cursor-not-allowed' : ''
                                    } ${isActive
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                                        : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                                    }`}
                                >
                                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {isActive ? 'Tắt Bảo trì' : 'Bật Bảo trì'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default MaintenanceModal;
