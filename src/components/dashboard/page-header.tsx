'use client'

import { usePathname } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PageHeaderProps {
  userEmail: string
  orgName: string
}

const pathLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/inventory': 'SaaS Inventory',
  '/connections': 'Connections',
  '/reports': 'Waste Reports',
  '/billing': 'Billing',
  '/settings': 'Settings',
}

export function PageHeader({ userEmail, orgName }: PageHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const pageTitle = pathLabels[pathname] ?? 'Dashboard'
  const initials = userEmail
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="relative flex items-center justify-between border-b border-foreground/5 bg-background/70 backdrop-blur-xl px-6 py-3 sticky top-0 z-30 after:absolute after:bottom-0 after:inset-x-0 after:h-[2px] after:bg-gradient-to-r after:from-transparent after:via-brand/40 after:to-transparent">
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

      <DropdownMenu>
        <DropdownMenuTrigger className="relative h-9 w-9 rounded-full focus:outline-none group">
          <div className="absolute inset-0 rounded-full bg-brand/10 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
          <Avatar className="relative h-9 w-9 ring-2 ring-brand/20 group-hover:ring-brand/40 transition-all">
            <AvatarFallback className="bg-gradient-to-br from-brand to-brand-hover text-brand-foreground text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="text-sm font-medium">{userEmail}</p>
            <p className="text-xs text-muted-foreground">{orgName}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/settings" />}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} variant="destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
