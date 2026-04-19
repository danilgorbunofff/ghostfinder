# Phase 5 — Toast & Visual Feedback Layer

## Objective

Confirm the user can actually **see** success/error feedback after dev tools actions. This phase exposes a critical design flaw: the Sonner toast container and the dev tools panel compete for the same screen real estate, and the panel's z-index wins — effectively hiding ALL feedback.

---

## Architecture Overview

```
Root Layout (src/app/layout.tsx)
  └── <Toaster position="bottom-right" />  ← z-index: ~1 (Sonner default)

Dashboard Layout (src/app/(dashboard)/layout.tsx)
  └── <DevToolsLoader />
       └── <DevToolsPanel />
            ├── Floating button ← z-index: 9999, bottom-right
            └── Panel           ← z-index: 9998, bottom-right

The toast renders BEHIND the panel → user sees nothing.
```

**This is the primary reason "nothing happens" appears true even when actions succeed.**

---

## Step 5.1 — Understand the z-index conflict

### Current z-index stack

| Element | Position | z-index | Visual layer |
|---------|----------|---------|-------------|
| Sonner toast container | `fixed`, bottom-right | ~1 (default) | **Bottom** |
| Dashboard content | `relative`, z-10 | 10 | Middle |
| Dev tools panel | `fixed`, bottom-right | 9998 | Top |
| Dev tools button | `fixed`, bottom-right | 9999 | Top |

The Sonner `<Toaster>` renders with a default z-index that is vastly lower than the dev panel's `9998`. Both are positioned `bottom-right`. Result: every toast notification — success, error, or network failure — is rendered directly behind the dev panel.

### Proof of concept

1. Open the dev tools panel
2. Click "Seed Full Demo Data"
3. **Immediately close the panel** (click the X or the floating button)
4. Watch for toast notifications that were queued while the panel was open

If toasts appear after closing the panel, this confirms the z-index collision.

---

## Step 5.2 — Verify toasts are actually being fired

Add temporary logging to confirm the toast system is invoked:

### In browser console (before clicking any button)

```javascript
// Monkey-patch Sonner's toast to log calls
const originalError = window.__SONNER_TOAST_ERROR
// OR: intercept the import
console.log('Toast patching — watch for [TOAST] logs after clicking dev buttons')
```

### Better approach — instrument the hook

Add debug lines to `use-dev-action.ts`:

```typescript
// After the fetch response check (line 35-36)
if (!res.ok || data.error) {
  console.error('[TOAST WOULD FIRE] Error:', data.error || `Action failed (${res.status})`)
  toast.error(data.error || `Action failed (${res.status})`)
  return null
}

// After successful mutation
console.log('[TOAST WOULD FIRE] Success — action:', payload.action, 'response:', data)
```

### Check: Does the tab component show a success toast?

Each tab has its own toast call after `run()` returns. For example, in `dev-data-tab.tsx`:

```typescript
onClick={async () => {
  const r = await run({ action: 'seed-data' })
  if (r) toast.success(r.message)  // ← only fires if run() returned non-null
}}
```

If `run()` returns `null` (error case), no success toast fires — but an error toast was already fired inside `run()`. Either way, a toast should fire. If you see nothing, it's being hidden.

---

## Step 5.3 — Verify the Toaster component is mounted

The `<Toaster>` is in the root layout, which wraps the entire app:

```typescript
// src/app/layout.tsx — lines 42-49
<Toaster
  position="bottom-right"
  richColors
  closeButton
  toastOptions={{
    duration: 4000,
  }}
/>
```

### Verify it's in the DOM

```javascript
// Browser console
const toasterEl = document.querySelector('[data-sonner-toaster]')
console.log('Toaster exists:', !!toasterEl)
if (toasterEl) {
  const style = window.getComputedStyle(toasterEl)
  console.table({
    position: style.position,
    zIndex: style.zIndex,
    bottom: style.bottom,
    right: style.right,
    pointerEvents: style.pointerEvents,
  })
}
```

### Check for competing Toaster instances

If there are multiple `<Toaster>` components mounted (e.g., one in root layout and another in a page), Sonner may behave unpredictably:

```bash
grep -r "<Toaster" src/ --include='*.tsx'
```

There should be exactly **one** `<Toaster>` in the entire app.

---

## Step 5.4 — Test toast visibility with the panel CLOSED

This is the definitive test:

1. **Close** the dev tools panel
2. Open browser Console
3. Run:
   ```javascript
   // Simulate a toast directly
   const { toast } = await import('sonner')
   toast.success('Test toast — can you see this?')
   toast.error('Test error toast — can you see this?')
   ```
4. Check the bottom-right corner — two toasts should appear

### If toasts appear when panel is closed

**Confirmed**: The z-index conflict is the problem. Toasts work fine; they're just hidden behind the panel.

### If toasts DON'T appear even with the panel closed

The toast system itself is broken. Check:
- Is Sonner installed? `grep sonner package.json`
- Is the `<Toaster>` in the DOM? (Step 5.3)
- Is there a CSS rule hiding toasts? Search for `[data-sonner-toast] { display: none }` in stylesheets

---

## Step 5.5 — Fix: Elevate Toaster z-index

The fix is straightforward — give the Toaster a z-index higher than the dev panel:

```typescript
// src/app/layout.tsx
<Toaster
  position="bottom-right"
  richColors
  closeButton
  toastOptions={{
    duration: 4000,
    className: 'z-[10000]',   // ← ADD THIS: above dev panel's 9999
  }}
  style={{ zIndex: 10000 }}    // ← ADD THIS: container z-index
/>
```

### Alternative: Use Sonner's `toastOptions.style`

```typescript
<Toaster
  position="bottom-right"
  richColors
  closeButton
  toastOptions={{
    duration: 4000,
    style: { zIndex: 10000 },
  }}
/>
```

### Alternative: Change toast position to avoid the panel

```typescript
<Toaster
  position="top-right"    // ← Move toasts to top-right, away from dev panel
  richColors
  closeButton
  toastOptions={{ duration: 4000 }}
/>
```

This avoids the z-index issue entirely since the dev panel is bottom-right and toasts would be top-right.

---

## Step 5.6 — Verify `router.refresh()` actually refreshes content

After every mutation, `use-dev-action.ts` calls:

```typescript
if (!READ_ACTIONS.has(payload.action)) {
  router.refresh()
}
```

`router.refresh()` in Next.js App Router:
- Re-runs server components without a full page reload
- Does NOT clear client-side state
- Does NOT scroll to top
- Re-fetches data from the server

### How to verify it works

1. Open the dev tools panel → Data tab
2. Click "Seed Full Demo Data"
3. **Close the panel** and look at the dashboard
4. If the dashboard shows seeded data (vendors, connections, etc.), `router.refresh()` is working
5. If the dashboard still shows empty state, `router.refresh()` might be broken

### Debug `router.refresh()`

```javascript
// Browser console — intercept the refresh call
const origRefresh = window.__NEXT_ROUTER_CONTEXT?.refresh
if (origRefresh) {
  window.__NEXT_ROUTER_CONTEXT.refresh = function() {
    console.log('[ROUTER] refresh() called at', new Date().toISOString())
    return origRefresh.apply(this, arguments)
  }
}
```

### Next.js 16 compatibility concern

If `router.refresh()` behavior changed in Next.js 16, mutations might succeed but the UI never reflects the change. Check:

```bash
# Look for Next.js migration docs
ls node_modules/next/dist/docs/ 2>/dev/null
# Or check the changelog
grep -i "refresh\|revalidate" node_modules/next/CHANGELOG.md 2>/dev/null | head -20
```

---

## Step 5.7 — Verify loading state feedback

Each button in the dev panel shows a `<Loader2>` spinner while the action runs. If the action completes instantly (or fails immediately), the spinner flashes too quickly to notice.

### The loading state flow

```typescript
// use-dev-action.ts
const [loading, setLoading] = useState<string | null>(null)

run = async (payload) => {
  setLoading(payload.action)     // ← START: spinner appears
  try {
    // ... fetch ...
  } finally {
    setLoading(null)             // ← END: spinner disappears
  }
}
```

### In tab components

```typescript
// Example from dev-data-tab.tsx
<Button disabled={loading === 'seed-data'}>
  {loading === 'seed-data' 
    ? <Loader2 className="h-3 w-3 animate-spin" />  // spinner
    : <Database className="h-3 w-3" />               // normal icon
  }
  Seed Full Demo Data
</Button>
```

### Verify loading state

1. Open Network tab → set throttling to "Slow 3G"
2. Click "Seed Full Demo Data"
3. The button should:
   - Become disabled (greyed out)
   - Show a spinning loader instead of the database icon
   - Re-enable after the response arrives

If the button never changes, the `loading` state is not being set — which means `run()` is not being called at all.

---

## Step 5.8 — Check for swallowed errors

The `use-dev-action` hook catches all errors:

```typescript
try {
  // ... all logic ...
} catch (e) {
  toast.error(`Network error: ${e}`)   // ← error toast (hidden behind panel)
  return null
} finally {
  setLoading(null)
}
```

And the tab components check the return value:

```typescript
const r = await run({ action: 'seed-data' })
if (r) toast.success(r.message)    // ← only on success
// If r is null (error), nothing else happens in the tab — error was already toasted in run()
```

**The design means every error path ends with a toast.** If you can't see toasts, you can't see errors. This creates the "nothing happens" experience.

---

## Pass Criteria

| Check | Expected | How to verify |
|-------|----------|---------------|
| Toast appears when panel is closed | Test toast visible in bottom-right | Console: `toast.success('test')` |
| Toast hidden when panel is open | Same toast not visible behind panel | Visual check |
| Loading spinner appears on click | Button icon changes to spinner | Slow 3G throttling |
| Button re-enables after action | Spinner returns to normal icon | Wait for response |
| `router.refresh()` triggers | Dashboard content updates after mutation | Close panel, check dashboard |

**If toasts work when panel is closed** → Apply the z-index fix (Step 5.5) and re-test with panel open. This may resolve the entire "nothing happens" issue.
**If toasts never appear** → Debug the Sonner installation (Step 5.3-5.4).
**If toasts appear but dashboard doesn't update** → Proceed to Phase 6 (cache invalidation).
