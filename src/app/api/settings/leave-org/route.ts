import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await ensureOrganization(
    user.id,
    user.email ?? undefined,
    user.user_metadata?.full_name ?? undefined
  )

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
    .eq('org_id', membership.orgId)

  if (error) {
    console.error('Failed to leave organization:', error)
    return NextResponse.json({ error: 'Failed to leave organization' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
