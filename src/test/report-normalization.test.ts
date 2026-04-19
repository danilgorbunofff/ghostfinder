import { describe, expect, it } from 'vitest'
import { normalizeDuplicateFindings, normalizeGhostSeatFindings } from '@/lib/reports/normalize-report'

describe('report normalization', () => {
  it('preserves canonical report payloads for rendering', () => {
    const ghostSeats = normalizeGhostSeatFindings([
      {
        vendor: 'Slack',
        normalizedName: 'slack',
        monthlyCost: 875,
        perSeatCost: 25,
        totalSeats: 35,
        activeSeats: 28,
        ghostSeats: 7,
        monthlyWaste: 175,
        inactiveUsers: [
          {
            email: 'carol@demo.co',
            displayName: 'Carol White',
            lastLogin: '2024-01-01T00:00:00.000Z',
            daysSinceLogin: 45,
            provider: 'okta',
          },
        ],
      },
    ])

    const duplicates = normalizeDuplicateFindings([
      {
        category: 'CRM',
        combinedMonthlyCost: 3290,
        potentialSavings: 890,
        recommendation: 'Consolidate to one CRM.',
        vendors: [
          { name: 'Salesforce', normalizedName: 'salesforce', monthlyCost: 2400 },
          { name: 'HubSpot', normalizedName: 'hubspot', monthlyCost: 890 },
        ],
      },
    ])

    expect(ghostSeats[0]).toMatchObject({
      vendor: 'Slack',
      ghostSeats: 7,
      inactiveUsers: [
        expect.objectContaining({ email: 'carol@demo.co', provider: 'okta' }),
      ],
    })
    expect(duplicates[0]).toMatchObject({
      category: 'CRM',
      potentialSavings: 890,
      vendors: [
        expect.objectContaining({ name: 'Salesforce', monthlyCost: 2400 }),
        expect.objectContaining({ name: 'HubSpot', monthlyCost: 890 }),
      ],
    })
  })

  it('coerces legacy dev-seed payloads into a safe renderable shape', () => {
    const ghostSeats = normalizeGhostSeatFindings([
      {
        user: 'carol@demo.co',
        name: 'Carol White',
        tools: ['Slack', 'Figma'],
        monthly_cost: 1735,
        last_login_days: 45,
      },
    ])

    const duplicates = normalizeDuplicateFindings([
      {
        vendors: ['Asana', 'Jira'],
        monthly_cost: 670,
        note: 'Project management overlap',
      },
    ])

    expect(ghostSeats[0]).toMatchObject({
      vendor: 'Slack',
      ghostSeats: 1,
      monthlyWaste: 1735,
      inactiveUsers: [
        expect.objectContaining({
          email: 'carol@demo.co',
          displayName: 'Carol White',
          daysSinceLogin: 45,
          provider: 'seed',
        }),
      ],
    })
    expect(duplicates[0]).toMatchObject({
      category: 'Overlapping subscriptions',
      potentialSavings: 670,
      recommendation: 'Project management overlap',
      vendors: [
        expect.objectContaining({ name: 'Asana' }),
        expect.objectContaining({ name: 'Jira' }),
      ],
    })
    expect(duplicates[0].vendors.every((vendor) => vendor.monthlyCost === 335)).toBe(true)
  })
})