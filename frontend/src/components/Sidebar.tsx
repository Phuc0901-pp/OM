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
    BarChart3,
    History
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';

interface SidebarProps {
    role?: string;
    isOpen: boolean;
    onClose: () => void;
}

// Imports
import { useLanguageStore } from '../stores/useLanguageStore';
const Sidebar = ({ role, isOpen, onClose }: SidebarProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguageStore();

    const handleLogout = async () => {
        // Notify server to set status_user = 0
        await authService.logout();
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        navigate('/login');
    };

    const managerMenu = [
        { label: t('sidebar.management'), icon: ClipboardEdit, path: '/manager/management' },
        { label: t('sidebar.reports'), icon: FileBarChart, path: '/manager/reports' },
        { label: t('sidebar.allocation'), icon: Share2, path: '/manager/allocation' },
        { label: t('sidebar.operations'), icon: Activity, path: '/manager/operations' },
        { label: t('sidebar.history'), icon: Briefcase, path: '/manager/history' },
    ];

    const defaultMenu = [
        { label: t('sidebar.dashboard'), icon: LayoutDashboard, path: '/home' },
    ];

    const userMenu = [
        { label: t('sidebar.environment'), icon: Briefcase, path: '/user/environment' },
        { label: t('sidebar.statistics'), icon: BarChart3, path: '/user/statistics' },
        { label: t('sidebar.history'), icon: History, path: '/user/history' },
        { label: t('sidebar.settings'), icon: Settings, path: '/user/settings' },
    ];

    const getMenu = () => {
        if (role === 'manager' || role === 'admin') {
            return managerMenu;
        }
        // Tất cả các roles khác đều xài chung menu của engineer
        return userMenu;
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
                <div className="p-6 border-b border-slate-200 ">
                    <div className="flex items-center gap-3">
                        {/* Logo */}
                        <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                            <img src="/logo.png" alt="Smart O&M Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold text-slate-900 ">Raitek O&M</h1>
                            <p className="text-xs text-slate-500 ">Version 6.5.0</p>
                        </div>
                    </div>
                </div>

                {/* Menu Area */}
                <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide">
                    {/* Dashboard */}
                    <NavLink
                        icon={LayoutDashboard}
                        label={t('sidebar.dashboard')}
                        path="/home"
                        active={location.pathname === '/home' || location.pathname === '/'}
                        onClick={() => navigate('/home')}
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

                    {/* Account Section - Only for Manager/Admin */}
                    {(role === 'manager' || role === 'admin') && (
                        <div className="mt-6 pt-6 border-t border-slate-200 ">
                            <p className="px-3 mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Tài khoản</p>
                            <NavLink
                                icon={User}
                                label={t('sidebar.profile')}
                                path={'/manager/profile'}
                                active={location.pathname.includes('/profile')}
                                onClick={() => {
                                    navigate('/manager/profile');
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Footer / Logout */}
                <div className="p-3 border-t border-slate-200 ">
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full gap-3 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="text-sm font-medium">{t('sidebar.logout')}</span>
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
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 '
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 '
                }
 `}
        >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">{label}</span>
        </button>
    );
};

export default Sidebar;
