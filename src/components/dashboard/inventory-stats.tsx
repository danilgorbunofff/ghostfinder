'use client'

import { Package, CheckCircle2, DollarSign, Calculator } from 'lucide-react'

interface InventoryStatsProps {
  totalVendors: number
  activeVendors: number
  totalSpend: number
  avgCost: number
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

export function InventoryStats({ totalVendors, activeVendors, totalSpend, avgCost }: InventoryStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatTile
        icon={Package}
        label="Total Vendors"
        value={String(totalVendors)}
        color="bg-brand-muted text-brand"
        delay={0}
      />
      <StatTile
        icon={CheckCircle2}
        label="Active"
        value={String(activeVendors)}
        color="bg-green-500/10 text-green-500 dark:bg-green-500/20"
        delay={50}
      />
      <StatTile
        icon={DollarSign}
        label="Monthly Spend"
        value={`$${totalSpend >= 1000 ? `${(totalSpend / 1000).toFixed(1)}k` : totalSpend.toLocaleString()}`}
        color="bg-blue-500/10 text-blue-500 dark:bg-blue-500/20"
        delay={100}
      />
      <StatTile
        icon={Calculator}
        label="Avg / Vendor"
        value={`$${avgCost >= 1000 ? `${(avgCost / 1000).toFixed(1)}k` : avgCost.toLocaleString()}`}
        color="bg-orange-500/10 text-orange-500 dark:bg-orange-500/20"
        delay={150}
      />
    </div>
  )
}
