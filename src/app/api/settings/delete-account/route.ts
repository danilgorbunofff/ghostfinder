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
