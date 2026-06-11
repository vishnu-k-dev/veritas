// backend/src/routes/verify.js
// Dynamic OG + visual passport page for LinkedIn sharing & public verification
// Queries Supabase first (skill_passports), falls back to Firestore for legacy passports.
import { Router } from 'express';
import admin from 'firebase-admin';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });
  } else if (projectId) {
    admin.initializeApp({ projectId });
  }
}

const firestoreDb = admin.firestore();

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function vColor(cls) {
  const c = (cls || '').toLowerCase();
  if (c.includes('pass') || c.includes('verified')) return '#10b981';
  if (c.includes('hold') || c.includes('review')) return '#f59e0b';
  return '#ef4444';
}

router.get('/:verificationId', async (req, res) => {
  const vid = req.params.verificationId;
  let trustScore = 'N/A';
  let classification = 'Unknown';
  let candidateName = 'Developer';
  let githubRepo = '';
  let projectName = '';

  // 1. Try Supabase skill_passports first (new passports)
  try {
    const { data: passport } = await supabaseAdmin
      .from('skill_passports')
      .select('trust_score, verdict, passport_data, interviews(candidate_name, repo_url, interview_type)')
      .eq('public_url', vid)
      .single();

    if (passport) {
      trustScore    = String(passport.trust_score ?? 'N/A');
      classification = passport.verdict || 'Unknown';
      candidateName  = passport.interviews?.candidate_name || 'Developer';
      githubRepo     = passport.interviews?.repo_url || '';
      projectName    = passport.passport_data?.projectName || '';
    }
  } catch { /* not found in Supabase — try Firestore */ }

  // 2. Fall back to Firestore for legacy passports
  if (trustScore === 'N/A') {
    try {
      const snapshot = await firestoreDb
        .collection('interviews')
        .where('verificationId', '==', vid)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const interview = snapshot.docs[0].data();
        if (interview.trustScore != null) trustScore = String(interview.trustScore);
        if (interview.verdict) classification = interview.verdict;
        if (interview.candidateName) candidateName = interview.candidateName;
        if (interview.repoUrl) githubRepo = interview.repoUrl;
        if (interview.projectName) projectName = interview.projectName;
      }
    } catch (err) {
      console.error('Verify route Firestore error:', err.message);
    }
  }

  const color = vColor(classification);
  const dateStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const ogTitle = esc(candidateName + "'s VERITAS Skill Passport");
  const ogDesc = esc('Trust score: ' + trustScore + '/100 · ' + classification.toUpperCase() + ' · Verified via AI technical interview');
  const ogImage = 'https://VERITAS-api.onrender.com/api/badge/' + vid;
  const safeName = esc(candidateName);
  const safeClass = esc(classification.toUpperCase());
  const shortId = esc(vid.substring(0, 8));
  const repoTag = githubRepo ? esc(githubRepo.split('/').pop()) : (projectName ? esc(projectName) : 'AI INTERVIEW');

  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <title>' + ogTitle + '</title>',
    '  <meta property="og:type" content="profile">',
    '  <meta property="og:title" content="' + ogTitle + '">',
    '  <meta property="og:description" content="' + ogDesc + '">',
    '  <meta property="og:image" content="' + ogImage + '">',
    '  <meta property="og:url" content="https://www.tryVERITAS.app/verify/' + vid + '">',
    '  <meta name="twitter:card" content="summary_large_image">',
    '  <link rel="preconnect" href="https://fonts.googleapis.com">',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">',
    '  <style>',
    '    *{margin:0;padding:0;box-sizing:border-box}',
    '    body{min-height:100vh;background:#000;color:#fff;font-family:"DM Sans",sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center}',
    '    .bg{position:fixed;inset:0;z-index:-1;background:radial-gradient(circle at 50% -20%,#2a2215 0%,#000 50%)}',
    '    .wrap{perspective:1000px;position:relative;z-index:10}',
    '    .card{width:320px;height:480px;position:relative;transform-style:preserve-3d;transition:transform .6s cubic-bezier(.4,0,.2,1);cursor:pointer}',
    '    .card.flipped{transform:rotateY(180deg)}',
    '    .face{position:absolute;inset:0;backface-visibility:hidden;border-radius:12px;background:#121212;border:1px solid #222;overflow:hidden;display:flex;flex-direction:column}',
    '    .face.back{transform:rotateY(180deg);background:#111}',
    '    .hdr{padding:24px;display:flex;align-items:flex-start;gap:16px;border-bottom:1px solid #1e1e1e}',
    '    .av{width:60px;height:60px;border-radius:12px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;border:1px solid #333}',
    '    .nm{font-family:"Bebas Neue",sans-serif;font-size:24px;letter-spacing:.06em;color:#fff;line-height:1.1}',
    '    .rl{font-size:11px;color:#a0a0a0;margin-top:3px;letter-spacing:.04em}',
    '    .vs{padding:12px 24px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #1e1e1e;background:#0a0a0a}',
    '    .dot{width:8px;height:8px;border-radius:50%}',
    '    .vt{font-family:"Bebas Neue",sans-serif;font-size:16px;letter-spacing:.08em;line-height:1}',
    '    .vid{margin-left:auto;font-family:"DM Mono",monospace;font-size:9px;color:#888;letter-spacing:.08em}',
    '    .sg{display:flex;padding:20px 24px;gap:12px}',
    '    .sb{flex:1;background:#171717;border:1px solid #222;border-radius:8px;padding:12px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center}',
    '    .sv{font-family:"Bebas Neue",sans-serif;font-size:28px;color:#f5d485;line-height:1}',
    '    .sl{font-size:9.5px;color:#a0a0a0;text-transform:uppercase;letter-spacing:.09em;margin-top:3px}',
    '    .tg{padding:0 24px 24px;display:flex;flex-wrap:wrap;gap:6px}',
    '    .t{font-size:9.5px;font-family:"DM Mono",monospace;color:#b0b0b0;background:#1a1a1a;border:1px solid #262626;border-radius:4px;padding:3px 7px;letter-spacing:.04em}',
    '    .ft{margin-top:auto;border-top:1px solid #1e1e1e;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}',
    '    .fi{font-family:"DM Mono",monospace;font-size:9px;color:#888;letter-spacing:.12em}',
    '    .fh{font-size:9px;color:#a0a0a0;letter-spacing:.08em;text-transform:uppercase}',
    '    .bw{padding:24px;display:flex;flex-direction:column;flex:1}',
    '    .bh{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px;border-bottom:1px solid #1e1e1e;padding-bottom:12px}',
    '    .bt{font-family:"Bebas Neue",sans-serif;font-size:15px;letter-spacing:.1em;color:#e0e0e0}',
    '    .bv{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#c8973a}',
    '    .ub{background:#161616;border:1px solid #1e1e1e;border-radius:7px;padding:9px 12px;margin-top:auto}',
    '    .ul{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:#888;margin-bottom:2px}',
    '    .uv{font-family:"DM Mono",monospace;font-size:9.5px;color:#a0a0a0}',
    '    .cta{margin-top:24px;background:transparent;color:#a0a0a0;border:1px solid #333;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:11px 14px;border-radius:10px;width:320px;font-family:"DM Sans",sans-serif;font-weight:500;text-decoration:none;display:block;text-align:center;transition:opacity .15s}',
    '    .cta:hover{opacity:.8}',
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="bg"></div>',
    '  <div class="wrap">',
    '    <div class="card" id="card" onclick="this.classList.toggle(\'flipped\')">',
    '      <div class="face front">',
    '        <div class="hdr">',
    '          <div class="av">',
    '            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    '          </div>',
    '          <div>',
    '            <div class="nm">' + safeName + '</div>',
    '            <div class="rl">SOFTWARE ENGINEER</div>',
    '          </div>',
    '        </div>',
    '        <div class="vs">',
    '          <div class="dot" style="background:' + color + ';box-shadow:0 0 8px ' + color + '"></div>',
    '          <div class="vt" style="color:' + color + '">' + safeClass + '</div>',
    '          <div class="vid">#' + shortId + '</div>',
    '        </div>',
    '        <div class="sg">',
    '          <div class="sb">',
    '            <div class="sv">' + esc(trustScore) + '</div>',
    '            <div class="sl">TRUST SCORE</div>',
    '          </div>',
    '          <div class="sb" style="opacity:.5">',
    '            <div class="sv" style="color:#666">--</div>',
    '            <div class="sl">SPECIFICITY</div>',
    '          </div>',
    '        </div>',
    '        <div class="tg">',
    '          <div class="t">' + repoTag + '</div>',
    '          <div class="t">VERIFIED</div>',
    '        </div>',
    '        <div class="ft">',
    '          <div class="fi">VERITAS // ' + esc(dateStr) + '</div>',
    '          <div class="fh">CLICK TO FLIP ↩</div>',
    '        </div>',
    '      </div>',
    '      <div class="face back">',
    '        <div class="bw">',
    '          <div class="bh">',
    '            <div class="bt">PERFORMANCE LOG</div>',
    '            <div class="bv">✓ VERIFIED</div>',
    '          </div>',
    '          <div class="ub">',
    '            <div class="ul">VERIFY VIA</div>',
    '            <div class="uv">tryVERITAS.app/verify/' + esc(vid) + '</div>',
    '          </div>',
    '        </div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <a href="https://www.tryVERITAS.app" class="cta">Create your own VERITAS Passport</a>',
    '</body>',
    '</html>'
  ].join('\n');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;

