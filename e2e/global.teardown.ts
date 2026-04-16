import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TEST_EMAIL = 'e2e-owner@ghostfinder.test'

setup('cleanup test user data', async () => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: existing } = await admin.auth.admin.listUsers()
  const user = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (!user) return

  // Clean org data
  const { data: membership } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership?.org_id) {
    const orgId = membership.org_id
    const tables = [
      'waste_reports',
      'notification_log',
      'notification_settings',
      'user_activity',
      'transactions',
      'saas_vendors',
      'integration_connections',
      'plaid_connections',
      'subscriptions',
    ]
    for (const table of tables) {
      await admin.from(table).delete().eq('org_id', orgId)
    }
    await admin.from('org_members').delete().eq('org_id', orgId)
    await admin.from('organizations').delete().eq('id', orgId)
  }

  await admin.auth.admin.deleteUser(user.id)
})
