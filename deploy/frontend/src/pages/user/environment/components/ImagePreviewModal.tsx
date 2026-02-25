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
    const rawUrl = viewImage.images[viewImage.currentIndex];
    const [displayUrl, setDisplayUrl] = React.useState<string>(rawUrl);
    const [isLoading, setIsLoading] = React.useState(false);

    // Determine content type
    const isVideo = rawUrl.endsWith('.webm') || (rawUrl.startsWith('blob:') && rawUrl.includes('video'));
    const hasPrev = viewImage.currentIndex > 0;
    const hasNext = viewImage.currentIndex < viewImage.images.length - 1;

    React.useEffect(() => {
        let active = true;
        let diffObjectUrl: string | null = null;

        const fetchImage = async () => {
            // Reset to raw initially to avoid showing old stale image
            // But if it's blob/data, no need to wait
            if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
                setDisplayUrl(rawUrl);
                return;
            }

            try {
                setIsLoading(true);
                const token = localStorage.getItem('token');

                if (!token) {
                    if (active) setDisplayUrl(rawUrl);
                    return;
                }

                const response = await fetch(rawUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Failed to fetch image');

                const blob = await response.blob();
                if (active) {
                    const objectUrl = URL.createObjectURL(blob);
                    diffObjectUrl = objectUrl;
                    setDisplayUrl(objectUrl);
                }
            } catch (err) {
                console.error("Failed to load protected image", err);
                if (active) setDisplayUrl(rawUrl);
            } finally {
                if (active) setIsLoading(false);
            }
        };

        fetchImage();

        return () => {
            active = false;
            if (diffObjectUrl) {
                URL.revokeObjectURL(diffObjectUrl);
            }
        };
    }, [rawUrl]);

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

                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                {isVideo ? (
                    <video src={displayUrl} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                ) : (
                    <img src={displayUrl} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                )}
            </motion.div>
        </motion.div>
    );
};

export default ImagePreviewModal;
