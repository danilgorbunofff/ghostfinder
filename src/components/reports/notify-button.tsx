'use client'

import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'
import { useState } from 'react'

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

      if (res.ok) {
        setSent(true)
      }
    } catch (err) {
      console.error('Notify error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleNotify}
      disabled={loading || sent || disabled}
    >
      <Bell className="mr-2 h-4 w-4" />
      {sent ? 'Sent!' : loading ? 'Sending...' : 'Notify via Slack'}
    </Button>
  )
}
