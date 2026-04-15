import React from 'react';
import { MapPin, CheckCircle, XCircle, Clock, FileText, User as UserIcon, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { parseSafeDate } from '../../utils/timeUtils';
import { getImageUrl } from '../../utils/imageUtils';

// Define Interface matching FilteredTaskContainer's expectation
// We can also import it if we centralized it, but for now we keep it standalone or compatible.
interface TaskDetail {
    id: string;
    station_id?: string;
    station?: { id: string; name: string };
    // Old shape: child_category
    child_category?: {
        name: string;
        main_category?: { name: string };
    };
    station_name?: string;
    process?: { name: string };
    processName?: string;
    process_name?: string;
    status?: string;
    check?: number;
    accept?: number;
    image_url?: string;
    image_path?: string;
    note?: string;
    note_data?: string;   // DetailAssign note field
    description?: string;
    created_at?: string;
    updated_at?: string;
    submitted_at?: any;   // DetailAssign: JSON array of dates
    approval_at?: any;
    rejected_at?: any;
    // Status flags (DetailAssign shape)
    status_submit?: number;
    status_approve?: number;
    status_reject?: number;
    // DetailAssign: config with sub_work / asset
    config?: {
        sub_work?: { name: string; work?: { name: string } };
        asset?: { name: string };
    };
    // Image data: DetailAssign stores as array in 'data' field
    data?: string[] | string;
    // Categorized Images (legacy)
    beforeImages?: string[];
    afterImages?: string[];
    generalImages?: string[];
    data_result?: any;
    assigned_user_names?: string;
    [key: string]: any;
}

interface TaskGroupContainerProps {
    tasks: TaskDetail[];
    onImageClick: (src: string, alt: string) => void;
}

const TaskGroupContainer: React.FC<TaskGroupContainerProps> = ({ tasks, onImageClick }) => {

    // Helper to sort tasks by process order
    const sortTasks = (tasks: TaskDetail[]) => {
        const orderMap: { [key: string]: number } = {
            'trước khi làm': 1,
            'trong khi làm': 2,
            'sau khi làm': 3
        };

        return [...tasks].sort((a, b) => {
            const pA = (a.process?.name || a.processName || a.process_name || '').toLowerCase().trim();
            const pB = (b.process?.name || b.processName || b.process_name || '').toLowerCase().trim();

            const orderA = orderMap[pA] || 99;
            const orderB = orderMap[pB] || 99;

            if (orderA !== orderB) return orderA - orderB;

            // Secondary sort by creation time
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA; // Newest first
        });
    };

    // Group tasks by Station for better organization
    const groupedTasks = React.useMemo(() => {
        const groups: { [key: string]: TaskDetail[] } = {};

        // Sort tasks first
        const sortedTasks = sortTasks(tasks);

        sortedTasks.forEach(task => {
            const stationName = task.station?.name || task.station_name || task.config?.asset?.name || 'Khác';
            if (!groups[stationName]) {
                groups[stationName] = [];
            }
            groups[stationName].push(task);
        });
        return groups;
    }, [tasks]);

    if (tasks.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 italic">
                Không có công việc nào.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {Object.entries(groupedTasks).map(([stationName, stationTasks]) => (
                <div key={stationName} className="space-y-3">
                    {/* Station Header */}
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <MapPin className="w-4 h-4 text-indigo-500" />
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                            {stationName}
                        </h4>
                        <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
                            {stationTasks.length}
                        </span>
                    </div>

                    {/* Task List */}
                    <div className="grid gap-4">
                        {stationTasks.map(task => (
                            <TaskItem key={task.id} task={task} onImageClick={onImageClick} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// Sub-component for individual task
const TaskItem: React.FC<{ task: TaskDetail; onImageClick: (src: string, alt: string) => void }> = ({ task, onImageClick }) => {

    // Parse Images & Categorize
    const { beforeImgs, afterImgs, duringImgs, allImages } = React.useMemo(() => {
        let b: string[] = task.beforeImages || [];
        let a: string[] = task.afterImages || [];
        let d: string[] = task.generalImages || [];

        // DetailAssign shape: images stored in task.data (array of URLs)
        if (task.data && d.length === 0 && b.length === 0) {
            const rawData = task.data;
            if (Array.isArray(rawData)) {
                d = [...d, ...rawData.filter((x: any) => typeof x === 'string')];
            } else if (typeof rawData === 'string') {
                try {
                    const parsed = JSON.parse(rawData);
                    if (Array.isArray(parsed)) d = [...d, ...parsed];
                } catch { /* ignore */ }
            }
        }

        // Try to parse data_result if fields are empty
        if (task.data_result) {
            try {
                const dr = typeof task.data_result === 'string' ? JSON.parse(task.data_result) : task.data_result;
                if (dr?.before?.images && Array.isArray(dr.before.images)) b = [...b, ...dr.before.images];
                if (dr?.after?.images && Array.isArray(dr.after.images)) a = [...a, ...dr.after.images];
                if (dr?.images && Array.isArray(dr.images)) d = [...d, ...dr.images];
            } catch { /* ignore */ }
        }

        // Fallback: image_url / image_path
        if (b.length === 0 && a.length === 0 && d.length === 0) {
            if (task.image_path) d.push(task.image_path);
            if (task.image_url) {
                try {
                    const parsed = JSON.parse(task.image_url);
                    if (Array.isArray(parsed)) d.push(...parsed);
                    else if (typeof parsed === 'string') d.push(parsed);
                } catch { /* ignore */ }
            }
        }

        // Filter valid strings and distinct
        const clean = (arr: any[]) => [...new Set(arr.filter(i => typeof i === 'string' && i))];

        const bClean = clean(b);
        const aClean = clean(a);
        const dClean = clean(d);

        return {
            beforeImgs: bClean,
            afterImgs: aClean,
            duringImgs: dClean,
            allImages: [...bClean, ...dClean, ...aClean]
        };
    }, [task]);

    // Determine status color/icon — handles both old shape and DetailAssign status flags
    const getStatusInfo = () => {
        const isApproved = task.accept === 1 || task.status_approve === 1;
        const isRejected = task.status === 'rejected' || !!task.reject_at || task.status_reject === 1;
        // submitted_at on DetailAssign is JSON array — check both
        const hasSubmitted = task.status === 'submitted' || task.status_submit === 1
            || (task.submitted_at && (Array.isArray(task.submitted_at) ? task.submitted_at.length > 0 : !!task.submitted_at));
        if (isApproved) return { color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100', icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Đã duyệt' };
        if (isRejected) return { color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-100', icon: <XCircle className="w-3.5 h-3.5" />, label: 'Từ chối' };
        if (hasSubmitted) return { color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-100', icon: <Clock className="w-3.5 h-3.5" />, label: 'Đang chờ duyệt' };
        return { color: 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-100', icon: <Clock className="w-3.5 h-3.5" />, label: 'Chưa thực hiện' };
    };

    const statusInfo = getStatusInfo();
    // Support both old shape (child_category) and new DetailAssign shape (config.sub_work / config.asset)
    const taskName = task.child_category?.name
        || task.config?.sub_work?.name
        || task.config?.asset?.name
        || 'Công việc không tên';
    const mainCategory = task.child_category?.main_category?.name
        || task.config?.sub_work?.work?.name
        || task.config?.asset?.name;
    const processName = task.process?.name || task.processName || task.process_name;

    // Determine Process Color
    const getProcessColor = (name: string) => {
        const lower = name.toLowerCase().trim();
        if (lower === 'trước khi làm') return 'text-orange-500';
        if (lower === 'trong khi làm') return 'text-blue-500';
        if (lower === 'sau khi làm') return 'text-emerald-500';
        return 'text-indigo-500';
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-2">
                    {/* Category Label */}
                    <div className="flex items-center gap-2">
                        {mainCategory && (
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                {mainCategory}
                            </div>
                        )}
                        {processName && (
                            <div className={`text - [10px] uppercase font - bold tracking - wider ${getProcessColor(processName)} `}>
                                • {processName}
                            </div>
                        )}
                    </div>

                    {/* Task Name */}
                    <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                        {taskName}
                    </h5>

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-2 pt-1 items-center">
                        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${statusInfo.color}`}>
                            {statusInfo.icon}
                            {statusInfo.label}
                        </span>
                        {task.updated_at && (
                            <span className="flex items-center gap-1 text-xs text-slate-400 px-2 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-100 dark:border-slate-800">
                                <Clock className="w-3.5 h-3.5" />
                                {format(parseSafeDate(task.updated_at), "dd/MM/yyyy HH:mm", { locale: vi })}
                            </span>
                        )}
                        {task.assigned_user_names && (
                            <span className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 px-2 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-100 dark:border-slate-800">
                                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                                {task.assigned_user_names}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Note/Description — also handle note_data from DetailAssign */}
            {(task.note || task.description || task.note_data) && (
                <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg flex gap-2 items-start">
                    <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <p className="line-clamp-3">{task.note || task.note_data || task.description}</p>
                </div>
            )}

            {/* Images List */}
            {allImages.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                        {allImages.map((img, idx) => (
                            <div
                                key={idx}
                                className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer group"
                                onClick={() => onImageClick(getImageUrl(img), `Ảnh minh chứng ${idx + 1} `)}
                            >
                                <img
                                    src={getImageUrl(img)}
                                    alt={`Task proof ${idx} `}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskGroupContainer;
