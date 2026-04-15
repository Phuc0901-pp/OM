import React, { useState, useMemo } from 'react';
import { List, Calendar, User, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Settings2, X, CalendarRange } from 'lucide-react';
import GlassCard from '../../../../components/common/GlassCard';
import type { Assign, DetailAssign } from '../../../../types/models';
import { determineDetailStatus, STATUS_BADGES } from '../../../../utils/statusUtils';

interface TaskTableProps {
    assigns: Assign[];
    selectedProject: string;
    loading: boolean;
    usersMap?: Record<string, string>;
}

interface TaskRow {
    id: string;
    assignId: string;
    workName: string;
    assetName: string;
    projectName: string;
    templateName: string;
    status: 'approved' | 'rejected' | 'resubmitted' | 'submitted' | 'pending';
    submittedAt?: string | null;
    approvedAt?: string | null;
    actorId?: string | null;
}

const getLatestDate = (field: any): string | null => {
    if (!field) return null;
    let arr: any[] = [];
    if (Array.isArray(field)) {
        arr = field;
    } else if (typeof field === 'string') {
        if (field.startsWith('[')) {
            try { arr = JSON.parse(field); } catch { return null; }
        } else {
            const d = new Date(field);
            return isNaN(d.getTime()) ? null : field;
        }
    }
    const valid = arr.filter((s: any) => typeof s === 'string' && !isNaN(new Date(s).getTime()));
    return valid.length > 0 ? valid[valid.length - 1] : null;
};

type SortConfig = {
    key: keyof TaskRow | '';
    direction: 'asc' | 'desc';
};

const STATUS_FILTERS = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'approved', label: 'Đã phê duyệt' },
    { value: 'submitted', label: 'Đã nộp/Chờ duyệt' },
    { value: 'rejected', label: 'Yêu cầu sửa' },
    { value: 'pending', label: 'Chưa làm' },
];

const TaskTable: React.FC<TaskTableProps> = ({ assigns, loading, usersMap = {} }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: 'asc' });

    // Advanced Filters State
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [projectFilter, setProjectFilter] = useState('all');
    const [templateFilter, setTemplateFilter] = useState('all');
    const [workFilter, setWorkFilter] = useState('all');
    const [assetFilter, setAssetFilter] = useState('all');
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');

    const handleSort = (key: keyof TaskRow) => {
        setSortConfig((current) => {
            if (current.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const renderSortIcon = (key: keyof TaskRow) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-3 h-3 text-indigo-500" />
            : <ArrowDown className="w-3 h-3 text-indigo-500" />;
    };

    // 1. Raw Base Rows
    const baseRows: TaskRow[] = useMemo(() => {
        const result: TaskRow[] = [];
        assigns.forEach(assign => {
            const details = assign.details || [];
            if (details.length === 0) {
                result.push({
                    id: assign.id,
                    assignId: assign.id,
                    workName: 'Nhiều công việc',
                    assetName: '—',
                    projectName: assign.project?.name || 'N/A',
                    templateName: assign.template?.name || assign.model_project?.name || 'N/A',
                    status: 'pending',
                });
            } else {
                details.forEach((d: DetailAssign) => {
                    const status = determineDetailStatus(d);
                    let actorArr: string[] = [];
                    const rawActor = status === 'approved'
                        ? (d.id_person_approve as any)
                        : status === 'rejected'
                            ? (d.id_person_reject as any)
                            : null;
                    if (rawActor) {
                        if (Array.isArray(rawActor)) actorArr = rawActor;
                        else if (typeof rawActor === 'string') { try { actorArr = JSON.parse(rawActor); } catch { actorArr = [rawActor]; } }
                    }
                    const actorId = actorArr.length > 0 ? actorArr[actorArr.length - 1] : null;

                    result.push({
                        id: d.id,
                        assignId: assign.id,
                        workName: d.config?.sub_work?.name || d.config?.sub_work?.work?.name || 'N/A',
                        assetName: d.config?.asset?.name || d.config?.sub_work?.work?.asset?.name || 'N/A',
                        projectName: assign.project?.name || 'N/A',
                        templateName: assign.template?.name || assign.model_project?.name || 'N/A',
                        status,
                        submittedAt: getLatestDate(d.submitted_at),
                        approvedAt: getLatestDate((d as any).approval_at) || getLatestDate(d.rejected_at),
                        actorId,
                    });
                });
            }
        });
        return result;
    }, [assigns]);

    // 2. Cascade Options Derivation
    const projectOptions = useMemo(() => {
        return Array.from(new Set(baseRows.map(r => r.projectName))).sort();
    }, [baseRows]);

    const templateOptions = useMemo(() => {
        let r = baseRows;
        if (projectFilter !== 'all') r = r.filter(x => x.projectName === projectFilter);
        return Array.from(new Set(r.map(x => x.templateName))).sort();
    }, [baseRows, projectFilter]);

    const workOptions = useMemo(() => {
        let r = baseRows;
        if (projectFilter !== 'all') r = r.filter(x => x.projectName === projectFilter);
        if (templateFilter !== 'all') r = r.filter(x => x.templateName === templateFilter);
        return Array.from(new Set(r.map(x => x.workName))).sort();
    }, [baseRows, projectFilter, templateFilter]);

    const assetOptions = useMemo(() => {
        let r = baseRows;
        if (projectFilter !== 'all') r = r.filter(x => x.projectName === projectFilter);
        if (templateFilter !== 'all') r = r.filter(x => x.templateName === templateFilter);
        if (workFilter !== 'all') r = r.filter(x => x.workName === workFilter);
        return Array.from(new Set(r.map(x => x.assetName))).sort();
    }, [baseRows, projectFilter, templateFilter, workFilter]);

    // Cleanup cascaded filters manually if upper level changes
    React.useEffect(() => { setTemplateFilter('all'); setWorkFilter('all'); setAssetFilter('all'); }, [projectFilter]);
    React.useEffect(() => { setWorkFilter('all'); setAssetFilter('all'); }, [templateFilter]);
    React.useEffect(() => { setAssetFilter('all'); }, [workFilter]);

    const handleClearFilters = () => {
        setSearchTerm(''); setStatusFilter('all'); setProjectFilter('all');
        setTemplateFilter('all'); setWorkFilter('all'); setAssetFilter('all');
        setDateStart(''); setDateEnd('');
    };

    // 3. Final Filtered & Sorted Rows
    const rows: TaskRow[] = useMemo(() => {
        let filtered = baseRows;

        // 1. Text Search
        if (searchTerm.trim() !== '') {
            const lowerQuery = searchTerm.toLowerCase();
            filtered = filtered.filter(row =>
                row.projectName.toLowerCase().includes(lowerQuery) ||
                row.workName.toLowerCase().includes(lowerQuery) ||
                row.assetName.toLowerCase().includes(lowerQuery)
            );
        }

        // 2. Status
        if (statusFilter !== 'all') {
            filtered = filtered.filter(row => row.status === statusFilter);
        }

        // 3. Cascading Selectors
        if (projectFilter !== 'all') filtered = filtered.filter(r => r.projectName === projectFilter);
        if (templateFilter !== 'all') filtered = filtered.filter(r => r.templateName === templateFilter);
        if (workFilter !== 'all') filtered = filtered.filter(r => r.workName === workFilter);
        if (assetFilter !== 'all') filtered = filtered.filter(r => r.assetName === assetFilter);

        // 4. Date Range
        if (dateStart) {
            const dStart = new Date(dateStart).getTime();
            filtered = filtered.filter(r => r.submittedAt && new Date(r.submittedAt).getTime() >= dStart);
        }
        if (dateEnd) {
            const dEnd = new Date(dateEnd);
            dEnd.setHours(23, 59, 59, 999);
            filtered = filtered.filter(r => r.submittedAt && new Date(r.submittedAt).getTime() <= dEnd.getTime());
        }

        // 5. Sắp xếp (SortConfig)
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof TaskRow];
                const bValue = b[sortConfig.key as keyof TaskRow];

                if (aValue === bValue) return 0;

                // Trị số null/undefined sẽ bị đẩy xuống cuối
                if (aValue == null) return 1;
                if (bValue == null) return -1;

                // Xử lý Ngày tháng
                if (sortConfig.key === 'submittedAt' || sortConfig.key === 'approvedAt') {
                    const dateA = new Date(aValue as string).getTime();
                    const dateB = new Date(bValue as string).getTime();
                    return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
                }

                // Xử lý Text mặc định
                const strA = String(aValue);
                const strB = String(bValue);
                return sortConfig.direction === 'asc'
                    ? strA.localeCompare(strB)
                    : strB.localeCompare(strA);
            });
        } else {
            // Smart sort default: Dự án -> Công việc -> Tài sản
            filtered.sort((a, b) => {
                if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
                if (a.templateName !== b.templateName) return a.templateName.localeCompare(b.templateName);
                if (a.workName !== b.workName) return a.workName.localeCompare(b.workName);
                return a.assetName.localeCompare(b.assetName);
            });
        }

        return filtered;
    }, [baseRows, searchTerm, statusFilter, sortConfig, projectFilter, templateFilter, workFilter, assetFilter, dateStart, dateEnd]);

    return (
        <GlassCard className="!p-0 overflow-hidden flex flex-col h-[560px]">
            {/* Header bar */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                    <List className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Chi tiết công việc</h3>
                {rows.length > 0 && (
                    <span className="ml-auto text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-bold border border-indigo-100 dark:border-indigo-800">
                        {rows.length.toLocaleString()} mục
                    </span>
                )}
            </div>

            {/* Toolbar: Search & Filter */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <div className="relative flex-1 w-full lg:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm dự án, công việc, tài sản..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm transition-all"
                    />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto lg:ml-auto">
                    <div className="relative w-full sm:w-auto flex-1 lg:flex-none">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full pl-9 pr-9 py-2 text-sm font-medium text-center sm:text-left text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm appearance-none cursor-pointer transition-all"
                            style={{ textAlignLast: 'center' }}
                        >
                            {STATUS_FILTERS.map(f => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all whitespace-nowrap w-full sm:w-auto ${
                            showAdvancedFilters || projectFilter !== 'all' || templateFilter !== 'all' || workFilter !== 'all' || assetFilter !== 'all' || dateStart || dateEnd
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-300 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/60'
                        }`}
                    >
                        <Settings2 className="w-4 h-4" /> Bảng lọc nâng cao
                    </button>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
                <div className="px-6 py-5 border-b border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/10 shrink-0 select-none">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chọn dự án</label>
                            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none w-full">
                                <option value="all">-- Tất cả Dự án --</option>
                                {projectOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chọn Biểu mẫu / Template</label>
                            <select value={templateFilter} onChange={e => setTemplateFilter(e.target.value)} disabled={projectFilter === 'all'} className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-400 focus:ring-2 focus:ring-indigo-500/50 outline-none w-full">
                                <option value="all">-- Tất cả Biểu mẫu --</option>
                                {templateOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nhóm công việc</label>
                            <select value={workFilter} onChange={e => setWorkFilter(e.target.value)} disabled={templateFilter === 'all'} className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-400 focus:ring-2 focus:ring-indigo-500/50 outline-none w-full">
                                <option value="all">-- Tất cả --</option>
                                {workOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tài sản (Asset)</label>
                            <select value={assetFilter} onChange={e => setAssetFilter(e.target.value)} disabled={workFilter === 'all'} className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-400 focus:ring-2 focus:ring-indigo-500/50 outline-none w-full">
                                <option value="all">-- Tất cả --</option>
                                {assetOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <CalendarRange className="w-3.5 h-3.5" /> Khoảng TG Nộp bài
                            </label>
                            <div className="flex items-center gap-2">
                                <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none w-full" />
                                <span className="text-slate-400 text-xs">-</span>
                                <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none w-full" />
                            </div>
                        </div>
                    </div>

                    {(projectFilter !== 'all' || templateFilter !== 'all' || workFilter !== 'all' || assetFilter !== 'all' || dateStart || dateEnd) && (
                        <div className="flex justify-start mt-4">
                            <button onClick={handleClearFilters} className="text-[11px] font-bold uppercase tracking-wider text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors">
                                <X className="w-3.5 h-3.5" /> Xóa bộ lọc nâng cao
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Table Container */}
            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 relative scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                <table className="w-full text-sm text-left min-w-[900px]">
                    <thead className="text-xs text-slate-400 dark:text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 shadow-sm pointer-events-none">
                        <tr>
                            <th scope="col" className="w-[18%]">
                                <button type="button" onClick={() => handleSort('projectName')} className="flex items-center gap-1.5 px-5 py-4 font-bold tracking-wider hover:text-slate-700 dark:hover:text-slate-300 w-full group pointer-events-auto">
                                    Dự án {renderSortIcon('projectName')}
                                </button>
                            </th>
                            <th scope="col" className="w-[21%]">
                                <button type="button" onClick={() => handleSort('workName')} className="flex items-center gap-1.5 px-4 py-4 font-bold tracking-wider hover:text-slate-700 dark:hover:text-slate-300 w-full group pointer-events-auto">
                                    Công việc {renderSortIcon('workName')}
                                </button>
                            </th>
                            <th scope="col" className="w-[17%]">
                                <button type="button" onClick={() => handleSort('assetName')} className="flex items-center gap-1.5 px-4 py-4 font-bold tracking-wider hover:text-slate-700 dark:hover:text-slate-300 w-full group pointer-events-auto">
                                    Tài sản {renderSortIcon('assetName')}
                                </button>
                            </th>
                            <th scope="col" className="w-[15%]">
                                <button type="button" onClick={() => handleSort('status')} className="flex items-center justify-center gap-1.5 px-4 py-4 font-bold tracking-wider hover:text-slate-700 dark:hover:text-slate-300 w-full group pointer-events-auto">
                                    Trạng thái {renderSortIcon('status')}
                                </button>
                            </th>
                            <th scope="col" className="w-[11%]">
                                <button type="button" onClick={() => handleSort('submittedAt')} className="flex items-center justify-center gap-1.5 px-4 py-4 font-bold tracking-wider hover:text-slate-700 dark:hover:text-slate-300 w-full group pointer-events-auto">
                                    Ngày nộp {renderSortIcon('submittedAt')}
                                </button>
                            </th>
                            <th scope="col" className="w-[18%]">
                                <button type="button" onClick={() => handleSort('approvedAt')} className="flex items-center justify-center gap-1.5 px-5 py-4 font-bold tracking-wider hover:text-slate-700 dark:hover:text-slate-300 w-full group pointer-events-auto">
                                    Phê duyệt {renderSortIcon('approvedAt')}
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-slate-50 dark:border-slate-800 animate-pulse">
                                    <td className="px-5 py-5"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4"></div></td>
                                    <td className="px-4 py-5"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div></td>
                                    <td className="px-4 py-5"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2"></div></td>
                                    <td className="px-4 py-5"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto w-20"></div></td>
                                    <td className="px-4 py-5"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded mx-auto w-16"></div></td>
                                    <td className="px-5 py-5"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto w-24"></div></td>
                                </tr>
                            ))
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                                            <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                        </div>
                                        <div className="text-slate-500 dark:text-slate-400 font-semibold text-base"> Không tìm thấy kết quả khớp nào </div>
                                        <p className="text-slate-400 dark:text-slate-500 text-sm">Vui lòng thử từ khóa phân phối khác hoặc thay đổi bộ lọc.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => {
                                const badge = STATUS_BADGES[row.status];

                                // Parse submitted date
                                let dateEl = <span className="text-slate-300 dark:text-slate-600">—</span>;
                                if (row.submittedAt) {
                                    const d = new Date(row.submittedAt);
                                    if (!isNaN(d.getTime())) {
                                        dateEl = (
                                            <div className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400">
                                                <Calendar className="w-3.5 h-3.5 opacity-60" />
                                                <span className="text-[13px] font-semibold whitespace-nowrap">
                                                    {d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            </div>
                                        );
                                    }
                                }

                                // Actor / approver pill
                                let userEl = <span className="text-slate-300 dark:text-slate-600">—</span>;
                                if (row.actorId) {
                                    const isApproved = row.status === 'approved';
                                    const color = isApproved
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800';
                                    const name = usersMap[row.actorId] || (row.actorId.slice(0, 8) + '…');

                                    let approveDateEl = null;
                                    if (row.approvedAt) {
                                        const ad = new Date(row.approvedAt);
                                        if (!isNaN(ad.getTime())) {
                                            approveDateEl = (
                                                <div className="flex items-center gap-1 mt-1 text-slate-500 dark:text-slate-400 opacity-90">
                                                    <Calendar className="w-3 h-3" />
                                                    <span className="text-[10px] font-semibold">
                                                        {ad.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            );
                                        }
                                    }

                                    userEl = (
                                        <div className="flex flex-col items-center">
                                            <span
                                                title={name}
                                                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-sm max-w-[130px] ${color}`}
                                            >
                                                <User className="w-3 h-3 shrink-0 opacity-70" />
                                                <span className="truncate">{name}</span>
                                            </span>
                                            {approveDateEl}
                                        </div>
                                    );
                                }

                                return (
                                    <tr
                                        key={row.id}
                                        className="bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                        <td className="px-5 py-4">
                                            <div className="font-bold text-slate-800 dark:text-white line-clamp-2">
                                                {row.projectName}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-semibold text-indigo-900 dark:text-indigo-300 line-clamp-2">
                                                {row.workName}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-medium text-slate-500 dark:text-slate-400 line-clamp-2">
                                                {row.assetName}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-center">
                                                <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm whitespace-nowrap ${badge?.color ?? ''}`}>
                                                    {badge?.label ?? String(row.status)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {dateEl}
                                        </td>
                                        <td className="px-5 py-4 align-middle">
                                            {userEl}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-400 dark:text-slate-500 text-right shrink-0">
                Hiển thị {rows.length.toLocaleString()} bản ghi
            </div>
        </GlassCard>
    );
};

export default TaskTable;
