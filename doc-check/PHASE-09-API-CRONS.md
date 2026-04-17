# Phase 9 — API Routes & Cron Jobs

> **Objective:** Every API route returns correct HTTP responses, handles authentication and authorization, validates input, and returns meaningful error messages. All three cron jobs execute without errors, process data correctly, and are protected by CRON_SECRET. The dev tools API works in mock mode for testing.

---

## 9.1 API Route Inventory

### Complete route map (27 routes)

| Category | Route | Method | Auth | Purpose |
|----------|-------|--------|------|---------|
| **Health** | `/api/health` | GET | None | Status check |
| **Dev** | `/api/dev` | POST | Bearer token | Mock data management |
| **Cron** | `/api/cron/sync-transactions` | GET | CRON_SECRET | Daily transaction sync |
| **Cron** | `/api/cron/sync-usage` | GET | CRON_SECRET | Daily user sync |
| **Cron** | `/api/cron/generate-reports` | GET | CRON_SECRET | Weekly report generation |
| **Billing** | `/api/billing/checkout` | POST | Session | Create Stripe Checkout |
| **Billing** | `/api/billing/portal` | POST | Session | Create Billing Portal |
| **Webhook** | `/api/webhooks/stripe` | POST | Signature | Stripe event processing |
| **Plaid** | `/api/plaid/create-link-token` | POST | Session | Initialize Plaid Link |
| **Plaid** | `/api/plaid/exchange-token` | POST | Session | Complete token exchange |
| **Plaid** | `/api/plaid/disconnect` | DELETE | Session | Revoke Plaid access |
| **Plaid** | `/api/plaid/webhook` | POST | Signature | Plaid event processing |
| **GoCardless** | `/api/gocardless/institutions` | GET | Session | List banks by country |
| **GoCardless** | `/api/gocardless/create-requisition` | POST | Session | Start PSD2 flow |
| **GoCardless** | `/api/gocardless/callback` | GET | Session | Process auth callback |
| **GoCardless** | `/api/gocardless/disconnect` | DELETE | Session | Delete requisition |
| **Google** | `/api/integrations/google/connect` | POST | Session | Generate OAuth URL |
| **Google** | `/api/integrations/google/callback` | GET | Session | Process OAuth callback |
| **Google** | `/api/integrations/google/disconnect` | DELETE | Session | Revoke + delete |
| **Okta** | `/api/integrations/okta/connect` | POST | Session | Validate + store |
| **Okta** | `/api/integrations/okta/disconnect` | DELETE | Session | Delete connection |
| **Notifs** | `/api/notifications/notify-users` | POST | Session | Send Slack/email |
| **Notifs** | `/api/notifications/settings` | PATCH | Session | Update notification config |
| **Settings** | `/api/settings/profile` | PATCH | Session | Update display name |
| **Settings** | `/api/settings/organization` | PATCH | Session | Update org name |
| **Settings** | `/api/settings/leave-org` | POST | Session | Leave organization |
| **Settings** | `/api/settings/delete-account` | DELETE | Session | Delete user account |

---

## 9.2 Health Check

**File:** `src/app/api/health/route.ts`

### Specification

| Field | Value |
|-------|-------|
| Method | GET |
| Auth | None |
| Response | `{ status: "ok", timestamp: ISO string, version: string }` |

### Verification
```bash
curl -s http://localhost:3000/api/health | jq .
# Expected:
# {
#   "status": "ok",
#   "timestamp": "2026-04-17T...",
#   "version": "1.0.0"
# }
```

### Unit test
- `src/test/health.test.ts` — validates status, timestamp, version fields

---

## 9.3 Dev Tools API

**File:** `src/app/api/dev/route.ts`

### Guard
- Only available when `MOCK_SERVICES=true`
- Requires Bearer token (access token from authenticated session)

### Actions

| Action | Body | Effect |
|--------|------|--------|
| `seed-data` | `{}` | Seeds complete demo dataset |
| `reset-data` | `{}` | Clears all org data |
| `reset-table` | `{ table: string }` | Clears specific table |
| `generate-transactions` | `{ count: number }` | Creates N random transactions |
| `switch-role` | `{ role: 'owner'\|'admin'\|'member'\|'viewer' }` | Changes user's role |
| `switch-tier` | `{ tier: 'free'\|'monitor'\|'recovery' }` | Changes subscription tier |
| `simulate-plaid` | `{ status?, institutionName? }` | Creates mock Plaid connection |
| `simulate-google` | `{ totalUsers?, inactiveRatio? }` | Creates mock Google connection |
| `simulate-okta` | `{ totalUsers?, inactiveRatio? }` | Creates mock Okta connection |
| `sync-transactions` | `{}` | Runs transaction sync cron |
| `sync-usage` | `{}` | Runs usage sync cron |
| `generate-reports` | `{}` | Runs report generation cron |
| `get-state` | `{}` | Returns current org/user/subscription state |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Disabled in production | Returns 404 when MOCK_SERVICES ≠ true |
| 2 | Requires auth token | 401 without Bearer token |
| 3 | seed-data works | All tables populated |
| 4 | reset-data clears all | All tables empty for org |
| 5 | switch-role persists | org_members.role updated |
| 6 | switch-tier persists | subscriptions.tier updated |
| 7 | simulate-plaid creates connection | plaid_connections row |
| 8 | get-state returns correct data | All relevant state |

---

## 9.4 Cron Job: sync-transactions

**File:** `src/app/api/cron/sync-transactions/route.ts`  
**Schedule:** Daily at 2:00 AM UTC  
**Vercel cron:** `0 2 * * *`

### Flow
```
1. Verify CRON_SECRET bearer token
2. Create admin Supabase client (bypasses RLS)
3. For each org with active connections:
   a. Plaid connections:
      - Call syncTransactions() with cursor pagination (500/batch)
      - Filter for software transactions (MCC codes + vendor matching)
      - Upsert to transactions table
   b. GoCardless connections:
      - Fetch account transactions (booked + pending)
      - Extract merchant names from unstructured text
      - Filter for software transactions
      - Upsert to transactions table
4. Recalculate vendor aggregates:
   - Group transactions by normalized vendor name
   - Update saas_vendors: monthly_cost, seats, status, last_seen
5. Return summary: { orgsProcessed, transactionsSynced, errors }
```

### Service calls
- `plaid.syncTransactions(accessToken, cursor)` — paginated sync
- `gocardless.getAccountTransactions(accountId)` — booked + pending
- `vendorNormalizer.normalizeVendorName(rawName)` — clean merchant names
- `mccCodes.isSoftwareTransaction(mcc, merchant, category)` — filter

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | CRON_SECRET required | 401 without correct bearer token |
| 2 | Processes all orgs | Iterates orgs with active bank connections |
| 3 | Plaid sync | Fetches new transactions since last cursor |
| 4 | GoCardless sync | Fetches transactions from all accounts |
| 5 | Software filtering | Only software/SaaS transactions stored |
| 6 | Vendor normalization | "SLACK TECHNOLOGIES INC" → "slack" |
| 7 | Vendor aggregation | Monthly cost recalculated from transactions |
| 8 | Idempotent | Running twice doesn't duplicate data |
| 9 | Error handling | Failed org doesn't block other orgs |
| 10 | Logging | Summary returned with counts |

### Manual verification
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/sync-transactions | jq .
```

---

## 9.5 Cron Job: sync-usage

**File:** `src/app/api/cron/sync-usage/route.ts`  
**Schedule:** Daily at 3:00 AM UTC  
**Vercel cron:** `0 3 * * *`

### Flow
```
1. Verify CRON_SECRET bearer token
2. Create admin Supabase client
3. For each org with active identity providers:
   a. Okta connections:
      - Call listOktaUsers() with stored API token
      - Classify users: active, inactive, suspended, deprovisioned
      - Upsert to user_activity table
   b. Google Workspace connections:
      - Refresh access token if expired (using refresh_token)
      - Call listGoogleUsers() (paginated, 500 max)
      - Classify users by last_login date
      - Upsert to user_activity table
4. Update integration_connections: total_users, inactive_users, last_synced
5. Return summary: { orgsProcessed, usersSynced, errors }
```

### Service calls
- `okta.listOktaUsers()` — all users with status classification
- `google.refreshGoogleToken()` — handle expired access tokens
- `google.listGoogleUsers()` — paginated workspace users

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | CRON_SECRET required | 401 without correct bearer token |
| 2 | Processes all orgs | Iterates orgs with active identity providers |
| 3 | Okta user sync | Fetches and classifies all Okta users |
| 4 | Google token refresh | Handles expired access tokens |
| 5 | Google user sync | Fetches and classifies workspace users |
| 6 | User activity upserted | user_activity table updated |
| 7 | Connection stats updated | total_users, inactive_users, last_synced |
| 8 | Idempotent | Running twice doesn't duplicate users |
| 9 | Error handling | Failed provider doesn't block others |
| 10 | Token from vault | Retrieves API tokens via get_secret RPC |

### Manual verification
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/sync-usage | jq .
```

---

## 9.6 Cron Job: generate-reports

**File:** `src/app/api/cron/generate-reports/route.ts`  
**Schedule:** Monday at 8:00 AM UTC  
**Vercel cron:** `0 8 * * 1`

### Flow
```
1. Verify CRON_SECRET bearer token
2. Create admin Supabase client
3. For each org qualifying for report generation:
   a. Prerequisites: has bank connection + has identity provider
   b. Call generateWasteReport(adminClient, orgId)
      - Runs ghost detector + duplicate detector in parallel
      - Calculates totals, annual projections
      - Persists to waste_reports table
   c. Call sendReportNotifications(adminClient, orgId, reportId)
      - Only for Recovery tier with active subscription
      - Sends Slack (if configured + threshold met)
      - Sends email (if configured + threshold met)
      - Logs to notification_log
4. Return summary: { reportsGenerated, notificationsSent, errors }
```

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | CRON_SECRET required | 401 without correct bearer token |
| 2 | Only qualifying orgs | Has both bank + identity connections |
| 3 | Ghost detection runs | Finds inactive users per vendor |
| 4 | Duplicate detection runs | Finds overlapping categories |
| 5 | Report persisted | waste_reports row created with JSONB data |
| 6 | Notifications sent | Slack + email for Recovery tier orgs |
| 7 | Threshold check | Only notifies if waste > configured threshold |
| 8 | Notification log | Each attempt logged (sent/failed/skipped) |
| 9 | Error handling | Failed org doesn't block others |
| 10 | Idempotent | Running twice creates 2 reports (intentional for history) |

### Manual verification
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/generate-reports | jq .
```

---

## 9.7 HTTP Error Response Standards

### All API routes should follow consistent error patterns

| Status | When | Response body |
|--------|------|---------------|
| 200 | Success | `{ data: ... }` or `{ url: ... }` |
| 400 | Invalid input | `{ error: "Description of what's wrong" }` |
| 401 | No auth / bad token | `{ error: "Unauthorized" }` |
| 403 | Insufficient role/tier | `{ error: "Insufficient permissions" }` |
| 404 | Resource not found | `{ error: "Not found" }` |
| 405 | Wrong HTTP method | `{ error: "Method not allowed" }` |
| 500 | Server error | `{ error: "Internal server error" }` |

### Verification matrix

| Route category | 401 test | 403 test | 400 test | 200 test |
|---------------|----------|----------|----------|----------|
| Cron jobs | No CRON_SECRET | — | — | With CRON_SECRET |
| Billing | No session | Viewer role | Missing price_id | Owner + price_id |
| Settings | No session | Member editing org | Empty name | Owner + name |
| Notifications | No session | Non-recovery tier | Invalid webhook URL | Recovery + valid |
| Connections | No session | Viewer connecting | Missing fields | Owner + valid data |
| Webhooks | Bad signature | — | Malformed body | Valid signature + event |

---

## 9.8 Security Verification

### Per-route security checks

| Check | Routes affected | What to verify |
|-------|----------------|----------------|
| Session auth | All except health, webhooks, crons | `getUser()` returns valid user |
| CRON_SECRET | 3 cron routes | `Authorization: Bearer $CRON_SECRET` |
| Webhook signature | Stripe, Plaid | Cryptographic signature verification |
| CSRF state | Google OAuth callback | State cookie matches callback param |
| Role check | Billing, settings, connections | User has required role in org |
| Tier check | Notifications | Org has required subscription tier |
| Input validation | All POST/PATCH | Body parsed, required fields checked |
| RLS | All DB queries | Queries scoped to user's org |
| Vault access | Token retrieval | Secrets via `get_secret` RPC only |

### Test commands
```bash
# No auth → 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3000/api/billing/checkout
# Expected: 401

# Bad CRON_SECRET → 401
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer wrong" \
  http://localhost:3000/api/cron/sync-transactions
# Expected: 401

# Valid CRON_SECRET → 200
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/sync-transactions
# Expected: 200
```

---

## 9.9 Vercel Cron Configuration

**File:** `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/sync-transactions", "schedule": "0 2 * * *" },
    { "path": "/api/cron/sync-usage",        "schedule": "0 3 * * *" },
    { "path": "/api/cron/generate-reports",   "schedule": "0 8 * * 1" }
  ]
}
```

### Schedule verification

| Cron | Schedule | Human readable |
|------|----------|---------------|
| sync-transactions | `0 2 * * *` | Daily at 2:00 AM UTC |
| sync-usage | `0 3 * * *` | Daily at 3:00 AM UTC |
| generate-reports | `0 8 * * 1` | Monday at 8:00 AM UTC |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | All 3 paths exist as routes | Files in `src/app/api/cron/` |
| 2 | Schedules are correct | Match vercel.json |
| 3 | Order makes sense | Transactions → usage → reports (data dependency) |
| 4 | No overlap | 1-hour gap between each |

---

## Exit Criteria

| Criteria | Status |
|----------|--------|
| `/api/health` returns 200 with status/timestamp/version | ☐ |
| Dev tools API works with all actions | ☐ |
| sync-transactions: processes Plaid + GoCardless | ☐ |
| sync-usage: processes Okta + Google (with token refresh) | ☐ |
| generate-reports: creates report + sends notifications | ☐ |
| All cron routes reject requests without CRON_SECRET | ☐ |
| All session-auth routes reject unauthenticated requests | ☐ |
| All routes return consistent error format | ☐ |
| Webhook signature verification works (Stripe + Plaid) | ☐ |
| CSRF state validation works (Google OAuth) | ☐ |
| Role gates enforced on billing/settings/connections | ☐ |
| Tier gates enforced on notifications | ☐ |

---

## Dependencies
- **Requires:** Phase 0 (build), Phase 1 (auth)
- **Depends on:** Phases 4-8 (routes serve these pages)
- **Blocks:** Phase 10 (E2E tests call these routes)
