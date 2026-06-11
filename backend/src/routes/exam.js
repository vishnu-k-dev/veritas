// backend/src/routes/exam.js
// No-auth public examination routes — candidate flow (no Supabase required)
import { Router } from 'express'
import { generateQuestions, evaluateAnswer, computeScores } from '../services/ai/index.js'
import { randomBytes } from 'crypto'

const router = Router()

// POST /api/exam/questions — generate viva questions from repo context
router.post('/questions', async (req, res) => {
  const { repoContext, resumeText } = req.body
  if (!repoContext) return res.status(400).json({ error: 'repoContext required' })

  const {
    name:        rawName,
    description: rawDescription,
    languages, techStack, commits,
    architecture: rawArchitecture,
    systemType:   rawSystemType,
    readme,
  } = repoContext

  const name        = String(rawName        || '').slice(0, 100)
  const description = String(rawDescription || '').slice(0, 300)
  const architecture = String(rawArchitecture || '').slice(0, 100)
  const systemType   = String(rawSystemType   || '').slice(0, 60)

  const langStr = Object.entries(languages || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([l]) => l)
    .join(', ')

  const commitLines = (commits || []).slice(0, 10)
    .map(c => `  ${c.sha?.slice(0, 7) || '???????'} "${c.message}" — ${c.author}`)
    .join('\n')

  const prompt = `You are VERITAS — an AI oral examiner. Your job: expose whether a candidate genuinely built what they claim.

PROJECT: ${name}
${description ? `Description: ${description}` : ''}
Languages: ${langStr || 'unknown'}
Tech stack: ${(techStack || []).join(', ') || 'unknown'}
Architecture: ${architecture || 'unknown'}
System type: ${systemType || 'software project'}
${readme ? `README (excerpt):\n${readme.slice(0, 700)}` : ''}

Commit history (evidence):
${commitLines || '  (no commits available)'}

${resumeText ? `Candidate background: ${resumeText.slice(0, 400)}` : ''}

Generate exactly 5 examination questions. Non-negotiable rules:
1. Every question must be unanswerable by someone who copy-pasted or never ran the code
2. Reference specific evidence visible in the data above (commit message, tech choice, file structure)
3. Never ask "what is X" — ask WHY they chose it, HOW they debugged it, WHAT they gave up
4. Q1: Warm-up — broad, "walk me through the hardest part of building this"
5. Q2: Probe a specific technical decision (cite the evidence from commits or tech stack)
6. Q3: Force a trade-off — no single right answer, they must defend a choice
7. Q4: Failure or debugging story — what broke, how they found it, what they changed
8. Q5: Pressure — the most technically risky or likely-exaggerated claim in this repo

Return ONLY a JSON array, no markdown, no explanation:
[
  { "id": 1, "question": "...", "evidence": "brief note on what evidence triggered this question", "area": "architecture|decisions|debugging|tradeoffs|depth" },
  { "id": 2, ... },
  { "id": 3, ... },
  { "id": 4, ... },
  { "id": 5, ... }
]`

  const result = await generateQuestions(prompt, {
    systemPrompt: 'You are VERITAS, an expert technical examiner. Return ONLY valid JSON — no markdown, no text outside the array.',
    maxTokens: 1400
  })

  if (!result.success) return res.status(503).json({ error: 'AI unavailable — try again shortly' })

  try {
    const cleaned = result.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    // Find JSON array in response
    const match = cleaned.match(/\[[\s\S]*\]/)
    const questions = JSON.parse(match ? match[0] : cleaned)
    res.json({ questions: Array.isArray(questions) ? questions : [] })
  } catch {
    res.json({ questions: [], raw: result.data })
  }
})

// POST /api/exam/evaluate — evaluate a single candidate answer
router.post('/evaluate', async (req, res) => {
  const { question: rawQuestion, answer: rawAnswer, projectContext, priorQA, questionNumber } = req.body
  if (!rawQuestion || !rawAnswer) return res.status(400).json({ error: 'question and answer required' })

  const question = String(rawQuestion).slice(0, 600)
  const answer   = String(rawAnswer).slice(0, 2000)

  const priorStr = (priorQA || []).slice(0, 10).length > 0
    ? priorQA.slice(0, 10).map((p, i) => `Q${i + 1}: ${String(p.question || '').slice(0, 400)}\nA${i + 1}: ${String(p.answer || '').slice(0, 600)}`).join('\n\n')
    : 'First answer — no prior context.'

  const prompt = `QUESTION ASKED (Q${questionNumber || '?'}): ${question}

CANDIDATE'S ANSWER: ${answer}

PROJECT CONTEXT: ${(projectContext || '').slice(0, 800)}

PRIOR ANSWERS (for consistency check):
${priorStr}

BE STRICT. A one-word answer like "ok", "yes", "fine", "good" scores 5–10 across all dimensions — it provides zero evidence of ownership. Do NOT give charity points. Score what was actually said.

Score this answer on FIVE dimensions (0–100 each, no artificial floor):

AUTHENTICITY (weight 45%) — does this answer prove the candidate built it?
  90–100: Cites specific files, line numbers, error messages, config values, commit SHAs
  70–89:  Specific technical decisions with clear personal reasoning
  50–69:  Understands the concept but surface-level — no specifics
  30–49:  Generic — could come from reading the docs without touching the code
  10–29:  Vague or one-liner with no evidence
  0–9:    Blank, "ok", "yes", or completely off-topic

DEPTH (weight 25%) — how deeply did they explain?
  90–100: What + why + alternatives considered + tradeoffs + what they'd change
  70–89:  Decision with clear reasoning
  50–69:  Implementation described without reasoning
  30–49:  High-level with some context
  10–29:  One sentence, barely on-topic
  0–9:    Single word or no substance

SPECIFICITY (weight 15%) — concrete references:
  90–100: Specific numbers, metrics, file paths, error names, version numbers
  70–89:  Named technologies with real context
  50–69:  Technologies named but without context
  10–29:  No specifics at all
  0–9:    Single word answer

COMMUNICATION (weight 10%) — clarity and structure:
  90–100: Logical, well-structured, easy to follow
  50–69:  Understandable but disorganised
  10–29:  Hard to follow
  0–9:    Single word or gibberish

CONSISTENCY (weight 5%) — matches prior answers or first answer:
  100: Fully consistent with prior answers
   60: Minor discrepancy
   50: First answer (no prior context to compare)
   10: Contradicts prior answers

COMPOSITE = (auth×0.45) + (depth×0.25) + (spec×0.15) + (comm×0.10) + (cons×0.05)
VERDICT: pass if composite≥60, hold if 35–59, fail if <35

Return ONLY valid JSON — no markdown, no text outside the object:
{
  "authenticity_score": <0-100>,
  "depth_score": <0-100>,
  "specificity_score": <0-100>,
  "communication_score": <0-100>,
  "consistency_score": <0-100>,
  "composite_score": <0-100>,
  "verdict": "<pass|hold|fail>",
  "strength": "<one sentence on what was credible, or null>",
  "weakness": "<one sentence on what was missing, or null>",
  "follow_up_needed": <true|false>
}`

  // Key 3 (GROQ_KEY_EVALUATOR) — deep answer analysis: authenticity, reasoning, red flags
  const evalResult = await evaluateAnswer(prompt, {
    systemPrompt: 'You are a senior technical evaluator. Be fair — reward genuine effort. Return ONLY valid JSON.',
    maxTokens: 600
  })

  if (!evalResult.success) return res.status(503).json({ error: 'Evaluation service unavailable — try again shortly' })

  let ev
  try {
    const cleaned = evalResult.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    ev = JSON.parse(match ? match[0] : cleaned)
  } catch {
    return res.status(503).json({ error: 'Evaluation response malformed — try again shortly' })
  }

  // Key 4 (GROQ_KEY_SCORING) — validate and compute final composite score
  const clamp = n => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))
  const auth  = clamp(ev.authenticity_score)
  const depth = clamp(ev.depth_score)
  const spec  = clamp(ev.specificity_score)
  const comm  = clamp(ev.communication_score)
  const cons  = clamp(ev.consistency_score)

  const scorePrompt = `Given these raw dimension scores from an answer evaluation:
authenticity=${auth}, depth=${depth}, specificity=${spec}, communication=${comm}, consistency=${cons}

Weights: authenticity×0.45 + depth×0.25 + specificity×0.15 + communication×0.10 + consistency×0.05
No minimum — score honestly. A one-word answer like "ok" should score under 10.

Return ONLY: { "composite_score": <number>, "verdict": "<pass|hold|fail>" }
pass if composite≥60, hold if 35–59, fail if <35`

  const scoreResult = await computeScores(scorePrompt, { maxTokens: 80 })

  let composite = clamp(Math.round(auth * 0.45 + depth * 0.25 + spec * 0.15 + comm * 0.10 + cons * 0.05))
  let verdict = composite >= 60 ? 'pass' : composite >= 35 ? 'hold' : 'fail'

  if (scoreResult.success) {
    try {
      const sc = JSON.parse(scoreResult.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim().match(/\{[\s\S]*\}/)?.[0] || '{}')
      if (sc.composite_score != null) composite = clamp(Number(sc.composite_score))
      if (sc.verdict) verdict = sc.verdict
    } catch { /* use calculated fallback */ }
  }

  res.json({
    authenticity_score: auth, depth_score: depth, specificity_score: spec,
    communication_score: comm, consistency_score: cons,
    composite_score: composite, verdict,
    strength: ev.strength || null,
    weakness: ev.weakness || null,
    follow_up_needed: ev.follow_up_needed ?? false
  })
})

// In-memory report store — survives server session, shareable by verificationId
const reportStore = new Map()

// GET /api/exam/report/:id — fetch a saved report by verification ID
router.get('/report/:id', (req, res) => {
  const report = reportStore.get(req.params.id)
  if (!report) return res.status(404).json({ error: 'Report not found' })
  res.json(report)
})

// POST /api/exam/report — generate final certificate data
router.post('/report', async (req, res) => {
  const { candidateName, repoName, repoUrl, techStack, qaPairs } = req.body
  if (!qaPairs?.length) return res.status(400).json({ error: 'qaPairs required' })

  const verificationId = `VRT-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`

  const avg = arr => Math.round(arr.reduce((s, v) => s + (Number(v) || 0), 0) / arr.length)
  const clamp = n => Math.max(0, Math.min(100, Math.round(n)))

  const authenticityScore = clamp(avg(qaPairs.map(p => p.evaluation?.authenticity_score ?? 0)))
  const ownershipScore    = clamp(avg(qaPairs.map(p => p.evaluation?.specificity_score  ?? 0)))
  const competencyScore   = clamp(avg(qaPairs.map(p => p.evaluation?.depth_score        ?? 0)))
  const overallScore      = clamp(avg(qaPairs.map(p => p.evaluation?.composite_score    ?? 0)))

  const tier = score => {
    if (score >= 85) return 'Distinguished'
    if (score >= 70) return 'Proficient'
    if (score >= 50) return 'Developing'
    return 'Emerging'
  }

  const verdict = overallScore >= 70 ? 'VERIFIED'
    : overallScore >= 50 ? 'CONDITIONAL'
    : 'NEEDS REVIEW'

  const report = {
    verificationId,
    candidateName: candidateName || 'Candidate',
    repoName:  repoName  || 'Unknown project',
    repoUrl:   repoUrl   || '',
    techStack: techStack || [],
    issuedAt:  new Date().toISOString(),
    scores: {
      authenticity: { score: authenticityScore, tier: tier(authenticityScore) },
      ownership:    { score: ownershipScore,    tier: tier(ownershipScore)    },
      competency:   { score: competencyScore,   tier: tier(competencyScore)   },
      overall: overallScore
    },
    verdict,
    shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${verificationId}`
  }

  reportStore.set(verificationId, report)
  res.json(report)
})

export default router
