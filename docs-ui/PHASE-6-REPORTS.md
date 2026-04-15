# Phase 6 — Reports Page

> **Priority:** High — the core value delivery page  
> **Estimated scope:** 2 files modified, 1 new file created  
> **Dependencies:** Phase 0 (brand tokens, animation keyframes, Sonner toast), Phase 2 (PageHeader)

---

## Objective

Transform the Reports page from a dense, uniform data dump into a visually striking, severity-graded report that highlights the biggest savings opportunities first and guides users to take action. This is where GhostFinder proves its ROI — the report must feel urgent, clear, and actionable.

---

## Current State Assessment

| Area | Current | Problem |
|---|---|---|
| Summary section | 3 small identical cards (Monthly Waste, Annual, Ghost Seats) | No visual hierarchy — the big number blends in with minor stats |
| Ghost seat severity | All `daysSinceLogin` badges look the same (`destructive`/`secondary`) | 31 days inactive and 999 days inactive have the same visual weight |
| User list density | All inactive users shown inline in every card | 20+ users per vendor = massive scroll; overwhelming |
| Duplicates | Small bordered divs with text | No visual comparison; hard to see the overlap |
| Notify button | Fires API call with no user feedback | No toast, no loading state, no success confirmation |
| Report history | None — only shows latest report | Users can't compare or track trends over time |
| Export | Not available | Finance teams need shareable data for budget reviews |
| Empty state | Ghost icon + 2 lines of text | No guidance on what prerequisites are needed |

---

## Implementation Steps

### Step 1 — Create Waste Summary Hero Section

Replace the 3-card grid with a single impactful hero section:

```tsx
{/* Hero waste banner */}
<div className="rounded-xl border bg-gradient-to-br from-orange-50 via-background to-background dark:from-orange-950/20 p-6 md:p-8">
  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
    <div>
      <p className="text-sm font-medium text-muted-foreground mb-1">
        Total Monthly Waste Detected
      </p>
      <div className="text-metric-lg text-orange-500 animate-count-up">
        ${Number(report.total_monthly_waste ?? 0).toLocaleString()}
        <span className="text-lg font-normal text-muted-foreground">/mo</span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        <span className="font-semibold text-destructive">
          ${Number(report.total_annual_waste ?? 0).toLocaleString()}
        </span>
        {' '}projected annual waste
      </p>
    </div>

    <div className="flex gap-6">
      <div className="text-center">
        <div className="text-2xl font-bold">{report.ghost_seat_count}</div>
        <p className="text-xs text-muted-foreground">Ghost Seats</p>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold">{report.duplicate_count}</div>
        <p className="text-xs text-muted-foreground">Duplicates</p>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-brand">{report.opportunity_count}</div>
        <p className="text-xs text-muted-foreground">Opportunities</p>
      </div>
    </div>
  </div>
</div>
```

### Step 2 — Add Report History Selector

Add a dropdown to select from past reports:

```tsx
// Server query — fetch all report dates:
const { data: reportHistory } = await supabase
  .from('waste_reports')
  .select('id, generated_at, total_monthly_waste')
  .order('generated_at', { ascending: false })
  .limit(12)

// Client component for selector:
'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ReportSelectorProps {
  reports: { id: string; generated_at: string; total_monthly_waste: number }[]
  currentId: string
}

export function ReportSelector({ reports, currentId }: ReportSelectorProps) {
  return (
    <Select
      value={currentId}
      onValueChange={(id) => {
        // Navigate to report by ID via URL params
        const url = new URL(window.location.href)
        url.searchParams.set('reportId', id)
        window.location.href = url.toString()
      }}
    >
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Select report" />
      </SelectTrigger>
      <SelectContent>
        {reports.map((r, i) => (
          <SelectItem key={r.id} value={r.id}>
            {new Date(r.generated_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
            {i === 0 && ' (Latest)'}
            {' · $'}{Number(r.total_monthly_waste).toLocaleString()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

Wire in the page to accept `searchParams`:

```tsx
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ reportId?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let reportQuery = supabase
    .from('waste_reports')
    .select('*')

  if (params.reportId) {
    reportQuery = reportQuery.eq('id', params.reportId)
  } else {
    reportQuery = reportQuery.order('generated_at', { ascending: false }).limit(1)
  }

  const { data: report } = await reportQuery.single()
  // ...
}
```

### Step 3 — Color-Code Ghost Seat Severity

Replace uniform badge colors with severity-graded coloring:

```tsx
function severityConfig(daysSinceLogin: number) {
  if (daysSinceLogin === 999 || daysSinceLogin > 180) {
    return {
      badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
      label: daysSinceLogin === 999 ? 'Never' : `${daysSinceLogin}d`,
      dot: 'bg-red-500',
    }
  }
  if (daysSinceLogin > 60) {
    return {
      badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
      label: `${daysSinceLogin}d`,
      dot: 'bg-orange-500',
    }
  }
  return {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    label: `${daysSinceLogin}d`,
    dot: 'bg-amber-500',
  }
}
```

Render in the user table:

```tsx
<TableCell>
  <div className="flex items-center gap-2">
    <span className={`h-2 w-2 rounded-full shrink-0 ${severity.dot}`} />
    <Badge variant="outline" className={severity.badge}>
      {severity.label}
    </Badge>
  </div>
</TableCell>
```

### Step 4 — Collapsible User Lists

Default to showing top 3 users per vendor, with expand/collapse:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'

function GhostSeatCard({ finding }: { finding: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)
  const users = (finding.inactiveUsers as Record<string, unknown>[]) ?? []
  const PREVIEW_COUNT = 3
  const visibleUsers = expanded ? users : users.slice(0, PREVIEW_COUNT)
  const hiddenCount = users.length - PREVIEW_COUNT

  return (
    <Card>
      {/* Header with vendor name + notify + badge */}
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{finding.vendor as string}</CardTitle>
            <CardDescription>
              {finding.activeSeats as number} active / {finding.totalSeats as number} total ·
              <span className="font-medium text-orange-500">
                {' '}${finding.monthlyWaste as number}/mo wasted
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <NotifyButton
              vendor={finding.vendor as string}
              ghostSeats={finding.ghostSeats as number}
              monthlyWaste={finding.monthlyWaste as number}
            />
            <Badge variant="destructive">
              {finding.ghostSeats as number} ghost seats
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Inactive</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleUsers.map((user, i) => {
              const days = user.daysSinceLogin as number
              const severity = severityConfig(days)
              return (
                <TableRow key={i}>
                  <TableCell className="font-medium">{user.email as string}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastLogin
                      ? new Date(user.lastLogin as string).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${severity.dot}`} />
                      <Badge variant="outline" className={severity.badge}>
                        {severity.label}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {user.provider as string}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Show {hiddenCount} more users
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
```

### Step 5 — Redesign Duplicate Findings as Comparison Cards

Replace the plain divs with a visual side-by-side comparison:

```tsx
<Card key={index}>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle className="text-base">{finding.category as string}</CardTitle>
      <Badge className="bg-success/10 text-success border-success/20">
        Save ${finding.potentialSavings as number}/mo
      </Badge>
    </div>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Side-by-side vendor comparison */}
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {(finding.vendors as Record<string, unknown>[])?.map(
        (v: Record<string, unknown>, i: number) => (
          <div
            key={i}
            className={`rounded-lg border p-4 text-center ${
              i === 0 ? 'border-brand/30 bg-brand-muted' : ''
            }`}
          >
            <p className="font-semibold text-sm">{v.name as string}</p>
            <p className="text-2xl font-bold mt-1">
              ${v.monthlyCost as number}
              <span className="text-xs font-normal text-muted-foreground">/mo</span>
            </p>
            {i === 0 && (
              <Badge variant="outline" className="mt-2 text-[10px]">
                Highest cost
              </Badge>
            )}
          </div>
        )
      )}
    </div>

    {/* Recommendation */}
    <div className="rounded-lg bg-muted/50 border p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          {finding.recommendation as string}
        </p>
      </div>
    </div>
  </CardContent>
</Card>
```

### Step 6 — Add Toast Feedback to NotifyButton

**File:** `src/components/reports/notify-button.tsx`

Wire Sonner toasts for success/error feedback:

```tsx
import { toast } from 'sonner'

async function handleNotify() {
  setLoading(true)
  try {
    const res = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor, ghostSeats, monthlyWaste }),
    })

    const data = await res.json()

    if (data.success) {
      toast.success(`Notification sent for ${vendor}`, {
        description: `Alerted about ${ghostSeats} ghost seats ($${monthlyWaste}/mo)`,
      })
    } else {
      toast.error('Failed to send notification', {
        description: data.error || 'Please try again',
      })
    }
  } catch {
    toast.error('Network error', {
      description: 'Could not reach the notification service',
    })
  } finally {
    setLoading(false)
  }
}
```

### Step 7 — Add Export Button Placeholder

Add a disabled export button in the header area:

```tsx
import { Download } from 'lucide-react'

<div className="flex items-center gap-3">
  <ReportSelector reports={reportHistory ?? []} currentId={report.id} />
  <Button variant="outline" size="sm" disabled>
    <Download className="mr-2 h-4 w-4" />
    Export
  </Button>
</div>
```

### Step 8 — Upgrade Empty State

Replace the bare ghost icon with a structured requirement checklist:

```tsx
import { EmptyState } from '@/components/ui/empty-state'
import { Ghost, Building2, Shield, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

return (
  <div className="space-y-6">
    <EmptyState
      icon={Ghost}
      title="No reports generated yet"
      description="Reports are generated weekly once you connect your data sources."
      action={
        <div className="space-y-3 mt-2">
          <div className="text-left space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Prerequisites
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>Connect at least one bank account</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span>Connect an identity provider (Okta or Google)</span>
            </div>
          </div>
          <Button asChild>
            <Link href="/connections">
              Get connected <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      }
    />
  </div>
)
```

---

## Reports Page Layout (After)

```
Reports
├── Header row
│   ├── Report date + opportunity count text
│   ├── Report history selector (dropdown)
│   └── Export button (disabled)
├── Waste Hero Banner (gradient, orange tint)
│   ├── "$X,XXX/mo" (large animated number)
│   ├── "$XX,XXX projected annual waste"
│   └── Stats: Ghost Seats | Duplicates | Opportunities
├── Tabs
│   ├── Ghost Seats (N)
│   │   └── Per-vendor cards
│   │       ├── Vendor name + waste amount + ghost seat count badge
│   │       ├── Notify button (with toast feedback)
│   │       ├── User table (top 3 shown by default)
│   │       │   ├── User email | Last Login | Inactive (color-coded) | Source
│   │       │   └── "Show N more users" expand button
│   │       └── Severity: amber (30-60d) | orange (60-180d) | red (180+/never)
│   └── Duplicates (N)
│       └── Per-category cards
│           ├── Category name + "Save $X/mo" badge
│           ├── Side-by-side vendor cards (highest cost highlighted)
│           └── Recommendation with warning icon
└── Empty state (if no reports)
    ├── Ghost icon in brand circle
    ├── "No reports generated yet"
    ├── Prerequisites checklist
    └── "Get connected →" CTA
```

---

## Files Changed

| File | Action | Description |
|---|---|---|
| `src/app/(dashboard)/reports/page.tsx` | Modified | Hero banner, report history, severity coding, collapsible users, comparison cards, empty state |
| `src/components/reports/notify-button.tsx` | Modified | Sonner toast feedback on success/error |
| `src/components/reports/report-selector.tsx` | Created | Report history dropdown selector |

---

## Verification Checklist

- [ ] Hero banner shows large animated waste number with annual projection
- [ ] Summary stats (Ghost Seats, Duplicates, Opportunities) display in hero
- [ ] Report selector dropdown lists past 12 reports with dates and waste amounts
- [ ] Selecting a different report reloads the page with that report's data
- [ ] Ghost seat severity: 30-60d = amber, 60-180d = orange, 180+/Never = red
- [ ] Each severity level has a colored dot + matching badge
- [ ] User lists default to 3 rows; "Show N more" button expands to full list
- [ ] Clicking "Show less" collapses back to 3 rows
- [ ] NotifyButton shows toast: green on success, red on error
- [ ] Duplicate vendor cards show side-by-side with highest cost highlighted
- [ ] "Save $X/mo" badge on duplicates is green
- [ ] Export button is visible but disabled (placeholder)
- [ ] Empty state shows prerequisites checklist with link to Connections page
- [ ] Dark mode: gradient backgrounds and severity colors render correctly

---

## Design Decisions

| Decision | Rationale |
|---|---|
| Single hero banner over 3 equal cards | Waste amount is the star metric — deserves visual dominance |
| 3-tier severity (amber/orange/red) | Matches mental model: "somewhat stale" → "very stale" → "never used" |
| Collapse to 3 users | Reduces initial cognitive load; 3 is scannable; full list is opt-in |
| Report history via URL params | Pages are server-rendered; URL params allow bookmarking/sharing specific reports |
| Toast over inline success text | Non-blocking; auto-dismissing; consistent with Phase 0 Sonner setup |
| Export disabled as placeholder | Sets expectation; drives upgrade conversation ("available in Recovery plan") |
