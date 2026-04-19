'use client'

import dynamic from 'next/dynamic'

const DevToolsPanel = dynamic(() => import('./dev-tools-panel'), { ssr: false })

export function DevToolsLoader() {
  if (process.env.NODE_ENV !== 'development') return null
  if (process.env.NEXT_PUBLIC_MOCK_SERVICES !== 'true') return null
  return <DevToolsPanel />
}
