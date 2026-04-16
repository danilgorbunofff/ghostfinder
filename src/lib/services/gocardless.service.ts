// ─── GoCardless Bank Account Data API (formerly Nordigen) ──────────────────
// Docs: https://developer.gocardless.com/bank-account-data/overview

const BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2'

// ─── Auth ───────────────────────────────────────────────────────────────────

let cachedToken: { access: string; expires: number } | null = null

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5min buffer)
  if (cachedToken && cachedToken.expires > Date.now() + 5 * 60 * 1000) {
    return cachedToken.access
  }

  const res = await fetch(`${BASE_URL}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret_id: process.env.GOCARDLESS_SECRET_ID!,
      secret_key: process.env.GOCARDLESS_SECRET_KEY!,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GoCardless auth failed (${res.status}): ${body}`)
  }

  const data = await res.json() as {
    access: string
    access_expires: number   // seconds
    refresh: string
    refresh_expires: number
  }

  cachedToken = {
    access: data.access,
    expires: Date.now() + data.access_expires * 1000,
  }

  return data.access
}

async function gcFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GoCardless API ${path} failed (${res.status}): ${body}`)
  }

  return res.json() as Promise<T>
}

// ─── Institutions ───────────────────────────────────────────────────────────

export interface GCInstitution {
  id: string
  name: string
  bic: string
  logo: string
  countries: string[]
}

export async function listInstitutions(country: string): Promise<GCInstitution[]> {
  return gcFetch<GCInstitution[]>(`/institutions/?country=${encodeURIComponent(country.toUpperCase())}`)
}

// ─── Requisitions ───────────────────────────────────────────────────────────

interface RequisitionResponse {
  id: string
  link: string
  status: string
  accounts: string[]
  institution_id: string
  reference: string
}

export async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  referenceId: string
): Promise<RequisitionResponse> {
  return gcFetch<RequisitionResponse>('/requisitions/', {
    method: 'POST',
    body: JSON.stringify({
      institution_id: institutionId,
      redirect: redirectUrl,
      reference: referenceId,
      user_language: 'EN',
    }),
  })
}

export async function getRequisition(requisitionId: string): Promise<RequisitionResponse> {
  return gcFetch<RequisitionResponse>(`/requisitions/${encodeURIComponent(requisitionId)}/`)
}

// ─── Account Details ────────────────────────────────────────────────────────

interface AccountMetadata {
  id: string
  status: string
  institution_id: string
  owner_name: string
  created: string
}

export async function getAccountMetadata(accountId: string): Promise<AccountMetadata> {
  return gcFetch<AccountMetadata>(`/accounts/${encodeURIComponent(accountId)}/`)
}

// ─── Transactions ───────────────────────────────────────────────────────────

export interface GCTransactionAmount {
  amount: string   // e.g. "-12.50" or "12.50"
  currency: string // e.g. "EUR"
}

export interface GCTransaction {
  transactionId: string
  bookingDate: string      // "YYYY-MM-DD"
  valueDate?: string
  transactionAmount: GCTransactionAmount
  creditorName?: string
  debtorName?: string
  remittanceInformationUnstructured?: string
  remittanceInformationUnstructuredArray?: string[]
  proprietaryBankTransactionCode?: string
  merchantCategoryCode?: string
}

interface TransactionsResponse {
  transactions: {
    booked: GCTransaction[]
    pending: GCTransaction[]
  }
}

export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ booked: GCTransaction[]; pending: GCTransaction[] }> {
  const params = new URLSearchParams()
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  const qs = params.toString() ? `?${params.toString()}` : ''

  const data = await gcFetch<TransactionsResponse>(
    `/accounts/${encodeURIComponent(accountId)}/transactions/${qs}`
  )
  return data.transactions
}

// ─── Transaction Mapping ────────────────────────────────────────────────────

/**
 * Extract a merchant/vendor name from a GoCardless transaction.
 * Priority: creditorName > remittanceInformationUnstructured > debtorName
 */
export function extractMerchantName(txn: GCTransaction): string | null {
  if (txn.creditorName) return txn.creditorName
  if (txn.remittanceInformationUnstructured) return txn.remittanceInformationUnstructured
  if (txn.remittanceInformationUnstructuredArray?.length) {
    return txn.remittanceInformationUnstructuredArray[0]
  }
  if (txn.debtorName) return txn.debtorName
  return null
}

// ─── EU Countries ───────────────────────────────────────────────────────────

export const EU_EEA_COUNTRIES: { code: string; name: string }[] = [
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'GB', name: 'United Kingdom' },
]
