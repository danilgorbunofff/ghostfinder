export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Description skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-80 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-32 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Bento stats grid skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
        {/* Hero waste card */}
        <div className="lg:col-span-5 lg:row-span-2 rounded-xl border bg-card p-6 min-h-[200px] space-y-4">
          <div className="flex justify-between">
            <div className="space-y-2">
              <div className="h-4 w-28 rounded bg-muted animate-pulse" />
              <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
          </div>
          <div className="mt-auto space-y-2">
            <div className="h-10 w-44 rounded bg-muted animate-pulse" />
            <div className="h-4 w-56 rounded bg-muted animate-pulse" />
            <div className="h-3 w-40 rounded bg-muted animate-pulse" />
          </div>
        </div>

        {/* Spend card */}
        <div className="lg:col-span-4 rounded-xl border bg-card p-5 space-y-4">
          <div className="flex justify-between">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
          </div>
          <div className="h-8 w-36 rounded bg-muted animate-pulse" />
          <div className="h-5 w-40 rounded-full bg-muted animate-pulse" />
        </div>

        {/* Opportunities card */}
        <div className="lg:col-span-3 rounded-xl border bg-card p-5 space-y-4">
          <div className="flex justify-between">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
          </div>
          <div className="h-8 w-12 rounded bg-muted animate-pulse" />
          <div className="h-3 w-36 rounded bg-muted animate-pulse" />
        </div>

        {/* User activity card */}
        <div className="lg:col-span-7 rounded-xl border bg-card p-5 space-y-4">
          <div className="flex justify-between">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
          </div>
          <div className="flex items-end gap-4">
            <div className="h-8 w-24 rounded bg-muted animate-pulse" />
            <div className="flex-1 max-w-xs space-y-1.5">
              <div className="h-2.5 rounded-full bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions skeleton */}
      <div className="flex gap-3">
        <div className="h-8 w-36 rounded-lg bg-muted animate-pulse" />
        <div className="h-8 w-40 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Charts skeleton */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="h-4 w-24 rounded bg-muted animate-pulse mb-4" />
          <div className="h-[200px] rounded-lg bg-muted/50 animate-pulse" />
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="h-4 w-32 rounded bg-muted animate-pulse mb-4" />
          <div className="h-[160px] rounded-lg bg-muted/50 animate-pulse" />
        </div>
      </div>
    </div>
  )
}
