// backend/src/routes/github.js
// GitHub OAuth + API proxy routes
import { Router } from 'express'

const router = Router()

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || ''
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || ''

// GET /api/github/auth-url — get OAuth URL
router.get('/auth-url', (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: 'GitHub OAuth not configured. Set GITHUB_CLIENT_ID env variable.' })
  }
  const state = Math.random().toString(36).substring(2)
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=read:user,repo&state=${state}`
  res.json({ url, state })
})

// POST /api/github/callback — exchange code for token
router.post('/callback', async (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'Authorization code required' })
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' })
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
      })
    })
    const data = await response.json()
    if (data.error) return res.status(400).json({ error: data.error_description || data.error })
    res.json({ access_token: data.access_token, token_type: data.token_type, scope: data.scope })
  } catch (err) {
    console.error('GitHub OAuth error:', err)
    res.status(500).json({ error: 'Failed to exchange code for token' })
  }
})

// GET /api/github/repos — fetch user repos
router.get('/repos', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'GitHub access token required' })

  try {
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50&type=owner', {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    })
    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({ error: err.message || 'Failed to fetch repos' })
    }
    const repos = await response.json()
    res.json(repos.map(r => ({
      id: r.id, name: r.name, full_name: r.full_name, description: r.description,
      language: r.language, stargazers_count: r.stargazers_count, forks_count: r.forks_count,
      updated_at: r.updated_at, html_url: r.html_url, private: r.private,
      default_branch: r.default_branch
    })))
  } catch (err) {
    console.error('GitHub repos error:', err)
    res.status(500).json({ error: 'Failed to fetch repositories' })
  }
})

// GET /api/github/user — fetch user profile
router.get('/user', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'GitHub access token required' })

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    })
    if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch user' })
    const user = await response.json()
    res.json({ login: user.login, name: user.name, avatar_url: user.avatar_url })
  } catch (err) {
    console.error('GitHub user error:', err)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

export default router
