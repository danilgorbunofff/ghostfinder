# Phase 0 — Infrastructure & DevOps Baseline

> **Goal:** Establish a production-grade foundation — project scaffold, secrets management, CI/CD pipeline, deployment target, and security headers — so every subsequent phase ships on stable rails.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Repository & Project Scaffold](#2-repository--project-scaffold)
3. [Dependency Installation](#3-dependency-installation)
4. [Shadcn/ui Initialization](#4-shadcnui-initialization)
5. [Supabase Local Development](#5-supabase-local-development)
6. [Environment Configuration](#6-environment-configuration)
7. [Vercel Configuration](#7-vercel-configuration)
8. [CI/CD Pipeline (GitHub Actions)](#8-cicd-pipeline-github-actions)
9. [Monitoring & Observability](#9-monitoring--observability)
10. [Project Directory Structure](#10-project-directory-structure)
11. [Security Baseline](#11-security-baseline)
12. [Acceptance Criteria](#12-acceptance-criteria)

---

## 1. Prerequisites

Before starting, ensure the following accounts and tools are provisioned:

| Resource | Purpose | Action Required |
|----------|---------|-----------------|
| **GitHub** | Source control, CI/CD | Create repo `ghostfinder` |
| **Vercel** | Hosting, Edge Functions, Cron | Create project, link to GitHub repo |
| **Supabase Cloud** | Postgres, Auth, Vault, Realtime | Create project (region: `us-east-1` or nearest) |
| **Plaid** | Bank transaction data | Create Sandbox account at [dashboard.plaid.com](https://dashboard.plaid.com) |
| **Stripe** | Billing & subscriptions | Create account, get test-mode keys |
| **Okta Developer** | Identity/usage data | Register at [developer.okta.com](https://developer.okta.com) |
| **Google Cloud Console** | Workspace Admin SDK | Create OAuth 2.0 credentials, enable Admin SDK |
| **Node.js** | Runtime | v20 LTS or v22 LTS (required by deps) |
| **pnpm / npm** | Package manager | npm (default with Next.js scaffold) |

### Local Toolchain

```bash
# Verify Node.js version
node -v  # Should be >= 20.0.0

# Install Supabase CLI globally (or use npx)
npm i -g supabase

# Install Vercel CLI (optional — for local preview)
npm i -g vercel
```

---

## 2. Repository & Project Scaffold

### 2.1 — Initialize the Git Repository

```bash
cd "/Users/danil/Documents/New project/ghostfinder"
git init
```

### 2.2 — Scaffold Next.js

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

**Flags explained:**

| Flag | Rationale |
|------|-----------|
| `--typescript` | Type safety across API routes, services, and components |
| `--tailwind` | Utility-first CSS; required by Shadcn/ui |
| `--eslint` | Catch issues at lint time, not runtime |
| `--app` | App Router (Server Components, Route Handlers, Middleware) |
| `--src-dir` | Separates application code from config files at root |
| `--import-alias "@/*"` | Clean imports: `@/lib/supabase/server` instead of `../../../lib/supabase/server` |

### 2.3 — Initial Commit

```bash
git add .
git commit -m "chore: scaffold next.js with typescript, tailwind, app router"
```

---

## 3. Dependency Installation

### 3.1 — Production Dependencies

```bash
# Supabase (Auth + Database + SSR cookie handling)
npm i @supabase/supabase-js @supabase/ssr

# Financial data (Plaid bank integration + Link UI component)
npm i @plaid/plaid-node react-plaid-link

# Billing (Stripe server SDK + client-side Checkout.js)
npm i stripe @stripe/stripe-js

# Identity providers (Okta user directory + Google Admin SDK)
npm i @okta/okta-sdk-nodejs googleapis

# UI framework (Tailwind CSS v4 + PostCSS plugin)
npm i tailwindcss @tailwindcss/postcss
```

### 3.2 — Development Dependencies

```bash
# Supabase CLI for local dev, migrations, type generation
npm i -D supabase

# TypeScript type definitions
npm i -D @types/node @types/react

# Testing framework
npm i -D vitest @testing-library/react @testing-library/jest-dom

# Code quality
npm i -D prettier eslint-config-prettier
```

### 3.3 — Dependency Security Notes

| Package | Security Consideration |
|---------|----------------------|
| `@plaid/plaid-node` | **Server-only.** Never import in client components. Contains `client_secret`. |
| `stripe` | **Server-only.** Uses `STRIPE_SECRET_KEY`. Client uses `@stripe/stripe-js` (publishable key). |
| `@supabase/supabase-js` | Client uses `ANON_KEY` (safe to expose). `SERVICE_ROLE_KEY` bypasses RLS — server-only. |
| `googleapis` | OAuth tokens stored in Supabase Vault. Refresh tokens must never reach the client. |

### 3.4 — Commit

```bash
git add .
git commit -m "chore: install core dependencies (supabase, plaid, stripe, okta, google)"
```

---

## 4. Shadcn/ui Initialization

### 4.1 — Initialize

```bash
npx shadcn@latest init
```

When prompted:
- **Style:** `default`
- **Base color:** `neutral` (professional SaaS look)
- **CSS variables:** `yes`

### 4.2 — Install Required Components

Install the components used across all phases upfront:

```bash
npx shadcn@latest add \
  button card table badge tabs \
  dialog dropdown-menu input label \
  separator sheet avatar \
  alert toast sonner
```

| Component | Used In |
|-----------|---------|
| `card` | Dashboard KPI cards (Phase 1) |
| `table` | Vendor inventory, ghost seats report (Phase 1, 4) |
| `badge` | Status indicators (active/inactive/error) |
| `tabs` | Reports page (Ghost Seats / Duplicates tabs) (Phase 4) |
| `dialog` | Connection setup, notification config (Phase 2, 3, 5) |
| `dropdown-menu` | User menu, actions menu |
| `sheet` | Mobile sidebar navigation |
| `sonner` / `toast` | Success/error notifications |
| `button`, `input`, `label` | Forms (auth, settings, billing) |

### 4.3 — Commit

```bash
git add .
git commit -m "chore: initialize shadcn/ui with core components"
```

---

## 5. Supabase Local Development

### 5.1 — Initialize Supabase

```bash
npx supabase init
```

This creates:

```
supabase/
├── config.toml       # Local dev server config (ports, auth settings)
├── migrations/       # SQL migration files (created in Phase 1+)
└── seed.sql          # Seed data for local development
```

### 5.2 — Configure `config.toml`

Edit `supabase/config.toml` for local development:

```toml
[project]
id = "ghostfinder"

[api]
enabled = true
port = 54321

[db]
port = 54322

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/callback"]

[auth.email]
enable_signup = true
enable_confirmations = false   # Disable email confirm for local dev

[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_CLIENT_SECRET)"
redirect_uri = "http://localhost:54321/auth/v1/callback"
```

### 5.3 — Start Local Supabase

```bash
npx supabase start
```

This spins up local Postgres, Auth, Storage, and Realtime services via Docker. Save the output — it contains your local `SUPABASE_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY`.

### 5.4 — Link to Remote Project

```bash
npx supabase link --project-ref <your-project-ref>
```

This links local CLI to Supabase Cloud so `supabase db push` applies migrations to production.

### 5.5 — Generate TypeScript Types

```bash
npx supabase gen types typescript --linked > src/lib/types/database.types.ts
```

> **Run this after every migration** to keep TypeScript types in sync with the DB schema.

### 5.6 — Commit

```bash
git add .
git commit -m "chore: initialize supabase local dev environment"
```

---

## 6. Environment Configuration

### 6.1 — Create `.env.local`

> **WARNING:** This file is git-ignored by default. Never commit secrets.

```env
# ─── Supabase ────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key

# ─── Plaid ───────────────────────────────────────────────────
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-sandbox-secret
PLAID_ENV=sandbox

# ─── Okta ────────────────────────────────────────────────────
OKTA_ORG_URL=https://dev-xxxxx.okta.com
OKTA_API_TOKEN=your-okta-api-token
OKTA_CLIENT_ID=your-okta-client-id
OKTA_CLIENT_SECRET=your-okta-client-secret

# ─── Google Workspace ────────────────────────────────────────
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ─── Stripe ──────────────────────────────────────────────────
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxx
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx

# ─── Internal ────────────────────────────────────────────────
CRON_SECRET=generate-a-64-char-random-string-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6.2 — Create `.env.example`

This is committed to the repo so teammates know which vars to configure:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Plaid (sandbox | development | production)
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox

# Okta
OKTA_ORG_URL=
OKTA_API_TOKEN=
OKTA_CLIENT_ID=
OKTA_CLIENT_SECRET=

# Google Workspace
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Internal
CRON_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6.3 — Vercel Environment Variables

Configure in Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Preview (dev) | Production |
|----------|---------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dev project URL | Supabase prod project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev service role key | Prod service role key |
| `PLAID_ENV` | `sandbox` | `production` |
| `PLAID_SECRET` | Sandbox secret | Production secret |
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `CRON_SECRET` | Shared random string | Different random string |

> **Critical:** Never reuse the same `CRON_SECRET` across environments.

### 6.4 — Generate CRON_SECRET

```bash
openssl rand -hex 32
```

### 6.5 — Commit

```bash
git add .env.example
git commit -m "chore: add .env.example with all required environment variables"
```

---

## 7. Vercel Configuration

### 7.1 — Create `vercel.json`

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
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        },
        {
          "key": "X-DNS-Prefetch-Control",
          "value": "on"
        }
      ]
    }
  ]
}
```

### 7.2 — Cron Schedule Reference

| Cron Job | Schedule | Expression | Purpose |
|----------|----------|------------|---------|
| `sync-transactions` | Every 6 hours | `0 */6 * * *` | Pull Plaid transactions, filter SaaS spend |
| `sync-usage` | Every 12 hours | `0 */12 * * *` | Pull Okta/Google user activity data |
| `generate-reports` | Weekly Mon 8am UTC | `0 8 * * 1` | Run reconciliation engine, generate waste reports |

### 7.3 — Security Headers Explained

| Header | Purpose |
|--------|---------|
| `X-Frame-Options: DENY` | Prevent clickjacking — app cannot be embedded in iframes |
| `X-Content-Type-Options: nosniff` | Prevent MIME-type sniffing attacks |
| `Strict-Transport-Security` | Force HTTPS for 2 years, include subdomains |
| `Referrer-Policy` | Limit referrer info sent to external origins |
| `Permissions-Policy` | Disable camera/mic/geolocation (not needed) |

### 7.4 — Connect to Vercel

```bash
# Login to Vercel CLI
vercel login

# Link project
vercel link

# Deploy preview
vercel

# Deploy production
vercel --prod
```

### 7.5 — Commit

```bash
git add vercel.json
git commit -m "infra: add vercel.json with cron schedules and security headers"
```

---

## 8. CI/CD Pipeline (GitHub Actions)

### 8.1 — Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'

jobs:
  quality:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npx vitest run --reporter=verbose

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: quality
    env:
      # Stub env vars so next build doesn't fail on missing NEXT_PUBLIC_* vars
      NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_placeholder
      NEXT_PUBLIC_APP_URL: https://placeholder.vercel.app
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
```

### 8.2 — Pipeline Architecture

```
PR opened / push to main
         │
         ▼
    ┌─────────┐
    │ quality  │  lint + tsc --noEmit
    └────┬────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────┐  ┌───────┐
│ test │  │ build │   run in parallel after quality passes
└──────┘  └───────┘
```

### 8.3 — Branch Strategy

| Branch | Environment | Deploy Target |
|--------|-------------|---------------|
| `main` | Production | Vercel Production + Supabase Prod |
| Feature branches | Preview | Vercel Preview (auto-deploy on PR) |

**Rules:**
- Direct pushes to `main` blocked — all changes via PRs
- PRs require CI pass before merge
- Vercel auto-deploys: PRs → Preview, merged to `main` → Production
- Supabase migrations pushed manually or via post-deploy hook

### 8.4 — Supabase Migration Strategy

```bash
# Create a new migration locally
npx supabase migration new <description>

# Test locally
npx supabase db reset   # Drops + re-applies all migrations

# Push to remote (production)
npx supabase db push --linked
```

> **Important:** Always run `supabase db reset` locally before pushing to production. Migrations are append-only — you cannot edit a pushed migration.

### 8.5 — Commit

```bash
git add .github/
git commit -m "ci: add github actions pipeline (lint, typecheck, test, build)"
```

---

## 9. Monitoring & Observability

### 9.1 — Monitoring Stack (No Extra Infrastructure)

| Layer | Tool | What It Covers |
|-------|------|----------------|
| **Frontend** | Vercel Analytics | Core Web Vitals, page load times, client errors |
| **API Routes** | Vercel Logs | Request/response logs, function duration, cold starts |
| **Database** | Supabase Dashboard | Query performance, connection pool, storage usage |
| **Background Jobs** | Vercel Cron Logs | Cron execution history, success/failure, duration |
| **Billing** | Stripe Dashboard | Payment events, subscription lifecycle, failed charges |
| **Error Tracking** | Sentry *(Phase 5+)* | Runtime exceptions, stack traces, user impact |

### 9.2 — Alerting Setup

Configure alerts in each platform:

- **Supabase:** Database approaching connection limit, disk usage > 80%
- **Vercel:** Function errors spike, build failures
- **Stripe:** Failed payment attempts, subscription churn
- **Plaid:** Item error webhooks (bank connection broken)

### 9.3 — Health Check Endpoint

Create a health check route (useful for uptime monitoring):

```
GET /api/health → { status: "ok", timestamp: "...", version: "..." }
```

This validates the API layer is responsive. Add a Supabase ping to check DB connectivity.

---

## 10. Project Directory Structure

```
ghostfinder/
├── .github/
│   └── workflows/
│       └── ci.yml                          # CI pipeline
├── src/
│   ├── app/
│   │   ├── (auth)/                         # Auth route group (no layout nesting)
│   │   │   ├── login/page.tsx              # Login page
│   │   │   ├── signup/page.tsx             # Signup page
│   │   │   └── callback/route.ts           # OAuth callback handler
│   │   ├── (dashboard)/                    # Dashboard route group (shared layout)
│   │   │   ├── layout.tsx                  # Sidebar + auth guard layout
│   │   │   ├── page.tsx                    # Main dashboard with KPI cards
│   │   │   ├── inventory/page.tsx          # SaaS vendor inventory table
│   │   │   ├── connections/page.tsx        # Manage integrations
│   │   │   ├── reports/page.tsx            # Waste reports
│   │   │   ├── settings/page.tsx           # Org settings
│   │   │   └── billing/page.tsx            # Subscription management
│   │   ├── api/
│   │   │   ├── health/route.ts             # Health check
│   │   │   ├── plaid/                      # Plaid API routes (Phase 2)
│   │   │   ├── integrations/              # Okta/Google OAuth (Phase 3)
│   │   │   ├── cron/                       # Background job endpoints
│   │   │   ├── stripe/                     # Billing API routes (Phase 5)
│   │   │   └── notifications/             # Alert endpoints (Phase 5)
│   │   ├── layout.tsx                      # Root layout (html, body, fonts)
│   │   └── page.tsx                        # Landing page / marketing
│   ├── components/
│   │   ├── dashboard/                      # Dashboard-specific components
│   │   ├── connections/                    # Integration connection components
│   │   └── ui/                             # Shadcn/ui auto-generated components
│   ├── lib/
│   │   ├── supabase/                       # Supabase client variants
│   │   │   ├── client.ts                   # Browser client (anon key)
│   │   │   ├── server.ts                   # Server client (cookies)
│   │   │   ├── admin.ts                    # Service role client
│   │   │   └── middleware.ts               # Auth refresh helper
│   │   ├── services/                       # External API service modules
│   │   │   ├── plaid.service.ts
│   │   │   ├── okta.service.ts
│   │   │   ├── google.service.ts
│   │   │   ├── stripe.service.ts
│   │   │   └── notification.service.ts
│   │   ├── reconciliation/                 # Business logic (Phase 4)
│   │   │   ├── engine.ts
│   │   │   ├── ghost-detector.ts
│   │   │   └── duplicate-detector.ts
│   │   ├── utils/                          # Utility functions
│   │   │   ├── mcc-codes.ts
│   │   │   └── vendor-normalizer.ts
│   │   └── types/
│   │       ├── index.ts                    # App-level TypeScript types
│   │       └── database.types.ts           # Auto-generated from Supabase
│   └── middleware.ts                       # Next.js auth middleware
├── supabase/
│   ├── config.toml                         # Local dev config
│   ├── migrations/                         # SQL migration files
│   └── seed.sql                            # Local seed data
├── public/                                 # Static assets
├── .env.local                              # Local secrets (git-ignored)
├── .env.example                            # Template for env vars
├── vercel.json                             # Vercel config (crons, headers)
├── next.config.ts                          # Next.js config
├── tsconfig.json                           # TypeScript config
├── tailwind.config.ts                      # Tailwind config
├── vitest.config.ts                        # Test config
├── package.json
└── README.md
```

---

## 11. Security Baseline

### 11.1 — Secrets Management Principles

| Principle | Implementation |
|-----------|---------------|
| **No secrets in code** | All secrets in `.env.local` (local) or Vercel env vars (deployed) |
| **No secrets in Git** | `.gitignore` includes `.env.local`, `.env*.local` |
| **Least privilege** | `ANON_KEY` for client, `SERVICE_ROLE_KEY` only in server routes |
| **Rotate regularly** | Document rotation procedures for each provider |
| **Separate per environment** | Different keys for dev vs prod |

### 11.2 — `.gitignore` Additions

Verify these entries exist in `.gitignore`:

```gitignore
# Environment secrets
.env.local
.env*.local

# Supabase local data
supabase/.temp/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

### 11.3 — Cron Endpoint Security

All cron endpoints (`/api/cron/*`) must verify the `CRON_SECRET`:

```typescript
// Pattern for every cron route handler:
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... cron logic
}
```

Vercel sends cron requests with the `Authorization: Bearer <CRON_SECRET>` header automatically when configured.

### 11.4 — Content Security Policy (Future Enhancement)

When moving to production with real users, add a CSP header in `vercel.json`:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.plaid.com; connect-src 'self' https://*.supabase.co https://*.plaid.com https://*.stripe.com; frame-src https://cdn.plaid.com https://js.stripe.com;
```

> Plaid Link and Stripe Checkout require specific CSP allowances.

---

## 12. Acceptance Criteria

Phase 0 is complete when **all** of the following are true:

- [ ] Next.js app runs locally (`npm run dev`) and renders the default page
- [ ] All dependencies installed without version conflicts
- [ ] Shadcn/ui components render correctly (test with a Button on the index page)
- [ ] `npx supabase start` launches local Supabase (Postgres + Auth accessible)
- [ ] `.env.local` populated with all required variables (at least placeholder values)
- [ ] `.env.example` committed to repo with all variable names
- [ ] `vercel.json` committed with cron schedules and security headers
- [ ] GitHub Actions CI pipeline runs and passes (lint, type-check, build)
- [ ] Vercel project created and linked — preview deploy succeeds on PR
- [ ] `git log` shows clean, atomic commits for each step above
- [ ] No secrets in the Git history — verified with `git log --all -p | grep -i "secret\|password\|token"` returns nothing sensitive

---

## Next Step

→ Proceed to [Phase 1 — Foundation & Dashboard Shell](./PHASE-1-FOUNDATION.md)
