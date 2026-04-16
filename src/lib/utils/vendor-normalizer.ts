import { KNOWN_SAAS_VENDORS, isSoftwareMCC } from './mcc-codes'

const PAYMENT_PROCESSOR_PREFIXES = [
  'STRIPE*',
  'SQ *',
  'SQU*',
  'PAYPAL *',
  'PAYPAL*',
  'PP*',
  'BILL.COM*',
  'ACH ',
  'DEBIT ',
  'RECURRING ',
  'AUTOPAY ',
  'WIRE ',
  // EU payment processors
  'ADYEN*',
  'MOLLIE*',
  'GOCARDLESS*',
  'KLARNA*',
  'SUMUP*',
  'IZETTLE*',
  'WORLDPAY*',
]

const NOISE_SUFFIXES = [
  'INC',
  'INC.',
  'LLC',
  'LLC.',
  'LTD',
  'LTD.',
  'CORP',
  'CORP.',
  'CO',
  'CO.',
  'GMBH',
  'AG',
  'BV',
  'B.V.',
  'NV',
  'N.V.',
  'SA',
  'S.A.',
  'SRL',
  'S.R.L.',
  'PTY',
  'SARL',
  'OY',
  'AB',
  'AS',
  'APS',
  'SUBSCRIPTION',
  'MONTHLY',
  'ANNUAL',
  'PLAN',
  'PAYMENT',
  'CHARGE',
  'SERVICE',
  'SERVICES',
  'TECHNOLOGIES',
  'IRELAND',
  'EUROPE',
  'INTERNATIONAL',
  'UK',
]

export function normalizeVendorName(rawName: string): {
  normalizedName: string
  displayName: string
  category: string | null
  isKnown: boolean
} {
  let cleaned = rawName.trim()

  // Strip payment processor prefixes
  for (const prefix of PAYMENT_PROCESSOR_PREFIXES) {
    if (cleaned.toUpperCase().startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length).trim()
      break
    }
  }

  // Remove noise suffixes
  const words = cleaned.split(/\s+/)
  const filteredWords = words.filter(
    (word) => !NOISE_SUFFIXES.includes(word.toUpperCase().replace(/[.,]$/, ''))
  )
  cleaned = filteredWords.join(' ').trim()

  // Lowercase for matching
  const lowered = cleaned.toLowerCase()

  // Match against known SaaS vendors
  for (const [key, vendor] of Object.entries(KNOWN_SAAS_VENDORS)) {
    for (const pattern of vendor.patterns) {
      if (lowered.includes(pattern.toLowerCase())) {
        return {
          normalizedName: key,
          displayName: vendor.displayName,
          category: vendor.category,
          isKnown: true,
        }
      }
    }
  }

  // No match — return cleaned name
  return {
    normalizedName: lowered.replace(/[^a-z0-9]/g, '_'),
    displayName: cleaned,
    category: null,
    isKnown: false,
  }
}

export function isSoftwareTransaction(
  mccCode: string | null | undefined,
  merchantName: string | null | undefined,
  category: string | null | undefined
): boolean {
  if (isSoftwareMCC(mccCode)) return true

  if (merchantName) {
    const { isKnown } = normalizeVendorName(merchantName)
    if (isKnown) return true
  }

  if (category) {
    const softwareCategories = [
      'Software',
      'Computers and Electronics',
      'Digital Purchase',
    ]
    if (softwareCategories.some((c) => category.includes(c))) return true
  }

  return false
}
