'use client'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { Bell, CheckCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function ReportNotifyButton({ reportId }: { reportId: string }) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleNotify = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/notify-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })

      const data = await res.json()

      if (data.success) {
        setSent(true)
        toast.success('Notification sent!', {
          description: 'Your team has been notified about this report.',
        })
      } else if (res.status === 403) {
        toast.error('Upgrade required', {
          description: data.error,
        })
      } else if (res.status === 400) {
        toast.error('Notifications not configured', {
          description: data.error,
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

  if (sent) {
    return (
      <Tooltip content="Already sent for this report">
        <Button
          variant="outline"
          size="sm"
          disabled
          className="gap-2 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900"
          data-testid="notify-button"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Sent
        </Button>
      </Tooltip>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleNotify}
      disabled={loading}
      className="gap-2 hover:border-brand hover:text-brand"
      data-testid="notify-button"
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Sending…
        </>
      ) : (
        <>
          <Bell className="h-3.5 w-3.5" />
          Notify Team
        </>
      )}
    </Button>
  )
}
