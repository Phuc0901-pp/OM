import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, Briefcase, Shield, Calendar, Edit2, Camera, Users, Moon } from 'lucide-react';
import api from '../../../services/api';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';
import EditProfileModal from '../../../components/modals/EditProfileModal';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';

interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    role: string;
    address?: string;
    telegram_chat_id?: string;
    team?: {
        name: string;
    };
    created_at: string;
}

const ManagerProfilePage = () => {
    const { theme, toggleTheme } = useTheme();
    const { t } = useLanguage();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            setError(null);

            const userString = localStorage.getItem('user');
            if (!userString) {
                setError('Không tìm thấy thông tin đăng nhập');
                return;
            }

            const currentUser = JSON.parse(userString);
            const response = await api.get(`/users?email=${currentUser.email}`);

            if (response.data && response.data.length > 0) {
                setProfile(response.data[0]);
            } else {
                setError('Không tìm thấy thông tin người dùng');
            }
        } catch (err: any) {
            console.error('Error fetching profile:', err);
            setError(err.response?.data?.error || 'Không thể tải thông tin cá nhân');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">Đang tải thông tin...</p>
                </div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <GlassCard className="text-center p-8 max-w-md !bg-red-50 !border-red-200">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-red-700 mb-2">Không thể tải thông tin</h3>
                    <p className="text-red-600/80 mb-4">{error || 'Đã xảy ra lỗi'}</p>
                    <PremiumButton onClick={fetchProfile} variant="danger">
                        Thử lại
                    </PremiumButton>
                </GlassCard>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pb-10"
        >
            {/* Header Banner - Manager Blue Theme */}
            <div className="relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl shadow-blue-500/30">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-600 opacity-95"></div>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Users className="w-64 h-64" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner border border-white/30">
                            <Briefcase className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Hồ sơ Manager</h1>
                            <p className="text-blue-100 font-medium text-lg opacity-90">Thông tin quản lý</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Avatar & Quick Info */}
                <div className="lg:col-span-1 space-y-6">
                    <GlassCard className="text-center">
                        {/* Avatar */}
                        <div className="relative inline-block mb-6">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 p-1 shadow-xl shadow-blue-300">
                                <div className="w-full h-full bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                    <span className="text-white font-black text-5xl">
                                        {profile.full_name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg hover:shadow-xl transition-all border-2 border-blue-100 hover:border-blue-300">
                                <Camera className="w-4 h-4 text-blue-600" />
                            </button>
                        </div>

                        {/* Name */}
                        <h2 className="text-2xl font-black text-slate-800 mb-2">{profile.full_name}</h2>

                        {/* Role Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 mb-6 bg-blue-100 text-blue-700 border-blue-300">
                            <Briefcase className="w-4 h-4" />
                            <span className="font-bold uppercase text-sm tracking-wider">
                                {profile.role}
                            </span>
                        </div>

                        {/* Team Info */}
                        {profile.team && (
                            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-100">
                                <p className="text-xs font-bold text-blue-600 uppercase mb-1">Đội nhóm</p>
                                <p className="text-sm font-bold text-slate-800">{profile.team.name}</p>
                            </div>
                        )}

                        {/* Edit Button */}
                        <PremiumButton
                            className="w-full mb-4"
                            icon={<Edit2 className="w-4 h-4" />}
                            variant="glass"
                            onClick={() => setIsEditModalOpen(true)}
                        >
                            Chỉnh sửa hồ sơ
                        </PremiumButton>

                        {/* Preferences Card (Dark Mode) */}
                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 text-left">Cài đặt giao diện</h3>
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                                        <Moon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Chế độ tối</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Giao diện ban đêm</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={theme === 'dark'}
                                        onChange={toggleTheme}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    </GlassCard>


                </div>

                {/* Right Column - Detailed Info */}
                <div className="lg:col-span-2">
                    <GlassCard>
                        <h3 className="text-xl font-bold text-slate-800 mb-6">Thông tin chi tiết</h3>

                        <div className="space-y-6">
                            {/* Email */}
                            <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                                <div className="p-3 bg-blue-100 rounded-xl">
                                    <Mail className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Email</p>
                                    <p className="text-base font-bold text-slate-800">{profile.email}</p>
                                </div>
                            </div>

                            {/* Phone */}
                            <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                                <div className="p-3 bg-emerald-100 rounded-xl">
                                    <Phone className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Số điện thoại</p>
                                    <p className="text-base font-bold text-slate-800">
                                        {profile.phone || 'Chưa cập nhật'}
                                    </p>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                                <div className="p-3 bg-amber-100 rounded-xl">
                                    <MapPin className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Địa chỉ</p>
                                    <p className="text-base font-bold text-slate-800">
                                        {profile.address || 'Chưa cập nhật'}
                                    </p>
                                </div>
                            </div>

                            {/* Role */}
                            <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                                <div className="p-3 bg-blue-100 rounded-xl">
                                    <Briefcase className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Vai trò</p>
                                    <p className="text-base font-bold text-slate-800 capitalize">{profile.role}</p>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            </div>

            {/* Edit Profile Modal */}
            {profile && (
                <EditProfileModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    user={profile}
                    onUpdate={() => {
                        fetchProfile();
                        setIsEditModalOpen(false);
                    }}
                />
            )}
        </motion.div>
    );
};

export default ManagerProfilePage;
