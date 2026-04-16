import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Okta connections', () => {
  test.beforeEach(async ({ devApi }) => {
    await devApi.resetData()
  })

  test('shows connect CTA', async ({ page }) => {
    await page.goto('/connections')
    await expect(page.getByTestId(S.connections.oktaButton)).toBeVisible()
  })

  test('opens dialog with form inputs', async ({ page }) => {
    await page.goto('/connections')
    await page.getByTestId(S.connections.oktaButton).click()

    // Dialog should appear with orgUrl and apiToken fields
    await expect(page.getByTestId(S.connections.oktaOrgUrl)).toBeVisible()
    await expect(page.getByTestId(S.connections.oktaApiToken)).toBeVisible()
    await expect(page.getByTestId(S.connections.oktaSubmit)).toBeVisible()
  })

  test('validates Okta org URL format', async ({ page }) => {
    await page.goto('/connections')
    await page.getByTestId(S.connections.oktaButton).click()

    await page.getByTestId(S.connections.oktaOrgUrl).fill('invalid-url')
    await page.getByTestId(S.connections.oktaApiToken).fill('00testtoken')
    await page.getByTestId(S.connections.oktaSubmit).click()

    // Should show error for invalid URL
    const error = page.locator('[data-sonner-toast]').or(page.getByTestId(S.auth.errorMessage))
    await expect(error).toBeVisible({ timeout: 5_000 })
  })

  test('shows connection card after simulation', async ({ devApi, page }) => {
    await devApi.simulateOkta({ totalUsers: 45, inactiveRatio: 0.2 })
    await page.goto('/connections')

    const card = page.getByTestId(S.connections.connectionCard).filter({
      hasText: /okta/i,
    })
    await expect(card).toBeVisible()
  })
})
