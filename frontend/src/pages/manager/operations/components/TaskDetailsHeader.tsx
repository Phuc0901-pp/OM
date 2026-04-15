import React from 'react';
import { X, CheckCircle2, AlertCircle, Clock, MapPin, Grid, Briefcase } from 'lucide-react';
import { TaskRow } from '../types';

interface OrderDetailsHeaderProps {
    task: TaskRow;
    onClose: () => void;
}

const TaskDetailsHeader: React.FC<OrderDetailsHeaderProps> = ({ task, onClose }) => {
    return (
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md z-10 flex-shrink-0 relative overflow-hidden">
            {/* Left Border Marker */}
            <div className={`absolute top-0 left-0 w-1.5 h-full ${
                task.statusApprove === 1 ? 'bg-green-500' :
                (task.statusReject === 1 && task.statusSubmit === 1) ? 'bg-indigo-500' :
                task.statusReject === 1 ? 'bg-red-500' :
                task.statusSubmit === 1 ? 'bg-amber-500' : 'bg-blue-500'
            }`}></div>
            
            <div>
                {/* Breadcrumb Navigation */}
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors cursor-default">
                        <Briefcase className="w-3.5 h-3.5" /> {task.projectName || 'DỰ ÁN'}
                    </span>
                    <span className="text-slate-300">›</span>
                    <span className="hover:text-indigo-500 transition-colors cursor-default">
                        {task.subWorkName}
                    </span>
                </div>

                {/* Main Title: Work & Asset */}
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none flex items-center gap-2">
                        {task.workName} 
                        {task.assetName && (
                            <>
                                <span className="text-slate-300 font-normal">/</span> 
                                <span className="text-indigo-600">{task.assetName}</span>
                            </>
                        )}
                    </h2>

                    {/* Status Badge */}
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border flex items-center gap-1.5 shadow-sm ${
                        task.statusApprove === 1 ? 'bg-green-50 text-green-700 border-green-200' :
                        (task.statusReject === 1 && task.statusSubmit === 1) ? 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse' :
                        task.statusReject === 1 ? 'bg-red-50 text-red-700 border-red-200' :
                        task.statusSubmit === 1 ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                        {task.statusApprove === 1 ? <><CheckCircle2 className="w-3 h-3"/> Đã duyệt</> :
                            (task.statusReject === 1 && task.statusSubmit === 1) ? <><CheckCircle2 className="w-3 h-3"/> Đã nộp lại</> :
                            task.statusReject === 1 ? <><AlertCircle className="w-3 h-3"/> Từ chối</> :
                                task.statusSubmit === 1 ? <><Clock className="w-3 h-3"/> Chờ duyệt</> : 'Đang thực hiện'}
                    </span>
                </div>
            </div>

            <button
                onClick={onClose}
                className="p-2 bg-slate-50 text-slate-400 border border-slate-200 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all shadow-sm"
            >
                <X className="w-5 h-5" />
            </button>
        </div>
    );
};

export default TaskDetailsHeader;
