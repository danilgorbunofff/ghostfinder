'use client'

import { Button } from '@/components/ui/button'
import { Shield, CreditCard } from 'lucide-react'
import { useDevAction } from './use-dev-action'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'

const ROLES = ['owner', 'admin', 'member', 'viewer'] as const
const TIERS = ['free', 'monitor', 'recovery'] as const

export function DevAuthTab() {
  const { run, loading } = useDevAction()
  const [currentRole, setCurrentRole] = useState<string>('owner')
  const [currentTier, setCurrentTier] = useState<string>('free')

  // Load current state on mount
  useEffect(() => {
    run({ action: 'get-state' }).then(r => {
      if (r?.state) {
        setCurrentRole(r.state.user.role)
        setCurrentTier(r.state.subscription?.tier ?? 'free')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      {/* Role Switcher */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Shield className="h-3 w-3" /> Role
        </h4>
        <div className="grid grid-cols-4 gap-1">
          {ROLES.map(role => (
            <Button
              key={role}
              size="sm"
              variant={currentRole === role ? 'default' : 'outline'}
              className="h-7 text-[10px] capitalize"
              disabled={loading === 'switch-role'}
              onClick={async () => {
                const r = await run({ action: 'switch-role', role })
                if (r) {
                  setCurrentRole(role)
                  toast.success(r.message ?? `Role -> ${role}`)
                }
              }}
            >
              {loading === 'switch-role' && currentRole !== role ? null : role}
            </Button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Controls access to connections, settings, danger zone. Refresh page to see changes.
        </p>
      </div>

      {/* Tier Switcher */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <CreditCard className="h-3 w-3" /> Subscription Tier
        </h4>
        <div className="grid grid-cols-3 gap-1">
          {TIERS.map(tier => (
            <Button
              key={tier}
              size="sm"
              variant={currentTier === tier ? 'default' : 'outline'}
              className="h-7 text-[10px] capitalize"
              disabled={loading === 'switch-tier'}
              onClick={async () => {
                const r = await run({ action: 'switch-tier', tier })
                if (r) {
                  setCurrentTier(tier)
                  toast.success(r.message ?? `Tier -> ${tier}`)
                }
              }}
            >
              {tier}
            </Button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Free: connections only. Monitor: reports + dashboard. Recovery: full features.
        </p>
      </div>
    </div>
  )
}
