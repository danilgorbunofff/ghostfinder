# Phase 9 — Polish & Cross-Cutting Improvements

> **Priority:** Low-medium — the finishing layer  
> **Estimated scope:** 5 files modified, 3 new files created  
> **Dependencies:** All previous phases (0–8) must be complete

---

## Objective

Apply the final layer of polish across every page: page transition animations, universal skeleton loaders, consistent toast feedback, keyboard accessibility audit, and per-page SEO metadata. These are the details that separate a "works" product from a "feels great" product. None of these are individually critical, but together they compound into a significantly better user experience.

---

## Current State Assessment

| Area | Current | Problem |
|---|---|---|
| Page transitions | None — hard cut between pages | Pages feel disconnected; jarring navigation experience |
| Loading states | No skeletons anywhere | Content pops in after server query; visible layout shift |
| Toast coverage | Only auth errors show inline text | Zero toasts on any mutation (save settings, send notification, connect, etc.) |
| Empty states | Inconsistent — some use text, some use icons | No unified component; different patterns across pages |
| Keyboard nav | Not audited | Dialogs may not trap focus; dropdowns may not close on Escape |
| SEO metadata | Only root layout has metadata | Individual pages have no `<title>` or `<meta description>` |
| Error boundaries | None | Unhandled errors show Next.js default error page |

---

## Implementation Steps

### Step 1 — Create Page Transition Wrapper

**New file:** `src/components/ui/page-wrapper.tsx`

A client component that wraps each page's content with a fade-in-up animation:

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

export function PageWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(false)
    // Trigger animation on next frame
    const frame = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        show
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
      }`}
    >
      {children}
    </div>
  )
}
```

Wire into the dashboard layout:

```tsx
// src/app/(dashboard)/layout.tsx
import { PageWrapper } from '@/components/ui/page-wrapper'

<main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
  <PageWrapper>
    {children}
  </PageWrapper>
</main>
```

### Step 2 — Create Reusable Skeleton Components

**New file:** `src/components/ui/skeleton-cards.tsx`

```tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-4 rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-32 rounded bg-muted mb-2" />
            <div className="h-3 w-40 rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

**New file:** `src/components/ui/skeleton-table.tsx`

```tsx
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'

export function SkeletonTable({
  columns = 5,
  rows = 5,
}: {
  columns?: number
  rows?: number
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: columns }).map((_, i) => (
            <TableHead key={i}>
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, row) => (
          <TableRow key={row}>
            {Array.from({ length: columns }).map((_, col) => (
              <TableCell key={col}>
                <div
                  className="h-4 rounded bg-muted animate-pulse"
                  style={{ width: `${60 + Math.random() * 40}%` }}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### Step 3 — Add Loading.tsx Files for Suspense

Create `loading.tsx` files for each dashboard route that show appropriate skeletons:

**File:** `src/app/(dashboard)/loading.tsx`

```tsx
import { SkeletonCards } from '@/components/ui/skeleton-cards'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-5 w-64 rounded bg-muted animate-pulse" />
      </div>
      <SkeletonCards count={4} />
    </div>
  )
}
```

**File:** `src/app/(dashboard)/inventory/loading.tsx`

```tsx
import { SkeletonTable } from '@/components/ui/skeleton-table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function InventoryLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-48 rounded bg-muted animate-pulse" />
      <Card>
        <CardHeader>
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
        </CardHeader>
        <CardContent>
          <SkeletonTable columns={5} rows={8} />
        </CardContent>
      </Card>
    </div>
  )
}
```

**File:** `src/app/(dashboard)/connections/loading.tsx`

```tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card'

function ConnectionSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-4 animate-pulse">
      <div className="h-10 w-10 rounded-lg bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="h-3 w-48 rounded bg-muted" />
      </div>
      <div className="h-5 w-14 rounded-full bg-muted" />
    </div>
  )
}

export default function ConnectionsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-48 rounded bg-muted animate-pulse" />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
          <div className="h-9 w-40 rounded bg-muted animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-3">
          <ConnectionSkeleton />
          <ConnectionSkeleton />
        </CardContent>
      </Card>
    </div>
  )
}
```

Create similar `loading.tsx` files for `/reports`, `/billing`, and `/settings`.

### Step 4 — Comprehensive Toast Audit

Go through every mutation in the app and ensure toast feedback is present. Here's the complete audit:

| Component | Action | Toast Needed |
|---|---|---|
| `plaid-link-button.tsx` | Bank connected successfully | `toast.success('Bank account connected')` |
| `plaid-link-button.tsx` | Connection failed | `toast.error(...)` |
| `okta-connect-button.tsx` | Okta connected | `toast.success('Okta connected successfully')` |
| `okta-connect-button.tsx` | Connection failed | `toast.error(...)` |
| `google-connect-button.tsx` | Redirect initiated | `toast.info('Redirecting to Google...')` |
| `google-connect-button.tsx` | Connection failed | `toast.error(...)` |
| `notify-button.tsx` | Notification sent | `toast.success(...)` — already done in Phase 6 |
| `notification-settings-form.tsx` | Settings saved | `toast.success(...)` — already done in Phase 8 |
| `upgrade-button.tsx` | Redirecting to Stripe | `toast.info('Redirecting to checkout...')` |
| `manage-button.tsx` | Opening billing portal | `toast.info('Opening billing portal...')` |
| `profile-section.tsx` | Profile saved | Already done in Phase 8 |
| `organization-section.tsx` | Org name saved | Already done in Phase 8 |

Implementation for each — add `import { toast } from 'sonner'` and call after API response:

```tsx
// Example for PlaidLinkButton:
const handleSuccess = useCallback(async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
  setLoading(true)
  try {
    const res = await fetch('/api/plaid/exchange-token', { /* ... */ })
    const data = await res.json()
    if (data.success) {
      toast.success('Bank account connected', {
        description: `${metadata.institution?.name ?? 'Account'} linked successfully`,
      })
      onSuccess?.()
    } else {
      toast.error('Failed to connect account', {
        description: data.error || 'Please try again',
      })
    }
  } catch {
    toast.error('Connection failed', {
      description: 'Could not save the bank connection',
    })
  } finally {
    setLoading(false)
  }
}, [onSuccess])
```

### Step 5 — Keyboard Navigation Audit

Verify and fix these keyboard behaviors:

**Dialogs (Okta connect, plan upgrade, danger zone):**
- [ ] Focus is trapped inside the dialog when open
- [ ] Pressing `Escape` closes the dialog
- [ ] Focus returns to the trigger element after close
- [ ] Tab cycles through all interactive elements
- shadcn Dialog handles all of this by default — verify with manual testing

**Dropdown menus (user avatar, overflow menus):**
- [ ] `Enter` or `Space` opens the dropdown
- [ ] Arrow keys navigate between items
- [ ] `Escape` closes the dropdown
- [ ] Focus returns to trigger after close
- shadcn DropdownMenu handles this — verify with manual testing

**Table sorting:**
- [ ] Sort headers are focusable via Tab
- [ ] `Enter` or `Space` triggers sort

Add tabindex and role to sort headers if not already present:

```tsx
<TableHead
  className="cursor-pointer select-none hover:text-foreground transition-colors"
  onClick={() => handleSort(column)}
  tabIndex={0}
  role="button"
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSort(column)
    }
  }}
>
```

**Focus rings:**

Verify all interactive elements show a visible focus ring. Add to `globals.css`:

```css
@layer base {
  /* Ensure visible focus rings for keyboard navigation */
  :focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
}
```

### Step 6 — Per-Page SEO Metadata

Add `export const metadata` to each dashboard page:

```tsx
// src/app/(dashboard)/page.tsx
export const metadata = {
  title: 'Dashboard | GhostFinder',
  description: 'Overview of your SaaS spend, waste, and optimization opportunities.',
}

// src/app/(dashboard)/inventory/page.tsx
export const metadata = {
  title: 'SaaS Inventory | GhostFinder',
  description: 'All detected software subscriptions across your connected accounts.',
}

// src/app/(dashboard)/connections/page.tsx
export const metadata = {
  title: 'Connections | GhostFinder',
  description: 'Connect bank accounts and identity providers to discover SaaS usage.',
}

// src/app/(dashboard)/reports/page.tsx
export const metadata = {
  title: 'Waste Reports | GhostFinder',
  description: 'Ghost seat detection and duplicate subscription findings.',
}

// src/app/(dashboard)/billing/page.tsx
export const metadata = {
  title: 'Billing | GhostFinder',
  description: 'Manage your subscription and billing preferences.',
}

// src/app/(dashboard)/settings/page.tsx
export const metadata = {
  title: 'Settings | GhostFinder',
  description: 'Manage your profile, organization, and notification settings.',
}

// src/app/(auth)/login/page.tsx
export const metadata = {
  title: 'Sign In | GhostFinder',
  description: 'Sign in to your GhostFinder account.',
}

// src/app/(auth)/signup/page.tsx
export const metadata = {
  title: 'Create Account | GhostFinder',
  description: 'Create a GhostFinder account to start finding unused SaaS subscriptions.',
}
```

### Step 7 — Create Error Boundary

**New file:** `src/app/(dashboard)/error.tsx`

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Something went wrong"
      description={error.message || 'An unexpected error occurred. Please try again.'}
      action={
        <Button onClick={() => reset()}>
          Try again
        </Button>
      }
    />
  )
}
```

### Step 8 — Final Visual Polish Pass

Small CSS refinements to apply across the app:

```css
/* src/app/globals.css — add to @layer base */

/* Smooth scrolling for dashboard main area */
.overflow-y-auto {
  scroll-behavior: smooth;
}

/* Better selection colors */
::selection {
  background-color: var(--brand-muted);
  color: var(--foreground);
}

/* Card hover effect for interactive cards */
.card-interactive {
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.card-interactive:hover {
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05);
  border-color: var(--brand);
}

/* Consistent table row hover */
.table-row-hover:hover {
  background-color: var(--muted);
}
```

---

## Summary of All New Files

| File | Type | Description |
|---|---|---|
| `src/components/ui/page-wrapper.tsx` | Component | Fade-in-up transition wrapper for page content |
| `src/components/ui/skeleton-cards.tsx` | Component | Skeleton loader for stats card grids |
| `src/components/ui/skeleton-table.tsx` | Component | Skeleton loader for data tables |
| `src/app/(dashboard)/loading.tsx` | Loading UI | Dashboard home loading skeleton |
| `src/app/(dashboard)/inventory/loading.tsx` | Loading UI | Inventory page loading skeleton |
| `src/app/(dashboard)/connections/loading.tsx` | Loading UI | Connections page loading skeleton |
| `src/app/(dashboard)/reports/loading.tsx` | Loading UI | Reports page loading skeleton |
| `src/app/(dashboard)/billing/loading.tsx` | Loading UI | Billing page loading skeleton |
| `src/app/(dashboard)/settings/loading.tsx` | Loading UI | Settings page loading skeleton |
| `src/app/(dashboard)/error.tsx` | Error boundary | Dashboard-wide error fallback |

---

## Files Modified

| File | Description |
|---|---|
| `src/app/(dashboard)/layout.tsx` | Wrap children in `<PageWrapper>` |
| `src/app/globals.css` | Focus rings, selection color, card hover, smooth scroll |
| `src/components/connections/plaid-link-button.tsx` | Add toast.success/error |
| `src/components/connections/okta-connect-button.tsx` | Add toast.success/error |
| `src/components/connections/google-connect-button.tsx` | Add toast.info/error |
| `src/components/billing/upgrade-button.tsx` | Add toast.info on redirect |
| `src/components/billing/manage-button.tsx` | Add toast.info on redirect |
| `src/components/dashboard/vendor-table.tsx` | Add keyboard support to sort headers |
| All 6 dashboard page.tsx + 2 auth page.tsx | Add `export const metadata` |

---

## Verification Checklist

- [ ] Navigating between dashboard pages shows smooth fade-in-up transition
- [ ] Loading skeletons appear during server data fetching (simulate with slow network)
- [ ] All skeleton layouts match their resolved page layouts (no layout shift)
- [ ] Connecting a bank account shows success toast
- [ ] Connecting Okta shows success toast
- [ ] Google connect shows "Redirecting..." toast
- [ ] All error states show error toast with description
- [ ] Upgrade button shows "Redirecting to checkout..." toast
- [ ] Tab key navigates through all interactive elements on every page
- [ ] Sort column headers are keyboard-accessible (Enter/Space to sort)
- [ ] All dialogs trap focus and close on Escape
- [ ] Focus ring is visible on all focusable elements (brand-colored)
- [ ] Each page has a unique `<title>` tag (check via browser tab)
- [ ] Dashboard error boundary shows "Something went wrong" with retry button
- [ ] `::selection` uses brand color
- [ ] `npm run build` passes with zero errors
- [ ] `npm run lint` passes

---

## Design Decisions

| Decision | Rationale |
|---|---|
| CSS transitions over framer-motion | Keeps bundle lean (~0KB vs ~32KB); sufficient for page-level transitions |
| `loading.tsx` over manual Suspense | Next.js convention; automatic Suspense boundaries per route segment |
| Global focus-visible over per-component | Single source of truth; no missed elements; easier to maintain |
| Inline metadata over generateMetadata | Static metadata sufficient for dashboard pages; simpler |
| Error boundary at dashboard level | Catches all page errors; single recovery point; friendly UI |
| Toast over inline messages | Consistent, non-blocking, auto-dismissing; matches Phase 0 Sonner setup |

---

## Post-Phase 9 — Stretch Goals (Not In Scope)

These items were identified during the audit but are deferred:

| Feature | Reason for Deferral |
|---|---|
| CSV/PDF export on Reports | Requires server-side file generation; separate backend task |
| Disconnect connection API | Needs new API routes + Plaid/Okta revocation logic |
| Invite member flow | Needs email service integration + invite token handling |
| View Transitions API | Browser support still limited; CSS transitions are sufficient |
| Animated count-up numbers | Would need a client-side animation library; CSS `animate-count-up` is sufficient |
| Mobile bottom nav bar | Would require significant layout rework; hamburger menu is functional |
