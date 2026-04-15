// Google Workspace service — server-only
// Implements Admin SDK integration for usage data (Phase 3)

import { google, admin_directory_v1 } from 'googleapis'

export interface GoogleUserActivity {
  email: string
  displayName: string | null
  lastLogin: string | null
  status: 'active' | 'inactive' | 'suspended' | 'deprovisioned'
  department: string | null
  title: string | null
  isAdmin: boolean
}

/**
 * Create an authenticated Google Admin SDK client.
 */
function createAdminClient(accessToken: string): admin_directory_v1.Admin {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  return google.admin({
    version: 'directory_v1',
    auth,
  })
}

/**
 * Fetch all users from a Google Workspace domain with their last login timestamps.
 */
export async function listGoogleUsers(
  accessToken: string,
  domain: string
): Promise<GoogleUserActivity[]> {
  const adminClient = createAdminClient(accessToken)
  const users: GoogleUserActivity[] = []
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  let pageToken: string | undefined = undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let response: any

  do {
    response = await adminClient.users.list({
      domain,
      maxResults: 500,
      orderBy: 'email',
      projection: 'full',
      pageToken,
    })

    const googleUsers = response.data.users || []

    for (const user of googleUsers) {
      const lastLogin = user.lastLoginTime
        ? new Date(user.lastLoginTime)
        : null

      const isNeverLoggedIn =
        !lastLogin || lastLogin.getFullYear() <= 1970

      let status: GoogleUserActivity['status'] = 'active'
      if (user.suspended) {
        status = 'suspended'
      } else if (isNeverLoggedIn || lastLogin! < thirtyDaysAgo) {
        status = 'inactive'
      }

      users.push({
        email: user.primaryEmail ?? '',
        displayName: user.name?.fullName ?? null,
        lastLogin: isNeverLoggedIn ? null : user.lastLoginTime ?? null,
        status,
        department: user.organizations?.[0]?.department ?? null,
        title: user.organizations?.[0]?.title ?? null,
        isAdmin: user.isAdmin ?? false,
      })
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return users
}

/**
 * Refresh an expired Google OAuth token using the refresh token.
 */
export async function refreshGoogleToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: Date
}> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauth2Client.refreshAccessToken()

  return {
    accessToken: credentials.access_token!,
    expiresAt: new Date(credentials.expiry_date!),
  }
}

/**
 * Verify Google Workspace access by listing one user.
 */
export async function verifyGoogleConnection(
  accessToken: string,
  domain: string
): Promise<boolean> {
  try {
    const adminClient = createAdminClient(accessToken)
    await adminClient.users.list({
      domain,
      maxResults: 1,
    })
    return true
  } catch {
    return false
  }
}
