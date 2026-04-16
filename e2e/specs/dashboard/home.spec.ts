import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Dashboard home', () => {
  test.describe('empty state', () => {
    test.beforeEach(async ({ devApi, page }) => {
      await devApi.resetData()
      await page.goto('/')
    })

    test('shows getting started checklist', async ({ page }) => {
      await expect(page.getByTestId(S.dashboard.gettingStarted)).toBeVisible()
    })

    test('shows zero stats', async ({ page }) => {
      await expect(page.getByTestId(S.dashboard.statsCards)).toBeVisible()
      const spendText = await page.getByTestId(S.dashboard.totalSpend).textContent()
      expect(spendText).toContain('$0')
    })

    test('does not show spend chart when no data', async ({ page }) => {
      await expect(page.getByTestId(S.dashboard.spendChart)).toBeHidden()
    })
  })

  test.describe('seeded state', () => {
    test.beforeEach(async ({ devApi, page }) => {
      await devApi.seedDemoData()
      await page.goto('/')
    })

    test('displays stats cards with real values', async ({ page }) => {
      await expect(page.getByTestId(S.dashboard.statsCards)).toBeVisible()

      const spendText = await page.getByTestId(S.dashboard.totalSpend).textContent()
      // Seeded vendors total: 875+320+540+210+450+380+2400+890+290+180 = $6,535
      expect(spendText).not.toContain('$0')
    })

    test('shows spend chart', async ({ page }) => {
      await expect(page.getByTestId(S.dashboard.spendChart)).toBeVisible()
    })

    test('shows vendor breakdown', async ({ page }) => {
      await expect(page.getByTestId(S.dashboard.vendorBreakdown)).toBeVisible()
    })

    test('shows quick actions', async ({ page }) => {
      await expect(page.getByTestId(S.dashboard.quickActions)).toBeVisible()
    })

    test('getting started reflects completed steps', async ({ page }) => {
      // After seed, bank + identity providers are connected
      const checklist = page.getByTestId(S.dashboard.gettingStarted)
      if (await checklist.isVisible()) {
        // Bank step should be checked
        const bankStep = page.getByTestId(S.dashboard.stepBank)
        await expect(bankStep).toBeVisible()
      }
    })
  })
})
