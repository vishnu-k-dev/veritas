import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Github, ArrowRight, Award, Clock, LogOut, User, ChevronRight, ExternalLink, Shield, Mail, Phone } from 'lucide-react';
import useAuth from '../hooks/useAuth.jsx';
import { apiRequest } from '../services/api';

/**
 * Examinee Dashboard — Hub for examinations, past Examination Reports, and scores
 */
export default function StudentDashboard({ onStartInterview, onEnterCode, onLogout, usageData, onViewPassport, onPractice, refreshUsage }) {
  const { user, profile } = useAuth();
  const [passports, setPassports] = useState([]);
  const [loading, setLoading] = useState(true);

  const interviewUsage = usageData?.interview;
  const limitReached = interviewUsage?.exceeded === true;

  useEffect(() => {
    loadPassports();
  }, [user]);

  // Always refresh usage on dashboard mount — covers stale state from login/cached data
  useEffect(() => {
    refreshUsage?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const loadPassports = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      // Read from Supabase — single source of truth
      const data = await apiRequest('/api/interview/list');
      const interviews = (data.interviews || []).map(i => ({
        id: i.id,
        trustScore: i.trust_score,
        verdict: i.verdict,
        verificationId: i.verdict_summary,
        repoUrl: i.repo_url,
        projectName: i.skill_passports?.[0]?.passport_data?.projectName || i.repo_url?.split('/').pop() || 'Project Interview',
        techStack: i.skill_passports?.[0]?.tech_stack || [],
        breakdown: i.skill_passports?.[0]?.scores || [],
        completedAt: i.completed_at,
        type: i.interview_type,
      }));
      setPassports(interviews);
    } catch (err) {
      console.log('No past interviews yet:', err.message);
      setPassports([]);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 45) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBg = (score) => {
    if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 45) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const formatDate = (d) => {
    if (!d) return 'N/A';
    const date = new Date(d);
    if (isNaN(date)) return 'N/A';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              {getInitials(profile?.name || user?.displayName)}
            </div>
            <div>
              <p className="text-sm text-text-muted">Welcome back,</p>
              <p className="text-lg font-bold text-white">{profile?.name || user?.displayName || 'Student'}</p>
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
            Your <span className="gradient-text">Examination Portfolio</span>
          </h2>
          <p className="text-text-muted max-w-lg">
            {profile?.college && <span className="text-white/70">{profile.college}</span>}
            {profile?.college && ' • '}
            Complete assessments, earn passports, verify your competency.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={onLogout}
            className="p-2.5 rounded-xl hover:bg-white/5 text-text-muted hover:text-white transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </motion.div>
      </header>

      {/* Usage Status Bar */}
      {interviewUsage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`rounded-2xl p-4 border ${
            limitReached
              ? 'bg-red-500/5 border-red-500/20'
              : 'bg-emerald-500/5 border-emerald-500/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className={`w-5 h-5 ${limitReached ? 'text-red-400' : 'text-emerald-400'}`} />
              <div>
                <p className="text-sm font-semibold text-white">
                  {limitReached
                    ? 'Free tier limit reached'
                    : `${interviewUsage.used}/${interviewUsage.limit} free assessments used`}
                </p>
                <p className="text-xs text-text-muted">
                  {limitReached
                    ? 'Contact us to upgrade for unlimited access'
                    : `${interviewUsage.remaining} remaining`}
                </p>
              </div>
            </div>
            {/* Progress dots */}
            <div className="flex gap-2">
              {Array.from({ length: interviewUsage.limit }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border ${
                    i < interviewUsage.used
                      ? 'bg-emerald-400 border-emerald-400'
                      : 'bg-white/5 border-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Contact Us CTA — shown when limit reached */}
      {limitReached && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-center"
        >
          <h3 className="text-lg font-bold text-white mb-2">Upgrade for Unlimited Access</h3>
          <p className="text-sm text-text-muted mb-4">You've completed your 2 free assessments. Contact us to unlock unlimited assessments and premium features.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:vishnuk2006@protonmail.com"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-semibold hover:bg-indigo-500/25 transition-all text-sm"
            >
              <Mail className="w-4 h-4" />
              vishnuk2006@protonmail.com
            </a>
            <a
              href="tel:+919611604661"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/25 transition-all text-sm"
            >
              <Phone className="w-4 h-4" />
              +91 9611604661
            </a>
          </div>
        </motion.div>
      )}

      {/* Quick Actions — hidden when limit reached */}
      {!limitReached && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid md:grid-cols-2 gap-4"
      >
        {/* GitHub Interview */}
        <button
          onClick={onStartInterview}
          className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-left cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <Github className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">GitHub Project Examination</h3>
            <p className="text-sm text-text-muted mb-4">Connect your GitHub, pick a project, and demonstrate your competency through a personalised AI examination.</p>
            <div className="inline-flex items-center gap-2 text-emerald-400 text-sm font-semibold group-hover:gap-3 transition-all">
              Start Assessment <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </button>

        {/* Enter Recruiter Code */}
        <button
          onClick={onEnterCode}
          className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 transition-all text-left cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary">passkey</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Enter Examination Code</h3>
            <p className="text-sm text-text-muted mb-4">Received a code from an institution or organization? Enter it to begin your examination session.</p>
            <div className="inline-flex items-center gap-2 text-primary text-sm font-semibold group-hover:gap-3 transition-all">
              Enter Code <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </button>
      </motion.div>
      )}

      {/* Practice Mode CTA */}
      {onPractice && !limitReached && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <button
            onClick={onPractice}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🎯</span>
              <div className="text-left">
                <p className="text-white font-semibold text-sm">Practice Mode</p>
                <p className="text-text-muted text-xs">Practice examination mode — instant feedback per answer, nothing saved or counted.</p>
              </div>
            </div>
            <span className="text-blue-400 text-sm font-medium group-hover:translate-x-1 transition-transform">Start →</span>
          </button>
        </motion.div>
      )}

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Assessments</p>
          <p className="text-2xl font-bold text-white">{passports.length}</p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Avg Score</p>
          <p className={`text-2xl font-bold ${passports.length > 0 ? getScoreColor(Math.round(passports.reduce((a, p) => a + (p.trustScore || 0), 0) / passports.length)) : 'text-text-muted'}`}>
            {passports.length > 0
              ? `${Math.round(passports.reduce((a, p) => a + (p.trustScore || 0), 0) / passports.length)}%`
              : '—'}
          </p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Best Score</p>
          <p className={`text-2xl font-bold ${passports.length > 0 ? getScoreColor(Math.max(...passports.map(p => p.trustScore || 0))) : 'text-text-muted'}`}>
            {passports.length > 0
              ? `${Math.max(...passports.map(p => p.trustScore || 0))}%`
              : '—'}
          </p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Badges</p>
          <p className="text-2xl font-bold text-white">{passports.filter(p => p.trustScore >= 65).length}</p>
        </div>
      </motion.div>

      {/* Score Trajectory — only show if 2+ assessments */}
      {passports.length >= 2 && (() => {
        const sorted = [...passports]
          .filter(p => p.trustScore != null)
          .sort((a, b) => new Date(a.completedAt || 0) - new Date(b.completedAt || 0))
          .slice(-10); // last 10

        if (sorted.length < 2) return null;

        const W = 400, H = 160, PAD_X = 12, PAD_Y = 16;
        const scores = sorted.map(p => p.trustScore || 0);

        // Auto-fit Y-axis to the actual data range (padded) so a run of low
        // scores doesn't flatline at the bottom of a fixed 0-100 axis.
        const dataMin = Math.min(...scores);
        const dataMax = Math.max(...scores);
        const pad = Math.max(5, (dataMax - dataMin) * 0.3);
        const minS = Math.max(0, Math.floor(dataMin - pad));
        const maxS = Math.min(100, Math.ceil(dataMax + pad));
        const range = Math.max(1, maxS - minS);
        const gridScores = [
          Math.round(minS + range * 0.25),
          Math.round(minS + range * 0.5),
          Math.round(minS + range * 0.75),
        ];

        const points = scores.map((s, i) => ({
          x: PAD_X + (i / (scores.length - 1)) * (W - PAD_X * 2),
          y: H - PAD_Y - ((s - minS) / range) * (H - PAD_Y * 2),
        }));

        // Smooth cubic-bezier path
        const smoothPath = (pts) => {
          if (pts.length < 2) return '';
          let d = `M ${pts[0].x} ${pts[0].y}`;
          for (let i = 1; i < pts.length; i++) {
            const p0 = pts[i - 1], p1 = pts[i];
            const cx = (p0.x + p1.x) / 2;
            d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
          }
          return d;
        };
        const pathD = smoothPath(points);
        const fillD = `${pathD} L ${points[points.length - 1].x} ${H - PAD_Y} L ${points[0].x} ${H - PAD_Y} Z`;

        const latest = scores[scores.length - 1];
        const prev = scores[scores.length - 2];
        const delta = latest - prev;
        const trendIcon = delta > 0 ? '↗' : delta < 0 ? '↘' : '→';
        const trendColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-text-muted';

        const fmt = (d) => new Date(d || 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const midIdx = Math.floor(sorted.length / 2);

        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-transparent p-6"
          >
            {/* Ambient glow */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/[0.06] rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex items-start justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-white">Score Trajectory</h3>
                <p className="text-xs text-text-muted mt-0.5">Last {sorted.length} examinations</p>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold leading-none ${trendColor}`}>{latest}</div>
                <div className={`text-[11px] mt-1 font-medium ${trendColor} flex items-center gap-1 justify-end`}>
                  <span className="text-base leading-none">{trendIcon}</span>
                  {delta >= 0 ? '+' : ''}{delta} vs prev
                </div>
              </div>
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} className="relative w-full h-40">
              <defs>
                <linearGradient id="trajGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Gridlines at 25/50/75% of the visible range, labeled with actual values */}
              {gridScores.map(score => {
                const y = H - PAD_Y - ((score - minS) / range) * (H - PAD_Y * 2);
                return (
                  <g key={score}>
                    <line x1={PAD_X} x2={W - PAD_X} y1={y} y2={y}
                      stroke="white" strokeOpacity="0.05" strokeDasharray="3 5" strokeWidth="1" />
                    <text x={PAD_X + 2} y={y - 2} fontSize="8" fill="white" fillOpacity="0.3">{score}</text>
                  </g>
                );
              })}
              {/* Y-axis min/max labels */}
              <text x={PAD_X + 2} y={H - PAD_Y - 2} fontSize="8" fill="white" fillOpacity="0.35">{minS}</text>
              <text x={PAD_X + 2} y={PAD_Y + 8} fontSize="8" fill="white" fillOpacity="0.35">{maxS}</text>

              {/* Gradient fill under curve */}
              <path d={fillD} fill="url(#trajGrad)" />

              {/* Smooth animated line */}
              <motion.path
                d={pathD}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              />

              {/* Data points */}
              {points.map((p, i) => {
                const isLatest = i === points.length - 1;
                return (
                  <g key={i}>
                    {isLatest && (
                      <circle cx={p.x} cy={p.y} r="10" fill="#10b981" opacity="0.18">
                        <animate attributeName="r" values="8;13;8" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.25;0.05;0.25" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle
                      cx={p.x} cy={p.y}
                      r={isLatest ? 5 : 3}
                      fill={isLatest ? '#10b981' : '#0b0f14'}
                      stroke="#10b981"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>

            {/* 3 evenly-spaced date labels */}
            <div className="relative flex justify-between mt-3 text-[10px] text-text-muted/60 font-medium">
              <span>{fmt(sorted[0].completedAt)}</span>
              {sorted.length > 2 && <span>{fmt(sorted[midIdx].completedAt)}</span>}
              <span>{fmt(sorted[sorted.length - 1].completedAt)}</span>
            </div>
          </motion.div>
        );
      })()}

      {/* Past Passports */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Examination Reports</h3>
          <span className="text-sm text-text-muted">{passports.length} total</span>
        </div>

        {loading ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <div className="w-10 h-10 mx-auto border-4 border-card-dark border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-text-muted mt-4">Loading your passports...</p>
          </div>
        ) : passports.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Award className="w-8 h-8 text-emerald-400/50" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">No examinations yet</h4>
            <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
              Complete your first examination to earn a verified VERITAS Examination Report.
            </p>
            <button
              onClick={onStartInterview}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Github className="w-4 h-4" />
              Begin Your First Examination
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {passports.map((passport, i) => (
              <motion.div
                key={passport.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onViewPassport && onViewPassport(passport)}
                className="glass-panel rounded-xl p-5 hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-emerald-500/20"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`w-12 h-12 flex-shrink-0 aspect-square rounded-xl border flex items-center justify-center ${getScoreBg(passport.trustScore || 0)}`}>
                      <span className={`text-lg font-bold ${getScoreColor(passport.trustScore || 0)}`}>
                        {passport.trustScore || 0}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-white truncate">{passport.projectName || 'Examination Session'}</h4>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {passport.repoUrl && (
                          <a
                            href={passport.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-text-muted hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
                          >
                            <Github className="w-3 h-3" />
                            {passport.repoUrl.split('/').slice(-1)[0]}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(passport.completedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {passport.verificationId && (
                      <span className="text-xs font-mono text-text-muted bg-white/5 px-2 py-1 rounded">
                        {passport.verificationId}
                      </span>
                    )}
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${passport.trustScore >= 65
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : passport.trustScore >= 45
                        ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}>
                      {passport.trustScore >= 65 ? 'Verified' : passport.trustScore >= 45 ? 'Review' : 'Flagged'}
                    </div>
                  </div>
                </div>

                {/* Tech stack tags */}
                {passport.techStack && passport.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {passport.techStack.slice(0, 5).map(tech => (
                      <span key={tech} className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-text-muted">
                        {tech}
                      </span>
                    ))}
                    {passport.techStack.length > 5 && (
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-text-muted">
                        +{passport.techStack.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-panel rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-text-muted" />
            Profile
          </h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-text-muted mb-1">Name</p>
            <p className="text-white font-medium">{profile?.name || user?.displayName || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">Email</p>
            <p className="text-white font-medium">{user?.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">College</p>
            <p className="text-white font-medium">{profile?.college || '—'}</p>
          </div>
          {profile?.year && (
            <div>
              <p className="text-xs text-text-muted mb-1">Year</p>
              <p className="text-white font-medium">{profile.year}</p>
            </div>
          )}
          {profile?.branch && (
            <div>
              <p className="text-xs text-text-muted mb-1">Branch</p>
              <p className="text-white font-medium">{profile.branch}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
