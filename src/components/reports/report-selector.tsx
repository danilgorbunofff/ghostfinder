'use client'

import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from 'lucide-react'

interface ReportSelectorProps {
  reports: { id: string; generated_at: string; total_monthly_waste: number }[]
  currentId: string
}

export function ReportSelector({ reports, currentId }: ReportSelectorProps) {
  const router = useRouter()

  return (
    <Select
      value={currentId}
      onValueChange={(id) => {
        router.push(`/reports?reportId=${id}`)
      }}
    >
      <SelectTrigger className="w-[260px] gap-2" data-testid="report-selector">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <SelectValue placeholder="Select report" />
      </SelectTrigger>
      <SelectContent>
        {reports.map((r, i) => {
          const waste = Number(r.total_monthly_waste)
          const isActive = r.id === currentId
          return (
            <SelectItem key={r.id} value={r.id} className={isActive ? 'font-medium' : ''}>
              <span>
                {new Date(r.generated_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {i === 0 && (
                  <span className="ml-1.5 text-[10px] text-brand font-medium">(Latest)</span>
                )}
              </span>
              <span className={`ml-2 tabular-nums ${waste > 500 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                · ${waste.toLocaleString()}
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
