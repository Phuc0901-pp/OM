import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { X, User, Mail, Phone, Shield, Users, Send } from 'lucide-react';

interface UserData {
    id: string;
    full_name: string;
    email: string;
    number_phone?: string;
    role: string;
    role_id?: string;
    team?: { id: string; name: string } | null;
    team_id?: string;
    telegram_chat_id?: string;
}

interface UpdateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user: UserData | null;
}

const UpdateUserInfoModal: React.FC<UpdateUserModalProps> = ({ isOpen, onClose, onSuccess, user }) => {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        number_phone: '',
        telegram_chat_id: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            setFormData({
                full_name: user.full_name || '',
                email: user.email || '',
                number_phone: user.number_phone || '',
                telegram_chat_id: user.telegram_chat_id || ''
            });
        }
    }, [isOpen, user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setError('');
        setLoading(true);

        try {
            await api.put(`/users/${user.id}`, formData);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update user');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border border-gray-100">
                {/* Modern Header with Gradient */}
                <div className="relative px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600">
                    <div className="relative z-10 flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Cập nhật hồ sơ</h2>
                            <p className="text-blue-100 text-sm mt-1 font-medium">Quản lý thông tin cho {user.full_name}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all backdrop-blur-md border border-white/10"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Decorative Pattern Overlay */}
                    <div className="absolute inset-0 opacity-10"
                        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                            <div className="p-1 bg-red-100 rounded-full text-red-600 mt-0.5">
                                <X className="w-3 h-3" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-red-900">Cập nhật thất bại</h4>
                                <p className="text-sm text-red-600 mt-0.5">{error}</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* Full Name */}
                        <div className="group">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                                Họ và tên
                            </label>
                            <div className="relative transition-all duration-200 focus-within:transform focus-within:scale-[1.01]">
                                <div className="absolute left-0 inset-y-0 w-12 flex items-center justify-center text-gray-400 group-focus-within:text-blue-600 transition-colors">
                                    <User className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-medium text-gray-800 placeholder-gray-400 shadow-sm focus:shadow-md focus:shadow-blue-500/10"
                                    placeholder="Enter full name"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="group">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                                Địa chỉ Email
                            </label>
                            <div className="relative transition-all duration-200 focus-within:transform focus-within:scale-[1.01]">
                                <div className="absolute left-0 inset-y-0 w-12 flex items-center justify-center text-gray-400 group-focus-within:text-blue-600 transition-colors">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-medium text-gray-800 placeholder-gray-400 shadow-sm focus:shadow-md focus:shadow-blue-500/10"
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>

                        {/* Phone Number */}
                        <div className="group">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                                Số điện thoại
                            </label>
                            <div className="relative transition-all duration-200 focus-within:transform focus-within:scale-[1.01]">
                                <div className="absolute left-0 inset-y-0 w-12 flex items-center justify-center text-gray-400 group-focus-within:text-blue-600 transition-colors">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <input
                                    type="tel"
                                    value={formData.number_phone}
                                    onChange={(e) => setFormData({ ...formData, number_phone: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-medium text-gray-800 placeholder-gray-400 shadow-sm focus:shadow-md focus:shadow-blue-500/10"
                                    placeholder="e.g. 0909 123 456"
                                />
                            </div>
                        </div>

                        {/* Telegram Chat ID */}
                        <div className="group">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                                Telegram Chat ID
                            </label>
                            <div className="relative transition-all duration-200 focus-within:transform focus-within:scale-[1.01]">
                                <div className="absolute left-0 inset-y-0 w-12 flex items-center justify-center text-gray-400 group-focus-within:text-blue-600 transition-colors">
                                    <Send className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    value={formData.telegram_chat_id}
                                    onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-xl outline-none transition-all font-medium text-gray-800 placeholder-gray-400 shadow-sm focus:shadow-md focus:shadow-blue-500/10"
                                    placeholder="Nhập Chat ID"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Read-only Context Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm relative overflow-hidden group hover:border-blue-200 transition-colors">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Shield className="w-12 h-12 text-blue-600" />
                            </div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Vai trò
                            </label>
                            <div className="flex items-center gap-2 relative z-10">
                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                                <span className="font-bold text-gray-700 capitalize text-lg">{user.role}</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-colors">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Users className="w-12 h-12 text-emerald-600" />
                            </div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Nhóm
                            </label>
                            <div className="flex items-center gap-2 relative z-10">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                                <span className="font-bold text-gray-700 text-lg truncate" title={user.team ? user.team.name : 'No Team'}>
                                    {user.team ? user.team.name : 'No Team'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex flex-col-reverse md:flex-row gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors font-semibold"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-1 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all font-semibold transform active:scale-[0.98] 
                                ${loading ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Đang lưu...
                                </span>
                            ) : 'Lưu thay đổi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UpdateUserInfoModal;
