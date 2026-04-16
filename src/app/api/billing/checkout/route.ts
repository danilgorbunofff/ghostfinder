import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
    process.env.NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID,
  ]
  if (!allowedPrices.includes(priceId)) {
    return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 })
  }

  if (process.env.MOCK_SERVICES === 'true') {
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
    return NextResponse.json({ url: `${origin}/billing?mock_checkout=true` })
  }

  // Get user's org
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('org_members')
    .select('org_id, organizations(name)')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(
    membership.org_id,
    (membership.organizations as unknown as { name: string }).name,
    user.email!
  )

  // Persist Stripe customer ID if new
  await admin
    .from('subscriptions')
    .upsert({
      org_id: membership.org_id,
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
    membership.org_id,
    `${origin}/billing?success=true`,
    `${origin}/billing?canceled=true`
  )

  return NextResponse.json({ url: session.url })
}
