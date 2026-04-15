# Phase 1 — Foundation & Dashboard Shell

> **Goal:** Establish Supabase Auth, multi-tenant database schema with RLS, the authenticated dashboard layout, and a high-value UI shell with mock data — so the app looks real and the security model is proven before any external API integration.

---

## Table of Contents

1. [Supabase Auth Configuration](#1-supabase-auth-configuration)
2. [Supabase Client Libraries](#2-supabase-client-libraries)
3. [Next.js Auth Middleware](#3-nextjs-auth-middleware)
4. [Auth Pages (Login / Signup / Callback)](#4-auth-pages-login--signup--callback)
5. [Database Schema — Migration 1](#5-database-schema--migration-1)
6. [Row Level Security — Migration 2](#6-row-level-security--migration-2)
7. [Dashboard Layout & Navigation](#7-dashboard-layout--navigation)
8. [Dashboard KPI Cards](#8-dashboard-kpi-cards)
9. [Vendor Inventory Table](#9-vendor-inventory-table)
10. [TypeScript Types](#10-typescript-types)
11. [First Vercel Deploy](#11-first-vercel-deploy)
12. [Acceptance Criteria](#12-acceptance-criteria)

---

## 1. Supabase Auth Configuration

### 1.1 — Supabase Dashboard Setup

In the Supabase Cloud dashboard:

1. **Authentication → Providers:**
   - Enable **Email** (email/password sign-in)
   - Enable **Google** OAuth (paste `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`)
2. **Authentication → URL Configuration:**
   - Site URL: `http://localhost:3000` (dev) / `https://your-app.vercel.app` (prod)
   - Redirect URLs: `http://localhost:3000/callback`, `https://your-app.vercel.app/callback`
3. **Authentication → Email Templates:**
   - Customize confirm email and magic link templates with your brand (optional for Phase 1)

### 1.2 — Google OAuth Credentials

In Google Cloud Console:
1. Create OAuth 2.0 Client ID (Web application)
2. Authorized redirect URIs:
   - `http://localhost:54321/auth/v1/callback` (local Supabase)
   - `https://<your-supabase-ref>.supabase.co/auth/v1/callback` (production)
3. Copy Client ID + Secret → Supabase dashboard + `.env.local`

---

## 2. Supabase Client Libraries

Three client variants serve different execution contexts. Each has distinct security boundaries.

### 2.1 — Browser Client

**File:** `src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**When to use:** Client Components (`'use client'`), browser-side interactivity.
**Security:** Uses `ANON_KEY` — all queries go through RLS. Safe to expose.

### 2.2 — Server Client (SSR / Server Components / Route Handlers)

**File:** `src/lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — cookies are read-only.
            // Session refresh will be handled by middleware.
          }
        },
      },
    }
  )
}
```

**When to use:** Server Components, Route Handlers, Server Actions.
**Security:** Uses `ANON_KEY` + user's session cookies. RLS enforced. The `try/catch` in `setAll` is required because Server Components cannot set cookies — only middleware and Route Handlers can.

### 2.3 — Admin Client (Service Role)

**File:** `src/lib/supabase/admin.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

**When to use:** Cron jobs, webhooks, background workers — anywhere you need to bypass RLS.
**Security:** Uses `SERVICE_ROLE_KEY` — **bypasses all RLS policies**. NEVER import in client code. NEVER expose this key in `NEXT_PUBLIC_*` variables.

### 2.4 — Middleware Helper

**File:** `src/lib/supabase/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do NOT use getSession() — it reads from cookies without
  // validation. getUser() makes a server call to verify the JWT.
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users accessing protected routes
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/callback') &&
    !request.nextUrl.pathname.startsWith('/api') &&
    request.nextUrl.pathname !== '/'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

> **Critical:** Always use `getUser()`, never `getSession()`. `getSession()` reads from the cookie without server-side validation — an attacker could forge a session cookie.

---

## 3. Next.js Auth Middleware

**File:** `src/middleware.ts`

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     * - API routes that handle their own auth (webhooks, cron)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**What this does:**
1. Runs on every navigation request (not static files or images)
2. Refreshes the Supabase session (extends cookie expiry)
3. Redirects unauthenticated users from `/dashboard/*` to `/login`
4. Allows unauthenticated access to `/`, `/login`, `/signup`, `/callback`, `/api/*`

---

## 4. Auth Pages (Login / Signup / Callback)

### 4.1 — Login Page

**File:** `src/app/(auth)/login/page.tsx`

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/') // Redirects to dashboard via middleware
    router.refresh()
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to Ghost Finder</CardTitle>
          <CardDescription>
            Find unused SaaS subscriptions and save money.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
            Continue with Google
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 4.2 — Signup Page

**File:** `src/app/(auth)/signup/page.tsx`

Same structure as login but calls:

```typescript
await supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: `${window.location.origin}/callback` }
})
```

After signup, the auto-create trigger (Migration 1) will create an organization for the user.

### 4.3 — OAuth Callback Route

**File:** `src/app/(auth)/callback/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
```

**How it works:**
1. Supabase OAuth redirects back to `/callback?code=xxx`
2. This route exchanges the `code` for a session (sets cookies)
3. Redirects to the dashboard

---

## 5. Database Schema — Migration 1

**File:** `supabase/migrations/00001_initial_schema.sql`

```sql
-- ============================================================================
-- MIGRATION 1: Core multi-tenant schema
-- Creates: organizations, org_members, auto-create trigger
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Organizations (Tenants) ────────────────────────────────────────────────
CREATE TABLE public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT 'My Organization',
  slug        TEXT UNIQUE,                              -- URL-friendly name
  stripe_customer_id TEXT UNIQUE,                       -- Linked in Phase 5
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.organizations IS 'Tenant boundary. All data is scoped to an org.';

-- ─── Organization Members ───────────────────────────────────────────────────
CREATE TABLE public.org_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

COMMENT ON TABLE public.org_members IS 'Maps users to organizations with role-based access.';

-- Indexes for RLS policy performance
CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX idx_org_members_org_id  ON public.org_members(org_id);

-- ─── Auto-Create Trigger ────────────────────────────────────────────────────
-- When a new user signs up, automatically create an org and add them as owner.
-- This ensures every user has at least one org immediately after signup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create a default organization for the new user
  INSERT INTO public.organizations (name)
  VALUES (
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.email,
      'My Organization'
    ) || '''s Organization'
  )
  RETURNING id INTO new_org_id;

  -- Add user as the owner of the new org
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- Trigger: runs after each new user is created in auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── Updated At Trigger ─────────────────────────────────────────────────────
-- Generic trigger to auto-update the updated_at column on row changes.

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **`organizations` as tenant boundary** | Every multi-tenant table has `org_id` FK. RLS policies filter by org membership. |
| **Auto-create trigger** | Zero-friction onboarding — user signs up, org exists, they're the owner. No manual setup. |
| **Role enum as CHECK constraint** | Four roles: `owner` (billing, delete org), `admin` (manage members, integrations), `member` (view data), `viewer` (read-only). |
| **`SECURITY DEFINER`** | Trigger runs with the function owner's permissions (bypasses RLS) so it can insert into tables the new user doesn't have access to yet. |
| **`SET search_path = public`** | Prevents search_path injection in SECURITY DEFINER functions. |

---

## 6. Row Level Security — Migration 2

**File:** `supabase/migrations/00002_enable_rls.sql`

```sql
-- ============================================================================
-- MIGRATION 2: Row Level Security policies
-- Enforces: Users can only access data belonging to their organization.
-- ============================================================================

-- ─── Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members    ENABLE ROW LEVEL SECURITY;

-- ─── Helper: Get user's org IDs (cached per statement) ──────────────────────
-- Using a subquery with (SELECT auth.uid()) caches the value per statement,
-- which significantly improves performance when multiple RLS checks execute.

-- ─── Organizations Policies ─────────────────────────────────────────────────

-- SELECT: Users can view organizations they belong to
CREATE POLICY "org_select_own"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = organizations.id
        AND user_id = (SELECT auth.uid())
    )
  );

-- UPDATE: Only owners and admins can update org details
CREATE POLICY "org_update_admin"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = organizations.id
        AND user_id = (SELECT auth.uid())
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = organizations.id
        AND user_id = (SELECT auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

-- DELETE: Only the owner can delete the org
CREATE POLICY "org_delete_owner"
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = organizations.id
        AND user_id = (SELECT auth.uid())
        AND role = 'owner'
    )
  );

-- INSERT: Handled by the auto-create trigger (SECURITY DEFINER).
-- No direct insert policy needed for authenticated users.

-- ─── Org Members Policies ───────────────────────────────────────────────────

-- SELECT: Users can see members of orgs they belong to
CREATE POLICY "members_select_own_org"
  ON public.org_members
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = (SELECT auth.uid())
    )
  );

-- INSERT: Only owners and admins can add members
CREATE POLICY "members_insert_admin"
  ON public.org_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role IN ('owner', 'admin')
    )
  );

-- UPDATE: Only owners can change member roles
CREATE POLICY "members_update_owner"
  ON public.org_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role = 'owner'
    )
  );

-- DELETE: Owners and admins can remove members (but owners can't be removed)
CREATE POLICY "members_delete_admin"
  ON public.org_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role IN ('owner', 'admin')
    )
    AND role != 'owner'  -- Prevent removing the owner
  );
```

### RLS Testing Strategy

```sql
-- Test as User A (owner of Org 1):
-- Should see: Org 1 data
-- Should NOT see: Org 2 data

-- 1. Create two test users in Supabase Auth
-- 2. Each auto-gets an org via trigger
-- 3. Insert test data into each org
-- 4. Query as User A → verify only Org 1 data returned
-- 5. Query as User B → verify only Org 2 data returned

-- Quick test (run in Supabase SQL Editor as anon role):
SET request.jwt.claims = '{"sub": "user-a-uuid"}';
SELECT * FROM organizations;  -- Should only return User A's org
```

---

## 7. Dashboard Layout & Navigation

### 7.1 — Dashboard Layout

**File:** `src/app/(dashboard)/layout.tsx`

This is a Server Component that:
1. Verifies the user is authenticated (server-side check)
2. Fetches the user's organization
3. Renders the sidebar navigation
4. Wraps all dashboard pages

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's org membership
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(id, name)')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="flex h-screen">
      <SidebarNav
        user={user}
        orgName={membership?.organizations?.name ?? 'My Org'}
        role={membership?.role ?? 'member'}
      />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
```

### 7.2 — Sidebar Navigation

**File:** `src/components/dashboard/sidebar-nav.tsx`

Navigation items:

| Item | Route | Icon | Description |
|------|-------|------|-------------|
| Dashboard | `/` | `LayoutDashboard` | KPI overview |
| Inventory | `/inventory` | `Package` | SaaS vendor list |
| Connections | `/connections` | `Plug` | Manage integrations |
| Reports | `/reports` | `FileBarChart` | Waste reports |
| Billing | `/billing` | `CreditCard` | Subscription management |
| Settings | `/settings` | `Settings` | Org settings |

Install `lucide-react` for icons:

```bash
npm i lucide-react
```

### 7.3 — Auth Route Group `(auth)`

The `(auth)` route group does NOT share the dashboard layout. Login and signup pages render without the sidebar.

```
src/app/
├── (auth)/          # No shared layout — standalone pages
│   ├── login/
│   └── signup/
├── (dashboard)/     # Shared layout with sidebar + auth guard
│   ├── layout.tsx
│   ├── page.tsx
│   ├── inventory/
│   └── ...
```

---

## 8. Dashboard KPI Cards

### 8.1 — Stats Cards Component

**File:** `src/components/dashboard/stats-cards.tsx`

Three high-value KPI cards dominate the dashboard:

| Card | Label | Mock Value | Color | Icon |
|------|-------|------------|-------|------|
| 1 | Total SaaS Spend | $12,450/mo | Blue | `DollarSign` |
| 2 | Estimated Waste | $3,200/mo | Red/Orange | `AlertTriangle` |
| 3 | Optimization Opportunities | 14 actions | Green | `TrendingDown` |

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, AlertTriangle, TrendingDown } from 'lucide-react'

interface StatsCardsProps {
  totalSpend: number
  estimatedWaste: number
  opportunities: number
}

export function StatsCards({ totalSpend, estimatedWaste, opportunities }: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total SaaS Spend</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${totalSpend.toLocaleString()}/mo
          </div>
          <p className="text-xs text-muted-foreground">
            Across all connected accounts
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Estimated Waste</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-500">
            ${estimatedWaste.toLocaleString()}/mo
          </div>
          <p className="text-xs text-muted-foreground">
            Ghost seats + duplicate subscriptions
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Optimization Opportunities</CardTitle>
          <TrendingDown className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">
            {opportunities}
          </div>
          <p className="text-xs text-muted-foreground">
            Actionable savings identified
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 8.2 — Dashboard Page

**File:** `src/app/(dashboard)/page.tsx`

```typescript
import { StatsCards } from '@/components/dashboard/stats-cards'

export default function DashboardPage() {
  // Phase 1: Mock data. Replaced with real queries in Phases 2-4.
  const mockStats = {
    totalSpend: 12450,
    estimatedWaste: 3200,
    opportunities: 14,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Your SaaS spend overview and optimization opportunities.
        </p>
      </div>
      <StatsCards {...mockStats} />
    </div>
  )
}
```

---

## 9. Vendor Inventory Table

### 9.1 — Mock Vendor Data

This table previews the SaaS inventory a customer will see after connecting Plaid. In Phase 1 it uses hardcoded data. Phase 2 replaces it with real transaction-derived vendors.

| Vendor | Monthly Cost | Seats | Last Activity | Status |
|--------|-------------|-------|---------------|--------|
| Slack | $12.50/user × 45 = $562 | 45 | 2 days ago | Active |
| Zoom | $14.99/user × 38 = $570 | 38 | 5 days ago | Active |
| Adobe Creative Cloud | $54.99/user × 12 = $660 | 12 | 45 days ago | Inactive |
| GitHub | $4.00/user × 22 = $88 | 22 | 1 day ago | Active |
| Figma | $15.00/user × 8 = $120 | 8 | 60 days ago | Inactive |
| Salesforce | $150/user × 30 = $4,500 | 30 | 3 days ago | Active |
| HubSpot | $45/user × 15 = $675 | 15 | 30 days ago | Warning |
| Jira | $7.75/user × 22 = $170 | 22 | 1 day ago | Active |
| Notion | $10/user × 50 = $500 | 50 | 7 days ago | Active |
| Microsoft 365 | $22/user × 100 = $2,200 | 100 | 1 day ago | Active |

### 9.2 — Vendor Table Component

**File:** `src/components/dashboard/vendor-table.tsx`

```typescript
'use client'

import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Vendor {
  name: string
  monthlyCost: number
  seats: number
  lastActivity: string
  status: 'active' | 'inactive' | 'warning'
}

const statusVariant = {
  active: 'default',
  inactive: 'destructive',
  warning: 'secondary',
} as const

export function VendorTable({ vendors }: { vendors: Vendor[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vendor</TableHead>
          <TableHead className="text-right">Monthly Cost</TableHead>
          <TableHead className="text-right">Seats</TableHead>
          <TableHead>Last Activity</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vendors.map((vendor) => (
          <TableRow key={vendor.name}>
            <TableCell className="font-medium">{vendor.name}</TableCell>
            <TableCell className="text-right">
              ${vendor.monthlyCost.toLocaleString()}
            </TableCell>
            <TableCell className="text-right">{vendor.seats}</TableCell>
            <TableCell>{vendor.lastActivity}</TableCell>
            <TableCell>
              <Badge variant={statusVariant[vendor.status]}>
                {vendor.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### 9.3 — Inventory Page

**File:** `src/app/(dashboard)/inventory/page.tsx`

```typescript
import { VendorTable } from '@/components/dashboard/vendor-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const mockVendors = [
  { name: 'Slack', monthlyCost: 562, seats: 45, lastActivity: '2 days ago', status: 'active' as const },
  { name: 'Zoom', monthlyCost: 570, seats: 38, lastActivity: '5 days ago', status: 'active' as const },
  { name: 'Adobe Creative Cloud', monthlyCost: 660, seats: 12, lastActivity: '45 days ago', status: 'inactive' as const },
  // ... more vendors
]

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SaaS Inventory</h1>
        <p className="text-muted-foreground">
          All detected software subscriptions across your connected accounts.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Vendors ({mockVendors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <VendorTable vendors={mockVendors} />
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## 10. TypeScript Types

**File:** `src/lib/types/index.ts`

Define shared types used across the app:

```typescript
// ─── Database Row Types (supplement auto-generated types) ───────────────────

export interface Organization {
  id: string
  name: string
  slug: string | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  created_at: string
}

// ─── Dashboard Types ────────────────────────────────────────────────────────

export interface DashboardStats {
  totalSpend: number
  estimatedWaste: number
  opportunities: number
}

export interface VendorRow {
  name: string
  monthlyCost: number
  seats: number
  lastActivity: string
  status: 'active' | 'inactive' | 'warning'
}

// ─── Integration Types (used in Phases 2-5) ────────────────────────────────

export type IntegrationProvider = 'okta' | 'google_workspace' | 'slack' | 'azure_ad'

export type ActivityStatus = 'active' | 'inactive' | 'suspended' | 'deprovisioned'

export type SubscriptionPlan = 'free' | 'monitor' | 'recovery'

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer'
```

---

## 11. First Vercel Deploy

### 11.1 — Pre-Deploy Checklist

| Check | Command |
|-------|---------|
| Lint passes | `npm run lint` |
| Types pass | `npx tsc --noEmit` |
| Build succeeds | `npm run build` |
| No secrets in git | `git log --all -p \| grep -i "sk_\|secret\|password" \| head -20` |

### 11.2 — Deploy

```bash
# Push to GitHub
git remote add origin https://github.com/<your-user>/ghostfinder.git
git push -u origin main

# Vercel auto-deploys from GitHub
# Or manually:
vercel --prod
```

### 11.3 — Post-Deploy Verification

1. Open the Vercel preview URL
2. Navigate to `/login` → should render login page
3. Sign up with test email → should redirect to dashboard
4. Dashboard should show 3 KPI cards with mock data
5. Navigate to `/inventory` → should show vendor table
6. Open browser DevTools → Network tab → no failed requests
7. Open browser DevTools → Console → no errors

---

## 12. Acceptance Criteria

Phase 1 is complete when **all** of the following are true:

### Auth
- [ ] Email/password signup creates a new user + auto-creates an organization
- [ ] Email/password login works and redirects to dashboard
- [ ] Google OAuth login works (redirects through Google, returns to `/callback`, lands on dashboard)
- [ ] Logout clears session and redirects to `/login`
- [ ] Unauthenticated users accessing `/inventory` are redirected to `/login`
- [ ] Session persists across page refreshes (middleware refreshes cookie)

### Database & Security
- [ ] `organizations` table has RLS enabled with correct policies
- [ ] `org_members` table has RLS enabled with correct policies
- [ ] User A cannot see User B's organization when querying via Supabase client
- [ ] Auto-create trigger fires: new auth user → new org + owner membership row
- [ ] `SECURITY DEFINER` function has `SET search_path = public`

### UI
- [ ] Dashboard layout renders with sidebar navigation
- [ ] Three KPI cards display mock data (Total Spend, Waste, Opportunities)
- [ ] Vendor inventory table renders with 10 mock vendors
- [ ] Status badges show correct colors (active=default, inactive=red, warning=yellow)
- [ ] Responsive: sidebar collapses on mobile
- [ ] All Shadcn/ui components render without console errors

### DevOps
- [ ] `npm run build` succeeds with zero warnings
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] Vercel preview deploy succeeds
- [ ] GitHub Actions CI pipeline passes on PR

---

## Next Step

→ Proceed to [Phase 2 — Financial Discovery (Plaid Integration)](./PHASE-2-FINANCIAL-DISCOVERY.md)
