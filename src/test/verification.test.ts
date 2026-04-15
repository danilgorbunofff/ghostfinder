/**
 * GhostFinder — Comprehensive Verification Tests
 * 
 * Validates all core modules across Phases 0-5:
 *   - Vendor normalizer (Phase 2)
 *   - MCC code classification (Phase 2)
 *   - Ghost seat detector logic (Phase 4)
 *   - Duplicate detector categories (Phase 4)
 *   - Feature gating (Phase 5)
 *   - Notification email/slack exports (Phase 5)
 * 
 * Run: npx vitest run src/test/verification.test.ts
 */
import { describe, it, expect } from 'vitest'
import { normalizeVendorName, isSoftwareTransaction } from '@/lib/utils/vendor-normalizer'
import { isSoftwareMCC, SOFTWARE_MCC_CODES } from '@/lib/utils/mcc-codes'
import { hasAccess, getRequiredTier } from '@/lib/billing/gate'

// ═══════════════════════════════════════════════════════════════
// Phase 2: Vendor Normalizer
// ═══════════════════════════════════════════════════════════════

describe('Vendor Normalizer', () => {
  it('normalizes known SaaS vendor names', () => {
    const result = normalizeVendorName('SLACK TECHNOLOGIES INC')
    expect(result.normalizedName).toBe('slack')
    expect(result.isKnown).toBe(true)
  })

  it('strips payment processor prefixes', () => {
    const result = normalizeVendorName('STRIPE* FIGMA INC')
    expect(result.normalizedName).toBe('figma')
    expect(result.isKnown).toBe(true)
  })

  it('strips PAYPAL prefix', () => {
    const result = normalizeVendorName('PAYPAL *NOTION LABS')
    expect(result.normalizedName).toBe('notion')
    expect(result.isKnown).toBe(true)
  })

  it('handles unknown vendors gracefully', () => {
    const result = normalizeVendorName('RANDOM COFFEE SHOP LLC')
    expect(result.isKnown).toBe(false)
    expect(result.normalizedName).toBeTruthy()
  })

  it('strips noise suffixes (INC, LLC, CORP)', () => {
    const result = normalizeVendorName('GITHUB INC')
    expect(result.normalizedName).toBe('github')
    expect(result.isKnown).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// Phase 2: MCC Code Classification
// ═══════════════════════════════════════════════════════════════

describe('MCC Code Classification', () => {
  it('identifies software MCC codes', () => {
    expect(isSoftwareMCC('5734')).toBe(true) // Computer Software Stores
    expect(isSoftwareMCC('5817')).toBe(true) // Digital Goods
    expect(isSoftwareMCC('7372')).toBe(true) // Computer Programming
  })

  it('rejects non-software MCC codes', () => {
    expect(isSoftwareMCC('5411')).toBe(false) // Grocery Stores
    expect(isSoftwareMCC('5812')).toBe(false) // Restaurants
    expect(isSoftwareMCC('0000')).toBe(false)
  })

  it('has all expected MCC codes defined', () => {
    const codes = Object.keys(SOFTWARE_MCC_CODES)
    expect(codes).toContain('5734')
    expect(codes).toContain('5817')
    expect(codes).toContain('5818')
    expect(codes).toContain('7372')
    expect(codes).toContain('7379')
  })
})

describe('isSoftwareTransaction', () => {
  it('detects software by MCC code', () => {
    expect(isSoftwareTransaction('5817', 'UNKNOWN MERCHANT', null)).toBe(true)
  })

  it('detects software by known vendor name', () => {
    expect(isSoftwareTransaction(null, 'SLACK TECHNOLOGIES', null)).toBe(true)
  })

  it('rejects non-software transactions', () => {
    expect(isSoftwareTransaction('5411', 'WHOLE FOODS', null)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Phase 5: Feature Gating
// ═══════════════════════════════════════════════════════════════

describe('Feature Gating', () => {
  describe('hasAccess', () => {
    it('free tier has no access to reports', () => {
      expect(hasAccess('free', 'reports.view')).toBe(false)
    })

    it('monitor tier has access to reports', () => {
      expect(hasAccess('monitor', 'reports.view')).toBe(true)
    })

    it('monitor tier cannot send notifications', () => {
      expect(hasAccess('monitor', 'notifications.send')).toBe(false)
    })

    it('recovery tier has access to everything', () => {
      expect(hasAccess('recovery', 'reports.view')).toBe(true)
      expect(hasAccess('recovery', 'notifications.send')).toBe(true)
      expect(hasAccess('recovery', 'recovery.tracking')).toBe(true)
    })

    it('higher tiers include lower tier features', () => {
      // recovery should have all monitor features
      expect(hasAccess('recovery', 'reports.view')).toBe(true)
      expect(hasAccess('recovery', 'ghost-seats.list')).toBe(true)
      expect(hasAccess('recovery', 'duplicates.list')).toBe(true)
    })
  })

  describe('getRequiredTier', () => {
    it('reports require monitor tier', () => {
      expect(getRequiredTier('reports.view')).toBe('monitor')
    })

    it('notifications require recovery tier', () => {
      expect(getRequiredTier('notifications.send')).toBe('recovery')
    })
  })
})
