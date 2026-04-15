'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Loader2, Shield } from 'lucide-react'

export function OktaConnectButton({ onSuccess }: { onSuccess?: () => void }) {
  const [orgUrl, setOrgUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/integrations/okta/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgUrl, apiToken }),
      })

      const data = await res.json()
      if (data.success) {
        setOpen(false)
        onSuccess?.()
      } else {
        setError(data.error || 'Connection failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Shield className="mr-2 h-4 w-4" />
            Connect Okta
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Okta</DialogTitle>
          <DialogDescription>
            Enter your Okta org URL and an API token.
            You can generate an API token in Okta Admin → Security → API → Tokens.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgUrl">Okta Org URL</Label>
            <Input
              id="orgUrl"
              type="url"
              placeholder="https://your-company.okta.com"
              value={orgUrl}
              onChange={(e) => setOrgUrl(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiToken">API Token</Label>
            <Input
              id="apiToken"
              type="password"
              placeholder="00xxxxxxxxxxxxxxxxxx"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
