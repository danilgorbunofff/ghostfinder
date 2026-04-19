import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { createBillingPortalSession } from '@/lib/services/stripe.service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (process.env.MOCK_SERVICES === 'true') {
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
    return NextResponse.json({ url: `${origin}/billing?mock_portal=true` })
  }

  const admin = createAdminClient()
  const membership = await ensureOrganization(
    user.id,
    user.email ?? undefined,
    user.user_metadata?.full_name ?? undefined
  )

  // Only owner/admin can manage billing
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ error: 'Only owners and admins can manage billing' }, { status: 403 })
  }

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('org_id', membership.orgId)
    .single()

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
  const session = await createBillingPortalSession(
    subscription.stripe_customer_id,
    `${origin}/billing`
  )

  return NextResponse.json({ url: session.url })
}
