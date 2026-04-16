import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Building2, Bell, AlertTriangle } from 'lucide-react'
import { ProfileSection } from '@/components/settings/profile-section'
import { OrganizationSection } from '@/components/settings/organization-section'
import { NotificationsSection } from '@/components/settings/notifications-section'
import { DangerZoneSection } from '@/components/settings/danger-zone-section'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings | GhostFinder',
  description: 'Manage your profile, organization, and notification settings.',
}

export default async function SettingsPage() {
  const supabase = await createClient()

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
          <TabsTrigger value="danger" className="gap-2 text-destructive" data-testid="tab-danger-zone">
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
