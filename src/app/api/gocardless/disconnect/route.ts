import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

const GC_BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2'

async function getGCToken(): Promise<string | null> {
  try {
    const res = await fetch(`${GC_BASE_URL}/token/new/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret_id: process.env.GOCARDLESS_SECRET_ID!,
        secret_key: process.env.GOCARDLESS_SECRET_KEY!,
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { access: string }
    return data.access
  } catch {
    return null
  }
}

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
    .from('gocardless_connections')
    .select('id, requisition_id, org_id')
    .eq('id', connectionId)
    .eq('org_id', membership.orgId)
    .maybeSingle()

  if (fetchError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // Call GoCardless DELETE /requisitions/{id} (best-effort; skip in mock mode)
  if (process.env.MOCK_SERVICES !== 'true' && connection.requisition_id) {
    try {
      const token = await getGCToken()
      if (token) {
        await fetch(`${GC_BASE_URL}/requisitions/${encodeURIComponent(connection.requisition_id)}/`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch (err) {
      console.error('[gocardless disconnect] DELETE requisition failed:', err)
    }
  }

  // Delete the connection row (cascades to transactions via ON DELETE CASCADE)
  const { error: deleteError } = await admin
    .from('gocardless_connections')
    .delete()
    .eq('id', connectionId)
    .eq('org_id', membership.orgId)

  if (deleteError) {
    console.error('[gocardless disconnect] delete failed:', deleteError)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  // Clean up derived data that was built from this connection's transactions
  const [{ error: vendorsError }, { error: reportsError }] = await Promise.all([
    admin.from('saas_vendors').delete().eq('org_id', membership.orgId),
    admin.from('waste_reports').delete().eq('org_id', membership.orgId),
  ])
  if (vendorsError) console.error('[gocardless disconnect] saas_vendors cleanup failed:', vendorsError)
  if (reportsError) console.error('[gocardless disconnect] waste_reports cleanup failed:', reportsError)

  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}
