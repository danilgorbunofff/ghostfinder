import { test as base, expect, type Page } from '@playwright/test'

/**
 * Auth fixture — provides a pre-authenticated page using stored storageState.
 * All browser projects already use storageState from playwright.config.ts,
 * so `page` is already authenticated. This fixture re-exports test/expect
 * and adds helper utilities.
 */

export type AuthFixtures = {
  /** Extract the Supabase access token from the current page context */
  getAccessToken: () => Promise<string>
}

export const test = base.extend<AuthFixtures>({
  getAccessToken: async ({ page }, use) => {
    const getter = async (): Promise<string> => {
      const token = await page.evaluate(() => {
        // Supabase stores session in localStorage under a key like:
        // sb-<project-ref>-auth-token
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            try {
              const parsed = JSON.parse(localStorage.getItem(key)!)
              return parsed?.access_token ?? ''
            } catch {
              return ''
            }
          }
        }
        return ''
      })

      if (!token) {
        throw new Error(
          'No Supabase access token found in localStorage. Is the page authenticated?'
        )
      }
      return token
    }
    await use(getter)
  },
})

export { expect }
