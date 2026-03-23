import React, { useState } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { ArrowLeft, FileType, LayoutTemplate } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TemplateUploader from './components/TemplateUploader';
import ReportCanvas from './components/ReportCanvas';
import ReportEditor from './components/ReportEditor';
import ImageLibrarySidebar from './components/ImageLibrarySidebar';
import PremiumButton from '../../../../components/common/PremiumButton';

const SmartReportPage = () => {
    const navigate = useNavigate();
    const [templateImage, setTemplateImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [mode, setMode] = useState<'ai' | 'manual'>('manual'); // 'ai' or 'manual'

    // Canvas Zones State (Lifted up)
    const [zones, setZones] = useState([
        { id: 'zone_1', x: 10, y: 30, w: 35, h: 25, content: null },
        { id: 'zone_2', x: 55, y: 30, w: 35, h: 25, content: null },
        { id: 'zone_3', x: 10, y: 60, w: 35, h: 25, content: null },
        { id: 'zone_4', x: 55, y: 60, w: 35, h: 25, content: null },
    ]);

    // Dragging State
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<any>(null);
    const [droppedItemToEditor, setDroppedItemToEditor] = useState<any>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    const handleTemplateUpload = async (file: File) => {
        console.log("Processing file:", file.name, file.type);
        setIsProcessing(true);

        try {
            let url = '';
            if (file.type === 'application/pdf') {
                const { convertPdfToImage } = await import('../../../../utils/pdfUtils');
                url = await convertPdfToImage(file);
            } else {
                url = URL.createObjectURL(file);
            }

            setTimeout(() => {
                setTemplateImage(url);
                setIsProcessing(false);
            }, 1000);

        } catch (error) {
            console.error("Upload failed", error);
            alert("Không thể xử lý file này. Vui lòng thử lại.");
            setIsProcessing(false);
        }
    };

    const handleDragStart = (event: any) => {
        const { active } = event;
        setActiveId(active.id);
        setActiveDragItem(active.data.current);
    };

    const handleDragEnd = (event: any) => {
        const { over, active } = event;
        const droppedImage = active.data.current;

        if (over && droppedImage) {
            if (mode === 'ai') {
                setZones((prevZones) =>
                    prevZones.map((zone) =>
                        zone.id === over.id ? { ...zone, content: droppedImage } : zone
                    )
                );
            } else if (mode === 'manual' && over.id === 'editor-zone') {
                setDroppedItemToEditor(droppedImage);
            }
        }

        setActiveId(null);
        setActiveDragItem(null);
    };

    const handleRemoveContent = (zoneId: string) => {
        setZones((prevZones) =>
            prevZones.map((zone) =>
                zone.id === zoneId ? { ...zone, content: null } : zone
            )
        );
    };

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-20">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">Smart Report</span>
                                <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-200">BETA</span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setMode('ai')}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${mode === 'ai' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutTemplate className="w-4 h-4" /> AI Auto
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${mode === 'manual' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileType className="w-4 h-4" /> Soạn Thảo
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        {mode === 'ai' && templateImage && <PremiumButton size="sm" variant="ghost" onClick={() => setTemplateImage(null)}>Chọn mẫu khác</PremiumButton>}
                        <PremiumButton
                            size="sm"
                            className="shadow-lg shadow-indigo-200"
                            onClick={async () => {
                                if (mode === 'manual') {
                                    window.print();
                                } else {
                                    try {
                                        const { default: html2canvas } = await import('html2canvas');
                                        const element = document.getElementById('report-canvas-container');
                                        if (element) {
                                            const canvas = await html2canvas(element, { useCORS: true, scale: 2, backgroundColor: null } as any);
                                            const link = document.createElement('a');
                                            link.download = `bao-cao-${Date.now()}.png`;
                                            link.href = canvas.toDataURL('image/png');
                                            link.click();
                                        }
                                    } catch (e) { alert("Có lỗi khi xuất báo cáo."); }
                                }
                            }}
                        >
                            {mode === 'manual' ? 'In Báo Cáo' : 'Xuất File Ảnh'}
                        </PremiumButton>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">

                    {/* LEFT: Editor or Uploader */}
                    <div className="flex-1 relative bg-slate-100/50 flex flex-col overflow-hidden">
                        {mode === 'ai' ? (
                            !templateImage ? (
                                <div className="flex-1 flex items-center justify-center p-8">
                                    <TemplateUploader onUpload={handleTemplateUpload} isProcessing={isProcessing} />
                                </div>
                            ) : (
                                <ReportCanvas templateSrc={templateImage} zones={zones} onRemoveContent={handleRemoveContent} />
                            )
                        ) : (
                            <div className="flex-1 p-8 overflow-hidden h-full">
                                <ReportEditor
                                    droppedImage={droppedItemToEditor}
                                    onImageHandled={() => setDroppedItemToEditor(null)}
                                />
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Image Library Sidebar (Shared) */}
                    {(templateImage || mode === 'manual') && (
                        <div className="w-80 bg-white border-l border-slate-200 shadow-xl z-10 flex flex-col">
                            <ImageLibrarySidebar />
                        </div>
                    )}
                </div>

                {/* Global Drag Overlay */}
                <DragOverlay dropAnimation={null}>
                    {activeId && activeDragItem ? (
                        <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-indigo-500 shadow-2xl opacity-90 rotate-3 cursor-grabbing z-50 pointer-events-none">
                            <img src={activeDragItem.url} alt="" className="w-full h-full object-cover" />
                        </div>
                    ) : null}
                </DragOverlay>
            </div>
        </DndContext>
    );
};

export default SmartReportPage;
