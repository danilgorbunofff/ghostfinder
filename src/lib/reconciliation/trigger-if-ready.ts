import { SupabaseClient } from '@supabase/supabase-js'
import { generateWasteReport } from './engine'
import { sendReportNotifications } from '@/lib/notifications/send'

/**
 * Check if an org has both prerequisites (Plaid + identity provider)
 * and immediately generate a waste report if so.
 *
 * Safe to call after any connection is saved — never throws.
 * Returns true if a scan was triggered, false otherwise.
 */
export async function triggerScanIfReady(
  adminClient: SupabaseClient,
  orgId: string
): Promise<boolean> {
  try {
    const [{ data: plaid }, { data: integrations }] = await Promise.all([
      adminClient
        .from('plaid_connections')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .limit(1),
      adminClient
        .from('integration_connections')
        .select('id')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .limit(1),
    ])

    if (!plaid?.length || !integrations?.length) {
      return false
    }

    const report = await generateWasteReport(adminClient, orgId)

    const { data: savedReport } = await adminClient
      .from('waste_reports')
      .select('id')
      .eq('org_id', orgId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (savedReport) {
      await sendReportNotifications(adminClient, orgId, savedReport.id)
    }

    console.log(
      `[trigger-if-ready] Scan completed for org ${orgId}: $${report.totalMonthlyWaste}/mo waste, ${report.ghostSeatCount} ghost seats`
    )
    return true
  } catch (err) {
    console.error(`[trigger-if-ready] Scan failed for org ${orgId}:`, err)
    return false
  }
}
