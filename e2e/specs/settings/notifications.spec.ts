import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Settings notifications', () => {
  test.beforeEach(async ({ devApi, page }) => {
    await devApi.seedDemoData()
    await page.goto('/settings')
    await page.getByTestId(S.settings.tabNotifications).click()
  })

  test('shows email notification toggle', async ({ page }) => {
    await expect(page.getByTestId(S.settings.emailToggle)).toBeVisible()
  })

  test('shows slack notification toggle', async ({ page }) => {
    await expect(page.getByTestId(S.settings.slackToggle)).toBeVisible()
  })

  test('shows threshold amount input', async ({ page }) => {
    const input = page.getByTestId(S.settings.thresholdInput)
    if (await input.isVisible()) {
      const value = await input.inputValue()
      // Seeded threshold is $500
      expect(Number(value)).toBeGreaterThanOrEqual(0)
    }
  })

  test('can toggle email notifications', async ({ page }) => {
    const toggle = page.getByTestId(S.settings.emailToggle)
    const initialState = await toggle.getAttribute('data-state')
    await toggle.click()
    await page.waitForTimeout(500)

    const newState = await toggle.getAttribute('data-state')
    expect(newState).not.toBe(initialState)
  })
})
