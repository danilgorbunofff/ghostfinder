import { test, expect } from '@playwright/test'
import { S } from '../../helpers/selectors'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Signup page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup')
  })

  test('renders signup form', async ({ page }) => {
    await expect(page.getByTestId(S.auth.signupEmail)).toBeVisible()
    await expect(page.getByTestId(S.auth.signupPassword)).toBeVisible()
    await expect(page.getByTestId(S.auth.signupSubmit)).toBeVisible()
    await expect(page.getByTestId(S.auth.signupGoogle)).toBeVisible()
  })

  test('shows confirmation after valid signup', async ({ page }) => {
    const uniqueEmail = `e2e-test-${Date.now()}@ghostfinder.test`
    await page.getByTestId(S.auth.signupEmail).fill(uniqueEmail)
    await page.getByTestId(S.auth.signupPassword).fill('ValidPassword123!')
    await page.getByTestId(S.auth.signupSubmit).click()

    // After signup, should show "Check your email" confirmation
    await expect(page.getByTestId(S.auth.signupConfirmation)).toBeVisible({
      timeout: 10_000,
    })
  })

  test('shows error for weak password', async ({ page }) => {
    await page.getByTestId(S.auth.signupEmail).fill('test@example.com')
    await page.getByTestId(S.auth.signupPassword).fill('123')
    await page.getByTestId(S.auth.signupSubmit).click()

    await expect(page.getByTestId(S.auth.signupError)).toBeVisible({
      timeout: 5_000,
    })
  })

  test('Google OAuth button is present and clickable', async ({ page }) => {
    const btn = page.getByTestId(S.auth.signupGoogle)
    await expect(btn).toBeVisible()
    await expect(btn).toBeEnabled()
  })
})
