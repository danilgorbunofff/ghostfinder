import { test, expect } from '../../fixtures/auth.fixture'
import { S } from '../../helpers/selectors'

test.describe('Dashboard navigation', () => {
  const navLinks = [
    { testId: S.nav.dashboard, path: '/', label: 'Dashboard' },
    { testId: S.nav.inventory, path: '/inventory', label: 'Inventory' },
    { testId: S.nav.connections, path: '/connections', label: 'Connections' },
    { testId: S.nav.reports, path: '/reports', label: 'Reports' },
    { testId: S.nav.billing, path: '/billing', label: 'Billing' },
    { testId: S.nav.settings, path: '/settings', label: 'Settings' },
  ]

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  for (const { testId, path, label } of navLinks) {
    test(`sidebar "${label}" navigates to ${path}`, async ({ page }) => {
      await page.getByTestId(testId).click()
      await page.waitForURL(path === '/' ? '/' : `${path}**`)
      await expect(page).toHaveURL(new RegExp(`^.*${path.replace('/', '\\/')}.*$`))
    })
  }

  test('sidebar displays org name', async ({ page }) => {
    await expect(page.getByTestId(S.nav.orgName)).toBeVisible()
  })

  test('page header displays user email', async ({ page }) => {
    await expect(page.getByTestId(S.header.userEmail)).toBeVisible()
  })

  test('active nav link is highlighted', async ({ page }) => {
    await page.goto('/inventory')
    const link = page.getByTestId(S.nav.inventory)
    // The active link should have an active indicator class or aria attribute
    await expect(link).toHaveAttribute('data-active', 'true')
  })

  test('mobile sidebar toggle works', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test')

    const sidebar = page.getByTestId(S.nav.sidebar)
    // Sidebar should be hidden on mobile by default
    await expect(sidebar).toBeHidden()

    // Click toggle
    await page.getByTestId(S.nav.mobileToggle).click()
    await expect(sidebar).toBeVisible()
  })
})
