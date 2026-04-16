import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // Get user's org
  const { data: membership } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('org_id', membership.org_id)
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
