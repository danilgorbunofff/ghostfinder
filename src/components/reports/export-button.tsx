'use client'

import type { DuplicateFinding } from '@/lib/reconciliation/duplicate-detector'
import type { GhostSeatFinding } from '@/lib/reconciliation/ghost-detector'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface ExportButtonProps {
  ghostSeats: GhostSeatFinding[]
  duplicates: DuplicateFinding[]
  reportDate: string
}

export function ExportButton({ ghostSeats, duplicates, reportDate }: ExportButtonProps) {
  const handleExport = () => {
    const rows: string[][] = []

    // Header
    rows.push(['Type', 'Vendor', 'Category', 'Ghost Seats', 'Monthly Waste', 'Max Days Inactive'])

    // Ghost seat findings
    for (const g of ghostSeats) {
      const maxDays = g.inactiveUsers.reduce((max, user) => {
        const d = user.daysSinceLogin ?? 0
        return d > max ? d : max
      }, 0)

      rows.push([
        'Ghost Seats',
        g.vendor,
        '',
        String(g.ghostSeats),
        String(g.monthlyWaste),
        String(maxDays),
      ])
    }

    // Duplicate findings
    for (const d of duplicates) {
      const vendorNames = d.vendors.map((vendor) => vendor.name).join(' + ')

      rows.push([
        'Duplicate',
        vendorNames,
        d.category,
        '',
        String(d.potentialSavings),
        '',
      ])
    }

    // Build CSV
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const date = new Date(reportDate).toISOString().slice(0, 10)

    const a = document.createElement('a')
    a.href = url
    a.download = `ghostfinder-report-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleExport}
      data-testid="export-report"
    >
      <Download className="h-4 w-4" />
      Export
    </Button>
  )
}
