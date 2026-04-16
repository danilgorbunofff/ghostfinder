import { test, expect } from '../../fixtures/auth.fixture'
import { S } from '../../helpers/selectors'

test.describe('Settings profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
  })

  test('shows tab navigation', async ({ page }) => {
    await expect(page.getByTestId(S.settings.tabProfile)).toBeVisible()
    await expect(page.getByTestId(S.settings.tabOrganization)).toBeVisible()
    await expect(page.getByTestId(S.settings.tabNotifications)).toBeVisible()
  })

  test('profile tab is active by default', async ({ page }) => {
    const tab = page.getByTestId(S.settings.tabProfile)
    await expect(tab).toHaveAttribute('data-state', 'active')
  })

  test('profile section displays user email', async ({ page }) => {
    // The profile section should show the authenticated user's email
    await expect(page.getByText('e2e-owner@ghostfinder.test')).toBeVisible()
  })

  test('can switch between tabs', async ({ page }) => {
    await page.getByTestId(S.settings.tabOrganization).click()
    // Organization content should be visible
    await expect(page.getByTestId(S.settings.membersList).or(
      page.getByText(/organization/i)
    )).toBeVisible()

    await page.getByTestId(S.settings.tabNotifications).click()
    await expect(page.getByTestId(S.settings.emailToggle).or(
      page.getByText(/notification/i)
    )).toBeVisible()
  })
})
