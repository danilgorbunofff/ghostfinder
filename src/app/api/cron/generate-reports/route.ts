import { createAdminClient } from '@/lib/supabase/admin'
import { generateWasteReport } from '@/lib/reconciliation/engine'
import { sendReportNotifications } from '@/lib/notifications/send'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  // 1. Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const results: {
    orgId: string
    success: boolean
    totalWaste?: number
    ghostSeats?: number
    duplicates?: number
    error?: string
  }[] = []

  try {
    // 2. Find orgs with both financial and usage data sources
    const { data: orgsWithPlaid } = await admin
      .from('plaid_connections')
      .select('org_id')
      .eq('status', 'active')

    const { data: orgsWithGoCardless } = await admin
      .from('gocardless_connections')
      .select('org_id')
      .eq('status', 'active')

    const { data: orgsWithIntegrations } = await admin
      .from('integration_connections')
      .select('org_id')
      .eq('is_active', true)

    if ((!orgsWithPlaid && !orgsWithGoCardless) || !orgsWithIntegrations) {
      return NextResponse.json({
        message: 'No qualifying organizations found',
        results: [],
      })
    }

    // Orgs need BOTH a bank connection (Plaid OR GoCardless) AND at least one identity provider
    const bankOrgIds = new Set([
      ...(orgsWithPlaid ?? []).map((c) => c.org_id),
      ...(orgsWithGoCardless ?? []).map((c) => c.org_id),
    ])
    const integrationOrgIds = new Set(orgsWithIntegrations.map((c) => c.org_id))
    const qualifiedOrgIds = [...bankOrgIds].filter((id) => integrationOrgIds.has(id))

    if (qualifiedOrgIds.length === 0) {
      return NextResponse.json({
        message: 'No orgs with both financial and usage data sources',
        results: [],
      })
    }

    // 3. Generate report for each qualifying org
    for (const orgId of qualifiedOrgIds) {
      try {
        const report = await generateWasteReport(admin, orgId)

        // Send notifications for Recovery tier orgs
        const { data: savedReport } = await admin
          .from('waste_reports')
          .select('id')
          .eq('org_id', orgId)
          .order('generated_at', { ascending: false })
          .limit(1)
          .single()

        if (savedReport) {
          await sendReportNotifications(admin, orgId, savedReport.id)
        }

        results.push({
          orgId,
          success: true,
          totalWaste: report.totalMonthlyWaste,
          ghostSeats: report.ghostSeatCount,
          duplicates: report.duplicateCount,
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        results.push({
          orgId,
          success: false,
          error: message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      orgsProcessed: qualifiedOrgIds.length,
      results,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Report generation cron failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
