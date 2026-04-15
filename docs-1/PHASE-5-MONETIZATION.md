# Phase 5 — Monetization & Automated Savings Notifications

> **Goal:** Implement Stripe-based billing with a two-tier model (Monitor + Recovery), build a notification engine for automated alerts (Slack + Email), and enforce feature gating across the application.

---

## Table of Contents

1. [Billing Architecture](#1-billing-architecture)
2. [Database Schema — Migration 6](#2-database-schema--migration-6)
3. [Stripe Product & Price Configuration](#3-stripe-product--price-configuration)
4. [Stripe Service Module](#4-stripe-service-module)
5. [Checkout & Billing API Routes](#5-checkout--billing-api-routes)
6. [Stripe Webhook Handler](#6-stripe-webhook-handler)
7. [Billing Page UI](#7-billing-page-ui)
8. [Feature Gating Middleware](#8-feature-gating-middleware)
9. [Notification Engine](#9-notification-engine)
10. [One-Click Notify Integration](#10-one-click-notify-integration)
11. [Paywall Enforcement Matrix](#11-paywall-enforcement-matrix)
12. [Environment Variables](#12-environment-variables)
13. [Edge Cases & Business Rules](#13-edge-cases--business-rules)
14. [Acceptance Criteria](#14-acceptance-criteria)

---

## 1. Billing Architecture

### Two-Tier Pricing Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   FREE (Trial)          MONITOR ($49/mo)        RECOVERY (20%)       │
│   ─────────────         ──────────────           ────────────        │
│                                                                      │
│   ✅ Connect bank       ✅ Everything Free       ✅ Everything Monitor│
│   ✅ Connect IdP        ✅ Weekly waste reports   ✅ Slack alerts      │
│   ✅ Single scan        ✅ Full ghost detection   ✅ Email alerts      │
│   ❌ Historical data    ✅ Duplicate detection    ✅ One-click notify  │
│   ❌ Alerts             ✅ Dashboard analytics    ✅ Recovery tracking │
│   ❌ Notifications      ❌ Alerts/notifications   ✅ ROI dashboard     │
│                                                                      │
│   Price: $0             Price: $49/month         Price: 20% of       │
│                         (flat rate)              annual savings       │
│                                                  (usage-based)       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Revenue Flow

```
  Customer ──→ Stripe Checkout ──→ Subscription Created
                                        │
                      ┌─────────────────┼────────────────┐
                      ▼                                   ▼
             Monitor ($49/mo)                    Recovery (20%)
             Fixed monthly                       Commission-based
             Stripe Billing                      Stripe Usage Records
                      │                                   │
                      ▼                                   ▼
             Recurring charge                   Metered charge based
             every 30 days                      on verified savings
```

---

## 2. Database Schema — Migration 6

**File:** `supabase/migrations/00006_subscriptions.sql`

```sql
-- ============================================================================
-- MIGRATION 6: Billing subscriptions and notification preferences
-- ============================================================================

-- ─── Subscription Tier Enum ─────────────────────────────────────────
CREATE TYPE public.subscription_tier AS ENUM ('free', 'monitor', 'recovery');

-- ─── Subscriptions Table ────────────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Stripe references
  stripe_customer_id    TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_price_id       TEXT,

  -- Tier & status
  tier                  public.subscription_tier DEFAULT 'free',
  status                TEXT DEFAULT 'active'
                        CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing')),

  -- Billing period
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT false,

  -- Recovery tier tracking
  verified_annual_savings NUMERIC(12, 2) DEFAULT 0,  -- Total savings verified
  commission_charged      NUMERIC(12, 2) DEFAULT 0,  -- Total commission collected

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_subscriptions_org_id ON public.subscriptions(org_id);
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);

-- Trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Notification Settings Table ────────────────────────────────────
CREATE TABLE public.notification_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Slack
  slack_webhook_url TEXT,
  slack_enabled     BOOLEAN DEFAULT false,

  -- Email
  email_enabled     BOOLEAN DEFAULT false,
  email_recipients  TEXT[] DEFAULT '{}',  -- Array of email addresses

  -- Preferences
  notify_on_ghost_seats   BOOLEAN DEFAULT true,
  notify_on_duplicates    BOOLEAN DEFAULT true,
  notify_threshold_amount NUMERIC(10, 2) DEFAULT 0,  -- Min waste $ to trigger alert

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_notification_settings_org_id ON public.notification_settings(org_id);

CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Notification Log ───────────────────────────────────────────────
CREATE TABLE public.notification_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id     UUID REFERENCES public.waste_reports(id) ON DELETE SET NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('slack', 'email')),
  status        TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  sent_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notification_log_org_id ON public.notification_log(org_id, sent_at DESC);

-- ─── RLS Policies ───────────────────────────────────────────────────

-- Subscriptions: Org members can read, only service_role can modify
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

-- Notification settings: Org members can read and update
CREATE POLICY "notification_settings_select_own" ON public.notification_settings
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "notification_settings_update_own" ON public.notification_settings
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "notification_settings_insert_own" ON public.notification_settings
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

-- Notification log: Org members can read
CREATE POLICY "notification_log_select_own" ON public.notification_log
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));
```

---

## 3. Stripe Product & Price Configuration

### Stripe Dashboard Setup

Create products and prices manually in the Stripe Dashboard (or via CLI):

| Product | Price | Billing | Stripe Price ID |
|---------|-------|---------|-----------------|
| **Ghost Finder Monitor** | $49.00/month | Recurring | `price_monitor_monthly` |
| **Ghost Finder Recovery** | 20% commission | Usage-based (metered) | `price_recovery_metered` |

### Stripe CLI Setup (alternative to Dashboard)

```bash
# Create Monitor product + price
stripe products create \
  --name="Ghost Finder Monitor" \
  --description="Weekly waste reports, ghost seat detection, duplicate detection"

stripe prices create \
  --product="prod_XXXXX" \
  --unit-amount=4900 \
  --currency=usd \
  --recurring[interval]=month

# Create Recovery product + price (metered)
stripe products create \
  --name="Ghost Finder Recovery" \
  --description="Automated notifications, one-click alerts, 20% of verified savings"

stripe prices create \
  --product="prod_YYYYY" \
  --currency=usd \
  --recurring[interval]=month \
  --recurring[usage_type]=metered \
  --billing-scheme=per_unit \
  --unit-amount=1  # Will report actual cents via usage records
```

### Environment Variables for Prices

```
NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID=price_XXXXXXXXXXXXX
NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID=price_YYYYYYYYYYYYY
```

---

## 4. Stripe Service Module

**File:** `src/lib/services/stripe.service.ts`

```typescript
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
})

/**
 * Create or retrieve a Stripe customer for an organization.
 */
export async function getOrCreateStripeCustomer(
  orgId: string,
  orgName: string,
  adminEmail: string
): Promise<string> {
  // Check if customer already exists (search by metadata)
  const existing = await stripe.customers.list({
    limit: 1,
    email: adminEmail,
  })

  if (existing.data.length > 0) {
    return existing.data[0].id
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: adminEmail,
    name: orgName,
    metadata: {
      org_id: orgId,
    },
  })

  return customer.id
}

/**
 * Create a Stripe Checkout session for subscription.
 *
 * @param customerId - Stripe customer ID
 * @param priceId - Stripe price ID (monitor or recovery)
 * @param orgId - Internal org ID (passed as metadata)
 * @param successUrl - Redirect after successful payment
 * @param cancelUrl - Redirect on cancellation
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  orgId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      org_id: orgId,
    },
    subscription_data: {
      metadata: {
        org_id: orgId,
      },
    },
  })

  return session
}

/**
 * Create a Stripe Billing Portal session for self-service management.
 * Allows customers to update payment method, view invoices, cancel.
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}

/**
 * Report usage for Recovery tier (metered billing).
 *
 * When verified savings are confirmed, report the commission amount
 * as a usage record on the subscription item.
 *
 * @param subscriptionItemId - Stripe subscription item ID
 * @param savingsAmount - Verified savings amount in dollars
 * @param commissionRate - Commission percentage (default 0.20 = 20%)
 */
export async function reportRecoveryUsage(
  subscriptionItemId: string,
  savingsAmount: number,
  commissionRate: number = 0.20
): Promise<void> {
  const commissionCents = Math.round(savingsAmount * commissionRate * 100)

  await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity: commissionCents,
    action: 'increment',
    timestamp: Math.floor(Date.now() / 1000),
  })
}

/**
 * Cancel a subscription at end of billing period.
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

/**
 * Reactivate a subscription that was set to cancel.
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  })
}
```

---

## 5. Checkout & Billing API Routes

### 5.1 — Create Checkout Session

**File:** `src/app/api/billing/checkout/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateStripeCustomer, createCheckoutSession } from '@/lib/services/stripe.service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { priceId } = await request.json()
  if (!priceId || typeof priceId !== 'string') {
    return NextResponse.json({ error: 'priceId is required' }, { status: 400 })
  }

  // Validate price ID against allowed values
  const allowedPrices = [
    process.env.NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID,
  ]
  if (!allowedPrices.includes(priceId)) {
    return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 })
  }

  // Get user's org
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('org_members')
    .select('org_id, organizations(name)')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(
    membership.org_id,
    (membership.organizations as any).name,
    user.email!
  )

  // Persist Stripe customer ID if new
  await admin
    .from('subscriptions')
    .upsert({
      org_id: membership.org_id,
      stripe_customer_id: customerId,
      tier: 'free',
    }, {
      onConflict: 'org_id',
      ignoreDuplicates: true,
    })

  // Create Checkout session
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
  const session = await createCheckoutSession(
    customerId,
    priceId,
    membership.org_id,
    `${origin}/billing?success=true`,
    `${origin}/billing?canceled=true`
  )

  return NextResponse.json({ url: session.url })
}
```

### 5.2 — Billing Portal

**File:** `src/app/api/billing/portal/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBillingPortalSession } from '@/lib/services/stripe.service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, org_id')
    .eq('org_id', (
      await admin
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .single()
    ).data?.org_id)
    .single()

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
  const session = await createBillingPortalSession(
    subscription.stripe_customer_id,
    `${origin}/billing`
  )

  return NextResponse.json({ url: session.url })
}
```

---

## 6. Stripe Webhook Handler

**File:** `src/app/api/webhooks/stripe/route.ts`

```typescript
import { stripe } from '@/lib/services/stripe.service'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

// Stripe sends raw body — disable body parsing
export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  // ─── 1. Verify webhook signature ─────────────────────────────────
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ─── 2. Handle relevant events ───────────────────────────────────
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.org_id
        const subscriptionId = session.subscription as string

        if (!orgId || !subscriptionId) break

        // Fetch the subscription to determine the tier
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price?.id
        const tier = determineTier(priceId)

        // Update subscription record
        await admin
          .from('subscriptions')
          .upsert({
            org_id: orgId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            tier,
            status: 'active',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          }, {
            onConflict: 'org_id',
          })

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata?.org_id
        if (!orgId) break

        const priceId = subscription.items.data[0]?.price?.id

        await admin
          .from('subscriptions')
          .update({
            status: subscription.status,
            stripe_price_id: priceId,
            tier: determineTier(priceId),
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('org_id', orgId)

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata?.org_id
        if (!orgId) break

        await admin
          .from('subscriptions')
          .update({
            status: 'canceled',
            tier: 'free',
          })
          .eq('org_id', orgId)

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string
        if (!subscriptionId) break

        await admin
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId)

        break
      }

      default:
        // Unhandled event type — ignore silently
        break
    }
  } catch (err: any) {
    console.error(`Webhook handler error for ${event.type}:`, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  // ─── 3. Always return 200 to acknowledge receipt ──────────────────
  return NextResponse.json({ received: true })
}

/**
 * Map Stripe price ID to internal tier enum.
 */
function determineTier(priceId: string | undefined): 'free' | 'monitor' | 'recovery' {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID) return 'monitor'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID) return 'recovery'
  return 'free'
}
```

### Webhook Security Checklist

| Check | Implementation |
|-------|---------------|
| **Signature verification** | `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET` |
| **Idempotency** | Stripe guarantees event IDs are unique; we upsert by `org_id` |
| **Error handling** | Always return 200 to Stripe (prevent retries for handled events) |
| **Raw body** | Use `request.text()` — Stripe requires the raw body for signature verification |
| **Metadata** | `org_id` is passed through checkout → subscription → webhook via metadata |

---

## 7. Billing Page UI

**File:** `src/app/(dashboard)/billing/page.tsx`

```typescript
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing preferences
        </p>
      </div>

      {/* Current Plan Banner */}
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
```

### UpgradeButton Component

**File:** `src/components/billing/upgrade-button.tsx`

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function UpgradeButton({
  priceId,
  planName,
}: {
  priceId: string
  planName: string
}) {
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleUpgrade}
      disabled={loading}
      className="w-full"
    >
      {loading ? 'Redirecting...' : `Upgrade to ${planName}`}
    </Button>
  )
}
```

### ManageButton Component

**File:** `src/components/billing/manage-button.tsx`

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function ManageButton() {
  const [loading, setLoading] = useState(false)

  const handleManage = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error('Portal error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleManage}
      disabled={loading}
      variant="outline"
      className="w-full"
    >
      {loading ? 'Loading...' : 'Manage Subscription'}
    </Button>
  )
}
```

### Billing Page Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ Billing                                                             │
│ Manage your subscription and billing preferences                    │
│                                                                      │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│ │  Free         │  │ ★ Monitor    │  │  Recovery     │               │
│ │  $0           │  │  $49/mo      │  │  20% savings  │               │
│ │               │  │              │  │               │               │
│ │ ✅ Connect    │  │ ✅ Everything │  │ ✅ Everything  │               │
│ │ ✅ Connect    │  │ ✅ Weekly     │  │ ✅ Slack alerts│               │
│ │ ✅ One scan   │  │ ✅ Ghost      │  │ ✅ Email       │               │
│ │ ❌ Reports    │  │ ✅ Duplicates │  │ ✅ One-click   │               │
│ │ ❌ Ghost      │  │ ✅ Dashboard  │  │ ✅ Recovery    │               │
│ │ ❌ Notifi..   │  │ ❌ Notifi..   │  │ ✅ ROI         │               │
│ │               │  │              │  │               │               │
│ │ [Current]     │  │ [Upgrade]    │  │ [Upgrade]     │               │
│ └──────────────┘  └──────────────┘  └──────────────┘               │
└────────────────────────────────────────────────────────────────────┘
```

---

## 8. Feature Gating Middleware

**File:** `src/lib/billing/gate.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js'

export type Tier = 'free' | 'monitor' | 'recovery'

/**
 * Feature gate definitions.
 *
 * Maps feature keys to the minimum tier required to access them.
 * Tiers are ordered: free < monitor < recovery.
 */
const FEATURE_GATES: Record<string, Tier> = {
  'reports.view':         'monitor',
  'reports.history':      'monitor',
  'ghost-seats.list':     'monitor',
  'duplicates.list':      'monitor',
  'notifications.slack':  'recovery',
  'notifications.email':  'recovery',
  'notifications.send':   'recovery',
  'recovery.tracking':    'recovery',
}

const TIER_LEVELS: Record<Tier, number> = {
  free: 0,
  monitor: 1,
  recovery: 2,
}

/**
 * Check if a feature is accessible for a given tier.
 */
export function hasAccess(currentTier: Tier, feature: string): boolean {
  const requiredTier = FEATURE_GATES[feature]
  if (!requiredTier) return true  // Unknown feature = allowed (fail open)

  return TIER_LEVELS[currentTier] >= TIER_LEVELS[requiredTier]
}

/**
 * Get the current tier for an organization.
 */
export async function getOrgTier(
  supabase: SupabaseClient,
  orgId: string
): Promise<Tier> {
  const { data } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('org_id', orgId)
    .single()

  if (!data || data.status === 'canceled' || data.status === 'past_due') {
    return 'free'
  }

  return (data.tier as Tier) ?? 'free'
}

/**
 * Get the required tier for a feature (for paywall messaging).
 */
export function getRequiredTier(feature: string): Tier | null {
  return FEATURE_GATES[feature] ?? null
}
```

### Usage in API Routes

```typescript
// In any API route:
import { hasAccess, getOrgTier } from '@/lib/billing/gate'

const tier = await getOrgTier(supabase, orgId)

if (!hasAccess(tier, 'notifications.send')) {
  return NextResponse.json(
    { error: 'Upgrade to Recovery plan to use notifications' },
    { status: 403 }
  )
}
```

### Usage in Server Components

```typescript
// In any page:
import { hasAccess, getOrgTier } from '@/lib/billing/gate'

const tier = await getOrgTier(supabase, orgId)
const canViewReports = hasAccess(tier, 'reports.view')

if (!canViewReports) {
  return <UpgradePrompt feature="reports.view" />
}
```

---

## 9. Notification Engine

### 9.1 — Slack Notification

**File:** `src/lib/notifications/slack.ts`

```typescript
export interface SlackWasteMessage {
  totalMonthlyWaste: number
  totalAnnualWaste: number
  ghostSeatCount: number
  duplicateCount: number
  topGhosts: { vendor: string; ghostSeats: number; monthlyWaste: number }[]
  reportUrl: string
}

/**
 * Send a waste report summary to Slack via an Incoming Webhook.
 *
 * Uses Slack's Block Kit for rich formatting.
 * Webhook URL is stored in the org's notification_settings.
 */
export async function sendSlackNotification(
  webhookUrl: string,
  message: SlackWasteMessage
): Promise<void> {
  const topGhostLines = message.topGhosts
    .slice(0, 5)
    .map((g) => `• *${g.vendor}*: ${g.ghostSeats} ghost seats ($${g.monthlyWaste}/mo)`)
    .join('\n')

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '👻 Ghost Finder — Weekly Waste Report',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Monthly Waste:*\n$${message.totalMonthlyWaste.toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Annual Projection:*\n$${message.totalAnnualWaste.toLocaleString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Ghost Seats:*\n${message.ghostSeatCount}`,
          },
          {
            type: 'mrkdwn',
            text: `*Duplicate Apps:*\n${message.duplicateCount}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Ghost Seats:*\n${topGhostLines || '_No ghost seats detected_'}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Full Report',
            },
            url: message.reportUrl,
            style: 'primary',
          },
        ],
      },
    ],
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`)
  }
}
```

### 9.2 — Email Notification

**File:** `src/lib/notifications/email.ts`

```typescript
/**
 * Send waste report via email.
 *
 * Uses Resend (recommended) or SendGrid. This example uses Resend
 * for simplicity, but the interface is provider-agnostic.
 *
 * Install: npm install resend
 */

interface EmailWasteReport {
  totalMonthlyWaste: number
  totalAnnualWaste: number
  ghostSeatCount: number
  duplicateCount: number
  reportUrl: string
}

export async function sendEmailNotification(
  recipients: string[],
  report: EmailWasteReport
): Promise<void> {
  if (recipients.length === 0) return

  // Using Resend API directly (avoids SDK dependency if preferred)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Ghost Finder <alerts@ghostfinder.app>',
      to: recipients,
      subject: `👻 SaaS Waste Alert: $${report.totalMonthlyWaste.toLocaleString()}/mo identified`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2>Weekly Waste Report</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">
                <strong>Monthly Waste</strong><br>
                <span style="font-size: 24px; color: #f97316;">
                  $${report.totalMonthlyWaste.toLocaleString()}
                </span>
              </td>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">
                <strong>Annual Projection</strong><br>
                <span style="font-size: 24px; color: #ef4444;">
                  $${report.totalAnnualWaste.toLocaleString()}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">
                <strong>Ghost Seats</strong><br>
                <span style="font-size: 24px;">${report.ghostSeatCount}</span>
              </td>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">
                <strong>Duplicate Apps</strong><br>
                <span style="font-size: 24px;">${report.duplicateCount}</span>
              </td>
            </tr>
          </table>
          <a href="${report.reportUrl}"
             style="display: inline-block; background: #3b82f6; color: white;
                    padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Full Report
          </a>
          <p style="color: #6b7280; margin-top: 20px; font-size: 14px;">
            This alert was sent by Ghost Finder. Manage notification settings in your dashboard.
          </p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Email send failed: ${error}`)
  }
}
```

### 9.3 — Notification Orchestrator

**File:** `src/lib/notifications/send.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { sendSlackNotification } from './slack'
import { sendEmailNotification } from './email'

/**
 * Send notifications for a waste report based on org preferences.
 *
 * @param adminClient - Supabase admin client (service_role)
 * @param orgId - Organization ID
 * @param reportId - Waste report ID
 */
export async function sendReportNotifications(
  adminClient: SupabaseClient,
  orgId: string,
  reportId: string
): Promise<void> {
  // 1. Check org subscription tier (notifications require Recovery)
  const { data: subscription } = await adminClient
    .from('subscriptions')
    .select('tier, status')
    .eq('org_id', orgId)
    .single()

  if (!subscription || subscription.tier !== 'recovery' || subscription.status !== 'active') {
    return  // Notifications only for Recovery tier
  }

  // 2. Get notification settings
  const { data: settings } = await adminClient
    .from('notification_settings')
    .select('*')
    .eq('org_id', orgId)
    .single()

  if (!settings) return

  // 3. Get the report data
  const { data: report } = await adminClient
    .from('waste_reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (!report) return

  // 4. Check threshold
  if (Number(report.total_monthly_waste) < Number(settings.notify_threshold_amount)) {
    await logNotification(adminClient, orgId, reportId, 'slack', 'skipped')
    return
  }

  const reportUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reports`
  const ghostSeats = (report.ghost_seats as any[]) ?? []

  // 5. Send Slack notification
  if (settings.slack_enabled && settings.slack_webhook_url) {
    try {
      await sendSlackNotification(settings.slack_webhook_url, {
        totalMonthlyWaste: Number(report.total_monthly_waste),
        totalAnnualWaste: Number(report.total_annual_waste),
        ghostSeatCount: report.ghost_seat_count,
        duplicateCount: report.duplicate_count,
        topGhosts: ghostSeats.map((g: any) => ({
          vendor: g.vendor,
          ghostSeats: g.ghostSeats,
          monthlyWaste: g.monthlyWaste,
        })),
        reportUrl,
      })
      await logNotification(adminClient, orgId, reportId, 'slack', 'sent')
    } catch (err: any) {
      await logNotification(adminClient, orgId, reportId, 'slack', 'failed', err.message)
    }
  }

  // 6. Send email notification
  if (settings.email_enabled && settings.email_recipients?.length > 0) {
    try {
      await sendEmailNotification(settings.email_recipients, {
        totalMonthlyWaste: Number(report.total_monthly_waste),
        totalAnnualWaste: Number(report.total_annual_waste),
        ghostSeatCount: report.ghost_seat_count,
        duplicateCount: report.duplicate_count,
        reportUrl,
      })
      await logNotification(adminClient, orgId, reportId, 'email', 'sent')
    } catch (err: any) {
      await logNotification(adminClient, orgId, reportId, 'email', 'failed', err.message)
    }
  }
}

async function logNotification(
  adminClient: SupabaseClient,
  orgId: string,
  reportId: string,
  channel: 'slack' | 'email',
  status: 'sent' | 'failed' | 'skipped',
  errorMessage?: string
): Promise<void> {
  await adminClient.from('notification_log').insert({
    org_id: orgId,
    report_id: reportId,
    channel,
    status,
    error_message: errorMessage,
  })
}
```

### Integration with Report Generation Cron

Update `src/app/api/cron/generate-reports/route.ts` to send notifications after report generation:

```typescript
// After successfully generating a report:
import { sendReportNotifications } from '@/lib/notifications/send'

// Inside the org processing loop, after generateWasteReport():
const report = await generateWasteReport(admin, orgId)

// Get the report ID from the database (last inserted)
const { data: savedReport } = await admin
  .from('waste_reports')
  .select('id')
  .eq('org_id', orgId)
  .order('generated_at', { ascending: false })
  .limit(1)
  .single()

if (savedReport) {
  await sendReportNotifications(admin, orgId, savedReport.id)
}
```

---

## 10. One-Click Notify Integration

Add a "Notify Inactive Users" button on the reports page. When clicked, it sends a message to the Slack channel (or email) highlighting specific ghost seats.

**File:** `src/app/api/notifications/notify-users/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgTier, hasAccess } from '@/lib/billing/gate'
import { sendSlackNotification } from '@/lib/notifications/slack'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get org membership
  const { data: membership } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  // Feature gate check
  const tier = await getOrgTier(admin, membership.org_id)
  if (!hasAccess(tier, 'notifications.send')) {
    return NextResponse.json(
      { error: 'Upgrade to Recovery plan to send notifications' },
      { status: 403 }
    )
  }

  const { vendor, ghostSeats, monthlyWaste } = await request.json()

  // Get Slack webhook
  const { data: settings } = await admin
    .from('notification_settings')
    .select('slack_webhook_url, slack_enabled')
    .eq('org_id', membership.org_id)
    .single()

  if (!settings?.slack_enabled || !settings?.slack_webhook_url) {
    return NextResponse.json(
      { error: 'Slack not configured. Set up Slack in notification settings.' },
      { status: 400 }
    )
  }

  try {
    await sendSlackNotification(settings.slack_webhook_url, {
      totalMonthlyWaste: monthlyWaste,
      totalAnnualWaste: monthlyWaste * 12,
      ghostSeatCount: ghostSeats,
      duplicateCount: 0,
      topGhosts: [{ vendor, ghostSeats, monthlyWaste }],
      reportUrl: `${process.env.NEXT_PUBLIC_APP_URL}/reports`,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

### One-Click Button Component

**File:** `src/components/reports/notify-button.tsx`

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'
import { useState } from 'react'

export function NotifyButton({
  vendor,
  ghostSeats,
  monthlyWaste,
  disabled,
}: {
  vendor: string
  ghostSeats: number
  monthlyWaste: number
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleNotify = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/notify-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor, ghostSeats, monthlyWaste }),
      })

      if (res.ok) {
        setSent(true)
      }
    } catch (err) {
      console.error('Notify error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleNotify}
      disabled={loading || sent || disabled}
    >
      <Bell className="mr-2 h-4 w-4" />
      {sent ? 'Sent!' : loading ? 'Sending...' : 'Notify via Slack'}
    </Button>
  )
}
```

---

## 11. Paywall Enforcement Matrix

### What Each Tier Can Access

| Feature | Free | Monitor ($49/mo) | Recovery (20%) |
|---------|------|-------------------|----------------|
| Connect Plaid | ✅ | ✅ | ✅ |
| Connect Okta/Google | ✅ | ✅ | ✅ |
| Dashboard (basic) | ✅ | ✅ | ✅ |
| Vendor list | ✅ (limit 3) | ✅ (all) | ✅ (all) |
| Waste report | ❌ | ✅ | ✅ |
| Reports history | ❌ | ✅ | ✅ |
| Ghost seat details | ❌ | ✅ | ✅ |
| Duplicate detection | ❌ | ✅ | ✅ |
| Cron reports | ❌ | ✅ (weekly) | ✅ (weekly) |
| Slack notifications | ❌ | ❌ | ✅ |
| Email alerts | ❌ | ❌ | ✅ |
| One-click notify | ❌ | ❌ | ✅ |
| Recovery tracking | ❌ | ❌ | ✅ |
| Billing portal | ❌ | ✅ | ✅ |

### Enforcement Points

```
┌──────────────────────────────────────────────────────────┐
│                  ENFORCEMENT LAYER                        │
│                                                           │
│  1. API Routes    → Check tier before processing         │
│  2. Server Pages  → Render paywall overlay if blocked    │
│  3. Cron Jobs     → Skip notification for non-Recovery   │
│  4. UI Components → Disable/gray out gated features      │
│                                                           │
│  Priority: Always enforce on the SERVER side.             │
│  Client-side gating is for UX only (not security).        │
└──────────────────────────────────────────────────────────┘
```

---

## 12. Environment Variables

Add these to `.env.local` and Vercel project settings:

```bash
# ─── Stripe ──────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (from Stripe Dashboard)
NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID=price_...

# ─── Email (Resend) ─────────────────────────────────────
RESEND_API_KEY=re_...

# ─── App URL ────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Update for production
```

### Stripe Test Mode vs Live

| Environment | Stripe Mode | Keys |
|-------------|-------------|------|
| Development (local) | Test | `sk_test_*`, `pk_test_*` |
| Preview (Vercel) | Test | Same test keys |
| Production (Vercel) | **Live** | `sk_live_*`, `pk_live_*` |

**Warning:** Never use live keys during development. Stripe test mode provides full API functionality with fake payments.

### Stripe Webhook Setup

```bash
# Local development: Use Stripe CLI to forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Production: Configure in Stripe Dashboard
# Endpoint URL: https://ghostfinder.app/api/webhooks/stripe
# Events to listen for:
#   - checkout.session.completed
#   - customer.subscription.updated
#   - customer.subscription.deleted
#   - invoice.payment_failed
```

---

## 13. Edge Cases & Business Rules

### 13.1 — Billing Edge Cases

| Edge Case | Handling |
|-----------|----------|
| User downgrades from Recovery → Monitor | Disable notifications, keep report access |
| Subscription goes `past_due` | Show warning banner, allow 3-day grace period before downgrading to `free` |
| User cancels subscription | `cancel_at_period_end: true` — access continues until billing period ends |
| Duplicate checkout attempts | Stripe Customer ID is reused (idempotent), prevents double subscriptions |
| Webhook arrives before checkout redirect | Works because webhook and redirect are independent — DB state is eventually consistent |
| Recovery tier commission calculation | Only charged on **verified** savings (user confirms actions taken) |
| Free tier → Recovery (skip Monitor) | Allowed — user can pick any tier |

### 13.2 — Notification Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Slack webhook URL is invalid | Catch 400/404, log as `failed` in notification_log, don't retry |
| Email bounces | Resend handles bounces — check delivery reports |
| Notification sent but report is stale | OK — notifications are point-in-time alerts, not live data |
| User removes Slack webhook | `slack_enabled` set to false, notifications are skipped |
| Threshold set too high | No notifications sent — log as `skipped` |
| Multiple orgs use same Slack webhook | Supported — each gets own message with org-specific data |

### 13.3 — Business Rules

| Rule | Implementation |
|------|---------------|
| **One subscription per org** | `UNIQUE INDEX idx_subscriptions_org_id` — enforced at DB level |
| **Notifications require Recovery** | Checked in notification orchestrator AND API routes |
| **Commission is on verified savings** | Admin manually confirms savings before metered usage is reported |
| **No refunds on commissions** | Business decision — commission is for the service, not contingent on sustained savings |
| **Trial period** | Not implemented in Phase 5 — can be added later via Stripe's `trial_period_days` |

---

## 14. Acceptance Criteria

Phase 5 is complete when **all** of the following are true:

### Stripe Billing
- [ ] Stripe customer is created on first checkout
- [ ] Checkout session redirects to Stripe-hosted payment form
- [ ] After payment, subscription record is created in `subscriptions` table
- [ ] Webhook correctly processes `checkout.session.completed` → tier update
- [ ] Webhook correctly processes `customer.subscription.updated` → status/period update
- [ ] Webhook correctly processes `customer.subscription.deleted` → downgrade to free
- [ ] Webhook correctly processes `invoice.payment_failed` → mark as past_due
- [ ] Webhook signature verification with `STRIPE_WEBHOOK_SECRET`
- [ ] Billing Portal accessible to paying customers

### Billing Page UI
- [ ] Three pricing cards with correct features listed
- [ ] Current plan highlighted with badge
- [ ] "Upgrade" button redirects to Stripe Checkout
- [ ] "Manage Subscription" button redirects to Stripe Billing Portal
- [ ] Past-due warning banner shown when payment fails

### Feature Gating
- [ ] `hasAccess()` correctly evaluates tier hierarchy (free < monitor < recovery)
- [ ] Reports page blocked for free users → upgrade prompt
- [ ] Notification endpoints blocked for non-Recovery users → 403
- [ ] Dashboard shows upgrade CTA for gated features (client-side UX)
- [ ] Server-side enforcement on all protected API routes

### Notifications — Slack
- [ ] Slack message sent via Incoming Webhook with Block Kit formatting
- [ ] Message includes: monthly waste, annual projection, ghost count, top ghosts
- [ ] "View Full Report" button links to reports page
- [ ] Failed sends logged in `notification_log` with error message
- [ ] Webhook URL stored in `notification_settings` table

### Notifications — Email
- [ ] Email sent via Resend API with HTML template
- [ ] Recipients configurable per org (array of email addresses)
- [ ] Subject line includes dollar amount of waste
- [ ] Failed sends logged in `notification_log`

### Notification Orchestrator
- [ ] Automatically sends notifications after report generation (cron integration)
- [ ] Respects `notify_threshold_amount` — skips if waste is below threshold
- [ ] Only sends to Recovery tier orgs
- [ ] Logs all notification attempts (sent, failed, skipped)

### One-Click Notify
- [ ] "Notify via Slack" button visible on ghost seat findings
- [ ] Button disabled when Slack is not configured
- [ ] Button shows "Sent!" after successful send
- [ ] Feature gated to Recovery tier (403 for lower tiers)

### Security
- [ ] Stripe webhook signature verified on every request
- [ ] Price IDs validated against allowed values before creating checkout
- [ ] Customer email comes from authenticated user (not request body)
- [ ] Notification settings have RLS (org members only)
- [ ] Notification log has RLS (org members can view their own)
- [ ] Resend API key is server-side only (not `NEXT_PUBLIC_*`)

---

## Post-Phase 5: What's Next?

With all 6 phases complete, Ghost Finder is a fully functional SaaS product:

```
Phase 0 ✅  Infrastructure (Vercel, Supabase, CI/CD)
Phase 1 ✅  Auth + Dashboard Shell
Phase 2 ✅  Financial Discovery (Plaid)
Phase 3 ✅  Usage Discovery (Okta + Google)
Phase 4 ✅  Reconciliation Engine
Phase 5 ✅  Monetization & Notifications
```

### Future Roadmap Ideas

| Feature | Complexity | Impact |
|---------|------------|--------|
| **More identity providers** (Azure AD, OneLogin) | Medium | High — larger market |
| **Direct vendor API integration** (Slack Admin, Zoom Admin) | High | High — per-vendor seat data |
| **ML-based vendor classification** | Medium | Medium — reduce curated lists |
| **Team management** (invite members, roles) | Medium | Medium — enterprise readiness |
| **CSV export** | Low | Medium — IT team workflows |
| **SOC 2 compliance** | High | High — enterprise sales |
| **White-labeling** | Medium | Medium — agency/MSP resale |
| **Mobile app** (React Native) | High | Low — B2B is desktop-first |
