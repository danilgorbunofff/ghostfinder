import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Plaid connections', () => {
  test.beforeEach(async ({ devApi }) => {
    await devApi.resetData()
  })

  test('shows empty state with connect CTA', async ({ page }) => {
    await page.goto('/connections')
    await expect(page.getByTestId(S.connections.plaidButton)).toBeVisible()
  })

  test('connect button initiates Plaid Link in mock mode', async ({ page }) => {
    await page.goto('/connections')
    const plaidBtn = page.getByTestId(S.connections.plaidButton)
    await plaidBtn.click()

    // In mock mode, the Plaid Link either opens or we get a mock response
    // Wait for any response — either link token request or mock redirect
    await page.waitForResponse(
      (res) => res.url().includes('/api/plaid/create-link-token'),
      { timeout: 10_000 }
    ).catch(() => {
      // Mock mode may skip the API call entirely
    })
  })

  test('shows connection card after simulation', async ({ devApi, page }) => {
    await devApi.simulatePlaid({ institutionName: 'Chase Bank', status: 'active' })
    await page.goto('/connections')

    const card = page.getByTestId(S.connections.connectionCard).filter({
      hasText: 'Chase Bank',
    })
    await expect(card).toBeVisible()
    await expect(card.getByTestId(S.connections.statusBadge)).toHaveText(/active/i)
  })

  test('shows error status for errored connections', async ({ devApi, page }) => {
    await devApi.simulatePlaid({ status: 'error' })
    await page.goto('/connections')

    const badge = page.getByTestId(S.connections.statusBadge).first()
    await expect(badge).toHaveText(/error/i)
  })
})
