'use client'

import { Button } from '@/components/ui/button'
import { Loader2, Plug, ToggleLeft } from 'lucide-react'
import { useDevAction } from './use-dev-action'
import { toast } from 'sonner'
import { useState } from 'react'

export function DevConnectionsTab() {
  const { run, loading } = useDevAction()
  const [plaidName, setPlaidName] = useState('Chase Bank')
  const [plaidStatus, setPlaidStatus] = useState('active')
  const [googleUsers, setGoogleUsers] = useState(40)
  const [googleInactive, setGoogleInactive] = useState(0.25)
  const [oktaUsers, setOktaUsers] = useState(45)
  const [oktaInactive, setOktaInactive] = useState(0.2)

  return (
    <div className="space-y-3">
      {/* Plaid */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bank (Plaid)</h4>
        <div className="space-y-1.5">
          <input
            value={plaidName}
            onChange={e => setPlaidName(e.target.value)}
            placeholder="Institution name"
            className="w-full h-7 rounded border bg-background px-2 text-xs"
          />
          <div className="flex gap-1.5">
            <select
              value={plaidStatus}
              onChange={e => setPlaidStatus(e.target.value)}
              className="flex-1 h-7 rounded border bg-background px-1.5 text-xs"
            >
              <option value="active">Active</option>
              <option value="syncing">Syncing</option>
              <option value="error">Error</option>
              <option value="disabled">Disabled</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              disabled={loading === 'simulate-plaid'}
              onClick={async () => {
                const r = await run({ action: 'simulate-plaid', institutionName: plaidName, status: plaidStatus })
                if (r) toast.success(r.message ?? `Simulated ${plaidName}`)
              }}
            >
              {loading === 'simulate-plaid' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Google Workspace */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Google Workspace</h4>
        <div className="flex gap-1.5 items-center">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-muted-foreground">Users</label>
            <input type="number" min={1} max={200} value={googleUsers} onChange={e => setGoogleUsers(Number(e.target.value))} className="w-full h-7 rounded border bg-background px-2 text-xs" />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-muted-foreground">Inactive %</label>
            <input type="number" min={0} max={1} step={0.05} value={googleInactive} onChange={e => setGoogleInactive(Number(e.target.value))} className="w-full h-7 rounded border bg-background px-2 text-xs" />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs gap-1.5 mt-1.5"
          disabled={loading === 'simulate-google'}
          onClick={async () => {
            const r = await run({ action: 'simulate-google', totalUsers: googleUsers, inactiveRatio: googleInactive })
            if (r) toast.success(r.message ?? 'Simulated Google Workspace')
          }}
        >
          {loading === 'simulate-google' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ToggleLeft className="h-3 w-3" />}
          Simulate Google
        </Button>
      </div>

      {/* Okta */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Okta</h4>
        <div className="flex gap-1.5 items-center">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-muted-foreground">Users</label>
            <input type="number" min={1} max={200} value={oktaUsers} onChange={e => setOktaUsers(Number(e.target.value))} className="w-full h-7 rounded border bg-background px-2 text-xs" />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-muted-foreground">Inactive %</label>
            <input type="number" min={0} max={1} step={0.05} value={oktaInactive} onChange={e => setOktaInactive(Number(e.target.value))} className="w-full h-7 rounded border bg-background px-2 text-xs" />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs gap-1.5 mt-1.5"
          disabled={loading === 'simulate-okta'}
          onClick={async () => {
            const r = await run({ action: 'simulate-okta', totalUsers: oktaUsers, inactiveRatio: oktaInactive })
            if (r) toast.success(r.message ?? 'Simulated Okta')
          }}
        >
          {loading === 'simulate-okta' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ToggleLeft className="h-3 w-3" />}
          Simulate Okta
        </Button>
      </div>
    </div>
  )
}
