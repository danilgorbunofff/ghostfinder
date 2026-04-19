import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'
import { collectConsoleErrors } from '../../helpers/assertions'

const STORAGE_KEY = 'ghostfinder-dev-panel'

test.describe('Dev panel — rendering & tab mechanics', () => {
  test.beforeEach(async ({ page }) => {
    // Clear dev panel localStorage before each test
    await page.goto('/')
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
  })

  // ── Step 2.1 — Toggle button ──────────────────────────────────────

  test('floating gear button is visible', async ({ page }) => {
    const toggle = page.getByTestId(S.dev.toggle)
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('title', 'Dev Tools')
  })

  test('clicking toggle opens the panel', async ({ page }) => {
    const toggle = page.getByTestId(S.dev.toggle)
    const panel = page.getByTestId(S.dev.panel)

    // Panel hidden initially
    await expect(panel).toBeHidden()

    // Click opens panel
    await toggle.click()
    await expect(panel).toBeVisible()
  })

  test('clicking toggle again closes the panel', async ({ page }) => {
    const toggle = page.getByTestId(S.dev.toggle)
    const panel = page.getByTestId(S.dev.panel)

    await toggle.click()
    await expect(panel).toBeVisible()

    await toggle.click()
    await expect(panel).toBeHidden()
  })

  test('close button inside header closes the panel', async ({ page }) => {
    const toggle = page.getByTestId(S.dev.toggle)
    const panel = page.getByTestId(S.dev.panel)
    const close = page.getByTestId(S.dev.close)

    await toggle.click()
    await expect(panel).toBeVisible()

    await close.click()
    await expect(panel).toBeHidden()
  })

  // ── Step 2.2 — Panel renders correctly ────────────────────────────

  test('panel has expected dimensions and position', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()
    const panel = page.getByTestId(S.dev.panel)
    await expect(panel).toBeVisible()

    const box = await panel.boundingBox()
    expect(box).not.toBeNull()
    // Width should be 360px per spec
    expect(box!.width).toBeCloseTo(360, -1)
    // Panel should be positioned on the right side of viewport
    const viewport = page.viewportSize()!
    expect(box!.x + box!.width).toBeCloseTo(viewport.width - 16, 5) // right-4 = 16px
  })

  test('panel header shows title and DEV badge', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()
    const panel = page.getByTestId(S.dev.panel)

    await expect(panel.getByText('Dev Tools')).toBeVisible()
    await expect(panel.getByText('DEV')).toBeVisible()
  })

  // ── Step 2.3 — Tab switching ─────────────────────────────────────

  test('all 5 tabs are rendered', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()

    await expect(page.getByTestId(S.dev.tabData)).toBeVisible()
    await expect(page.getByTestId(S.dev.tabConn)).toBeVisible()
    await expect(page.getByTestId(S.dev.tabCron)).toBeVisible()
    await expect(page.getByTestId(S.dev.tabAuth)).toBeVisible()
    await expect(page.getByTestId(S.dev.tabState)).toBeVisible()
  })

  test('tabs display correct labels', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()

    await expect(page.getByTestId(S.dev.tabData)).toContainText('Data')
    await expect(page.getByTestId(S.dev.tabConn)).toContainText('Conn')
    await expect(page.getByTestId(S.dev.tabCron)).toContainText('Cron')
    await expect(page.getByTestId(S.dev.tabAuth)).toContainText('Auth')
    await expect(page.getByTestId(S.dev.tabState)).toContainText('State')
  })

  test('Data tab is active by default', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()
    const dataTab = page.getByTestId(S.dev.tabData)

    // @base-ui marks active tab with data-selected
    await expect(dataTab).toHaveAttribute('data-selected', '')
  })

  test('clicking each tab switches content', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()
    const panel = page.getByTestId(S.dev.panel)

    // Switch to Conn tab
    await page.getByTestId(S.dev.tabConn).click()
    await expect(page.getByTestId(S.dev.tabConn)).toHaveAttribute('data-selected', '')
    // Connections tab renders Plaid heading
    await expect(panel.getByText('Bank (Plaid)')).toBeVisible()

    // Switch to Cron tab
    await page.getByTestId(S.dev.tabCron).click()
    await expect(page.getByTestId(S.dev.tabCron)).toHaveAttribute('data-selected', '')
    await expect(panel.getByText('Trigger cron jobs manually')).toBeVisible()

    // Switch to Auth tab
    await page.getByTestId(S.dev.tabAuth).click()
    await expect(page.getByTestId(S.dev.tabAuth)).toHaveAttribute('data-selected', '')
    await expect(panel.getByText('Role')).toBeVisible()

    // Switch to State tab
    await page.getByTestId(S.dev.tabState).click()
    await expect(page.getByTestId(S.dev.tabState)).toHaveAttribute('data-selected', '')
    // State tab shows loading spinner or state content
    await expect(
      panel.getByText('State').or(panel.locator('.animate-spin'))
    ).toBeVisible()

    // Switch back to Data tab
    await page.getByTestId(S.dev.tabData).click()
    await expect(page.getByTestId(S.dev.tabData)).toHaveAttribute('data-selected', '')
    await expect(panel.getByText('Seed')).toBeVisible()
  })

  // ── Step 2.4 — localStorage persistence ──────────────────────────

  test('opening panel persists state to localStorage', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()
    await expect(page.getByTestId(S.dev.panel)).toBeVisible()

    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || '{}'),
      STORAGE_KEY
    )
    expect(stored.open).toBe(true)
    expect(stored.tab).toBe('data')
  })

  test('tab switch persists to localStorage', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()
    await page.getByTestId(S.dev.tabCron).click()

    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || '{}'),
      STORAGE_KEY
    )
    expect(stored.tab).toBe('cron')
  })

  test('panel state restores from localStorage on reload', async ({ page }) => {
    // Open panel and switch to auth tab
    await page.getByTestId(S.dev.toggle).click()
    await page.getByTestId(S.dev.tabAuth).click()
    await expect(page.getByTestId(S.dev.panel)).toBeVisible()

    // Reload page
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Panel should reopen and auth tab should be selected
    await expect(page.getByTestId(S.dev.panel)).toBeVisible()
    await expect(page.getByTestId(S.dev.tabAuth)).toHaveAttribute('data-selected', '')
  })

  test('clearing localStorage resets to default state', async ({ page }) => {
    // Open panel
    await page.getByTestId(S.dev.toggle).click()
    await expect(page.getByTestId(S.dev.panel)).toBeVisible()

    // Clear and reload
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Panel should be closed
    await expect(page.getByTestId(S.dev.panel)).toBeHidden()

    // When opened, Data tab should be default
    await page.getByTestId(S.dev.toggle).click()
    await expect(page.getByTestId(S.dev.tabData)).toHaveAttribute('data-selected', '')
  })

  // ── Step 2.5 — Hydration mismatches ──────────────────────────────

  test('no hydration errors on page load', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const hydrationErrors = errors.filter(
      (e) =>
        e.toLowerCase().includes('hydration') ||
        e.includes('server rendered HTML') ||
        e.includes('Expected server HTML')
    )
    expect(hydrationErrors).toHaveLength(0)
  })

  test('no hydration errors after opening panel', async ({ page }) => {
    const errors = collectConsoleErrors(page)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.getByTestId(S.dev.toggle).click()
    await expect(page.getByTestId(S.dev.panel)).toBeVisible()

    // Wait a tick for any async hydration warnings
    await page.waitForTimeout(500)

    const hydrationErrors = errors.filter(
      (e) =>
        e.toLowerCase().includes('hydration') ||
        e.includes('server rendered HTML') ||
        e.includes('Expected server HTML')
    )
    expect(hydrationErrors).toHaveLength(0)
  })

  // ── Step 2.6 — Tab content mounts ─────────────────────────────────

  test('Data tab content has child elements', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()
    const panel = page.getByTestId(S.dev.panel)

    // Data tab renders the Seed section with buttons
    await expect(panel.getByText('Seed Full Demo Data')).toBeVisible()
    await expect(panel.getByText('Generate Transactions')).toBeVisible()
  })

  test('Connections tab content has child elements', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()
    await page.getByTestId(S.dev.tabConn).click()
    const panel = page.getByTestId(S.dev.panel)

    await expect(panel.getByText('Bank (Plaid)')).toBeVisible()
    await expect(panel.getByText('Google Workspace')).toBeVisible()
  })

  test('Cron tab content has child elements', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()
    await page.getByTestId(S.dev.tabCron).click()
    const panel = page.getByTestId(S.dev.panel)

    await expect(panel.getByText('Sync Transactions')).toBeVisible()
    await expect(panel.getByText('Sync Usage')).toBeVisible()
    await expect(panel.getByText('Generate Reports')).toBeVisible()
  })

  test('Auth tab content has child elements', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()
    await page.getByTestId(S.dev.tabAuth).click()
    const panel = page.getByTestId(S.dev.panel)

    // Role buttons
    await expect(panel.getByRole('button', { name: 'owner' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'admin' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'member' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'viewer' })).toBeVisible()

    // Tier section
    await expect(panel.getByText('Subscription Tier')).toBeVisible()
  })

  test('State tab content mounts (loading or populated)', async ({ page }) => {
    await page.getByTestId(S.dev.toggle).click()
    await page.getByTestId(S.dev.tabState).click()
    const panel = page.getByTestId(S.dev.panel)

    // Should show either a loading spinner or actual state content
    const hasSpinner = panel.locator('.animate-spin')
    const hasStateHeading = panel.getByText('State')
    const hasTableCounts = panel.getByText('Table Counts')

    await expect(
      hasSpinner.or(hasStateHeading).or(hasTableCounts)
    ).toBeVisible({ timeout: 10_000 })
  })
})
