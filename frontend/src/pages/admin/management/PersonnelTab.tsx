import { useEffect, useState, useRef } from 'react';
import api from '../../../services/api';
import { Search, Plus, MoreVertical, User, Briefcase, Trash2, Shield, Edit } from 'lucide-react';
import AddUserModal from '../../../components/AddUserModal';
import UpdateUserInfoModal from '../../../components/UpdateUserInfoModal';
import AllocateLeaderModal from '../../../components/AllocateLeaderModal';
import ConfirmModal from '../../../components/ConfirmModal';
import PremiumTable, { Column } from '../../../components/common/PremiumTable';
import PremiumButton from '../../../components/common/PremiumButton';
import ModernInput from '../../../components/common/ModernInput';
import GlassCard from '../../../components/common/GlassCard';

interface UserData {
    id: string;
    full_name: string;
    email: string;
    role: string;
    team: { id: string; name: string } | null;
    number_phone?: string;
    leader?: { id: string; full_name: string } | null;
    telegram_chat_id?: string;
}

interface RoleData {
    id: string;
    name: string;
}

type SortConfig = {
    key: keyof UserData | 'team';
    direction: 'asc' | 'desc';
} | null;

const PersonnelTab = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [roles, setRoles] = useState<RoleData[]>([]);
    const [loading, setLoading] = useState(true);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    // Menu State
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Edit Role State
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [selectedRoleId, setSelectedRoleId] = useState<string>("");

    // Update Info State
    const [updatingUser, setUpdatingUser] = useState<UserData | null>(null);

    // Allocation State
    const [allocatingUser, setAllocatingUser] = useState<UserData | null>(null);

    // Confirm Modal State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Sub-tab state
    const [subTab, setSubTab] = useState<'all' | 'allocation'>('all');

    useEffect(() => {
        fetchUsers();
        fetchRoles();

        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuId(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/users');
            setUsers(response.data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const response = await api.get('/roles');
            setRoles(response.data);
        } catch (error) {
            console.error("Failed to fetch roles", error);
        }
    };

    const handleDeleteUser = (id: string) => {
        setConfirmState({
            isOpen: true,
            title: "Xóa người dùng",
            message: "Hành động này sẽ xóa người dùng khỏi hệ thống vĩnh viễn.",
            onConfirm: async () => {
                try {
                    await api.delete(`/users/${id}`);
                    setActiveMenuId(null);
                    fetchUsers();
                } catch (error) {
                    alert("Xóa người dùng thất bại");
                }
            }
        });
    };

    const handleUpdateRole = async () => {
        if (!editingUserId || !selectedRoleId) return;
        try {
            await api.put(`/users/${editingUserId}/role`, {
                role_id: selectedRoleId
            });
            setEditingUserId(null); // Close modal
            fetchUsers(); // Refresh
        } catch (error) {
            console.error(error);
            alert("Failed to update role");
        }
    };

    const handleSort = (key: keyof UserData | 'team') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedUsers = () => {
        let sortableUsers = [...users];

        // Get Current User for Role-based Filtering
        const storedUser = localStorage.getItem('user');
        const currentUser = storedUser ? JSON.parse(storedUser) : null;
        const isManager = currentUser?.role === 'manager';
        const currentUserId = currentUser?.id;

        // Filter first
        if (searchTerm) {
            sortableUsers = sortableUsers.filter(user =>
                (user.role !== 'admin' && user.role !== 'manager') &&
                (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.email?.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        } else {
            // Default filter (exclude admin & manager)
            // AND if I am a manager, ONLY show my assigned users
            sortableUsers = sortableUsers.filter(user => {
                const isNotAdminOrManager = user.role !== 'admin' && user.role !== 'manager';

                if (isManager) {
                    return isNotAdminOrManager && user.leader?.id === currentUserId;
                }

                return isNotAdminOrManager;
            });
        }

        // Then Sort
        if (sortConfig !== null) {
            sortableUsers.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof UserData];
                let bValue: any = b[sortConfig.key as keyof UserData];

                if (sortConfig.key === 'team') {
                    aValue = a.team?.name || '';
                    bValue = b.team?.name || '';
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableUsers;
    };

    const filteredUsers = getSortedUsers();

    // Table Columns Definition
    const userColumns: Column<UserData>[] = [
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

                    {/* Dropdown Menu */}
                    {activeMenuId === user.id && (
                        <div
                            ref={menuRef}
                            className="absolute right-8 top-0 w-48 bg-white/90 backdrop-blur-xl rounded-xl shadow-glass-lg border border-white/50 z-50 animate-fade-in overflow-hidden p-1.5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => {
                                    setUpdatingUser(user);
                                    setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <Edit className="w-4 h-4 text-slate-500" />
                                Cập nhật thông tin
                            </button>
                            <button
                                onClick={() => {
                                    setEditingUserId(user.id);
                                    setActiveMenuId(null);
                                }}
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

    const allocationColumns: Column<UserData>[] = [
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
                    <span className="text-sm text-slate-700 font-medium">
                        {user.leader.full_name}
                    </span>
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

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Sub Tabs */}
            <GlassCard className="p-2 !rounded-2xl flex items-center gap-2 w-fit">
                <PremiumButton
                    variant={subTab === 'all' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSubTab('all')}
                >
                    Tất cả nhân sự
                </PremiumButton>
                <PremiumButton
                    variant={subTab === 'allocation' ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSubTab('allocation')}
                >
                    Phân bổ & Trưởng nhóm
                </PremiumButton>
            </GlassCard>

            {subTab === 'all' ? (
                <>
                    {/* Search & Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <ModernInput
                            placeholder="Tìm kiếm theo tên hoặc email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={<Search className="w-5 h-5" />}
                            className="flex-1 !bg-white/50"
                        />
                        <div className="flex gap-2">
                            <PremiumButton
                                variant="primary"
                                size="md"
                                onClick={() => setShowAddModal(true)}
                                icon={<Plus className="w-5 h-5" />}
                            >
                                Thêm nhân sự
                            </PremiumButton>
                        </div>
                    </div>

                    {/* Table */}
                    <PremiumTable
                        data={filteredUsers}
                        columns={userColumns}
                        keyField="id"
                        isLoading={loading}
                        emptyMessage="Không tìm thấy nhân sự nào."
                    />
                </>
            ) : (
                <PremiumTable
                    data={users.filter(u => u.role !== 'admin' && u.role !== 'manager')}
                    columns={allocationColumns}
                    keyField="id"
                    isLoading={loading}
                    emptyMessage="Không có nhân sự cần phân bổ."
                />
            )}

            {/* Add User Modal */}
            <AddUserModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={() => {
                    fetchUsers();
                    setLoading(true);
                }}
            />

            {/* Update Info Modal */}
            <UpdateUserInfoModal
                isOpen={!!updatingUser}
                onClose={() => setUpdatingUser(null)}
                onSuccess={() => {
                    fetchUsers();
                }}
                user={updatingUser}
            />

            {/* Allocation Modal */}
            <AllocateLeaderModal
                isOpen={!!allocatingUser}
                onClose={() => setAllocatingUser(null)}
                onSuccess={() => {
                    fetchUsers();
                }}
                targetUser={allocatingUser}
                managers={users.filter(u => u.role === 'manager')}
            />

            {/* Edit Role Modal */}
            {editingUserId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <GlassCard className="w-full max-w-sm !p-0 overflow-hidden">
                        <div className="p-6 bg-white/80">
                            <h3 className="text-xl font-bold text-slate-800 mb-4">Đổi vai trò người dùng</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-1 block">Chọn vai trò mới</label>
                                    <select
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-400 outline-none bg-white"
                                        value={selectedRoleId}
                                        onChange={(e) => setSelectedRoleId(e.target.value)}
                                    >
                                        <option value="">Chọn một vai trò...</option>
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-3 pt-4">
                                    <PremiumButton
                                        variant="secondary"
                                        onClick={() => setEditingUserId(null)}
                                        className="flex-1"
                                    >
                                        Hủy
                                    </PremiumButton>
                                    <PremiumButton
                                        onClick={handleUpdateRole}
                                        className="flex-1"
                                    >
                                        Cập nhật
                                    </PremiumButton>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
            />
        </div>
    );
};

export default PersonnelTab;
