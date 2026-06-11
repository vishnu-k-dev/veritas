// backend/src/workers/interview.worker.js
// BullMQ worker for interview question generation and answer evaluation
import { Worker } from 'bullmq'
import { redisClient } from '../lib/redis.js'
import { checkAIBudget } from '../services/spendGuard.js'
import { safeGenQuestion, safeEvaluateAnswer } from '../services/ai/breaker.js'
import { supabaseAdmin } from '../lib/supabase.js'
import { generateFollowUp } from '../services/followUpEngine.js'

const worker = new Worker('interview', async (job) => {
  const { interviewId, userId, type, payload } = job.data

  // AI spend guard — check BEFORE making any AI call
  await checkAIBudget(userId)

  if (type === 'generate_question') {
    const result = await safeGenQuestion.fire(payload)
    if (result.fallback) {
      // Circuit open — use cached fallback question
      await supabaseAdmin.from('interview_messages').insert({
        interview_id: interviewId,
        role: 'assistant',
        content: result.question,
        is_fallback: true
      })
      return { status: 'fallback', question: result.question }
    }
    await supabaseAdmin.from('interview_messages').insert({
      interview_id: interviewId,
      role: 'assistant',
      content: result.question
    })
    return { status: 'ok', question: result.question }
  }

  if (type === 'evaluate_answer') {
    const evaluation = await safeEvaluateAnswer.fire(payload)
    if (!evaluation.fallback) {
      // Store composite score as the canonical authenticity_score for backward compat
      await supabaseAdmin.from('interview_messages').update({
        authenticity_score: evaluation.composite_score ?? evaluation.authenticity_score,
        eval_verdict: evaluation.verdict,
        eval_reasoning: JSON.stringify(evaluation)
      }).eq('id', payload.messageId)

      // Follow-up engine: probe weak answers before advancing (max 1 per question)
      if (evaluation.follow_up_needed && !payload.isFollowUp) {
        try {
          const followUp = await generateFollowUp({
            originalQuestion: payload.currentQuestion || '',
            candidateAnswer:  payload.answer,
            evaluation,
            projectContext:   payload.projectContext || ''
          })
          if (followUp) {
            await supabaseAdmin.from('interview_messages').insert({
              interview_id: interviewId,
              role:         'assistant',
              content:      followUp,
              is_follow_up: true
            })
          }
        } catch (err) {
          console.warn('[FollowUp] Generation failed (non-critical):', err.message)
        }
      }
    }
    return { status: evaluation.fallback ? 'fallback' : 'ok', evaluation }
  }

}, {
  connection: redisClient,
  concurrency: 50,
  // Anthropic org rate limit is 50 RPM. 48 leaves a 2-job safety margin while
  // giving significantly more throughput during workshop bursts vs the old 40 cap.
  limiter: { max: 48, duration: 60_000 },
})

worker.on('failed', (job, err) => {
  console.error(`❌ Interview job ${job?.id} failed:`, err.message)
})

worker.on('completed', (job) => {
  console.log(`✅ Interview job ${job.id} completed`)
})

export default worker
