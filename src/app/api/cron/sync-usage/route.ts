import { createAdminClient } from '@/lib/supabase/admin'
import { listOktaUsers } from '@/lib/services/okta.service'
import { listGoogleUsers, refreshGoogleToken } from '@/lib/services/google.service'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  // ─── 1. Verify cron secret ─────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const results: {
    connectionId: string
    provider: string
    usersProcessed: number
    activeUsers: number
    inactiveUsers: number
    error: string | null
  }[] = []

  try {
    // ─── 2. Fetch all active integration connections ──────────────────
    const { data: connections } = await admin
      .from('integration_connections')
      .select('*')
      .eq('is_active', true)

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: 'No active integrations', results: [] })
    }

    // ─── 3. Process each connection ──────────────────────────────────
    for (const connection of connections) {
      const result = {
        connectionId: connection.id,
        provider: connection.provider,
        usersProcessed: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        error: null as string | null,
      }

      try {
        // Skip external API calls for mock connections (no real vault token)
        if (!connection.access_token_secret_id) {
          // Still update stats from existing user_activity rows
          const { count: activeCount } = await admin
            .from('user_activity')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', connection.org_id)
            .eq('provider', connection.provider)
            .eq('status', 'active')

          const { count: inactiveCount } = await admin
            .from('user_activity')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', connection.org_id)
            .eq('provider', connection.provider)
            .neq('status', 'active')

          const total = (activeCount ?? 0) + (inactiveCount ?? 0)
          if (total > 0) {
            await admin
              .from('integration_connections')
              .update({
                last_synced_at: new Date().toISOString(),
                total_users: total,
                active_users: activeCount ?? 0,
                inactive_users: inactiveCount ?? 0,
                error_message: null,
              })
              .eq('id', connection.id)
          }

          result.usersProcessed = total
          result.activeUsers = activeCount ?? 0
          result.inactiveUsers = inactiveCount ?? 0
          results.push(result)
          continue
        }

        let users: {
          email: string
          displayName: string | null
          lastLogin: string | null
          status: string
          department: string | null
          title: string | null
          isAdmin: boolean
        }[] = []

        // ─── Fetch users based on provider ──────────────────────────
        if (connection.provider === 'okta') {
          const { data: apiToken } = await admin.rpc('get_secret', {
            p_secret_id: connection.access_token_secret_id,
          })

          if (!apiToken) {
            result.error = 'Failed to retrieve Okta API token from Vault'
            results.push(result)
            continue
          }

          const orgUrl = (connection.metadata as Record<string, string> | null)?.orgUrl
          if (!orgUrl) {
            result.error = 'Missing Okta org URL in metadata'
            results.push(result)
            continue
          }

          users = await listOktaUsers(orgUrl, apiToken)

        } else if (connection.provider === 'google_workspace') {
          let accessToken: string

          if (connection.token_expires_at &&
              new Date(connection.token_expires_at) < new Date()) {
            // Token expired — refresh it
            const { data: refreshToken } = await admin.rpc('get_secret', {
              p_secret_id: connection.refresh_token_secret_id,
            })

            if (!refreshToken) {
              result.error = 'Failed to retrieve Google refresh token'
              await admin
                .from('integration_connections')
                .update({ is_active: false, error_message: result.error })
                .eq('id', connection.id)
              results.push(result)
              continue
            }

            const refreshed = await refreshGoogleToken(refreshToken)
            accessToken = refreshed.accessToken

            // Store new access token in Vault
            const { data: newSecretId } = await admin.rpc('store_secret', {
              p_secret: accessToken,
              p_name: `google_access_${connection.org_id}_refreshed`,
              p_description: 'Refreshed Google access token',
            })

            // Update connection with new token and expiry
            await admin
              .from('integration_connections')
              .update({
                access_token_secret_id: newSecretId,
                token_expires_at: refreshed.expiresAt.toISOString(),
              })
              .eq('id', connection.id)
          } else {
            const { data: token } = await admin.rpc('get_secret', {
              p_secret_id: connection.access_token_secret_id,
            })
            accessToken = token
          }

          if (!accessToken) {
            result.error = 'Failed to retrieve Google access token'
            results.push(result)
            continue
          }

          const domain = (connection.metadata as Record<string, string> | null)?.domain
          if (!domain) {
            result.error = 'Missing Google Workspace domain in metadata'
            results.push(result)
            continue
          }

          users = await listGoogleUsers(accessToken, domain)
        }

        // ─── 4. Upsert user activity data ────────────────────────────
        let activeCount = 0
        let inactiveCount = 0

        for (const user of users) {
          if (!user.email) continue

          const isInactive = user.status === 'inactive' || user.status === 'suspended'
          if (isInactive) inactiveCount++
          else activeCount++

          await admin.from('user_activity').upsert({
            org_id: connection.org_id,
            integration_connection_id: connection.id,
            email: user.email,
            display_name: user.displayName,
            provider: connection.provider,
            last_login: user.lastLogin,
            status: user.status,
            department: user.department,
            title: user.title,
            is_admin: user.isAdmin,
          }, {
            onConflict: 'org_id,email,provider',
          })
        }

        // ─── 5. Update connection stats ──────────────────────────────
        await admin
          .from('integration_connections')
          .update({
            last_synced_at: new Date().toISOString(),
            total_users: users.length,
            active_users: activeCount,
            inactive_users: inactiveCount,
            error_message: null,
          })
          .eq('id', connection.id)

        result.usersProcessed = users.length
        result.activeUsers = activeCount
        result.inactiveUsers = inactiveCount

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        result.error = message
        await admin
          .from('integration_connections')
          .update({ error_message: message })
          .eq('id', connection.id)
      }

      results.push(result)
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Usage sync cron failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
