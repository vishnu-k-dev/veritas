// backend/app.js
import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { randomUUID } from 'crypto'
import { globalLimit } from './src/middleware/rateLimiter.js'

// ── Route imports ─────────────────────────────────────────────────────────────
import examRoutes from './src/routes/exam.js'

// Optional routes — only imported if their files are present
let aiRoutes, authRoutes, githubRoutes, verifyRoutes, interviewRoutes
try { aiRoutes       = (await import('./src/routes/ai.js')).default }       catch { /* skip */ }
try { authRoutes     = (await import('./src/routes/auth.js')).default }     catch { /* skip */ }
try { githubRoutes   = (await import('./src/routes/github.js')).default }   catch { /* skip */ }
try { verifyRoutes   = (await import('./src/routes/verify.js')).default }   catch { /* skip */ }
try { interviewRoutes = (await import('./src/routes/interview.js')).default } catch { /* skip */ }

const app = express()
const IS_PROD = process.env.NODE_ENV === 'production'

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, hsts: IS_PROD }))

// ── CORS ──────────────────────────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174'
const ALLOWED = [
  'http://localhost:5173', 'http://localhost:5174',
  'http://localhost:4173', FRONTEND_URL,
  ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',').filter(Boolean),
]

app.use(cors({
  origin: (origin, cb) => (!origin || ALLOWED.includes(origin) ? cb(null, true) : cb(new Error('CORS_BLOCKED'))),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.options('*', cors())

// ── Body + request ID ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))
app.use((req, _res, next) => { req.id = randomUUID(); next() })

// ── Rate limit ────────────────────────────────────────────────────────────────
app.use('/api/', globalLimit)

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/ping', (_req, res) => res.json({ ok: true, ts: Date.now() }))

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/exam', examRoutes)               // Public — no auth required

if (aiRoutes)        app.use('/api/ai',        aiRoutes)
if (authRoutes)      app.use('/api/auth',      authRoutes)
if (githubRoutes)    app.use('/api/github',    githubRoutes)
if (verifyRoutes)    app.use('/api/verify',    verifyRoutes)
if (interviewRoutes) app.use('/api/interview', interviewRoutes)

// ── 404 + error handlers ─────────────────────────────────────────────────────
app.use('/api/*', (req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` }))
app.use((err, req, res, _next) => {
  if (err.message === 'CORS_BLOCKED') return res.status(403).json({ error: 'Access denied' })
  console.error(`[${req.id}]`, err.message)
  res.status(500).json({ error: IS_PROD ? 'Internal server error' : err.message })
})

export default app
