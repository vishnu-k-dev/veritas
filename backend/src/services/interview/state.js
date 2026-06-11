// backend/src/services/interview/state.js
// Redis-backed interview session state
import { redisClient } from '../../lib/redis.js'

const SESSION_TTL = 2 * 60 * 60  // 2 hours

export async function saveInterviewState(interviewId, state) {
  await redisClient.setex(
    `interview:state:${interviewId}`,
    SESSION_TTL,
    JSON.stringify(state)
  )
}

export async function getInterviewState(interviewId) {
  const data = await redisClient.get(`interview:state:${interviewId}`)
  return data ? JSON.parse(data) : null
}

export async function clearInterviewState(interviewId) {
  await redisClient.del(`interview:state:${interviewId}`)
}

// State structure stored per interview:
// {
//   questionsAsked: 4,
//   performanceSignals: [70, 65, 80, 72],
//   currentDifficulty: 'medium',
//   violationCount: 0,
//   fingerprintId: 'uuid-of-project-fingerprint'
// }
