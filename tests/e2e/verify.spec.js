import { test, expect } from '@playwright/test'

const MOCK_REPORT = {
  verificationId: 'VRT-2026-ABCD1234',
  candidateName: 'Priya Mehta',
  repoName: 'distributed-cache',
  repoUrl: 'https://github.com/priya/distributed-cache',
  techStack: ['Go', 'Redis', 'Docker'],
  issuedAt: '2026-06-11T10:00:00.000Z',
  scores: {
    authenticity: { score: 84, tier: 'Proficient' },
    ownership:    { score: 79, tier: 'Proficient' },
    competency:   { score: 88, tier: 'Distinguished' },
    overall: 83,
  },
  verdict: 'VERIFIED',
  ragEnabled: true,
  integrityFlags: {
    tabSwitches: 0, pasteAttempts: 0, copyAttempts: 0, suspiciousTyping: 0,
    aiDetections: [],
  },
  shareUrl: 'http://localhost:5173/verify/VRT-2026-ABCD1234',
}

test.describe('/verify/:id — public certificate page', () => {
  test('renders a valid certificate', async ({ page }) => {
    await page.route('**/api/exam/report/VRT-2026-ABCD1234', route =>
      route.fulfill({ json: MOCK_REPORT }))

    await page.goto('/verify/VRT-2026-ABCD1234')

    await expect(page.locator('.vr-card')).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('.vr-card-name')).toContainText('Priya Mehta')
    await expect(page.locator('.vr-card-repo')).toContainText('distributed-cache')
    await expect(page.locator('.vv')).toContainText('VRT-2026-ABCD1234')
    await expect(page.locator('.vr-verdict')).toBeVisible()
    // Three score cells
    await expect(page.locator('.vr-score')).toHaveCount(3)
    // Authenticity score
    await expect(page.locator('text=84')).toBeVisible()
  })

  test('shows clean AI integrity badge when no flags present', async ({ page }) => {
    await page.route('**/api/exam/report/VRT-2026-ABCD1234', route =>
      route.fulfill({ json: MOCK_REPORT }))

    await page.goto('/verify/VRT-2026-ABCD1234')
    await expect(page.locator('.vr-card')).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('text=AI Usage: Clean')).toBeVisible()
  })

  test('shows integrity flags when AI usage was detected', async ({ page }) => {
    const flaggedReport = {
      ...MOCK_REPORT,
      integrityFlags: {
        tabSwitches: 1, pasteAttempts: 2, copyAttempts: 0, suspiciousTyping: 0,
        aiDetections: [{ q: 1, verdict: 'flagged', suspicionScore: 70, signals: ['ai_opener_phrase'] }],
      },
    }
    await page.route('**/api/exam/report/VRT-2026-ABCD1234', route =>
      route.fulfill({ json: flaggedReport }))

    await page.goto('/verify/VRT-2026-ABCD1234')
    await expect(page.locator('.vr-card')).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('text=Integrity flags present')).toBeVisible()
    await expect(page.locator('text=paste attempt')).toBeVisible()
  })

  test('shows 404 state for unknown ID', async ({ page }) => {
    await page.route('**/api/exam/report/VRT-UNKNOWN', route =>
      route.fulfill({ status: 404, json: { error: 'Report not found' } }))

    await page.goto('/verify/VRT-UNKNOWN')
    await expect(page.locator('text=Report not found')).toBeVisible({ timeout: 8_000 })
    await expect(page.locator('text=VRT-UNKNOWN')).toBeVisible()
  })

  test('copy share link button works', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.route('**/api/exam/report/VRT-2026-ABCD1234', route =>
      route.fulfill({ json: MOCK_REPORT }))

    await page.goto('/verify/VRT-2026-ABCD1234')
    await expect(page.locator('.vr-card')).toBeVisible({ timeout: 8_000 })
    await page.getByRole('button', { name: /copy share link/i }).click()
    await expect(page.getByRole('button', { name: /copied/i })).toBeVisible()
  })
})
