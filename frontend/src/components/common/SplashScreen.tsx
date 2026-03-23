import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logoSrc from '../../assets/logo.png'; // Make sure this path is correct

interface SplashScreenProps {
    onFinish?: () => void;
    duration?: number;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, duration = 2500 }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            if (onFinish) setTimeout(onFinish, 500); // Allow exit animation to finish
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onFinish]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-950 overflow-hidden"
                >
                    {/* Background Accents */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-1/2 -left-1/2 w-[100vw] h-[100vw] bg-indigo-500/5 rounded-full blur-[100px]"
                    />
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-1/2 -right-1/2 w-[100vw] h-[100vw] bg-purple-500/5 rounded-full blur-[100px]"
                    />

                    {/* Logo & Content */}
                    <div className="relative z-10 flex flex-col items-center justify-center">
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="relative mb-8"
                        >
                            <div className="w-32 h-32 md:w-40 md:h-40 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl flex items-center justify-center p-6 relative overflow-hidden ring-4 ring-white/50 dark:ring-slate-700/50">
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20"
                                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <img src={logoSrc} alt="Logo" className="w-full h-full object-contain relative z-10 drop-shadow-lg" />
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.6 }}
                            className="text-center"
                        >
                            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">
                                Solar <span className="text-indigo-600">O&M</span>
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base tracking-widest uppercase opacity-80">
                                Maintenance Management System
                            </p>
                        </motion.div>

                        {/* Progress Bar */}
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 160, opacity: 1 }}
                            transition={{ delay: 0.8, duration: 1.5, ease: "circOut" }}
                            className="h-1.5 bg-indigo-600 rounded-full mt-10 shadow-[0_0_15px_rgba(79,70,229,0.5)]"
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SplashScreen;
