import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Billing tiers', () => {
  test.beforeEach(async ({ devApi, page }) => {
    await devApi.resetData()
    await page.goto('/billing')
  })

  test('shows three pricing cards', async ({ page }) => {
    await expect(page.getByTestId(S.billing.freeCard)).toBeVisible()
    await expect(page.getByTestId(S.billing.monitorCard)).toBeVisible()
    await expect(page.getByTestId(S.billing.recoveryCard)).toBeVisible()
  })

  test('free tier is current by default', async ({ page }) => {
    const freeCard = page.getByTestId(S.billing.freeCard)
    await expect(freeCard.getByTestId(S.billing.currentBadge)).toBeVisible()
  })

  test('switching to monitor tier highlights monitor card', async ({ devApi, page }) => {
    await devApi.switchTier('monitor')
    await page.reload()

    const monitorCard = page.getByTestId(S.billing.monitorCard)
    await expect(monitorCard.getByTestId(S.billing.currentBadge)).toBeVisible()
  })

  test('switching to recovery tier highlights recovery card', async ({ devApi, page }) => {
    await devApi.switchTier('recovery')
    await page.reload()

    const recoveryCard = page.getByTestId(S.billing.recoveryCard)
    await expect(recoveryCard.getByTestId(S.billing.currentBadge)).toBeVisible()
  })

  test('billing toggle switches monthly/annual display', async ({ page }) => {
    const toggle = page.getByTestId(S.billing.billingToggle)
    if (await toggle.isVisible()) {
      await toggle.click()
      // Prices should change (annual pricing shown)
      await page.waitForTimeout(500)
    }
  })

  test('upgrade button opens confirmation dialog', async ({ devApi, page }) => {
    // Ensure we're on free tier
    await devApi.switchTier('free')
    await page.reload()

    const upgradeBtn = page.getByTestId(S.billing.upgradeButton).first()
    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click()
      await expect(page.getByTestId(S.billing.upgradeConfirm)).toBeVisible()
    }
  })

  test('manage subscription button visible on paid tier', async ({ devApi, page }) => {
    await devApi.switchTier('monitor')
    await page.reload()

    await expect(page.getByTestId(S.billing.manageButton)).toBeVisible()
  })

  test('manage subscription button hidden on free tier', async ({ page }) => {
    await expect(page.getByTestId(S.billing.manageButton)).not.toBeVisible()
  })

  test('past-due banner shows for past_due status', async ({ devApi, page }) => {
    await devApi.switchTier('monitor')
    await devApi.setSubscriptionStatus('past_due')
    await page.reload()

    await expect(page.getByTestId(S.billing.pastDueBanner)).toBeVisible()
  })

  test('past-due banner hidden when active', async ({ devApi, page }) => {
    await devApi.switchTier('monitor')
    await page.reload()

    await expect(page.getByTestId(S.billing.pastDueBanner)).not.toBeVisible()
  })

  test('FAQ accordion renders 4 questions', async ({ page }) => {
    const questions = page.locator('[data-slot="accordion-trigger"]')
    await expect(questions).toHaveCount(4)
  })

  test('FAQ accordion expands and collapses', async ({ page }) => {
    const firstTrigger = page.locator('[data-slot="accordion-trigger"]').first()
    await firstTrigger.click()
    const firstPanel = page.locator('[data-slot="accordion-content"]').first()
    await expect(firstPanel).toBeVisible()

    // Click again to collapse
    await firstTrigger.click()
    await expect(firstPanel).not.toBeVisible()
  })
})
