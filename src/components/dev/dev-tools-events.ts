'use client'

export type DevActionPhase = 'started' | 'succeeded' | 'failed'

export interface DevActionEventDetail {
  action: string
  phase: DevActionPhase
  message: string
  hint?: string
  status?: number
  at: string
}

export const DEV_ACTION_EVENT = 'ghostfinder:dev-action'

const ACTION_LABELS: Record<string, string> = {
  'get-state': 'Load state',
  'seed-data': 'Seed demo data',
  'reset-data': 'Reset all data',
  'reset-table': 'Clear table',
  'generate-transactions': 'Generate transactions',
  'simulate-plaid': 'Simulate Plaid',
  'simulate-google': 'Simulate Google Workspace',
  'simulate-okta': 'Simulate Okta',
  'simulate-gocardless': 'Simulate GoCardless',
  'toggle-connection-status': 'Update connection status',
  'sync-transactions': 'Sync transactions',
  'sync-usage': 'Sync usage',
  'generate-reports': 'Generate reports',
  'run-cron': 'Run cron job',
  'switch-role': 'Switch role',
  'switch-tier': 'Switch tier',
  'set-subscription-status': 'Set subscription status',
}

function hasWindow() {
  return typeof window !== 'undefined'
}

function sentenceCase(input: string) {
  const normalized = input.replace(/[-_]+/g, ' ').trim()
  if (!normalized) return 'Unknown action'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function formatDevActionLabel(action: string) {
  return ACTION_LABELS[action] ?? sentenceCase(action)
}

export function getDevActionHint(status?: number, message?: string) {
  if (status === 400) {
    return 'The request payload was rejected by /api/dev. Check the selected values and try again.'
  }

  if (status === 401) {
    return 'No active browser session was sent. Refresh the page or sign in again.'
  }

  if (status === 404) {
    return 'The dev API is disabled. Set MOCK_SERVICES=true and restart the dev server.'
  }

  if (status === 500) {
    return 'The action failed on the server. Check the Next.js terminal for [DEV API ERROR].'
  }

  if (message?.includes('Failed to fetch')) {
    return 'The app origin is not responding. Confirm the Next.js dev server is running.'
  }

  return 'Use the State tab to verify env/auth and inspect the latest backend state.'
}

export function emitDevActionEvent(detail: Omit<DevActionEventDetail, 'at'> & { at?: string }) {
  if (!hasWindow()) return

  window.dispatchEvent(new CustomEvent<DevActionEventDetail>(DEV_ACTION_EVENT, {
    detail: {
      ...detail,
      at: detail.at ?? new Date().toISOString(),
    },
  }))
}

export function onDevActionEvent(listener: (detail: DevActionEventDetail) => void) {
  if (!hasWindow()) {
    return () => undefined
  }

  const handle = (event: Event) => {
    const detail = (event as CustomEvent<DevActionEventDetail>).detail
    if (detail) {
      listener(detail)
    }
  }

  window.addEventListener(DEV_ACTION_EVENT, handle as EventListener)
  return () => window.removeEventListener(DEV_ACTION_EVENT, handle as EventListener)
}