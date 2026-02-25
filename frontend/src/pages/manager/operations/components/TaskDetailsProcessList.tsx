import React from 'react';
import { LayoutGrid, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { TaskRow } from '../types';

interface TaskDetailsProcessListProps {
    task: TaskRow;
    evidenceMap: Record<string, string[]>;
    noteMap: Record<string, string>;
    onViewImage: (images: string[], index: number) => void;
    selectedTaskIds: Set<string>;
    onToggleSelection: (id: string) => void;
}

const TaskDetailsProcessList: React.FC<TaskDetailsProcessListProps> = ({
    task,
    evidenceMap,
    noteMap,
    onViewImage,
    selectedTaskIds,
    onToggleSelection
}) => {
    // Get API base URL for proper image resolution (especially for tunnel access)
    const apiUrl = import.meta.env.VITE_API_URL || '';

    // Helper to resolve image URLs
    const getImageUrl = (img: string): string => {
        if (!img) return '';
        // Already a full URL
        if (img.startsWith('http://') || img.startsWith('https://')) return img;

        const baseUrl = apiUrl.replace(/\/api$/, '');

        // Handle URLs already having /api prefix
        if (img.startsWith('/api')) {
            return baseUrl ? `${baseUrl}${img}` : img;
        }

        // Handle legacy URLs missing /api prefix (e.g., /media/proxy?...)
        if (img.startsWith('/media/')) {
            return baseUrl ? `${baseUrl}/api${img}` : `/api${img}`;
        }

        // Handle malformed relative URLs
        if (img.startsWith('proxy?key=')) {
            return baseUrl ? `${baseUrl}/api/media/${img}` : `/api/media/${img}`;
        }

        // Relative path without /api prefix
        if (img.startsWith('/')) {
            return baseUrl ? `${baseUrl}${img}` : img;
        }
        return img;
    };

    return (
        <div className="lg:col-span-8 space-y-6">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide px-1">
                <LayoutGrid className="w-4 h-4 text-indigo-500" /> Hình ảnh & Ghi chú
            </h3>

            {(() => {
                const subTasks = task.subTasks && task.subTasks.length > 0
                    ? task.subTasks
                    : [task];

                return subTasks.map((subTask: any, tIdx: number) => {
                    const dr = subTask.dataResult || (subTask.data_result ? JSON.parse(subTask.data_result) : null);
                    const processLabel = subTask.processName || `Quy trình ${tIdx + 1}`;
                    const isSelected = selectedTaskIds.has(subTask.id);

                    // (Moved evidence declaration down)
                    const currentNote = noteMap[subTask.id] || '';

                    const getStageData = (stage: string) => {
                        const data = dr?.[stage] || dr?.[stage.charAt(0).toUpperCase() + stage.slice(1)];
                        let imgs: string[] = [];
                        if (data?.images && Array.isArray(data.images)) {
                            imgs = data.images.filter((i: any) => typeof i === 'string');
                        }
                        // Fix Legacy Paths
                        imgs = imgs.map(img => img.startsWith('/media/proxy') ? `/api${img}` : img);

                        return {
                            images: imgs,
                            note: data?.note as string || ''
                        };
                    };

                    // Try to use direct evidence fields if dataResult is missing
                    let before = getStageData('before');
                    let after = getStageData('after');


                    // Fix API Evidence Paths too
                    const currentEvidence = (evidenceMap[subTask.id] || []).map(img =>
                        img.startsWith('/media/proxy') ? `/api${img}` : img
                    );

                    // Check if existing images cover what's in evidence
                    const existingImages = new Set([...before.images, ...after.images]);
                    const newEvidence = currentEvidence.filter(img => !existingImages.has(img));

                    console.log(`[TaskDetails] Task ${subTask.id} Images:`, {
                        before: before.images,
                        after: after.images,
                        newEvidence,
                        evidenceRaw: evidenceMap[subTask.id]
                    });

                    if (subTask.beforeImages && subTask.beforeImages.length > 0) {
                        before.images = subTask.beforeImages;
                        before.note = subTask.beforeNote || before.note;
                    }
                    if (subTask.afterImages && subTask.afterImages.length > 0) {
                        after.images = subTask.afterImages;
                        after.note = subTask.afterNote || after.note;
                    }

                    const legacyImgs = subTask.images || [];
                    const generalImages = (legacyImgs.length > 0 && before.images.length === 0 && after.images.length === 0) ? legacyImgs : [];

                    // Append API evidence to General Images
                    if (newEvidence.length > 0) {
                        generalImages.push(...newEvidence);
                    }
                    // Also check generalImages prop
                    if (subTask.generalImages && subTask.generalImages.length > 0) generalImages.push(...subTask.generalImages);

                    const hasBefore = before.images.length > 0;
                    const hasAfter = after.images.length > 0;
                    const hasGeneral = generalImages.length > 0;
                    const isEmpty = !hasBefore && !hasAfter && !hasGeneral;

                    // All Images for this Task for Viewer
                    const allTaskImages = [
                        ...before.images,
                        ...after.images,
                        ...generalImages
                    ];

                    return (
                        <div
                            key={subTask.id}
                            onClick={() => onToggleSelection(subTask.id)}
                            className={`bg-white rounded-xl border p-4 shadow-sm relative overflow-hidden cursor-pointer transition-all ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'}`}
                        >
                            {/* Selection Indicator */}
                            <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 bg-white'}`}>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                            </div>

                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                            <h4 className="font-bold text-slate-800 mb-4 pl-3 pr-10 flex justify-between items-center text-sm">
                                <span>{processLabel}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-mono">{subTask.id.slice(0, 8)}...</span>
                            </h4>

                            {/* Status Display */}
                            {subTask.accept === 1 && subTask.status_reject === 0 ? (
                                <div className="mb-3 px-3 py-2 bg-green-50 text-green-700 text-xs rounded-lg flex items-center gap-2 border border-green-100">
                                    <CheckCircle2 className="w-3 h-3" /> Đã duyệt: "{subTask.note_approval}"
                                </div>
                            ) : subTask.accept === 0 && (subTask.status_reject === 1 || subTask.status_reject === -1) ? (
                                <div className="mb-3 px-3 py-2 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2 border border-red-100">
                                    <AlertCircle className="w-3 h-3" /> Bị từ chối: "{subTask.note_reject}"
                                </div>
                            ) : null}

                            {/* Worker Note from MinIO Sync */}
                            {currentNote && (
                                <div className="mb-4 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50">
                                    <h5 className="text-[10px] font-bold text-indigo-600 uppercase mb-1 flex items-center gap-1.5">
                                        <FileText className="w-3 h-3" /> Ghi chú từ nhân sự
                                    </h5>
                                    <p className="text-sm text-slate-700 leading-relaxed">"{currentNote}"</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                {/* Before Section */}
                                {hasBefore && (
                                    <div className="bg-amber-50/30 rounded-lg p-3 border border-amber-100/50">
                                        <div className="text-[10px] font-bold text-amber-600 uppercase mb-2 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Trước khi làm
                                        </div>
                                        {before.note && <p className="text-xs text-slate-600 italic mb-2 bg-white/50 p-2 rounded border border-amber-50">"{before.note}"</p>}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {before.images.map((img: string, idx: number) => (
                                                <img
                                                    key={idx}
                                                    src={getImageUrl(img)}
                                                    className="w-full h-20 object-cover rounded-md border border-amber-100 shadow-sm transition-transform hover:scale-105 cursor-pointer"
                                                    alt="before"
                                                    onClick={(e) => { e.stopPropagation(); onViewImage(allTaskImages.map(getImageUrl), allTaskImages.indexOf(img)); }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* After Section */}
                                {hasAfter && (
                                    <div className="bg-emerald-50/30 rounded-lg p-3 border border-emerald-100/50">
                                        <div className="text-[10px] font-bold text-emerald-600 uppercase mb-2 flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Sau khi làm
                                        </div>
                                        {after.note && <p className="text-xs text-slate-600 italic mb-2 bg-white/50 p-2 rounded border border-emerald-50">"{after.note}"</p>}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {after.images.map((img: string, idx: number) => (
                                                <img
                                                    key={idx}
                                                    src={getImageUrl(img)}
                                                    className="w-full h-20 object-cover rounded-md border border-emerald-100 shadow-sm transition-transform hover:scale-105 cursor-pointer"
                                                    alt="after"
                                                    onClick={(e) => { e.stopPropagation(); onViewImage(allTaskImages.map(getImageUrl), allTaskImages.indexOf(img)); }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* General Section */}
                                {hasGeneral && (
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Hình ảnh</div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {generalImages.map((img: string, idx: number) => (
                                                <img
                                                    key={idx}
                                                    src={getImageUrl(img)}
                                                    className="w-full h-20 object-cover rounded-md border border-slate-200 shadow-sm hover:scale-105 cursor-pointer"
                                                    alt="general"
                                                    onClick={(e) => { e.stopPropagation(); onViewImage(allTaskImages.map(getImageUrl), allTaskImages.indexOf(img)); }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {isEmpty && (
                                    <div className="text-center py-4 text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                        Không có dữ liệu hình ảnh cho quy trình này.
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                });
            })()}
        </div>
    );
};

export default TaskDetailsProcessList;
