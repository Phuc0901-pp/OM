import { motion, HTMLMotionProps } from 'framer-motion';
import { ReactNode } from 'react';

interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

const GlassCard = ({ children, className = '', hoverEffect = false, ...props }: GlassCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            whileHover={hoverEffect ? { y: -4, transition: { duration: 0.2 } } : {}}
            className={`bg-white/60 backdrop-blur-md border border-white/40 shadow-sm rounded-2xl p-6 relative ${className}`}
            {...props}
        >
            <div className="relative z-10">{children}</div>

            {/* Subtle Gradient Overlay - ensuring it doesn't bleed if overflow is visible */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-2xl" />
        </motion.div>
    );
};

export default GlassCard;
