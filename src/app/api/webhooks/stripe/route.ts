import { stripe } from '@/lib/services/stripe.service'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  // 1. Verify webhook signature
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Webhook signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 2. Handle relevant events
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.org_id
        const subscriptionId = session.subscription as string

        if (!orgId || !subscriptionId) break

        // Fetch the subscription to determine the tier
        const subResponse = await stripe.subscriptions.retrieve(subscriptionId)
        const sub = subResponse as unknown as Stripe.Subscription
        const subItem = sub.items.data[0]
        const priceId = subItem?.price?.id
        const tier = determineTier(priceId)

        await admin
          .from('subscriptions')
          .upsert({
            org_id: orgId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            tier,
            status: 'active',
            current_period_start: subItem ? new Date(subItem.current_period_start * 1000).toISOString() : null,
            current_period_end: subItem ? new Date(subItem.current_period_end * 1000).toISOString() : null,
          }, {
            onConflict: 'org_id',
          })

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata?.org_id
        if (!orgId) break

        const updatedItem = subscription.items.data[0]
        const priceId = updatedItem?.price?.id

        await admin
          .from('subscriptions')
          .update({
            status: subscription.status,
            stripe_price_id: priceId,
            tier: determineTier(priceId),
            current_period_start: updatedItem ? new Date(updatedItem.current_period_start * 1000).toISOString() : null,
            current_period_end: updatedItem ? new Date(updatedItem.current_period_end * 1000).toISOString() : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('org_id', orgId)

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata?.org_id
        if (!orgId) break

        await admin
          .from('subscriptions')
          .update({
            status: 'canceled',
            tier: 'free',
          })
          .eq('org_id', orgId)

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.parent?.subscription_details?.subscription as string | undefined
        if (!subscriptionId) break

        await admin
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId)

        break
      }

      default:
        break
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Webhook handler error for ${event.type}:`, message)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  // 3. Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true })
}

function determineTier(priceId: string | undefined): 'free' | 'monitor' | 'recovery' {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_MONITOR_PRICE_ID) return 'monitor'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_RECOVERY_PRICE_ID) return 'recovery'
  return 'free'
}
