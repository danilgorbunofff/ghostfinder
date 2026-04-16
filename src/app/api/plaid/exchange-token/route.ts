import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangePublicToken } from '@/lib/services/plaid.service'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { publicToken, institutionName, institutionId } = await request.json()

  if (!publicToken || !institutionName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (process.env.MOCK_SERVICES === 'true') {
    return NextResponse.json({ success: true, itemId: 'mock_item_id', institutionName })
  }

  try {
    const { accessToken, itemId } = await exchangePublicToken(publicToken)

    let membership: { orgId: string }
    try {
      membership = await ensureOrganization(user.id, user.email ?? undefined)
    } catch {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const admin = createAdminClient()
    const { data: secretResult } = await admin.rpc('store_secret', {
      p_secret: accessToken,
      p_name: `plaid_${itemId}`,
      p_description: `Plaid access token for ${institutionName}`,
    })

    const { error: insertError } = await admin
      .from('plaid_connections')
      .insert({
        org_id: membership.orgId,
        access_token_secret_id: secretResult,
        item_id: itemId,
        institution_name: institutionName,
        institution_id: institutionId,
        status: 'active',
      })

    if (insertError) {
      console.error('Failed to insert plaid connection:', insertError)
      return NextResponse.json(
        { error: 'Failed to save connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      connectionId: itemId,
      institutionName,
    })
  } catch (error) {
    console.error('Plaid token exchange failed:', error)
    return NextResponse.json(
      { error: 'Failed to connect bank account' },
      { status: 500 }
    )
  }
}
