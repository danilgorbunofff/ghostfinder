# Phase 7 — Billing

> **Objective:** The billing page renders three pricing tiers with correct visual hierarchy, the monthly/annual toggle updates prices, the Stripe checkout flow completes successfully, the billing portal opens for managing subscriptions, and the Stripe webhook correctly processes subscription lifecycle events. Feature gating enforces tier restrictions throughout the app.

---

## 7.1 Billing Page (Server Component)

**File:** `src/app/(dashboard)/billing/page.tsx`

### Data fetching
```sql
-- Current subscription
SELECT tier, status, stripe_subscription_id, stripe_customer_id
FROM subscriptions
WHERE org_id = ? AND status IN ('active', 'past_due', 'trialing');

-- Usage stats
SELECT COUNT(*) as vendor_count FROM saas_vendors WHERE org_id = ?;
SELECT COUNT(*) as ghost_count FROM waste_reports WHERE org_id = ?
  ORDER BY created_at DESC LIMIT 1;  -- from latest report ghost_seats JSONB
```

### Page layout
```
┌──────────────────────────────────────────────────────┐
│  ⚠️ Past-due banner (if applicable — sticky, pulsing) │
├──────────────────────────────────────────────────────┤
│  Billing & Plans                                      │
│  [Monthly] [Annual — Save 15%]  ← toggle              │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  FREE    │  │  ★ MONITOR      │  │  RECOVERY    │ │
│  │          │  │  Recommended     │  │  Max Savings │ │
│  │  $0/mo   │  │  $XX/mo         │  │  $XX/mo      │ │
│  │          │  │  (scaled 1.03x) │  │  (amber grad)│ │
│  │  ○ Basic │  │  ✓ Reports      │  │  ✓ All of    │ │
│  │  ○ 5 ven │  │  ✓ Ghost seats  │  │    Monitor   │ │
│  │          │  │  ✓ Duplicates   │  │  ✓ Notifs    │ │
│  │  Current │  │  [Upgrade]      │  │  ✓ Recovery  │ │
│  └──────────┘  └─────────────────┘  └──────────────┘ │
│                                                       │
├──────────────────────────────────────────────────────┤
│  📊 Your Usage                                        │
│  Vendors scanned: X    Ghost seats found: X           │
├──────────────────────────────────────────────────────┤
│  📋 FAQ (accordion)                                   │
│  ▸ What is a ghost seat?                              │
│  ▸ How does the Monitor plan work?                    │
│  ▸ Can I downgrade later?                             │
│  ▸ How is billing handled?                            │
└──────────────────────────────────────────────────────┘
```

---

## 7.2 Pricing Tiers

### Tier definitions

| Tier | Price (monthly) | Price (annual) | Features |
|------|----------------|----------------|----------|
| **Free** | $0 | $0 | Basic dashboard, 5 vendor limit, no reports |
| **Monitor** | env var | -15% | Reports, ghost seats, duplicates, unlimited vendors |
| **Recovery** | env var | -15% | All Monitor + Slack/email notifications, recovery tracking |

### Visual hierarchy

| Tier | Styling | Badge |
|------|---------|-------|
| Free | Muted card, standard border | — |
| Monitor | Scaled 1.03x, brand accent top bar, ring | "Recommended" |
| Recovery | Amber gradient header, premium styling | "Maximum Savings" |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | 3 tier cards render | Free, Monitor, Recovery |
| 2 | Monitor is visually prominent | Scaled, accent bar, "Recommended" badge |
| 3 | Recovery has premium styling | Amber gradient, "Maximum Savings" badge |
| 4 | Current plan indicator | Active tier shows "Current Plan" label |
| 5 | Feature lists correct | Each tier shows included features |
| 6 | Price IDs from env vars | `NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID`, `NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID` |
| 7 | Responsive layout | Cards stack on mobile, side-by-side on desktop |

---

## 7.3 Monthly/Annual Toggle

**File:** `src/app/(dashboard)/billing/billing-toggle.tsx`

### Behavior
- Default: Monthly selected
- Annual: Shows 15% discount badge
- Switching updates all tier prices simultaneously
- Animation: Smooth transition on toggle

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Toggle renders | Monthly / Annual options |
| 2 | "Save 15%" badge | Visible on Annual option |
| 3 | Click toggles | Prices update across all 3 tiers |
| 4 | Correct calculation | Annual = monthly × 12 × 0.85 |
| 5 | Price animation | Smooth number transition |
| 6 | Stripe price IDs switch | Monthly → annual price IDs |

---

## 7.4 Upgrade Flow

**Component:** `src/components/billing/upgrade-button.tsx`

### Flow
```
1. Click "Upgrade" on tier card
2. Confirmation dialog opens:
   - "Upgrade to {tier}?"
   - Shows price per month/year
   - Confirm / Cancel buttons
3. On confirm: POST /api/billing/checkout
4. Response: { url: "https://checkout.stripe.com/..." }
5. Redirect to Stripe Checkout
6. User completes payment
7. Stripe sends webhook → subscription activated
8. User redirected to success URL → billing page
```

### API Route: `src/app/api/billing/checkout/route.ts`

| Check | Detail |
|-------|--------|
| Auth required | Validates user session |
| Role gate | Only owner/admin can upgrade |
| Creates/gets Stripe customer | `getOrCreateStripeCustomer()` |
| Creates checkout session | With correct price ID (monthly or annual) |
| Success URL | `/billing?success=true` |
| Cancel URL | `/billing?canceled=true` |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Upgrade button visible | On non-current tier cards |
| 2 | Confirmation dialog | Shows tier name + price |
| 3 | Role gate enforced | Member/viewer cannot upgrade |
| 4 | Stripe redirect | Opens Stripe Checkout |
| 5 | Correct price ID | Matches selected billing period |
| 6 | Loading state | Spinner on button during redirect |
| 7 | Cancel returns | Back to billing page |
| 8 | Success returns | Billing page with success state |
| 9 | Error handling | Toast on API failure |

---

## 7.5 Manage Subscription

**Component:** `src/components/billing/manage-button.tsx`

### Flow
```
Click "Manage Subscription"
  → POST /api/billing/portal
  → Response: { url: "https://billing.stripe.com/..." }
  → Redirect to Stripe Billing Portal
  → User can: change card, cancel, view invoices
  → Return URL: /billing
```

### API Route: `src/app/api/billing/portal/route.ts`

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Button visible | Only for paid tiers (Monitor, Recovery) |
| 2 | Button hidden | For Free tier |
| 3 | Portal opens | Stripe Billing Portal loads |
| 4 | Return URL | Back to `/billing` |
| 5 | Loading state | Spinner during redirect |
| 6 | Error handling | Toast on failure |

---

## 7.6 Stripe Webhook

**File:** `src/app/api/webhooks/stripe/route.ts`

### Events handled

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Upsert subscription row (tier, status, stripe refs) |
| `customer.subscription.updated` | Update tier/status (e.g., upgrade, downgrade, pause) |
| `customer.subscription.deleted` | Set status to 'canceled', tier to 'free' |
| `invoice.payment_succeeded` | Update status to 'active' |
| `invoice.payment_failed` | Update status to 'past_due' |

### Security: Webhook signature verification
```typescript
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET!
);
```

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Signature verified | Rejects requests with invalid/missing signature |
| 2 | subscription.created | Creates subscription row |
| 3 | subscription.updated | Updates tier and status |
| 4 | subscription.deleted | Sets to free/canceled |
| 5 | payment_succeeded | Status → active |
| 6 | payment_failed | Status → past_due |
| 7 | Unknown events | Returns 200 (no error, just ignored) |
| 8 | Idempotent | Processing same event twice doesn't corrupt data |

---

## 7.7 Past-Due Warning Banner

### Conditions
- Subscription status = 'past_due'

### Display
- Sticky banner at top of billing page
- Pulsing red/amber indicator dot
- Message: "Your payment is past due. Please update your payment method."
- CTA: "Manage Subscription" button

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Shows when past_due | Banner visible |
| 2 | Hidden when active | Banner not rendered |
| 3 | Sticky position | Stays at top on scroll |
| 4 | Pulsing indicator | Animated dot |
| 5 | CTA opens portal | Navigates to Stripe Billing Portal |

---

## 7.8 FAQ Accordion

### Questions

| # | Question |
|---|----------|
| 1 | What is a ghost seat? |
| 2 | How does the Monitor plan work? |
| 3 | Can I downgrade later? |
| 4 | How is billing handled? |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | 4 questions render | All visible in collapsed state |
| 2 | Click expands | Answer text appears with animation |
| 3 | Click collapses | Answer hides |
| 4 | Only one open | Accordion behavior (others close when one opens) |
| 5 | Accessible | keyboard nav (Enter/Space to toggle) |

---

## 7.9 Feature Gating

**File:** `src/lib/billing/gate.ts`

### Tier levels
```typescript
const TIER_LEVELS = { free: 0, monitor: 1, recovery: 2 };
```

### Feature gates

| Feature key | Required tier |
|-------------|--------------|
| `reports.view` | monitor |
| `reports.history` | monitor |
| `ghost-seats.list` | monitor |
| `duplicates.list` | monitor |
| `notifications.slack` | recovery |
| `notifications.email` | recovery |
| `notifications.send` | recovery |
| `recovery.tracking` | recovery |

### Functions

| Function | Input | Output |
|----------|-------|--------|
| `hasAccess(tier, feature)` | tier string, feature key | boolean |
| `getOrgTier(supabase, orgId)` | Supabase client, org ID | tier string |
| `getRequiredTier(feature)` | feature key | tier string |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Free → reports | `hasAccess('free', 'reports.view')` = false |
| 2 | Monitor → reports | `hasAccess('monitor', 'reports.view')` = true |
| 3 | Monitor → notifications | `hasAccess('monitor', 'notifications.slack')` = false |
| 4 | Recovery → everything | `hasAccess('recovery', 'notifications.slack')` = true |
| 5 | Unknown feature | Defaults to allowed (fail-open for safety) |
| 6 | `getRequiredTier` | Returns minimum tier name for paywall text |

### Where gating is enforced
- Reports page: checks before rendering report content
- Notifications tab: shows upgrade prompt for non-Recovery
- Notify button: disabled with upgrade message
- API routes: return 403 for insufficient tier

---

## 7.10 Stripe Service

**File:** `src/lib/services/stripe.service.ts`

| Function | Purpose |
|----------|---------|
| `getOrCreateStripeCustomer(orgId, orgName, email)` | Find or create Stripe customer |
| `createCheckoutSession(customerId, priceId, orgId, successUrl, cancelUrl)` | Create Checkout session |
| `createBillingPortalSession(customerId, returnUrl)` | Create portal session |
| `reportRecoveryUsage(subscriptionItemId, savingsAmount, rate)` | Usage-based billing events |
| `cancelSubscription(subscriptionId)` | Cancel subscription |
| `reactivateSubscription(subscriptionId)` | Reactivate canceled sub |

---

## 7.11 E2E Test Coverage

### Spec file: `e2e/specs/billing/tiers.spec.ts`

| Test | Assertion |
|------|-----------|
| 3 tier cards render | Free, Monitor, Recovery visible |
| Current plan indicator | Active tier marked |
| Monthly/annual toggle | Prices update |
| Upgrade button (mock) | Confirmation dialog opens |
| Manage button visible | For paid tiers only |
| Past-due banner | Shows for past_due status |
| FAQ accordion | All 4 questions expand |

### Test IDs (from `e2e/helpers/selectors.ts`)
```typescript
billing: {
  freeTier:       'tier-free',
  monitorTier:    'tier-monitor',
  recoveryTier:   'tier-recovery',
  billingToggle:  'billing-toggle',
  upgradeButton:  'upgrade-button',
  upgradeConfirm: 'upgrade-confirm',
  manageButton:   'manage-subscription',
  pastDueBanner:  'past-due-banner',
}
```

### Running billing E2E
```bash
npx playwright test e2e/specs/billing/ --project=chromium
```

---

## Exit Criteria

| Criteria | Status |
|----------|--------|
| 3 pricing tiers render with correct features | ☐ |
| Monitor card is visually prominent (recommended) | ☐ |
| Monthly/annual toggle updates all prices | ☐ |
| 15% annual discount calculation correct | ☐ |
| Current plan indicator on active tier | ☐ |
| Upgrade button opens confirmation dialog | ☐ |
| Upgrade redirects to Stripe Checkout | ☐ |
| Role gate: member/viewer cannot upgrade | ☐ |
| Manage button opens Stripe Portal | ☐ |
| Manage button hidden for Free tier | ☐ |
| Stripe webhook: signature verified | ☐ |
| Stripe webhook: subscription events update DB | ☐ |
| Past-due banner shows with pulsing indicator | ☐ |
| FAQ accordion: 4 questions expand/collapse | ☐ |
| Feature gating: correct tier/feature matrix | ☐ |
| Usage stats display correct numbers | ☐ |
| All billing E2E specs pass | ☐ |

---

## Dependencies
- **Requires:** Phase 0 (build), Phase 1 (auth), Phase 3 (layout)
- **Feeds into:** Phase 6 (Reports — tier gates report access), Phase 8 (Settings — notification tier gate)
- **Blocks:** None
