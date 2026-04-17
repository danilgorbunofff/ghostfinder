# Phase 0 — Infrastructure & Build Health

> **Objective:** Establish a verified green baseline. The app compiles, lints cleanly, unit tests pass, database schema is valid, and the CI verification script reports zero failures. No feature work begins until this phase is fully green.

---

## 0.1 TypeScript Build

| Step | Command | Expected Result |
|------|---------|-----------------|
| Run production build | `npm run build` | Exit code 0, no TS errors |
| Inspect output | Check `.next/` directory created | Pages pre-rendered, API routes compiled |

### What to fix if it fails
- Type errors in server/client components (missing imports, wrong generics)
- Missing environment variable types (add to `env.d.ts` or `next-env.d.ts`)
- Circular dependency between `src/lib/` modules

### Files to inspect
```
next.config.ts          — currently empty placeholder; add config only if build needs it
tsconfig.json           — strict mode, path aliases (@/* → ./src/*)
src/proxy.ts            — Next.js 16 proxy convention (NOT middleware.ts)
```

---

## 0.2 Linting

| Step | Command | Expected Result |
|------|---------|-----------------|
| Run ESLint | `npm run lint` | Exit code 0, no errors |

### Configuration
- `eslint.config.mjs` — Next.js vitals + TypeScript configs
- Ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`

### Common fixes
- Unused imports → remove or prefix with `_`
- Missing `key` props in `.map()` renders
- `any` types in route handlers → add explicit types

---

## 0.3 Unit Tests (Vitest)

| Step | Command | Expected Result |
|------|---------|-----------------|
| Run Vitest | `npm run test` | All suites pass |

### Test inventory
| File | Tests | What it covers |
|------|-------|----------------|
| `src/test/health.test.ts` | 1 | `/api/health` returns `{ status: "ok", timestamp, version }` |
| `src/test/verification.test.ts` | ~10 | Vendor normalizer, MCC codes, feature gating (`hasAccess`, `getRequiredTier`) |

### Configuration
```
vitest.config.ts    — jsdom environment, setup file, @ alias
src/test/setup.ts   — imports @testing-library/jest-dom/vitest
```

### What to fix if it fails
- Mock missing Supabase client in health route test
- Vendor normalizer test: ensure known SaaS list matches `src/lib/utils/mcc-codes.ts`
- Feature gating test: verify tier levels (free=0, monitor=1, recovery=2)

---

## 0.4 Proxy / Middleware Verification

The app uses the **Next.js 16 `proxy` convention** (`src/proxy.ts`), NOT the deprecated `middleware.ts`.

| Check | File | What to verify |
|-------|------|----------------|
| Proxy exports `proxy` function | `src/proxy.ts` | Calls `updateSession(request)` |
| Session update logic | `src/lib/supabase/middleware.ts` | Uses `getUser()` (JWT validation), NOT `getSession()` |
| Matcher excludes static assets | `src/proxy.ts` | Pattern: `/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)` |
| Public routes bypass auth | `src/lib/supabase/middleware.ts` | `/login`, `/signup`, `/callback`, `/api/*` excluded from redirect |

### Verification
```bash
# With dev server running:
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login      # → 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/            # → 302 (redirect to /login)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health  # → 200
```

---

## 0.5 Next.js Configuration

| File | Current State | Action |
|------|---------------|--------|
| `next.config.ts` | Empty placeholder (`{}`) | Add config ONLY if a feature requires it (image domains, redirects, etc.) |
| `vercel.json` | Cron jobs + security headers defined | Verify all 3 cron paths exist as API routes |

### Security headers (from `vercel.json`)
- [x] `X-Frame-Options: DENY`
- [x] `X-Content-Type-Options: nosniff`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [x] `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [x] `X-DNS-Prefetch-Control: on`

---

## 0.6 Database & Seed Data

| Step | Command | Expected Result |
|------|---------|-----------------|
| Start Supabase | `npx supabase start` | All services healthy |
| Verify schema | Run `scripts/verify-db.sql` via psql | 11 tables exist, RLS enabled, 24 indexes, vault functions present |
| Verify seed | `npx supabase db reset` | Seed data loads: dev user, org, 10 vendors, 17 transactions, waste report |

### Tables expected (11)
```
integration_connections    org_members          plaid_connections
notification_log          notification_settings  organizations
saas_vendors              subscriptions         transactions
user_activity             waste_reports
```

### Migrations (8 files)
```
00001_initial_schema.sql      — core tables (orgs, members, vendors)
00002_enable_rls.sql          — RLS policies on all tables
00003_financial_tables.sql    — plaid_connections, transactions
00004_usage_tables.sql        — integration_connections, user_activity
00005_waste_reports.sql       — waste_reports table
00006_subscriptions.sql       — subscriptions + billing
00007_gocardless_tables.sql   — gocardless_connections
00008_vault_functions.sql     — store_secret, get_secret, get_plaid_token
```

### Seed data summary (`supabase/seed.sql`)
- Dev user: `dev@ghostfinder.local` / `Dev1234!`
- Organization: auto-created, Recovery tier subscription
- 10 SaaS vendors (Slack, Notion, Figma, GitHub, Zoom, Jira, Salesforce, HubSpot, Asana, Dropbox)
- 17 transactions (10 Plaid + 5 GoCardless + 2 misc)
- 2 identity providers (Okta: 47 users, Google: 38 users)
- 15 user activity records (mixed active/inactive)
- 1 pre-generated waste report

---

## 0.7 Full Verification Script

| Step | Command | Expected Result |
|------|---------|-----------------|
| Run script | `bash scripts/verify-all.sh` | 0 FAIL, 0 WARN |

### What the script checks
1. **Build & static analysis** — tsc, eslint, vitest, next build
2. **Route inventory** — 15 API routes + 7 pages exist
3. **Service modules** — 5 expected (plaid, stripe, okta, google, notification)
4. **Database migrations** — 8 migration files present
5. **Security audit** (10 checks):
   - Security headers in `vercel.json`
   - No secrets in client components
   - No secrets via `NEXT_PUBLIC_`
   - Middleware uses `getUser()` not `getSession()`
   - All cron routes protected with `CRON_SECRET`
   - Vault functions have `SET search_path` + `REVOKE`
   - Stripe webhook has signature verification
   - Google OAuth has CSRF state
   - Okta URL validation present
   - `.env` files git-ignored

---

## 0.8 Environment Variables Checklist

| Variable | Required For | Secret? |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase calls | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-side client | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin operations, crons | **Yes** |
| `NEXT_PUBLIC_APP_URL` | OAuth callbacks, redirects | No |
| `PLAID_CLIENT_ID` | Plaid API | **Yes** |
| `PLAID_SECRET` | Plaid API | **Yes** |
| `PLAID_ENV` | sandbox/production toggle | No |
| `GOCARDLESS_SECRET_ID` | GoCardless API | **Yes** |
| `GOCARDLESS_SECRET_KEY` | GoCardless API | **Yes** |
| `GOOGLE_CLIENT_ID` | Google OAuth | **Yes** |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | **Yes** |
| `STRIPE_SECRET_KEY` | Stripe API | **Yes** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js | No |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verify | **Yes** |
| `NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID` | Checkout session | No |
| `NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID` | Checkout session | No |
| `RESEND_API_KEY` | Email notifications | **Yes** |
| `CRON_SECRET` | Cron job auth | **Yes** |
| `MOCK_SERVICES` | Dev/test mock mode | No |

---

## Exit Criteria

| Criteria | Status |
|----------|--------|
| `npm run build` exits 0 | ☐ |
| `npm run lint` exits 0 | ☐ |
| `npm run test` all green | ☐ |
| `npx supabase db reset` succeeds | ☐ |
| `scripts/verify-all.sh` — 0 FAIL | ☐ |
| Dev server starts on port 3000 | ☐ |
| `/api/health` returns `{ status: "ok" }` | ☐ |

---

## Dependencies
- **None** — this is the first phase
- **Blocks:** All subsequent phases (1–10) depend on a green Phase 0
