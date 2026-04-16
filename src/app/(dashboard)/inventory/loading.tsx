import { SkeletonTable } from '@/components/ui/skeleton-table'

export default function InventoryLoading() {
  return (
    <div className="space-y-5">
      {/* Description */}
      <div className="h-4 w-72 rounded bg-muted animate-pulse" />

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
            <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-5 w-12 rounded bg-muted animate-pulse" />
              <div className="h-3 w-16 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <div className="h-9 flex-1 max-w-sm rounded-md bg-muted animate-pulse" />
        <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
        <div className="h-8 w-22 rounded-md bg-muted animate-pulse" />
        <div className="ml-auto h-8 w-16 rounded-md bg-muted animate-pulse" />
      </div>

      {/* Table */}
      <SkeletonTable columns={6} rows={8} />
    </div>
  )
}
