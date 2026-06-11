// backend/src/jobs/ragFeedbackJob.js
// BullMQ job — stores RAG quality signals post-interview for re-ranking improvement
// Triggered after each completed interview that used RAG augmentation
import { supabaseAdmin } from '../lib/supabase.js'

/**
 * Process RAG feedback signals from a completed interview.
 * Updates cim_signal_strength in rag_questions based on answer quality.
 *
 * @param {object} job — BullMQ job with data:
 *   { interviewId, ragQuestionIds, qaPairs, evaluations }
 */
export async function storeRAGFeedback(job) {
  const { interviewId, ragQuestionIds = [], qaPairs = [], evaluations = [] } = job?.data || {}

  if (!interviewId || ragQuestionIds.length === 0) {
    console.log('[RAG feedback] No RAG question IDs — skipping')
    return { processed: 0 }
  }

  console.log(`[RAG feedback] Processing ${ragQuestionIds.length} RAG signals for interview ${interviewId}`)

  let processed = 0

  for (let i = 0; i < ragQuestionIds.length; i++) {
    const questionId    = ragQuestionIds[i]
    const qaPair        = qaPairs[i]
    const evaluation    = evaluations[i]

    const answerQuality = evaluation?.authenticityScore || evaluation?.score || 0
    const wasHighSignal = answerQuality >= 70

    try {
      // Insert feedback record
      await supabaseAdmin
        .from('rag_feedback')
        .insert({
          question_id:     questionId,
          interview_id:    interviewId,
          answer_quality:  answerQuality,
          was_high_signal: wasHighSignal,
          recorded_at:     new Date().toISOString(),
        })

      // Update cim_signal_strength in rag_questions via exponential moving average
      // new_strength = old_strength * 0.7 + quality_signal * 0.3
      const qualitySignal = wasHighSignal ? 1.0 : (answerQuality / 100)

      await supabaseAdmin.rpc('update_rag_signal_strength', {
        p_question_id:    questionId,
        p_quality_signal: qualitySignal,
        p_alpha:          0.3,
      }).catch(err => {
        // RPC may not exist yet — update directly as fallback
        return updateSignalStrengthDirect(questionId, qualitySignal)
      })

      processed++
    } catch (err) {
      console.warn(`[RAG feedback] Failed for question ${questionId}:`, err?.message)
    }
  }

  console.log(`[RAG feedback] Done — ${processed}/${ragQuestionIds.length} signals stored`)
  return { processed }
}

/**
 * Direct update fallback if the RPC function doesn't exist.
 */
async function updateSignalStrengthDirect(questionId, qualitySignal) {
  const { data: existing } = await supabaseAdmin
    .from('rag_questions')
    .select('cim_signal_strength')
    .eq('id', questionId)
    .maybeSingle()

  if (!existing) return

  const oldStrength = existing.cim_signal_strength || 0.5
  const newStrength = Math.min(1.0, Math.max(0.0, oldStrength * 0.7 + qualitySignal * 0.3))

  await supabaseAdmin
    .from('rag_questions')
    .update({ cim_signal_strength: newStrength, updated_at: new Date().toISOString() })
    .eq('id', questionId)
}

/**
 * Schedule a RAG feedback job in BullMQ after interview completion.
 * Call this from the interview finish handler.
 *
 * @param {object} queue — BullMQ Queue instance
 * @param {object} payload — { interviewId, ragQuestionIds, qaPairs, evaluations }
 */
export async function scheduleRAGFeedback(queue, payload) {
  if (!queue) {
    console.warn('[RAG feedback] Queue not available — processing inline')
    return storeRAGFeedback({ data: payload })
  }

  return queue.add('rag_feedback', payload, {
    delay:    5000,  // 5s after interview completes
    attempts: 3,
    backoff:  { type: 'exponential', delay: 10000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  })
}

export default storeRAGFeedback
