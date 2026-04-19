'use client'

import { Button } from '@/components/ui/button'
import { Loader2, Play, RefreshCw, FileBarChart, Users } from 'lucide-react'
import { useDevAction } from './use-dev-action'
import { toast } from 'sonner'
import { useState } from 'react'

const JOBS = [
  { id: 'sync-transactions', label: 'Sync Transactions', icon: RefreshCw, description: 'Pull transactions from Plaid connections' },
  { id: 'sync-usage', label: 'Sync Usage', icon: Users, description: 'Pull user activity from Okta/Google' },
  { id: 'generate-reports', label: 'Generate Reports', icon: FileBarChart, description: 'Run ghost seat & duplicate detection' },
]

export function DevCronTab() {
  const { run } = useDevAction()
  const [runningJob, setRunningJob] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { success: boolean; time: string }>>({})

  async function triggerJob(jobId: string) {
    setRunningJob(jobId)
    try {
      const r = await run({ action: 'run-cron', job: jobId })
      if (r) {
        const succeeded = r.success === true
        setResults(prev => ({
          ...prev,
          [jobId]: { success: succeeded, time: new Date().toLocaleTimeString() },
        }))
        if (succeeded) {
          toast.success(`${jobId}: completed`)
        } else {
          toast.error(`${jobId}: failed`)
        }
      }
    } finally {
      setRunningJob(null)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground">
        Trigger cron jobs manually. Uses your CRON_SECRET.
      </p>
      {JOBS.map(job => {
        const Icon = job.icon
        const result = results[job.id]
        const isRunning = runningJob === job.id

        return (
          <div key={job.id} className="rounded-lg border p-2.5 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{job.label}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-1"
                disabled={runningJob !== null}
                onClick={() => triggerJob(job.id)}
              >
                {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Run
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">{job.description}</p>
            {result && (
              <p className={`text-[10px] ${result.success ? 'text-green-500' : 'text-red-500'}`}>
                {result.success ? '✓' : '✗'} Last run: {result.time}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
