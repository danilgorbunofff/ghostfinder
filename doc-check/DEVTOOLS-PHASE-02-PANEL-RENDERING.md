# Phase 2 — Panel Rendering & Tab Mechanics

## Objective

Confirm the floating panel opens on button click, tabs switch correctly, and tab content renders. This phase isolates the **client-side React state machine** — if the panel never opens or tabs appear broken, the issue is in the toggle/tab logic, not the API.

---

## Architecture Overview

```
DevToolsPanel (default export)
  ├── State: open (boolean)  — controls panel visibility
  ├── State: tab (string)    — controls active tab
  ├── localStorage persist   — saves {open, tab} to 'ghostfinder-dev-panel'
  │
  ├── <button>               — floating gear, z-[9999], toggles open
  └── {open && <div>}        — conditional panel render, z-[9998]
       └── <Tabs>            — @base-ui/react v1.4.0 (NOT Radix)
            ├── Data          — DevDataTab
            ├── Conn          — DevConnectionsTab
            ├── Cron          — DevCronTab
            ├── Auth          — DevAuthTab
            └── State         — DevInspectTab
```

---

## Step 2.1 — Verify the toggle button works

1. Locate the floating gear button (bottom-right corner of the screen)
2. Click it once — the panel should appear above the button
3. Click again — the panel should disappear

### If clicking does nothing

Open Browser Console and run:

```javascript
// Find the button and inspect its React fiber
const btn = document.querySelector('[title="Dev Tools"]')
console.log('Button exists:', !!btn)
console.log('Click handlers:', btn?.onclick, btn?._reactEvents)
```

Then manually trigger a click:

```javascript
document.querySelector('[title="Dev Tools"]').click()
```

### Debug React state

If the button exists but clicking doesn't toggle the panel, the `setOpen` state updater may be broken. Add a temporary debug log:

```typescript
// src/components/dev/dev-tools-panel.tsx — line 42
<button
  onClick={() => {
    console.log('Toggle clicked, current open:', open)  // ← ADD THIS
    setOpen(o => !o)
  }}
```

### Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Click does nothing, no console errors | Event handler not attached (SSR hydration mismatch) | Clear `.next` cache, restart dev server |
| Click works but panel not visible | Panel renders but is off-screen or hidden | Check Step 2.3 |
| Button appears then disappears on hydration | localStorage has `{open: false}` from previous session | Clear localStorage (Step 2.4) |

---

## Step 2.2 — Verify the panel renders correctly

When the panel is open, verify the DOM structure:

```javascript
// Browser console
const panel = document.querySelector('.fixed.bottom-16.right-4')
console.log('Panel exists:', !!panel)
if (panel) {
  const rect = panel.getBoundingClientRect()
  console.table({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  })
}
```

**Expected dimensions**: 360px wide, positioned above the floating button (`bottom-16` = 64px from bottom).

### If the panel is in the DOM but invisible

Check computed styles:

```javascript
const panel = document.querySelector('.fixed.bottom-16.right-4')
const style = window.getComputedStyle(panel)
console.table({
  display: style.display,
  visibility: style.visibility,
  opacity: style.opacity,
  zIndex: style.zIndex,
  overflow: style.overflow,
  maxHeight: style.maxHeight,
  height: style.height,
})
```

Possible issues:
- `max-h-[520px]` combined with `overflow-hidden` and zero-height content → panel collapses to header-only
- `backdrop-blur-xl` can make the panel appear transparent on certain backgrounds
- `bg-background/95` with 95% opacity — if `--background` CSS variable is not set, panel is invisible

---

## Step 2.3 — Verify tabs switch correctly

The tabs use `@base-ui/react/tabs` (NOT Radix UI). The key API difference:

```typescript
// @base-ui/react v1.4.0 — Tabs.Root props
value?: any           // controlled value
onValueChange?: (value: any, eventDetails: ChangeEventDetails) => void

// Current code:
<Tabs value={tab} onValueChange={setTab}>
```

`setTab` receives `(value, eventDetails)` but only uses the first argument — this is **safe** in JavaScript (extra arguments are ignored).

### Manual tab switching test

1. Open the panel
2. Click each tab label: **Data**, **Conn**, **Cron**, **Auth**, **State**
3. For each tab, verify:
   - The tab header highlights/activates
   - Content below changes to match the tab
   - No console errors during switch

### Console verification

```javascript
// Watch tab changes in real-time
// Run this BEFORE clicking tabs
const observer = new MutationObserver(mutations => {
  mutations.forEach(m => {
    if (m.target.dataset?.slot === 'tabs-trigger') {
      console.log('Tab changed:', m.target.textContent, m.target.dataset)
    }
  })
})
observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-active'] })
```

### If tabs don't switch

Check if the `Tabs` component receives the props correctly:

```javascript
// In browser console — inspect the Tabs root element
const tabsEl = document.querySelector('[data-slot="tabs"]')
console.log('Tabs data-orientation:', tabsEl?.dataset?.orientation)
```

**Possible root cause**: The `value` prop type mismatch. `tab` state is `string | number` but tab values are strings (`"data"`, `"connections"`, etc.). If the initial value doesn't match any tab's `value` prop, no tab activates.

### Quick fix test

If tabs don't work, try switching to uncontrolled mode temporarily:

```typescript
// Replace:
<Tabs value={tab} onValueChange={setTab} ...>
// With:
<Tabs defaultValue="data" ...>
```

If uncontrolled works but controlled doesn't, the issue is in state management.

---

## Step 2.4 — Verify localStorage state restoration

The panel persists its state to localStorage under key `ghostfinder-dev-panel`:

```typescript
// On mount — restore
useEffect(() => {
  const saved = localStorage.getItem('ghostfinder-dev-panel')
  if (saved) {
    const { open: o, tab: t } = JSON.parse(saved)
    if (typeof o === 'boolean') setOpen(o)
    if (typeof t === 'string') setTab(t)
  }
}, [])

// On change — save
useEffect(() => {
  localStorage.setItem('ghostfinder-dev-panel', JSON.stringify({ open, tab }))
}, [open, tab])
```

### Inspect stored state

```javascript
// Browser console
const stored = localStorage.getItem('ghostfinder-dev-panel')
console.log('Stored state:', stored)
console.log('Parsed:', JSON.parse(stored))
```

### Common issues

| Stored value | Problem | Effect |
|-------------|---------|--------|
| `{"open":false,"tab":"data"}` | Panel was closed last session | Panel appears closed on load |
| `{"open":true,"tab":"inspect"}` | Valid — should restore correctly | Panel opens to State tab |
| `malformed json{` | Corrupted storage | Silent catch, panel stays at defaults |
| `{"open":true,"tab":42}` | Numeric tab not matching any trigger | Panel opens but no tab is active |

### Reset localStorage

```javascript
// Browser console — nuclear reset
localStorage.removeItem('ghostfinder-dev-panel')
location.reload()
```

After reload, the panel should start in its default state: closed, "data" tab selected.

---

## Step 2.5 — Check for hydration mismatches

The panel uses `dynamic(..., { ssr: false })` which prevents server rendering. However, the initial client render must match the "nothing rendered" state from the server.

### Detection

1. Browser Console → filter for warnings containing `hydration`
2. Look for:
   ```
   Warning: Expected server HTML to contain a matching <button> in <div>
   ```
   or:
   ```
   Hydration failed because the server rendered HTML didn't match the client.
   ```

### If hydration errors appear

The issue is that `DevToolsPanel` renders to the DOM before React hydration completes. Since it's loaded with `{ ssr: false }`, this shouldn't happen — but check:

1. Is `DevToolsLoader` actually using `dynamic()`?
2. Is there another import of `DevToolsPanel` that bypasses the dynamic wrapper?

```bash
# Search for direct imports of dev-tools-panel (bypassing the loader)
grep -r "dev-tools-panel" src/ --include='*.tsx' --include='*.ts' | grep -v 'dev-tools-loader'
```

If any file imports `dev-tools-panel` directly (not through `dev-tools-loader`), that import will SSR and cause hydration issues.

---

## Step 2.6 — Verify tab content components mount

Each tab is a separate component. If a tab's component throws during render, the error may be caught by a React error boundary (or crash the entire panel).

### Test each tab in isolation

```javascript
// Browser console — after opening the panel
const tabContents = document.querySelectorAll('[data-slot="tabs-content"]')
tabContents.forEach(tc => {
  console.log('Tab panel:', tc.dataset, 'Children:', tc.children.length, 'Visible:', tc.offsetParent !== null)
})
```

### Components that fetch on mount

**`DevAuthTab`** makes an API call on mount:

```typescript
useEffect(() => {
  run({ action: 'get-state' }).then(r => {
    if (r?.state) {
      setCurrentRole(r.state.user.role)
      setCurrentTier(r.state.subscription?.tier ?? 'free')
    }
  })
}, [])
```

If this `get-state` call fails (401, 404, network error), the Auth tab will render with default values but may appear broken. This is **not** a panel rendering issue — it's an API issue covered in Phase 3-4.

**`DevInspectTab`** (State tab) similarly loads state on mount. Same concern applies.

---

## Pass Criteria

| Check | Expected | How to verify |
|-------|----------|---------------|
| Button click toggles panel | Panel appears/disappears | Click the gear button |
| All 5 tabs are rendered | Data, Conn, Cron, Auth, State labels visible | Visual inspection |
| Tab switching works | Content changes per tab | Click each tab |
| No hydration warnings | Console clean of hydration errors | Console filter |
| localStorage saves state | `ghostfinder-dev-panel` key has valid JSON | Console: `localStorage.getItem(...)` |
| Tab content mounts | Each tab has child elements when active | Element inspector |

**If all checks pass** → Phase 2 cleared, proceed to Phase 3.
**If toggle/tabs broken** → Fix identified issue, clear `.next` and localStorage, restart.
