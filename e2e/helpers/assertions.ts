import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Assert a Sonner toast message appears */
export async function expectToastMessage(page: Page, text: string) {
  const toast = page.locator('[data-sonner-toast]', { hasText: text })
  await expect(toast).toBeVisible({ timeout: 5_000 })
}

/** Assert the page has loaded with the expected heading */
export async function expectPageHeading(page: Page, heading: string) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible()
}

/** Assert an empty state placeholder is shown */
export async function expectEmptyState(page: Page, testId: string) {
  await expect(page.getByTestId(testId)).toBeVisible()
}

/** Assert the page has no console errors (call before interactions) */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  return errors
}

/** Assert element is visible by test ID */
export async function expectVisible(page: Page, testId: string) {
  await expect(page.getByTestId(testId)).toBeVisible()
}

/** Assert element is NOT visible by test ID */
export async function expectHidden(page: Page, testId: string) {
  await expect(page.getByTestId(testId)).toBeHidden()
}
