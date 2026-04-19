'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Shield, Scan, ArrowRight, Ghost, Check, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'

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
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('gf-checklist-collapsed') !== 'true'
  })
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined)

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev
      localStorage.setItem('gf-checklist-collapsed', next ? 'false' : 'true')
      return next
    })
  }

  const steps = [
    {
      label: 'Connect a bank account',
      description: 'Link your company card or bank to discover SaaS charges automatically.',
      done: hasBankConnection,
      href: '/connections',
      icon: Building2,
      testId: 'step-bank-connection',
    },
    {
      label: 'Connect an identity provider',
      description: 'Link Okta or Google Workspace to detect unused seats.',
      done: hasIdentityProvider,
      href: '/connections',
      icon: Shield,
      testId: 'step-identity-provider',
    },
    {
      label: 'Generate your first waste report',
      description: 'Cross-reference financial and usage data to find ghost subscriptions.',
      done: hasWasteReport,
      href: '/reports',
      icon: Scan,
      testId: 'step-waste-report',
    },
  ]

  const completedCount = steps.filter((s) => s.done).length

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [])

  if (completedCount === 3) return null

  return (
    <Card data-testid="getting-started" className="relative overflow-hidden border-0 animate-fade-in-up bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 dark:from-blue-700 dark:via-indigo-700 dark:to-violet-800 shadow-lg shadow-indigo-500/10">
      {/* Ghost watermarks scattered across entire card */}
      <Ghost className="absolute -right-6 -top-6 h-36 w-36 text-white/[0.06] rotate-12 pointer-events-none" />
      <Ghost className="absolute right-24 top-10 h-14 w-14 text-white/[0.04] -rotate-6 pointer-events-none" />
      <Ghost className="absolute left-[40%] top-[60%] h-20 w-20 text-white/[0.03] rotate-[20deg] pointer-events-none" />
      <Ghost className="absolute -left-4 bottom-4 h-24 w-24 text-white/[0.04] -rotate-12 pointer-events-none" />
      <Ghost className="absolute right-[15%] bottom-8 h-10 w-10 text-white/[0.05] rotate-6 pointer-events-none" />

      {/* Header — always visible, clickable to toggle */}
      <button
        onClick={toggleOpen}
        className="relative w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer group/header"
      >
        <div>
          <h3 className="text-lg font-bold text-white">Get started with GhostFinder</h3>
          <p className="text-sm text-white/60 mt-0.5">Complete these steps to unlock full insights</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white/90 bg-white/15 px-3 py-1 rounded-full backdrop-blur-sm">
            {completedCount}/3
          </span>
          <div className={`flex items-center justify-center h-7 w-7 rounded-full bg-white/10 transition-transform duration-300 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
            <ChevronDown className="h-4 w-4 text-white/80" />
          </div>
        </div>
      </button>

      {/* Progress bar */}
      <div className="flex gap-1 px-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-[3px] flex-1 rounded-full transition-all duration-500 ${
              i < completedCount
                ? 'bg-white shadow-sm shadow-white/20'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* Collapsible content */}
      <div
        className="transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden"
        style={{
          maxHeight: isOpen ? (contentHeight ?? 600) : 0,
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div ref={contentRef}>
          <CardContent className="p-6 pt-5 space-y-2.5">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div
                  key={step.label}
                  data-testid={step.testId}
                  className={`group/step flex items-center gap-4 rounded-xl border p-3.5 transition-all duration-200 ${
                    step.done
                      ? 'bg-white/5 border-white/10 opacity-60'
                      : 'bg-white/[0.08] border-white/[0.12] hover:bg-white/[0.12] hover:border-white/20'
                  }`}
                >
                  {/* Step number / check */}
                  <div className={`flex items-center justify-center h-9 w-9 rounded-xl shrink-0 transition-all duration-200 ${
                    step.done
                      ? 'bg-green-400/20 text-green-300'
                      : 'bg-white/15 text-white'
                  }`}>
                    {step.done ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-bold">{index + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.done ? 'line-through text-white/40' : 'text-white'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-white/50 mt-0.5 line-clamp-1">{step.description}</p>
                  </div>

                  {!step.done && (
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={step.href} />}
                      className="shrink-0 gap-1 text-white/70 hover:text-white hover:bg-white/10 opacity-0 group-hover/step:opacity-100 transition-all"
                    >
                      Start
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {step.done && (
                    <Icon className="h-4 w-4 text-white/30 shrink-0" />
                  )}
                </div>
              )
            })}
          </CardContent>
        </div>
      </div>
    </Card>
  )
}
