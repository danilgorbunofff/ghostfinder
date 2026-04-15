# Phase 2 — Dashboard Layout & Navigation

> **Priority:** High — the shell that wraps every dashboard page  
> **Estimated scope:** 2 files modified, 2 new files created  
> **Dependencies:** Phase 0 (brand tokens, ThemeToggle component)

---

## Objective

Redesign the dashboard's structural skeleton: sidebar navigation, top header bar, user profile area, and mobile responsive behavior. This phase touches every page implicitly — it's the persistent frame users see 100% of the time inside the app.

---

## Current State Assessment

| Area | Current | Problem |
|---|---|---|
| Active nav item | `bg-accent text-accent-foreground` (gray) | Indistinguishable from hover state; no visual "you are here" signal |
| Sidebar header | Plain Ghost icon + "GhostFinder" text, no background | Feels flat; no brand personality in the navigation chrome |
| User info | Email text + "Sign out" button at sidebar bottom | No avatar; email truncates awkwardly; sign out is prominent but rarely used |
| Top area | None — content starts immediately in `<main>` | No page title breadcrumb; no quick-access user menu; wastes horizontal space |
| Mobile sidebar | Slide from left, `bg-black/50` overlay | No easing function on transition — feels snappy/abrupt |
| Icon coloring | All icons are same color as text | No semantic meaning; harder to scan 6 identical items |
| Dark mode toggle | Doesn't exist | Users are stuck on light mode |

---

## Implementation Steps

### Step 1 — Create Page Header Component

**New file:** `src/components/dashboard/page-header.tsx`

This replaces the inline `<h1>` + `<p>` pattern that every page currently duplicates. It adds breadcrumbs and a right-aligned user avatar dropdown.

```tsx
'use client'

import { usePathname } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { LogOut, Settings, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PageHeaderProps {
  userEmail: string
  orgName: string
}

const pathLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/inventory': 'SaaS Inventory',
  '/connections': 'Connections',
  '/reports': 'Waste Reports',
  '/billing': 'Billing',
  '/settings': 'Settings',
}

export function PageHeader({ userEmail, orgName }: PageHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const pageTitle = pathLabels[pathname] ?? 'Dashboard'
  const initials = userEmail
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between border-b bg-background/80 backdrop-blur-sm px-6 py-3 sticky top-0 z-30">
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
          <Link href="/" className="hover:text-foreground transition-colors">
            {orgName}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{pageTitle}</span>
        </nav>
        <h1 className="text-xl font-semibold tracking-tight">{pageTitle}</h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-brand text-brand-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="text-sm font-medium">{userEmail}</p>
            <p className="text-xs text-muted-foreground">{orgName}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

### Step 2 — Redesign Sidebar Active State & Icon Colors

**File:** `src/components/dashboard/sidebar-nav.tsx`

Replace the flat `bg-accent` active state with a brand-colored pill with left border accent:

```tsx
// Update navItems with per-icon colors
const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, iconColor: 'text-brand' },
  { label: 'Inventory', href: '/inventory', icon: Package, iconColor: 'text-violet-500' },
  { label: 'Connections', href: '/connections', icon: Plug, iconColor: 'text-blue-500' },
  { label: 'Reports', href: '/reports', icon: FileBarChart, iconColor: 'text-orange-500' },
  { label: 'Billing', href: '/billing', icon: CreditCard, iconColor: 'text-green-500' },
  { label: 'Settings', href: '/settings', icon: Settings, iconColor: 'text-muted-foreground' },
]
```

Update the nav link rendering:

```tsx
<Link
  key={item.href}
  href={item.href}
  onClick={() => setMobileOpen(false)}
  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
    active
      ? 'bg-brand-muted text-foreground border-l-2 border-brand ml-0 pl-2.5'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
  }`}
>
  <Icon className={`h-4 w-4 ${active ? item.iconColor : ''}`} />
  {item.label}
</Link>
```

### Step 3 — Upgrade Sidebar Header

Replace the plain logo area with a branded header strip:

```tsx
{/* Sidebar header */}
<div className="flex items-center gap-2.5 px-4 py-5 border-b">
  <div className="rounded-lg bg-foreground p-1.5">
    <Ghost className="h-5 w-5 text-background" />
  </div>
  <div>
    <span className="text-base font-bold tracking-tight">GhostFinder</span>
  </div>
</div>

{/* Org info */}
<div className="px-4 py-3">
  <p className="text-sm font-medium truncate">{orgName}</p>
  <p className="text-xs text-muted-foreground capitalize">{role}</p>
</div>
```

### Step 4 — Compact Sidebar Footer with Avatar + Theme Toggle

Replace the current footer (email text + full sign-out button) with a compact avatar row plus theme toggle:

```tsx
import { ThemeToggle } from '@/components/ui/theme-toggle'

{/* Sidebar footer */}
<div className="border-t p-3">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback className="bg-brand text-brand-foreground text-[10px] font-semibold">
          {user.email?.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground truncate">
        {user.email}
      </span>
    </div>
    <ThemeToggle />
  </div>
</div>
```

Remove the existing "Sign out" button from sidebar — it now lives in the `PageHeader` dropdown.

### Step 5 — Update Dashboard Layout to Include PageHeader

**File:** `src/app/(dashboard)/layout.tsx`

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { PageHeader } from '@/components/dashboard/page-header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(id, name)')
    .eq('user_id', user.id)
    .single()

  const orgName = (membership?.organizations as unknown as { name: string } | null)?.name ?? 'My Org'
  const role = membership?.role ?? 'member'

  return (
    <div className="flex h-screen">
      <SidebarNav
        user={user}
        orgName={orgName}
        role={role}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          userEmail={user.email ?? ''}
          orgName={orgName}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### Step 6 — Improve Mobile Sidebar Animation

Add `duration-300 ease-in-out` easing to the slide transition:

```tsx
{/* Mobile sidebar */}
<aside
  className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform duration-300 ease-in-out md:hidden ${
    mobileOpen ? 'translate-x-0' : '-translate-x-full'
  }`}
>
  {sidebarContent}
</aside>
```

Also add transition to the overlay:

```tsx
{/* Mobile overlay */}
<div
  className={`fixed inset-0 z-30 bg-black/50 md:hidden transition-opacity duration-300 ${
    mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
  }`}
  onClick={() => setMobileOpen(false)}
/>
```

### Step 7 — Remove Per-Page `<h1>` Headers

Since `PageHeader` now renders the page title from the pathname, remove the manual `<h1>` + description from each page. Update all 6 dashboard pages:

```tsx
// BEFORE (in each page):
<div>
  <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
  <p className="text-muted-foreground">
    Your SaaS spend overview and optimization opportunities.
  </p>
</div>

// AFTER: Remove entirely — PageHeader handles it.
// Keep the descriptive <p> if it adds page-specific context:
<p className="text-muted-foreground mb-4">
  Your SaaS spend overview and optimization opportunities.
</p>
```

---

## Sidebar Layout Structure (After)

```
<aside> (w-64, border-r)
├── Header (border-b)
│   ├── Ghost icon in dark pill
│   └── "GhostFinder" text
├── Org info
│   ├── Org name (font-medium)
│   └── Role badge (capitalize, muted)
├── Nav items (flex-1, scrollable)
│   ├── Dashboard (brand icon, active = brand-muted bg + left border)
│   ├── Inventory (violet icon)
│   ├── Connections (blue icon)
│   ├── Reports (orange icon)
│   ├── Billing (green icon)
│   └── Settings (muted icon)
└── Footer (border-t)
    ├── Avatar (initials, brand bg)
    ├── Email (truncated)
    └── ThemeToggle button
```

---

## Files Changed

| File | Action | Description |
|---|---|---|
| `src/components/dashboard/sidebar-nav.tsx` | Modified | Active state, icon colors, header, footer with avatar + theme toggle, mobile animation |
| `src/app/(dashboard)/layout.tsx` | Modified | Added PageHeader, adjusted main padding |
| `src/components/dashboard/page-header.tsx` | Created | Breadcrumb + page title + user avatar dropdown |
| All 6 dashboard `page.tsx` files | Modified | Remove inline `<h1>` headers (PageHeader handles it) |

---

## Verification Checklist

- [ ] Active sidebar item shows brand-colored left border + tinted background
- [ ] Each nav icon has its own semantic color (violet, blue, orange, green)
- [ ] Sidebar footer shows user avatar initials in brand color circle
- [ ] Dark mode toggle in sidebar footer switches theme correctly
- [ ] Page header shows breadcrumb: `OrgName / Page Title`
- [ ] Page header user dropdown opens on avatar click
- [ ] "Sign out" in dropdown logs out and redirects to `/login`
- [ ] Mobile sidebar slides in with smooth 300ms ease-in-out
- [ ] Mobile overlay fades in/out (not instant show/hide)
- [ ] No duplicate `<h1>` on any page (PageHeader is the single source)
- [ ] Sidebar width is consistent (256px / `w-64`) on desktop
- [ ] Content area padding scales: 16px mobile → 24px tablet → 32px desktop

---

## Design Decisions

| Decision | Rationale |
|---|---|
| Left border accent over pill background | More visually distinct; matches Vercel, Linear, and Notion sidebar patterns |
| Per-icon colors | Helps users build muscle memory for navigation; reduces cognitive load |
| PageHeader with breadcrumb | Provides persistent location context; frees up main content area |
| Avatar dropdown for sign-out | Sign out is a rare action — burying it in a dropdown reduces sidebar clutter |
| `backdrop-blur-sm` on header | Creates visual separation when scrolling content beneath the sticky header |
| Removed padding increase | `p-4 md:p-6 lg:p-8` gives more content space on mid-size screens vs old `p-6 md:p-8` |
