# Phase 3 — Dashboard Home Page

> **Priority:** High — the page users see every day  
> **Estimated scope:** 2 files modified, 2 new files created  
> **Dependencies:** Phase 0 (recharts, brand tokens, animation keyframes), Phase 2 (PageHeader)

---

## Objective

Transform the dashboard home from a static 4-card KPI display into a dynamic command center that surfaces actionable insights, guides new users through onboarding, and provides at-a-glance trend signals. This is the most-visited page in the app — every improvement here multiplies across all sessions.

---

## Current State Assessment

| Area | Current | Problem |
|---|---|---|
| Stats cards | 4 flat white cards with icon + number + subtitle | No trend context — is $4,200/mo going up or down? No way to tell |
| Waste card | Same visual weight as other cards | The most important metric blends in — should demand attention |
| Empty state | Cards show `$0`, `0`, `—` when no data | New users see a dead dashboard; no guidance on what to do next |
| Actions | None | No way to trigger a scan, jump to reports, or connect a source |
| Timestamp | None | Users don't know when data was last refreshed |
| Trends | No previous-period comparison | No "vs last week" or sparkline — data feels static |

---

## Implementation Steps

### Step 1 — Create Getting Started Checklist Component

**New file:** `src/components/dashboard/getting-started.tsx`

This appears when the user has no connections. It guides them through the 3-step onboarding funnel.

```tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, Building2, Shield, Scan, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface GettingStartedProps {
  hasBankConnection: boolean
  hasIdentityProvider: boolean
  hasWasteReport: boolean
}

export function GettingStarted({
  hasBankConnection,
  hasIdentityProvider,
  hasWasteReport,
}: GettingStartedProps) {
  const steps = [
    {
      label: 'Connect a bank account',
      description: 'Link your company card or bank to discover SaaS charges automatically.',
      done: hasBankConnection,
      href: '/connections',
      icon: Building2,
    },
    {
      label: 'Connect an identity provider',
      description: 'Link Okta or Google Workspace to detect unused seats.',
      done: hasIdentityProvider,
      href: '/connections',
      icon: Shield,
    },
    {
      label: 'Generate your first waste report',
      description: 'We\'ll cross-reference financial and usage data to find ghost subscriptions.',
      done: hasWasteReport,
      href: '/reports',
      icon: Scan,
    },
  ]

  const completedCount = steps.filter((s) => s.done).length

  if (completedCount === 3) return null // All done — hide checklist

  return (
    <Card className="border-brand/20 bg-gradient-to-br from-brand-muted to-background">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Get started with GhostFinder</CardTitle>
          <span className="text-xs text-muted-foreground font-medium">
            {completedCount}/3 complete
          </span>
        </div>
        {/* Progress bar */}
        <div className="flex gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < completedCount ? 'bg-brand' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.label}
            className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
              step.done
                ? 'bg-muted/50 border-muted'
                : 'bg-background border-border hover:border-brand/30'
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? 'line-through text-muted-foreground' : ''}`}>
                {step.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
            </div>
            {!step.done && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={step.href}>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```

### Step 2 — Create Quick Actions Row Component

**New file:** `src/components/dashboard/quick-actions.tsx`

```tsx
import { Button } from '@/components/ui/button'
import { FileBarChart, Plug, Download } from 'lucide-react'
import Link from 'next/link'

interface QuickActionsProps {
  hasReport: boolean
  hasConnections: boolean
}

export function QuickActions({ hasReport, hasConnections }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" size="sm" asChild>
        <Link href="/reports">
          <FileBarChart className="mr-2 h-4 w-4 text-orange-500" />
          {hasReport ? 'View latest report' : 'Generate report'}
        </Link>
      </Button>
      {!hasConnections && (
        <Button variant="outline" size="sm" asChild>
          <Link href="/connections">
            <Plug className="mr-2 h-4 w-4 text-blue-500" />
            Connect a data source
          </Link>
        </Button>
      )}
      {hasReport && (
        <Button variant="outline" size="sm" disabled>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      )}
    </div>
  )
}
```

### Step 3 — Redesign Stats Cards with Trend Badges

**File:** `src/components/dashboard/stats-cards.tsx`

Add a `trend` prop to each card and display directional badges:

```tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, AlertTriangle, TrendingDown, TrendingUp, Users, Minus } from 'lucide-react'

interface TrendInfo {
  value: number    // e.g. 12 for +12% or -5 for -5%
  label: string    // e.g. "vs last week"
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
```

### Step 4 — Highlight Waste Card as Hero

Make the "Estimated Waste" card visually dominant — it's the core value proposition:

```tsx
{/* Waste card — spans 2 columns on large screens */}
<Card className="md:col-span-2 lg:col-span-2 border-orange-200 dark:border-orange-900 bg-gradient-to-br from-orange-50 to-background dark:from-orange-950/30 dark:to-background">
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
```

Update the grid to accommodate the wider waste card:

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {/* Total Spend card — 1 col */}
  {/* Estimated Waste card — 2 cols on lg */}
  {/* Opportunities card — 1 col */}
</div>
{/* User Activity card — separate row, full width with donut chart */}
```

### Step 5 — Add Last Scanned Timestamp

**File:** `src/app/(dashboard)/page.tsx`

Add timestamp query and display:

```tsx
// In the server component query:
const { data: latestReport } = await supabase
  .from('waste_reports')
  .select('total_monthly_waste, opportunity_count, generated_at')
  .order('generated_at', { ascending: false })
  .limit(1)
  .single()

const lastScanned = latestReport?.generated_at ?? null
```

Render as a right-aligned subtitle below the page description:

```tsx
<div className="flex items-center justify-between">
  <p className="text-muted-foreground">
    Your SaaS spend overview and optimization opportunities.
  </p>
  {lastScanned && (
    <p className="text-xs text-muted-foreground">
      Last scanned:{' '}
      <time dateTime={lastScanned}>
        {new Date(lastScanned).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })}
      </time>
    </p>
  )}
</div>
```

### Step 6 — Add Trend Data Computation

**File:** `src/app/(dashboard)/page.tsx`

Query the 2 most recent waste reports to derive trend data:

```tsx
// Fetch last 2 reports for trend calculation
const { data: recentReports } = await supabase
  .from('waste_reports')
  .select('total_monthly_waste, opportunity_count, generated_at')
  .order('generated_at', { ascending: false })
  .limit(2)

const current = recentReports?.[0]
const previous = recentReports?.[1]

let wasteTrend: { value: number; label: string } | null = null
if (current && previous && Number(previous.total_monthly_waste) > 0) {
  const pct = Math.round(
    ((Number(current.total_monthly_waste) - Number(previous.total_monthly_waste))
      / Number(previous.total_monthly_waste)) * 100
  )
  wasteTrend = { value: pct, label: 'vs last report' }
}
```

### Step 7 — Wire Everything in Dashboard Page

**File:** `src/app/(dashboard)/page.tsx`

```tsx
import { createClient } from '@/lib/supabase/server'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { GettingStarted } from '@/components/dashboard/getting-started'
import { QuickActions } from '@/components/dashboard/quick-actions'

export default async function DashboardPage() {
  const supabase = await createClient()

  // ... existing queries ...

  // Check connection states for Getting Started
  const { count: bankCount } = await supabase
    .from('plaid_connections')
    .select('*', { count: 'exact', head: true })

  const { count: idpCount } = await supabase
    .from('integration_connections')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const hasBankConnection = (bankCount ?? 0) > 0
  const hasIdentityProvider = (idpCount ?? 0) > 0
  const hasReport = !!latestReport

  return (
    <div className="space-y-6">
      {/* Description + timestamp */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Your SaaS spend overview and optimization opportunities.
        </p>
        {lastScanned && (
          <p className="text-xs text-muted-foreground">...</p>
        )}
      </div>

      {/* Getting Started — only when incomplete */}
      <GettingStarted
        hasBankConnection={hasBankConnection}
        hasIdentityProvider={hasIdentityProvider}
        hasWasteReport={hasReport}
      />

      {/* KPI Cards */}
      <StatsCards
        totalSpend={totalSpend}
        estimatedWaste={estimatedWaste}
        opportunities={opportunities}
        totalUsers={totalUsers}
        inactiveUsers={inactiveUsers}
        wasteTrend={wasteTrend}
      />

      {/* Quick actions */}
      <QuickActions
        hasReport={hasReport}
        hasConnections={hasBankConnection || hasIdentityProvider}
      />
    </div>
  )
}
```

---

## Dashboard Page Layout (After)

```
Dashboard
├── Description + "Last scanned: Apr 14, 10:32 AM"
├── Getting Started (if incomplete)
│   ├── Progress bar (0-3 segments)
│   ├── Step 1: Connect bank (✓ / →)
│   ├── Step 2: Connect identity provider (✓ / →)
│   └── Step 3: Generate report (✓ / →)
├── Stats Cards (grid)
│   ├── Total SaaS Spend [$X,XXX/mo]  [+N% trend badge]
│   ├── Estimated Waste (2-col hero, orange gradient)  [$X,XXX/mo]
│   ├── Opportunities [N]
│   └── User Activity [X/Y with donut]
└── Quick Actions
    ├── View latest report →
    ├── Connect a data source →
    └── Export CSV (disabled)
```

---

## Files Changed

| File | Action | Description |
|---|---|---|
| `src/app/(dashboard)/page.tsx` | Modified | Trend data query, connection state checks, GettingStarted + QuickActions wiring |
| `src/components/dashboard/stats-cards.tsx` | Modified | TrendBadge, waste hero card, grid layout change |
| `src/components/dashboard/getting-started.tsx` | Created | 3-step onboarding checklist with progress bar |
| `src/components/dashboard/quick-actions.tsx` | Created | Action button row |

---

## Verification Checklist

- [ ] New user (no connections) sees Getting Started card with 0/3 progress
- [ ] Connecting a bank marks Step 1 as complete (checkmark + strikethrough)
- [ ] All 3 steps complete → Getting Started disappears
- [ ] Waste card spans 2 columns on large screens with orange gradient
- [ ] Waste card shows annual projection inline
- [ ] Trend badges show `+N%` (red, up arrow) or `-N%` (green, down arrow) or "First scan"
- [ ] "Last scanned" timestamp appears right-aligned when a report exists
- [ ] Quick action buttons link to correct pages
- [ ] Export CSV button is present but disabled
- [ ] Entire page renders without layout shift (no content jump)
- [ ] Cards animate with `fade-in-up` on load

---

## Design Decisions

| Decision | Rationale |
|---|---|
| Waste card as 2-col hero | Core value prop — the thing users are paying for; deserves dominant visual weight |
| Getting Started over tour/modal | Non-intrusive; persistent until complete; users can ignore and come back |
| Trend comparison to "last report" | Reports generate weekly — "vs last week" is the natural comparison period |
| Orange gradient on waste card | Orange = warning; direct psychological association with "money being lost" |
| Annual projection inline | Decision-makers think in annual budget terms — showing $50K annual impact is more motivating than $4.2K/mo |
