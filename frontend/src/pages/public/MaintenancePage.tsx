import { motion } from 'framer-motion';
import { HardHat, RefreshCcw } from 'lucide-react';

interface MaintenancePageProps {
    message?: string;
}

const MaintenancePage = ({ message }: MaintenancePageProps) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
                <div className="absolute top-0 right-1/3 w-64 h-64 bg-yellow-500/10 rounded-full blur-2xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="relative z-10 text-center max-w-lg"
            >
                {/* Icon */}
                <motion.div
                    animate={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    className="inline-flex items-center justify-center w-28 h-28 rounded-3xl bg-amber-400/20 border-2 border-amber-400/40 mb-8 shadow-2xl shadow-amber-500/20"
                >
                    <HardHat className="w-14 h-14 text-amber-400" />
                </motion.div>

                {/* Title */}
                <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                    Hệ thống đang{' '}
                    <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                        bảo trì
                    </span>
                </h1>

                {/* Subtitle */}
                <p className="text-slate-400 text-lg font-medium mb-6">
                    {message || 'Chúng tôi đang nâng cấp hệ thống để phục vụ bạn tốt hơn.'}
                </p>

                {/* Status bar */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-8">
                    <div className="flex items-center gap-3 justify-center">
                        <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse" />
                        <p className="text-sm text-slate-300 font-medium">
                            Quản lý sẽ thông báo ngay khi hệ thống hoạt động trở lại
                        </p>
                    </div>
                </div>

                {/* Refresh hint */}
                <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all border border-white/10 hover:border-white/30"
                >
                    <RefreshCcw className="w-4 h-4" />
                    Tải lại trang
                </button>
            </motion.div>
        </div>
    );
};

export default MaintenancePage;
