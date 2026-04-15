# Phase 8 — Settings Page

> **Priority:** Medium — essential for team management and notification config  
> **Estimated scope:** 2 files modified, 3 new components created  
> **Dependencies:** Phase 0 (brand tokens, Sonner toast)

---

## Objective

Expand the Settings page from a single notification form into a multi-section settings hub covering Profile, Organization, Notifications, and Danger Zone. This is where admins manage their team, configure alerts, and perform account-level actions. The current single-form approach doesn't scale as the product grows.

---

## Current State Assessment

| Area | Current | Problem |
|---|---|---|
| Layout | Single card with notification settings form | No profile, org, or account management — everything is missing |
| Organization | Org name shown in sidebar but not editable | No member list, no invite flow, no role management |
| Profile | Not present | Users can't change their display name or see their account info |
| Notifications | Form fields + save button | Disabled state shows text "Notifications require the Recovery plan" — no upgrade CTA |
| Danger zone | Not present | No way to leave an org or delete an account — users must contact support |
| Navigation | None | Single-page scroll — will be unwieldy with 4 sections |
| Save feedback | `saved` state sets a boolean | No toast notification; easy to miss the success signal |

---

## Implementation Steps

### Step 1 — Create Multi-Section Layout with Vertical Tabs

**File:** `src/app/(dashboard)/settings/page.tsx`

Replace the single card with a tabbed layout:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Building2, Bell, AlertTriangle } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()

  // Fetch all necessary data
  const { data: { user } } = await supabase.auth.getUser()
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .single()

  const { data: notificationSettings } = await supabase
    .from('notification_settings')
    .select('*')
    .single()

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(id, name, slug)')
    .eq('user_id', user!.id)
    .single()

  const { data: members } = await supabase
    .from('org_members')
    .select('user_id, role, created_at')
    .eq('org_id', membership?.org_id)

  const isRecovery = subscription?.tier === 'recovery' && subscription?.status === 'active'
  const isOwnerOrAdmin = membership?.role === 'owner' || membership?.role === 'admin'
  const orgName = (membership?.organizations as unknown as { name: string } | null)?.name ?? ''

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Manage your profile, organization, and notification preferences.
      </p>

      <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-6">
        {/* Vertical tab list on desktop, horizontal on mobile */}
        <TabsList className="flex md:flex-col h-auto bg-transparent gap-1 md:w-48 shrink-0">
          <TabsTrigger
            value="profile"
            className="justify-start gap-2 data-[state=active]:bg-brand-muted data-[state=active]:text-foreground"
          >
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="organization"
            className="justify-start gap-2 data-[state=active]:bg-brand-muted data-[state=active]:text-foreground"
          >
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="justify-start gap-2 data-[state=active]:bg-brand-muted data-[state=active]:text-foreground"
          >
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="danger"
            className="justify-start gap-2 text-destructive data-[state=active]:bg-destructive/10"
          >
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-w-0">
          <TabsContent value="profile">
            <ProfileSection user={user!} />
          </TabsContent>
          <TabsContent value="organization">
            <OrganizationSection
              orgName={orgName}
              members={members ?? []}
              isOwnerOrAdmin={isOwnerOrAdmin}
            />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsSection
              settings={notificationSettings}
              isRecovery={isRecovery}
            />
          </TabsContent>
          <TabsContent value="danger">
            <DangerZoneSection isOwner={membership?.role === 'owner'} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
```

### Step 2 — Create Profile Section Component

**New file:** `src/components/settings/profile-section.tsx`

```tsx
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { toast } from 'sonner'

interface ProfileSectionProps {
  user: { email?: string; user_metadata?: { display_name?: string } }
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const [displayName, setDisplayName] = useState(
    user.user_metadata?.display_name ?? ''
  )
  const [saving, setSaving] = useState(false)
  const email = user.email ?? ''
  const initials = email.slice(0, 2).toUpperCase()

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      })

      if (res.ok) {
        toast.success('Profile updated')
      } else {
        toast.error('Failed to update profile')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Manage your personal information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-brand text-brand-foreground text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{displayName || email.split('@')[0]}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        {/* Display name */}
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">
            Email is managed by your authentication provider and cannot be changed here.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </CardContent>
    </Card>
  )
}
```

### Step 3 — Create Organization Section Component

**New file:** `src/components/settings/organization-section.tsx`

```tsx
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface Member {
  user_id: string
  role: string
  created_at: string
}

const roleBadgeColors: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  member: 'bg-muted text-muted-foreground',
  viewer: 'bg-muted text-muted-foreground',
}

interface OrganizationSectionProps {
  orgName: string
  members: Member[]
  isOwnerOrAdmin: boolean
}

export function OrganizationSection({
  orgName,
  members,
  isOwnerOrAdmin,
}: OrganizationSectionProps) {
  const [name, setName] = useState(orgName)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        toast.success('Organization name updated')
      } else {
        toast.error('Failed to update organization')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Manage your organization details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwnerOrAdmin}
            />
          </div>
          {isOwnerOrAdmin && (
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? 'Saving...' : 'Update name'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>{members.length} members in your organization</CardDescription>
          </div>
          {isOwnerOrAdmin && (
            <Button variant="outline" size="sm" disabled>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="font-mono text-xs">
                    {m.user_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={roleBadgeColors[m.role] ?? ''}>
                      {m.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(m.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 4 — Create Danger Zone Section Component

**New file:** `src/components/settings/danger-zone-section.tsx`

```tsx
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function DangerZoneSection({ isOwner }: { isOwner: boolean }) {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Irreversible actions that affect your account and organization.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Leave organization */}
        {!isOwner && (
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
            <div>
              <p className="font-medium text-sm">Leave organization</p>
              <p className="text-xs text-muted-foreground">
                You will lose access to all organization data and reports.
              </p>
            </div>
            <ConfirmDialog
              title="Leave organization"
              description="This will remove you from the organization. You will lose access to all data instantly. This cannot be undone."
              confirmText="leave organization"
              action="Leave"
              onConfirm={async () => {
                const res = await fetch('/api/settings/leave-org', { method: 'POST' })
                if (res.ok) {
                  toast.success('You have left the organization')
                  window.location.href = '/login'
                } else {
                  toast.error('Failed to leave organization')
                }
              }}
            />
          </div>
        )}

        {/* Delete account */}
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
          <div>
            <p className="font-medium text-sm">Delete account</p>
            <p className="text-xs text-muted-foreground">
              Permanently delete your account and all associated data.
            </p>
          </div>
          <ConfirmDialog
            title="Delete account"
            description="This will permanently delete your account, remove you from all organizations, and erase your data. This action cannot be reversed."
            confirmText="delete my account"
            action="Delete"
            variant="destructive"
            onConfirm={async () => {
              const res = await fetch('/api/settings/delete-account', { method: 'DELETE' })
              if (res.ok) {
                toast.success('Account deleted')
                window.location.href = '/login'
              } else {
                toast.error('Failed to delete account')
              }
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ConfirmDialog({
  title,
  description,
  confirmText,
  action,
  variant = 'outline',
  onConfirm,
}: {
  title: string
  description: string
  confirmText: string
  action: string
  variant?: 'outline' | 'destructive'
  onConfirm: () => Promise<void>
}) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const isMatch = input.toLowerCase() === confirmText.toLowerCase()

  async function handleConfirm() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setInput('') }}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          {action}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="confirm">
            Type <span className="font-mono font-bold">{confirmText}</span> to confirm
          </Label>
          <Input
            id="confirm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={confirmText}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isMatch || loading}
          >
            {loading ? 'Processing...' : `Confirm ${action.toLowerCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 5 — Upgrade Notification Settings Form

**File:** `src/components/settings/notification-settings-form.tsx`

Add inline upgrade CTA when notifications are disabled:

```tsx
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Bell, ArrowRight } from 'lucide-react'
import Link from 'next/link'

// When disabled (not Recovery plan):
{disabled && (
  <div className="rounded-lg border border-brand/20 bg-brand-muted p-4 mb-6">
    <div className="flex items-start gap-3">
      <Bell className="h-5 w-5 text-brand mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-sm">
          Unlock notifications with the Recovery plan
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Get Slack alerts and email notifications when ghost seats or duplicate subscriptions are detected.
        </p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link href="/billing">
            View plans <ArrowRight className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  </div>
)}

// Replace the save handler success with toast:
if (res.ok) {
  toast.success('Notification settings saved')
} else {
  toast.error('Failed to save settings')
}
```

---

## Settings Page Layout (After)

```
Settings
├── Description text
├── Vertical Tabs (md: side-by-side | mobile: stacked)
│   ├── Tab: Profile
│   │   └── Card
│   │       ├── Avatar (initials, brand bg, 64px)
│   │       ├── Display Name input
│   │       ├── Email input (read-only, muted bg)
│   │       └── [Save changes] button
│   ├── Tab: Organization
│   │   ├── Card: Org Details
│   │   │   ├── Organization Name input
│   │   │   └── [Update name] button (admin only)
│   │   └── Card: Team Members
│   │       ├── Header + [Invite] button (disabled, admin only)
│   │       └── Table: User ID | Role badge | Joined date
│   ├── Tab: Notifications
│   │   ├── Upgrade CTA (if not Recovery plan)
│   │   │   ├── Bell icon + description
│   │   │   └── [View plans →] button
│   │   └── Notification form (disabled if not Recovery)
│   │       ├── Slack webhook URL input
│   │       ├── Slack enabled toggle
│   │       ├── Email recipients input
│   │       ├── Email enabled toggle
│   │       ├── Threshold amount input
│   │       └── [Save settings] button → toast
│   └── Tab: Danger Zone (red accent)
│       └── Card (destructive border)
│           ├── Leave organization (non-owners only)
│           │   └── Dialog: type "leave organization" to confirm
│           └── Delete account
│               └── Dialog: type "delete my account" to confirm
```

---

## Files Changed

| File | Action | Description |
|---|---|---|
| `src/app/(dashboard)/settings/page.tsx` | Modified | Multi-section tabbed layout, data fetching for all sections |
| `src/components/settings/notification-settings-form.tsx` | Modified | Upgrade CTA, toast feedback |
| `src/components/settings/profile-section.tsx` | Created | Profile card with avatar, display name, email |
| `src/components/settings/organization-section.tsx` | Created | Org name, member list with role badges, invite placeholder |
| `src/components/settings/danger-zone-section.tsx` | Created | Leave org, delete account with typed confirmation dialogs |

---

## Verification Checklist

- [ ] Settings page shows 4 vertical tabs on desktop, horizontal on mobile
- [ ] Profile tab shows avatar with initials in brand color
- [ ] Display name can be edited and saved with toast feedback
- [ ] Email field is disabled with explanatory text
- [ ] Organization tab shows editable org name (admin+ only)
- [ ] Team members table shows role with colored badges (owner=amber, admin=blue)
- [ ] Invite button is present but disabled (placeholder for future API)
- [ ] Notifications tab shows upgrade CTA if not on Recovery plan
- [ ] CTA links to billing page
- [ ] Notification form saves with toast.success/error
- [ ] Danger Zone tab header is red-colored
- [ ] "Leave organization" requires typing "leave organization" to enable button
- [ ] "Delete account" requires typing "delete my account" to enable button
- [ ] Both danger actions show confirmation dialog before executing
- [ ] Non-owners see "Leave organization"; owners do not
- [ ] All API endpoints referenced (`/api/settings/profile`, `/api/settings/organization`, `/api/settings/leave-org`, `/api/settings/delete-account`) are noted as needing backend implementation

---

## Design Decisions

| Decision | Rationale |
|---|---|
| Vertical tabs over accordion | Better desktop use of horizontal space; familiar settings page pattern (Vercel, GitHub) |
| Typed confirmation for destructive actions | Industry best practice — prevents accidental account deletion; matches GitHub/AWS pattern |
| Disabled invite button | Shows the feature exists; sets expectation; avoids dead-end |
| Role-colored badges | Visual hierarchy for team permissions; amber=ownership stands out |
| Upgrade CTA inside notification tab | Contextual upsell — user is already thinking about notifications |
| Toast over inline success message | Consistent with Phase 0; non-blocking; auto-dismissing |

---

## Backend API Endpoints Required

These endpoints are referenced by the UI components but require separate backend implementation:

| Endpoint | Method | Description |
|---|---|---|
| `/api/settings/profile` | POST | Update user display name in `auth.users.user_metadata` |
| `/api/settings/organization` | POST | Update `organizations.name` (admin+ only) |
| `/api/settings/leave-org` | POST | Remove current user from `org_members` |
| `/api/settings/delete-account` | DELETE | Remove user from all orgs, delete auth account |
