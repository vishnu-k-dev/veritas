import { motion } from 'framer-motion';

/**
 * Card Component
 * Glassmorphic card with optional gold accent border
 */
export default function Card({
    children,
    className = '',
    accent = false,
    hover = true,
    padding = 'md',
    ...props
}) {
    const paddingSizes = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={hover ? { scale: 1.01 } : {}}
            className={`
        glass-panel rounded-2xl relative overflow-hidden
        ${accent ? 'border-t-4 border-t-primary' : ''}
        ${paddingSizes[padding]}
        ${hover ? 'transition-all duration-300' : ''}
        ${className}
      `}
            {...props}
        >
            {/* Ambient glow effect */}
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors pointer-events-none" />

            <div className="relative z-10">
                {children}
            </div>
        </motion.div>
    );
}
