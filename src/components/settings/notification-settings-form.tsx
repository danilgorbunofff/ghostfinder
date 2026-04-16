'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DollarSign, Loader2, Lock, Mail, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface NotificationSettingsData {
  slack_webhook_url: string | null
  slack_enabled: boolean
  email_enabled: boolean
  email_recipients: string[]
  notify_on_ghost_seats: boolean
  notify_on_duplicates: boolean
  notify_threshold_amount: number
}

export function NotificationSettingsForm({
  settings,
  disabled,
}: {
  settings: NotificationSettingsData | null
  disabled: boolean
}) {
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(settings?.slack_webhook_url ?? '')
  const [slackEnabled, setSlackEnabled] = useState(settings?.slack_enabled ?? false)
  const [emailEnabled, setEmailEnabled] = useState(settings?.email_enabled ?? false)
  const [emailRecipients, setEmailRecipients] = useState(
    settings?.email_recipients?.join(', ') ?? ''
  )
  const [thresholdAmount, setThresholdAmount] = useState(
    String(settings?.notify_threshold_amount ?? 0)
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const recipients = emailRecipients
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)

      const res = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slack_webhook_url: slackWebhookUrl || null,
          slack_enabled: slackEnabled,
          email_enabled: emailEnabled,
          email_recipients: recipients,
          notify_threshold_amount: Number(thresholdAmount) || 0,
        }),
      })

      if (res.ok) {
        toast.success('Notification settings saved')
      } else {
        toast.error('Failed to save settings')
      }
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (disabled) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Upgrade to the Recovery plan to configure notifications.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Slack Settings */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center">
              <MessageSquare className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <h3 className="text-sm font-medium">Slack</h3>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="slack-toggle" className="text-xs text-muted-foreground">
              {slackEnabled ? 'Enabled' : 'Disabled'}
            </Label>
            <Switch
              id="slack-toggle"
              checked={slackEnabled}
              onCheckedChange={setSlackEnabled}
              data-testid="notification-slack-toggle"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="slack-webhook" className="text-xs">Webhook URL</Label>
          <Input
            id="slack-webhook"
            placeholder="https://hooks.slack.com/services/..."
            value={slackWebhookUrl}
            onChange={(e) => setSlackWebhookUrl(e.target.value)}
            disabled={!slackEnabled}
          />
          <p className="text-xs text-muted-foreground">
            Create an Incoming Webhook in your Slack workspace settings.
          </p>
        </div>
      </div>

      {/* Email Settings */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
              <Mail className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <h3 className="text-sm font-medium">Email</h3>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="email-toggle" className="text-xs text-muted-foreground">
              {emailEnabled ? 'Enabled' : 'Disabled'}
            </Label>
            <Switch
              id="email-toggle"
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
              data-testid="notification-email-toggle"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-recipients" className="text-xs">Recipients</Label>
          <Input
            id="email-recipients"
            placeholder="admin@company.com, cfo@company.com"
            value={emailRecipients}
            onChange={(e) => setEmailRecipients(e.target.value)}
            disabled={!emailEnabled}
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated list of email addresses.
          </p>
        </div>
      </div>

      {/* Threshold */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-green-500/10 flex items-center justify-center">
            <DollarSign className="h-3.5 w-3.5 text-green-500" />
          </div>
          <h3 className="text-sm font-medium">Waste Threshold</h3>
        </div>
        <div className="space-y-2">
          <Label htmlFor="threshold" className="text-xs">Minimum Amount ($)</Label>
          <Input
            id="threshold"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={thresholdAmount}
            onChange={(e) => setThresholdAmount(e.target.value)}
            className="max-w-[200px]"
            data-testid="notification-threshold"
          />
          <p className="text-xs text-muted-foreground">
            Only send notifications when total monthly waste exceeds this amount.
          </p>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Save Settings'}
      </Button>
    </div>
  )
}
