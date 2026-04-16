import { test, expect } from '../../fixtures/dev-tools.fixture'
import { S } from '../../helpers/selectors'

type RoleAccess = {
  role: 'owner' | 'admin' | 'member' | 'viewer'
  canConnect: boolean
  canManageOrg: boolean
  canDangerZone: boolean
  canUpgrade: boolean
  canExport: boolean
}

const ROLE_MATRIX: RoleAccess[] = [
  { role: 'owner', canConnect: true, canManageOrg: true, canDangerZone: true, canUpgrade: true, canExport: true },
  { role: 'admin', canConnect: true, canManageOrg: true, canDangerZone: false, canUpgrade: true, canExport: true },
  { role: 'member', canConnect: false, canManageOrg: false, canDangerZone: false, canUpgrade: false, canExport: true },
  { role: 'viewer', canConnect: false, canManageOrg: false, canDangerZone: false, canUpgrade: false, canExport: false },
]

test.describe('RBAC matrix', () => {
  test.beforeEach(async ({ devApi }) => {
    await devApi.seedDemoData()
  })

  for (const { role, canConnect, canManageOrg, canDangerZone, canUpgrade, canExport } of ROLE_MATRIX) {
    test.describe(`Role: ${role}`, () => {
      test.beforeEach(async ({ devApi }) => {
        await devApi.switchRole(role)
      })

      test('can view dashboard', async ({ page }) => {
        await page.goto('/')
        await expect(page.getByTestId(S.dashboard.statsCards)).toBeVisible()
      })

      test('can view billing page', async ({ page }) => {
        await page.goto('/billing')
        await expect(page.getByTestId(S.billing.freeCard)).toBeVisible()
      })

      test('can view reports page', async ({ page }) => {
        await page.goto('/reports')
        await page.waitForLoadState('networkidle')
        // All roles can view reports page (content varies)
        await expect(page.locator('main')).toBeVisible()
      })

      test(`${canConnect ? 'CAN' : 'CANNOT'} connect Plaid`, async ({ page }) => {
        await page.goto('/connections')
        const plaidBtn = page.getByTestId(S.connections.plaidButton)
        if (canConnect) {
          await expect(plaidBtn).toBeVisible()
          await expect(plaidBtn).toBeEnabled()
        } else {
          await expect(plaidBtn).toBeHidden()
        }
      })

      test(`${canConnect ? 'CAN' : 'CANNOT'} connect Google`, async ({ page }) => {
        await page.goto('/connections')
        const googleBtn = page.getByTestId(S.connections.googleButton)
        if (canConnect) {
          await expect(googleBtn).toBeVisible()
        } else {
          await expect(googleBtn).toBeHidden()
        }
      })

      test(`${canConnect ? 'CAN' : 'CANNOT'} connect Okta`, async ({ page }) => {
        await page.goto('/connections')
        const oktaBtn = page.getByTestId(S.connections.oktaButton)
        if (canConnect) {
          await expect(oktaBtn).toBeVisible()
        } else {
          await expect(oktaBtn).toBeHidden()
        }
      })

      test(`${canManageOrg ? 'CAN' : 'CANNOT'} manage organization settings`, async ({ page }) => {
        await page.goto('/settings')
        await page.getByTestId(S.settings.tabOrganization).click()

        const saveBtn = page.getByTestId(S.settings.orgSaveButton)
        if (canManageOrg) {
          await expect(saveBtn).toBeVisible()
        } else {
          await expect(saveBtn).toBeHidden()
        }
      })

      test(`${canDangerZone ? 'CAN' : 'CANNOT'} see danger zone`, async ({ page }) => {
        await page.goto('/settings')
        const dangerTab = page.getByTestId(S.settings.tabDangerZone)
        if (canDangerZone) {
          await dangerTab.click()
          await expect(page.getByTestId(S.settings.dangerZoneSection)).toBeVisible()
        } else {
          await expect(dangerTab).toBeHidden()
        }
      })

      test(`${canUpgrade ? 'CAN' : 'CANNOT'} upgrade tier`, async ({ page }) => {
        await page.goto('/billing')
        const upgradeBtn = page.getByTestId(S.billing.upgradeButton).first()
        if (canUpgrade) {
          await expect(upgradeBtn).toBeVisible()
        } else {
          await expect(upgradeBtn).toBeHidden()
        }
      })

      test(`${canExport ? 'CAN' : 'CANNOT'} export CSV`, async ({ page }) => {
        await page.goto('/inventory')
        const exportBtn = page.getByTestId(S.inventory.exportButton)
        if (canExport) {
          await expect(exportBtn).toBeVisible()
        } else {
          await expect(exportBtn).toBeHidden()
        }
      })
    })
  }

  // Restore to owner role after RBAC tests
  test.afterAll(async ({ devApi }) => {
    await devApi.switchRole('owner')
  })
})
