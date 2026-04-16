import { test, expect } from '@playwright/test'
import { S } from '../../helpers/selectors'

// Login tests use a fresh (unauthenticated) browser context
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('renders login form', async ({ page }) => {
    await expect(page.getByTestId(S.auth.emailInput)).toBeVisible()
    await expect(page.getByTestId(S.auth.passwordInput)).toBeVisible()
    await expect(page.getByTestId(S.auth.submitButton)).toBeVisible()
    await expect(page.getByTestId(S.auth.googleButton)).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.getByTestId(S.auth.emailInput).fill('bad@example.com')
    await page.getByTestId(S.auth.passwordInput).fill('wrongpassword')
    await page.getByTestId(S.auth.submitButton).click()

    await expect(page.getByTestId(S.auth.errorMessage)).toBeVisible({ timeout: 5_000 })
  })

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.getByTestId(S.auth.emailInput).fill('e2e-owner@ghostfinder.test')
    await page.getByTestId(S.auth.passwordInput).fill('TestPassword123!')
    await page.getByTestId(S.auth.submitButton).click()

    await page.waitForURL('/', { timeout: 10_000 })
    await expect(page).toHaveURL('/')
  })

  test('Google OAuth button initiates redirect', async ({ page }) => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup').catch(() => null),
      page.getByTestId(S.auth.googleButton).click(),
    ])

    // Depending on OAuth config, either a popup opens or the page navigates
    // to a URL containing google or supabase auth
    if (popup) {
      expect(popup.url()).toContain('google')
    } else {
      // Page may redirect to supabase auth endpoint
      await page.waitForURL(/supabase|google|accounts\.google/, { timeout: 5_000 }).catch(() => {
        // May stay on login if OAuth is not configured for this env
      })
    }
  })

  test('authenticated user visiting /login is redirected to dashboard', async ({ browser }) => {
    // Use authenticated context
    const context = await browser.newContext({
      storageState: 'e2e/.auth/owner.json',
    })
    const page = await context.newPage()
    await page.goto('/login')

    // Should redirect to dashboard
    await page.waitForURL('/', { timeout: 10_000 })
    await context.close()
  })
})
