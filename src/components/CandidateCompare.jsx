/**
 * CandidateCompare — side-by-side comparison of 2 or 3 candidates
 * Props: candidates (array of interview objects), onClose
 */
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy } from 'lucide-react';

const DIMENSIONS = [
    { key: 'trust_score', label: 'Trust Score', suffix: '/100', max: 100 },
];

const SCORE_FIELDS = [
    { key: 'skill_match_score', label: 'Skill Match', weight: '30%' },
    { key: 'depth_score', label: 'Answer Depth', weight: '20%' },
    { key: 'authenticity_score', label: 'Authenticity', weight: '25%' },
    { key: 'communication_score', label: 'Communication', weight: '10%' },
    { key: 'consistency_score', label: 'Consistency', weight: '15%' },
];

function getVerdictStyle(verdict) {
    if (verdict === 'pass') return 'bg-verified/20 text-verified border-verified/30';
    if (verdict === 'hold') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (verdict === 'fail') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-white/10 text-text-muted border-white/10';
}

function ScoreBar({ value, max = 100, best }) {
    const pct = Math.min(100, Math.round(((value || 0) / max) * 100));
    const isBest = best && value === best;
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${isBest ? 'bg-primary' : 'bg-white/30'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className={`text-xs font-bold w-7 text-right ${isBest ? 'text-primary' : 'text-text-muted'}`}>
                {value ?? '—'}
            </span>
        </div>
    );
}

export default function CandidateCompare({ candidates, onClose }) {
    if (!candidates || candidates.length < 2) return null;

    const cols = candidates.slice(0, 3);
    const topScore = Math.max(...cols.map(c => c.trust_score || 0));

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative w-full max-w-4xl glass-panel rounded-2xl p-6 border border-white/10 max-h-[90vh] flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-white">Examinee Comparison</h2>
                            <p className="text-sm text-text-muted">Side-by-side analysis of {cols.length} examinees</p>
                        </div>
                        <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {/* Candidate header row */}
                        <div className={`grid gap-4 mb-6 ${cols.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            {cols.map((c, i) => {
                                const isTop = (c.trust_score || 0) === topScore;
                                return (
                                    <div
                                        key={c.id}
                                        className={`rounded-xl p-4 border ${isTop ? 'bg-primary/5 border-primary/30' : 'bg-white/3 border-white/10'}`}
                                    >
                                        {isTop && (
                                            <div className="flex items-center gap-1 text-primary text-xs font-bold mb-2">
                                                <Trophy className="w-3.5 h-3.5" />
                                                Top Score
                                            </div>
                                        )}
                                        <p className="font-bold text-white truncate">{c.candidate_name || 'Unknown'}</p>
                                        <p className="text-xs text-text-muted truncate">{c.applicant_email || '—'}</p>
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className={`text-3xl font-black ${isTop ? 'text-primary' : 'text-white'}`}>
                                                {c.trust_score ?? '—'}
                                            </span>
                                            <span className="text-text-muted text-sm">/100</span>
                                        </div>
                                        <div className="mt-2">
                                            <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium ${getVerdictStyle(c.verdict)}`}>
                                                {c.verdict ? c.verdict.toUpperCase() : 'PENDING'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-muted mt-2">{formatDate(c.created_at)}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Score breakdown */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Score Breakdown</h3>
                            {SCORE_FIELDS.map(field => {
                                const values = cols.map(c => {
                                    // scores may be nested in auth_report or at top level
                                    const raw = c[field.key] ?? c.auth_report?.[field.key];
                                    return typeof raw === 'number' ? Math.round(raw) : null;
                                });
                                const validValues = values.filter(v => v !== null);
                                const best = validValues.length ? Math.max(...validValues) : null;

                                return (
                                    <div key={field.key} className={`grid gap-4 ${cols.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                        {/* Label row — shown once as a separate full-width label above */}
                                        {cols.map((c, i) => (
                                            <div key={c.id} className="space-y-1">
                                                {i === 0 && (
                                                    <div className="col-span-full mb-1">
                                                        <span className="text-xs text-text-muted">{field.label}</span>
                                                        <span className="text-xs text-text-muted/50 ml-1">({field.weight})</span>
                                                    </div>
                                                )}
                                                <ScoreBar value={values[i]} best={best} />
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Interview date & repo */}
                        <div className={`grid gap-4 mt-6 ${cols.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            {cols.map((c) => (
                                <div key={c.id} className="space-y-2">
                                    {c.repo_url && (
                                        <a
                                            href={c.repo_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">code</span>
                                            View GitHub Repo
                                        </a>
                                    )}
                                    {c.verification_id && (
                                        <a
                                            href={`/verify/${c.verification_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-white transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">verified</span>
                                            View Passport
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/5">
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 rounded-xl border border-white/10 text-text-muted hover:text-white hover:border-white/20 transition-colors text-sm"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
