import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, ArrowRight, Mail, Phone, MessageCircle, X, HelpCircle, Sun, ShieldCheck } from 'lucide-react';
import logo from '../../../assets/logo.png';
import { useLogin } from '../../../hooks/useLogin';

const DesktopLogin = () => {
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
        <div className="min-h-screen h-screen w-full flex bg-background font-sans text-text-main overflow-hidden">
            {/* Left Side - Brand & Visuals (Dark Mesh) */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 bg-mesh-dark overflow-hidden text-white flex-col justify-between">
                {/* Visual Elements */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-primary-500/20 rounded-full blur-[120px] mix-blend-screen animate-float" />
                    <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-secondary-500/20 rounded-full blur-[100px] mix-blend-screen animate-float" style={{ animationDelay: '-3s' }} />
                </div>

                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative z-20 pt-[6vh] pl-[6vh]"
                >
                    <img src={logo} alt="RAITEK Logo" className="h-[10vh] max-h-24 object-contain drop-shadow-2xl" />
                </motion.div>

                {/* Content */}
                <div className="relative z-10 w-full flex-1 flex flex-col justify-center px-[8vh]">
                    <div className="max-w-[80%]">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <h1 className="font-display font-bold leading-tight tracking-tight mb-[4vh] mt-[2vh]" style={{ fontSize: 'clamp(3rem, 5vw, 5rem)' }}>
                                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
                                    Vận hành
                                </span>
                                <span className="block text-primary-400 drop-shadow-lg">
                                    Bảo dưỡng
                                </span>
                            </h1>

                            <div className="h-1.5 w-[8vh] bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full mb-[4vh]" />

                            <p className="text-slate-300 leading-relaxed font-light mb-[6vh] text-lg lg:text-xl max-w-lg">
                                Giải pháp quản lý O&M toàn diện, tối ưu hóa hiệu suất và đảm bảo an toàn cho hệ thống năng lượng của Raitek.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="flex flex-wrap gap-4"
                        >
                            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all hover:scale-105 cursor-default">
                                <Sun className="w-6 h-6 text-primary-400" />
                                <span className="font-medium tracking-wide text-white/90">Hiệu suất cao</span>
                            </div>
                            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all hover:scale-105 cursor-default">
                                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                <span className="font-medium tracking-wide text-white/90">An toàn tuyệt đối</span>
                            </div>
                        </motion.div>
                    </div>
                </div>

                <div className="relative z-10 pb-[6vh] pl-[8vh] pr-[8vh] text-xs text-slate-500 font-bold tracking-widest uppercase flex justify-between">
                    <span>© 2026 RAITEK O&M</span>
                    <span>v2.4.0 IoT Tech Edition</span>
                </div>
            </div>

            {/* Right Side - Login Form (Light Mesh + Glass Card) */}
            <div className="w-full lg:w-1/2 h-full flex items-center justify-center p-4 lg:p-[4vh] relative bg-mesh-light bg-slate-50">
                {/* Floating Blobs */}
                <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary-200/40 rounded-full blur-3xl mix-blend-multiply animate-float opacity-70" />
                <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-secondary-200/40 rounded-full blur-3xl mix-blend-multiply animate-float opacity-70" style={{ animationDelay: '-2s' }} />

                {/* Glass Card */}
                <div className="w-full max-w-md 2xl:max-w-xl relative z-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-glass-lg rounded-3xl p-8 lg:p-12"
                    >
                        <div className="mb-8 text-center lg:text-left">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <h2 className="font-display font-bold text-3xl lg:text-4xl text-slate-800 mb-2">Đăng nhập</h2>
                                <p className="text-slate-500">Chào mừng trở lại! Nhập thông tin để tiếp tục.</p>
                            </motion.div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mb-6 p-4 bg-red-50/80 border border-red-100 text-red-600 rounded-xl flex items-start gap-3 text-sm shadow-sm backdrop-blur-sm"
                            >
                                <X className="w-5 h-5 shrink-0 mt-0.5" />
                                <span className="font-medium">{error}</span>
                            </motion.div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-6">
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="space-y-2"
                            >
                                <label className="text-sm font-semibold text-slate-700 ml-1">Email</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors text-slate-400 group-focus-within:text-primary-500">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3.5 bg-white/60 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 outline-none hover:bg-white/80"
                                        placeholder="name@company.com"
                                        required
                                    />
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                                className="space-y-2"
                            >
                                <label className="text-sm font-semibold text-slate-700 ml-1">Mật khẩu</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors text-slate-400 group-focus-within:text-primary-500">
                                        <Lock className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3.5 bg-white/60 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 outline-none hover:bg-white/80"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="flex items-center justify-between px-1"
                            >
                                <div className="flex items-center">
                                    <input
                                        id="remember-me"
                                        type="checkbox"
                                        className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2 transition-all cursor-pointer"
                                    />
                                    <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 cursor-pointer select-none font-medium">
                                        Ghi nhớ
                                    </label>
                                </div>
                                <div className="text-sm">
                                    <a href="#" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                                        Quên mật khẩu?
                                    </a>
                                </div>
                            </motion.div>

                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                type="submit"
                                whileHover={{ scale: 1.01, boxShadow: "0 20px 25px -5px rgba(99, 102, 241, 0.25), 0 8px 10px -6px rgba(99, 102, 241, 0.25)" }}
                                whileTap={{ scale: 0.98 }}
                                className={`w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-white font-bold text-base bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 focus:outline-none focus:ring-4 focus:ring-primary-500/30 transform transition-all duration-200 shadow-lg shadow-indigo-500/20 ${isLoading ? 'opacity-80 cursor-wait' : ''}`}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span key="loading" className="flex items-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Đang xử lý...
                                    </span>
                                ) : (
                                    <span key="idle" className="flex items-center gap-2">Đăng nhập <ArrowRight className="w-5 h-5" /></span>
                                )}
                            </motion.button>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.7 }}
                                className="pt-4 text-center"
                            >
                                <button
                                    type="button"
                                    onClick={() => setShowSupport(true)}
                                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 transition-colors font-medium px-4 py-2 rounded-full hover:bg-slate-100/50"
                                >
                                    <HelpCircle className="w-4 h-4" />
                                    Hỗ trợ kỹ thuật
                                </button>
                            </motion.div>
                        </form>
                    </motion.div>
                </div>
            </div>

            {/* Support Modal Overlay (Glass) */}
            <AnimatePresence>
                {showSupport && (
                    <motion.div
                        key="support-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl w-full max-w-sm overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative bg-gradient-to-br from-primary-50 to-indigo-50 p-6 text-center border-b border-primary-100/50">
                                <button
                                    onClick={() => setShowSupport(false)}
                                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors p-1 hover:bg-white/50 rounded-full"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glass border border-white/50">
                                    <MessageCircle className="w-8 h-8 text-primary-500" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">Trung tâm Hỗ trợ</h3>
                                <p className="text-sm text-slate-500 mt-1">Chúng tôi luôn sẵn sàng hỗ trợ 24/7</p>
                            </div>

                            <div className="p-6 space-y-3">
                                <a href="mailto:phphuc0539@gmail.com" className="flex items-center gap-4 p-4 rounded-2xl border border-white/50 bg-white/50 hover:bg-white hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/5 transition-all group">
                                    <div className="p-3 bg-indigo-50 rounded-xl text-indigo-500 group-hover:scale-110 transition-transform">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-slate-700 text-sm">Gửi Email</div>
                                        <div className="text-xs text-slate-500">phphuc0539@gmail.com</div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                                </a>

                                <a href="tel:+84908904895" className="flex items-center gap-4 p-4 rounded-2xl border border-white/50 bg-white/50 hover:bg-white hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/5 transition-all group">
                                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-slate-700 text-sm">Tổng đài Hotline</div>
                                        <div className="text-xs text-slate-500">0908 904 895</div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                                </a>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DesktopLogin;
