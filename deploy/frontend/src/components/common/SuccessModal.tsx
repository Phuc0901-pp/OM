import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import PremiumButton from './PremiumButton';

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    variant?: 'success' | 'error';
}

const SuccessModal: React.FC<SuccessModalProps> = ({
    isOpen,
    onClose,
    title = "Thành công",
    message = "Thao tác đã được thực hiện thành công!",
    variant = 'success'
}) => {
    const isError = variant === 'error';
    const colorClass = isError ? 'red' : 'emerald';

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
                        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                    >
                        {/* Decor Header */}
                        <div className={`h-2 w-full ${isError ? 'bg-red-500' : 'bg-emerald-500'}`} />

                        <div className="p-6 text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ${isError ? 'bg-red-100 text-red-600 ring-red-50' : 'bg-emerald-100 text-emerald-600 ring-emerald-50'}`}>
                                <motion.div
                                    initial={{ scale: 0, rotate: -45 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                                >
                                    {isError ? <AlertCircle className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                                </motion.div>
                            </div>

                            <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
                            <p className="text-slate-600 mb-6">{message}</p>

                            <PremiumButton
                                variant={isError ? 'danger' : 'primary'}
                                onClick={onClose}
                                className={`w-full justify-center shadow-lg ${isError ? 'shadow-red-200' : 'shadow-emerald-200 !bg-emerald-600 hover:!bg-emerald-700'}`}
                            >
                                Đóng
                            </PremiumButton>
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

export default SuccessModal;
