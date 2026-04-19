import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRequisition, EU_EEA_COUNTRIES } from '@/lib/services/gocardless.service'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

const VALID_COUNTRY_CODES = new Set(EU_EEA_COUNTRIES.map((c) => c.code))

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { institutionId, institutionName, country } = body as {
    institutionId?: string
    institutionName?: string
    country?: string
  }

  if (!institutionId || !country) {
    return NextResponse.json({ error: 'Missing required fields: institutionId, country' }, { status: 400 })
  }

  const countryUpper = country.toUpperCase()
  if (!VALID_COUNTRY_CODES.has(countryUpper)) {
    return NextResponse.json({ error: 'Invalid country code' }, { status: 400 })
  }

  let membership: { orgId: string; role: 'owner' | 'admin' | 'member' | 'viewer' }
  try {
    membership = await ensureOrganization(user.id, user.email ?? undefined)
  } catch {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  // Check admin/owner role
  const admin = createAdminClient()
  if (!['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Admin or owner role required' }, { status: 403 })
  }

  if (process.env.MOCK_SERVICES === 'true') {
    // Insert a mock connection row
    const { data: row } = await admin
      .from('gocardless_connections')
      .insert({
        org_id: membership.orgId,
        requisition_id: `mock_req_${Date.now()}`,
        institution_id: institutionId,
        institution_name: institutionName || institutionId,
        country: countryUpper,
        status: 'active',
        account_id: `mock_acct_${Date.now()}`,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        last_synced_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    // Seed vendor + transaction data so inventory page is populated
    const { seedMockVendors, seedMockTransactions } = await import('@/lib/utils/mock-seed')
    await seedMockVendors(admin, membership.orgId)
    await seedMockTransactions(admin, membership.orgId)

    revalidatePath('/', 'layout')
    return NextResponse.json({
      link: `${process.env.NEXT_PUBLIC_APP_URL}/connections?mock_gocardless=true`,
      requisitionId: 'mock_req_id',
      connectionId: row?.id,
    })
  }

  try {
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/gocardless/callback`
    const referenceId = `${membership.orgId}_${Date.now()}`

    const requisition = await createRequisition(institutionId, callbackUrl, referenceId)

    // Insert pending connection
    const { data: row, error: insertError } = await admin
      .from('gocardless_connections')
      .insert({
        org_id: membership.orgId,
        requisition_id: requisition.id,
        institution_id: institutionId,
        institution_name: institutionName || institutionId,
        country: countryUpper,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert GoCardless connection:', insertError)
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 })
    }

    return NextResponse.json({
      link: requisition.link,
      requisitionId: requisition.id,
      connectionId: row?.id,
    })
  } catch (error) {
    console.error('GoCardless requisition creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to initiate bank connection' },
      { status: 500 }
    )
  }
}
