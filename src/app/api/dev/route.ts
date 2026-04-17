import { createAdminClient } from '@/lib/supabase/admin'
import { ensureOrganization } from '@/lib/supabase/ensure-org'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Block in production — returns 404 as if route doesn't exist
function guardDev() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return null
}

async function getAuthContext(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  // Verify the token server-side using admin client — no cookie parsing needed
  const admin = createAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null

  // Ensure org exists (safety net for users missing handle_new_user trigger)
  const { orgId, role } = await ensureOrganization(
    user.id,
    user.email ?? undefined,
    user.user_metadata?.full_name ?? undefined
  )
  return { userId: user.id, orgId, role }
}

export async function POST(request: Request) {
  const blocked = guardDev()
  if (blocked) return blocked

  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action, ...params } = body as { action: string; [key: string]: unknown }
  const admin = createAdminClient()

  switch (action) {
    // ─── Data Actions ──────────────────────────────────────────────────
    case 'seed-data': {
      return await seedDemoData(admin, ctx.orgId)
    }

    case 'reset-data': {
      return await resetOrgData(admin, ctx.orgId)
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
      await admin.from(table).delete().eq('org_id', ctx.orgId)
      return NextResponse.json({ success: true, message: `Cleared ${table}` })
    }

    case 'generate-transactions': {
      const count = Math.min(Math.max(Number(params.count) || 20, 1), 500)
      return await generateRandomTransactions(admin, ctx.orgId, count)
    }

    // ─── Connection Simulation ─────────────────────────────────────────
    case 'simulate-plaid': {
      const status = (params.status as string) || 'active'
      const name = (params.institutionName as string) || 'Demo Bank'
      return await simulatePlaidConnection(admin, ctx.orgId, name, status)
    }

    case 'simulate-google': {
      const total = Number(params.totalUsers) || 40
      const inactiveRatio = Number(params.inactiveRatio) || 0.25
      return await simulateIdentityProvider(admin, ctx.orgId, 'google_workspace', total, inactiveRatio)
    }

    case 'simulate-okta': {
      const total = Number(params.totalUsers) || 45
      const inactiveRatio = Number(params.inactiveRatio) || 0.2
      return await simulateIdentityProvider(admin, ctx.orgId, 'okta', total, inactiveRatio)
    }

    case 'simulate-gocardless': {
      const gcName = (params.institutionName as string) || 'Revolut'
      const gcCountry = (params.country as string) || 'GB'
      const gcStatus = (params.status as string) || 'active'
      return await simulateGoCardlessConnection(admin, ctx.orgId, gcName, gcCountry, gcStatus)
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
      await admin.from(table).update({ [field]: value }).eq('id', connectionId).eq('org_id', ctx.orgId)
      return NextResponse.json({ success: true })
    }

    // ─── Cron Triggers ─────────────────────────────────────────────────
    case 'run-cron': {
      const job = params.job as string
      const jobMap: Record<string, string> = {
        'sync-transactions': '/api/cron/sync-transactions',
        'sync-usage': '/api/cron/sync-usage',
        'generate-reports': '/api/cron/generate-reports',
      }
      const path = jobMap[job]
      if (!path) {
        return NextResponse.json({ error: `Unknown cron job: ${job}` }, { status: 400 })
      }
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const res = await fetch(`${baseUrl}${path}`, {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        })
        const data = await res.json()
        return NextResponse.json({ success: res.ok, status: res.status, data })
      } catch (e) {
        return NextResponse.json({ success: false, error: String(e) })
      }
    }

    // ─── Auth & Roles ──────────────────────────────────────────────────
    case 'switch-role': {
      const newRole = params.role as string
      const validRoles = ['owner', 'admin', 'member', 'viewer']
      if (!validRoles.includes(newRole)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      await admin.from('org_members').update({ role: newRole }).eq('user_id', ctx.userId).eq('org_id', ctx.orgId)
      return NextResponse.json({ success: true, role: newRole })
    }

    case 'switch-tier': {
      const newTier = params.tier as string
      const validTiers = ['free', 'monitor', 'recovery']
      if (!validTiers.includes(newTier)) {
        return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
      }
      await admin.from('subscriptions').upsert({
        org_id: ctx.orgId,
        stripe_customer_id: 'cus_dev_tools',
        tier: newTier,
        status: 'active',
      }, { onConflict: 'org_id' })
      return NextResponse.json({ success: true, tier: newTier })
    }

    // ─── Inspect ───────────────────────────────────────────────────────
    case 'get-state': {
      return await getOrgState(admin, ctx)
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}

// ─── Implementation Helpers ──────────────────────────────────────────────────

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
  // 1. Subscription
  await admin.from('subscriptions').upsert({
    org_id: orgId, stripe_customer_id: 'cus_dev_tools',
    tier: 'recovery', status: 'active', verified_annual_savings: 46140,
  }, { onConflict: 'org_id' })

  // 2. Plaid connection
  await admin.from('plaid_connections').upsert({
    org_id: orgId, item_id: 'dev_item_chase',
    institution_name: 'Chase Bank', institution_id: 'ins_3',
    status: 'active', last_synced_at: new Date().toISOString(),
  }, { onConflict: 'org_id,item_id' })

  // 3. Vendors
  for (const v of SAMPLE_VENDORS) {
    await admin.from('saas_vendors').upsert({
      org_id: orgId, name: v.name, normalized_name: v.normalized,
      monthly_cost: v.cost, annual_cost: v.cost * 12,
      seats_paid: v.seats, category: v.category,
      is_active: true, first_seen: daysAgo(90), last_seen: daysAgo(2),
      transaction_count: 12,
    }, { onConflict: 'org_id,normalized_name' })
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
  await admin.from('transactions').upsert(txns, { onConflict: 'org_id,plaid_transaction_id' })

  // 5. Identity providers
  await admin.from('integration_connections').upsert({
    org_id: orgId, provider: 'okta',
    is_active: true, total_users: 47, active_users: 36, inactive_users: 11,
    last_synced_at: new Date().toISOString(),
    metadata: { orgUrl: 'https://demo.okta.com', domain: 'demo.co' },
  }, { onConflict: 'org_id,provider' })

  await admin.from('integration_connections').upsert({
    org_id: orgId, provider: 'google_workspace',
    is_active: true, total_users: 38, active_users: 29, inactive_users: 9,
    last_synced_at: new Date().toISOString(),
    metadata: { domain: 'demo.co', customerId: 'C0dev123' },
  }, { onConflict: 'org_id,provider' })

  // 6. User activity
  for (const u of SAMPLE_USERS) {
    const provider = u.isAdmin || u.email.startsWith('h') || u.email.startsWith('i') || u.email.startsWith('j') || u.email.startsWith('k') || u.email.startsWith('l') || u.email.startsWith('o')
      ? 'google_workspace' : 'okta'
    await admin.from('user_activity').upsert({
      org_id: orgId, email: u.email, display_name: u.name,
      provider, last_login: daysAgo(u.daysAgo),
      status: u.status, is_admin: u.isAdmin,
    }, { onConflict: 'org_id,email,provider' })
  }

  // 7. Waste report
  await admin.from('waste_reports').insert({
    org_id: orgId, total_monthly_waste: 3845, total_annual_waste: 46140,
    ghost_seat_count: 5, duplicate_count: 2,
    ghost_seats: [
      { user: 'carol@demo.co', name: 'Carol White', tools: ['Slack', 'Figma', 'Notion'], monthly_cost: 1735, last_login_days: 45 },
      { user: 'dave@demo.co', name: 'Dave Brown', tools: ['Slack', 'Jira'], monthly_cost: 1255, last_login_days: 60 },
      { user: 'frank@demo.co', name: 'Frank Wilson', tools: ['Salesforce', 'HubSpot'], monthly_cost: 3290, last_login_days: 90 },
      { user: 'henry@demo.co', name: 'Henry Martinez', tools: ['Zoom', 'Asana'], monthly_cost: 740, last_login_days: 55 },
      { user: 'jake@demo.co', name: 'Jake Anderson', tools: ['GitHub', 'Notion'], monthly_cost: 530, last_login_days: 75 },
    ],
    duplicates: [
      { vendors: ['Asana', 'Jira'], monthly_cost: 670, note: 'Project management overlap' },
      { vendors: ['Salesforce', 'HubSpot'], monthly_cost: 3290, note: 'CRM overlap' },
    ],
  })

  // 8. Notification settings
  await admin.from('notification_settings').upsert({
    org_id: orgId, slack_webhook_url: '', slack_enabled: false,
    email_enabled: false, email_recipients: [],
    notify_on_ghost_seats: true, notify_on_duplicates: true,
    notify_threshold_amount: 500,
  }, { onConflict: 'org_id' })

  return NextResponse.json({ success: true, message: 'Demo data seeded' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resetOrgData(admin: any, orgId: string) {
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
    await admin.from(t).delete().eq('org_id', orgId)
  }
  // Reset subscription to free tier
  await admin.from('subscriptions').upsert({
    org_id: orgId, stripe_customer_id: 'cus_dev_tools',
    tier: 'free', status: 'active', verified_annual_savings: 0,
  }, { onConflict: 'org_id' })

  return NextResponse.json({ success: true, message: 'Project reset — all data cleared, back to free tier' })
}

const TX_VENDORS = ['SLACK TECH', 'NOTION LABS', 'FIGMA INC', 'GITHUB INC', 'ZOOM VIDEO', 'ATLASSIAN', 'SALESFORCE', 'HUBSPOT', 'ASANA INC', 'DROPBOX INC', 'AWS', 'ADOBE SYSTEMS', 'MICROSOFT', 'GOOGLE CLOUD', 'DATADOG']
const TX_NORMALIZED = ['slack', 'notion', 'figma', 'github', 'zoom', 'jira', 'salesforce', 'hubspot', 'asana', 'dropbox', 'aws', 'adobe', 'microsoft', 'google_cloud', 'datadog']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateRandomTransactions(admin: any, orgId: string, count: number) {
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
  await admin.from('transactions').insert(txns)
  return NextResponse.json({ success: true, message: `Generated ${count} transactions` })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function simulatePlaidConnection(admin: any, orgId: string, institutionName: string, status: string) {
  const itemId = `dev_item_${Date.now()}`
  await admin.from('plaid_connections').insert({
    org_id: orgId, item_id: itemId,
    institution_name: institutionName, institution_id: `ins_dev_${Date.now()}`,
    status,
    last_synced_at: status === 'active' ? new Date().toISOString() : null,
    error_message: status === 'error' ? 'Simulated authentication error' : null,
    error_code: status === 'error' ? 'ITEM_LOGIN_REQUIRED' : null,
  })
  return NextResponse.json({ success: true, message: `Simulated ${institutionName} (${status})` })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function simulateGoCardlessConnection(admin: any, orgId: string, institutionName: string, country: string, status: string) {
  const accountId = `dev_gc_acct_${Date.now()}`
  const expiresAt = status === 'expired'
    ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  await admin.from('gocardless_connections').insert({
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
  })
  return NextResponse.json({ success: true, message: `Simulated GoCardless ${institutionName} (${country}, ${status})` })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function simulateIdentityProvider(admin: any, orgId: string, provider: string, totalUsers: number, inactiveRatio: number) {
  const activeUsers = Math.round(totalUsers * (1 - inactiveRatio))
  const inactiveUsers = totalUsers - activeUsers

  await admin.from('integration_connections').upsert({
    org_id: orgId, provider,
    is_active: true, total_users: totalUsers,
    active_users: activeUsers, inactive_users: inactiveUsers,
    last_synced_at: new Date().toISOString(),
    metadata: provider === 'okta'
      ? { orgUrl: 'https://demo.okta.com', domain: 'demo.co' }
      : { domain: 'demo.co' },
  }, { onConflict: 'org_id,provider' })

  // Generate user activity records
  const names = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Sophia', 'Mason', 'Isabella', 'Logan', 'Mia', 'James', 'Charlotte', 'Elijah', 'Amelia', 'Oliver', 'Harper', 'Lucas', 'Evelyn', 'Aiden', 'Aria']
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']

  for (let i = 0; i < Math.min(totalUsers, 20); i++) {
    const isInactive = i >= activeUsers || (i >= totalUsers * (1 - inactiveRatio))
    const first = names[i % names.length]
    const last = lastNames[i % lastNames.length]
    await admin.from('user_activity').upsert({
      org_id: orgId,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@demo.co`,
      display_name: `${first} ${last}`,
      provider,
      last_login: daysAgo(isInactive ? 40 + Math.floor(Math.random() * 60) : Math.floor(Math.random() * 15)),
      status: isInactive ? 'inactive' : 'active',
      is_admin: i === 0,
    }, { onConflict: 'org_id,email,provider' })
  }

  return NextResponse.json({ success: true, message: `Simulated ${provider} with ${totalUsers} users (${inactiveUsers} inactive)` })
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
        PLAID_ENV: process.env.PLAID_ENV ?? 'not set',
        NODE_ENV: process.env.NODE_ENV ?? 'not set',
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
