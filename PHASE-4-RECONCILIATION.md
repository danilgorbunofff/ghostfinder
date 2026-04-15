# Phase 4 — Reconciliation Engine (The "Brain")

> **Goal:** Build the core business logic that cross-references financial data (Phase 2) with usage data (Phase 3) to identify Ghost Seats, Duplicate Subscriptions, and generate actionable Waste Reports — this is the product's primary value driver.

---

## Table of Contents

1. [Reconciliation Architecture](#1-reconciliation-architecture)
2. [Database Schema — Migration 5](#2-database-schema--migration-5)
3. [Ghost Seat Detector](#3-ghost-seat-detector)
4. [Duplicate Subscription Detector](#4-duplicate-subscription-detector)
5. [Reconciliation Engine (Orchestrator)](#5-reconciliation-engine-orchestrator)
6. [Report Generation Cron Job](#6-report-generation-cron-job)
7. [Reports Page UI](#7-reports-page-ui)
8. [Dashboard: Live Waste Data](#8-dashboard-live-waste-data)
9. [Vercel Cron Configuration](#9-vercel-cron-configuration)
10. [Edge Cases & Business Rules](#10-edge-cases--business-rules)
11. [Acceptance Criteria](#11-acceptance-criteria)

---

## 1. Reconciliation Architecture

### The Core Equation

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│   GHOST SEATS = Paid Seats − Active Users            │
│                                                      │
│   Where:                                             │
│     Paid Seats    = saas_vendors.seats_paid           │
│                     (derived from Plaid spend)        │
│     Active Users  = user_activity WHERE               │
│                     last_login > NOW() - 30 days      │
│                     (derived from Okta/Google)         │
│                                                      │
│   WASTE = Ghost Seats × Per-Seat Monthly Cost        │
│                                                      │
│   DUPLICATES = Multiple vendors in same category     │
│                (e.g., Zoom + Teams + Meet)            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Reconciliation Pipeline

```
                    ┌──────────────────────┐
                    │  generateWasteReport │ (engine.ts)
                    │     Orchestrator     │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                                  ▼
    ┌─────────────────┐               ┌──────────────────┐
    │ detectGhostSeats│               │ detectDuplicates │
    │  ghost-detector │               │ duplicate-detect │
    └────────┬────────┘               └────────┬─────────┘
             │                                  │
    ┌────────┴────────┐               ┌────────┴─────────┐
    │ saas_vendors    │               │ saas_vendors     │
    │ + user_activity │               │ (category match) │
    │ (30-day window) │               │                  │
    └─────────────────┘               └──────────────────┘
             │                                  │
             └────────────┬─────────────────────┘
                          ▼
                 ┌─────────────────┐
                 │  waste_reports  │
                 │  (stored in DB) │
                 └─────────────────┘
```

---

## 2. Database Schema — Migration 5

**File:** `supabase/migrations/00005_waste_reports.sql`

```sql
-- ============================================================================
-- MIGRATION 5: Waste reports table
-- Stores the output of the reconciliation engine.
-- ============================================================================

CREATE TABLE public.waste_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  generated_at        TIMESTAMPTZ DEFAULT now(),

  -- ─── Summary Metrics ──────────────────────────────────────────────
  total_monthly_waste NUMERIC(12, 2) DEFAULT 0,     -- $ wasted per month
  total_annual_waste  NUMERIC(12, 2) DEFAULT 0,     -- Projected yearly waste
  ghost_seat_count    INTEGER DEFAULT 0,             -- Total ghost seats found
  duplicate_count     INTEGER DEFAULT 0,             -- Duplicate subscription groups
  opportunity_count   INTEGER DEFAULT 0,             -- Total actionable items

  -- ─── Detailed Findings ────────────────────────────────────────────
  -- Ghost seats: array of vendor-level findings
  ghost_seats         JSONB DEFAULT '[]',
  -- Structure:
  -- [
  --   {
  --     "vendor": "Slack",
  --     "normalizedName": "slack",
  --     "monthlyCost": 562.50,
  --     "perSeatCost": 12.50,
  --     "totalSeats": 45,
  --     "activeSeats": 38,
  --     "ghostSeats": 7,
  --     "monthlyWaste": 87.50,
  --     "inactiveUsers": [
  --       { "email": "john@company.com", "lastLogin": "2026-02-15T...", "daysSinceLogin": 59 },
  --       ...
  --     ]
  --   },
  --   ...
  -- ]

  -- Duplicate subscriptions: array of category-level findings
  duplicates          JSONB DEFAULT '[]',
  -- Structure:
  -- [
  --   {
  --     "category": "Video Conferencing",
  --     "vendors": ["Zoom", "Microsoft Teams"],
  --     "combinedMonthlyCost": 1140.00,
  --     "recommendation": "Consolidate to one platform. Potential savings: $570/mo.",
  --     "potentialSavings": 570.00
  --   },
  --   ...
  -- ]

  -- Full snapshot for historical tracking
  report_metadata     JSONB DEFAULT '{}',
  -- Structure:
  -- {
  --   "totalSaaSSpend": 12450.00,
  --   "vendorsAnalyzed": 10,
  --   "usersAnalyzed": 380,
  --   "dataSourcesUsed": ["plaid", "okta", "google_workspace"],
  --   "reportVersion": "1.0"
  -- }

  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.waste_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_waste_reports_org_id ON public.waste_reports(org_id);
CREATE INDEX idx_waste_reports_latest ON public.waste_reports(org_id, generated_at DESC);

-- ─── RLS Policies ───────────────────────────────────────────────────

-- Org members can view their reports
CREATE POLICY "reports_select_own" ON public.waste_reports
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

-- Reports are created by service_role (cron job) only
-- No INSERT policy for authenticated — this is by design.
-- The cron handler uses the admin client (service_role) which bypasses RLS.
```

### Why JSONB for Findings?

| Approach | Pros | Cons |
|----------|------|------|
| **Separate tables** (`ghost_seats`, `duplicate_findings`) | Relational, queryable | Many joins, schema migrations for new fields |
| **JSONB columns** (chosen) | Flexible, fast reads, snapshot-friendly | Less queryable, no FK constraints |

We chose JSONB because:
1. Reports are **point-in-time snapshots** — historical data must not change when vendor/user data changes
2. The UI reads the entire report at once — no need for partial queries
3. Schema evolves frequently in early stages — JSONB avoids migrations for every new field
4. Postgres JSONB supports indexing via GIN indexes if we need queries later

---

## 3. Ghost Seat Detector

**File:** `src/lib/reconciliation/ghost-detector.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js'

export interface GhostSeatFinding {
  vendor: string
  normalizedName: string
  monthlyCost: number
  perSeatCost: number
  totalSeats: number
  activeSeats: number
  ghostSeats: number
  monthlyWaste: number
  inactiveUsers: {
    email: string
    displayName: string | null
    lastLogin: string | null
    daysSinceLogin: number
    provider: string
  }[]
}

/**
 * Detect ghost seats across all SaaS vendors for an organization.
 *
 * A "Ghost Seat" is a paid license for a user who has not logged in
 * within the last 30 days. The cost of that seat is pure waste.
 *
 * Algorithm:
 * 1. Fetch all active SaaS vendors (from Plaid transaction data)
 * 2. Fetch all user activity records (from Okta/Google)
 * 3. For each vendor:
 *    a. Count total users who SHOULD have access
 *    b. Count users who HAVE logged in within 30 days
 *    c. Ghost seats = total - active
 *    d. Monthly waste = ghost seats × per-seat cost
 *
 * Note: In Phase 2, we estimate seats_paid from transaction amounts.
 * If we can't determine per-seat cost, we flag the vendor but can't
 * calculate exact waste.
 */
export async function detectGhostSeats(
  adminClient: SupabaseClient,
  orgId: string
): Promise<GhostSeatFinding[]> {
  const findings: GhostSeatFinding[] = []
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // 1. Fetch all active SaaS vendors for this org
  const { data: vendors } = await adminClient
    .from('saas_vendors')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (!vendors || vendors.length === 0) return findings

  // 2. Fetch all user activity records
  const { data: users } = await adminClient
    .from('user_activity')
    .select('*')
    .eq('org_id', orgId)
    .not('status', 'eq', 'deprovisioned')  // Exclude already-removed users

  if (!users || users.length === 0) return findings

  // 3. Build activity lookup
  // For each user email, find the most recent login across all providers
  const userActivityMap = new Map<string, {
    email: string
    displayName: string | null
    lastLogin: Date | null
    provider: string
  }>()

  for (const user of users) {
    const existing = userActivityMap.get(user.email)
    const userLogin = user.last_login ? new Date(user.last_login) : null

    // Keep the most recent login if user exists in multiple providers
    if (!existing || (userLogin && (!existing.lastLogin || userLogin > existing.lastLogin))) {
      userActivityMap.set(user.email, {
        email: user.email,
        displayName: user.display_name,
        lastLogin: userLogin,
        provider: user.provider,
      })
    }
  }

  // 4. For each vendor, match against user activity
  for (const vendor of vendors) {
    const totalSeats = vendor.seats_paid ?? userActivityMap.size
    const perSeatCost = vendor.seats_paid && vendor.monthly_cost
      ? Number(vendor.monthly_cost) / vendor.seats_paid
      : 0

    // Find inactive users (no login in 30+ days)
    const inactiveUsers: GhostSeatFinding['inactiveUsers'] = []

    for (const [, userData] of userActivityMap) {
      const isInactive = !userData.lastLogin || userData.lastLogin < thirtyDaysAgo

      if (isInactive) {
        const daysSinceLogin = userData.lastLogin
          ? Math.floor((now.getTime() - userData.lastLogin.getTime()) / (1000 * 60 * 60 * 24))
          : 999  // Never logged in

        inactiveUsers.push({
          email: userData.email,
          displayName: userData.displayName,
          lastLogin: userData.lastLogin?.toISOString() ?? null,
          daysSinceLogin,
          provider: userData.provider,
        })
      }
    }

    if (inactiveUsers.length === 0) continue  // No ghosts for this vendor

    const ghostSeats = inactiveUsers.length
    const activeSeats = totalSeats - ghostSeats
    const monthlyWaste = ghostSeats * perSeatCost

    findings.push({
      vendor: vendor.name,
      normalizedName: vendor.normalized_name,
      monthlyCost: Number(vendor.monthly_cost ?? 0),
      perSeatCost,
      totalSeats,
      activeSeats: Math.max(0, activeSeats),
      ghostSeats,
      monthlyWaste: Math.round(monthlyWaste * 100) / 100,
      inactiveUsers: inactiveUsers
        .sort((a, b) => b.daysSinceLogin - a.daysSinceLogin),  // Worst offenders first
    })
  }

  // Sort by monthly waste (highest first)
  return findings.sort((a, b) => b.monthlyWaste - a.monthlyWaste)
}
```

### Ghost Detection Logic — Visual

```
For vendor "Slack" ($12.50/seat, 45 seats):

   All Employees (from Okta/Google)
   ┌──────────────────────────────────────────┐
   │ ✅ user1@co.com    Last login: 1 day ago │  Active
   │ ✅ user2@co.com    Last login: 3 days ago│  Active
   │ ✅ user3@co.com    Last login: 10 days   │  Active
   │ ...                                       │
   │ ⚠️ user38@co.com   Last login: 35 days   │  GHOST
   │ ⚠️ user39@co.com   Last login: 42 days   │  GHOST
   │ ❌ user40@co.com   Last login: never      │  GHOST
   │ ...                                       │
   └──────────────────────────────────────────┘

   Active: 38    Ghost: 7    Waste: 7 × $12.50 = $87.50/mo
```

---

## 4. Duplicate Subscription Detector

**File:** `src/lib/reconciliation/duplicate-detector.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js'

export interface DuplicateFinding {
  category: string
  vendors: {
    name: string
    normalizedName: string
    monthlyCost: number
  }[]
  combinedMonthlyCost: number
  potentialSavings: number
  recommendation: string
}

/**
 * Duplicate subscription category groups.
 *
 * If an organization is paying for multiple vendors in the same category,
 * they likely have redundant subscriptions. The recommendation is to
 * consolidate to the most-used platform.
 *
 * NOTE: This is intentionally a curated list. As the product matures,
 * this could be powered by an LLM or a vendor database.
 */
const DUPLICATE_GROUPS: Record<string, {
  label: string
  vendors: string[]  // normalized_name values
}> = {
  video_conferencing: {
    label: 'Video Conferencing',
    vendors: ['zoom', 'microsoft_teams', 'google_meet', 'webex', 'goto_meeting'],
  },
  project_management: {
    label: 'Project Management',
    vendors: ['asana', 'monday', 'jira', 'linear', 'clickup', 'trello', 'basecamp', 'notion'],
  },
  communication: {
    label: 'Team Communication',
    vendors: ['slack', 'microsoft_teams', 'discord', 'google_chat'],
  },
  cloud_storage: {
    label: 'Cloud Storage',
    vendors: ['dropbox', 'google_drive', 'box', 'onedrive', 'icloud'],
  },
  crm: {
    label: 'CRM',
    vendors: ['salesforce', 'hubspot', 'pipedrive', 'zoho_crm', 'close'],
  },
  email_marketing: {
    label: 'Email Marketing',
    vendors: ['mailchimp', 'sendgrid', 'constant_contact', 'campaign_monitor', 'convertkit'],
  },
  design: {
    label: 'Design Tools',
    vendors: ['figma', 'adobe', 'canva', 'sketch', 'invision'],
  },
  customer_support: {
    label: 'Customer Support',
    vendors: ['zendesk', 'intercom', 'freshdesk', 'helpscout', 'drift'],
  },
  password_management: {
    label: 'Password Management',
    vendors: ['1password', 'lastpass', 'dashlane', 'bitwarden', 'keeper'],
  },
  productivity: {
    label: 'Productivity Suite',
    vendors: ['microsoft', 'google_workspace'],
  },
  documentation: {
    label: 'Documentation',
    vendors: ['notion', 'confluence', 'gitbook', 'slite', 'coda'],
  },
  ci_cd: {
    label: 'CI/CD',
    vendors: ['github', 'gitlab', 'bitbucket', 'circleci', 'jenkins'],
  },
}

/**
 * Detect duplicate/overlapping SaaS subscriptions within an organization.
 *
 * Algorithm:
 * 1. Fetch all active SaaS vendors for the org
 * 2. For each duplicate category group:
 *    a. Find which vendors the org is paying for
 *    b. If 2+ vendors in the same group → flag as duplicate
 *    c. Calculate combined cost and potential savings
 *    d. Generate recommendation
 */
export async function detectDuplicates(
  adminClient: SupabaseClient,
  orgId: string
): Promise<DuplicateFinding[]> {
  const findings: DuplicateFinding[] = []

  // 1. Fetch all active SaaS vendors
  const { data: vendors } = await adminClient
    .from('saas_vendors')
    .select('name, normalized_name, monthly_cost')
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (!vendors || vendors.length === 0) return findings

  // 2. Build a set of vendor normalized names for fast lookup
  const orgVendors = new Map(
    vendors.map((v) => [v.normalized_name, v])
  )

  // 3. Check each duplicate group
  for (const [, group] of Object.entries(DUPLICATE_GROUPS)) {
    const matchedVendors = group.vendors
      .filter((v) => orgVendors.has(v))
      .map((v) => {
        const vendor = orgVendors.get(v)!
        return {
          name: vendor.name,
          normalizedName: vendor.normalized_name,
          monthlyCost: Number(vendor.monthly_cost ?? 0),
        }
      })

    // Only flag if 2+ vendors in the same category
    if (matchedVendors.length < 2) continue

    const combinedCost = matchedVendors.reduce((sum, v) => sum + v.monthlyCost, 0)

    // Potential savings = cost of cheapest vendor(s) if consolidated to most expensive
    // (Assumption: keep the most expensive = most feature-rich)
    const sorted = [...matchedVendors].sort((a, b) => b.monthlyCost - a.monthlyCost)
    const potentialSavings = sorted.slice(1).reduce((sum, v) => sum + v.monthlyCost, 0)

    const vendorNames = matchedVendors.map((v) => v.name).join(' and ')

    findings.push({
      category: group.label,
      vendors: matchedVendors,
      combinedMonthlyCost: Math.round(combinedCost * 100) / 100,
      potentialSavings: Math.round(potentialSavings * 100) / 100,
      recommendation:
        `Your organization is paying for ${vendorNames} (${group.label}). ` +
        `Consider consolidating to a single platform to save ~$${potentialSavings.toFixed(0)}/month.`,
    })
  }

  // Sort by potential savings (highest first)
  return findings.sort((a, b) => b.potentialSavings - a.potentialSavings)
}
```

### Duplicate Detection — Visual

```
Organization is paying for:
  ✅ Zoom         → $570/mo (Video Conferencing)
  ✅ Microsoft Teams → $0/mo (bundled with Microsoft 365)
  ✅ Google Meet   → $0/mo (bundled with Google Workspace)

Result:
  ┌──────────────────────────────────────────────┐
  │ ⚠️  DUPLICATE: Video Conferencing             │
  │                                                │
  │   Zoom:             $570/mo                    │
  │   Microsoft Teams:  $0/mo (bundled)            │
  │   Google Meet:      $0/mo (bundled)            │
  │                                                │
  │   Combined: $570/mo                            │
  │   Recommendation: You already have Teams and   │
  │   Meet bundled. Consider dropping Zoom.         │
  │   Potential savings: $570/mo ($6,840/yr)       │
  └──────────────────────────────────────────────┘
```

---

## 5. Reconciliation Engine (Orchestrator)

**File:** `src/lib/reconciliation/engine.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { detectGhostSeats, type GhostSeatFinding } from './ghost-detector'
import { detectDuplicates, type DuplicateFinding } from './duplicate-detector'

export interface WasteReport {
  orgId: string
  generatedAt: string
  totalMonthlyWaste: number
  totalAnnualWaste: number
  ghostSeatCount: number
  duplicateCount: number
  opportunityCount: number
  ghostSeats: GhostSeatFinding[]
  duplicates: DuplicateFinding[]
  metadata: {
    totalSaaSSpend: number
    vendorsAnalyzed: number
    usersAnalyzed: number
    dataSourcesUsed: string[]
    reportVersion: string
  }
}

/**
 * Generate a comprehensive waste report for an organization.
 *
 * This is the core "brain" of Ghost Finder — it orchestrates the
 * ghost seat detector and duplicate detector, aggregates results,
 * and persists the report to the database.
 *
 * @param adminClient - Supabase client with service_role (bypasses RLS)
 * @param orgId - Organization ID to analyze
 * @returns The generated waste report
 */
export async function generateWasteReport(
  adminClient: SupabaseClient,
  orgId: string
): Promise<WasteReport> {
  const generatedAt = new Date().toISOString()

  // ─── 1. Run detectors in parallel ────────────────────────────────
  const [ghostSeats, duplicates] = await Promise.all([
    detectGhostSeats(adminClient, orgId),
    detectDuplicates(adminClient, orgId),
  ])

  // ─── 2. Calculate summary metrics ────────────────────────────────
  const ghostWaste = ghostSeats.reduce((sum, g) => sum + g.monthlyWaste, 0)
  const duplicateWaste = duplicates.reduce((sum, d) => sum + d.potentialSavings, 0)
  const totalMonthlyWaste = ghostWaste + duplicateWaste
  const totalAnnualWaste = totalMonthlyWaste * 12

  const ghostSeatCount = ghostSeats.reduce((sum, g) => sum + g.ghostSeats, 0)
  const duplicateCount = duplicates.length
  const opportunityCount = ghostSeats.filter((g) => g.ghostSeats > 0).length + duplicateCount

  // ─── 3. Gather metadata ──────────────────────────────────────────
  const { data: vendors } = await adminClient
    .from('saas_vendors')
    .select('monthly_cost')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const totalSaaSSpend = vendors?.reduce(
    (sum, v) => sum + Number(v.monthly_cost ?? 0), 0
  ) ?? 0

  const { count: userCount } = await adminClient
    .from('user_activity')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)

  const { data: integrations } = await adminClient
    .from('integration_connections')
    .select('provider')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const dataSourcesUsed = [
    'plaid',  // Always present if we have vendor data
    ...(integrations?.map((i) => i.provider) ?? []),
  ]

  const metadata = {
    totalSaaSSpend: Math.round(totalSaaSSpend * 100) / 100,
    vendorsAnalyzed: vendors?.length ?? 0,
    usersAnalyzed: userCount ?? 0,
    dataSourcesUsed,
    reportVersion: '1.0',
  }

  // ─── 4. Persist report to database ───────────────────────────────
  const report: WasteReport = {
    orgId,
    generatedAt,
    totalMonthlyWaste: Math.round(totalMonthlyWaste * 100) / 100,
    totalAnnualWaste: Math.round(totalAnnualWaste * 100) / 100,
    ghostSeatCount,
    duplicateCount,
    opportunityCount,
    ghostSeats,
    duplicates,
    metadata,
  }

  const { error: insertError } = await adminClient
    .from('waste_reports')
    .insert({
      org_id: orgId,
      generated_at: generatedAt,
      total_monthly_waste: report.totalMonthlyWaste,
      total_annual_waste: report.totalAnnualWaste,
      ghost_seat_count: report.ghostSeatCount,
      duplicate_count: report.duplicateCount,
      opportunity_count: report.opportunityCount,
      ghost_seats: report.ghostSeats,
      duplicates: report.duplicates,
      report_metadata: report.metadata,
    })

  if (insertError) {
    console.error('Failed to persist waste report:', insertError)
    throw new Error(`Failed to save waste report: ${insertError.message}`)
  }

  return report
}
```

### Engine Performance Characteristics

| Operation | Expected Duration | Bottleneck |
|-----------|-------------------|------------|
| Ghost detection | 100ms–500ms | DB query: `saas_vendors` + `user_activity` JOIN |
| Duplicate detection | 10ms–50ms | In-memory set intersection (fast) |
| Metadata aggregation | 50ms–200ms | DB count + aggregation queries |
| Report persistence | 20ms–100ms | Single INSERT with JSONB |
| **Total** | **200ms–900ms** | Mostly DB-bound |

The detectors run **in parallel** (`Promise.all`) since they're independent queries.

---

## 6. Report Generation Cron Job

**File:** `src/app/api/cron/generate-reports/route.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { generateWasteReport } from '@/lib/reconciliation/engine'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300  // 5 minutes

export async function GET(request: Request) {
  // ─── 1. Verify cron secret ─────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const results: {
    orgId: string
    success: boolean
    totalWaste?: number
    ghostSeats?: number
    duplicates?: number
    error?: string
  }[] = []

  try {
    // ─── 2. Find all orgs with at least one active data source ──────
    // An org needs BOTH financial data (Plaid) AND usage data (Okta/Google)
    // to generate a meaningful report.
    const { data: orgsWithPlaid } = await admin
      .from('plaid_connections')
      .select('org_id')
      .eq('status', 'active')

    const { data: orgsWithIntegrations } = await admin
      .from('integration_connections')
      .select('org_id')
      .eq('is_active', true)

    if (!orgsWithPlaid || !orgsWithIntegrations) {
      return NextResponse.json({
        message: 'No qualifying organizations found',
        results: [],
      })
    }

    // Find orgs that have BOTH Plaid AND at least one identity provider
    const plaidOrgIds = new Set(orgsWithPlaid.map((c) => c.org_id))
    const integrationOrgIds = new Set(orgsWithIntegrations.map((c) => c.org_id))
    const qualifiedOrgIds = [...plaidOrgIds].filter((id) => integrationOrgIds.has(id))

    if (qualifiedOrgIds.length === 0) {
      return NextResponse.json({
        message: 'No orgs with both financial and usage data sources',
        results: [],
      })
    }

    // ─── 3. Generate report for each qualifying org ──────────────────
    for (const orgId of qualifiedOrgIds) {
      try {
        const report = await generateWasteReport(admin, orgId)
        results.push({
          orgId,
          success: true,
          totalWaste: report.totalMonthlyWaste,
          ghostSeats: report.ghostSeatCount,
          duplicates: report.duplicateCount,
        })
      } catch (err: any) {
        results.push({
          orgId,
          success: false,
          error: err.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      orgsProcessed: qualifiedOrgIds.length,
      results,
    })
  } catch (error: any) {
    console.error('Report generation cron failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

### Qualification Logic

An org must have **both** data sources to get a report:

```
Has Plaid (spend data)?       ─── YES ──┐
                                         │
Has Okta OR Google (usage)?   ─── YES ──┤── QUALIFIED → Generate report
                                         │
Has neither?                  ─── NO  ──┘── SKIP (can't reconcile)
```

---

## 7. Reports Page UI

**File:** `src/app/(dashboard)/reports/page.tsx`

```typescript
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Copy, Ghost } from 'lucide-react'

export default async function ReportsPage() {
  const supabase = await createClient()

  // Fetch the latest waste report for the user's org
  const { data: report } = await supabase
    .from('waste_reports')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (!report) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Waste Reports</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ghost className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No reports generated yet</p>
            <p className="text-muted-foreground">
              Reports are generated weekly once you connect a bank account
              and an identity provider.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const ghostSeats = (report.ghost_seats as any[]) ?? []
  const duplicates = (report.duplicates as any[]) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Waste Report</h1>
        <p className="text-muted-foreground">
          Generated {new Date(report.generated_at).toLocaleDateString()} ·
          {report.opportunity_count} optimization opportunities found
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Waste</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              ${report.total_monthly_waste?.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Annual Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              ${report.total_annual_waste?.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ghost Seats Found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.ghost_seat_count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Detail View */}
      <Tabs defaultValue="ghost-seats">
        <TabsList>
          <TabsTrigger value="ghost-seats">
            <Ghost className="mr-2 h-4 w-4" />
            Ghost Seats ({ghostSeats.length})
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            <Copy className="mr-2 h-4 w-4" />
            Duplicates ({duplicates.length})
          </TabsTrigger>
        </TabsList>

        {/* Ghost Seats Tab */}
        <TabsContent value="ghost-seats" className="space-y-4">
          {ghostSeats.map((finding: any, index: number) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{finding.vendor}</CardTitle>
                  <Badge variant="destructive">
                    {finding.ghostSeats} ghost seats
                  </Badge>
                </div>
                <CardDescription>
                  {finding.activeSeats} active / {finding.totalSeats} total seats ·
                  Waste: ${finding.monthlyWaste}/mo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Days Inactive</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finding.inactiveUsers?.map((user: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleDateString()
                            : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.daysSinceLogin > 60 ? 'destructive' : 'secondary'}>
                            {user.daysSinceLogin === 999 ? 'Never' : `${user.daysSinceLogin}d`}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{user.provider}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates" className="space-y-4">
          {duplicates.map((finding: any, index: number) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{finding.category}</CardTitle>
                  <Badge variant="secondary">
                    Save ${finding.potentialSavings}/mo
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {finding.vendors?.map((v: any, i: number) => (
                    <div key={i} className="rounded-lg border p-3">
                      <p className="font-medium">{v.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${v.monthlyCost}/mo
                      </p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                    <p className="text-sm">{finding.recommendation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### Reports Page Layout

```
┌────────────────────────────────────────────────────────────┐
│ Waste Report                                                │
│ Generated Apr 14, 2026 · 8 optimization opportunities       │
│                                                              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ Monthly Waste │ │ Annual Proj. │ │ Ghost Seats  │         │
│ │ $3,200/mo    │ │ $38,400/yr   │ │ 42 found     │         │
│ └──────────────┘ └──────────────┘ └──────────────┘         │
│                                                              │
│ [👻 Ghost Seats (5)]  [📋 Duplicates (3)]                  │
│ ┌────────────────────────────────────────────────┐          │
│ │ Slack                         [7 ghost seats]  │          │
│ │ 38 active / 45 total · Waste: $87.50/mo        │          │
│ │ ┌──────────────────────────────────────────┐   │          │
│ │ │ john@co.com    Mar 1, 2026    45d        │   │          │
│ │ │ jane@co.com    Feb 20, 2026   54d        │   │          │
│ │ │ bob@co.com     Never          Never      │   │          │
│ │ └──────────────────────────────────────────┘   │          │
│ └────────────────────────────────────────────────┘          │
│ ┌────────────────────────────────────────────────┐          │
│ │ Adobe Creative Cloud        [5 ghost seats]    │          │
│ │ 7 active / 12 total · Waste: $274.95/mo        │          │
│ │ ...                                             │          │
│ └────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────┘
```

---

## 8. Dashboard: Live Waste Data

Update the dashboard to pull from the latest waste report:

**Updates to `src/app/(dashboard)/page.tsx`:**

```typescript
// Fetch latest waste report for real KPI data
const { data: latestReport } = await supabase
  .from('waste_reports')
  .select('total_monthly_waste, opportunity_count')
  .order('generated_at', { ascending: false })
  .limit(1)
  .single()

const estimatedWaste = Number(latestReport?.total_monthly_waste ?? 0)
const opportunities = latestReport?.opportunity_count ?? 0
```

Now all three KPI cards show real data:
- **Total SaaS Spend** — from `saas_vendors` (Phase 2)
- **Estimated Waste** — from `waste_reports` (Phase 4)
- **Optimization Opportunities** — from `waste_reports` (Phase 4)

---

## 9. Vercel Cron Configuration

Ensure `vercel.json` includes the report generation cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-transactions",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/sync-usage",
      "schedule": "0 */12 * * *"
    },
    {
      "path": "/api/cron/generate-reports",
      "schedule": "0 8 * * 1"
    }
  ]
}
```

| Cron | Schedule | Rationale |
|------|----------|-----------|
| `sync-transactions` | Every 6h | Keep spend data fresh |
| `sync-usage` | Every 12h | Keep login timestamps current |
| `generate-reports` | Monday 8am UTC | Weekly cadence, ready for Monday morning review |

**Ordering matters:** Transactions sync first (6h cadence), then usage (12h), then reports (weekly). This ensures reports use the freshest data.

---

## 10. Edge Cases & Business Rules

### 10.1 — Business Rules

| Rule | Implementation |
|------|---------------|
| **30-day inactivity threshold** | Configurable constant. Default: 30 days. |
| **Deprovisioned users excluded** | `WHERE status != 'deprovisioned'` — don't flag fired employees as ghosts |
| **Per-seat cost estimation** | `monthly_cost / seats_paid`. If unknown, flag vendor but set `monthlyWaste: 0` |
| **Multi-provider logins** | Use the **most recent** login across providers (Okta + Google) |
| **Duplicate detection is curated** | Only flags known category groups, not arbitrary overlaps |
| **Reports are snapshots** | JSONB data is frozen at generation time — doesn't change retroactively |

### 10.2 — Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Vendor has 0 seats_paid | Use total user count from `user_activity` as estimate |
| User exists in multiple providers | Take the most recent `last_login` across all providers |
| Vendor not in known SaaS list | Still analyzed (normalized name), but may not match usage data |
| Org has Plaid but no identity provider | No report generated (both data sources required) |
| No transactions in 60+ days | Mark vendor `is_active: false` — may be cancelled |
| User has `last_login: null` | Treat as "never logged in" — worse than 30 days inactive |
| Report already generated today | Insert creates a new row (history preserved). UI shows latest. |

### 10.3 — Future Enhancements (Not in Phase 4)

- **Per-vendor usage matching** — Match specific users to specific vendor licenses (requires vendor API integration)
- **ML-based vendor categorization** — Replace curated duplicate groups with LLM classification
- **Cost optimization recommendations** — Suggest downgrade paths (e.g., "Switch from Pro to Business plan")
- **Trend analysis** — Compare week-over-week waste changes
- **Export to CSV** — Download ghost seat lists for IT teams

---

## 11. Acceptance Criteria

Phase 4 is complete when **all** of the following are true:

### Ghost Seat Detection
- [ ] Identifies users with no login in 30+ days per vendor
- [ ] Correctly excludes deprovisioned users
- [ ] Calculates per-seat cost and total monthly waste
- [ ] Handles users present in multiple identity providers (takes latest login)
- [ ] Handles vendors with unknown seat counts (flags but doesn't calculate waste)
- [ ] Results sorted by monthly waste (highest first)

### Duplicate Detection
- [ ] Identifies when an org pays for multiple vendors in the same category
- [ ] Correctly matches vendors to categories (Zoom + Teams = Video Conferencing)
- [ ] Calculates combined cost and potential savings
- [ ] Generates human-readable recommendations
- [ ] Does NOT flag false positives (single vendor per category = no finding)

### Reconciliation Engine
- [ ] Runs both detectors in parallel (`Promise.all`)
- [ ] Aggregates totals correctly (ghost waste + duplicate waste)
- [ ] Persists report to `waste_reports` table with JSONB snapshots
- [ ] Report metadata includes vendor count, user count, data sources

### Cron Job
- [ ] Generates reports only for orgs with BOTH Plaid AND identity provider
- [ ] Skips orgs with insufficient data (no false reports)
- [ ] Logs per-org results (success/failure + metrics)
- [ ] Secured by `CRON_SECRET` header check

### Reports Page UI
- [ ] Shows latest report with summary cards (monthly waste, annual, ghost count)
- [ ] Ghost Seats tab: vendor-level cards with inactive user tables
- [ ] Duplicates tab: category cards with vendor comparison + recommendations
- [ ] Empty state: friendly message when no reports exist
- [ ] Badge colors: red for high-priority, yellow for medium

### Dashboard Integration
- [ ] "Estimated Waste" card shows real data from `waste_reports`
- [ ] "Opportunities" card shows actionable item count
- [ ] Both update automatically when new reports are generated

### Security
- [ ] `waste_reports` has RLS enabled — org members can only see their own reports
- [ ] Report generation runs with service_role (bypasses RLS for cross-table queries)
- [ ] No PII leaked in report metadata (only emails, which are org-internal)

---

## Next Step

→ Proceed to [Phase 5 — Monetization & Automated Savings](./PHASE-5-MONETIZATION.md)
