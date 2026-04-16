'use client'

import { Card, CardContent } from '@/components/ui/card'
import { PieChart as PieChartIcon } from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'

interface VendorBreakdownProps {
  vendors: { name: string; cost: number }[]
}

const COLORS = [
  'var(--color-brand)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { percent: number } }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-foreground/10 bg-background/95 backdrop-blur-xl px-3 py-2 shadow-lg">
      <p className="text-xs font-medium">{payload[0].name}</p>
      <p className="text-sm font-semibold">
        ${payload[0].value.toLocaleString()}<span className="text-muted-foreground font-normal">/mo</span>
      </p>
      <p className="text-[10px] text-muted-foreground">{(payload[0].payload.percent * 100).toFixed(1)}%</p>
    </div>
  )
}

export function VendorBreakdown({ vendors }: VendorBreakdownProps) {
  if (!vendors.length) return null

  // Top 5 + "Other"
  const sorted = [...vendors].sort((a, b) => b.cost - a.cost)
  const top5 = sorted.slice(0, 5)
  const otherCost = sorted.slice(5).reduce((s, v) => s + v.cost, 0)
  const chartData = [
    ...top5.map(v => ({ name: v.name, value: v.cost })),
    ...(otherCost > 0 ? [{ name: 'Other', value: otherCost }] : []),
  ]
  const total = chartData.reduce((s, d) => s + d.value, 0)

  return (
    <Card className="card-interactive animate-fade-in-up [animation-delay:375ms] overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Vendor Breakdown</p>
            <p className="text-xs text-muted-foreground mt-0.5">Top {Math.min(5, vendors.length)} by spend</p>
          </div>
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex items-center gap-6">
          <div className="h-[160px] w-[160px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      opacity={0.85}
                      className="transition-opacity duration-200 hover:opacity-100"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 space-y-2">
            {chartData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="truncate flex-1 text-xs">{item.name}</span>
                <span className="text-xs font-medium tabular-nums">
                  ${item.value.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">
                  {total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
