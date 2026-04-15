import { createClient } from '@/lib/supabase/server'
import { createLinkToken } from '@/lib/services/plaid.service'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const linkToken = await createLinkToken(user.id)
    return NextResponse.json({ linkToken })
  } catch (error) {
    console.error('Failed to create Plaid link token:', error)
    return NextResponse.json(
      { error: 'Failed to create link token' },
      { status: 500 }
    )
  }
}
