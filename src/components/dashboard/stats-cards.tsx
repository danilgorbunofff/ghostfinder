'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, AlertTriangle, TrendingDown, TrendingUp, Users, Minus, Sparkles } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'

interface TrendInfo {
  value: number
  label: string
}

interface StatsCardsProps {
  totalSpend: number
  estimatedWaste: number
  opportunities: number
  totalUsers?: number
  inactiveUsers?: number
  spendTrend?: TrendInfo | null
  wasteTrend?: TrendInfo | null
}

// Synthetic sparkline data (7 points) - in production, pass real history
function generateSparkline(current: number, variance = 0.15): { v: number }[] {
  const points = 7
  const data: { v: number }[] = []
  for (let i = 0; i < points; i++) {
    const factor = 1 - variance + (variance * 2 * (i / (points - 1)))
    const jitter = 1 + (Math.sin(i * 2.1) * variance * 0.5)
    data.push({ v: Math.round(current * factor * jitter) })
  }
  data[points - 1] = { v: current } // ensure last point is exact
  return data
}

function TrendBadge({ trend }: { trend: TrendInfo | null | undefined }) {
  if (!trend) return (
    <Badge variant="outline" className="text-[10px] gap-1 bg-brand-muted/50 border-brand/20 text-brand">
      <Sparkles className="h-3 w-3" />
      First scan
    </Badge>
  )

  const isUp = trend.value > 0
  const isZero = trend.value === 0
  const Icon = isZero ? Minus : isUp ? TrendingUp : TrendingDown

  return (
    <Badge
      variant="outline"
      className={`text-[10px] gap-1 font-semibold backdrop-blur-sm ${
        isZero
          ? 'text-muted-foreground bg-muted/50'
          : isUp
          ? 'text-destructive border-destructive/30 bg-destructive/5'
          : 'text-success border-success/30 bg-success/5'
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(trend.value)}% {trend.label}
    </Badge>
  )
}

function IconBg({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className={`relative flex items-center justify-center h-10 w-10 rounded-xl ${color}`}>
      <div className={`absolute inset-0 rounded-xl ${color} opacity-20 blur-lg`} />
      <div className="relative">
        {children}
      </div>
    </div>
  )
}

function MetricNumber({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-metric animate-number-roll ${className}`}>
      {children}
    </div>
  )
}

export function StatsCards({
  totalSpend,
  estimatedWaste,
  opportunities,
  totalUsers = 0,
  inactiveUsers = 0,
  spendTrend,
  wasteTrend,
}: StatsCardsProps) {
  const spendSparkline = generateSparkline(totalSpend)
  const wasteSparkline = generateSparkline(estimatedWaste, 0.2)
  const activeUsers = totalUsers - inactiveUsers

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
      {/* Estimated Waste — Hero card, spans left side */}
      <Card className="lg:col-span-5 lg:row-span-2 relative overflow-hidden border-orange-200/60 dark:border-orange-800/40 bg-gradient-to-br from-orange-50 via-background to-background dark:from-orange-950/30 dark:via-background dark:to-background card-interactive hover:shadow-orange-500/10 animate-fade-in-up group">
        {/* Background sparkline watermark */}
        <div className="absolute bottom-0 left-0 right-0 h-24 opacity-[0.08] group-hover:opacity-[0.12] transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={wasteSparkline}>
              <defs>
                <linearGradient id="wasteGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-warning)" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="var(--color-warning)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="none" fill="url(#wasteGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <CardContent className="relative p-6 flex flex-col justify-between h-full min-h-[200px]">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Estimated Waste</p>
              <TrendBadge trend={wasteTrend} />
            </div>
            <IconBg color="bg-orange-500/10 dark:bg-orange-500/20">
              <AlertTriangle className="h-5 w-5 text-orange-500 animate-glow-pulse" />
            </IconBg>
          </div>

          <div className="mt-auto space-y-2">
            <MetricNumber className="text-orange-500 text-metric-lg">
              ${estimatedWaste.toLocaleString()}<span className="text-xl font-normal opacity-60">/mo</span>
            </MetricNumber>
            <p className="text-sm text-muted-foreground">
              Ghost seats + duplicate subscriptions
            </p>
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
              ${(estimatedWaste * 12).toLocaleString()} projected annually
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Total SaaS Spend */}
      <Card className="lg:col-span-4 relative overflow-hidden card-interactive animate-fade-in-up [animation-delay:75ms] group">
        {/* Background sparkline */}
        <div className="absolute bottom-0 left-0 right-0 h-16 opacity-[0.06] group-hover:opacity-[0.10] transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spendSparkline}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="none" fill="url(#spendGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <CardContent className="relative p-5">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Total SaaS Spend</p>
            <IconBg color="bg-brand-muted">
              <DollarSign className="h-5 w-5 text-brand" />
            </IconBg>
          </div>
          <MetricNumber>
            ${totalSpend.toLocaleString()}<span className="text-lg font-normal opacity-60">/mo</span>
          </MetricNumber>
          <div className="flex items-center gap-2 mt-2">
            <TrendBadge trend={spendTrend} />
            <span className="text-xs text-muted-foreground">Across all accounts</span>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities */}
      <Card className="lg:col-span-3 relative overflow-hidden card-interactive animate-fade-in-up [animation-delay:150ms] group">
        <CardContent className="relative p-5">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Opportunities</p>
            <IconBg color="bg-green-500/10 dark:bg-green-500/20">
              <TrendingDown className="h-5 w-5 text-green-500" />
            </IconBg>
          </div>
          <MetricNumber className="text-green-500">
            {opportunities}
          </MetricNumber>
          <p className="text-xs text-muted-foreground mt-2">
            Actionable savings identified
          </p>
        </CardContent>
      </Card>

      {/* User Activity — bottom right area */}
      <Card className="lg:col-span-7 relative overflow-hidden card-interactive animate-fade-in-up [animation-delay:225ms] group">
        <CardContent className="relative p-5">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">User Activity</p>
            <IconBg color="bg-blue-500/10 dark:bg-blue-500/20">
              <Users className="h-5 w-5 text-blue-500" />
            </IconBg>
          </div>
          {totalUsers > 0 ? (
            <div className="flex items-end gap-4">
              <div>
                <MetricNumber>
                  {activeUsers}
                  <span className="text-lg font-normal text-muted-foreground">/{totalUsers}</span>
                </MetricNumber>
                <p className="text-xs text-muted-foreground mt-1">
                  Active users
                </p>
              </div>
              {/* Activity bar visual */}
              <div className="flex-1 max-w-xs space-y-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                  <span>Active</span>
                  <span>Inactive</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-700"
                    style={{ width: `${(activeUsers / totalUsers) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {inactiveUsers} inactive (30+ days no login)
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-metric text-muted-foreground/30">—</div>
              <p className="text-sm text-muted-foreground">
                Connect an identity provider to track usage
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
