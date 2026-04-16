import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  if (membership.role === 'owner') {
    return NextResponse.json(
      { error: 'Owners cannot leave their organization. Transfer ownership first.' },
      { status: 403 }
    )
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('org_members')
    .delete()
    .eq('user_id', user.id)
    .eq('org_id', membership.org_id)

  if (error) {
    console.error('Failed to leave organization:', error)
    return NextResponse.json({ error: 'Failed to leave organization' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
