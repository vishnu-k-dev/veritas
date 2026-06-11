// backend/src/routes/ai.js
// AI proxy routes — keeps API keys server-side
import { Router } from 'express'
import { createHash } from 'crypto'
import { generateCompletion } from '../services/ai/index.js'
import { perUserLimit } from '../middleware/rateLimiter.js'
import { redisClient } from '../lib/redis.js'

const router = Router()

// ── Response cache helpers ─────────────────────────────────────────────────
// Cache AI responses by prompt fingerprint so identical or near-identical
// requests (e.g. two students submitting the same repo) hit Redis, not Anthropic.
// TTL: 6h — covers a full workshop session.
const CACHE_TTL_SECONDS = 6 * 60 * 60

function promptFingerprint(prompt, systemPrompt = '', userId = '') {
  // Include userId so two different students NEVER share a cached response.
  // Normalise whitespace so minor formatting differences don't bust the cache.
  const normalised = `${userId}|${systemPrompt.slice(0, 200)}|${prompt.slice(0, 2000)}`.replace(/\s+/g, ' ').trim()
  return 'ai:cache:' + createHash('sha256').update(normalised).digest('hex').slice(0, 24)
}

async function getCached(key) {
  try { return await redisClient.get(key) } catch { return null }
}

async function setCached(key, value) {
  try { await redisClient.setex(key, CACHE_TTL_SECONDS, value) } catch { /* non-critical */ }
}

// GET /api/ai/status — check AI availability
router.get('/status', (req, res) => {
  const key1 = !!process.env.ANTHROPIC_API_KEY
  const key2 = !!process.env.ANTHROPIC_API_KEY_2
  res.json({
    available: key1,
    model: 'claude-haiku-4-5',
    keys: key1 && key2 ? 2 : key1 ? 1 : 0
  })
})

// POST /api/ai/generate — general purpose completion
router.post('/generate', perUserLimit, async (req, res) => {
  const { prompt, options } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' })

  // Cache repo-question and resume-parse calls — these are the heavy, repeatable ones.
  // Short conversational prompts (< 200 chars) skip caching intentionally.
  // Include userId in the fingerprint so two different users never share a cache entry.
  const userId = req.user?.dbUser?.id || req.user?.uid || ''
  const isCacheable = prompt.length > 200 && options?.maxTokens >= 500
  const cacheKey = isCacheable ? promptFingerprint(prompt, options?.systemPrompt, userId) : null

  if (cacheKey) {
    const cached = await getCached(cacheKey)
    if (cached) {
      return res.json({ success: true, data: cached, fromCache: true })
    }
  }

  const result = await generateCompletion(prompt, options || {})
  if (!result.success) return res.status(503).json({ error: result.error })

  if (cacheKey && result.data) {
    setCached(cacheKey, result.data) // async, don't await
  }

  res.json(result)
})

// POST /api/ai/parse-resume — parse resume with AI
router.post('/parse-resume', perUserLimit, async (req, res) => {
  const { resumeText, jobDescription } = req.body
  if (!resumeText) return res.status(400).json({ error: 'Resume text is required' })

  const prompt = `Analyze this resume for a ${jobDescription?.title || 'software'} role.

Resume:
${resumeText.slice(0, 3000)}

Required Skills: ${(jobDescription?.requiredSkills || []).join(', ') || 'General software skills'}

Return a JSON object with:
{
  "skills": ["skill1", "skill2"],
  "experience_years": number,
  "strengths": ["strength1"],
  "gaps": ["gap1"],
  "suggestedQuestions": ["question1", "question2"]
}`

  const result = await generateCompletion(prompt, {
    systemPrompt: 'You are an expert technical recruiter. Return valid JSON only.',
    temperature: 0.3,
    maxTokens: 1000
  })

  if (!result.success) return res.status(503).json(result)

  try {
    const cleaned = result.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    res.json({ success: true, data: JSON.parse(cleaned) })
  } catch {
    res.json({ success: true, data: result.data })
  }
})

// POST /api/ai/repo-questions — generate repo-specific questions
router.post('/repo-questions', perUserLimit, async (req, res) => {
  const { prompt } = req.body
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' })

  // Cache by prompt fingerprint — same repo submitted by two students = one Anthropic call.
  // Repo question prompts are repo-specific (not user-specific), so sharing the cache here
  // is intentional and correct — two students with the same repo get the same questions.
  const cacheKey = promptFingerprint(prompt, 'repo-questions')
  const cached = await getCached(cacheKey)
  if (cached) {
    try {
      return res.json({ success: true, data: JSON.parse(cached), fromCache: true })
    } catch { /* fall through to generate */ }
  }

  const result = await generateCompletion(prompt, {
    systemPrompt: 'You are an expert technical interviewer. Generate unique, project-specific questions.',
    temperature: 0.9,
    maxTokens: 1500
  })

  if (!result.success) return res.status(503).json(result)

  try {
    const lines = result.data.split('\n').filter(l => l.trim())
    const questions = []
    for (const line of lines) {
      const match = line.match(/^\d+\.\s*\[([^\]]+)\]\s*(.+)$/)
      if (match) {
        questions.push({
          category: match[1].toLowerCase().replace(/\s+/g, '_'),
          text: match[2].trim(),
          difficulty: 'medium'
        })
      }
    }
    const payload = questions.length > 0 ? questions : result.data
    // Cache the parsed result so identical repo prompts skip Anthropic entirely
    setCached(cacheKey, JSON.stringify(payload))
    res.json({ success: true, data: payload })
  } catch {
    res.json({ success: true, data: result.data })
  }
})

// POST /api/ai/report — generate hiring report
router.post('/report', perUserLimit, async (req, res) => {
  const { interviewData, resumeData, jobDescription } = req.body

  const prompt = `Generate a brief hiring report for a ${jobDescription?.title || 'software'} candidate.

Interview Q&A:
${(interviewData?.questions || []).map((q, i) => `Q: ${q}\nA: ${interviewData.answers?.[i] || 'No answer'}`).join('\n\n')}

Return a JSON object: { "summary": "...", "strengths": [...], "concerns": [...], "recommendation": "pass|hold|fail" }`

  const result = await generateCompletion(prompt, {
    systemPrompt: 'You are an expert hiring analyst. Return valid JSON only.',
    temperature: 0.3,
    maxTokens: 1000
  })

  if (!result.success) return res.status(503).json(result)

  try {
    const cleaned = result.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    res.json({ success: true, data: JSON.parse(cleaned) })
  } catch {
    res.json({ success: true, data: result.data })
  }
})

// POST /api/ai/embed — text embedding via Gemini text-embedding-004
// Used by ragService and CIMEvaluator
router.post('/embed', perUserLimit, async (req, res) => {
  try {
    const { text } = req.body
    if (!text) return res.status(400).json({ error: 'text required' })

    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) return res.status(503).json({ error: 'Embedding service not configured' })

    const truncated = text.slice(0, 8000)

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: truncated }] },
        }),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}))
      console.error('[Embed] Gemini error:', err)
      return res.status(503).json({ error: 'Embedding failed' })
    }

    const result = await geminiRes.json()
    const embedding = result?.embedding?.values

    if (!embedding?.length) {
      return res.status(503).json({ error: 'Empty embedding returned' })
    }

    // Cache key for repeated embeddings (SHA-256 of text)
    const cacheKey = createHash('sha256').update(truncated).digest('hex').slice(0, 16)

    return res.json({ embedding, dimensions: embedding.length, cacheKey })
  } catch (err) {
    console.error('[Embed] Error:', err)
    return res.status(500).json({ error: 'Embedding service failed' })
  }
})

export default router
