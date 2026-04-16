'use client'

import { Link2, Users, RefreshCw } from 'lucide-react'

interface ConnectionStatsProps {
  totalConnections: number
  totalUsers: number
  lastSynced: string | null
}

function StatTile({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
  delay: number
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border bg-card p-3.5 card-interactive animate-fade-in-up"
      data-slot="card"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`flex items-center justify-center h-9 w-9 rounded-xl shrink-0 ${color}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold tabular-nums tracking-tight animate-number-roll">{value}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  )
}

export function ConnectionStats({ totalConnections, totalUsers, lastSynced }: ConnectionStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="connection-stats">
      <StatTile
        icon={Link2}
        label="Total Connections"
        value={String(totalConnections)}
        color="bg-brand-muted text-brand"
        delay={0}
      />
      <StatTile
        icon={Users}
        label="Users Synced"
        value={String(totalUsers)}
        color="bg-green-500/10 text-green-500 dark:bg-green-500/20"
        delay={50}
      />
      <StatTile
        icon={RefreshCw}
        label="Last Synced"
        value={lastSynced ?? 'Never'}
        color="bg-amber-500/10 text-amber-500 dark:bg-amber-500/20"
        delay={100}
      />
    </div>
  )
}
