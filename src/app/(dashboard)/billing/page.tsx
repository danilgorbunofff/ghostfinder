import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertAction } from '@/components/ui/alert'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { AlertTriangle } from 'lucide-react'
import { ManageButton } from '@/components/billing/manage-button'
import { BillingToggle } from './billing-toggle'
import { getServerOrgContext } from '@/lib/supabase/server-org'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Billing | GhostFinder',
  description: 'Manage your subscription and billing preferences.',
}

export const dynamic = 'force-dynamic'

const PLANS = [
  {
    name: 'Free',
    tier: 'free' as const,
    monthlyPrice: '$0',
    annualPrice: '$0',
    annualMonthly: '$0',
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
    monthlyPrice: '$49',
    annualPrice: '$499',
    annualMonthly: '$42',
    priceId: process.env.NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID,
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_MONITOR_ANNUAL_PRICE_ID,
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
    monthlyPrice: '20%',
    annualPrice: '15%',
    annualMonthly: '15%',
    priceId: process.env.NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID,
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_RECOVERY_ANNUAL_PRICE_ID,
    priceSubtext: 'of verified savings',
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

const FAQ_ITEMS = [
  {
    q: 'What is a ghost seat?',
    a: 'A ghost seat is a paid software license assigned to a user who is no longer active — they haven\'t logged in or used the tool within a defined period. You\'re paying for access nobody is using.',
  },
  {
    q: 'How does the Monitor plan work?',
    a: 'The Monitor plan continuously scans your connected bank accounts and identity providers to detect SaaS waste. You get weekly reports highlighting ghost seats, duplicate subscriptions, and spending trends.',
  },
  {
    q: 'Can I downgrade later?',
    a: 'Yes. Go to Manage Subscription and switch to a lower tier. Your current plan features will remain active until the end of the billing period.',
  },
  {
    q: 'How is billing handled?',
    a: 'We use Stripe for secure payment processing. Monitor plans are billed monthly or annually. Recovery plans charge a percentage of verified savings — if we don\'t find waste, you don\'t pay.',
  },
]

export default async function BillingPage() {
  const { admin, orgId } = await getServerOrgContext()

  const { data: subscription, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (subscriptionError) {
    throw new Error(`Failed to load subscription: ${subscriptionError.message}`)
  }

  const currentTier = subscription?.tier ?? 'free'
  const isPaidPlan = currentTier !== 'free'

  // Fetch usage stats for current plan display
  const { data: latestReport, error: latestReportError } = await admin
    .from('waste_reports')
    .select('ghost_seat_count, report_metadata')
    .eq('org_id', orgId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestReportError) {
    throw new Error(`Failed to load latest report: ${latestReportError.message}`)
  }

  const usage = latestReport
    ? {
        vendorsScanned:
          (latestReport.report_metadata as Record<string, unknown>)
            ?.vendorsAnalyzed ?? 0,
        ghostSeatsFound: latestReport.ghost_seat_count ?? 0,
      }
    : null

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground animate-fade-in-up">
        Manage your subscription and billing preferences
      </p>

      {/* Past-due Warning Banner */}
      {subscription?.status === 'past_due' && (
        <Alert variant="destructive" className="sticky top-0 z-20 border-l-4 border-l-red-500 animate-fade-in-up" data-testid="past-due-banner">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <AlertTriangle className="h-4 w-4" />
          </div>
          <AlertDescription>
            <strong>Payment failed.</strong> Update your payment method to
            maintain access to your plan features.
          </AlertDescription>
          <AlertAction>
            <ManageButton
              variant="outline"
              size="sm"
              className="shrink-0"
            />
          </AlertAction>
        </Alert>
      )}

      {/* Monthly / Annual Toggle */}
      <BillingToggle plans={PLANS} currentTier={currentTier} isPaidPlan={isPaidPlan} usage={usage} />

      {/* FAQ */}
      <Card className="card-interactive animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion multiple={false}>
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i}>
                <AccordionTrigger className="hover:text-brand transition-colors">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
