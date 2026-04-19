'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Settings, Building2, CreditCard, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PopoverRoot, PopoverTrigger, PopoverContent, PopoverClose } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import type { MemberRole } from '@/lib/types'
import { cn } from '@/lib/utils'

interface UserMenuPopoverProps {
  userEmail: string
  displayName?: string
  orgName: string
  role: MemberRole
  subscriptionTier?: string | null
  subscriptionStatus?: string | null
}

const roleLabelMap: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

const roleVariantMap: Record<MemberRole, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
  viewer: 'outline',
}

function tierLabel(tier?: string | null): string {
  if (!tier || tier === 'free') return 'Free'
  if (tier === 'pro') return 'Pro'
  if (tier === 'enterprise') return 'Enterprise'
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

function tierVariant(tier?: string | null): 'default' | 'secondary' | 'outline' {
  if (!tier || tier === 'free') return 'outline'
  if (tier === 'pro') return 'default'
  return 'secondary'
}

function statusWarning(status?: string | null): string | null {
  if (status === 'past_due') return 'Payment past due'
  if (status === 'canceled') return 'Subscription canceled'
  return null
}

export function UserMenuPopover({
  userEmail,
  displayName,
  orgName,
  role,
  subscriptionTier,
  subscriptionStatus,
}: UserMenuPopoverProps) {
  const router = useRouter()
  const supabase = createClient()

  const initials = userEmail.split('@')[0].slice(0, 2).toUpperCase()
  const nameDisplay = displayName || userEmail.split('@')[0]
  const warning = statusWarning(subscriptionStatus)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <PopoverRoot>
      <PopoverTrigger
        data-testid="user-menu-trigger"
        className="relative h-9 w-9 rounded-full focus:outline-none group"
      >
        <div className="absolute inset-0 rounded-full bg-brand/10 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
        <Avatar className="relative h-9 w-9 ring-2 ring-brand/20 group-hover:ring-brand/40 transition-all">
          <AvatarFallback className="bg-gradient-to-br from-brand to-brand-hover text-brand-foreground text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </PopoverTrigger>

      <PopoverContent>
        {/* Header — avatar + identity + role */}
        <div className="flex items-start gap-3 bg-muted/30 px-4 py-3.5 border-b border-foreground/5">
          <Avatar className="h-12 w-12 shrink-0 ring-2 ring-brand/20">
            <AvatarFallback className="bg-gradient-to-br from-brand to-brand-hover text-brand-foreground text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-semibold leading-tight truncate">{nameDisplay}</p>
            <p
              data-testid="header-user-email"
              className="text-xs text-muted-foreground truncate mt-0.5"
            >
              {userEmail}
            </p>
            <div className="mt-1.5">
              <Badge variant={roleVariantMap[role]} className="text-[10px] h-4">
                {roleLabelMap[role]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Org + subscription */}
        <div className="px-4 py-3 border-b border-foreground/5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">{orgName}</span>
            </div>
            <Badge variant={tierVariant(subscriptionTier)} className="text-[10px] h-4 shrink-0">
              {tierLabel(subscriptionTier)}
            </Badge>
          </div>
          {warning && (
            <div className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 shrink-0 text-destructive" />
              <span className="text-xs text-destructive">{warning}</span>
            </div>
          )}
        </div>

        {/* Navigation actions */}
        <div className="p-1.5 border-b border-foreground/5">
          <PopoverClose
            render={
              <Link
                href="/settings"
                className={cn(
                  'flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-sm',
                  'hover:bg-muted/60 transition-colors group/item'
                )}
              />
            }
          >
            <span className="flex items-center gap-2.5">
              <Settings className="h-4 w-4 text-muted-foreground group-hover/item:text-foreground transition-colors" />
              Settings
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover/item:text-muted-foreground transition-colors" />
          </PopoverClose>

        </div>

        {/* Sign out */}
        <div className="p-1.5">
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm',
              'text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors'
            )}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </PopoverContent>
    </PopoverRoot>
  )
}
