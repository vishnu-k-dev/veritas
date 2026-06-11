import { test, expect } from '@playwright/test'

// ── Shared mock payloads ──────────────────────────────────────────────────────

const MOCK_REPO = {
  name: 'url-shortener', full_name: 'test/url-shortener', private: false,
  description: 'A URL shortener built with Node.js and Redis',
  default_branch: 'main', stargazers_count: 12, language: 'JavaScript',
}

const MOCK_COMMITS = [
  { sha: 'abc1234', commit: { message: 'feat: add Redis caching layer', author: { name: 'Test User', date: '2024-01-01' }, committer: { name: 'Test User' } } },
  { sha: 'def5678', commit: { message: 'fix: handle expired links gracefully', author: { name: 'Test User', date: '2024-01-02' }, committer: { name: 'Test User' } } },
]

const MOCK_LANGUAGES = { JavaScript: 15000, CSS: 2000 }

const MOCK_TREE = {
  tree: [
    { path: 'src/index.js', type: 'blob' },
    { path: 'src/routes.js', type: 'blob' },
    { path: 'package.json', type: 'blob' },
    { path: 'README.md', type: 'blob' },
  ]
}

const MOCK_README = {
  content: btoa('# URL Shortener\nA fast URL shortener using Redis for caching and Node.js for the API.'),
  encoding: 'base64',
}

const MOCK_PKG = {
  content: btoa(JSON.stringify({
    name: 'url-shortener',
    dependencies: { express: '^4.18.0', redis: '^4.0.0' },
    devDependencies: {},
  })),
  encoding: 'base64',
}

const MOCK_QUESTIONS = {
  questions: [
    { id: 1, question: 'Walk me through why you chose Redis for caching in this project.', area: 'architecture', evidence: 'Redis dependency in package.json' },
    { id: 2, question: 'In commit def5678 you handled expired links. What edge cases did you find?', area: 'debugging', evidence: 'Commit: fix: handle expired links gracefully' },
  ],
  sessionId: 'exam_test_session_001',
}

const MOCK_EVAL = {
  authenticity_score: 72, depth_score: 68, specificity_score: 65,
  communication_score: 78, consistency_score: 100,
  composite_score: 71, verdict: 'pass',
  strength: 'Referenced specific implementation details.', weakness: null,
  follow_up_needed: false, rag: false,
  aiDetection: { suspicionScore: 5, signals: [], verdict: 'clean' },
}

const MOCK_REPORT = {
  verificationId: 'VRT-2026-TESTABCD',
  candidateName: 'Test Candidate',
  repoName: 'url-shortener',
  repoUrl: 'https://github.com/test/url-shortener',
  techStack: ['express', 'redis'],
  issuedAt: new Date().toISOString(),
  scores: {
    authenticity: { score: 72, tier: 'Proficient' },
    ownership:    { score: 65, tier: 'Developing'  },
    competency:   { score: 68, tier: 'Developing'  },
    overall: 70,
  },
  verdict: 'VERIFIED',
  ragEnabled: false,
  integrityFlags: { tabSwitches: 0, pasteAttempts: 0, copyAttempts: 0, suspiciousTyping: 0, aiDetections: [] },
  shareUrl: 'http://localhost:5173/verify/VRT-2026-TESTABCD',
}

// ── Test setup: mock all external network calls ───────────────────────────────

async function mockAllAPIs(page) {
  // GitHub REST API (called directly from the browser)
  await page.route('**/api.github.com/repos/**', async route => {
    const url = route.request().url()
    if (url.includes('/commits'))         return route.fulfill({ json: MOCK_COMMITS })
    if (url.includes('/languages'))       return route.fulfill({ json: MOCK_LANGUAGES })
    if (url.includes('/git/trees'))       return route.fulfill({ json: MOCK_TREE })
    if (url.includes('/readme'))          return route.fulfill({ json: MOCK_README })
    if (url.includes('/contents/package.json')) return route.fulfill({ json: MOCK_PKG })
    if (url.includes('/contents/'))       return route.fulfill({ status: 404, json: { message: 'Not Found' } })
    return route.fulfill({ json: MOCK_REPO })
  })

  // Backend exam API
  await page.route('**/api/exam/questions', route =>
    route.fulfill({ json: MOCK_QUESTIONS }))
  await page.route('**/api/exam/evaluate', route =>
    route.fulfill({ json: MOCK_EVAL }))
  await page.route('**/api/exam/report', route =>
    route.fulfill({ json: MOCK_REPORT }))

  // Backend health / warmup ping (don't block it)
  await page.route('**/api/ping', route => route.fulfill({ json: { ok: true } }))
  await page.route('**/api/health', route => route.fulfill({ json: { ok: true } }))
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Exam flow — golden path', () => {
  test('intake → blueprint → viva → certificate', async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/exam')

    // ── INTAKE ────────────────────────────────────────────────────────────────
    await page.getByPlaceholder('Arjun Sharma').fill('Test Candidate')
    await page.getByPlaceholder('https://github.com/you/your-project').fill('https://github.com/test/url-shortener')
    await page.getByRole('button', { name: /begin examination/i }).click()

    // ── BLUEPRINT ─────────────────────────────────────────────────────────────
    await expect(page.locator('.ef-blueprint')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Repository analysed')).toBeVisible()
    // Questions preview shows both questions
    await expect(page.locator('.ef-q-preview-row')).toHaveCount(2)
    await page.getByRole('button', { name: /begin examination/i }).click()

    // ── VIVA — Question 1 ─────────────────────────────────────────────────────
    await expect(page.locator('.ef-viva')).toBeVisible()
    await expect(page.locator('text=Q1')).toBeVisible()
    // Answer textarea is present and accepts input
    const textarea = page.locator('.ef-answer-area')
    await expect(textarea).toBeVisible()
    await textarea.fill('I chose Redis because it provides sub-millisecond latency for caching short URL lookups. We stored each short code as a key with a 24-hour TTL to handle link expiry automatically. The alternative was a PostgreSQL query on every redirect, which at 100 req/s would have caused significant DB load.')
    await page.getByRole('button', { name: /submit answer/i }).click()

    // Evaluation recorded banner appears
    await expect(page.locator('text=Answer recorded')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /next question/i }).click()

    // ── VIVA — Question 2 ─────────────────────────────────────────────────────
    await expect(page.locator('text=Q2')).toBeVisible()
    await page.locator('.ef-answer-area').fill('When a link expired I found that the redirect was returning a 200 with an empty body rather than a 404. The bug was in routes.js line 42 — I forgot to check if the Redis GET returned null before calling res.redirect.')
    await page.getByRole('button', { name: /submit answer/i }).click()
    await expect(page.locator('text=Answer recorded')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /view examination report/i }).click()

    // ── CERTIFICATE ───────────────────────────────────────────────────────────
    await expect(page.locator('.ef-cert-card')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.v-val')).toContainText('VRT-2026-TESTABCD')
    await expect(page.locator('.ef-cert-verdict')).toBeVisible()
    await expect(page.locator('.ef-cert-name')).toContainText('Test Candidate')
    // AI detection section is present
    await expect(page.locator('text=AI Usage Analysis')).toBeVisible()
    await expect(page.locator('text=No AI-generated response patterns')).toBeVisible()
  })

  test('blueprint shows question count correctly', async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/exam')
    await page.getByPlaceholder('Arjun Sharma').fill('Test')
    await page.getByPlaceholder('https://github.com/you/your-project').fill('https://github.com/test/url-shortener')
    await page.getByRole('button', { name: /begin examination/i }).click()
    await expect(page.locator('.ef-blueprint')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /examination plan/i })).toBeVisible()
  })

  test('proctoring bar is visible during viva', async ({ page }) => {
    await mockAllAPIs(page)
    await page.goto('/exam')
    await page.getByPlaceholder('Arjun Sharma').fill('Test')
    await page.getByPlaceholder('https://github.com/you/your-project').fill('https://github.com/test/url-shortener')
    await page.getByRole('button', { name: /begin examination/i }).click()
    await expect(page.locator('.ef-blueprint')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /begin examination/i }).click()
    await expect(page.locator('.ef-proctor-bar')).toBeVisible()
    await expect(page.locator('text=Proctored examination')).toBeVisible()
  })
})

test.describe('AI cheating detection', () => {
  test('flags an answer with ChatGPT opener phrase', async ({ page }) => {
    // Override evaluate to return a flagged aiDetection
    await page.route('**/api.github.com/repos/**', async route => {
      const url = route.request().url()
      if (url.includes('/commits'))   return route.fulfill({ json: MOCK_COMMITS })
      if (url.includes('/languages')) return route.fulfill({ json: MOCK_LANGUAGES })
      if (url.includes('/git/trees')) return route.fulfill({ json: MOCK_TREE })
      if (url.includes('/readme'))    return route.fulfill({ json: MOCK_README })
      if (url.includes('/contents/package.json')) return route.fulfill({ json: MOCK_PKG })
      if (url.includes('/contents/')) return route.fulfill({ status: 404, json: { message: 'Not Found' } })
      return route.fulfill({ json: MOCK_REPO })
    })
    await page.route('**/api/exam/questions', route => route.fulfill({ json: MOCK_QUESTIONS }))
    await page.route('**/api/exam/report', route => route.fulfill({ json: {
      ...MOCK_REPORT,
      integrityFlags: { tabSwitches: 0, pasteAttempts: 0, copyAttempts: 0, suspiciousTyping: 0,
        aiDetections: [{ q: 1, verdict: 'flagged', suspicionScore: 65, signals: ['ai_opener_phrase', 'ai_closer_phrase'] }] },
    }}))
    await page.route('**/api/exam/evaluate', route => route.fulfill({
      json: { ...MOCK_EVAL, aiDetection: { suspicionScore: 65, signals: ['ai_opener_phrase', 'ai_closer_phrase'], verdict: 'flagged' } },
    }))
    await page.route('**/api/ping', route => route.fulfill({ json: { ok: true } }))
    await page.route('**/api/health', route => route.fulfill({ json: { ok: true } }))

    await page.goto('/exam')
    await page.getByPlaceholder('Arjun Sharma').fill('Test')
    await page.getByPlaceholder('https://github.com/you/your-project').fill('https://github.com/test/url-shortener')
    await page.getByRole('button', { name: /begin examination/i }).click()
    await expect(page.locator('.ef-blueprint')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /begin examination/i }).click()

    await page.locator('.ef-answer-area').fill('Certainly! Great question. I would like to explain that Redis leverages best practices for scalable solutions.')
    await page.getByRole('button', { name: /submit answer/i }).click()
    await expect(page.locator('text=Answer recorded')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /next question/i }).click()

    await page.locator('.ef-answer-area').fill('To summarize, this robust solution ensures seamless integration with best practices.')
    await page.getByRole('button', { name: /submit answer/i }).click()
    await expect(page.locator('text=Answer recorded')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /view examination report/i }).click()

    await expect(page.locator('.ef-cert-card')).toBeVisible({ timeout: 10_000 })
    // Flagged detection shown in AI Usage Analysis section
    await expect(page.locator('text=Flagged').first()).toBeVisible()
    await expect(page.locator('text=ai opener phrase').first()).toBeVisible()
  })
})
