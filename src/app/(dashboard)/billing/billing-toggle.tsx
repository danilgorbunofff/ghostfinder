'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Eye, Ghost, Rocket, Search, XCircle, Zap } from 'lucide-react'
import { UpgradeButton } from '@/components/billing/upgrade-button'
import { ManageButton } from '@/components/billing/manage-button'

type Plan = {
  name: string
  tier: 'free' | 'monitor' | 'recovery'
  monthlyPrice: string
  annualPrice: string
  annualMonthly: string
  description: string
  features: { label: string; included: boolean }[]
  priceId?: string
  annualPriceId?: string
  priceSubtext?: string
  popular?: boolean
}

type Usage = {
  vendorsScanned: number | unknown
  ghostSeatsFound: number
} | null

const tierConfig = {
  free: {
    icon: Zap,
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    accentBar: null,
    cardBg: '',
    checkBg: 'bg-green-500/10',
    checkColor: 'text-green-500',
    xBg: 'bg-muted',
    badge: null,
    ring: 'ring-brand',
    currentBadge: 'border-brand/30 text-brand',
    statBg: 'bg-muted/60',
    statIconBg: 'bg-brand-muted',
    statIconColor: 'text-brand',
  },
  monitor: {
    icon: Eye,
    iconBg: 'bg-brand-muted',
    iconColor: 'text-brand',
    accentBar: 'bg-gradient-to-r from-brand via-brand-hover to-brand/30',
    cardBg: 'bg-gradient-to-br from-brand/[0.04] via-transparent to-transparent dark:from-brand/[0.08]',
    checkBg: 'bg-green-500/10',
    checkColor: 'text-green-500',
    xBg: 'bg-muted',
    badge: { label: 'Recommended', className: 'bg-brand/10 text-brand border-brand/20' },
    ring: 'ring-brand',
    currentBadge: 'border-brand/30 text-brand',
    statBg: 'bg-brand/[0.06] dark:bg-brand/[0.1]',
    statIconBg: 'bg-brand-muted',
    statIconColor: 'text-brand',
  },
  recovery: {
    icon: Rocket,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    accentBar: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500/30',
    cardBg: 'bg-gradient-to-br from-amber-500/[0.05] via-orange-500/[0.02] to-transparent dark:from-amber-500/[0.08] dark:via-orange-500/[0.04]',
    checkBg: 'bg-amber-500/10',
    checkColor: 'text-amber-500',
    xBg: 'bg-muted',
    badge: { label: 'Maximum Savings', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
    ring: 'ring-amber-500',
    currentBadge: 'border-amber-500/30 text-amber-600 dark:text-amber-400',
    statBg: 'bg-amber-500/[0.06] dark:bg-amber-500/[0.1]',
    statIconBg: 'bg-amber-500/10',
    statIconColor: 'text-amber-500',
  },
} as const

export function BillingToggle({
  plans,
  currentTier,
  isPaidPlan,
  usage,
}: {
  plans: Plan[]
  currentTier: string
  isPaidPlan: boolean
  usage: Usage
}) {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly')
  const isAnnual = period === 'annual'

  return (
    <>
      {/* Monthly / Annual Toggle */}
      <div className="flex items-center justify-center mb-8 animate-fade-in-up">
        <div className="relative flex items-center rounded-full bg-muted p-1">
          <div
            className="absolute top-1 bottom-1 rounded-full bg-foreground shadow-sm transition-all duration-300 ease-out"
            style={{
              left: isAnnual ? 'calc(50%)' : '4px',
              width: 'calc(50% - 4px)',
            }}
          />
          <button
            className={`relative z-10 px-5 py-1.5 text-sm font-medium rounded-full transition-colors duration-300 ${
              !isAnnual ? 'text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setPeriod('monthly')}
            data-testid="billing-monthly"
          >
            Monthly
          </button>
          <button
            className={`relative z-10 px-5 py-1.5 text-sm font-medium rounded-full transition-colors duration-300 ${
              isAnnual ? 'text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setPeriod('annual')}
            data-testid="billing-annual"
          >
            Annual
          </button>
        </div>
        <Badge
          className={`ml-3 bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900 transition-all duration-300 ${
            isAnnual ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
        >
          Save 15%
        </Badge>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 md:grid-cols-3 items-stretch">
        {plans.map((plan, idx) => {
          const isCurrent = plan.tier === currentTier
          const displayPrice = isAnnual ? plan.annualMonthly : plan.monthlyPrice
          const activePriceId = isAnnual
            ? (plan.annualPriceId ?? plan.priceId)
            : plan.priceId
          const config = tierConfig[plan.tier]
          const isMonitor = plan.tier === 'monitor'

          return (
            <Card
              key={plan.tier}
              className={`card-interactive animate-fade-in-up h-full ${config.cardBg} ${
                isCurrent ? `ring-2 ${config.ring}` : plan.tier === 'free' ? 'opacity-85' : ''
              } ${isMonitor ? 'md:scale-[1.03] shadow-lg border-brand/20' : ''}`}
              style={{ animationDelay: `${idx * 80}ms` }}
              data-testid={`plan-${plan.tier}`}
            >
              {/* Accent bar */}
              {config.accentBar && (
                <div className={`h-1 ${config.accentBar} rounded-t-xl -mt-4 mx-[-1px]`} />
              )}

              <PlanCardContent
                plan={plan}
                config={config}
                displayPrice={displayPrice}
                isAnnual={isAnnual}
                isCurrent={isCurrent}
                isPaidPlan={isPaidPlan}
                activePriceId={activePriceId}
                usage={usage}
              />
            </Card>
          )
        })}
      </div>
    </>
  )
}

type TierConfig = typeof tierConfig[keyof typeof tierConfig]

function PlanCardContent({
  plan,
  config,
  displayPrice,
  isAnnual,
  isCurrent,
  isPaidPlan,
  activePriceId,
  usage,
}: {
  plan: Plan
  config: TierConfig
  displayPrice: string
  isAnnual: boolean
  isCurrent: boolean
  isPaidPlan: boolean
  activePriceId?: string
  usage: Usage
}) {
  const Icon = config.icon

  return (
    <>
      <CardHeader className="space-y-3">
        {/* Icon tile + badge row */}
        <div className="flex items-center justify-between">
          <div className={`h-10 w-10 rounded-xl ${config.iconBg} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          {config.badge && (
            <Badge variant="outline" className={config.badge.className}>
              {config.badge.label}
            </Badge>
          )}
        </div>

        <div>
          <CardTitle>{plan.name}</CardTitle>
          <CardDescription className="mt-0.5">{plan.description}</CardDescription>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1 pt-1">
          <span className="text-4xl font-bold tabular-nums tracking-tight" key={displayPrice}>
            {displayPrice}
          </span>
          {plan.tier !== 'free' && (
            <span className="text-sm text-muted-foreground">
              {plan.priceSubtext ? ` ${plan.priceSubtext}` : '/mo'}
            </span>
          )}
          {isAnnual && plan.monthlyPrice !== plan.annualMonthly && (
            <span className="ml-2 text-sm line-through text-muted-foreground">
              {plan.monthlyPrice}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 gap-4">
        {/* Feature list */}
        <ul className="space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature.label} className="flex items-center gap-2.5">
              {feature.included ? (
                <span className={`h-5 w-5 rounded-md ${config.checkBg} flex items-center justify-center shrink-0`}>
                  <CheckCircle className={`h-3.5 w-3.5 ${config.checkColor}`} />
                </span>
              ) : (
                <span className={`h-5 w-5 rounded-md ${config.xBg} flex items-center justify-center shrink-0`}>
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              )}
              <span className={`text-sm ${feature.included ? '' : 'text-muted-foreground'}`}>
                {feature.label}
              </span>
            </li>
          ))}
        </ul>

        {/* Current plan state */}
        <div className="mt-auto">
          {isCurrent ? (
            <div className="space-y-3 pt-4 border-t">
              <Badge
                variant="outline"
                className={`w-full justify-center h-8 gap-1.5 ${config.currentBadge}`}
              >
                <CheckCircle className="h-3 w-3" />
                Current Plan
              </Badge>

              {usage && (
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-xl p-2.5 text-center ${config.statBg}`}>
                    <div className={`h-6 w-6 rounded-lg mx-auto mb-1.5 flex items-center justify-center ${config.statIconBg}`}>
                      <Search className={`h-3 w-3 ${config.statIconColor}`} />
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {String(usage.vendorsScanned)}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Vendors scanned</p>
                  </div>
                  <div className={`rounded-xl p-2.5 text-center ${config.statBg}`}>
                    <div className="h-6 w-6 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-orange-500/10">
                      <Ghost className="h-3 w-3 text-orange-500" />
                    </div>
                    <div className="text-lg font-bold text-orange-500 tabular-nums">
                      {usage.ghostSeatsFound}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Ghost seats found</p>
                  </div>
                </div>
              )}

              {isPaidPlan && <ManageButton />}
            </div>
          ) : activePriceId ? (
            <UpgradeButton priceId={activePriceId} planName={plan.name} />
          ) : null}
        </div>
      </CardContent>
    </>
  )
}
