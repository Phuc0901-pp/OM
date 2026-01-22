import React from 'react';
import { motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { ViewImageData } from '../types';

interface ImagePreviewModalProps {
    viewImage: ViewImageData;
    onClose: () => void;
    onChangeIndex: (newIndex: number) => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ viewImage, onClose, onChangeIndex }) => {
    const currentUrl = viewImage.images[viewImage.currentIndex];
    const isVideo = currentUrl.endsWith('.webm') || (currentUrl.startsWith('blob:') && currentUrl.includes('video'));
    const hasPrev = viewImage.currentIndex > 0;
    const hasNext = viewImage.currentIndex < viewImage.images.length - 1;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
            style={{ margin: 0 }}
        >
            {/* Previous Button */}
            {hasPrev && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onChangeIndex(viewImage.currentIndex - 1);
                    }}
                    className="absolute left-4 z-[10000] p-3 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
                >
                    <ChevronLeft className="w-8 h-8" />
                </button>
            )}

            {/* Next Button */}
            {hasNext && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onChangeIndex(viewImage.currentIndex + 1);
                    }}
                    className="absolute right-4 z-[10000] p-3 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
                >
                    <ChevronRight className="w-8 h-8" />
                </button>
            )}

            <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="relative max-w-full max-h-full flex items-center justify-center w-full h-full"
                onClick={e => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[10000] p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Image Counter */}
                <div className="absolute top-4 left-4 z-[10000] bg-black/50 px-3 py-1 rounded-full text-white/90 text-sm font-medium">
                    {viewImage.currentIndex + 1} / {viewImage.images.length}
                </div>

                {isVideo ? (
                    <video src={currentUrl} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                ) : (
                    <img src={currentUrl} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                )}
            </motion.div>
        </motion.div>
    );
};

export default ImagePreviewModal;
