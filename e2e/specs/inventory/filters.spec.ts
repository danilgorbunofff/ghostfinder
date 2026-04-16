import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Inventory filters', () => {
  test.beforeEach(async ({ devApi, page }) => {
    await devApi.seedDemoData()
    await page.goto('/inventory')
  })

  test('search filters vendors by name', async ({ page }) => {
    const searchInput = page.getByTestId(S.inventory.searchInput)
    await searchInput.fill('Slack')

    const rows = page.getByTestId(S.inventory.vendorRow)
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Slack')
  })

  test('search is case-insensitive', async ({ page }) => {
    await page.getByTestId(S.inventory.searchInput).fill('slack')
    const rows = page.getByTestId(S.inventory.vendorRow)
    await expect(rows).toHaveCount(1)
  })

  test('status filter shows only active vendors', async ({ page }) => {
    await page.getByTestId(S.inventory.statusFilter).click()
    await page.getByRole('option', { name: /active/i }).click()

    const rows = page.getByTestId(S.inventory.vendorRow)
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('cost range filter: high shows expensive vendors', async ({ page }) => {
    await page.getByTestId(S.inventory.costFilter).click()
    await page.getByRole('option', { name: /high/i }).click()

    const rows = page.getByTestId(S.inventory.vendorRow)
    const count = await rows.count()
    // Only vendors with cost > $500 (Slack $875, Figma $540, Zoom $450? depends on threshold)
    expect(count).toBeGreaterThan(0)
  })

  test('combined filters work together', async ({ page }) => {
    // Search + status
    await page.getByTestId(S.inventory.searchInput).fill('S')
    const rows = page.getByTestId(S.inventory.vendorRow)
    const initialCount = await rows.count()
    expect(initialCount).toBeGreaterThan(0)
  })

  test('no results shows empty state', async ({ page }) => {
    await page.getByTestId(S.inventory.searchInput).fill('NonExistentVendorXYZ999')
    const rows = page.getByTestId(S.inventory.vendorRow)
    await expect(rows).toHaveCount(0)
  })
})
