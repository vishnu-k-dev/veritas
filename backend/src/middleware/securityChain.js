// backend/src/middleware/securityChain.js
// Centralized security middleware chain for v3 endpoints.
// Apply to all AI-calling routes: verifyFirebaseToken → sanitise → budget → rate limit → log

import { supabaseAdmin } from '../lib/supabase.js'
import { redisClient } from '../lib/redis.js'

// ─── INJECTION PATTERNS ───────────────────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /you are now/i,
  /disregard.*system/i,
  /\beval\s*\(/,
  /require\s*\(\s*['"]child_process/,
  /process\.env/i,
  /<script/i,
  /system prompt/i,
  /jailbreak/i,
  /DAN mode/i,
  /pretend you are/i,
  /act as if/i,
]

// ─── INPUT SANITISATION ───────────────────────────────────────────────────────

function cleanValue(val) {
  if (typeof val !== 'string') return val
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(val)) return null // signals rejection
  }
  return val.slice(0, 5000)
}

/**
 * Sanitise all string values in req.body.
 * Rejects immediately on injection attempt, logs the event.
 */
export function sanitiseRequestBody(req, res, next) {
  const body = req.body || {}
  for (const [key, val] of Object.entries(body)) {
    if (typeof val === 'string') {
      const cleaned = cleanValue(val)
      if (cleaned === null) {
        logSecurityEvent(req, 'injection_attempt', `field=${key} preview=${val.slice(0, 50)}`)
        return res.status(400).json({ error: 'Invalid input detected' })
      }
      req.body[key] = cleaned
    }
  }
  next()
}

// ─── DSA CODE SAFETY ──────────────────────────────────────────────────────────

const DSA_DISALLOWED_PATTERNS = [
  /\bexec\b/,
  /\beval\b/,
  /child_process/,
  /os\.system/,
  /subprocess/,
  /Runtime\.getRuntime/,
  /ProcessBuilder/,
  /\bfetch\b/,
  /XMLHttpRequest/,
  /require\s*\(/,
  /import\s+/,
  /__import__/,
  /open\s*\(/,
  /file\s*\(/i,
  /socket\.connect/,
  /net\.createServer/,
  /dns\.lookup/,
]

/**
 * Reject DSA code submissions containing disallowed patterns.
 * NEVER pass rejected code to any AI model.
 */
export function rejectUnsafeDSACode(req, res, next) {
  const { code } = req.body || {}
  if (!code) return next()

  if (typeof code !== 'string' || code.length > 10240) {
    logSecurityEvent(req, 'dsa_size_limit', `length=${(code || '').length}`)
    return res.status(400).json({ error: 'Submission too large', pattern: 'size_limit' })
  }

  for (const pattern of DSA_DISALLOWED_PATTERNS) {
    if (pattern.test(code)) {
      logSecurityEvent(req, 'dsa_unsafe_code', `pattern=${pattern.toString()}`)
      return res.status(400).json({
        error: 'Submission contains disallowed patterns',
        pattern: pattern.toString(),
      })
    }
  }

  next()
}

// ─── AI BUDGET CHECK ──────────────────────────────────────────────────────────

const DAILY_BUDGET_INR = parseFloat(process.env.AI_DAILY_BUDGET_INR || '50')

/**
 * Check if the daily AI spend budget has been exceeded.
 * Reads from Redis spend counter set by spendGuard.js.
 */
export async function checkAIBudget(req, res, next) {
  try {
    const todayKey = `ai_spend:${new Date().toISOString().slice(0, 10)}`
    const spentRaw = await redisClient.get(todayKey)
    const spentInr = parseFloat(spentRaw || '0')
    if (spentInr >= DAILY_BUDGET_INR) {
      logSecurityEvent(req, 'budget_exceeded', `spent=${spentInr} budget=${DAILY_BUDGET_INR}`)
      return res.status(429).json({ error: 'Daily AI budget exceeded. Try again tomorrow.' })
    }
  } catch {
    // Budget check failure is non-blocking — prefer availability over strict enforcement
  }
  next()
}

// ─── RATE LIMITING ────────────────────────────────────────────────────────────

/**
 * Per-user rate limiting for AI-calling endpoints.
 * @param {number} maxRequests — per window
 * @param {number} windowSeconds
 */
export function rateLimitByUser(maxRequests = 20, windowSeconds = 60) {
  return async (req, res, next) => {
    const userId = req.user?.dbUser?.id || req.ip || 'anonymous'
    const key    = `rl:${userId}:${Math.floor(Date.now() / (windowSeconds * 1000))}`

    try {
      const count = await redisClient.incr(key)
      if (count === 1) await redisClient.expire(key, windowSeconds)
      if (count > maxRequests) {
        return res.status(429).json({ error: 'Too many requests. Please slow down.' })
      }
    } catch {
      // Rate limit failure is non-blocking
    }
    next()
  }
}

// ─── DEMO RATE LIMITING ───────────────────────────────────────────────────────

/**
 * Rate limit demo sessions: 3 per email per 24h.
 */
export async function rateLimitDemoByEmail(req, res, next) {
  const email = (req.body?.email || '').toLowerCase().trim()
  if (!email) return res.status(400).json({ error: 'Email required for demo access' })

  const key = `demo:${email}:${new Date().toISOString().slice(0, 10)}`
  try {
    const count = await redisClient.incr(key)
    if (count === 1) await redisClient.expire(key, 86400)
    if (count > 3) {
      return res.status(429).json({ error: 'Demo limit reached. Create an account to continue.' })
    }
  } catch {
    // Non-blocking
  }
  next()
}

// ─── HMAC WEBHOOK VERIFICATION ────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verify HMAC signature on CIM training webhook (timing-safe comparison).
 */
export function verifyCIMWebhook(req, res, next) {
  const signature = req.headers['x-cim-signature'] || ''
  const secret    = process.env.CIM_TRAINING_WEBHOOK_SECRET || ''
  if (!secret) {
    console.error('[SecurityChain] CIM_TRAINING_WEBHOOK_SECRET not set')
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  const expectedSig = `sha256=${createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex')}`

  let valid = false
  try {
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expectedSig)
    valid = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)
  } catch { valid = false }

  if (!valid) {
    logSecurityEvent(req, 'invalid_cim_webhook', 'signature mismatch')
    return res.status(401).json({ error: 'Invalid webhook signature' })
  }
  next()
}

// ─── SECURITY EVENT LOGGING ───────────────────────────────────────────────────

/**
 * Log a security event to Supabase security_events table.
 * Never throws — must not block the request chain.
 */
export function logSecurityEvent(req, type, detail) {
  // Log locally — Supabase security_events table not provisioned in this deployment
  console.warn('[security]', type, (detail || '').slice(0, 200), req.ip || '')
}

// ─── CONVENIENCE CHAIN BUILDER ────────────────────────────────────────────────

/**
 * Build the standard security middleware array for an AI-calling route.
 * @param {object} options
 * @returns {Function[]}
 */
export function buildSecurityChain({ maxRequests = 20, windowSeconds = 60 } = {}) {
  return [
    sanitiseRequestBody,
    checkAIBudget,
    rateLimitByUser(maxRequests, windowSeconds),
  ]
}

export default {
  sanitiseRequestBody,
  rejectUnsafeDSACode,
  checkAIBudget,
  rateLimitByUser,
  rateLimitDemoByEmail,
  verifyCIMWebhook,
  logSecurityEvent,
  buildSecurityChain,
}
