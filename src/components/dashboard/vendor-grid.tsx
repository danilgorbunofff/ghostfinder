'use client'

import { Badge } from '@/components/ui/badge'
import type { VendorRow } from '@/lib/types'

const statusConfig = {
  active: {
    dot: 'bg-green-500',
    label: 'Active',
  },
  warning: {
    dot: 'bg-amber-500',
    label: 'Warning',
  },
  inactive: {
    dot: 'bg-red-500',
    label: 'Inactive',
  },
} as const

const avatarColors = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-blue-600',
]

function getAvatarColor(name: string) {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0)
  return avatarColors[code % avatarColors.length]
}

interface VendorGridProps {
  vendors: VendorRow[]
  totalSpend: number
  onVendorClick?: (vendor: VendorRow) => void
}

export function VendorGrid({ vendors, totalSpend, onVendorClick }: VendorGridProps) {
  if (!vendors.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up">
        <div className="relative mb-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-muted to-muted flex items-center justify-center">
            <span className="text-3xl opacity-50">👻</span>
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground">No vendors found</p>
        <p className="text-xs text-muted-foreground mt-1">Connect a data source to start tracking SaaS spend</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {vendors.map((vendor, index) => {
        const pct = totalSpend > 0 ? (vendor.monthlyCost / totalSpend) * 100 : 0
        const cfg = statusConfig[vendor.status]
        return (
          <button
            key={vendor.name}
            onClick={() => onVendorClick?.(vendor)}
            data-slot="card"
            className={`card-interactive rounded-xl border bg-card p-4 text-left transition-all animate-fade-in-up ${
              vendor.status === 'inactive' ? 'opacity-60' : ''
            }`}
            style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${getAvatarColor(vendor.name)} flex items-center justify-center shrink-0 shadow-sm`}>
                  <span className="text-white text-sm font-bold">
                    {vendor.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{vendor.name}</p>
                  {vendor.category && (
                    <p className="text-[10px] text-muted-foreground">{vendor.category}</p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px] gap-1 px-1.5 py-0">
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </Badge>
            </div>

            {/* Cost */}
            <div className="mb-3">
              <span className="text-xl font-bold tabular-nums">
                {vendor.monthlyCost > 0 ? `$${vendor.monthlyCost.toLocaleString()}` : '—'}
              </span>
              <span className="text-[11px] text-muted-foreground ml-1">/mo</span>
            </div>

            {/* Spend bar */}
            {vendor.monthlyCost > 0 && totalSpend > 0 && (
              <div className="h-1.5 w-full rounded-full bg-muted/80 overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-brand-hover transition-all duration-700"
                  style={{ width: `${Math.max(3, pct)}%` }}
                />
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{vendor.seats > 0 ? `${vendor.seats} seats` : 'No seat data'}</span>
              <span>{vendor.lastActivity}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
