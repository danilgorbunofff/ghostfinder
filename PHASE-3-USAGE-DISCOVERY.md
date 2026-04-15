# Phase 3 — Usage Discovery (Okta + Google Workspace)

> **Goal:** Connect identity providers (Okta, Google Workspace) via OAuth 2.0, ingest user directory data with last-login timestamps, and flag inactive users (30+ days since login) — providing the "activity" side of the reconciliation equation.

---

## Table of Contents

1. [Integration Architecture Overview](#1-integration-architecture-overview)
2. [Database Schema — Migration 4](#2-database-schema--migration-4)
3. [Okta Service Module](#3-okta-service-module)
4. [Google Workspace Service Module](#4-google-workspace-service-module)
5. [Okta OAuth 2.0 Flow](#5-okta-oauth-20-flow)
6. [Google Workspace OAuth 2.0 Flow](#6-google-workspace-oauth-20-flow)
7. [OAuth State & CSRF Protection](#7-oauth-state--csrf-protection)
8. [Usage Sync Cron Job](#8-usage-sync-cron-job)
9. [Connections Page Update](#9-connections-page-update)
10. [Dashboard: Activity Data](#10-dashboard-activity-data)
11. [Token Refresh Strategy](#11-token-refresh-strategy)
12. [Vercel Cron Configuration](#12-vercel-cron-configuration)
13. [Testing Strategy](#13-testing-strategy)
14. [Acceptance Criteria](#14-acceptance-criteria)

---

## 1. Integration Architecture Overview

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Connections Page (UI)                       │
│                                                               │
│    [Connect Okta]          [Connect Google Workspace]          │
│         │                           │                         │
│         ▼                           ▼                         │
│   /api/integrations/          /api/integrations/              │
│   okta/connect                google/connect                  │
│         │                           │                         │
│         ▼                           ▼                         │
│   Okta OAuth Screen           Google OAuth Screen             │
│   (User authorizes)           (Admin authorizes)              │
│         │                           │                         │
│         ▼                           ▼                         │
│   /api/integrations/          /api/integrations/              │
│   okta/callback               google/callback                 │
│         │                           │                         │
│         └───────────┬───────────────┘                         │
│                     ▼                                         │
│              Store tokens in Vault                            │
│              Create integration_connections row               │
│                     │                                         │
│                     ▼                                         │
│         Cron: /api/cron/sync-usage (every 12h)               │
│                     │                                         │
│         ┌───────────┴───────────┐                             │
│         ▼                       ▼                             │
│   Okta: List Users        Google: List Users                  │
│   + Last Login            + Last Login                        │
│         │                       │                             │
│         └───────────┬───────────┘                             │
│                     ▼                                         │
│            Upsert user_activity table                         │
│            Flag inactive (30+ days)                           │
└──────────────────────────────────────────────────────────────┘
```

### Provider Comparison

| Feature | Okta | Google Workspace |
|---------|------|------------------|
| **Auth Method** | OAuth 2.0 (Authorization Code) | OAuth 2.0 (Authorization Code) |
| **SDK** | `@okta/okta-sdk-nodejs` | `googleapis` (Admin SDK) |
| **User List Endpoint** | `/api/v1/users` | `admin.users.list()` |
| **Last Login Field** | `lastLogin` (ISO timestamp) | `lastLoginTime` (ISO timestamp) |
| **Status Field** | `status` (ACTIVE, SUSPENDED, DEPROVISIONED) | `suspended` (boolean) |
| **Admin Requirement** | Okta Super Admin or API token | Google Workspace Super Admin |
| **Rate Limits** | 600 req/min | 2400 req/100sec per user |
| **Pagination** | Link header (cursor) | `nextPageToken` |

---

## 2. Database Schema — Migration 4

**File:** `supabase/migrations/00004_usage_tables.sql`

```sql
-- ============================================================================
-- MIGRATION 4: Usage discovery tables (Okta + Google Workspace)
-- Creates: integration_connections, user_activity
-- ============================================================================

-- ─── Integration Provider Enum ──────────────────────────────────────────────
CREATE TYPE integration_provider AS ENUM (
  'okta',
  'google_workspace',
  'azure_ad',
  'slack'
);

-- ─── Activity Status Enum ───────────────────────────────────────────────────
CREATE TYPE activity_status AS ENUM (
  'active',
  'inactive',
  'suspended',
  'deprovisioned'
);

-- ─── Integration Connections ────────────────────────────────────────────────
-- Tracks OAuth connections to identity providers.
-- Each org can have multiple providers connected.
CREATE TABLE public.integration_connections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider                integration_provider NOT NULL,
  access_token_secret_id  UUID,             -- Vault reference (encrypted)
  refresh_token_secret_id UUID,             -- Vault reference (encrypted, for token refresh)
  token_expires_at        TIMESTAMPTZ,      -- When the access token expires
  metadata                JSONB DEFAULT '{}', -- Provider-specific config
  -- metadata examples:
  --   Okta:    { "orgUrl": "https://dev-xxx.okta.com", "domain": "company.com" }
  --   Google:  { "domain": "company.com", "customerId": "Cxxxx" }
  is_active               BOOLEAN DEFAULT true,
  total_users             INTEGER DEFAULT 0,
  active_users            INTEGER DEFAULT 0,
  inactive_users          INTEGER DEFAULT 0,
  last_synced_at          TIMESTAMPTZ,
  error_message           TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, provider)  -- One connection per provider per org
);

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_integrations_org_id ON public.integration_connections(org_id);
CREATE INDEX idx_integrations_provider ON public.integration_connections(org_id, provider);

CREATE TRIGGER set_updated_at_integrations
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── User Activity ──────────────────────────────────────────────────────────
-- Stores per-user login activity from connected identity providers.
-- This is the "activity" side of the ghost seat equation.
CREATE TABLE public.user_activity (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_connection_id UUID REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  email                     TEXT NOT NULL,
  display_name              TEXT,
  provider                  TEXT NOT NULL,       -- 'okta' | 'google_workspace'
  last_login                TIMESTAMPTZ,         -- Most recent login timestamp
  status                    activity_status DEFAULT 'active',
  department                TEXT,                 -- Org unit / department
  title                     TEXT,                 -- Job title
  is_admin                  BOOLEAN DEFAULT false,
  raw_data                  JSONB,               -- Full provider response (for debugging)
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, email, provider)
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_activity_org_id ON public.user_activity(org_id);
CREATE INDEX idx_user_activity_email ON public.user_activity(org_id, email);
CREATE INDEX idx_user_activity_status ON public.user_activity(org_id, status);
CREATE INDEX idx_user_activity_last_login ON public.user_activity(org_id, last_login);
CREATE INDEX idx_user_activity_inactive ON public.user_activity(org_id, status)
  WHERE status = 'inactive';  -- Partial index for ghost seat queries

CREATE TRIGGER set_updated_at_user_activity
  BEFORE UPDATE ON public.user_activity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS Policies ───────────────────────────────────────────────────────────

-- Integration Connections
CREATE POLICY "integrations_select_own" ON public.integration_connections
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "integrations_insert_admin" ON public.integration_connections
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

CREATE POLICY "integrations_update_admin" ON public.integration_connections
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

CREATE POLICY "integrations_delete_admin" ON public.integration_connections
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

-- User Activity
CREATE POLICY "user_activity_select_own" ON public.user_activity
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

-- User activity is managed by service_role (cron jobs).
-- No direct insert/update/delete by authenticated users.
```

### Why Separate `user_activity` from `integration_connections`?

| Concern | `integration_connections` | `user_activity` |
|---------|--------------------------|-----------------|
| **Cardinality** | 1-2 per org | Thousands per org (every employee) |
| **Sensitivity** | Contains token refs (Vault IDs) | Contains employee email/login data |
| **Update frequency** | Rarely (only when re-auth) | Every sync cycle (12h) |
| **Query pattern** | Lookup by org + provider | Scan by org + status (ghost detection) |

---

## 3. Okta Service Module

**File:** `src/lib/services/okta.service.ts`

```typescript
import { Client as OktaClient } from '@okta/okta-sdk-nodejs'

export interface OktaUserActivity {
  email: string
  displayName: string | null
  lastLogin: string | null       // ISO 8601 timestamp
  status: 'active' | 'inactive' | 'suspended' | 'deprovisioned'
  department: string | null
  title: string | null
  isAdmin: boolean
}

/**
 * Fetch all users from an Okta organization with their last login timestamps.
 *
 * @param orgUrl - Okta org URL (e.g., "https://dev-xxxxx.okta.com")
 * @param apiToken - Okta API token (decrypted from Vault)
 * @returns Array of user activity records
 */
export async function listOktaUsers(
  orgUrl: string,
  apiToken: string
): Promise<OktaUserActivity[]> {
  const client = new OktaClient({
    orgUrl,
    token: apiToken,
  })

  const users: OktaUserActivity[] = []
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Okta SDK uses async iteration for pagination
  const collection = await client.userApi.listUsers()

  for await (const user of collection) {
    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null

    // Map Okta status to our enum
    let status: OktaUserActivity['status'] = 'active'
    if (user.status === 'SUSPENDED') {
      status = 'suspended'
    } else if (user.status === 'DEPROVISIONED') {
      status = 'deprovisioned'
    } else if (!lastLogin || lastLogin < thirtyDaysAgo) {
      status = 'inactive'
    }

    users.push({
      email: user.profile?.email ?? '',
      displayName: user.profile
        ? `${user.profile.firstName ?? ''} ${user.profile.lastName ?? ''}`.trim()
        : null,
      lastLogin: user.lastLogin ?? null,
      status,
      department: user.profile?.department ?? null,
      title: user.profile?.title ?? null,
      isAdmin: false,  // Would need separate admin API call
    })
  }

  return users
}

/**
 * Verify Okta API token is valid by making a test request.
 */
export async function verifyOktaConnection(
  orgUrl: string,
  apiToken: string
): Promise<boolean> {
  try {
    const client = new OktaClient({ orgUrl, token: apiToken })
    // Fetch a single user to verify credentials
    const collection = await client.userApi.listUsers({ limit: 1 })
    for await (const _ of collection) {
      break  // Just verify we can read — don't iterate all
    }
    return true
  } catch {
    return false
  }
}
```

### Okta SDK Notes

| Concern | Detail |
|---------|--------|
| **Pagination** | SDK handles automatically via async iteration. No manual page handling needed. |
| **Rate limits** | 600 requests/min. The SDK has built-in retry with backoff. |
| **`lastLogin`** | `null` if user has never logged in (invited but never activated). |
| **Status mapping** | `ACTIVE`, `STAGED`, `PROVISIONED`, `RECOVERY`, `SUSPENDED`, `DEPROVISIONED`, `PASSWORD_EXPIRED`, `LOCKED_OUT` → we simplify to 4 statuses. |

---

## 4. Google Workspace Service Module

**File:** `src/lib/services/google.service.ts`

```typescript
import { google, admin_directory_v1 } from 'googleapis'

export interface GoogleUserActivity {
  email: string
  displayName: string | null
  lastLogin: string | null       // ISO 8601 timestamp
  status: 'active' | 'inactive' | 'suspended' | 'deprovisioned'
  department: string | null
  title: string | null
  isAdmin: boolean
}

/**
 * Create an authenticated Google Admin SDK client.
 *
 * @param accessToken - OAuth 2.0 access token (decrypted from Vault)
 */
function createAdminClient(accessToken: string): admin_directory_v1.Admin {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  return google.admin({
    version: 'directory_v1',
    auth,
  })
}

/**
 * Fetch all users from a Google Workspace domain with their last login timestamps.
 *
 * @param accessToken - OAuth 2.0 access token
 * @param domain - Workspace domain (e.g., "company.com")
 * @returns Array of user activity records
 */
export async function listGoogleUsers(
  accessToken: string,
  domain: string
): Promise<GoogleUserActivity[]> {
  const adminClient = createAdminClient(accessToken)
  const users: GoogleUserActivity[] = []
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  let pageToken: string | undefined = undefined

  do {
    const response = await adminClient.users.list({
      domain,
      maxResults: 500,
      orderBy: 'email',
      projection: 'full',     // Include all user fields
      pageToken,
    })

    const googleUsers = response.data.users || []

    for (const user of googleUsers) {
      const lastLogin = user.lastLoginTime
        ? new Date(user.lastLoginTime)
        : null

      // Google returns "1970-01-01T00:00:00.000Z" for never-logged-in users
      const isNeverLoggedIn =
        !lastLogin || lastLogin.getFullYear() <= 1970

      let status: GoogleUserActivity['status'] = 'active'
      if (user.suspended) {
        status = 'suspended'
      } else if (isNeverLoggedIn || lastLogin! < thirtyDaysAgo) {
        status = 'inactive'
      }

      users.push({
        email: user.primaryEmail ?? '',
        displayName: user.name?.fullName ?? null,
        lastLogin: isNeverLoggedIn ? null : user.lastLoginTime ?? null,
        status,
        department: user.organizations?.[0]?.department ?? null,
        title: user.organizations?.[0]?.title ?? null,
        isAdmin: user.isAdmin ?? false,
      })
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return users
}

/**
 * Refresh an expired Google OAuth token using the refresh token.
 *
 * @returns New access token + expiry
 */
export async function refreshGoogleToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: Date
}> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauth2Client.refreshAccessToken()

  return {
    accessToken: credentials.access_token!,
    expiresAt: new Date(credentials.expiry_date!),
  }
}

/**
 * Verify Google Workspace access by listing one user.
 */
export async function verifyGoogleConnection(
  accessToken: string,
  domain: string
): Promise<boolean> {
  try {
    const adminClient = createAdminClient(accessToken)
    await adminClient.users.list({
      domain,
      maxResults: 1,
    })
    return true
  } catch {
    return false
  }
}
```

### Google Workspace SDK Notes

| Concern | Detail |
|---------|--------|
| **Admin privilege** | Must be a Google Workspace Super Admin to access `admin.users.list` |
| **`lastLoginTime`** | `"1970-01-01T00:00:00.000Z"` if user has never logged in |
| **Token refresh** | Google access tokens expire in 1 hour. Use refresh token to get new ones. |
| **Domain** | Multi-domain workspaces: query each domain separately |
| **Pagination** | Manual: use `nextPageToken` in a do-while loop |
| **Rate limits** | 2,400 requests per 100 seconds per user. Pagination helps stay within limits. |

---

## 5. Okta OAuth 2.0 Flow

### 5.1 — Initiate Connection

**File:** `src/app/api/integrations/okta/connect/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orgUrl, apiToken } = await request.json()

  if (!orgUrl || !apiToken) {
    return NextResponse.json(
      { error: 'Okta org URL and API token are required' },
      { status: 400 }
    )
  }

  // Validate URL format
  try {
    const url = new URL(orgUrl)
    if (!url.hostname.endsWith('.okta.com') && !url.hostname.endsWith('.oktapreview.com')) {
      return NextResponse.json(
        { error: 'Invalid Okta org URL. Must end with .okta.com' },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  try {
    // Verify the token works
    const { verifyOktaConnection } = await import('@/lib/services/okta.service')
    const isValid = await verifyOktaConnection(orgUrl, apiToken)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid Okta credentials. Check your org URL and API token.' },
        { status: 400 }
      )
    }

    // Get user's org
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only admins can connect integrations' },
        { status: 403 }
      )
    }

    // Store API token in Vault
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()

    const { data: secretId } = await admin.rpc('store_secret', {
      p_secret: apiToken,
      p_name: `okta_${membership.org_id}`,
      p_description: `Okta API token for org ${membership.org_id}`,
    })

    // Create or update integration connection
    const { error: upsertError } = await admin
      .from('integration_connections')
      .upsert({
        org_id: membership.org_id,
        provider: 'okta',
        access_token_secret_id: secretId,
        metadata: { orgUrl, domain: new URL(orgUrl).hostname },
        is_active: true,
        error_message: null,
      }, {
        onConflict: 'org_id,provider',
      })

    if (upsertError) {
      return NextResponse.json(
        { error: 'Failed to save connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Okta connection failed:', error)
    return NextResponse.json(
      { error: 'Failed to connect to Okta' },
      { status: 500 }
    )
  }
}
```

### Okta Integration Notes

Okta supports two authentication methods:
1. **API Token** (simpler, used here): Admin creates a token in Okta Dashboard → enters it in Ghost Finder
2. **OAuth 2.0** (more complex): Full Authorization Code flow with PKCE

We use the **API Token approach** because:
- Simpler for the admin (no OAuth redirect dance)
- API tokens don't expire (unless revoked)
- No refresh token handling needed
- Sufficient for reading user directory data

---

## 6. Google Workspace OAuth 2.0 Flow

### 6.1 — Initiate OAuth

**File:** `src/app/api/integrations/google/connect/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import crypto from 'crypto'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is an admin
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Only admins can connect integrations' },
      { status: 403 }
    )
  }

  // Generate OAuth state parameter (CSRF protection)
  const state = crypto.randomBytes(32).toString('hex')

  // Store state in a short-lived cookie for validation in callback
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
  )

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',      // Request refresh_token
    prompt: 'consent',           // Force consent to always get refresh_token
    scope: [
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
    ],
    state: `${state}:${membership.org_id}`,  // Encode org_id in state
  })

  // Set state cookie for CSRF validation
  const response = NextResponse.json({ authorizationUrl })
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,  // 10 minutes
    path: '/',
  })

  return response
}
```

### 6.2 — OAuth Callback

**File:** `src/app/api/integrations/google/callback/route.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=google_oauth_denied`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=missing_params`
    )
  }

  // Validate CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('google_oauth_state')?.value
  const [receivedState, orgId] = state.split(':')

  if (!storedState || storedState !== receivedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=invalid_state`
    )
  }

  try {
    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
    )

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token) {
      throw new Error('No access token received')
    }

    const admin = createAdminClient()

    // Store access token in Vault
    const { data: accessSecretId } = await admin.rpc('store_secret', {
      p_secret: tokens.access_token,
      p_name: `google_access_${orgId}`,
      p_description: `Google Workspace access token for org ${orgId}`,
    })

    // Store refresh token in Vault (if provided)
    let refreshSecretId = null
    if (tokens.refresh_token) {
      const { data } = await admin.rpc('store_secret', {
        p_secret: tokens.refresh_token,
        p_name: `google_refresh_${orgId}`,
        p_description: `Google Workspace refresh token for org ${orgId}`,
      })
      refreshSecretId = data
    }

    // Detect domain from the authorized admin's profile
    oauth2Client.setCredentials(tokens)
    const people = google.people({ version: 'v1', auth: oauth2Client })
    const me = await people.people.get({
      resourceName: 'people/me',
      personFields: 'emailAddresses',
    })
    const adminEmail = me.data.emailAddresses?.[0]?.value ?? ''
    const domain = adminEmail.split('@')[1] ?? ''

    // Create or update integration connection
    const { error: upsertError } = await admin
      .from('integration_connections')
      .upsert({
        org_id: orgId,
        provider: 'google_workspace',
        access_token_secret_id: accessSecretId,
        refresh_token_secret_id: refreshSecretId,
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        metadata: { domain, adminEmail },
        is_active: true,
        error_message: null,
      }, {
        onConflict: 'org_id,provider',
      })

    if (upsertError) {
      throw new Error(`Failed to save connection: ${upsertError.message}`)
    }

    // Clear state cookie
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/connections?success=google_connected`
    )
    response.cookies.delete('google_oauth_state')
    return response

  } catch (err: any) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/connections?error=google_callback_failed`
    )
  }
}
```

### Google OAuth Scopes

| Scope | Purpose | Why We Need It |
|-------|---------|---------------|
| `admin.directory.user.readonly` | List all users in the domain | Get emails, last login, suspended status |

> **Important:** The user authorizing must be a **Google Workspace Super Admin**. Regular users cannot access the Admin SDK.

---

## 7. OAuth State & CSRF Protection

### Why State Parameter Matters

Without CSRF protection, an attacker could:
1. Initiate an OAuth flow with their own Okta/Google account
2. Send the callback URL to a victim
3. Victim clicks the link → their Ghost Finder org gets connected to the attacker's identity provider
4. Attacker's user data appears in the victim's reports

### Our Protection

```
Connect Click → Generate random state → Store in httpOnly cookie
        │
        ▼
OAuth Provider (Okta/Google)
        │
        ▼
Callback → Verify state from URL matches state in cookie
        │
        ├── Match → Proceed (legitimate flow)
        └── No match → Reject (CSRF attempt)
```

| Protection | Implementation |
|-----------|---------------|
| **State parameter** | `crypto.randomBytes(32)` — unpredictable |
| **Cookie storage** | `httpOnly`, `secure`, `sameSite: lax` |
| **Short-lived** | `maxAge: 600` (10 minutes) |
| **One-time use** | Cookie deleted after callback |

---

## 8. Usage Sync Cron Job

**File:** `src/app/api/cron/sync-usage/route.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { listOktaUsers } from '@/lib/services/okta.service'
import { listGoogleUsers, refreshGoogleToken } from '@/lib/services/google.service'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300  // 5 min (Vercel Pro)

export async function GET(request: Request) {
  // ─── 1. Verify cron secret ─────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const results: {
    connectionId: string
    provider: string
    usersProcessed: number
    activeUsers: number
    inactiveUsers: number
    error: string | null
  }[] = []

  try {
    // ─── 2. Fetch all active integration connections ──────────────────
    const { data: connections } = await admin
      .from('integration_connections')
      .select('*')
      .eq('is_active', true)

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: 'No active integrations', results: [] })
    }

    // ─── 3. Process each connection ──────────────────────────────────
    for (const connection of connections) {
      const result = {
        connectionId: connection.id,
        provider: connection.provider,
        usersProcessed: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        error: null as string | null,
      }

      try {
        let users: { email: string; displayName: string | null; lastLogin: string | null; status: string; department: string | null; title: string | null; isAdmin: boolean }[] = []

        // ─── Fetch users based on provider ──────────────────────────
        if (connection.provider === 'okta') {
          // Retrieve Okta API token from Vault
          const { data: apiToken } = await admin.rpc('get_secret', {
            p_secret_id: connection.access_token_secret_id,
          })

          if (!apiToken) {
            result.error = 'Failed to retrieve Okta API token from Vault'
            results.push(result)
            continue
          }

          const orgUrl = connection.metadata?.orgUrl
          if (!orgUrl) {
            result.error = 'Missing Okta org URL in metadata'
            results.push(result)
            continue
          }

          users = await listOktaUsers(orgUrl, apiToken)

        } else if (connection.provider === 'google_workspace') {
          // Check if token needs refresh
          let accessToken: string

          if (connection.token_expires_at &&
              new Date(connection.token_expires_at) < new Date()) {
            // Token expired — refresh it
            const { data: refreshToken } = await admin.rpc('get_secret', {
              p_secret_id: connection.refresh_token_secret_id,
            })

            if (!refreshToken) {
              result.error = 'Failed to retrieve Google refresh token'
              await admin
                .from('integration_connections')
                .update({ is_active: false, error_message: result.error })
                .eq('id', connection.id)
              results.push(result)
              continue
            }

            const refreshed = await refreshGoogleToken(refreshToken)
            accessToken = refreshed.accessToken

            // Store new access token in Vault
            const { data: newSecretId } = await admin.rpc('store_secret', {
              p_secret: accessToken,
              p_name: `google_access_${connection.org_id}_refreshed`,
              p_description: 'Refreshed Google access token',
            })

            // Update connection with new token and expiry
            await admin
              .from('integration_connections')
              .update({
                access_token_secret_id: newSecretId,
                token_expires_at: refreshed.expiresAt.toISOString(),
              })
              .eq('id', connection.id)
          } else {
            // Token still valid
            const { data: token } = await admin.rpc('get_secret', {
              p_secret_id: connection.access_token_secret_id,
            })
            accessToken = token
          }

          if (!accessToken) {
            result.error = 'Failed to retrieve Google access token'
            results.push(result)
            continue
          }

          const domain = connection.metadata?.domain
          if (!domain) {
            result.error = 'Missing Google Workspace domain in metadata'
            results.push(result)
            continue
          }

          users = await listGoogleUsers(accessToken, domain)
        }

        // ─── 4. Upsert user activity data ────────────────────────────
        let activeCount = 0
        let inactiveCount = 0

        for (const user of users) {
          if (!user.email) continue

          const isInactive = user.status === 'inactive' || user.status === 'suspended'
          if (isInactive) inactiveCount++
          else activeCount++

          await admin.from('user_activity').upsert({
            org_id: connection.org_id,
            integration_connection_id: connection.id,
            email: user.email,
            display_name: user.displayName,
            provider: connection.provider,
            last_login: user.lastLogin,
            status: user.status,
            department: user.department,
            title: user.title,
            is_admin: user.isAdmin,
          }, {
            onConflict: 'org_id,email,provider',
          })
        }

        // ─── 5. Update connection stats ──────────────────────────────
        await admin
          .from('integration_connections')
          .update({
            last_synced_at: new Date().toISOString(),
            total_users: users.length,
            active_users: activeCount,
            inactive_users: inactiveCount,
            error_message: null,
          })
          .eq('id', connection.id)

        result.usersProcessed = users.length
        result.activeUsers = activeCount
        result.inactiveUsers = inactiveCount

      } catch (err: any) {
        result.error = err.message
        await admin
          .from('integration_connections')
          .update({ error_message: err.message })
          .eq('id', connection.id)
      }

      results.push(result)
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error: any) {
    console.error('Usage sync cron failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

### Cron Architecture

```
Vercel Cron (every 12h)
    │
    ▼
GET /api/cron/sync-usage
    │
    ├── Verify CRON_SECRET
    │
    ├── Fetch all active integration_connections
    │
    └── For each connection:
        │
        ├── provider = okta?
        │   ├── Decrypt API token from Vault
        │   └── Call listOktaUsers(orgUrl, token)
        │
        ├── provider = google_workspace?
        │   ├── Check token expiry → refresh if needed
        │   ├── Decrypt access token from Vault
        │   └── Call listGoogleUsers(token, domain)
        │
        ├── Upsert user_activity rows
        ├── Calculate active/inactive counts
        └── Update connection stats
```

---

## 9. Connections Page Update

### 9.1 — Okta Connect Button

**File:** `src/components/connections/okta-connect-button.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Loader2, Shield } from 'lucide-react'

export function OktaConnectButton({ onSuccess }: { onSuccess?: () => void }) {
  const [orgUrl, setOrgUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/integrations/okta/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgUrl, apiToken }),
      })

      const data = await res.json()
      if (data.success) {
        setOpen(false)
        onSuccess?.()
      } else {
        setError(data.error || 'Connection failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Shield className="mr-2 h-4 w-4" />
          Connect Okta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Okta</DialogTitle>
          <DialogDescription>
            Enter your Okta org URL and an API token.
            You can generate an API token in Okta Admin → Security → API → Tokens.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgUrl">Okta Org URL</Label>
            <Input
              id="orgUrl"
              type="url"
              placeholder="https://your-company.okta.com"
              value={orgUrl}
              onChange={(e) => setOrgUrl(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiToken">API Token</Label>
            <Input
              id="apiToken"
              type="password"
              placeholder="00xxxxxxxxxxxxxxxxxx"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### 9.2 — Google Workspace Connect Button

**File:** `src/components/connections/google-connect-button.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function GoogleConnectButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/integrations/google/connect', {
        method: 'POST',
      })

      const data = await res.json()
      if (data.authorizationUrl) {
        // Redirect to Google OAuth consent screen
        window.location.href = data.authorizationUrl
      } else {
        setError(data.error || 'Failed to initiate connection')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button variant="outline" onClick={handleConnect} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Connect Google Workspace
      </Button>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  )
}
```

### 9.3 — Updated Connections Page

Add the Okta and Google buttons to the existing Connections page. Show integration status, user counts, and last sync time.

```
┌─────────────────────────────────────────────────────┐
│ Connections                                          │
│                                                      │
│ ┌─ Bank Accounts ─────────────────────────────────┐ │
│ │  First Platypus Bank         [active]  Synced 2h│ │
│ │                        [+ Connect Bank Account] │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─ Identity Providers ────────────────────────────┐ │
│ │  Okta (dev-xxxxx.okta.com)                      │ │
│ │  150 users (12 inactive)     [active]  Synced 6h│ │
│ │                                                  │ │
│ │  Google Workspace (company.com)                  │ │
│ │  230 users (28 inactive)     [active]  Synced 6h│ │
│ │                                                  │ │
│ │  [+ Connect Okta]  [+ Connect Google Workspace] │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 10. Dashboard: Activity Data

Add user activity stats to the dashboard. In the `(dashboard)/page.tsx`, fetch from `integration_connections`:

```typescript
// Fetch user activity summary
const { data: integrations } = await supabase
  .from('integration_connections')
  .select('total_users, active_users, inactive_users')
  .eq('is_active', true)

const totalUsers = integrations?.reduce((s, i) => s + (i.total_users || 0), 0) ?? 0
const inactiveUsers = integrations?.reduce((s, i) => s + (i.inactive_users || 0), 0) ?? 0
```

Display as additional cards or as a sub-section under the KPI cards.

---

## 11. Token Refresh Strategy

### Google Workspace

Google access tokens expire after **1 hour**. The cron job handles refresh automatically:

```
Before each sync:
  1. Check token_expires_at
  2. If expired → call refreshGoogleToken(refreshToken)
  3. Store new access token in Vault
  4. Update integration_connections with new secret_id + expiry
  5. Proceed with sync
```

### Okta

Okta API tokens **do not expire** (they last until revoked by an admin). No refresh logic needed.

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Google refresh token revoked | Mark connection `is_active: false`, show error on Connections page |
| Okta API token revoked | Sync fails → `error_message` set → user must re-enter token |
| Google admin loses admin privileges | Admin SDK calls fail → error recorded, connection deactivated |
| Rate limits hit | SDK handles retries; if persistent, log error and skip to next connection |

---

## 12. Vercel Cron Configuration

Ensure `vercel.json` includes the usage sync cron:

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
    }
  ]
}
```

---

## 13. Testing Strategy

### 13.1 — Okta Sandbox

1. Create a free Okta Developer account at [developer.okta.com](https://developer.okta.com)
2. Add test users: go to Directory → People → Add Person
3. Create API token: Security → API → Tokens → Create Token
4. Use the developer org URL and token in Ghost Finder

### 13.2 — Google Workspace Test

1. Use a Google Workspace trial (or existing workspace)
2. Create OAuth credentials in Google Cloud Console
3. Enable Admin SDK: APIs & Services → Library → Admin SDK API → Enable
4. Test the OAuth flow with your admin account

### 13.3 — Unit Tests

Test the normalizer/detector logic without hitting external APIs:

```typescript
// Example: test user activity status classification
describe('listOktaUsers', () => {
  it('marks users with no login in 30+ days as inactive', () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 45)

    // Mock user with old lastLogin
    // Verify status === 'inactive'
  })
})
```

---

## 14. Acceptance Criteria

Phase 3 is complete when **all** of the following are true:

### Okta Integration
- [ ] Okta connect dialog accepts org URL + API token
- [ ] API token is validated before saving (test request succeeds)
- [ ] API token stored in Supabase Vault (not plaintext)
- [ ] Invalid credentials show clear error message
- [ ] `integration_connections` row created with `provider: okta`
- [ ] Only admins/owners can connect integrations (role check enforced)

### Google Workspace Integration
- [ ] "Connect Google Workspace" redirects to Google OAuth consent screen
- [ ] OAuth state parameter validated in callback (CSRF protection)
- [ ] Access token + refresh token stored in Supabase Vault
- [ ] Callback redirects back to `/connections` with success indicator
- [ ] Domain auto-detected from authorized admin's email
- [ ] `integration_connections` row created with `provider: google_workspace`

### Usage Sync
- [ ] Cron endpoint secured by `CRON_SECRET` header check
- [ ] Okta users fetched with `lastLogin` timestamps
- [ ] Google Workspace users fetched with `lastLoginTime` timestamps
- [ ] Google token auto-refreshes when expired (using refresh token)
- [ ] Users inactive 30+ days marked with `status: inactive`
- [ ] `user_activity` table populated with correct data
- [ ] Integration connection stats updated (total/active/inactive counts)
- [ ] Never-logged-in users correctly identified

### Security
- [ ] RLS enforced: Org A cannot see Org B's user activity
- [ ] Tokens only decrypted via `private.get_secret()` (SECURITY DEFINER)
- [ ] Google OAuth state cookie is `httpOnly`, `secure`, `sameSite: lax`
- [ ] Okta org URL validated (must end in `.okta.com`)
- [ ] No tokens logged or returned to the client

### UI
- [ ] Connections page shows Okta and Google connect buttons
- [ ] Connected integrations show user counts and last sync time
- [ ] Error states displayed clearly (revoked token, sync failure)
- [ ] Dashboard shows active vs inactive user counts

---

## Next Step

→ Proceed to [Phase 4 — Reconciliation Engine](./PHASE-4-RECONCILIATION.md)
