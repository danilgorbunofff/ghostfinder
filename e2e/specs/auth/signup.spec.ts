import { test, expect } from '@playwright/test'
import { S } from '../../helpers/selectors'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Signup page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup')
  })

  test('renders signup form', async ({ page }) => {
    await expect(page.getByTestId(S.auth.emailInput)).toBeVisible()
    await expect(page.getByTestId(S.auth.passwordInput)).toBeVisible()
    await expect(page.getByTestId(S.auth.submitButton)).toBeVisible()
    await expect(page.getByTestId(S.auth.googleButton)).toBeVisible()
  })

  test('shows confirmation after valid signup', async ({ page }) => {
    const uniqueEmail = `e2e-test-${Date.now()}@ghostfinder.test`
    await page.getByTestId(S.auth.emailInput).fill(uniqueEmail)
    await page.getByTestId(S.auth.passwordInput).fill('ValidPassword123!')
    await page.getByTestId(S.auth.submitButton).click()

    // After signup, should show "Check your email" confirmation
    await expect(page.getByTestId(S.auth.confirmationMessage)).toBeVisible({
      timeout: 10_000,
    })
  })

  test('shows error for weak password', async ({ page }) => {
    await page.getByTestId(S.auth.emailInput).fill('test@example.com')
    await page.getByTestId(S.auth.passwordInput).fill('123')
    await page.getByTestId(S.auth.submitButton).click()

    await expect(page.getByTestId(S.auth.errorMessage)).toBeVisible({
      timeout: 5_000,
    })
  })

  test('Google OAuth button is present and clickable', async ({ page }) => {
    const btn = page.getByTestId(S.auth.googleButton)
    await expect(btn).toBeVisible()
    await expect(btn).toBeEnabled()
  })
})
