# Phase 7 — Billing Page

> **Priority:** Medium — revenue-critical conversion page  
> **Estimated scope:** 3 files modified, 0 new files created  
> **Dependencies:** Phase 0 (brand tokens)

---

## Objective

Transform the billing page from a flat 3-column card grid into a conversion-optimized pricing page with clear tier hierarchy, visual anchoring on the recommended plan, usage context for current subscribers, and friction-reducing confirmation flows. This is the page that drives revenue — every UX improvement maps directly to conversion rate.

---

## Current State Assessment

| Area | Current | Problem |
|---|---|---|
| Tier hierarchy | All 3 cards have equal visual weight | No clear recommended path; users must read every feature list to decide |
| Monitor card | Has `border-primary shadow-lg` + "Most Popular" badge | In achromatic theme, `border-primary` is dark gray — barely distinguishable |
| Recovery card | Same white card as others | Premium tier should feel premium — currently identical to Free |
| Annual pricing | Not available | No annual discount toggle — common conversion lever left unused |
| Current plan | "Current Plan" outline badge | No usage context — "you've found 12 ghost seats this month" would reinforce value |
| Past-due banner | Red-bordered card with text | Easy to scroll past; no inline action button |
| Upgrade flow | Direct redirect to Stripe Checkout | No confirmation — users might click accidentally; no plan comparison |
| FAQ | None | Common questions (refunds, downgrades, data retention) go unanswered |
| Plan features | Plain list with check/x icons | No grouping; long scan to compare across tiers |

---

## Implementation Steps

### Step 1 — Add Monthly/Annual Toggle

Add a segmented control above the pricing grid:

```tsx
'use client'

import { useState } from 'react'

function BillingToggle({
  period,
  onChange,
}: {
  period: 'monthly' | 'annual'
  onChange: (p: 'monthly' | 'annual') => void
}) {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      <button
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          period === 'monthly'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => onChange('monthly')}
      >
        Monthly
      </button>
      <button
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors relative ${
          period === 'annual'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => onChange('annual')}
      >
        Annual
        <span className="absolute -top-2 -right-4 text-[10px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
          -15%
        </span>
      </button>
    </div>
  )
}
```

Update the PLANS array with annual prices:

```tsx
const PLANS = [
  {
    name: 'Free',
    tier: 'free' as const,
    monthlyPrice: '$0',
    annualPrice: '$0',
    annualMonthly: '$0',
    // ... features
  },
  {
    name: 'Monitor',
    tier: 'monitor' as const,
    monthlyPrice: '$49',
    annualPrice: '$499',
    annualMonthly: '$42',  // ~15% off
    priceId: process.env.NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID,
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_MONITOR_ANNUAL_PRICE_ID,
    // ... features
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
    // ... features
  },
]
```

### Step 2 — Apply Visual Tier Hierarchy

Differentiate each plan card visually:

```tsx
{/* Free — muted/subtle */}
<Card className={`relative ${isCurrent ? 'ring-2 ring-brand' : 'opacity-80'}`}>
  {/* No special styling — intentionally plain */}
</Card>

{/* Monitor — featured/recommended */}
<Card className={`relative border-brand shadow-lg scale-[1.02] ${
  isCurrent ? 'ring-2 ring-brand' : ''
}`}>
  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-brand-foreground">
    Recommended
  </Badge>
  {/* Brand gradient at top */}
  <div className="h-1 bg-gradient-to-r from-brand to-brand/50 rounded-t-lg" />
</Card>

{/* Recovery — premium/dark */}
<Card className={`relative bg-foreground text-background ${
  isCurrent ? 'ring-2 ring-brand' : ''
}`}>
  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black">
    Maximum Savings
  </Badge>
  {/* Invert all inner text colors */}
</Card>
```

### Step 3 — Show Current Plan Usage Stats

When displaying the current plan card, add inline usage context:

```tsx
{isCurrent && (
  <div className="space-y-2 mt-4 pt-4 border-t">
    <Badge variant="outline" className="w-full justify-center border-brand text-brand">
      Current Plan
    </Badge>

    {/* Usage stats (passed from server) */}
    {usage && (
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="rounded-lg bg-muted p-2 text-center">
          <div className="text-lg font-bold">{usage.vendorsScanned}</div>
          <p className="text-[10px] text-muted-foreground">Vendors scanned</p>
        </div>
        <div className="rounded-lg bg-muted p-2 text-center">
          <div className="text-lg font-bold text-orange-500">{usage.ghostSeatsFound}</div>
          <p className="text-[10px] text-muted-foreground">Ghost seats found</p>
        </div>
      </div>
    )}

    {isPaidPlan && <ManageButton />}
  </div>
)}
```

Add usage data query in the server component:

```tsx
// Fetch usage stats for current plan display
const { data: latestReport } = await supabase
  .from('waste_reports')
  .select('ghost_seat_count, report_metadata')
  .order('generated_at', { ascending: false })
  .limit(1)
  .single()

const usage = latestReport ? {
  vendorsScanned: (latestReport.report_metadata as Record<string, unknown>)?.vendorsAnalyzed ?? 0,
  ghostSeatsFound: latestReport.ghost_seat_count ?? 0,
} : null
```

### Step 4 — Upgrade Past-Due Banner

Make the past-due warning impossible to miss:

```tsx
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

{subscription?.status === 'past_due' && (
  <Alert variant="destructive" className="sticky top-0 z-20">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription className="flex items-center justify-between flex-1">
      <span>
        <strong>Payment failed.</strong> Update your payment method to maintain access to your plan features.
      </span>
      <ManageButton variant="outline" size="sm" className="ml-4 shrink-0 border-white text-white hover:bg-white/20" />
    </AlertDescription>
  </Alert>
)}
```

### Step 5 — Add Plan Change Confirmation Dialog

**File:** `src/components/billing/upgrade-button.tsx`

Wrap the checkout redirect in a confirmation dialog:

```tsx
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CheckCircle2 } from 'lucide-react'

export function UpgradeButton({ priceId, planName }: { priceId: string; planName: string }) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      toast.error('Failed to start checkout')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          Upgrade to {planName}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to {planName}</DialogTitle>
          <DialogDescription>
            You&apos;re about to upgrade your plan. You&apos;ll be redirected to Stripe to complete payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Immediate access to all {planName} features</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Cancel anytime — no long-term commitment</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Pro-rated billing for the current period</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpgrade} disabled={loading}>
            {loading ? 'Redirecting...' : `Continue to checkout`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 6 — Add FAQ Accordion

Add common billing questions below the pricing grid. First, add the Accordion component via shadcn:

```bash
npx shadcn@latest add accordion
```

Then render:

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FAQ_ITEMS = [
  {
    q: 'Can I downgrade my plan?',
    a: 'Yes. Go to Manage Subscription and switch to a lower tier. Your current plan features will remain active until the end of the billing period.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'Your data is retained for 30 days after cancellation. You can re-subscribe at any time during this period to regain access.',
  },
  {
    q: 'How does Recovery plan pricing work?',
    a: 'The Recovery plan charges a percentage of verified savings. We only bill when we can prove ROI — if we don\'t find savings, you don\'t pay.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'We offer a full refund within the first 14 days if you\'re not satisfied. Contact support@ghostfinder.app to request one.',
  },
]

{/* Below pricing grid */}
<Card>
  <CardHeader>
    <CardTitle>Frequently Asked Questions</CardTitle>
  </CardHeader>
  <CardContent>
    <Accordion type="single" collapsible className="w-full">
      {FAQ_ITEMS.map((item, i) => (
        <AccordionItem key={i} value={`item-${i}`}>
          <AccordionTrigger>{item.q}</AccordionTrigger>
          <AccordionContent>{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </CardContent>
</Card>
```

---

## Billing Page Layout (After)

```
Billing
├── Description text
├── Past-due Alert (sticky, full-width, destructive — conditional)
├── Monthly / Annual toggle (with -15% badge)
├── Pricing Grid (3 columns)
│   ├── Free (muted, plain)
│   │   ├── Price: $0
│   │   ├── Feature list (✓/✗)
│   │   └── Current Plan badge + usage stats (if active)
│   ├── Monitor (featured, brand border, scale-up, gradient top bar)
│   │   ├── "Recommended" badge
│   │   ├── Price: $49/mo (or $42/mo annual with strikethrough)
│   │   ├── Feature list (all ✓)
│   │   └── Upgrade button → confirmation dialog → Stripe
│   └── Recovery (dark inverted card, gold badge)
│       ├── "Maximum Savings" badge
│       ├── Price: 20% of savings (or 15% annual)
│       ├── Feature list (all ✓)
│       └── Upgrade button → confirmation dialog → Stripe
└── FAQ Accordion
    ├── Can I downgrade?
    ├── What happens to my data?
    ├── How does Recovery pricing work?
    └── Do you offer refunds?
```

---

## Files Changed

| File | Action | Description |
|---|---|---|
| `src/app/(dashboard)/billing/page.tsx` | Modified | Tier hierarchy, annual toggle, usage stats, past-due alert, FAQ |
| `src/components/billing/upgrade-button.tsx` | Modified | Confirmation dialog before Stripe redirect |
| `src/components/billing/manage-button.tsx` | Modified | Accept variant/size/className props for past-due banner inline usage |
| `src/components/ui/accordion.tsx` | Created | Added via `npx shadcn@latest add accordion` |

---

## Verification Checklist

- [ ] Monthly/Annual toggle switches displayed prices on all cards
- [ ] Annual toggle shows `-15%` badge and strikethrough monthly price
- [ ] Free card appears muted/subtle compared to paid tiers
- [ ] Monitor card has brand-colored top bar + "Recommended" badge + slight scale-up
- [ ] Recovery card has dark/inverted background + "Maximum Savings" gold badge
- [ ] Current plan shows usage stats (vendors scanned, ghost seats found)
- [ ] Past-due banner is sticky, red, with inline "Update payment" button
- [ ] Clicking "Upgrade to Monitor" opens confirmation dialog first
- [ ] Dialog shows 3 reassurance bullet points + Cancel/Continue buttons
- [ ] "Continue to checkout" redirects to Stripe Checkout
- [ ] FAQ accordion opens/closes correctly; only one item expanded at a time
- [ ] All text is readable in dark mode (especially the inverted Recovery card)
- [ ] Annual price IDs fall back gracefully if env vars are not set

---

## Design Decisions

| Decision | Rationale |
|---|---|
| Inverted dark card for Recovery | Premium tier feels premium; creates visual anchor; draws the eye last (decoy effect favors Monitor) |
| Confirmation dialog before Stripe | Prevents accidental clicks; provides reassurance; reduces checkout abandonment |
| Usage stats on current plan | Reinforces value — "you found 12 ghost seats" reminds users why they're paying |
| FAQ as accordion | Addresses objections inline; reduces support tickets; standard pricing page pattern |
| Annual -15% badge on toggle | Draws attention to the discount; social proof that annual saves money |
| "Recommended" over "Most Popular" | More actionable — tells users what to do, not what others did |
