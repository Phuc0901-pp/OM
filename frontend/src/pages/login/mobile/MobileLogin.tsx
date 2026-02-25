import { useLogin } from '../../../hooks/useLogin';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, User, Lock, X, Mail, Phone, MessageCircle, HelpCircle } from 'lucide-react';
import logo from '../../../assets/logo.png';

const MobileLogin = () => {
    const {
        email,
        setEmail,
        password,
        setPassword,
        isLoading,
        error,
        showSupport,
        setShowSupport,
        handleLogin
    } = useLogin();

    return (
        <div className="min-h-[100dvh] relative flex flex-col font-sans text-white overflow-hidden bg-slate-900">
            {/* Background Image/Gradient */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-amber-900/30" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light" />

                {/* Abstract Shapes */}
                <div className="absolute top-[-20%] right-[-20%] w-[80vw] h-[80vw] bg-primary-500/20 rounded-full blur-[80px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-secondary-500/10 rounded-full blur-[80px]" />
            </div>

            {/* Top Bar with Logo */}
            <div className="relative z-20 pt-[6vh] px-6 flex justify-between items-start">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <img src={logo} alt="RAITEK Logo" className="h-[8vh] max-h-20 object-contain drop-shadow-lg" />
                </motion.div>

                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    onClick={() => setShowSupport(true)}
                    className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-primary-400"
                >
                    <HelpCircle className="w-6 h-6" />
                </motion.button>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col justify-center px-6 -mt-[5vh]">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h1 className="font-bold leading-tight tracking-tight mb-2" style={{ fontSize: 'clamp(2rem, 8vw, 3rem)' }}>
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
                            Vận hành
                        </span>
                        <span className="block text-primary-400">
                            Bảo dưỡng
                        </span>
                    </h1>
                    <p className="text-slate-400 text-sm mb-[4vh] max-w-[80%]">
                        Chào mừng trở lại! Đăng nhập để tiếp tục.
                    </p>
                </motion.div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl text-sm flex items-center gap-2 backdrop-blur-sm"
                    >
                        <X className="w-4 h-4 text-red-400" />
                        {error}
                    </motion.div>
                )}

                <form className="space-y-[2.5vh]" onSubmit={handleLogin}>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="space-y-1.5"
                    >
                        <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Email</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors">
                                <User className="h-5 w-5 text-slate-500 group-focus-within:text-primary-400" />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full pl-11 pr-4 py-[2vh] bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all shadow-lg"
                                placeholder="name@company.com"
                                required
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="space-y-1.5"
                    >
                        <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">Mật khẩu</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors">
                                <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-primary-400" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-11 pr-4 py-[2vh] bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all shadow-lg"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="flex items-center justify-end"
                    >
                        <a href="#" className="text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors">Quên mật khẩu?</a>
                    </motion.div>

                    <motion.button
                        type="submit"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isLoading}
                        className={`w-full flex items-center justify-center py-[2vh] rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-lg shadow-lg shadow-primary-500/20 mt-4 ${isLoading ? 'opacity-80' : ''}`}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Đang xử lý...
                            </span>
                        ) : (
                            <>Đăng nhập <ArrowRight className="ml-2 w-5 h-5" /></>
                        )}
                    </motion.button>
                </form>
            </div>

            {/* Bottom Info */}
            <div className="relative z-10 p-6 text-center">
                <p className="text-xs text-slate-500">© 2026 RAITEK O&M</p>
            </div>

            {/* Support Modal Overlay */}
            <AnimatePresence>
                {showSupport && (
                    <motion.div
                        key="mobile-support-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-800 border border-white/10 rounded-3xl shadow-2xl w-full max-w-xs overflow-hidden"
                        >
                            <div className="relative bg-gradient-to-b from-slate-700 to-slate-800 p-6 text-center border-b border-white/5">
                                <button
                                    onClick={() => setShowSupport(false)}
                                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-3 ring-1 ring-primary-500/30">
                                    <MessageCircle className="w-6 h-6 text-primary-400" />
                                </div>
                                <h3 className="text-lg font-bold text-white">Liên hệ Hỗ trợ</h3>
                                <p className="text-sm text-slate-400 mt-1">Chọn phương thức liên hệ</p>
                            </div>

                            <div className="p-5 space-y-3">
                                <a href="mailto:phphuc0539@gmail.com" className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50 border border-white/5 hover:bg-slate-700 hover:border-primary-500/50 transition-all group">
                                    <div className="p-2 bg-slate-800 rounded-lg text-slate-400 group-hover:text-primary-400 transition-colors">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <div className="font-semibold text-white text-sm">Email</div>
                                        <div className="text-xs text-slate-400">Phản hồi 24h</div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-primary-400" />
                                </a>

                                <a href="tel:+84908904895" className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50 border border-white/5 hover:bg-slate-700 hover:border-primary-500/50 transition-all group">
                                    <div className="p-2 bg-slate-800 rounded-lg text-slate-400 group-hover:text-primary-400 transition-colors">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <div className="font-semibold text-white text-sm">Hotline</div>
                                        <div className="text-xs text-slate-400">Giờ hành chính</div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-primary-400" />
                                </a>

                                <a href="https://zalo.me/0908904895" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50 border border-white/5 hover:bg-slate-700 hover:border-blue-500/50 transition-all group">
                                    <div className="p-2 bg-slate-800 rounded-lg text-slate-400 group-hover:text-blue-400 transition-colors">
                                        <div className="w-5 h-5 font-bold flex items-center justify-center text-[10px] border border-current rounded-md">Z</div>
                                    </div>
                                    <div className="text-left flex-1">
                                        <div className="font-semibold text-white text-sm">Zalo Chat</div>
                                        <div className="text-xs text-slate-400">Nhắn tin ngay</div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400" />
                                </a>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MobileLogin;
