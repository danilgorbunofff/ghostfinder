import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { getOrgTier, hasAccess } from '@/lib/billing/gate'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
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
  if (!hasAccess(tier, 'notifications.slack') && !hasAccess(tier, 'notifications.email')) {
    return NextResponse.json(
      { error: 'Upgrade to Recovery plan to configure notifications' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const {
    slack_webhook_url,
    slack_enabled,
    email_enabled,
    email_recipients,
    notify_threshold_amount,
  } = body

  // Validate slack webhook URL if provided
  if (slack_webhook_url && !slack_webhook_url.startsWith('https://hooks.slack.com/')) {
    return NextResponse.json(
      { error: 'Invalid Slack webhook URL' },
      { status: 400 }
    )
  }

  // Validate email recipients
  if (email_recipients && Array.isArray(email_recipients)) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const email of email_recipients) {
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: `Invalid email address: ${email}` },
          { status: 400 }
        )
      }
    }
  }

  const { error } = await admin
    .from('notification_settings')
    .upsert({
      org_id: membership.orgId,
      slack_webhook_url,
      slack_enabled: !!slack_enabled,
      email_enabled: !!email_enabled,
      email_recipients: email_recipients ?? [],
      notify_threshold_amount: Number(notify_threshold_amount) || 0,
    }, {
      onConflict: 'org_id',
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
