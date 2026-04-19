'use client'

import type { GhostSeatFinding } from '@/lib/reconciliation/ghost-detector'
import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { NotifyButton } from '@/components/reports/notify-button'

const lastLoginFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function severityConfig(daysSinceLogin: number) {
  if (daysSinceLogin === 999 || daysSinceLogin > 180) {
    return {
      badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900',
      label: daysSinceLogin === 999 ? 'Never' : `${daysSinceLogin}d`,
      dot: 'bg-red-500',
    }
  }
  if (daysSinceLogin > 60) {
    return {
      badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border-orange-200 dark:border-orange-900',
      label: `${daysSinceLogin}d`,
      dot: 'bg-orange-500',
    }
  }
  return {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    label: `${daysSinceLogin}d`,
    dot: 'bg-amber-500',
  }
}

function wasteSeverityBorder(users: GhostSeatFinding['inactiveUsers']): string {
  const maxDays = users.reduce((max, u) => {
    const days = u.daysSinceLogin ?? 0
    return days > max ? days : max
  }, 0)
  if (maxDays >= 90) return 'border-l-red-500'
  if (maxDays >= 60) return 'border-l-orange-500'
  return 'border-l-amber-500'
}

const avatarColors = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-blue-600',
]

function getAvatarColor(name: string) {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0)
  return avatarColors[code % avatarColors.length]
}

const PREVIEW_COUNT = 3

export function GhostSeatCard({ finding, index = 0 }: { finding: GhostSeatFinding; index?: number }) {
  const [expanded, setExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number>(0)

  const users = finding.inactiveUsers ?? []
  const previewUsers = users.slice(0, PREVIEW_COUNT)
  const hiddenUsers = users.slice(PREVIEW_COUNT)
  const hiddenCount = hiddenUsers.length
  const vendor = finding.vendor
  const waste = finding.monthlyWaste

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [expanded, users.length])

  return (
    <Card
      className={`card-interactive animate-fade-in-up border-l-4 ${wasteSeverityBorder(users)}`}
      style={{ animationDelay: `${index * 60}ms` }}
      data-testid="ghost-seat-card"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${getAvatarColor(vendor)} flex items-center justify-center shrink-0 shadow-sm`}>
              <span className="text-white text-sm font-bold">
                {vendor.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <CardTitle className="text-base">{vendor}</CardTitle>
              <CardDescription className="mt-0.5">
                {finding.activeSeats} active / {finding.totalSeats} total ·
                <span className="font-medium text-orange-500">
                  {' '}${waste}/mo wasted
                </span>
              </CardDescription>
            </div>
          </div>
          <Badge variant="destructive" className="gap-1.5 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            {finding.ghostSeats} ghost seats
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>User</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Inactive</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewUsers.map((user, i) => {
              const days = user.daysSinceLogin
              const severity = severityConfig(days)
              return (
                <TableRow key={i} className="hover:bg-muted/30 transition-colors border-l-2 border-l-transparent hover:border-l-brand">
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastLogin
                      ? lastLoginFormatter.format(new Date(user.lastLogin))
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${severity.badge} gap-1.5`}>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${severity.dot}`} />
                      {severity.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground text-sm">
                    {user.provider}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {/* Expandable hidden users */}
        {hiddenCount > 0 && (
          <>
            <div
              ref={contentRef}
              style={{
                maxHeight: expanded ? `${contentHeight}px` : '0px',
                opacity: expanded ? 1 : 0,
                transition: 'max-height 400ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease',
                overflow: 'hidden',
              }}
            >
              <Table>
                <TableBody>
                  {hiddenUsers.map((user, i) => {
                    const days = user.daysSinceLogin
                    const severity = severityConfig(days)
                    return (
                      <TableRow key={i} className="hover:bg-muted/30 transition-colors border-l-2 border-l-transparent hover:border-l-brand">
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.lastLogin
                            ? lastLoginFormatter.format(new Date(user.lastLogin))
                            : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${severity.badge} gap-1.5`}>
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${severity.dot}`} />
                            {severity.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground text-sm">
                          {user.provider}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-muted-foreground gap-2"
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Show less' : `Show ${hiddenCount} more users`}
            </Button>
          </>
        )}

        {/* Action bar */}
        <div className="border-t mt-3 pt-3 flex items-center justify-end">
          <NotifyButton
            vendor={vendor}
            ghostSeats={finding.ghostSeats}
            monthlyWaste={waste}
          />
        </div>
      </CardContent>
    </Card>
  )
}
