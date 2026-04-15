import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOktaConnection } from '@/lib/services/okta.service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orgUrl, apiToken } = await request.json()

  if (!orgUrl || !apiToken) {
    return NextResponse.json(
      { error: 'Okta org URL and API token are required' },
      { status: 400 }
    )
  }

  // Validate URL format
  try {
    const url = new URL(orgUrl)
    if (!url.hostname.endsWith('.okta.com') && !url.hostname.endsWith('.oktapreview.com')) {
      return NextResponse.json(
        { error: 'Invalid Okta org URL. Must end with .okta.com' },
        { status: 400 }
      )
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  try {
    // Verify the token works
    const isValid = await verifyOktaConnection(orgUrl, apiToken)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid Okta credentials. Check your org URL and API token.' },
        { status: 400 }
      )
    }

    // Get user's org
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only admins can connect integrations' },
        { status: 403 }
      )
    }

    // Store API token in Vault
    const admin = createAdminClient()

    const { data: secretId } = await admin.rpc('store_secret', {
      p_secret: apiToken,
      p_name: `okta_${membership.org_id}`,
      p_description: `Okta API token for org ${membership.org_id}`,
    })

    // Create or update integration connection
    const { error: upsertError } = await admin
      .from('integration_connections')
      .upsert({
        org_id: membership.org_id,
        provider: 'okta',
        access_token_secret_id: secretId,
        metadata: { orgUrl, domain: new URL(orgUrl).hostname },
        is_active: true,
        error_message: null,
      }, {
        onConflict: 'org_id,provider',
      })

    if (upsertError) {
      return NextResponse.json(
        { error: 'Failed to save connection' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Okta connection failed:', error)
    return NextResponse.json(
      { error: 'Failed to connect to Okta' },
      { status: 500 }
    )
  }
}
