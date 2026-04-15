# Phase 5 — Connections Page

> **Priority:** High — gatekeeper to all data ingestion  
> **Estimated scope:** 4 files modified, 2 new files created  
> **Dependencies:** Phase 0 (brand tokens, EmptyState component)

---

## Objective

Redesign the Connections page from a list of plain border divs into a branded card-based layout with provider logos, health indicators, onboarding progress, and improved error handling. This page is the critical path — users cannot get value from GhostFinder until they connect at least one data source.

---

## Current State Assessment

| Area | Current | Problem |
|---|---|---|
| Provider display | Plain `rounded-lg border p-4` divs with text | No visual identity — Plaid/Okta/Google all look identical |
| Logos | None — text labels only | Users can't visually identify providers at a glance |
| Health status | `Badge` with `default`/`destructive` | No intermediate state (syncing/warning); binary active/error is too simplistic |
| Sync indicator | "Last synced: 3h ago" as muted text | Hard to spot; no urgency signal for stale connections |
| Onboarding | None | New users don't understand the required sequence: bank → identity → scan |
| Okta dialog | Bare form with URL + token inputs | No help text explaining how to create a token; high drop-off point |
| Error handling | `{conn.error_message}` as red text | No retry action; users see the error but can't act on it |
| Disconnect | Not possible | Users can't remove a broken connection |
| Loading states | None | Content pops in after server query; layout shifts |
| Empty section | "No bank accounts connected" text | No visual hierarchy; doesn't motivate action |

---

## Implementation Steps

### Step 1 — Create Provider Logo Components

**New file:** `src/components/connections/provider-logos.tsx`

SVG logos for each integration provider, sized consistently:

```tsx
export function PlaidLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#111111" />
      <path d="M6 7h3l2 5-2 5H6l2-5-2-5z" fill="white" />
      <path d="M11 7h3l2 5-2 5h-3l2-5-2-5z" fill="white" opacity="0.6" />
    </svg>
  )
}

export function OktaLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#007DC1" />
      <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="2" fill="none" />
    </svg>
  )
}

export function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#4285F4" />
      <path d="M17.5 12.2c0-.4 0-.8-.1-1.2H12v2.3h3.1c-.1.7-.5 1.3-1.1 1.7v1.4h1.8c1-1 1.7-2.4 1.7-4.2z" fill="white"/>
      <path d="M12 18c1.5 0 2.7-.5 3.7-1.4l-1.8-1.4c-.5.3-1.1.5-1.9.5-1.5 0-2.7-1-3.1-2.3H7v1.4C8 16.8 9.8 18 12 18z" fill="white" opacity="0.9"/>
      <path d="M8.9 13.4c-.1-.4-.2-.7-.2-1.1s.1-.8.2-1.1V9.8H7C6.7 10.5 6.5 11.2 6.5 12s.2 1.5.5 2.2l1.9-1.4v.6z" fill="white" opacity="0.7"/>
      <path d="M12 8.6c.8 0 1.6.3 2.1.8l1.6-1.6C14.7 6.9 13.5 6.5 12 6.5 9.8 6.5 8 7.7 7 9.5l1.9 1.5C9.3 9.6 10.5 8.6 12 8.6z" fill="white" opacity="0.8"/>
    </svg>
  )
}
```

### Step 2 — Create Onboarding Progress Stepper

**New file:** `src/components/connections/onboarding-progress.tsx`

```tsx
import { CheckCircle2, Circle, Building2, Shield, Scan } from 'lucide-react'

interface OnboardingProgressProps {
  hasBankConnection: boolean
  hasIdentityProvider: boolean
  hasWasteReport: boolean
}

export function OnboardingProgress({
  hasBankConnection,
  hasIdentityProvider,
  hasWasteReport,
}: OnboardingProgressProps) {
  const steps = [
    { label: 'Bank Account', done: hasBankConnection, icon: Building2 },
    { label: 'Identity Provider', done: hasIdentityProvider, icon: Shield },
    { label: 'Run Scan', done: hasWasteReport, icon: Scan },
  ]

  const completedCount = steps.filter((s) => s.done).length
  if (completedCount === 3) return null

  return (
    <div className="rounded-lg border bg-card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">Setup Progress</p>
        <span className="text-xs text-muted-foreground">{completedCount}/3</span>
      </div>

      <div className="flex items-center gap-0">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1">
            {/* Step dot */}
            <div className="flex flex-col items-center gap-1.5">
              {step.done ? (
                <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
              ) : (
                <Circle className="h-6 w-6 text-muted-foreground shrink-0" />
              )}
              <span className={`text-[11px] font-medium text-center leading-tight ${
                step.done ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded-full mt-[-16px] ${
                steps[i + 1].done ? 'bg-success' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Step 3 — Redesign Connection Cards with Logos + Health Dots

**File:** `src/app/(dashboard)/connections/page.tsx`

Replace each plain div with a rich card layout:

```tsx
// Bank connection card:
<div
  key={conn.id}
  className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
>
  <PlaidLogo className="h-10 w-10 shrink-0 rounded-lg" />
  <div className="flex-1 min-w-0">
    <p className="font-medium">{conn.institution_name}</p>
    <div className="flex items-center gap-2 mt-0.5">
      {/* Health dot */}
      <span className={`h-2 w-2 rounded-full shrink-0 ${
        conn.status === 'active'
          ? 'bg-green-500'
          : conn.status === 'syncing'
          ? 'bg-amber-500 animate-pulse'
          : 'bg-red-500'
      }`} />
      <span className="text-xs text-muted-foreground">
        {conn.status === 'active'
          ? conn.last_synced_at
            ? `Synced ${formatTimeAgo(conn.last_synced_at)}`
            : 'Connected'
          : conn.status === 'syncing'
          ? 'Syncing...'
          : 'Connection error'}
      </span>
    </div>
    {conn.error_message && (
      <div className="mt-2 flex items-center gap-2">
        <p className="text-xs text-destructive">{conn.error_message}</p>
        <Button variant="ghost" size="sm" className="h-6 text-xs">
          Reconnect
        </Button>
      </div>
    )}
  </div>
  {/* Overflow menu for disconnect (future) */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem className="text-destructive" disabled>
        Disconnect
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

### Step 4 — Improve Identity Provider Cards

Apply the same card pattern to Okta/Google connections with their logos:

```tsx
// In integrations list:
<div
  key={integration.id}
  className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
>
  {integration.provider === 'okta' ? (
    <OktaLogo className="h-10 w-10 shrink-0 rounded-lg" />
  ) : (
    <GoogleLogo className="h-10 w-10 shrink-0 rounded-lg" />
  )}
  <div className="flex-1 min-w-0">
    <p className="font-medium">{label}</p>
    <div className="flex items-center gap-3 mt-0.5">
      <span className={`h-2 w-2 rounded-full shrink-0 ${
        integration.is_active ? 'bg-green-500' : 'bg-red-500'
      }`} />
      <span className="text-xs text-muted-foreground">
        {integration.total_users} users · {integration.inactive_users} inactive
      </span>
      {integration.last_synced_at && (
        <span className="text-xs text-muted-foreground">
          · Synced {formatTimeAgo(integration.last_synced_at)}
        </span>
      )}
    </div>
    {integration.error_message && (
      <div className="mt-2 flex items-center gap-2">
        <p className="text-xs text-destructive">{integration.error_message}</p>
        <Button variant="ghost" size="sm" className="h-6 text-xs">
          Retry
        </Button>
      </div>
    )}
  </div>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem className="text-destructive" disabled>
        Disconnect
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

### Step 5 — Move CTA Buttons to Card Headers

Move "Connect Bank Account" and provider buttons to prominent header positions:

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between">
    <div>
      <CardTitle>Bank Accounts</CardTitle>
      <CardDescription className="mt-1">
        Connect your company bank or credit card to discover SaaS charges.
      </CardDescription>
    </div>
    <PlaidLinkButton />
  </CardHeader>
  <CardContent>
    {/* connection list or empty state */}
  </CardContent>
</Card>
```

### Step 6 — Upgrade Okta Dialog with Help Section

**File:** `src/components/connections/okta-connect-button.tsx`

Add a collapsible help section inside the dialog:

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { HelpCircle, ChevronDown } from 'lucide-react'

{/* After DialogDescription, before form */}
<Collapsible>
  <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-2">
    <HelpCircle className="h-3.5 w-3.5" />
    How to create an Okta API token
    <ChevronDown className="h-3.5 w-3.5 ml-auto" />
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="rounded-lg bg-muted p-3 text-xs space-y-2 mb-4">
      <ol className="list-decimal list-inside space-y-1.5">
        <li>Log in to your Okta Admin Console</li>
        <li>Navigate to <strong>Security → API → Tokens</strong></li>
        <li>Click <strong>Create Token</strong> and give it a name (e.g., "GhostFinder")</li>
        <li>Copy the token value — you won&apos;t be able to see it again</li>
      </ol>
      <p className="text-muted-foreground">
        The token needs read-only access to users and groups.{' '}
        <a
          href="https://developer.okta.com/docs/guides/create-an-api-token/main/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline underline-offset-2"
        >
          Okta documentation →
        </a>
      </p>
    </div>
  </CollapsibleContent>
</Collapsible>
```

### Step 7 — Add Empty State for Each Section

Replace plain "No bank accounts connected" text:

```tsx
import { EmptyState } from '@/components/ui/empty-state'
import { Building2, Shield } from 'lucide-react'

{/* Bank accounts empty state */}
{!connections || connections.length === 0 ? (
  <EmptyState
    icon={Building2}
    title="No bank accounts connected"
    description="Connect your corporate card or bank account to automatically detect SaaS transactions."
    className="py-8"
  />
) : (
  /* connection cards */
)}

{/* Identity providers empty state */}
{!integrations || integrations.length === 0 ? (
  <EmptyState
    icon={Shield}
    title="No identity providers connected"
    description="Link Okta or Google Workspace to detect inactive users and ghost seats."
    className="py-8"
  />
) : (
  /* integration cards */
)}
```

### Step 8 — Add Skeleton Loading Placeholder

Create a skeleton pattern for connection rows:

```tsx
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
```

Use with `<Suspense>` or as a loading state.

---

## Connections Page Layout (After)

```
Connections
├── Description text
├── Onboarding Progress Stepper (if <3 steps complete)
│   ├── ● Bank Account ——— ○ Identity Provider ——— ○ Run Scan
│   └── "1/3" counter
├── Card: Bank Accounts
│   ├── Header: title + description + [Connect Bank Account] button
│   └── Content
│       ├── Connection card (logo + name + health dot + sync time + ⋯ menu)
│       └── ...or EmptyState (Building icon + CTA text)
└── Card: Identity Providers
    ├── Header: title
    ├── Content
    │   ├── Connection card (Okta logo + details + health dot + ⋯ menu)
    │   └── ...or EmptyState (Shield icon + CTA text)
    └── Footer: [Connect Okta] [Connect Google Workspace] buttons
```

---

## Files Changed

| File | Action | Description |
|---|---|---|
| `src/app/(dashboard)/connections/page.tsx` | Modified | Card redesign, logos, health dots, onboarding stepper, empty states |
| `src/components/connections/okta-connect-button.tsx` | Modified | Collapsible help section with docs link |
| `src/components/connections/provider-logos.tsx` | Created | PlaidLogo, OktaLogo, GoogleLogo SVG components |
| `src/components/connections/onboarding-progress.tsx` | Created | 3-step setup progress stepper |

---

## Verification Checklist

- [ ] Each connection shows its provider logo (Plaid/Okta/Google)
- [ ] Health dot: green = active, amber pulsing = syncing, red = error
- [ ] "Synced 3h ago" appears next to health dot
- [ ] Error connections show error message + "Reconnect"/"Retry" button
- [ ] Overflow menu (⋯) exists on each card with disabled "Disconnect" option
- [ ] Onboarding stepper shows correct completed/pending steps
- [ ] Stepper disappears when all 3 steps are complete
- [ ] Okta dialog shows collapsible "How to create an API token" with numbered steps
- [ ] Okta docs link opens in new tab
- [ ] Empty state for bank accounts shows Building icon + description
- [ ] Empty state for identity providers shows Shield icon + description
- [ ] CTA buttons are in card headers (prominent position)
- [ ] Cards have hover state (`hover:bg-muted/50`)
- [ ] Dark mode: logos and health dots render correctly

---

## Design Decisions

| Decision | Rationale |
|---|---|
| Inline SVG logos over logo CDN | Zero external dependencies; instant load; works offline |
| Health dots over status badges | More compact; industry-standard pattern (Vercel, Datadog, Grafana) |
| Collapsible help in Okta dialog | Reduces visual noise for repeat users; available for first-timers |
| Disabled "Disconnect" in menu | Communicates the feature exists but needs backend API endpoint (built later) |
| Stepper over checklist | Visual progress metaphor; horizontal layout makes sense for 3 linear steps |
