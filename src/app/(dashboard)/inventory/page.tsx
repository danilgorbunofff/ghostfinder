import Link from 'next/link'
import { Package } from 'lucide-react'
import { InventoryView } from './inventory-view'
import { InventoryStats } from '@/components/dashboard/inventory-stats'
import { getServerOrgContext } from '@/lib/supabase/server-org'
import type { VendorRow } from '@/lib/types'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'SaaS Inventory | GhostFinder',
  description: 'All detected software subscriptions across your connected accounts.',
}

function formatLastActivity(date: string | null): string {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function vendorStatus(isActive: boolean, lastActivityAt: string | null): 'active' | 'inactive' | 'warning' {
  if (!isActive) return 'inactive'
  if (!lastActivityAt) return 'warning'
  const days = Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / 86400000)
  if (days > 30) return 'warning'
  return 'active'
}

export default async function InventoryPage() {
  const { admin, orgId } = await getServerOrgContext()

  let vendors: VendorRow[] = []
  let totalSpend = 0

  const { data: saasVendors, error } = await admin
    .from('saas_vendors')
    .select('name, monthly_cost, seats_paid, last_seen, is_active, category')
    .eq('org_id', orgId)
    .order('monthly_cost', { ascending: false })

  if (error) {
    throw new Error(`Failed to load vendors: ${error.message}`)
  }

  vendors = (saasVendors ?? []).map((v) => ({
    name: v.name,
    monthlyCost: Number(v.monthly_cost ?? 0),
    seats: v.seats_paid ?? 0,
    lastActivity: formatLastActivity(v.last_seen),
    status: vendorStatus(v.is_active, v.last_seen),
    category: v.category ?? null,
  }))

  totalSpend = vendors.reduce((sum, v) => sum + v.monthlyCost, 0)

  const activeVendors = vendors.filter(v => v.status === 'active').length
  const avgCost = vendors.length > 0 ? Math.round(totalSpend / vendors.length) : 0

  if (vendors.length === 0) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground animate-fade-in-up">
          All detected software subscriptions across your connected accounts.
        </p>
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in-up">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-3xl bg-brand/10 blur-2xl" />
            <div className="relative h-24 w-24 rounded-3xl bg-gradient-to-br from-brand-muted to-muted flex items-center justify-center">
              <Package className="h-10 w-10 text-brand/40" />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1">No SaaS vendors detected yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
            Connect a data source to automatically discover your software subscriptions and their costs.
          </p>
          <Link
            href="/connections"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-sm hover:bg-brand-hover transition-colors"
          >
            Connect a data source
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground animate-fade-in-up">
        All detected software subscriptions across your connected accounts.
      </p>

      {/* Stats strip */}
      <InventoryStats
        totalVendors={vendors.length}
        activeVendors={activeVendors}
        totalSpend={totalSpend}
        avgCost={avgCost}
      />

      {/* Vendors table/grid */}
      <InventoryView vendors={vendors} totalSpend={totalSpend} />
    </div>
  )
}
