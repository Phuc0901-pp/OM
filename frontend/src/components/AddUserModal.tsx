import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { X, User, Mail, Lock, Shield, Users, Plus, Check, Phone, Send } from 'lucide-react';

interface Role {
    id: string;
    name: string;
}

interface Team {
    id: string;
    name: string;
}

interface AddUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    forceLeaderId?: string; // If provided, auto-assign this leader to the new user (e.g. manager's own ID)
}

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onSuccess, forceLeaderId }) => {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        number_phone: '',
        telegram_chat_id: '',
        password: '',
        role_id: '',
        team_id: ''
    });
    const [roles, setRoles] = useState<Role[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // State for adding new Role/Team
    const [isAddingRole, setIsAddingRole] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [isAddingTeam, setIsAddingTeam] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchRoles();
            fetchTeams();
        }
    }, [isOpen]);

    const fetchRoles = async () => {
        try {
            const response = await api.get('/roles');
            setRoles(response.data);
        } catch (err) {
            console.error('Failed to fetch roles', err);
        }
    };

    const fetchTeams = async () => {
        try {
            const response = await api.get('/teams');
            setTeams(response.data);
        } catch (err) {
            console.error('Failed to fetch teams', err);
        }
    };

    const handleAddRole = async () => {
        if (!newRoleName.trim()) return;
        try {
            const response = await api.post('/roles', { name: newRoleName });
            const newRole = response.data;
            setRoles([...roles, newRole]);
            setFormData({ ...formData, role_id: newRole.id });
            setIsAddingRole(false);
            setNewRoleName('');
        } catch (err) {
            console.error('Failed to create role', err);
            setError('Failed to create role');
        }
    };

    const handleAddTeam = async () => {
        if (!newTeamName.trim()) return;
        try {
            const response = await api.post('/teams', { name: newTeamName });
            const newTeam = response.data;
            setTeams([...teams, newTeam]);
            setFormData({ ...formData, team_id: newTeam.id });
            setIsAddingTeam(false);
            setNewTeamName('');
        } catch (err) {
            console.error('Failed to create team', err);
            setError('Failed to create team');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/users', {
                ...formData,
                ...(forceLeaderId ? { leader_id: forceLeaderId } : {}),
            });
            // Reset form
            setFormData({
                full_name: '',
                email: '',
                number_phone: '',
                telegram_chat_id: '',
                password: '',
                role_id: '',
                team_id: ''
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800">Thêm người dùng mới</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Họ và tên
                        </label>
                        <div className="relative">
                            <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                required
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                                placeholder="Nguyễn Văn A"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email
                        </label>
                        <div className="relative">
                            <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                                placeholder="email@company.com"
                            />
                        </div>
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Số điện thoại
                        </label>
                        <div className="relative">
                            <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="tel"
                                value={formData.number_phone}
                                onChange={(e) => setFormData({ ...formData, number_phone: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                                placeholder="0909 123 456"
                            />
                        </div>
                    </div>

                    {/* Telegram Chat ID */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Telegram Chat ID <span className="text-gray-400 font-normal">(Tùy chọn)</span>
                        </label>
                        <div className="relative">
                            <Send className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={formData.telegram_chat_id}
                                onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                                placeholder="Nhập Chat ID (nếu có)"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Mật khẩu
                        </label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                                placeholder="Tối thiểu 6 ký tự"
                            />
                        </div>
                    </div>

                    {/* Role */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Vai trò
                        </label>
                        <div className="flex gap-2">
                            {isAddingRole ? (
                                <div className="flex-1 flex gap-2">
                                    <input
                                        type="text"
                                        value={newRoleName}
                                        onChange={(e) => setNewRoleName(e.target.value)}
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                                        placeholder="Nhập vai trò mới"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddRole}
                                        className="p-2 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors"
                                    >
                                        <Check className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingRole(false)}
                                        className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative flex-1">
                                        <Shield className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <select
                                            required
                                            value={formData.role_id}
                                            onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all appearance-none bg-white"
                                        >
                                            <option value="">Chọn vai trò...</option>
                                            {roles.map((role) => (
                                                <option key={role.id} value={role.id}>
                                                    {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingRole(true)}
                                        className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
                                        title="Thêm vai trò mới"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Team */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nhóm <span className="text-gray-400 font-normal">(Tùy chọn)</span>
                        </label>
                        <div className="flex gap-2">
                            {isAddingTeam ? (
                                <div className="flex-1 flex gap-2">
                                    <input
                                        type="text"
                                        value={newTeamName}
                                        onChange={(e) => setNewTeamName(e.target.value)}
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                                        placeholder="Nhập nhóm mới"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddTeam}
                                        className="p-2 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors"
                                    >
                                        <Check className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingTeam(false)}
                                        className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative flex-1">
                                        <Users className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <select
                                            value={formData.team_id}
                                            onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all appearance-none bg-white"
                                        >
                                            <option value="">Không có nhóm</option>
                                            {teams.map((team) => (
                                                <option key={team.id} value={team.id}>
                                                    {team.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingTeam(true)}
                                        className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
                                        title="Thêm nhóm mới"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Đang tạo...' : 'Tạo người dùng'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default AddUserModal;
