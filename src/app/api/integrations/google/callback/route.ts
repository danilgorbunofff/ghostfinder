import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      `${appUrl}/connections?error=google_oauth_denied`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/connections?error=missing_params`
    )
  }

  // Validate CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('google_oauth_state')?.value
  const [receivedState, orgId] = state.split(':')

  if (!storedState || storedState !== receivedState) {
    return NextResponse.redirect(
      `${appUrl}/connections?error=invalid_state`
    )
  }

  try {
    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${appUrl}/api/integrations/google/callback`
    )

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token) {
      throw new Error('No access token received')
    }

    const admin = createAdminClient()

    // Store access token in Vault
    const { data: accessSecretId } = await admin.rpc('store_secret', {
      p_secret: tokens.access_token,
      p_name: `google_access_${orgId}`,
      p_description: `Google Workspace access token for org ${orgId}`,
    })

    // Store refresh token in Vault (if provided)
    let refreshSecretId = null
    if (tokens.refresh_token) {
      const { data } = await admin.rpc('store_secret', {
        p_secret: tokens.refresh_token,
        p_name: `google_refresh_${orgId}`,
        p_description: `Google Workspace refresh token for org ${orgId}`,
      })
      refreshSecretId = data
    }

    // Detect domain from the authorized admin's profile
    oauth2Client.setCredentials(tokens)
    const people = google.people({ version: 'v1', auth: oauth2Client })
    const me = await people.people.get({
      resourceName: 'people/me',
      personFields: 'emailAddresses',
    })
    const adminEmail = me.data.emailAddresses?.[0]?.value ?? ''
    const domain = adminEmail.split('@')[1] ?? ''

    // Create or update integration connection
    const { error: upsertError } = await admin
      .from('integration_connections')
      .upsert({
        org_id: orgId,
        provider: 'google_workspace',
        access_token_secret_id: accessSecretId,
        refresh_token_secret_id: refreshSecretId,
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        metadata: { domain, adminEmail },
        is_active: true,
        error_message: null,
      }, {
        onConflict: 'org_id,provider',
      })

    if (upsertError) {
      throw new Error(`Failed to save connection: ${upsertError.message}`)
    }

    // Clear state cookie
    const response = NextResponse.redirect(
      `${appUrl}/connections?success=google_connected`
    )
    response.cookies.delete('google_oauth_state')
    return response

  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(
      `${appUrl}/connections?error=google_callback_failed`
    )
  }
}
