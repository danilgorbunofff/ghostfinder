import { createClient } from '@/lib/supabase/server'
import { PlaidLinkButton } from '@/components/connections/plaid-link-button'
import { OktaConnectButton } from '@/components/connections/okta-connect-button'
import { GoogleConnectButton } from '@/components/connections/google-connect-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function ConnectionsPage() {
  const supabase = await createClient()

  const { data: connections } = await supabase
    .from('plaid_connections')
    .select('id, institution_name, status, last_synced_at, error_message')

  const { data: integrations } = await supabase
    .from('integration_connections')
    .select('id, provider, is_active, total_users, active_users, inactive_users, last_synced_at, error_message, metadata')

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Connect your bank accounts and identity providers.
      </p>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bank Accounts</CardTitle>
          <PlaidLinkButton />
        </CardHeader>
        <CardContent>
          {connections && connections.length > 0 ? (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div key={conn.id}
                  className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{conn.institution_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Last synced: {conn.last_synced_at
                        ? formatTimeAgo(conn.last_synced_at)
                        : 'Never'}
                    </p>
                    {conn.error_message && (
                      <p className="text-sm text-red-500">{conn.error_message}</p>
                    )}
                  </div>
                  <Badge variant={conn.status === 'active' ? 'default' : 'destructive'}>
                    {conn.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No bank accounts connected. Click &quot;Connect Bank Account&quot; to get started.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identity Providers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {integrations && integrations.length > 0 ? (
            <div className="space-y-3">
              {integrations.map((integration) => {
                const meta = integration.metadata as Record<string, string> | null
                const label = integration.provider === 'okta'
                  ? `Okta (${meta?.domain ?? meta?.orgUrl ?? 'Connected'})`
                  : `Google Workspace (${meta?.domain ?? 'Connected'})`

                return (
                  <div key={integration.id}
                    className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-muted-foreground">
                        {integration.total_users} users ({integration.inactive_users} inactive)
                        {integration.last_synced_at && (
                          <> &middot; Synced {formatTimeAgo(integration.last_synced_at)}</>
                        )}
                      </p>
                      {integration.error_message && (
                        <p className="text-sm text-red-500">{integration.error_message}</p>
                      )}
                    </div>
                    <Badge variant={integration.is_active ? 'default' : 'destructive'}>
                      {integration.is_active ? 'active' : 'error'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No identity providers connected yet.
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <OktaConnectButton />
            <GoogleConnectButton />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
