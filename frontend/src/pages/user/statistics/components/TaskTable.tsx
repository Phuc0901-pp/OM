import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DetailedTask, Allocation } from '../../../../types/allocation';
import { getStatusBadge, determineTaskStatus } from '../../../../utils/statusUtils';
import GlassCard from '../../../../components/common/GlassCard';
import { ChevronRight, FileX2, ChevronLeft, X } from 'lucide-react';
import { getImageUrl } from '../../../../utils/imageUtils';

interface TaskTableProps {
    allocations: Allocation[];
    selectedProject: string;
    stations: { id: string; name: string }[];
    processes: { id: string; name: string }[];
    loading: boolean;
    filterTaskId?: string | null;
}


// Expanded Process Color Palette (20 distinct colors)
const PROCESS_COLORS = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500',
    'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500',
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500',
    'bg-pink-500', 'bg-rose-500', 'bg-slate-500', 'bg-gray-500', 'bg-zinc-500'
];

// Helper to get color by index in the process list
const getProcessColorByIndex = (index: number) => {
    return PROCESS_COLORS[index % PROCESS_COLORS.length];
};

const TaskTable: React.FC<TaskTableProps> = ({ allocations, selectedProject, stations, processes, loading, filterTaskId }) => {

    // Create a stable Map of Process ID -> Color based on order
    const processColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        // Sort processes by Name (or ID) to ensure consistent coloring across renders
        // const sorted = [...processes].sort((a, b) => a.name.localeCompare(b.name)); 
        // Or just use the order provided if stable
        processes.forEach((p, idx) => {
            map[p.id] = getProcessColorByIndex(idx);
        });
        return map;
    }, [processes]);

    // Lightbox State: store all images and current index
    const [lightbox, setLightbox] = useState<{ images: string[], index: number } | null>(null);

    // Handlers for Carousel
    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!lightbox) return;
        setLightbox({
            ...lightbox,
            index: (lightbox.index + 1) % lightbox.images.length
        });
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!lightbox) return;
        setLightbox({
            ...lightbox,
            index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length
        });
    };

    // 1. Prepare Station & Process Maps for O(1) lookup
    const { stationMap, processMap } = useMemo(() => {
        const sMap: Record<string, string> = {};
        stations.forEach(s => { sMap[s.id] = s.name; });

        const pMap: Record<string, string> = {};
        processes.forEach(p => { pMap[p.id] = p.name; });

        return { stationMap: sMap, processMap: pMap };
    }, [stations, processes]);

    // 2. Grouping & Flattening Logic
    const tableData = useMemo(() => {
        const groupedMap = new Map<string, DetailedTask>();

        allocations.forEach(alloc => {
            if (selectedProject && alloc.id_project !== selectedProject) return;

            const tasks = alloc.task_details || [];
            tasks.forEach(d => {
                // Filter by Task ID if provided
                if (filterTaskId && d.id !== filterTaskId) return;

                // Key: AssignID + StationID + ChildCategoryID
                // Use station_id -> station_name -> fallback
                const stationIdKey = d.station_id || '';
                const stationNameFallback = d.station_name || '';
                const stationKey = stationIdKey || stationNameFallback || 'no-station';

                // Group by Process ID as well to ensure distinct steps show as separate rows
                const groupKey = `${alloc.id}_${stationKey}_${d.child_category_id}_${d.process_id || 'default'}`;

                // Resolve Station Name: Map lookup -> d.station_name -> d.child_category.station.name -> '-'
                const resolvedStationName = (d.station_id && stationMap[d.station_id])
                    ? stationMap[d.station_id]
                    : (d.station_name || d.child_category?.station?.name || undefined);

                // Date Reviewed Logic
                const isApproved = d.status_approve === 1 || d.accept === 1;
                const isRejected = d.status_reject === 1 || d.accept === -1;

                let dateReviewed = '-';
                if (isApproved && d.approval_at) {
                    dateReviewed = new Date(d.approval_at).toLocaleString('vi-VN');
                } else if (isRejected && d.reject_at) {
                    dateReviewed = new Date(d.reject_at).toLocaleString('vi-VN');
                }

                const rowData: DetailedTask = {
                    id: d.id,
                    projectName: alloc.project?.project_name || 'N/A',
                    classificationName: alloc.classification?.name || 'N/A',
                    categoryName: d.child_category?.main_category?.name || 'N/A',
                    itemName: d.child_category?.name || 'N/A',
                    status: determineTaskStatus(d),
                    note: (d as any).data_note || d.note,
                    stationName: resolvedStationName,
                    inverterName: d.inverter_name ?? undefined,
                    dateSubmitted: d.submitted_at ? new Date(d.submitted_at).toLocaleString('vi-VN') : '-',
                    dateReviewed: dateReviewed,
                    processId: d.process_id, // Map process_id
                    // Add extra fields for rendering. 
                    // But here we construct the object. Let's assume we cast or updated the type.
                    // For now, note is there. Image path is on 'd'.
                    imagePath: d.image_url || d.image_path
                } as DetailedTask & { imagePath?: string };

                // Logic: Keep the "latest" updated task in the group.
                if (groupedMap.has(groupKey)) {
                    const existing = groupedMap.get(groupKey)!;
                    // Compare updated_at
                    const currentUpdated = new Date(d.updated_at || 0).getTime();
                    // Since DetailedTask doesn't store raw updated_at, we might miss it.
                    // Ideally we should pass it. For now, let's assume 'd' iteration order implies significance,
                    // OR specifically check if 'rowData' has a "more final" status.

                    // Simple heuristic: If current is 'approved' or 'rejected', it overrides 'pending'.
                    // Or check timestamps if we stored them. 
                    // Let's rely on backend sort order (usually ID or Created).

                    groupedMap.set(groupKey, rowData); // Just replacing for now (Basic grouping)
                } else {
                    groupedMap.set(groupKey, rowData);
                }
            });
        });

        return Array.from(groupedMap.values());
    }, [allocations, selectedProject, stationMap, filterTaskId]);

    if (loading && tableData.length === 0) {
        return (
            <GlassCard className="h-[400px] flex items-center justify-center">
                <p className="text-slate-400 font-medium">Đang tải danh sách công việc...</p>
            </GlassCard>
        );
    }

    return (
        <GlassCard className="flex flex-col min-h-[500px] !p-0 overflow-hidden relative border-slate-200/60 shadow-xl shadow-slate-200/40">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="h-8 w-1.5 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
                    <div>
                        <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Danh sách công việc chi tiết</h2>
                        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
                            {tableData.length} hạng mục
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                {/* Mobile Legend for Processes */}
                <div className="md:hidden flex flex-wrap gap-3 p-4 bg-slate-50 border-b border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 w-full mb-1">Chú thích quy trình:</span>
                    {processes.map((p) => {
                        const colorClass = processColorMap[p.id] || 'bg-slate-300';
                        return (
                            <div key={p.id} className="flex items-center gap-1.5">
                                <span className={`w-2.5 h-2.5 rounded-full ${colorClass}`}></span>
                                <span className="text-[11px] font-medium text-slate-600 truncate max-w-[100px]">{p.name}</span>
                            </div>
                        );
                    })}
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 sticky top-0 z-10 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider backdrop-blur-sm border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Hạng mục / Dự án</th>
                                <th className="px-6 py-4">Công việc</th>
                                <th className="px-6 py-4">Khu vực</th>
                                <th className="px-6 py-4 hidden md:table-cell">Ngày nộp</th>
                                <th className="px-6 py-4 hidden md:table-cell">Ngày duyệt/từ chối</th>
                                <th className="px-6 py-4 text-center">Trạng thái</th>
                                <th className="px-6 py-4 text-center">Hình ảnh</th>
                                <th className="px-6 py-4 text-center">Ghi chú</th>
                                <th className="px-6 py-4 text-center">Quy trình làm việc</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tableData.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 opacity-50">
                                            <FileX2 className="w-12 h-12 text-slate-300" />
                                            <p className="text-slate-500 font-medium">Chưa có dữ liệu công việc</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                tableData.map((task, index) => {
                                    const badge = getStatusBadge(task.status);
                                    return (
                                        <tr key={`${task.id}-${index}`} className="hover:bg-indigo-50/30 transition-colors duration-200 group">

                                            {/* Hạng mục & Dự án */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-bold text-slate-700">{task.categoryName}</span>
                                                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 w-fit px-2 py-0.5 rounded-md">
                                                        {task.projectName}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Công việc */}
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-medium text-slate-600">{task.itemName}</span>
                                                {task.inverterName && (
                                                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                        Inverter: {task.inverterName}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Khu vực */}
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-mono text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                    {task.stationName || '-'}
                                                </span>
                                            </td>

                                            {/* Ngày nộp */}
                                            <td className="px-6 py-4 hidden md:table-cell text-xs font-medium text-slate-500">
                                                {task.dateSubmitted}
                                            </td>

                                            {/* Ngày duyệt */}
                                            <td className="px-6 py-4 hidden md:table-cell text-xs font-medium">
                                                <span className={
                                                    task.status === 'approved' ? 'text-emerald-600' :
                                                        task.status === 'rejected' ? 'text-rose-600' : 'text-slate-400'
                                                }>
                                                    {task.dateReviewed}
                                                </span>
                                            </td>

                                            {/* Trạng thái */}
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${badge.color}`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                    {badge.label}
                                                </span>
                                            </td>

                                            {/* Action */}
                                            <td className="px-6 py-4 text-center">
                                                {(() => {
                                                    const path = (task as any).imagePath;
                                                    let displayImages: string[] = [];
                                                    const apiUrl = import.meta.env.VITE_API_URL || '/api';



                                                    if (path) {
                                                        if (path.startsWith('[') || path.startsWith('{')) {
                                                            try {
                                                                const parsed = JSON.parse(path);
                                                                if (Array.isArray(parsed)) {
                                                                    displayImages = parsed;
                                                                } else {
                                                                    displayImages = [path];
                                                                }
                                                            } catch (e) {
                                                                displayImages = [path];
                                                            }
                                                        } else {
                                                            displayImages = [path];
                                                        }
                                                    }

                                                    if (displayImages.length > 0) {
                                                        return (
                                                            <div className="flex justify-center gap-1 flex-wrap max-w-[150px] mx-auto">
                                                                {displayImages.map((src, idx) => {
                                                                    const resolvedSrc = getImageUrl(src);
                                                                    return (
                                                                        <img
                                                                            key={idx}
                                                                            src={resolvedSrc}
                                                                            alt={`Proof ${idx + 1}`}
                                                                            className="h-10 w-10 object-cover rounded-lg border border-slate-200 shadow-sm transition-transform hover:scale-150 cursor-zoom-in"
                                                                            title={`Ảnh ${idx + 1}`}
                                                                            onClick={() => {
                                                                                // Resolve all images for lightbox too
                                                                                const resolvedAll = displayImages.map(getImageUrl);
                                                                                setLightbox({ images: resolvedAll, index: idx })
                                                                            }}
                                                                        />
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    } else {
                                                        return <span className="text-xs text-slate-400 italic">Không có</span>;
                                                    }
                                                })()}
                                            </td>

                                            <td className="px-6 py-4 text-center">
                                                {(() => {
                                                    const note = (task as any).data_note || task.note;
                                                    return note ? (
                                                        <span className="text-xs text-slate-600 max-w-[150px] inline-block truncate" title={note}>
                                                            {note}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    );
                                                })()}
                                            </td>

                                            <td className="px-6 py-4 text-center font-medium text-slate-600">
                                                {task.processId && processMap[task.processId] ? (
                                                    <>
                                                        {/* Desktop: Full Badge */}
                                                        <span className="hidden md:inline-block px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-bold border border-purple-100 whitespace-nowrap">
                                                            {processMap[task.processId]}
                                                        </span>

                                                        {/* Mobile: Colored Dot */}
                                                        <div className="md:hidden flex justify-center items-center">
                                                            <div
                                                                className={`w-3.5 h-3.5 rounded-full shadow-sm ${processColorMap[task.processId!] || 'bg-slate-300'}`}
                                                                title={processMap[task.processId]} // Native tooltip fallback
                                                            ></div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Lightbox Modal (Carousel) - Rendered via Portal */}
            {lightbox && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => setLightbox(null)}
                >
                    {/* Close Button */}
                    <button
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50"
                        onClick={() => setLightbox(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Container */}
                    <div className="relative w-full h-full flex items-center justify-center p-4 pointer-events-none" onClick={(e) => e.stopPropagation()}>

                        {/* Prev Button */}
                        {lightbox.images.length > 1 && (
                            <button
                                className="absolute left-2 md:left-8 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all z-40 pointer-events-auto"
                                onClick={handlePrev}
                            >
                                <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
                            </button>
                        )}

                        {/* Main Image Container */}
                        <div className="relative flex items-center justify-center w-full h-full p-4 pointer-events-auto">
                            <img
                                src={lightbox.images[lightbox.index]}
                                alt={`Image ${lightbox.index + 1}`}
                                className="max-w-full max-h-screen md:max-h-[90vh] object-contain rounded shadow-2xl select-none"
                            />

                            {/* Counter / Caption - Overlay at bottom */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/90 text-sm font-medium bg-black/60 px-4 py-1.5 rounded-full backdrop-blur-md shadow-lg border border-white/10">
                                {lightbox.index + 1} / {lightbox.images.length}
                            </div>
                        </div>

                        {/* Next Button */}
                        {lightbox.images.length > 1 && (
                            <button
                                className="absolute right-2 md:right-8 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all z-40 pointer-events-auto"
                                onClick={handleNext}
                            >
                                <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
                            </button>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </GlassCard>
    );
};

export default TaskTable;
