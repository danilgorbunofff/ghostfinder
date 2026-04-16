'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

type DevAction = {
  action: string
  [key: string]: unknown
}

export function useDevAction() {
  const [loading, setLoading] = useState<string | null>(null)

  const run = useCallback(async (payload: DevAction) => {
    setLoading(payload.action)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch('/api/dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || `Action failed (${res.status})`)
        return null
      }
      return data
    } catch (e) {
      toast.error(`Network error: ${e}`)
      return null
    } finally {
      setLoading(null)
    }
  }, [])

  return { run, loading }
}
