import { createClient } from '@/lib/supabase/server'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import crypto from 'crypto'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Ensure org exists & verify user is an admin
  const membership = await ensureOrganization(user.id, user.email ?? undefined)

  if (!['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Only admins can connect integrations' },
      { status: 403 }
    )
  }

  if (process.env.MOCK_SERVICES === 'true') {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()

    // Seed a real integration_connections row so the UI shows the connection
    const { error: icError } = await admin.from('integration_connections').upsert({
      org_id: membership.orgId,
      provider: 'google_workspace',
      is_active: true,
      total_users: 25,
      active_users: 18,
      inactive_users: 7,
      last_synced_at: new Date().toISOString(),
      metadata: { domain: 'demo.co', adminEmail: 'admin@demo.co' },
      error_message: null,
    }, { onConflict: 'org_id,provider' })
    if (icError) console.error('[mock] integration_connections upsert failed:', icError.message)

    // Seed user activity so reports/ghost-seat detection works
    const { seedMockUserActivity } = await import('@/lib/utils/mock-seed')
    console.log('[mock] Seeding Google Workspace user activity for org:', membership.orgId)
    await seedMockUserActivity(admin, membership.orgId, 'google_workspace')
    console.log('[mock] Google seeding complete')

    revalidatePath('/', 'layout')
    return NextResponse.json({ authorizationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/connections?success=google_connected` })
  }

  // Generate OAuth state parameter (CSRF protection)
  const state = crypto.randomBytes(32).toString('hex')

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
  )

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: `${state}:${membership.orgId}`,
  })

  // Set state cookie for CSRF validation
  const response = NextResponse.json({ authorizationUrl })
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
