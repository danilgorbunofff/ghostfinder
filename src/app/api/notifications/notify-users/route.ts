import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgTier, hasAccess } from '@/lib/billing/gate'
import { sendSlackNotification } from '@/lib/notifications/slack'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get org membership
  const { data: membership } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  // Feature gate check
  const tier = await getOrgTier(admin, membership.org_id)
  if (!hasAccess(tier, 'notifications.send')) {
    return NextResponse.json(
      { error: 'Upgrade to Recovery plan to send notifications' },
      { status: 403 }
    )
  }

  const { vendor, ghostSeats, monthlyWaste } = await request.json()

  // Get Slack webhook
  const { data: settings } = await admin
    .from('notification_settings')
    .select('slack_webhook_url, slack_enabled')
    .eq('org_id', membership.org_id)
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
