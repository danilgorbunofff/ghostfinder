'use client'

import { useState, useMemo } from 'react'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { VendorRow } from '@/lib/types'

const statusConfig = {
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-900',
  },
  warning: {
    label: 'Warning',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900',
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900',
  },
} as const

type SortKey = 'name' | 'monthlyCost' | 'seats' | 'status'
type SortDir = 'asc' | 'desc'

interface VendorTableProps {
  vendors: VendorRow[]
  totalSpend: number
}

export function VendorTable({ vendors, totalSpend }: VendorTableProps) {
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

  function SortHeader({ label, column }: { label: string; column: SortKey }) {
    const isActive = sortKey === column
    const Icon = !isActive ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
    return (
      <TableHead
        className="cursor-pointer select-none hover:text-foreground transition-colors"
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center gap-1">
          {label}
          <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
        </div>
      </TableHead>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortHeader label="Vendor" column="name" />
          <SortHeader label="Monthly Cost" column="monthlyCost" />
          <SortHeader label="Seats" column="seats" />
          <TableHead>Last Activity</TableHead>
          <SortHeader label="Status" column="status" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((vendor) => (
          <TableRow key={vendor.name}>
            <TableCell>
              <div>
                <span className="font-medium">{vendor.name}</span>
                {vendor.category && (
                  <Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">
                    {vendor.category}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="text-right">
                <span className="font-medium">
                  {vendor.monthlyCost > 0 ? `$${vendor.monthlyCost.toLocaleString()}` : '—'}
                </span>
                {vendor.monthlyCost > 0 && totalSpend > 0 && (
                  <div className="mt-1.5 h-1.5 w-full max-w-[80px] rounded-full bg-muted ml-auto">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{
                        width: `${Math.max(2, (vendor.monthlyCost / totalSpend) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right">
              {vendor.seats > 0 ? vendor.seats : '—'}
            </TableCell>
            <TableCell>{vendor.lastActivity}</TableCell>
            <TableCell>
              <Badge variant="outline" className={statusConfig[vendor.status].className}>
                {statusConfig[vendor.status].label}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
