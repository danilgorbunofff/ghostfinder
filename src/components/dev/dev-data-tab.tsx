'use client'

import { Button } from '@/components/ui/button'
import { Loader2, Database, Shuffle, RotateCcw } from 'lucide-react'
import { useDevAction } from './use-dev-action'
import { toast } from 'sonner'
import { useState } from 'react'

const TABLES = [
  'transactions', 'saas_vendors', 'plaid_connections',
  'integration_connections', 'user_activity', 'waste_reports',
  'notification_log',
]

export function DevDataTab() {
  const { run, loading } = useDevAction()
  const [txnCount, setTxnCount] = useState(20)

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Seed</h4>
        <div className="space-y-1.5">
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-2 h-7 text-xs"
            disabled={loading === 'seed-data'}
            onClick={async () => {
              const r = await run({ action: 'seed-data' })
              if (r) toast.success(r.message)
            }}
          >
            {loading === 'seed-data' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
            Seed Full Demo Data
          </Button>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 justify-start gap-2 h-7 text-xs"
              disabled={loading === 'generate-transactions'}
              onClick={async () => {
                const r = await run({ action: 'generate-transactions', count: txnCount })
                if (r) toast.success(r.message)
              }}
            >
              {loading === 'generate-transactions' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shuffle className="h-3 w-3" />}
              Generate Transactions
            </Button>
            <input
              type="number"
              min={1}
              max={500}
              value={txnCount}
              onChange={e => setTxnCount(Number(e.target.value))}
              className="w-14 h-7 rounded border bg-background px-1.5 text-xs text-center"
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reset</h4>
        <div className="space-y-1.5">
          <Button
            size="sm"
            variant="destructive"
            className="w-full justify-start gap-2 h-7 text-xs"
            disabled={loading === 'reset-data'}
            onClick={async () => {
              if (!confirm('Delete ALL project data? This clears every bank connection, integration, transaction, vendor, and usage record and resets the subscription to free. This cannot be undone.')) return
              const r = await run({ action: 'reset-data' })
              if (r) toast.success(r.message)
            }}
          >
            {loading === 'reset-data' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Delete All Data (Start Fresh)
          </Button>
          <div className="flex items-center gap-1.5">
            <select
              id="reset-table"
              className="flex-1 h-7 rounded border bg-background px-1.5 text-xs"
              defaultValue={TABLES[0]}
            >
              {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-destructive hover:text-destructive"
              disabled={!!loading}
              onClick={async () => {
                const table = (document.getElementById('reset-table') as HTMLSelectElement).value
                const r = await run({ action: 'reset-table', table })
                if (r) toast.success(r.message)
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
