# Phase 3 — Auth Token Flow (Client → Server)

## Objective

Confirm the browser obtains a valid Supabase JWT access token and sends it to `/api/dev` with every request. If the token is missing, empty, or expired, the server returns `401 Unauthorized` — and because the error toast is hidden behind the panel (Phase 5), this failure is completely silent.

---

## Architecture Overview

```
Button Click in Tab Component
  │
  ▼
useDevAction().run({ action: 'seed-data' })
  │
  ├── 1. createClient()           ← createBrowserClient(URL, ANON_KEY)
  ├── 2. supabase.auth.getSession()  ← reads token from browser storage
  ├── 3. session?.access_token    ← extract JWT (or empty string)
  │
  ▼
fetch('/api/dev', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <jwt>',   ← THIS must be a valid, non-empty JWT
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ action: 'seed-data' })
})
```

---

## Step 3.1 — Verify Supabase client env vars exist

The browser Supabase client needs two `NEXT_PUBLIC_` vars:

```bash
grep 'NEXT_PUBLIC_SUPABASE' .env.local
```

**Expected output:**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### What each var does

| Variable | Purpose | Effect if missing |
|----------|---------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project endpoint | `createBrowserClient()` throws or creates a broken client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key for row-level security | Auth calls fail, `getSession()` returns null |

### Quick validation

```javascript
// Browser console
console.log('Supabase URL bundled:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'YES' : 'MISSING')
```

> Note: `NEXT_PUBLIC_` vars are replaced at build time. If they were missing when the dev server started, they won't appear even if you add them to `.env.local` without restarting.

---

## Step 3.2 — Verify the user has an active session

The hook calls `supabase.auth.getSession()` which reads the session from the browser's local storage (managed by `@supabase/ssr`).

### Check session in browser console

```javascript
// Create a Supabase client and check session
const { createBrowserClient } = await import('@supabase/ssr')
const sb = createBrowserClient(
  // These are inlined at build time, you may need the actual values
  document.querySelector('meta[name="supabase-url"]')?.content || 'CHECK_MANUALLY',
  'CHECK_MANUALLY'
)

// Easier method — check what's in storage
const keys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('sb-'))
console.log('Supabase storage keys:', keys)
keys.forEach(k => {
  try {
    const val = JSON.parse(localStorage.getItem(k))
    console.log(k, '→ has access_token:', !!val?.access_token, 'expires_at:', val?.expires_at)
  } catch {
    console.log(k, '→ raw:', localStorage.getItem(k)?.substring(0, 100))
  }
})
```

### If no session keys found

The user is not logged in. `getSession()` returns `{ data: { session: null } }` and the token becomes `''`.

Effect in `use-dev-action.ts`:

```typescript
const token = session?.access_token ?? ''
// token is '' → the Authorization header condition:
...(token ? { Authorization: `Bearer ${token}` } : {})
// '' is falsy → NO Authorization header sent → server returns 401
```

### Fix: Log in first

Navigate to `/login`, sign in with valid credentials, then return to the dashboard. The session will be stored by Supabase's auth module.

---

## Step 3.3 — Add temporary debug logging

Instrument the hook to see exactly what's happening:

```typescript
// src/components/dev/use-dev-action.ts — inside the run() callback

const supabase = createClient()
const { data: { session }, error: sessionError } = await supabase.auth.getSession()

// ── TEMPORARY DEBUG — REMOVE AFTER DIAGNOSIS ──
console.group(`[DevAction] ${payload.action}`)
console.log('Session exists:', !!session)
console.log('Session error:', sessionError)
console.log('Token (first 20 chars):', session?.access_token?.substring(0, 20) ?? 'NONE')
console.log('Token expires at:', session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A')
console.log('User ID:', session?.user?.id ?? 'NONE')
console.groupEnd()
// ── END DEBUG ──
```

### Interpretation

| Console output | Meaning | Action |
|----------------|---------|--------|
| `Session exists: false` | No auth session in browser | Log in at `/login` |
| `Session exists: true`, `Token: NONE` | Session exists but token field missing | Supabase client misconfigured |
| `Session exists: true`, `Token: eyJh...` | Token present | Move to Step 3.4 |
| `Token expires at: 2026-04-18T10:00:00Z` (in the past) | Token expired | Supabase should auto-refresh — check Step 3.5 |

---

## Step 3.4 — Verify the network request fires and carries the token

1. Open Browser DevTools → **Network** tab
2. Filter by: `dev` (to catch `/api/dev` requests)
3. Click any button in the dev tools panel (e.g., "Seed Full Demo Data")
4. Watch for a `POST` request to `/api/dev`

### If NO request appears

The `onClick` handler is not executing. Possible causes:
- Button is `disabled` (the `loading` state is stuck)
- JavaScript error thrown before `fetch()` is reached
- The `confirm()` dialog was cancelled (for destructive actions like "Delete All Data")

Check the Console for errors during the click.

### If the request appears — inspect it

**Request Headers** (click the request → Headers tab):

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

- If `Authorization` header is missing → token was empty (Step 3.2)
- If `Bearer ` is followed by nothing → same issue

**Request Body** (click the request → Payload tab):

```json
{"action":"seed-data"}
```

Verify the action name is correct and not `undefined`.

**Response** (click the request → Response tab):

| Status | Meaning | Next step |
|--------|---------|-----------|
| `200` | Success — action executed | Move to Phase 5 (check if you can SEE the result) |
| `401` | Token invalid or missing | Check server-side (Phase 4) |
| `404` | `MOCK_SERVICES` not set on server | Fix `.env.local`, restart |
| `400` | Unknown action name | Check request payload |
| `500` | Server error | Check server terminal logs |

---

## Step 3.5 — Check token expiry and auto-refresh

Supabase access tokens expire (default: 1 hour). The `@supabase/ssr` client should auto-refresh via the middleware.

### Check token expiry

```javascript
// Browser console — decode JWT payload (no library needed)
const keys = Object.keys(localStorage).filter(k => k.includes('sb-'))
const session = JSON.parse(localStorage.getItem(keys[0]))
if (session?.access_token) {
  const payload = JSON.parse(atob(session.access_token.split('.')[1]))
  const expiresAt = new Date(payload.exp * 1000)
  const now = new Date()
  console.log('Token expires:', expiresAt.toISOString())
  console.log('Current time:', now.toISOString())
  console.log('Expired:', expiresAt < now)
  console.log('Minutes remaining:', ((expiresAt - now) / 60000).toFixed(1))
}
```

### If token is expired

1. Refresh the page — the Supabase middleware should refresh the token
2. If still expired after refresh, the refresh token may also be expired (user needs to log in again)
3. Navigate to `/login`, sign in, return to dashboard

### If `getSession()` warns about using `getUser()` instead

Supabase v2+ has a distinction:
- `getSession()` — reads from local storage, does NOT validate with server
- `getUser()` — makes a server call to validate the token

For client-side token extraction, `getSession()` is correct. We're not validating here — the server does that. But check the Supabase version:

```bash
grep '"@supabase' package.json
```

If using `@supabase/ssr` >= 0.5.0, `getSession()` may log a console warning suggesting `getUser()`. This warning is informational and does NOT break the flow.

---

## Step 3.6 — Verify there are no CORS or middleware blocks

The request goes to `/api/dev` on the same origin, so CORS shouldn't apply. But verify:

### Check the middleware

```typescript
// src/proxy.ts — this is the Next.js middleware
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

This matcher includes ALL routes except static files — meaning `/api/dev` passes through the middleware. The middleware (`updateSession`) handles cookie-based session management for server components, but it does NOT block API routes.

### Verify middleware doesn't redirect API routes

The middleware in `src/lib/supabase/middleware.ts` has a guard:

```typescript
if (
  !user &&
  !request.nextUrl.pathname.startsWith('/api')  // ← API routes are NOT redirected
) {
  // redirect to /login
}
```

So `/api/dev` is allowed through even without cookies. Authentication is handled by the dev route's own `getAuthContext()` using the Bearer token.

---

## Pass Criteria

| Check | Expected | How to verify |
|-------|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` in bundle | Non-empty URL | Console or Sources tab |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` in bundle | Non-empty key | Console or Sources tab |
| Active session in localStorage | `sb-` key with `access_token` | Console: check localStorage |
| `getSession()` returns session | Debug log shows `Session exists: true` | Console after clicking action |
| Token is not expired | `Minutes remaining > 0` | JWT decode check |
| Network request fires | `POST /api/dev` appears in Network tab | Network tab |
| Authorization header present | `Bearer eyJ...` in request headers | Network tab → Headers |
| Response is not 401 | Status 200 or other non-auth error | Network tab → Status |

**If all checks pass** → Phase 3 cleared, proceed to Phase 4.
**If token is missing** → Log in, refresh page, restart dev server if env vars were missing.
**If request never fires** → Check Console for JS errors, check if button is disabled.
