import { useEffect, useRef, useState, useCallback } from 'react';

/* ─── scripted session events ─────────────────────────────────────────── */
const EVENTS = [
  {
    type: 'examiner',
    tag: 'Q4 · BRANCH B2 · DEPTH 3',
    text: 'In commit a3f9c21 you replaced MD5 truncation with counter-based base62 encoding. What problem were you actually solving — and what did you give up?',
    evs: ['commit a3f9c21', 'src/encoder.ts#L12-L48'],
    typing: 1600,
  },
  {
    type: 'candidate',
    tag: 'TRANSCRIBED · 0:58',
    text: 'The MD5 approach truncated the hash to 7 characters, so collisions were a birthday-paradox problem — at around 5 million links the probability got uncomfortable. I moved to a Redis INCR counter encoded in base62, which guarantees uniqueness. What I gave up is unpredictability: sequential counters mean my short codes are enumerable. I added a random per-namespace offset to make that harder, but it\'s mitigation, not elimination.',
    typing: 2600,
  },
  {
    type: 'trigger',
    title: 'Adaptive follow-up triggered',
    body: 'Answer demonstrates <strong>first-hand decision knowledge</strong> — cites the collision threshold and names the trade-off unprompted. Escalating probe depth on this thread.',
    from: 3,
    to: 4,
  },
  {
    type: 'examiner',
    tag: 'Q4a · FOLLOW-UP · DEPTH 4',
    text: 'You said enumerable. If I can enumerate your URLs, what is the actual attack — and why was a random offset the right answer rather than going back to hashing?',
    evs: ['src/encoder.ts#L12-L48'],
    typing: 1800,
  },
  {
    type: 'int',
    kind: 'amber',
    text: 'RESPONSE LATENCY · 9s PAUSE LOGGED — ADVISORY ONLY',
  },
  {
    type: 'candidate',
    tag: 'TRANSCRIBED · 1:21',
    text: 'The attack is scraping — private links people assumed were secret. Enumeration turns my whole namespace into a crawlable dataset. Going back to hashing would reintroduce collisions to solve a problem that\'s really a policy problem: short links are not secrets. So I treated them as public by default, added optional password-protected links for sensitive ones, and put the sliding-window rate limiter on the resolve path so bulk enumeration is expensive. The offset just raises the floor.',
    typing: 3000,
  },
  {
    type: 'int',
    kind: 'green',
    text: 'LATENCY PROFILE BACK TO NORMAL · NO ACTION',
  },
  {
    type: 'trigger',
    title: 'Thread closed · branch advancing',
    body: 'Depth-4 answer connects the design decision to threat model and product policy. <strong>B2 marked complete</strong> — moving to Caching Strategy.',
    from: 4,
    to: 4,
    advance: true,
  },
  {
    type: 'examiner',
    tag: 'Q5 · BRANCH B3 · DEPTH 3',
    text: "Let's talk about your cache. You set a 24-hour TTL on the read-through layer. Defend that number.",
    evs: ['src/cache.ts#L20-L61'],
    typing: 1700,
  },
  { type: 'complete' },
];

/* ─── CSS injected once, scoped under .viva-root ─────────────────────── */
const VIVA_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap');

.viva-root {
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
  --accent-dim: rgba(142,42,27,0.08);
  --verified: #1E6B45;
  --verified-dim: rgba(30,107,69,0.1);
  --flagged: #B3261E;
  --hold: #8F6608;
  --ai: #4F4380;
  --ai-tint: rgba(79,67,128,0.07);
  --font-display: "Newsreader", Georgia, serif;
  --font-serif: "Newsreader", Georgia, serif;
  --font-ui: "Geist", system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;

  font-family: var(--font-ui);
  background: var(--bg);
  color: var(--text);
  height: 100vh;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.viva-root * { box-sizing: border-box; }
.viva-root a { color: inherit; text-decoration: none; }
.viva-root ::selection { background: rgba(142,42,27,0.18); }

/* scrollbar */
.viva-root ::-webkit-scrollbar { width: 10px; }
.viva-root ::-webkit-scrollbar-track { background: transparent; }
.viva-root ::-webkit-scrollbar-thumb { background: rgba(28,25,18,0.18); border-radius: 5px; border: 2px solid var(--bg); }
.viva-root ::-webkit-scrollbar-thumb:hover { background: rgba(28,25,18,0.3); }

/* ── nav ── */
.viva-root .vnav {
  position: sticky; top: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between; gap: 24px;
  height: 58px; padding: 0 28px;
  background: rgba(245,242,233,0.92);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}
.viva-root .vnav-left { display: flex; align-items: center; gap: 14px; }
.viva-root .vnav-right { display: flex; align-items: center; gap: 12px; }
.viva-root .wordmark {
  font-family: var(--font-ui); font-weight: 600; font-size: 14px;
  letter-spacing: 0.26em; color: var(--text);
  display: inline-flex; align-items: baseline; user-select: none;
}
.viva-root .wordmark .a-mark {
  color: var(--accent); font-family: var(--font-serif);
  font-style: italic; font-weight: 500; font-size: 1.18em; margin: 0 0.02em;
}
.viva-root .journey { display: flex; align-items: center; gap: 2px; }
.viva-root .journey-step {
  display: flex; align-items: center; gap: 8px;
  font-size: 12.5px; font-weight: 500; letter-spacing: 0.02em;
  color: var(--muted); padding: 7px 13px;
  border-bottom: 2px solid transparent; transition: color 0.15s ease;
}
.viva-root .journey-step .step-n {
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.06em; color: var(--muted); flex-shrink: 0;
}
.viva-root .journey-step:hover { color: var(--text); }
.viva-root .journey-step.is-active { color: var(--text); border-bottom-color: var(--accent); }
.viva-root .journey-step.is-active .step-n { color: var(--accent); }
.viva-root .journey-step.is-done { color: var(--soft); }
.viva-root .journey-step.is-done .step-n { color: var(--verified); }
.viva-root .journey-sep { width: 16px; height: 1px; background: var(--line-strong); flex-shrink: 0; }

/* integrity pill */
.viva-root .integrity-pill {
  display: inline-flex; align-items: center; gap: 9px;
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em;
  color: var(--verified); border: 1px solid rgba(30,107,69,0.35);
  border-radius: 2px; padding: 6px 12px; background: var(--surface);
}
.viva-root .integrity-pill .dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--verified);
  animation: viva-breathe 2.4s ease-in-out infinite;
}
@keyframes viva-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(30,107,69,0.35); }
  50% { box-shadow: 0 0 0 5px rgba(30,107,69,0); }
}

/* ── shell / layout ── */
.viva-root .viva-shell {
  display: grid;
  grid-template-columns: 1fr 320px;
  height: calc(100vh - 58px);
}
@media (max-width: 980px) {
  .viva-root .viva-shell { grid-template-columns: 1fr; }
  .viva-root .rail { display: none; }
}

/* ── conversation column ── */
.viva-root .convo-col {
  display: flex; flex-direction: column; min-width: 0; min-height: 0;
  border-right: 1px solid var(--line);
}
.viva-root .convo-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 13px 28px; border-bottom: 1px solid var(--line);
  background: var(--surface); flex-shrink: 0;
}
.viva-root .q-pos { font-family: var(--font-mono); font-size: 11px; color: var(--soft); letter-spacing: 0.06em; }
.viva-root .q-pos strong { color: var(--text); font-weight: 500; }
.viva-root .convo-controls { display: flex; gap: 8px; }

.viva-root .transcript {
  flex: 1; overflow-y: auto;
  padding: 30px 28px 44px; scroll-behavior: smooth;
}
.viva-root .transcript-inner {
  max-width: 720px; width: 100%; margin: 0 auto;
  display: flex; flex-direction: column; gap: 22px;
}

/* ── messages ── */
.viva-root .msg {
  display: flex; flex-direction: column; gap: 8px;
  opacity: 0; transform: translateY(10px);
  animation: viva-msg-in 0.45s cubic-bezier(0.22,1,0.36,1) forwards;
}
@keyframes viva-msg-in { to { opacity: 1; transform: none; } }
.viva-root .msg-who {
  display: flex; align-items: center; gap: 9px;
  font-family: var(--font-mono); font-size: 9.5px;
  letter-spacing: 0.16em; text-transform: uppercase;
}
.viva-root .msg.examiner .msg-who { color: var(--ai); }
.viva-root .msg.candidate .msg-who { color: var(--muted); }
.viva-root .msg-tag { font-family: var(--font-mono); font-size: 9px; color: var(--muted); letter-spacing: 0.1em; }
.viva-root .msg-body { font-size: 14.5px; line-height: 1.65; color: var(--text); }
.viva-root .msg.examiner .msg-body {
  border-left: 2px solid var(--ai);
  background: var(--ai-tint);
  border-radius: 0 3px 3px 0;
  padding: 16px 20px;
}
.viva-root .msg.examiner .msg-body .q-serif {
  font-family: var(--font-serif); font-size: 17px; line-height: 1.5;
}
.viva-root .msg.candidate .msg-body {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 3px; padding: 16px 20px; color: var(--soft);
}
.viva-root .q-evs { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }

/* evidence chip */
.viva-root .ev-chip {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--font-mono); font-size: 11px;
  color: var(--evidence); background: var(--surface-2);
  border: 1px solid var(--line); border-radius: 2px;
  padding: 3px 9px; letter-spacing: -0.01em; white-space: nowrap;
}
.viva-root .ev-chip::before {
  content: ""; width: 5px; height: 5px; border-radius: 50%;
  background: var(--accent); flex-shrink: 0; opacity: 0.75;
}

/* ai label */
.viva-root .ai-label {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--font-mono); font-size: 9.5px; font-weight: 500;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--ai);
}
.viva-root .ai-label::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%;
  border: 1.5px solid var(--ai); background: transparent;
}

/* ── adaptive trigger callout ── */
.viva-root .trigger {
  align-self: center; width: 100%; max-width: 540px;
  border: 1px solid var(--ai); background: var(--surface);
  border-radius: 3px; padding: 16px 20px;
  opacity: 0; transform: scale(0.97);
  animation: viva-trig-in 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
}
@keyframes viva-trig-in { to { opacity: 1; transform: none; } }
.viva-root .t-head { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.viva-root .t-body { font-size: 13px; color: var(--soft); line-height: 1.6; }
.viva-root .t-body strong { color: var(--ai); font-weight: 600; }
.viva-root .depth-shift {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em;
  color: var(--ai); margin-top: 10px;
}
.viva-root .depth-shift .pips { display: inline-flex; gap: 3px; }
.viva-root .pip { width: 11px; height: 3px; background: var(--surface-3); }
.viva-root .pip.on { background: var(--ai); }
.viva-root .pip.new { background: var(--ai); animation: viva-pip-pulse 1.2s ease-in-out 2; }
@keyframes viva-pip-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(79,67,128,0.4); }
  50% { box-shadow: 0 0 0 4px rgba(79,67,128,0); }
}

/* ── integrity inline note ── */
.viva-root .int-note {
  align-self: center;
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em;
  padding: 6px 14px; border-radius: 2px;
  opacity: 0; animation: viva-msg-in 0.4s ease forwards;
}
.viva-root .int-note.amber { color: var(--hold); border: 1px solid rgba(143,102,8,0.4); background: var(--surface); }
.viva-root .int-note.green { color: var(--verified); border: 1px solid rgba(30,107,69,0.35); background: var(--surface); }

/* ── typing indicator ── */
.viva-root .typing {
  display: inline-flex; gap: 5px; padding: 15px 20px;
  background: var(--ai-tint); border-left: 2px solid var(--ai);
  border-radius: 0 3px 3px 0; width: fit-content;
}
.viva-root .typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--ai); opacity: 0.4; animation: viva-ty 1.2s infinite; display: block; }
.viva-root .typing span:nth-child(2) { animation-delay: 0.18s; }
.viva-root .typing span:nth-child(3) { animation-delay: 0.36s; }
@keyframes viva-ty { 0%,60%,100% { opacity: 0.35; transform: none; } 30% { opacity: 1; transform: translateY(-3px); } }
.viva-root .typing.cand { background: var(--surface); border: 1px solid var(--line); border-radius: 3px; border-left-width: 1px; }
.viva-root .typing.cand span { background: var(--muted); }

/* ── session complete card ── */
.viva-root .complete-card {
  align-self: center; width: 100%; max-width: 540px; text-align: center;
  border: 1px solid var(--line-strong); background: var(--surface);
  border-radius: 3px; padding: 32px 28px 28px;
  opacity: 0; animation: viva-trig-in 0.5s ease forwards;
}
.viva-root .complete-card h3 {
  font-family: var(--font-display); font-size: 22px; font-weight: 500;
  margin: 14px 0 6px; letter-spacing: -0.01em;
}
.viva-root .complete-card p { font-size: 13.5px; color: var(--soft); margin-bottom: 20px; }

/* badge */
.viva-root .badge {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--font-mono); font-size: 10px; font-weight: 500;
  letter-spacing: 0.13em; text-transform: uppercase;
  padding: 4px 11px; border-radius: 2px;
  border: 1px solid currentColor; background: transparent;
}
.viva-root .badge::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.viva-root .badge-verified { color: var(--verified); }

/* buttons */
.viva-root .btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-ui); font-size: 13.5px; font-weight: 500;
  letter-spacing: 0.01em; padding: 11px 20px;
  border-radius: 2px; border: 1px solid transparent;
  cursor: pointer; transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
  white-space: nowrap;
}
.viva-root .btn:active { transform: translateY(1px); }
.viva-root .btn-primary { background: var(--text); color: var(--surface); }
.viva-root .btn-primary:hover { background: var(--accent-deep); }
.viva-root .btn-ghost { background: transparent; color: var(--text); border-color: var(--line-strong); }
.viva-root .btn-ghost:hover { border-color: var(--text); }

/* ── answer dock ── */
.viva-root .dock { border-top: 1px solid var(--line); background: var(--surface); padding: 14px 28px; flex-shrink: 0; }
.viva-root .dock-in { max-width: 720px; margin: 0 auto; display: flex; align-items: center; gap: 14px; }
.viva-root .mic {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  background: var(--text); border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; position: relative;
}
.viva-root .mic::after {
  content: ""; position: absolute; inset: -4px; border-radius: 50%;
  border: 1px solid rgba(28,25,18,0.3);
  animation: viva-breathe 2.4s ease-in-out infinite;
}
.viva-root .mic svg { width: 16px; height: 16px; fill: var(--bg); }
.viva-root .field {
  flex: 1; background: var(--bg); border: 1px solid var(--line); border-radius: 2px;
  padding: 11px 16px; font-size: 13px; color: var(--muted);
  font-family: var(--font-serif); font-style: italic;
}
.viva-root .hint {
  font-family: var(--font-mono); font-size: 9px; color: var(--muted);
  letter-spacing: 0.12em; text-transform: uppercase; flex-shrink: 0;
}

/* ── right rail ── */
.viva-root .rail { overflow-y: auto; background: var(--surface-2); padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.viva-root .rail-sec { background: var(--surface); border: 1px solid var(--line); border-radius: 3px; padding: 16px 18px; }
.viva-root .rail-sec h4 {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--muted); font-weight: 500; margin-bottom: 12px;
  padding-bottom: 10px; border-bottom: 1px solid var(--line);
}
.viva-root .int-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; font-size: 12.5px; color: var(--soft); }
.viva-root .int-row + .int-row { border-top: 1px solid var(--line); }
.viva-root .int-stat { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; }
.viva-root .int-stat::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.viva-root .int-stat.ok { color: var(--verified); }
.viva-root .int-stat.warn { color: var(--hold); }
.viva-root .rail-note { font-size: 11.5px; color: var(--muted); line-height: 1.6; margin-top: 12px; font-family: var(--font-serif); font-style: italic; }
.viva-root .sess-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12.5px; }
.viva-root .sess-row .k { color: var(--muted); }
.viva-root .sess-row .v { color: var(--soft); font-family: var(--font-mono); font-size: 11px; }
.viva-root .mini-branch { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 12.5px; color: var(--muted); }
.viva-root .mini-branch .b-id { font-family: var(--font-mono); font-size: 9px; width: 26px; flex-shrink: 0; color: var(--muted); }
.viva-root .mini-branch.done { color: var(--soft); }
.viva-root .mini-branch.done .b-id { color: var(--verified); }
.viva-root .mini-branch.now { color: var(--text); font-weight: 500; }
.viva-root .mini-branch.now .b-id { color: var(--accent); }
`;

/* ─── item renderers ─────────────────────────────────────────────────── */
function ExaminerMsg({ event }) {
  const evChips = (event.evs || []).map((x, i) => (
    <span key={i} className="ev-chip">{x}</span>
  ));
  return (
    <div className="msg examiner">
      <div className="msg-who">
        VERITAS Examiner <span className="msg-tag">{event.tag}</span>
      </div>
      <div className="msg-body">
        <span className="ai-label" style={{ marginBottom: 10, display: 'inline-flex' }}>
          AI-generated question
        </span>
        <div className="q-serif">{event.text}</div>
        {evChips.length > 0 && <div className="q-evs">{evChips}</div>}
      </div>
    </div>
  );
}

function CandidateMsg({ event }) {
  return (
    <div className="msg candidate">
      <div className="msg-who">
        Rahul Mehta <span className="msg-tag">{event.tag}</span>
      </div>
      <div className="msg-body">{event.text}</div>
    </div>
  );
}

function TriggerCard({ event }) {
  const pips = [1, 2, 3, 4].map((n) => {
    if (n <= event.from) return <i key={n} className="pip on" />;
    if (n <= event.to) return <i key={n} className="pip new" />;
    return <i key={n} className="pip" />;
  });
  return (
    <div className="trigger">
      <div className="t-head">
        <span className="ai-label">{event.title}</span>
      </div>
      <div className="t-body" dangerouslySetInnerHTML={{ __html: event.body }} />
      <span className="depth-shift">
        PROBE DEPTH{' '}
        <span className="pips">{pips}</span>
        {event.from}
        {event.to > event.from ? ` → ${event.to}` : ''}
      </span>
    </div>
  );
}

function IntNote({ event }) {
  return <div className={`int-note ${event.kind}`}>{event.text}</div>;
}

function CompleteCard({ onViewReport }) {
  return (
    <div className="complete-card">
      <span className="badge badge-verified">Session segment complete</span>
      <h3>This is where the demo jumps ahead</h3>
      <p>The full viva runs 14 questions across 5 branches. Rahul's report is ready.</p>
      <button className="btn btn-primary" onClick={onViewReport}>
        View Rahul's Examination Report →
      </button>
    </div>
  );
}

function TypingIndicator({ kind }) {
  return (
    <div className={`typing${kind === 'candidate' ? ' cand' : ''}`}>
      <span /><span /><span />
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────────────── */
export default function VivaExamination({ onViewReport, onBack }) {
  const [items, setItems] = useState([]);
  const [typingKind, setTypingKind] = useState(null);
  const [elapsed, setElapsed] = useState(18 * 60 + 42);
  const [latency, setLatency] = useState({ kind: 'ok', text: 'Normal' });
  const [progress, setProgress] = useState({
    qNow: 4,
    branchNow: 'B2 — API Design & Security',
    b2: 'now',
    b3: '',
  });

  const timerRef = useRef(null);
  const idxRef = useRef(0);
  const transcriptRef = useRef(null);

  const scrollFeed = useCallback(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, []);

  /* apply side effects that come with certain events */
  const applyEffects = useCallback((e) => {
    if (e.type === 'int') {
      if (e.kind === 'amber') setLatency({ kind: 'warn', text: '9s pause' });
      else setLatency({ kind: 'ok', text: 'Normal' });
    }
    if (e.type === 'trigger' && e.advance) {
      setProgress({ qNow: 5, branchNow: 'B3 — Caching Strategy', b2: 'done', b3: 'now' });
    }
  }, []);

  const step = useCallback(() => {
    const idx = idxRef.current;
    if (idx >= EVENTS.length) return;
    const e = EVENTS[idx];

    const advance = () => {
      setTypingKind(null);
      applyEffects(e);
      setItems((prev) => [...prev, { ...e, _id: idx }]);
      idxRef.current = idx + 1;
      const gap = e.type === 'trigger' ? 1400 : e.type === 'int' ? 1000 : 1300;
      timerRef.current = setTimeout(step, gap);
    };

    if (e.typing) {
      setTypingKind(e.type);
      timerRef.current = setTimeout(() => advance(), e.typing);
    } else {
      advance();
    }
  }, [applyEffects]);

  /* start playback on mount */
  useEffect(() => {
    timerRef.current = setTimeout(step, 700);
    return () => clearTimeout(timerRef.current);
  }, [step]);

  /* auto-scroll whenever transcript changes */
  useEffect(() => { scrollFeed(); }, [items, typingKind, scrollFeed]);

  /* elapsed clock */
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleReplay = () => {
    clearTimeout(timerRef.current);
    idxRef.current = 0;
    setItems([]);
    setTypingKind(null);
    setProgress({ qNow: 4, branchNow: 'B2 — API Design & Security', b2: 'now', b3: '' });
    setLatency({ kind: 'ok', text: 'Normal' });
    timerRef.current = setTimeout(step, 700);
  };

  const handleSkip = () => {
    clearTimeout(timerRef.current);
    idxRef.current = EVENTS.length;
    setTypingKind(null);
    // Apply all side effects in order
    const allLatency = { kind: 'ok', text: 'Normal' };
    const allProgress = { qNow: 4, branchNow: 'B2 — API Design & Security', b2: 'now', b3: '' };
    EVENTS.forEach((e) => {
      if (e.type === 'int') {
        if (e.kind === 'amber') { allLatency.kind = 'warn'; allLatency.text = '9s pause'; }
        else { allLatency.kind = 'ok'; allLatency.text = 'Normal'; }
      }
      if (e.type === 'trigger' && e.advance) {
        allProgress.qNow = 5;
        allProgress.branchNow = 'B3 — Caching Strategy';
        allProgress.b2 = 'done';
        allProgress.b3 = 'now';
      }
    });
    setLatency(allLatency);
    setProgress(allProgress);
    setItems(EVENTS.map((e, i) => ({ ...e, _id: i })));
  };

  const renderItem = (item) => {
    switch (item.type) {
      case 'examiner': return <ExaminerMsg key={item._id} event={item} />;
      case 'candidate': return <CandidateMsg key={item._id} event={item} />;
      case 'trigger': return <TriggerCard key={item._id} event={item} />;
      case 'int': return <IntNote key={item._id} event={item} />;
      case 'complete': return <CompleteCard key={item._id} onViewReport={onViewReport} />;
      default: return null;
    }
  };

  return (
    <>
      <style>{VIVA_CSS}</style>
      <div className="viva-root">

        {/* ── top nav ── */}
        <nav className="vnav">
          <div className="vnav-left">
            <button
              onClick={onBack}
              className="wordmark"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              VERIT<span className="a-mark">A</span>S
            </button>
          </div>

          <div className="journey">
            <span className="journey-step is-done">
              <span className="step-n">✓</span>Blueprint
            </span>
            <span className="journey-sep" />
            <span className="journey-step is-active">
              <span className="step-n">02</span>Viva
            </span>
            <span className="journey-sep" />
            <span className="journey-step">
              <span className="step-n">03</span>Report
            </span>
            <span className="journey-sep" />
            <span className="journey-step">
              <span className="step-n">04</span>Review Console
            </span>
          </div>

          <div className="vnav-right">
            <span className="integrity-pill">
              <span className="dot" />
              SESSION INTEGRITY · NOMINAL
            </span>
          </div>
        </nav>

        {/* ── viva shell ── */}
        <div className="viva-shell">

          {/* ── conversation column ── */}
          <div className="convo-col">
            <div className="convo-head">
              <span className="q-pos">
                Question <strong>{progress.qNow}</strong> of 14 · Branch{' '}
                <strong>{progress.branchNow}</strong>
              </span>
              <div className="convo-controls">
                <button className="btn btn-ghost" onClick={handleReplay} style={{ padding: '6px 13px', fontSize: 12 }}>
                  Replay
                </button>
                <button className="btn btn-ghost" onClick={handleSkip} style={{ padding: '6px 13px', fontSize: 12 }}>
                  Skip to end
                </button>
              </div>
            </div>

            <div className="transcript" ref={transcriptRef}>
              <div className="transcript-inner">
                {items.map(renderItem)}
                {typingKind && <TypingIndicator kind={typingKind} />}
              </div>
            </div>

            <div className="dock">
              <div className="dock-in">
                <button className="mic" aria-label="Microphone active">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
                  </svg>
                </button>
                <div className="field">Speaking… answers are transcribed live</div>
                <span className="hint">Voice · single speaker</span>
              </div>
            </div>
          </div>

          {/* ── right rail ── */}
          <aside className="rail">
            <div className="rail-sec">
              <h4>Session Integrity</h4>
              <div className="int-row">
                Identity
                <span className="int-stat ok">Verified</span>
              </div>
              <div className="int-row">
                Audio
                <span className="int-stat ok">Single speaker</span>
              </div>
              <div className="int-row">
                Environment
                <span className="int-stat ok">Clear</span>
              </div>
              <div className="int-row">
                Input events
                <span className="int-stat ok">No paste</span>
              </div>
              <div className="int-row">
                Response latency
                <span className={`int-stat ${latency.kind}`}>{latency.text}</span>
              </div>
              <p className="rail-note">
                Integrity signals are advisory. Final judgement cites evidence and answers — not surveillance.
              </p>
            </div>

            <div className="rail-sec">
              <h4>Session</h4>
              <div className="sess-row"><span className="k">Candidate</span><span className="v">Rahul Mehta</span></div>
              <div className="sess-row"><span className="k">Exam code</span><span className="v">NTU-CS-4012</span></div>
              <div className="sess-row"><span className="k">Elapsed</span><span className="v">{fmtTime(elapsed)}</span></div>
              <div className="sess-row"><span className="k">Mode</span><span className="v">Oral · adaptive</span></div>
            </div>

            <div className="rail-sec">
              <h4>Blueprint Progress</h4>
              <div className="mini-branch done">
                <span className="b-id">B1</span>System Design
              </div>
              <div className={`mini-branch ${progress.b2}`}>
                <span className="b-id">B2</span>API Design &amp; Security
              </div>
              <div className={`mini-branch ${progress.b3}`}>
                <span className="b-id">B3</span>Caching Strategy
              </div>
              <div className="mini-branch">
                <span className="b-id">B4</span>Data Modelling
              </div>
              <div className="mini-branch">
                <span className="b-id">B5</span>Operations &amp; Testing
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
