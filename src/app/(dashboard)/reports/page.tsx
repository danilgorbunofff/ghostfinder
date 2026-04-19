import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Building2, Copy, Ghost, Lightbulb, Shield, Sparkles, TrendingDown } from 'lucide-react'
import { ReportSelector } from '@/components/reports/report-selector'
import { GhostSeatCard } from '@/components/reports/ghost-seat-card'
import { ExportButton } from '@/components/reports/export-button'
import { ReportNotifyButton } from '@/components/reports/report-notify-button'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { normalizeDuplicateFindings, normalizeGhostSeatFindings } from '@/lib/reports/normalize-report'
import { getServerOrgContext } from '@/lib/supabase/server-org'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Waste Reports | GhostFinder',
  description: 'Ghost seat detection and duplicate subscription findings.',
}

const reportDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const currencyFormatter = new Intl.NumberFormat('en-US')

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ reportId?: string }>
}) {
  const params = await searchParams
  const { admin, orgId } = await getServerOrgContext()

  // Fetch report history for selector
  const { data: reportHistory, error: reportHistoryError } = await admin
    .from('waste_reports')
    .select('id, generated_at, total_monthly_waste')
    .eq('org_id', orgId)
    .order('generated_at', { ascending: false })
    .limit(12)

  if (reportHistoryError) {
    throw new Error(`Failed to load report history: ${reportHistoryError.message}`)
  }

  // Fetch selected or latest report
  let reportQuery = admin.from('waste_reports').select('*').eq('org_id', orgId)

  if (params.reportId) {
    reportQuery = reportQuery.eq('id', params.reportId)
  } else {
    reportQuery = reportQuery.order('generated_at', { ascending: false }).limit(1)
  }

  const { data: report, error: reportError } = await reportQuery.maybeSingle()

  if (reportError) {
    throw new Error(`Failed to load report: ${reportError.message}`)
  }

  if (!report) {
    return (
      <div className="space-y-6">
        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in-up">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-3xl bg-orange-500/10 blur-2xl" />
            <div className="relative h-24 w-24 rounded-3xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border flex items-center justify-center">
              <Ghost className="h-10 w-10 text-orange-500/40" />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1" data-testid="reports-empty-state">No reports generated yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
            Reports are generated weekly once you connect your data sources.
          </p>

          <div className="space-y-2 mb-6 w-full max-w-xs">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider text-center">
              Prerequisites
            </p>
            <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-brand-muted flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-brand" />
              </div>
              <span className="text-sm">Connect at least one bank account</span>
            </div>
            <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-green-500" />
              </div>
              <span className="text-sm">Connect an identity provider</span>
            </div>
          </div>

          <Button render={<Link href="/connections" />} className="group/btn gap-2">
            Get connected
            <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 group-hover/btn:translate-x-0 group-hover/btn:opacity-100 transition-all" />
          </Button>
        </div>
      </div>
    )
  }

  const ghostSeats = normalizeGhostSeatFindings(report.ghost_seats)
  const duplicates = normalizeDuplicateFindings(report.duplicates)
  const ghostSeatCount = Number(
    report.ghost_seat_count ?? ghostSeats.reduce((sum, finding) => sum + finding.ghostSeats, 0)
  )
  const duplicateCount = Number(report.duplicate_count ?? duplicates.length)
  const opportunityCount = Number(report.opportunity_count ?? ghostSeats.length + duplicates.length)

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in-up">
        <p className="text-muted-foreground" data-testid="report-date">
          Generated {reportDateFormatter.format(new Date(report.generated_at))} ·{' '}
          {opportunityCount} optimization opportunities found
        </p>
        <div className="flex items-center gap-3">
          <ReportSelector
            reports={reportHistory ?? []}
            currentId={report.id}
          />
          <ExportButton
            ghostSeats={ghostSeats}
            duplicates={duplicates}
            reportDate={report.generated_at}
          />
          <ReportNotifyButton reportId={report.id} />
        </div>
      </div>

      {/* Hero waste banner */}
      <div className="rounded-xl border bg-gradient-to-br from-orange-500/[0.06] via-red-500/[0.03] to-transparent dark:from-orange-500/[0.1] dark:via-red-500/[0.05] p-6 md:p-8 card-interactive animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Total Monthly Waste Detected
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl md:text-5xl font-bold text-orange-500 tabular-nums tracking-tight animate-number-roll" data-testid="report-total-waste">
                ${currencyFormatter.format(Number(report.total_monthly_waste ?? 0))}
              </span>
              <span className="text-lg font-normal text-muted-foreground">/mo</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-500/[0.06] dark:bg-red-500/[0.1] px-2.5 py-1">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              <span className="text-sm font-semibold text-destructive tabular-nums">
                ${currencyFormatter.format(Number(report.total_annual_waste ?? 0))}
              </span>
              <span className="text-xs text-muted-foreground">projected annual waste</span>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="rounded-xl border bg-card p-3 min-w-[90px] text-center animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <Ghost className="h-4 w-4 text-orange-500 mx-auto mb-1" />
              <div className="text-xl font-bold tabular-nums">{ghostSeatCount}</div>
              <p className="text-[10px] text-muted-foreground">Ghost Seats</p>
            </div>
            <div className="rounded-xl border bg-card p-3 min-w-[90px] text-center animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <Copy className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <div className="text-xl font-bold tabular-nums">{duplicateCount}</div>
              <p className="text-[10px] text-muted-foreground">Duplicates</p>
            </div>
            <div className="rounded-xl border bg-card p-3 min-w-[90px] text-center animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <Sparkles className="h-4 w-4 text-brand mx-auto mb-1" />
              <div className="text-xl font-bold tabular-nums text-brand">{opportunityCount}</div>
              <p className="text-[10px] text-muted-foreground">Opportunities</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed Detail View */}
      <Tabs defaultValue="ghost-seats">
        <TabsList>
          <TabsTrigger value="ghost-seats" className="gap-2">
            <Ghost className="h-4 w-4" />
            Ghost Seats
            <Badge variant="outline" className="ml-0.5 text-[10px] px-1.5 py-0 bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900">
              {ghostSeats.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="gap-2">
            <Copy className="h-4 w-4" />
            Duplicates
            <Badge variant="outline" className="ml-0.5 text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900">
              {duplicates.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Ghost Seats Tab */}
        <TabsContent value="ghost-seats" className="space-y-4" data-testid="ghost-seats">
          {ghostSeats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Ghost className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">No ghost seats detected</p>
              <p className="text-xs text-muted-foreground mt-1">All users are actively using their licenses.</p>
            </div>
          ) : (
            ghostSeats.map((finding, index) => (
              <GhostSeatCard key={index} finding={finding} index={index} />
            ))
          )}
        </TabsContent>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates" className="space-y-4" data-testid="duplicates">
          {duplicates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Copy className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">No duplicates detected</p>
              <p className="text-xs text-muted-foreground mt-1">No overlapping vendor categories found.</p>
            </div>
          ) : duplicates.map((finding, index) => {
            const savings = finding.potentialSavings
            return (
              <Card key={index} className="card-interactive animate-fade-in-up" style={{ animationDelay: `${index * 60}ms` }} data-testid="duplicate-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{finding.category}</CardTitle>
                    <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900 gap-1.5">
                      <TrendingDown className="h-3 w-3" />
                      Save ${savings}/mo
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Side-by-side vendor comparison */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {finding.vendors.map(
                      (vendor, i) => (
                        <div
                          key={i}
                          className={`rounded-xl border p-4 text-center transition-all ${
                            i === 0
                              ? 'border-brand/30 bg-brand-muted shadow-sm'
                              : 'border-dashed opacity-70'
                          }`}
                        >
                          {/* Vendor avatar */}
                          <div className={`h-8 w-8 rounded-lg mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold bg-gradient-to-br ${
                            i === 0
                              ? 'from-brand to-brand-hover'
                              : 'from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700'
                          }`}>
                            {vendor.name.charAt(0).toUpperCase()}
                          </div>
                          <p className="font-semibold text-sm">{vendor.name}</p>
                          <p className="text-2xl font-bold mt-1 tabular-nums">
                            ${vendor.monthlyCost}
                            <span className="text-xs font-normal text-muted-foreground">/mo</span>
                          </p>
                          {i === 0 ? (
                            <Badge variant="outline" className="mt-2 text-[10px]">
                              Keep
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground mt-2 block">
                              Consider removing
                            </span>
                          )}
                        </div>
                      )
                    )}
                  </div>

                  {/* Recommendation */}
                  <div className="rounded-xl bg-brand-muted/50 border border-brand/10 p-3">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-brand mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        {finding.recommendation}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
      </Tabs>
    </div>
  )
}
