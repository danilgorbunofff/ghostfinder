import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { PageHeader } from '@/components/dashboard/page-header'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { DevToolsLoader } from '@/components/dev/dev-tools-loader'
import { getServerOrgContext } from '@/lib/supabase/server-org'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, orgName, role, admin, orgId } = await getServerOrgContext()

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('tier, status')
    .eq('org_id', orgId)
    .maybeSingle()

  const displayName: string | undefined =
    user.user_metadata?.full_name ??
    user.user_metadata?.display_name ??
    undefined

  return (
    <div className="relative flex h-screen overflow-hidden">
      {/* Ambient background — brand gradient + dot grid + noise */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-brand-muted/60 via-background to-background" />
      <div className="absolute inset-0 z-0 dashboard-dot-grid" />
      <div className="noise-overlay" />

      <SidebarNav
        user={user}
        orgName={orgName}
        role={role}
      />
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <PageHeader
          userEmail={user.email ?? ''}
          displayName={displayName}
          orgName={orgName}
          role={role}
          subscriptionTier={subscription?.tier ?? null}
          subscriptionStatus={subscription?.status ?? null}
        />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8">
          <PageWrapper>
            {children}
          </PageWrapper>
        </main>
      </div>
      <DevToolsLoader />
    </div>
  )
}
