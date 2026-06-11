import { motion } from 'framer-motion';

/**
 * Button Component
 * Variants: primary, secondary, ghost
 * Sizes: sm, md, lg
 */
export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    icon,
    iconPosition = 'left',
    className = '',
    disabled = false,
    ...props
}) {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: 'bg-gradient-to-b from-primary to-[#D4A005] hover:to-primary text-black rounded-xl shadow-glow-primary hover:shadow-glow-primary-lg transform hover:-translate-y-0.5',
        secondary: 'bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl backdrop-blur-sm',
        ghost: 'text-text-muted hover:text-white hover:bg-white/5 rounded-lg',
        danger: 'bg-flagged/10 hover:bg-flagged/20 border border-flagged/20 text-flagged rounded-xl',
    };

    const sizes = {
        sm: 'text-sm px-4 py-2.5 min-h-[40px]',
        md: 'text-sm px-6 py-3 min-h-[44px]',
        lg: 'text-base px-8 py-3.5 min-h-[48px]',
    };

    return (
        <motion.button
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled}
            {...props}
        >
            {icon && iconPosition === 'left' && (
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
            )}
            {children}
            {icon && iconPosition === 'right' && (
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
            )}
        </motion.button>
    );
}
