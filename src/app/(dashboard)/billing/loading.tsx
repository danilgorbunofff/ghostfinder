export default function BillingLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-72 rounded bg-muted animate-pulse" />

      {/* Toggle skeleton */}
      <div className="flex items-center justify-center gap-3">
        <div className="h-9 w-52 rounded-full bg-muted animate-pulse" />
        <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
      </div>

      {/* Plan cards skeleton */}
      <div className="grid gap-6 md:grid-cols-3 items-start">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`rounded-xl border p-5 space-y-4 animate-pulse ${
              i === 1 ? 'md:scale-[1.03] shadow-lg' : ''
            }`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Accent bar for Monitor & Recovery */}
            {i > 0 && (
              <div className={`h-1 w-full rounded -mt-2 ${
                i === 1 ? 'bg-brand/20' : 'bg-amber-500/20'
              }`} />
            )}
            {/* Icon tile + badge row */}
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-muted" />
              {i > 0 && <div className="h-5 w-24 rounded-full bg-muted" />}
            </div>
            <div className="space-y-2">
              <div className="h-5 w-20 rounded bg-muted" />
              <div className="h-3.5 w-40 rounded bg-muted" />
            </div>
            <div className="h-10 w-24 rounded bg-muted" />
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-md bg-muted" />
                  <div className="h-4 w-36 rounded bg-muted" />
                </div>
              ))}
            </div>
            <div className="h-10 w-full rounded-lg bg-muted mt-2" />
          </div>
        ))}
      </div>

      {/* FAQ skeleton */}
      <div className="rounded-xl border p-5 space-y-4 animate-pulse" style={{ animationDelay: '240ms' }}>
        <div className="h-5 w-52 rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}
