import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Check, X } from 'lucide-react';

interface ImageEditorProps {
    src: string;
    onSave: (editedBase64: string) => void;
    onCancel: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ src, onSave, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [rotation, setRotation] = useState(0);
    const [scaleX, setScaleX] = useState(1);
    const [scaleY, setScaleY] = useState(1);
    const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setImageObj(img);
        img.src = src;
    }, [src]);

    useEffect(() => {
        if (!imageObj || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate dimensions based on rotation
        const isRotated = (rotation / 90) % 2 !== 0; // 90 or 270 degrees
        const canvasW = isRotated ? imageObj.height : imageObj.width;
        const canvasH = isRotated ? imageObj.width : imageObj.height;

        // We set actual pixel dimensions for maximum raw quality.
        canvas.width = canvasW;
        canvas.height = canvasH;

        ctx.clearRect(0, 0, canvasW, canvasH);

        ctx.translate(canvasW / 2, canvasH / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scaleX, scaleY);

        ctx.drawImage(imageObj, -imageObj.width / 2, -imageObj.height / 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

    }, [imageObj, rotation, scaleX, scaleY]);

    const handleSave = () => {
        if (!canvasRef.current) return;
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.95);
        onSave(dataUrl);
    };

    return (
        <div className="fixed inset-0 z-[9999999] bg-black flex flex-col items-center justify-between touch-none">
            {/* Header / Actions */}
            <div className="w-full p-4 flex justify-between items-center bg-black/60 backdrop-blur-md absolute top-0 left-0 z-10 text-white safe-area-top shadow-md">
                <button onClick={onCancel} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                    <X className="w-5 h-5" />
                    <span className="text-sm font-medium">Hủy</span>
                </button>
                <span className="font-bold text-white tracking-wide">Chỉnh sửa</span>
                <button onClick={handleSave} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded-full hover:bg-blue-500 transition-colors">
                    <Check className="w-5 h-5" />
                    <span className="text-sm font-medium">Lưu</span>
                </button>
            </div>

            {/* Canvas Container */}
            <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden relative pt-20 pb-32">
                <canvas
                    ref={canvasRef}
                    className="max-w-[95%] max-h-[95%] object-contain rounded-md shadow-2xl transition-all duration-300 ring-1 ring-white/10"
                />
            </div>

            {/* Tools Footer */}
            <div className="absolute bottom-0 left-0 w-full p-6 flex justify-center gap-6 bg-black/80 backdrop-blur-md pb-safe border-t border-white/10">
                <button onClick={() => setRotation(r => (r - 90) % 360)} className="p-4 bg-white/5 hover:bg-white/10 rounded-full text-white active:scale-95 transition-all shadow-lg ring-1 ring-white/10">
                    <RotateCcw className="w-6 h-6" />
                </button>
                <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-4 bg-white/5 hover:bg-white/10 rounded-full text-white active:scale-95 transition-all shadow-lg ring-1 ring-white/10">
                    <RotateCw className="w-6 h-6" />
                </button>
                <div className="w-px h-10 bg-white/20 my-auto mx-2"></div>
                <button onClick={() => setScaleX(s => s * -1)} className="p-4 bg-white/5 hover:bg-white/10 rounded-full text-white active:scale-95 transition-all shadow-lg ring-1 ring-white/10">
                    <FlipHorizontal className="w-6 h-6" />
                </button>
                <button onClick={() => setScaleY(s => s * -1)} className="p-4 bg-white/5 hover:bg-white/10 rounded-full text-white active:scale-95 transition-all shadow-lg ring-1 ring-white/10">
                    <FlipVertical className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};
