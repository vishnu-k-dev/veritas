/**
 * Badge Component
 * Status badges for verified/review/flagged states
 */
export default function Badge({
    children,
    variant = 'default',
    pulse = false,
    icon,
    className = ''
}) {
    const variants = {
        default: 'bg-white/10 text-white border-white/10',
        verified: 'bg-verified/10 text-verified border-verified/20',
        review: 'bg-primary/10 text-primary border-primary/20',
        flagged: 'bg-flagged/10 text-flagged border-flagged/20',
        info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };

    return (
        <span className={`
      inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border
      ${variants[variant]}
      ${className}
    `}>
            {pulse && (
                <span className={`size-1.5 rounded-full animate-pulse ${variant === 'verified' ? 'bg-verified' :
                        variant === 'review' ? 'bg-primary' :
                            variant === 'flagged' ? 'bg-flagged' :
                                'bg-white'
                    }`} />
            )}
            {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
            {children}
        </span>
    );
}
