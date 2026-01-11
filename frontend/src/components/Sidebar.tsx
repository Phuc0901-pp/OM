import {
    LayoutDashboard,
    ClipboardEdit,
    User,
    LogOut,
    FileBarChart,
    Settings,
    Activity,
    Briefcase,
    Share2,
    Database,
    BarChart3,
    ChevronRight,
    Zap
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

interface SidebarProps {
    role?: string;
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar = ({ role, isOpen, onClose }: SidebarProps) => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const adminMenu = [
        { label: 'Quản lý', icon: ClipboardEdit, path: '/admin/management' },
        { label: 'Báo Cáo', icon: FileBarChart, path: '/admin/reports' },
        { label: 'Vận Hành', icon: Activity, path: '/admin/operations' },
        { label: 'Database', icon: Database, path: '/admin/database' },
    ];

    const managerMenu = [
        { label: 'Quản lý', icon: ClipboardEdit, path: '/manager/management' },
        { label: 'Báo Cáo', icon: FileBarChart, path: '/manager/reports' },
        { label: 'Phân Bổ', icon: Share2, path: '/manager/allocation' },
        { label: 'Vận hành', icon: Activity, path: '/manager/operations' },
        { label: 'Lịch sử', icon: Briefcase, path: '/manager/history' },
    ];

    const defaultMenu = [
        { label: 'Tổng quan', icon: LayoutDashboard, path: '/' },
    ];

    const userMenu = [
        { label: 'Môi trường làm việc', icon: Briefcase, path: '/user/environment' },
        { label: 'Thống kê dữ liệu', icon: BarChart3, path: '/user/statistics' },
        { label: 'Cài đặt', icon: Settings, path: '/user/settings' },
    ];

    const getMenu = () => {
        switch (role) {
            case 'admin':
                return adminMenu;
            case 'manager':
                return managerMenu;
            case 'engineer':
            case 'user':
                return userMenu;
            default:
                return defaultMenu;
        }
    };

    const menuItems = getMenu();

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/10 z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Container - MINIMAL PROFESSIONAL */}
            <aside className={`
                h-screen w-72 fixed left-0 top-0 overflow-hidden z-50 
                bg-white border-r border-slate-200
                transition-transform duration-300 ease-out flex flex-col
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                {/* Logo Area - CLEAN */}
                <div className="p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        {/* Logo */}
                        <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                            <img src="../assets/LOGO.png" alt="Smart O&M Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold text-slate-900">Raitek O&M</h1>
                            <p className="text-xs text-slate-500">System v2.0</p>
                        </div>
                    </div>
                </div>

                {/* Menu Area */}
                <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide">
                    {/* Dashboard */}
                    <NavLink
                        icon={LayoutDashboard}
                        label="Dashboard"
                        path="/"
                        active={location.pathname === '/'}
                        onClick={() => navigate('/')}
                    />

                    {/* Main Menu */}
                    <div className="mt-6">
                        <p className="px-3 mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Menu</p>
                        {menuItems.map((item, index) => (
                            <NavLink
                                key={index}
                                icon={item.icon}
                                label={item.label}
                                path={item.path}
                                active={location.pathname === item.path || location.pathname.startsWith(item.path)}
                                onClick={() => navigate(item.path)}
                            />
                        ))}
                    </div>

                    {/* Account Section */}
                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <p className="px-3 mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Tài khoản</p>
                        <NavLink
                            icon={User}
                            label="Hồ sơ"
                            path={
                                role === 'admin' ? '/admin/profile' :
                                    role === 'manager' ? '/manager/profile' :
                                        '/user/profile'
                            }
                            active={location.pathname.includes('/profile')}
                            onClick={() => {
                                const profilePath =
                                    role === 'admin' ? '/admin/profile' :
                                        role === 'manager' ? '/manager/profile' :
                                            '/user/profile';
                                navigate(profilePath);
                            }}
                        />
                    </div>
                </div>

                {/* Footer / Logout */}
                <div className="p-3 border-t border-slate-200">
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full gap-3 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="text-sm font-medium">Đăng xuất</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

interface NavLinkProps {
    icon: any;
    label: string;
    path: string;
    active: boolean;
    onClick: () => void;
}

const NavLink = ({ icon: Icon, label, path, active, onClick }: NavLinkProps) => {
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }
            `}
        >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">{label}</span>
        </button>
    );
};

export default Sidebar;
