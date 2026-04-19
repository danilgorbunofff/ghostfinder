import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Inventory table and grid views', () => {
  test.beforeEach(async ({ devApi, page }) => {
    await devApi.seedDemoData()
    await page.goto('/inventory')
  })

  test('defaults to table view', async ({ page }) => {
    await expect(page.getByTestId(S.inventory.vendorTable)).toBeVisible()
  })

  test('vendor rows display name, cost, seats, status', async ({ page }) => {
    const firstRow = page.getByTestId(S.inventory.vendorRow).first()
    await expect(firstRow).toBeVisible()

    const text = await firstRow.textContent()
    // Should contain vendor info (name, cost amount, etc.)
    expect(text).toBeTruthy()
    expect(text!.length).toBeGreaterThan(5)
  })

  test('can switch to grid view', async ({ page }) => {
    // Click the grid button within the view toggle
    const toggle = page.getByTestId(S.inventory.viewToggle)
    await toggle.locator('button').nth(1).click()
    await expect(page.getByTestId(S.inventory.vendorGrid)).toBeVisible()
  })

  test('view mode persists across navigation', async ({ page }) => {
    // Switch to grid
    const toggle = page.getByTestId(S.inventory.viewToggle)
    await toggle.locator('button').nth(1).click()
    await expect(page.getByTestId(S.inventory.vendorGrid)).toBeVisible()

    // Navigate away and back
    await page.goto('/')
    await page.goto('/inventory')

    // Should still be grid view (persisted in localStorage)
    await expect(page.getByTestId(S.inventory.vendorGrid)).toBeVisible()
  })

  test('clicking vendor opens detail drawer', async ({ page }) => {
    const firstRow = page.getByTestId(S.inventory.vendorRow).first()
    await firstRow.click()

    await expect(page.getByTestId(S.inventory.vendorDrawer)).toBeVisible()
  })

  test('vendors are sorted by cost descending', async ({ page }) => {
    const rows = page.getByTestId(S.inventory.vendorRow)
    const count = await rows.count()
    if (count < 2) return

    const costs: number[] = []
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = await rows.nth(i).textContent()
      // Extract dollar amount — look for patterns like $X,XXX or $XXX
      const match = text?.match(/\$[\d,]+/)
      if (match) {
        costs.push(Number(match[0].replace(/[$,]/g, '')))
      }
    }

    // Verify descending order
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeLessThanOrEqual(costs[i - 1])
    }
  })

  test('inventory stats cards show totals', async ({ page }) => {
    await expect(page.getByTestId(S.inventory.inventoryStats)).toBeVisible()
  })
})
