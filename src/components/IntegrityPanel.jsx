import { motion } from 'framer-motion';
import { ShieldCheck, Clock, Brain, GitBranch, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

/**
 * IntegrityPanel — Assessment Integrity Layer
 *
 * Answers the judge question: "How do you prevent cheating?"
 * Shows session-level integrity metrics and the methodology behind each.
 *
 * Props:
 *   integrity: {
 *     sessionDuration: number,      // minutes
 *     consistencyScore: number,     // 0–100
 *     aiAssistanceRisk: 'Low' | 'Medium' | 'High',
 *     ownershipConfidence: number,  // 0–100
 *     flags: string[],              // e.g. ["Paste detected Q3", "Long pause Q5"]
 *     checks: {
 *       crossQuestion: boolean,
 *       consistencyAnalysis: boolean,
 *       adaptiveFollowUp: boolean,
 *       typingVelocity: boolean,
 *       pasteDetection: boolean,
 *       promptInjection: boolean,
 *     }
 *   }
 *   compact?: boolean   — slim version for embedding in passport
 */

const RISK_CONFIG = {
    Low:    { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
    Medium: { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-400'   },
    High:   { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-400'     },
};

const SCORE_COLOR = (v) => {
    if (v >= 85) return 'text-emerald-400';
    if (v >= 65) return 'text-indigo-400';
    if (v >= 45) return 'text-amber-400';
    return 'text-red-400';
};

const METHODS = [
    {
        key: 'crossQuestion',
        label: 'Cross-Question Validation',
        desc: 'Answers are compared across the session for contradictions. Inconsistent claims about the same codebase are flagged automatically.',
    },
    {
        key: 'consistencyAnalysis',
        label: 'Answer Consistency Analysis',
        desc: 'STAR-method detection identifies genuine experience narratives vs. rehearsed or AI-generated responses using behavioral linguistics.',
    },
    {
        key: 'adaptiveFollowUp',
        label: 'Adaptive Follow-Up Verification',
        desc: 'Suspiciously fluent answers trigger deeper follow-up questions probing implementation details only the real author would know.',
    },
    {
        key: 'typingVelocity',
        label: 'Typing Velocity Analysis',
        desc: 'Unusually fast or perfectly uniform typing patterns are detected and weighted against the authenticity score.',
    },
    {
        key: 'pasteDetection',
        label: 'Paste-Event Detection',
        desc: 'Clipboard paste events are logged per question. Three paste events trigger a follow-up integrity check.',
    },
    {
        key: 'promptInjection',
        label: 'Prompt Injection Defense',
        desc: 'Inputs are sanitized before reaching the AI layer. Attempts to override system instructions are flagged and blocked.',
    },
];

function ScoreMeter({ value, className = '' }) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: value >= 85 ? '#34D399' : value >= 65 ? '#818CF8' : value >= 45 ? '#FBBF24' : '#F87171' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
                />
            </div>
            <span className={`text-sm font-bold tabular-nums ${SCORE_COLOR(value)}`}>{value}%</span>
        </div>
    );
}

export default function IntegrityPanel({ integrity, compact = false }) {
    if (!integrity) return null;

    const risk = RISK_CONFIG[integrity.aiAssistanceRisk] ?? RISK_CONFIG.Low;
    const flagCount = integrity.flags?.length ?? 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.04]">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                    <div className="text-xs font-bold tracking-widest text-text-muted uppercase">
                        Assessment Integrity
                    </div>
                    <div className="text-sm font-semibold text-white">
                        {flagCount === 0 ? 'No integrity violations detected' : `${flagCount} flag${flagCount > 1 ? 's' : ''} logged`}
                    </div>
                </div>
                {flagCount === 0
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto" />
                    : <AlertTriangle className="w-5 h-5 text-amber-400 ml-auto" />
                }
            </div>

            <div className="p-5">
                {/* 4 primary metrics */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Session Duration */}
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Clock className="w-3.5 h-3.5 text-text-muted" />
                            <span className="text-xs text-text-muted font-medium">Session Duration</span>
                        </div>
                        <div className="text-2xl font-black text-white">{integrity.sessionDuration}<span className="text-sm font-medium text-text-muted ml-1">min</span></div>
                    </div>

                    {/* AI Assistance Risk */}
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Brain className="w-3.5 h-3.5 text-text-muted" />
                            <span className="text-xs text-text-muted font-medium">AI Assistance Risk</span>
                        </div>
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-bold ${risk.bg} ${risk.border} ${risk.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
                            {integrity.aiAssistanceRisk}
                        </div>
                    </div>

                    {/* Consistency Score */}
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-text-muted" />
                            <span className="text-xs text-text-muted font-medium">Consistency Score</span>
                        </div>
                        <ScoreMeter value={integrity.consistencyScore} />
                    </div>

                    {/* Ownership Confidence */}
                    <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                            <GitBranch className="w-3.5 h-3.5 text-text-muted" />
                            <span className="text-xs text-text-muted font-medium">Ownership Confidence</span>
                        </div>
                        <ScoreMeter value={integrity.ownershipConfidence} />
                    </div>
                </div>

                {/* Flags */}
                {flagCount > 0 && (
                    <div className="mb-6 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
                        <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Integrity Flags</div>
                        <ul className="space-y-1.5">
                            {integrity.flags.map((flag, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-amber-300/80">
                                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                    {flag}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Methodology breakdown */}
                {!compact && (
                    <div>
                        <div className="text-xs font-bold tracking-widest text-text-muted uppercase mb-3">
                            Integrity Methodology
                        </div>
                        <div className="space-y-2">
                            {METHODS.map((method) => {
                                const active = integrity.checks?.[method.key] !== false;
                                return (
                                    <div
                                        key={method.key}
                                        className={`rounded-xl border p-3 transition-colors ${
                                            active
                                                ? 'border-indigo-500/15 bg-indigo-500/[0.04]'
                                                : 'border-white/[0.03] bg-white/[0.01] opacity-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-indigo-400' : 'text-text-muted'}`} />
                                            <span className={`text-xs font-semibold ${active ? 'text-white' : 'text-text-muted'}`}>
                                                {method.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-muted leading-relaxed pl-5">
                                            {method.desc}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
