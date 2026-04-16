import { Button } from '@/components/ui/button'
import { FileBarChart, Plug, Download, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface QuickActionsProps {
  hasReport: boolean
  hasConnections: boolean
}

export function QuickActions({ hasReport, hasConnections }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-3 animate-fade-in-up [animation-delay:275ms]" data-testid="quick-actions">
      <Button
        variant="outline"
        size="sm"
        render={<Link href="/reports" />}
        className="group/action gap-2 transition-all duration-200 hover:border-orange-300 hover:bg-orange-50/50 dark:hover:border-orange-800 dark:hover:bg-orange-950/30"
      >
        <FileBarChart className="h-4 w-4 text-orange-500 transition-transform group-hover/action:scale-110" />
        {hasReport ? 'View latest report' : 'Generate report'}
        <ArrowRight className="h-3 w-3 opacity-0 -ml-1 group-hover/action:opacity-100 group-hover/action:ml-0 transition-all" />
      </Button>
      {!hasConnections && (
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/connections" />}
          className="group/action gap-2 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
        >
          <Plug className="h-4 w-4 text-blue-500 transition-transform group-hover/action:scale-110" />
          Connect a data source
          <ArrowRight className="h-3 w-3 opacity-0 -ml-1 group-hover/action:opacity-100 group-hover/action:ml-0 transition-all" />
        </Button>
      )}
      {hasReport && (
        <Button variant="outline" size="sm" disabled className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      )}
    </div>
  )
}
