# Phase 8 — Settings

> **Objective:** All four settings tabs — Profile, Organization, Notifications, and Danger Zone — render correctly, save data, enforce role-based access, and handle edge cases. Forms persist changes, team member list displays accurately, notification configuration respects tier gating, and destructive actions require explicit confirmation.

---

## 8.1 Settings Page (Server Component)

**File:** `src/app/(dashboard)/settings/page.tsx`

### Data fetching
```sql
-- User profile
SELECT id, email, raw_user_meta_data FROM auth.users WHERE id = ?;

-- Organization
SELECT id, name FROM organizations WHERE id = ?;

-- Membership + role
SELECT role FROM org_members WHERE org_id = ? AND user_id = ?;

-- Team members
SELECT u.email, u.raw_user_meta_data, m.role
FROM org_members m JOIN auth.users u ON m.user_id = u.id
WHERE m.org_id = ?;

-- Subscription (for notification gating)
SELECT tier, status FROM subscriptions WHERE org_id = ?;

-- Notification settings
SELECT * FROM notification_settings WHERE org_id = ?;
```

### Tab layout
```
┌──────────────────────────────────────────────────┐
│  [ Profile ] [ Organization ] [ Notifications ]  │
│  [ 🔴 Danger Zone ]  ← owner only, pulsing dot  │
├──────────────────────────────────────────────────┤
│  Tab content renders here                         │
└──────────────────────────────────────────────────┘
```

---

## 8.2 Profile Tab

### Fields

| Field | Type | Editable | Source |
|-------|------|----------|--------|
| Display name | Text input | ✅ Yes | `auth.users.raw_user_meta_data.display_name` |
| Email | Text (read-only) | ❌ No | `auth.users.email` |

### API Route: `src/app/api/settings/profile/route.ts`
- Method: PATCH
- Body: `{ display_name: string }`
- Auth: any authenticated user
- Action: Updates `raw_user_meta_data` on auth.users

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Display name shows current value | Pre-filled from DB |
| 2 | Email shows current value | Read-only, greyed out |
| 3 | Edit name + save | Toast: "Profile updated" |
| 4 | Empty name | Validation: minimum 1 character |
| 5 | Refresh after save | New name persists |
| 6 | Name reflected in sidebar | Avatar initials + display name update |
| 7 | Save button disabled during submit | Loading state |
| 8 | Error handling | Toast on API failure |

---

## 8.3 Organization Tab

### Sections

#### 8.3.1 Organization Name
| Field | Type | Editable by | Source |
|-------|------|-------------|--------|
| Org name | Text input | owner, admin | `organizations.name` |

- Member/viewer: field is read-only or hidden
- API: PATCH `/api/settings/organization` with `{ name: string }`

#### 8.3.2 Team Members List

| Column | Data |
|--------|------|
| Avatar | Initials from email |
| Name/Email | Display name (or email if no name) |
| Role | Badge: owner (purple), admin (blue), member (green), viewer (gray) |

### Known gaps

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **Invite button disabled** | Cannot add team members through UI | Add "Coming Soon" tooltip or implement invite flow |
| **Role management missing** | Can see roles but can't change them | Add role dropdown for owner/admin users |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Org name editable by owner | Input active, save button |
| 2 | Org name editable by admin | Input active, save button |
| 3 | Org name read-only for member | Input disabled or hidden |
| 4 | Team list renders | All org members shown |
| 5 | Role badges colored | owner=purple, admin=blue, member=green, viewer=gray |
| 6 | Current user highlighted | Or marked with "(you)" |
| 7 | Invite button | Disabled with "Coming Soon" or functional |
| 8 | Save org name | Toast: "Organization updated" |
| 9 | Empty name validation | Minimum 1 character |
| 10 | Refresh persists | Name stays after reload |

---

## 8.4 Notifications Tab

### Tier gate
- **Recovery tier:** Full notification configuration
- **Free/Monitor tier:** Shows upgrade prompt with link to billing page

### Fields (Recovery tier only)

| Field | Type | Description |
|-------|------|-------------|
| Slack webhook URL | Text input | `https://hooks.slack.com/services/...` |
| Slack enabled | Toggle | On/off |
| Email recipients | Text input | Comma-separated emails |
| Email enabled | Toggle | On/off |
| Waste threshold | Number input | Minimum $ to trigger notification |

### API Route: `src/app/api/notifications/settings/route.ts`
- Method: PATCH
- Body: `{ slack_webhook_url, slack_enabled, email_recipients, email_enabled, waste_threshold }`
- Auth: owner/admin only
- Tier check: must be Recovery

### Known bug
> **Form may lose settings if saved without Recovery tier.** If a user was on Recovery, configured notifications, then downgraded to Monitor, and tries to save → the API should either:
> a. Reject with 403 + "Upgrade required" message
> b. Save the settings but keep them inactive until Recovery is restored
> 
> Verify which behavior exists and ensure no data is silently deleted.

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Recovery tier: form renders | All 5 fields visible |
| 2 | Non-Recovery: upgrade prompt | "Upgrade to Recovery" CTA + link to billing |
| 3 | Slack URL input | Accepts valid webhook URL |
| 4 | Slack toggle | On/off |
| 5 | Email recipients | Accepts comma-separated emails |
| 6 | Email toggle | On/off |
| 7 | Threshold input | Accepts positive numbers |
| 8 | Save persists | Settings stored in `notification_settings` table |
| 9 | Refresh shows saved values | Pre-filled from DB |
| 10 | **Downgrade scenario** | Settings preserved but inactive (verify!) |
| 11 | Invalid webhook URL | Validation error |
| 12 | Invalid email format | Validation error |
| 13 | Zero threshold | Should work (notify on any waste) |
| 14 | Save loading state | Button disabled during submit |
| 15 | Missing Slack webhook test button | Low priority — user can't validate setup without test send |

---

## 8.5 Danger Zone Tab

### Visibility
- **Owner only** — tab hidden for admin/member/viewer
- Visual: Red pulsing indicator dot on tab label

### Actions

#### 8.5.1 Leave Organization
- **Hidden for owner** (owner cannot leave their own org)
- For admin/member/viewer: "Leave Organization" button
- API: POST `/api/settings/leave-org`
- Effect: Removes `org_members` row for current user
- Redirect: to `/login` after leaving

#### 8.5.2 Delete Account
- **Type-to-confirm pattern:** User must type "DELETE" to enable button
- API: DELETE `/api/settings/delete-account`
- Effect: 
  1. Removes all `org_members` entries for user
  2. If user is sole owner → deletes entire org and all data
  3. Deletes auth.users entry
- Redirect: to `/login`

### Known gap
> **No account deletion grace period.** Once confirmed, deletion is immediate and permanent. This is a risk for accidental deletion. Recommended: add 7-day grace period with email confirmation, or at minimum a "Are you absolutely sure?" double-confirmation step.

### API Routes

| Route | Method | Action |
|-------|--------|--------|
| `/api/settings/leave-org` | POST | Remove membership, redirect |
| `/api/settings/delete-account` | DELETE | Delete user + cascade data |

### Checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Tab visible for owner only | Hidden for other roles |
| 2 | Pulsing red dot on tab | Animated indicator |
| 3 | "Leave org" hidden for owner | Only shown for non-owner roles |
| 4 | "Leave org" button works | Removes membership, redirects |
| 5 | "Delete account" requires typing "DELETE" | Button disabled until match |
| 6 | Case sensitivity | "DELETE" must be exact match |
| 7 | Delete confirmation | Additional "Are you sure?" dialog |
| 8 | Delete cascades correctly | org_members → org data → auth.users |
| 9 | Redirect after delete | To `/login` |
| 10 | Session cleared | Auth session invalidated |
| 11 | No grace period | ⚠️ Document as known risk |

---

## 8.6 Settings Components

**Directory:** `src/components/settings/`

| Component | Purpose |
|-----------|---------|
| Profile form | Display name editor |
| Organization form | Org name editor + team list |
| Notification form | Slack/email/threshold config |
| Danger zone | Leave org + delete account |
| Team member row | Avatar + name + role badge |

### Shared patterns
- All forms use controlled inputs with `useState`
- All saves call API routes with `fetch()` + show `toast.success()` or `toast.error()`
- All save buttons disabled during submission (loading state)
- All forms validate before submit

---

## 8.7 E2E Test Coverage

### Spec files

| File | Tests | Coverage |
|------|-------|----------|
| `e2e/specs/settings/profile.spec.ts` | ~3 | Name edit, email read-only, save persistence |
| `e2e/specs/settings/organization.spec.ts` | ~4 | Org name edit, team list, role badges, permission gate |
| `e2e/specs/settings/notifications.spec.ts` | ~4 | Tier gate, Slack config, email config, threshold |
| `e2e/specs/settings/danger-zone.spec.ts` | ~4 | Tab visibility, type-to-confirm, delete, leave org |

### Test IDs (from `e2e/helpers/selectors.ts`)
```typescript
settings: {
  profileTab:       'tab-profile',
  orgTab:           'tab-organization',
  notificationsTab: 'tab-notifications',
  dangerTab:        'tab-danger',
  displayName:      'display-name',
  orgName:          'org-name',
  teamList:         'team-list',
  inviteButton:     'invite-button',
  slackWebhook:     'slack-webhook',
  slackToggle:      'slack-toggle',
  emailRecipients:  'email-recipients',
  emailToggle:      'email-toggle',
  wasteThreshold:   'waste-threshold',
  deleteConfirm:    'delete-confirm',
}
```

### Running settings E2E
```bash
npx playwright test e2e/specs/settings/ --project=chromium
```

### Dev fixture methods for testing
```typescript
// Switch to different roles to test permission gates
await devApi.switchRole('viewer');   // → danger zone hidden
await devApi.switchRole('owner');    // → danger zone visible

// Switch tier to test notification gate
await devApi.switchTier('free');     // → upgrade prompt
await devApi.switchTier('recovery'); // → notification form
```

---

## 8.8 API Route Verification

### All settings-related API routes

| Route | Method | Auth | Role gate | Tier gate |
|-------|--------|------|-----------|-----------|
| `/api/settings/profile` | PATCH | Any user | None | None |
| `/api/settings/organization` | PATCH | Authenticated | owner, admin | None |
| `/api/notifications/settings` | PATCH | Authenticated | owner, admin | recovery |
| `/api/settings/leave-org` | POST | Authenticated | Non-owner | None |
| `/api/settings/delete-account` | DELETE | Authenticated | Any | None |

### Verification per route

| Check | Expected |
|-------|----------|
| Unauthenticated request | 401 Unauthorized |
| Wrong role | 403 Forbidden |
| Wrong tier (notifications) | 403 Forbidden with upgrade message |
| Valid request | 200 OK with updated data |
| Invalid body | 400 Bad Request |
| Database error | 500 Internal Server Error |

---

## Exit Criteria

| Criteria | Status |
|----------|--------|
| Profile: display name saves + persists | ☐ |
| Profile: email is read-only | ☐ |
| Org: name editable by owner/admin only | ☐ |
| Org: team list renders all members | ☐ |
| Org: role badges colored correctly | ☐ |
| Notifications: tier gate shows upgrade prompt | ☐ |
| Notifications: Recovery tier shows full form | ☐ |
| Notifications: save persists all 5 fields | ☐ |
| Notifications: downgrade scenario verified | ☐ |
| Danger Zone: visible to owner only | ☐ |
| Danger Zone: "Leave org" hidden for owner | ☐ |
| Danger Zone: type-to-confirm "DELETE" works | ☐ |
| Danger Zone: delete cascades correctly | ☐ |
| All API routes handle auth/role/tier gates | ☐ |
| All settings E2E specs pass | ☐ |

---

## Dependencies
- **Requires:** Phase 0 (build), Phase 1 (auth + RBAC), Phase 3 (layout)
- **Depends on:** Phase 7 (Billing — tier determines notification access)
- **Feeds into:** Phase 6 (Reports — notification settings used by notify button)
- **Blocks:** None
