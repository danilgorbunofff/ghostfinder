// ─── Database Row Types ─────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  created_at: string
}

// ─── Dashboard Types ────────────────────────────────────────────────────────

export interface DashboardStats {
  totalSpend: number
  estimatedWaste: number
  opportunities: number
}

export interface VendorRow {
  name: string
  monthlyCost: number
  seats: number
  lastActivity: string
  status: 'active' | 'inactive' | 'warning'
  category: string | null
}

// ─── Integration Types (used in Phases 2-5) ────────────────────────────────

export type IntegrationProvider = 'okta' | 'google_workspace' | 'slack' | 'azure_ad'

export type ActivityStatus = 'active' | 'inactive' | 'suspended' | 'deprovisioned'

export type SubscriptionPlan = 'free' | 'monitor' | 'recovery'

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer'

// ─── Integration Connection Types ───────────────────────────────────────────

export interface IntegrationConnection {
  id: string
  org_id: string
  provider: IntegrationProvider
  access_token_secret_id: string | null
  refresh_token_secret_id: string | null
  token_expires_at: string | null
  metadata: Record<string, string> | null
  is_active: boolean
  total_users: number
  active_users: number
  inactive_users: number
  last_synced_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface UserActivity {
  id: string
  org_id: string
  integration_connection_id: string | null
  email: string
  display_name: string | null
  provider: string
  last_login: string | null
  status: ActivityStatus
  department: string | null
  title: string | null
  is_admin: boolean
  raw_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ─── Plaid / Financial Types ────────────────────────────────────────────────

export type PlaidConnectionStatus = 'active' | 'syncing' | 'error' | 'disabled'

export interface PlaidConnection {
  id: string
  org_id: string
  access_token_secret_id: string | null
  item_id: string
  institution_name: string
  institution_id: string | null
  status: PlaidConnectionStatus
  cursor: string | null
  last_synced_at: string | null
  error_code: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  org_id: string
  plaid_connection_id: string | null
  plaid_transaction_id: string
  vendor: string | null
  vendor_normalized: string | null
  amount: number
  currency: string
  date: string
  mcc_code: string | null
  category: string | null
  description: string | null
  is_software: boolean
  pending: boolean
  created_at: string
}

export interface SaasVendor {
  id: string
  org_id: string
  name: string
  normalized_name: string
  monthly_cost: number | null
  annual_cost: number | null
  seats_paid: number | null
  category: string | null
  first_seen: string | null
  last_seen: string | null
  transaction_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Billing & Subscription Types ───────────────────────────────────────────

export type SubscriptionTier = 'free' | 'monitor' | 'recovery'
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing'

export interface Subscription {
  id: string
  org_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  tier: SubscriptionTier
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  verified_annual_savings: number
  commission_charged: number
  created_at: string
  updated_at: string
}

// ─── Notification Types ─────────────────────────────────────────────────────

export interface NotificationSettings {
  id: string
  org_id: string
  slack_webhook_url: string | null
  slack_enabled: boolean
  email_enabled: boolean
  email_recipients: string[]
  notify_on_ghost_seats: boolean
  notify_on_duplicates: boolean
  notify_threshold_amount: number
  created_at: string
  updated_at: string
}

export interface NotificationLogEntry {
  id: string
  org_id: string
  report_id: string | null
  channel: 'slack' | 'email'
  status: 'sent' | 'failed' | 'skipped'
  error_message: string | null
  sent_at: string
}
