import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const email = 'e2e-owner@ghostfinder.test'
const password = 'TestPassword123!'

async function ensureOwnerUser() {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const users = await admin.auth.admin.listUsers()
  if (users.error) {
    throw users.error
  }

  let userId = users.data.users.find((user) => user.email === email)?.id
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (created.error || !created.data.user) {
      throw created.error ?? new Error('Failed to create runtime verification user')
    }
    userId = created.data.user.id
  } else {
    const updated = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    })
    if (updated.error) {
      throw updated.error
    }
  }

  const memberships = await admin
    .from('org_members')
    .select('org_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (memberships.error) {
    throw memberships.error
  }

  if (!memberships.data?.length) {
    const org = await admin
      .from('organizations')
      .insert({ name: 'E2E Test Org' })
      .select('id')
      .single()

    if (org.error || !org.data) {
      throw org.error ?? new Error('Failed to create runtime verification org')
    }

    const memberInsert = await admin
      .from('org_members')
      .insert({ user_id: userId, org_id: org.data.id, role: 'owner' })

    if (memberInsert.error) {
      throw memberInsert.error
    }
  }
}

async function callDev(page, action) {
  return page.evaluate(async (currentAction) => {
    const res = await fetch('/api/dev', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ghostfinder-Dev-Action': '1',
      },
      body: JSON.stringify({ action: currentAction }),
    })

    return {
      status: res.status,
      body: await res.json(),
    }
  }, action)
}

async function textIfVisible(locator) {
  try {
    return await locator.textContent()
  } catch {
    return null
  }
}

async function visibleIfPresent(locator) {
  try {
    return await locator.isVisible()
  } catch {
    return false
  }
}

async function main() {
  await ensureOwnerUser()

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const pageErrors = []

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  await page.goto('http://localhost:3000/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL('http://localhost:3000/', { timeout: 15000 })
  await page.waitForLoadState('networkidle')

  const seed = await callDev(page, 'seed-data')
  const state = await callDev(page, 'get-state')

  await page.goto('http://localhost:3000/')
  await page.waitForLoadState('networkidle')
  const dashboardSpend = await textIfVisible(page.getByTestId('stat-total-spend'))
  const gettingStartedVisible = await visibleIfPresent(page.getByTestId('getting-started'))

  await page.goto('http://localhost:3000/inventory')
  await page.waitForLoadState('networkidle')
  const inventoryText = (await page.textContent('body')) ?? ''
  const inventoryTableVisible = await visibleIfPresent(page.getByTestId('vendor-table'))
  const inventoryGridVisible = await visibleIfPresent(page.getByTestId('vendor-grid'))

  await page.goto('http://localhost:3000/connections')
  await page.waitForLoadState('networkidle')
  const connectionsText = (await page.textContent('body')) ?? ''

  const reportsResponse = await page.goto('http://localhost:3000/reports')
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(
    () => {
      const text = document.body.innerText
      return text.includes('Generated') || text.includes('Ghost Seats') || text.includes('No reports generated yet')
    },
    { timeout: 5000 }
  ).catch(() => null)
  const reportsText = (await page.textContent('body')) ?? ''
  const reportsHtmlPreview = (await page.locator('body').innerHTML()).slice(0, 300)
  const reportsTitle = await page.title()
  const reportTotalWaste = await textIfVisible(page.getByTestId('report-total-waste'))
  const reportsEmptyVisible = await visibleIfPresent(page.getByTestId('reports-empty-state'))
  await page.screenshot({ path: 'test-results/reports-runtime.png', fullPage: true })

  await page.goto('http://localhost:3000/billing')
  await page.waitForLoadState('networkidle')
  const billingText = (await page.textContent('body')) ?? ''

  console.log(JSON.stringify({
    seed,
    counts: state.body?.state?.counts,
    dashboardSpend,
    gettingStartedVisible,
    inventoryHasEmpty: inventoryText.includes('No SaaS vendors detected yet'),
    inventoryHasSlack: inventoryText.includes('Slack'),
    inventoryTableVisible,
    inventoryGridVisible,
    connectionsHasChase: connectionsText.includes('Chase Bank'),
    connectionsHasOkta: connectionsText.includes('Okta'),
    reportsStatus: reportsResponse?.status() ?? null,
    reportsTitle,
    reportTotalWaste,
    reportsEmptyVisible,
    reportsHasGenerated: reportsText.includes('Generated'),
    reportsHasGhostSeatsTab: reportsText.includes('Ghost Seats'),
    reportsPreview: reportsText.slice(0, 300),
    reportsHtmlPreview,
    pageErrors,
    billingHasRecovery: billingText.includes('Recovery') && billingText.includes('Current Plan'),
  }, null, 2))

  await browser.close()
}

await main()