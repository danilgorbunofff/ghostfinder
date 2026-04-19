import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { getOrCreateStripeCustomer, createCheckoutSession } from '@/lib/services/stripe.service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { priceId } = await request.json()
  if (!priceId || typeof priceId !== 'string') {
    return NextResponse.json({ error: 'priceId is required' }, { status: 400 })
  }

  // Validate price ID against allowed values
  const allowedPrices = [
    process.env.NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_MONITOR_ANNUAL_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_RECOVERY_ANNUAL_PRICE_ID,
  ].filter(Boolean)
  if (!allowedPrices.includes(priceId)) {
    return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 })
  }

  if (process.env.MOCK_SERVICES === 'true') {
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
    return NextResponse.json({ url: `${origin}/billing?mock_checkout=true` })
  }

  const admin = createAdminClient()
  const membership = await ensureOrganization(
    user.id,
    user.email ?? undefined,
    user.user_metadata?.full_name ?? undefined
  )

  // Only owner/admin can upgrade
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ error: 'Only owners and admins can manage billing' }, { status: 403 })
  }

  const { data: organization, error: organizationError } = await admin
    .from('organizations')
    .select('name')
    .eq('id', membership.orgId)
    .maybeSingle()

  if (organizationError) {
    return NextResponse.json({ error: 'Failed to load organization' }, { status: 500 })
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(
    membership.orgId,
    organization?.name ?? 'My Org',
    user.email!
  )

  // Persist Stripe customer ID if new
  await admin
    .from('subscriptions')
    .upsert({
      org_id: membership.orgId,
      stripe_customer_id: customerId,
      tier: 'free',
    }, {
      onConflict: 'org_id',
      ignoreDuplicates: true,
    })

  // Create Checkout session
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
  const session = await createCheckoutSession(
    customerId,
    priceId,
    membership.orgId,
    `${origin}/billing?success=true`,
    `${origin}/billing?canceled=true`
  )

  return NextResponse.json({ url: session.url })
}
