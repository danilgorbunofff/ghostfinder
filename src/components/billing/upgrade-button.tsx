'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function UpgradeButton({
  priceId,
  planName,
}: {
  priceId: string
  planName: string
}) {
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleUpgrade}
      disabled={loading}
      className="w-full"
    >
      {loading ? 'Redirecting...' : `Upgrade to ${planName}`}
    </Button>
  )
}
