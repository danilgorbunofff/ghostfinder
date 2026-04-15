import { SupabaseClient } from '@supabase/supabase-js'

export interface DuplicateFinding {
  category: string
  vendors: {
    name: string
    normalizedName: string
    monthlyCost: number
  }[]
  combinedMonthlyCost: number
  potentialSavings: number
  recommendation: string
}

/**
 * Curated duplicate subscription category groups.
 *
 * If an organization is paying for multiple vendors in the same category,
 * they likely have redundant subscriptions.
 */
const DUPLICATE_GROUPS: Record<string, {
  label: string
  vendors: string[]
}> = {
  video_conferencing: {
    label: 'Video Conferencing',
    vendors: ['zoom', 'microsoft_teams', 'google_meet', 'webex', 'goto_meeting'],
  },
  project_management: {
    label: 'Project Management',
    vendors: ['asana', 'monday', 'jira', 'linear', 'clickup', 'trello', 'basecamp', 'notion'],
  },
  communication: {
    label: 'Team Communication',
    vendors: ['slack', 'microsoft_teams', 'discord', 'google_chat'],
  },
  cloud_storage: {
    label: 'Cloud Storage',
    vendors: ['dropbox', 'google_drive', 'box', 'onedrive', 'icloud'],
  },
  crm: {
    label: 'CRM',
    vendors: ['salesforce', 'hubspot', 'pipedrive', 'zoho_crm', 'close'],
  },
  email_marketing: {
    label: 'Email Marketing',
    vendors: ['mailchimp', 'sendgrid', 'constant_contact', 'campaign_monitor', 'convertkit'],
  },
  design: {
    label: 'Design Tools',
    vendors: ['figma', 'adobe', 'canva', 'sketch', 'invision'],
  },
  customer_support: {
    label: 'Customer Support',
    vendors: ['zendesk', 'intercom', 'freshdesk', 'helpscout', 'drift'],
  },
  password_management: {
    label: 'Password Management',
    vendors: ['1password', 'lastpass', 'dashlane', 'bitwarden', 'keeper'],
  },
  productivity: {
    label: 'Productivity Suite',
    vendors: ['microsoft', 'google_workspace'],
  },
  documentation: {
    label: 'Documentation',
    vendors: ['notion', 'confluence', 'gitbook', 'slite', 'coda'],
  },
  ci_cd: {
    label: 'CI/CD',
    vendors: ['github', 'gitlab', 'bitbucket', 'circleci', 'jenkins'],
  },
}

/**
 * Detect duplicate/overlapping SaaS subscriptions within an organization.
 */
export async function detectDuplicates(
  adminClient: SupabaseClient,
  orgId: string
): Promise<DuplicateFinding[]> {
  const findings: DuplicateFinding[] = []

  const { data: vendors } = await adminClient
    .from('saas_vendors')
    .select('name, normalized_name, monthly_cost')
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (!vendors || vendors.length === 0) return findings

  const orgVendors = new Map(
    vendors.map((v) => [v.normalized_name, v])
  )

  for (const [, group] of Object.entries(DUPLICATE_GROUPS)) {
    const matchedVendors = group.vendors
      .filter((v) => orgVendors.has(v))
      .map((v) => {
        const vendor = orgVendors.get(v)!
        return {
          name: vendor.name,
          normalizedName: vendor.normalized_name,
          monthlyCost: Number(vendor.monthly_cost ?? 0),
        }
      })

    if (matchedVendors.length < 2) continue

    const combinedCost = matchedVendors.reduce((sum, v) => sum + v.monthlyCost, 0)

    // Potential savings = cost of cheaper vendors if consolidated to the most expensive
    const sorted = [...matchedVendors].sort((a, b) => b.monthlyCost - a.monthlyCost)
    const potentialSavings = sorted.slice(1).reduce((sum, v) => sum + v.monthlyCost, 0)

    const vendorNames = matchedVendors.map((v) => v.name).join(' and ')

    findings.push({
      category: group.label,
      vendors: matchedVendors,
      combinedMonthlyCost: Math.round(combinedCost * 100) / 100,
      potentialSavings: Math.round(potentialSavings * 100) / 100,
      recommendation:
        `Your organization is paying for ${vendorNames} (${group.label}). ` +
        `Consider consolidating to a single platform to save ~$${potentialSavings.toFixed(0)}/month.`,
    })
  }

  return findings.sort((a, b) => b.potentialSavings - a.potentialSavings)
}
