import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Inventory CSV export', () => {
  test.beforeEach(async ({ devApi, page }) => {
    await devApi.seedDemoData()
    await page.goto('/inventory')
  })

  test('export button is visible', async ({ page }) => {
    await expect(page.getByTestId(S.inventory.exportButton)).toBeVisible()
  })

  test('clicking export downloads a CSV file', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId(S.inventory.exportButton).click(),
    ])

    const filename = download.suggestedFilename()
    expect(filename).toMatch(/\.csv$/i)
  })

  test('exported CSV contains correct headers', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId(S.inventory.exportButton).click(),
    ])

    const path = await download.path()
    if (!path) return

    const fs = require('fs')
    const content = fs.readFileSync(path, 'utf-8')
    const firstLine = content.split('\n')[0]

    expect(firstLine).toContain('Vendor')
    expect(firstLine).toContain('Monthly Cost')
    expect(firstLine).toContain('Seats')
    expect(firstLine).toContain('Status')
    expect(firstLine).toContain('Category')
  })

  test('CSV contains data matching current filter', async ({ page }) => {
    // Filter to only show Slack
    await page.getByTestId(S.inventory.searchInput).fill('Slack')
    await page.waitForTimeout(500)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId(S.inventory.exportButton).click(),
    ])

    const path = await download.path()
    if (!path) return

    const fs = require('fs')
    const content = fs.readFileSync(path, 'utf-8')
    const lines = content.trim().split('\n')

    // Header + 1 data row (Slack only)
    expect(lines.length).toBe(2)
    expect(lines[1]).toContain('Slack')
  })
})
