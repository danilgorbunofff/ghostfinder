# Phase 4 — Server-Side API Handler

## Objective

Confirm `/api/dev` receives requests, authenticates them, executes the requested action, and returns a valid JSON response. This phase bypasses the browser entirely — use `curl` to test the raw API, isolating server-side issues from client-side problems.

---

## Architecture Overview

```
POST /api/dev
  │
  ├── 1. guardDev()
  │     └── MOCK_SERVICES !== 'true' → 404 (route pretends to not exist)
  │
  ├── 2. getAuthContext(request)
  │     ├── Extract Bearer token from Authorization header
  │     ├── admin.auth.getUser(token) → validate with Supabase
  │     ├── ensureOrganization(userId) → get or create org
  │     └── Return { userId, orgId, role } or null → 401
  │
  ├── 3. Parse body: { action, ...params }
  │
  ├── 4. Router: switch(action)
  │     ├── 'get-state'          → read-only, returns immediately
  │     ├── 'seed-data'          → inserts demo rows into 9+ tables
  │     ├── 'reset-data'         → deletes all org data
  │     ├── 'generate-transactions' → random transactions
  │     ├── 'simulate-plaid'     → fake bank connection
  │     ├── 'simulate-google/okta' → fake identity provider
  │     ├── 'switch-role/tier'   → update org membership
  │     └── default              → 400 unknown action
  │
  └── 5. revalidatePath('/', 'layout') → invalidate server cache
```

---

## Step 4.1 — Test the endpoint with curl (bypass browser)

First, obtain a valid JWT token. Open the browser console on any dashboard page:

```javascript
// Browser console — copy the token
const { createBrowserClient } = await import('@supabase/ssr')
// Or find it directly:
const key = Object.keys(localStorage).find(k => k.startsWith('sb-'))
const data = JSON.parse(localStorage.getItem(key))
console.log('TOKEN:', data.access_token)
// Copy this token value
```

Then test in terminal:

```bash
# Replace <TOKEN> with the copied JWT
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"get-state"}' | python3 -m json.tool
```

### Expected responses by scenario

| Status | Body | Meaning |
|--------|------|---------|
| `200` | `{"state": {"user": {...}, "counts": {...}, ...}}` | Everything works — server healthy |
| `404` | `{"error": "Not found"}` | `MOCK_SERVICES` not set to `true` on server |
| `401` | `{"error": "Unauthorized"}` | Token invalid, expired, or missing |
| `400` | `{"error": "Unknown action: xyz"}` | Action name typo or unsupported action |
| `500` | HTML error page or empty | Uncaught server exception |

### If you get a 404

```bash
# Check server-side env
grep '^MOCK_SERVICES' .env.local
```

Must be exactly `MOCK_SERVICES=true` (no spaces, no quotes).

After fixing, **restart the dev server** — server-side env vars are read at startup for API routes.

### If you get a 401

The token is invalid or expired. Common causes:

1. Token was copied incorrectly (truncated)
2. Token expired (default Supabase token lifetime: 3600 seconds / 1 hour)
3. `SUPABASE_SERVICE_ROLE_KEY` is missing — the admin client can't verify tokens
4. `NEXT_PUBLIC_SUPABASE_URL` is wrong — admin client connects to wrong project

---

## Step 4.2 — Verify the `SUPABASE_SERVICE_ROLE_KEY`

The `getAuthContext()` function creates an admin client to verify the Bearer token server-side:

```typescript
// Creates admin client with service role key
const admin = createAdminClient()
// Uses admin privileges to verify the user's JWT
const { data: { user }, error } = await admin.auth.getUser(token)
```

The admin client is defined in `src/lib/supabase/admin.ts`:

```typescript
import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,      // ← must be correct
    process.env.SUPABASE_SERVICE_ROLE_KEY!,       // ← must be correct
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

### Verify the key exists

```bash
grep 'SUPABASE_SERVICE_ROLE_KEY' .env.local
```

- If the line is empty or missing, all admin operations fail silently
- The `!` postfix in TypeScript means "trust me, this exists" — it does NOT throw if undefined. It just passes `undefined` to Supabase, which then fails on every call.

### Verify the key is valid

```bash
# Test the service role key directly against Supabase
# Replace values from .env.local
curl -s "https://YOUR_PROJECT.supabase.co/auth/v1/user" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "apikey: <ANON_KEY>"
```

If this returns an error about the key being invalid, you need to regenerate it from the Supabase Dashboard → Settings → API.

---

## Step 4.3 — Check server terminal for runtime errors

When the dev server processes a request to `/api/dev`, any uncaught errors should appear in the terminal where `npm run dev` is running.

### What to look for

```
# Good — request processed
POST /api/dev 200 in 234ms

# Bad — env var missing
TypeError: Cannot read properties of undefined (reading 'auth')
    at createAdminClient (src/lib/supabase/admin.ts:4:10)
    at getAuthContext (src/app/api/dev/route.ts:22:18)

# Bad — database table missing
error: relation "organizations" does not exist
    at ensureOrganization (src/lib/supabase/ensure-org.ts:14:42)

# Bad — RLS or permission error
error: new row violates row-level security policy for table "saas_vendors"
```

### Enable verbose logging (temporary)

Add error logging to the API route:

```typescript
// src/app/api/dev/route.ts — wrap the POST handler body
export async function POST(request: Request) {
  try {
    const blocked = guardDev()
    if (blocked) return blocked
    // ... rest of handler ...
  } catch (error) {
    console.error('[DEV API ERROR]', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
```

---

## Step 4.4 — Verify database tables exist (migrations applied)

The dev API writes to multiple tables. If Supabase migrations haven't been applied, the tables won't exist and all mutations fail.

### Check critical tables

```bash
# If using Supabase CLI with local dev
npx supabase db dump --schema public | grep 'CREATE TABLE'
```

Or check via the Supabase Dashboard → Table Editor. Required tables:

| Table | Used by actions |
|-------|----------------|
| `organizations` | `ensureOrganization()`, all queries |
| `org_members` | `ensureOrganization()`, `switch-role` |
| `subscriptions` | `switch-tier`, `set-subscription-status`, `seed-data` |
| `saas_vendors` | `seed-data`, `reset-data` |
| `transactions` | `seed-data`, `generate-transactions`, `reset-data` |
| `plaid_connections` | `simulate-plaid`, `seed-data` |
| `integration_connections` | `simulate-google`, `simulate-okta` |
| `user_activity` | `simulate-google`, `simulate-okta`, `seed-data` |
| `waste_reports` | `seed-data`, `get-state` |
| `notification_log` | `seed-data` |
| `gocardless_connections` | `simulate-gocardless` |

### Apply missing migrations

```bash
# If using Supabase CLI
npx supabase db push

# Or run migrations manually
npx supabase migration up
```

---

## Step 4.5 — Test each action category with curl

### Read-only action (safest — test first)

```bash
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"get-state"}' | python3 -m json.tool
```

**Expected**: JSON with `state.user`, `state.counts`, `state.subscription`, `state.environment`

### Data mutation

```bash
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"seed-data"}' | python3 -m json.tool
```

**Expected**: `{"success": true, "message": "Demo data seeded successfully"}`

### Role switch

```bash
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"switch-role","role":"admin"}' | python3 -m json.tool
```

**Expected**: `{"success": true, "role": "admin"}`

### Cron trigger

```bash
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"sync-transactions"}' | python3 -m json.tool
```

**Note**: Cron actions make a server-to-server fetch to `/api/cron/*` with `CRON_SECRET`. If `CRON_SECRET` is not set, the cron endpoint returns 401 and the dev API wraps that:

```json
{"success": false, "status": 401, "data": "Unauthorized"}
```

Verify `CRON_SECRET` is set:

```bash
grep 'CRON_SECRET' .env.local
```

---

## Step 4.6 — Verify `ensureOrganization()` behavior

This function is a safety net that creates an org if the user doesn't have one (e.g., if the `handle_new_user` Postgres trigger didn't fire).

```typescript
// src/lib/supabase/ensure-org.ts
export async function ensureOrganization(userId, email?, fullName?) {
  // 1. Check for existing membership
  const { data: membership } = await admin
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (membership) return { orgId: membership.org_id, role: membership.role }

  // 2. No membership — create org + membership
  const { data: org } = await admin
    .from('organizations')
    .insert({ name: '...' })
    .select('id')
    .single()

  await admin
    .from('org_members')
    .insert({ org_id: org.id, user_id: userId, role: 'owner' })

  return { orgId: org.id, role: 'owner' }
}
```

### Failure modes

| Error | Cause | Fix |
|-------|-------|-----|
| `relation "org_members" does not exist` | Migrations not applied | `npx supabase db push` |
| `violates row-level security policy` | Service role key incorrect (using anon key) | Fix `SUPABASE_SERVICE_ROLE_KEY` |
| `duplicate key value violates unique constraint` | Race condition — org already created | Usually self-resolving; check for duplicate calls |
| Function throws uncaught | org_members table missing or wrong schema | Verify schema matches migration files |

---

## Step 4.7 — Verify RLS policies don't block the admin client

The admin client uses the `service_role` key which **bypasses RLS** by default. But verify:

```sql
-- In Supabase SQL Editor:
-- Check if RLS is enabled on key tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

The service role key should bypass RLS regardless, but misconfigured Supabase projects can behave unexpectedly.

---

## Pass Criteria

| Check | Expected | How to verify |
|-------|----------|---------------|
| `get-state` returns 200 | JSON with state object | curl test |
| `seed-data` returns 200 | `{"success": true}` | curl test |
| `switch-role` returns 200 | `{"success": true, "role": "admin"}` | curl test |
| No 404 response | `MOCK_SERVICES=true` is set | curl status code |
| No 401 response | Token valid, service role key correct | curl status code |
| No 500 errors | No uncaught exceptions | Server terminal output |
| Tables exist in DB | All required tables present | Supabase Dashboard |

**If all curl tests pass** → The server is healthy. The problem is client-side (Phases 1-3) or visual (Phase 5).
**If 404** → Fix `MOCK_SERVICES` env var, restart server.
**If 401** → Fix token or `SUPABASE_SERVICE_ROLE_KEY`, get fresh token.
**If 500** → Read server terminal error, fix schema/migration issue.
