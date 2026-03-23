import { ReactNode } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export interface Column<T> {
    header: string;
    accessor: keyof T | ((item: T) => ReactNode);
    cell?: (value: any, item: T) => ReactNode;
    className?: string;
}
export type ColumnDef<T> = Column<T>;

interface PremiumTableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyField: keyof T;
    isLoading?: boolean;
    pagination?: {
        currentPage: number;
        totalPages: number;
        onPageChange: (page: number) => void;
    };
    onRowClick?: (item: T) => void;
    emptyMessage?: string;
}

const PremiumTable = <T extends any>({
    data,
    columns,
    keyField,
    isLoading = false,
    pagination,
    onRowClick,
    emptyMessage = "No data found"
}: PremiumTableProps<T>) => {

    return (
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-glass rounded-2xl overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/20 bg-slate-50/50">
                            {columns.map((col, idx) => (
                                <th
                                    key={idx}
                                    className={`px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider ${col.className || ''}`}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/20">
                        {isLoading ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                                        <span>Loading...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                                    {emptyMessage || 'No data available'}
                                </td>
                            </tr>
                        ) : (
                            data.map((item, rowIndex) => (
                                <tr
                                    key={keyField ? String(item[keyField]) : `row-${rowIndex}`}
                                    onClick={() => onRowClick && onRowClick(item)}
                                    className={`
                                        group transition-colors duration-150
                                        ${onRowClick ? 'cursor-pointer hover:bg-white/60 active:bg-white/80' : 'hover:bg-white/40'}
                                    `}
                                >
                                    {columns.map((col, idx) => {
                                        const value = typeof col.accessor === 'function'
                                            ? col.accessor(item)
                                            : item[col.accessor];

                                        // Use custom cell renderer if provided, otherwise default
                                        const cellContent = col.cell
                                            ? col.cell(value, item)
                                            : (value !== undefined && value !== null ? String(value) : '-');

                                        return (
                                            <td key={idx} className={`px-6 py-4 text-sm text-slate-700 font-medium ${col.className || ''}`}>
                                                {cellContent}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {
                pagination && (
                    <div className="px-6 py-4 border-t border-white/20 bg-slate-50/30 flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">
                            Page {pagination.currentPage} of {pagination.totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => pagination.onPageChange(Math.max(1, pagination.currentPage - 1))}
                                disabled={pagination.currentPage === 1}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-primary-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => pagination.onPageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
                                disabled={pagination.currentPage === pagination.totalPages}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-primary-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default PremiumTable;
