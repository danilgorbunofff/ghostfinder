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
import { useState } from 'react'
import type { MemberRole } from '@/lib/types'

interface SidebarNavProps {
  user: { email?: string }
  orgName: string
  role: MemberRole
}

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, iconColor: 'text-brand' },
  { label: 'Inventory', href: '/inventory', icon: Package, iconColor: 'text-violet-500' },
  { label: 'Connections', href: '/connections', icon: Plug, iconColor: 'text-blue-500' },
  { label: 'Reports', href: '/reports', icon: FileBarChart, iconColor: 'text-orange-500' },
  { label: 'Billing', href: '/billing', icon: CreditCard, iconColor: 'text-green-500' },
  { label: 'Settings', href: '/settings', icon: Settings, iconColor: 'text-muted-foreground' },
]

export function SidebarNav({ user, orgName, role }: SidebarNavProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <>
      {/* Sidebar header */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b">
        <div className="rounded-lg bg-foreground p-1.5">
          <Ghost className="h-5 w-5 text-background" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight">GhostFinder</span>
        </div>
      </div>

      {/* Org info */}
      <div className="px-4 py-3">
        <p className="text-sm font-medium truncate">{orgName}</p>
        <p className="text-xs text-muted-foreground capitalize">{role}</p>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-brand-muted text-foreground border-l-2 border-brand ml-0 pl-2.5'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? item.iconColor : ''}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sidebar footer */}
      <div className="border-t p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-brand text-brand-foreground text-[10px] font-semibold">
                {user.email?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              {user.email}
            </span>
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
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 md:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-background">
        {sidebarContent}
      </aside>
    </>
  )
}
