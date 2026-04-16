# Plan: Full Local Setup with Real Service Credentials

## TL;DR
Wire up GhostFinder with real credentials for all 6 services (Supabase Cloud, Stripe, Plaid, Google, Okta, Resend) plus Slack webhooks in-app. Replace all mocked env vars in .env.local, set MOCK_SERVICES=false, and verify end-to-end flows work locally.

---

## Phase 1 — Supabase Cloud

**Steps:**
1. Sign up at https://supabase.com → New project → pick a region close to you → save your DB password.
2. After provisioning (~2 min), go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Install Supabase CLI if not already: `npm i -g supabase`
4. Link local project: `supabase link --project-ref <ref-id>` (ref-id from project URL, e.g. abcxyz.supabase.co → ref = abcxyz)
5. Push all migrations to cloud: `supabase db push`
   - This applies all 6 migration files in supabase/migrations/
6. Enable **Vault** extension: in Supabase dashboard → Database → Extensions → search "vault" → enable
7. Update .env.local with the 3 keys above.

---

## Phase 2 — Stripe (Test Mode)

**Steps:**
1. Sign up at https://stripe.com → Dashboard opens in test mode by default.
2. Go to **Developers → API keys** and copy:
   - `Publishable key` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `Secret key` → `STRIPE_SECRET_KEY`
3. Create two Products for the billing tiers:
   - **Monitor** product → recurring price ($X/month) → copy price ID → `NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID`
   - **Recovery** product → recurring price ($X/month) → copy price ID → `NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID`
   - (Exact amounts don't matter for local testing; pick any)
4. Install Stripe CLI: https://stripe.com/docs/stripe-cli (Windows: `scoop install stripe` or download from releases)
5. Authenticate CLI: `stripe login`
6. Start webhook forwarding: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   - Copy the `whsec_...` webhook signing secret from CLI output → `STRIPE_WEBHOOK_SECRET`
7. Update .env.local with all 5 Stripe vars.

---

## Phase 3 — Plaid (Sandbox)

**Steps:**
1. Sign up at https://dashboard.plaid.com → Create account (free sandbox).
2. Go to **Team Settings → Keys** and copy:
   - `client_id` → `PLAID_CLIENT_ID`
   - `Sandbox` secret → `PLAID_SECRET`
3. Keep `PLAID_ENV=sandbox` (sandbox is free with test bank credentials).
4. Note: Plaid webhook registration is automatic — the app passes `NEXT_PUBLIC_APP_URL + /api/plaid/webhook` when creating link tokens. For local testing webhooks won't reach localhost; use `ngrok` or skip webhook-triggered syncs (manual sync still works).
5. Update .env.local.

---

## Phase 4 — Google Workspace (OAuth2 + Admin SDK)

**Steps:**
1. Go to https://console.cloud.google.com → Create a new project (name: "GhostFinder Dev").
2. Enable **Admin SDK API**: APIs & Services → Library → search "Admin SDK" → Enable.
3. Configure OAuth consent screen: APIs & Services → OAuth consent screen → External → fill app name/email → Add scope: `https://www.googleapis.com/auth/admin.directory.user.readonly`.
4. Create OAuth2 credentials: APIs & Services → Credentials → Create Credentials → OAuth client ID:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/integrations/google/callback`
   - Copy `Client ID` → `GOOGLE_CLIENT_ID`
   - Copy `Client secret` → `GOOGLE_CLIENT_SECRET`
5. Important: The Google Workspace Admin SDK requires a G Suite/Google Workspace domain admin to authorize. For testing, use a personal Google account only if you have a Workspace account or use a free Workspace trial.
6. Update .env.local.

---

## Phase 5 — Okta (Developer Sandbox)

**Steps:**
1. Sign up for free Okta Developer at https://developer.okta.com/signup/ → creates a free dev org (e.g. dev-12345678.okta.com).
2. Create an API Token: Security → API → Tokens → Create Token → copy token → `OKTA_API_TOKEN`.
3. Create test users: Directory → People → Add Person (to simulate ghost seats).
4. Create an OIDC Web Application (for OAuth2 flow):
   - Applications → Applications → Create App Integration → OIDC → Web Application
   - Grant type: Authorization Code
   - Sign-in redirect URI: `http://localhost:3000/api/integrations/okta/callback` (if used)
   - Copy Client ID → `OKTA_CLIENT_ID`
   - Copy Client Secret → `OKTA_CLIENT_SECRET`
5. Set `OKTA_ORG_URL=https://dev-XXXXXXXX.okta.com` (your dev org URL, no trailing slash).
6. Update .env.local.

---

## Phase 6 — Resend (Email Notifications)

**Steps:**
1. Sign up at https://resend.com → Create account.
2. Go to **API Keys** → Create API Key → copy → `RESEND_API_KEY`.
3. Resend requires domain verification for production sending. For local testing, you can send to your own email from the `onboarding@resend.dev` sandbox domain (no domain setup needed).
4. Update .env.local.

---

## Phase 7 — Slack (In-App Notification Setting)

**Steps:**
1. Go to https://api.slack.com/apps → Create New App → From scratch → name: "GhostFinder" → pick your workspace.
2. Features → Incoming Webhooks → Activate → Add New Webhook to Workspace → pick a channel → copy webhook URL (starts with `https://hooks.slack.com/services/...`).
3. This webhook URL is configured **inside the app** in Settings → Notifications (not in .env.local). Enter it there after signing in.

---

## Phase 8 — Final .env.local Update

Replace the entire .env.local with real values:
- Set `MOCK_SERVICES=false`
- Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- Generate a strong `CRON_SECRET`: `openssl rand -hex 32` (or use any random 32+ char string)
- All service keys from phases above

---

## Phase 9 — Start & Verify

**Steps (sequential):**
1. `npm install` (ensure deps are current)
2. `npm run dev` → app starts at http://localhost:3000
3. Sign up for a new account → verify Supabase auth works + org auto-created in DB
4. Go to Billing → click upgrade to Monitor → complete Stripe test checkout (card: 4242 4242 4242 4242)
   - In separate terminal: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` must be running
5. Go to Connections → connect Plaid (use sandbox test credentials: username=`user_good`, password=`pass_good`)
6. Go to Connections → connect Google Workspace → authorize OAuth flow
7. Go to Connections → connect Okta → enter your dev org URL
8. Go to Reports → verify ghost seat/waste report generates
9. Go to Settings → Notifications → enter Slack webhook URL → trigger a test notification

---

## Relevant Files
- `.env.local` — primary file to update throughout all phases
- `src/app/api/webhooks/stripe/route.ts` — Stripe webhook handler
- `src/app/api/plaid/webhook/route.ts` — Plaid webhook handler
- `src/app/api/integrations/google/callback/route.ts` — Google OAuth callback
- `vercel.json` — cron schedule configuration
- `supabase/migrations/` — 6 migration files to push to cloud

## Decisions
- Supabase Cloud (not local Docker)
- All 6 services with real credentials
- Stripe CLI for local webhook forwarding
- Slack webhook configured in-app (not env var)
- Plaid webhooks won't work on localhost without a tunnel — manual sync is sufficient for testing
