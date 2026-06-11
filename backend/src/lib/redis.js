// backend/src/lib/redis.js
// Redis client via ioredis — connects to Upstash with TLS
import Redis from 'ioredis'

// Clean up Redis URL — strip any accidentally pasted CLI flags like "--tls -u"
let redisUrl = process.env.UPSTASH_REDIS_URL || ''
if (redisUrl) {
  // Extract just the redis:// or rediss:// URL if CLI flags were pasted
  const match = redisUrl.match(/(rediss?:\/\/.+)/)
  if (match) {
    redisUrl = match[1].trim()
  } else {
    console.warn('⚠️  UPSTASH_REDIS_URL does not contain a valid redis:// URL, disabling Redis')
    redisUrl = ''
  }
}

let redisClient

if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null, // Required by BullMQ — callers must handle errors themselves
      commandTimeout: 3000,       // 3s per command — prevents auth from hanging on Redis stall
      retryStrategy: (times) => {
        if (times > 5) {
          console.warn('⚠️  Redis: giving up after 5 retries')
          return null
        }
        return Math.min(times * 300, 3000)
      },
      connectTimeout: 5000,       // 5s to establish connection
      enableOfflineQueue: true    // Queue commands during reconnect (commandTimeout caps the wait)
    })

    redisClient.on('error', (err) => console.error('Redis error:', err.message))
    redisClient.on('connect', () => console.log('   Redis: connected ✓'))
  } catch (err) {
    console.error('Redis init failed:', err.message)
    redisUrl = '' // Fall through to stub
  }
}

if (!redisUrl) {
  if (!process.env.UPSTASH_REDIS_URL) {
    console.warn('⚠️  UPSTASH_REDIS_URL not set — Redis features disabled, using in-memory fallback')
  }

  // In-memory stub for development without Redis
  const store = new Map()
  redisClient = {
    get: async (key) => store.get(key) || null,
    set: async (key, value) => { store.set(key, value); return 'OK' },
    setex: async (key, _ttl, value) => { store.set(key, value); return 'OK' },
    del: async (key) => { store.delete(key); return 1 },
    call: async (...args) => null,
    on: () => {},
    status: 'ready',
    duplicate: () => redisClient
  }
}

export { redisClient }
