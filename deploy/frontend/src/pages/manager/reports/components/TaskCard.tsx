import React, { memo } from 'react';
import { CompletedTask } from '../../../../types/reports';
import { MapPin, FileText } from 'lucide-react';

interface TaskCardProps {
    task: CompletedTask;
    index: number;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, index }) => {
    // Get API base URL for proper image resolution (especially for tunnel access)
    const apiUrl = import.meta.env.VITE_API_URL || '';

    // Helper to resolve image URLs
    const getImageUrl = (img: string): string => {
        if (!img) return '';
        if (img.startsWith('http://') || img.startsWith('https://')) return img;

        const baseUrl = apiUrl.replace(/\/api$/, '');

        if (img.startsWith('/api')) {
            return baseUrl ? `${baseUrl}${img}` : img;
        }

        // Handle legacy URLs missing /api prefix
        if (img.startsWith('/media/')) {
            return baseUrl ? `${baseUrl}/api${img}` : `/api${img}`;
        }

        // Handle malformed relative URLs (e.g. proxy?key=...)
        if (img.startsWith('proxy?key=')) {
            return baseUrl ? `${baseUrl}/api/media/${img}` : `/api/media/${img}`;
        }

        if (img.startsWith('/')) {
            return baseUrl ? `${baseUrl}${img}` : img;
        }
        return img;
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden break-inside-avoid shadow-sm hover:shadow-md transition-shadow">
            {/* Task Header */}
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="font-semibold text-gray-900">
                        {task.station_name || `Item ${index + 1}`}
                    </span>
                    {task.inverter_name && (
                        <>
                            <span className="text-gray-300">|</span>
                            <span className="text-gray-600 text-sm">{task.inverter_name}</span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{new Date(task.completed_at).toLocaleDateString('vi-VN')}</span>
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold uppercase border border-green-200">
                        Đã duyệt
                    </span>
                </div>
            </div>

            {/* Images Section */}
            <div className="p-5">
                <div className="flex gap-6">
                    {/* Before Column */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="flex items-center justify-center w-5 h-5 bg-orange-100 text-orange-600 rounded-full text-xs font-bold">1</span>
                            <h4 className="text-sm font-semibold text-gray-700 uppercase">Trước khi thực hiện</h4>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {task.evidence?.before?.length > 0 ? (
                                task.evidence.before.map((img, i) => (
                                    <div key={i} className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                                        <img
                                            src={getImageUrl(img)}
                                            alt={`Before ${i}`}
                                            crossOrigin="anonymous"
                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-2 text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    <span className="text-xs text-gray-400 italic">Không có ảnh</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px bg-gray-100 my-2"></div>

                    {/* After Column */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="flex items-center justify-center w-5 h-5 bg-green-100 text-green-600 rounded-full text-xs font-bold">2</span>
                            <h4 className="text-sm font-semibold text-gray-700 uppercase">Sau khi thực hiện</h4>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {task.evidence?.after?.length > 0 ? (
                                task.evidence.after.map((img, i) => (
                                    <div key={i} className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                                        <img
                                            src={getImageUrl(img)}
                                            alt={`After ${i}`}
                                            crossOrigin="anonymous"
                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                ))
                            ) : (
                                // Fallback to image_path if evidence is empty (Legacy support)
                                task.image_path ? (
                                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
                                        <img
                                            src={getImageUrl(task.image_path)}
                                            alt="Evidence"
                                            crossOrigin="anonymous"
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                ) : (
                                    <div className="col-span-2 text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                        <span className="text-xs text-gray-400 italic">Không có ảnh</span>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Note */}
                {task.note && (
                    <div className="mt-4 pt-3 border-t border-gray-100 text-sm text-gray-600 flex items-start gap-2">
                        <FileText className="w-4 h-4 mt-0.5 text-gray-400" />
                        <p className="italic">{task.note}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Memoize to prevent re-renders if Props match
export default memo(TaskCard);
