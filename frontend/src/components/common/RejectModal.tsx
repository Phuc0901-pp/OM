import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, Send } from 'lucide-react';
import PremiumButton from './PremiumButton';

interface RejectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    title?: string;
}

const RejectModal: React.FC<RejectModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    title = "Từ chối quy trình"
}) => {
    const [reason, setReason] = React.useState('');

    const handleSubmit = () => {
        if (reason.trim()) {
            onSubmit(reason.trim());
            setReason('');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                    >
                        {/* Red Decor Header */}
                        <div className="h-2 bg-red-500 w-full" />

                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center ring-4 ring-red-50">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                            </div>

                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Lý do từ chối <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Nhập lý do từ chối..."
                                rows={4}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none transition-all resize-none text-slate-700"
                            />

                            <div className="flex gap-3 mt-6">
                                <PremiumButton
                                    variant="secondary"
                                    onClick={onClose}
                                    className="flex-1 justify-center"
                                >
                                    Hủy
                                </PremiumButton>
                                <PremiumButton
                                    variant="danger"
                                    onClick={handleSubmit}
                                    disabled={!reason.trim()}
                                    className="flex-1 justify-center"
                                >
                                    <Send className="w-4 h-4" />
                                    Gửi từ chối
                                </PremiumButton>
                            </div>
                        </div>

                        {/* Close Icon */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default RejectModal;
