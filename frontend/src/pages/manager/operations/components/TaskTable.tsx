import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
    Search, ChevronRight, LayoutGrid, Check, X, Loader2,
    CheckCircle2, ChevronDown, Folder, FolderOpen,
    FileText, Layers, Wrench, Minus, ArrowDownAZ
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { parseSafeDate } from '../../../../utils/timeUtils';
import GlassCard from '../../../../components/common/GlassCard';
import { TaskRow } from '../types';
import BulkTaskReportModal from './BulkTaskReportModal';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaskTableProps {
    tasks: TaskRow[];
    selectedAssignId: string | null;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    setSelectedTask: (task: TaskRow) => void;
    stations: any[];
    onBulkUpdateStatus: (ids: string[], status: number, note?: string) => Promise<void>;
    fetchTasks: () => void;
}

interface TreeNode {
    key: string;
    label: string;
    level: number; // 0=workName, 1=subWorkName, 2=assetName, 3=leafTasks
    children: TreeNode[];
    leafTasks: TaskRow[];
    // Stats
    total: number;
    completed: number;
    pendingApprove: number;
    rejected: number;
    // Flat ID lists for cascade selection
    approvableIds: string[];
    approvedIds: string[];
    rejectedIds: string[];
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const getStatusBadge = (statusString?: string) => {
    switch (statusString || '0000') {
        case '0000': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">Chưa làm</span>;
        case '1000': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 whitespace-nowrap">Đang làm</span>;
        case '1100': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 whitespace-nowrap">Chờ duyệt</span>;
        case '1001': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-600 border border-cyan-200 whitespace-nowrap">Nộp lại</span>;
        case '1101': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 whitespace-nowrap">Từ chối</span>;
        case '1110': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 whitespace-nowrap">Đã xong</span>;
        case '1111': return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-200 whitespace-nowrap">Điều chỉnh xong</span>;
        default:     return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-400 border border-gray-200 whitespace-nowrap">Khác</span>;
    }
};

// ─── Mini Indeterminate Checkbox ──────────────────────────────────────────────
interface TriCheckboxProps {
    checked: boolean;
    indeterminate: boolean;
    color: 'indigo' | 'emerald' | 'rose';
    onClick: (e: React.MouseEvent) => void;
    title?: string;
}
const TriCheckbox: React.FC<TriCheckboxProps> = ({ checked, indeterminate, color, onClick, title }) => {
    const ref = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (ref.current) (ref.current as any).indeterminate = indeterminate;
    }, [indeterminate]);

    const colorMap = {
        indigo: { bg: 'bg-indigo-500 border-indigo-500', hover: 'hover:border-indigo-400', dot: 'bg-indigo-500' },
        emerald: { bg: 'bg-emerald-500 border-emerald-500', hover: 'hover:border-emerald-400', dot: 'bg-emerald-500' },
        rose:   { bg: 'bg-rose-500 border-rose-500',   hover: 'hover:border-rose-400',   dot: 'bg-rose-500' },
    };
    const c = colorMap[color];

    return (
        <button
            ref={ref}
            title={title}
            onClick={onClick}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0
                ${checked || indeterminate ? c.bg : `border-slate-400 bg-transparent ${c.hover}`}`}
        >
            {checked && <Check className="w-2.5 h-2.5 text-white" />}
            {!checked && indeterminate && <Minus className="w-2.5 h-2.5 text-white" />}
        </button>
    );
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────
const ProgressBar: React.FC<{ completed: number; total: number; dark?: boolean }> = ({ completed, total, dark }) => {
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return (
        <div className="flex items-center gap-2 shrink-0">
            <div className={`w-20 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/20' : 'bg-slate-200'}`}>
                <motion.div
                    className="h-full rounded-full bg-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
            </div>
            <span className={`w-[28px] text-right text-[11px] font-black tabular-nums ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>{pct}%</span>
        </div>
    );
};

// ─── Level Visual Config ──────────────────────────────────────────────────────
const levelCfg = [
    // L0: Work – dark
    {
        rowClass: 'bg-slate-800 hover:bg-slate-750 border-b border-slate-700',
        labelClass: 'text-white text-[13px] font-black tracking-wide',
        expandIconClass: 'text-slate-400',
        indentPx: 0,
    },
    // L1: SubWork – light gray
    {
        rowClass: 'bg-slate-100 hover:bg-slate-200/70 border-b border-slate-200',
        labelClass: 'text-slate-700 text-[12px] font-bold',
        expandIconClass: 'text-slate-500',
        indentPx: 28,
    },
    // L2: Asset – white
    {
        rowClass: 'bg-white hover:bg-indigo-50/50 border-b border-dashed border-slate-200',
        labelClass: 'text-slate-600 text-[12px] font-semibold',
        expandIconClass: 'text-slate-400',
        indentPx: 52,
    },
];

// ─── Main Component ───────────────────────────────────────────────────────────
const TaskTable: React.FC<TaskTableProps> = ({
    tasks,
    selectedAssignId,
    searchTerm,
    setSearchTerm,
    setSelectedTask,
    stations,
    onBulkUpdateStatus,
    fetchTasks,
}) => {
    // ── State ───────────────────────────────────────────────────────────────
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());           // approvable
    const [reportCheckedIds, setReportCheckedIds] = useState<Set<string>>(new Set()); // approved
    const [rejectCheckedIds, setRejectCheckedIds] = useState<Set<string>>(new Set()); // rejected
    const [showReportModal, setShowReportModal] = useState(false);
    const [showRejectReportModal, setShowRejectReportModal] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [filterValue, setFilterValue] = useState('');
    const [isSortAlpha, setIsSortAlpha] = useState(false);

    // ── Filter options ──────────────────────────────────────────────────────
    const filterOptions = useMemo(() => {
        if (!filterCategory) return [];
        if (filterCategory === 'status') {
            return ['Chưa thực hiện', 'Đang thực hiện', 'Chờ duyệt', 'Từ chối', 'Đã xong'];
        }
        const opts = new Set<string>();
        tasks.forEach(t => {
            if (filterCategory === 'work' && t.subWorkName) opts.add(t.subWorkName);
            if (filterCategory === 'asset') {
                let name = t.assetName || '-';
                const a = stations.find(s => s.id === t.assetId);
                if (a?.parent_id) { const p = stations.find(s => s.id === a.parent_id); if (p) name = `${p.name} - ${name}`; }
                opts.add(name);
            }
        });
        return Array.from(opts).sort();
    }, [filterCategory, tasks, stations]);

    // ── Filtered list ───────────────────────────────────────────────────────
    const filteredTasks = useMemo(() => {
        let list = [...tasks];
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(t =>
                (t.subWorkName || '').toLowerCase().includes(q) ||
                (t.workName || '').toLowerCase().includes(q) ||
                (t.assetName || '').toLowerCase().includes(q) ||
                (t.processName || '').toLowerCase().includes(q)
            );
        }
        if (filterCategory && filterValue) {
            list = list.filter(t => {
                if (filterCategory === 'work') return t.subWorkName === filterValue;
                if (filterCategory === 'asset') {
                    let name = t.assetName || '-';
                    const a = stations.find(s => s.id === t.assetId);
                    if (a?.parent_id) { const p = stations.find(s => s.id === a.parent_id); if (p) name = `${p.name} - ${name}`; }
                    return name === filterValue;
                }
                if (filterCategory === 'status') {
                    if (filterValue === 'Chưa thực hiện') return t.statusString === '0000';
                    if (filterValue === 'Đang thực hiện') return t.statusString === '1000';
                    if (filterValue === 'Chờ duyệt') return t.statusString === '1100' || t.statusString === '1001';
                    if (filterValue === 'Từ chối') return t.statusString === '1101';
                    if (filterValue === 'Đã xong') return t.statusString === '1110' || t.statusString === '1111';
                }
                return true;
            });
        }
        return list;
    }, [tasks, searchTerm, filterCategory, filterValue, stations]);

    // ── Build tree with aggregated ID lists ────────────────────────────────
    const treeData = useMemo<TreeNode[]>(() => {
        const workMap = new Map<string, TreeNode>();

        const makeNode = (key: string, label: string, level: number): TreeNode => ({
            key, label, level, children: [], leafTasks: [],
            total: 0, completed: 0, pendingApprove: 0, rejected: 0,
            approvableIds: [], approvedIds: [], rejectedIds: [],
        });

        const pushIds = (node: TreeNode, task: TaskRow) => {
            const isApprovable = task.statusString === '1100' || task.statusString === '1001';
            const isApproved   = task.statusString === '1110' || task.statusString === '1111';
            const isRejected   = task.statusString === '1101';
            node.total++;
            if (isApproved)   { node.completed++; node.approvedIds.push(task.id); }
            if (isApprovable) { node.pendingApprove++; node.approvableIds.push(task.id); }
            if (isRejected)   { node.rejected++;   node.rejectedIds.push(task.id); }
        };

        filteredTasks.forEach(task => {
            const wKey  = task.workName || 'Khác';
            const swKey = `${wKey}||${task.subWorkName || 'Khác'}`;

            let assetDisplay = task.assetName || '-';
            const a = stations.find(s => s.id === task.assetId);
            if (a?.parent_id) { const p = stations.find(s => s.id === a.parent_id); if (p) assetDisplay = `${p.name} - ${task.assetName}`; }
            const asKey = `${swKey}||${assetDisplay}`;

            const leaves = task.subTasks && task.subTasks.length > 0 ? task.subTasks : [task];

            // L0
            if (!workMap.has(wKey)) workMap.set(wKey, makeNode(wKey, task.workName || 'Khác', 0));
            const wNode = workMap.get(wKey)!;
            pushIds(wNode, task);

            // L1
            let swNode = wNode.children.find(c => c.key === swKey);
            if (!swNode) { swNode = makeNode(swKey, task.subWorkName || 'Khác', 1); wNode.children.push(swNode); }
            pushIds(swNode, task);

            // L2
            let asNode = swNode.children.find(c => c.key === asKey);
            if (!asNode) { asNode = makeNode(asKey, assetDisplay, 2); swNode.children.push(asNode); }
            pushIds(asNode, task);

            // L3 leaves
            leaves.forEach(leaf => {
                asNode!.leafTasks.push(leaf);
                // Also push leaf IDs up
                const isApprovable = leaf.statusString === '1100' || leaf.statusString === '1001';
                const isApproved   = leaf.statusString === '1110' || leaf.statusString === '1111';
                const isRejected   = leaf.statusString === '1101';
                if (leaf.id !== task.id) { // avoid double-counting if task itself is the leaf
                    if (isApprovable) { wNode.approvableIds.push(leaf.id); swNode!.approvableIds.push(leaf.id); asNode!.approvableIds.push(leaf.id); }
                    if (isApproved)   { wNode.approvedIds.push(leaf.id);   swNode!.approvedIds.push(leaf.id);   asNode!.approvedIds.push(leaf.id); }
                    if (isRejected)   { wNode.rejectedIds.push(leaf.id);   swNode!.rejectedIds.push(leaf.id);   asNode!.rejectedIds.push(leaf.id); }
                }
            });
        });

        const finalTree = Array.from(workMap.values());
        
        if (isSortAlpha) {
            const sortNodes = (nodes: TreeNode[]) => {
                nodes.sort((a, b) => a.label.localeCompare(b.label, 'vi-VN', { numeric: true, sensitivity: 'base' }));
                nodes.forEach(n => {
                    if (n.children.length > 0) sortNodes(n.children);
                    if (n.leafTasks.length > 0) {
                        n.leafTasks.sort((a, b) => (a.processName || '').localeCompare(b.processName || '', 'vi-VN', { numeric: true, sensitivity: 'base' }));
                    }
                });
            };
            sortNodes(finalTree);
        }

        return finalTree;
    }, [filteredTasks, stations, isSortAlpha]);

    // ── Toggle expand ───────────────────────────────────────────────────────
    const toggleExpand = useCallback((key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedNodes(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    }, []);

    // ── Smart group checkbox toggle ─────────────────────────────────────────
    // Priority: approvable > approved > rejected
    const toggleGroup = useCallback((node: TreeNode, e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.approvableIds.length > 0) {
            // Operate on checkedIds
            const allIn = node.approvableIds.every(id => checkedIds.has(id));
            setCheckedIds(prev => {
                const n = new Set(prev);
                if (allIn) node.approvableIds.forEach(id => n.delete(id));
                else       node.approvableIds.forEach(id => n.add(id));
                return n;
            });
        } else if (node.approvedIds.length > 0) {
            // Operate on reportCheckedIds
            const allIn = node.approvedIds.every(id => reportCheckedIds.has(id));
            setReportCheckedIds(prev => {
                const n = new Set(prev);
                if (allIn) node.approvedIds.forEach(id => n.delete(id));
                else       node.approvedIds.forEach(id => n.add(id));
                return n;
            });
        } else if (node.rejectedIds.length > 0) {
            const allIn = node.rejectedIds.every(id => rejectCheckedIds.has(id));
            setRejectCheckedIds(prev => {
                const n = new Set(prev);
                if (allIn) node.rejectedIds.forEach(id => n.delete(id));
                else       node.rejectedIds.forEach(id => n.add(id));
                return n;
            });
        }
    }, [checkedIds, reportCheckedIds, rejectCheckedIds]);

    // ── Leaf checkbox toggles ───────────────────────────────────────────────
    const toggleOne = useCallback((id: string) => {
        setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }, []);
    const toggleReportOne = useCallback((id: string) => {
        setReportCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }, []);
    const toggleRejectOne = useCallback((id: string) => {
        setRejectCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }, []);

    // ── Derive checkbox state for a node ───────────────────────────────────
    const getGroupCheckState = useCallback((node: TreeNode): {
        show: boolean; color: 'indigo' | 'emerald' | 'rose'; checked: boolean; indeterminate: boolean;
    } => {
        if (node.approvableIds.length > 0) {
            const cnt = node.approvableIds.filter(id => checkedIds.has(id)).length;
            return { show: true, color: 'indigo', checked: cnt === node.approvableIds.length, indeterminate: cnt > 0 && cnt < node.approvableIds.length };
        }
        if (node.approvedIds.length > 0) {
            const cnt = node.approvedIds.filter(id => reportCheckedIds.has(id)).length;
            return { show: true, color: 'emerald', checked: cnt === node.approvedIds.length, indeterminate: cnt > 0 && cnt < node.approvedIds.length };
        }
        if (node.rejectedIds.length > 0) {
            const cnt = node.rejectedIds.filter(id => rejectCheckedIds.has(id)).length;
            return { show: true, color: 'rose', checked: cnt === node.rejectedIds.length, indeterminate: cnt > 0 && cnt < node.rejectedIds.length };
        }
        return { show: false, color: 'indigo', checked: false, indeterminate: false };
    }, [checkedIds, reportCheckedIds, rejectCheckedIds]);

    // ── Bulk action helpers ─────────────────────────────────────────────────
    const expandedPendingIds = useMemo(() => {
        const ids: string[] = [];
        tasks.forEach(t => {
            if (checkedIds.has(t.id)) {
                const leaves = t.subTasks && t.subTasks.length > 0 ? t.subTasks : [t];
                leaves.forEach(l => { if (l.statusString === '1100' || l.statusString === '1001') ids.push(l.id); });
            }
        });
        return ids;
    }, [tasks, checkedIds]);

    const approvedTasks  = useMemo(() => tasks.filter(t => t.statusString === '1110' || t.statusString === '1111'), [tasks]);
    const rejectedTasks  = useMemo(() => tasks.filter(t => t.statusString === '1101'), [tasks]);
    const isAllApprovedSelected = approvedTasks.length > 0 && approvedTasks.every(t => reportCheckedIds.has(t.id));
    const isAllRejectSelected   = rejectedTasks.length > 0 && rejectedTasks.every(t => rejectCheckedIds.has(t.id));

    const handleBulkApprove = async () => {
        if (expandedPendingIds.length === 0) return;
        setBulkLoading(true);
        try { await onBulkUpdateStatus(expandedPendingIds, 1, 'Đã phê duyệt'); setCheckedIds(new Set()); fetchTasks(); }
        finally { setBulkLoading(false); }
    };
    const handleBulkReject = async () => {
        if (expandedPendingIds.length === 0) return;
        const reason = prompt(`Nhập lý do từ chối cho ${expandedPendingIds.length} quy trình:`);
        if (reason === null) return;
        setBulkLoading(true);
        try { await onBulkUpdateStatus(expandedPendingIds, -1, reason || 'Từ chối hàng loạt'); setCheckedIds(new Set()); fetchTasks(); }
        finally { setBulkLoading(false); }
    };

    // ── Render leaf (Process row) ───────────────────────────────────────────
    const renderLeafRow = (task: TaskRow) => {
        const isApprovable = task.statusString === '1100' || task.statusString === '1001';
        const isApproved   = task.statusString === '1110' || task.statusString === '1111';
        const isRejected   = task.statusString === '1101';
        const isChecked        = checkedIds.has(task.id);
        const isReportChecked  = reportCheckedIds.has(task.id);
        const isRejectChecked  = rejectCheckedIds.has(task.id);

        let accent = 'border-l-slate-200';
        if (isApproved)   accent = 'border-l-emerald-400';
        if (isApprovable) accent = 'border-l-indigo-400';
        if (isRejected)   accent = 'border-l-rose-400';

        let rowBg = 'bg-white hover:bg-slate-50';
        if (isChecked)       rowBg = 'bg-indigo-50/70 hover:bg-indigo-50';
        if (isReportChecked) rowBg = 'bg-emerald-50/70 hover:bg-emerald-50';
        if (isRejectChecked) rowBg = 'bg-rose-50/70 hover:bg-rose-50';

        return (
            <motion.div
                key={task.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setSelectedTask(task)}
                className={`flex flex-row items-center w-full py-2.5 border-b border-slate-100 border-l-2 ${accent} ${rowBg} cursor-pointer transition-colors duration-150 group`}
                style={{ paddingLeft: '80px' }}
            >
                {/* Guide line dot */}
                <div className="flex items-center gap-1 mr-2 shrink-0">
                    <div className="w-5 h-px bg-slate-200" />
                    <div className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                </div>

                {/* Leaf Checkbox */}
                <div
                    className="w-[32px] shrink-0 flex justify-center"
                    onClick={e => {
                        e.stopPropagation();
                        if (isApprovable) toggleOne(task.id);
                        else if (isApproved) toggleReportOne(task.id);
                        else if (isRejected) toggleRejectOne(task.id);
                    }}
                >
                    {isApprovable ? (
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 hover:border-indigo-400 bg-white'}`}>
                            {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                    ) : isApproved ? (
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isReportChecked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200 hover:border-emerald-400 bg-white'}`}>
                            {isReportChecked && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                    ) : isRejected ? (
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isRejectChecked ? 'bg-rose-500 border-rose-500' : 'border-slate-200 hover:border-rose-400 bg-white'}`}>
                            {isRejectChecked && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                    ) : <div className="w-4 h-4" />}
                </div>

                {/* Process name */}
                <div className="flex-1 min-w-0 flex items-center gap-2 pr-2">
                    <Wrench className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-[12px] font-semibold text-slate-700 truncate">{task.processName || 'Quy trình'}</span>
                </div>

                {/* Time col */}
                <div className="hidden lg:flex w-[160px] shrink-0 flex-col text-[11px] text-slate-400 font-medium px-2">
                    {task.submittedAt && !isNaN(parseSafeDate(task.submittedAt).getTime()) && (
                        <span>Nộp: {format(parseSafeDate(task.submittedAt), 'dd/MM HH:mm')}</span>
                    )}
                    {task.approvalAt && !isNaN(parseSafeDate(task.approvalAt).getTime()) ? (
                        <span className="text-emerald-500">Duyệt: {format(parseSafeDate(task.approvalAt), 'dd/MM HH:mm')}</span>
                    ) : task.rejectedAt && !isNaN(parseSafeDate(task.rejectedAt).getTime()) ? (
                        <span className="text-rose-400">Từ chối: {format(parseSafeDate(task.rejectedAt), 'dd/MM HH:mm')}</span>
                    ) : null}
                </div>

                {/* Status */}
                <div className="w-[110px] shrink-0 flex justify-center">
                    {getStatusBadge(task.statusString)}
                </div>

                {/* Action */}
                <div className="w-[64px] shrink-0 flex justify-end items-center gap-1 pr-2">
                    {isApprovable && (
                        <button
                            onClick={async e => {
                                e.stopPropagation();
                                const ids = task.subTasks && task.subTasks.length > 0
                                    ? task.subTasks.filter(st => st.statusString === '1100' || st.statusString === '1001').map(st => st.id)
                                    : [task.id];
                                if (ids.length > 0) { await onBulkUpdateStatus(ids, 1, 'Quick Approved'); fetchTasks(); }
                            }}
                            className="p-1 text-emerald-400 hover:text-white hover:bg-emerald-500 rounded-md transition-all opacity-0 group-hover:opacity-100"
                            title="Duyệt nhanh"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button className="p-1 text-slate-300 group-hover:text-indigo-400 rounded-md transition-all" title="Xem chi tiết">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        );
    };

    // ── Render tree node recursively ────────────────────────────────────────
    const renderNode = (node: TreeNode): React.ReactNode => {
        const isExpanded = expandedNodes.has(node.key);
        const cfg = levelCfg[node.level] ?? levelCfg[2];
        const hasChildren = node.children.length > 0 || node.leafTasks.length > 0;
        const checkState = getGroupCheckState(node);

        return (
            <div key={node.key} className="w-full">
                {/* ── Node Header Row ── */}
                <div
                    onClick={(e) => hasChildren && toggleExpand(node.key, e)}
                    className={`flex flex-row items-center w-full py-2.5 transition-colors duration-150 ${hasChildren ? 'cursor-pointer' : 'cursor-default'} ${cfg.rowClass}`}
                    style={{ paddingLeft: `${cfg.indentPx + 12}px` }}
                >
                    {/* Expand chevron */}
                    <div className="w-[28px] shrink-0 flex items-center justify-center">
                        {hasChildren ? (
                            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.18 }}>
                                <ChevronRight className={`w-4 h-4 ${cfg.expandIconClass}`} />
                            </motion.div>
                        ) : <div className="w-4" />}
                    </div>

                    {/* Smart Master Checkbox */}
                    <div className="w-[32px] shrink-0 flex justify-center">
                        {checkState.show ? (
                            <TriCheckbox
                                checked={checkState.checked}
                                indeterminate={checkState.indeterminate}
                                color={checkState.color}
                                onClick={(e) => toggleGroup(node, e)}
                                title={
                                    checkState.color === 'indigo' ? 'Chọn tất cả để duyệt' :
                                    checkState.color === 'emerald' ? 'Chọn tất cả để tạo báo cáo' :
                                    'Chọn tất cả từ chối'
                                }
                            />
                        ) : <div className="w-4 h-4" />}
                    </div>

                    {/* Icon */}
                    <div className="mr-2 shrink-0">
                        {node.level === 0 && <Layers className="w-4 h-4 text-slate-400" />}
                        {node.level === 1 && <Wrench className="w-3.5 h-3.5 text-slate-400" />}
                        {node.level === 2 && (isExpanded
                            ? <FolderOpen className="w-4 h-4 text-indigo-400" />
                            : <Folder className="w-4 h-4 text-indigo-400" />
                        )}
                    </div>

                    {/* Label and Status Pills */}
                    <div className="flex-1 min-w-0 flex items-center gap-3 pr-2">
                        <span className={`truncate ${cfg.labelClass}`}>
                            {node.label}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                            {node.pendingApprove > 0 && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap
                                    ${node.level === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                    {node.pendingApprove} chờ
                                </span>
                            )}
                            {node.rejected > 0 && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap
                                    ${node.level === 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                                    {node.rejected} từ chối
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Stats area (Progress and count) */}
                    <div className="flex items-center gap-3 pr-4 shrink-0 w-[160px] justify-end">
                        <ProgressBar completed={node.completed} total={node.total} dark={node.level === 0} />
                        <span className={`w-[44px] text-center px-1.5 py-0.5 rounded text-[11px] font-black tabular-nums
                            ${node.level === 0 ? 'bg-white/10 text-white border border-white/20' : 'bg-slate-200 text-slate-600 border border-slate-300'}`}>
                            {node.completed}/{node.total}
                        </span>
                    </div>
                </div>

                {/* ── Children (animated collapse) ── */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="overflow-hidden"
                        >
                            {node.children.map(child => renderNode(child))}
                            {node.leafTasks.map(task => renderLeafRow(task))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <GlassCard className="lg:col-span-9 !p-0 flex flex-col h-full overflow-hidden min-h-[600px] relative border-slate-200/60 shadow-xl shadow-slate-200/40">
            <AnimatePresence mode="wait">
                {selectedAssignId ? (
                    <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">

                        {/* ── Toolbar ── */}
                        <div className="px-5 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/60 backdrop-blur-md sticky top-0 z-20">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-1 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-full shrink-0" />
                                <div className="min-w-0">
                                    <h2 className="text-[16px] font-extrabold text-slate-800 truncate">
                                        {tasks.length > 0 ? tasks[0].projectName : 'Chi tiết phân bổ'}
                                    </h2>
                                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mt-0.5">
                                        <Layers className="w-3 h-3 text-indigo-400" />
                                        {treeData.length} hạng mục chính &middot; {filteredTasks.length} công việc
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Filter cascade */}
                                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                                    <div className="relative">
                                        <select
                                            className="appearance-none bg-white border border-slate-200 text-slate-600 text-[11px] font-bold rounded-lg pl-3 pr-7 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm"
                                            value={filterCategory || ''}
                                            onChange={e => { setFilterCategory(e.target.value || null); setFilterValue(''); }}
                                        >
                                            <option value="">Lọc theo...</option>
                                            <option value="work">Công việc</option>
                                            <option value="asset">Khu vực</option>
                                            <option value="status">Trạng thái</option>
                                        </select>
                                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                    <div className="relative">
                                        <select
                                            className={`appearance-none bg-white border border-slate-200 text-indigo-700 text-[11px] font-bold rounded-lg pl-3 pr-7 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm ${!filterCategory ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            value={filterValue}
                                            onChange={e => setFilterValue(e.target.value)}
                                            disabled={!filterCategory}
                                        >
                                            <option value="">Giá trị...</option>
                                            {filterOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                        <ChevronDown className={`w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${!filterCategory ? 'text-slate-300' : 'text-indigo-400'}`} />
                                    </div>
                                </div>

                                {/* Sort AZ */}
                                <button
                                    onClick={() => setIsSortAlpha(!isSortAlpha)}
                                    className={`relative flex items-center justify-center p-2 rounded-lg border transition-colors ${isSortAlpha ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm'}`}
                                    title="Sắp xếp A-Z"
                                >
                                    <ArrowDownAZ className="w-4 h-4" />
                                </button>

                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 text-[12px] font-semibold placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm w-[180px] transition-all"
                                    />
                                </div>
                            </div>
                        </div>



                        {/* ── Tree ── */}
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <div className="flex flex-col w-full pb-20 min-w-[600px]">
                                {treeData.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                                        <Search className="w-10 h-10 mb-3 opacity-30" />
                                        <p className="font-semibold text-sm">Không tìm thấy kết quả</p>
                                    </div>
                                ) : (
                                    treeData.map(node => renderNode(node))
                                )}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center text-slate-400 relative">
                        <div className="absolute inset-0 bg-slate-50/50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
                        <div className="relative z-10 bg-white p-6 rounded-full shadow-xl shadow-slate-200 mb-6 border border-slate-100">
                            <div className="bg-slate-50 p-4 rounded-full">
                                <LayoutGrid className="w-10 h-10 text-slate-300" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-slate-600 relative z-10">Chọn dự án để bắt đầu quản lý</p>
                        <p className="text-sm text-slate-400 mt-2 relative z-10">Dữ liệu vận hành sẽ được hiển thị chi tiết tại đây</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Floating Bulk Action Bars ── */}
            {ReactDOM.createPortal(
                <AnimatePresence>
                    {checkedIds.size > 0 && (
                        <motion.div key="approve-bar"
                            initial={{ y: 100, opacity: 0, scale: 0.92 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 100, opacity: 0, scale: 0.92 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-2 py-2 rounded-full backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.6)]"
                            style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.95) 100%)' }}
                        >
                            <div className="flex items-center gap-2 pl-3 pr-4 border-r border-white/10">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-500/40 text-white">{checkedIds.size}</div>
                                <span className="text-sm font-semibold text-slate-300 whitespace-nowrap">hạng mục &middot; <span className="text-indigo-300">{expandedPendingIds.length} quy trình</span></span>
                            </div>
                            <button onClick={handleBulkApprove} disabled={bulkLoading} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 rounded-full text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all">
                                {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Duyệt tất cả
                            </button>
                            <button onClick={handleBulkReject} disabled={bulkLoading} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-400 hover:from-rose-400 hover:to-rose-300 disabled:opacity-50 rounded-full text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition-all">
                                <X className="w-4 h-4" /> Từ chối
                            </button>
                            <button onClick={() => setCheckedIds(new Set())} className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                        </motion.div>
                    )}

                    {reportCheckedIds.size > 0 && checkedIds.size === 0 && (
                        <motion.div key="report-bar"
                            initial={{ y: 100, opacity: 0, scale: 0.92 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 100, opacity: 0, scale: 0.92 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-2 py-2 rounded-full backdrop-blur-xl border border-emerald-400/20 shadow-[0_8px_40px_-8px_rgba(16,185,129,0.4)]"
                            style={{ background: 'linear-gradient(135deg, rgba(6,78,59,0.97) 0%, rgba(5,46,37,0.97) 100%)' }}
                        >
                            <div className="flex items-center gap-2 pl-3 pr-4 border-r border-emerald-400/20">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xs font-black shadow-lg text-white">{reportCheckedIds.size}</div>
                                <span className="text-sm font-semibold text-emerald-200 whitespace-nowrap">hạng mục đã duyệt</span>
                            </div>
                            <button onClick={() => setShowReportModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 rounded-full text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all">
                                <FileText className="w-4 h-4" /> Tạo Báo Cáo Nghiệm thu
                            </button>
                            <button onClick={() => setReportCheckedIds(new Set())} className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors text-emerald-300 hover:text-white"><X className="w-4 h-4" /></button>
                        </motion.div>
                    )}

                    {rejectCheckedIds.size > 0 && checkedIds.size === 0 && reportCheckedIds.size === 0 && (
                        <motion.div key="reject-report-bar"
                            initial={{ y: 100, opacity: 0, scale: 0.92 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 100, opacity: 0, scale: 0.92 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-2 py-2 rounded-full backdrop-blur-xl border border-rose-400/20 shadow-[0_8px_40px_-8px_rgba(244,63,94,0.35)]"
                            style={{ background: 'linear-gradient(135deg, rgba(76,5,25,0.97) 0%, rgba(136,19,55,0.97) 100%)' }}
                        >
                            <div className="flex items-center gap-2 pl-3 pr-4 border-r border-rose-400/20">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-xs font-black shadow-lg text-white">{rejectCheckedIds.size}</div>
                                <span className="text-sm font-semibold text-rose-200 whitespace-nowrap">hạng mục bị từ chối</span>
                            </div>
                            <button onClick={() => setShowRejectReportModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-orange-400 hover:from-rose-400 rounded-full text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition-all">
                                <FileText className="w-4 h-4" /> Tạo Báo Cáo Sửa Chữa
                            </button>
                            <button onClick={() => setRejectCheckedIds(new Set())} className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors text-rose-300 hover:text-white"><X className="w-4 h-4" /></button>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Modals */}
            {showReportModal && (
                <BulkTaskReportModal tasks={tasks.filter(t => reportCheckedIds.has(t.id))} assignId={tasks[0]?.assignId || ''} projectName={tasks[0]?.projectName || ''} isAllSelected={isAllApprovedSelected} onClose={() => setShowReportModal(false)} />
            )}
            {showRejectReportModal && (
                <BulkTaskReportModal tasks={tasks.filter(t => rejectCheckedIds.has(t.id))} assignId={tasks[0]?.assignId || ''} projectName={tasks[0]?.projectName || ''} isAllSelected={isAllRejectSelected} type="reject" onClose={() => setShowRejectReportModal(false)} />
            )}
        </GlassCard>
    );
};

export default TaskTable;
