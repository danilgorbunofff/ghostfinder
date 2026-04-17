# Phase 5 — Connections

> **Objective:** All four data source integrations — Plaid (US banking), GoCardless (EU banking), Okta (identity), and Google Workspace (identity) — connect, disconnect, display status, and handle errors correctly. The onboarding progress indicator tracks completion. Mock mode works for development/testing. Real OAuth/API flows work in production.

---

## 5.1 Connections Page (Server Component)

**File:** `src/app/(dashboard)/connections/page.tsx`

### Data queries

| Query | Table | Returns |
|-------|-------|---------|
| Bank connections | `plaid_connections` | US bank links (status, institution, last_synced) |
| EU bank connections | `gocardless_connections` | EU bank links (status, institution, country, expires_at) |
| Identity providers | `integration_connections` | Okta/Google (status, provider, total_users, inactive_users, domain) |

### Page layout
```
┌────────────────────────────────────────────┐
│  Connection Stats (3 cards)                │
│  [Total Connections] [Users Synced] [Last] │
├────────────────────────────────────────────┤
│  Onboarding Progress (3 steps)             │
│  [ Bank ✓ ] ── [ Identity ✓ ] ── [ Scan ] │
├────────────────────────────────────────────┤
│  🏦 Bank Accounts                          │
│  ┌─────────────────┐ ┌─────────────────┐  │
│  │ Plaid (Chase)   │ │ GoCardless (EU) │  │
│  │ Active • 2h ago │ │ Active • 80d    │  │
│  └─────────────────┘ └─────────────────┘  │
│  [+ Connect US Bank] [+ Connect EU Bank]   │
├────────────────────────────────────────────┤
│  🔐 Identity Providers                     │
│  ┌─────────────────┐ ┌─────────────────┐  │
│  │ Okta  47 users  │ │ Google 38 users │  │
│  │ Active • 1d ago │ │ Active • 3h ago │  │
│  └─────────────────┘ └─────────────────┘  │
│  [+ Add Provider]                          │
└────────────────────────────────────────────┘
```

---

## 5.2 Plaid Integration (US Banking)

**Component:** `src/components/connections/plaid-link-button.tsx`

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/plaid/create-link-token` | POST | Initialize Plaid Link widget |
| `/api/plaid/exchange-token` | POST | Exchange public token → access token, store in vault |
| `/api/plaid/disconnect` | DELETE | Revoke Plaid access, cascade delete data |
| `/api/plaid/webhook` | POST | Handle Plaid events (sync updates, errors, expiration) |

### Service: `src/lib/services/plaid.service.ts`
- `createLinkToken()` — Initializes Plaid Link session
- `exchangePublicToken()` — Exchanges public → access token
- `syncTransactions()` — Full sync with cursor pagination (500/batch)
- `getInstitution()` — Institution metadata
- `verifyWebhook()` — Webhook signature validation

### Mock mode flow (MOCK_SERVICES=true)
```
Click "Connect US Bank"
  → POST /api/plaid/create-link-token returns { mockMode: true }
  → Component calls POST /api/plaid/exchange-token with mock data
  → Seeds: plaid_connection (Chase Bank), 10 transactions, 5 vendors
  → Page refreshes, connection card appears
```

### Real mode flow
```
Click "Connect US Bank"
  → POST /api/plaid/create-link-token returns { link_token }
  → Plaid Link widget opens (react-plaid-link)
  → User selects bank, authenticates
  → onSuccess callback receives public_token
  → POST /api/plaid/exchange-token exchanges token
  → Access token stored in Supabase Vault
  → plaid_connections row inserted
  → triggerScanIfReady() called
```

### Connection card content
- Plaid logo (from `provider-logos.tsx`)
- Institution name (e.g., "Chase Bank")
- Status badge: active / syncing / error / disabled
- Last synced timestamp (relative: "2h ago")
- Dropdown menu: Disconnect

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Connect button visible | When no Plaid connection exists |
| 2 | Mock mode: click connects | Seeds data, card appears after refresh |
| 3 | Connection card renders | Logo, institution name, status, last synced |
| 4 | Status badge colors | active=green, syncing=blue, error=red |
| 5 | Disconnect dialog | Confirmation with cascade warning |
| 6 | Disconnect cascade | Deletes: plaid_connections → transactions → saas_vendors → waste_reports |
| 7 | Error state | Error badge + "Reconnect" button |
| 8 | Webhook: sync updates | Status updated on TRANSACTIONS.SYNC_UPDATES_AVAILABLE |
| 9 | Webhook: error | Status set to error on ITEM.ERROR |
| 10 | Webhook: expiration | Handles ITEM.PENDING_EXPIRATION |

---

## 5.3 GoCardless Integration (EU Banking)

**Component:** `src/components/connections/gocardless-connect-button.tsx`

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/gocardless/institutions` | GET | List banks for a country (cached 1h) |
| `/api/gocardless/create-requisition` | POST | Create requisition, redirect to bank auth |
| `/api/gocardless/callback` | GET | Process authorization callback |
| `/api/gocardless/disconnect` | DELETE | Delete requisition + cascade |

### Service: `src/lib/services/gocardless.service.ts`
- `getAccessToken()` — Token management with 5-min cache
- `listInstitutions(country)` — Banks for country
- `createRequisition()` — PSD2 authorization flow
- `getRequisition()` — Status check
- `getAccountTransactions()` — Booked + pending transactions
- `extractMerchantName()` — Parses merchant from transaction text

### EU/EEA countries supported (31)
```
AT, BE, BG, CY, CZ, DE, DK, EE, ES, FI, FR, GR, HR, HU, IE, IS, IT,
LI, LT, LU, LV, MT, NL, NO, PL, PT, RO, SE, SI, SK, GB
```

### Connect flow
```
1. Select country from dropdown (31 options)
2. Search/filter institutions for that country
3. Click institution → POST /api/gocardless/create-requisition
4. Redirect to bank's PSD2 authorization page
5. Bank redirects back to /api/gocardless/callback
6. Callback activates account, sets 90-day expiry
7. Page refreshes, connection card appears
```

### Connection card content
- GoCardless logo + EU badge
- Institution name + country flag
- Status badge: active / pending / expired / error
- Expires at date (90-day PSD2 mandate)
- Dropdown menu: Disconnect

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Country dropdown shows 31 options | All EU/EEA countries |
| 2 | Institution search filters | Typing filters bank list |
| 3 | Mock mode: seeds data | Fake requisition + transactions |
| 4 | Real mode: redirect flow | Redirects to bank, callback processes |
| 5 | 90-day expiry tracked | `expires_at` set, shown on card |
| 6 | Expired connection | Shows "Expired" badge + "Reconnect" button |
| 7 | Multiple accounts | Handles requisitions with multiple bank accounts |
| 8 | Disconnect cascade | Deletes: gocardless_connections → transactions |
| 9 | Role gate | Only owner/admin can connect (validate on POST) |
| 10 | Error handling | Toast on failure, error state on card |

---

## 5.4 Okta Integration (Identity Provider)

**Component:** `src/components/connections/okta-connect-button.tsx`

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/okta/connect` | POST | Validate + store Okta credentials |
| `/api/integrations/okta/disconnect` | DELETE | Remove connection + user activity |

### Service: `src/lib/services/okta.service.ts`
- `listOktaUsers()` — Fetches all users with last login, status classification
- `verifyOktaConnection()` — Tests API token validity
- User statuses: active, inactive, suspended, deprovisioned

### Connect flow
```
1. Enter Okta org URL (e.g., https://dev-12345.okta.com)
2. Enter API token
3. Click Connect
4. POST /api/integrations/okta/connect:
   - Validates URL format (.okta.com domain)
   - Verifies API token with test request to Okta
   - Stores token in Supabase Vault
   - Upserts integration_connections row
   - Seeds mock user activity (in mock mode)
   - Triggers scan if ready
```

### Connection card content
- Okta logo (blue circle)
- Domain (from metadata)
- User breakdown bar: active (green) / inactive (red)
- User counts: active / inactive / total
- Last synced timestamp
- Dropdown menu: Disconnect

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Form displays | URL + token inputs |
| 2 | URL validation | Rejects non-.okta.com domains |
| 3 | Help text expandable | "How to create API token" accordion |
| 4 | Connection verified | Test API call succeeds before saving |
| 5 | Token stored in vault | Not in plain text in DB |
| 6 | Connection card renders | Logo, domain, user bar, counts |
| 7 | User breakdown bar | Proportional green/red segments |
| 8 | Disconnect cascade | Deletes: integration_connections → user_activity |
| 9 | Error on bad token | Toast: "Invalid API token" |
| 10 | Error on bad URL | Toast: "Invalid Okta URL" |

---

## 5.5 Google Workspace Integration (Identity Provider)

**Component:** `src/components/connections/google-connect-button.tsx`

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations/google/connect` | POST | Generate OAuth URL + CSRF state |
| `/api/integrations/google/callback` | GET | Exchange code, store tokens |
| `/api/integrations/google/disconnect` | DELETE | Revoke token + delete data |

### Service: `src/lib/services/google.service.ts`
- `listGoogleUsers()` — Workspace users (paginated, 500 max)
- `refreshGoogleToken()` — Token refresh using refresh_token
- `verifyGoogleConnection()` — Tests workspace access
- OAuth scopes: `admin.directory.user.readonly`, `userinfo.email`

### Connect flow
```
1. Click "Connect Google Workspace"
2. POST /api/integrations/google/connect:
   - Generates OAuth authorization URL
   - Creates CSRF state token
   - Sets state cookie (HttpOnly)
3. Redirect to Google consent screen
4. Google redirects to /api/integrations/google/callback:
   - Validates CSRF state cookie
   - Exchanges code for access + refresh tokens
   - Stores tokens in Supabase Vault
   - Detects workspace domain from admin profile
   - Upserts integration_connections
   - Triggers scan if ready
   - Clears state cookie
```

### Mock mode
```
Click "Connect Google Workspace"
  → POST returns redirect URL to /connections?success=google_connected
  → Page shows success toast
  → Seeds mock user data
```

### Security: CSRF protection
- State token generated server-side, stored in HttpOnly cookie
- Callback validates state cookie matches callback `state` param
- Cookie cleared after use

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Connect button renders | Google logo + "Connect Google Workspace" |
| 2 | Mock mode works | Redirect with success param, data seeded |
| 3 | Real mode: OAuth redirect | Opens Google consent screen |
| 4 | CSRF state validated | Callback rejects mismatched state |
| 5 | Tokens stored in vault | Access + refresh tokens |
| 6 | Domain detected | From admin's Google profile |
| 7 | Connection card renders | Google logo, domain, user bar, counts |
| 8 | Token refresh | Handles expired access tokens via refresh_token |
| 9 | Disconnect: token revoked | Calls Google revoke API |
| 10 | Disconnect cascade | Deletes: integration_connections → user_activity |

---

## 5.6 Onboarding Progress

**Component:** `src/components/connections/onboarding-progress.tsx`

### Steps

| # | Step | Icon | Complete when |
|---|------|------|--------------|
| 1 | Bank Account | Building | Any plaid or gocardless connection active |
| 2 | Identity Provider | Shield | Any okta or google connection active |
| 3 | Run Scan | Scan | waste_reports has at least 1 row |

### Visual
```
[ ✅ Bank ] ───── [ ✅ Identity ] ───── [ ○ Scan ]
                                          ↑ Next step highlighted
```

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Empty state | All 3 steps unchecked |
| 2 | Bank connected | Step 1 ✅, steps 2-3 ○ |
| 3 | Both connected | Steps 1-2 ✅, step 3 ○ |
| 4 | All complete | Progress hidden entirely |
| 5 | Progress line | Green fill between completed steps |
| 6 | Next step highlight | Pending step has pulsing indicator |

---

## 5.7 Connection Stats

**Component:** `src/components/connections/connection-stats.tsx`

| Card | Data | Format |
|------|------|--------|
| Total connections | Count of all active connections | Integer |
| Users synced | Sum of total_users across identity providers | Integer |
| Last synced | Most recent `last_synced` timestamp | Relative ("3h ago", "2d ago") |

---

## 5.8 Disconnect Dialog

**Component:** `src/components/connections/disconnect-dialog.tsx`

### Flow
```
Click dropdown "..." on connection card
  → Select "Disconnect"
  → Confirmation dialog opens
  → Warning: "This will permanently delete all associated data"
  → Lists what will be deleted (transactions, vendors, reports)
  → Confirm button (red/destructive)
  → DELETE /api/{provider}/disconnect
  → Toast: success or error
  → Page refreshes
```

### Provider-specific API routing

| Provider | DELETE endpoint |
|----------|---------------|
| Plaid | `/api/plaid/disconnect` |
| GoCardless | `/api/gocardless/disconnect` |
| Okta | `/api/integrations/okta/disconnect` |
| Google | `/api/integrations/google/disconnect` |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Dialog opens | From dropdown menu |
| 2 | Warning message | Lists data that will be deleted |
| 3 | Cancel button | Closes dialog, no action |
| 4 | Confirm deletes | Calls correct DELETE endpoint |
| 5 | Loading state | Button shows spinner during delete |
| 6 | Success toast | "Disconnected successfully" |
| 7 | Error toast | "Failed to disconnect" with retry option |
| 8 | Page refreshes | Connection card disappears |

---

## 5.9 Provider Logos

**Component:** `src/components/connections/provider-logos.tsx`

| Provider | Logo type | Detail |
|----------|----------|--------|
| Plaid | SVG | Black/white adaptive |
| Okta | SVG | Blue circle |
| Google | SVG | 4-color G |
| GoCardless | SVG | Teal wordmark |

### Check
- [ ] All 4 logos render in light mode
- [ ] All 4 logos render in dark mode
- [ ] No layout shift from SVG loading

---

## 5.10 Error Handling

### Connection error states

| State | Display | Action |
|-------|---------|--------|
| API timeout | Toast: "Connection timed out" | Retry button |
| Invalid credentials | Toast: "Invalid API token" | Fix + retry |
| OAuth denied | Redirect with error param | Show error, re-attempt |
| Expired (GoCardless) | "Expired" badge on card | "Reconnect" button |
| Sync error | "Error" badge on card | "Retry" button |

---

## 5.11 E2E Test Coverage

### Spec files

| File | Tests | Coverage |
|------|-------|----------|
| `e2e/specs/connections/overview.spec.ts` | ~3 | Stats cards, onboarding progress, multi-connection render |
| `e2e/specs/connections/plaid.spec.ts` | ~3 | Empty state, Plaid Link initiation, connection card |
| `e2e/specs/connections/gocardless.spec.ts` | ~3 | Country selector, institution list, connection card |
| `e2e/specs/connections/okta.spec.ts` | ~3 | Form render, validation, connection card |
| `e2e/specs/connections/google.spec.ts` | ~3 | OAuth initiation, callback handling, connection card |

### Test IDs (from `e2e/helpers/selectors.ts`)
```typescript
connections: {
  stats:           'connection-stats',
  progress:        'onboarding-progress',
  plaidConnect:    'plaid-connect-button',
  gocardlessConnect: 'gocardless-connect-button',
  oktaConnect:     'okta-connect-submit',
  googleConnect:   'google-connect-button',
  disconnectDialog:'disconnect-dialog',
  connectionCard:  'connection-card',
}
```

### Running connections E2E
```bash
npx playwright test e2e/specs/connections/ --project=chromium
```

---

## Exit Criteria

| Criteria | Status |
|----------|--------|
| Plaid mock connect works | ☐ |
| Plaid connection card renders correctly | ☐ |
| GoCardless country selector shows 31 countries | ☐ |
| GoCardless institution search filters | ☐ |
| Okta form validates URL format | ☐ |
| Okta rejects invalid API token | ☐ |
| Google OAuth redirect works (mock mode) | ☐ |
| Google CSRF state validation works | ☐ |
| Onboarding progress updates on connect | ☐ |
| Onboarding hides when all complete | ☐ |
| Disconnect dialog warns about data loss | ☐ |
| Disconnect cascade deletes all associated data | ☐ |
| Error states show correct badges + retry | ☐ |
| All connections E2E specs pass | ☐ |

---

## Dependencies
- **Requires:** Phase 0 (build), Phase 1 (auth), Phase 3 (layout)
- **Feeds into:** Phase 4 (Inventory — vendors from transaction sync), Phase 6 (Reports — user activity for ghost detection)
- **Blocks:** None (Inventory works with seed data independently)
