'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function ManageButton() {
  const [loading, setLoading] = useState(false)

  const handleManage = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error('Portal error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleManage}
      disabled={loading}
      variant="outline"
      className="w-full"
    >
      {loading ? 'Loading...' : 'Manage Subscription'}
    </Button>
  )
}
