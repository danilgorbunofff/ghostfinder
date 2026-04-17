# Phase 10 — E2E Test Suite & Cross-Browser Validation

> **Objective:** The full Playwright E2E test suite passes across all configured browser projects — Chromium, Firefox, WebKit, and Mobile Chrome. Test infrastructure (global setup/teardown, fixtures, helpers) is solid and reliable. Every spec file runs green. Test data is properly seeded and cleaned up. The smoke test validates production readiness.

---

## 10.1 Test Infrastructure Overview

### Architecture
```
e2e/
├── global.setup.ts          — Creates test user, authenticates, saves cookies
├── global.teardown.ts       — Cleans up all test data
├── fixtures/
│   ├── auth.fixture.ts      — Token extraction from browser storage
│   └── dev-tools.fixture.ts — Mock data management API wrapper
├── helpers/
│   ├── assertions.ts        — Reusable assertion functions
│   └── selectors.ts         — Centralized data-testid constants (~100 IDs)
└── specs/
    ├── auth/           (3 specs)
    ├── billing/        (1 spec)
    ├── connections/    (5 specs)
    ├── dashboard/      (2 specs)
    ├── inventory/      (3 specs)
    ├── reports/        (2 specs)
    ├── settings/       (4 specs)
    └── smoke/          (1 spec)
```

**Total: 21 spec files**

---

## 10.2 Global Setup

**File:** `e2e/global.setup.ts`

### Flow
```
1. Create test user via Supabase Admin API:
   - Email: e2e-owner@ghostfinder.test
   - Password: TestPassword123!
   - If exists: update password
   - If not exists: create new user

2. Ensure org + membership:
   - Create organization if missing
   - Create org_member with 'owner' role if missing

3. Authenticate via browser:
   - Open /login page
   - Call supabase.auth.signInWithPassword() in browser context
   - Wait for redirect to /
   - Save browser state (cookies + localStorage)

4. Persist auth state:
   - Save to e2e/.auth/owner.json
   - All browser projects use this as storageState
```

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | User created | e2e-owner@ghostfinder.test exists in auth.users |
| 2 | Org exists | Organization created for test user |
| 3 | Membership exists | owner role in org_members |
| 4 | Auth state saved | `e2e/.auth/owner.json` contains valid cookies |
| 5 | Idempotent | Running setup twice doesn't fail |
| 6 | Handles existing user | Updates password if user already exists |

---

## 10.3 Global Teardown

**File:** `e2e/global.teardown.ts`

### Cleanup order (respects FK constraints)
```
1. Find E2E test user by email
2. Find their organization
3. Delete in dependency order:
   a. waste_reports
   b. notification_log
   c. notification_settings
   d. user_activity
   e. transactions
   f. saas_vendors
   g. integration_connections
   h. gocardless_connections
   i. plaid_connections
   j. subscriptions
   k. org_members
   l. organizations
4. Delete auth user via admin API
```

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | All data tables cleaned | 9 data tables emptied |
| 2 | Relationship tables cleaned | org_members, organizations deleted |
| 3 | Auth user deleted | Removed from auth.users |
| 4 | FK constraints respected | Delete order prevents constraint violations |
| 5 | Handles missing data | No error if already clean |
| 6 | No orphaned data | Nothing left after teardown |

---

## 10.4 Auth Fixture

**File:** `e2e/fixtures/auth.fixture.ts`

### Exports
- `test` — Extended Playwright test with auth context
- `getAccessToken()` — Extracts Supabase JWT from browser localStorage

### Token extraction logic
```typescript
// Searches localStorage for keys matching 'sb-*-auth-token'
// Parses JSON value, extracts 'access_token' field
// Returns JWT string or throws if not found
```

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Token extracted | Valid JWT from localStorage |
| 2 | Throws on missing | Error message: "Authentication failed" |
| 3 | Handles multiple keys | Picks first matching sb-*-auth-token |

---

## 10.5 Dev Tools Fixture

**File:** `e2e/fixtures/dev-tools.fixture.ts`

### Extends auth fixture with `devApi` object

| Method | API call | Purpose |
|--------|----------|---------|
| `seedDemoData()` | POST /api/dev `{ action: 'seed-data' }` | Full demo dataset |
| `resetData()` | POST /api/dev `{ action: 'reset-data' }` | Clear all org data |
| `resetTable(table)` | POST /api/dev `{ action: 'reset-table', table }` | Clear one table |
| `generateTransactions(count)` | POST /api/dev `{ action: 'generate-transactions', count }` | Random transactions |
| `switchRole(role)` | POST /api/dev `{ action: 'switch-role', role }` | Change user role |
| `switchTier(tier)` | POST /api/dev `{ action: 'switch-tier', tier }` | Change subscription |
| `simulatePlaid(opts)` | POST /api/dev `{ action: 'simulate-plaid', ...opts }` | Mock Plaid connection |
| `simulateGoogle(opts)` | POST /api/dev `{ action: 'simulate-google', ...opts }` | Mock Google connection |
| `simulateOkta(opts)` | POST /api/dev `{ action: 'simulate-okta', ...opts }` | Mock Okta connection |
| `runCron(job)` | POST /api/dev `{ action: job }` | Execute cron job |
| `getState()` | POST /api/dev `{ action: 'get-state' }` | Current org state |

### Requirements
- `MOCK_SERVICES=true` environment variable
- Bearer token from authenticated session

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | All methods work | No 500 errors |
| 2 | seedDemoData populates | Vendors, transactions, connections visible |
| 3 | resetData clears | All tables empty |
| 4 | switchRole changes UI | Viewer sees restricted view |
| 5 | switchTier changes gates | Free tier blocks reports |
| 6 | simulatePlaid creates card | Plaid connection visible |
| 7 | getState returns data | Correct org/user/subscription info |

---

## 10.6 Assertion Helpers

**File:** `e2e/helpers/assertions.ts`

| Function | Usage |
|----------|-------|
| `expectToastMessage(page, text)` | Waits for `[data-sonner-toast]` with text |
| `expectPageHeading(page, heading)` | Expects heading role with name |
| `expectEmptyState(page, testId)` | Expects element visible by testid |
| `collectConsoleErrors(page)` | Collects console.error messages |
| `expectVisible(page, testId)` | Element visible by testid |
| `expectHidden(page, testId)` | Element NOT visible by testid |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Toast assertion works | Finds Sonner toast elements |
| 2 | Console error collector | Catches JS runtime errors |
| 3 | Visibility assertions | Correct visible/hidden detection |

---

## 10.7 Test ID Registry

**File:** `e2e/helpers/selectors.ts`

### Coverage by section

| Section | ID count | Example IDs |
|---------|----------|-------------|
| `nav.*` | ~15 | sidebar-nav, nav-dashboard, nav-inventory, ... |
| `header.*` | 2 | page-header, header-user-email |
| `dashboard.*` | ~11 | stat-waste, stat-spend, getting-started, ... |
| `connections.*` | ~8 | plaid-connect-button, okta-connect-submit, ... |
| `inventory.*` | ~11 | vendor-table, vendor-grid, vendor-search, ... |
| `reports.*` | ~6 | waste-summary, ghost-seats, notify-button, ... |
| `billing.*` | ~8 | tier-free, tier-monitor, billing-toggle, ... |
| `settings.*` | ~14 | tab-profile, display-name, team-list, ... |
| `auth.*` | ~5 | login-email, login-submit, signup-email, ... |
| **Total** | **~80-100** | — |

### Validation task
For each test ID in `selectors.ts`, verify the corresponding `data-testid` attribute exists in the component source code. Missing IDs = failing tests.

```bash
# Quick check: find all data-testid in source
grep -roh 'data-testid="[^"]*"' src/ | sort -u | wc -l

# Compare with selectors.ts count
grep -c "'" e2e/helpers/selectors.ts
```

---

## 10.8 Spec File Inventory

### Auth specs

| File | Tests | Key assertions |
|------|-------|----------------|
| `login.spec.ts` | ~5 | Form render, invalid creds, success redirect, OAuth, auth redirect |
| `signup.spec.ts` | ~4 | Form render, email confirm, weak password, OAuth |
| `rbac-matrix.spec.ts` | ~6 | 4 roles × permission checks |

### Dashboard specs

| File | Tests | Key assertions |
|------|-------|----------------|
| `home.spec.ts` | ~8 | Empty state, seeded state, checklist, stats, charts |
| `navigation.spec.ts` | ~6 | Nav links, active state, org name, mobile toggle |

### Inventory specs

| File | Tests | Key assertions |
|------|-------|----------------|
| `table-grid.spec.ts` | ~7 | Default table, rows, grid toggle, persistence, drawer, sort |
| `filters.spec.ts` | ~5 | Search, status, cost range, combined, empty state |
| `export.spec.ts` | ~3 | Button, CSV download, filtered export |

### Connections specs

| File | Tests | Key assertions |
|------|-------|----------------|
| `overview.spec.ts` | ~3 | Stats, onboarding progress, multi-connection |
| `plaid.spec.ts` | ~3 | Empty state, Link initiation, card |
| `gocardless.spec.ts` | ~3 | Country selector, institutions, card |
| `okta.spec.ts` | ~3 | Form, validation, card |
| `google.spec.ts` | ~3 | OAuth initiation, callback, card |

### Reports specs

| File | Tests | Key assertions |
|------|-------|----------------|
| `ghost-seats.spec.ts` | ~5 | Cards, severity, user list, expand |
| `duplicates.spec.ts` | ~4 | Categories, comparison, savings |

### Billing specs

| File | Tests | Key assertions |
|------|-------|----------------|
| `tiers.spec.ts` | ~7 | 3 tiers, toggle, upgrade, manage, past-due, FAQ |

### Settings specs

| File | Tests | Key assertions |
|------|-------|----------------|
| `profile.spec.ts` | ~3 | Name edit, email read-only, save |
| `organization.spec.ts` | ~4 | Org name, team list, roles, permission gate |
| `notifications.spec.ts` | ~4 | Tier gate, Slack, email, threshold |
| `danger-zone.spec.ts` | ~4 | Tab visibility, type-to-confirm, delete |

### Smoke specs

| File | Tests | Key assertions |
|------|-------|----------------|
| `health.spec.ts` | ~2 | API health endpoint, page loads |

---

## 10.9 Playwright Configuration

**File:** `playwright.config.ts`

### Projects

| Project | Browser | Dependencies | Storage state |
|---------|---------|-------------|---------------|
| `setup` | — | None | Creates auth state |
| `chromium` | Chromium | setup | `e2e/.auth/owner.json` |
| `firefox` | Firefox | setup | `e2e/.auth/owner.json` |
| `webkit` | WebKit | setup | `e2e/.auth/owner.json` |
| `mobile-chrome` | Mobile Chrome | setup | `e2e/.auth/owner.json` |
| `teardown` | — | chromium, firefox, webkit, mobile-chrome | — |

### Configuration

| Setting | Local | CI |
|---------|-------|-----|
| Workers | Auto (parallel) | 1 |
| Retries | 0 | 2 |
| Timeout | 30s | 30s |
| Expect timeout | 10s | 10s |
| Screenshots | On failure | On failure |
| Video | On failure | On failure |
| Trace | On first retry | On first retry |
| Reporter | HTML | Blob + GitHub |

### Environment
```
MOCK_SERVICES=true  — All browser projects run with mock services
```

---

## 10.10 Execution Plan

### Step 1: Run on Chromium first
```bash
npx playwright test --project=chromium
```
- Fix all failures before moving to other browsers
- Most issues will be caught here

### Step 2: Run full suite
```bash
npm run test:e2e
```
- Runs all 4 browser projects
- Setup → all browsers → teardown

### Step 3: Fix browser-specific issues
Common cross-browser differences:
- **Firefox:** CSS `backdrop-filter` may behave differently
- **WebKit:** `localStorage` timing, font rendering
- **Mobile Chrome:** Touch events, viewport, hamburger menu

### Step 4: Verify HTML report
```bash
npx playwright show-report
```
- All specs green
- No flaky tests (retries should be 0 in local)
- Screenshots captured for failures

---

## 10.11 Test Data Management Strategy

### Before each spec file
```typescript
test.beforeEach(async ({ devApi }) => {
  await devApi.resetData();       // Clean slate
  await devApi.seedDemoData();    // Consistent starting state
});
```

### Role-specific tests
```typescript
test('viewer cannot access danger zone', async ({ devApi, page }) => {
  await devApi.switchRole('viewer');
  await page.goto('/settings');
  await expectHidden(page, S.settings.dangerTab);
});
```

### Tier-specific tests
```typescript
test('free tier sees upgrade prompt', async ({ devApi, page }) => {
  await devApi.switchTier('free');
  await page.goto('/reports');
  // Expect paywall message
});
```

---

## 10.12 Flaky Test Prevention

### Common causes and fixes

| Cause | Fix |
|-------|-----|
| Race condition on navigation | `await page.waitForURL()` after click |
| Toast not found | `await expectToastMessage()` with timeout |
| Data not loaded | `await page.waitForSelector()` before assertion |
| Animation interference | `await page.waitForTimeout(300)` or disable animations |
| Stale auth state | Global setup runs fresh each time |
| Port conflict | Playwright reuses existing dev server |

### Best practices verified

| Practice | Check |
|----------|-------|
| No `page.waitForTimeout()` for logic | Only for animations |
| Selectors use data-testid | Not CSS classes or text |
| Each test is independent | No shared state between tests |
| Tests clean up | Via global teardown |
| Assertions have timeouts | Default 10s expect timeout |

---

## 10.13 CI Pipeline Integration

### GitHub Actions configuration (`.github/workflows/e2e.yml`)

| Step | Command |
|------|---------|
| Start Supabase | `npx supabase start` |
| Seed database | `npx supabase db reset` |
| Install Playwright | `npx playwright install --with-deps` |
| Start dev server | `npm run dev &` |
| Wait for server | `npx wait-on http://localhost:3000` |
| Run E2E | `npx playwright test` |
| Upload report | Blob artifacts for GitHub reporter |

### CI-specific settings (from playwright.config.ts)
- 1 worker (sequential)
- 2 retries
- Blob + GitHub reporter
- Video on failure
- Trace on first retry

---

## Exit Criteria

| Criteria | Status |
|----------|--------|
| Global setup creates user + org + auth state | ☐ |
| Global teardown cleans all data | ☐ |
| Auth fixture extracts valid JWT | ☐ |
| Dev tools fixture: all 13 methods work | ☐ |
| All test IDs in selectors.ts exist in components | ☐ |
| `npx playwright test --project=chromium` — all green | ☐ |
| `npx playwright test --project=firefox` — all green | ☐ |
| `npx playwright test --project=webkit` — all green | ☐ |
| `npx playwright test --project=mobile-chrome` — all green | ☐ |
| `npm run test:e2e` — full suite exits 0 | ☐ |
| No flaky tests (0 retries needed locally) | ☐ |
| HTML report shows all green | ☐ |
| Smoke test: health.spec.ts passes | ☐ |
| CI pipeline runs successfully | ☐ |

---

## Dependencies
- **Requires:** All previous phases (0–9) complete
- **This is the final validation phase**
- **Blocks:** Production deployment (deploy only after full green suite)

---

## Summary: Full Test Matrix

| Phase | Spec files | Approx tests | Priority |
|-------|-----------|-------------|----------|
| Auth | 3 | 15 | P0 |
| Dashboard | 2 | 14 | P0 |
| Navigation | (in dashboard) | — | P0 |
| Inventory | 3 | 15 | P1 |
| Connections | 5 | 15 | P1 |
| Reports | 2 | 9 | P1 |
| Billing | 1 | 7 | P1 |
| Settings | 4 | 15 | P1 |
| Smoke | 1 | 2 | P0 |
| **Total** | **21** | **~92** | — |
