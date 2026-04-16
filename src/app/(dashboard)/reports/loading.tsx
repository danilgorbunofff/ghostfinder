export default function ReportsLoading() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="h-5 w-80 rounded bg-muted animate-pulse" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-[260px] rounded-md bg-muted animate-pulse" />
          <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
        </div>
      </div>

      {/* Waste banner skeleton */}
      <div className="rounded-xl border bg-gradient-to-br from-orange-500/[0.04] via-transparent to-transparent p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-3">
            <div className="h-4 w-48 rounded bg-muted animate-pulse" />
            <div className="h-12 w-52 rounded bg-muted animate-pulse" />
            <div className="h-7 w-64 rounded-lg bg-muted animate-pulse" />
          </div>
          <div className="flex gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl border p-3 min-w-[90px] space-y-2 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="h-4 w-4 rounded bg-muted mx-auto" />
                <div className="h-6 w-10 rounded bg-muted mx-auto" />
                <div className="h-2.5 w-14 rounded bg-muted mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab skeleton */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="h-9 w-36 rounded bg-muted animate-pulse" />
          <div className="h-9 w-32 rounded bg-muted animate-pulse" />
        </div>

        {/* Card skeletons */}
        {[0, 1].map(i => (
          <div key={i} className="rounded-xl border border-l-4 border-l-muted p-5 space-y-4 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3.5 w-48 rounded bg-muted" />
                </div>
              </div>
              <div className="h-6 w-24 rounded-full bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-8 w-full rounded bg-muted" />
              <div className="h-8 w-full rounded bg-muted" />
              <div className="h-8 w-full rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
