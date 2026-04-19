import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Building2, Bell, AlertTriangle } from 'lucide-react'
import { ProfileSection } from '@/components/settings/profile-section'
import { OrganizationSection } from '@/components/settings/organization-section'
import { NotificationsSection } from '@/components/settings/notifications-section'
import { DangerZoneSection } from '@/components/settings/danger-zone-section'
import { getServerOrgContext } from '@/lib/supabase/server-org'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings | GhostFinder',
  description: 'Manage your profile, organization, and notification settings.',
}

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { admin, orgId, orgName, role, user } = await getServerOrgContext()

  const { data: subscription, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('tier, status')
    .eq('org_id', orgId)
    .maybeSingle()

  if (subscriptionError) {
    throw new Error(`Failed to load subscription: ${subscriptionError.message}`)
  }

  const { data: notificationSettings, error: notificationSettingsError } = await admin
    .from('notification_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (notificationSettingsError) {
    throw new Error(`Failed to load notification settings: ${notificationSettingsError.message}`)
  }

  // Fetch members with emails via admin-level join
  const { data: members, error: membersError } = await admin
    .from('org_members')
    .select('user_id, role, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  if (membersError) {
    throw new Error(`Failed to load organization members: ${membersError.message}`)
  }

  // Fetch user emails for all members
  const memberEmails: Record<string, { email: string; display_name?: string }> = {}
  if (members) {
    for (const m of members) {
      // Use current user's data directly if available
      if (m.user_id === user.id) {
        memberEmails[m.user_id] = {
          email: user.email ?? '',
          display_name: user.user_metadata?.display_name,
        }
      }
    }
  }

  const isRecovery = subscription?.tier === 'recovery' && subscription?.status === 'active'
  const isOwner = role === 'owner'
  const isOwnerOrAdmin = isOwner || role === 'admin'

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground animate-fade-in-up">
        Manage your profile, organization, and notification preferences.
      </p>

      <Tabs defaultValue="profile" orientation="vertical" className="flex-col md:flex-row gap-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
        <TabsList variant="line" className="md:w-48 md:shrink-0">
          <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="organization" className="gap-2" data-testid="tab-organization">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="danger" className="gap-2 text-destructive" data-testid="tab-danger-zone">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
              <span className="relative flex h-2 w-2 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
            </TabsTrigger>
          )}
        </TabsList>

        <div className="flex-1 min-w-0">
          <TabsContent value="profile">
            <ProfileSection user={user} />
          </TabsContent>
          <TabsContent value="organization">
            <OrganizationSection
              orgName={orgName}
              members={members ?? []}
              memberEmails={memberEmails}
              currentUserId={user.id}
              isOwnerOrAdmin={isOwnerOrAdmin}
            />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsSection
              settings={notificationSettings}
              isRecovery={isRecovery}
            />
          </TabsContent>
          {isOwner && (
            <TabsContent value="danger">
              <DangerZoneSection isOwner={true} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  )
}
