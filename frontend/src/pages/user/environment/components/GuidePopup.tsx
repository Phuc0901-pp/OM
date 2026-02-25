import React from 'react';
import { motion } from 'framer-motion';
import { X, ScrollText } from 'lucide-react';
import { GuidePopupData } from '../types';

interface GuidePopupProps {
    data: GuidePopupData;
    onClose: () => void;
}

const GuidePopup: React.FC<GuidePopupProps> = ({ data, onClose }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <ScrollText className="w-5 h-5 text-indigo-600" />
                        Hướng dẫn: {data.title}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    {data.text ? (
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-slate-700 leading-relaxed whitespace-pre-line">
                            {data.text}
                        </div>
                    ) : (
                        <p className="text-slate-400 italic text-center">Chưa có hướng dẫn text.</p>
                    )}

                    {data.images && data.images.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="font-bold text-sm text-slate-700 uppercase tracking-wider">Hình ảnh mẫu ({data.images.length})</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {data.images.map((img, idx) => (
                                    <div key={idx} className="group relative aspect-video rounded-lg overflow-hidden border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-all" onClick={() => window.open(img, '_blank')}>
                                        <img src={img} alt={`Guide ${idx}`} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default GuidePopup;
