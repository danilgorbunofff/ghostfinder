import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Check if user is sole owner of any organizations — cascade delete those orgs
  const { data: ownedMemberships } = await admin
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('role', 'owner')

  if (ownedMemberships) {
    for (const membership of ownedMemberships) {
      // Check if there are other members in this org
      const { count } = await admin
        .from('org_members')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', membership.org_id)
        .neq('user_id', user.id)

      if (count === 0) {
        // Sole owner — delete the entire organization and cascading data
        await admin.from('notification_settings').delete().eq('org_id', membership.org_id)
        await admin.from('notification_log').delete().eq('org_id', membership.org_id)
        await admin.from('subscriptions').delete().eq('org_id', membership.org_id)
        await admin.from('user_activity').delete().eq('org_id', membership.org_id)
        await admin.from('integration_connections').delete().eq('org_id', membership.org_id)
        await admin.from('waste_reports').delete().eq('org_id', membership.org_id)
        await admin.from('saas_vendors').delete().eq('org_id', membership.org_id)
        await admin.from('transactions').delete().eq('org_id', membership.org_id)
        await admin.from('gocardless_connections').delete().eq('org_id', membership.org_id)
        await admin.from('plaid_connections').delete().eq('org_id', membership.org_id)
        await admin.from('organizations').delete().eq('id', membership.org_id)
      }
    }
  }

  // Remove from all organizations
  const { error: memberError } = await admin
    .from('org_members')
    .delete()
    .eq('user_id', user.id)

  if (memberError) {
    console.error('Failed to remove org memberships:', memberError)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }

  // Delete the auth user
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)

  if (deleteError) {
    console.error('Failed to delete auth user:', deleteError)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
