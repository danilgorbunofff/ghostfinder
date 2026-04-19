# Phase 1 — Environment Gating (Panel Visibility)

## Objective

Confirm the floating Dev Tools button renders in the browser DOM. The panel has a **two-layer environment gate** — if either layer fails, the panel is silently removed from the component tree and nothing is rendered. This is the single most common reason for "nothing happens."

---

## Architecture Overview

```
.env.local
  ├── NEXT_PUBLIC_MOCK_SERVICES=true   ← client reads this (compiled into JS bundle)
  └── MOCK_SERVICES=true               ← server reads this (runtime only)

src/app/(dashboard)/layout.tsx
  └── <DevToolsLoader />               ← mounted at bottom of dashboard shell

src/components/dev/dev-tools-loader.tsx
  ├── Guard 1: NODE_ENV !== 'development' → return null
  ├── Guard 2: NEXT_PUBLIC_MOCK_SERVICES !== 'true' → return null
  └── dynamic(() => import('./dev-tools-panel'), { ssr: false })
```

---

## Step 1.1 — Verify `.env.local` contains BOTH env vars

Open a terminal in the project root and run:

```bash
grep 'MOCK_SERVICES' .env.local
```

**Expected output (exactly 2 lines):**

```
MOCK_SERVICES=true
NEXT_PUBLIC_MOCK_SERVICES=true
```

### Why both are required

| Variable | Read by | Where checked | Effect if missing |
|----------|---------|---------------|-------------------|
| `NEXT_PUBLIC_MOCK_SERVICES` | Browser JS bundle | `dev-tools-loader.tsx` line 9 | Panel never mounts — button invisible |
| `MOCK_SERVICES` | Node.js server runtime | `api/dev/route.ts` line 10 | API returns 404 for every request — actions silently fail |

These are **independent variables**. `NEXT_PUBLIC_` prefix makes the var available to client-side code at build time. The server-only `MOCK_SERVICES` is only available in API routes and server components.

### Common mistakes

| Mistake | Symptom |
|---------|---------|
| Only `MOCK_SERVICES=true` | Button invisible, no panel rendered |
| Only `NEXT_PUBLIC_MOCK_SERVICES=true` | Button visible, every action returns 404 |
| Both set to `false` | Complete silence — nothing anywhere |
| Vars in `.env` instead of `.env.local` | Works until `.env.local` overrides with blanks |
| Trailing whitespace: `MOCK_SERVICES=true ` | String comparison `!== 'true'` fails |

### Fix (if missing)

```bash
# Add both vars if not present
echo 'MOCK_SERVICES=true' >> .env.local
echo 'NEXT_PUBLIC_MOCK_SERVICES=true' >> .env.local
```

> **Critical**: After changing any `NEXT_PUBLIC_*` variable, you MUST restart the dev server. These values are inlined into the JS bundle at compile time — hot reload does NOT pick them up.

---

## Step 1.2 — Verify the app runs in development mode

```bash
# Check the running process
ps aux | grep 'next dev'
```

If the app was started with `next build && next start` or `npm run start`, `NODE_ENV` will be `production` and the first guard in `dev-tools-loader.tsx` returns null.

### The guard in code

```typescript
// src/components/dev/dev-tools-loader.tsx — line 8
if (process.env.NODE_ENV !== 'development') return null
```

`NODE_ENV` is set automatically by Next.js:
- `next dev` → `NODE_ENV = 'development'`
- `next build` / `next start` → `NODE_ENV = 'production'`

### Verification

```bash
# Correct way to start for dev tools
npm run dev
# or
npx next dev
```

Check the terminal output for:
```
▲ Next.js 16.x.x
- Local: http://localhost:3000
- Environments: .env.local
```

The `Environments: .env.local` line confirms Next.js loaded your env file.

---

## Step 1.3 — Verify the button exists in the DOM

1. Open `http://localhost:3000` in the browser (must be a dashboard page, not `/login`)
2. Open Browser DevTools → **Elements** tab
3. Press `Cmd+F` (macOS) or `Ctrl+F` (Windows/Linux) to search the DOM
4. Search for: `Dev Tools`

**Expected**: A `<button>` element with `title="Dev Tools"`:

```html
<button
  class="fixed bottom-4 right-4 z-[9999] h-10 w-10 rounded-full ..."
  title="Dev Tools"
>
  <svg><!-- Settings gear icon --></svg>
</button>
```

### If NOT found in DOM

The component returned `null` before reaching the button render. Diagnóstic:

1. Open **Console** tab
2. Type:
   ```javascript
   // Check what the client bundle received
   console.log('NODE_ENV:', process.env.NODE_ENV)
   ```
   > Note: `NEXT_PUBLIC_MOCK_SERVICES` is replaced at build time, so you can't read it at runtime. Instead check the compiled bundle.

3. To verify the bundled value, search the Network tab for the chunk containing `dev-tools-loader`:
   - **Sources** tab → `Cmd+P` → type `dev-tools-loader`
   - Look for the compiled guard: the value will be inlined as a string literal like `"true" !== 'true'` (pass) or `"false" !== 'true'` (fail)

### If found in DOM but not visible

The button uses `fixed` positioning with `bottom-4 right-4 z-[9999]`. Check:

```javascript
// In browser console
const btn = document.querySelector('[title="Dev Tools"]')
if (btn) {
  const rect = btn.getBoundingClientRect()
  const style = window.getComputedStyle(btn)
  console.table({
    bottom: rect.bottom,
    right: rect.right,
    width: rect.width,
    height: rect.height,
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    zIndex: style.zIndex,
  })
}
```

Common visibility killers:
- Parent has `overflow: hidden` and the button overflows (unlikely with `fixed`)
- Another element with higher z-index covers it
- CSS `display: none` from a media query

---

## Step 1.4 — Verify the dynamic import loads successfully

The panel is loaded via Next.js `dynamic()` with SSR disabled:

```typescript
// src/components/dev/dev-tools-loader.tsx — line 5
const DevToolsPanel = dynamic(() => import('./dev-tools-panel'), { ssr: false })
```

### Check for import errors

1. Browser DevTools → **Console** tab
2. Filter by `Error` level
3. Look for:
   - `ChunkLoadError` — network failure loading the lazy chunk
   - `TypeError: Cannot read property...` — the imported module threw during initialization
   - `Failed to fetch dynamically imported module` — file doesn't exist or build is stale

### Force reimport

```bash
# Clear Next.js compile cache and restart
rm -rf .next
npm run dev
```

### Verify the chunk exists

After the dev server starts, check that the dynamic chunk resolves:

1. **Network** tab → filter by `JS`
2. Navigate to a dashboard page
3. Look for a chunk containing `dev-tools-panel` in the filename
4. Status should be `200`, not `404`

---

## Step 1.5 — Verify `<DevToolsLoader />` is mounted in the layout

The loader component must be present in the dashboard layout tree.

```typescript
// src/app/(dashboard)/layout.tsx — bottom of the return
return (
  <div className="relative flex h-screen overflow-hidden">
    {/* ... sidebar, header, main ... */}
    <DevToolsLoader />   // ← Must exist here
  </div>
)
```

### If missing

The `<DevToolsLoader />` import and usage must be present:

```typescript
import { DevToolsLoader } from '@/components/dev/dev-tools-loader'
// ... at bottom of the layout JSX:
<DevToolsLoader />
```

If you're on a non-dashboard page (e.g., `/login`, `/signup`), the dashboard layout doesn't wrap that page, so dev tools won't appear.

---

## Pass Criteria

| Check | Expected | Tool |
|-------|----------|------|
| `.env.local` has `MOCK_SERVICES=true` | grep shows the line | Terminal |
| `.env.local` has `NEXT_PUBLIC_MOCK_SERVICES=true` | grep shows the line | Terminal |
| App started with `next dev` | Terminal shows `NODE_ENV: development` | Terminal |
| Settings button in DOM | `<button title="Dev Tools">` found | Elements inspector |
| No dynamic import errors | Console clean of chunk errors | Console |
| Button visible on screen | Floating circle bottom-right corner | Visual |

**If all checks pass** → Phase 1 cleared, proceed to Phase 2.
**If any check fails** → Fix the identified issue, restart dev server, re-verify.
