import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  typescript: true,
})

/**
 * Create or retrieve a Stripe customer for an organization.
 */
export async function getOrCreateStripeCustomer(
  orgId: string,
  orgName: string,
  adminEmail: string
): Promise<string> {
  const existing = await stripe.customers.list({
    limit: 1,
    email: adminEmail,
  })

  if (existing.data.length > 0) {
    return existing.data[0].id
  }

  const customer = await stripe.customers.create({
    email: adminEmail,
    name: orgName,
    metadata: {
      org_id: orgId,
    },
  })

  return customer.id
}

/**
 * Create a Stripe Checkout session for subscription.
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  orgId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      org_id: orgId,
    },
    subscription_data: {
      metadata: {
        org_id: orgId,
      },
    },
  })

  return session
}

/**
 * Create a Stripe Billing Portal session for self-service management.
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}

/**
 * Report usage for Recovery tier (metered billing).
 *
 * Uses Stripe Billing Meter Events API for usage-based pricing.
 */
export async function reportRecoveryUsage(
  subscriptionItemId: string,
  savingsAmount: number,
  commissionRate: number = 0.20
): Promise<void> {
  const commissionCents = Math.round(savingsAmount * commissionRate * 100)

  // Use the raw Stripe API for usage record creation
  // This is compatible with both legacy metered subscriptions and newer Billing Meters
  await stripe.billing.meterEvents.create({
    event_name: 'recovery_commission',
    payload: {
      value: String(commissionCents),
      stripe_customer_id: subscriptionItemId,
    },
  })
}

/**
 * Cancel a subscription at end of billing period.
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

/**
 * Reactivate a subscription that was set to cancel.
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  })
}
