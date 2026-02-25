import React from 'react';
import { MoreVertical, User, Briefcase, Trash2, Shield, Edit } from 'lucide-react';
import { Column } from '../../../../components/common/PremiumTable';
import PremiumButton from '../../../../components/common/PremiumButton';
import { UserData } from './types';

interface ColumnOptions {
    activeMenuId: string | null;
    setActiveMenuId: (id: string | null) => void;
    menuRef: React.RefObject<HTMLDivElement>;
    setUpdatingUser: (user: UserData) => void;
    setEditingUserId: (id: string) => void;
    handleDeleteUser: (id: string) => void;
    setAllocatingUser: (user: UserData) => void;
}

export const getUserColumns = (options: ColumnOptions): Column<UserData>[] => {
    const {
        activeMenuId, setActiveMenuId, menuRef,
        setUpdatingUser, setEditingUserId, handleDeleteUser
    } = options;

    return [
        {
            header: 'Người dùng',
            accessor: 'full_name',
            cell: (_, user) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-primary-100 to-indigo-100 rounded-full flex items-center justify-center text-primary-600 font-bold border-2 border-white shadow-sm">
                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                        <div className="font-semibold text-slate-800">{user.full_name || 'N/A'}</div>
                        <div className="text-xs text-slate-500 font-medium">{user.email}</div>
                    </div>
                </div>
            )
        },
        {
            header: 'Vai trò',
            accessor: 'role',
            cell: (_, user) => (
                <div className="flex items-center gap-2">
                    {user.role === 'manager' ? <Briefcase className="w-4 h-4 text-primary-500" /> :
                        user.role === 'admin' ? <Shield className="w-4 h-4 text-red-500" /> :
                            <User className="w-4 h-4 text-emerald-500" />}
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg capitalize border ${user.role === 'manager' ? 'bg-primary-50 text-primary-700 border-primary-100' :
                        user.role === 'admin' ? 'bg-red-50 text-red-700 border-red-100' :
                            'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                        {user.role || 'User'}
                    </span>
                </div>
            )
        },
        {
            header: 'Nhóm',
            accessor: (user) => user.team?.name || '',
            cell: (_, user) => (
                <div className="text-sm text-slate-600 font-medium">
                    {user.team ? user.team.name : <span className="text-slate-400 italic font-normal">Chưa vào nhóm</span>}
                </div>
            )
        },
        {
            header: 'Trạng thái',
            accessor: () => 'active',
            cell: () => (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    ACTIVE
                </span>
            )
        },
        {
            header: 'Hành động',
            className: 'text-right',
            accessor: (user) => user.id,
            cell: (_, user) => (
                <div className="flex justify-end relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === user.id ? null : user.id);
                        }}
                        className="text-slate-400 hover:text-primary-600 p-2 rounded-lg hover:bg-primary-50 transition-colors"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === user.id && (
                        <div
                            ref={menuRef}
                            className="absolute right-8 top-0 w-48 bg-white/90 backdrop-blur-xl rounded-xl shadow-glass-lg border border-white/50 z-50 animate-fade-in overflow-hidden p-1.5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => { setUpdatingUser(user); setActiveMenuId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <Edit className="w-4 h-4 text-slate-500" />
                                Cập nhật thông tin
                            </button>
                            <button
                                onClick={() => { setEditingUserId(user.id); setActiveMenuId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <Shield className="w-4 h-4 text-primary-500" />
                                Đổi vai trò
                            </button>
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Xóa người dùng
                            </button>
                        </div>
                    )}
                </div>
            )
        }
    ];
};

export const getAllocationColumns = (setAllocatingUser: (user: UserData) => void): Column<UserData>[] => [
    {
        header: 'Người dùng',
        accessor: 'full_name',
        cell: (_, user) => (
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-bold border border-white">
                    {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                    <div className="font-medium text-slate-900">{user.full_name}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                </div>
            </div>
        )
    },
    {
        header: 'Vai trò',
        accessor: 'role',
        cell: (_, user) => (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-lg border capitalize
                ${user.role === 'manager' ? 'bg-primary-50 text-primary-700 border-primary-100' :
                    'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                {user.role}
            </span>
        )
    },
    {
        header: 'Trưởng nhóm hiện tại',
        accessor: (user) => user.leader?.full_name || '',
        cell: (_, user) => user.leader ? (
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold">
                    {user.leader.full_name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-slate-700 font-medium">{user.leader.full_name}</span>
            </div>
        ) : (
            <span className="text-sm text-slate-400 italic">Chưa phân bổ</span>
        )
    },
    {
        header: 'Hành động',
        className: 'text-right',
        accessor: 'id',
        cell: (_, user) => (
            <div className="flex justify-end">
                <PremiumButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setAllocatingUser(user)}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                >
                    {user.leader ? 'Đổi trưởng nhóm' : 'Gán trưởng nhóm'}
                </PremiumButton>
            </div>
        )
    }
];
