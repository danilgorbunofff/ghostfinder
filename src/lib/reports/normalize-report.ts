import type { DuplicateFinding } from '@/lib/reconciliation/duplicate-detector'
import type { GhostSeatFinding } from '@/lib/reconciliation/ghost-detector'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown_vendor'
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

function normalizeInactiveUsers(value: unknown): GhostSeatFinding['inactiveUsers'] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((user) => {
      const email = toString(user.email, toString(user.user, 'unknown@ghostfinder.local'))
      return {
        email,
        displayName: toNullableString(user.displayName) ?? toNullableString(user.name),
        lastLogin: toNullableString(user.lastLogin) ?? toNullableString(user.last_login),
        daysSinceLogin: Math.max(0, Math.round(toNumber(user.daysSinceLogin, toNumber(user.last_login_days, 999)))),
        provider: toString(user.provider, toString(user.source, 'seed')),
      }
    })
    .sort((left, right) => right.daysSinceLogin - left.daysSinceLogin)
}

function normalizeGhostSeatFinding(value: JsonRecord): GhostSeatFinding {
  const tools = normalizeStringArray(value.tools)
  const vendor = toString(value.vendor, tools[0] ?? toString(value.name, 'Unknown Vendor'))
  const inactiveUsers = normalizeInactiveUsers(value.inactiveUsers)

  if (inactiveUsers.length === 0 && typeof value.user === 'string') {
    inactiveUsers.push({
      email: value.user,
      displayName: toNullableString(value.name),
      lastLogin: null,
      daysSinceLogin: Math.max(0, Math.round(toNumber(value.last_login_days, 999))),
      provider: 'seed',
    })
  }

  const ghostSeats = Math.max(0, Math.round(toNumber(value.ghostSeats, inactiveUsers.length)))
  const totalSeats = Math.max(ghostSeats, Math.round(toNumber(value.totalSeats, ghostSeats || 1)))
  const monthlyWaste = roundCurrency(toNumber(value.monthlyWaste, toNumber(value.monthly_cost, 0)))
  const monthlyCost = roundCurrency(toNumber(value.monthlyCost, monthlyWaste))
  const perSeatCost = ghostSeats > 0
    ? roundCurrency(toNumber(value.perSeatCost, monthlyWaste / ghostSeats))
    : roundCurrency(toNumber(value.perSeatCost, monthlyCost))

  return {
    vendor,
    normalizedName: toString(value.normalizedName, normalizeName(vendor)),
    monthlyCost,
    perSeatCost,
    totalSeats,
    activeSeats: Math.max(0, Math.round(toNumber(value.activeSeats, totalSeats - ghostSeats))),
    ghostSeats,
    monthlyWaste,
    inactiveUsers,
  }
}

function normalizeDuplicateVendor(value: unknown): DuplicateFinding['vendors'][number] | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return {
      name: value,
      normalizedName: normalizeName(value),
      monthlyCost: 0,
    }
  }

  if (!isRecord(value)) {
    return null
  }

  const name = toString(value.name)
  if (!name) {
    return null
  }

  return {
    name,
    normalizedName: toString(value.normalizedName, normalizeName(name)),
    monthlyCost: roundCurrency(toNumber(value.monthlyCost, 0)),
  }
}

function normalizeDuplicateFinding(value: JsonRecord): DuplicateFinding {
  const baseCombinedCost = roundCurrency(
    toNumber(value.combinedMonthlyCost, toNumber(value.monthly_cost, toNumber(value.potentialSavings, 0)))
  )

  let vendors = Array.isArray(value.vendors)
    ? value.vendors.map(normalizeDuplicateVendor).filter((vendor): vendor is DuplicateFinding['vendors'][number] => vendor !== null)
    : []

  if (vendors.length > 0 && vendors.every((vendor) => vendor.monthlyCost === 0) && baseCombinedCost > 0) {
    const distributedCost = roundCurrency(baseCombinedCost / vendors.length)
    vendors = vendors.map((vendor) => ({
      ...vendor,
      monthlyCost: distributedCost,
    }))
  }

  const combinedMonthlyCost = roundCurrency(
    toNumber(value.combinedMonthlyCost, baseCombinedCost || vendors.reduce((sum, vendor) => sum + vendor.monthlyCost, 0))
  )
  const potentialSavings = roundCurrency(
    toNumber(value.potentialSavings, combinedMonthlyCost)
  )
  const vendorNames = vendors.map((vendor) => vendor.name).join(' and ')
  const category = toString(value.category, 'Overlapping subscriptions')

  return {
    category,
    vendors,
    combinedMonthlyCost,
    potentialSavings,
    recommendation: toString(
      value.recommendation,
      toString(
        value.note,
        vendorNames
          ? `Consider consolidating ${vendorNames} to reduce overlapping spend.`
          : 'Consider consolidating overlapping subscriptions to reduce spend.'
      )
    ),
  }
}

export function normalizeGhostSeatFindings(value: unknown): GhostSeatFinding[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map(normalizeGhostSeatFinding)
    .sort((left, right) => right.monthlyWaste - left.monthlyWaste)
}

export function normalizeDuplicateFindings(value: unknown): DuplicateFinding[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map(normalizeDuplicateFinding)
    .sort((left, right) => right.potentialSavings - left.potentialSavings)
}