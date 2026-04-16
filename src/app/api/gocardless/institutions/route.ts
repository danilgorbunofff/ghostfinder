import { listInstitutions, EU_EEA_COUNTRIES } from '@/lib/services/gocardless.service'
import { NextResponse, type NextRequest } from 'next/server'

const VALID_COUNTRY_CODES = new Set(EU_EEA_COUNTRIES.map((c) => c.code))

const MOCK_INSTITUTIONS = [
  { id: 'REVOLUT_REVOGB21', name: 'Revolut', bic: 'REVOGB21', logo: 'https://cdn.nordigen.com/ais/REVOLUT_REVOGB21.png', countries: ['GB', 'DE', 'FR'] },
  { id: 'N26_NTSBDEB1', name: 'N26', bic: 'NTSBDEB1', logo: 'https://cdn.nordigen.com/ais/N26_NTSBDEB1.png', countries: ['DE', 'ES', 'FR', 'IT'] },
  { id: 'MONZO_MONZGB2L', name: 'Monzo', bic: 'MONZGB2L', logo: 'https://cdn.nordigen.com/ais/MONZO_MONZGB2L.png', countries: ['GB'] },
  { id: 'ING_INGBNL2A', name: 'ING', bic: 'INGBNL2A', logo: 'https://cdn.nordigen.com/ais/ING_INGBNL2A.png', countries: ['NL', 'DE', 'BE'] },
  { id: 'DEUTSCHE_DEUTDEFF', name: 'Deutsche Bank', bic: 'DEUTDEFF', logo: 'https://cdn.nordigen.com/ais/DEUTSCHE_DEUTDEFF.png', countries: ['DE'] },
]

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get('country')?.toUpperCase()

  if (!country || !VALID_COUNTRY_CODES.has(country)) {
    return NextResponse.json(
      { error: 'Invalid or missing country code. Use ISO 3166-1 alpha-2 (e.g. GB, DE).' },
      { status: 400 }
    )
  }

  if (process.env.MOCK_SERVICES === 'true') {
    const filtered = MOCK_INSTITUTIONS.filter((i) => i.countries.includes(country))
    return NextResponse.json({ institutions: filtered })
  }

  try {
    const institutions = await listInstitutions(country)
    return NextResponse.json(
      { institutions },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    )
  } catch (error) {
    console.error('Failed to fetch GoCardless institutions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch institutions' },
      { status: 500 }
    )
  }
}
