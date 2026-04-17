import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangePublicToken } from '@/lib/services/plaid.service'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { triggerScanIfReady } from '@/lib/reconciliation/trigger-if-ready'
import { revalidatePath } from 'next/cache'
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
    let membership: { orgId: string }
    try {
      membership = await ensureOrganization(user.id, user.email ?? undefined)
    } catch {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const admin = createAdminClient()
    const itemId = `mock_item_${Date.now()}`

    const { error: insertError } = await admin
      .from('plaid_connections')
      .insert({
        org_id: membership.orgId,
        item_id: itemId,
        institution_name: institutionName,
        institution_id: institutionId || `ins_mock_${Date.now()}`,
        status: 'active',
        last_synced_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Failed to insert mock plaid connection:', insertError)
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 })
    }

    // Seed vendor + transaction + report data so all pages are populated
    const { seedMockVendors, seedMockTransactions, seedMockWasteReport } = await import('@/lib/utils/mock-seed')
    console.log('[mock] Seeding data for org:', membership.orgId)
    await seedMockVendors(admin, membership.orgId)
    await seedMockTransactions(admin, membership.orgId)
    await seedMockWasteReport(admin, membership.orgId)
    console.log('[mock] Seeding complete')

    revalidatePath('/', 'layout')
    return NextResponse.json({ success: true, connectionId: itemId, institutionName })
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

    await triggerScanIfReady(admin, membership.orgId)

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
