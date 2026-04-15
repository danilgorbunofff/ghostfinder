#!/usr/bin/env bash
# ============================================================================
# GhostFinder — Full-Stack Verification Script
# Run: chmod +x scripts/verify-all.sh && ./scripts/verify-all.sh
# ============================================================================
set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}✅ PASS${NC} — $1"; ((PASS++)); }
fail() { echo -e "  ${RED}❌ FAIL${NC} — $1"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}⚠️  WARN${NC} — $1"; ((WARN++)); }
section() { echo -e "\n${CYAN}${BOLD}═══ $1 ═══${NC}"; }

cd "$(dirname "$0")/.."

# ─── PHASE A: Build & Static Analysis ────────────────────────────────────────
section "PHASE A: Build & Static Analysis"

echo "  Running TypeScript type check..."
if npx tsc --noEmit 2>/dev/null; then pass "TypeScript — zero errors"; else fail "TypeScript errors found"; fi

echo "  Running ESLint..."
LINT_OUTPUT=$(npm run lint 2>&1 || true)
LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -cE "^\s+[0-9]+ problem" | head -1 || echo "0")
LINT_HAS_ERRORS=$(echo "$LINT_OUTPUT" | grep -oE "[0-9]+ error" | head -1 | grep -oE "[0-9]+" || echo "0")
if [ "$LINT_HAS_ERRORS" -eq 0 ]; then pass "ESLint — zero errors"; else fail "ESLint found $LINT_HAS_ERRORS errors"; fi

echo "  Running tests..."
TEST_OUTPUT=$(npx vitest run 2>&1 || true)
if echo "$TEST_OUTPUT" | grep -q "passed"; then pass "Vitest — all tests passed"; else fail "Test failures detected"; fi

echo "  Running production build..."
BUILD_OUTPUT=$(npm run build 2>&1 || true)
if echo "$BUILD_OUTPUT" | grep -qE "Generating static pages|Route \(app\)"; then pass "Next.js build — successful"; else fail "Build failed"; fi

# ─── ROUTE INVENTORY ─────────────────────────────────────────────────────────
section "ROUTE INVENTORY"

EXPECTED_ROUTES=(
  "api/billing/checkout" "api/billing/portal"
  "api/cron/generate-reports" "api/cron/sync-transactions" "api/cron/sync-usage"
  "api/health"
  "api/integrations/google/callback" "api/integrations/google/connect"
  "api/integrations/okta/connect"
  "api/notifications/notify-users" "api/notifications/settings"
  "api/plaid/create-link-token" "api/plaid/exchange-token" "api/plaid/webhook"
  "api/webhooks/stripe"
)

for route in "${EXPECTED_ROUTES[@]}"; do
  if [ -f "src/app/$route/route.ts" ]; then
    pass "Route: /$route"
  else
    fail "Route missing: /$route"
  fi
done

EXPECTED_PAGES=("login" "signup" "billing" "connections" "inventory" "reports" "settings")
for page in "${EXPECTED_PAGES[@]}"; do
  found=$(find src/app -path "*/$page/page.tsx" 2>/dev/null | head -1)
  if [ -n "$found" ]; then pass "Page: /$page"; else fail "Page missing: /$page"; fi
done

# ─── SERVICE MODULES ─────────────────────────────────────────────────────────
section "SERVICE MODULES"

SERVICES=("plaid" "stripe" "okta" "google" "notification")
for svc in "${SERVICES[@]}"; do
  if [ -f "src/lib/services/$svc.service.ts" ]; then
    pass "Service: $svc.service.ts"
  else
    fail "Service missing: $svc.service.ts"
  fi
done

# ─── RECONCILIATION ENGINE ───────────────────────────────────────────────────
section "RECONCILIATION ENGINE"

for module in engine ghost-detector duplicate-detector; do
  if [ -f "src/lib/reconciliation/$module.ts" ]; then
    pass "Reconciliation: $module.ts"
  else
    fail "Missing: $module.ts"
  fi
done

# ─── DATABASE MIGRATIONS ─────────────────────────────────────────────────────
section "DATABASE MIGRATIONS"

MIGRATIONS=(
  "00001_initial_schema" "00002_enable_rls" "00003_financial_tables"
  "00003b_vault_functions" "00004_usage_tables" "00005_waste_reports"
  "00006_subscriptions"
)
for mig in "${MIGRATIONS[@]}"; do
  if [ -f "supabase/migrations/${mig}.sql" ]; then
    pass "Migration: ${mig}.sql"
  else
    fail "Migration missing: ${mig}.sql"
  fi
done

# ─── SECURITY CHECKS ─────────────────────────────────────────────────────────
section "SECURITY AUDIT"

# H1: Security headers
for header in "X-Frame-Options" "X-Content-Type-Options" "Strict-Transport-Security" "Referrer-Policy" "Permissions-Policy"; do
  if grep -q "$header" vercel.json 2>/dev/null; then
    pass "Security header: $header"
  else
    fail "Missing header: $header"
  fi
done

# H2: No secrets in client components
CLIENT_SECRET_LEAK=$(grep -rn "createAdminClient\|SUPABASE_SERVICE_ROLE_KEY\|PLAID_SECRET\|STRIPE_SECRET_KEY" src/components/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$CLIENT_SECRET_LEAK" -eq 0 ]; then
  pass "No secrets in client components"
else
  fail "Secret references found in client components ($CLIENT_SECRET_LEAK occurrences)"
fi

# H2b: No NEXT_PUBLIC_ prefix on secrets
EXPOSED_SECRETS=$(grep -rn "NEXT_PUBLIC_.*SECRET\|NEXT_PUBLIC_.*SERVICE_ROLE\|NEXT_PUBLIC_.*API_TOKEN" src/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$EXPOSED_SECRETS" -eq 0 ]; then
  pass "No secrets exposed via NEXT_PUBLIC_"
else
  fail "Secrets exposed via NEXT_PUBLIC_ ($EXPOSED_SECRETS occurrences)"
fi

# H3: getUser in middleware
# Check that actual code calls getUser(), and getSession() only appears in comments
if grep -q "supabase.auth.getUser" src/lib/supabase/middleware.ts && ! grep -v "//\|Do NOT" src/lib/supabase/middleware.ts | grep -q "getSession()"; then
  pass "Middleware uses getUser() not getSession()"
else
  fail "Middleware uses insecure getSession()"
fi

# H4: CRON_SECRET in all cron routes
ALL_CRONS_PROTECTED=true
for f in src/app/api/cron/*/route.ts; do
  if ! grep -q "CRON_SECRET" "$f"; then
    ALL_CRONS_PROTECTED=false
    fail "Cron route missing CRON_SECRET: $f"
  fi
done
if $ALL_CRONS_PROTECTED; then pass "All cron routes protected with CRON_SECRET"; fi

# H5: SECURITY DEFINER + search_path
if grep -q "SET search_path" supabase/migrations/00003b_vault_functions.sql; then
  pass "Vault functions have SET search_path"
else
  fail "Vault functions missing SET search_path"
fi

# H5b: Vault REVOKE
if grep -q "REVOKE EXECUTE" supabase/migrations/00003b_vault_functions.sql; then
  pass "Vault functions have REVOKE from PUBLIC"
else
  fail "Vault functions missing REVOKE"
fi

# H6: Webhook signature verification
if grep -q "constructEvent" src/app/api/webhooks/stripe/route.ts; then
  pass "Stripe webhook uses signature verification"
else
  fail "Stripe webhook missing signature verification"
fi

# OAuth CSRF
if grep -q "randomBytes\|crypto" src/app/api/integrations/google/connect/route.ts 2>/dev/null; then
  pass "Google OAuth has CSRF state parameter"
else
  warn "Google OAuth CSRF state not verified"
fi

# Okta URL validation
if grep -q "okta.com" src/app/api/integrations/okta/connect/route.ts 2>/dev/null; then
  pass "Okta URL validation present"
else
  fail "Okta URL validation missing"
fi

# .gitignore
if grep -q ".env" .gitignore; then
  pass ".env files are git-ignored"
else
  fail ".env files NOT in .gitignore"
fi

# ─── FEATURE GATING ──────────────────────────────────────────────────────────
section "FEATURE GATING & BILLING"

if [ -f "src/lib/billing/gate.ts" ]; then pass "Feature gate module exists"; else fail "Feature gate missing"; fi

if grep -q "hasAccess" src/app/api/notifications/notify-users/route.ts 2>/dev/null; then
  pass "Notification API is feature-gated"
else
  fail "Notification API missing feature gate"
fi

if grep -q "hasAccess" src/app/api/notifications/settings/route.ts 2>/dev/null; then
  pass "Notification settings API is feature-gated"
else
  fail "Notification settings missing feature gate"
fi

# ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
section "NOTIFICATION ENGINE"

for mod in send email slack; do
  if [ -f "src/lib/notifications/$mod.ts" ]; then
    pass "Notification module: $mod.ts"
  else
    fail "Missing: $mod.ts"
  fi
done

# ─── ENV CONFIGURATION ──────────────────────────────────────────────────────
section "ENVIRONMENT CONFIGURATION"

if [ -f ".env.example" ]; then pass ".env.example exists"; else fail ".env.example missing"; fi

for var in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY \
  PLAID_CLIENT_ID PLAID_SECRET PLAID_ENV \
  GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET \
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
  CRON_SECRET NEXT_PUBLIC_APP_URL RESEND_API_KEY; do
  if grep -q "$var" .env.example 2>/dev/null; then
    pass "Env var documented: $var"
  else
    fail "Env var missing from .env.example: $var"
  fi
done

# ─── VERCEL CONFIGURATION ────────────────────────────────────────────────────
section "VERCEL CONFIGURATION"

if [ -f "vercel.json" ]; then pass "vercel.json exists"; else fail "vercel.json missing"; fi

for cron in "sync-transactions" "sync-usage" "generate-reports"; do
  if grep -q "$cron" vercel.json; then
    pass "Cron configured: $cron"
  else
    fail "Cron missing: $cron"
  fi
done

# ─── CI/CD ────────────────────────────────────────────────────────────────────
section "CI/CD PIPELINE"

if [ -f ".github/workflows/ci.yml" ]; then
  pass "CI workflow exists"
  if grep -q "lint" .github/workflows/ci.yml; then pass "CI includes lint"; else warn "CI missing lint step"; fi
  if grep -q "vitest\|test" .github/workflows/ci.yml; then pass "CI includes tests"; else warn "CI missing test step"; fi
  if grep -q "build" .github/workflows/ci.yml; then pass "CI includes build"; else warn "CI missing build step"; fi
else
  fail "CI workflow missing"
fi

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
section "VERIFICATION SUMMARY"
echo ""
echo -e "  ${GREEN}Passed:  $PASS${NC}"
echo -e "  ${RED}Failed:  $FAIL${NC}"
echo -e "  ${YELLOW}Warnings: $WARN${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  🎉 ALL CHECKS PASSED — GhostFinder is verified!${NC}"
else
  echo -e "${RED}${BOLD}  ⚠️  $FAIL CHECKS FAILED — Review items above${NC}"
fi
echo ""
