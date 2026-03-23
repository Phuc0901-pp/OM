import React, { useState, useRef, useEffect } from 'react';
import { Filter, ArrowUpDown, ChevronDown, Check, X } from 'lucide-react';

export type SortField = 'name' | 'created_at' | 'person_created' | 'role' | 'team';
export type SortOrder = 'asc' | 'desc';

export interface FilterOption {
    label: string;
    value: string;
}

interface SmartFilterSortProps {
    // Role Filter
    roleOptions: FilterOption[];
    selectedRole: string;
    onRoleChange: (value: string) => void;

    // Team Filter
    teamOptions: FilterOption[];
    selectedTeam: string;
    onTeamChange: (value: string) => void;

    // Sort
    sortField: SortField;
    sortOrder: SortOrder;
    onSortChange: (field: SortField, order: SortOrder) => void;
}

const SORT_OPTIONS: { label: string; field: SortField; defaultOrder: SortOrder }[] = [
    { label: 'Tên nhân sự', field: 'name', defaultOrder: 'asc' },
    { label: 'Ngày tạo', field: 'created_at', defaultOrder: 'desc' },
    { label: 'Người tạo', field: 'person_created', defaultOrder: 'asc' },
    { label: 'Vai trò', field: 'role', defaultOrder: 'asc' },
    { label: 'Nhóm', field: 'team', defaultOrder: 'asc' },
];

const SmartFilterSort: React.FC<SmartFilterSortProps> = ({
    roleOptions, selectedRole, onRoleChange,
    teamOptions, selectedTeam, onTeamChange,
    sortField, sortOrder, onSortChange
}) => {
    const [openDropdown, setOpenDropdown] = useState<'role' | 'team' | 'sort' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = (dropdown: 'role' | 'team' | 'sort') => {
        setOpenDropdown(openDropdown === dropdown ? null : dropdown);
    };

    const handleSortClick = (field: SortField, defaultOrder: SortOrder) => {
        if (sortField === field) {
            // Toggle order if clicking same field
            onSortChange(field, sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new field with default order
            onSortChange(field, defaultOrder);
        }
        setOpenDropdown(null);
    };

    return (
        <div className="flex flex-wrap items-center gap-2" ref={containerRef}>

            {/* 1. ROLE FILTER DROPDOWN */}
            <div className="relative">
                <button
                    onClick={() => toggleDropdown('role')}
                    className={`flex items-center gap-2 px-3 py-2 bg-white border rounded-xl text-sm font-medium transition-all shadow-sm ${selectedRole || openDropdown === 'role' ? 'border-indigo-400 text-indigo-600 ring-2 ring-indigo-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                    <Filter className="w-4 h-4" />
                    <span>{selectedRole ? roleOptions.find(o => o.value === selectedRole)?.label || 'Vai trò' : 'Vai trò'}</span>
                    {selectedRole ? (
                        <X
                            className="w-3.5 h-3.5 ml-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 p-0.5 transition-colors"
                            onClick={(e) => { e.stopPropagation(); onRoleChange(''); }}
                        />
                    ) : (
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openDropdown === 'role' ? 'rotate-180' : ''}`} />
                    )}
                </button>

                {openDropdown === 'role' && (
                    <div className="absolute top-full left-0 mt-1.5 w-48 bg-white border border-slate-100 rounded-xl shadow-lg z-30 py-1.5 overflow-hidden animate-fade-in-up">
                        <div className="px-3 py-1.5 border-b border-slate-50 mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lọc theo vai trò</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            <button
                                onClick={() => { onRoleChange(''); setOpenDropdown(null); }}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${!selectedRole ? 'bg-indigo-50/50 text-indigo-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                Tất cả
                                {!selectedRole && <Check className="w-4 h-4" />}
                            </button>
                            {roleOptions.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => { onRoleChange(option.value); setOpenDropdown(null); }}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${selectedRole === option.value ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {option.label}
                                    {selectedRole === option.value && <Check className="w-4 h-4" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 2. TEAM FILTER DROPDOWN */}
            <div className="relative">
                <button
                    onClick={() => toggleDropdown('team')}
                    className={`flex items-center gap-2 px-3 py-2 bg-white border rounded-xl text-sm font-medium transition-all shadow-sm ${selectedTeam || openDropdown === 'team' ? 'border-emerald-400 text-emerald-600 ring-2 ring-emerald-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                    <Filter className="w-4 h-4" />
                    <span className="truncate max-w-[100px]">{selectedTeam ? teamOptions.find(o => o.value === selectedTeam)?.label || 'Nhóm' : 'Nhóm'}</span>
                    {selectedTeam ? (
                        <X
                            className="w-3.5 h-3.5 ml-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 p-0.5 transition-colors"
                            onClick={(e) => { e.stopPropagation(); onTeamChange(''); }}
                        />
                    ) : (
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openDropdown === 'team' ? 'rotate-180' : ''}`} />
                    )}
                </button>

                {openDropdown === 'team' && (
                    <div className="absolute top-full left-0 mt-1.5 w-56 bg-white border border-slate-100 rounded-xl shadow-lg z-30 py-1.5 overflow-hidden animate-fade-in-up">
                        <div className="px-3 py-1.5 border-b border-slate-50 mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lọc theo nhóm</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            <button
                                onClick={() => { onTeamChange(''); setOpenDropdown(null); }}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${!selectedTeam ? 'bg-emerald-50/50 text-emerald-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                Tất cả
                                {!selectedTeam && <Check className="w-4 h-4" />}
                            </button>
                            {teamOptions.map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => { onTeamChange(option.value); setOpenDropdown(null); }}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${selectedTeam === option.value ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {selectedTeam === option.value && <Check className="w-4 h-4 shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div> {/* Divider */}

            {/* 3. SORT DROPDOWN */}
            <div className="relative">
                <button
                    onClick={() => toggleDropdown('sort')}
                    className={`flex items-center gap-2 px-3 py-2 bg-white border rounded-xl text-sm font-medium transition-all shadow-sm ${openDropdown === 'sort' ? 'border-sky-400 text-sky-600 ring-2 ring-sky-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                    <ArrowUpDown className="w-4 h-4" />
                    <span>Sắp xếp</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openDropdown === 'sort' ? 'rotate-180' : ''}`} />
                </button>

                {openDropdown === 'sort' && (
                    <div className="absolute top-full right-0 mt-1.5 w-56 bg-white border border-slate-100 rounded-xl shadow-lg z-30 py-1.5 overflow-hidden animate-fade-in-up">
                        <div className="px-3 py-2 border-b border-slate-50 mb-1 flex justify-between items-center bg-slate-50/50">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tiêu chí sắp xếp</span>
                        </div>

                        <div className="py-1">
                            {SORT_OPTIONS.map(option => (
                                <button
                                    key={option.field}
                                    onClick={() => handleSortClick(option.field, option.defaultOrder)}
                                    className={`w-full px-4 py-2 text-sm flex flex-col transition-colors hover:bg-slate-50 ${sortField === option.field ? 'bg-sky-50/40' : ''}`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className={`font-medium ${sortField === option.field ? 'text-sky-700' : 'text-slate-700'}`}>
                                            {option.label}
                                        </span>
                                        {sortField === option.field && (
                                            <span className="text-xs font-semibold text-sky-500 bg-sky-100 px-1.5 py-0.5 rounded">
                                                {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Mũi tên chỉ định thứ tự */}
                                    {sortField === option.field && (
                                        <div className="flex items-center text-[10px] text-sky-600 mt-1 gap-1 font-medium bg-white/50 w-fit px-1.5 py-0.5 rounded shadow-sm border border-sky-100">
                                            <ArrowUpDown className="w-3 h-3" />
                                            {sortOrder === 'asc'
                                                ? (option.field === 'created_at' ? 'Cũ nhất trước' : 'Tăng dần')
                                                : (option.field === 'created_at' ? 'Mới nhất trước' : 'Giảm dần')}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};

export default SmartFilterSort;
