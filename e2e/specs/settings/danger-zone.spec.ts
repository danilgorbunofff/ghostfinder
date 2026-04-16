import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

test.describe('Settings danger zone', () => {
  test.beforeEach(async ({ devApi, page }) => {
    await devApi.seedDemoData()
  })

  test('danger zone tab visible only for owners', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByTestId(S.settings.tabDangerZone)).toBeVisible()
  })

  test('danger zone contains delete org button', async ({ page }) => {
    await page.goto('/settings')
    await page.getByTestId(S.settings.tabDangerZone).click()

    await expect(page.getByTestId(S.settings.dangerZoneSection)).toBeVisible()
    await expect(page.getByTestId(S.settings.deleteOrgButton)).toBeVisible()
  })

  test('admin cannot see danger zone', async ({ devApi, page }) => {
    await devApi.switchRole('admin')
    await page.goto('/settings')

    await expect(page.getByTestId(S.settings.tabDangerZone)).toBeHidden()

    await devApi.switchRole('owner')
  })

  test('member cannot see danger zone', async ({ devApi, page }) => {
    await devApi.switchRole('member')
    await page.goto('/settings')

    await expect(page.getByTestId(S.settings.tabDangerZone)).toBeHidden()

    await devApi.switchRole('owner')
  })

  test('viewer cannot see danger zone', async ({ devApi, page }) => {
    await devApi.switchRole('viewer')
    await page.goto('/settings')

    await expect(page.getByTestId(S.settings.tabDangerZone)).toBeHidden()

    await devApi.switchRole('owner')
  })
})
