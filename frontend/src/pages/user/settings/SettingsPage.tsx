import React, { useState, useEffect } from 'react';
import {
    Mail,
    Shield,
    Users,
    Lock,
    Bell,
    Globe,
    Moon,
    Save,
    User,
    Key,
    Settings as SettingsIcon,
    Sparkles
} from 'lucide-react';
import api from '../../../services/api';
import SettingItem from '../../../components/SettingItem';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 max-w-2xl mx-auto">
                    <div className="relative overflow-hidden bg-gradient-to-br from-red-50 via-white to-red-50 border border-red-200 rounded-2xl p-8 shadow-xl">
                        <h2 className="text-2xl font-bold text-red-900 mb-2">Có lỗi xảy ra</h2>
                        <pre className="text-red-700 text-sm">{this.state.error?.toString()}</pre>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const SettingsPageContent = () => {
    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [language, setLanguage] = useState('vi');

    // State for user data
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const handlePasswordChange = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement password change logic
        alert('Chức năng đổi mật khẩu sẽ được cập nhật sau');
    };

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userStr = localStorage.getItem('user');
                if (!userStr) return;

                const localUser = JSON.parse(userStr);
                const response = await api.get(`/users/${localUser.id}`);
                if (response.data) {
                    setUser(response.data);
                }
            } catch (error) {
                console.error("Failed to fetch user data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[60vh]">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
                    <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-600 animate-pulse" />
                </div>
                <span className="ml-4 text-gray-600 font-medium">Đang tải...</span>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <div className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50 border border-gray-200 rounded-2xl p-8 shadow-xl text-center">
                    <p className="text-gray-600 font-medium">Không tìm thấy người dùng</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
                {/* Premium Header */}
                <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl border border-white/20">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl -z-10"></div>
                    <div className="relative z-10">
                        <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                            Cài đặt
                        </h1>
                        <p className="text-gray-600 font-medium">Quản lý thông tin cá nhân và tùy chọn</p>
                    </div>
                </div>

                {/* Premium Profile Section */}
                <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl border border-white/20">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-indigo-400/10 to-purple-600/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                <User className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                Thông tin hồ sơ
                            </h2>
                        </div>

                        <div className="flex flex-col md:flex-row items-start gap-6 mb-6">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative w-24 h-24 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-3xl font-black shadow-2xl">
                                    {user.full_name?.charAt(0).toUpperCase()}
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-1">
                                    {user.full_name}
                                </h3>
                                <p className="text-gray-600 mb-3">{user.email}</p>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg">
                                        {user.role || 'User'}
                                    </span>
                                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-xl font-medium">
                                        Tham gia {new Date(user.created_at).toLocaleDateString('vi-VN')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/5 group-hover:to-indigo-500/5 transition-all duration-300"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                                        <Mail className="w-5 h-5 text-blue-600" />
                                        <span className="text-sm font-semibold">Email</span>
                                    </div>
                                    <p className="font-bold text-gray-900">{user.email}</p>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all duration-300">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 transition-all duration-300"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                                        <Shield className="w-5 h-5 text-indigo-600" />
                                        <span className="text-sm font-semibold">Vai trò</span>
                                    </div>
                                    <p className="font-bold text-gray-900">{user.role}</p>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden p-5 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-lg transition-all duration-300 md:col-span-2">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/5 group-hover:to-pink-500/5 transition-all duration-300"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                                        <Users className="w-5 h-5 text-purple-600" />
                                        <span className="text-sm font-semibold">Nhóm</span>
                                    </div>
                                    <p className="font-bold text-gray-900">{user.team?.name || 'Chưa tham gia nhóm'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Premium Change Password Section */}
                <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl border border-white/20">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-400/10 to-indigo-600/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                                <Key className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                Đổi mật khẩu
                            </h2>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Mật khẩu hiện tại
                                </label>
                                <div className="relative group">
                                    <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-blue-600 absolute left-4 top-1/2 -translate-y-1/2 transition-colors" />
                                    <input
                                        type="password"
                                        value={passwordForm.currentPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium"
                                        placeholder="Nhập mật khẩu hiện tại"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Mật khẩu mới
                                </label>
                                <div className="relative group">
                                    <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 absolute left-4 top-1/2 -translate-y-1/2 transition-colors" />
                                    <input
                                        type="password"
                                        value={passwordForm.newPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium"
                                        placeholder="Nhập mật khẩu mới"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Xác nhận mật khẩu mới
                                </label>
                                <div className="relative group">
                                    <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-purple-600 absolute left-4 top-1/2 -translate-y-1/2 transition-colors" />
                                    <input
                                        type="password"
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-500 transition-all font-medium"
                                        placeholder="Xác nhận mật khẩu mới"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="group relative w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all font-bold flex items-center justify-center gap-2"
                            >
                                <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <Save className="w-5 h-5 relative z-10" />
                                <span className="relative z-10">Cập nhật mật khẩu</span>
                            </button>
                        </form>
                    </div>
                </div>

                {/* Premium Preferences Section */}
                <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl border border-white/20">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-purple-400/10 to-pink-600/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                                <SettingsIcon className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                Tùy chọn
                            </h2>
                        </div>

                        <div className="space-y-3">
                            <SettingItem
                                icon={Bell}
                                title="Thông báo"
                                description="Nhận thông báo cho các cập nhật mới"
                                action={
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={notifications}
                                            onChange={(e) => setNotifications(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-indigo-600 shadow-lg"></div>
                                    </label>
                                }
                            />

                            <SettingItem
                                icon={Moon}
                                title="Chế độ tối"
                                description="Bật giao diện tối cho trải nghiệm tốt hơn vào ban đêm"
                                action={
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={darkMode}
                                            onChange={(e) => setDarkMode(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-600 peer-checked:to-purple-600 shadow-lg"></div>
                                    </label>
                                }
                            />

                            <SettingItem
                                icon={Globe}
                                title="Ngôn ngữ"
                                description="Chọn ngôn ngữ hiển thị"
                                action={
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-500 bg-white hover:border-purple-300 transition-all cursor-pointer"
                                    >
                                        <option value="vi">Tiếng Việt</option>
                                        <option value="en">English</option>
                                    </select>
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.6s ease-out;
                }
            `}</style>
        </div>
    );
};

const SettingsPage = () => (
    <ErrorBoundary>
        <SettingsPageContent />
    </ErrorBoundary>
);

export default SettingsPage;
