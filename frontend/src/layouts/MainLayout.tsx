import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import type { LocalUser } from '../types/models';
import { useLocationStore } from '../stores/useLocationStore';

const TITLE_MAP: Record<string, string> = {
    '/': 'Tổng quan',

    // Admin


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

    const user = React.useMemo((): LocalUser & { _roleName: string } => {
        try {
            const userString = sessionStorage.getItem('user');
            const parsed: LocalUser = userString ? JSON.parse(userString) : {};
            // Normalize role: if it's an object { id, name }, extract the name string
            const _roleName = typeof parsed.role === 'object' && parsed.role !== null
                ? (parsed.role?.name || '')
                : (typeof parsed.role === 'string' ? parsed.role : '');
            return { ...parsed, _roleName };
        } catch (e) {
            return { id: '', email: '', name: '', _roleName: '' };
        }
    }, []);

    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    // ── Global GPS Tracking ───────────────────────────────────────────────────
    const { startTracking, stopTracking } = useLocationStore();
    useEffect(() => {
        startTracking();
        return () => stopTracking();
    }, []);





    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-100 selection:text-blue-900">
            {/* Sidebar */}
            <Sidebar
                role={user?._roleName}
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


            </div>
        </div>
    );
};

export default MainLayout;
