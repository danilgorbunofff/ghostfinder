'use client'

import { useState, useEffect } from 'react'
import { Settings, X, Database, Plug, Timer, Shield, Search } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DevDataTab } from './dev-data-tab'
import { DevConnectionsTab } from './dev-connections-tab'
import { DevCronTab } from './dev-cron-tab'
import { DevAuthTab } from './dev-auth-tab'
import { DevInspectTab } from './dev-inspect-tab'

const STORAGE_KEY = 'ghostfinder-dev-panel'

export default function DevToolsPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<string | number>('data')

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

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-[9999] h-10 w-10 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        title="Dev Tools"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-16 right-4 z-[9998] w-[360px] max-h-[520px] rounded-xl border bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Dev Tools</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">DEV</span>
            </div>
            <button onClick={() => setOpen(false)} className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="shrink-0 mx-2 mt-2">
              <TabsTrigger value="data" className="gap-1 text-[10px] px-1.5">
                <Database className="h-3 w-3" />
                Data
              </TabsTrigger>
              <TabsTrigger value="connections" className="gap-1 text-[10px] px-1.5">
                <Plug className="h-3 w-3" />
                Conn
              </TabsTrigger>
              <TabsTrigger value="cron" className="gap-1 text-[10px] px-1.5">
                <Timer className="h-3 w-3" />
                Cron
              </TabsTrigger>
              <TabsTrigger value="auth" className="gap-1 text-[10px] px-1.5">
                <Shield className="h-3 w-3" />
                Auth
              </TabsTrigger>
              <TabsTrigger value="inspect" className="gap-1 text-[10px] px-1.5">
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
