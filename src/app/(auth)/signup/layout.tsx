import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Account | GhostFinder',
  description: 'Create a GhostFinder account to start finding unused SaaS subscriptions.',
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
