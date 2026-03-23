import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { X, Move, Maximize2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface DropZoneProps {
    id: string;
    style: React.CSSProperties;
    content: any | null;
    onRemoveContent: () => void;
}

const DropZone: React.FC<DropZoneProps> = ({ id, style, content, onRemoveContent }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: id,
    });

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`absolute transition-all duration-200 rounded-lg overflow-hidden group
            ${content ? 'border-transparent shadow-md' : 'border-2 border-dashed'}
            ${isOver && !content ? 'border-emerald-500 bg-emerald-500/20 scale-105 z-10' : 'border-indigo-300 bg-white/30 hover:bg-white/50'}
            `}
        >
            {content ? (
                <>
                    <img src={content.url} alt="" className="w-full h-full object-cover" />
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemoveContent(); }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform hover:scale-110"
                    >
                        <X className="w-3 h-3" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate text-center">{content.name}</p>
                    </div>
                </>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-indigo-400 font-bold text-xs uppercase tracking-widest opacity-60 group-hover:opacity-100">
                    {isOver ? 'Thả vào đây' : 'Trống'}
                </div>
            )}
        </div>
    );
};

interface Props {
    templateSrc: string;
    zones: any[];
    onRemoveContent: (id: string) => void;
}

const ReportCanvas: React.FC<Props> = ({ templateSrc, zones, onRemoveContent }) => {
    return (
        <div className="flex-1 overflow-auto bg-slate-200/50 p-8 flex justify-center items-start">
            <motion.div
                id="report-canvas-container"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative bg-white shadow-2xl shadow-slate-300 overflow-hidden"
                style={{ width: '800px', minHeight: '1100px' }} // A4 Ratio approx
            >
                {/* Reference Template */}
                <img src={templateSrc} alt="Template" className="w-full h-full object-contain opacity-50 pointer-events-none" />

                {/* Overlay Zones */}
                {zones.map(zone => (
                    <DropZone
                        key={zone.id}
                        id={zone.id}
                        style={{
                            top: `${zone.y}%`,
                            left: `${zone.x}%`,
                            width: `${zone.w}%`,
                            height: `${zone.h}%`
                        }}
                        content={zone.content}
                        onRemoveContent={() => onRemoveContent(zone.id)}
                    />
                ))}

                {/* AI Overlay Badge */}
                <div className="absolute top-4 right-4 bg-indigo-600/90 backdrop-blur text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg z-20">
                    <Maximize2 className="w-3 h-3" /> AI Layout Detected
                </div>
            </motion.div>
        </div>
    );
};

export default ReportCanvas;
