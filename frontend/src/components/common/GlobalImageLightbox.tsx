import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';

interface GlobalImageLightboxProps {
    src: string | null;
    alt?: string;
    onClose: () => void;
}

const GlobalImageLightbox: React.FC<GlobalImageLightboxProps> = ({ src, alt, onClose }) => {
    const [scale, setScale] = React.useState(1);
    const [isDragging, setIsDragging] = React.useState(false);
    const [position, setPosition] = React.useState({ x: 0, y: 0 });
    const [startPos, setStartPos] = React.useState({ x: 0, y: 0 });

    useEffect(() => {
        if (src) {
            document.body.style.overflow = 'hidden';
            setScale(1);
            setPosition({ x: 0, y: 0 });
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [src]);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!src) return null;

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        if (e.deltaY < 0) {
            setScale(s => Math.min(s + 0.1, 3));
        } else {
            setScale(s => Math.max(s - 0.1, 0.5));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            setIsDragging(true);
            setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) {
            setPosition({
                x: e.clientX - startPos.x,
                y: e.clientY - startPos.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={onClose}
        >
            {/* Toolbar */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
                <button
                    onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(s + 0.5, 3)); }}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                    <ZoomIn className="w-5 h-5" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(s - 0.5, 0.5)); }}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                    <ZoomOut className="w-5 h-5" />
                </button>
                <a
                    href={src}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Download className="w-5 h-5" />
                </a>
                <button
                    onClick={onClose}
                    className="p-2 bg-white/10 hover:bg-red-500/80 rounded-full text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Image Container */}
            <div
                className="relative w-full h-full flex items-center justify-center p-4 overflow-hidden"
                onWheel={handleWheel}
            >
                <img
                    src={src}
                    alt={alt || 'Full screen preview'}
                    className="max-w-full max-h-full object-contain transition-transform duration-100 ease-out select-none cursor-grab active:cursor-grabbing"
                    style={{
                        transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    draggable={false}
                />
            </div>

            {/* Legend/Caption */}
            {alt && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full backdrop-blur-md text-white/90 text-sm font-medium">
                    {alt}
                </div>
            )}
        </div>,
        document.body
    );
};

export default GlobalImageLightbox;
