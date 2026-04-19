# Phase 6 — Database Mutations & Cache Invalidation

## Objective

Confirm that dev tools actions actually write data to Supabase and that the Next.js cache invalidation mechanism propagates those changes to the UI. This is the final layer — if all previous phases pass but "nothing happens," the mutations aren't reaching the database or the cache isn't being busted.

---

## Architecture Overview

```
POST /api/dev  { action: 'seed-data' }
  │
  ├── 1. Admin client executes INSERT/UPSERT/DELETE
  │     └── Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
  │
  ├── 2. Returns NextResponse.json({ success: true, message: '...' })
  │
  └── 3. revalidatePath('/', 'layout')   ← tells Next.js to re-render all layouts
          │
          ▼
      Next.js marks all server components as stale
          │
          ▼
      Client calls router.refresh()      ← triggers re-fetch of stale components
          │
          ▼
      Server components re-run, query fresh data from Supabase
          │
          ▼
      Dashboard UI updates with new data
```

---

## Step 6.1 — Verify data lands in the database

After clicking "Seed Full Demo Data" in the dev panel (or running the curl from Phase 4), check the database directly. This bypasses all caching and rendering — pure database verification.

### Option A: Supabase Dashboard

1. Go to your Supabase project dashboard (URL in `NEXT_PUBLIC_SUPABASE_URL`)
2. Click **Table Editor** in the sidebar
3. Check these tables and expected row counts:

| Table | Expected after seed | Key columns to check |
|-------|-------------------|---------------------|
| `saas_vendors` | 10 rows | name, monthly_cost, category |
| `transactions` | 15+ rows | vendor_name, amount, is_software |
| `plaid_connections` | 1 row | institution_name = "Chase Bank", status = "active" |
| `integration_connections` | 2 rows | provider: "okta" + "google_workspace" |
| `user_activity` | 15 rows | email, status (active/inactive), provider |
| `subscriptions` | 1 row | tier = "recovery", status = "active" |
| `waste_reports` | 1 row | monthly_waste, ghost_seats, duplicate_tools |
| `org_members` | 1 row | role = "owner" |

### Option B: Supabase SQL Editor

```sql
-- Run in Supabase Dashboard → SQL Editor
-- Replace 'YOUR_ORG_ID' with the actual org ID from get-state response

-- Quick count check
SELECT 
  (SELECT count(*) FROM saas_vendors WHERE org_id = 'YOUR_ORG_ID') as vendors,
  (SELECT count(*) FROM transactions WHERE org_id = 'YOUR_ORG_ID') as transactions,
  (SELECT count(*) FROM plaid_connections WHERE org_id = 'YOUR_ORG_ID') as plaid,
  (SELECT count(*) FROM integration_connections WHERE org_id = 'YOUR_ORG_ID') as integrations,
  (SELECT count(*) FROM user_activity WHERE org_id = 'YOUR_ORG_ID') as users,
  (SELECT count(*) FROM subscriptions WHERE org_id = 'YOUR_ORG_ID') as subscriptions,
  (SELECT count(*) FROM waste_reports WHERE org_id = 'YOUR_ORG_ID') as reports;
```

### Option C: Use the dev API itself

```bash
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"get-state"}' | python3 -m json.tool
```

Check the `counts` object in the response:

```json
{
  "state": {
    "counts": {
      "vendors": 10,
      "transactions": 15,
      "plaidConnections": 1,
      "integrationConnections": 2,
      "userActivity": 15,
      "wasteReports": 1
    }
  }
}
```

If counts are 0 after seeding, the mutation failed silently.

---

## Step 6.2 — Verify database writes aren't silently failing

Supabase client operations return `{ data, error }` but the code might not check the error. Inspect the seed function:

### Check for unchecked Supabase errors

The API route uses a `check()` helper function or the raw Supabase client. Common pattern:

```typescript
// If errors aren't checked:
await admin.from('saas_vendors').insert(vendors)
// This can fail silently — .insert() returns {data, error} but nobody reads error

// Correct pattern:
const { error } = await admin.from('saas_vendors').insert(vendors)
if (error) throw new Error(`Insert failed: ${error.message}`)
```

### Add temporary error logging

If you suspect silent failures, instrument the seed function:

```typescript
// src/app/api/dev/route.ts — inside seedDemoData()
const { error: vendorErr } = await admin.from('saas_vendors').insert(vendors).eq('org_id', orgId)
if (vendorErr) console.error('[SEED] vendors failed:', vendorErr)

const { error: txnErr } = await admin.from('transactions').insert(transactions)
if (txnErr) console.error('[SEED] transactions failed:', txnErr)
```

### Common database write failures

| Error | Cause | Fix |
|-------|-------|-----|
| `violates foreign key constraint` | org_id doesn't exist in organizations table | Ensure org was created first |
| `violates unique constraint` | Duplicate seed data (already seeded) | Reset data first, then seed |
| `null value in column "org_id"` | org_id not passed to insert | Bug in seed function |
| `permission denied for table` | Service role key wrong or RLS misconfigured | Verify `SUPABASE_SERVICE_ROLE_KEY` |
| `relation "xxx" does not exist` | Table missing (migration not applied) | Run `npx supabase db push` |

---

## Step 6.3 — Verify `revalidatePath()` works in Next.js 16

After every mutation, the API calls:

```typescript
revalidatePath('/', 'layout')
```

This tells Next.js to invalidate the cached output of all layouts, forcing server components to re-run on the next request.

### Check Next.js 16 documentation

```bash
# Check for migration notes
find node_modules/next/dist/docs -name '*.md' 2>/dev/null | head -20
```

Look for any changes to `revalidatePath`:
- Was the second argument (`'layout'` vs `'page'`) changed?
- Was it deprecated in favor of `revalidateTag()`?
- Does it require `export const dynamic = 'force-dynamic'`?

### Test `revalidatePath` in isolation

Create a minimal test:

```bash
# Request 1: Get current state (caches server components)
curl -s http://localhost:3000/ -o /dev/null -w "Status: %{http_code}\n"

# Request 2: Seed data via dev API (triggers revalidatePath)
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"seed-data"}'

# Request 3: Fetch page again — should show new data
curl -s http://localhost:3000/ -o /dev/null -w "Status: %{http_code}\n"
```

### Alternative: Use `revalidateTag` instead

If `revalidatePath` is broken in Next.js 16, the alternative is tag-based revalidation:

```typescript
// In server components that fetch data, add tags:
const data = await fetch('...', { next: { tags: ['org-data'] } })

// In the API route, revalidate by tag:
import { revalidateTag } from 'next/cache'
revalidateTag('org-data')
```

This is more granular than `revalidatePath('/', 'layout')` which is a broad invalidation.

---

## Step 6.4 — Verify `router.refresh()` triggers on the client

After `revalidatePath()` on the server, the client calls:

```typescript
// use-dev-action.ts — line 40
if (!READ_ACTIONS.has(payload.action)) {
  router.refresh()
}
```

### How `router.refresh()` works

1. Client sends a React Server Component payload request to the server
2. Server re-renders all server components in the current route tree
3. Client applies the new RSC payload to the DOM (like a React update)
4. No full page reload — client state is preserved

### Verify the RSC payload fires

1. Open Network tab
2. Click "Seed Full Demo Data" in the dev panel
3. After the `POST /api/dev` response arrives, look for a second request:
   - URL: the current page path (e.g., `/` or `/dashboard`)
   - Method: `GET` (or a custom RSC request)
   - Headers: should include `RSC: 1` or `Next-Router-State-Tree` headers
   - This is the `router.refresh()` call

### If the RSC request fires but the UI doesn't update

Possible causes:
- Server components are querying stale data (caching layer between Supabase and Next.js)
- The dashboard page uses `export const revalidate = 3600` (static caching, ignores revalidatePath)
- The Supabase server client caches its own results

### Check for static caching on dashboard pages

```bash
grep -r 'revalidate\s*=' src/app/ --include='*.tsx' --include='*.ts'
grep -r 'force-static\|force-dynamic' src/app/ --include='*.tsx' --include='*.ts'
```

If any dashboard page has `export const revalidate = NUMBER`, it won't update until that time expires — regardless of `revalidatePath()`.

---

## Step 6.5 — Verify the reset function works

"Delete All Data" is the nuclear option. Test it:

```bash
# 1. Seed data
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"seed-data"}'

# 2. Verify data exists
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"get-state"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Vendors:', d['state']['counts'].get('vendors', 'N/A'))"

# 3. Reset data
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"reset-data"}'

# 4. Verify data is gone
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"get-state"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Vendors:', d['state']['counts'].get('vendors', 'N/A'))"
```

**Expected**: Step 2 shows `Vendors: 10`, Step 4 shows `Vendors: 0`.

### Reset function — dependency order

The reset deletes tables in a specific order to avoid foreign key violations:

```
1. notification_log  (no dependencies)
2. waste_reports     (no dependencies)
3. user_activity     (no dependencies)
4. integration_connections
5. plaid_connections
6. gocardless_connections
7. transactions
8. saas_vendors
9. subscriptions → reset to free tier
```

If deletion fails partway, some tables may have data and others may not.

---

## Step 6.6 — Verify the `DevInspectTab` (State tab) reflects changes

The State tab shows live data by calling `get-state`. After seeding data:

1. Open the dev panel → **State** tab
2. Click the refresh button (if present) or switch away and back to the tab
3. The counts should match what was seeded

### Expected State tab values after seed

```
User: { userId: '...', orgId: '...', role: 'owner' }
Subscription: { tier: 'recovery', status: 'active' }
Counts: {
  vendors: 10,
  transactions: 15+,
  plaidConnections: 1,
  integrationConnections: 2,
  userActivity: 15
}
Latest Report: {
  monthlyWaste: 3845,
  ghostSeats: 5,
  duplicateTools: 2
}
```

If counts show 0 but the database has data, the `get-state` query is scoped to the wrong `org_id`.

---

## Step 6.7 — Verify the `DevAuthTab` state update cycle

The Auth tab does a full round-trip:

1. **Mount**: Calls `get-state` → reads `role` and `tier` → sets local state
2. **Click role button**: Calls `switch-role` → updates DB → success toast → local state updated
3. **Click tier button**: Calls `switch-tier` → upserts subscription → success toast → local state updated

### Test the cycle

1. Open dev panel → Auth tab
2. Current role should be highlighted (e.g., "owner")
3. Click "admin" — button should activate, toast should fire
4. Close and reopen the panel — Auth tab should still show "admin" (it re-fetches on mount)
5. Verify via API:

```bash
curl -s -X POST http://localhost:3000/api/dev \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"action":"get-state"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Role:', d['state']['user']['role'])"
```

### Critical: Role change requires page refresh for permission effects

The Auth tab shows a note:

> Controls access to connections, settings, danger zone. **Refresh page to see changes.**

Role changes update the database but the dashboard layout caches the role from the initial server render. `router.refresh()` should re-run the layout and pick up the new role, but verify this actually happens.

---

## Step 6.8 — End-to-end smoke test sequence

Run this complete sequence to verify the entire pipeline:

```bash
TOKEN="<your-jwt-token>"
API="http://localhost:3000/api/dev"
HEADERS=(-H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN")

echo "=== 1. Reset ==="
curl -s -X POST $API "${HEADERS[@]}" -d '{"action":"reset-data"}' | python3 -m json.tool

echo "=== 2. Verify empty ==="
curl -s -X POST $API "${HEADERS[@]}" -d '{"action":"get-state"}' | python3 -c "
import sys,json; d=json.load(sys.stdin)['state']
print('Vendors:', d['counts'].get('vendors', 0))
print('Tier:', d.get('subscription', {}).get('tier', 'none'))
"

echo "=== 3. Seed ==="
curl -s -X POST $API "${HEADERS[@]}" -d '{"action":"seed-data"}' | python3 -m json.tool

echo "=== 4. Verify seeded ==="
curl -s -X POST $API "${HEADERS[@]}" -d '{"action":"get-state"}' | python3 -c "
import sys,json; d=json.load(sys.stdin)['state']
print('Vendors:', d['counts'].get('vendors', 0))
print('Tier:', d.get('subscription', {}).get('tier', 'none'))
print('Report waste:', d.get('latestReport', {}).get('monthly_waste', 'none'))
"

echo "=== 5. Switch role ==="
curl -s -X POST $API "${HEADERS[@]}" -d '{"action":"switch-role","role":"viewer"}' | python3 -m json.tool

echo "=== 6. Verify role ==="
curl -s -X POST $API "${HEADERS[@]}" -d '{"action":"get-state"}' | python3 -c "
import sys,json; d=json.load(sys.stdin)['state']
print('Role:', d['user']['role'])
"

echo "=== 7. Switch tier ==="
curl -s -X POST $API "${HEADERS[@]}" -d '{"action":"switch-tier","tier":"free"}' | python3 -m json.tool

echo "=== 8. Verify tier ==="
curl -s -X POST $API "${HEADERS[@]}" -d '{"action":"get-state"}' | python3 -c "
import sys,json; d=json.load(sys.stdin)['state']
print('Tier:', d.get('subscription', {}).get('tier', 'none'))
"

echo "=== 9. Restore owner role ==="
curl -s -X POST $API "${HEADERS[@]}" -d '{"action":"switch-role","role":"owner"}' | python3 -m json.tool

echo "=== DONE ==="
```

### Expected output

```
=== 1. Reset ===
{ "success": true, "message": "All data reset" }
=== 2. Verify empty ===
Vendors: 0
Tier: free
=== 3. Seed ===
{ "success": true, "message": "Demo data seeded successfully" }
=== 4. Verify seeded ===
Vendors: 10
Tier: recovery
Report waste: 3845
=== 5. Switch role ===
{ "success": true, "role": "viewer" }
=== 6. Verify role ===
Role: viewer
=== 7. Switch tier ===
{ "success": true, "tier": "free" }
=== 8. Verify tier ===
Tier: free
=== 9. Restore owner role ===
{ "success": true, "role": "owner" }
=== DONE ===
```

If this entire sequence passes, the server and database are fully functional. The "nothing happens" issue is 100% a **visual/feedback problem** (Phase 5 — toast z-index + panel occlusion).

---

## Pass Criteria

| Check | Expected | How to verify |
|-------|----------|---------------|
| Seed inserts rows | Table counts > 0 after seed | SQL query or get-state |
| Reset clears rows | Table counts = 0 after reset | SQL query or get-state |
| Role switch persists | get-state shows new role | API call |
| Tier switch persists | get-state shows new tier | API call |
| Cache invalidation works | Dashboard shows updated data after action | Visual + Network tab RSC request |
| No silent DB errors | Server terminal clean | Terminal output |
| End-to-end smoke passes | All 9 steps return expected output | Smoke test script |

**If smoke test passes** → The backend works. Fix the toast z-index (Phase 5) and the issue is resolved.
**If mutations fail** → Check DB errors, migration state, service role key.
**If cache doesn't invalidate** → Check Next.js 16 revalidatePath behavior, check for static caching on pages.
