'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function DangerZoneSection({ isOwner }: { isOwner: boolean }) {
  return (
    <Card className="border-destructive/50 animate-fade-in-up" data-testid="danger-zone-section">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <CardTitle className="text-destructive flex items-center gap-2">
              Danger Zone
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
            </CardTitle>
            <CardDescription>
              Irreversible actions that affect your account and organization.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isOwner && (
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-red-500/[0.03] dark:bg-red-500/[0.06] p-4">
            <div>
              <p className="font-medium text-sm">Leave organization</p>
              <p className="text-xs text-muted-foreground">
                You will lose access to all organization data and reports.
              </p>
            </div>
            <ConfirmDialog
              title="Leave organization"
              description="This will remove you from the organization. You will lose access to all data instantly. This cannot be undone."
              confirmText="leave organization"
              action="Leave"
              onConfirm={async () => {
                const res = await fetch('/api/settings/leave-org', { method: 'POST' })
                if (res.ok) {
                  toast.success('You have left the organization')
                  window.location.href = '/login'
                } else {
                  toast.error('Failed to leave organization')
                }
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-red-500/[0.03] dark:bg-red-500/[0.06] p-4">
          <div>
            <p className="font-medium text-sm">Delete account</p>
            <p className="text-xs text-muted-foreground">
              Permanently delete your account and all associated data.
            </p>
          </div>
          <ConfirmDialog
            title="Delete account"
            description="This will permanently delete your account, remove you from all organizations, and erase your data. This action cannot be reversed."
            confirmText="delete my account"
            action="Delete"
            variant="destructive"
            onConfirm={async () => {
              const res = await fetch('/api/settings/delete-account', { method: 'DELETE' })
              if (res.ok) {
                toast.success('Account deleted')
                window.location.href = '/login'
              } else {
                toast.error('Failed to delete account')
              }
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ConfirmDialog({
  title,
  description,
  confirmText,
  action,
  variant = 'outline',
  onConfirm,
}: {
  title: string
  description: string
  confirmText: string
  action: string
  variant?: 'outline' | 'destructive'
  onConfirm: () => Promise<void>
}) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const isMatch = input.toLowerCase() === confirmText.toLowerCase()

  async function handleConfirm() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setInput('') }}>
      <DialogTrigger render={<Button variant={variant} size="sm" />}>
        {action}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="confirm">
            Type <span className="font-mono font-bold">{confirmText}</span> to confirm
          </Label>
          <Input
            id="confirm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={confirmText}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isMatch || loading}
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : `Confirm ${action.toLowerCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
