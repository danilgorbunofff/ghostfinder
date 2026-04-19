import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('GoCardless connections', () => {
  test.beforeEach(async ({ devApi }) => {
    await devApi.resetData()
  })

  test('shows connect EU bank button', async ({ page }) => {
    await page.goto('/connections')
    await expect(page.getByTestId(S.connections.goCardlessButton)).toBeVisible()
  })

  test('country selector shows institutions', async ({ page }) => {
    await page.goto('/connections')
    await page.getByTestId(S.connections.goCardlessButton).click()

    // Dialog should open with country selector
    await expect(page.getByText('Connect EU Bank Account')).toBeVisible()
    await expect(page.getByText('Select your country')).toBeVisible()
  })

  test('shows connection card after simulation', async ({ devApi, page }) => {
    await devApi.simulateGoCardless({
      institutionName: 'Revolut',
      country: 'GB',
      status: 'active',
    })
    await page.goto('/connections')

    const card = page.getByTestId(S.connections.connectionCard).filter({
      hasText: 'Revolut',
    })
    await expect(card).toBeVisible()
    // Should show EU badge
    await expect(card.getByText('EU')).toBeVisible()
  })
})
