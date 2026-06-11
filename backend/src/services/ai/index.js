// backend/src/services/ai/index.js
// Groq inference — 4 dedicated API keys, each assigned to one role:
//   GROQ_KEY_ANALYSIS   → repo/context analysis (orchestration)
//   GROQ_KEY_QUESTIONS  → question generation
//   GROQ_KEY_EVALUATOR  → answer analysis
//   GROQ_KEY_SCORING    → score computation
//
// Each key runs independently so one key's rate limit never blocks another role.

import Groq from 'groq-sdk'

const MODEL = 'llama-3.3-70b-versatile'  // best free-tier Groq model

// ── Build a single-key Groq client ───────────────────────────────────────────
function makeClient(envKey, role) {
  const apiKey = process.env[envKey]
  if (!apiKey) {
    console.warn(`[AI] ${envKey} not set — ${role} calls will fail`)
    return null
  }
  return new Groq({ apiKey })
}

const CLIENTS = {
  analysis:  makeClient('GROQ_KEY_ANALYSIS',  'analysis'),
  questions: makeClient('GROQ_KEY_QUESTIONS', 'questions'),
  evaluator: makeClient('GROQ_KEY_EVALUATOR', 'evaluator'),
  scoring:   makeClient('GROQ_KEY_SCORING',   'scoring'),
}

const loaded = Object.entries(CLIENTS).filter(([, c]) => c).map(([r]) => r)
console.log(`[AI] Groq keys loaded for: ${loaded.join(', ')} — model: ${MODEL}`)

// ── Core call ─────────────────────────────────────────────────────────────────
// role: 'analysis' | 'questions' | 'evaluator' | 'scoring'
async function call(role, { system, user, maxTokens = 1000 }) {
  const client = CLIENTS[role]
  if (!client) throw new Error(`Groq client for role "${role}" not configured — set ${roleToEnvKey(role)} in .env`)

  const MAX_ATTEMPTS = 3
  let lastErr

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await client.chat.completions.create({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user   },
        ],
        temperature: role === 'scoring' ? 0.1 : role === 'evaluator' ? 0.2 : 0.75,
      })
      return res.choices[0].message.content
    } catch (err) {
      const isRateLimit = err?.status === 429 || err?.message?.includes('rate_limit') || err?.message?.includes('rate limit')
      if (isRateLimit) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000)
        console.warn(`[AI:${role}] Rate-limited (attempt ${attempt + 1}/${MAX_ATTEMPTS}), waiting ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
        lastErr = err
        continue
      }
      throw err
    }
  }

  throw lastErr || new Error(`Groq ${role} call failed after ${MAX_ATTEMPTS} attempts`)
}

function roleToEnvKey(role) {
  return ({ analysis: 'GROQ_KEY_ANALYSIS', questions: 'GROQ_KEY_QUESTIONS', evaluator: 'GROQ_KEY_EVALUATOR', scoring: 'GROQ_KEY_SCORING' })[role]
}

// ── Public API ────────────────────────────────────────────────────────────────

// Key 1 — GROQ_KEY_ANALYSIS
// Used for: repo context analysis, README summarisation, orchestration decisions
export async function analyzeContext(prompt, options = {}) {
  const { maxTokens = 1000, systemPrompt = 'You are an expert technical analyst.' } = options
  try {
    const text = await call('analysis', { system: systemPrompt, user: prompt, maxTokens })
    return { success: true, data: text }
  } catch (err) {
    console.error('[AI:analysis]', err.message)
    return { success: false, error: err.message }
  }
}

// Key 2 — GROQ_KEY_QUESTIONS
// Used for: generating viva questions from repo context
export async function generateQuestions(prompt, options = {}) {
  const { maxTokens = 1400, systemPrompt = 'You are VERITAS, an expert technical examiner. Return ONLY valid JSON.' } = options
  try {
    const text = await call('questions', { system: systemPrompt, user: prompt, maxTokens })
    return { success: true, data: text }
  } catch (err) {
    console.error('[AI:questions]', err.message)
    return { success: false, error: err.message }
  }
}

// Key 3 — GROQ_KEY_EVALUATOR
// Used for: deep answer analysis — authenticity, reasoning, red flags
export async function evaluateAnswer(prompt, options = {}) {
  const { maxTokens = 700, systemPrompt = 'You are a senior technical evaluator. Be fair — reward genuine effort. Return ONLY valid JSON.' } = options
  try {
    const text = await call('evaluator', { system: systemPrompt, user: prompt, maxTokens })
    return { success: true, data: text }
  } catch (err) {
    console.error('[AI:evaluator]', err.message)
    return { success: false, error: err.message }
  }
}

// Key 4 — GROQ_KEY_SCORING
// Used for: final score computation, tier assignment, report generation
export async function computeScores(prompt, options = {}) {
  const { maxTokens = 600, systemPrompt = 'You are a precise scoring engine. Return ONLY valid JSON with numeric scores.' } = options
  try {
    const text = await call('scoring', { system: systemPrompt, user: prompt, maxTokens })
    return { success: true, data: text }
  } catch (err) {
    console.error('[AI:scoring]', err.message)
    return { success: false, error: err.message }
  }
}

// ── generateCompletion — generic fallback (uses analysis key) ─────────────────
// Used by any legacy code that calls generateCompletion() directly.
// Exam routes now call the role-specific functions above.
export async function generateCompletion(prompt, options = {}) {
  const { maxTokens = 1500, systemPrompt = 'You are a helpful assistant.', role = 'analysis' } = options
  try {
    const text = await call(role, { system: systemPrompt, user: prompt, maxTokens })
    return { success: true, data: text }
  } catch (err) {
    console.error('[AI:generateCompletion]', err.message)
    return { success: false, error: err.message }
  }
}

// ── Legacy named exports (used by existing interview/recruiter routes) ─────────
export async function generateNextQuestion({ systemPrompt, userPrompt }) {
  const text = await call('questions', { system: systemPrompt, user: userPrompt, maxTokens: 500 })
  return { question: text, model: MODEL }
}

export async function generateReport({ systemPrompt, userPrompt }) {
  const text = await call('scoring', { system: systemPrompt, user: userPrompt, maxTokens: 2000 })
  return text
}

// ── Score parsing helpers (used by exam.js) ───────────────────────────────────
function clamp(n, fallback = 0) {
  const v = Number(n)
  return isNaN(v) ? fallback : Math.max(0, Math.min(100, Math.round(v)))
}

export function parseEvaluation(text) {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : cleaned)

    const auth  = clamp(parsed.authenticity_score  ?? 50)
    const depth = clamp(parsed.depth_score         ?? 50)
    const spec  = clamp(parsed.specificity_score   ?? 50)
    const comm  = clamp(parsed.communication_score ?? 50)
    const cons  = clamp(parsed.consistency_score   ?? 50)
    const composite = clamp(parsed.composite_score ??
      Math.round(auth * 0.45 + depth * 0.25 + spec * 0.15 + comm * 0.10 + cons * 0.05))
    const verdict = parsed.verdict ||
      (composite >= 60 ? 'pass' : composite >= 35 ? 'hold' : 'fail')

    return {
      authenticity_score:  auth,
      depth_score:         depth,
      specificity_score:   spec,
      communication_score: comm,
      consistency_score:   cons,
      composite_score:     composite,
      verdict,
      strength:         parsed.strength         || parsed.reasoning_strength || null,
      weakness:         parsed.weakness         || parsed.reasoning_weakness || null,
      follow_up_needed: parsed.follow_up_needed ?? false,
    }
  } catch {
    return {
      authenticity_score: 50, depth_score: 50, specificity_score: 50,
      communication_score: 50, consistency_score: 50, composite_score: 50,
      verdict: 'hold', strength: null, weakness: null, follow_up_needed: false,
    }
  }
}
