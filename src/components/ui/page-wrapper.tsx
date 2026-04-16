'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

export function PageWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(false)
    // Trigger animation on next frame
    const frame = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        show
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
      }`}
    >
      {children}
    </div>
  )
}
