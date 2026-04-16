import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { PageHeader } from '@/components/dashboard/page-header'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's org membership
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(id, name)')
    .eq('user_id', user.id)
    .single()

  const orgName = (membership?.organizations as unknown as { id: string; name: string } | null)?.name ?? 'My Org'
  const role = membership?.role ?? 'member'

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
          orgName={orgName}
        />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8">
          <PageWrapper>
            {children}
          </PageWrapper>
        </main>
      </div>
    </div>
  )
}
