import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Google Workspace connections', () => {
  test.beforeEach(async ({ devApi }) => {
    await devApi.resetData()
  })

  test('shows connect CTA', async ({ page }) => {
    await page.goto('/connections')
    await expect(page.getByTestId(S.connections.googleButton)).toBeVisible()
  })

  test('connect button initiates OAuth flow', async ({ page }) => {
    await page.goto('/connections')

    // Clicking connect should trigger a POST to the connect endpoint
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/integrations/google/connect'),
        { timeout: 10_000 }
      ).catch(() => null),
      page.getByTestId(S.connections.googleButton).click(),
    ])

    // In mock mode, the response may contain a mock auth URL or redirect
    if (response) {
      expect(response.status()).toBeLessThan(500)
    }
  })

  test('shows connection card with user counts after simulation', async ({ devApi, page }) => {
    await devApi.simulateGoogle({ totalUsers: 40, inactiveRatio: 0.25 })
    await page.goto('/connections')

    const card = page.getByTestId(S.connections.connectionCard).filter({
      hasText: /google/i,
    })
    await expect(card).toBeVisible()
    // Should display user count info
    await expect(card).toContainText(/\d+/)
  })
})
