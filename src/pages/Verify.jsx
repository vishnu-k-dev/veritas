import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, FileCode2, Brain, BadgeCheck, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';

/**
 * Verify — Examination Verification Portal
 * Route: /verify/:verificationId
 *
 * Accessible without login — designed to be scanned via QR code on the Examination Report.
 * Shows: VERIFIED status + 3 metrics + verified competencies + issued date.
 * Makes VERITAS feel like a real credential system.
 */

const SCORE_COLOR = (v) => {
    if (v >= 85) return 'text-emerald-400';
    if (v >= 65) return 'text-indigo-400';
    if (v >= 45) return 'text-amber-400';
    return 'text-red-400';
};

const SCORE_BG = (v) => {
    if (v >= 85) return 'from-emerald-500/10';
    if (v >= 65) return 'from-indigo-500/10';
    if (v >= 45) return 'from-amber-500/10';
    return 'from-red-500/10';
};

function MetricRing({ label, value, icon: Icon, delay }) {
    const r = 28;
    const circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;
    const color = value >= 85 ? '#34D399' : value >= 65 ? '#818CF8' : value >= 45 ? '#FBBF24' : '#F87171';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, type: 'spring', stiffness: 200 }}
            className="flex flex-col items-center gap-2"
        >
            <div className="relative w-18 h-18" style={{ width: 72, height: 72 }}>
                <svg width={72} height={72} viewBox="0 0 72 72" className="-rotate-90">
                    <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
                    <motion.circle
                        cx={36} cy={36} r={r}
                        fill="none"
                        stroke={color}
                        strokeWidth={5}
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        initial={{ strokeDashoffset: circ }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ delay: delay + 0.2, duration: 0.9, ease: 'easeOut' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Icon className="w-3 h-3 mb-0.5" style={{ color }} />
                    <span className="text-sm font-black text-white leading-none">{value}</span>
                </div>
            </div>
            <span className="text-xs font-medium text-text-muted">{label}</span>
        </motion.div>
    );
}

export default function Verify({ verificationId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!verificationId) return;
        fetch(`/api/interview/public/verify/${verificationId}`)
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(d => { setData(d); setLoading(false); })
            .catch(() => { setNotFound(true); setLoading(false); });
    }, [verificationId]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (notFound) return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="text-center max-w-sm">
                <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
                <h1 className="text-xl font-black text-white mb-2">Examination Report Not Found</h1>
                <p className="text-text-muted text-sm mb-6">
                    The Verification ID <code className="text-indigo-300 font-mono">{verificationId}</code> does not match any issued Examination Report.
                </p>
                <p className="text-xs text-text-muted/60">
                    If you believe this is an error, contact the issuing institution.
                </p>
            </div>
        </div>
    );

    const overall = Math.round((data.authenticity + data.ownership + data.competency) / 3);

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                {/* VERITAS header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="material-symbols-outlined text-white text-lg">verified</span>
                        </div>
                        <span className="font-black text-xl tracking-widest text-white">VERITAS</span>
                    </div>
                    <p className="text-xs text-text-muted">Examination Verification Portal</p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-indigo-500/20 bg-white/[0.02] overflow-hidden"
                >
                    {/* Top band */}
                    <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-600" />

                    <div className="p-6">
                        {/* Verified badge */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                            className="flex flex-col items-center mb-6"
                        >
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/10">
                                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                            </div>
                            <div className="text-xs font-black tracking-[0.25em] text-emerald-400 uppercase mb-1">
                                Verified
                            </div>
                            <div className="text-xs font-bold tracking-widest text-indigo-300/70 uppercase">
                                VERITAS Examination Report
                            </div>
                        </motion.div>

                        {/* Examinee info */}
                        <div className="text-center mb-6 pb-6 border-b border-white/[0.06]">
                            <h2 className="text-xl font-black text-white mb-0.5">{data.candidateName}</h2>
                            {data.candidateRole && (
                                <p className="text-sm text-text-muted">{data.candidateRole}</p>
                            )}
                        </div>

                        {/* 3 Metrics */}
                        <div className="flex items-center justify-around mb-6 pb-6 border-b border-white/[0.06]">
                            <MetricRing label="Authenticity" value={data.authenticity} icon={Shield}    delay={0.15} />
                            <MetricRing label="Ownership"    value={data.ownership}    icon={FileCode2} delay={0.25} />
                            <MetricRing label="Competency"   value={data.competency}   icon={Brain}     delay={0.35} />
                        </div>

                        {/* Verified competencies */}
                        {data.skills?.length > 0 && (
                            <div className="mb-6">
                                <div className="text-xs font-bold tracking-widest text-text-muted uppercase mb-3">
                                    Verified Competencies
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {data.skills.map((skill, i) => (
                                        <motion.div
                                            key={skill}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.4 + i * 0.05 }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs font-semibold text-indigo-300"
                                        >
                                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                            {skill}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Verification ID + Date */}
                        <div className="flex items-center justify-between text-xs pt-4 border-t border-white/[0.06]">
                            <div>
                                <div className="text-text-muted mb-0.5">Verification ID</div>
                                <div className="font-mono text-indigo-300 font-bold">{data.verificationId}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-text-muted mb-0.5">Issued</div>
                                <div className="text-white">{data.issuedDate}</div>
                            </div>
                        </div>
                    </div>

                    <div className="h-1 bg-gradient-to-r from-indigo-600/50 via-violet-500/50 to-indigo-600/50" />
                </motion.div>

                <p className="text-center text-xs text-text-muted/40 mt-6">
                    This Examination Report was issued by VERITAS Evidence-Backed AI Examination System.<br />
                    Verification ID: {verificationId}
                </p>
            </div>
        </div>
    );
}
