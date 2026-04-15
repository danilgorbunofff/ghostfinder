import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Package } from 'lucide-react'
import { PlaidLinkButton } from '@/components/connections/plaid-link-button'
import { InventoryView } from './inventory-view'
import type { VendorRow } from '@/lib/types'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  const orgId = membership?.org_id

  let vendors: VendorRow[] = []
  let totalSpend = 0

  if (orgId) {
    const { data: saasVendors } = await supabase
      .from('saas_vendors')
      .select('display_name, monthly_cost, seats_paid, last_activity_at, is_active, category')
      .eq('org_id', orgId)
      .order('monthly_cost', { ascending: false })

    vendors = (saasVendors ?? []).map((v) => ({
      name: v.display_name,
      monthlyCost: Number(v.monthly_cost ?? 0),
      seats: v.seats_paid ?? 0,
      lastActivity: formatLastActivity(v.last_activity_at),
      status: vendorStatus(v.is_active, v.last_activity_at),
      category: v.category ?? null,
    }))

    totalSpend = vendors.reduce((sum, v) => sum + v.monthlyCost, 0)
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        All detected software subscriptions across your connected accounts.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Vendors ({vendors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {vendors.length > 0 ? (
            <InventoryView vendors={vendors} totalSpend={totalSpend} />
          ) : (
            <EmptyState
              icon={Package}
              title="No vendors detected yet"
              description="Connect a bank account to automatically discover your SaaS subscriptions and their costs."
              action={<PlaidLinkButton />}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
