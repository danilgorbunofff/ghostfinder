'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function PageWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div
      key={pathname}
      className="animate-fade-in-up"
    >
      {children}
    </div>
  )
}
