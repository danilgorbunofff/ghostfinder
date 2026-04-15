// Okta service — server-only
// Implements user directory sync and usage detection (Phase 3)

import { Client as OktaClient } from '@okta/okta-sdk-nodejs'

export interface OktaUserActivity {
  email: string
  displayName: string | null
  lastLogin: string | null
  status: 'active' | 'inactive' | 'suspended' | 'deprovisioned'
  department: string | null
  title: string | null
  isAdmin: boolean
}

/**
 * Fetch all users from an Okta organization with their last login timestamps.
 */
export async function listOktaUsers(
  orgUrl: string,
  apiToken: string
): Promise<OktaUserActivity[]> {
  const client = new OktaClient({
    orgUrl,
    token: apiToken,
  })

  const users: OktaUserActivity[] = []
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const collection = await client.userApi.listUsers()

  for await (const user of collection) {
    if (!user) continue
    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null

    let status: OktaUserActivity['status'] = 'active'
    if (user.status === 'SUSPENDED') {
      status = 'suspended'
    } else if (user.status === 'DEPROVISIONED') {
      status = 'deprovisioned'
    } else if (!lastLogin || lastLogin < thirtyDaysAgo) {
      status = 'inactive'
    }

    users.push({
      email: user.profile?.email ?? '',
      displayName: user.profile
        ? `${user.profile.firstName ?? ''} ${user.profile.lastName ?? ''}`.trim()
        : null,
      lastLogin: user.lastLogin ? new Date(user.lastLogin).toISOString() : null,
      status,
      department: user.profile?.department ?? null,
      title: user.profile?.title ?? null,
      isAdmin: false,
    })
  }

  return users
}

/**
 * Verify Okta API token is valid by making a test request.
 */
export async function verifyOktaConnection(
  orgUrl: string,
  apiToken: string
): Promise<boolean> {
  try {
    const client = new OktaClient({ orgUrl, token: apiToken })
    const collection = await client.userApi.listUsers({ limit: 1 })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _user of collection) {
      break
    }
    return true
  } catch {
    return false
  }
}
