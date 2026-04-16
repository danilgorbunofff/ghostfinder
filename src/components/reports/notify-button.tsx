'use client'

import { Button } from '@/components/ui/button'
import { Bell, CheckCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function NotifyButton({
  vendor,
  ghostSeats,
  monthlyWaste,
  disabled,
}: {
  vendor: string
  ghostSeats: number
  monthlyWaste: number
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleNotify = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/notify-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor, ghostSeats, monthlyWaste }),
      })

      const data = await res.json()

      if (data.success) {
        setSent(true)
        toast.success(`Notification sent for ${vendor}`, {
          description: `Alerted about ${ghostSeats} ghost seats ($${monthlyWaste}/mo)`,
        })
      } else {
        toast.error('Failed to send notification', {
          description: data.error || 'Please try again',
        })
      }
    } catch {
      toast.error('Network error', {
        description: 'Could not reach the notification service',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={sent ? 'outline' : 'outline'}
      size="sm"
      onClick={handleNotify}
      disabled={loading || sent || disabled}
      className={`gap-2 transition-all group/notify ${
        sent
          ? 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-900'
          : 'hover:border-brand hover:text-brand'
      }`}
    >
      {sent ? (
        <>
          <CheckCircle className="h-3.5 w-3.5" />
          Sent
        </>
      ) : loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Sending…
        </>
      ) : (
        <>
          <Bell className="h-3.5 w-3.5 group-hover/notify:animate-wiggle" />
          Notify via Slack
        </>
      )}
    </Button>
  )
}
