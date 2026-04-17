import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, Building2, Copy, Download, Ghost, Lightbulb, Shield, Sparkles, TrendingDown } from 'lucide-react'
import { ReportSelector } from '@/components/reports/report-selector'
import { GhostSeatCard } from '@/components/reports/ghost-seat-card'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Waste Reports | GhostFinder',
  description: 'Ghost seat detection and duplicate subscription findings.',
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ reportId?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Fetch report history for selector
  const { data: reportHistory } = await supabase
    .from('waste_reports')
    .select('id, generated_at, total_monthly_waste')
    .order('generated_at', { ascending: false })
    .limit(12)

  // Fetch selected or latest report
  let reportQuery = supabase.from('waste_reports').select('*')

  if (params.reportId) {
    reportQuery = reportQuery.eq('id', params.reportId)
  } else {
    reportQuery = reportQuery.order('generated_at', { ascending: false }).limit(1)
  }

  const { data: report } = await reportQuery.single()

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

  const ghostSeats = (report.ghost_seats as Record<string, unknown>[]) ?? []
  const duplicates = (report.duplicates as Record<string, unknown>[]) ?? []

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in-up">
        <p className="text-muted-foreground" data-testid="report-date">
          Generated {new Date(report.generated_at).toLocaleDateString()} ·{' '}
          {report.opportunity_count} optimization opportunities found
        </p>
        <div className="flex items-center gap-3">
          <ReportSelector
            reports={reportHistory ?? []}
            currentId={report.id}
          />
          <Button variant="outline" size="sm" disabled className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
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
              <span className="text-4xl md:text-5xl font-bold text-orange-500 tabular-nums tracking-tight animate-number-roll" data-testid="total-waste">
                ${Number(report.total_monthly_waste ?? 0).toLocaleString()}
              </span>
              <span className="text-lg font-normal text-muted-foreground">/mo</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-500/[0.06] dark:bg-red-500/[0.1] px-2.5 py-1">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              <span className="text-sm font-semibold text-destructive tabular-nums">
                ${Number(report.total_annual_waste ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">projected annual waste</span>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="rounded-xl border bg-card p-3 min-w-[90px] text-center animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <Ghost className="h-4 w-4 text-orange-500 mx-auto mb-1" />
              <div className="text-xl font-bold tabular-nums">{report.ghost_seat_count}</div>
              <p className="text-[10px] text-muted-foreground">Ghost Seats</p>
            </div>
            <div className="rounded-xl border bg-card p-3 min-w-[90px] text-center animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <Copy className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <div className="text-xl font-bold tabular-nums">{report.duplicate_count}</div>
              <p className="text-[10px] text-muted-foreground">Duplicates</p>
            </div>
            <div className="rounded-xl border bg-card p-3 min-w-[90px] text-center animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <Sparkles className="h-4 w-4 text-brand mx-auto mb-1" />
              <div className="text-xl font-bold tabular-nums text-brand">{report.opportunity_count}</div>
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
        <TabsContent value="ghost-seats" className="space-y-4">
          {ghostSeats.map((finding: Record<string, unknown>, index: number) => (
            <GhostSeatCard key={index} finding={finding} index={index} />
          ))}
        </TabsContent>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates" className="space-y-4">
          {duplicates.map((finding: Record<string, unknown>, index: number) => {
            const savings = finding.potentialSavings as number
            return (
              <Card key={index} className="card-interactive animate-fade-in-up" style={{ animationDelay: `${index * 60}ms` }}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{finding.category as string}</CardTitle>
                    <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900 gap-1.5">
                      <TrendingDown className="h-3 w-3" />
                      Save ${savings}/mo
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Side-by-side vendor comparison */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(finding.vendors as Record<string, unknown>[])?.map(
                      (v: Record<string, unknown>, i: number) => (
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
                            {(v.name as string).charAt(0).toUpperCase()}
                          </div>
                          <p className="font-semibold text-sm">{v.name as string}</p>
                          <p className="text-2xl font-bold mt-1 tabular-nums">
                            ${v.monthlyCost as number}
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
                        {finding.recommendation as string}
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
