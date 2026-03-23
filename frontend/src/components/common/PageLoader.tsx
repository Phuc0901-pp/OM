import React from 'react';
import { motion } from 'framer-motion';

const PageLoader: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-6">
                {/* Spinner with Pulse Effect */}
                <div className="relative transform scale-150">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-200 dark:border-slate-800"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-t-indigo-600 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30 animate-ping"></div>
                </div>

                {/* Text Animation */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                    className="flex flex-col items-center gap-1"
                >
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 tracking-widest uppercase">
                        Loading
                    </p>
                    <div className="flex gap-1">
                        <motion.div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                        <motion.div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                        <motion.div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default PageLoader;
