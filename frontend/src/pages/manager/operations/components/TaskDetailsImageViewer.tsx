import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface TaskDetailsImageViewerProps {
    viewImage: { images: string[], currentIndex: number } | null;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
}

const TaskDetailsImageViewer: React.FC<TaskDetailsImageViewerProps> = ({
    viewImage,
    onClose,
    onNext,
    onPrev
}) => {
    if (!viewImage) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
                onClick={onClose}
            >
                {/* Close Button */}
                <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-[10001]">
                    <X className="w-8 h-8" />
                </button>

                {/* Main Image */}
                <motion.img
                    key={viewImage.currentIndex}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={viewImage.images[viewImage.currentIndex]}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                />

                {/* Navigation */}
                {viewImage.images.length > 1 && (
                    <>
                        <button
                            className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all z-[10001]"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPrev();
                            }}
                        >
                            <ChevronLeft className="w-8 h-8" />
                        </button>
                        <button
                            className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all z-[10001]"
                            onClick={(e) => {
                                e.stopPropagation();
                                onNext();
                            }}
                        >
                            <ChevronRight className="w-8 h-8" />
                        </button>
                    </>
                )}

                {/* Counter */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur text-white rounded-full text-sm font-medium border border-white/10">
                    {viewImage.currentIndex + 1} / {viewImage.images.length}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default TaskDetailsImageViewer;
