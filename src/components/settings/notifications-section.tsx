'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, Bell } from 'lucide-react'
import Link from 'next/link'
import { NotificationSettingsForm } from '@/components/settings/notification-settings-form'

interface NotificationsSettingsData {
  slack_webhook_url: string | null
  slack_enabled: boolean
  email_enabled: boolean
  email_recipients: string[]
  notify_on_ghost_seats: boolean
  notify_on_duplicates: boolean
  notify_threshold_amount: number
}

interface NotificationsSectionProps {
  settings: NotificationsSettingsData | null
  isRecovery: boolean
}

export function NotificationsSection({ settings, isRecovery }: NotificationsSectionProps) {
  return (
    <Card className="card-interactive animate-fade-in-up">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Bell className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Configure how you receive alerts about SaaS waste.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isRecovery && (
          <div className="rounded-lg border border-brand/20 bg-gradient-to-br from-brand/[0.04] via-transparent to-transparent dark:from-brand/[0.08] p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-brand-muted flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4 text-brand" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">
                  Unlock notifications with the Recovery plan
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Get Slack alerts and email notifications when ghost seats or duplicate subscriptions are detected.
                </p>
                <Button variant="outline" size="sm" className="mt-3 group/btn" render={<Link href="/billing" />}>
                  View plans <ArrowRight className="ml-2 h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
        <NotificationSettingsForm
          settings={settings}
          disabled={!isRecovery}
        />
      </CardContent>
    </Card>
  )
}
