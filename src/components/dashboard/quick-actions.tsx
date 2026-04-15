import { Button } from '@/components/ui/button'
import { FileBarChart, Plug, Download } from 'lucide-react'
import Link from 'next/link'

interface QuickActionsProps {
  hasReport: boolean
  hasConnections: boolean
}

export function QuickActions({ hasReport, hasConnections }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" size="sm" render={<Link href="/reports" />}>
        <FileBarChart className="mr-2 h-4 w-4 text-orange-500" />
        {hasReport ? 'View latest report' : 'Generate report'}
      </Button>
      {!hasConnections && (
        <Button variant="outline" size="sm" render={<Link href="/connections" />}>
          <Plug className="mr-2 h-4 w-4 text-blue-500" />
          Connect a data source
        </Button>
      )}
      {hasReport && (
        <Button variant="outline" size="sm" disabled>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      )}
    </div>
  )
}
