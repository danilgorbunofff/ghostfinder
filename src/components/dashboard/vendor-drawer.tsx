'use client'

import { useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, ExternalLink, DollarSign, Users, Clock, Tag } from 'lucide-react'
import type { VendorRow } from '@/lib/types'

const statusConfig = {
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-900',
    dot: 'bg-green-500',
  },
  warning: {
    label: 'Warning',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    dot: 'bg-amber-500',
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900',
    dot: 'bg-red-500',
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

interface VendorDrawerProps {
  vendor: VendorRow | null
  totalSpend: number
  onClose: () => void
}

export function VendorDrawer({ vendor, totalSpend, onClose }: VendorDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  // Escape key
  useEffect(() => {
    if (!vendor) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [vendor, onClose])

  // Focus trap — focus the drawer when it opens
  useEffect(() => {
    if (vendor && drawerRef.current) {
      drawerRef.current.focus()
    }
  }, [vendor])

  const isOpen = vendor !== null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={vendor ? `${vendor.name} details` : undefined}
        tabIndex={-1}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-background border-l shadow-2xl transition-transform duration-300 ease-out custom-scrollbar overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {vendor && (
          <div className="p-6 space-y-6 animate-fade-in-up">
            {/* Close button */}
            <div className="flex justify-end">
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Header */}
            <div className="flex items-center gap-4">
              <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${getAvatarColor(vendor.name)} flex items-center justify-center shadow-lg`}>
                <span className="text-white text-xl font-bold">
                  {vendor.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold">{vendor.name}</h2>
                <Badge variant="outline" className={`${statusConfig[vendor.status].className} gap-1.5 mt-1`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusConfig[vendor.status].dot}`} />
                  {statusConfig[vendor.status].label}
                </Badge>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3">
              <DetailTile
                icon={DollarSign}
                label="Monthly Cost"
                value={vendor.monthlyCost > 0 ? `$${vendor.monthlyCost.toLocaleString()}` : '—'}
              />
              <DetailTile
                icon={DollarSign}
                label="Annual Cost"
                value={vendor.monthlyCost > 0 ? `$${(vendor.monthlyCost * 12).toLocaleString()}` : '—'}
              />
              <DetailTile
                icon={Users}
                label="Seats"
                value={vendor.seats > 0 ? String(vendor.seats) : '—'}
              />
              <DetailTile
                icon={Clock}
                label="Last Activity"
                value={vendor.lastActivity}
              />
            </div>

            {/* Category */}
            {vendor.category && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="h-4 w-4" />
                <span>{vendor.category}</span>
              </div>
            )}

            {/* Spend share */}
            {vendor.monthlyCost > 0 && totalSpend > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Share of total spend</p>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-brand-hover transition-all duration-700"
                    style={{ width: `${Math.max(3, (vendor.monthlyCost / totalSpend) * 100)}%` }}
                  />
                </div>
                <p className="text-right text-xs font-medium mt-1 tabular-nums">
                  {((vendor.monthlyCost / totalSpend) * 100).toFixed(1)}%
                </p>
              </div>
            )}

            {/* Cost per seat */}
            {vendor.seats > 0 && vendor.monthlyCost > 0 && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-1">Cost per Seat</p>
                <p className="text-2xl font-bold tabular-nums">
                  ${Math.round(vendor.monthlyCost / vendor.seats).toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
              </div>
            )}

            {/* Action */}
            <div className="pt-2 border-t">
              <Button variant="outline" className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                View Vendor Details
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function DetailTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border bg-card p-3" data-slot="card">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}
