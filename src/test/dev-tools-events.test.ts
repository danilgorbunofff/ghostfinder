import { describe, expect, it, vi } from 'vitest'
import {
  DEV_ACTION_EVENT,
  emitDevActionEvent,
  formatDevActionLabel,
  getDevActionHint,
  onDevActionEvent,
} from '@/components/dev/dev-tools-events'

describe('dev tools events', () => {
  it('formats known actions with readable labels', () => {
    expect(formatDevActionLabel('seed-data')).toBe('Seed demo data')
    expect(formatDevActionLabel('simulate-google')).toBe('Simulate Google Workspace')
  })

  it('provides targeted hints for common failure statuses', () => {
    expect(getDevActionHint(401)).toContain('sign in again')
    expect(getDevActionHint(404)).toContain('MOCK_SERVICES=true')
    expect(getDevActionHint(500)).toContain('Next.js terminal')
  })

  it('emits and subscribes to panel action events through window', () => {
    const listener = vi.fn()
    const unsubscribe = onDevActionEvent(listener)

    emitDevActionEvent({
      action: 'seed-data',
      phase: 'succeeded',
      message: 'Demo data seeded',
      status: 200,
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toMatchObject({
      action: 'seed-data',
      phase: 'succeeded',
      message: 'Demo data seeded',
      status: 200,
    })

    unsubscribe()
    window.dispatchEvent(new CustomEvent(DEV_ACTION_EVENT, {
      detail: {
        action: 'seed-data',
        phase: 'failed',
        message: 'Should not be observed',
        at: new Date().toISOString(),
      },
    }))

    expect(listener).toHaveBeenCalledTimes(1)
  })
})