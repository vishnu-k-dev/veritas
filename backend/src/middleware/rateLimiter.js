// backend/src/middleware/rateLimiter.js
// 5-layer Redis-backed rate limiting (falls back to memory if Redis unavailable)
import rateLimit from 'express-rate-limit'

// Only use Redis store if Redis is configured
let makeStore
if (process.env.UPSTASH_REDIS_URL) {
  const { default: RedisStore } = await import('rate-limit-redis')
  const { redisClient } = await import('../lib/redis.js')

  makeStore = (prefix) => new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: `rl:${prefix}:`,
    passOnStoreError: true   // Don't block requests if Redis is temporarily down
  })
} else {
  makeStore = () => undefined // use express-rate-limit's default MemoryStore
}

// Layer 1: Global — high ceiling since many users share one IP (university WiFi etc.)
// Real enforcement happens at per-user layer (keyed by Firebase UID)
export const globalLimit = rateLimit({
  windowMs: 15 * 60 * 1000,        // 15 minutes
  max: 2000,                        // 2000/15min per IP — handles 100 users on same WiFi
  store: makeStore('global'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in 15 minutes.' }
})

// Layer 2: Per authenticated user — primary enforcement
export const perUserLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,                         // 100/15min — covers active interview session
  store: makeStore('user'),
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: { error: 'User rate limit exceeded.' }
})

// Layer 3: Interview start — prevents free-tier abuse
export const interviewStartLimit = rateLimit({
  windowMs: 60 * 60 * 1000,        // 1 hour
  max: 3,
  store: makeStore('interview-start'),
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: { error: 'Maximum 3 interview starts per hour.' }
})

// Layer 4: Answer submission — prevents rapid-fire spam
export const answerLimit = rateLimit({
  windowMs: 3 * 1000,              // 3 seconds
  max: 1,
  store: makeStore('answer'),
  keyGenerator: (req) => req.body?.interviewId || req.user?.uid || req.ip,
  message: { error: 'Please wait before submitting another answer.' }
})

// Layer 5: Auth endpoints — brute force protection
export const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  store: makeStore('auth'),
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' }
})
