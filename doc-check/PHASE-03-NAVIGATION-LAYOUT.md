# Phase 3 — Sidebar Navigation & Layout

> **Objective:** The dashboard shell renders correctly — sidebar with all 6 navigation links, active state indicators, mobile responsive hamburger menu, page header with breadcrumbs and user dropdown, theme toggle, error boundary, and loading skeletons. This is the frame that wraps every dashboard page.

---

## 3.1 Desktop Sidebar

**File:** `src/components/dashboard/sidebar-nav.tsx`

### Navigation links

| Label | Path | Icon | Accent Color | data-testid |
|-------|------|------|-------------|-------------|
| Dashboard | `/` | LayoutDashboard | Purple/brand | `nav-dashboard` |
| Inventory | `/inventory` | Package | Violet-500 | `nav-inventory` |
| Connections | `/connections` | Plug | Blue-500 | `nav-connections` |
| Reports | `/reports` | FileBarChart | Orange-500 | `nav-reports` |
| Billing | `/billing` | CreditCard | Green-500 | `nav-billing` |
| Settings | `/settings` | Settings | Muted | `nav-settings` |

### Active state indicator
- 3px vertical bar on left side (animated with spring transition)
- Background changes to `bg-brand-muted/80`
- Icon background changes color
- Link text color shifts to active accent

### Sidebar sections
```
┌─────────────────────┐
│  👻 GhostFinder     │  ← Logo + name (glow effect)
│                     │
│  Org Name           │  ← data-testid="nav-org-name"
│  Owner              │  ← data-testid="nav-user-role" (capitalized)
├─────────────────────┤
│  ▎ Dashboard        │  ← Active indicator
│    Inventory        │
│    Connections      │
│    Reports          │
│    Billing          │
│    Settings         │
├─────────────────────┤
│  👤 user@email.com  │  ← Avatar (initials) + email
│  🌓 Theme toggle    │
└─────────────────────┘
```

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | All 6 links render | Correct icons, labels, paths |
| 2 | Active link detection | Current route has animated indicator bar |
| 3 | Click navigation | Each link navigates to correct page |
| 4 | Org name displayed | From `organizations` table | 
| 5 | User role displayed | Capitalized: "Owner", "Admin", "Member", "Viewer" |
| 6 | User avatar | Shows initials from email (first 2 chars of local part) |
| 7 | User email | Full email shown in sidebar footer |
| 8 | Sidebar width | 264px fixed on desktop |
| 9 | Logo glow effect | CSS glow renders around ghost icon |
| 10 | Hover states | Links show hover background + icon color shift |

---

## 3.2 Mobile Sidebar

### Responsive behavior
- **Desktop (≥1024px):** Sidebar always visible, 264px fixed
- **Mobile (<1024px):** Sidebar hidden, hamburger toggle in top-left

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Hamburger button | Visible on mobile, top-left corner | `nav-mobile-toggle` |
| 2 | Toggle opens sidebar | Sidebar slides in from left as overlay |
| 3 | Backdrop | Semi-transparent overlay behind sidebar |
| 4 | Click nav closes | Clicking any nav item closes sidebar |
| 5 | Click backdrop closes | Clicking overlay area closes sidebar |
| 6 | Z-index | Sidebar z-50 (above all content) |
| 7 | Scroll lock | Body scroll disabled while sidebar open |
| 8 | No layout shift | Main content doesn't resize when sidebar opens |

### Test at breakpoints
- 375px (iPhone SE)
- 390px (iPhone 14)
- 768px (iPad)
- 1024px (breakpoint boundary)
- 1280px+ (desktop)

---

## 3.3 Page Header

**File:** `src/components/dashboard/page-header.tsx`

### Route label mapping
| Path | Page title |
|------|-----------|
| `/` | Dashboard |
| `/inventory` | SaaS Inventory |
| `/connections` | Connections |
| `/reports` | Waste Reports |
| `/billing` | Billing |
| `/settings` | Settings |

### Components

| Element | Detail | data-testid |
|---------|--------|-------------|
| Breadcrumb | `{orgName} / {pageTitle}` | `page-header` |
| User avatar | Dropdown trigger (initials circle) | — |
| Dropdown: Settings | Navigates to `/settings` | — |
| Dropdown: Sign out | Clears session → redirects to `/login` | — |
| Email display | Shown in dropdown | `header-user-email` |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Breadcrumb updates per route | Correct `orgName / pageTitle` |
| 2 | Avatar renders | Initials from email, consistent with sidebar |
| 3 | Dropdown opens on click | Settings + Sign out items visible |
| 4 | Settings link works | Navigates to `/settings` |
| 5 | Sign out works | Calls `supabase.auth.signOut()` → redirect to `/login` |
| 6 | Session cleared | After sign out, `/` redirects to `/login` |

---

## 3.4 Theme Toggle

### Implementation
- Library: `next-themes` (ThemeProvider in root layout)
- Strategy: `class` based (adds `dark` class to `<html>`)
- Default: system preference

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Toggle button visible | In sidebar footer area |
| 2 | Click toggles theme | Light ↔ Dark |
| 3 | Theme persists | Survives page refresh (localStorage) |
| 4 | System default | First visit follows OS preference |
| 5 | No flash | No white flash on dark-mode load (class strategy) |
| 6 | All pages render in dark | Colors use CSS variables, not hardcoded |

### Color system
The app uses **OKLCh color space** with semantic tokens:
```css
--background     --foreground
--primary        --primary-foreground
--secondary      --secondary-foreground
--accent         --accent-foreground
--destructive    --success    --warning
--brand          --brand-muted
--sidebar        --sidebar-primary  --sidebar-accent
--chart-1..5
```

---

## 3.5 Dashboard Layout

**File:** `src/app/(dashboard)/layout.tsx`

### Responsibilities
1. **Auth gate:** Redirects to `/login` if no user session
2. **Organization safety net:** Calls `ensureOrganization()` on every load
3. **Data fetching:** Gets org membership + role for sidebar
4. **Ambient background:** Gradient + dot grid + noise overlay
5. **Dev tools:** Loads dev panel in development mode only

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Unauthenticated → redirect | No flash of dashboard content |
| 2 | Org created if missing | `ensureOrganization()` idempotent |
| 3 | Role passed to sidebar | Correct role badge in sidebar |
| 4 | Background renders | Gradient visible behind content |
| 5 | Dev tools | Visible only when `NODE_ENV=development` |
| 6 | Content area | Proper padding, scrollable, full height |

---

## 3.6 Error Boundary

**File:** `src/app/(dashboard)/error.tsx`

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Catches runtime errors | Component errors don't crash entire app |
| 2 | Error message displayed | User-friendly message (not raw stack trace) |
| 3 | Retry button | Calls `reset()` to re-render the failed segment |
| 4 | Styling | Centered card with icon, matches design system |
| 5 | Doesn't catch layout errors | Layout errors bubble to root error boundary |

### Manual test
```typescript
// Temporarily add to any dashboard page to trigger:
throw new Error("Test error boundary");
```

---

## 3.7 Loading Skeletons

Every dashboard sub-route has a `loading.tsx` that renders during Suspense:

| File | Skeleton content |
|------|-----------------|
| `src/app/(dashboard)/billing/loading.tsx` | Pricing card placeholders |
| `src/app/(dashboard)/connections/loading.tsx` | Connection card placeholders |
| `src/app/(dashboard)/inventory/loading.tsx` | Table row + filter bar placeholders |
| `src/app/(dashboard)/reports/loading.tsx` | Report card placeholders |
| `src/app/(dashboard)/settings/loading.tsx` | Settings form placeholders |

### Checklist per skeleton

| # | Check | Expected |
|---|-------|----------|
| 1 | Renders on slow load | Skeleton visible during data fetch |
| 2 | Matches page layout | Skeleton shape resembles actual content |
| 3 | Animated pulse | Tailwind `animate-pulse` on placeholder elements |
| 4 | No layout shift | Skeleton → real content transitions smoothly |
| 5 | Responsive | Skeleton adapts to viewport width |

---

## 3.8 E2E Test Coverage

### Spec file: `e2e/specs/dashboard/navigation.spec.ts`

| Test | Assertion |
|------|-----------|
| Dashboard link | Navigates to `/`, heading visible |
| Inventory link | Navigates to `/inventory` |
| Connections link | Navigates to `/connections` |
| Reports link | Navigates to `/reports` |
| Billing link | Navigates to `/billing` |
| Settings link | Navigates to `/settings` |
| Org name displays | `nav-org-name` has correct text |
| User email displays | `header-user-email` has correct text |
| Active link indicator | Current route link has active styling |
| Mobile toggle | Hamburger opens/closes sidebar |

### Test IDs (from `e2e/helpers/selectors.ts`)
```typescript
nav: {
  sidebar:       'sidebar-nav',
  dashboard:     'nav-dashboard',
  inventory:     'nav-inventory',
  connections:   'nav-connections',
  reports:       'nav-reports',
  billing:       'nav-billing',
  settings:      'nav-settings',
  orgName:       'nav-org-name',
  userRole:      'nav-user-role',
  mobileToggle:  'nav-mobile-toggle',
  // ... additional nav IDs
}

header: {
  pageHeader:    'page-header',
  userEmail:     'header-user-email',
}
```

---

## Exit Criteria

| Criteria | Status |
|----------|--------|
| All 6 sidebar links navigate correctly | ☐ |
| Active link indicator animates on correct link | ☐ |
| Org name + user role display in sidebar | ☐ |
| User avatar + email in sidebar footer | ☐ |
| Theme toggle switches light ↔ dark | ☐ |
| Theme persists across refresh | ☐ |
| Mobile hamburger opens/closes sidebar | ☐ |
| Page header breadcrumb updates per route | ☐ |
| Sign out clears session + redirects | ☐ |
| Error boundary catches + displays retry | ☐ |
| All 5 loading skeletons render | ☐ |
| Navigation E2E specs pass | ☐ |

---

## Dependencies
- **Requires:** Phase 0 (build), Phase 1 (auth)
- **Blocks:** None directly, but all Phases 4–8 rely on this layout rendering correctly
