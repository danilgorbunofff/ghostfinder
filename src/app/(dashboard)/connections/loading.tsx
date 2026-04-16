import { Card, CardContent, CardHeader } from '@/components/ui/card'

function ConnectionSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border p-4 animate-pulse">
      <div className="h-10 w-10 rounded-xl bg-muted ring-2 ring-muted ring-offset-2 ring-offset-background" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-4 w-12 rounded-full bg-muted" />
        </div>
        <div className="h-3 w-32 rounded bg-muted" />
      </div>
      <div className="h-8 w-8 rounded bg-muted" />
    </div>
  )
}

export default function ConnectionsLoading() {
  return (
    <div className="space-y-5">
      {/* Description */}
      <div className="h-4 w-56 rounded bg-muted animate-pulse" />

      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
            <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-5 w-10 rounded bg-muted animate-pulse" />
              <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Onboarding progress skeleton */}
      <div className="rounded-xl border bg-card p-5 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-3 w-10 rounded bg-muted" />
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="flex-1 mx-4 h-0.5 bg-muted rounded-full" />
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="flex-1 mx-4 h-0.5 bg-muted rounded-full" />
          <div className="h-8 w-8 rounded-full bg-muted" />
        </div>
      </div>

      {/* Bank accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-28 rounded bg-muted animate-pulse" />
            <div className="h-3 w-56 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-9 w-40 rounded bg-muted animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-3">
          <ConnectionSkeleton />
        </CardContent>
      </Card>

      {/* Identity providers */}
      <Card>
        <CardHeader>
          <div className="space-y-1.5">
            <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            <div className="h-3 w-64 rounded bg-muted animate-pulse" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ConnectionSkeleton />
          <ConnectionSkeleton />
        </CardContent>
      </Card>
    </div>
  )
}
