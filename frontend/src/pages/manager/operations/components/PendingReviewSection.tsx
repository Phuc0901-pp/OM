import React, { useState } from 'react';
import { Timer, ChevronRight, Info, MapPin, ClipboardSignature, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { parseSafeDate } from '../../../../utils/timeUtils';
import AvatarGroup from '../../../../components/common/AvatarGroup';
import { TaskRow } from '../types';

interface PendingReviewSectionProps {
    pendingReviewTasks: TaskRow[];
    setSelectedTask: (task: TaskRow) => void;
    stations?: any[];
}

// ─── Waiting Time Badge ────────────────────────────────────────────────────────
const WaitingTimeBadge: React.FC<{ submittedAt: string | null }> = ({ submittedAt }) => {
    if (!submittedAt) return <span className="text-xs text-slate-400">—</span>;
    const d = parseSafeDate(submittedAt);
    if (isNaN(d.getTime())) return <span className="text-xs text-slate-400">—</span>;

    const hoursAgo = (Date.now() - d.getTime()) / 1000 / 3600;
    const urgentColor = hoursAgo >= 24
        ? 'text-rose-600'
        : hoursAgo >= 4
            ? 'text-amber-600'
            : 'text-slate-600';

    const relative = formatDistanceToNow(d, { addSuffix: true, locale: vi });
    const absolute = format(d, 'dd/MM/yyyy HH:mm');

    return (
        <div className="flex flex-col gap-0.5">
            <span className={`flex items-center gap-1.5 text-[12px] font-bold ${urgentColor}`}>
                <Timer className="w-3.5 h-3.5 shrink-0 opacity-70" />
                {relative}
            </span>
            <span className="text-[10px] text-slate-400 font-medium pl-4">{absolute}</span>
        </div>
    );
};

// ─── Row ───────────────────────────────────────────────────────────────────────
const PendingRow: React.FC<{
    task: TaskRow;
    index: number;
    displayStation: string;
    processText: string | null | undefined;
    onClick: () => void;
}> = ({ task, index, displayStation, processText, onClick }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02, duration: 0.22, ease: 'easeOut' }}
            onClick={onClick}
            className="group relative flex items-center gap-4 px-5 py-4 cursor-pointer
                bg-white hover:bg-slate-50/80
                border-b border-slate-100 last:border-b-0
                transition-all duration-200"
        >
            {/* Left urgent accent line */}
            <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-amber-400 opacity-0 group-hover:opacity-100 transition-all duration-200" />

            {/* Cột 1: Dự án */}
            <div className="w-28 shrink-0 hidden md:block">
                <span className="text-[12px] font-bold text-slate-600 leading-snug line-clamp-2">
                    {task.projectName}
                </span>
            </div>

            {/* Cột 2: Hạng mục + Khu vực + Quy trình */}
            <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-bold text-slate-800 truncate leading-snug" title={task.subWorkName || task.workName}>
                    {task.subWorkName || task.workName || '—'}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate text-indigo-600 font-semibold" title={displayStation}>{displayStation}</span>
                    {processText && (
                        <>
                            <span className="text-slate-300">·</span>
                            <span className="truncate text-amber-600/90 font-medium">{processText}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Cột 3: Nhân sự */}
            <div className="w-36 shrink-0 hidden sm:flex items-center">
                <AvatarGroup names={task.userName} maxVisible={3} />
            </div>

            {/* Cột 4: Thời gian chờ */}
            <div className="w-36 shrink-0 hidden lg:block">
                <WaitingTimeBadge submittedAt={task.submittedAt} />
            </div>

            {/* Cột 5: Hành động */}
            <div className="shrink-0">
                <button
                    className="flex items-center gap-1.5 h-8 px-3.5
                        rounded-lg border border-slate-200 bg-white
                        text-[12px] font-semibold text-slate-500
                        group-hover:border-indigo-300 group-hover:text-indigo-600 group-hover:bg-indigo-50
                        transition-all duration-200 shadow-xs"
                >
                    Kiểm tra
                    <ChevronRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform duration-200" />
                </button>
            </div>
        </motion.div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const PendingReviewSection: React.FC<PendingReviewSectionProps> = ({
    pendingReviewTasks,
    setSelectedTask,
    stations,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    if (pendingReviewTasks.length === 0) return null;

    const INITIAL_COUNT = 4;
    const hasMore = pendingReviewTasks.length > INITIAL_COUNT;
    const visibleTasks = isExpanded ? pendingReviewTasks : pendingReviewTasks.slice(0, INITIAL_COUNT);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="rounded-2xl border border-amber-200/70 bg-white overflow-hidden shadow-[0_4px_24px_-6px_rgba(251,191,36,0.2)] shadow-amber-100"
        >
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100/70 bg-gradient-to-r from-amber-50/60 to-white">
                {/* Icon + Title */}
                <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-md shadow-indigo-300/40">
                        <ClipboardSignature className="w-5 h-5 text-white" />
                        {/* Glow ring */}
                        <span className="absolute inset-0 rounded-xl animate-ping bg-indigo-400 opacity-20" />
                    </div>
                    <div>
                        <h2 className="text-[15px] font-extrabold text-slate-800 tracking-tight leading-tight">
                            Cần phê duyệt ngay
                        </h2>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                            Các hạng mục đã nộp đang chờ xác nhận
                        </p>
                    </div>
                </div>

                {/* Badge đếm */}
                <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-amber-200/60 rounded-xl px-3 py-1.5 shadow-sm">
                    {/* Ping dot */}
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                    </span>
                    <span className="text-[13px] font-extrabold text-amber-700">
                        {pendingReviewTasks.length}
                        <span className="font-semibold text-amber-600/70 ml-1">yêu cầu</span>
                    </span>
                </div>
            </div>

            {/* ── Column Header ───────────────────────────────────────────── */}
            <div className="hidden md:flex items-center gap-4 px-5 py-2.5 bg-slate-50/70 border-b border-slate-100
                text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                <div className="w-28 shrink-0">Dự án</div>
                <div className="flex-1">Hạng mục &amp; Khu vực</div>
                <div className="w-36 shrink-0 hidden sm:block">Nhân sự</div>
                <div className="w-36 shrink-0 hidden lg:block">Thời gian chờ</div>
                <div className="shrink-0 w-20 text-right">Hành động</div>
            </div>

            {/* ── Rows ────────────────────────────────────────────────────── */}
            <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[60vh] md:max-h-[400px] overflow-y-auto custom-scrollbar' : ''}`}>
                <AnimatePresence>
                    {visibleTasks.map((task, index) => {
                        // Resolve parent station
                        let displayStation = task.assetName || '—';
                        if (stations) {
                            const assetObj = stations.find(s => s.id === task.assetId);
                            if (assetObj?.parent_id) {
                                const parentObj = stations.find(s => s.id === assetObj.parent_id);
                                if (parentObj) displayStation = `${parentObj.name} – ${task.assetName}`;
                            }
                        }

                        // Pending process list text
                        const pendingProcesses = task.subTasks
                            ? task.subTasks.filter(st => st.statusSubmit === 1 && st.statusApprove === 0 && st.processName)
                            : [];
                        const processText = pendingProcesses.length > 0
                            ? pendingProcesses.map(p => p.processName).join(', ')
                            : task.processName;

                        return (
                            <PendingRow
                                key={task.id}
                                task={task}
                                index={index}
                                displayStation={displayStation}
                                processText={processText}
                                onClick={() => setSelectedTask(task)}
                            />
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* ── Footer summary ──────────────────────────────────────────── */}
            <div className="px-5 py-3 bg-amber-50/40 border-t border-amber-100/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center justify-between w-full sm:w-auto">
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-indigo-400" />
                        Click vào hàng bất kỳ để xem và phê duyệt chi tiết
                    </span>
                    {!hasMore && (
                        <span className="text-[11px] font-bold text-amber-600/70 sm:hidden">
                            {pendingReviewTasks.length} mục đang chờ
                        </span>
                    )}
                </div>

                {hasMore && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-bold text-amber-700 hover:bg-amber-50 hover:text-amber-600 transition-colors shadow-sm"
                    >
                        {isExpanded ? (
                            <>Thu gọn <ChevronUp className="w-3.5 h-3.5" /></>
                        ) : (
                            <>Xem thêm {pendingReviewTasks.length - INITIAL_COUNT} yêu cầu <ChevronDown className="w-3.5 h-3.5" /></>
                        )}
                    </button>
                )}
            </div>
        </motion.div>
    );
};

export default PendingReviewSection;
