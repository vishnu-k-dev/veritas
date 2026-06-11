import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Brain, FileCode2, GitCommit, CheckCircle2,
    AlertCircle, Shield, TrendingUp, TrendingDown, Minus,
    ChevronDown, ChevronUp, Eye, BadgeCheck
} from 'lucide-react';
import IntegrityPanel from '../components/IntegrityPanel';
import CompetencyTimeline from '../components/CompetencyTimeline';

/**
 * Audit — /assessment/:id/audit
 *
 * Institution Review Console: full transparency into every AI decision.
 * Makes VERITAS explainable, not a black box.
 *
 * Each turn shows:
 *   Question → Examinee Answer → AI Analysis → Evidence → Confidence → Reasoning
 */

const CONF_CONFIG = {
    High:   { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    Medium: { color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20'  },
    Low:    { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
};

const SCORE_COLOR = (v) => {
    if (v >= 80) return 'text-emerald-400';
    if (v >= 60) return 'text-indigo-400';
    if (v >= 40) return 'text-amber-400';
    return 'text-red-400';
};

const TrendIcon = ({ prev, curr }) => {
    if (prev == null) return null;
    if (curr > prev + 4) return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (curr < prev - 4) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-text-muted" />;
};

function AuditTurnCard({ turn, index, prevScore }) {
    const [open, setOpen] = useState(index === 0);
    const cc = CONF_CONFIG[turn.confidence] ?? CONF_CONFIG.Medium;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        >
            {/* Collapsible header */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
            >
                <div className="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-black text-indigo-300">{index + 1}</span>
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium leading-snug line-clamp-1">{turn.question}</p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                    <TrendIcon prev={prevScore} curr={turn.score} />
                    <span className={`text-sm font-black tabular-nums ${SCORE_COLOR(turn.score)}`}>
                        {turn.score}/100
                    </span>
                    <div className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${cc.bg} ${cc.border} ${cc.color}`}>
                        {turn.confidence}
                    </div>
                    {open ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                </div>
            </button>

            {open && (
                <div className="border-t border-white/[0.04] p-5 grid md:grid-cols-2 gap-5">
                    {/* Left column: Question + Answer */}
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Brain className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Question</span>
                            </div>
                            <p className="text-sm text-white leading-relaxed">{turn.question}</p>
                        </div>

                        <div>
                            <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                                Examinee Answer
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
                                {turn.answer}
                            </p>
                        </div>

                        {/* Evidence */}
                        {turn.evidence && (
                            <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.04] p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    {turn.evidence.type === 'commit'
                                        ? <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
                                        : <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
                                    }
                                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Evidence Source</span>
                                </div>
                                <code className="text-xs text-indigo-200 block mb-1">{turn.evidence.file}</code>
                                {turn.evidence.commit && (
                                    <code className="text-xs text-indigo-400/60 block">{turn.evidence.commit} — {turn.evidence.commitMsg}</code>
                                )}
                                {turn.evidence.code && (
                                    <pre className="mt-2 text-xs font-mono text-gray-400 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-20 overflow-y-auto border-t border-indigo-500/10 pt-2">
                                        {turn.evidence.code}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right column: AI Analysis + Reasoning */}
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Eye className="w-3.5 h-3.5 text-violet-400" />
                                <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">AI Analysis</span>
                            </div>
                            <div className="space-y-2">
                                {turn.analysis?.map((point, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-violet-400/60 flex-shrink-0 mt-0.5" />
                                        {point}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Shield className="w-3.5 h-3.5 text-text-muted" />
                                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Reasoning</span>
                            </div>
                            <p className="text-xs text-text-muted leading-relaxed bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
                                {turn.reasoning}
                            </p>
                        </div>

                        {/* Score breakdown */}
                        <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                            <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Score Breakdown</div>
                            {turn.scoreBreakdown && Object.entries(turn.scoreBreakdown).map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between mb-2 last:mb-0">
                                    <span className="text-xs text-text-muted capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-indigo-500/60"
                                                style={{ width: `${v}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-white font-mono w-5 text-right">{v}</span>
                                    </div>
                                </div>
                            ))}

                            <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                                <span className="text-xs font-bold text-white">Final Score</span>
                                <span className={`text-sm font-black ${SCORE_COLOR(turn.score)}`}>{turn.score}/100</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

export default function Audit({ assessmentId, onBack }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!assessmentId) return;
        setLoading(true);
        fetch(`/api/interview/${assessmentId}/audit`)
            .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
            .then(d => { setData(d); setLoading(false); })
            .catch(e => { setError(e.message); setLoading(false); });
    }, [assessmentId]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-white font-semibold mb-2">Assessment not found</p>
                <p className="text-text-muted text-sm">{error}</p>
            </div>
        </div>
    );

    const { candidate, turns = [], summary, integrity } = data ?? {};

    return (
        <div className="min-h-screen px-4 sm:px-6 py-10 max-w-4xl mx-auto">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors mb-8"
            >
                <ArrowLeft className="w-4 h-4" /> Back
            </button>

            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-base">verified</span>
                        </div>
                        <span className="font-black text-sm tracking-widest text-white">VERITAS</span>
                    </div>
                    <h1 className="text-2xl font-black text-white mb-1">Institution Review Console</h1>
                    {candidate && (
                        <p className="text-text-muted text-sm">{candidate.name} · {candidate.role} · {candidate.date}</p>
                    )}
                    {candidate && (
                        <p className="text-xs text-text-muted/50 mt-1">Examination Session · Full Audit Trail</p>
                    )}
                </div>
                <div className="px-3 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">Institution Access</span>
                </div>
            </div>

            {/* Summary scores */}
            {summary && (
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'Authenticity', value: summary.authenticity },
                        { label: 'Ownership', value: summary.ownership },
                        { label: 'Competency', value: summary.competency },
                    ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                            <div className={`text-2xl font-black mb-0.5 ${SCORE_COLOR(value)}`}>{value}%</div>
                            <div className="text-xs text-text-muted">{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Timeline */}
            {turns.length >= 2 && (
                <div className="mb-8 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <CompetencyTimeline turns={turns} />
                </div>
            )}

            {/* Integrity panel */}
            {integrity && (
                <div className="mb-8">
                    <IntegrityPanel integrity={integrity} />
                </div>
            )}

            {/* Turn-by-turn audit */}
            <div className="mb-4">
                <div className="text-xs font-bold tracking-widest text-text-muted uppercase mb-4">
                    Full Question Audit — {turns.length} questions
                </div>
                <div className="space-y-3">
                    {turns.map((turn, i) => (
                        <AuditTurnCard
                            key={i}
                            turn={turn}
                            index={i}
                            prevScore={i > 0 ? turns[i - 1].score : null}
                        />
                    ))}
                </div>
            </div>

            {/* Verification footer */}
            {summary?.verificationId && (
                <div className="mt-8 pt-6 border-t border-white/[0.04] flex items-center justify-between">
                    <span className="text-xs text-text-muted font-mono">{summary.verificationId}</span>
                    <span className="text-xs text-indigo-400/60">VERITAS Institution Review Console</span>
                </div>
            )}
        </div>
    );
}
