import { createClient } from '@/lib/supabase/server'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { GettingStarted } from '@/components/dashboard/getting-started'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { SpendChart } from '@/components/dashboard/spend-chart'
import { VendorBreakdown } from '@/components/dashboard/vendor-breakdown'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard | GhostFinder',
  description: 'Overview of your SaaS spend, waste, and optimization opportunities.',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: spendData } = await supabase
    .from('saas_vendors')
    .select('name, monthly_cost')
    .eq('is_active', true)

  const totalSpend = spendData?.reduce(
    (sum, v) => sum + Number(v.monthly_cost || 0), 0
  ) ?? 0

  // Fetch user activity summary from connected identity providers
  const { data: integrations } = await supabase
    .from('integration_connections')
    .select('total_users, active_users, inactive_users')
    .eq('is_active', true)

  const totalUsers = integrations?.reduce((s, i) => s + (i.total_users || 0), 0) ?? 0
  const inactiveUsers = integrations?.reduce((s, i) => s + (i.inactive_users || 0), 0) ?? 0

  // Fetch last 2 reports for trend calculation
  const { data: recentReports } = await supabase
    .from('waste_reports')
    .select('total_monthly_waste, opportunity_count, generated_at')
    .order('generated_at', { ascending: false })
    .limit(2)

  const current = recentReports?.[0]
  const previous = recentReports?.[1]

  const estimatedWaste = Number(current?.total_monthly_waste ?? 0)
  const opportunities = current?.opportunity_count ?? 0
  const lastScanned = current?.generated_at ?? null

  let wasteTrend: { value: number; label: string } | null = null
  if (current && previous && Number(previous.total_monthly_waste) > 0) {
    const pct = Math.round(
      ((Number(current.total_monthly_waste) - Number(previous.total_monthly_waste))
        / Number(previous.total_monthly_waste)) * 100
    )
    wasteTrend = { value: pct, label: 'vs last report' }
  }

  // Check connection states for Getting Started
  const { count: bankCount } = await supabase
    .from('plaid_connections')
    .select('*', { count: 'exact', head: true })

  const { count: idpCount } = await supabase
    .from('integration_connections')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const hasBankConnection = (bankCount ?? 0) > 0
  const hasIdentityProvider = (idpCount ?? 0) > 0
  const hasReport = !!current

  // Vendor breakdown for donut chart
  const vendorList = (spendData ?? [])
    .filter(v => Number(v.monthly_cost || 0) > 0)
    .map(v => ({ name: v.name ?? 'Unknown', cost: Number(v.monthly_cost) }))

  return (
    <div className="space-y-6">
      {/* Description + timestamp */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <p className="text-muted-foreground">
          Your SaaS spend overview and optimization opportunities.
        </p>
        {lastScanned && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <time dateTime={lastScanned}>
              {new Date(lastScanned).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
        )}
      </div>

      {/* Getting Started — only when incomplete */}
      <GettingStarted
        hasBankConnection={hasBankConnection}
        hasIdentityProvider={hasIdentityProvider}
        hasWasteReport={hasReport}
      />

      {/* KPI Cards */}
      <StatsCards
        totalSpend={totalSpend}
        estimatedWaste={estimatedWaste}
        opportunities={opportunities}
        totalUsers={totalUsers}
        inactiveUsers={inactiveUsers}
        wasteTrend={wasteTrend}
      />

      {/* Quick actions */}
      <QuickActions
        hasReport={hasReport}
        hasConnections={hasBankConnection || hasIdentityProvider}
      />

      {/* Charts row */}
      {totalSpend > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SpendChart totalSpend={totalSpend} />
          <VendorBreakdown vendors={vendorList} />
        </div>
      )}
    </div>
  )
}
