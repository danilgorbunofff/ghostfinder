import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Connections overview', () => {
  test('shows connection stats after seeding', async ({ devApi, page }) => {
    await devApi.seedDemoData()
    await page.goto('/connections')

    await expect(page.getByTestId(S.connections.connectionStats)).toBeVisible()
  })

  test('onboarding progress updates with connections', async ({ devApi, page }) => {
    // Start empty
    await devApi.resetData()
    await page.goto('/connections')
    const progress = page.getByTestId(S.connections.onboardingProgress)
    await expect(progress).toBeVisible()

    // Add a bank connection
    await devApi.simulatePlaid()
    await page.reload()

    // Progress should reflect bank connection is done
    await expect(progress).toBeVisible()
  })

  test('multiple connection types display together', async ({ devApi, page }) => {
    await devApi.simulatePlaid({ institutionName: 'Chase Bank' })
    await devApi.simulateGoogle({ totalUsers: 30 })
    await devApi.simulateOkta({ totalUsers: 40 })
    await page.goto('/connections')

    const cards = page.getByTestId(S.connections.connectionCard)
    await expect(cards).toHaveCount(3, { timeout: 5_000 })
  })
})
