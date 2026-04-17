import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { PlaidApi, PlaidEnvironments, Configuration } from 'plaid'

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

  // Verify the connection belongs to the user's org
  let membership: { orgId: string; role: string }
  try {
    membership = await ensureOrganization(user.id, user.email ?? undefined)
  } catch {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  const { data: connection, error: fetchError } = await admin
    .from('plaid_connections')
    .select('id, item_id, access_token_secret_id, org_id')
    .eq('id', connectionId)
    .eq('org_id', membership.orgId)
    .maybeSingle()

  if (fetchError || !connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // Call Plaid item/remove to revoke access (best-effort; skip in mock mode)
  if (process.env.MOCK_SERVICES !== 'true' && connection.item_id) {
    try {
      const configuration = new Configuration({
        basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments ?? 'sandbox'],
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
            'PLAID-SECRET': process.env.PLAID_SECRET!,
          },
        },
      })
      const plaidClient = new PlaidApi(configuration)

      // Retrieve the access token from vault
      const { data: tokenData } = await admin.rpc('get_plaid_token' as never, {
        p_connection_id: connectionId,
      })

      if (tokenData) {
        await plaidClient.itemRemove({ access_token: tokenData as string })
      }
    } catch (err) {
      // Log but don't block — proceed with DB delete
      console.error('[plaid disconnect] item/remove failed:', err)
    }
  }

  // Delete the connection row (cascades to transactions via ON DELETE CASCADE)
  const { error: deleteError } = await admin
    .from('plaid_connections')
    .delete()
    .eq('id', connectionId)
    .eq('org_id', membership.orgId)

  if (deleteError) {
    console.error('[plaid disconnect] delete failed:', deleteError)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  // Clean up derived data that was built from this connection's transactions.
  // saas_vendors has no FK to plaid_connections (only org_id), so we delete manually.
  // waste_reports generated from wrong-bank data are worthless; delete them too.
  const [{ error: vendorsError }, { error: reportsError }] = await Promise.all([
    admin.from('saas_vendors').delete().eq('org_id', membership.orgId),
    admin.from('waste_reports').delete().eq('org_id', membership.orgId),
  ])
  if (vendorsError) console.error('[plaid disconnect] saas_vendors cleanup failed:', vendorsError)
  if (reportsError) console.error('[plaid disconnect] waste_reports cleanup failed:', reportsError)

  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}
