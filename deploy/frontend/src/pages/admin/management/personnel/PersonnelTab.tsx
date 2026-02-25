import { useState } from 'react';
import { Search, Plus } from 'lucide-react';

// Common Components
import AddUserModal from '../../../../components/AddUserModal';
import UpdateUserInfoModal from '../../../../components/UpdateUserInfoModal';
import AllocateLeaderModal from '../../../../components/AllocateLeaderModal';
import ConfirmModal from '../../../../components/ConfirmModal';
import PremiumTable from '../../../../components/common/PremiumTable';
import PremiumButton from '../../../../components/common/PremiumButton';
import ModernInput from '../../../../components/common/ModernInput';
import GlassCard from '../../../../components/common/GlassCard';

// Local Modules
import { usePersonnelManagement } from './usePersonnelManagement';
import { getUserColumns, getAllocationColumns } from './columns';
import ChangeRoleModal from './ChangeRoleModal';
import { SubTabType } from './types';

const PersonnelTab = () => {
    const [subTab, setSubTab] = useState<SubTabType>('all');

    const {
        // Data
        users,
        roles,
        filteredUsers,
        managers,
        loading,
        // Search
        searchTerm,
        setSearchTerm,
        // Menu
        activeMenuId,
        setActiveMenuId,
        menuRef,
        // Modals
        showAddModal,
        setShowAddModal,
        editingUserId,
        setEditingUserId,
        selectedRoleId,
        setSelectedRoleId,
        updatingUser,
        setUpdatingUser,
        allocatingUser,
        setAllocatingUser,
        confirmState,
        setConfirmState,
        // Actions
        fetchUsers,
        handleDeleteUser,
        handleUpdateRole,
    } = usePersonnelManagement();

    // Column definitions using local state setters
    const userColumns = getUserColumns({
        activeMenuId,
        setActiveMenuId,
        menuRef,
        setUpdatingUser,
        setEditingUserId,
        handleDeleteUser,
        setAllocatingUser,
    });

    const allocationColumns = getAllocationColumns(setAllocatingUser);

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
                    data={users}
                    columns={allocationColumns}
                    keyField="id"
                    isLoading={loading}
                    emptyMessage="Không có nhân sự cần phân bổ."
                />
            )}

            {/* Modals */}
            <AddUserModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={() => { fetchUsers(); }}
            />

            <UpdateUserInfoModal
                isOpen={!!updatingUser}
                onClose={() => setUpdatingUser(null)}
                onSuccess={() => { fetchUsers(); }}
                user={updatingUser}
            />

            <AllocateLeaderModal
                isOpen={!!allocatingUser}
                onClose={() => setAllocatingUser(null)}
                onSuccess={() => { fetchUsers(); }}
                targetUser={allocatingUser}
                managers={managers}
            />

            <ChangeRoleModal
                isOpen={!!editingUserId}
                roles={roles}
                selectedRoleId={selectedRoleId}
                setSelectedRoleId={setSelectedRoleId}
                onClose={() => setEditingUserId(null)}
                onConfirm={handleUpdateRole}
            />

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
