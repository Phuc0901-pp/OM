/**
 * VirtualTable.tsx
 * A high-performance, virtualized table component using @tanstack/react-virtual.
 * Renders only the visible rows in the DOM — handles 10,000+ rows without lag.
 *
 * Usage:
 * <VirtualTable columns={cols} data={rows} rowHeight={52} />
 */

import React, { useRef, CSSProperties } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualColumnDef<T> {
 /** Column header label */
 header: string;
 /** Accessor: key of T or function returning value */
 accessor: keyof T | ((row: T) => React.ReactNode);
 /** Optional custom cell renderer. Receives the (value, row) */
 cell?: (value: unknown, row: T) => React.ReactNode;
 /** Optional tailwind class for this column's td/th (cells) */
 className?: string;
 /** Optional tailwind class overrides for the <th> header cell only */
 headerClassName?: string;
 /** Optional min-width in pixels (default: auto) */
 minWidth?: number;
 /** Optional percentage width e.g. '20%' */
 width?: string;
}

interface VirtualTableProps<T> {
 columns: VirtualColumnDef<T>[];
 data: T[];
 /** Height of each row in pixels (default: 52) */
 rowHeight?: number;
 /** Max height of the scrollable container (default: 520px) */
 maxHeight?: number;
 /** Key field to use for row keys */
 keyField?: keyof T;
 /** Show a loading skeleton */
 isLoading?: boolean;
 /** Number of skeleton rows to show while loading */
 skeletonRows?: number;
 /** Empty state message */
 emptyMessage?: string;
 /** Optional row click handler */
 onRowClick?: (row: T) => void;
 /** Optional extra class on the wrapper */
 className?: string;
}

function getAccessorValue<T>(row: T, accessor: keyof T | ((row: T) => React.ReactNode)): React.ReactNode {
 if (typeof accessor === 'function') return accessor(row);
 return row[accessor] as React.ReactNode;
}

function VirtualTable<T>({
 columns,
 data,
 rowHeight = 52,
 maxHeight = 520,
 keyField,
 isLoading = false,
 skeletonRows = 6,
 emptyMessage = 'Chưa có dữ liệu.',
 onRowClick,
 className = '',
}: VirtualTableProps<T>) {
 const parentRef = useRef<HTMLDivElement>(null);

 const rowVirtualizer = useVirtualizer({
 count: data.length,
 getScrollElement: () => parentRef.current,
 estimateSize: () => rowHeight,
 overscan: 8,
 });

 const headerCellStyle: CSSProperties = {
 position: 'sticky',
 top: 0,
 zIndex: 1,
 };

 if (isLoading) {
 return (
 <div className={`overflow-hidden rounded-xl border border-slate-100 ${className}`}>
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase">
 {columns.map((col, i) => (
 <th key={i} className="py-3 px-4 text-left font-semibold" style={headerCellStyle}>
 {col.header}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {Array.from({ length: skeletonRows }).map((_, i) => (
 <tr key={i} className="border-b border-slate-50 ">
 {columns.map((_, j) => (
 <td key={j} className="py-3 px-4">
 <div className="h-4 bg-slate-100 rounded animate-pulse" />
 </td>
 ))}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
 }

 if (!data.length) {
 return (
 <div className={`text-center text-slate-400 py-16 ${className}`}>
 <p className="text-sm font-medium">{emptyMessage}</p>
 </div>
 );
 }

 const totalHeight = rowVirtualizer.getTotalSize();
 const virtualItems = rowVirtualizer.getVirtualItems();

 const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
 const paddingBottom = virtualItems.length > 0 ? totalHeight - virtualItems[virtualItems.length - 1].end : 0;

 return (
 <div
 className={`overflow-hidden rounded-xl border border-slate-100 ${className}`}
 >
 {/* Sticky header */}
 <table className="w-full text-sm table-fixed">
 <colgroup>
 {columns.map((col, i) => (
 <col key={i} style={{ width: col.width, minWidth: col.minWidth }} />
 ))}
 </colgroup>
 <thead>
 <tr className="bg-slate-50 border-b border-slate-200 ">
 {columns.map((col, i) => (
 <th
 key={i}
 className={`py-3.5 px-5 text-[11px] font-bold tracking-wider uppercase text-slate-400 ${col.headerClassName ?? 'text-left'}`}
 style={{ minWidth: col.minWidth }}
 >
 {col.header}
 </th>
 ))}
 </tr>
 </thead>
 </table>

 {/* Virtualized scrollable body */}
 <div
 ref={parentRef}
 style={{ maxHeight, overflowY: 'auto' }}
 className="scrollbar-hide"
 >
 <table className="w-full text-sm table-fixed">
 <colgroup>
 {columns.map((col, i) => (
 <col key={i} style={{ width: col.width, minWidth: col.minWidth }} />
 ))}
 </colgroup>
 <tbody>
 {paddingTop > 0 && (
 <tr>
 <td style={{ height: paddingTop, padding: 0, border: 0 }} colSpan={columns.length} />
 </tr>
 )}
 {virtualItems.map((virtualRow) => {
 const row = data[virtualRow.index];
 const key = keyField ? String(row[keyField]) : virtualRow.index;
 return (
 <tr
 key={key}
 data-index={virtualRow.index}
 className={`border-b border-slate-50 transition-colors ${onRowClick
 ? 'cursor-pointer hover:bg-slate-50 '
 : 'hover:bg-slate-50/50 '
 }`}
 onClick={() => onRowClick?.(row)}
 >
 {columns.map((col, ci) => {
 const rawValue = getAccessorValue(row, col.accessor);
 const cellContent = col.cell ? col.cell(rawValue, row) : rawValue;
 return (
 <td
 key={ci}
 className={`px-5 align-middle ${col.className ?? ''}`}
 style={{ height: rowHeight, minWidth: col.minWidth, maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
 >
 {cellContent as React.ReactNode}
 </td>
 );
 })}
 </tr>
 );
 })}
 {paddingBottom > 0 && (
 <tr>
 <td style={{ height: paddingBottom, padding: 0, border: 0 }} colSpan={columns.length} />
 </tr>
 )}
 </tbody>
 </table>
 </div>

 {/* Row count badge */}
 <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-400 text-right">
 {data.length.toLocaleString()} bản ghi
 </div>
 </div>
 );
}

export default VirtualTable;
