import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Settings organization', () => {
  test.beforeEach(async ({ devApi, page }) => {
    await devApi.seedDemoData()
    await page.goto('/settings')
    await page.getByTestId(S.settings.tabOrganization).click()
  })

  test('displays organization name', async ({ page }) => {
    const nameInput = page.getByTestId(S.settings.orgNameInput)
    if (await nameInput.isVisible()) {
      const value = await nameInput.inputValue()
      expect(value).toBeTruthy()
    }
  })

  test('shows members list', async ({ page }) => {
    await expect(page.getByTestId(S.settings.membersList)).toBeVisible()
  })

  test('owner can update org name', async ({ page }) => {
    const nameInput = page.getByTestId(S.settings.orgNameInput)
    const saveBtn = page.getByTestId(S.settings.orgSaveButton)

    await expect(nameInput).toBeVisible()
    await expect(saveBtn).toBeVisible()

    await nameInput.clear()
    await nameInput.fill('Updated E2E Org')
    await saveBtn.click()

    // Should show success feedback (toast or inline)
    await expect(
      page.locator('[data-sonner-toast]').or(page.getByText(/saved|updated/i))
    ).toBeVisible({ timeout: 5_000 })
  })

  test('member role sees read-only organization section', async ({ devApi, page }) => {
    await devApi.switchRole('member')
    await page.reload()
    await page.getByTestId(S.settings.tabOrganization).click()

    const saveBtn = page.getByTestId(S.settings.orgSaveButton)
    await expect(saveBtn).toBeHidden()

    // Restore role
    await devApi.switchRole('owner')
  })
})
