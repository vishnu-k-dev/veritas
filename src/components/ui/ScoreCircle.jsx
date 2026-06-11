import { motion } from 'framer-motion';

/**
 * Score Circle Component
 * Circular progress indicator with animated fill
 */
export default function ScoreCircle({
    score,
    size = 'md',
    label,
    showPercentage = true,
    variant = 'primary',
    className = ''
}) {
    const sizes = {
        sm: { container: 'size-16', stroke: 3, fontSize: 'text-lg' },
        md: { container: 'size-24', stroke: 4, fontSize: 'text-2xl' },
        lg: { container: 'size-32', stroke: 5, fontSize: 'text-4xl' },
        xl: { container: 'size-40', stroke: 6, fontSize: 'text-5xl' },
    };

    const variants = {
        primary: { color: '#EAB308', bgColor: 'rgba(234, 179, 8, 0.1)' },
        verified: { color: '#22C55E', bgColor: 'rgba(34, 197, 94, 0.1)' },
        flagged: { color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
        neutral: { color: '#A0A0A0', bgColor: 'rgba(160, 160, 160, 0.1)' },
    };

    // Auto-select variant based on score
    const autoVariant = score >= 70 ? 'verified' : score >= 50 ? 'primary' : 'flagged';
    const selectedVariant = variant === 'auto' ? autoVariant : variant;

    const { container, stroke, fontSize } = sizes[size];
    const { color, bgColor } = variants[selectedVariant];

    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className={`flex flex-col items-center gap-2 ${className}`}>
            <div className={`${container} relative`}>
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke={bgColor}
                        strokeWidth={stroke}
                    />
                    {/* Progress circle */}
                    <motion.circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                    />
                </svg>
                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {showPercentage && (
                        <motion.span
                            className={`${fontSize} font-bold text-white`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            {score}
                            <span className="text-text-muted text-lg">%</span>
                        </motion.span>
                    )}
                </div>
            </div>
            {label && (
                <span className="text-sm font-medium text-text-muted uppercase tracking-wide">
                    {label}
                </span>
            )}
        </div>
    );
}
