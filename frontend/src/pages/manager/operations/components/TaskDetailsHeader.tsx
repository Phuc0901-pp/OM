import React from 'react';
import { X, List, MapPin, Zap } from 'lucide-react';
import { TaskRow } from '../types';

interface OrderDetailsHeaderProps {
    task: TaskRow;
    onClose: () => void;
}

const TaskDetailsHeader: React.FC<OrderDetailsHeaderProps> = ({ task, onClose }) => {
    return (
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md z-10 flex-shrink-0">
            <div>
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{task.categoryName}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${task.accept === 1 ? 'bg-green-50 text-green-700 border-green-200' :
                        task.accept === -1 ? 'bg-red-50 text-red-700 border-red-200' :
                            task.check === 3 ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                        {task.accept === 1 ? 'Đã duyệt' :
                            task.accept === -1 ? 'Đã từ chối' :
                                task.check === 3 ? 'Chờ duyệt' : 'Đang thực hiện'}
                    </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5"><List className="w-4 h-4 text-indigo-500" /> {task.mainCategoryName}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    {task.stationName && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-emerald-500" /> {task.stationName}</span>}
                    {task.inverterName && <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> {task.inverterName}</span>}
                </div>
            </div>
            <button
                onClick={onClose}
                className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
            >
                <X className="w-6 h-6" />
            </button>
        </div>
    );
};

export default TaskDetailsHeader;
