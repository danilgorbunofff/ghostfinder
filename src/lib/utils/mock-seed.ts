import { type SupabaseClient } from '@supabase/supabase-js'
import { generateWasteReport } from '@/lib/reconciliation/engine'

// Shared mock data for connection mock-mode flows.
// Extracted from dev/route.ts to avoid duplication.

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

function daysAgo(d: number): string {
  const date = new Date()
  date.setDate(date.getDate() - d)
  return date.toISOString().split('T')[0]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>

export async function seedMockVendors(admin: AdminClient, orgId: string) {
  for (const v of SAMPLE_VENDORS) {
    const { error } = await admin.from('saas_vendors').upsert({
      org_id: orgId,
      name: v.name,
      normalized_name: v.normalized,
      monthly_cost: v.cost,
      annual_cost: v.cost * 12,
      seats_paid: v.seats,
      category: v.category,
      is_active: true,
      first_seen: daysAgo(90),
      last_seen: daysAgo(2),
      transaction_count: 12,
    }, { onConflict: 'org_id,normalized_name' })
    if (error) console.error(`[mock-seed] vendor ${v.name} failed:`, error.message)
  }
}

export async function seedMockTransactions(admin: AdminClient, orgId: string) {
  const txns = SAMPLE_VENDORS.map((v, i) => ({
    org_id: orgId,
    plaid_transaction_id: `mock_txn_${v.normalized}_${Date.now()}_${i}`,
    vendor: v.name.toUpperCase() + ' INC',
    vendor_normalized: v.normalized,
    amount: v.cost,
    date: daysAgo(i * 2 + 1),
    is_software: true,
  }))
  const { error } = await admin.from('transactions').upsert(txns, { onConflict: 'org_id,plaid_transaction_id' })
  if (error) console.error('[mock-seed] transactions failed:', error.message)
}

export async function seedMockUserActivity(admin: AdminClient, orgId: string, provider: string) {
  for (const u of SAMPLE_USERS) {
    const { error } = await admin.from('user_activity').upsert({
      org_id: orgId,
      email: u.email,
      display_name: u.name,
      provider,
      last_login: new Date(new Date().setDate(new Date().getDate() - u.daysAgo)).toISOString(),
      status: u.status,
      is_admin: u.isAdmin,
    }, { onConflict: 'org_id,email,provider' })
    if (error) console.error(`[mock-seed] user_activity ${u.email} failed:`, error.message)
  }
}

export async function seedMockWasteReport(admin: AdminClient, orgId: string) {
  const { error } = await admin.from('waste_reports').delete().eq('org_id', orgId)
  if (error) {
    throw new Error(`[mock-seed] waste_reports cleanup failed: ${error.message}`)
  }

  await generateWasteReport(admin, orgId)
}
