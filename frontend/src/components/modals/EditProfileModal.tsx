import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Phone, Mail, Save, Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import api from '../../services/api';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    number_phone?: string;
}

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile;
    onUpdate: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, user, onUpdate }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        number_phone: '',
    });
    const [passwordData, setPasswordData] = useState({
        old_password: '',
        new_password: '',
        confirm_password: '',
    });
    const [showPasswords, setShowPasswords] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (user && isOpen) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                number_phone: user.number_phone || '',
            });
            setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
            setError(null);
            setSuccess(null);
        }
    }, [user, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Update profile info
            await api.put(`/users/${user.id}`, {
                full_name: formData.name,
                email: formData.email,
                number_phone: formData.number_phone,
            });

            // Change password if fields are filled
            if (passwordData.old_password || passwordData.new_password) {
                if (!passwordData.old_password) {
                    setError('Vui lòng nhập mật khẩu cũ');
                    setLoading(false);
                    return;
                }
                if (passwordData.new_password.length < 6) {
                    setError('Mật khẩu mới phải có ít nhất 6 ký tự');
                    setLoading(false);
                    return;
                }
                if (passwordData.new_password !== passwordData.confirm_password) {
                    setError('Mật khẩu xác nhận không khớp');
                    setLoading(false);
                    return;
                }
                await api.put(`/users/${user.id}/password`, {
                    old_password: passwordData.old_password,
                    new_password: passwordData.new_password,
                });
            }

            setSuccess('Cập nhật thành công!');
            setTimeout(() => {
                onUpdate();
                onClose();
            }, 800);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Có lỗi xảy ra khi cập nhật hồ sơ');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClass = 'w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-400 text-slate-700 font-medium';

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800">Cập nhật thông tin</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>
                        )}
                        {success && (
                            <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">{success}</div>
                        )}

                        {/* ---- Profile Info ---- */}
                        <div className="space-y-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thông tin cơ bản</p>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Họ và tên</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputClass} placeholder="Nhập họ và tên" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} required className={inputClass} placeholder="Nhập địa chỉ email" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Số điện thoại</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="tel" name="number_phone" value={formData.number_phone} onChange={handleChange} className={inputClass} placeholder="Nhập số điện thoại" />
                                </div>
                            </div>
                        </div>

                        {/* ---- Change Password ---- */}
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đổi mật khẩu <span className="text-slate-300 font-normal normal-case">(tuỳ chọn)</span></p>
                                <button type="button" onClick={() => setShowPasswords(prev => !prev)} className="text-xs text-blue-500 font-medium hover:underline">
                                    {showPasswords ? 'Ẩn' : 'Hiện'}
                                </button>
                            </div>

                            {showPasswords && (
                                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Mật khẩu cũ</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input type="password" name="old_password" value={passwordData.old_password} onChange={handlePasswordChange} className={inputClass} placeholder="Nhập mật khẩu cũ" autoComplete="current-password" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Mật khẩu mới</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input type="password" name="new_password" value={passwordData.new_password} onChange={handlePasswordChange} className={`${inputClass} pr-10`} placeholder="Tối thiểu 6 ký tự" autoComplete="new-password" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Xác nhận mật khẩu</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input type="password" name="confirm_password" value={passwordData.confirm_password} onChange={handlePasswordChange} className={`${inputClass} pr-10`} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Buttons */}
                        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-50 mt-2">
                            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors disabled:opacity-50">
                                Hủy bỏ
                            </button>
                            <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-shadow shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed">
                                {loading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /><span>Đang lưu...</span></>
                                ) : (
                                    <><Save className="w-4 h-4" /><span>Lưu thay đổi</span></>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default EditProfileModal;
