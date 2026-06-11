import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap');
.vr { --bg:#F5F2E9;--surface:#FDFCF8;--surface-2:#EFEBDF;--surface-3:#E7E2D2;--line:rgba(28,25,18,0.13);--line-strong:rgba(28,25,18,0.26);--text:#1C1912;--soft:#524C3F;--muted:#8B8472;--accent:#8E2A1B;--verified:#1E6B45;--ai:#4F4380;--fd:"Newsreader",Georgia,serif;--fu:"Geist",system-ui,sans-serif;--fm:"Geist Mono",ui-monospace,monospace;min-height:100vh;background:var(--bg);color:var(--text);font-family:var(--fu);font-size:15px;line-height:1.55; }
.vr * { box-sizing:border-box;margin:0;padding:0; }
.vr-nav { height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc(50vw - 580px));border-bottom:1px solid var(--line);background:rgba(245,242,233,0.95);backdrop-filter:blur(10px); }
.vr-wordmark { font-family:var(--fu);font-weight:600;font-size:13px;letter-spacing:0.26em;color:var(--text);background:none;border:none;cursor:pointer; }
.vr-wordmark .a { color:var(--accent);font-family:var(--fd);font-style:italic;font-weight:500;font-size:1.18em; }
.vr-wrap { max-width:640px;margin:0 auto;padding:0 24px; }
.vr-hero { padding:64px 0 48px;text-align:center; }
.vr-hero .eyebrow { font-family:var(--fm);font-size:9.5px;letter-spacing:0.26em;text-transform:uppercase;color:var(--muted);margin-bottom:12px; }
.vr-spinner { width:16px;height:16px;border:2px solid var(--surface-3);border-top-color:var(--text);border-radius:50%;animation:vr-spin 0.7s linear infinite;display:inline-block;margin:0 auto; }
@keyframes vr-spin { to{transform:rotate(360deg)} }

/* cert card */
.vr-card { background:var(--surface);border:1px solid var(--line-strong);border-radius:3px;padding:40px 44px;position:relative;box-shadow:0 1px 0 rgba(28,25,18,0.04),0 24px 48px -28px rgba(28,25,18,0.22);margin-bottom:28px; }
.vr-card::before { content:'';position:absolute;inset:9px;border:1px solid var(--line);border-radius:1px;pointer-events:none; }
.vr-card-type { font-family:var(--fm);font-size:9.5px;letter-spacing:0.26em;text-transform:uppercase;color:var(--muted);text-align:center;margin-bottom:22px; }
.vr-card-name { font-family:var(--fd);font-size:38px;font-weight:500;text-align:center;letter-spacing:-0.01em;line-height:1.1; }
.vr-card-repo { font-size:13px;color:var(--soft);text-align:center;margin-top:5px;font-family:var(--fd);font-style:italic; }
.vr-scores { display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin:26px 0 22px; }
.vr-score { text-align:center;padding:18px 8px 16px; }
.vr-score+.vr-score { border-left:1px solid var(--line); }
.vr-score .sv { font-family:var(--fd);font-size:44px;font-weight:500;line-height:1; }
.vr-score .sl { font-family:var(--fm);font-size:8.5px;letter-spacing:0.18em;text-transform:uppercase;color:var(--muted);margin-top:8px; }
.vr-score .st { font-size:11px;margin-top:4px;font-family:var(--fd);font-style:italic; }
.sc-distinguished{color:var(--verified)} .sc-proficient{color:var(--text)} .sc-developing{color:var(--soft)} .sc-emerging{color:var(--muted)}
.vr-foot { display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px; }
.vr-vid .vl { font-family:var(--fm);font-size:8.5px;letter-spacing:0.18em;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:4px; }
.vr-vid .vv { font-family:var(--fm);font-size:13px;color:var(--soft);letter-spacing:0.02em; }
.vr-verdict { font-family:var(--fm);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;padding:5px 13px;border-radius:2px;border:1px solid; }
.vr-verdict.VERIFIED { color:var(--verified);border-color:rgba(30,107,69,0.3);background:rgba(30,107,69,0.07); }
.vr-verdict.CONDITIONAL { color:var(--soft);border-color:var(--line-strong);background:var(--surface-2); }
.vr-verdict.NEEDS-REVIEW { color:var(--accent);border-color:rgba(142,42,27,0.3);background:rgba(142,42,27,0.06); }
.vr-verdict-bar { border-radius:3px 3px 0 0; }
.vr-verdict-bar.VERIFIED { border-top:3px solid var(--verified); }
.vr-verdict-bar.CONDITIONAL { border-top:3px solid var(--muted); }
.vr-verdict-bar.NEEDS-REVIEW { border-top:3px solid var(--accent); }

/* meta strip */
.vr-meta { display:flex;justify-content:center;gap:32px;padding:20px 0;border-top:1px solid var(--line);margin-bottom:28px;flex-wrap:wrap; }
.vr-meta-item { text-align:center; }
.vr-meta-item .mi-val { font-family:var(--fd);font-size:18px;font-weight:500; }
.vr-meta-item .mi-label { font-family:var(--fm);font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted);margin-top:3px; }

/* verified badge */
.vr-badge { display:flex;align-items:center;gap:14px;padding:16px 20px;background:rgba(30,107,69,0.05);border:1px solid rgba(30,107,69,0.18);border-radius:2px;margin-bottom:24px; }
.vr-badge .badge-icon { font-size:22px;flex-shrink:0; }
.vr-badge .badge-text { font-size:13.5px;color:var(--soft);line-height:1.55; }
.vr-badge .badge-text strong { color:var(--verified); }

/* error state */
.vr-error { text-align:center;padding:80px 0; }
.vr-error h2 { font-family:var(--fd);font-size:28px;font-weight:500;margin-bottom:10px; }
.vr-error p { color:var(--soft);font-size:15px; }

/* actions */
.vr-actions { display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:48px; }
.vr-btn { display:inline-flex;align-items:center;gap:8px;font-family:var(--fu);font-size:13px;font-weight:500;padding:10px 22px;border-radius:2px;border:1px solid transparent;cursor:pointer;transition:background 0.15s,border-color 0.15s; }
.vr-btn-primary { background:var(--text);color:var(--surface);border-color:var(--text); }
.vr-btn-primary:hover { background:var(--accent);border-color:var(--accent); }
.vr-btn-ghost { background:transparent;color:var(--text);border-color:var(--line-strong); }
.vr-btn-ghost:hover { border-color:var(--text); }

.vr-issued { font-family:var(--fm);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);text-align:center;margin-bottom:32px; }

@media print {
  .vr-nav, .vr-actions, .vr-badge { display:none!important; }
  .vr { background:white; }
  .vr-card { box-shadow:none;border:1px solid #ccc; }
  .vr-wrap { max-width:100%; }
}
@media(max-width:540px) {
  .vr-scores { grid-template-columns:1fr; }
  .vr-score+.vr-score { border-left:none;border-top:1px solid var(--line); }
  .vr-card { padding:28px 22px; }
}
`

export default function VerifyReport() {
  const id = window.location.pathname.split('/').filter(Boolean).pop()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/exam/report/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setReport(data); setLoading(false) })
      .catch(() => { setReport(null); setLoading(false) })
  }, [id])

  const tierClass = t => ({ Distinguished:'sc-distinguished', Proficient:'sc-proficient', Developing:'sc-developing', Emerging:'sc-emerging' }[t] || 'sc-developing')
  const scoreColor = s => s >= 60 ? 'var(--verified)' : s >= 35 ? 'var(--soft)' : 'var(--accent)'

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="vr">
        <nav className="vr-nav">
          <button className="vr-wordmark" onClick={() => window.location.href = '/'}>
            VERIT<span className="a">A</span>S
          </button>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Verification Portal
          </span>
        </nav>

        <div className="vr-wrap">
          {loading && (
            <div className="vr-hero">
              <div className="eyebrow">Looking up report…</div>
              <div style={{ marginTop: 24 }}><div className="vr-spinner" /></div>
            </div>
          )}

          {!loading && !report && (
            <div className="vr-error">
              <h2>Report not found</h2>
              <p>The verification ID <code style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{id}</code> does not match any examination report.</p>
              <p style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>Reports are stored for the duration of the server session.</p>
            </div>
          )}

          {!loading && report && (() => {
            const v = report.verdict?.replace(' ', '-') || 'CONDITIONAL'
            return (
              <>
                <div style={{ paddingTop: 48, marginBottom: 24, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--verified)', marginBottom: 6 }}>
                    Verified Examination Report
                  </div>
                </div>

                <div className={`vr-verdict-bar ${v}`} />
                <div className="vr-card">
                  <div className="vr-card-type">Examination Report · № {report.verificationId}</div>
                  <div className="vr-card-name">{report.candidateName}</div>
                  <div className="vr-card-repo">{report.repoName}</div>

                  <div className="vr-scores">
                    {[
                      ['Authenticity', report.scores?.authenticity],
                      ['Ownership',    report.scores?.ownership],
                      ['Competency',   report.scores?.competency],
                    ].map(([label, s]) => (
                      <div key={label} className="vr-score">
                        <div className="sv" style={{ color: scoreColor(s?.score || 0) }}>{s?.score ?? '—'}</div>
                        <div className="sl">{label}</div>
                        <div className={`st ${tierClass(s?.tier)}`}>{s?.tier}</div>
                      </div>
                    ))}
                  </div>

                  <div className="vr-foot">
                    <div className="vr-vid">
                      <span className="vl">Verification ID</span>
                      <span className="vv">{report.verificationId}</span>
                    </div>
                    <span className={`vr-verdict ${v}`}>{report.verdict}</span>
                  </div>
                </div>

                <div className="vr-issued">
                  Issued {new Date(report.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {report.repoUrl && <> · <a href={report.repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ai)', textDecoration: 'underline', textUnderlineOffset: 3 }}>View repository ↗</a></>}
                </div>

                <div className="vr-badge">
                  <div className="badge-icon">✓</div>
                  <div className="badge-text">
                    <strong>This report is authentic.</strong> It was generated by VERITAS from a live examination conducted on {new Date(report.issuedAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. The questions were derived from the candidate's actual GitHub repository and the answers were evaluated in real time.
                  </div>
                </div>

                {/* AI usage integrity summary */}
                {report.integrityFlags && (() => {
                  const detections = report.integrityFlags.aiDetections || []
                  const flagged = detections.filter(d => d.verdict === 'flagged').length
                  const behavioural = (report.integrityFlags.tabSwitches || 0) + (report.integrityFlags.pasteAttempts || 0)
                  if (flagged === 0 && behavioural === 0) return (
                    <div className="vr-badge" style={{ background: 'rgba(30,107,69,0.04)', borderColor: 'rgba(30,107,69,0.15)', marginBottom: 24 }}>
                      <div className="badge-icon" style={{ fontSize: 18 }}>🛡️</div>
                      <div className="badge-text"><strong style={{ color: 'var(--verified)' }}>AI Usage: Clean.</strong> No AI-generated response patterns were detected in any answer. No behavioural flags during the examination.</div>
                    </div>
                  )
                  return (
                    <div className="vr-badge" style={{ background: 'rgba(142,42,27,0.04)', borderColor: 'rgba(142,42,27,0.2)', marginBottom: 24 }}>
                      <div className="badge-icon" style={{ fontSize: 18 }}>⚑</div>
                      <div className="badge-text">
                        <strong style={{ color: 'var(--accent)' }}>Integrity flags present.</strong>{' '}
                        {flagged > 0 && <>{flagged} answer{flagged !== 1 ? 's' : ''} contained patterns consistent with AI-generated text. </>}
                        {report.integrityFlags.pasteAttempts > 0 && <>{report.integrityFlags.pasteAttempts} paste attempt{report.integrityFlags.pasteAttempts !== 1 ? 's' : ''} were blocked. </>}
                        {report.integrityFlags.tabSwitches > 0 && <>{report.integrityFlags.tabSwitches} tab switch{report.integrityFlags.tabSwitches !== 1 ? 'es' : ''} recorded. </>}
                        Scores reflect only the content of answers and were evaluated independently of these flags.
                      </div>
                    </div>
                  )
                })()}

                <div className="vr-meta">
                  {[
                    { val: report.scores?.overall ?? '—', label: 'Overall Score' },
                    { val: report.techStack?.length || 0, label: 'Tech Detected' },
                    { val: report.verdict?.replace(' REVIEW',''), label: 'Final Verdict' },
                  ].map(item => (
                    <div key={item.label} className="vr-meta-item">
                      <div className="mi-val">{item.val}</div>
                      <div className="mi-label">{item.label}</div>
                    </div>
                  ))}
                </div>

                <div className="vr-actions">
                  <button className="vr-btn vr-btn-ghost" onClick={copyLink}>
                    {copied ? '✓ Copied' : 'Copy share link'}
                  </button>
                  <button className="vr-btn vr-btn-ghost" onClick={() => window.print()}>
                    Print / Save PDF
                  </button>
                  <button className="vr-btn vr-btn-primary" onClick={() => window.location.href = '/exam'}>
                    Take the exam →
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </>
  )
}
