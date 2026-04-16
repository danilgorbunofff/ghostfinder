'use client'

import { Button, buttonVariants } from '@/components/ui/button'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { VariantProps } from 'class-variance-authority'

type ManageButtonProps = Pick<VariantProps<typeof buttonVariants>, 'variant' | 'size'> & {
  className?: string
}

export function ManageButton({
  variant = 'outline',
  size,
  className = 'w-full',
}: ManageButtonProps = {}) {
  const [loading, setLoading] = useState(false)

  const handleManage = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) {
        toast.info('Opening billing portal...', {
          description: 'Manage your subscription on the Stripe page',
        })
        window.location.href = url
      }
    } catch (err) {
      console.error('Portal error:', err)
      toast.error('Could not open billing portal', {
        description: 'Please try again later.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleManage}
      disabled={loading}
      variant={variant}
      size={size}
      className={`${className} gap-2 hover:border-brand transition-colors`}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </>
      ) : (
        <>
          Manage Subscription
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </>
      )}
    </Button>
  )
}
