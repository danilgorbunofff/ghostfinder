import { SupabaseClient } from '@supabase/supabase-js'
import { sendSlackNotification } from './slack'
import { sendEmailNotification } from './email'

/**
 * Send notifications for a waste report based on org preferences.
 */
export async function sendReportNotifications(
  adminClient: SupabaseClient,
  orgId: string,
  reportId: string
): Promise<void> {
  // 1. Check org subscription tier (notifications require Recovery)
  const { data: subscription } = await adminClient
    .from('subscriptions')
    .select('tier, status')
    .eq('org_id', orgId)
    .single()

  if (!subscription || subscription.tier !== 'recovery' || subscription.status !== 'active') {
    return
  }

  // 2. Get notification settings
  const { data: settings } = await adminClient
    .from('notification_settings')
    .select('*')
    .eq('org_id', orgId)
    .single()

  if (!settings) return

  // 3. Get the report data
  const { data: report } = await adminClient
    .from('waste_reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (!report) return

  // 4. Check threshold
  if (Number(report.total_monthly_waste) < Number(settings.notify_threshold_amount)) {
    await logNotification(adminClient, orgId, reportId, 'slack', 'skipped')
    return
  }

  const reportUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reports`
  const ghostSeats = (report.ghost_seats as Record<string, unknown>[]) ?? []

  // 5. Send Slack notification
  if (settings.slack_enabled && settings.slack_webhook_url) {
    try {
      await sendSlackNotification(settings.slack_webhook_url, {
        totalMonthlyWaste: Number(report.total_monthly_waste),
        totalAnnualWaste: Number(report.total_annual_waste),
        ghostSeatCount: report.ghost_seat_count,
        duplicateCount: report.duplicate_count,
        topGhosts: ghostSeats.map((g: Record<string, unknown>) => ({
          vendor: g.vendor as string,
          ghostSeats: g.ghostSeats as number,
          monthlyWaste: g.monthlyWaste as number,
        })),
        reportUrl,
      })
      await logNotification(adminClient, orgId, reportId, 'slack', 'sent')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      await logNotification(adminClient, orgId, reportId, 'slack', 'failed', message)
    }
  }

  // 6. Send email notification
  if (settings.email_enabled && settings.email_recipients?.length > 0) {
    try {
      await sendEmailNotification(settings.email_recipients, {
        totalMonthlyWaste: Number(report.total_monthly_waste),
        totalAnnualWaste: Number(report.total_annual_waste),
        ghostSeatCount: report.ghost_seat_count,
        duplicateCount: report.duplicate_count,
        reportUrl,
      })
      await logNotification(adminClient, orgId, reportId, 'email', 'sent')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      await logNotification(adminClient, orgId, reportId, 'email', 'failed', message)
    }
  }
}

async function logNotification(
  adminClient: SupabaseClient,
  orgId: string,
  reportId: string,
  channel: 'slack' | 'email',
  status: 'sent' | 'failed' | 'skipped',
  errorMessage?: string
): Promise<void> {
  await adminClient.from('notification_log').insert({
    org_id: orgId,
    report_id: reportId,
    channel,
    status,
    error_message: errorMessage,
  })
}
