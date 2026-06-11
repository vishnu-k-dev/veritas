import { test, expect } from '@playwright/test'

test.describe('Landing page', () => {
  test('loads and shows the VERITAS wordmark', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.wordmark').first()).toBeVisible()
  })

  test('/exam route renders the intake form', async ({ page }) => {
    await page.goto('/exam')
    await expect(page.getByPlaceholder('Arjun Sharma')).toBeVisible()
    await expect(page.getByPlaceholder('https://github.com/you/your-project')).toBeVisible()
    await expect(page.getByRole('button', { name: /begin examination/i })).toBeVisible()
  })

  test('intake form requires a name', async ({ page }) => {
    await page.goto('/exam')
    await page.getByPlaceholder('https://github.com/you/your-project').fill('https://github.com/test/repo')
    await page.getByRole('button', { name: /begin examination/i }).click()
    await expect(page.locator('.ef-err')).toBeVisible()
  })

  test('intake form requires a repo URL', async ({ page }) => {
    await page.goto('/exam')
    await page.getByPlaceholder('Arjun Sharma').fill('Test User')
    await page.getByRole('button', { name: /begin examination/i }).click()
    await expect(page.locator('.ef-err')).toBeVisible()
  })
})
