import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import StatCard from './ui/StatCard';
import BulkInviteModal from './BulkInviteModal';
import CandidateCompare from './CandidateCompare';
import { fetchRecruiterStats, fetchRecruiterCodes, fetchCodeSubmissions, logout, reinviteCandidate, apiRequest } from '../services/api';

// ── Sentiment helpers ──────────────────────────────────────────────────────────

function scoreColor(score) {
    if (score === null || score === undefined) return '#6b7280';
    if (score <= 1.5) return '#22c55e';
    if (score <= 2.5) return '#f59e0b';
    return '#ef4444';
}

function npsConfig(nps) {
    if (nps === null || nps === undefined) return { color: '#6b7280', label: 'No data' };
    if (nps > 50) return { color: '#22c55e', label: 'Excellent' };
    if (nps >= 20) return { color: '#f59e0b', label: 'Good' };
    return { color: '#ef4444', label: 'Needs work' };
}

function ScoreBar({ label, score }) {
    const fill = score != null ? Math.round(((4 - score) / 3) * 100) : 0;
    const color = scoreColor(score);
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted w-24 flex-shrink-0">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${fill}%`, background: color }}
                />
            </div>
            <span className="text-xs font-mono w-8 text-right" style={{ color }}>
                {score != null ? score.toFixed(1) : '—'}
            </span>
        </div>
    );
}

function SentimentPanel({ sentiment }) {
    if (!sentiment) return null;
    const { response_count, avg_accuracy, avg_specificity, avg_actionability, nps_score, completed_count } = sentiment;

    return (
        <div className="mt-4 glass-panel rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[15px] text-text-muted">sentiment_satisfied</span>
                <span className="text-sm font-bold text-white">Examinee Sentiment</span>
                {response_count > 0 && (
                    <span className="text-xs text-text-muted ml-auto">
                        {completed_count ?? response_count} response{(completed_count ?? response_count) !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {response_count < 3 ? (
                <p className="text-xs text-text-muted text-center py-1">
                    Sentiment data available after 3+ examinees complete the form
                </p>
            ) : (
                <div className="space-y-3">
                    <ScoreBar label="Accuracy" score={avg_accuracy} />
                    <ScoreBar label="Specificity" score={avg_specificity} />
                    <ScoreBar label="Actionability" score={avg_actionability} />

                    {nps_score !== null && nps_score !== undefined && (
                        <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between">
                            <span className="text-xs text-text-muted">NPS Score</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold font-mono" style={{ color: npsConfig(nps_score).color }}>
                                    {nps_score > 0 ? '+' : ''}{Math.round(nps_score)}
                                </span>
                                <span
                                    className="text-xs px-2 py-0.5 rounded-full"
                                    style={{
                                        color: npsConfig(nps_score).color,
                                        background: `${npsConfig(nps_score).color}18`,
                                        border: `1px solid ${npsConfig(nps_score).color}30`,
                                    }}
                                >
                                    {npsConfig(nps_score).label}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Recruiter Dashboard Component
 * Shows screening codes, stats, submissions, bulk invite, compare, and re-invite
 */
export default function RecruiterDashboard({ recruiter, onCreateNew, onLogout, onViewSubmission }) {
    const [stats, setStats] = useState({ totalCodes: 0, totalScreenings: 0, avgTrustScore: 0, timeSaved: 0 });
    const [codes, setCodes] = useState([]);
    const [selectedCode, setSelectedCode] = useState(null);
    const [selectedCodeData, setSelectedCodeData] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Bulk invite modal
    const [showInvite, setShowInvite] = useState(false);

    // Compare
    const [compareIds, setCompareIds] = useState(new Set());
    const [showCompare, setShowCompare] = useState(false);

    // Re-invite
    const [reinviting, setReinviting] = useState(null);
    const [reinviteMsg, setReinviteMsg] = useState('');

    // Candidate sentiment (keyed by screening code UUID)
    const [sentimentData, setSentimentData] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [statsData, codesData] = await Promise.all([
                fetchRecruiterStats().catch(() => ({})),
                fetchRecruiterCodes().catch(() => []),
            ]);
            setStats(statsData);
            setCodes(codesData);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadSubmissions = async (codeRow) => {
        setSelectedCode(codeRow.code);
        setSelectedCodeData(codeRow);
        setCompareIds(new Set());
        try {
            const [subs] = await Promise.all([
                fetchCodeSubmissions(codeRow.code),
                apiRequest(`/api/recruiter/feedback-stats/${codeRow.id}`)
                    .then(s => setSentimentData(prev => ({ ...prev, [codeRow.id]: s })))
                    .catch(() => {}),
            ]);
            setSubmissions(subs);
        } catch (error) {
            console.error('Failed to load submissions:', error);
        }
    };

    const handleLogout = async () => {
        await logout();
        onLogout();
    };

    const toggleCompare = (id) => {
        setCompareIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else if (next.size < 3) next.add(id);
            return next;
        });
    };

    const compareSelected = submissions.filter(s => compareIds.has(s.id));

    const handleReinvite = async (sub) => {
        setReinviting(sub.id);
        setReinviteMsg('');
        try {
            await reinviteCandidate(selectedCode, sub.id);
            setReinviteMsg(`${sub.candidate_name || 'Examinee'} has been re-invited.`);
            // Refresh submissions
            const subs = await fetchCodeSubmissions(selectedCode);
            setSubmissions(subs);
        } catch (err) {
            setReinviteMsg('Failed to reinvite. Please try again.');
        } finally {
            setReinviting(null);
            setTimeout(() => setReinviteMsg(''), 4000);
        }
    };

    const getVerdictConfig = (verdict, status) => {
        switch (verdict) {
            case 'pass': return { label: 'Verified', variant: 'verified' };
            case 'hold': return { label: 'Review', variant: 'review' };
            case 'fail': return { label: 'Flagged', variant: 'flagged' };
        }
        if (status === 'reinvited') return { label: 'Re-invited', variant: 'default' };
        if (status === 'in_progress') return { label: 'In Progress', variant: 'default' };
        if (status === 'completed') return { label: 'Completed', variant: 'verified' };
        return { label: 'Pending', variant: 'default' };
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const isExpired = (expiresAt) => new Date(expiresAt) < new Date();

    const getInitials = (name) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="space-y-8">
            {/* Hero Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                <div className="space-y-3 max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 mb-2"
                    >
                        <div className="size-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-primary font-bold">
                            {getInitials(recruiter?.name)}
                        </div>
                        <div>
                            <p className="text-sm text-text-muted">Welcome back,</p>
                            <p className="text-lg font-bold text-white">{recruiter?.name || 'Organization'}</p>
                        </div>
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.1]"
                    >
                        Objective <span className="gradient-text">Examinations at Scale</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-text-muted text-lg max-w-lg font-light leading-relaxed"
                    >
                        {codes.length > 0
                            ? `Managing ${codes.length} examination codes with ${stats.totalScreenings || 0} examinees assessed.`
                            : 'Start your first AI-powered competency examination to see insights here.'
                        }
                    </motion.p>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex-shrink-0 flex items-center gap-3"
                >
                    <Button
                        variant="primary"
                        size="lg"
                        icon="add_circle"
                        onClick={onCreateNew}
                        className="group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full skew-y-12 group-hover:translate-y-[-150%] transition-transform duration-700 ease-in-out" />
                        <span className="relative z-10">New Examination Code</span>
                    </Button>
                    <Button variant="ghost" onClick={handleLogout} title="Logout">
                        <span className="material-symbols-outlined">logout</span>
                    </Button>
                </motion.div>
            </header>

            {/* Stats */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard icon="group" label="Examinees Assessed" value={stats.totalScreenings || 0} />
                <StatCard icon="verified_user" label="Avg Trust Score" value={`${stats.avgTrustScore || 0}%`} />
                <StatCard icon="avg_time" label="Time Saved" value={stats.timeSaved || 0} suffix="min" />
                <StatCard icon="qr_code_2" label="Active Codes" value={stats.totalCodes || 0} />
            </section>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Codes List */}
                <div className="lg:col-span-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">Examination Codes</h2>
                        <span className="text-sm text-text-muted">{codes.length} codes</span>
                    </div>

                    {isLoading ? (
                        <Card padding="lg" className="text-center">
                            <div className="w-10 h-10 mx-auto border-4 border-card-dark border-t-primary rounded-full animate-spin" />
                            <p className="text-text-muted mt-4">Loading...</p>
                        </Card>
                    ) : codes.length === 0 ? (
                        <Card padding="lg" className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                                <span className="material-symbols-outlined text-3xl text-text-muted">qr_code_2</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">No examination codes yet</h3>
                            <p className="text-text-muted text-sm mb-4">Create your first examination to generate a code</p>
                            <Button variant="primary" icon="add" onClick={onCreateNew}>Create Test</Button>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {codes.map((codeData) => (
                                <motion.div
                                    key={codeData.code}
                                    whileHover={{ scale: 1.01 }}
                                    onClick={() => loadSubmissions(codeData)}
                                    className={`glass-panel rounded-xl p-4 cursor-pointer transition-all ${selectedCode === codeData.code ? 'ring-2 ring-primary' : 'hover:bg-white/5'}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono font-bold text-primary">{codeData.code}</span>
                                                {isExpired(codeData.expires_at) && (
                                                    <Badge variant="flagged">Expired</Badge>
                                                )}
                                            </div>
                                            <p className="text-white font-medium">{codeData.role_title}</p>
                                            <p className="text-xs text-text-muted mt-1">
                                                Expires {formatDate(codeData.expires_at)}
                                                {codeData.max_candidates && (
                                                    <span> · Max {codeData.max_candidates}</span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-white">{codeData.submission_count || 0}</div>
                                            <p className="text-xs text-text-muted">submissions</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Submissions Panel */}
                <div className="lg:col-span-7">
                    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                        <h2 className="text-lg font-bold text-white">
                            {selectedCode ? `Submissions — ${selectedCode}` : 'Select a code'}
                        </h2>
                        {selectedCode && (
                            <div className="flex items-center gap-2">
                                {compareIds.size >= 2 && (
                                    <button
                                        onClick={() => setShowCompare(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
                                        Compare ({compareIds.size})
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowInvite(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-text-muted hover:text-white hover:border-white/30 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[16px]">send</span>
                                    Invite Examinees
                                </button>
                            </div>
                        )}
                    </div>

                    {reinviteMsg && (
                        <div className="mb-3 px-4 py-2 rounded-lg bg-verified/10 border border-verified/20 text-verified text-sm">
                            {reinviteMsg}
                        </div>
                    )}

                    {!selectedCode ? (
                        <Card padding="lg" className="text-center min-h-[300px] flex items-center justify-center">
                            <div>
                                <span className="material-symbols-outlined text-4xl text-text-muted mb-4">touch_app</span>
                                <p className="text-text-muted">Select an examination code to view submissions</p>
                            </div>
                        </Card>
                    ) : submissions.length === 0 ? (
                        <Card padding="lg" className="text-center min-h-[300px] flex items-center justify-center">
                            <div>
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-3xl text-text-muted">inbox</span>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">No submissions yet</h3>
                                <p className="text-text-muted text-sm mb-4">Share the code with examinees to receive submissions</p>
                                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 inline-block mb-4">
                                    <p className="text-xs text-text-muted mb-1">Share this code:</p>
                                    <p className="font-mono text-2xl font-bold text-primary">{selectedCode}</p>
                                </div>
                                <div>
                                    <button
                                        onClick={() => setShowInvite(true)}
                                        className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-text-muted hover:text-white hover:border-white/30 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">send</span>
                                        Generate Invite Links
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <>
                            {compareIds.size > 0 && (
                                <p className="text-xs text-text-muted mb-2">
                                    {compareIds.size}/3 selected for comparison. {compareIds.size < 2 ? 'Select at least 2.' : ''}
                                </p>
                            )}
                            <Card padding="none">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/5">
                                            <th className="px-3 py-3 w-8">
                                                <span className="text-xs text-text-muted font-bold uppercase">Cmp</span>
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-text-muted uppercase">Examinee</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-text-muted uppercase">Date</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-text-muted uppercase">Score</th>
                                            <th className="px-4 py-3 text-center text-xs font-bold text-text-muted uppercase">Status</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-text-muted uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {submissions.map((sub) => {
                                            const verdictConfig = getVerdictConfig(sub.verdict, sub.status);
                                            const isCompleted = sub.status === 'completed';
                                            const isHold = sub.verdict === 'hold';
                                            const isChecked = compareIds.has(sub.id);
                                            const canCheck = isCompleted && (isChecked || compareIds.size < 3);

                                            return (
                                                <tr key={sub.id} className={`hover:bg-white/[0.02] ${isChecked ? 'bg-primary/5' : ''}`}>
                                                    <td className="px-3 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleCompare(sub.id)}
                                                            disabled={!canCheck}
                                                            className="w-3.5 h-3.5 rounded accent-primary disabled:opacity-30 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-white">{sub.candidate_name}</p>
                                                        <p className="text-xs text-text-muted">{sub.applicant_email}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-text-muted">{formatDate(sub.created_at)}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {sub.fraud_flag && (
                                                                <span
                                                                    title={sub.fraud_reason || 'Possible answer similarity detected'}
                                                                    className="text-yellow-400 cursor-help"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px]">warning</span>
                                                                </span>
                                                            )}
                                                            <span className="text-lg font-bold text-white">{sub.trust_score ?? '--'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge variant={verdictConfig.variant}>{verdictConfig.label}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {isHold && (
                                                                <button
                                                                    onClick={() => handleReinvite(sub)}
                                                                    disabled={reinviting === sub.id}
                                                                    title="Re-invite for another attempt"
                                                                    className="p-1.5 rounded-lg hover:bg-yellow-500/10 text-yellow-500/60 hover:text-yellow-400 transition-colors disabled:opacity-30"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px]">
                                                                        {reinviting === sub.id ? 'sync' : 'replay'}
                                                                    </span>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => onViewSubmission?.(sub)}
                                                                disabled={!isCompleted}
                                                                title="View result"
                                                                className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-white transition-colors disabled:opacity-30"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </Card>

                            {/* Candidate Sentiment */}
                            <SentimentPanel sentiment={sentimentData[selectedCodeData?.id]} />
                        </>
                    )}
                </div>
            </div>

            {/* Bulk Invite Modal */}
            <BulkInviteModal
                isOpen={showInvite}
                onClose={() => setShowInvite(false)}
                screeningCode={selectedCode}
                roleTitle={selectedCodeData?.role_title}
            />

            {/* Candidate Compare Modal */}
            {showCompare && (
                <CandidateCompare
                    candidates={compareSelected}
                    onClose={() => setShowCompare(false)}
                />
            )}
        </div>
    );
}
