import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from '../../helpers/assertions'

test.describe('Smoke tests', () => {
  test('GET /api/health returns 200', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/health`)
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  const pages = [
    { path: '/', name: 'Dashboard' },
    { path: '/connections', name: 'Connections' },
    { path: '/inventory', name: 'Inventory' },
    { path: '/reports', name: 'Reports' },
    { path: '/billing', name: 'Billing' },
    { path: '/settings', name: 'Settings' },
  ]

  for (const { path, name } of pages) {
    test(`${name} page (${path}) loads without errors`, async ({ page }) => {
      const errors = collectConsoleErrors(page)

      await page.goto(path)
      await page.waitForLoadState('networkidle')

      // Page should render main content area
      await expect(page.locator('main')).toBeVisible()

      // No critical console errors (ignore minor warnings)
      const criticalErrors = errors.filter(
        (e) =>
          !e.includes('Warning:') &&
          !e.includes('DevTools') &&
          !e.includes('favicon')
      )
      expect(criticalErrors).toHaveLength(0)
    })
  }

  test('404 page returns appropriate status for unknown routes', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/nonexistent-route-xyz`)
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('unauthenticated access redirects to login', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    await page.goto('/')

    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await context.close()
  })
})
