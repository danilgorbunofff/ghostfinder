'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, AlertTriangle, TrendingDown, TrendingUp, Users, Minus } from 'lucide-react'

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

function TrendBadge({ trend }: { trend: TrendInfo | null | undefined }) {
  if (!trend) return <Badge variant="outline" className="text-[10px]">First scan</Badge>

  const isUp = trend.value > 0
  const isZero = trend.value === 0
  const Icon = isZero ? Minus : isUp ? TrendingUp : TrendingDown

  return (
    <Badge
      variant="outline"
      className={`text-[10px] gap-1 ${
        isZero
          ? 'text-muted-foreground'
          : isUp
          ? 'text-destructive border-destructive/30'
          : 'text-success border-success/30'
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(trend.value)}% {trend.label}
    </Badge>
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
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total SaaS Spend — 1 col */}
        <Card className="animate-fade-in-up">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total SaaS Spend</CardTitle>
            <div className="flex items-center gap-2">
              <TrendBadge trend={spendTrend} />
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-metric animate-count-up">
              ${totalSpend.toLocaleString()}<span className="text-lg font-normal">/mo</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all connected accounts
            </p>
          </CardContent>
        </Card>

        {/* Estimated Waste — 2 cols on lg, hero card */}
        <Card className="md:col-span-2 lg:col-span-2 border-orange-200 dark:border-orange-900 bg-gradient-to-br from-orange-50 to-background dark:from-orange-950/30 dark:to-background animate-fade-in-up [animation-delay:100ms]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Estimated Waste</CardTitle>
            <div className="flex items-center gap-2">
              <TrendBadge trend={wasteTrend} />
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-metric text-orange-500 animate-count-up">
              ${estimatedWaste.toLocaleString()}<span className="text-lg font-normal">/mo</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ghost seats + duplicate subscriptions ·{' '}
              <span className="font-medium text-orange-600 dark:text-orange-400">
                ${(estimatedWaste * 12).toLocaleString()} projected annually
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Optimization Opportunities — 1 col */}
        <Card className="animate-fade-in-up [animation-delay:200ms]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-metric text-green-500 animate-count-up">
              {opportunities}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Actionable savings identified
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Activity — full width row */}
      <Card className="animate-fade-in-up [animation-delay:300ms]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">User Activity</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-metric animate-count-up">
            {totalUsers > 0 ? (
              <>
                {totalUsers - inactiveUsers}
                <span className="text-lg font-normal text-muted-foreground">
                  /{totalUsers} active
                </span>
              </>
            ) : (
              '—'
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {totalUsers > 0
              ? `${inactiveUsers} inactive users (30+ days no login)`
              : 'Connect an identity provider to track usage'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
