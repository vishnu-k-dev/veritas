import { motion } from 'framer-motion';

/**
 * Stat Card Component
 * Glassmorphic stat display with icon, value, and trend
 */
export default function StatCard({
    icon,
    label,
    value,
    suffix = '',
    trend,
    trendValue,
    className = ''
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            className={`stat-card group ${className}`}
        >
            {/* Ambient glow */}
            <div className="absolute -right-6 -top-6 size-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />

            <div className="relative z-10">
                {/* Header: Icon + Trend */}
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-primary">
                        <span className="material-symbols-outlined">{icon}</span>
                    </div>

                    {trend && (
                        <span className={trend === 'up' ? 'trend-up' : 'trend-down'}>
                            <span className="material-symbols-outlined text-[14px]">
                                {trend === 'up' ? 'trending_up' : 'trending_down'}
                            </span>
                            {trendValue}
                        </span>
                    )}
                </div>

                {/* Value */}
                <div>
                    <p className="text-text-muted text-sm font-medium mb-1">{label}</p>
                    <div className="flex items-end gap-1">
                        <motion.p
                            className="text-4xl font-bold text-white tracking-tight"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            {value}
                        </motion.p>
                        {suffix && (
                            <span className="text-2xl font-medium text-text-muted mb-1">{suffix}</span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
