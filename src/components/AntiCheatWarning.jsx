import { motion, AnimatePresence } from 'framer-motion';

/**
 * AntiCheatWarning — Full-screen overlay that appears on malpractice detection.
 * Shows the violation type, strike count, and auto-dismisses (or terminates on 3rd strike).
 */
export default function AntiCheatWarning({
    showWarning,
    currentWarning,
    strikes,
    maxStrikes,
    terminated,
    dismissWarning,
    onExit,
}) {
    // Terminated state — permanent overlay
    if (terminated) {
        return (
            <div className="anticheat-overlay terminated">
                <motion.div
                    className="anticheat-card terminated"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <div className="anticheat-icon terminated">
                        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                            <circle cx="28" cy="28" r="28" fill="#ef4444" opacity="0.15" />
                            <path d="M20 20L36 36M36 20L20 36" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    </div>
                    <h2 className="anticheat-title terminated">Examination Terminated</h2>
                    <p className="anticheat-message">
                        Your examination has been ended due to <strong>{maxStrikes} integrity violations</strong>.
                        This will be reflected in your Examination Report.
                    </p>
                    <div className="anticheat-violations">
                        {currentWarning && (
                            <div className="violation-list">
                                <span className="violation-label">Violations detected:</span>
                                <ul>
                                    {['Tab switching', 'Paste/Copy', 'Leaving window'].map((v, i) => (
                                        <li key={i} className="violation-item">⚠️ {v}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <button className="anticheat-exit-btn" onClick={onExit}>
                        Exit Interview
                    </button>
                </motion.div>
            </div>
        );
    }

    // Warning state — temporary overlay
    return (
        <AnimatePresence>
            {showWarning && currentWarning && (
                <motion.div
                    className="anticheat-overlay warning"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={dismissWarning}
                >
                    <motion.div
                        className="anticheat-card warning"
                        initial={{ opacity: 0, y: -30, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -30, scale: 0.9 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="anticheat-icon warning">
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                <circle cx="24" cy="24" r="24" fill="#f59e0b" opacity="0.15" />
                                <path d="M24 16V28" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="24" cy="33" r="2" fill="#f59e0b" />
                            </svg>
                        </div>

                        <h3 className="anticheat-title warning">⚠️ Warning — Strike {strikes}/{maxStrikes}</h3>

                        <p className="anticheat-message">
                            {currentWarning.message}
                        </p>

                        <div className="anticheat-strikes">
                            {Array.from({ length: maxStrikes }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`strike-dot ${i < strikes ? 'active' : ''}`}
                                />
                            ))}
                        </div>

                        <p className="anticheat-remaining">
                            {maxStrikes - strikes === 1
                                ? '🚨 Final warning — one more integrity violation will terminate your examination.'
                                : `${maxStrikes - strikes} warnings remaining before examination is terminated.`
                            }
                        </p>

                        <button className="anticheat-dismiss-btn" onClick={dismissWarning}>
                            I Understand — Continue
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
