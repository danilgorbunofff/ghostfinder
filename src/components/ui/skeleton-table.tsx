import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'

export function SkeletonTable({
  columns = 5,
  rows = 5,
}: {
  columns?: number
  rows?: number
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: columns }).map((_, i) => (
            <TableHead key={i}>
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, row) => (
          <TableRow key={row}>
            {Array.from({ length: columns }).map((_, col) => (
              <TableCell key={col}>
                <div
                  className="h-4 rounded bg-muted animate-pulse"
                  style={{ width: `${60 + ((row * columns + col) % 5) * 8}%` }}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
