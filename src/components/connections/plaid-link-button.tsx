'use client'

import { useCallback, useState } from 'react'
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { Loader2, Building2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export function PlaidLinkButton({ onSuccess }: { onSuccess?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLinkToken = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/plaid/create-link-token', { method: 'POST' })
      const data = await res.json()
      if (data.linkToken) {
        setLinkToken(data.linkToken)
      } else {
        setError('Failed to initialize bank connection')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      setLoading(true)
      try {
        const res = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            institutionName: metadata.institution?.name ?? 'Unknown',
            institutionId: metadata.institution?.institution_id,
          }),
        })

        const data = await res.json()
        if (data.success) {
          toast.success('Bank account connected', {
            description: `${metadata.institution?.name ?? 'Account'} linked successfully`,
          })
          onSuccess?.()
        } else {
          toast.error('Failed to connect account', {
            description: data.error || 'Please try again',
          })
          setError(data.error || 'Failed to connect account')
        }
      } catch {
        toast.error('Connection failed', {
          description: 'Could not save the bank connection',
        })
        setError('Failed to save connection')
      } finally {
        setLoading(false)
      }
    },
    [onSuccess]
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: (err) => {
      if (err) setError(err.display_message || 'Connection cancelled')
    },
  })

  return (
    <div>
      {!linkToken ? (
        <Button onClick={fetchLinkToken} disabled={loading} data-testid="plaid-connect-button" className="group/btn gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          Connect Bank Account
          <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 group-hover/btn:translate-x-0 group-hover/btn:opacity-100 transition-all" />
        </Button>
      ) : (
        <Button onClick={() => open()} disabled={!ready || loading} data-testid="plaid-connect-button" className="group/btn gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          Open Bank Login
          <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 group-hover/btn:translate-x-0 group-hover/btn:opacity-100 transition-all" />
        </Button>
      )}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  )
}
