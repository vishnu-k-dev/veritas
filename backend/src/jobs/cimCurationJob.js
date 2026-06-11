// backend/src/jobs/cimCurationJob.js
// BullMQ job — triggered after every 50 completed interviews
// Curates training data from recent interviews and exports dataset for CIM fine-tuning
import { supabaseAdmin } from '../lib/supabase.js'

// ── Selection criteria ────────────────────────────────────────────────────────
//
// Only select interviews where:
//   - status = 'completed'
//   - score is unambiguous (not 45-55 "hold" range)
//   - at least 6 questions answered
//   - no fraud_flag violations
//   - answers are non-empty
//
const MIN_QUESTIONS    = 6
const AMBIGUOUS_LOW    = 45
const AMBIGUOUS_HIGH   = 55

// PII scrubbing patterns (regex)
const PII_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,    token: '[EMAIL]'    },
  { pattern: /\b(\+91|91)?[6-9]\d{9}\b/g,                                  token: '[PHONE]'    },
  { pattern: /https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_-]+/g,            token: '[GITHUB]'   },
  { pattern: /https?:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+/g,      token: '[LINKEDIN]' },
]

/**
 * Scrub PII from a text string.
 * @param {string} text
 * @returns {string} scrubbed text
 */
export function scrubPII(text) {
  if (!text || typeof text !== 'string') return text
  let scrubbed = text
  for (const { pattern, token } of PII_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, token)
  }
  return scrubbed
}

/**
 * Assert no PII remains — throws PII_DETECTED if found.
 * @param {string} text
 */
export function assertNoPII(text) {
  for (const { pattern } of PII_PATTERNS) {
    if (pattern.test(text)) {
      pattern.lastIndex = 0 // reset regex state
      throw new Error('PII_DETECTED')
    }
    pattern.lastIndex = 0
  }
}

/**
 * Grade a training example based on score + answer quality.
 * A = high signal (score > 75 or < 25, with depth indicators)
 * B = normal
 * C = ambiguous — excluded from training
 */
export function gradeTrainingExample(example) {
  const score = example.score || 0
  const answer = example.answer || ''

  const isAmbiguous = score >= AMBIGUOUS_LOW && score <= AMBIGUOUS_HIGH
  if (isAmbiguous) return 'C'

  const hasDepth = answer.length > 150 &&
    /because|therefore|we decided|tradeoff|bottleneck|latency|throughput|performance|scale/i.test(answer)

  if ((score > 75 || score < 25) && hasDepth) return 'A'
  return 'B'
}

/**
 * Validate a training example before it enters the pool.
 * Returns null if valid, or a rejection reason string.
 */
export function validateTrainingExample(example) {
  if (!example.question || !example.answer) return 'missing_fields'
  if (example.answer.trim().split(/\s+/).length < 5) return 'answer_too_short'
  if (example.answer.length > 5000) return 'answer_too_long'
  if (example.score == null) return 'missing_score'
  if (gradeTrainingExample(example) === 'C') return 'ambiguous_score'

  try {
    assertNoPII(example.question)
    assertNoPII(example.answer)
  } catch {
    return 'pii_detected'
  }

  return null // valid
}

/**
 * Export training data as JSONL (one JSON object per line).
 */
export function exportAsJSONL(examples) {
  return examples.map(e => JSON.stringify({
    system:    'You are an expert technical interviewer evaluating a candidate answer.',
    user:      e.question,
    assistant: e.answer,
    metadata:  { score: e.score, domain: e.domain_type, grade: e.grade },
  })).join('\n')
}

/**
 * Export training data in Alpaca format for HuggingFace fine-tuning.
 */
export function exportAsAlpaca(examples) {
  return JSON.stringify(examples.map(e => ({
    instruction: e.question,
    input:       '',
    output:      e.answer,
  })), null, 2)
}

/**
 * Compute CIM model independence score.
 * = (CIM calls / total AI calls) × 100 over the last 30 days
 */
export async function computeModelIndependenceScore() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('routing_logs')
    .select('model_used')
    .gte('created_at', since)

  if (error || !data || data.length === 0) return 0

  const cimCalls = data.filter(r => r.model_used === 'cim').length
  return Math.round((cimCalls / data.length) * 100)
}

/**
 * Main curation job — called by BullMQ after every 50 completed interviews.
 * @param {object} job — BullMQ job object
 */
export async function curateTrainingData(job) {
  const { since, limit = 200 } = job?.data || {}

  const sinceDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  console.log(`[CIM curation] Starting — since ${sinceDate}`)

  // Fetch completed interviews with their Q&A pairs
  const { data: interviews, error } = await supabaseAdmin
    .from('interviews')
    .select('id, trust_score, authenticity_score, fraud_flag, interview_messages(role, content)')
    .eq('status', 'completed')
    .eq('fraud_flag', false)
    .gte('completed_at', sinceDate)
    .not('trust_score', 'is', null)
    .limit(limit)

  if (error) {
    console.error('[CIM curation] Fetch error:', error)
    throw error
  }

  if (!interviews || interviews.length === 0) {
    console.log('[CIM curation] No interviews to curate')
    return { processed: 0, stored: 0 }
  }

  let processed = 0
  let stored    = 0
  let rejected  = 0

  for (const interview of interviews) {
    const sysMsg = interview.interview_messages?.find(m => m.role === 'system')
    if (!sysMsg) continue

    let qaPairs
    try { qaPairs = JSON.parse(sysMsg.content)?.qaPairs } catch { continue }
    if (!Array.isArray(qaPairs) || qaPairs.length < MIN_QUESTIONS) continue

    for (const pair of qaPairs) {
      processed++

      const raw = {
        question:    scrubPII(pair.question || pair.text || ''),
        answer:      scrubPII(pair.answer || ''),
        score:       pair.authenticityScore || pair.score || interview.trust_score || 0,
        domain_type: pair.domain || null,
      }

      const reason = validateTrainingExample(raw)
      if (reason) {
        rejected++
        continue
      }

      const grade = gradeTrainingExample(raw)
      const example = { ...raw, grade, interview_id: interview.id }

      // Store to cim_training_examples
      const { error: insertErr } = await supabaseAdmin
        .from('cim_training_examples')
        .insert({
          question:     example.question,
          answer:       example.answer,
          score:        example.score,
          grade,
          domain_type:  example.domain_type,
          interview_id: example.interview_id,
          status:       grade === 'A' ? 'approved' : 'pending',
          pii_scrubbed: true,
        })
        .select('id')
        .single()

      if (!insertErr) stored++
    }
  }

  console.log(`[CIM curation] Done — processed: ${processed}, stored: ${stored}, rejected: ${rejected}`)

  // Trigger training run if enough A-grade examples have accumulated
  const { count } = await supabaseAdmin
    .from('cim_training_examples')
    .select('id', { count: 'exact' })
    .eq('status', 'approved')
    .eq('grade', 'A')

  if ((count || 0) >= 1000) {
    console.log(`[CIM curation] ${count} A-grade examples — triggering training run`)
    await triggerTrainingRun(count)
  }

  return { processed, stored, rejected }
}

/**
 * Trigger a CIM training run via Modal.com webhook.
 */
async function triggerTrainingRun(exampleCount) {
  const webhookUrl = process.env.MODAL_TRAINING_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[CIM curation] No MODAL_TRAINING_WEBHOOK_URL configured — skipping training trigger')
    return
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exampleCount,
        baseModel: 'phi-3-mini-4k-instruct',
        callbackUrl: `${process.env.BACKEND_URL}/api/internal/cim-trained`,
        callbackSecret: process.env.CIM_WEBHOOK_SECRET,
      }),
    })
    if (res.ok) {
      console.log('[CIM curation] Training run triggered successfully')
    } else {
      console.warn('[CIM curation] Training trigger failed:', res.status)
    }
  } catch (err) {
    console.error('[CIM curation] Training trigger error:', err.message)
  }
}

export default curateTrainingData
