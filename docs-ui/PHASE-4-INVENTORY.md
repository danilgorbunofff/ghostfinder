# Phase 4 — Inventory Page

> **Priority:** Medium — critical data view, used daily by finance/IT teams  
> **Estimated scope:** 2 files modified, 1 new file created  
> **Dependencies:** Phase 0 (brand tokens), Phase 2 (PageHeader removes inline h1)

---

## Objective

Upgrade the SaaS Inventory from a plain static table into a filterable, sortable, visually rich data grid with spend visualization, meaningful status colors, and a guided empty state. This is the page operations teams will live in — it must handle 5 vendors and 500 vendors equally well.

---

## Current State Assessment

| Area | Current | Problem |
|---|---|---|
| Search/filter | None | Users with 50+ vendors must visually scan the entire table |
| Sorting | None — server-sorted by `monthly_cost` descending | Can't sort by status, seats, or activity |
| Status badges | Generic `Badge` with `default`/`destructive`/`secondary` variants | Colors don't convey meaning — "secondary" (gray) for warning is confusing |
| Spend context | Raw dollar number per row | No relative context — is $200/mo a lot or a little relative to total? |
| Seats column | Shows `0` for vendors without seat data | Misleading — 0 seats implies "no one uses it"; reality is "data unavailable" |
| Empty state | Plain text: "No vendors detected yet..." | No visual CTA; doesn't tell users what to do |
| Category | Not displayed | No way to see vendor grouping by function (CRM, PM, etc.) |

---

## Implementation Steps

### Step 1 — Create Search & Filter Bar Component

**New file:** `src/components/dashboard/vendor-filters.tsx`

```tsx
'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Filter, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export type StatusFilter = 'all' | 'active' | 'warning' | 'inactive'

interface VendorFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: StatusFilter
  onStatusChange: (status: StatusFilter) => void
  totalCount: number
  filteredCount: number
}

export function VendorFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  totalCount,
  filteredCount,
}: VendorFiltersProps) {
  const hasFilters = searchQuery || statusFilter !== 'all'

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 flex-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Status
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {statusFilter}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(['all', 'active', 'warning', 'inactive'] as const).map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={statusFilter === s}
                onCheckedChange={() => onStatusChange(s)}
              >
                {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange('')
              onStatusChange('all')
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {hasFilters
          ? `${filteredCount} of ${totalCount} vendors`
          : `${totalCount} vendors`}
      </p>
    </div>
  )
}
```

### Step 2 — Add Semantic Status Badge Colors

**File:** `src/components/dashboard/vendor-table.tsx`

Replace the generic variant mapping with semantically colored badges:

```tsx
const statusConfig = {
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-900',
  },
  warning: {
    label: 'Warning',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900',
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900',
  },
} as const
```

Render:

```tsx
<Badge variant="outline" className={statusConfig[vendor.status].className}>
  {statusConfig[vendor.status].label}
</Badge>
```

### Step 3 — Add Spend Bar Visualization

Add a mini horizontal bar to each row showing relative spend as a percentage of total:

```tsx
interface VendorTableProps {
  vendors: VendorRow[]
  totalSpend: number  // NEW — pass from parent
}

// In each row's cost cell:
<TableCell>
  <div className="text-right">
    <span className="font-medium">
      {vendor.monthlyCost > 0 ? `$${vendor.monthlyCost.toLocaleString()}` : '—'}
    </span>
    {vendor.monthlyCost > 0 && totalSpend > 0 && (
      <div className="mt-1.5 h-1.5 w-full max-w-[80px] rounded-full bg-muted ml-auto">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{
            width: `${Math.max(2, (vendor.monthlyCost / totalSpend) * 100)}%`,
          }}
        />
      </div>
    )}
  </div>
</TableCell>
```

### Step 4 — Add Sortable Column Headers

Make columns clickable for client-side sorting:

```tsx
'use client'

import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

type SortKey = 'name' | 'monthlyCost' | 'seats' | 'lastActivity' | 'status'
type SortDir = 'asc' | 'desc'

export function VendorTable({ vendors, totalSpend }: VendorTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('monthlyCost')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    return [...vendors].sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'name':
          return mult * a.name.localeCompare(b.name)
        case 'monthlyCost':
          return mult * (a.monthlyCost - b.monthlyCost)
        case 'seats':
          return mult * (a.seats - b.seats)
        case 'status':
          return mult * a.status.localeCompare(b.status)
        default:
          return 0
      }
    })
  }, [vendors, sortKey, sortDir])

  function SortHeader({ label, column }: { label: string; column: SortKey }) {
    const isActive = sortKey === column
    const Icon = !isActive ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
    return (
      <TableHead
        className="cursor-pointer select-none hover:text-foreground transition-colors"
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center gap-1">
          {label}
          <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
        </div>
      </TableHead>
    )
  }

  // ... render sorted instead of vendors
}
```

### Step 5 — Fix Seats Column Display

Replace `0` seats with `—`:

```tsx
<TableCell className="text-right">
  {vendor.seats > 0 ? vendor.seats : '—'}
</TableCell>
```

### Step 6 — Add Category Column

Extend the `VendorRow` type to include category:

```tsx
// In src/lib/types/index.ts — add to VendorRow:
export interface VendorRow {
  name: string
  monthlyCost: number
  seats: number
  lastActivity: string
  status: 'active' | 'inactive' | 'warning'
  category: string | null  // NEW
}
```

In the inventory page server query, include category:

```tsx
const { data: saasVendors } = await supabase
  .from('saas_vendors')
  .select('display_name, monthly_cost, seats_paid, last_activity_at, is_active, category')
  .eq('org_id', orgId)
  .order('monthly_cost', { ascending: false })
```

Render as a muted badge in the table:

```tsx
<TableCell>
  <div>
    <span className="font-medium">{vendor.name}</span>
    {vendor.category && (
      <Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">
        {vendor.category}
      </Badge>
    )}
  </div>
</TableCell>
```

### Step 7 — Upgrade Empty State

**File:** `src/app/(dashboard)/inventory/page.tsx`

Replace the plain text empty state with the reusable `EmptyState` component:

```tsx
import { EmptyState } from '@/components/ui/empty-state'
import { Package } from 'lucide-react'
import { PlaidLinkButton } from '@/components/connections/plaid-link-button'

// In return:
{vendors.length > 0 ? (
  <VendorTable vendors={vendors} totalSpend={totalSpend} />
) : (
  <EmptyState
    icon={Package}
    title="No vendors detected yet"
    description="Connect a bank account to automatically discover your SaaS subscriptions and their costs."
    action={<PlaidLinkButton />}
  />
)}
```

### Step 8 — Convert Inventory Page to Client-Driven Filtering

**File:** `src/app/(dashboard)/inventory/page.tsx`

Since search and filter are client-side operations, wrap the table section in a client component:

```tsx
// Create a new wrapper component in the same file or separate:
'use client'

import { useState, useMemo } from 'react'
import { VendorFilters, type StatusFilter } from '@/components/dashboard/vendor-filters'
import { VendorTable } from '@/components/dashboard/vendor-table'
import type { VendorRow } from '@/lib/types'

export function InventoryView({
  vendors,
  totalSpend,
}: {
  vendors: VendorRow[]
  totalSpend: number
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      const matchesSearch = !search || v.name.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = status === 'all' || v.status === status
      return matchesSearch && matchesStatus
    })
  }, [vendors, search, status])

  return (
    <div className="space-y-4">
      <VendorFilters
        searchQuery={search}
        onSearchChange={setSearch}
        statusFilter={status}
        onStatusChange={setStatus}
        totalCount={vendors.length}
        filteredCount={filtered.length}
      />
      <VendorTable vendors={filtered} totalSpend={totalSpend} />
    </div>
  )
}
```

---

## Inventory Page Layout (After)

```
Inventory
├── Description text
├── Card
│   ├── CardHeader: "Vendors (42)"
│   └── CardContent
│       ├── Filters row
│       │   ├── Search input (with icon)
│       │   ├── Status dropdown (All / Active / Warning / Inactive)
│       │   ├── Clear filters button (conditional)
│       │   └── "12 of 42 vendors" count
│       └── Table
│           ├── Headers (sortable: ↕ Vendor | ↕ Monthly Cost | ↕ Seats | Last Activity | ↕ Status)
│           └── Rows
│               ├── Vendor name + category badge
│               ├── Cost + spend bar (% of total)
│               ├── Seats (or "—")
│               ├── Last Activity (relative time)
│               └── Status badge (green/amber/red)
│
└── Empty state (if no vendors)
    ├── Package icon in brand circle
    ├── "No vendors detected yet"
    ├── Description text
    └── PlaidLinkButton CTA
```

---

## Files Changed

| File | Action | Description |
|---|---|---|
| `src/app/(dashboard)/inventory/page.tsx` | Modified | InventoryView wrapper, empty state, category + totalSpend pass-through |
| `src/components/dashboard/vendor-table.tsx` | Modified | Sortable columns, spend bar, semantic status badges, seats display |
| `src/components/dashboard/vendor-filters.tsx` | Created | Search + status filter bar with counts |
| `src/lib/types/index.ts` | Modified | Added `category` to `VendorRow` |

---

## Verification Checklist

- [ ] Search input filters vendors in real time as user types
- [ ] Status dropdown filters to Active / Warning / Inactive only
- [ ] "Clear" button resets search and status; "12 of 42 vendors" count updates
- [ ] Column headers show sort arrows; clicking toggles asc/desc
- [ ] Default sort is Monthly Cost descending
- [ ] Spend bars render proportionally (highest cost = full bar, others relative)
- [ ] Status badges: Active = green, Warning = amber, Inactive = red
- [ ] Vendors with 0 seats show "—" instead of "0"
- [ ] Category badge shows inline next to vendor name (e.g., "CRM", "Design Tools")
- [ ] Empty state shows Package icon + "Connect a bank account" CTA
- [ ] Table is responsive — horizontal scroll on mobile with sticky first column (stretch)
- [ ] Dark mode: status badges use `dark:` colors correctly

---

## Design Decisions

| Decision | Rationale |
|---|---|
| Client-side filtering over URL params | Instant feedback; no server round-trip; dataset size (<500 vendors) is small enough |
| Spend bar (not pie chart) | Inline with the table row; scannable at a glance; inspired by GitHub language bars |
| Sortable columns client-side | Server sort would require reload; current dataset fits in memory |
| Category from database | Already stored in `saas_vendors.category` — just not queried/displayed |
| Search + Status (not multi-filter) | Two filters cover 95% of use cases; more complex filtering is over-engineering |
