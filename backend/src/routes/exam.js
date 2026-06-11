// backend/src/routes/exam.js
// No-auth public examination routes — candidate flow
import { Router } from 'express'
import { randomBytes } from 'crypto'
import rateLimit from 'express-rate-limit'
import { generateQuestions, evaluateAnswer } from '../services/ai/index.js'
import { isRagEnabled, indexRepo, retrieveForQuestions, retrieveEvidence, purgeSession } from '../services/rag/indexer.js'
import { saveReport, getReport, isDbEnabled } from '../services/db/reports.js'

const router = Router()

// Per-IP rate limits for the expensive exam endpoints
const questionsLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: req => req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Maximum 5 exam sessions per hour. Try again later.' },
})

const evaluateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: req => req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Maximum 30 evaluations per hour. Try again later.' },
})

// In-memory fallback when DATABASE_URL is not set
const reportMemStore = new Map()

// POST /api/exam/questions — index repo into pgvector, generate viva questions
router.post('/questions', questionsLimit, async (req, res) => {
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

  const name         = String(rawName         || '').slice(0, 100)
  const description  = String(rawDescription  || '').slice(0, 300)
  const architecture = String(rawArchitecture || '').slice(0, 100)
  const systemType   = String(rawSystemType   || '').slice(0, 60)

  // ── RAG: index repo into pgvector and retrieve rich context ──────────────────
  let sessionId = null
  let ragContext = null

  if (isRagEnabled()) {
    sessionId = `exam_${Date.now()}_${randomBytes(4).toString('hex')}`
    try {
      await indexRepo(sessionId, repoContext)
      ragContext = await retrieveForQuestions(sessionId, name)
    } catch (err) {
      console.warn('[RAG] Indexing failed, using raw context:', err.message)
      sessionId = null
      ragContext = null
    }
  }

  // ── Build question prompt (RAG-enriched or raw fallback) ─────────────────────
  let contextBlock
  if (ragContext) {
    contextBlock = `REPOSITORY INTELLIGENCE (retrieved from full semantic index — ${repoContext.fileCount || 0} files, ${commits?.length || 0} commits indexed):

${ragContext}`
  } else {
    const langStr = Object.entries(languages || {})
      .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => l).join(', ')

    const commitLines = (commits || []).slice(0, 10)
      .map(c => `  ${c.sha?.slice(0, 7) || '???????'} "${c.message}" — ${c.author}`)
      .join('\n')

    contextBlock = `PROJECT: ${name}
${description ? `Description: ${description}` : ''}
Languages: ${langStr || 'unknown'}
Tech stack: ${(techStack || []).join(', ') || 'unknown'}
Architecture: ${architecture || 'unknown'}
System type: ${systemType || 'software project'}
${readme ? `README (excerpt):\n${readme.slice(0, 700)}` : ''}

Commit history (evidence):
${commitLines || '  (no commits available)'}`
  }

  const prompt = `You are VERITAS — an AI oral examiner. Your job: expose whether a candidate genuinely built what they claim.

${contextBlock}

${resumeText ? `Candidate background: ${String(resumeText).slice(0, 400)}` : ''}

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
    maxTokens: 1400,
  })

  if (!result.success) return res.status(503).json({ error: 'AI unavailable — try again shortly' })

  try {
    const cleaned = result.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    const questions = JSON.parse(match ? match[0] : cleaned)
    res.json({ questions: Array.isArray(questions) ? questions : [], sessionId })
  } catch {
    res.json({ questions: [], sessionId, raw: result.data })
  }
})

// POST /api/exam/evaluate — evaluate a single candidate answer with RAG evidence grounding
router.post('/evaluate', evaluateLimit, async (req, res) => {
  const { question: rawQuestion, answer: rawAnswer, projectContext, priorQA, questionNumber, sessionId } = req.body
  if (!rawQuestion || !rawAnswer) return res.status(400).json({ error: 'question and answer required' })

  const question = String(rawQuestion).slice(0, 600)
  const answer   = String(rawAnswer).slice(0, 2000)

  const priorStr = (priorQA || []).slice(0, 10).length > 0
    ? priorQA.slice(0, 10).map((p, i) =>
        `Q${i + 1}: ${String(p.question || '').slice(0, 400)}\nA${i + 1}: ${String(p.answer || '').slice(0, 600)}`
      ).join('\n\n')
    : 'First answer — no prior context.'

  // ── RAG: retrieve repo evidence relevant to this answer ──────────────────────
  let evidenceBlock = ''
  if (sessionId && isRagEnabled()) {
    try {
      const evidence = await retrieveEvidence(sessionId, answer)
      if (evidence) {
        evidenceBlock = `\nREPOSITORY EVIDENCE (retrieved from pgvector index — verify candidate claims against this):
${evidence}

Use this evidence to check: does the candidate mention real files, real commits, real decisions that actually exist in this repo?
`
      }
    } catch (err) {
      console.warn('[RAG] Evidence retrieval failed:', err.message)
    }
  }

  const prompt = `QUESTION ASKED (Q${questionNumber || '?'}): ${question}

CANDIDATE'S ANSWER: ${answer}

PROJECT CONTEXT: ${String(projectContext || '').slice(0, 400)}
${evidenceBlock}
PRIOR ANSWERS (for consistency check):
${priorStr}

BE STRICT. A one-word answer like "ok", "yes", "fine", "good" scores 5–10 across all dimensions — it provides zero evidence of ownership. Do NOT give charity points. Score what was actually said.
${evidenceBlock ? 'If the candidate references something verifiable in the repository evidence above, reward specificity. If they claim something that contradicts the evidence, penalise authenticity.' : ''}

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

  const evalResult = await evaluateAnswer(prompt, {
    systemPrompt: 'You are a senior technical evaluator. Be fair — reward genuine effort. Return ONLY valid JSON.',
    maxTokens: 600,
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

  const clamp = n => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))
  const auth  = clamp(ev.authenticity_score)
  const depth = clamp(ev.depth_score)
  const spec  = clamp(ev.specificity_score)
  const comm  = clamp(ev.communication_score)
  const cons  = clamp(ev.consistency_score)

  // Compute composite deterministically from Key 3 dimensions — no Key 4 call needed
  const composite = clamp(Math.round(auth * 0.45 + depth * 0.25 + spec * 0.15 + comm * 0.10 + cons * 0.05))
  const verdict = composite >= 60 ? 'pass' : composite >= 35 ? 'hold' : 'fail'

  res.json({
    authenticity_score: auth, depth_score: depth, specificity_score: spec,
    communication_score: comm, consistency_score: cons,
    composite_score: composite, verdict,
    strength: ev.strength || null,
    weakness: ev.weakness || null,
    follow_up_needed: ev.follow_up_needed ?? false,
    rag: !!evidenceBlock,
  })
})

// GET /api/exam/report/:id — fetch a saved report by verification ID
router.get('/report/:id', async (req, res) => {
  const id = req.params.id
  try {
    if (isDbEnabled()) {
      const report = await getReport(id)
      if (report) return res.json(report)
    }
    const mem = reportMemStore.get(id)
    if (mem) return res.json(mem)
    res.status(404).json({ error: 'Report not found' })
  } catch (err) {
    console.error('[report/get]', err.message)
    res.status(500).json({ error: 'Failed to retrieve report' })
  }
})

// POST /api/exam/report — generate final certificate, purge RAG session
router.post('/report', async (req, res) => {
  const { candidateName, repoName, repoUrl, techStack, qaPairs, sessionId } = req.body
  if (!qaPairs?.length) return res.status(400).json({ error: 'qaPairs required' })

  const verificationId = `VRT-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`

  const avg   = arr => Math.round(arr.reduce((s, v) => s + (Number(v) || 0), 0) / arr.length)
  const clamp = n => Math.max(0, Math.min(100, Math.round(n)))

  const authenticityScore = clamp(avg(qaPairs.map(p => p.evaluation?.authenticity_score ?? 0)))
  const ownershipScore    = clamp(avg(qaPairs.map(p => p.evaluation?.specificity_score  ?? 0)))
  const competencyScore   = clamp(avg(qaPairs.map(p => p.evaluation?.depth_score        ?? 0)))
  const overallScore      = clamp(avg(qaPairs.map(p => p.evaluation?.composite_score    ?? 0)))

  const tier = s => s >= 85 ? 'Distinguished' : s >= 70 ? 'Proficient' : s >= 50 ? 'Developing' : 'Emerging'

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
      overall: overallScore,
    },
    verdict,
    ragEnabled: isRagEnabled(),
    shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${verificationId}`,
  }

  // Persist — Neon Postgres if available, in-memory Map as fallback
  try {
    if (isDbEnabled()) {
      await saveReport(report)
    } else {
      reportMemStore.set(verificationId, report)
    }
  } catch (err) {
    console.error('[report/save]', err.message)
    reportMemStore.set(verificationId, report) // fallback on DB error
  }

  // Purge pgvector session vectors now that the report is saved
  if (sessionId && isRagEnabled()) {
    purgeSession(sessionId).catch(err => console.warn('[RAG] Purge failed:', err.message))
  }

  res.json(report)
})

export default router
