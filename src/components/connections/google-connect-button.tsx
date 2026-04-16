'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export function GoogleConnectButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/integrations/google/connect', {
        method: 'POST',
      })

      const data = await res.json()
      if (data.authorizationUrl) {
        toast.info('Redirecting to Google...', {
          description: 'Complete the authorization in the new page',
        })
        window.location.href = data.authorizationUrl
      } else {
        toast.error('Failed to connect Google', {
          description: data.error || 'Please try again',
        })
        setError(data.error || 'Failed to initiate connection')
      }
    } catch {
      toast.error('Connection failed', {
        description: 'Network error — please try again',
      })
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button variant="outline" onClick={handleConnect} disabled={loading} data-testid="google-connect-button" className="group/btn gap-2">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Connect Google Workspace
        <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 group-hover/btn:translate-x-0 group-hover/btn:opacity-100 transition-all" />
      </Button>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  )
}
