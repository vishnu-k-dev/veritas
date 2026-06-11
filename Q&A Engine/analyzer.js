// ============================================================
// VERITAS RAG — Answer Analyzer (v2: Cost-Optimized)
// ─────────────────────────────────────────────────────────────
// v1: GPT-4o per answer → ~₹1.80/interview
// v2: Rule-based live + GPT-4o-mini batch → ~₹0.08/interview
//
//   1. cheapFollowupDecision() — zero AI cost during interview
//   2. If follow-up needed: retrieve from RAG (vector search, no LLM)
//   3. batchEvaluate() — ONE API call after interview ends
//   4. Env-gated: B2B_MODE=true → GPT-4o for paid reports
// ============================================================

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { retrieveFollowups, embed } from './retriever.js'

// Lazy init — don't crash at import time if keys are missing
let _openai = null
let _supabase = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}
function getSupabase() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '')
  return _supabase
}

// Maximum follow-ups before forcing next question
const MAX_FOLLOWUPS_PER_QUESTION = 2

// Environment-controlled quality tier
const EVAL_MODEL = process.env.NODE_ENV === 'production' && process.env.B2B_MODE === 'true'
  ? 'gpt-4o'        // B2B reports — full quality
  : 'gpt-4o-mini'   // free tier — good enough

// ── Main analyzer (LIVE — called per answer during interview) ──
export async function analyzeAnswer({
  question,
  answer,
  context,        // candidate context (from fingerprint or resume)
  questionType,   // 'implementation' | 'decision' etc
  difficulty,
  followupCount = 0,
  questionId = null,
}) {

  // Step 1: CHEAP follow-up decision (ZERO AI cost)
  const followupDecision = cheapFollowupDecision(answer, difficulty, followupCount)

  // Step 2: If follow-up needed, retrieve from RAG (vector search only, no LLM)
  let followupQuestion = null
  if (followupDecision.needed) {
    const followups = await retrieveFollowups({
      question,
      answer,
      triggerType: followupDecision.triggerType,
      context,
      count: 3,
    })

    // Pick best match, then personalize it
    const template = followups[0]?.question || getFallbackFollowup(followupDecision.triggerType)
    followupQuestion = await personalizeFollowup(template, question, answer, context)
  }

  // Step 3: Log raw answer (scoring happens later via batchEvaluate)
  await logRawAnswer({
    questionId, question, answer,
    followupDecision, followupQuestion, context,
  })

  return {
    // No individual scores during live interview — saves ₹1.80
    scores: null,
    verdict: null,
    reasoning: null,

    // Follow-up decision (rule-based, free)
    followup: {
      needed:      followupDecision.needed,
      triggerType: followupDecision.triggerType,
      reason:      followupDecision.reason,
      question:    followupQuestion,
    },

    // What to do next
    action: followupDecision.needed ? 'followup' : 'next_question',
  }
}

// ── BATCH EVALUATE — called ONCE after interview ends ──────
// Scores all 8 Q&A pairs in one API call
// Cost: ~₹0.08 (1× GPT-4o-mini) vs ~₹1.80 (8× GPT-4o)
export async function batchEvaluate({ allQAPairs, context, interviewId }) {
  if (!allQAPairs?.length) return []

  const contextStr = buildContextString(context)

  const pairs = allQAPairs.map((qa, i) =>
    `Q${i + 1} [${qa.difficulty}]: ${qa.question}\nA${i + 1}: ${qa.answer}`
  ).join('\n\n')

  const prompt = `You are evaluating ${allQAPairs.length} interview Q&A pairs for VERITAS skill verification.

=== CANDIDATE CONTEXT ===
${contextStr}

=== Q&A PAIRS ===
${pairs}

Evaluate each answer strictly. A genuine answer will have:
- Specific details (file names, function names, exact values)
- Real decisions with reasoning
- Natural imperfections

A fake or padded answer will have:
- Generic descriptions that apply to any project
- Textbook explanations without personal context
- Overly polished prose

Return ONLY a valid JSON array of ${allQAPairs.length} objects:
[{ "q": 1, "authenticity": 0-100, "depth": 0-100,
   "clarity": 0-100, "overall": 0-100,
   "verdict": "strong" | "acceptable" | "weak" | "suspicious",
   "reasoning": "one sentence",
   "strengths": ["specific strength"],
   "redFlags": ["specific concern"] or []
}]`

  const res = await getOpenAI().chat.completions.create({
    model:       EVAL_MODEL,
    max_tokens:  1200,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SCORER_SYSTEM },
      { role: 'user',   content: prompt },
    ]
  })

  const raw = res.choices[0].message.content.replace(/```json|```/g, '').trim()
  let evaluations

  try {
    evaluations = JSON.parse(raw)
  } catch {
    // Fallback: return neutral scores
    evaluations = allQAPairs.map((_, i) => ({
      q: i + 1, authenticity: 50, depth: 50, clarity: 50, overall: 50,
      verdict: 'acceptable', reasoning: 'Evaluation parse error',
      strengths: [], redFlags: [],
    }))
  }

  // Log evaluations to DB
  for (let i = 0; i < evaluations.length; i++) {
    const ev = evaluations[i]
    const qa = allQAPairs[i]
    try {
      const answerEmbedding = await embed(qa.answer)
      await getSupabase().from('rag_answer_log').insert({
        interview_id:        interviewId,
        question_id:         qa.questionId || null,
        question_text:       qa.question,
        answer_text:         qa.answer.slice(0, 2000),
        answer_embedding:    answerEmbedding,
        authenticity:        ev.authenticity,
        depth:               ev.depth,
        clarity:             ev.clarity,
        overall:             ev.overall,
        verdict:             ev.verdict,
        follow_up_needed:    qa.followupTriggered || false,
        follow_up_reason:    qa.followupReason || null,
        follow_up_question:  qa.followupQuestion || null,
        tech_tags:           context.techStack || [],
      })

      // Update question stats
      if (qa.questionId) {
        await getSupabase().rpc('update_question_stats', {
          p_question_id: qa.questionId,
          p_score:       ev.overall,
        })
      }
    } catch (err) {
      console.error('Batch log failed (non-fatal):', err.message)
    }
  }

  return evaluations
}

// ── CHEAP follow-up decision (ZERO AI cost) ───────────────
// Replaces the per-answer GPT-4o call during the interview
function cheapFollowupDecision(answer, difficulty, followupCount) {
  // Hard cap
  if (followupCount >= MAX_FOLLOWUPS_PER_QUESTION) {
    return { needed: false, reason: 'Max follow-ups reached' }
  }

  if (!answer?.trim()) {
    return { needed: true, triggerType: 'vague', reason: 'No meaningful answer provided' }
  }

  const words   = answer.trim().split(/\s+/).length
  const hasSpec = /\d|file|function|line|error|bug|class|method|config|env|import|module|route|endpoint|database|query|api|hook|component|state/i.test(answer)
  const hasWhy  = /because|since|so\s+that|in\s+order|chose|decided|trade-?off|alternative/i.test(answer)

  // Rule 1: Very short answer — always follow up
  if (words < 10) {
    return { needed: true, triggerType: 'vague', reason: 'Answer too short to evaluate' }
  }

  // Rule 2: Short answer at hard difficulty — needs more
  if (words < 25 && ['deep', 'pressure'].includes(difficulty)) {
    return { needed: true, triggerType: 'shallow', reason: 'Answer lacks depth for this difficulty level' }
  }

  // Rule 3: No specifics at medium+ difficulty
  if (!hasSpec && difficulty !== 'warm_up') {
    return { needed: true, triggerType: 'vague', reason: 'Missing specific details (file names, function names, values)' }
  }

  // Rule 4: No reasoning at deep+ difficulty
  if (!hasWhy && ['deep', 'pressure'].includes(difficulty) && followupCount === 0) {
    return { needed: true, triggerType: 'shallow', reason: 'Missing reasoning — why this approach?' }
  }

  // Rule 5: Strong + deep → probe further (once)
  if (words > 60 && hasSpec && hasWhy && ['deep', 'pressure'].includes(difficulty) && followupCount === 0) {
    return { needed: true, triggerType: 'strong', reason: 'Strong answer — probe for even deeper knowledge' }
  }

  return { needed: false, reason: 'Answer sufficient — proceed to next question' }
}

// ── Personalize a follow-up template (cheap: gpt-4o-mini) ─
async function personalizeFollowup(template, question, answer, context) {
  const hasContext = context.repoName || context.currentRole
  if (!hasContext) return template

  const prompt = `Rewrite this follow-up question to reference the candidate's specific context.
Keep it short (1-2 sentences). Keep the same intent.

Original question: "${template}"
Previous question: "${question}"
Their answer: "${answer.slice(0, 200)}"
Context: ${context.repoName ? `Project: ${context.repoName}` : `Role: ${context.currentRole}`}

Rewritten question (1-2 sentences only):`

  const res = await getOpenAI().chat.completions.create({
    model:       'gpt-4o-mini',   // cheap — just rephrasing
    max_tokens:  100,
    temperature: 0.5,
    messages:    [{ role: 'user', content: prompt }]
  })

  return res.choices[0].message.content.trim()
}

// ── Log raw answer (no scoring yet — that happens in batch) ─
async function logRawAnswer({ questionId, question, answer,
                              followupDecision, followupQuestion, context }) {
  try {
    // Just log the answer + follow-up decision. Scores come later from batchEvaluate.
    const answerEmbedding = await embed(answer)
    await getSupabase().from('rag_answer_log').insert({
      question_id:         questionId,
      question_text:       question,
      answer_text:         answer.slice(0, 2000),
      answer_embedding:    answerEmbedding,
      follow_up_needed:    followupDecision.needed,
      follow_up_reason:    followupDecision.reason,
      follow_up_question:  followupQuestion,
      tech_tags:           context.techStack || [],
    })
  } catch (err) {
    console.error('Log raw answer failed (non-fatal):', err.message)
  }
}

// ── Helpers ───────────────────────────────────────────────
function buildContextString(context) {
  if (context.source === 'github') {
    return [
      `Project: ${context.repoName}`,
      `Architecture: ${context.architecture}`,
      `Tech: ${(context.techStack || []).join(', ')}`,
      `Auth signals: ${(context.authenticitySignals || []).join(', ')}`,
    ].join('\n')
  }
  return [
    `Role: ${context.currentRole}`,
    `Experience: ${context.totalExperience}`,
    `Skills: ${[
      ...(context.skills?.languages || []),
      ...(context.skills?.frameworks || []),
    ].join(', ')}`,
    `Key claims: ${(context.biggestClaims || []).join(', ')}`,
  ].join('\n')
}

function getFallbackFollowup(triggerType) {
  const fallbacks = {
    vague:      "Can you be more specific? Give me a concrete example.",
    shallow:    "Go deeper — what's actually happening under the hood?",
    suspicious: "Walk me through exactly which parts you wrote yourself.",
    strong:     "Impressive. Where would that solution break at scale?",
    partial:    "You covered part of it — what about error handling?",
    confused:   "Let me rephrase — in simple terms, what does that piece of code do?",
  }
  return fallbacks[triggerType] || "Can you elaborate on that?"
}

const SCORER_SYSTEM = `You are a sceptical senior engineer evaluating technical interview answers.
Your job is to detect whether someone genuinely built and understands their work.
Be rigorous. Vague answers fail. Specific answers pass.
Never give full marks for generic descriptions.`

