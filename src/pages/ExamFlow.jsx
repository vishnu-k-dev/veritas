import { useState, useRef, useEffect, useCallback } from 'react'
import { parseGitHubUrl, analyzeRepository } from '../services/githubService'
import { buildRepoContext } from '../engine/repoAnalysis'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const STEPS = { INTAKE: 'intake', ANALYZING: 'analyzing', BLUEPRINT: 'blueprint', VIVA: 'viva', CERTIFICATE: 'certificate' }

/* ─── CSS ─────────────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap');

.ef {
  --bg: #F5F2E9; --surface: #FDFCF8; --surface-2: #EFEBDF; --surface-3: #E7E2D2;
  --line: rgba(28,25,18,0.13); --line-strong: rgba(28,25,18,0.26);
  --text: #1C1912; --soft: #524C3F; --muted: #8B8472; --evidence: #5E5747;
  --accent: #8E2A1B; --accent-deep: #6E2014; --verified: #1E6B45; --ai: #4F4380;
  --fd: "Newsreader", Georgia, serif; --fu: "Geist", system-ui, sans-serif; --fm: "Geist Mono", ui-monospace, monospace;
  min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--fu); font-size: 15px; line-height: 1.55;
}
.ef * { box-sizing: border-box; margin: 0; padding: 0; }
.ef a { color: inherit; text-decoration: none; }

/* nav */
.ef-nav {
  position: sticky; top: 0; z-index: 50; height: 58px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 max(24px, calc(50vw - 580px));
  background: rgba(245,242,233,0.93); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line);
}
.ef-wordmark { font-family: var(--fu); font-weight: 600; font-size: 13px; letter-spacing: 0.26em; color: var(--text); background: none; border: none; cursor: pointer; user-select: none; display: inline-flex; align-items: baseline; }
.ef-wordmark .a { color: var(--accent); font-family: var(--fd); font-style: italic; font-weight: 500; font-size: 1.18em; margin: 0 0.02em; }
.ef-step-trail { display: flex; align-items: center; gap: 6px; font-family: var(--fm); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
.ef-step-trail .active { color: var(--text); }
.ef-step-trail .sep { opacity: 0.35; }

/* ── PROCTORING BANNER ── */
.ef-proctor-bar {
  background: var(--surface-2); border-bottom: 1px solid var(--line);
  padding: 7px max(24px, calc(50vw - 580px));
  display: flex; align-items: center; justify-content: space-between;
  font-family: var(--fm); font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted);
}
.ef-proctor-bar .pb-left { display: flex; align-items: center; gap: 16px; }
.ef-proctor-bar .pb-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--verified); display: inline-block; margin-right: 6px; animation: ef-pulse 2s ease-in-out infinite; }
.ef-proctor-bar .pb-dot.warn { background: #B45309; animation: none; }
.ef-proctor-bar .pb-flag { color: var(--accent); }
@keyframes ef-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

/* ── TAB SWITCH OVERLAY ── */
.ef-tab-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(245,242,233,0.97); backdrop-filter: blur(8px);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
  animation: ef-fade-in 0.2s ease;
}
@keyframes ef-fade-in { from{opacity:0} to{opacity:1} }
.ef-tab-overlay h2 { font-family: var(--fd); font-size: 28px; font-weight: 500; color: var(--accent); letter-spacing: -0.02em; }
.ef-tab-overlay p { font-size: 14px; color: var(--soft); max-width: 380px; text-align: center; line-height: 1.6; }
.ef-tab-overlay .strike-count { font-family: var(--fm); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-top: 4px; }

/* wrap */
.ef-wrap { max-width: 720px; margin: 0 auto; padding: 0 24px; }

/* ── INTAKE ── */
.ef-intake { padding: 72px 0 80px; }
.ef-intake h1 { font-family: var(--fd); font-size: clamp(32px, 5vw, 56px); font-weight: 500; letter-spacing: -0.022em; line-height: 1.04; margin-bottom: 14px; }
.ef-intake h1 em { font-style: italic; color: var(--accent); font-weight: 400; }
.ef-intake .sub { font-size: 16px; color: var(--soft); line-height: 1.65; margin-bottom: 48px; max-width: 520px; }
.ef-form { display: flex; flex-direction: column; gap: 22px; }
.ef-label { font-family: var(--fm); font-size: 9.5px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); display: block; margin-bottom: 8px; }
.ef-input { width: 100%; padding: 12px 16px; background: var(--surface); border: 1px solid var(--line-strong); border-radius: 2px; color: var(--text); font-family: var(--fu); font-size: 14.5px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
.ef-input::placeholder { color: var(--muted); }
.ef-input:focus { border-color: var(--text); box-shadow: 0 0 0 3px rgba(28,25,18,0.06); }
.ef-input.error { border-color: var(--accent); }
.ef-resume-zone { border: 1px dashed var(--line-strong); border-radius: 2px; background: var(--surface); padding: 28px 20px; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; position: relative; }
.ef-resume-zone:hover, .ef-resume-zone.drag { border-color: var(--text); background: var(--surface-2); }
.ef-resume-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.ef-resume-zone .rz-label { font-family: var(--fm); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.ef-resume-zone .rz-hint { font-size: 12.5px; color: var(--muted); margin-top: 6px; }
.ef-resume-zone .rz-file { font-size: 13px; color: var(--verified); font-weight: 500; }
.ef-err { font-family: var(--fm); font-size: 10.5px; letter-spacing: 0.06em; color: var(--accent); margin-top: 6px; }

.ef-btn { display: inline-flex; align-items: center; gap: 8px; font-family: var(--fu); font-size: 13.5px; font-weight: 500; padding: 12px 24px; border-radius: 2px; border: 1px solid transparent; cursor: pointer; transition: background 0.16s, border-color 0.16s, color 0.16s; white-space: nowrap; align-self: flex-start; }
.ef-btn:active { transform: translateY(1px); }
.ef-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
.ef-btn-primary { background: var(--text); color: var(--surface); border-color: var(--text); }
.ef-btn-primary:hover:not(:disabled) { background: var(--accent-deep); border-color: var(--accent-deep); }
.ef-btn-ghost { background: transparent; color: var(--text); border-color: var(--line-strong); }
.ef-btn-ghost:hover:not(:disabled) { border-color: var(--text); }

/* ── ANALYZING ── */
.ef-analyzing { padding: 80px 0; text-align: center; }
.ef-analyzing h2 { font-family: var(--fd); font-size: 28px; font-weight: 500; letter-spacing: -0.018em; margin-bottom: 10px; }
.ef-analyzing .sub { color: var(--soft); font-size: 15px; margin-bottom: 48px; }
.ef-progress-list { display: flex; flex-direction: column; gap: 12px; max-width: 400px; margin: 0 auto; text-align: left; }
.ef-progress-item { display: flex; align-items: center; gap: 12px; font-size: 13.5px; color: var(--soft); }
.ef-progress-item.done  { color: var(--verified); }
.ef-progress-item.active { color: var(--text); }
.ef-progress-item .pi-icon { width: 18px; flex-shrink: 0; font-family: var(--fm); font-size: 11px; }
.ef-spinner { width: 14px; height: 14px; border: 2px solid var(--surface-3); border-top-color: var(--text); border-radius: 50%; animation: ef-spin 0.7s linear infinite; display: inline-block; }
@keyframes ef-spin { to { transform: rotate(360deg); } }
.ef-analyze-err { margin-top: 40px; padding: 18px 22px; background: rgba(142,42,27,0.07); border: 1px solid rgba(142,42,27,0.2); border-radius: 2px; font-size: 14px; color: var(--accent); }

/* ── BLUEPRINT ── */
.ef-blueprint { padding: 64px 0 80px; }
.ef-blueprint h2 { font-family: var(--fd); font-size: clamp(26px, 4vw, 40px); font-weight: 500; letter-spacing: -0.018em; margin-bottom: 6px; }
.ef-blueprint .sub { color: var(--soft); font-size: 15.5px; margin-bottom: 40px; }
.ef-blueprint-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 36px; }
.ef-bp-card { background: var(--surface); border: 1px solid var(--line-strong); border-radius: 2px; padding: 18px 20px; }
.ef-bp-card .bpc-label { font-family: var(--fm); font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
.ef-bp-card .bpc-val { font-size: 14px; color: var(--text); line-height: 1.5; }
.ef-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.ef-chip { font-family: var(--fm); font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 9px; border-radius: 2px; border: 1px solid var(--line-strong); color: var(--soft); background: var(--surface-2); }
.ef-questions-preview { margin-bottom: 36px; }
.ef-questions-preview h3 { font-family: var(--fd); font-size: 18px; font-weight: 500; margin-bottom: 16px; color: var(--soft); }
.ef-q-preview-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
.ef-q-preview-row:last-child { border-bottom: 1px solid var(--line); }
.ef-q-num { font-family: var(--fm); font-size: 10px; letter-spacing: 0.12em; color: var(--muted); padding-top: 2px; flex-shrink: 0; width: 24px; }
.ef-q-area { font-family: var(--fm); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; padding: 2px 7px; border-radius: 1px; flex-shrink: 0; margin-top: 1px; }
.ef-q-area.architecture { background: rgba(79,67,128,0.1); color: var(--ai); }
.ef-q-area.decisions    { background: rgba(142,42,27,0.09); color: var(--accent); }
.ef-q-area.debugging    { background: rgba(28,25,18,0.07); color: var(--evidence); }
.ef-q-area.tradeoffs    { background: rgba(30,107,69,0.08); color: var(--verified); }
.ef-q-area.depth        { background: rgba(28,25,18,0.07); color: var(--soft); }
.ef-q-text { font-size: 13.5px; color: var(--soft); line-height: 1.5; }
.ef-bp-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.ef-bp-meta { font-family: var(--fm); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }

/* ── VIVA ── */
.ef-viva { padding: 48px 0 80px; }
.ef-viva-progress { margin-bottom: 32px; }
.ef-vp-bar { height: 3px; background: var(--surface-3); border-radius: 2px; overflow: hidden; margin-bottom: 10px; }
.ef-vp-fill { height: 100%; background: var(--text); border-radius: 2px; transition: width 0.5s ease; }
.ef-vp-label { font-family: var(--fm); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
.ef-q-card { background: var(--surface); border: 1px solid var(--line-strong); border-radius: 2px; padding: 28px 32px; margin-bottom: 24px; position: relative; user-select: none; }
.ef-q-card::before { content: ''; position: absolute; inset: 7px; border: 1px solid var(--line); border-radius: 1px; pointer-events: none; }
.ef-q-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.ef-q-tag { font-family: var(--fm); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.ef-q-body { font-family: var(--fd); font-size: 20px; font-weight: 400; line-height: 1.45; color: var(--text); }
.ef-q-evidence { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); font-family: var(--fm); font-size: 10.5px; color: var(--evidence); letter-spacing: 0.04em; }
.ef-answer-area { width: 100%; min-height: 140px; padding: 14px 16px; background: var(--surface); border: 1px solid var(--line-strong); border-radius: 2px; color: var(--text); font-family: var(--fu); font-size: 14.5px; line-height: 1.6; resize: vertical; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
.ef-answer-area::placeholder { color: var(--muted); }
.ef-answer-area:focus { border-color: var(--text); box-shadow: 0 0 0 3px rgba(28,25,18,0.06); }
.ef-answer-area:disabled { opacity: 0.55; }
.ef-answer-hint { font-family: var(--fm); font-size: 10px; letter-spacing: 0.1em; color: var(--muted); margin-top: 8px; }
.ef-paste-warn { background: rgba(142,42,27,0.07); border: 1px solid rgba(142,42,27,0.2); border-radius: 2px; padding: 10px 14px; margin-top: 10px; font-family: var(--fm); font-size: 10px; letter-spacing: 0.08em; color: var(--accent); animation: ef-slide-up 0.2s ease; }

/* answer recorded confirmation */
.ef-recorded { display: flex; align-items: center; gap: 12px; padding: 18px 20px; background: rgba(30,107,69,0.06); border: 1px solid rgba(30,107,69,0.2); border-radius: 2px; margin: 16px 0; animation: ef-slide-up 0.3s ease; }
.ef-recorded .rec-icon { font-size: 18px; }
.ef-recorded .rec-text { font-size: 13.5px; color: var(--verified); font-weight: 500; }
.ef-recorded .rec-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
@keyframes ef-slide-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
.ef-viva-actions { display: flex; align-items: center; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
.ef-evaluating { display: flex; align-items: center; gap: 10px; padding: 16px 0; font-size: 13px; color: var(--soft); }

/* ── GRADE CARD ── */
.ef-cert-wrap { padding: 64px 0 80px; }
.ef-cert-header { margin-bottom: 40px; }
.ef-cert-header h2 { font-family: var(--fd); font-size: clamp(26px,4vw,40px); font-weight: 500; letter-spacing: -0.018em; }
.ef-cert-header .sub { color: var(--soft); font-size: 15px; margin-top: 8px; }

.ef-cert-card { background: var(--surface); border: 1px solid var(--line-strong); border-radius: 3px; padding: 36px 40px; position: relative; box-shadow: 0 1px 0 rgba(28,25,18,0.04), 0 24px 48px -28px rgba(28,25,18,0.28); margin-bottom: 32px; }
.ef-cert-card::before { content: ''; position: absolute; inset: 9px; border: 1px solid var(--line); border-radius: 1px; pointer-events: none; }
.ef-cert-type { font-family: var(--fm); font-size: 9.5px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--muted); text-align: center; margin-bottom: 20px; }
.ef-cert-name { font-family: var(--fd); font-size: 36px; font-weight: 500; text-align: center; letter-spacing: -0.01em; line-height: 1.1; }
.ef-cert-project { font-size: 13px; color: var(--soft); text-align: center; margin-top: 4px; font-family: var(--fd); font-style: italic; }
.ef-cert-scores { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin: 24px 0 22px; }
.ef-cert-score { text-align: center; padding: 16px 8px 14px; }
.ef-cert-score + .ef-cert-score { border-left: 1px solid var(--line); }
.ef-cert-score .sc-val { font-family: var(--fd); font-size: 42px; font-weight: 500; line-height: 1; }
.ef-cert-score .sc-label { font-family: var(--fm); font-size: 8.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-top: 8px; }
.ef-cert-score .sc-tier { font-size: 11px; margin-top: 4px; font-family: var(--fd); font-style: italic; }
.sc-distinguished { color: var(--verified); } .sc-proficient { color: var(--text); } .sc-developing { color: var(--soft); } .sc-emerging { color: var(--muted); }
.ef-cert-foot { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
.ef-cert-vid .v-label { font-family: var(--fm); font-size: 8.5px; letter-spacing: 0.18em; color: var(--muted); text-transform: uppercase; display: block; margin-bottom: 4px; }
.ef-cert-vid .v-val { font-family: var(--fm); font-size: 12.5px; color: var(--evidence); letter-spacing: 0.02em; }
.ef-cert-verdict { font-family: var(--fm); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; padding: 5px 12px; border-radius: 2px; border: 1px solid; }
.ef-cert-verdict.VERIFIED    { color: var(--verified); border-color: rgba(30,107,69,0.3); background: rgba(30,107,69,0.07); }
.ef-cert-verdict.CONDITIONAL { color: var(--soft);    border-color: var(--line-strong);  background: var(--surface-2); }
.ef-cert-verdict.NEEDS-REVIEW { color: var(--accent); border-color: rgba(142,42,27,0.3); background: rgba(142,42,27,0.06); }
.ef-cert-verdict-bar { border-radius: 3px 3px 0 0; }
.ef-cert-verdict-bar.VERIFIED    { border-top: 3px solid var(--verified); }
.ef-cert-verdict-bar.CONDITIONAL { border-top: 3px solid var(--muted); }
.ef-cert-verdict-bar.NEEDS-REVIEW { border-top: 3px solid var(--accent); }
.ef-cert-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 40px; }

/* per-question score grid */
.ef-qgrid { margin-bottom: 40px; }
.ef-qgrid h3 { font-family: var(--fd); font-size: 20px; font-weight: 500; margin-bottom: 20px; }
.ef-qgrid-row { display: grid; grid-template-columns: 28px 1fr auto; gap: 12px 16px; align-items: start; padding: 16px 0; border-top: 1px solid var(--line); }
.ef-qgrid-row:last-child { border-bottom: 1px solid var(--line); }
.ef-qgrid-num { font-family: var(--fm); font-size: 10px; color: var(--muted); padding-top: 3px; }
.ef-qgrid-q { font-size: 13.5px; color: var(--soft); line-height: 1.5; }
.ef-qgrid-a { font-size: 12px; color: var(--muted); margin-top: 5px; line-height: 1.5; font-style: italic; }
.ef-qgrid-score { text-align: right; flex-shrink: 0; }
.ef-qgrid-score .gs-val { font-family: var(--fd); font-size: 28px; font-weight: 500; line-height: 1; }
.ef-qgrid-score .gs-val.pass { color: var(--verified); }
.ef-qgrid-score .gs-val.hold { color: var(--soft); }
.ef-qgrid-score .gs-val.fail { color: var(--accent); }
.ef-qgrid-score .gs-verd { font-family: var(--fm); font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-top: 4px; }
.ef-qgrid-bars { display: flex; gap: 3px; margin-top: 6px; justify-content: flex-end; }
.ef-qgrid-bar { height: 3px; width: 22px; border-radius: 2px; background: var(--surface-3); overflow: hidden; }
.ef-qgrid-bar-fill { height: 100%; border-radius: 2px; }

/* integrity panel */
.ef-integrity { background: var(--surface-2); border: 1px solid var(--line-strong); border-radius: 2px; padding: 22px 26px; margin-bottom: 32px; }
.ef-integrity h4 { font-family: var(--fm); font-size: 9.5px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); margin-bottom: 16px; }
.ef-integrity-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.ef-ig-item { text-align: center; }
.ef-ig-val { font-family: var(--fd); font-size: 26px; font-weight: 500; }
.ef-ig-val.clean { color: var(--verified); }
.ef-ig-val.warn  { color: #B45309; }
.ef-ig-val.flag  { color: var(--accent); }
.ef-ig-label { font-family: var(--fm); font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-top: 4px; }
.ef-integrity-note { font-size: 12px; color: var(--soft); margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); line-height: 1.6; }

@media (max-width: 640px) {
  /* grids that collapse */
  .ef-blueprint-grid { grid-template-columns: 1fr; }
  .ef-cert-scores { grid-template-columns: 1fr; }
  .ef-cert-score + .ef-cert-score { border-left: none; border-top: 1px solid var(--line); }
  .ef-integrity-grid { grid-template-columns: repeat(2,1fr); }
  .ef-qgrid-row { grid-template-columns: 24px 1fr; }
  .ef-qgrid-score { grid-column: 2; }

  /* nav — hide step trail, it overflows on small screens */
  .ef-step-trail { display: none; }

  /* proctoring bar — stack flags vertically */
  .ef-proctor-bar { flex-direction: column; align-items: flex-start; gap: 4px; padding-top: 9px; padding-bottom: 9px; }
  .ef-proctor-bar .pb-left { flex-wrap: wrap; gap: 10px; }

  /* card padding */
  .ef-q-card { padding: 20px 18px; }
  .ef-cert-card { padding: 26px 20px; }

  /* intake */
  .ef-intake { padding: 48px 0 56px; }
  .ef-intake .ef-btn { align-self: stretch; justify-content: center; width: 100%; }

  /* blueprint footer — stack on mobile */
  .ef-bp-footer { flex-direction: column; align-items: stretch; }
  .ef-bp-footer > div:last-child { display: flex; flex-direction: column; gap: 10px; }
  .ef-bp-footer .ef-btn { justify-content: center; }

  /* question preview — let area tag wrap below number */
  .ef-q-preview-row { flex-wrap: wrap; gap: 4px 10px; }
  .ef-q-text { flex-basis: 100%; padding-left: 32px; }

  /* viva actions — full-width button */
  .ef-viva-actions { flex-direction: column; }
  .ef-viva-actions .ef-btn { width: 100%; justify-content: center; }

  /* certificate actions — full-width stacked */
  .ef-cert-actions { flex-direction: column; }
  .ef-cert-actions .ef-btn { width: 100%; justify-content: center; }

  /* cert name — smaller on very small phones */
  .ef-cert-name { font-size: 28px; }
}
`

function Spinner() { return <span className="ef-spinner" /> }

export default function ExamFlow() {
  const [step, setStep]               = useState(STEPS.INTAKE)
  const [name, setName]               = useState('')
  const [repoUrl, setRepoUrl]         = useState('')
  const [resumeFile, setResumeFile]   = useState(null)
  const [resumeText, setResumeText]   = useState('')
  const [drag, setDrag]               = useState(false)
  const [inputErr, setInputErr]       = useState({})
  const [progressMsg, setProgressMsg] = useState('')
  const [progressDone, setProgressDone] = useState([])
  const [analyzeErr, setAnalyzeErr]   = useState('')
  const [repoCtx, setRepoCtx]         = useState(null)
  const [sessionId, setSessionId]     = useState(null)
  const [questions, setQuestions]     = useState([])
  const [qIndex, setQIndex]           = useState(0)
  const [answer, setAnswer]           = useState('')
  const [evaluating, setEvaluating]   = useState(false)
  const [recorded, setRecorded]       = useState(false)
  const [qaPairs, setQaPairs]         = useState([])
  const [report, setReport]           = useState(null)
  const [showPasteWarn, setShowPasteWarn] = useState(false)

  // ── Proctoring state ──────────────────────────────────────────────────────
  const [integrity, setIntegrity] = useState({
    tabSwitches: 0, pasteAttempts: 0, copyAttempts: 0, suspiciousCount: 0
  })
  const [showTabWarning, setShowTabWarning] = useState(false)
  const answerStartRef  = useRef(null)  // when first keystroke happened
  const answerLengthRef = useRef(0)     // length before each keypress (detect large paste)

  const topRef = useRef(null)
  const answerRef = useRef(null)

  const PROGRESS_STEPS = [
    'Fetching repository metadata…',
    'Loading commit history…',
    'Reading project structure…',
    'Building examination context…',
    'Generating examination questions…',
  ]

  function scrollTop() { topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  // ── Proctoring: tab switch ────────────────────────────────────────────────
  useEffect(() => {
    if (step !== STEPS.VIVA) return
    const onVisibility = () => {
      if (document.hidden) {
        setIntegrity(p => ({ ...p, tabSwitches: p.tabSwitches + 1 }))
        setShowTabWarning(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [step])

  // ── Proctoring: copy from question card ──────────────────────────────────
  useEffect(() => {
    if (step !== STEPS.VIVA) return
    const onCopy = () => setIntegrity(p => ({ ...p, copyAttempts: p.copyAttempts + 1 }))
    document.addEventListener('copy', onCopy)
    return () => document.removeEventListener('copy', onCopy)
  }, [step])

  // ── Proctoring: detect paste into answer ─────────────────────────────────
  function handleAnswerPaste(e) {
    e.preventDefault()
    setIntegrity(p => ({ ...p, pasteAttempts: p.pasteAttempts + 1 }))
    setShowPasteWarn(true)
    setTimeout(() => setShowPasteWarn(false), 4000)
  }

  // ── Proctoring: typing velocity (detect AI-generated paste via keyboard) ─
  function handleAnswerKeydown(e) {
    if (!answerStartRef.current && e.key.length === 1) {
      answerStartRef.current = Date.now()
    }
    answerLengthRef.current = answer.length
  }

  function handleAnswerChange(e) {
    const newVal = e.target.value
    const delta = newVal.length - answerLengthRef.current
    // If > 80 chars appeared in one event and no paste was blocked → keyboard paste or autocomplete
    if (delta > 80 && answerStartRef.current) {
      setIntegrity(p => ({ ...p, suspiciousCount: p.suspiciousCount + 1 }))
    }
    setAnswer(newVal)
  }

  // ── typing speed check on submit — returns { suspicious, wpm } ───────────
  function checkTypingSpeed(text) {
    if (!answerStartRef.current) return { suspicious: false, wpm: 0 }
    const elapsed = Math.max((Date.now() - answerStartRef.current) / 1000 / 60, 0.01)
    const words = text.trim().split(/\s+/).length
    const wpm = Math.round(words / elapsed)
    const suspicious = words > 40 && wpm > 200
    return { suspicious, wpm }
  }

  // ── Resume parse ──────────────────────────────────────────────────────────
  async function handleResumeFile(file) {
    if (!file) return
    setResumeFile(file)
    try {
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
      GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
      const ab = await file.arrayBuffer()
      const pdf = await getDocument({ data: ab }).promise
      let text = ''
      for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map(item => item.str).join(' ') + '\n'
      }
      setResumeText(text.slice(0, 3000))
    } catch {
      try { setResumeText((await file.text()).slice(0, 3000)) } catch { setResumeText('') }
    }
  }

  // ── Start exam ────────────────────────────────────────────────────────────
  async function handleStart(e) {
    e.preventDefault()
    const errs = {}
    if (!name.trim()) errs.name = 'Please enter your name'
    if (!repoUrl.trim()) errs.repoUrl = 'Please paste a GitHub repository URL'
    else if (!parseGitHubUrl(repoUrl)) errs.repoUrl = 'Could not parse GitHub URL — use format github.com/owner/repo'
    if (Object.keys(errs).length) { setInputErr(errs); return }
    setInputErr({})
    setStep(STEPS.ANALYZING)
    setAnalyzeErr('')
    setProgressDone([])
    scrollTop()
    await runAnalysis()
  }

  async function runAnalysis() {
    try {
      const parsed = parseGitHubUrl(repoUrl)
      const done = []
      const onProgress = (msg) => {
        setProgressMsg(msg)
        const idx = PROGRESS_STEPS.findIndex(s => s === msg)
        if (idx > 0) { done.push(PROGRESS_STEPS[idx - 1]); setProgressDone([...done]) }
      }
      const rawData = await analyzeRepository(parsed.owner, parsed.repo, onProgress)
      const ctx = buildRepoContext(rawData)
      setRepoCtx(ctx)
      setProgressMsg('Generating examination questions…')
      const qRes = await fetch(`${API}/api/exam/questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoContext: ctx, resumeText })
      })
      if (!qRes.ok) throw new Error('Failed to generate questions — is the backend running?')
      const qData = await qRes.json()
      const qs = Array.isArray(qData.questions) && qData.questions.length > 0
        ? qData.questions
        : [{ id: 1, question: `Walk me through the architecture of ${ctx.name}`, area: 'architecture', evidence: 'General' }]
      setProgressDone([...PROGRESS_STEPS])
      setSessionId(qData.sessionId || null)
      setQuestions(qs)
      setTimeout(() => { setStep(STEPS.BLUEPRINT); scrollTop() }, 600)
    } catch (err) {
      setAnalyzeErr(err.message || 'Something went wrong')
    }
  }

  // ── Submit answer ─────────────────────────────────────────────────────────
  async function handleSubmitAnswer() {
    if (!answer.trim() || evaluating) return
    const { suspicious, wpm } = checkTypingSpeed(answer)
    if (suspicious) setIntegrity(p => ({ ...p, suspiciousCount: p.suspiciousCount + 1 }))
    setEvaluating(true)
    try {
      const priorQA = qaPairs.map(p => ({ question: p.question, answer: p.answer }))
      const projectContext = `${repoCtx?.name}: ${repoCtx?.description || ''} | Tech: ${(repoCtx?.techStack || []).join(', ')}`
      const evRes = await fetch(`${API}/api/exam/evaluate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questions[qIndex].question, answer: answer.trim(),
          projectContext, priorQA, questionNumber: qIndex + 1, sessionId,
          pasteDetected: integrity.pasteAttempts > 0,
          wpm,
        })
      })
      const ev = evRes.ok ? await evRes.json() : { composite_score: 0, verdict: 'fail', strength: null, weakness: null }
      setQaPairs(prev => [...prev, {
        question: questions[qIndex].question,
        answer: answer.trim(),
        area: questions[qIndex].area,
        evaluation: ev,
        suspicious,
        aiDetection: ev.aiDetection || null,
      }])
    } catch {
      setQaPairs(prev => [...prev, { question: questions[qIndex].question, answer: answer.trim(), area: questions[qIndex].area, evaluation: { composite_score: 0, verdict: 'fail' } }])
    }
    setEvaluating(false)
    setRecorded(true)
    // Reset typing trackers for next question
    answerStartRef.current = null
    answerLengthRef.current = 0
  }

  // ── Next / finish ─────────────────────────────────────────────────────────
  async function handleNext() {
    if (qIndex + 1 < questions.length) {
      setQIndex(qi => qi + 1)
      setAnswer('')
      setRecorded(false)
      scrollTop()
    } else {
      setStep(STEPS.CERTIFICATE)
      scrollTop()
      try {
        const rRes = await fetch(`${API}/api/exam/report`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
          candidateName: name, repoName: repoCtx?.name, repoUrl: repoCtx?.repoUrl,
          techStack: repoCtx?.techStack, qaPairs, sessionId,
          integrityFlags: {
            tabSwitches: integrity.tabSwitches,
            pasteAttempts: integrity.pasteAttempts,
            copyAttempts: integrity.copyAttempts,
            suspiciousTyping: integrity.suspiciousCount,
            aiDetections: qaPairs.map((p, i) => ({ q: i + 1, ...p.aiDetection })).filter(d => d.verdict && d.verdict !== 'clean'),
          },
        })
        })
        if (rRes.ok) setReport(await rRes.json())
      } catch { /* non-critical */ }
    }
  }

  const tierClass = t => ({ Distinguished: 'sc-distinguished', Proficient: 'sc-proficient', Developing: 'sc-developing', Emerging: 'sc-emerging' }[t] || 'sc-developing')
  const scoreColor = s => s >= 60 ? 'var(--verified)' : s >= 35 ? 'var(--soft)' : 'var(--accent)'
  const integrityRating = () => {
    const flags = integrity.tabSwitches + integrity.pasteAttempts + (integrity.suspiciousCount * 2) + integrity.copyAttempts
    if (flags === 0) return { label: 'Clean', cls: 'clean' }
    if (flags <= 2)  return { label: 'Low Risk', cls: 'warn' }
    return { label: 'Flagged', cls: 'flag' }
  }

  /* ── render ─────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{CSS}</style>
      <div className="ef" ref={topRef}>

        {/* TAB SWITCH OVERLAY */}
        {showTabWarning && step === STEPS.VIVA && (
          <div className="ef-tab-overlay">
            <h2>Tab switch detected</h2>
            <p>Leaving the examination window is recorded and flagged in your integrity report. Please stay on this page for the duration of the exam.</p>
            <div className="strike-count">Strike {integrity.tabSwitches} recorded</div>
            <button className="ef-btn ef-btn-primary" style={{ marginTop: 16 }} onClick={() => setShowTabWarning(false)}>
              Resume examination →
            </button>
          </div>
        )}

        {/* NAV */}
        <nav className="ef-nav">
          <button className="ef-wordmark" onClick={() => window.location.href = '/'}>
            VERIT<span className="a">A</span>S
          </button>
          <div className="ef-step-trail">
            {['Intake','Blueprint','Examination','Report'].map((s, i) => {
              const curr = [STEPS.INTAKE,STEPS.ANALYZING].includes(step) ? 0 : step === STEPS.BLUEPRINT ? 1 : step === STEPS.VIVA ? 2 : 3
              return <span key={s}>{i > 0 && <span className="sep"> · </span>}<span className={curr === i ? 'active' : ''}>{s}</span></span>
            })}
          </div>
        </nav>

        {/* PROCTORING BAR — only during viva */}
        {step === STEPS.VIVA && (
          <div className="ef-proctor-bar">
            <div className="pb-left">
              <span>
                <span className={`pb-dot${integrity.tabSwitches + integrity.pasteAttempts + integrity.suspiciousCount > 0 ? ' warn' : ''}`} />
                Proctored examination
              </span>
              {integrity.tabSwitches > 0 && <span className="pb-flag">Tab switches: {integrity.tabSwitches}</span>}
              {integrity.pasteAttempts > 0 && <span className="pb-flag">Paste attempts: {integrity.pasteAttempts}</span>}
              {integrity.copyAttempts > 0 && <span className="pb-flag">Copies: {integrity.copyAttempts}</span>}
            </div>
            <span>No copy-paste · Stay on page</span>
          </div>
        )}

        {/* ── INTAKE ── */}
        {step === STEPS.INTAKE && (
          <div className="ef-wrap ef-intake">
            <div style={{ marginBottom: 6, fontFamily: 'var(--fm)', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted)' }}>Examination · Public Beta</div>
            <h1>Your work.<br />Your <em>examination.</em></h1>
            <p className="sub">Paste a public GitHub repository. VERITAS reads your code, your commits, your decisions — then examines you on what you actually built.</p>
            <form className="ef-form" onSubmit={handleStart} noValidate>
              <div>
                <label className="ef-label">Your name</label>
                <input className={`ef-input${inputErr.name ? ' error' : ''}`} type="text" placeholder="Arjun Sharma" value={name} onChange={e => setName(e.target.value)} />
                {inputErr.name && <div className="ef-err">{inputErr.name}</div>}
              </div>
              <div>
                <label className="ef-label">GitHub repository (public)</label>
                <input className={`ef-input${inputErr.repoUrl ? ' error' : ''}`} type="text" placeholder="https://github.com/you/your-project" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} />
                {inputErr.repoUrl && <div className="ef-err">{inputErr.repoUrl}</div>}
              </div>
              <div>
                <label className="ef-label">Resume <span style={{ letterSpacing: 0, textTransform: 'none', fontFamily: 'var(--fu)', fontSize: 11, color: 'var(--muted)' }}>— optional</span></label>
                <div className={`ef-resume-zone${drag ? ' drag' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); handleResumeFile(e.dataTransfer.files[0]) }}>
                  <input type="file" accept=".pdf,.txt" onChange={e => handleResumeFile(e.target.files[0])} />
                  {resumeFile ? <div className="rz-file">✓ {resumeFile.name}</div> : <><div className="rz-label">Drop PDF or click to upload</div><div className="rz-hint">PDF · TXT · max 5 MB</div></>}
                </div>
              </div>
              <button type="submit" className="ef-btn ef-btn-primary">Begin examination →</button>
            </form>
          </div>
        )}

        {/* ── ANALYZING ── */}
        {step === STEPS.ANALYZING && (
          <div className="ef-wrap ef-analyzing">
            <h2>Analysing your repository</h2>
            <p className="sub">Reading your work before the examination begins.</p>
            <div className="ef-progress-list">
              {PROGRESS_STEPS.map(s => {
                const done = progressDone.includes(s)
                const active = progressMsg === s && !done
                return (
                  <div key={s} className={`ef-progress-item${done ? ' done' : active ? ' active' : ''}`}>
                    <span className="pi-icon">{done ? '✓' : active ? <Spinner /> : '·'}</span>
                    {s}
                  </div>
                )
              })}
            </div>
            {analyzeErr && (
              <div className="ef-analyze-err">
                <strong>Error:</strong> {analyzeErr}
                <br /><button className="ef-btn ef-btn-ghost" style={{ marginTop: 14 }} onClick={() => { setStep(STEPS.INTAKE); setAnalyzeErr('') }}>← Go back</button>
              </div>
            )}
          </div>
        )}

        {/* ── BLUEPRINT ── */}
        {step === STEPS.BLUEPRINT && repoCtx && (
          <div className="ef-wrap ef-blueprint">
            <div style={{ fontFamily: 'var(--fm)', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>Examination Blueprint</div>
            <h2>Repository analysed</h2>
            <p className="sub">VERITAS has read <strong>{repoCtx.name}</strong> and prepared {questions.length} questions.</p>
            <div className="ef-blueprint-grid">
              <div className="ef-bp-card">
                <div className="bpc-label">Tech stack detected</div>
                <div className="ef-chips">{(repoCtx.techStack || []).slice(0, 8).map(t => <span key={t} className="ef-chip">{t}</span>)}</div>
              </div>
              <div className="ef-bp-card">
                <div className="bpc-label">Architecture</div>
                <div className="bpc-val">{repoCtx.architecture}</div>
                <div style={{ marginTop: 6, fontFamily: 'var(--fm)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{repoCtx.systemType?.replace(/_/g, ' ')}</div>
              </div>
              <div className="ef-bp-card">
                <div className="bpc-label">Commits analysed</div>
                <div className="bpc-val" style={{ fontFamily: 'var(--fd)', fontSize: 28, fontWeight: 500 }}>{repoCtx.commits?.length || 0}</div>
              </div>
              <div className="ef-bp-card">
                <div className="bpc-label">Files in repository</div>
                <div className="bpc-val" style={{ fontFamily: 'var(--fd)', fontSize: 28, fontWeight: 500 }}>{repoCtx.fileCount || 0}</div>
              </div>
            </div>
            <div className="ef-questions-preview">
              <h3>Examination plan — {questions.length} questions</h3>
              {questions.map((q, i) => (
                <div key={q.id} className="ef-q-preview-row">
                  <span className="ef-q-num">0{i + 1}</span>
                  <span className={`ef-q-area ${q.area || 'depth'}`}>{(q.area || 'depth').replace(/_/g, ' ')}</span>
                  <span className="ef-q-text">{q.question.slice(0, 100)}{q.question.length > 100 ? '…' : ''}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(142,42,27,0.05)', border: '1px solid rgba(142,42,27,0.15)', borderRadius: 2, padding: '12px 16px', marginBottom: 28, fontFamily: 'var(--fm)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--accent)' }}>
              PROCTORED EXAM — Tab switching, copy-paste, and typing patterns are monitored and included in your integrity report.
            </div>
            <div className="ef-bp-footer">
              <div className="ef-bp-meta">{questions.length} questions · written examination · no time limit</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="ef-btn ef-btn-ghost" onClick={() => setStep(STEPS.INTAKE)}>← Edit</button>
                <button className="ef-btn ef-btn-primary" onClick={() => { setStep(STEPS.VIVA); setQIndex(0); setAnswer(''); setRecorded(false); scrollTop() }}>
                  Begin examination →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── VIVA ── */}
        {step === STEPS.VIVA && questions.length > 0 && (
          <div className="ef-wrap ef-viva">
            <div className="ef-viva-progress">
              <div className="ef-vp-bar">
                <div className="ef-vp-fill" style={{ width: `${((qIndex + (recorded ? 1 : 0)) / questions.length) * 100}%` }} />
              </div>
              <div className="ef-vp-label">Question {qIndex + 1} of {questions.length} · {repoCtx?.name}</div>
            </div>

            {/* Question — no copy allowed */}
            <div className="ef-q-card" onContextMenu={e => e.preventDefault()}>
              <div className="ef-q-meta">
                <span className="ef-q-tag">Q{qIndex + 1} · {(questions[qIndex].area || 'examination').replace(/_/g, ' ').toUpperCase()}</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--ai)', textTransform: 'uppercase' }}>EVIDENCE-BASED</span>
              </div>
              <div className="ef-q-body">{questions[qIndex].question}</div>
              {questions[qIndex].evidence && <div className="ef-q-evidence">Evidence basis: {questions[qIndex].evidence}</div>}
            </div>

            {/* Answer area */}
            {!recorded && (
              <>
                <textarea
                  ref={answerRef}
                  className="ef-answer-area"
                  placeholder="Answer in your own words. Be specific — reference files, decisions, errors, trade-offs."
                  value={answer}
                  onChange={handleAnswerChange}
                  onKeyDown={handleAnswerKeydown}
                  onPaste={handleAnswerPaste}
                  onContextMenu={e => e.preventDefault()}
                  disabled={evaluating}
                  rows={6}
                />
                {showPasteWarn && (
                  <div className="ef-paste-warn">
                    Paste is disabled during the examination. Type your answer manually.
                  </div>
                )}
                <div className="ef-answer-hint">Tip: specifics beat generics — name the file, the error, the trade-off you made.</div>
                <div className="ef-viva-actions">
                  <button className="ef-btn ef-btn-primary" onClick={handleSubmitAnswer} disabled={!answer.trim() || evaluating}>
                    {evaluating ? <><Spinner /> Evaluating…</> : 'Submit answer →'}
                  </button>
                </div>
              </>
            )}

            {evaluating && !recorded && (
              <div className="ef-evaluating"><Spinner /> Evaluating your answer…</div>
            )}

            {/* Answer recorded — no score shown */}
            {recorded && (
              <>
                <div className="ef-recorded">
                  <span className="rec-icon">✓</span>
                  <div>
                    <div className="rec-text">Answer recorded</div>
                    <div className="rec-sub">Score will be revealed in the final report</div>
                  </div>
                </div>
                <div className="ef-viva-actions">
                  <button className="ef-btn ef-btn-primary" onClick={handleNext}>
                    {qIndex + 1 < questions.length ? `Next question (${qIndex + 2}/${questions.length}) →` : 'View examination report →'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CERTIFICATE / GRADE CARD ── */}
        {step === STEPS.CERTIFICATE && (
          <div className="ef-wrap ef-cert-wrap">
            <div className="ef-cert-header">
              <div style={{ fontFamily: 'var(--fm)', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--verified)', marginBottom: 10 }}>Examination Complete</div>
              <h2>Examination Report</h2>
              <p className="sub">Generated from your answers · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            {/* Main cert card */}
            {report ? (
              <>
                <div className={`ef-cert-verdict-bar ${report.verdict.replace(' ','-')}`} />
                <div className="ef-cert-card">
                  <div className="ef-cert-type">Examination Report · № {report.verificationId}</div>
                  <div className="ef-cert-name">{report.candidateName}</div>
                  <div className="ef-cert-project">{report.repoName}</div>
                  <div className="ef-cert-scores">
                    {[['Authenticity', report.scores.authenticity], ['Ownership', report.scores.ownership], ['Competency', report.scores.competency]].map(([label, s]) => (
                      <div key={label} className="ef-cert-score">
                        <div className="sc-val" style={{ color: scoreColor(s.score) }}>{s.score}</div>
                        <div className="sc-label">{label}</div>
                        <div className={`sc-tier ${tierClass(s.tier)}`}>{s.tier}</div>
                      </div>
                    ))}
                  </div>
                  <div className="ef-cert-foot">
                    <div className="ef-cert-vid">
                      <span className="v-label">Verification ID</span>
                      <span className="v-val">{report.verificationId}</span>
                    </div>
                    <span className={`ef-cert-verdict ${report.verdict.replace(' ','-')}`}>{report.verdict}</span>
                  </div>
                </div>
              </>
            ) : (
              /* Fallback while report loads */
              (() => {
                const avg = key => Math.round(qaPairs.reduce((s, p) => s + (p.evaluation?.[key] || 0), 0) / Math.max(qaPairs.length, 1))
                const scores = [['Authenticity', avg('authenticity_score')], ['Ownership', avg('specificity_score')], ['Competency', avg('depth_score')]]
                const overall = avg('composite_score')
                const verdict = overall >= 70 ? 'VERIFIED' : overall >= 50 ? 'CONDITIONAL' : 'NEEDS REVIEW'
                return (
                  <>
                    <div className={`ef-cert-verdict-bar ${verdict.replace(' ','-')}`} />
                    <div className="ef-cert-card">
                      <div className="ef-cert-type">Examination Report</div>
                      <div className="ef-cert-name">{name}</div>
                      <div className="ef-cert-project">{repoCtx?.name}</div>
                      <div className="ef-cert-scores">
                        {scores.map(([label, score]) => (
                          <div key={label} className="ef-cert-score">
                            <div className="sc-val" style={{ color: scoreColor(score) }}>{score}</div>
                            <div className="sc-label">{label}</div>
                            <div className={`sc-tier ${score >= 85 ? 'sc-distinguished' : score >= 70 ? 'sc-proficient' : score >= 50 ? 'sc-developing' : 'sc-emerging'}`}>
                              {score >= 85 ? 'Distinguished' : score >= 70 ? 'Proficient' : score >= 50 ? 'Developing' : 'Emerging'}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="ef-cert-foot">
                        <div className="ef-cert-vid"><span className="v-label">Generating ID…</span><span style={{ display:'inline-block', marginTop:4 }}><Spinner /></span></div>
                        <span className={`ef-cert-verdict ${verdict.replace(' ','-')}`}>{verdict}</span>
                      </div>
                    </div>
                  </>
                )
              })()
            )}

            <div className="ef-cert-actions">
              <button className="ef-btn ef-btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
              <button className="ef-btn ef-btn-ghost" onClick={() => window.location.href = '/'}>Return to VERITAS</button>
            </div>

            {/* Per-question score grid */}
            {qaPairs.length > 0 && (
              <div className="ef-qgrid">
                <h3>Question-by-question breakdown</h3>
                {qaPairs.map((pair, i) => {
                  const ev = pair.evaluation || {}
                  const verdict = ev.verdict || 'fail'
                  const dims = [
                    ev.authenticity_score, ev.depth_score,
                    ev.specificity_score, ev.communication_score
                  ]
                  return (
                    <div key={i} className="ef-qgrid-row">
                      <div className="ef-qgrid-num">Q{i + 1}</div>
                      <div>
                        <div className="ef-qgrid-q">{pair.question}</div>
                        <div className="ef-qgrid-a">"{pair.answer.slice(0, 120)}{pair.answer.length > 120 ? '…' : ''}"</div>
                        {pair.suspicious && (
                          <div style={{ fontFamily: 'var(--fm)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.12em', marginTop: 4, textTransform: 'uppercase' }}>
                            ⚑ Unusual typing pattern detected
                          </div>
                        )}
                      </div>
                      <div className="ef-qgrid-score">
                        <div className={`gs-val ${verdict}`}>{ev.composite_score ?? '—'}</div>
                        <div className="gs-verd">{verdict.toUpperCase()}</div>
                        <div className="ef-qgrid-bars">
                          {dims.map((d, di) => (
                            <div key={di} className="ef-qgrid-bar">
                              <div className="ef-qgrid-bar-fill" style={{ width: `${d || 0}%`, background: scoreColor(d || 0) }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Integrity report */}
            <div className="ef-integrity">
              <h4>Integrity Report</h4>
              <div className="ef-integrity-grid">
                {[
                  { label: 'Tab Switches',    val: integrity.tabSwitches,    warn: integrity.tabSwitches > 0 },
                  { label: 'Paste Attempts',  val: integrity.pasteAttempts,  warn: integrity.pasteAttempts > 0 },
                  { label: 'Copy Attempts',   val: integrity.copyAttempts,   warn: integrity.copyAttempts > 0 },
                  { label: 'Typing Flags',    val: integrity.suspiciousCount, warn: integrity.suspiciousCount > 0 },
                ].map(item => (
                  <div key={item.label} className="ef-ig-item">
                    <div className={`ef-ig-val ${item.val === 0 ? 'clean' : item.val <= 1 ? 'warn' : 'flag'}`}>{item.val}</div>
                    <div className="ef-ig-label">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="ef-integrity-note">
                {(() => {
                  const r = integrityRating()
                  const total = integrity.tabSwitches + integrity.pasteAttempts + integrity.copyAttempts + integrity.suspiciousCount
                  if (total === 0) return '✓ No integrity flags raised. Examination conducted without any detected anomalies.'
                  return `${r.label}: ${total} flag${total > 1 ? 's' : ''} detected during this examination — tab switch${integrity.tabSwitches > 0 ? ` ×${integrity.tabSwitches}` : ' ×0'}, paste attempt${integrity.pasteAttempts > 0 ? ` ×${integrity.pasteAttempts}` : ' ×0'}, copy ×${integrity.copyAttempts}, typing anomaly ×${integrity.suspiciousCount}. Scores are evaluated independently; flags are advisory.`
                })()}
              </div>
            </div>

            {/* AI usage detection */}
            {(() => {
              const flagged = qaPairs.filter(p => p.aiDetection?.verdict === 'flagged')
              const suspicious = qaPairs.filter(p => p.aiDetection?.verdict === 'suspicious')
              const allClean = flagged.length === 0 && suspicious.length === 0
              return (
                <div className="ef-integrity" style={{ marginTop: 16 }}>
                  <h4>AI Usage Analysis</h4>
                  <div className="ef-integrity-note" style={{ marginBottom: flagged.length > 0 ? 14 : 0 }}>
                    {allClean
                      ? '✓ No AI-generated response patterns detected across all answers.'
                      : `${flagged.length} answer${flagged.length !== 1 ? 's' : ''} flagged, ${suspicious.length} suspicious. Patterns typical of AI-generated text were detected in the answers below.`
                    }
                  </div>
                  {!allClean && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {qaPairs.map((p, i) => {
                        const d = p.aiDetection
                        if (!d || d.verdict === 'clean') return null
                        const isFlag = d.verdict === 'flagged'
                        return (
                          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: isFlag ? 'rgba(142,42,27,0.05)' : 'rgba(139,132,114,0.07)', border: `1px solid ${isFlag ? 'rgba(142,42,27,0.2)' : 'var(--line-strong)'}`, borderRadius: 2 }}>
                            <span style={{ fontFamily: 'var(--fm)', fontSize: 9.5, color: isFlag ? 'var(--accent)' : 'var(--muted)', letterSpacing: '0.14em', textTransform: 'uppercase', paddingTop: 2, flexShrink: 0 }}>Q{i + 1}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontFamily: 'var(--fm)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: isFlag ? 'var(--accent)' : 'var(--soft)', marginBottom: 4 }}>
                                {isFlag ? '⚑ Flagged' : '⚐ Suspicious'} · Score {d.suspicionScore}/100
                              </div>
                              <div style={{ fontFamily: 'var(--fm)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.06em' }}>
                                {d.signals.map(s => s.replace(/_/g, ' ')).join(' · ')}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

          </div>
        )}

      </div>
    </>
  )
}
