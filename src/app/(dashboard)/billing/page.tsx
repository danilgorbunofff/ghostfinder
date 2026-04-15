import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle } from 'lucide-react'
import { UpgradeButton } from '@/components/billing/upgrade-button'
import { ManageButton } from '@/components/billing/manage-button'

const PLANS = [
  {
    name: 'Free',
    tier: 'free' as const,
    price: '$0',
    description: 'Get started with a single scan',
    features: [
      { label: 'Connect bank account', included: true },
      { label: 'Connect identity provider', included: true },
      { label: 'One-time waste scan', included: true },
      { label: 'Weekly reports', included: false },
      { label: 'Ghost seat detection', included: false },
      { label: 'Notifications & alerts', included: false },
    ],
  },
  {
    name: 'Monitor',
    tier: 'monitor' as const,
    price: '$49/mo',
    priceId: process.env.NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID,
    description: 'Full visibility into SaaS waste',
    features: [
      { label: 'Everything in Free', included: true },
      { label: 'Weekly waste reports', included: true },
      { label: 'Full ghost seat detection', included: true },
      { label: 'Duplicate detection', included: true },
      { label: 'Dashboard analytics', included: true },
      { label: 'Notifications & alerts', included: false },
    ],
    popular: true,
  },
  {
    name: 'Recovery',
    tier: 'recovery' as const,
    price: '20% of savings',
    priceId: process.env.NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID,
    description: 'We help you act on findings',
    features: [
      { label: 'Everything in Monitor', included: true },
      { label: 'Slack alerts', included: true },
      { label: 'Email notifications', included: true },
      { label: 'One-click notify inactive users', included: true },
      { label: 'Recovery tracking', included: true },
      { label: 'ROI dashboard', included: true },
    ],
  },
]

export default async function BillingPage() {
  const supabase = await createClient()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .single()

  const currentTier = subscription?.tier ?? 'free'
  const isPaidPlan = currentTier !== 'free'

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Manage your subscription and billing preferences
      </p>

      {/* Past-due Warning Banner */}
      {subscription?.status === 'past_due' && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950">
          <CardContent className="py-4">
            <p className="text-red-700 dark:text-red-300 font-medium">
              Your payment failed. Please update your payment method to continue access.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pricing Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentTier
          return (
            <Card
              key={plan.tier}
              className={`relative ${
                plan.popular ? 'border-primary shadow-lg' : ''
              } ${isCurrent ? 'ring-2 ring-primary' : ''}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <p className="text-3xl font-bold">{plan.price}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature.label} className="flex items-center gap-2">
                      {feature.included ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={feature.included ? '' : 'text-muted-foreground'}>
                        {feature.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="space-y-2">
                    <Badge variant="outline" className="w-full justify-center">
                      Current Plan
                    </Badge>
                    {isPaidPlan && <ManageButton />}
                  </div>
                ) : plan.priceId ? (
                  <UpgradeButton priceId={plan.priceId} planName={plan.name} />
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
