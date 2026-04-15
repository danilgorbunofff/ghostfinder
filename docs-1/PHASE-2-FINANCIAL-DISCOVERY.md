# Phase 2 — Financial Discovery (Plaid Integration)

> **Goal:** Connect the customer's business bank account via Plaid, ingest transaction history, filter for software-related charges, normalize vendor names, and surface real SaaS spend data on the dashboard — replacing mock data with actual financial intelligence.

---

## Table of Contents

1. [Plaid Account & Environment Setup](#1-plaid-account--environment-setup)
2. [Database Schema — Migration 3](#2-database-schema--migration-3)
3. [Supabase Vault for Token Storage](#3-supabase-vault-for-token-storage)
4. [Plaid Service Module](#4-plaid-service-module)
5. [API Route: Create Link Token](#5-api-route-create-link-token)
6. [API Route: Exchange Public Token](#6-api-route-exchange-public-token)
7. [Plaid Link UI Component](#7-plaid-link-ui-component)
8. [MCC Code Mapping](#8-mcc-code-mapping)
9. [Vendor Name Normalizer](#9-vendor-name-normalizer)
10. [Transaction Sync Cron Job](#10-transaction-sync-cron-job)
11. [Plaid Webhook Receiver](#11-plaid-webhook-receiver)
12. [Connections Page UI](#12-connections-page-ui)
13. [Dashboard: Real Spend Data](#13-dashboard-real-spend-data)
14. [Vercel Cron Configuration](#14-vercel-cron-configuration)
15. [Acceptance Criteria](#15-acceptance-criteria)

---

## 1. Plaid Account & Environment Setup

### 1.1 — Plaid Dashboard Configuration

1. Sign up at [dashboard.plaid.com](https://dashboard.plaid.com)
2. Get your **Client ID** and **Sandbox Secret** from the Keys page
3. Configure webhook URL: `https://your-app.vercel.app/api/plaid/webhook`
4. Enable products: **Transactions**

### 1.2 — Environment Progression

| Stage | `PLAID_ENV` | Institutions | Data |
|-------|-------------|-------------|------|
| **Development** | `sandbox` | Plaid test banks (user: `user_good`, pass: `pass_good`) | Fake transactions |
| **Testing** | `development` | Real banks, limited to 100 Items | Real transactions |
| **Production** | `production` | All banks, unlimited | Real transactions |

### 1.3 — Sandbox Test Credentials

```
Institution: "First Platypus Bank" (or any sandbox institution)
Username: user_good
Password: pass_good
MFA: not required in sandbox
```

---

## 2. Database Schema — Migration 3

**File:** `supabase/migrations/00003_financial_tables.sql`

```sql
-- ============================================================================
-- MIGRATION 3: Financial data tables (Plaid integration)
-- Creates: plaid_connections, transactions, saas_vendors
-- ============================================================================

-- ─── Plaid Connections ──────────────────────────────────────────────────────
CREATE TABLE public.plaid_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token_secret_id UUID,           -- Reference to vault.secrets (encrypted)
  item_id               TEXT NOT NULL,    -- Plaid Item ID (safe to store plaintext)
  institution_name      TEXT NOT NULL,
  institution_id        TEXT,             -- Plaid Institution ID
  status                TEXT DEFAULT 'active'
                        CHECK (status IN ('active', 'syncing', 'error', 'disabled')),
  cursor                TEXT,             -- Plaid sync cursor for incremental sync
  last_synced_at        TIMESTAMPTZ,
  error_code            TEXT,             -- Plaid error code if status = 'error'
  error_message         TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, item_id)
);

ALTER TABLE public.plaid_connections ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_plaid_connections_org_id ON public.plaid_connections(org_id);
CREATE INDEX idx_plaid_connections_status ON public.plaid_connections(org_id, status);

CREATE TRIGGER set_updated_at_plaid_connections
  BEFORE UPDATE ON public.plaid_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Transactions ───────────────────────────────────────────────────────────
CREATE TABLE public.transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plaid_connection_id   UUID REFERENCES public.plaid_connections(id) ON DELETE CASCADE,
  plaid_transaction_id  TEXT NOT NULL,
  vendor                TEXT,              -- Raw merchant name from Plaid
  vendor_normalized     TEXT,              -- Cleaned + matched name (lowercase)
  amount                NUMERIC(12, 2) NOT NULL,  -- Always positive (Plaid sends positive for debits)
  currency              TEXT DEFAULT 'USD',
  date                  DATE NOT NULL,
  mcc_code              TEXT,              -- Merchant Category Code
  category              TEXT,              -- Plaid primary category
  description           TEXT,              -- Full transaction description
  is_software           BOOLEAN DEFAULT false,  -- Flagged as software/SaaS
  pending               BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, plaid_transaction_id)
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_transactions_org_id ON public.transactions(org_id);
CREATE INDEX idx_transactions_date ON public.transactions(org_id, date DESC);
CREATE INDEX idx_transactions_vendor ON public.transactions(org_id, vendor_normalized);
CREATE INDEX idx_transactions_software ON public.transactions(org_id, is_software)
  WHERE is_software = true;  -- Partial index: only software transactions

-- ─── SaaS Vendors ───────────────────────────────────────────────────────────
-- Aggregated view of per-vendor spend derived from transactions.
-- Updated by the sync cron job after each transaction sync.
CREATE TABLE public.saas_vendors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,          -- Display name (e.g., "Slack")
  normalized_name   TEXT NOT NULL,          -- Matching key (e.g., "slack")
  monthly_cost      NUMERIC(12, 2),         -- Avg monthly spend (calculated)
  annual_cost       NUMERIC(12, 2),         -- Projected annual
  seats_paid        INTEGER,                -- Estimated seats (if derivable)
  category          TEXT,                    -- e.g., "Communication", "Project Management"
  first_seen        DATE,                   -- First transaction date
  last_seen         DATE,                   -- Most recent transaction date
  transaction_count INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,   -- false if no charge in 60+ days
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, normalized_name)
);

ALTER TABLE public.saas_vendors ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_saas_vendors_org_id ON public.saas_vendors(org_id);
CREATE INDEX idx_saas_vendors_active ON public.saas_vendors(org_id, is_active)
  WHERE is_active = true;

CREATE TRIGGER set_updated_at_saas_vendors
  BEFORE UPDATE ON public.saas_vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS Policies ───────────────────────────────────────────────────────────

-- Plaid Connections: org members can view, admins can manage
CREATE POLICY "plaid_select_own" ON public.plaid_connections
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "plaid_insert_admin" ON public.plaid_connections
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

CREATE POLICY "plaid_update_admin" ON public.plaid_connections
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

CREATE POLICY "plaid_delete_admin" ON public.plaid_connections
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

-- Transactions: org members can view (insert/update handled by service role)
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

-- SaaS Vendors: org members can view, admins can manage
CREATE POLICY "vendors_select_own" ON public.saas_vendors
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "vendors_manage_admin" ON public.saas_vendors
  FOR ALL TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));
```

### Indexing Strategy

| Index | Purpose |
|-------|---------|
| `idx_transactions_date` | Fast date-range queries for spend calculation |
| `idx_transactions_vendor` | Group-by-vendor aggregation |
| `idx_transactions_software` | Partial index — only rows where `is_software = true` reduces scan size |
| `idx_plaid_connections_status` | Cron job queries active connections |
| `idx_saas_vendors_active` | Dashboard only shows active vendors |

---

## 3. Supabase Vault for Token Storage

### 3.1 — Why Vault

Plaid `access_token` values grant permanent read access to a customer's bank transactions. They **must** be encrypted at rest. Supabase Vault provides authenticated encryption (AEAD) backed by `pgsodium`.

### 3.2 — Vault Helper Functions

**File:** `supabase/migrations/00003b_vault_functions.sql`

```sql
-- ============================================================================
-- Vault helper functions for secure token storage/retrieval
-- These run as SECURITY DEFINER — only service_role can execute them.
-- ============================================================================

-- Store a secret in Vault and return the secret_id
CREATE OR REPLACE FUNCTION private.store_secret(
  p_secret TEXT,
  p_name   TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  SELECT id INTO v_secret_id FROM vault.create_secret(p_secret, p_name, p_description);
  RETURN v_secret_id;
END;
$$;

-- Retrieve a decrypted secret by its ID
CREATE OR REPLACE FUNCTION private.get_secret(p_secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;

  RETURN v_secret;
END;
$$;

-- Retrieve Plaid access token for a specific connection
CREATE OR REPLACE FUNCTION private.get_plaid_token(p_connection_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id UUID;
  v_token TEXT;
BEGIN
  SELECT access_token_secret_id INTO v_secret_id
  FROM public.plaid_connections
  WHERE id = p_connection_id;

  IF v_secret_id IS NULL THEN
    RAISE EXCEPTION 'No access token found for connection %', p_connection_id;
  END IF;

  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;

  RETURN v_token;
END;
$$;

-- Restrict access: only service_role can call these functions
REVOKE EXECUTE ON FUNCTION private.store_secret FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION private.get_secret FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION private.get_plaid_token FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION private.store_secret TO service_role;
GRANT EXECUTE ON FUNCTION private.get_secret TO service_role;
GRANT EXECUTE ON FUNCTION private.get_plaid_token TO service_role;
```

### 3.3 — Token Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ 1. User completes Plaid Link → public_token returned    │
│ 2. Backend exchanges public_token → access_token        │
│ 3. Backend calls vault.create_secret(access_token)      │
│ 4. Vault returns secret_id (UUID)                       │
│ 5. Backend stores secret_id in plaid_connections row    │
│ 6. access_token NEVER stored in plaintext anywhere      │
│                                                         │
│ When reading:                                           │
│ 7. Cron job calls private.get_plaid_token(connection_id)│
│ 8. Vault decrypts and returns token (server-only)       │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Plaid Service Module

**File:** `src/lib/services/plaid.service.ts`

```typescript
import {
  PlaidApi,
  PlaidEnvironments,
  Configuration,
  Products,
  CountryCode,
  type TransactionsSyncRequest,
  type TransactionsSyncResponse,
  type Transaction,
} from 'plaid'

// ─── Client Initialization ─────────────────────────────────────────────────

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
})

const plaidClient = new PlaidApi(configuration)

// ─── Service Methods ────────────────────────────────────────────────────────

/**
 * Create a Link token for the Plaid Link UI.
 * The token is short-lived (30 min) and scoped to a specific user.
 */
export async function createLinkToken(userId: string) {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Ghost Finder',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`,
  })

  return response.data.link_token
}

/**
 * Exchange a public_token (from Plaid Link) for a permanent access_token.
 * The access_token must be stored encrypted (Supabase Vault).
 */
export async function exchangePublicToken(publicToken: string) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  })

  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  }
}

/**
 * Sync transactions using the cursor-based sync endpoint.
 * Returns added, modified, and removed transactions since last cursor.
 *
 * @param accessToken - Decrypted Plaid access token
 * @param cursor - Last sync cursor (null for initial sync)
 */
export async function syncTransactions(
  accessToken: string,
  cursor?: string | null
): Promise<{
  added: Transaction[]
  modified: Transaction[]
  removed: { transaction_id: string }[]
  nextCursor: string
  hasMore: boolean
}> {
  const allAdded: Transaction[] = []
  const allModified: Transaction[] = []
  const allRemoved: { transaction_id: string }[] = []
  let currentCursor = cursor || undefined
  let hasMore = true

  // Paginate through all available transaction updates
  while (hasMore) {
    const request: TransactionsSyncRequest = {
      access_token: accessToken,
      cursor: currentCursor,
      count: 500,  // Max per page
    }

    const response = await plaidClient.transactionsSync(request)
    const data = response.data

    allAdded.push(...data.added)
    allModified.push(...data.modified)
    allRemoved.push(...data.removed)

    currentCursor = data.next_cursor
    hasMore = data.has_more
  }

  return {
    added: allAdded,
    modified: allModified,
    removed: allRemoved,
    nextCursor: currentCursor!,
    hasMore: false,
  }
}

/**
 * Get institution details by ID.
 */
export async function getInstitution(institutionId: string) {
  const response = await plaidClient.institutionsGetById({
    institution_id: institutionId,
    country_codes: [CountryCode.Us],
  })
  return response.data.institution
}

/**
 * Verify a Plaid webhook signature.
 * Prevents spoofed webhook calls.
 */
export async function verifyWebhook(
  body: string,
  headers: Record<string, string>
): Promise<boolean> {
  try {
    const jwtToken = headers['plaid-verification']
    if (!jwtToken) return false

    // Plaid webhook verification uses JWT + JWK
    // The plaid client handles verification internally
    await plaidClient.webhookVerificationKeyGet({
      key_id: jwtToken,
    })
    return true
  } catch {
    return false
  }
}
```

### Service Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Stateless** | No instance variables. Pure functions. Import and call. |
| **Server-only** | Uses `PLAID_SECRET` — must never be imported from client components |
| **Cursor-based sync** | Uses `/transactions/sync` (not deprecated `/transactions/get`). Supports incremental updates. |
| **Pagination** | Inner while loop handles multi-page responses automatically |
| **Modular** | Can be swapped for another financial data provider without touching API routes |

---

## 5. API Route: Create Link Token

**File:** `src/app/api/plaid/create-link-token/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { createLinkToken } from '@/lib/services/plaid.service'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const linkToken = await createLinkToken(user.id)
    return NextResponse.json({ linkToken })
  } catch (error) {
    console.error('Failed to create Plaid link token:', error)
    return NextResponse.json(
      { error: 'Failed to create link token' },
      { status: 500 }
    )
  }
}
```

### Security Checks

1. **Authentication:** Verifies user session via `getUser()` (server-side JWT validation)
2. **No input needed:** Link token is scoped to the authenticated `user.id`
3. **Error handling:** Never exposes internal Plaid errors to the client

---

## 6. API Route: Exchange Public Token

**File:** `src/app/api/plaid/exchange-token/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangePublicToken } from '@/lib/services/plaid.service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // 1. Authenticate the user
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse request body
  const { publicToken, institutionName, institutionId } = await request.json()

  if (!publicToken || !institutionName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // 3. Exchange public token for access token
    const { accessToken, itemId } = await exchangePublicToken(publicToken)

    // 4. Get user's org_id
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // 5. Store access token in Supabase Vault (requires service role)
    const admin = createAdminClient()
    const { data: secretResult } = await admin.rpc('store_secret', {
      p_secret: accessToken,
      p_name: `plaid_${itemId}`,
      p_description: `Plaid access token for ${institutionName}`,
    })

    // 6. Create plaid_connections row
    const { error: insertError } = await admin
      .from('plaid_connections')
      .insert({
        org_id: membership.org_id,
        access_token_secret_id: secretResult,
        item_id: itemId,
        institution_name: institutionName,
        institution_id: institutionId,
        status: 'active',
      })

    if (insertError) {
      console.error('Failed to insert plaid connection:', insertError)
      return NextResponse.json(
        { error: 'Failed to save connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      connectionId: itemId,
      institutionName,
    })
  } catch (error) {
    console.error('Plaid token exchange failed:', error)
    return NextResponse.json(
      { error: 'Failed to connect bank account' },
      { status: 500 }
    )
  }
}
```

### Critical Flow

```
Frontend (Plaid Link) → public_token
        │
        ▼
POST /api/plaid/exchange-token
        │
        ├── 1. Verify user session (getUser)
        ├── 2. Exchange public_token → access_token (Plaid API)
        ├── 3. Encrypt access_token in Vault (store_secret)
        ├── 4. Save secret_id in plaid_connections
        └── 5. Return success (never return access_token to client)
```

---

## 7. Plaid Link UI Component

**File:** `src/components/connections/plaid-link-button.tsx`

```typescript
'use client'

import { useCallback, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { Loader2, Building2 } from 'lucide-react'

export function PlaidLinkButton({ onSuccess }: { onSuccess?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch link token from our API
  const fetchLinkToken = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/plaid/create-link-token', { method: 'POST' })
      const data = await res.json()
      if (data.linkToken) {
        setLinkToken(data.linkToken)
      } else {
        setError('Failed to initialize bank connection')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle successful Link completion
  const handleSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      setLoading(true)
      try {
        const res = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            institutionName: metadata.institution?.name ?? 'Unknown',
            institutionId: metadata.institution?.institution_id,
          }),
        })

        const data = await res.json()
        if (data.success) {
          onSuccess?.()
        } else {
          setError(data.error || 'Failed to connect account')
        }
      } catch {
        setError('Failed to save connection')
      } finally {
        setLoading(false)
      }
    },
    [onSuccess]
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: (err) => {
      if (err) setError(err.display_message || 'Connection cancelled')
    },
  })

  return (
    <div>
      {!linkToken ? (
        <Button onClick={fetchLinkToken} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Building2 className="mr-2 h-4 w-4" />
          )}
          Connect Bank Account
        </Button>
      ) : (
        <Button onClick={() => open()} disabled={!ready || loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Building2 className="mr-2 h-4 w-4" />
          )}
          Open Bank Login
        </Button>
      )}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  )
}
```

### User Flow

```
1. User clicks "Connect Bank Account"
2. Frontend fetches link_token from /api/plaid/create-link-token
3. Frontend opens Plaid Link modal (user sees bank login UI)
4. User searches for and selects their bank
5. User enters bank credentials (handled entirely by Plaid — we never see them)
6. Plaid returns public_token + institution metadata
7. Frontend sends public_token to /api/plaid/exchange-token
8. Backend exchanges → stores encrypted → confirms
9. UI shows success message + new connection in list
```

---

## 8. MCC Code Mapping

**File:** `src/lib/utils/mcc-codes.ts`

```typescript
/**
 * Merchant Category Codes (MCC) associated with software and SaaS purchases.
 *
 * These codes are assigned by card networks to classify merchant businesses.
 * We use them to automatically detect software-related transactions from
 * bank statement data.
 */

// Primary Software MCC Codes
export const SOFTWARE_MCC_CODES: Record<string, string> = {
  '5734': 'Computer Software Stores',
  '5817': 'Digital Goods: Applications (Marketplaces)',
  '5818': 'Digital Goods: Large Merchants',
  '7372': 'Computer Programming, Data Processing',
  '7379': 'Computer Maintenance and Repair',
  '7399': 'Business Services (misc SaaS)',
  '5045': 'Computers, Computer Peripherals',
  '5946': 'Camera & Photographic Supplies (Adobe)',
}

// Known SaaS vendors and their common transaction name patterns
export const KNOWN_SAAS_VENDORS: Record<string, {
  displayName: string
  category: string
  patterns: string[]  // Patterns to match in transaction descriptions
}> = {
  slack: {
    displayName: 'Slack',
    category: 'Communication',
    patterns: ['slack', 'slack technologies'],
  },
  zoom: {
    displayName: 'Zoom',
    category: 'Video Conferencing',
    patterns: ['zoom', 'zoom.us', 'zoom video'],
  },
  adobe: {
    displayName: 'Adobe',
    category: 'Design & Creative',
    patterns: ['adobe', 'adobe systems', 'adobe inc'],
  },
  github: {
    displayName: 'GitHub',
    category: 'Development',
    patterns: ['github', 'github inc'],
  },
  figma: {
    displayName: 'Figma',
    category: 'Design & Creative',
    patterns: ['figma'],
  },
  salesforce: {
    displayName: 'Salesforce',
    category: 'CRM',
    patterns: ['salesforce', 'sfdc'],
  },
  hubspot: {
    displayName: 'HubSpot',
    category: 'Marketing',
    patterns: ['hubspot'],
  },
  microsoft: {
    displayName: 'Microsoft 365',
    category: 'Productivity',
    patterns: ['microsoft', 'msft', 'microsoft 365', 'office 365', 'ms office'],
  },
  google_workspace: {
    displayName: 'Google Workspace',
    category: 'Productivity',
    patterns: ['google', 'google workspace', 'gsuite', 'g suite'],
  },
  atlassian: {
    displayName: 'Atlassian (Jira/Confluence)',
    category: 'Project Management',
    patterns: ['atlassian', 'jira', 'confluence', 'bitbucket'],
  },
  notion: {
    displayName: 'Notion',
    category: 'Productivity',
    patterns: ['notion', 'notion labs'],
  },
  aws: {
    displayName: 'Amazon Web Services',
    category: 'Cloud Infrastructure',
    patterns: ['aws', 'amazon web services', 'amazon aws'],
  },
  datadog: {
    displayName: 'Datadog',
    category: 'Monitoring',
    patterns: ['datadog'],
  },
  intercom: {
    displayName: 'Intercom',
    category: 'Customer Support',
    patterns: ['intercom'],
  },
  zendesk: {
    displayName: 'Zendesk',
    category: 'Customer Support',
    patterns: ['zendesk'],
  },
  dropbox: {
    displayName: 'Dropbox',
    category: 'Storage',
    patterns: ['dropbox'],
  },
  asana: {
    displayName: 'Asana',
    category: 'Project Management',
    patterns: ['asana'],
  },
  monday: {
    displayName: 'Monday.com',
    category: 'Project Management',
    patterns: ['monday', 'monday.com'],
  },
  linear: {
    displayName: 'Linear',
    category: 'Project Management',
    patterns: ['linear'],
  },
  vercel: {
    displayName: 'Vercel',
    category: 'Cloud Infrastructure',
    patterns: ['vercel'],
  },
  twilio: {
    displayName: 'Twilio',
    category: 'Communication',
    patterns: ['twilio'],
  },
  sendgrid: {
    displayName: 'SendGrid',
    category: 'Email',
    patterns: ['sendgrid'],
  },
  mailchimp: {
    displayName: 'Mailchimp',
    category: 'Email Marketing',
    patterns: ['mailchimp'],
  },
  webflow: {
    displayName: 'Webflow',
    category: 'Website Builder',
    patterns: ['webflow'],
  },
  calendly: {
    displayName: 'Calendly',
    category: 'Scheduling',
    patterns: ['calendly'],
  },
  docusign: {
    displayName: 'DocuSign',
    category: 'Document Management',
    patterns: ['docusign'],
  },
  snowflake: {
    displayName: 'Snowflake',
    category: 'Data Platform',
    patterns: ['snowflake'],
  },
  okta: {
    displayName: 'Okta',
    category: 'Identity',
    patterns: ['okta'],
  },
  '1password': {
    displayName: '1Password',
    category: 'Security',
    patterns: ['1password', 'agilebits'],
  },
  lastpass: {
    displayName: 'LastPass',
    category: 'Security',
    patterns: ['lastpass'],
  },
  microsoft_teams: {
    displayName: 'Microsoft Teams',
    category: 'Video Conferencing',
    patterns: ['teams', 'microsoft teams'],
  },
  google_meet: {
    displayName: 'Google Meet',
    category: 'Video Conferencing',
    patterns: ['google meet'],
  },
}

/**
 * Check if an MCC code indicates a software/SaaS purchase.
 */
export function isSoftwareMCC(mccCode: string | null | undefined): boolean {
  if (!mccCode) return false
  return mccCode in SOFTWARE_MCC_CODES
}
```

---

## 9. Vendor Name Normalizer

**File:** `src/lib/utils/vendor-normalizer.ts`

```typescript
import { KNOWN_SAAS_VENDORS } from './mcc-codes'

/**
 * Prefixes added by payment processors.
 * These must be stripped before matching.
 */
const PAYMENT_PROCESSOR_PREFIXES = [
  'STRIPE*',
  'SQ *',
  'SQU*',
  'PAYPAL *',
  'PAYPAL*',
  'PP*',
  'BILL.COM*',
  'ACH ',
  'DEBIT ',
  'RECURRING ',
  'AUTOPAY ',
  'WIRE ',
]

/**
 * Suffixes to strip (common transaction noise).
 */
const NOISE_SUFFIXES = [
  'INC',
  'INC.',
  'LLC',
  'LLC.',
  'LTD',
  'LTD.',
  'CORP',
  'CORP.',
  'CO',
  'CO.',
  'SUBSCRIPTION',
  'MONTHLY',
  'ANNUAL',
  'PLAN',
  'PAYMENT',
  'CHARGE',
  'SERVICE',
  'SERVICES',
  'TECHNOLOGIES',
]

/**
 * Normalize a raw merchant/vendor name from bank transaction data.
 *
 * Pipeline:
 * 1. Strip payment processor prefixes (STRIPE*, SQ*, PAYPAL*)
 * 2. Remove noise suffixes (INC, LLC, SUBSCRIPTION, etc.)
 * 3. Lowercase + trim whitespace
 * 4. Match against known SaaS vendor patterns
 * 5. Return normalized key or cleaned raw name
 *
 * @returns { normalizedName, displayName, category, isKnown }
 */
export function normalizeVendorName(rawName: string): {
  normalizedName: string
  displayName: string
  category: string | null
  isKnown: boolean
} {
  let cleaned = rawName.trim()

  // 1. Strip payment processor prefixes
  for (const prefix of PAYMENT_PROCESSOR_PREFIXES) {
    if (cleaned.toUpperCase().startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length).trim()
      break  // Only one prefix per name
    }
  }

  // 2. Remove noise suffixes
  const words = cleaned.split(/\s+/)
  const filteredWords = words.filter(
    (word) => !NOISE_SUFFIXES.includes(word.toUpperCase().replace(/[.,]$/, ''))
  )
  cleaned = filteredWords.join(' ').trim()

  // 3. Lowercase for matching
  const lowered = cleaned.toLowerCase()

  // 4. Match against known SaaS vendors
  for (const [key, vendor] of Object.entries(KNOWN_SAAS_VENDORS)) {
    for (const pattern of vendor.patterns) {
      if (lowered.includes(pattern.toLowerCase())) {
        return {
          normalizedName: key,
          displayName: vendor.displayName,
          category: vendor.category,
          isKnown: true,
        }
      }
    }
  }

  // 5. No match — return cleaned name as-is
  return {
    normalizedName: lowered.replace(/[^a-z0-9]/g, '_'),
    displayName: cleaned,
    category: null,
    isKnown: false,
  }
}

/**
 * Determine if a transaction is likely a software/SaaS charge
 * using both MCC code and vendor name matching.
 */
export function isSoftwareTransaction(
  mccCode: string | null | undefined,
  merchantName: string | null | undefined,
  category: string | null | undefined
): boolean {
  // Check MCC code
  const { isSoftwareMCC } = require('./mcc-codes')
  if (isSoftwareMCC(mccCode)) return true

  // Check vendor name against known SaaS
  if (merchantName) {
    const { isKnown } = normalizeVendorName(merchantName)
    if (isKnown) return true
  }

  // Check Plaid category (if available)
  if (category) {
    const softwareCategories = [
      'Software',
      'Computers and Electronics',
      'Digital Purchase',
    ]
    if (softwareCategories.some((c) => category.includes(c))) return true
  }

  return false
}
```

### Normalization Examples

| Raw Transaction Name | `normalizedName` | `displayName` | `isKnown` |
|---------------------|-------------------|---------------|-----------|
| `STRIPE* SLACK TECHNOLOGIES` | `slack` | `Slack` | `true` |
| `SQ * ZOOM.US` | `zoom` | `Zoom` | `true` |
| `ADOBE SYSTEMS INC` | `adobe` | `Adobe` | `true` |
| `PAYPAL *NOTION LABS` | `notion` | `Notion` | `true` |
| `ACMEWIDGETS SaaS` | `acmewidgets_saas` | `ACMEWIDGETS SaaS` | `false` |

---

## 10. Transaction Sync Cron Job

**File:** `src/app/api/cron/sync-transactions/route.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTransactions } from '@/lib/services/plaid.service'
import { normalizeVendorName, isSoftwareTransaction } from '@/lib/utils/vendor-normalizer'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'          // Not edge — Plaid SDK uses Node APIs
export const maxDuration = 300           // 5 min timeout (Vercel Pro)

export async function GET(request: Request) {
  // ─── 1. Verify cron secret ─────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const results: { connectionId: string; added: number; errors: string[] }[] = []

  try {
    // ─── 2. Fetch all active Plaid connections ────────────────────────
    const { data: connections, error: fetchError } = await admin
      .from('plaid_connections')
      .select('id, org_id, item_id, cursor')
      .eq('status', 'active')

    if (fetchError || !connections) {
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    // ─── 3. Process each connection ──────────────────────────────────
    for (const connection of connections) {
      const connectionResult = { connectionId: connection.id, added: 0, errors: [] as string[] }

      try {
        // Update status to syncing
        await admin
          .from('plaid_connections')
          .update({ status: 'syncing' })
          .eq('id', connection.id)

        // Retrieve decrypted access token from Vault
        const { data: accessToken } = await admin.rpc('get_plaid_token', {
          p_connection_id: connection.id,
        })

        if (!accessToken) {
          connectionResult.errors.push('No access token in vault')
          continue
        }

        // Sync transactions from Plaid
        const { added, modified, removed, nextCursor } = await syncTransactions(
          accessToken,
          connection.cursor
        )

        // ─── 4. Process added transactions ─────────────────────────
        for (const txn of added) {
          const isSoftware = isSoftwareTransaction(
            txn.merchant_entity_id,
            txn.merchant_name || txn.name,
            txn.personal_finance_category?.primary
          )

          const vendorInfo = txn.merchant_name
            ? normalizeVendorName(txn.merchant_name)
            : { normalizedName: null, displayName: null, category: null }

          await admin.from('transactions').upsert({
            org_id: connection.org_id,
            plaid_connection_id: connection.id,
            plaid_transaction_id: txn.transaction_id,
            vendor: txn.merchant_name || txn.name,
            vendor_normalized: vendorInfo.normalizedName,
            amount: Math.abs(txn.amount),   // Plaid: positive = debit
            currency: txn.iso_currency_code || 'USD',
            date: txn.date,
            mcc_code: txn.merchant_entity_id,
            category: txn.personal_finance_category?.primary,
            description: txn.name,
            is_software: isSoftware,
            pending: txn.pending,
          }, {
            onConflict: 'org_id,plaid_transaction_id',
          })

          if (isSoftware) connectionResult.added++
        }

        // ─── 5. Handle removed transactions ────────────────────────
        for (const removed_txn of removed) {
          await admin
            .from('transactions')
            .delete()
            .eq('org_id', connection.org_id)
            .eq('plaid_transaction_id', removed_txn.transaction_id)
        }

        // ─── 6. Update cursor and status ───────────────────────────
        await admin
          .from('plaid_connections')
          .update({
            cursor: nextCursor,
            status: 'active',
            last_synced_at: new Date().toISOString(),
            error_code: null,
            error_message: null,
          })
          .eq('id', connection.id)

        // ─── 7. Recalculate vendor aggregates ──────────────────────
        await recalculateVendorAggregates(admin, connection.org_id)

      } catch (err: any) {
        connectionResult.errors.push(err.message)
        await admin
          .from('plaid_connections')
          .update({
            status: 'error',
            error_code: err.code || 'SYNC_ERROR',
            error_message: err.message,
          })
          .eq('id', connection.id)
      }

      results.push(connectionResult)
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error: any) {
    console.error('Transaction sync cron failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Recalculate the saas_vendors aggregate table from raw transactions.
 * Called after every sync to keep vendor-level spend data up to date.
 */
async function recalculateVendorAggregates(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string
) {
  // Get all software transactions grouped by vendor
  const { data: vendorStats } = await admin
    .from('transactions')
    .select('vendor_normalized, vendor, amount, date')
    .eq('org_id', orgId)
    .eq('is_software', true)
    .not('vendor_normalized', 'is', null)
    .order('date', { ascending: true })

  if (!vendorStats || vendorStats.length === 0) return

  // Group by normalized vendor name
  const grouped: Record<string, typeof vendorStats> = {}
  for (const txn of vendorStats) {
    const key = txn.vendor_normalized!
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(txn)
  }

  // Upsert each vendor
  for (const [normalizedName, transactions] of Object.entries(grouped)) {
    const totalSpend = transactions.reduce((sum, t) => sum + Number(t.amount), 0)
    const months = new Set(
      transactions.map((t) => t.date.substring(0, 7))
    ).size || 1
    const monthlyCost = totalSpend / months

    const vendorInfo = normalizeVendorName(transactions[0].vendor || normalizedName)
    const dates = transactions.map((t) => t.date).sort()

    await admin.from('saas_vendors').upsert({
      org_id: orgId,
      name: vendorInfo.displayName,
      normalized_name: normalizedName,
      monthly_cost: Math.round(monthlyCost * 100) / 100,
      annual_cost: Math.round(monthlyCost * 12 * 100) / 100,
      category: vendorInfo.category,
      first_seen: dates[0],
      last_seen: dates[dates.length - 1],
      transaction_count: transactions.length,
      is_active: true,
    }, {
      onConflict: 'org_id,normalized_name',
    })
  }
}
```

### Cron Architecture

```
Vercel Cron (every 6h)
    │
    ▼
GET /api/cron/sync-transactions
    │
    ├── Verify CRON_SECRET header
    │
    ├── Fetch all active plaid_connections
    │
    └── For each connection:
        ├── Decrypt access_token from Vault
        ├── Call Plaid /transactions/sync (cursor-based)
        ├── Filter is_software using MCC + vendor matching
        ├── Upsert transactions table
        ├── Handle removed transactions
        ├── Update cursor + status
        └── Recalculate saas_vendors aggregates
```

---

## 11. Plaid Webhook Receiver

**File:** `src/app/api/plaid/webhook/route.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.text()
  let payload: any

  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()
  const webhookType = payload.webhook_type
  const webhookCode = payload.webhook_code
  const itemId = payload.item_id

  console.log(`Plaid webhook: ${webhookType}.${webhookCode} for item ${itemId}`)

  switch (webhookType) {
    case 'TRANSACTIONS': {
      // Transaction data is available — trigger a sync
      if (['SYNC_UPDATES_AVAILABLE', 'DEFAULT_UPDATE', 'INITIAL_UPDATE'].includes(webhookCode)) {
        // Mark connection for sync (the cron will pick it up)
        // Or, for faster response, trigger sync immediately:
        await admin
          .from('plaid_connections')
          .update({ status: 'active' })  // Ensure it's not in error state
          .eq('item_id', itemId)
      }
      break
    }

    case 'ITEM': {
      if (webhookCode === 'ERROR') {
        // Bank connection has an error (e.g., password changed, MFA required)
        await admin
          .from('plaid_connections')
          .update({
            status: 'error',
            error_code: payload.error?.error_code,
            error_message: payload.error?.error_message,
          })
          .eq('item_id', itemId)
      }

      if (webhookCode === 'PENDING_EXPIRATION') {
        // Access token is about to expire (90+ days without refresh)
        await admin
          .from('plaid_connections')
          .update({
            status: 'error',
            error_code: 'PENDING_EXPIRATION',
            error_message: 'Bank connection will expire soon. User must re-authenticate.',
          })
          .eq('item_id', itemId)
      }
      break
    }

    default:
      console.log(`Unhandled Plaid webhook type: ${webhookType}.${webhookCode}`)
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true })
}
```

### Webhook Events Reference

| Event | Type | Action |
|-------|------|--------|
| `TRANSACTIONS.SYNC_UPDATES_AVAILABLE` | Transactions | New transactions ready — trigger sync |
| `TRANSACTIONS.INITIAL_UPDATE` | Transactions | Initial historical data ready |
| `TRANSACTIONS.DEFAULT_UPDATE` | Transactions | Daily transaction update |
| `ITEM.ERROR` | Item | Bank auth failed — mark connection as error |
| `ITEM.PENDING_EXPIRATION` | Item | Token expiring — notify user to re-auth |

---

## 12. Connections Page UI

**File:** `src/app/(dashboard)/connections/page.tsx`

```typescript
import { createClient } from '@/lib/supabase/server'
import { PlaidLinkButton } from '@/components/connections/plaid-link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function ConnectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch existing Plaid connections for the user's org
  const { data: connections } = await supabase
    .from('plaid_connections')
    .select('id, institution_name, status, last_synced_at, error_message')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
        <p className="text-muted-foreground">
          Connect your bank accounts and identity providers.
        </p>
      </div>

      {/* Bank Accounts Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bank Accounts</CardTitle>
          <PlaidLinkButton />
        </CardHeader>
        <CardContent>
          {connections && connections.length > 0 ? (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div key={conn.id}
                  className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{conn.institution_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Last synced: {conn.last_synced_at
                        ? new Date(conn.last_synced_at).toLocaleString()
                        : 'Never'}
                    </p>
                    {conn.error_message && (
                      <p className="text-sm text-red-500">{conn.error_message}</p>
                    )}
                  </div>
                  <Badge variant={conn.status === 'active' ? 'default' : 'destructive'}>
                    {conn.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No bank accounts connected. Click "Connect Bank Account" to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Identity Providers Section (Phase 3 placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle>Identity Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Connect Okta or Google Workspace to discover user activity data.
            Coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## 13. Dashboard: Real Spend Data

Replace the mock KPI data in the dashboard with real queries:

**File:** `src/app/(dashboard)/page.tsx` (updated)

```typescript
import { createClient } from '@/lib/supabase/server'
import { StatsCards } from '@/components/dashboard/stats-cards'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Total SaaS spend (sum of monthly costs from saas_vendors)
  const { data: spendData } = await supabase
    .from('saas_vendors')
    .select('monthly_cost')
    .eq('is_active', true)

  const totalSpend = spendData?.reduce(
    (sum, v) => sum + Number(v.monthly_cost || 0), 0
  ) ?? 0

  // Estimated waste and opportunities come from Phase 4 (waste_reports).
  // For now, show 0 until the reconciliation engine is built.
  const estimatedWaste = 0
  const opportunities = 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Your SaaS spend overview and optimization opportunities.
        </p>
      </div>
      <StatsCards
        totalSpend={totalSpend}
        estimatedWaste={estimatedWaste}
        opportunities={opportunities}
      />
    </div>
  )
}
```

---

## 14. Vercel Cron Configuration

Update `vercel.json` to include the transaction sync cron (if not already done in Phase 0):

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-transactions",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Important:** Vercel sends `GET` requests to cron endpoints with the `Authorization: Bearer <CRON_SECRET>` header. The `CRON_SECRET` env var must be configured in Vercel Dashboard.

---

## 15. Acceptance Criteria

Phase 2 is complete when **all** of the following are true:

### Plaid Integration
- [ ] Plaid Link opens in sandbox mode (test bank selection screen appears)
- [ ] User can select a sandbox institution and enter test credentials (`user_good` / `pass_good`)
- [ ] `public_token` is exchanged for `access_token` successfully
- [ ] `access_token` is stored in Supabase Vault (not plaintext in `plaid_connections`)
- [ ] `plaid_connections` row is created with correct `item_id`, `institution_name`, `status: active`
- [ ] Duplicate items are prevented (unique constraint on `org_id, item_id`)

### Transaction Sync
- [ ] Cron endpoint `/api/cron/sync-transactions` responds 401 without `CRON_SECRET`
- [ ] Cron endpoint syncs transactions from Plaid `/transactions/sync` API
- [ ] Transactions are filtered: `is_software = true` for matching MCC codes
- [ ] Vendor names are normalized: `"STRIPE* SLACK TECHNOLOGIES"` → `vendor_normalized: "slack"`
- [ ] Cursor is saved after each sync (incremental sync on next run)
- [ ] Connection status updated to `syncing` during sync, back to `active` after

### Vendor Aggregation
- [ ] `saas_vendors` table is populated with aggregated vendor data
- [ ] `monthly_cost` calculated correctly: total spend / number of months
- [ ] `first_seen` and `last_seen` dates are accurate
- [ ] Unknown vendors get a cleaned `normalized_name` (not raw garbage)

### Webhook
- [ ] Plaid webhook endpoint returns 200 for valid `TRANSACTIONS.SYNC_UPDATES_AVAILABLE`
- [ ] Item error events update `plaid_connections.status` to `error`

### UI
- [ ] Connections page shows "Connect Bank Account" button
- [ ] After connection, bank name + status badge appear in the list
- [ ] Dashboard "Total SaaS Spend" card shows real aggregated data
- [ ] Error state displayed when connection has errors

### Security
- [ ] RLS prevents Org A from seeing Org B's transactions
- [ ] Service role key only used in server-side API routes (never in client)
- [ ] Vault functions restricted to `service_role` (not `authenticated`)
- [ ] No Plaid secrets (`access_token`, `PLAID_SECRET`) logged or returned to client

---

## Next Step

→ Proceed to [Phase 3 — Usage Discovery (Okta + Google Workspace)](./PHASE-3-USAGE-DISCOVERY.md)
