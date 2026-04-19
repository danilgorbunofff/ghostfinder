import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { getOrgTier, hasAccess } from '@/lib/billing/gate'
import { sendSlackNotification } from '@/lib/notifications/slack'
import { sendReportNotifications } from '@/lib/notifications/send'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const membership = await ensureOrganization(
    user.id,
    user.email ?? undefined,
    user.user_metadata?.full_name ?? undefined
  )

  // Feature gate check
  const tier = await getOrgTier(admin, membership.orgId)
  if (!hasAccess(tier, 'notifications.send')) {
    return NextResponse.json(
      { error: 'Upgrade to Recovery plan to send notifications' },
      { status: 403 }
    )
  }

  const body = await request.json()

  // Report-level notification (sends full report via all configured channels)
  if (body.reportId) {
    try {
      await sendReportNotifications(admin, membership.orgId, body.reportId)
      return NextResponse.json({ success: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // Per-vendor notification (legacy: sends single vendor alert via Slack)
  const { vendor, ghostSeats, monthlyWaste } = body

  // Get Slack webhook
  const { data: settings } = await admin
    .from('notification_settings')
    .select('slack_webhook_url, slack_enabled')
    .eq('org_id', membership.orgId)
    .single()

  if (!settings?.slack_enabled || !settings?.slack_webhook_url) {
    return NextResponse.json(
      { error: 'Slack not configured. Set up Slack in notification settings.' },
      { status: 400 }
    )
  }

  try {
    await sendSlackNotification(settings.slack_webhook_url, {
      totalMonthlyWaste: monthlyWaste,
      totalAnnualWaste: monthlyWaste * 12,
      ghostSeatCount: ghostSeats,
      duplicateCount: 0,
      topGhosts: [{ vendor, ghostSeats, monthlyWaste }],
      reportUrl: `${process.env.NEXT_PUBLIC_APP_URL}/reports`,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
