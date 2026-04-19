import { PlaidLinkButton } from '@/components/connections/plaid-link-button'
import { GoCardlessConnectButton } from '@/components/connections/gocardless-connect-button'
import { OktaConnectButton } from '@/components/connections/okta-connect-button'
import { GoogleConnectButton } from '@/components/connections/google-connect-button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, RefreshCw, AlertCircle, Globe, Plus } from 'lucide-react'
import { PlaidLogo, OktaLogo, GoogleLogo, GoCardlessLogo } from '@/components/connections/provider-logos'
import { OnboardingProgress } from '@/components/connections/onboarding-progress'
import { ConnectionStats } from '@/components/connections/connection-stats'
import { getServerOrgContext, isMissingTableError } from '@/lib/supabase/server-org'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connections | GhostFinder',
  description: 'Connect bank accounts and identity providers to discover SaaS usage.',
}

export const dynamic = 'force-dynamic'

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const plaidStatusConfig = {
  active: { label: 'Active', className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-900', ring: 'ring-green-500/40' },
  syncing: { label: 'Syncing', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900', ring: 'ring-amber-500/40' },
  error: { label: 'Error', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900', ring: 'ring-red-500/40' },
  disabled: { label: 'Disabled', className: 'bg-muted text-muted-foreground', ring: 'ring-muted-foreground/20' },
} as const

const gcStatusConfig = {
  pending: { label: 'Pending', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-900', ring: 'ring-blue-500/40' },
  active: { label: 'Active', className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-900', ring: 'ring-green-500/40' },
  syncing: { label: 'Syncing', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900', ring: 'ring-amber-500/40' },
  error: { label: 'Error', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900', ring: 'ring-red-500/40' },
  expired: { label: 'Expired', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900', ring: 'ring-amber-500/40' },
  disabled: { label: 'Disabled', className: 'bg-muted text-muted-foreground', ring: 'ring-muted-foreground/20' },
} as const

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { success, error: urlError } = await searchParams
  const { admin, orgId } = await getServerOrgContext()

  const { data: plaidConnections, error: connectionsError } = await admin
    .from('plaid_connections')
    .select('id, institution_name, status, last_synced_at, error_message')
    .eq('org_id', orgId)

  if (connectionsError) {
    throw new Error(`Failed to load Plaid connections: ${connectionsError.message}`)
  }

  const connections = plaidConnections ?? []

  type GoCardlessConnection = {
    country: string
    error_message: string | null
    expires_at: string | null
    id: string
    institution_name: string
    last_synced_at: string | null
    status: string
  }

  let gcConnections: GoCardlessConnection[] = []

  const { data: rawGcConnections, error: gcConnectionsError } = await admin
    .from('gocardless_connections')
    .select('id, institution_name, country, status, last_synced_at, expires_at, error_message')
    .eq('org_id', orgId)

  if (gcConnectionsError && !isMissingTableError(gcConnectionsError, 'gocardless_connections')) {
    throw new Error(`Failed to load GoCardless connections: ${gcConnectionsError.message}`)
  }

  gcConnections = rawGcConnections ?? []

  const { data: rawIntegrations, error: integrationsError } = await admin
    .from('integration_connections')
    .select('id, provider, is_active, total_users, active_users, inactive_users, last_synced_at, error_message, metadata')
    .eq('org_id', orgId)

  if (integrationsError) {
    throw new Error(`Failed to load integrations: ${integrationsError.message}`)
  }

  const integrations = rawIntegrations ?? []

  const { count: wasteReportCount, error: wasteReportCountError } = await admin
    .from('waste_reports')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if (wasteReportCountError) {
    throw new Error(`Failed to load report count: ${wasteReportCountError.message}`)
  }

  const hasBankConnection = connections.length > 0 || gcConnections.length > 0
  const hasIdentityProvider = integrations.length > 0
  const hasWasteReport = (wasteReportCount ?? 0) > 0

  // Stats
  const totalConnections = connections.length + gcConnections.length + integrations.length
  const totalUsers = integrations.reduce((sum, i) => sum + (i.total_users ?? 0), 0)
  const allSyncDates = [
    ...connections.map(c => c.last_synced_at).filter(Boolean),
    ...gcConnections.map(c => c.last_synced_at).filter(Boolean),
    ...integrations.map(i => i.last_synced_at).filter(Boolean),
  ] as string[]
  const lastSynced = allSyncDates.length > 0
    ? formatTimeAgo(allSyncDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0])
    : null

  // Which identity providers are already connected
  const connectedProviders = new Set(integrations.map(i => i.provider))

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground animate-fade-in-up">
        Connect your bank accounts and identity providers.
      </p>

      {/* Success / error feedback from OAuth callbacks */}
      {success === 'google_connected' && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          Google Workspace connected successfully.
        </div>
      )}
      {urlError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {urlError === 'google_oauth_denied' && 'Google authorization was denied.'}
          {urlError === 'google_callback_failed' && 'Google connection failed — please try again.'}
          {urlError === 'invalid_state' && 'Security check failed — please try again.'}
          {!['google_oauth_denied', 'google_callback_failed', 'invalid_state'].includes(urlError) && 'Connection failed — please try again.'}
        </div>
      )}

      {/* Stats strip */}
      <ConnectionStats
        totalConnections={totalConnections}
        totalUsers={totalUsers}
        lastSynced={lastSynced}
      />

      <OnboardingProgress
        hasBankConnection={hasBankConnection}
        hasIdentityProvider={hasIdentityProvider}
        hasWasteReport={hasWasteReport}
      />

      {/* ─── Bank Accounts ────────────────────────────────────── */}
      <Card className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bank Accounts</CardTitle>
              <CardDescription className="mt-1">
                Connect your company bank or credit card to discover SaaS charges.
              </CardDescription>
            </div>
            {hasBankConnection && (
              <div className="flex gap-2">
                <PlaidLinkButton />
                <GoCardlessConnectButton />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {connections && connections.length > 0 ? (
            <div className="space-y-3">
              {connections.map((conn, idx) => {
                const status = conn.status as keyof typeof plaidStatusConfig
                const cfg = plaidStatusConfig[status] ?? plaidStatusConfig.disabled
                const hasError = !!conn.error_message

                return (
                  <div
                    key={conn.id}
                    className={`card-interactive rounded-xl border p-4 animate-fade-in-up ${
                      hasError ? 'bg-red-500/[0.03] dark:bg-red-500/[0.06]' : ''
                    }`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Logo with status glow ring */}
                      <div className={`shrink-0 rounded-xl ring-2 ring-offset-2 ring-offset-background ${cfg.ring}`}>
                        <PlaidLogo className="h-10 w-10 rounded-xl" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{conn.institution_name}</p>
                          <Badge variant="outline" className={`${cfg.className} text-[10px] shrink-0`}>
                            {status === 'syncing' && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />}
                            {cfg.label}
                          </Badge>
                        </div>

                        {/* Sync info */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <RefreshCw className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {conn.last_synced_at
                              ? `Synced ${formatTimeAgo(conn.last_synced_at)}`
                              : 'Not synced yet'}
                          </span>
                        </div>

                        {/* Error */}
                        {hasError && (
                          <div className="mt-2 flex items-center gap-2">
                            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                            <p className="text-xs text-destructive truncate">{conn.error_message}</p>
                            <Button variant="ghost" size="sm" className="h-6 text-xs shrink-0 text-brand">
                              Reconnect
                            </Button>
                          </div>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" disabled>
                            Disconnect
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}

              {/* GoCardless connections */}
              {gcConnections && gcConnections.map((gc, idx) => {
                const status = gc.status as keyof typeof gcStatusConfig
                const cfg = gcStatusConfig[status] ?? gcStatusConfig.disabled
                const hasError = !!gc.error_message
                const isExpired = status === 'expired'

                return (
                  <div
                    key={gc.id}
                    className={`card-interactive rounded-xl border p-4 animate-fade-in-up ${
                      hasError || isExpired ? 'bg-red-500/[0.03] dark:bg-red-500/[0.06]' : ''
                    }`}
                    style={{ animationDelay: `${(connections.length + idx) * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 rounded-xl ring-2 ring-offset-2 ring-offset-background ${cfg.ring}`}>
                        <GoCardlessLogo className="h-10 w-10 rounded-xl" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{gc.institution_name}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-900">
                            EU
                          </Badge>
                          <Badge variant="outline" className={`${cfg.className} text-[10px] shrink-0`}>
                            {status === 'syncing' && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />}
                            {cfg.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1">
                          <RefreshCw className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {gc.last_synced_at
                              ? `Synced ${formatTimeAgo(gc.last_synced_at)}`
                              : 'Not synced yet'}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground font-mono">{gc.country}</span>
                        </div>

                        {(hasError || isExpired) && (
                          <div className="mt-2 flex items-center gap-2">
                            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                            <p className="text-xs text-destructive truncate">
                              {gc.error_message || 'Bank access expired'}
                            </p>
                            <Button variant="ghost" size="sm" className="h-6 text-xs shrink-0 text-brand">
                              {isExpired ? 'Re-authorize' : 'Reconnect'}
                            </Button>
                          </div>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" disabled>
                            Disconnect
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : gcConnections && gcConnections.length > 0 ? (
            <div className="space-y-3">
              {gcConnections.map((gc, idx) => {
                const status = gc.status as keyof typeof gcStatusConfig
                const cfg = gcStatusConfig[status] ?? gcStatusConfig.disabled
                const hasError = !!gc.error_message
                const isExpired = status === 'expired'

                return (
                  <div
                    key={gc.id}
                    className={`card-interactive rounded-xl border p-4 animate-fade-in-up ${
                      hasError || isExpired ? 'bg-red-500/[0.03] dark:bg-red-500/[0.06]' : ''
                    }`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 rounded-xl ring-2 ring-offset-2 ring-offset-background ${cfg.ring}`}>
                        <GoCardlessLogo className="h-10 w-10 rounded-xl" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{gc.institution_name}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-900">
                            EU
                          </Badge>
                          <Badge variant="outline" className={`${cfg.className} text-[10px] shrink-0`}>
                            {cfg.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1">
                          <RefreshCw className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {gc.last_synced_at
                              ? `Synced ${formatTimeAgo(gc.last_synced_at)}`
                              : 'Not synced yet'}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground font-mono">{gc.country}</span>
                        </div>

                        {(hasError || isExpired) && (
                          <div className="mt-2 flex items-center gap-2">
                            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                            <p className="text-xs text-destructive truncate">
                              {gc.error_message || 'Bank access expired'}
                            </p>
                            <Button variant="ghost" size="sm" className="h-6 text-xs shrink-0 text-brand">
                              {isExpired ? 'Re-authorize' : 'Reconnect'}
                            </Button>
                          </div>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" disabled>
                            Disconnect
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Empty: illustrated CTA */
            <div className="flex flex-col items-center justify-center py-10 animate-fade-in-up">
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-2xl bg-[#111]/5 dark:bg-white/5 blur-2xl" />
                <PlaidLogo className="relative h-16 w-16 rounded-2xl shadow-lg" />
              </div>
              <h3 className="text-sm font-semibold mb-1">Connect a bank account</h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs mb-4">
                Link your corporate card or bank to automatically detect SaaS transactions and spending patterns.
              </p>
              <div className="flex gap-2">
                <PlaidLinkButton />
                <GoCardlessConnectButton />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Identity Providers ───────────────────────────────── */}
      <Card className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <CardHeader>
          <CardTitle>Identity Providers</CardTitle>
          <CardDescription className="mt-1">
            Connect SSO providers to detect user activity and ghost seats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrations && integrations.length > 0 ? (
            <>
              {integrations.map((integration, idx) => {
                const meta = integration.metadata as Record<string, string> | null
                const isOkta = integration.provider === 'okta'
                const providerName = isOkta ? 'Okta' : 'Google Workspace'
                const domain = meta?.domain ?? meta?.orgUrl ?? null
                const hasError = !!integration.error_message
                const activeUsers = integration.active_users ?? 0
                const inactiveUsers = integration.inactive_users ?? 0
                const totalU = integration.total_users ?? 0
                const activePct = totalU > 0 ? (activeUsers / totalU) * 100 : 0

                return (
                  <div
                    key={integration.id}
                    className={`card-interactive rounded-xl border p-4 animate-fade-in-up ${
                      hasError ? 'bg-red-500/[0.03] dark:bg-red-500/[0.06]' : ''
                    }`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Logo with glow ring */}
                      <div className={`shrink-0 rounded-xl ring-2 ring-offset-2 ring-offset-background ${
                        integration.is_active ? 'ring-green-500/40' : 'ring-red-500/40'
                      }`}>
                        {isOkta ? (
                          <OktaLogo className="h-10 w-10 rounded-xl" />
                        ) : (
                          <GoogleLogo className="h-10 w-10 rounded-xl" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{providerName}</p>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${
                            integration.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-900'
                              : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900'
                          }`}>
                            {integration.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        {/* Domain */}
                        {domain && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Globe className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-mono truncate">{domain}</span>
                          </div>
                        )}

                        {/* User breakdown bar */}
                        {totalU > 0 && (
                          <div className="mt-2.5 space-y-1">
                            <div className="h-1.5 w-full max-w-[200px] rounded-full bg-muted overflow-hidden flex">
                              <div
                                className="h-full bg-green-500 rounded-l-full transition-all duration-700"
                                style={{ width: `${activePct}%` }}
                              />
                              <div
                                className="h-full bg-red-400 rounded-r-full transition-all duration-700"
                                style={{ width: `${100 - activePct}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              <span className="text-green-600 dark:text-green-400 font-medium">{activeUsers} active</span>
                              {' · '}
                              <span className="text-red-500 font-medium">{inactiveUsers} inactive</span>
                              {' · '}
                              {totalU} total
                            </p>
                          </div>
                        )}

                        {/* Sync time */}
                        {integration.last_synced_at && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <RefreshCw className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              Synced {formatTimeAgo(integration.last_synced_at)}
                            </span>
                          </div>
                        )}

                        {/* Error */}
                        {hasError && (
                          <div className="mt-2 flex items-center gap-2">
                            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                            <p className="text-xs text-destructive truncate">{integration.error_message}</p>
                            <Button variant="ghost" size="sm" className="h-6 text-xs shrink-0 text-brand">
                              Retry
                            </Button>
                          </div>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" disabled>
                            Disconnect
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}

              {/* Add another provider — dashed tile */}
              {(!connectedProviders.has('okta') || !connectedProviders.has('google_workspace')) && (
                <div className="rounded-xl border border-dashed p-4 flex items-center justify-between animate-fade-in-up">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Add another provider</p>
                  </div>
                  <div className="flex gap-2">
                    {!connectedProviders.has('okta') && <OktaConnectButton />}
                    {!connectedProviders.has('google_workspace') && <GoogleConnectButton />}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Empty: two provider option tiles side-by-side */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in-up">
              <div className="rounded-xl border bg-card p-5 flex flex-col items-center text-center card-interactive">
                <div className="relative mb-3">
                  <div className="absolute inset-0 rounded-2xl bg-[#4285F4]/10 blur-xl" />
                  <GoogleLogo className="relative h-12 w-12 rounded-xl shadow-md" />
                </div>
                <p className="text-sm font-semibold mb-0.5">Google Workspace</p>
                <p className="text-[11px] text-muted-foreground mb-3">SSO & user directory</p>
                <GoogleConnectButton />
              </div>

              <div className="rounded-xl border bg-card p-5 flex flex-col items-center text-center card-interactive">
                <div className="relative mb-3">
                  <div className="absolute inset-0 rounded-2xl bg-[#007DC1]/10 blur-xl" />
                  <OktaLogo className="relative h-12 w-12 rounded-xl shadow-md" />
                </div>
                <p className="text-sm font-semibold mb-0.5">Okta</p>
                <p className="text-[11px] text-muted-foreground mb-3">SSO & user directory</p>
                <OktaConnectButton />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
