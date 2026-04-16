import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In | GhostFinder',
  description: 'Sign in to your GhostFinder account.',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
