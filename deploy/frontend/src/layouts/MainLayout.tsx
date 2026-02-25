import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PageTransition from '../components/common/PageTransition';
import FloatingNotification from '../components/common/FloatingNotification';

const TITLE_MAP: Record<string, string> = {
    '/': 'Tổng quan',

    // Admin
    '/admin/profile': 'Hồ sơ Admin',
    '/admin/management': 'Quản lý',
    '/admin/reports': 'Báo cáo',
    '/admin/operations': 'Vận hành',
    '/admin/database': 'Database Inspector',

    // Manager
    '/manager/profile': 'Hồ sơ Manager',
    '/manager/management': 'Quản lý',
    '/manager/reports': 'Báo cáo',
    '/manager/allocation': 'Phân bổ',
    '/manager/operations': 'Vận hành',
    '/manager/personnel': 'Nhân sự',
    '/manager/history': 'Lịch sử',

    // User
    '/user/profile': 'Hồ sơ cá nhân',
    '/user/environment': 'Môi trường làm việc',
    '/user/statistics': 'Thống kê',
    '/user/settings': 'Cài đặt',
};

const MainLayout = () => {
    const location = useLocation();

    // Helper to find best matching title (handles nested routes if needed)
    const getTitle = () => {
        const path = location.pathname;
        if (TITLE_MAP[path]) return TITLE_MAP[path];
        // Simple fallback for exact matches not found (e.g. dynamic IDs), currently mostly exact.
        return 'Dashboard';
    };

    const title = getTitle();

    const user = React.useMemo(() => {
        try {
            const userString = localStorage.getItem('user');
            return userString ? JSON.parse(userString) : {};
        } catch (e) {
            return {};
        }
    }, []);

    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-100 selection:text-blue-900">
            {/* Sidebar */}
            <Sidebar
                role={user?.role}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <div className="flex-1 ml-0 md:ml-72 flex flex-col min-h-screen transition-all duration-300 relative">
                {/* Header */}
                <Header
                    title={title}
                    user={user}
                    onMenuClick={() => setIsSidebarOpen(true)}
                />

                {/* Main Content Area */}
                <main className="flex-1 mt-[calc(4rem+env(safe-area-inset-top))] p-4 md:p-8 overflow-y-auto overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
                    <div className="w-full h-full relative z-10">
                        <div className="w-full relative z-10 scrollbar-hide">
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="w-full"
                            >
                                <Outlet />
                            </motion.div>
                        </div>
                    </div>
                </main>

                {/* Floating Notification - Global Access */}
                <FloatingNotification />
            </div>
        </div>
    );
};

export default MainLayout;
