import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain, FileCode2, GitCommit, CheckCircle2, AlertCircle, ChevronRight, BadgeCheck } from 'lucide-react';
import CompetencyTimeline from '../components/CompetencyTimeline';

/**
 * Assessment Replay — /assessment/:id/replay
 *
 * Shows the full Q&A transcript with AI reasoning and evidence for each turn.
 * Dramatically increases examiner/judge trust: every question is traceable to a source.
 */

const SCORE_COLOR = (score) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-indigo-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
};

const SCORE_BG = (score) => {
    if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'bg-indigo-500/10 border-indigo-500/20';
    if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
};

function TurnCard({ turn, index }) {
    const [showReasoning, setShowReasoning] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        >
            {/* Turn header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-300">{index + 1}</span>
                </div>
                <span className="text-sm text-text-muted">Question {index + 1}</span>
                {turn.evidence && (
                    <div className="flex items-center gap-1.5 ml-auto text-xs text-indigo-400/70">
                        <FileCode2 className="w-3 h-3" />
                        <span className="font-mono">{turn.evidence.file}</span>
                    </div>
                )}
            </div>

            <div className="p-5 space-y-4">
                {/* Question */}
                <div>
                    <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-indigo-400" /> Question
                    </div>
                    <p className="text-white text-sm leading-relaxed font-medium">{turn.question}</p>
                </div>

                {/* Answer */}
                <div>
                    <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                        Answer
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">{turn.answer}</p>
                </div>

                {/* Evidence source */}
                {turn.evidence && (
                    <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.04] p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                            {turn.evidence.type === 'commit'
                                ? <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
                                : <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
                            }
                            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Evidence</span>
                        </div>
                        <div className="font-mono text-xs text-indigo-200">{turn.evidence.file}</div>
                        {turn.evidence.commit && (
                            <div className="font-mono text-xs text-indigo-400/60 mt-0.5">{turn.evidence.commit} — {turn.evidence.commitMsg}</div>
                        )}
                        {turn.evidence.code && (
                            <pre className="mt-2 text-xs font-mono text-gray-400 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto border-t border-indigo-500/10 pt-2">
                                {turn.evidence.code}
                            </pre>
                        )}
                    </div>
                )}

                {/* AI Reasoning toggle */}
                <div>
                    <button
                        onClick={() => setShowReasoning(v => !v)}
                        className="flex items-center gap-1.5 text-xs text-indigo-400/70 hover:text-indigo-300 transition-colors"
                    >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showReasoning ? 'rotate-90' : ''}`} />
                        AI Reasoning
                    </button>
                    {showReasoning && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]"
                        >
                            <p className="text-xs text-text-muted leading-relaxed">{turn.reasoning}</p>
                        </motion.div>
                    )}
                </div>

                {/* Score */}
                <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
                    <div className={`px-3 py-1 rounded-full border text-xs font-bold ${SCORE_BG(turn.score)} ${SCORE_COLOR(turn.score)}`}>
                        {turn.score}/100
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        {turn.score >= 70
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            : <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        }
                        {turn.verdict}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default function Replay({ assessmentId, onBack }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!assessmentId) return;
        setLoading(true);
        fetch(`/api/interview/${assessmentId}/replay`)
            .then(r => {
                if (!r.ok) throw new Error('Assessment not found');
                return r.json();
            })
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

    const { candidate, turns = [], summary } = data ?? {};

    return (
        <div className="min-h-screen px-4 sm:px-6 py-10 max-w-3xl mx-auto">
            {/* Back */}
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-sm text-text-muted hover:text-white transition-colors mb-8"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Passport
            </button>

            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-sm">verified</span>
                    </div>
                    <span className="font-black text-sm tracking-widest text-white">VERITAS</span>
                </div>
                <h1 className="text-2xl font-black text-white mt-4 mb-1">Assessment Replay</h1>
                {candidate && (
                    <p className="text-text-muted text-sm">{candidate.name} · {candidate.role} · {candidate.date}</p>
                )}
            </div>

            {/* Summary scores */}
            {summary && (
                <div className="grid grid-cols-3 gap-4 mb-8">
                    {[
                        { label: 'Authenticity', value: summary.authenticity, icon: BadgeCheck },
                        { label: 'Ownership', value: summary.ownership, icon: FileCode2 },
                        { label: 'Competency', value: summary.competency, icon: Brain },
                    ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                            <Icon className={`w-4 h-4 mx-auto mb-1.5 ${SCORE_COLOR(value)}`} />
                            <div className={`text-2xl font-black mb-0.5 ${SCORE_COLOR(value)}`}>{value}%</div>
                            <div className="text-xs text-text-muted">{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Competency Timeline */}
            {turns.length >= 2 && (
                <div className="mb-8 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <CompetencyTimeline turns={turns} />
                </div>
            )}

            {/* Turn-by-turn */}
            <div className="space-y-4">
                {turns.map((turn, i) => (
                    <TurnCard key={i} turn={turn} index={i} />
                ))}
            </div>

            {/* Verification footer */}
            {summary?.verificationId && (
                <div className="mt-8 pt-6 border-t border-white/[0.04] flex items-center justify-between">
                    <span className="text-xs text-text-muted font-mono">{summary.verificationId}</span>
                    <span className="text-xs text-indigo-400/60">VERITAS Verified Assessment Replay</span>
                </div>
            )}
        </div>
    );
}
