import { motion } from 'framer-motion';
import { useState, useRef } from 'react';
import { Download, Share2, CheckCircle2, FileCode2, Github, Brain, Shield, BadgeCheck, ExternalLink } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import CompetencyRadar from './CompetencyRadar';
import KnowledgeGraph from './KnowledgeGraph';

/**
 * CompetencyPassport — VERITAS Verified Competency Passport
 *
 * Three primary metrics: Authenticity / Ownership / Competency
 * Evidence cards per verified skill
 * Unique Verification ID: VRT-2026-XXXX
 *
 * Props:
 *   report: {
 *     candidateName: string,
 *     candidateRole?: string,
 *     date: string,
 *     verificationId: string,         // e.g. "VRT-2026-0187"
 *     authenticity: number,           // 0–100
 *     ownership: number,              // 0–100
 *     competency: number,             // 0–100
 *     verdict: 'VERIFIED' | 'REVIEW' | 'FLAGGED',
 *     skills: Array<{
 *       name: string,
 *       score: number,
 *       evidence: string[],           // bullet proof points
 *     }>,
 *     summary?: string,
 *   }
 *   onViewReplay?: () => void,
 */

const VERDICT_CONFIG = {
    VERIFIED: { label: 'VERITAS VERIFIED', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
    REVIEW:   { label: 'UNDER REVIEW',     color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   dot: 'bg-amber-400'   },
    FLAGGED:  { label: 'FLAGGED',          color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     dot: 'bg-red-400'     },
};

const METRIC_COLOR = (v) => {
    if (v >= 85) return 'text-emerald-400';
    if (v >= 70) return 'text-indigo-400';
    if (v >= 50) return 'text-amber-400';
    return 'text-red-400';
};

const METRIC_RING = (v) => {
    if (v >= 85) return '#34D399';
    if (v >= 70) return '#818CF8';
    if (v >= 50) return '#FBBF24';
    return '#F87171';
};

function CircleMetric({ label, value, icon: Icon, delay = 0 }) {
    const r = 36;
    const circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;
    const color = METRIC_RING(value);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, type: 'spring', stiffness: 200 }}
            className="flex flex-col items-center gap-2"
        >
            <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
                    <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                    <motion.circle
                        cx="44" cy="44" r={r}
                        fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        initial={{ strokeDashoffset: circ }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ delay: delay + 0.2, duration: 1, ease: 'easeOut' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Icon className="w-4 h-4 mb-0.5" style={{ color }} />
                    <span className="text-xl font-black text-white leading-none">{value}</span>
                    <span className="text-xs text-text-muted leading-none">%</span>
                </div>
            </div>
            <span className="text-xs font-semibold text-text-muted tracking-wide">{label}</span>
        </motion.div>
    );
}

function SkillEvidenceCard({ skill, index }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + index * 0.07 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
        >
            <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-white text-sm">{skill.name}</span>
                <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-16 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: METRIC_RING(skill.score) }}
                            initial={{ width: 0 }}
                            animate={{ width: `${skill.score}%` }}
                            transition={{ delay: 0.2 + index * 0.07, duration: 0.6, ease: 'easeOut' }}
                        />
                    </div>
                    <span className={`text-xs font-bold ${METRIC_COLOR(skill.score)}`}>{skill.score}%</span>
                </div>
            </div>
            <ul className="space-y-1.5">
                {skill.evidence.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-text-muted">
                        <CheckCircle2 className="w-3 h-3 text-indigo-400/60 flex-shrink-0 mt-0.5" />
                        {point}
                    </li>
                ))}
            </ul>
        </motion.div>
    );
}

export default function CompetencyPassport({ report, onViewReplay }) {
    const passportRef = useRef(null);
    const [copying, setCopying] = useState(false);

    if (!report) return null;

    const vc = VERDICT_CONFIG[report.verdict] ?? VERDICT_CONFIG.REVIEW;
    const overall = Math.round((report.authenticity + report.ownership + report.competency) / 3);

    const handleDownload = async () => {
        if (!passportRef.current) return;
        try {
            const canvas = await html2canvas(passportRef.current, { scale: 2, backgroundColor: '#1a1a1a' });
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const w = pdf.internal.pageSize.getWidth();
            const h = (canvas.height * w) / canvas.width;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
            pdf.save(`VERITAS-${report.verificationId}.pdf`);
        } catch (e) {
            console.error('PDF export failed', e);
        }
    };

    const handleCopyLink = async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopying(true);
        setTimeout(() => setCopying(false), 1800);
    };

    return (
        <div className="min-h-screen px-4 sm:px-6 py-12 max-w-2xl mx-auto">
            <div ref={passportRef}>
                {/* Passport card */}
                <motion.div
                    initial={{ opacity: 0, y: 32 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-indigo-500/20 bg-white/[0.02] overflow-hidden"
                >
                    {/* Top band */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-600" />

                    <div className="p-6 sm:p-8">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-8">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white text-base">verified</span>
                                    </div>
                                    <span className="font-black text-sm tracking-widest text-white">VERITAS</span>
                                </div>
                                <div className="text-xs font-bold tracking-[0.2em] text-indigo-400/70 uppercase mb-1">
                                    VERITAS Examination Report
                                </div>
                                <h1 className="text-2xl font-black text-white">{report.candidateName}</h1>
                                {report.candidateRole && (
                                    <p className="text-text-muted text-sm mt-0.5">{report.candidateRole}</p>
                                )}
                            </div>

                            {/* Verdict badge */}
                            <div className={`px-3 py-1.5 rounded-full border ${vc.bg} ${vc.border} flex items-center gap-2`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${vc.dot}`} />
                                <span className={`text-xs font-black tracking-wider ${vc.color}`}>{vc.label}</span>
                            </div>
                        </div>

                        {/* 3 Metrics */}
                        <div className="flex items-center justify-around py-6 mb-8 rounded-xl border border-white/[0.04] bg-white/[0.02]">
                            <CircleMetric label="Authenticity" value={report.authenticity} icon={Shield} delay={0.1} />
                            <div className="w-px h-16 bg-white/[0.06]" />
                            <CircleMetric label="Ownership" value={report.ownership} icon={FileCode2} delay={0.2} />
                            <div className="w-px h-16 bg-white/[0.06]" />
                            <CircleMetric label="Competency" value={report.competency} icon={Brain} delay={0.3} />
                        </div>

                        {/* Competency Radar */}
                        {report.radarScores && (
                            <div className="flex flex-col items-center mb-8 pb-8 border-b border-white/[0.04]">
                                <div className="text-xs font-bold tracking-widest text-text-muted uppercase mb-4">
                                    Multidimensional Assessment
                                </div>
                                <CompetencyRadar scores={report.radarScores} size={260} />
                            </div>
                        )}

                        {/* Examination Blueprint */}
                        {report.skills?.length > 0 && (
                            <div className="mb-8 pb-8 border-b border-white/[0.04]">
                                <div className="text-xs font-bold tracking-widest text-text-muted uppercase mb-4">
                                    Examination Blueprint
                                </div>
                                <KnowledgeGraph graph={report.skills.map(s => ({
                                    label: s.name,
                                    verified: (s.score ?? s.level ?? 0) >= 70,
                                    children: (s.subtopics ?? s.evidence ?? []).slice(0, 3).map(e => ({
                                        label: typeof e === 'string' ? e : e.topic ?? e.label ?? String(e),
                                        verified: true,
                                    })),
                                }))} />
                            </div>
                        )}

                        {/* Summary */}
                        {report.summary && (
                            <p className="text-text-muted text-sm leading-relaxed mb-8 pb-8 border-b border-white/[0.04]">
                                {report.summary}
                            </p>
                        )}

                        {/* Evidence Cards */}
                        <div className="mb-8">
                            <h2 className="text-xs font-bold tracking-widest text-text-muted uppercase mb-4">
                                Evidence-Backed Competencies
                            </h2>
                            <div className="space-y-3">
                                {report.skills.map((skill, i) => (
                                    <SkillEvidenceCard key={skill.name} skill={skill} index={i} />
                                ))}
                            </div>
                        </div>

                        {/* Verification ID + date */}
                        <div className="pt-6 border-t border-white/[0.04] flex items-center justify-between">
                            <div>
                                <div className="text-xs text-text-muted mb-0.5">Verification ID</div>
                                <div className="font-mono text-sm text-indigo-300 font-bold">{report.verificationId}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-text-muted mb-0.5">Assessed</div>
                                <div className="text-sm text-white">{report.date}</div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom band */}
                    <div className="h-1 w-full bg-gradient-to-r from-indigo-600/50 via-violet-500/50 to-indigo-600/50" />
                </motion.div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors text-sm"
                >
                    <Download className="w-4 h-4" /> Download PDF
                </button>
                <button
                    onClick={handleCopyLink}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-white bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] transition-colors text-sm"
                >
                    {copying
                        ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Copied!</>
                        : <><Share2 className="w-4 h-4" /> Copy Link</>
                    }
                </button>
                {onViewReplay && (
                    <button
                        onClick={onViewReplay}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-indigo-300 bg-indigo-500/[0.08] hover:bg-indigo-500/[0.14] border border-indigo-500/20 transition-colors text-sm"
                    >
                        <ExternalLink className="w-4 h-4" /> Assessment Replay
                    </button>
                )}
            </div>

            <p className="text-center text-xs text-text-muted/50 mt-4">
                Issued by VERITAS Evidence-Backed AI Examination System · {report.verificationId}
            </p>
        </div>
    );
}
