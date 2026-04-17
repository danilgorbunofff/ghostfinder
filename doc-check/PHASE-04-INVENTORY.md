# Phase 4 — SaaS Inventory

> **Objective:** The inventory page renders all discovered SaaS vendors in a table or grid view with working filters, sorting, CSV export, and a detail drawer. Every interaction — search, filter, sort, view toggle, export, row click — must function correctly. Data must match what's in the database.

---

## 4.1 Inventory Page (Server Component)

**File:** `src/app/(dashboard)/inventory/page.tsx`

### Data fetching
```sql
SELECT id, name, monthly_cost, seats, status, category, last_seen, is_active
FROM saas_vendors
WHERE org_id = ?
ORDER BY monthly_cost DESC;
```

### States

| State | Condition | Renders |
|-------|-----------|---------|
| **Loading** | Suspense boundary active | Skeleton from `loading.tsx` |
| **Empty** | 0 vendors for org | Empty state CTA ("Connect a data source") |
| **Populated** | 1+ vendors | Stats bar + filters + table/grid + drawer |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | `force-dynamic` set | No stale cache in production |
| 2 | Vendors fetched server-side | RLS scopes to user's org |
| 3 | Empty state | Shows illustration + "Connect" CTA linking to `/connections` |
| 4 | Stats passed to `InventoryStats` | Correct totals |
| 5 | Vendors passed to `InventoryView` | Client component receives full vendor array |

---

## 4.2 Inventory View (Client Component)

**File:** `src/app/(dashboard)/inventory/inventory-view.tsx`

This client component manages all interactive state: filters, sort, view mode, drawer.

### State management
```typescript
const [search, setSearch] = useState('')
const [statusFilter, setStatusFilter] = useState('all')
const [categoryFilter, setCategoryFilter] = useState<string[]>([])
const [costRange, setCostRange] = useState('all')
const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'table')
const [sortConfig, setSortConfig] = useState({ key: 'monthly_cost', direction: 'desc' })
const [selectedVendor, setSelectedVendor] = useState(null)
```

### Filter pipeline
```
vendors → search filter → status filter → category filter → cost range → sort → render
```

---

## 4.3 Table View

**File:** `src/components/dashboard/vendor-table.tsx`

### Columns

| Column | Sortable | Format | Visual |
|--------|----------|--------|--------|
| Vendor name | ✅ | Text + avatar | — |
| Monthly cost | ✅ | `$X,XXX/mo` | Spend bar (% of total) |
| Seats | ✅ | Integer | — |
| Status | ✅ | Badge | Color-coded |

### Status badge colors

| Status | Background | Text | Border indicator |
|--------|-----------|------|------------------|
| Active | Green-500/10 | Green-500 | Green left border |
| Warning | Amber-500/10 | Amber-500 | Amber left border |
| Inactive | Red-500/10 | Red-500 | Red left border |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Rows render | One row per vendor |
| 2 | Default sort | `monthly_cost` descending (highest first) |
| 3 | Click column header | Toggles sort direction |
| 4 | Sort indicator | Arrow icon shows current direction |
| 5 | Spend bar | Proportional to vendor cost vs total |
| 6 | Status badge | Correct color per status value |
| 7 | Row click | Opens vendor drawer |
| 8 | Row hover | Background highlight |
| 9 | Row animation | Staggered fade-in on load |
| 10 | Animated indicator | Left-border pulse matches status |

### Seed data (10 vendors)
```
Salesforce   $2,400/mo  20 seats  active
HubSpot       $890/mo  15 seats  active
Slack         $875/mo  35 seats  active
Figma         $540/mo  18 seats  active
Zoom          $450/mo  45 seats  active
Jira          $380/mo  38 seats  warning
Notion        $320/mo  40 seats  active
Asana         $290/mo  29 seats  inactive
GitHub        $210/mo  30 seats  active
Dropbox       $180/mo  12 seats  warning
```

---

## 4.4 Grid View

**File:** `src/components/dashboard/vendor-grid.tsx`

### Layout
- **Desktop:** 4 columns
- **Tablet:** 3 columns
- **Mobile:** 1-2 columns

### Card content
- Vendor name + status badge
- Monthly cost (large text)
- Seats count
- Spend bar (proportional)
- Category tag

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Grid renders | Responsive column count |
| 2 | Cards match table data | Same vendors, same order |
| 3 | Card click | Opens vendor drawer |
| 4 | Card hover | Elevation/shadow change |
| 5 | Staggered animation | Cards fade in with delay |

---

## 4.5 Filters

**File:** `src/components/dashboard/vendor-filters.tsx`

### Filter controls

| Filter | Type | Options | Behavior |
|--------|------|---------|----------|
| Search | Text input | Free text | Real-time, case-insensitive, matches vendor name |
| Status | Dropdown | All / Active / Warning / Inactive | Single select |
| Category | Dropdown | Dynamic from data | Multi-select with checkboxes |
| Cost range | Dropdown | All / Low (<$50) / Mid ($50-$500) / High (>$500) | Single select |
| View mode | Toggle | Table / Grid | Persisted in localStorage |
| Export | Button | — | Downloads CSV |
| Clear | Button | — | Resets all filters |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Search filters in real-time | Typing "slack" shows only Slack row |
| 2 | Search is case-insensitive | "SLACK" = "slack" = "Slack" |
| 3 | Status filter works | "Active" hides warning/inactive vendors |
| 4 | Category multi-select | Can select multiple categories |
| 5 | Cost range works | "High" shows only vendors > $500/mo |
| 6 | Combined filters | All filters apply together (AND logic) |
| 7 | Clear all resets | All filters reset to default, full list shown |
| 8 | Empty state | "No vendors match your filters" message |
| 9 | Filter count badge | Shows number of active filters |

---

## 4.6 View Mode Toggle

| # | Check | Expected |
|---|-------|----------|
| 1 | Toggle switches view | Table ↔ Grid |
| 2 | Persisted in localStorage | `localStorage.getItem('viewMode')` returns 'table' or 'grid' |
| 3 | Survives navigation | Navigate away → back, same view mode |
| 4 | Survives refresh | F5 reload, same view mode |
| 5 | Default | 'table' if no localStorage value |

---

## 4.7 CSV Export

**Triggered from:** `vendor-filters.tsx` (line 197, button `disabled={totalCount === 0}`)

### Export specification

| Field | CSV Header | Format |
|-------|-----------|--------|
| `name` | Vendor | Plain text |
| `monthly_cost` | Monthly Cost | Number (no $ sign in CSV) |
| `seats` | Seats | Integer |
| `status` | Status | active / warning / inactive |
| `category` | Category | Plain text |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Button enabled when vendors exist | Not disabled |
| 2 | Button disabled when 0 vendors | `disabled={totalCount === 0}` |
| 3 | Downloads .csv file | File name includes date or "inventory" |
| 4 | Headers correct | Vendor, Monthly Cost, Seats, Status, Category |
| 5 | Data matches current filters | If filtered to "Active", CSV only has active vendors |
| 6 | Special characters escaped | Vendor names with commas properly quoted |
| 7 | Large dataset | 100+ vendors exports without browser freeze |

---

## 4.8 Vendor Detail Drawer

**File:** `src/components/dashboard/vendor-drawer.tsx`

### Trigger
- Click on table row or grid card → drawer slides in from right

### Content displayed

| Field | Source | Format |
|-------|--------|--------|
| Vendor name | `name` | Large text + avatar |
| Status | `status` | Color badge |
| Monthly cost | `monthly_cost` | `$X,XXX/mo` |
| Annual cost | Calculated | `$X,XXX/yr` (monthly × 12) |
| Seats | `seats` | Integer |
| Last activity | `last_seen` | Relative time ("3 days ago") |
| Category | `category` | Tag |
| Spend share | Calculated | `X%` of total org spend + visual bar |
| Cost per seat | Calculated | `$X/seat/mo` |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Drawer opens on row click | Slides in from right |
| 2 | Correct vendor data | Matches clicked row |
| 3 | Close button works | X button or click outside closes drawer |
| 4 | Escape key closes | Keyboard accessibility |
| 5 | Annual cost correct | monthly_cost × 12 |
| 6 | Cost per seat correct | monthly_cost / seats |
| 7 | Spend share correct | (vendor_cost / total_cost) × 100 |
| 8 | "View Vendor Details" button | **Verify:** Is this a placeholder? If so, remove or disable with tooltip |
| 9 | Scroll if content long | Drawer body scrollable |
| 10 | Focus trap | Tab doesn't escape drawer while open |

---

## 4.9 Inventory Stats

**File:** `src/components/dashboard/inventory-stats.tsx`

### Stat cards

| Card | Calculation | Format |
|------|------------|--------|
| Total vendors | `vendors.length` | Integer |
| Active vendors | `vendors.filter(v => v.status === 'active').length` | Integer |
| Monthly spend | `vendors.reduce((sum, v) => sum + v.monthly_cost, 0)` | `$X.Xk` for large amounts |
| Avg cost per vendor | `total_spend / total_vendors` | `$XXX` |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | All 4 cards render | Correct values from seed data |
| 2 | Large number formatting | `$6.5k` instead of `$6,535` |
| 3 | Zero state | Shows `$0` / `0` without NaN |
| 4 | Animation | Count-up animation on load |

### Seed data expected values
```
Total vendors:   10
Active vendors:  7  (Salesforce, HubSpot, Slack, Figma, Zoom, Notion, GitHub)
Monthly spend:   $6,535/mo
Avg cost:        $653.50/vendor
```

---

## 4.10 E2E Test Coverage

### Spec files

| File | Tests | Coverage |
|------|-------|----------|
| `e2e/specs/inventory/table-grid.spec.ts` | ~7 | Default table, row content, grid toggle, persistence, drawer, sort, stats |
| `e2e/specs/inventory/filters.spec.ts` | ~5 | Search, status filter, cost range, combined, empty state |
| `e2e/specs/inventory/export.spec.ts` | ~3 | Button visibility, CSV download, filtered export |

### Test IDs (from `e2e/helpers/selectors.ts`)
```typescript
inventory: {
  table:        'vendor-table',
  grid:         'vendor-grid',
  viewToggle:   'view-toggle',
  searchInput:  'vendor-search',
  statusFilter: 'status-filter',
  costFilter:   'cost-filter',
  exportButton: 'export-csv',
  clearFilters: 'clear-filters',
  drawer:       'vendor-drawer',
  drawerClose:  'drawer-close',
  emptyState:   'inventory-empty',
}
```

### Running inventory E2E
```bash
npx playwright test e2e/specs/inventory/ --project=chromium
```

---

## Exit Criteria

| Criteria | Status |
|----------|--------|
| Table renders all 10 seed vendors | ☐ |
| Default sort is cost descending | ☐ |
| All column sorts work (name, cost, seats, status) | ☐ |
| Grid view renders with correct column count | ☐ |
| View mode persists in localStorage | ☐ |
| Search filter works (real-time, case-insensitive) | ☐ |
| Status filter shows correct subset | ☐ |
| Cost range filter works | ☐ |
| Combined filters work (AND logic) | ☐ |
| Clear all resets filters | ☐ |
| CSV export downloads correct data | ☐ |
| CSV matches current filters | ☐ |
| Vendor drawer opens with correct data | ☐ |
| Drawer close works (button, click outside, Escape) | ☐ |
| Stats cards show correct values | ☐ |
| Empty state renders for org with no vendors | ☐ |
| All inventory E2E specs pass | ☐ |

---

## Dependencies
- **Requires:** Phase 0 (build), Phase 1 (auth), Phase 3 (layout renders)
- **Data source:** Vendors populated by Phase 5 (Connections) → Phase 9 (sync-transactions cron)
- **Blocks:** None
