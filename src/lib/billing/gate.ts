import { SupabaseClient } from '@supabase/supabase-js'

export type Tier = 'free' | 'monitor' | 'recovery'

/**
 * Feature gate definitions.
 * Maps feature keys to the minimum tier required to access them.
 * Tiers are ordered: free < monitor < recovery.
 */
const FEATURE_GATES: Record<string, Tier> = {
  'reports.view':         'monitor',
  'reports.history':      'monitor',
  'ghost-seats.list':     'monitor',
  'duplicates.list':      'monitor',
  'notifications.slack':  'recovery',
  'notifications.email':  'recovery',
  'notifications.send':   'recovery',
  'recovery.tracking':    'recovery',
}

const TIER_LEVELS: Record<Tier, number> = {
  free: 0,
  monitor: 1,
  recovery: 2,
}

/**
 * Check if a feature is accessible for a given tier.
 */
export function hasAccess(currentTier: Tier, feature: string): boolean {
  const requiredTier = FEATURE_GATES[feature]
  if (!requiredTier) return true // Unknown feature = allowed (fail open)

  return TIER_LEVELS[currentTier] >= TIER_LEVELS[requiredTier]
}

/**
 * Get the current tier for an organization.
 */
export async function getOrgTier(
  supabase: SupabaseClient,
  orgId: string
): Promise<Tier> {
  const { data } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('org_id', orgId)
    .single()

  if (!data || data.status === 'canceled' || data.status === 'past_due') {
    return 'free'
  }

  return (data.tier as Tier) ?? 'free'
}

/**
 * Get the required tier for a feature (for paywall messaging).
 */
export function getRequiredTier(feature: string): Tier | null {
  return FEATURE_GATES[feature] ?? null
}
