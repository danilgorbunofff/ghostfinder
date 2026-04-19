import { createAdminClient } from '@/lib/supabase/admin'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { seedMockWasteReport } from '@/lib/utils/mock-seed'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const DEV_ACTION_HEADER = 'x-ghostfinder-dev-action'

// Block unless mock mode is enabled — returns 404 as if route doesn't exist
function guardDev() {
  if (process.env.MOCK_SERVICES !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return null
}

async function getAuthContext(request: Request) {
  const cookieUser = await getCookieUser(request)
  const bearerUser = cookieUser ? null : await getBearerUser(request)
  const user = cookieUser ?? bearerUser

  if (!user) return null

  const { orgId, role } = await ensureOrganization(
    user.id,
    user.email ?? undefined,
    user.user_metadata?.full_name ?? undefined
  )
  return { userId: user.id, orgId, role }
}

async function getCookieUser(request: Request) {
  if (request.headers.get(DEV_ACTION_HEADER) !== '1') {
    return null
  }

  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return null
  }

  return user
}

async function getBearerUser(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  // Verify the token server-side using admin client — no cookie parsing needed
  const admin = createAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null

  return user
}

export async function POST(request: Request) {
  const blocked = guardDev()
  if (blocked) return blocked

  try {
    return await handlePost(request)
  } catch (error) {
    console.error('[DEV API ERROR]', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

async function handlePost(request: Request) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action, ...params } = body as { action: string; [key: string]: unknown }
  const admin = createAdminClient()

  // Read-only action — return early without cache invalidation
  if (action === 'get-state') {
    return await getOrgState(admin, ctx)
  }

  let response: NextResponse

  switch (action) {
    // ─── Data Actions ──────────────────────────────────────────────────
    case 'seed-data': {
      response = await seedDemoData(admin, ctx.orgId)
      break
    }

    case 'reset-data': {
      response = await resetOrgData(admin, ctx.orgId)
      break
    }

    case 'reset-table': {
      const table = params.table as string
      const allowed = [
        'transactions', 'saas_vendors', 'plaid_connections',
        'gocardless_connections',
        'integration_connections', 'user_activity', 'waste_reports',
        'notification_log',
      ]
      if (!allowed.includes(table)) {
        return NextResponse.json({ error: `Table "${table}" not allowed` }, { status: 400 })
      }
      const result = await admin.from(table).delete().eq('org_id', ctx.orgId)
      if (table === 'gocardless_connections' && isMissingTableError(result.error, table)) {
        response = NextResponse.json({ success: true, message: `Skipped ${table} — table not present in this database` })
        break
      }
      check(result, `clear ${table}`)
      response = NextResponse.json({ success: true, message: `Cleared ${table}` })
      break
    }

    case 'generate-transactions': {
      const count = Math.min(Math.max(Number(params.count) || 20, 1), 500)
      response = await generateRandomTransactions(admin, ctx.orgId, count)
      break
    }

    // ─── Connection Simulation ─────────────────────────────────────────
    case 'simulate-plaid': {
      const status = (params.status as string) || 'active'
      const name = (params.institutionName as string) || 'Demo Bank'
      response = await simulatePlaidConnection(admin, ctx.orgId, name, status)
      break
    }

    case 'simulate-google': {
      const total = Number(params.totalUsers) || 40
      const inactiveRatio = Number(params.inactiveRatio) || 0.25
      response = await simulateIdentityProvider(admin, ctx.orgId, 'google_workspace', total, inactiveRatio)
      break
    }

    case 'simulate-okta': {
      const total = Number(params.totalUsers) || 45
      const inactiveRatio = Number(params.inactiveRatio) || 0.2
      response = await simulateIdentityProvider(admin, ctx.orgId, 'okta', total, inactiveRatio)
      break
    }

    case 'simulate-gocardless': {
      const gcName = (params.institutionName as string) || 'Revolut'
      const gcCountry = (params.country as string) || 'GB'
      const gcStatus = (params.status as string) || 'active'
      response = await simulateGoCardlessConnection(admin, ctx.orgId, gcName, gcCountry, gcStatus)
      break
    }

    case 'toggle-connection-status': {
      const { connectionId, connectionType, newStatus } = params as {
        connectionId: string; connectionType: string; newStatus: string
      }
      const tableMap: Record<string, string> = {
        plaid: 'plaid_connections',
        gocardless: 'gocardless_connections',
      }
      const table = tableMap[connectionType] || 'integration_connections'
      const isStatusField = connectionType === 'plaid' || connectionType === 'gocardless'
      const field = isStatusField ? 'status' : 'is_active'
      const value = isStatusField ? newStatus : newStatus === 'active'
      const result = await admin.from(table)
        .update({ [field]: value })
        .eq('id', connectionId)
        .eq('org_id', ctx.orgId)
        .select('id')
        .maybeSingle()
      check(result, `${table} status update`)
      if (!result.data) {
        return NextResponse.json({ error: `${connectionType} connection not found` }, { status: 404 })
      }
      response = NextResponse.json({ success: true })
      break
    }

    // ─── Cron Triggers ─────────────────────────────────────────────────
    case 'sync-transactions':
    case 'sync-usage':
    case 'generate-reports':
    case 'run-cron': {
      const job = action === 'run-cron' ? (params.job as string) : action
      const jobMap: Record<string, string> = {
        'sync-transactions': '/api/cron/sync-transactions',
        'sync-usage': '/api/cron/sync-usage',
        'generate-reports': '/api/cron/generate-reports',
      }
      const path = jobMap[job]
      if (!path) {
        return NextResponse.json({ error: `Unknown cron job: ${job}` }, { status: 400 })
      }
      if (!process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
      }
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const res = await fetch(`${baseUrl}${path}`, {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        })
        const data = await res.json()
        response = NextResponse.json({ success: res.ok, status: res.status, data })
      } catch (e) {
        response = NextResponse.json({ success: false, error: String(e) })
      }
      break
    }

    // ─── Auth & Roles ──────────────────────────────────────────────────
    case 'switch-role': {
      const newRole = params.role as string
      const validRoles = ['owner', 'admin', 'member', 'viewer']
      if (!validRoles.includes(newRole)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      const result = await admin.from('org_members')
        .update({ role: newRole })
        .eq('user_id', ctx.userId)
        .eq('org_id', ctx.orgId)
        .select('user_id')
        .maybeSingle()
      check(result, 'org_members update')
      if (!result.data) {
        return NextResponse.json({ error: 'Organization membership not found' }, { status: 404 })
      }
      response = NextResponse.json({ success: true, role: newRole })
      break
    }

    case 'switch-tier': {
      const newTier = params.tier as string
      const validTiers = ['free', 'monitor', 'recovery']
      if (!validTiers.includes(newTier)) {
        return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
      }
      check(await admin.from('subscriptions').upsert({
        org_id: ctx.orgId,
        stripe_customer_id: 'cus_dev_tools',
        tier: newTier,
        status: 'active',
      }, { onConflict: 'org_id' }), 'subscriptions tier upsert')
      response = NextResponse.json({ success: true, tier: newTier })
      break
    }

    case 'set-subscription-status': {
      const newStatus = params.status as string
      const validStatuses = ['active', 'past_due', 'canceled']
      if (!validStatuses.includes(newStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      const currentSubscription = await admin
        .from('subscriptions')
        .select('tier')
        .eq('org_id', ctx.orgId)
        .maybeSingle()
      check(currentSubscription, 'subscriptions lookup')

      check(await admin.from('subscriptions').upsert({
        org_id: ctx.orgId,
        stripe_customer_id: 'cus_dev_tools',
        tier: currentSubscription.data?.tier ?? 'free',
        status: newStatus,
      }, { onConflict: 'org_id' }), 'subscriptions status upsert')
      response = NextResponse.json({ success: true, status: newStatus })
      break
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }

  // Invalidate server-side cache so pages re-fetch fresh data on next render
  revalidatePath('/', 'layout')

  return response
}

// ─── Implementation Helpers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function check(result: { error: any }, label: string) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message ?? JSON.stringify(result.error)}`)
  }
}

function getErrorMessage(error: unknown) {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return JSON.stringify(error)
}

function isMissingTableError(error: unknown, table: string) {
  const message = getErrorMessage(error).toLowerCase()
  const normalizedTable = table.toLowerCase()

  return (
    message.includes(`could not find the table 'public.${normalizedTable}'`) ||
    message.includes(`relation "${normalizedTable}" does not exist`) ||
    (message.includes(normalizedTable) && message.includes('does not exist'))
  )
}

const SAMPLE_VENDORS = [
  { name: 'Slack', normalized: 'slack', cost: 875, seats: 35, category: 'Communication' },
  { name: 'Notion', normalized: 'notion', cost: 320, seats: 40, category: 'Productivity' },
  { name: 'Figma', normalized: 'figma', cost: 540, seats: 18, category: 'Design' },
  { name: 'GitHub', normalized: 'github', cost: 210, seats: 30, category: 'Engineering' },
  { name: 'Zoom', normalized: 'zoom', cost: 450, seats: 45, category: 'Communication' },
  { name: 'Jira', normalized: 'jira', cost: 380, seats: 38, category: 'Project Management' },
  { name: 'Salesforce', normalized: 'salesforce', cost: 2400, seats: 20, category: 'CRM' },
  { name: 'HubSpot', normalized: 'hubspot', cost: 890, seats: 15, category: 'CRM' },
  { name: 'Asana', normalized: 'asana', cost: 290, seats: 29, category: 'Project Management' },
  { name: 'Dropbox', normalized: 'dropbox', cost: 180, seats: 12, category: 'Storage' },
]

const SAMPLE_USERS = [
  { email: 'alice@demo.co', name: 'Alice Johnson', daysAgo: 1, status: 'active', isAdmin: true },
  { email: 'bob@demo.co', name: 'Bob Smith', daysAgo: 3, status: 'active', isAdmin: false },
  { email: 'carol@demo.co', name: 'Carol White', daysAgo: 45, status: 'inactive', isAdmin: false },
  { email: 'dave@demo.co', name: 'Dave Brown', daysAgo: 60, status: 'inactive', isAdmin: false },
  { email: 'eve@demo.co', name: 'Eve Davis', daysAgo: 5, status: 'active', isAdmin: false },
  { email: 'frank@demo.co', name: 'Frank Wilson', daysAgo: 90, status: 'inactive', isAdmin: false },
  { email: 'grace@demo.co', name: 'Grace Lee', daysAgo: 2, status: 'active', isAdmin: false },
  { email: 'henry@demo.co', name: 'Henry Martinez', daysAgo: 55, status: 'inactive', isAdmin: false },
  { email: 'iris@demo.co', name: 'Iris Taylor', daysAgo: 6, status: 'active', isAdmin: false },
  { email: 'jake@demo.co', name: 'Jake Anderson', daysAgo: 75, status: 'inactive', isAdmin: false },
  { email: 'kate@demo.co', name: 'Kate Thomas', daysAgo: 4, status: 'active', isAdmin: true },
  { email: 'liam@demo.co', name: 'Liam Jackson', daysAgo: 40, status: 'inactive', isAdmin: false },
  { email: 'maya@demo.co', name: 'Maya Harris', daysAgo: 7, status: 'active', isAdmin: false },
  { email: 'noah@demo.co', name: 'Noah Clark', daysAgo: 85, status: 'inactive', isAdmin: false },
  { email: 'olivia@demo.co', name: 'Olivia Lewis', daysAgo: 1, status: 'active', isAdmin: false },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedDemoData(admin: any, orgId: string) {
  try {
    // 1. Subscription
    check(await admin.from('subscriptions').upsert({
      org_id: orgId, stripe_customer_id: 'cus_dev_tools',
      tier: 'recovery', status: 'active', verified_annual_savings: 46140,
    }, { onConflict: 'org_id' }), 'subscriptions upsert')

    // 2. Plaid connection
    check(await admin.from('plaid_connections').upsert({
      org_id: orgId, item_id: 'dev_item_chase',
      institution_name: 'Chase Bank', institution_id: 'ins_3',
      status: 'active', last_synced_at: new Date().toISOString(),
    }, { onConflict: 'org_id,item_id' }), 'plaid_connections upsert')

    // 3. Vendors
    for (const v of SAMPLE_VENDORS) {
      check(await admin.from('saas_vendors').upsert({
        org_id: orgId, name: v.name, normalized_name: v.normalized,
        monthly_cost: v.cost, annual_cost: v.cost * 12,
        seats_paid: v.seats, category: v.category,
        is_active: true, first_seen: daysAgo(90), last_seen: daysAgo(2),
        transaction_count: 12,
      }, { onConflict: 'org_id,normalized_name' }), `saas_vendors upsert (${v.name})`)
    }

    // 4. Transactions
    const txns = SAMPLE_VENDORS.map((v, i) => ({
      org_id: orgId,
      plaid_transaction_id: `dev_txn_${v.normalized}_${Date.now()}_${i}`,
      vendor: v.name.toUpperCase() + ' INC',
      vendor_normalized: v.normalized,
      amount: v.cost,
      date: daysAgo(i * 2 + 1),
      is_software: true,
    }))
    check(await admin.from('transactions').upsert(txns, { onConflict: 'org_id,plaid_transaction_id' }), 'transactions upsert')

    // 5. Identity providers
    check(await admin.from('integration_connections').upsert({
      org_id: orgId, provider: 'okta',
      is_active: true, total_users: 47, active_users: 36, inactive_users: 11,
      last_synced_at: new Date().toISOString(),
      metadata: { orgUrl: 'https://demo.okta.com', domain: 'demo.co' },
    }, { onConflict: 'org_id,provider' }), 'integration_connections upsert (okta)')

    check(await admin.from('integration_connections').upsert({
      org_id: orgId, provider: 'google_workspace',
      is_active: true, total_users: 38, active_users: 29, inactive_users: 9,
      last_synced_at: new Date().toISOString(),
      metadata: { domain: 'demo.co', customerId: 'C0dev123' },
    }, { onConflict: 'org_id,provider' }), 'integration_connections upsert (google)')

    // 6. User activity
    for (const u of SAMPLE_USERS) {
      const provider = u.isAdmin || u.email.startsWith('h') || u.email.startsWith('i') || u.email.startsWith('j') || u.email.startsWith('k') || u.email.startsWith('l') || u.email.startsWith('o')
        ? 'google_workspace' : 'okta'
      check(await admin.from('user_activity').upsert({
        org_id: orgId, email: u.email, display_name: u.name,
        provider, last_login: daysAgo(u.daysAgo),
        status: u.status, is_admin: u.isAdmin,
      }, { onConflict: 'org_id,email,provider' }), `user_activity upsert (${u.email})`)
    }

    // 7. Waste report
    await seedMockWasteReport(admin, orgId)

    // 8. Notification settings
    check(await admin.from('notification_settings').upsert({
      org_id: orgId, slack_webhook_url: '', slack_enabled: false,
      email_enabled: false, email_recipients: [],
      notify_on_ghost_seats: true, notify_on_duplicates: true,
      notify_threshold_amount: 500,
    }, { onConflict: 'org_id' }), 'notification_settings upsert')

    return NextResponse.json({ success: true, message: 'Demo data seeded' })
  } catch (e) {
    return NextResponse.json({ success: false, error: `Seed failed — ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resetOrgData(admin: any, orgId: string) {
  try {
    // All org-scoped tables — order respects FK constraints (children before parents)
    const tables = [
      'notification_log',
      'waste_reports',
      'user_activity',
      'integration_connections',
      'transactions',
      'saas_vendors',
      'gocardless_connections',
      'plaid_connections',
      'notification_settings',
    ]
    for (const t of tables) {
      const result = await admin.from(t).delete().eq('org_id', orgId)
      if (t === 'gocardless_connections' && isMissingTableError(result.error, t)) {
        continue
      }
      check(result, `delete ${t}`)
    }
    // Reset subscription to free tier
    check(await admin.from('subscriptions').upsert({
      org_id: orgId, stripe_customer_id: 'cus_dev_tools',
      tier: 'free', status: 'active', verified_annual_savings: 0,
    }, { onConflict: 'org_id' }), 'subscriptions reset')

    return NextResponse.json({ success: true, message: 'Project reset — all data cleared, back to free tier' })
  } catch (e) {
    return NextResponse.json({ success: false, error: `Reset failed — ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}

const TX_VENDORS = ['SLACK TECH', 'NOTION LABS', 'FIGMA INC', 'GITHUB INC', 'ZOOM VIDEO', 'ATLASSIAN', 'SALESFORCE', 'HUBSPOT', 'ASANA INC', 'DROPBOX INC', 'AWS', 'ADOBE SYSTEMS', 'MICROSOFT', 'GOOGLE CLOUD', 'DATADOG']
const TX_NORMALIZED = ['slack', 'notion', 'figma', 'github', 'zoom', 'jira', 'salesforce', 'hubspot', 'asana', 'dropbox', 'aws', 'adobe', 'microsoft', 'google_cloud', 'datadog']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateRandomTransactions(admin: any, orgId: string, count: number) {
  try {
    const now = Date.now()
    const txns = Array.from({ length: count }, (_, i) => {
      const idx = Math.floor(Math.random() * TX_VENDORS.length)
      const amount = Math.round((50 + Math.random() * 3000) * 100) / 100
      const dayOffset = Math.floor(Math.random() * 90)
      return {
        org_id: orgId,
        plaid_transaction_id: `dev_gen_${now}_${i}`,
        vendor: TX_VENDORS[idx],
        vendor_normalized: TX_NORMALIZED[idx],
        amount,
        date: daysAgo(dayOffset),
        is_software: Math.random() > 0.15,
      }
    })
    check(await admin.from('transactions').insert(txns), 'transactions insert')
    return NextResponse.json({ success: true, message: `Generated ${count} transactions` })
  } catch (e) {
    return NextResponse.json({ success: false, error: `Generate txns failed — ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function simulatePlaidConnection(admin: any, orgId: string, institutionName: string, status: string) {
  try {
    const itemId = `dev_item_${Date.now()}`
    check(await admin.from('plaid_connections').insert({
      org_id: orgId, item_id: itemId,
      institution_name: institutionName, institution_id: `ins_dev_${Date.now()}`,
      status,
      last_synced_at: status === 'active' ? new Date().toISOString() : null,
      error_message: status === 'error' ? 'Simulated authentication error' : null,
      error_code: status === 'error' ? 'ITEM_LOGIN_REQUIRED' : null,
    }), 'plaid_connections insert')
    return NextResponse.json({ success: true, message: `Simulated ${institutionName} (${status})` })
  } catch (e) {
    return NextResponse.json({ success: false, error: `Simulate Plaid failed — ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function simulateGoCardlessConnection(admin: any, orgId: string, institutionName: string, country: string, status: string) {
  try {
    const accountId = `dev_gc_acct_${Date.now()}`
    const expiresAt = status === 'expired'
      ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

    check(await admin.from('gocardless_connections').insert({
      org_id: orgId,
      requisition_id: `dev_req_${Date.now()}`,
      account_id: accountId,
      institution_id: `${institutionName.toUpperCase().replace(/\s/g, '_')}_DEV`,
      institution_name: institutionName,
      country: country.toUpperCase(),
      status,
      expires_at: expiresAt,
      last_synced_at: status === 'active' ? new Date().toISOString() : null,
      error_message: status === 'error' ? 'Simulated GoCardless error' : status === 'expired' ? 'Bank access expired — re-authorize required' : null,
      error_code: status === 'error' ? 'GC_ERROR' : null,
    }), 'gocardless_connections insert')
    return NextResponse.json({ success: true, message: `Simulated GoCardless ${institutionName} (${country}, ${status})` })
  } catch (e) {
    return NextResponse.json({ success: false, error: `Simulate GoCardless failed — ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function simulateIdentityProvider(admin: any, orgId: string, provider: string, totalUsers: number, inactiveRatio: number) {
  try {
    const activeUsers = Math.round(totalUsers * (1 - inactiveRatio))
    const inactiveUsers = totalUsers - activeUsers

    check(await admin.from('integration_connections').upsert({
      org_id: orgId, provider,
      is_active: true, total_users: totalUsers,
      active_users: activeUsers, inactive_users: inactiveUsers,
      last_synced_at: new Date().toISOString(),
      metadata: provider === 'okta'
        ? { orgUrl: 'https://demo.okta.com', domain: 'demo.co' }
        : { domain: 'demo.co' },
    }, { onConflict: 'org_id,provider' }), 'integration_connections upsert')

    // Generate user activity records
    const names = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Sophia', 'Mason', 'Isabella', 'Logan', 'Mia', 'James', 'Charlotte', 'Elijah', 'Amelia', 'Oliver', 'Harper', 'Lucas', 'Evelyn', 'Aiden', 'Aria']
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']

    for (let i = 0; i < Math.min(totalUsers, 20); i++) {
      const isInactive = i >= activeUsers || (i >= totalUsers * (1 - inactiveRatio))
      const first = names[i % names.length]
      const last = lastNames[i % lastNames.length]
      check(await admin.from('user_activity').upsert({
        org_id: orgId,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@demo.co`,
        display_name: `${first} ${last}`,
        provider,
        last_login: daysAgo(isInactive ? 40 + Math.floor(Math.random() * 60) : Math.floor(Math.random() * 15)),
        status: isInactive ? 'inactive' : 'active',
        is_admin: i === 0,
      }, { onConflict: 'org_id,email,provider' }), 'user_activity upsert')
    }

    return NextResponse.json({ success: true, message: `Simulated ${provider} with ${totalUsers} users (${inactiveUsers} inactive)` })
  } catch (e) {
    return NextResponse.json({ success: false, error: `Simulate IdP failed — ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrgState(admin: any, ctx: { userId: string; orgId: string; role: string }) {
  const [
    { count: vendorCount },
    { count: txnCount },
    { count: plaidCount },
    { count: gcCount },
    { count: integrationCount },
    { count: userActivityCount },
    { count: reportCount },
    { data: subscription },
    { data: latestReport },
    { count: notifLogCount },
  ] = await Promise.all([
    admin.from('saas_vendors').select('*', { count: 'exact', head: true }).eq('org_id', ctx.orgId),
    admin.from('transactions').select('*', { count: 'exact', head: true }).eq('org_id', ctx.orgId),
    admin.from('plaid_connections').select('*', { count: 'exact', head: true }).eq('org_id', ctx.orgId),
    admin.from('gocardless_connections').select('*', { count: 'exact', head: true }).eq('org_id', ctx.orgId),
    admin.from('integration_connections').select('*', { count: 'exact', head: true }).eq('org_id', ctx.orgId),
    admin.from('user_activity').select('*', { count: 'exact', head: true }).eq('org_id', ctx.orgId),
    admin.from('waste_reports').select('*', { count: 'exact', head: true }).eq('org_id', ctx.orgId),
    admin.from('subscriptions').select('tier, status').eq('org_id', ctx.orgId).single(),
    admin.from('waste_reports').select('total_monthly_waste, total_annual_waste, ghost_seat_count, duplicate_count, generated_at').eq('org_id', ctx.orgId).order('generated_at', { ascending: false }).limit(1).single(),
    admin.from('notification_log').select('*', { count: 'exact', head: true }).eq('org_id', ctx.orgId),
  ])

  return NextResponse.json({
    success: true,
    state: {
      user: { userId: ctx.userId, orgId: ctx.orgId, role: ctx.role },
      subscription: subscription ?? { tier: 'free', status: 'active' },
      counts: {
        vendors: vendorCount ?? 0,
        transactions: txnCount ?? 0,
        plaidConnections: plaidCount ?? 0,
        gocardlessConnections: gcCount ?? 0,
        integrations: integrationCount ?? 0,
        userActivity: userActivityCount ?? 0,
        reports: reportCount ?? 0,
        notifications: notifLogCount ?? 0,
      },
      latestReport: latestReport ?? null,
      env: {
        MOCK_SERVICES: process.env.MOCK_SERVICES ?? 'not set',
        NEXT_PUBLIC_MOCK_SERVICES: process.env.NEXT_PUBLIC_MOCK_SERVICES ?? 'not set',
        PLAID_ENV: process.env.PLAID_ENV ?? 'not set',
        NODE_ENV: process.env.NODE_ENV ?? 'not set',
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasPlaidKeys: !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
        hasGoCardlessKeys: !!(process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY),
        hasGoogleKeys: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        hasOktaKeys: !!(process.env.OKTA_ORG_URL && process.env.OKTA_API_TOKEN),
        hasStripeKeys: !!(process.env.STRIPE_SECRET_KEY),
        hasResendKey: !!process.env.RESEND_API_KEY,
        hasCronSecret: !!process.env.CRON_SECRET,
      },
    },
  })
}

function daysAgo(d: number): string {
  const date = new Date()
  date.setDate(date.getDate() - d)
  return date.toISOString().split('T')[0]
}
