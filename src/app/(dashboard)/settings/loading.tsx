import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-48 rounded bg-muted animate-pulse" />
      <div className="flex flex-col md:flex-row gap-6 animate-pulse">
        {/* Tabs skeleton */}
        <div className="md:w-48 md:shrink-0 space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 h-9 px-3">
              <div className="h-4 w-4 rounded bg-muted" />
              <div className={`h-4 rounded bg-muted ${i === 0 ? 'w-14' : i === 1 ? 'w-24' : i === 2 ? 'w-22' : 'w-24'}`} />
            </div>
          ))}
        </div>
        {/* Content skeleton */}
        <Card className="flex-1">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted" />
              <div className="space-y-1.5">
                <div className="h-5 w-20 rounded bg-muted" />
                <div className="h-3.5 w-48 rounded bg-muted" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar row */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted" />
              <div className="space-y-1.5">
                <div className="h-4 w-28 rounded bg-muted" />
                <div className="h-3.5 w-40 rounded bg-muted" />
              </div>
            </div>
            <div className="border-t pt-6 space-y-4">
              {/* Input fields */}
              {[0, 1].map((i) => (
                <div key={i} className="space-y-2 max-w-sm">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-10 w-full rounded-lg bg-muted" />
                </div>
              ))}
              <div className="h-9 w-28 rounded-lg bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
