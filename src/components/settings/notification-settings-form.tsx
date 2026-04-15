'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'

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
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
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
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (disabled) {
    return (
      <div className="text-center py-6">
        <Badge variant="secondary" className="mb-2">Recovery Plan Required</Badge>
        <p className="text-sm text-muted-foreground">
          Upgrade to the Recovery plan to configure Slack and email notifications.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Slack Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Slack</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={slackEnabled}
              onChange={(e) => setSlackEnabled(e.target.checked)}
              className="rounded"
            />
            Enabled
          </label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="slack-webhook">Webhook URL</Label>
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Email</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="rounded"
            />
            Enabled
          </label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-recipients">Recipients</Label>
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
      <div className="space-y-2">
        <Label htmlFor="threshold">Minimum Waste Threshold ($)</Label>
        <Input
          id="threshold"
          type="number"
          min="0"
          step="1"
          placeholder="0"
          value={thresholdAmount}
          onChange={(e) => setThresholdAmount(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Only send notifications when total monthly waste exceeds this amount.
        </p>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </Button>
    </div>
  )
}
