import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('GoCardless connections', () => {
  // GoCardless integration is not yet implemented — placeholder specs
  test.skip(true, 'GoCardless integration pending')

  test('shows connect CTA', async ({ page }) => {
    await page.goto('/connections')
    await expect(page.getByText(/gocardless/i)).toBeVisible()
  })

  test('connect button initiates flow', async ({ page }) => {
    await page.goto('/connections')
    // Implementation pending
  })
})
