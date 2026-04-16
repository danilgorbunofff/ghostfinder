import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const TEST_EMAIL = 'e2e-owner@ghostfinder.test'
const TEST_PASSWORD = 'TestPassword123!'

setup('create test user and authenticate', async ({ page }) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Create or find the test user
  const { data: existing } = await admin.auth.admin.listUsers()
  let userId = existing?.users?.find((u) => u.email === TEST_EMAIL)?.id

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (error) throw new Error(`Failed to create test user: ${error.message}`)
    userId = data.user.id
  } else {
    // Ensure password is current
    await admin.auth.admin.updateUserById(userId, { password: TEST_PASSWORD })
  }

  // 2. Ensure org + membership exists (the app's trigger may handle this,
  //    but we ensure it here for CI where seed may not have run)
  const { data: membership } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    const { data: org } = await admin
      .from('organizations')
      .insert({ name: 'E2E Test Org' })
      .select('id')
      .single()

    if (org) {
      await admin.from('org_members').insert({
        user_id: userId,
        org_id: org.id,
        role: 'owner',
      })
    }
  }

  // 3. Sign in via the browser so Supabase cookies are set
  await page.goto('/login')

  // Use Supabase client-side auth in the browser context
  await page.evaluate(
    async ({ url, anonKey, email, password }) => {
      const { createClient: createBrowserClient } = await import(
        '@supabase/supabase-js'
      )
      const supabase = createBrowserClient(url, anonKey)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw new Error(`Browser sign-in failed: ${error.message}`)
    },
    { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, email: TEST_EMAIL, password: TEST_PASSWORD }
  )

  // Wait for auth to settle and redirect
  await page.waitForURL('/', { timeout: 15_000 })

  // 4. Save authenticated state
  await page.context().storageState({ path: 'e2e/.auth/owner.json' })
})
