'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Loader2, Shield, HelpCircle, ChevronDown, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export function OktaConnectButton({ onSuccess }: { onSuccess?: () => void }) {
  const [orgUrl, setOrgUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

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
        toast.success('Okta connected successfully', {
          description: 'User data will be synced shortly',
        })
        setOpen(false)
        onSuccess?.()
      } else {
        toast.error('Failed to connect Okta', {
          description: data.error || 'Please check your credentials',
        })
        setError(data.error || 'Connection failed')
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="group/btn gap-2">
            <Shield className="h-4 w-4" />
            Connect Okta
            <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 group-hover/btn:translate-x-0 group-hover/btn:opacity-100 transition-all" />
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
        <button
          type="button"
          onClick={() => setHelpOpen(!helpOpen)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-2"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          How to create an Okta API token
          <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${helpOpen ? 'rotate-180' : ''}`} />
        </button>
        {helpOpen && (
          <div className="rounded-lg bg-muted p-3 text-xs space-y-2 mb-4">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Log in to your Okta Admin Console</li>
              <li>Navigate to <strong>Security → API → Tokens</strong></li>
              <li>Click <strong>Create Token</strong> and give it a name (e.g., &quot;GhostFinder&quot;)</li>
              <li>Copy the token value — you won&apos;t be able to see it again</li>
            </ol>
            <p className="text-muted-foreground">
              The token needs read-only access to users and groups.{' '}
              <a
                href="https://developer.okta.com/docs/guides/create-an-api-token/main/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline underline-offset-2"
              >
                Okta documentation →
              </a>
            </p>
          </div>
        )}
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
              className="focus:ring-2 focus:ring-brand/20"
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
              className="focus:ring-2 focus:ring-brand/20"
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
