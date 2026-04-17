# Phase 2 — Dashboard Home

> **Objective:** The main dashboard page renders all five sections correctly — stats cards, getting-started checklist, quick actions, spend chart, and vendor breakdown — with real data from the database. Empty states render cleanly without errors. All interactive elements (links, buttons, tooltips) function as expected.

---

## 2.1 Stats Cards (Bento Grid)

**File:** `src/app/(dashboard)/page.tsx`

The dashboard fetches data from four tables and renders a bento grid layout:

| Card | Grid span | Data source | Displays |
|------|-----------|-------------|----------|
| **Estimated Waste** (hero) | 5 cols × 2 rows | `waste_reports` | Monthly waste $, annual projection, trend % vs last report, sparkline |
| **Total SaaS Spend** | 4 cols | `saas_vendors` (sum of monthly_cost where is_active) | Monthly total $, sparkline, trend badge |
| **Opportunities** | 3 cols | `waste_reports` (ghost_seats + duplicates count) | Actionable finding count, green accent |
| **User Activity** | 7 cols | `integration_connections` (user counts) | Total users vs inactive, progress ratio |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Hero waste card renders | Orange accent, shows `$X/mo` + annual projection |
| 2 | Trend badge | Shows `+X%` or `-X%` vs previous report (green for decrease, red for increase) |
| 3 | Sparkline backgrounds | SVG watermarks render in hero + spend cards |
| 4 | Zero-data state | All cards show `$0` / `0` without JS errors |
| 5 | Responsive | Cards reflow on mobile (stacked) and tablet (2-col) |
| 6 | Animation | Fade-in-up animation with staggered delay per card |

### Data flow verification
```sql
-- Total SaaS Spend
SELECT SUM(monthly_cost) FROM saas_vendors WHERE org_id = ? AND is_active = true;

-- Waste (from latest report)
SELECT ghost_seats, duplicates FROM waste_reports WHERE org_id = ? ORDER BY created_at DESC LIMIT 1;

-- User Activity
SELECT total_users, inactive_users FROM integration_connections WHERE org_id = ?;
```

---

## 2.2 Getting Started Checklist

### Steps

| Step | Check condition | Link |
|------|----------------|------|
| 1. Connect bank account | `plaid_connections` or `gocardless_connections` has active row | `/connections` |
| 2. Connect identity provider | `integration_connections` has active Okta or Google row | `/connections` |
| 3. Generate waste report | `waste_reports` has at least 1 row | `/reports` |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Empty org | All 3 steps unchecked, checklist visible |
| 2 | Bank connected | Step 1 shows checkmark, steps 2-3 unchecked |
| 3 | All complete | Checklist auto-hides (collapsed with fade-out) |
| 4 | Links work | Each step's link navigates to correct page |
| 5 | Collapsible | User can collapse/expand the checklist |
| 6 | Persistence | Collapsed state persists across page navigation |

---

## 2.3 Quick Actions

**File:** `src/components/dashboard/quick-actions.tsx`

| Button | Icon | Condition | Action |
|--------|------|-----------|--------|
| Generate/View Report | FileBarChart | Changes label based on report existence | Navigate to `/reports` |
| Connect Data Source | Plug | Hidden when both bank + identity connected | Navigate to `/connections` |
| Export CSV | Download | **DISABLED** (line 36: `disabled` prop) | No-op |

### Issues to resolve

| Issue | Severity | Recommendation |
|-------|----------|----------------|
| Export CSV permanently disabled | Medium | Either implement CSV export of dashboard summary or remove the button entirely. A disabled button with no tooltip/explanation is a UX dead-end. |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Report button navigates | Clicks through to `/reports` |
| 2 | Connect button visibility | Hidden when all providers connected |
| 3 | Connect button navigates | Clicks through to `/connections` |
| 4 | Export button decision | Implement or remove (currently dead) |
| 5 | Hover states | Each button has colored hover effect (orange, blue) |
| 6 | Icons render | Lucide icons match button purpose |

---

## 2.4 Spend Chart (30-day Area)

### Rendering conditions
- **Shown when:** Total monthly spend > $0
- **Hidden when:** No vendors or all vendors have $0 cost

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Chart renders with seed data | 30-day area chart with gradient fill |
| 2 | X-axis | Date labels (formatted) |
| 3 | Y-axis | Dollar amounts with grid lines |
| 4 | Tooltip | Hover shows date + formatted dollar amount |
| 5 | Responsive | Chart resizes on window change without distortion |
| 6 | Empty state | Chart section hidden entirely (no empty container) |
| 7 | Recharts import | Uses `recharts` library (Area, XAxis, YAxis, Tooltip, ResponsiveContainer) |

---

## 2.5 Vendor Breakdown (Donut Chart)

### Rendering conditions
- **Shown when:** Total monthly spend > $0
- **Hidden when:** No vendors

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Top 5 vendors shown | Sorted by cost descending |
| 2 | "Other" category | Remaining vendors grouped as "Other" |
| 3 | Color coding | Uses CSS variables `chart-1` through `chart-5` |
| 4 | Legend | Vendor names + spend amounts listed |
| 5 | Responsive | Chart + legend stack on mobile |
| 6 | Empty state | Section hidden entirely |

### Seed data verification
With default seed (10 vendors):
```
Salesforce:  $2,400/mo  (largest slice)
HubSpot:     $890/mo
Slack:        $875/mo
Figma:        $540/mo
Zoom:         $450/mo
Other:       $1,380/mo  (Jira + Notion + Asana + GitHub + Dropbox)
```

---

## 2.6 Server Component Data Fetching

**File:** `src/app/(dashboard)/page.tsx` — uses `export const dynamic = "force-dynamic"`

### Data queries (verify each succeeds)

| Query | Table(s) | Returns |
|-------|----------|---------|
| Active vendor costs | `saas_vendors` | `monthly_cost` where `is_active = true` |
| User counts | `integration_connections` | Total users per provider |
| Waste trend | `waste_reports` | Latest 2 reports for trend calculation |
| Connection status | `plaid_connections`, `gocardless_connections`, `integration_connections` | Boolean flags for checklist |

### Error handling
- Database query failure → caught by `error.tsx` boundary
- No data → renders empty states (not error page)

---

## 2.7 E2E Test Coverage

### Spec files

| File | Tests | Scenario |
|------|-------|----------|
| `e2e/specs/dashboard/home.spec.ts` | ~8 | Empty state, seeded state, checklist, stats, charts, quick actions |
| `e2e/specs/dashboard/navigation.spec.ts` | ~6 | Nav links, active state, org name, user email, mobile toggle |

### Test IDs (from `e2e/helpers/selectors.ts`)
```typescript
dashboard: {
  wasteCard:        'stat-waste',
  spendCard:        'stat-spend',
  opportunityCard:  'stat-opportunities',
  activityCard:     'stat-activity',
  checklist:        'getting-started',
  quickActions:     'quick-actions',
  spendChart:       'spend-chart',
  vendorBreakdown:  'vendor-breakdown',
  emptyState:       'dashboard-empty',
  reportButton:     'quick-report',
  connectButton:    'quick-connect',
}
```

### Running dashboard E2E
```bash
npx playwright test e2e/specs/dashboard/ --project=chromium
```

---

## Exit Criteria

| Criteria | Status |
|----------|--------|
| All 4 stats cards render with seed data | ☐ |
| Trend badges show correct % direction | ☐ |
| Getting-started checklist reflects real data | ☐ |
| Checklist auto-hides when complete | ☐ |
| Quick action buttons navigate correctly | ☐ |
| Export CSV button decision made (implement or remove) | ☐ |
| Spend chart renders with seed data | ☐ |
| Vendor breakdown donut shows top 5 + Other | ☐ |
| Empty org shows clean zero states | ☐ |
| All dashboard E2E specs pass | ☐ |

---

## Dependencies
- **Requires:** Phase 0 (build), Phase 1 (auth — must be logged in to see dashboard)
- **Blocks:** None (other phases can proceed in parallel after Phase 1)
