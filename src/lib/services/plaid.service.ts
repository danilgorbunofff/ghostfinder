import {
  PlaidApi,
  PlaidEnvironments,
  Configuration,
  Products,
  CountryCode,
  type TransactionsSyncRequest,
  type Transaction,
} from 'plaid'

// ─── Client Initialization ─────────────────────────────────────────────────

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
})

const plaidClient = new PlaidApi(configuration)

// ─── Service Methods ────────────────────────────────────────────────────────

export async function createLinkToken(userId: string) {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'GhostFinder',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`,
  })

  return response.data.link_token
}

export async function exchangePublicToken(publicToken: string) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  })

  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  }
}

export async function syncTransactions(
  accessToken: string,
  cursor?: string | null
): Promise<{
  added: Transaction[]
  modified: Transaction[]
  removed: { transaction_id: string }[]
  nextCursor: string
  hasMore: boolean
}> {
  const allAdded: Transaction[] = []
  const allModified: Transaction[] = []
  const allRemoved: { transaction_id: string }[] = []
  let currentCursor = cursor || undefined
  let hasMore = true

  while (hasMore) {
    const request: TransactionsSyncRequest = {
      access_token: accessToken,
      cursor: currentCursor,
      count: 500,
    }

    const response = await plaidClient.transactionsSync(request)
    const data = response.data

    allAdded.push(...data.added)
    allModified.push(...data.modified)
    allRemoved.push(...data.removed)

    currentCursor = data.next_cursor
    hasMore = data.has_more
  }

  return {
    added: allAdded,
    modified: allModified,
    removed: allRemoved,
    nextCursor: currentCursor!,
    hasMore: false,
  }
}

export async function getInstitution(institutionId: string) {
  const response = await plaidClient.institutionsGetById({
    institution_id: institutionId,
    country_codes: [CountryCode.Us],
  })
  return response.data.institution
}

export async function verifyWebhook(
  body: string,
  headers: Record<string, string>
): Promise<boolean> {
  try {
    const jwtToken = headers['plaid-verification']
    if (!jwtToken) return false

    await plaidClient.webhookVerificationKeyGet({
      key_id: jwtToken,
    })
    return true
  } catch {
    return false
  }
}
