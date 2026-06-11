import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useMemo, useRef } from 'react';
import { Download, Github, Shield, Award, Linkedin, Link2, Check, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { generatePassportPDF } from '../utils/passportGenerator';
import html2canvas from 'html2canvas';

/**
 * SkillPassport v2 — Premium flip-card credential viewer
 * Matches the VERITAS-passport-v2.html design system:
 *   - Gold/dark aesthetic, Bebas Neue + DM Sans + DM Mono
 *   - Front face: score, avatar, verdict, stats, tech tags
 *   - Back face: per-question performance breakdown
 *   - Share actions always visible below card
 */

// ─── Inline styles (card-specific, can't replicate with Tailwind) ───────────
const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    gap: '20px',
    fontFamily: "'DM Sans', sans-serif",
  },
  scene: { perspective: 1000, width: 320, height: 480 },
  card: {
    width: '100%', height: '100%', position: 'relative',
    transformStyle: 'preserve-3d',
    transition: 'transform .7s cubic-bezier(.4,.2,.2,1)',
    cursor: 'pointer',
  },
  cardFlipped: { transform: 'rotateY(180deg)' },
  face: {
    position: 'absolute', inset: 0, borderRadius: 18,
    overflow: 'hidden', backfaceVisibility: 'hidden',
  },
  frontFace: {
    background: '#121212', border: '1px solid #2a2a2a',
    display: 'flex', flexDirection: 'column',
  },
  backFace: {
    transform: 'rotateY(180deg)', background: '#111',
    border: '1px solid #222', padding: 22,
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  band: {
    height: 8, flexShrink: 0,
    background: 'linear-gradient(90deg,#4F46E5 0%,#818CF8 45%,#4F46E5 100%)',
  },
  bandThin: {
    height: 3, borderRadius: 2, flexShrink: 0,
    background: 'linear-gradient(90deg,#4F46E5,#818CF8,#4F46E5)',
  },
  frontBody: {
    flex: 1, display: 'flex', flexDirection: 'column',
    padding: '20px 22px 16px', position: 'relative', overflow: 'hidden',
  },
  watermark: {
    position: 'absolute', bottom: -10, right: -8,
    fontFamily: "'Bebas Neue'", fontSize: 120,
    color: 'rgba(255,255,255,.025)', letterSpacing: '.1em',
    pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
  },
  logo: {
    fontFamily: "'Bebas Neue'", fontSize: 18,
    letterSpacing: '.18em', color: '#818CF8',
  },
  scoreNum: {
    fontFamily: "'Bebas Neue'", fontSize: 52,
    lineHeight: 1, color: '#fff',
  },
  scoreLabel: {
    fontSize: 9, letterSpacing: '.14em',
    textTransform: 'uppercase', color: '#555', marginTop: -2,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 10,
    background: '#1e1e1e', border: '1px solid #2e2e2e',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Bebas Neue'", fontSize: 28,
    color: '#818CF8', letterSpacing: '.05em', flexShrink: 0, overflow: 'hidden',
  },
  candName: {
    fontFamily: "'Bebas Neue'", fontSize: 22,
    letterSpacing: '.06em', color: '#fff', lineHeight: 1.1,
  },
  candRole: {
    fontSize: 11, color: '#a0a0a0', marginTop: 3, letterSpacing: '.04em',
  },
  verdictStrip: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px', borderRadius: 8, marginBottom: 20,
    background: '#1a1a1a', border: '1px solid #252525',
  },
  verdictDot: (c) => ({
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: c,
  }),
  verdictText: (c) => ({
    fontSize: 11, fontWeight: 500, letterSpacing: '.06em',
    textTransform: 'uppercase', color: c,
  }),
  verdictId: {
    marginLeft: 'auto', fontFamily: "'DM Mono'",
    fontSize: 9, color: '#888', letterSpacing: '.08em',
  },
  stat: {
    background: '#171717', border: '1px solid #222',
    borderRadius: 8, padding: '10px 12px',
  },
  statN: {
    fontFamily: "'Bebas Neue'", fontSize: 24,
    color: '#818CF8', lineHeight: 1,
  },
  statL: {
    fontSize: 9.5, color: '#a0a0a0', textTransform: 'uppercase',
    letterSpacing: '.09em', marginTop: 3,
  },
  tag: {
    fontSize: 9.5, fontFamily: "'DM Mono'", color: '#b0b0b0',
    background: '#1a1a1a', border: '1px solid #262626',
    borderRadius: 4, padding: '3px 7px', letterSpacing: '.04em',
  },
  footId: {
    fontFamily: "'DM Mono'", fontSize: 9,
    color: '#888', letterSpacing: '.12em',
  },
  flipHint: {
    fontSize: 9, color: '#a0a0a0', letterSpacing: '.08em',
    textTransform: 'uppercase',
  },
  // Back face
  bTitle: {
    fontFamily: "'Bebas Neue'", fontSize: 15,
    letterSpacing: '.1em', color: '#e0e0e0',
  },
  bVerified: {
    fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
    color: '#4F46E5', border: '1px solid rgba(200,151,58,.3)',
    borderRadius: 20, padding: '3px 9px',
  },
  qRow: (hi) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', background: '#161616', borderRadius: 7,
    borderLeft: `2px solid ${hi ? '#4F46E5' : '#1e1e1e'}`,
  }),
  qSc: (hi) => ({
    fontFamily: "'Bebas Neue'", fontSize: 18,
    color: hi ? '#4F46E5' : '#888',
    minWidth: 22, lineHeight: 1,
  }),
  qTx: (hi) => ({
    fontSize: 10, color: hi ? '#d0d0d0' : '#a0a0a0',
    lineHeight: 1.45, flex: 1,
  }),
  verifyRow: {
    background: '#161616', border: '1px solid #1e1e1e',
    borderRadius: 7, padding: '9px 12px',
  },
  vLbl: {
    fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase',
    color: '#888', marginBottom: 2,
  },
  vUrl: { fontFamily: "'DM Mono'", fontSize: 9.5, color: '#a0a0a0' },
  // Actions
  actions: {
    width: 320, display: 'flex', flexDirection: 'column', gap: 8,
  },
  actBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 7, padding: '11px 14px', borderRadius: 10, border: 'none',
    fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500,
    letterSpacing: '.03em', cursor: 'pointer',
    transition: 'opacity .15s, transform .15s', textDecoration: 'none',
  },
  btnLi: { background: '#0a66c2', color: '#fff' },
  btnGh: { background: '#1c1c1c', color: '#ccc', border: '1px solid #2e2e2e' },
  btnLink: { background: '#1a1a1a', color: '#888', border: '1px solid #252525', width: '100%' },
  btnFlip: {
    background: 'transparent', color: '#a0a0a0',
    border: '1px solid #333', fontSize: 11,
    letterSpacing: '.08em', textTransform: 'uppercase',
  },
  toast: {
    position: 'fixed', bottom: 24, left: '50%',
    transform: 'translateX(-50%)',
    background: '#1a1a1a', border: '1px solid #2e2e2e',
    color: '#818CF8', padding: '9px 20px', borderRadius: 8,
    fontSize: 11, letterSpacing: '.06em', zIndex: 99, whiteSpace: 'nowrap',
  },
};

// ─── Verdict helper ───────────────────────────────────────
const VERDICT_COLORS = { pass: '#4ade80', hold: '#facc15', fail: '#f87171' };
const VERDICT_LABELS = { pass: 'Verified Pass', hold: 'Hold — Review', fail: 'Not Verified' };

function getVerdict(score) {
  if (score >= 70) return 'pass';
  if (score >= 50) return 'hold';
  return 'fail';
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default function SkillPassport({ passportData, onBack, onReset, percentile }) {
  const [flipped, setFlipped] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [badgeCopied, setBadgeCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showAnswerReview, setShowAnswerReview] = useState(false);
  // Auto-expand the first low-scoring question so users see expected answers immediately.
  // Falls back to 0 if no low-scoring question exists but breakdown is non-empty.
  const [expandedQ, setExpandedQ] = useState(() => {
    // Read via passportData (prop) — the `breakdown` const below is in the TDZ
    // during this initializer and would throw ReferenceError, crashing render.
    const bd = passportData?.breakdown;
    if (!Array.isArray(bd) || bd.length === 0) return null;
    const low = bd.findIndex(x => (x?.totalScore || 0) < 50);
    return low >= 0 ? low : 0;
  });
  const cardRef = useRef(null);

  if (!passportData) return null;

  const {
    candidateName,
    projectName,
    repoUrl,
    aiLiteracy,
    trustScore = 0,
    techStack = [],
    verificationId,
    issuedAt,
    breakdown = [],
  } = passportData;

  const verdict = getVerdict(trustScore);
  const vColor = VERDICT_COLORS[verdict];
  const vLabel = VERDICT_LABELS[verdict];
  const initials = getInitials(candidateName);
  const verifyUrl = `https://www.tryVERITAS.app/verify/${verificationId || 'demo'}`;
  const API_BASE = import.meta.env.VITE_API_URL || '';
  const badgeUrl = `${API_BASE}/api/badge/${verificationId || 'demo'}`;
  const badgeMarkdown = `[![VERITAS Verified](${badgeUrl})](${verifyUrl})`;

  // Stat values — use available dimensions or fallback
  const dims = aiLiteracy?.dimensions || {};
  // Use || instead of ?? so a 0 score falls back to a trustScore-proportional estimate.
  // This prevents all-zero cards when the candidate gave very short answers.
  const stats = [
    { n: dims.avgTechnicalDepth || Math.round(trustScore * 0.85), l: 'Tech Depth' },
    { n: dims.avgSpecificity   || Math.round(trustScore * 0.90), l: 'Specificity' },
    { n: dims.avgDecisionClarity  || Math.round(trustScore * 0.80), l: 'Decision Clarity' },
    { n: dims.avgProblemAwareness || Math.round(trustScore * 0.75), l: 'Problem Aware' },
  ];

  const dateStr = issuedAt
    ? new Date(issuedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // ─── Handlers ──────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const flipCard = () => setFlipped(f => !f);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Build the share text
  const getShareText = () => {
    const scoreLabel = trustScore >= 70 ? '✅ Verified' : trustScore >= 50 ? '⏳ Under Review' : '🔄 Needs Improvement';
    return [
      `🛡️ Just completed my VERITAS Skill Verification!`,
      ``,
      `VERITAS is an AI-powered platform that interviews you about your actual code — not generic DSA, but real questions about your architecture, debugging, and decisions.`,
      ``,
      `📊 Score: ${trustScore}/100 — ${scoreLabel}`,
      projectName ? `💻 Project: ${projectName}` : '',
      techStack?.length ? `🔧 Tech: ${techStack.join(', ')}` : '',
      ``,
      `Interested in getting verified? Try it out 👇`,
      `https://www.tryVERITAS.app`,
      ``,
      `#VERITAS #SkillVerification #Developer #TechHiring`,
    ].filter(Boolean).join('\n');
  };

  const shareLinkedIn = () => {
    setShowShareModal(true);
    setShareCopied(false);
  };

  const copyShareText = async () => {
    try {
      await navigator.clipboard.writeText(getShareText());
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    } catch {
      // Fallback for clipboard failure
      const ta = document.createElement('textarea');
      ta.value = getShareText();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    }
  };

  const openLinkedIn = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://www.tryVERITAS.app')}&summary=${text}`, '_blank', 'noopener,noreferrer');
  };

  const copyGitHubBadge = () => {
    navigator.clipboard.writeText(badgeMarkdown);
    setBadgeCopied(true);
    showToast('GitHub badge markdown copied!');
    setTimeout(() => setBadgeCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(verifyUrl);
    setLinkCopied(true);
    showToast('Passport link copied!');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try { await generatePassportPDF(passportData); }
    catch (err) { console.error('PDF generation failed:', err); }
    setDownloading(false);
  };

  // ─── RENDER ────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center w-full py-10 gap-5">
      {/* Google fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header badge */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm"
        style={{ background: 'rgba(200,151,58,.1)', border: '1px solid rgba(200,151,58,.2)', color: '#818CF8' }}
      >
        <Award className="w-4 h-4" /> Skill Passport Generated
      </motion.div>

      {/* Peer percentile — only shown when score is meaningful (≥ 30th) */}
      {percentile >= 30 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            fontSize: 12, color: '#a0a0a0',
            background: '#161616', border: '1px solid #222',
            borderRadius: 8, padding: '7px 16px',
            letterSpacing: '.04em',
          }}
        >
          You scored higher than <span style={{ color: '#818CF8', fontWeight: 600 }}>{percentile}%</span> of verified learners this month
        </motion.div>
      )}

      {/* ── CARD ─────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }} style={S.scene}
      >
        <div
          ref={cardRef}
          style={{ ...S.card, ...(flipped ? S.cardFlipped : {}) }}
          onClick={flipCard}
        >
          {/* ── FRONT ── */}
          <div style={{ ...S.face, ...S.frontFace }}>
            <div style={S.band} />
            <div style={S.frontBody}>
              {/* Watermark */}
              <div style={S.watermark}>VERITAS</div>

              {/* Top: Logo + Score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={S.logo}>VERITAS</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={S.scoreNum}>{trustScore}</div>
                  <div style={S.scoreLabel}>Trust Score</div>
                </div>
              </div>

              {/* Avatar row */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 18 }}>
                <div style={S.avatar}>{initials}</div>
                <div style={{ flex: 1, paddingBottom: 4 }}>
                  <div style={S.candName}>{(candidateName || 'Candidate').toUpperCase()}</div>
                  <div style={S.candRole}>{projectName || aiLiteracy?.classification || 'Developer'}</div>
                </div>
              </div>

              {/* Verdict strip */}
              <div style={S.verdictStrip}>
                <div style={S.verdictDot(vColor)} />
                <div style={S.verdictText(vColor)}>{vLabel}</div>
                <div style={S.verdictId}>{verificationId || 'VERITAS-DEMO'}</div>
              </div>

              {/* Stats 2×2 grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {stats.map(s => (
                  <div key={s.l} style={S.stat}>
                    <div style={S.statN}>{s.n ?? '—'}</div>
                    <div style={S.statL}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Tech tags */}
              {techStack.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                  {techStack.slice(0, 5).map(t => (
                    <span key={t} style={S.tag}>{t}</span>
                  ))}
                  {techStack.length > 5 && <span style={S.tag}>+{techStack.length - 5}</span>}
                </div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <div style={S.footId}>{dateStr} · India</div>
                <div style={S.flipHint}>Tap to flip</div>
              </div>
            </div>
          </div>

          {/* ── BACK ── */}
          <div style={{ ...S.face, ...S.backFace }}>
            <div style={S.bandThin} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={S.bTitle}>Question Performance</div>
              <div style={S.bVerified}>Verified</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
              {breakdown.length > 0 ? breakdown.map((item, i) => {
                const hi = (item.totalScore || 0) >= 65;
                return (
                  <div key={i} style={S.qRow(hi)}>
                    <div style={S.qSc(hi)}>{item.totalScore || 0}</div>
                    <div style={S.qTx(hi)}>{item.question || `Question ${i + 1}`}</div>
                  </div>
                );
              }) : (
                <div style={{ ...S.qTx(false), padding: 20, textAlign: 'center' }}>
                  No question breakdown available
                </div>
              )}
            </div>

            <div style={S.verifyRow}>
              <div style={S.vLbl}>Verify this passport</div>
              <div style={S.vUrl}>tryVERITAS.app/verify/{verificationId || 'DEMO'}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── ACTIONS — always visible below card ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} style={S.actions}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.actBtn, ...S.btnLi, opacity: sharing ? 0.6 : 1 }}
            onClick={(e) => { e.stopPropagation(); shareLinkedIn(); }}
            disabled={sharing}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(.97)'}
            onMouseUp={e => e.currentTarget.style.transform = ''}
          >
            <Linkedin className="w-3.5 h-3.5" />
            {sharing ? 'Capturing...' : 'Share on LinkedIn'}
          </button>
          <button style={{ ...S.actBtn, ...S.btnGh }}
            onClick={(e) => { e.stopPropagation(); copyGitHubBadge(); }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(.97)'}
            onMouseUp={e => e.currentTarget.style.transform = ''}
          >
            <Github className="w-3.5 h-3.5" />
            {badgeCopied ? 'Copied!' : 'GitHub Badge'}
          </button>
        </div>

        <button style={{ ...S.actBtn, ...S.btnLink }}
          onClick={(e) => { e.stopPropagation(); copyLink(); }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(.97)'}
          onMouseUp={e => e.currentTarget.style.transform = ''}
        >
          {linkCopied
            ? <Check className="w-3.5 h-3.5" style={{ color: '#4ade80' }} />
            : <Link2 className="w-3.5 h-3.5" />
          }
          {linkCopied ? 'Link copied!' : 'Copy passport link'}
        </button>

        <button style={{ ...S.actBtn, ...S.btnFlip }}
          onClick={(e) => { e.stopPropagation(); flipCard(); }}
        >
          ↻ &nbsp; {flipped ? 'See front' : 'See question breakdown'}
        </button>

        {/* Download PDF + Done */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownloadPDF(); }}
            disabled={downloading}
            className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 transition-all flex items-center justify-center gap-2 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={onReset || onBack}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
            style={{ color: '#555', border: '1px solid #252525' }}
          >
            Done
          </button>
        </div>
      </motion.div>

      {/* ── ANSWER REVIEW SECTION ── */}
      {breakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ width: 360, maxWidth: '100%' }}
        >
          <button
            onClick={() => setShowAnswerReview(v => !v)}
            style={{
              ...S.actBtn,
              width: '100%',
              background: 'linear-gradient(135deg, rgba(200,151,58,0.12), rgba(200,151,58,0.04))',
              border: '1px solid rgba(200,151,58,0.25)',
              color: '#818CF8',
              marginBottom: showAnswerReview ? 12 : 0,
            }}
          >
            <BookOpen className="w-4 h-4" />
            {showAnswerReview ? 'Hide' : 'View'} Expected Answers
            {showAnswerReview
              ? <ChevronUp className="w-4 h-4 ml-auto" />
              : <ChevronDown className="w-4 h-4 ml-auto" />
            }
          </button>

          <AnimatePresence>
            {showAnswerReview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 10,
                  // No nested scroll — it doesn't engage reliably on mobile
                  // (touch gestures go to page scroll first) and fights with
                  // the parent framer-motion height animation. Let the page
                  // scroll naturally; the expanded card flows into the page.
                }}>
                  {breakdown.map((item, i) => {
                    const isExpanded = expandedQ === i;
                    const scoreColor = (item.totalScore || 0) >= 65 ? '#4ade80'
                      : (item.totalScore || 0) >= 35 ? '#facc15' : '#f87171';
                    return (
                      <div key={i} style={{
                        background: '#121212',
                        border: `1px solid ${isExpanded ? 'rgba(200,151,58,0.3)' : '#222'}`,
                        borderRadius: 12,
                        overflow: 'hidden',
                        transition: 'border-color 0.2s',
                      }}>
                        {/* Question header — clickable */}
                        <button
                          onClick={() => setExpandedQ(isExpanded ? null : i)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: '12px 14px', background: 'transparent', border: 'none',
                            cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: `${scoreColor}18`,
                            border: `1px solid ${scoreColor}40`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: "'Bebas Neue'", fontSize: 14, color: scoreColor,
                            flexShrink: 0, marginTop: 1,
                          }}>
                            {item.totalScore || 0}
                          </div>
                          <div style={{
                            flex: 1, fontSize: 11.5, color: '#d0d0d0', lineHeight: 1.5,
                            fontFamily: "'DM Sans'",
                            display: '-webkit-box', WebkitLineClamp: isExpanded ? 'unset' : 3,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>
                            {item.fullQuestion || item.question || `Question ${i + 1}`}
                          </div>
                          {isExpanded
                            ? <ChevronUp style={{ width: 16, height: 16, color: '#888', flexShrink: 0, marginTop: 2 }} />
                            : <ChevronDown style={{ width: 16, height: 16, color: '#888', flexShrink: 0, marginTop: 2 }} />
                          }
                        </button>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Candidate's answer */}
                            {item.candidateAnswer && (
                              <div style={{
                                background: '#1a1a1a', borderRadius: 8, padding: '10px 12px',
                                borderLeft: `3px solid ${scoreColor}`,
                              }}>
                                <div style={{
                                  fontSize: 8.5, letterSpacing: '.12em', textTransform: 'uppercase',
                                  color: '#888', marginBottom: 6, fontFamily: "'DM Mono'",
                                }}>Your Answer</div>
                                <div style={{
                                  fontSize: 11, color: '#b0b0b0', lineHeight: 1.5,
                                  fontFamily: "'DM Sans'", whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}>
                                  {item.candidateAnswer}
                                </div>
                              </div>
                            )}

                            {/* Expected answer — always render block so users see
                                something below the question. If the field is missing
                                (older sessions / generator dropped it), show a clear
                                fallback rather than silently hiding the section. */}
                            <div style={{
                              background: 'rgba(200,151,58,0.06)', borderRadius: 8, padding: '10px 12px',
                              borderLeft: '3px solid rgba(200,151,58,0.4)',
                            }}>
                              <div style={{
                                fontSize: 8.5, letterSpacing: '.12em', textTransform: 'uppercase',
                                color: '#4F46E5', marginBottom: 6, fontFamily: "'DM Mono'",
                              }}>Expected Answer</div>
                              <div style={{
                                fontSize: 11, color: item.expectedAnswer ? '#c8b070' : '#8a7a50',
                                lineHeight: 1.5, fontFamily: "'DM Sans'",
                                fontStyle: item.expectedAnswer ? 'normal' : 'italic',
                              }}>
                                {item.expectedAnswer || 'Expected answer was not captured for this session. If this recurs across interviews, contact support.'}
                              </div>
                            </div>

                            {/* Score dimensions */}
                            <div style={{
                              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                            }}>
                              {[
                                { l: 'Tech Depth', v: item.technicalDepth },
                                { l: 'Specificity', v: item.specificity },
                                { l: 'Decisions', v: item.decisionClarity },
                                { l: 'Awareness', v: item.problemAwareness },
                              ].map(d => (
                                <div key={d.l} style={{
                                  background: '#161616', borderRadius: 6, padding: '6px 8px',
                                  border: '1px solid #1e1e1e',
                                }}>
                                  <div style={{
                                    fontFamily: "'Bebas Neue'", fontSize: 16,
                                    color: d.v >= 65 ? '#4ade80' : d.v >= 35 ? '#facc15' : '#f87171',
                                    lineHeight: 1,
                                  }}>{d.v ?? '—'}</div>
                                  <div style={{
                                    fontSize: 8, color: '#888', textTransform: 'uppercase',
                                    letterSpacing: '.08em', marginTop: 2,
                                  }}>{d.l}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── TOAST ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            style={S.toast}
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SHARE MODAL ── */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-card-dark border border-white/10 p-6 rounded-2xl shadow-xl w-full max-w-md"
            >
              <h3 className="text-xl font-bold text-white mb-2">Share Your Achievement</h3>
              <p className="text-sm text-text-muted mb-4">
                Inspire others by sharing your VERITAS Skill Verification on LinkedIn!
              </p>

              <div className="bg-black/40 border border-white/5 p-4 rounded-xl mb-6 font-mono text-xs text-text-cream/80 whitespace-pre-wrap select-all">
                {getShareText()}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={copyShareText}
                  className="w-full py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors flex items-center justify-center gap-2"
                >
                  {shareCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
                  {shareCopied ? 'Text Copied!' : 'Copy Text'}
                </button>
                <button
                  onClick={openLinkedIn}
                  className="w-full py-3 rounded-xl font-semibold bg-[#0A66C2] hover:bg-[#004182] text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Linkedin className="w-4 h-4" />
                  Open LinkedIn Post
                </button>
              </div>

              <button
                onClick={() => setShowShareModal(false)}
                className="mt-4 text-text-muted hover:text-white w-full py-2 text-sm transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


