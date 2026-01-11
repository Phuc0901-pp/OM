import React, { useState, useEffect } from 'react';
import { X, UserCheck, Save } from 'lucide-react';
import api from '../services/api';

interface UserData {
    id: string;
    full_name: string;
    email: string;
    role: string;
    team: { id: string; name: string } | null;
    leader?: { id: string; full_name: string } | null;
}

interface AllocateLeaderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    targetUser: UserData | null;
    managers: UserData[];
}

const AllocateLeaderModal: React.FC<AllocateLeaderModalProps> = ({ isOpen, onClose, onSuccess, targetUser, managers }) => {
    const [selectedLeaderId, setSelectedLeaderId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && targetUser) {
            setSelectedLeaderId(targetUser.leader?.id || "");
            setError(null);
        }
    }, [isOpen, targetUser]);

    if (!isOpen || !targetUser) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await api.put(`/users/${targetUser.id}/leader`, {
                leader_id: selectedLeaderId
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Failed to assign leader", err);
            setError(err.response?.data?.error || "Failed to update leader assignment.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex justify-between items-center">
                    <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-blue-100" />
                        Phân bổ nhân sự
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-6">

                        {/* Target User Info */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Nhân viên</label>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                    {targetUser.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-medium text-gray-900">{targetUser.full_name}</div>
                                    <div className="text-sm text-gray-500">{targetUser.email}</div>
                                </div>
                            </div>
                        </div>

                        {/* Leader Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Gán Trưởng nhóm (Quản lý)
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedLeaderId}
                                    onChange={(e) => setSelectedLeaderId(e.target.value)}
                                    className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all appearance-none"
                                >
                                    <option value="">-- Chưa gán Trưởng nhóm --</option>
                                    {managers.map(manager => (
                                        <option key={manager.id} value={manager.id}>
                                            {manager.full_name} ({manager.email})
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 ml-1">
                                Chọn quản lý để phụ trách nhân viên này.
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Lưu phân bổ
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AllocateLeaderModal;
