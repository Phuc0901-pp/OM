import React from 'react';
import { List, Calendar, User } from 'lucide-react';
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

const TaskTable: React.FC<TaskTableProps> = ({ assigns, loading, usersMap = {} }) => {

    const rows: TaskRow[] = React.useMemo(() => {
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
                        status,
                        submittedAt: getLatestDate(d.submitted_at),
                        approvedAt: getLatestDate((d as any).approval_at) || getLatestDate(d.rejected_at),
                        actorId,
                    });
                });
            }
        });

        // Smart sort: Dự án -> Công việc -> Tài sản
        result.sort((a, b) => {
            if (a.projectName !== b.projectName) return a.projectName.localeCompare(b.projectName);
            if (a.workName !== b.workName) return a.workName.localeCompare(b.workName);
            return a.assetName.localeCompare(b.assetName);
        });

        return result;
    }, [assigns]);

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

            {/* Table Container */}
            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 relative scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                <table className="w-full text-sm text-left min-w-[900px]">
                    <thead className="text-xs text-slate-400 dark:text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th scope="col" className="px-5 py-4 font-bold tracking-wider w-[18%]">Dự án</th>
                            <th scope="col" className="px-4 py-4 font-bold tracking-wider w-[21%]">Công việc</th>
                            <th scope="col" className="px-4 py-4 font-bold tracking-wider w-[17%]">Tài sản</th>
                            <th scope="col" className="px-4 py-4 font-bold tracking-wider text-center w-[15%]">Trạng thái</th>
                            <th scope="col" className="px-4 py-4 font-bold tracking-wider text-center w-[11%]">Ngày nộp</th>
                            <th scope="col" className="px-5 py-4 font-bold tracking-wider text-center w-[18%]">Phê duyệt</th>
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
                                <td colSpan={6} className="px-6 py-16 text-center text-slate-400 dark:text-slate-500 font-medium">
                                    Chưa có công việc nào được giao.
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
