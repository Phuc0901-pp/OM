import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../../../services/api';
import { UserData, RoleData, SortConfig, ConfirmState } from './types';

export const usePersonnelManagement = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [roles, setRoles] = useState<RoleData[]>([]);
    const [loading, setLoading] = useState(true);

    // Search & Sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [selectedRoleId, setSelectedRoleId] = useState<string>("");
    const [updatingUser, setUpdatingUser] = useState<UserData | null>(null);
    const [allocatingUser, setAllocatingUser] = useState<UserData | null>(null);

    // Menu State
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Confirm Modal
    const [confirmState, setConfirmState] = useState<ConfirmState>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    // --- Data Fetching ---
    const fetchUsers = useCallback(async () => {
        try {
            const response = await api.get('/users');
            setUsers(response.data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchRoles = useCallback(async () => {
        try {
            const response = await api.get('/roles');
            setRoles(response.data);
        } catch (error) {
            console.error("Failed to fetch roles", error);
        }
    }, []);

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
    }, [fetchUsers, fetchRoles]);

    // --- Handlers ---
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
            await api.put(`/users/${editingUserId}/role`, { role_id: selectedRoleId });
            setEditingUserId(null);
            fetchUsers();
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

    // --- Derived Data ---
    const getSortedUsers = useCallback(() => {
        let sortableUsers = [...users];

        const storedUser = localStorage.getItem('user');
        const currentUser = storedUser ? JSON.parse(storedUser) : null;
        const isManager = currentUser?.role === 'manager';
        const currentUserId = currentUser?.id;

        // Filter
        if (searchTerm) {
            sortableUsers = sortableUsers.filter(user => {
                const matchesSearch = (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.email?.toLowerCase().includes(searchTerm.toLowerCase()));
                if (isManager) {
                    return matchesSearch && user.leader?.id === currentUserId;
                }
                return matchesSearch;
            });
        } else {
            sortableUsers = sortableUsers.filter(user => {
                if (isManager) {
                    return user.leader?.id === currentUserId;
                }
                return true;
            });
        }

        // Sort
        if (sortConfig !== null) {
            sortableUsers.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof UserData];
                let bValue: any = b[sortConfig.key as keyof UserData];

                if (sortConfig.key === 'team') {
                    aValue = a.team?.name || '';
                    bValue = b.team?.name || '';
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableUsers;
    }, [users, searchTerm, sortConfig]);

    const filteredUsers = getSortedUsers();
    const managers = users.filter(u => u.role === 'manager');

    return {
        // Data
        users,
        roles,
        filteredUsers,
        managers,
        loading,
        // Search & Sort
        searchTerm,
        setSearchTerm,
        sortConfig,
        handleSort,
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
    };
};
