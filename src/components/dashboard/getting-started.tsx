'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, Building2, Shield, Scan, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface GettingStartedProps {
  hasBankConnection: boolean
  hasIdentityProvider: boolean
  hasWasteReport: boolean
}

export function GettingStarted({
  hasBankConnection,
  hasIdentityProvider,
  hasWasteReport,
}: GettingStartedProps) {
  const steps = [
    {
      label: 'Connect a bank account',
      description: 'Link your company card or bank to discover SaaS charges automatically.',
      done: hasBankConnection,
      href: '/connections',
      icon: Building2,
    },
    {
      label: 'Connect an identity provider',
      description: 'Link Okta or Google Workspace to detect unused seats.',
      done: hasIdentityProvider,
      href: '/connections',
      icon: Shield,
    },
    {
      label: 'Generate your first waste report',
      description: 'We\'ll cross-reference financial and usage data to find ghost subscriptions.',
      done: hasWasteReport,
      href: '/reports',
      icon: Scan,
    },
  ]

  const completedCount = steps.filter((s) => s.done).length

  if (completedCount === 3) return null

  return (
    <Card className="border-brand/20 bg-gradient-to-br from-brand-muted to-background">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Get started with GhostFinder</CardTitle>
          <span className="text-xs text-muted-foreground font-medium">
            {completedCount}/3 complete
          </span>
        </div>
        {/* Progress bar */}
        <div className="flex gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < completedCount ? 'bg-brand' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.label}
            className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
              step.done
                ? 'bg-muted/50 border-muted'
                : 'bg-background border-border hover:border-brand/30'
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? 'line-through text-muted-foreground' : ''}`}>
                {step.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
            </div>
            {!step.done && (
              <Button variant="ghost" size="sm" render={<Link href={step.href} />}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
