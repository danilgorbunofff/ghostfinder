'use client'

import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { type DevActionState, useDevAction } from './use-dev-action'
import { useState, useEffect, useCallback } from 'react'
import { onDevActionEvent } from './dev-tools-events'

export function DevInspectTab() {
  const { run, loading } = useDevAction()
  const [state, setState] = useState<DevActionState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    const r = await run({ action: 'get-state' })
    if (r?.state) {
      setState(r.state)
      return
    }

    setError('State could not be loaded. Check the latest action status above, then retry.')
  }, [run])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
  useEffect(() => { refresh() }, [refresh])

  useEffect(() => onDevActionEvent((detail) => {
    if (detail.phase === 'succeeded' && detail.action !== 'get-state') {
      void refresh()
    }
  }), [refresh])

  if (error && !state) {
    return (
      <div className="space-y-3 py-4">
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-300">State unavailable</p>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{error}</p>
        </div>
        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={refresh} disabled={loading === 'get-state'}>
          {loading === 'get-state' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Retry state check
        </Button>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const EnvFlag = ({ label, value }: { label: string; value: string | boolean }) => (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-muted-foreground font-mono">{label}</span>
      {typeof value === 'boolean' ? (
        value ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-400" />
      ) : (
        <span className="text-[10px] font-mono">{value}</span>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">State</h4>
        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={refresh} disabled={loading === 'get-state'}>
          <RefreshCw className={`h-3 w-3 ${loading === 'get-state' ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* User Context */}
      <div className="rounded-lg border p-2 space-y-0.5">
        <p className="text-[10px] font-semibold">User</p>
        <p className="text-[10px] text-muted-foreground font-mono truncate">{state.user.userId}</p>
        <p className="text-[10px]">Role: <span className="font-medium capitalize">{state.user.role}</span> · Tier: <span className="font-medium capitalize">{state.subscription.tier}</span> ({state.subscription.status})</p>
      </div>

      {/* Table Counts */}
      <div className="rounded-lg border p-2">
        <p className="text-[10px] font-semibold mb-1">Table Counts</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {Object.entries(state.counts).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{key}</span>
              <span className="text-[10px] font-mono font-medium tabular-nums">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Latest Report */}
      {state.latestReport && (
        <div className="rounded-lg border p-2">
          <p className="text-[10px] font-semibold mb-1">Latest Report</p>
          <div className="space-y-0.5">
            <p className="text-[10px]">Waste: <span className="font-medium text-red-500">${state.latestReport.total_monthly_waste}/mo</span></p>
            <p className="text-[10px]">Ghost seats: {state.latestReport.ghost_seat_count} · Duplicates: {state.latestReport.duplicate_count}</p>
            <p className="text-[10px] text-muted-foreground">{new Date(state.latestReport.generated_at).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Environment */}
      <div className="rounded-lg border p-2">
        <p className="text-[10px] font-semibold mb-1">Environment</p>
        {Object.entries(state.env).map(([key, val]) => (
          <EnvFlag key={key} label={key} value={val} />
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
          <p className="text-[10px] text-amber-700 dark:text-amber-300">{error}</p>
        </div>
      )}
    </div>
  )
}
