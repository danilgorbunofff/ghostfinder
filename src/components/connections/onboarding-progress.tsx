import { Check, Building2, Shield, Scan, ArrowRight } from 'lucide-react'

interface OnboardingProgressProps {
  hasBankConnection: boolean
  hasIdentityProvider: boolean
  hasWasteReport: boolean
}

const stepMeta = [
  { label: 'Bank Account', desc: 'Connect a bank or card', icon: Building2 },
  { label: 'Identity Provider', desc: 'Add Google or Okta', icon: Shield },
  { label: 'Run Scan', desc: 'Discover ghost seats', icon: Scan },
]

export function OnboardingProgress({
  hasBankConnection,
  hasIdentityProvider,
  hasWasteReport,
}: OnboardingProgressProps) {
  const doneFlags = [hasBankConnection, hasIdentityProvider, hasWasteReport]
  const completedCount = doneFlags.filter(Boolean).length
  if (completedCount === 3) return null

  // Find next pending step
  const nextIdx = doneFlags.findIndex((d) => !d)
  const nextStep = nextIdx >= 0 ? stepMeta[nextIdx] : null

  return (
    <div className="rounded-xl border bg-card p-5 animate-fade-in-up" data-slot="card" data-testid="onboarding-progress">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold">Setup Progress</p>
        <span className="text-xs text-muted-foreground tabular-nums">{completedCount} of 3</span>
      </div>

      {/* Steps */}
      <div className="relative flex items-start justify-between">
        {/* Background line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted rounded-full" />
        {/* Filled line */}
        <div
          className="absolute top-4 left-4 h-0.5 rounded-full bg-gradient-to-r from-brand to-brand-hover transition-all duration-700 ease-out"
          style={{ width: `calc(${(completedCount / (stepMeta.length - 1)) * 100}% - 32px)` }}
        />

        {stepMeta.map((step, i) => {
          const done = doneFlags[i]
          const isCurrent = i === nextIdx
          return (
            <div key={step.label} className="relative flex flex-col items-center flex-1 z-10">
              {/* Circle */}
              <div
                className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold transition-all duration-300 ${
                  done
                    ? 'bg-gradient-to-br from-brand to-brand-hover text-white shadow-md'
                    : isCurrent
                    ? 'bg-background border-2 border-brand text-brand animate-pulse shadow-sm'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {/* Label */}
              <span className={`text-[11px] font-medium mt-2 text-center leading-tight ${
                done ? 'text-foreground' : isCurrent ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {step.label}
              </span>
              {/* Description */}
              <span className="text-[10px] text-muted-foreground mt-0.5 text-center hidden sm:block">
                {step.desc}
              </span>
            </div>
          )
        })}
      </div>

      {/* Next step CTA */}
      {nextStep && (
        <div className="mt-4 pt-3 border-t flex items-center gap-2 text-xs text-brand font-medium">
          <span>Next: {nextStep.desc}</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </div>
  )
}
