import { test as authTest, expect } from './auth.fixture'
import type { Page, APIRequestContext } from '@playwright/test'

type CronJob = 'sync-transactions' | 'sync-usage' | 'generate-reports'
type MemberRole = 'owner' | 'admin' | 'member' | 'viewer'
type Tier = 'free' | 'monitor' | 'recovery'
type AllowedTable =
  | 'transactions'
  | 'saas_vendors'
  | 'plaid_connections'
  | 'integration_connections'
  | 'user_activity'
  | 'waste_reports'
  | 'notification_log'

export interface DevApi {
  seedDemoData(): Promise<void>
  resetData(): Promise<void>
  resetTable(table: AllowedTable): Promise<void>
  generateTransactions(count?: number): Promise<void>
  switchRole(role: MemberRole): Promise<void>
  switchTier(tier: Tier): Promise<void>
  simulatePlaid(opts?: {
    status?: string
    institutionName?: string
  }): Promise<void>
  simulateGoogle(opts?: {
    totalUsers?: number
    inactiveRatio?: number
  }): Promise<void>
  simulateOkta(opts?: {
    totalUsers?: number
    inactiveRatio?: number
  }): Promise<void>
  runCron(job: CronJob): Promise<void>
  getState(): Promise<Record<string, unknown>>
}

export type DevToolsFixtures = {
  devApi: DevApi
}

async function callDevApi(
  request: APIRequestContext,
  baseURL: string,
  token: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await request.post(`${baseURL}/api/dev`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })

  if (!res.ok()) {
    const text = await res.text()
    throw new Error(
      `Dev API "${body.action}" failed (${res.status()}): ${text}`
    )
  }

  return res.json()
}

export const test = authTest.extend<DevToolsFixtures>({
  devApi: async ({ page, getAccessToken, request, baseURL }, use) => {
    // Navigate to app first so localStorage is accessible
    if (page.url() === 'about:blank') {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
    }

    const token = await getAccessToken()
    const url = baseURL!

    const api: DevApi = {
      async seedDemoData() {
        await callDevApi(request, url, token, { action: 'seed-data' })
      },
      async resetData() {
        await callDevApi(request, url, token, { action: 'reset-data' })
      },
      async resetTable(table) {
        await callDevApi(request, url, token, {
          action: 'reset-table',
          table,
        })
      },
      async generateTransactions(count = 20) {
        await callDevApi(request, url, token, {
          action: 'generate-transactions',
          count,
        })
      },
      async switchRole(role) {
        await callDevApi(request, url, token, {
          action: 'switch-role',
          role,
        })
      },
      async switchTier(tier) {
        await callDevApi(request, url, token, {
          action: 'switch-tier',
          tier,
        })
      },
      async simulatePlaid(opts = {}) {
        await callDevApi(request, url, token, {
          action: 'simulate-plaid',
          ...opts,
        })
      },
      async simulateGoogle(opts = {}) {
        await callDevApi(request, url, token, {
          action: 'simulate-google',
          ...opts,
        })
      },
      async simulateOkta(opts = {}) {
        await callDevApi(request, url, token, {
          action: 'simulate-okta',
          ...opts,
        })
      },
      async runCron(job) {
        await callDevApi(request, url, token, {
          action: 'run-cron',
          job,
        })
      },
      async getState() {
        return callDevApi(request, url, token, { action: 'get-state' })
      },
    }

    await use(api)
  },
})

export { expect }
