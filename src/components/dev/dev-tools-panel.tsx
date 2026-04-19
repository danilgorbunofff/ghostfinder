'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2, Database, Loader2, Plug, Search, Settings, Shield, Timer, X } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DevDataTab } from './dev-data-tab'
import { DevConnectionsTab } from './dev-connections-tab'
import { DevCronTab } from './dev-cron-tab'
import { DevAuthTab } from './dev-auth-tab'
import { DevInspectTab } from './dev-inspect-tab'
import { formatDevActionLabel, onDevActionEvent, type DevActionEventDetail } from './dev-tools-events'

const STORAGE_KEY = 'ghostfinder-dev-panel'

function formatEventTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function DevToolsPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<string | number>('data')
  const [latestEvent, setLatestEvent] = useState<DevActionEventDetail | null>(null)

  // Restore persisted panel state after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { open: o, tab: t } = JSON.parse(saved)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage restore
        if (typeof o === 'boolean') setOpen(o)
        if (typeof t === 'string') setTab(t)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ open, tab }))
    } catch { /* ignore */ }
  }, [open, tab])

  useEffect(() => onDevActionEvent((detail) => {
    setLatestEvent(detail)
  }), [])

  const statusTone = latestEvent?.phase === 'failed'
    ? 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-300'
    : latestEvent?.phase === 'succeeded'
      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-300'
      : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300'

  const StatusIcon = latestEvent?.phase === 'failed'
    ? AlertCircle
    : latestEvent?.phase === 'succeeded'
      ? CheckCircle2
      : Loader2

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-[9999] h-10 w-10 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        title="Dev Tools"
        data-testid="dev-tools-toggle"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-16 right-4 z-[9998] w-[360px] max-h-[520px] rounded-xl border bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden" data-testid="dev-tools-panel">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Dev Tools</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">DEV</span>
            </div>
            <button onClick={() => setOpen(false)} className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted transition-colors" data-testid="dev-tools-close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="border-b px-3 py-2 bg-muted/20">
            {latestEvent ? (
              <div className={`rounded-md border px-2 py-1.5 ${statusTone}`}>
                <div className="flex items-start gap-2">
                  <StatusIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${latestEvent.phase === 'started' ? 'animate-spin' : ''}`} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide">
                        {formatDevActionLabel(latestEvent.action)}
                      </span>
                      <span className="text-[9px] text-muted-foreground">{formatEventTime(latestEvent.at)}</span>
                    </div>
                    <p className="text-[10px] leading-snug">{latestEvent.message}</p>
                    {latestEvent.hint && (
                      <p className="text-[9px] leading-snug text-muted-foreground">{latestEvent.hint}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground leading-snug">
                Actions report live status here. Open State to verify counts, auth, and environment.
              </p>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="shrink-0 mx-2 mt-2">
              <TabsTrigger value="data" className="gap-1 text-[10px] px-1.5" data-testid="dev-tab-data">
                <Database className="h-3 w-3" />
                Data
              </TabsTrigger>
              <TabsTrigger value="connections" className="gap-1 text-[10px] px-1.5" data-testid="dev-tab-conn">
                <Plug className="h-3 w-3" />
                Conn
              </TabsTrigger>
              <TabsTrigger value="cron" className="gap-1 text-[10px] px-1.5" data-testid="dev-tab-cron">
                <Timer className="h-3 w-3" />
                Cron
              </TabsTrigger>
              <TabsTrigger value="auth" className="gap-1 text-[10px] px-1.5" data-testid="dev-tab-auth">
                <Shield className="h-3 w-3" />
                Auth
              </TabsTrigger>
              <TabsTrigger value="inspect" className="gap-1 text-[10px] px-1.5" data-testid="dev-tab-state">
                <Search className="h-3 w-3" />
                State
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              <TabsContent value="data">
                <DevDataTab />
              </TabsContent>
              <TabsContent value="connections">
                <DevConnectionsTab />
              </TabsContent>
              <TabsContent value="cron">
                <DevCronTab />
              </TabsContent>
              <TabsContent value="auth">
                <DevAuthTab />
              </TabsContent>
              <TabsContent value="inspect">
                <DevInspectTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </>
  )
}
