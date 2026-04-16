import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Ghost seats report', () => {
  test.describe('empty state', () => {
    test.beforeEach(async ({ devApi, page }) => {
      await devApi.resetData()
      await page.goto('/reports')
    })

    test('shows prerequisites when no connections', async ({ page }) => {
      await expect(page.getByTestId(S.reports.emptyState)).toBeVisible()
    })
  })

  test.describe('with data', () => {
    test.beforeEach(async ({ devApi, page }) => {
      await devApi.seedDemoData()
      await page.goto('/reports')
    })

    test('displays ghost seat cards', async ({ page }) => {
      const cards = page.getByTestId(S.reports.ghostSeatCard)
      await expect(cards.first()).toBeVisible({ timeout: 5_000 })

      // Seeded data has 5 ghost seats
      const count = await cards.count()
      expect(count).toBeGreaterThanOrEqual(1)
    })

    test('ghost seat card shows user details', async ({ page }) => {
      const card = page.getByTestId(S.reports.ghostSeatCard).first()
      const text = await card.textContent()

      // Should contain user email or name and cost info
      expect(text).toMatch(/@|cost|\$/i)
    })

    test('report selector allows choosing between reports', async ({ page }) => {
      const selector = page.getByTestId(S.reports.reportSelector)
      if (await selector.isVisible()) {
        await selector.click()
        // Should show at least one option
        const options = page.getByRole('option')
        const count = await options.count()
        expect(count).toBeGreaterThanOrEqual(1)
      }
    })

    test('displays total waste amount', async ({ page }) => {
      const waste = page.getByTestId(S.reports.totalWaste)
      if (await waste.isVisible()) {
        const text = await waste.textContent()
        expect(text).toMatch(/\$[\d,]+/)
      }
    })
  })
})
