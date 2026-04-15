import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationSettingsForm } from '@/components/settings/notification-settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .single()

  const { data: notificationSettings } = await supabase
    .from('notification_settings')
    .select('*')
    .single()

  const isRecovery = subscription?.tier === 'recovery' && subscription?.status === 'active'

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Manage your organization settings.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Configure how you receive alerts about SaaS waste.
            {!isRecovery && ' Notifications require the Recovery plan.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettingsForm
            settings={notificationSettings}
            disabled={!isRecovery}
          />
        </CardContent>
      </Card>
    </div>
  )
}
