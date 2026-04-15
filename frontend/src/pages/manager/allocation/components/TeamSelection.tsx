import React, { useState, useMemo } from 'react';
import { Users, Search, ArrowUpDown } from 'lucide-react';
import GlassCard from '../../../../components/common/GlassCard';
import type { User } from '../../../../types/models';

interface TeamSelectionProps {
    users: User[];
    selectedUsers: string[];
    roles: any[];
    toggleUser: (userId: string) => void;
}

const TeamSelection: React.FC<TeamSelectionProps> = ({ users, roles, selectedUsers, toggleUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'default' | 'name' | 'selected'>('selected');

    const getRoleName = (roleId?: string) => {
        if (!roleId) return 'N/A';
        const found = roles.find(r => r.id === roleId);
        return found ? found.name : 'N/A';
    };

    const getUserRoleName = (u: any) => {
        const directName = (u.role || u.role_model)?.name;
        if (directName) return directName;
        return getRoleName(u.role_id || u.id_role);
    };

    const processUsers = useMemo(() => {
        // 1. Filter out managers/admins and apply search term
        let filtered = users.filter(u => {
            const roleName = getUserRoleName(u).toLowerCase();
            const userName = (u.name || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const searchLower = searchTerm.toLowerCase();
            
            const isNotManager = !roleName.includes('manager') && !roleName.includes('admin');
            const matchesSearch = userName.includes(searchLower) || roleName.includes(searchLower) || email.includes(searchLower);

            return isNotManager && matchesSearch;
        });

        // 2. Apply sorting
        filtered.sort((a, b) => {
            const aSelected = selectedUsers.includes(a.id) ? 1 : 0;
            const bSelected = selectedUsers.includes(b.id) ? 1 : 0;
            const nameA = a.name?.toLowerCase() || '';
            const nameB = b.name?.toLowerCase() || '';

            if (sortBy === 'selected') {
                if (aSelected !== bSelected) return bSelected - aSelected; // Selected first
                return nameA.localeCompare(nameB, 'vi');
            } else if (sortBy === 'name') {
                return nameA.localeCompare(nameB, 'vi');
            }
            return 0; // default
        });

        return filtered;
    }, [users, searchTerm, sortBy, selectedUsers, roles]);

    return (
        <div className="xl:col-span-3 space-y-6">
            <GlassCard className="h-[600px] flex flex-col">
                <div className="flex flex-col gap-4 mb-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-600" /> Nhân Sự
                        </h3>
                        <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-1 rounded">
                            {selectedUsers.length}
                        </span>
                    </div>

                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm nhân sự, vai trò..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setSortBy(prev => prev === 'selected' ? 'name' : 'selected')}
                            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-center bg-white tooltip-trigger group relative"
                            title="Sắp xếp thông minh"
                        >
                            <ArrowUpDown className="w-4 h-4" />
                            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {sortBy === 'selected' ? 'Đã chọn lên đầu' : 'Theo bảng chữ cái'}
                            </div>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar p-1">
                    {processUsers.length > 0 ? (
                        processUsers.map(u => {
                            const isSelected = selectedUsers.includes(u.id);
                            return (
                                <div
                                    key={u.id}
                                    onClick={() => toggleUser(u.id)}
                                    className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center gap-3 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md transform scale-[1.02]' : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-300'}`}
                                >
                                    <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${isSelected ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                        {u.name?.charAt(0) ?? '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold truncate">{u.name}</div>
                                        <div className={`text-[10px] uppercase font-bold truncate mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            {getUserRoleName(u)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                            <Users className="w-10 h-10 text-slate-200" />
                            <p className="text-sm">Không tìm thấy nhân sự nào khớp với điều kiện tìmm kiếm.</p>
                        </div>
                    )}
                </div>
            </GlassCard>
        </div>
    );
};

export default TeamSelection;
