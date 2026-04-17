# Phase 1 — Authentication Flow

> **Objective:** Verify the complete authentication loop — email signup, email login, Google OAuth, session management, redirect logic, and role-based access control. Every auth path must terminate correctly: successful login lands on `/`, failed login shows an error toast, unauthenticated requests redirect to `/login`.

---

## 1.1 Login Page

**File:** `src/app/(auth)/login/page.tsx`

### Functional checklist

| # | Test case | Expected behavior | data-testid |
|---|-----------|-------------------|-------------|
| 1 | Empty form submit | Button disabled or validation error shown | `login-submit` |
| 2 | Invalid email format | Client-side validation blocks submit | `login-email` |
| 3 | Wrong password | Error toast: "Invalid login credentials" | `login-error` |
| 4 | Correct credentials | Redirect to `/` (dashboard) | — |
| 5 | Google OAuth button | Triggers Supabase OAuth flow → Google consent screen | `login-google` |
| 6 | Already authenticated | Visiting `/login` redirects to `/` | — |

### Implementation details to verify
- Form uses controlled inputs (`useState` for email/password)
- Submit handler calls `supabase.auth.signInWithPassword()`
- Error handling wraps the call in try/catch, shows `toast.error()`
- On success: `router.push("/")` or `router.refresh()`
- Google OAuth: `supabase.auth.signInWithOAuth({ provider: "google" })`

### Visual/UX checks
- [ ] Auth background renders (gradient + animated dot grid)
- [ ] GhostFinder logo visible above form
- [ ] "Don't have an account? Sign up" link navigates to `/signup`
- [ ] Loading spinner on submit button while request is in-flight
- [ ] Form inputs have proper `type` attributes (`email`, `password`)

---

## 1.2 Signup Page

**File:** `src/app/(auth)/signup/page.tsx`

### Functional checklist

| # | Test case | Expected behavior | data-testid |
|---|-----------|-------------------|-------------|
| 1 | Valid signup | Shows "Check your email" confirmation | `signup-confirmation` |
| 2 | Weak password (<6 chars) | Submit blocked, strength indicator shows "Weak" | `signup-password` |
| 3 | Password strength: Fair | 6-9 chars with mixed content | — |
| 4 | Password strength: Good | 10+ chars with uppercase + lowercase | — |
| 5 | Password strength: Strong | 10+ chars + numbers + special chars | — |
| 6 | Google OAuth button | Same flow as login page | `signup-google` |
| 7 | Duplicate email | Error toast from Supabase | — |

### Password strength indicator logic
```
Weak:   < 6 chars OR low variety
Fair:   6-9 chars with mixed content
Good:   10+ chars with uppercase + lowercase
Strong: 10+ chars + numbers + special chars
```

### Implementation details to verify
- Calls `supabase.auth.signUp({ email, password })`
- On success: sets state to show confirmation message (NOT auto-redirect)
- Password strength computed on every keystroke
- Strength bar shows colored segments (red → orange → yellow → green)

---

## 1.3 OAuth Callback

**File:** `src/app/(auth)/callback/route.ts`

### Flow
```
Google OAuth → Supabase auth → redirect to /callback?code=xxx
                                    ↓
                          Exchange code for session
                                    ↓
                          ensureOrganization() safety net
                                    ↓
                          Redirect to / (dashboard)
```

### Checklist

| # | Check | Detail |
|---|-------|--------|
| 1 | Code exchange | `supabase.auth.exchangeCodeForSession(code)` |
| 2 | Organization safety net | Calls `ensureOrganization()` — creates org + membership if trigger missed |
| 3 | Error handling | Invalid/expired code → redirect to `/login?error=auth_callback_error` |
| 4 | No code param | Redirect to `/login` |

### File to verify
- `src/lib/supabase/ensure-org.ts` — `ensureOrganization(userId, email?, fullName?)`
  - Creates organization if none exists
  - Creates org_member with "owner" role
  - Idempotent: no-ops if org already exists

---

## 1.4 Session Middleware (Proxy)

**Files:**
- `src/proxy.ts` — Next.js 16 proxy convention
- `src/lib/supabase/middleware.ts` — `updateSession()` implementation

### Checklist

| # | Check | Detail |
|---|-------|--------|
| 1 | Proxy function exported | `export async function proxy(request)` |
| 2 | Calls `updateSession(request)` | Refreshes Supabase session cookies |
| 3 | Uses `getUser()` NOT `getSession()` | JWT validation, not just cookie read |
| 4 | Public routes bypassed | `/login`, `/signup`, `/callback`, `/api/*` skip auth redirect |
| 5 | Static assets excluded | Matcher: `/((?!_next/static|_next/image|favicon.ico|...))` |
| 6 | Unauthenticated redirect | Non-public routes → 302 to `/login` |
| 7 | Cookie rotation | Session cookies refreshed on valid requests |

### Security verification
```bash
# Unauthenticated → redirect
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/           # 302
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/inventory  # 302
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/settings   # 302

# Public routes → 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login      # 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/signup     # 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health # 200
```

---

## 1.5 Supabase Client Utilities

| File | Export | Usage |
|------|--------|-------|
| `src/lib/supabase/client.ts` | `createClient()` | Browser-side (createBrowserClient) |
| `src/lib/supabase/server.ts` | `createClient()` | Server Components & Route Handlers (createServerClient + cookies) |
| `src/lib/supabase/admin.ts` | `createAdminClient()` | Crons & backend (service_role key, bypasses RLS) |

### Verification
- Browser client: no service_role key, uses anon key + user cookies
- Server client: reads cookies from request, passes to Supabase
- Admin client: uses `SUPABASE_SERVICE_ROLE_KEY` — only used in crons, webhooks, and setup

---

## 1.6 Role-Based Access Control (RBAC)

### Role hierarchy
```
owner  → full access (includes danger zone)
admin  → manage connections, settings, billing (no danger zone)
member → read access + export (no connection management)
viewer → read-only (no export, no management)
```

### Permission matrix

| Action | owner | admin | member | viewer |
|--------|-------|-------|--------|--------|
| View all pages | ✅ | ✅ | ✅ | ✅ |
| Connect data sources | ✅ | ✅ | ❌ | ❌ |
| Manage org settings | ✅ | ✅ | ❌ | ❌ |
| Upgrade billing tier | ✅ | ✅ | ❌ | ❌ |
| Export CSV | ✅ | ✅ | ✅ | ❌ |
| Danger zone (delete) | ✅ | ❌ | ❌ | ❌ |

### Where RBAC is enforced
- **Server-side:** Dashboard layout fetches org membership + role → passes to components
- **Client-side:** Components conditionally render buttons/actions based on `role` prop
- **API routes:** Route handlers verify role via Supabase RLS + explicit checks

### How to test
Use the dev-tools fixture to switch roles:
```typescript
await devApi.switchRole('viewer');
// Verify connect buttons hidden
// Verify export disabled
// Verify danger zone tab absent
```

---

## 1.7 Auth Background Component

**File:** `src/components/auth/auth-background.tsx`

| Check | Detail |
|-------|--------|
| Gradient backdrop | `brand-muted → background` |
| Animated dot grid | 24×24px pattern |
| Radial overlay | Proper z-index layering |
| No layout shift | Background doesn't push form content |
| Dark mode | Colors adapt to theme |

---

## 1.8 E2E Test Coverage

### Spec files

| File | Tests | Coverage |
|------|-------|----------|
| `e2e/specs/auth/login.spec.ts` | ~5 | Form render, invalid creds, success redirect, OAuth button, auth redirect |
| `e2e/specs/auth/signup.spec.ts` | ~4 | Form render, email confirmation, weak password, OAuth button |
| `e2e/specs/auth/rbac-matrix.spec.ts` | ~6 | 4 roles × permission checks |

### Running auth E2E
```bash
npx playwright test e2e/specs/auth/ --project=chromium
```

### Test IDs used (from `e2e/helpers/selectors.ts`)
```typescript
auth: {
  loginEmail:    'login-email',
  loginPassword: 'login-password',
  loginSubmit:   'login-submit',
  loginGoogle:   'login-google',
  loginError:    'login-error',
  signupEmail:   'signup-email',
  signupPassword:'signup-password',
  signupSubmit:  'signup-submit',
  signupGoogle:  'signup-google',
  signupConfirmation: 'signup-confirmation',
}
```

---

## Exit Criteria

| Criteria | Status |
|----------|--------|
| Login with valid credentials → redirects to `/` | ☐ |
| Login with invalid credentials → error toast | ☐ |
| Signup → "Check your email" confirmation | ☐ |
| Password strength indicator updates correctly | ☐ |
| Google OAuth button initiates flow | ☐ |
| Callback exchanges code + creates org | ☐ |
| Unauthenticated `/inventory` → redirect to `/login` | ☐ |
| Public routes accessible without auth | ☐ |
| RBAC: viewer cannot see connect buttons | ☐ |
| RBAC: only owner sees danger zone | ☐ |
| All auth E2E specs pass | ☐ |

---

## Dependencies
- **Requires:** Phase 0 (build passes, Supabase running, seed data loaded)
- **Blocks:** Phases 2–10 (all dashboard pages require working auth)
