# Phase 6 — Waste Reports

> **Objective:** The reports page renders waste analysis correctly — hero summary, ghost seat findings with severity grading, duplicate vendor detection with category grouping, notification delivery, and report history. The reconciliation engine (ghost detector + duplicate detector) produces accurate results. Export and notify buttons function correctly.

---

## 6.1 Reports Page (Server Component)

**File:** `src/app/(dashboard)/reports/page.tsx`

### Data fetching
```sql
-- Latest report
SELECT * FROM waste_reports WHERE org_id = ? ORDER BY created_at DESC LIMIT 1;

-- Report history (for selector)
SELECT id, created_at, 
  (data->'summary'->>'monthlyWaste')::numeric as monthly_waste
FROM waste_reports WHERE org_id = ? ORDER BY created_at DESC LIMIT 12;

-- Subscription tier (for feature gating)
SELECT tier FROM subscriptions WHERE org_id = ? AND status = 'active';
```

### Page layout
```
┌─────────────────────────────────────────────────┐
│  Report Selector dropdown  [Export] [Notify]     │
├─────────────────────────────────────────────────┤
│  💰 HERO: Estimated Monthly Waste               │
│  $X,XXX/mo          Annual: $XX,XXX/yr          │
├──────────┬──────────┬───────────────────────────┤
│  Ghost   │  Dupli-  │  Opportunities            │
│  Seats   │  cates   │  X actionable             │
│  X found │  X found │  findings                 │
├──────────┴──────────┴───────────────────────────┤
│                                                  │
│  👻 Ghost Seats (by vendor)                      │
│  ┌───────────────────────────────────────────┐  │
│  │ ▌ Salesforce — 8 ghost seats — $960/mo    │  │
│  │   user1@co, user2@co, user3@co  [+5 more] │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ ▌ Zoom — 12 ghost seats — $120/mo         │  │
│  │   user4@co, user5@co  [+10 more]          │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  🔄 Duplicate Subscriptions                      │
│  ┌───────────────────────────────────────────┐  │
│  │ Video Conferencing                         │  │
│  │ Zoom ($450) + Teams ($—) = $450/mo         │  │
│  │ Potential savings: $225/mo                  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 6.2 Hero Waste Summary

### Displayed values

| Metric | Source | Format |
|--------|--------|--------|
| Monthly waste | `report.data.summary.monthlyWaste` | `$X,XXX/mo` |
| Annual projection | Monthly × 12 | `$XX,XXX/yr` |
| Ghost seat count | `report.data.ghostSeats.length` | Integer |
| Duplicate count | `report.data.duplicates.length` | Integer |
| Opportunities | Ghost seats + duplicates | Integer |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Hero card renders | Large waste amount, orange accent |
| 2 | Annual projection | Correct × 12 calculation |
| 3 | 3 detail cards | Ghost seats, duplicates, opportunities |
| 4 | Empty state | "No reports yet" with CTA to connect data sources |
| 5 | Animation | Fade-in + count-up on load |

---

## 6.3 Ghost Seats Section

### Data structure (from reconciliation engine)
```typescript
interface GhostSeatFinding {
  vendor: string;
  normalizedName: string;
  monthly_cost: number;
  per_seat_cost: number;
  total_seats: number;
  active_seats: number;
  ghost_seats: number;
  monthly_waste: number;
  inactiveUsers: {
    email: string;
    displayName: string;
    lastLogin: string;
    daysSinceLogin: number;
    provider: 'okta' | 'google';
  }[];
}
```

### Severity grading (by days since last login)

| Days inactive | Severity | Border color | Text color |
|---------------|----------|-------------|------------|
| 90+ days | Critical | Red-500 | Red |
| 60-89 days | High | Orange-500 | Orange |
| 30-59 days | Medium | Amber-500 | Amber |

### Per-vendor card content
- Vendor name + severity border (left)
- Ghost seat count + monthly waste
- Per-seat cost
- Collapsible user list: 3 preview + "Show X more" expandable

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Cards render per vendor | Sorted by waste descending |
| 2 | Severity border color | Matches days-since-login threshold |
| 3 | Ghost count correct | Matches `ghost_seats` value |
| 4 | Monthly waste correct | `ghost_seats × per_seat_cost` |
| 5 | User list preview | Shows 3 users initially |
| 6 | Expand shows all | Click "Show X more" reveals full list |
| 7 | Collapse works | Can toggle back to 3-user preview |
| 8 | User display | Email + "X days ago" relative time |
| 9 | Provider badge | Okta / Google badge per user |
| 10 | Empty state | "No ghost seats detected" if array empty |

### Seed data expected
With 15 user activity records (mixed active/inactive across 10 vendors), expect:
- Multiple vendors with ghost seats
- Varying severity levels based on `last_login` dates in seed

---

## 6.4 Duplicates Section

### Data structure (from reconciliation engine)
```typescript
interface DuplicateFinding {
  category: string;
  vendors: { name: string; monthly_cost: number }[];
  combined_cost: number;
  potential_savings: number;
  recommendation: string;
}
```

### Duplicate category groups (12 defined)
```
Video Conferencing:  zoom, teams, google_meet, webex, goto_meeting
Project Management:  asana, monday, jira, linear, clickup, trello, basecamp, notion
Communication:       slack, teams, discord, google_chat
Cloud Storage:       dropbox, google_drive, box, onedrive, icloud
CRM:                 salesforce, hubspot, pipedrive, zoho, close
Email Marketing:     mailchimp, sendgrid, constant_contact, campaign_monitor, convertkit
Design:              figma, adobe, canva, sketch, invision
Customer Support:    zendesk, intercom, freshdesk, helpscout, drift
Password Mgmt:       1password, lastpass, dashlane, bitwarden, keeper
Productivity:        microsoft, google_workspace
Documentation:       notion, confluence, gitbook, slite, coda
CI/CD:               github, gitlab, bitbucket, circleci, jenkins
```

### Per-category card content
- Category name
- Vendor list with individual costs
- Combined cost
- Potential savings (recommendation: keep cheapest, consolidate)
- Recommendation text

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Categories render | One card per detected category with 2+ vendors |
| 2 | Vendor list correct | Names + costs match DB |
| 3 | Combined cost correct | Sum of all vendor costs in category |
| 4 | Savings correct | Combined minus cheapest vendor |
| 5 | Recommendation text | Actionable advice |
| 6 | **Grid layout** | **Known gap: verify comparison grid is complete, not broken** |
| 7 | Empty state | "No duplicates detected" if array empty |

### Known issue
> The duplicate vendor comparison grid may be incomplete. Verify the rendering logic handles all 12 category groups correctly, including categories where only 1 vendor exists (should be filtered out).

---

## 6.5 Report Selector

### Functionality
- Dropdown with last 12 reports
- Each option: date + waste amount
- Selecting a report switches the entire page to that report's data

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Dropdown renders | Shows report dates |
| 2 | Latest selected by default | Most recent report active |
| 3 | Switch report | Page data updates to selected report |
| 4 | Date formatting | "Mon DD, YYYY" or relative |
| 5 | Waste preview | Shows waste amount per report |

---

## 6.6 Export Button

**Location:** `src/app/(dashboard)/reports/page.tsx` (line 104)

**Current state:** `<Button variant="outline" size="sm" disabled className="gap-2">`

### Issue
The export button is **permanently disabled** with no tooltip or explanation. This is a UX dead-end.

### Recommendation options

| Option | Effort | Implementation |
|--------|--------|----------------|
| A. Remove button | Low | Delete the button entirely |
| B. "Coming soon" tooltip | Low | Add tooltip: "Export coming soon" |
| C. Implement CSV export | Medium | Export ghost seats + duplicates as CSV |
| D. Implement PDF export | High | Generate PDF report with charts |

### If implementing CSV export
```
Headers: Vendor, Ghost Seats, Monthly Waste, Days Inactive, Category
Data: One row per ghost seat finding
```

---

## 6.7 Notify Button

**Component:** `src/components/reports/notify-button.tsx`

### Behavior
```
Click "Notify Team"
  → POST /api/notifications/notify-users with reportId
  → Sends Slack webhook (if configured)
  → Sends email to recipients (if configured)
  → Toast: "Notification sent!" or error
```

### Feature gates

| Condition | Button state |
|-----------|-------------|
| Free tier | Disabled + "Upgrade to Recovery" tooltip |
| Monitor tier | Disabled + "Upgrade to Recovery" tooltip |
| Recovery tier, no webhook configured | Disabled + "Configure in Settings" tooltip |
| Recovery tier, webhook configured | Enabled |
| Already sent for this report | Disabled + "Already sent" |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Button renders | "Notify Team" with bell icon |
| 2 | Tier gate works | Disabled for free/monitor |
| 3 | No webhook gate | Disabled with config message |
| 4 | Click sends notification | POST to notify-users endpoint |
| 5 | Slack message sent | Block Kit format, top 5 vendors |
| 6 | Email sent | Rich HTML with metrics table |
| 7 | Success toast | "Notification sent!" |
| 8 | Error toast | "Failed to send notification" |
| 9 | Already sent state | Disabled after successful send |
| 10 | Loading state | Spinner during send |

---

## 6.8 Reconciliation Engine

### Components

| File | Function | Purpose |
|------|----------|---------|
| `src/lib/reconciliation/ghost-detector.ts` | `detectGhostSeats()` | Finds inactive users per vendor |
| `src/lib/reconciliation/duplicate-detector.ts` | `detectDuplicates()` | Finds overlapping vendor categories |
| `src/lib/reconciliation/engine.ts` | `generateWasteReport()` | Orchestrates both detectors |
| `src/lib/reconciliation/trigger-if-ready.ts` | `triggerScanIfReady()` | Auto-triggers when prerequisites met |

### Ghost detection algorithm
```
1. Fetch all active vendors for org
2. Fetch all user activity records (not deprovisioned)
3. Build activity lookup by email (keep most recent login)
4. For each vendor:
   a. Identify inactive users (no login in 30+ days)
   b. Calculate per_seat_cost = monthly_cost / total_seats
   c. Calculate monthly_waste = ghost_seats × per_seat_cost
5. Return findings sorted by monthly_waste descending
```

### Duplicate detection algorithm
```
1. Fetch all active vendors for org
2. Normalize vendor names
3. For each of 12 category groups:
   a. Find vendors matching any pattern in group
   b. If 2+ vendors in same category → duplicate finding
   c. Calculate combined_cost, potential_savings
   d. Generate recommendation text
4. Return findings sorted by potential_savings descending
```

### Auto-trigger prerequisites
```
triggerScanIfReady(adminClient, orgId):
  1. Has active Plaid OR GoCardless connection? → boolean
  2. Has active Okta OR Google connection? → boolean
  3. If both true:
     a. generateWasteReport()
     b. sendReportNotifications() (if subscribed)
     c. Return true
  4. Else return false
```

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Ghost detector: 30-day threshold | Users inactive 30+ days flagged |
| 2 | Ghost detector: per-seat cost | monthly_cost / total_seats |
| 3 | Ghost detector: handles 0 seats | No division by zero |
| 4 | Duplicate detector: 12 groups | All category groups checked |
| 5 | Duplicate detector: needs 2+ | Single vendor in category not flagged |
| 6 | Engine: parallel execution | Ghost + duplicate run concurrently |
| 7 | Engine: correct totals | ghostWaste + duplicateWaste = totalWaste |
| 8 | Engine: persists to DB | waste_reports row created |
| 9 | Trigger: checks prerequisites | Returns false if missing connections |
| 10 | Trigger: sends notifications | Calls sendReportNotifications on success |

---

## 6.9 Notification System

### Components

| File | Function | Channel |
|------|----------|---------|
| `src/lib/notifications/send.ts` | `sendReportNotifications()` | Router |
| `src/lib/notifications/slack.ts` | `sendSlackNotification()` | Slack webhook |
| `src/lib/notifications/email.ts` | `sendEmailNotification()` | Resend API |

### Slack message format (Block Kit)
```
Header: "👻 GhostFinder — Weekly Waste Report"
Section: Monthly Waste | Annual | Ghost Seats | Duplicates
Section: Top 5 ghost vendors listed
Action: "View Full Report" primary button
```

### Email format (HTML)
```
From: GhostFinder <alerts@ghostfinder.app>
Subject: 👻 SaaS Waste Alert: $X/mo identified
Body: Rich HTML table with metrics, CTA button
```

### Notification routing logic
```
sendReportNotifications(adminClient, orgId, reportId):
  1. Check: tier == 'recovery' && status == 'active' → else return
  2. Fetch notification_settings for org
  3. Check: waste exceeds threshold → else return
  4. If slack_enabled && webhook_url: sendSlackNotification()
  5. If email_enabled && recipients.length > 0: sendEmailNotification()
  6. Log each attempt to notification_log (sent/failed/skipped)
```

---

## 6.10 E2E Test Coverage

### Spec files

| File | Tests | Coverage |
|------|-------|----------|
| `e2e/specs/reports/ghost-seats.spec.ts` | ~5 | Ghost seat cards, severity, user list, expand/collapse |
| `e2e/specs/reports/duplicates.spec.ts` | ~4 | Category cards, vendor comparison, savings |

### Test IDs (from `e2e/helpers/selectors.ts`)
```typescript
reports: {
  wasteSummary:    'waste-summary',
  ghostSeats:      'ghost-seats',
  duplicates:      'duplicates',
  reportSelector:  'report-selector',
  exportButton:    'export-report',
  notifyButton:    'notify-button',
}
```

### Running reports E2E
```bash
npx playwright test e2e/specs/reports/ --project=chromium
```

---

## Exit Criteria

| Criteria | Status |
|----------|--------|
| Hero waste summary renders with correct amounts | ☐ |
| Annual projection = monthly × 12 | ☐ |
| Ghost seat cards render per vendor | ☐ |
| Severity border colors match inactivity thresholds | ☐ |
| User list expands/collapses correctly | ☐ |
| Duplicate categories render with 2+ vendors | ☐ |
| Savings calculation correct | ☐ |
| Report selector switches between reports | ☐ |
| Export button: decision made (implement/remove/"coming soon") | ☐ |
| Notify button respects tier gate | ☐ |
| Notify sends Slack + email when configured | ☐ |
| Reconciliation engine: ghost detector finds correct users | ☐ |
| Reconciliation engine: duplicate detector finds categories | ☐ |
| Auto-trigger works when both providers connected | ☐ |
| All reports E2E specs pass | ☐ |

---

## Dependencies
- **Requires:** Phase 0 (build), Phase 1 (auth), Phase 3 (layout)
- **Data source:** Phase 5 (Connections) provides user_activity + transactions
- **Notifications depend on:** Phase 8 (Settings — notification config)
- **Blocks:** None
