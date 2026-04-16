'use client'

import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

interface SpendChartProps {
  totalSpend: number
}

// Generate 30-day synthetic data - in production, pass real time-series data
function generateMonthlyData(current: number): { day: string; spend: number }[] {
  const data: { day: string; spend: number }[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    // Simulate gradual increase with some variation
    const progress = (30 - i) / 30
    const noise = 1 + (Math.sin(i * 1.7) * 0.08)
    const spend = Math.round(current * 0.7 * progress * noise + current * 0.3)
    data.push({ day: dayLabel, spend })
  }
  data[data.length - 1].spend = current
  return data
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-foreground/10 bg-background/95 backdrop-blur-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold">
        ${payload[0].value.toLocaleString()}<span className="text-muted-foreground font-normal">/mo</span>
      </p>
    </div>
  )
}

export function SpendChart({ totalSpend }: SpendChartProps) {
  const data = generateMonthlyData(totalSpend)

  return (
    <Card className="card-interactive animate-fade-in-up [animation-delay:300ms] overflow-hidden" data-testid="spend-chart">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Spend Trend</p>
            <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-brand" />
            Monthly SaaS spend
          </div>
        </div>

        <div className="h-[200px] -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="spendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.25} />
                  <stop offset="50%" stopColor="var(--color-brand)" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--color-border)"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                interval="preserveStartEnd"
                tickCount={5}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="var(--color-brand)"
                strokeWidth={2}
                fill="url(#spendAreaGradient)"
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: 'var(--color-brand)',
                  strokeWidth: 2,
                  fill: 'var(--color-background)',
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
