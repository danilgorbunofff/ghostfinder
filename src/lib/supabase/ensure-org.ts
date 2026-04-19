import type { MemberRole } from '@/lib/types'
import { createAdminClient } from './admin'

/**
 * Ensures a user has an organization and org_members row.
 * Safety net for users whose handle_new_user() trigger didn't fire.
 * Uses admin client to bypass RLS.
 */
export async function ensureOrganization(
  userId: string,
  email?: string,
  fullName?: string
): Promise<{ orgId: string; role: MemberRole }> {
  const admin = createAdminClient()

  const { data: memberships, error: membershipError } = await admin
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (membershipError) {
    throw new Error(`Failed to load membership: ${membershipError.message}`)
  }

  const membership = memberships?.[0]

  if (membership) {
    return { orgId: membership.org_id, role: membership.role as MemberRole }
  }

  // No membership — create org + membership (mirrors handle_new_user trigger)
  const orgName = (fullName || email || 'My Organization') + "'s Organization"

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: orgName })
    .select('id')
    .single()

  if (orgError || !org) {
    throw new Error(`Failed to create organization: ${orgError?.message}`)
  }

  const { error: memberError } = await admin
    .from('org_members')
    .insert({ org_id: org.id, user_id: userId, role: 'owner' })

  if (memberError) {
    throw new Error(`Failed to create membership: ${memberError.message}`)
  }

  return { orgId: org.id, role: 'owner' }
}
