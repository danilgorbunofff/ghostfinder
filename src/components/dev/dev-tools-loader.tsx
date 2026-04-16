'use client'

import dynamic from 'next/dynamic'

const DevToolsPanel = dynamic(() => import('./dev-tools-panel'), { ssr: false })

export function DevToolsLoader() {
  if (process.env.NODE_ENV !== 'development') return null
  return <DevToolsPanel />
}
