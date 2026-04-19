'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Plug,
  FileBarChart,
  CreditCard,
  Settings,
  Ghost,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useState, useEffect } from 'react'
import type { MemberRole } from '@/lib/types'

interface SidebarNavProps {
  user: { email?: string }
  orgName: string
  role: MemberRole
}

const navItems = [
  {
    label: 'Dashboard', href: '/', icon: LayoutDashboard,
    iconColor: 'text-brand', bgColor: 'bg-brand-muted',
    hoverIconColor: 'group-hover/nav:text-brand', hoverBgColor: 'group-hover/nav:bg-brand-muted',
  },
  {
    label: 'Inventory', href: '/inventory', icon: Package,
    iconColor: 'text-violet-500', bgColor: 'bg-violet-500/10',
    hoverIconColor: 'group-hover/nav:text-violet-500', hoverBgColor: 'group-hover/nav:bg-violet-500/10',
  },
  {
    label: 'Connections', href: '/connections', icon: Plug,
    iconColor: 'text-blue-500', bgColor: 'bg-blue-500/10',
    hoverIconColor: 'group-hover/nav:text-blue-500', hoverBgColor: 'group-hover/nav:bg-blue-500/10',
  },
  {
    label: 'Reports', href: '/reports', icon: FileBarChart,
    iconColor: 'text-orange-500', bgColor: 'bg-orange-500/10',
    hoverIconColor: 'group-hover/nav:text-orange-500', hoverBgColor: 'group-hover/nav:bg-orange-500/10',
  },
  {
    label: 'Billing', href: '/billing', icon: CreditCard,
    iconColor: 'text-green-500', bgColor: 'bg-green-500/10',
    hoverIconColor: 'group-hover/nav:text-green-500', hoverBgColor: 'group-hover/nav:bg-green-500/10',
  },
  {
    label: 'Settings', href: '/settings', icon: Settings,
    iconColor: 'text-muted-foreground', bgColor: 'bg-muted',
    hoverIconColor: 'group-hover/nav:text-muted-foreground', hoverBgColor: 'group-hover/nav:bg-muted',
  },
]

export function SidebarNav({ user, orgName, role }: SidebarNavProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const activeIndex = navItems.findIndex(item => isActive(item.href))

  const sidebarContent = (
    <>
      {/* Sidebar header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-foreground/5">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-brand/30 blur-md animate-glow-pulse" />
          <div className="relative rounded-xl bg-foreground p-2 ring-2 ring-brand/30 shadow-lg shadow-brand/10">
            <Ghost className="h-5 w-5 text-background" />
          </div>
        </div>
        <div>
          <span className="text-base font-bold tracking-tight gradient-text">GhostFinder</span>
        </div>
      </div>

      {/* Org info */}
      <div className="px-4 py-3 border-b border-foreground/5">
        <p data-testid="nav-org-name" className="text-sm font-semibold truncate">{orgName}</p>
        <p data-testid="nav-user-role" className="text-[11px] text-muted-foreground capitalize tracking-wide">{role}</p>
      </div>

      <nav className="flex-1 relative px-2 py-2">
        {/* Animated sliding indicator */}
        {/* Each nav link is 44px tall (h-7 icon + py-2 padding) with a 2px space-y-0.5 gap.
            The h-9 (36px) indicator is centered: navPy(8) + index*46 + (44-36)/2 = 12 + index*46 */}
        {activeIndex >= 0 && (
          <div
            className="absolute left-0 w-[3px] h-9 bg-gradient-to-b from-brand to-brand/60 rounded-r-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ top: `${12 + activeIndex * 46}px` }}
          />
        )}

        <div className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase()}`}
                data-active={active ? 'true' : undefined}
                onClick={() => setMobileOpen(false)}
                className={`group/nav flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-brand-muted/80 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                }`}
              >
                <div className={`flex items-center justify-center h-7 w-7 rounded-lg transition-all duration-200 ${
                  active ? item.bgColor : item.hoverBgColor
                }`}>
                  <Icon className={`h-4 w-4 transition-colors duration-200 ${active ? item.iconColor : item.hoverIconColor}`} />
                </div>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Sidebar footer */}
      <div className="border-t border-foreground/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-brand/20 blur-sm" />
              <Avatar className="relative h-8 w-8 ring-2 ring-brand/20">
                <AvatarFallback className="bg-gradient-to-br from-brand to-brand-hover text-brand-foreground text-[11px] font-bold">
                  {user.email?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{user.email?.split('@')[0]}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        data-testid="nav-mobile-toggle"
        className="fixed top-4 left-4 z-[60] lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile sidebar */}
      <aside
        data-testid="sidebar-nav"
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-foreground/5 bg-background/80 backdrop-blur-2xl sidebar-mesh transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="relative z-10 hidden lg:flex w-[264px] flex-col border-r border-foreground/5 bg-background/80 backdrop-blur-2xl sidebar-mesh">
        {sidebarContent}
      </aside>
    </>
  )
}
