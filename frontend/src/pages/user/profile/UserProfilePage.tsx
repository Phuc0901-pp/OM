import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, Briefcase, Shield, Calendar, Edit2, Camera, Wrench, Globe } from 'lucide-react';
import api from '../../../services/api';
import GlassCard from '../../../components/common/GlassCard';
import PremiumButton from '../../../components/common/PremiumButton';
import EditProfileModal from '../../../components/modals/EditProfileModal';
import { useLanguageStore } from '../../../stores/useLanguageStore';

interface UserProfile {
 id: string;
 name: string; // V2: was full_name
 email: string;
 number_phone?: string;
 role?: { name: string };
 role_name?: string;
 team?: {
 name: string;
 };
 created_at: string;
}

const UserProfilePage = () => {
 const { language, setLanguage } = useLanguageStore();
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

 const userString = sessionStorage.getItem('user');
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
 <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
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
 {/* Header Banner - User Emerald Theme */}
 <div className="relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl shadow-emerald-500/30">
 <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-green-600 opacity-95"></div>
 <div className="absolute top-0 right-0 p-4 opacity-10">
 <Wrench className="w-64 h-64" />
 </div>
 <div className="relative z-10 flex items-center justify-between">
 <div className="flex items-center gap-6">
 <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner border border-white/30">
 <User className="w-10 h-10 text-white" />
 </div>
 <div>
 <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Hồ sơ cá nhân</h1>
 <p className="text-emerald-100 font-medium text-lg opacity-90">Thông tin kỹ thuật viên</p>
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
 <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 p-1 shadow-xl shadow-emerald-300">
 <div className="w-full h-full bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
 <span className="text-white font-black text-5xl">
 {(profile.name || '?').charAt(0).toUpperCase()}
 </span>
 </div>
 </div>
 <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg hover:shadow-xl transition-all border-2 border-emerald-100 hover:border-emerald-300">
 <Camera className="w-4 h-4 text-emerald-600" />
 </button>
 </div>

 {/* Name */}
 <h2 className="text-2xl font-black text-slate-800 mb-2">{profile.name}</h2>

 {/* Role Badge */}
 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 mb-6 bg-emerald-100 text-emerald-700 border-emerald-300">
 <Wrench className="w-4 h-4" />
 <span className="font-bold uppercase text-sm tracking-wider">
 {profile.role?.name || profile.role_name || 'engineer'}
 </span>
 </div>

 {/* Team Info */}
 {profile.team && (
 <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
 <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Đội nhóm</p>
 <p className="text-sm font-bold text-slate-800">{profile.team.name}</p>
 </div>
 )}

 {/* Edit Button */}
 <PremiumButton
 className="w-full mt-6"
 icon={<Edit2 className="w-4 h-4" />}
 variant="glass"
 onClick={() => setIsEditModalOpen(true)}
 >
 Chỉnh sửa hồ sơ
 </PremiumButton>
 </GlassCard>

 {/* Account Info Card */}
 <GlassCard>
 <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
 <Calendar className="w-5 h-5 text-emerald-600" />
 Thông tin tài khoản
 </h3>
 <div className="space-y-3">
 <div className="flex justify-between items-center py-2 border-b border-slate-100">
 <span className="text-sm text-slate-500 font-medium">Ngày tham gia</span>
 <span className="text-sm font-bold text-slate-700">
 {new Date(profile.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
 </span>
 </div>
 <div className="flex justify-between items-center py-2">
 <span className="text-sm text-slate-500 font-medium">ID</span>
 <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
 {profile.id.slice(0, 8)}...
 </span>
 </div>
 </div>

 {/* Language Toggle */}
 <div className="mt-4 pt-4 border-t border-slate-200">
 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 text-left">Cài đặt giao diện</h3>
 <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl transition-colors mt-3">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-white rounded-lg shadow-sm">
 <Globe className="w-5 h-5 text-emerald-600" />
 </div>
 <div className="text-left">
 <p className="text-sm font-bold text-slate-700">Ngôn ngữ</p>
 <p className="text-xs text-slate-500">Giao diện hệ thống</p>
 </div>
 </div>
 <select
 value={language}
 onChange={(e) => setLanguage(e.target.value as any)}
 className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold outline-none bg-white transition-all cursor-pointer shadow-sm text-slate-700"
 >
 <option value="vi">VNI</option>
 <option value="en">ENG</option>
 </select>
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
 <div className="p-3 bg-emerald-100 rounded-xl">
 <Mail className="w-5 h-5 text-emerald-600" />
 </div>
 <div className="flex-1">
 <p className="text-xs font-bold text-slate-500 uppercase mb-1">Email</p>
 <p className="text-base font-bold text-slate-800">{profile.email}</p>
 </div>
 </div>

 {/* Phone */}
 <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
 <div className="p-3 bg-teal-100 rounded-xl">
 <Phone className="w-5 h-5 text-teal-600" />
 </div>
 <div className="flex-1">
 <p className="text-xs font-bold text-slate-500 uppercase mb-1">Số điện thoại</p>
 <p className="text-base font-bold text-slate-800">
 {profile.number_phone || 'Chưa cập nhật'}
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
 {'Chưa cập nhật'}
 </p>
 </div>
 </div>

 {/* Role */}
 <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
 <div className="p-3 bg-emerald-100 rounded-xl">
 <Briefcase className="w-5 h-5 text-emerald-600" />
 </div>
 <div className="flex-1">
 <p className="text-xs font-bold text-slate-500 uppercase mb-1">Vai trò</p>
 <p className="text-base font-bold text-slate-800 capitalize">{profile.role?.name || profile.role_name || 'engineer'}</p>
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

export default UserProfilePage;
