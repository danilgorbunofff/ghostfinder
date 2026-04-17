import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { connectionId } = await request.json()
  if (!connectionId) {
    return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })
  }

  const admin = createAdminClient()

  let membership: { orgId: string; role: string }
  try {
    membership = await ensureOrganization(user.id, user.email ?? undefined)
  } catch {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  const { data: connection, error: fetchError } = await admin
    .from('integration_connections')
    .select('id, org_id, metadata')
    .eq('id', connectionId)
    .eq('org_id', membership.orgId)
    .eq('provider', 'google_workspace')
    .maybeSingle()

  if (fetchError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // Revoke Google OAuth token (best-effort; skip in mock mode)
  if (process.env.MOCK_SERVICES !== 'true') {
    const meta = connection.metadata as Record<string, string> | null
    const accessToken = meta?.access_token
    if (accessToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
          method: 'POST',
        })
      } catch (err) {
        console.error('[google disconnect] token revocation failed:', err)
      }
    }
  }

  // Delete the connection row (cascades to user_activity via ON DELETE CASCADE)
  const { error: deleteError } = await admin
    .from('integration_connections')
    .delete()
    .eq('id', connectionId)
    .eq('org_id', membership.orgId)

  if (deleteError) {
    console.error('[google disconnect] delete failed:', deleteError)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}
