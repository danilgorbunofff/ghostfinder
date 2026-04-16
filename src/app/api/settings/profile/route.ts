import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { displayName } = await request.json()

  if (typeof displayName !== 'string' || displayName.length > 100) {
    return NextResponse.json({ error: 'Invalid display name' }, { status: 400 })
  }

  const { error } = await supabase.auth.updateUser({
    data: { display_name: displayName.trim() },
  })

  if (error) {
    console.error('Failed to update profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
