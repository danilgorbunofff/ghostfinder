import { SupabaseClient } from '@supabase/supabase-js'
import { detectGhostSeats, type GhostSeatFinding } from './ghost-detector'
import { detectDuplicates, type DuplicateFinding } from './duplicate-detector'

export interface WasteReport {
  orgId: string
  generatedAt: string
  totalMonthlyWaste: number
  totalAnnualWaste: number
  ghostSeatCount: number
  duplicateCount: number
  opportunityCount: number
  ghostSeats: GhostSeatFinding[]
  duplicates: DuplicateFinding[]
  metadata: {
    totalSaaSSpend: number
    vendorsAnalyzed: number
    usersAnalyzed: number
    dataSourcesUsed: string[]
    reportVersion: string
  }
}

/**
 * Generate a comprehensive waste report for an organization.
 *
 * Orchestrates ghost seat and duplicate detectors, aggregates results,
 * and persists the report to the database.
 */
export async function generateWasteReport(
  adminClient: SupabaseClient,
  orgId: string
): Promise<WasteReport> {
  const generatedAt = new Date().toISOString()

  // 1. Run detectors in parallel
  const [ghostSeats, duplicates] = await Promise.all([
    detectGhostSeats(adminClient, orgId),
    detectDuplicates(adminClient, orgId),
  ])

  // 2. Calculate summary metrics
  const ghostWaste = ghostSeats.reduce((sum, g) => sum + g.monthlyWaste, 0)
  const duplicateWaste = duplicates.reduce((sum, d) => sum + d.potentialSavings, 0)
  const totalMonthlyWaste = ghostWaste + duplicateWaste
  const totalAnnualWaste = totalMonthlyWaste * 12

  const ghostSeatCount = ghostSeats.reduce((sum, g) => sum + g.ghostSeats, 0)
  const duplicateCount = duplicates.length
  const opportunityCount = ghostSeats.filter((g) => g.ghostSeats > 0).length + duplicateCount

  // 3. Gather metadata
  const { data: vendors } = await adminClient
    .from('saas_vendors')
    .select('monthly_cost')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const totalSaaSSpend = vendors?.reduce(
    (sum, v) => sum + Number(v.monthly_cost ?? 0), 0
  ) ?? 0

  const { count: userCount } = await adminClient
    .from('user_activity')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)

  const { data: integrations } = await adminClient
    .from('integration_connections')
    .select('provider')
    .eq('org_id', orgId)
    .eq('is_active', true)

  const dataSourcesUsed = [
    'plaid',
    ...(integrations?.map((i) => i.provider) ?? []),
  ]

  const metadata = {
    totalSaaSSpend: Math.round(totalSaaSSpend * 100) / 100,
    vendorsAnalyzed: vendors?.length ?? 0,
    usersAnalyzed: userCount ?? 0,
    dataSourcesUsed,
    reportVersion: '1.0',
  }

  // 4. Persist report to database
  const report: WasteReport = {
    orgId,
    generatedAt,
    totalMonthlyWaste: Math.round(totalMonthlyWaste * 100) / 100,
    totalAnnualWaste: Math.round(totalAnnualWaste * 100) / 100,
    ghostSeatCount,
    duplicateCount,
    opportunityCount,
    ghostSeats,
    duplicates,
    metadata,
  }

  const { error: insertError } = await adminClient
    .from('waste_reports')
    .insert({
      org_id: orgId,
      generated_at: generatedAt,
      total_monthly_waste: report.totalMonthlyWaste,
      total_annual_waste: report.totalAnnualWaste,
      ghost_seat_count: report.ghostSeatCount,
      duplicate_count: report.duplicateCount,
      opportunity_count: report.opportunityCount,
      ghost_seats: report.ghostSeats,
      duplicates: report.duplicates,
      report_metadata: report.metadata,
    })

  if (insertError) {
    console.error('Failed to persist waste report:', insertError)
    throw new Error(`Failed to save waste report: ${insertError.message}`)
  }

  return report
}
