import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-4 rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-32 rounded bg-muted mb-2" />
            <div className="h-3 w-40 rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
