import { useState, useEffect, useRef } from 'react';
import HeroAnimation from '../components/HeroAnimation';

/* ─── scoped CSS (parchment editorial theme from Claude Design) ─────── */
const LANDING_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap');

.land-root {
  --bg: #F5F2E9;
  --surface: #FDFCF8;
  --surface-2: #EFEBDF;
  --surface-3: #E7E2D2;
  --line: rgba(28,25,18,0.13);
  --line-strong: rgba(28,25,18,0.26);
  --text: #1C1912;
  --soft: #524C3F;
  --muted: #8B8472;
  --evidence: #5E5747;
  --accent: #8E2A1B;
  --accent-deep: #6E2014;
  --verified: #1E6B45;
  --ai: #4F4380;
  --font-display: "Newsreader", Georgia, serif;
  --font-serif: "Newsreader", Georgia, serif;
  --font-ui: "Geist", system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;

  font-family: var(--font-ui);
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.land-root * { box-sizing: border-box; margin: 0; padding: 0; }
.land-root a { color: inherit; text-decoration: none; }
.land-root ::selection { background: rgba(142,42,27,0.18); }

/* scrollbar */
.land-root ::-webkit-scrollbar { width: 10px; }
.land-root ::-webkit-scrollbar-track { background: transparent; }
.land-root ::-webkit-scrollbar-thumb { background: rgba(28,25,18,0.18); border-radius: 5px; border: 2px solid var(--bg); }

/* ── nav ── */
.land-nav {
  position: sticky; top: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  height: 66px; padding: 0 max(28px, calc(50vw - 620px));
  background: rgba(245,242,233,0.93);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.land-nav-links { display: flex; align-items: center; gap: 30px; }
.land-nav-links a {
  font-size: 13px; color: var(--soft); letter-spacing: 0.01em;
  border-bottom: 1px solid transparent; padding-bottom: 2px;
  transition: color 0.15s, border-color 0.15s;
}
.land-nav-links a:hover { color: var(--text); border-bottom-color: var(--line-strong); }

/* wordmark */
.land-root .wordmark {
  font-family: var(--font-ui); font-weight: 600; font-size: 14px;
  letter-spacing: 0.26em; color: var(--text);
  display: inline-flex; align-items: baseline; user-select: none;
  background: none; border: none; cursor: pointer;
}
.land-root .wordmark .a-mark {
  color: var(--accent); font-family: var(--font-serif);
  font-style: italic; font-weight: 500; font-size: 1.18em; margin: 0 0.02em;
}

/* buttons */
.land-root .btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-ui); font-size: 13.5px; font-weight: 500;
  letter-spacing: 0.01em; padding: 11px 20px;
  border-radius: 2px; border: 1px solid transparent;
  cursor: pointer; transition: background 0.16s, border-color 0.16s, color 0.16s;
  white-space: nowrap;
}
.land-root .btn:active { transform: translateY(1px); }
.land-root .btn-primary { background: var(--text); color: var(--surface); border-color: var(--text); }
.land-root .btn-primary:hover { background: var(--accent-deep); border-color: var(--accent-deep); }
.land-root .btn-ghost { background: transparent; color: var(--text); border-color: var(--line-strong); }
.land-root .btn-ghost:hover { border-color: var(--text); }
.land-root .btn-paper { background: var(--bg); color: var(--text); border: none; }
.land-root .btn-paper:hover { background: #fff; }

/* wrap */
.land-root .wrap { max-width: 1240px; margin: 0 auto; padding: 0 28px; }

/* ── hero ── */
.land-hero { padding: 72px 0 0; }

/* left text + right (animation + cert) — portrait frames (720×1280) so right col is narrow */
.hero-grid {
  display: grid; grid-template-columns: 1fr 320px;
  gap: 64px; align-items: start;
  padding-bottom: 56px;
}
.hero-left {
  display: flex; flex-direction: column;
  padding-top: 16px;
}
.hero-right-col {
  display: flex; flex-direction: column;
}
.hero-cert-row {
  display: flex; justify-content: center;
  padding: 48px 0 72px;
  border-bottom: 1px solid var(--line);
}
.hero-cert-row .cert { width: 420px; max-width: 100%; }
.land-hero h1 {
  font-family: var(--font-display);
  font-size: clamp(32px, 4.2vw, 62px);
  line-height: 1.04; font-weight: 500;
  letter-spacing: -0.022em;
}
.land-hero h1 .dim { color: var(--muted); }
.land-hero h1 em { font-style: italic; font-weight: 400; color: var(--accent); }
.hero-sub { font-size: 16.5px; line-height: 1.65; color: var(--soft); margin-top: 24px; }
.hero-ctas { display: flex; gap: 14px; align-items: center; margin-top: 28px; flex-wrap: wrap; }
.hero-meta {
  margin-top: 22px; display: flex; gap: 26px;
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em;
  color: var(--muted); text-transform: uppercase;
}

/* video/gif slot — 9:16 portrait to match frame dimensions */
.hero-media {
  width: 100%; aspect-ratio: 9/16;
  border: 1px solid var(--line-strong);
  border-radius: 3px; overflow: hidden;
  background: var(--surface-2);
  position: relative;
}
.hero-media video,
.hero-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hero-media-placeholder {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--muted);
}
.hero-media-placeholder .pm-label {
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--muted);
}
.hero-media-livepin {
  position: absolute; bottom: 10px; left: 10px;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 2px;
  background: rgba(28,25,18,0.72); backdrop-filter: blur(4px);
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.16em;
  text-transform: uppercase; color: rgba(253,252,248,0.8);
}
.hero-media-livepin .dot { width: 5px; height: 5px; border-radius: 50%; background: #4ade80; animation: land-breathe 2s ease-in-out infinite; }
@keyframes land-breathe { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

/* certificate card */
.cert {
  width: 100%;
  background: var(--surface); border: 1px solid var(--line-strong);
  border-radius: 3px; padding: 24px 28px 22px;
  box-shadow: 0 1px 0 rgba(28,25,18,0.04), 0 24px 48px -28px rgba(28,25,18,0.28);
  position: relative;
}
.cert::before {
  content: ""; position: absolute; inset: 7px;
  border: 1px solid var(--line); border-radius: 1px; pointer-events: none;
}
.cert-type {
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.26em;
  text-transform: uppercase; color: var(--muted); text-align: center; margin-bottom: 16px;
}
.cert-name { font-family: var(--font-display); font-size: 26px; font-weight: 500; text-align: center; letter-spacing: -0.01em; line-height: 1.1; }
.cert-proj { font-size: 12.5px; color: var(--soft); text-align: center; margin-top: 4px; font-family: var(--font-serif); font-style: italic; }
.cert-scores {
  display: grid; grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  margin: 18px 0 16px;
}
.cert-score { text-align: center; padding: 12px 6px 10px; }
.cert-score + .cert-score { border-left: 1px solid var(--line); }
.cert-score .sc-val { font-family: var(--font-display); font-size: 26px; font-weight: 500; line-height: 1; }
.cert-score .sc-label { font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-top: 6px; }
.cert-score .sc-tier { font-size: 10.5px; margin-top: 3px; font-family: var(--font-serif); font-style: italic; }
.sc-distinguished { color: var(--verified); }
.sc-proficient { color: var(--text); }
.cert-foot { display: flex; justify-content: space-between; align-items: center; }
.cert-hash .h-label { font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.18em; color: var(--muted); text-transform: uppercase; display: block; margin-bottom: 3px; }
.cert-hash .h-val { font-family: var(--font-mono); font-size: 11.5px; color: var(--evidence); letter-spacing: 0.02em; }
.cert-seal { transform: rotate(-9deg); }

/* ── section scaffolding ── */
.land-sec { padding: 84px 0; border-top: 1px solid var(--line); }
.sec-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 54px; gap: 32px; flex-wrap: wrap; }
.sec-head h2 {
  font-family: var(--font-display); font-size: clamp(30px, 3.4vw, 44px);
  font-weight: 500; letter-spacing: -0.018em; line-height: 1.08; max-width: 640px;
}
.sec-head .eyebrow { margin-bottom: 16px; display: block; }
.sec-head p.lede { color: var(--soft); font-size: 15.5px; max-width: 360px; }
.eyebrow { font-family: var(--font-mono); font-size: 10.5px; font-weight: 500; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); }

/* scroll reveal */
.sr { opacity: 0; transform: translateY(18px); transition: opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1); }
.sr.in { opacity: 1; transform: none; }

/* reveal on mount */
.rv { opacity: 0; transform: translateY(16px); animation: land-rv-in 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
.rv.d1 { animation-delay: 0.05s; } .rv.d2 { animation-delay: 0.16s; }
.rv.d3 { animation-delay: 0.3s; } .rv.d4 { animation-delay: 0.44s; }
@keyframes land-rv-in { to { opacity: 1; transform: none; } }

/* ── how it works — step rows ── */
.step-rows { border-top: 1px solid var(--text); }
.step-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 360px) 1fr auto;
  gap: 36px; align-items: baseline;
  padding: 30px 0; border-bottom: 1px solid var(--line);
  transition: background 0.2s ease; cursor: pointer;
}
.step-row:hover { background: rgba(253,252,248,0.85); }
.step-row .n { font-family: var(--font-display); font-size: 38px; font-weight: 400; color: var(--muted); line-height: 1; }
.step-row h3 { font-family: var(--font-display); font-size: 24px; font-weight: 500; letter-spacing: -0.012em; }
.step-row p { font-size: 14px; color: var(--soft); max-width: 480px; }
.step-row .go {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--accent);
  display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;
}
.step-row .go::after { content: "→"; transition: transform 0.18s ease; }
.step-row:hover .go::after { transform: translateX(4px); }

/* ── pillars ── */
.pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px; }
.pillar { border-top: 2px solid var(--text); padding-top: 22px; }
.pillar .p-k { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin-bottom: 14px; }
.pillar h3 { font-family: var(--font-display); font-size: 28px; font-weight: 500; letter-spacing: -0.014em; margin-bottom: 10px; }
.pillar > p { font-size: 14.5px; color: var(--soft); }
.pillar ul { list-style: none; margin-top: 20px; }
.pillar li { font-size: 13.5px; color: var(--soft); line-height: 1.55; padding: 10px 0; border-top: 1px solid var(--line); display: flex; gap: 12px; }
.pillar li::before { content: "—"; color: var(--muted); flex-shrink: 0; }

/* ── problem section ── */
.prob-section { background: var(--surface-2); }
.prob-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  border: 1px solid var(--line-strong); border-radius: 3px; overflow: hidden;
}
.prob-candidate { padding: 44px 40px; background: var(--surface); position: relative; }
.prob-candidate + .prob-candidate { border-left: 1px solid var(--line-strong); }
.prob-tag {
  font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.22em;
  text-transform: uppercase; margin-bottom: 22px;
  display: inline-flex; align-items: center; gap: 8px; color: var(--muted);
}
.prob-tag-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
.prob-name { font-family: var(--font-display); font-size: 30px; font-weight: 500; letter-spacing: -0.014em; margin-bottom: 4px; color: var(--text); }
.prob-role { font-size: 11px; color: var(--muted); margin-bottom: 26px; font-family: var(--font-mono); letter-spacing: 0.14em; text-transform: uppercase; }
.prob-story { font-size: 14px; color: var(--soft); line-height: 1.78; margin-bottom: 30px; }
.prob-story em { color: var(--text); font-style: normal; font-weight: 500; }
.prob-result { border-top: 1px solid var(--line); padding-top: 22px; }
.prob-result-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }
.prob-verdict-row { display: flex; gap: 10px; }
.pvo { background: var(--surface-2); border: 1px solid var(--line); border-radius: 2px; padding: 10px 14px; flex: 1; }
.pvo-head { font-size: 9.5px; font-family: var(--font-mono); letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.pvo-val { font-family: var(--font-display); font-size: 16px; font-weight: 500; color: var(--text); }
.pvo-val.fail { color: var(--accent); }
.pvo-val.pass { color: var(--verified); }
.prob-footnote { margin-top: 12px; font-size: 12.5px; color: var(--muted); line-height: 1.65; }
.prob-resolution {
  margin-top: 32px; background: var(--surface);
  border: 1px solid var(--line-strong); border-radius: 3px;
  padding: 40px 48px; text-align: center;
}
.prob-resolution .eyebrow-warm { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); margin-bottom: 18px; display: block; }
.prob-resolution h3 { font-family: var(--font-display); font-size: clamp(20px, 2.4vw, 30px); font-weight: 500; letter-spacing: -0.014em; color: var(--text); line-height: 1.25; max-width: 700px; margin: 0 auto; }
.prob-resolution p { margin-top: 14px; font-size: 14px; color: var(--soft); line-height: 1.75; max-width: 620px; margin-left: auto; margin-right: auto; }
@media (max-width: 1080px) {
  .prob-grid { grid-template-columns: 1fr; }
  .prob-candidate + .prob-candidate { border-left: none; border-top: 1px solid var(--line-strong); }
  .prob-resolution { padding: 32px 24px; }
}

/* ── demo band ── */
.demo-band {
  background: var(--text); color: var(--bg); border-radius: 3px;
  padding: 56px 60px;
  display: flex; align-items: center; justify-content: space-between; gap: 48px;
}
.demo-band .eyebrow { color: #C97F6B; }
.demo-band h3 {
  font-family: var(--font-display); font-size: clamp(26px, 3vw, 38px);
  font-weight: 500; letter-spacing: -0.015em; margin: 14px 0 10px;
}
.demo-band p { color: rgba(245,242,233,0.72); font-size: 15px; max-width: 560px; }
.demo-band .btn-paper { flex-shrink: 0; }

/* ── FAQ ── */
.faq { max-width: 820px; border-top: 1px solid var(--text); }
.faq-item { border-bottom: 1px solid var(--line); }
.faq-q {
  width: 100%; background: none; border: none; color: var(--text);
  font-family: var(--font-display); font-size: 20px; font-weight: 500; text-align: left;
  letter-spacing: -0.008em;
  padding: 24px 0; cursor: pointer;
  display: flex; justify-content: space-between; align-items: center; gap: 24px;
}
.faq-fx { font-family: var(--font-mono); color: var(--muted); font-size: 17px; font-weight: 400; transition: transform 0.25s ease, color 0.25s; flex-shrink: 0; }
.faq-item.open .faq-fx { transform: rotate(45deg); color: var(--accent); }
.faq-a { overflow: hidden; transition: max-height 0.3s ease; }
.faq-a p { color: var(--soft); font-size: 14.5px; line-height: 1.7; padding-bottom: 26px; max-width: 660px; }

/* ── footer ── */
.land-foot { border-top: 1px solid var(--text); padding: 36px 0 60px; }
.foot-row { display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap; }
.foot-note { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.18em; color: var(--muted); text-transform: uppercase; }

/* ── responsive ── */
@media (max-width: 1080px) {
  .hero-grid { grid-template-columns: 1fr; }
  .hero-right-col { width: 100%; max-width: 420px; }
  .step-row { grid-template-columns: 64px 1fr; grid-template-rows: auto auto; }
  .step-row .go { grid-column: 2; }
  .pillars { grid-template-columns: 1fr; gap: 36px; }
  .demo-band { flex-direction: column; align-items: flex-start; padding: 40px 36px; }
  .land-nav-links { display: none; }
}
`;

/* ─── scroll reveal hook ───────────────────────────────────────────────── */
function useScrollReveal() {
    useEffect(() => {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
            });
        }, { threshold: 0.12 });
        document.querySelectorAll('.land-root .sr').forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, []);
}

/* ─── FAQ item ─────────────────────────────────────────────────────────── */
function FAQItem({ q, a }) {
    const [open, setOpen] = useState(false);
    const bodyRef = useRef(null);

    useEffect(() => {
        if (bodyRef.current) {
            bodyRef.current.style.maxHeight = open ? bodyRef.current.scrollHeight + 'px' : '0';
        }
    }, [open]);

    return (
        <div className={`faq-item${open ? ' open' : ''}`}>
            <button className="faq-q" onClick={() => setOpen((v) => !v)}>
                {q}
                <span className="faq-fx">+</span>
            </button>
            <div className="faq-a" ref={bodyRef} style={{ maxHeight: 0 }}>
                <p>{a}</p>
            </div>
        </div>
    );
}

/* ─── Seal SVG ──────────────────────────────────────────────────────────── */
function Seal({ size = 74 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 120 120" className="cert-seal">
            <defs>
                <path id="sealArc" d="M 60,60 m -44,0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0" />
            </defs>
            <circle cx="60" cy="60" r="56" fill="none" stroke="#8E2A1B" strokeWidth="1.5" />
            <circle cx="60" cy="60" r="33" fill="none" stroke="#8E2A1B" strokeWidth="1" />
            <text fill="#8E2A1B" fontFamily="Geist Mono, monospace" fontSize="9.5" letterSpacing="3.2">
                <textPath href="#sealArc">VERITAS · EXAMINED · VERIFIED · 2026 ·</textPath>
            </text>
            <text x="60" y="71" textAnchor="middle" fill="#8E2A1B" fontFamily="Newsreader, serif" fontStyle="italic" fontSize="34">V</text>
        </svg>
    );
}

/* ─── main component ─────────────────────────────────────────────────── */
export default function Landing({ onGetStarted }) {
    useScrollReveal();

    const faqs = [
        {
            q: "What stops a candidate from having someone else do the work?",
            a: "That's exactly what the viva tests. Questions reference specific commits, decisions, and trade-offs from the evidence — \"why did you switch hashing strategies in commit a3f9c21?\" is unanswerable by someone who didn't make that decision. Ownership is scored separately from Competency for this reason.",
        },
        {
            q: "How is this different from AI proctoring?",
            a: "Proctoring assumes the exam is worth defending and watches the candidate. VERITAS inverts it: the exam is generated from the candidate's own work, so impersonation and memorised answers stop working. Integrity monitoring exists, but it's a supporting signal — not the product.",
        },
        {
            q: "Can institutions trust an AI's grading?",
            a: "They don't have to trust it blindly. Every score decomposes into sub-scores, every judgement cites the evidence and the answer that produced it, and the Institution Review Console exposes the full reasoning chain and session replay. AI-generated content is visually marked everywhere it appears.",
        },
        {
            q: "What does the candidate walk away with?",
            a: "A shareable Examination Report with a verification ID. Anyone — an employer, an admissions office — can confirm the report is genuine and see what was examined, without seeing the private session detail.",
        },
        {
            q: "What's in this demo?",
            a: "One complete examinee journey: Rahul's evidence becomes a Blueprint, the Blueprint becomes an adaptive viva, the viva becomes a verified report — and the Institution Review Console shows how an examiner audits all of it. Use the journey bar at the top of each screen to navigate.",
        },
    ];

    return (
        <>
            <style>{LANDING_CSS}</style>
            <div className="land-root">

                {/* ── nav ── */}
                <nav className="land-nav">
                    <button className="wordmark" onClick={onGetStarted}>
                        VERIT<span className="a-mark">A</span>S
                    </button>
                    <div className="land-nav-links">
                        <a href="#how">How it works</a>
                        <a href="#pillars">Secure · Fair · Intelligent</a>
                        <a href="#faq">Judge FAQ</a>
                    </div>
                    <button className="btn btn-primary" onClick={() => window.location.href = '/exam'}>
                        Start examination
                    </button>
                </nav>

                {/* ── hero ── */}
                <header className="land-hero">
                    <div className="wrap">

                        {/* hero grid: left = headline + sub + CTAs, right = animation + cert */}
                        <div className="hero-grid">
                            {/* left column — all text */}
                            <div className="hero-left rv d1">
                                <h1>
                                    <span className="dim">Most platforms make exams harder to cheat.</span>
                                    <br />
                                    <span>VERITAS makes them <em>worth taking.</em></span>
                                </h1>
                                <p className="hero-sub">
                                    VERITAS reads a candidate's real work — a repository, a paper, a portfolio — builds a personalised examination from it, conducts an adaptive written viva, and issues a verifiable, evidence-backed report institutions can trust.
                                </p>
                                <div className="hero-ctas">
                                    <button className="btn btn-primary" onClick={() => window.location.href = '/exam'}>
                                        Start examination
                                    </button>
                                </div>
                            </div>

                            {/* right column — animation only */}
                            <div className="hero-right-col rv d2">
                                <div className="hero-media">
                                    <HeroAnimation className="w-full h-full" />
                                    <div className="hero-media-livepin">
                                        <span className="dot" />
                                        Adaptive Viva · Live
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* cert card — centered below the grid */}
                        <div className="hero-cert-row rv d3">
                            <div className="cert">
                                <div className="cert-type">Examination Report · № VRT-2026-0610</div>
                                <div className="cert-name">Rahul Mehta</div>
                                <div className="cert-proj">URL Shortener Service — three-month capstone</div>
                                <div className="cert-scores">
                                    <div className="cert-score">
                                        <div className="sc-val">94</div>
                                        <div className="sc-label">Authenticity</div>
                                        <div className="sc-tier sc-distinguished">Distinguished</div>
                                    </div>
                                    <div className="cert-score">
                                        <div className="sc-val">91</div>
                                        <div className="sc-label">Ownership</div>
                                        <div className="sc-tier sc-distinguished">Distinguished</div>
                                    </div>
                                    <div className="cert-score">
                                        <div className="sc-val">87</div>
                                        <div className="sc-label">Competency</div>
                                        <div className="sc-tier sc-proficient">Proficient</div>
                                    </div>
                                </div>
                                <div className="cert-foot">
                                    <div className="cert-hash">
                                        <span className="h-label">Verification ID</span>
                                        <span className="h-val">VRT-2026-0610-R8K2M4</span>
                                    </div>
                                    <Seal />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* ── problem ── */}
                <section className="land-sec prob-section" id="problem">
                    <div className="wrap">
                        <div className="sec-head sr">
                            <div>
                                <span className="eyebrow" style={{ color: '#C97F6B' }}>The broken status quo</span>
                                <h2>Two candidates. One repo. Same exam.<br/>The wrong person got the job.</h2>
                            </div>
                            <p className="lede">In every technical hiring round, the same injustice plays out — invisible to the interviewer.</p>
                        </div>

                        <div className="prob-grid sr">
                            {/* Candidate A */}
                            <div className="prob-candidate">
                                <div className="prob-tag">
                                    <span className="prob-tag-dot"></span>
                                    Candidate A
                                </div>
                                <div className="prob-name">Arjun Sharma</div>
                                <div className="prob-role">Built it. Every commit, every debug session.</div>
                                <p className="prob-story">
                                    Eight months. Three rewrites of the auth flow before the JWT expiry edge case was handled correctly. A Redis caching layer added after the first load spike — documented in commit <em>a3f9c2b</em> at 2am with the message "fix: cache miss on short-lived keys." He can tell you exactly why he chose Bull for the job queue, not because it sounded impressive, but because he read the pricing page and did the math.
                                </p>
                                <div className="prob-result">
                                    <div className="prob-result-label">Traditional technical interview</div>
                                    <div className="prob-verdict-row">
                                        <div className="pvo">
                                            <div className="pvo-head">Question</div>
                                            <div className="pvo-val" style={{ fontSize: 13, fontFamily: 'var(--font-ui)' }}>"Tell me about a challenging project."</div>
                                        </div>
                                        <div className="pvo">
                                            <div className="pvo-head">Verdict</div>
                                            <div className="pvo-val fail">Rejected</div>
                                        </div>
                                    </div>
                                    <p className="prob-footnote">He spoke honestly about what went wrong and hesitated on the parts that were hard. The interviewer read uncertainty as weakness. His genuine knowledge was invisible behind the wrong kind of confidence.</p>
                                </div>
                            </div>

                            {/* Candidate B */}
                            <div className="prob-candidate">
                                <div className="prob-tag">
                                    <span className="prob-tag-dot" style={{ background: '#2D9E6B' }}></span>
                                    Candidate B
                                </div>
                                <div className="prob-name">Riya Menon</div>
                                <div className="prob-role">Cloned it. Renamed it. Listed it.</div>
                                <p className="prob-story">
                                    She forked a template, changed the name, pushed it to GitHub. Then spent two days on a prep course with the top 40 system design answers for this company. She can deliver a polished monologue about Redis caching, JWT expiry handling, and job queues — <em>none of which she has ever debugged</em> — with exactly the fluency interviewers reward. The STAR framework is second nature. The code is not.
                                </p>
                                <div className="prob-result">
                                    <div className="prob-result-label">Traditional technical interview</div>
                                    <div className="prob-verdict-row">
                                        <div className="pvo">
                                            <div className="pvo-head">Question</div>
                                            <div className="pvo-val" style={{ fontSize: 13, fontFamily: 'var(--font-ui)' }}>"Tell me about a challenging project."</div>
                                        </div>
                                        <div className="pvo">
                                            <div className="pvo-head">Verdict</div>
                                            <div className="pvo-val pass">Hired</div>
                                        </div>
                                    </div>
                                    <p className="prob-footnote">Confident, structured, keyword-optimised. She will struggle with the work she was hired to do. The team will spend weeks trying to understand why. The interviewer will never connect the dots.</p>
                                </div>
                            </div>
                        </div>

                        <div className="prob-resolution sr">
                            <span className="eyebrow-warm">The VERITAS difference</span>
                            <h3>What if the exam asked Arjun why commit <span style={{ color: 'var(--accent)' }}>a3f9c2b</span> exists — and asked Riya the same question about her repo?</h3>
                            <p>VERITAS reads the actual repository. Every question is grounded in a real decision, a real commit, a real tradeoff the author made. You can only answer it if you were actually there. There is no question bank to memorise. There is no generic answer that scores well. The exam becomes the proof.</p>
                        </div>
                    </div>
                </section>

                {/* ── how it works ── */}
                <section className="land-sec" id="how">
                    <div className="wrap">
                        <div className="sec-head sr">
                            <div>
                                <span className="eyebrow">How it works</span>
                                <h2>From real work to verified credential, in four movements</h2>
                            </div>
                            <p className="lede">No question banks. No proctoring theatre. The candidate's own evidence is the exam.</p>
                        </div>
                        <div className="step-rows">
                            {[
                                { n: '01', h: 'Submit evidence', p: "The candidate connects a GitHub repository, research paper, or portfolio. VERITAS reads every commit, decision, and artefact.", go: "Rahul's evidence", action: () => window.location.href = '/exam' },
                                { n: '02', h: 'Examination Blueprint', p: "The AI maps the work into a skill graph and drafts questions — each one traceable to a specific evidence fragment.", go: "View the Blueprint", action: () => window.location.href = '/exam' },
                                { n: '03', h: 'Adaptive viva', p: "A live written examination that probes deeper when answers are strong, and pivots when they aren't. Integrity is observed throughout.", go: "Enter the viva", action: () => window.location.href = '/exam' },
                                { n: '04', h: 'Verifiable report', p: "Authenticity, Ownership, and Competency scores with a full audit trail and a verification ID any institution can check.", go: "Open the report", action: onGetStarted },
                            ].map((s) => (
                                <div key={s.n} className="step-row sr" onClick={s.action}>
                                    <span className="n">{s.n}</span>
                                    <h3>{s.h}</h3>
                                    <p>{s.p}</p>
                                    <span className="go">{s.go}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── pillars ── */}
                <section className="land-sec" id="pillars">
                    <div className="wrap">
                        <div className="sec-head sr">
                            <div>
                                <span className="eyebrow">The hackathon theme, answered</span>
                                <h2>Secure. Fair. Intelligent.</h2>
                            </div>
                            <p className="lede">Each pillar is a design constraint, not a marketing word.</p>
                        </div>
                        <div className="pillars">
                            <div className="pillar sr">
                                <div className="p-k">I — Secure</div>
                                <h3>The exam is the security model</h3>
                                <p>Integrity is observed, not policed.</p>
                                <ul>
                                    <li>Every question derives from work only the author knows intimately</li>
                                    <li>Continuous session integrity indicators, always visible</li>
                                    <li>Tamper-evident report with cryptographic verification ID</li>
                                </ul>
                            </div>
                            <div className="pillar sr" style={{ transitionDelay: '0.08s' }}>
                                <div className="p-k">II — Fair</div>
                                <h3>No two candidates get the same exam</h3>
                                <p>Because no two did the same work.</p>
                                <ul>
                                    <li>Answers graded against the candidate's own evidence, not a curve</li>
                                    <li>Every AI judgement is cited, inspectable, and appealable</li>
                                    <li>Full session replay available to the institution</li>
                                </ul>
                            </div>
                            <div className="pillar sr" style={{ transitionDelay: '0.16s' }}>
                                <div className="p-k">III — Intelligent</div>
                                <h3>An examiner that adapts in real time</h3>
                                <p>Like the best human vivas do.</p>
                                <ul>
                                    <li>Strong answers trigger deeper follow-ups, not the next question</li>
                                    <li>Skill graph built from evidence, weighted by demonstrated depth</li>
                                    <li>AI-generated content is always marked as such</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── demo band ── */}
                <section className="land-sec">
                    <div className="wrap">
                        <div className="demo-band sr">
                            <div>
                                <span className="eyebrow">Real examination · no login</span>
                                <h3>Try it on your own repository</h3>
                                <p>Paste any public GitHub repository. VERITAS reads your code and commits, generates evidence-based questions, conducts a live viva, and issues a verifiable report — all in under ten minutes.</p>
                            </div>
                            <button className="btn btn-paper" onClick={() => window.location.href = '/exam'}>
                                Start your examination
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── FAQ ── */}
                <section className="land-sec" id="faq">
                    <div className="wrap">
                        <div className="sec-head sr">
                            <div>
                                <span className="eyebrow">Judge FAQ</span>
                                <h2>The questions you're about to ask</h2>
                            </div>
                        </div>
                        <div className="faq sr">
                            {faqs.map((f) => <FAQItem key={f.q} q={f.q} a={f.a} />)}
                        </div>
                    </div>
                </section>

                {/* ── footer ── */}
                <footer className="land-foot">
                    <div className="wrap foot-row">
                        <button className="wordmark" onClick={onGetStarted}>
                            VERIT<span className="a-mark">A</span>S
                        </button>
                        <span className="foot-note">Built for Far Away 2026 · Reimagining examinations</span>
                    </div>
                </footer>

            </div>
        </>
    );
}
