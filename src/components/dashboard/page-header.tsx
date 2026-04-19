'use client'

import { usePathname } from 'next/navigation'
import { UserMenuPopover } from '@/components/dashboard/user-menu-popover'
import Link from 'next/link'
import type { MemberRole } from '@/lib/types'

interface PageHeaderProps {
  userEmail: string
  displayName?: string
  orgName: string
  role: MemberRole
  subscriptionTier?: string | null
  subscriptionStatus?: string | null
}

const pathLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/inventory': 'SaaS Inventory',
  '/connections': 'Connections',
  '/reports': 'Waste Reports',
  '/billing': 'Billing',
  '/settings': 'Settings',
}

export function PageHeader({
  userEmail,
  displayName,
  orgName,
  role,
  subscriptionTier,
  subscriptionStatus,
}: PageHeaderProps) {
  const pathname = usePathname()

  const pageTitle = pathLabels[pathname] ?? 'Dashboard'

  return (
    <header data-testid="page-header" className="relative flex items-center justify-between border-b border-foreground/5 bg-background/70 backdrop-blur-xl px-6 py-3 sticky top-0 z-30 after:absolute after:bottom-0 after:inset-x-0 after:h-[2px] after:bg-gradient-to-r after:from-transparent after:via-brand/40 after:to-transparent">
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
          <Link href="/" className="hover:text-foreground transition-colors">
            {orgName}
          </Link>
          <span className="opacity-40">/</span>
          <span className="text-foreground font-medium">{pageTitle}</span>
        </nav>
        <h1 className="text-xl font-semibold tracking-tight">{pageTitle}</h1>
      </div>

      <UserMenuPopover
        userEmail={userEmail}
        displayName={displayName}
        orgName={orgName}
        role={role}
        subscriptionTier={subscriptionTier}
        subscriptionStatus={subscriptionStatus}
      />
    </header>
  )
}
