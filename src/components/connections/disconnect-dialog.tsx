'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Provider = 'plaid' | 'gocardless' | 'google' | 'okta'

const API_ROUTES: Record<Provider, string> = {
  plaid: '/api/plaid/disconnect',
  gocardless: '/api/gocardless/disconnect',
  google: '/api/integrations/google/disconnect',
  okta: '/api/integrations/okta/disconnect',
}

interface DisconnectMenuProps {
  connectionId: string
  provider: Provider
  name: string
}

export function DisconnectMenu({ connectionId, provider, name }: DisconnectMenuProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDisconnect() {
    setLoading(true)
    try {
      const res = await fetch(API_ROUTES[provider], {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error('Failed to disconnect', {
          description: data.error ?? 'Please try again.',
        })
        return
      }

      toast.success(`${name} disconnected`)
      setDialogOpen(false)
      router.refresh()
    } catch {
      toast.error('Network error', { description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent">
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDialogOpen(true)}
          >
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton={false} data-testid="disconnect-dialog">
          <DialogHeader>
            <DialogTitle>Disconnect {name}?</DialogTitle>
            <DialogDescription>
              This will remove the connection and permanently delete all transaction data, vendor records, and waste reports for your organization. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
