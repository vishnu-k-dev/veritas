// backend/src/workers/report.worker.js
// BullMQ worker for generating post-interview reports
import { Worker } from 'bullmq'
import { redisClient } from '../lib/redis.js'
import { checkAIBudget } from '../services/spendGuard.js'
import { safeGenerateReport } from '../services/ai/breaker.js'
import { supabaseAdmin } from '../lib/supabase.js'

const worker = new Worker('report', async (job) => {
  const { interviewId, userId, payload } = job.data

  await checkAIBudget(userId)

  const report = await safeGenerateReport.fire(payload)

  if (!report.fallback) {
    // Idempotency guard: only update if still in 'completed' status
    // If this job retries, a second run won't overwrite an already-written report
    const { count } = await supabaseAdmin
      .from('interviews')
      .update({
        report_text: typeof report === 'string' ? report : JSON.stringify(report),
        status: 'report_ready',
      })
      .eq('id', interviewId)
      .eq('status', 'completed')
      .select('id', { count: 'exact' })

    if (!count) {
      console.warn(`[Report worker] Skipped overwrite for interview ${interviewId} — status was not 'completed'`)
    }
  }

  return { status: report.fallback ? 'fallback' : 'ok' }

}, {
  connection: redisClient,
  concurrency: 20   // Reports fire at end of interview, burst of 100 near-simultaneous
})

worker.on('failed', (job, err) => {
  console.error(`❌ Report job ${job?.id} failed:`, err.message)
})

worker.on('completed', (job) => {
  console.log(`✅ Report job ${job.id} completed`)
})

export default worker
