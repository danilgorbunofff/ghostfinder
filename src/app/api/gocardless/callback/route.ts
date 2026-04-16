import { createAdminClient } from '@/lib/supabase/admin'
import { getRequisition, getAccountMetadata } from '@/lib/services/gocardless.service'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get('ref')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!ref) {
    return NextResponse.redirect(`${appUrl}/connections?gc_error=missing_ref`)
  }

  if (process.env.MOCK_SERVICES === 'true') {
    return NextResponse.redirect(`${appUrl}/connections?gc_success=true`)
  }

  const admin = createAdminClient()

  try {
    // Find the pending connection by requisition_id
    const { data: connection, error: findError } = await admin
      .from('gocardless_connections')
      .select('id, org_id, institution_name, country')
      .eq('requisition_id', ref)
      .eq('status', 'pending')
      .single()

    if (findError || !connection) {
      console.error('GoCardless callback: connection not found for ref', ref)
      return NextResponse.redirect(`${appUrl}/connections?gc_error=not_found`)
    }

    // Fetch requisition status from GoCardless
    const requisition = await getRequisition(ref)

    if (!requisition.accounts || requisition.accounts.length === 0) {
      await admin
        .from('gocardless_connections')
        .update({
          status: 'error',
          error_code: 'NO_ACCOUNTS',
          error_message: 'No bank accounts were authorized',
        })
        .eq('id', connection.id)

      return NextResponse.redirect(`${appUrl}/connections?gc_error=no_accounts`)
    }

    // Activate the first account on the existing row
    const firstAccountId = requisition.accounts[0]
    let metadata: { institution_id: string } | null = null
    try {
      metadata = await getAccountMetadata(firstAccountId)
    } catch {
      // Non-fatal — we already have institution info from the creation step
    }

    // PSD2 access expires after 90 days
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

    await admin
      .from('gocardless_connections')
      .update({
        account_id: firstAccountId,
        institution_id: metadata?.institution_id || null,
        status: 'active',
        expires_at: expiresAt,
        error_code: null,
        error_message: null,
      })
      .eq('id', connection.id)

    // If the requisition returned multiple accounts, create additional rows
    for (let i = 1; i < requisition.accounts.length; i++) {
      const accountId = requisition.accounts[i]
      let acctMeta: { institution_id: string } | null = null
      try {
        acctMeta = await getAccountMetadata(accountId)
      } catch {
        // Non-fatal
      }

      await admin
        .from('gocardless_connections')
        .upsert({
          org_id: connection.org_id,
          requisition_id: ref,
          account_id: accountId,
          institution_id: acctMeta?.institution_id || null,
          institution_name: connection.institution_name,
          country: connection.country,
          status: 'active',
          expires_at: expiresAt,
        }, {
          onConflict: 'org_id,account_id',
        })
    }

    return NextResponse.redirect(`${appUrl}/connections?gc_success=true`)
  } catch (error) {
    console.error('GoCardless callback failed:', error)
    return NextResponse.redirect(`${appUrl}/connections?gc_error=callback_failed`)
  }
}
