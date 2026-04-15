import { SupabaseClient } from '@supabase/supabase-js'

export interface GhostSeatFinding {
  vendor: string
  normalizedName: string
  monthlyCost: number
  perSeatCost: number
  totalSeats: number
  activeSeats: number
  ghostSeats: number
  monthlyWaste: number
  inactiveUsers: {
    email: string
    displayName: string | null
    lastLogin: string | null
    daysSinceLogin: number
    provider: string
  }[]
}

/**
 * Detect ghost seats across all SaaS vendors for an organization.
 *
 * A "Ghost Seat" is a paid license for a user who has not logged in
 * within the last 30 days. The cost of that seat is pure waste.
 */
export async function detectGhostSeats(
  adminClient: SupabaseClient,
  orgId: string
): Promise<GhostSeatFinding[]> {
  const findings: GhostSeatFinding[] = []
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // 1. Fetch all active SaaS vendors for this org
  const { data: vendors } = await adminClient
    .from('saas_vendors')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (!vendors || vendors.length === 0) return findings

  // 2. Fetch all user activity records (exclude deprovisioned users)
  const { data: users } = await adminClient
    .from('user_activity')
    .select('*')
    .eq('org_id', orgId)
    .not('status', 'eq', 'deprovisioned')

  if (!users || users.length === 0) return findings

  // 3. Build activity lookup — for each email, keep the most recent login
  const userActivityMap = new Map<string, {
    email: string
    displayName: string | null
    lastLogin: Date | null
    provider: string
  }>()

  for (const user of users) {
    const existing = userActivityMap.get(user.email)
    const userLogin = user.last_login ? new Date(user.last_login) : null

    if (!existing || (userLogin && (!existing.lastLogin || userLogin > existing.lastLogin))) {
      userActivityMap.set(user.email, {
        email: user.email,
        displayName: user.display_name,
        lastLogin: userLogin,
        provider: user.provider,
      })
    }
  }

  // 4. For each vendor, match against user activity
  for (const vendor of vendors) {
    const totalSeats = vendor.seats_paid ?? userActivityMap.size
    const perSeatCost = vendor.seats_paid && vendor.monthly_cost
      ? Number(vendor.monthly_cost) / vendor.seats_paid
      : 0

    // Find inactive users (no login in 30+ days)
    const inactiveUsers: GhostSeatFinding['inactiveUsers'] = []

    for (const [, userData] of userActivityMap) {
      const isInactive = !userData.lastLogin || userData.lastLogin < thirtyDaysAgo

      if (isInactive) {
        const daysSinceLogin = userData.lastLogin
          ? Math.floor((now.getTime() - userData.lastLogin.getTime()) / (1000 * 60 * 60 * 24))
          : 999 // Never logged in

        inactiveUsers.push({
          email: userData.email,
          displayName: userData.displayName,
          lastLogin: userData.lastLogin?.toISOString() ?? null,
          daysSinceLogin,
          provider: userData.provider,
        })
      }
    }

    if (inactiveUsers.length === 0) continue

    const ghostSeats = inactiveUsers.length
    const activeSeats = totalSeats - ghostSeats
    const monthlyWaste = ghostSeats * perSeatCost

    findings.push({
      vendor: vendor.name,
      normalizedName: vendor.normalized_name,
      monthlyCost: Number(vendor.monthly_cost ?? 0),
      perSeatCost,
      totalSeats,
      activeSeats: Math.max(0, activeSeats),
      ghostSeats,
      monthlyWaste: Math.round(monthlyWaste * 100) / 100,
      inactiveUsers: inactiveUsers
        .sort((a, b) => b.daysSinceLogin - a.daysSinceLogin),
    })
  }

  // Sort by monthly waste (highest first)
  return findings.sort((a, b) => b.monthlyWaste - a.monthlyWaste)
}
