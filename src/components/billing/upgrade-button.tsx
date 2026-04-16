'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function UpgradeButton({
  priceId,
  planName,
}: {
  priceId: string
  planName: string
}) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const { url } = await res.json()
      if (url) {
        toast.info('Redirecting to checkout...', {
          description: 'Complete payment on the Stripe page',
        })
        window.location.href = url
      }
    } catch (err) {
      console.error('Checkout error:', err)
      toast.error('Checkout failed', {
        description: 'Could not start checkout. Please try again.',
      })
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button data-testid="upgrade-button" className="w-full group/upgrade gap-2" />}>
        Upgrade to {planName}
        <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 group-hover/upgrade:translate-x-0 group-hover/upgrade:opacity-100 transition-all" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Upgrade to <span className="text-brand">{planName}</span>
          </DialogTitle>
          <DialogDescription>
            You&apos;re about to upgrade your plan. You&apos;ll be redirected to
            Stripe to complete payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {[
            `Immediate access to all ${planName} features`,
            'Cancel anytime — no long-term commitment',
            'Pro-rated billing for the current period',
          ].map((text) => (
            <div key={text} className="flex items-center gap-3 text-sm">
              <span className="h-6 w-6 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              </span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={handleUpgrade} disabled={loading} data-testid="upgrade-confirm" className="gap-2 group/checkout">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting…
              </>
            ) : (
              <>
                Continue to checkout
                <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 group-hover/checkout:translate-x-0 group-hover/checkout:opacity-100 transition-all" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
