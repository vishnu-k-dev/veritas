// backend/src/services/ai/breaker.js
// Circuit breakers on all AI calls via opossum
import CircuitBreaker from 'opossum'
import { generateNextQuestion, evaluateAnswer, generateReport } from './index.js'

const breakerOptions = {
  timeout: 15000,                    // 15s — AI calls should be fast
  errorThresholdPercentage: 50,      // open if 50% of calls fail
  resetTimeout: 30000,               // try half-open after 30s
  volumeThreshold: 5                 // need 5 calls before tripping
}

function makeBreaker(fn, name) {
  const breaker = new CircuitBreaker(fn, breakerOptions)

  breaker.fallback((params) => ({
    fallback: true,
    message: `${name} temporarily unavailable`,
    question: getGenericFallbackQuestion(params)
  }))

  breaker.on('open',     () => console.warn(`[Circuit] ${name} OPEN — falling back`))
  breaker.on('halfOpen', () => console.info(`[Circuit] ${name} testing recovery...`))
  breaker.on('close',    () => console.info(`[Circuit] ${name} CLOSED (recovered)`))

  return breaker
}

export const safeGenQuestion     = makeBreaker(generateNextQuestion, 'QuestionGen')
export const safeEvaluateAnswer  = makeBreaker(evaluateAnswer,       'Evaluation')
export const safeGenerateReport  = makeBreaker(generateReport,       'ReportGen')

function getGenericFallbackQuestion() {
  const fallbacks = [
    'Can you walk me through the overall architecture of your project?',
    'What was the most challenging technical problem you solved in this project?',
    'How did you handle error cases in your implementation?',
    'Tell me about a specific decision you made in this project and why.',
    'What would you do differently if you built this project again?',
  ]
  return fallbacks[Math.floor(Math.random() * fallbacks.length)]
}
