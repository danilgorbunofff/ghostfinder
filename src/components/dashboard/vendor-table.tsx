'use client'

import { useState, useMemo } from 'react'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react'
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

// Color palette for vendor avatars keyed on first char
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

function getActivityColor(activity: string): string {
  if (activity === 'Never') return 'text-red-500'
  if (activity === 'Today' || activity === '1 day ago') return 'text-green-600 dark:text-green-400'
  const match = activity.match(/^(\d+)\s+days?\s+ago$/)
  if (match) {
    const days = parseInt(match[1], 10)
    if (days <= 7) return 'text-green-600 dark:text-green-400'
    if (days <= 30) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-500'
  }
  return 'text-muted-foreground'
}

function getRowStatusClass(status: 'active' | 'inactive' | 'warning'): string {
  switch (status) {
    case 'inactive': return 'opacity-60 border-l-red-400/60'
    case 'warning': return 'border-l-amber-400/60'
    default: return 'border-l-transparent'
  }
}

type SortKey = 'name' | 'monthlyCost' | 'seats' | 'status'
type SortDir = 'asc' | 'desc'

function SortHeader({ label, column, align, sortKey, sortDir, onSort }: {
  label: string
  column: SortKey
  align?: 'right'
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}) {
  const isActive = sortKey === column
  const Icon = !isActive ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(column)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSort(column)
        }
      }}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
      </div>
    </TableHead>
  )
}

interface VendorTableProps {
  vendors: VendorRow[]
  totalSpend: number
  onVendorClick?: (vendor: VendorRow) => void
}

export function VendorTable({ vendors, totalSpend, onVendorClick }: VendorTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('monthlyCost')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    return [...vendors].sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'name':
          return mult * a.name.localeCompare(b.name)
        case 'monthlyCost':
          return mult * (a.monthlyCost - b.monthlyCost)
        case 'seats':
          return mult * (a.seats - b.seats)
        case 'status':
          return mult * a.status.localeCompare(b.status)
        default:
          return 0
      }
    })
  }, [vendors, sortKey, sortDir])

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
    <Table data-testid="vendor-table">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <SortHeader label="Vendor" column="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortHeader label="Monthly Cost" column="monthlyCost" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortHeader label="Seats" column="seats" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <TableHead>Last Activity</TableHead>
          <SortHeader label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((vendor, index) => (
          <TableRow
            key={vendor.name}
            data-testid="vendor-row"
            className={`group/row animate-fade-in-up transition-colors hover:bg-brand-muted/30 border-l-2 hover:border-l-brand cursor-pointer ${getRowStatusClass(vendor.status)}`}
            style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            onClick={() => onVendorClick?.(vendor)}
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${getAvatarColor(vendor.name)} flex items-center justify-center shrink-0 shadow-sm`}>
                  <span className="text-white text-xs font-bold">
                    {vendor.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="font-medium">{vendor.name}</span>
                  {vendor.category && (
                    <Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">
                      {vendor.category}
                    </Badge>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-right">
                <span className="font-semibold tabular-nums">
                  {vendor.monthlyCost > 0 ? `$${vendor.monthlyCost.toLocaleString()}/mo` : '—'}
                </span>
                {vendor.monthlyCost > 0 && totalSpend > 0 && (
                  <div className="mt-1.5 h-2 w-full max-w-[80px] rounded-full bg-muted/80 ml-auto overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-brand-hover transition-all duration-700"
                      style={{
                        width: `${Math.max(3, (vendor.monthlyCost / totalSpend) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {vendor.seats > 0 ? vendor.seats : '—'}
            </TableCell>
            <TableCell className={`text-sm ${getActivityColor(vendor.lastActivity)}`}>{vendor.lastActivity}</TableCell>
            <TableCell>
              <Badge variant="outline" className={`${statusConfig[vendor.status].className} gap-1.5`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusConfig[vendor.status].dot}`} />
                {statusConfig[vendor.status].label}
              </Badge>
            </TableCell>
            <TableCell>
              <button className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
