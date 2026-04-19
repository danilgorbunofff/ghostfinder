'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { emitDevActionEvent, formatDevActionLabel, getDevActionHint } from './dev-tools-events'

type DevAction = {
  action: string
  [key: string]: unknown
}

const READ_ACTIONS = new Set(['get-state'])

export interface DevActionState {
  user: { userId: string; orgId: string; role: string }
  subscription: { tier: string; status: string }
  counts: Record<string, number>
  latestReport: {
    total_monthly_waste: number
    ghost_seat_count: number
    duplicate_count: number
    generated_at: string
  } | null
  env: Record<string, string | boolean>
}

export interface DevActionResult extends Record<string, unknown> {
  success?: boolean
  message?: string
  error?: string
  status?: number
  role?: string
  tier?: string
  state?: DevActionState
}

async function parseDevResponse(res: Response): Promise<DevActionResult> {
  const text = await res.text()
  if (!text) return {}

  try {
    const parsed = JSON.parse(text) as unknown
    return parsed && typeof parsed === 'object' ? parsed as DevActionResult : { value: parsed }
  } catch {
    return { error: text }
  }
}

export function useDevAction() {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  const run = useCallback(async (payload: DevAction) => {
    setLoading(payload.action)
    emitDevActionEvent({
      action: payload.action,
      phase: 'started',
      message: `Running ${formatDevActionLabel(payload.action).toLowerCase()}...`,
    })

    try {
      let token = ''

      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token ?? ''
      } catch {
        // Fall back to cookie-backed auth in /api/dev when local session access is unavailable.
      }

      const res = await fetch('/api/dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ghostfinder-Dev-Action': '1',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      const data = await parseDevResponse(res)
      const errorMessage = typeof data.error === 'string' ? data.error : null

      if (!res.ok || errorMessage) {
        const message = errorMessage || `Action failed (${res.status})`
        const hint = getDevActionHint(res.status, message)
        emitDevActionEvent({
          action: payload.action,
          phase: 'failed',
          message,
          hint,
          status: res.status,
        })
        toast.error(message, { description: hint })
        return null
      }

      // Refresh the page to pick up fresh server-rendered content
      if (!READ_ACTIONS.has(payload.action)) {
        router.refresh()
      }

      emitDevActionEvent({
        action: payload.action,
        phase: 'succeeded',
        message: typeof data.message === 'string' ? data.message : `${formatDevActionLabel(payload.action)} completed.`,
        status: res.status,
      })

      return data
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const hint = getDevActionHint(undefined, message)
      emitDevActionEvent({
        action: payload.action,
        phase: 'failed',
        message: 'Network error',
        hint,
      })
      toast.error('Network error', { description: message })
      return null
    } finally {
      setLoading(null)
    }
  }, [router])

  return { run, loading }
}
