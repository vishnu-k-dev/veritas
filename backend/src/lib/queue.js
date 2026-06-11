// backend/src/lib/queue.js
// BullMQ job queues — only initialized when Redis is available
import { redisClient } from './redis.js'

let interviewQueue = null
let reportQueue = null
let mlQueue = null
let cimQueue = null

const HAS_REDIS = !!process.env.UPSTASH_REDIS_URL

if (HAS_REDIS) {
  try {
    const { Queue } = await import('bullmq')
    const connection = redisClient

    interviewQueue = new Queue('interview', { connection })
    reportQueue    = new Queue('report', { connection })
    mlQueue        = new Queue('ml-pipeline', { connection })
    cimQueue       = new Queue('cim-training', { connection })
    console.log('   BullMQ: queues initialized ✓')
  } catch (err) {
    console.warn('⚠️  BullMQ: failed to initialize queues:', err.message)
    console.warn('   Queues disabled — jobs will run in sync mode')
    // Reset to null so routes fall back to sync mode
    interviewQueue = null
    reportQueue = null
    mlQueue = null
  }
} else {
  console.log('   BullMQ: disabled (no Redis URL)')
}

// Queue options — retry with exponential backoff
export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 7 * 24 * 3600 },
  removeOnFail: { age: 7 * 24 * 3600 }
}

export { interviewQueue, reportQueue, mlQueue, cimQueue }
