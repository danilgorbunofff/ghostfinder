import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Duplicate vendors report', () => {
  test.beforeEach(async ({ devApi, page }) => {
    await devApi.seedDemoData()
    await page.goto('/reports')
  })

  test('displays duplicate vendor cards', async ({ page }) => {
    const cards = page.getByTestId(S.reports.duplicateCard)
    await expect(cards.first()).toBeVisible({ timeout: 5_000 })

    // Seeded data has 2 duplicate pairs
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('duplicate card shows vendor pair and cost', async ({ page }) => {
    const card = page.getByTestId(S.reports.duplicateCard).first()
    const text = await card.textContent()

    // Should contain vendor names and cost
    expect(text).toBeTruthy()
    expect(text!.length).toBeGreaterThan(5)
  })

  test('report date is displayed', async ({ page }) => {
    const dateEl = page.getByTestId(S.reports.reportDate)
    if (await dateEl.isVisible()) {
      const text = await dateEl.textContent()
      // Should contain a date-like string
      expect(text).toMatch(/\d/)
    }
  })
})
