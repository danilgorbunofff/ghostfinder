import type { MemberRole } from '@/lib/types'
import type { User } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createAdminClient } from './admin'
import { ensureOrganization } from './ensure-org'
import { createClient } from './server'

export type ServerOrgContext = {
  admin: ReturnType<typeof createAdminClient>
  orgId: string
  orgName: string
  role: MemberRole
  user: User
}

export async function getServerOrgContext(): Promise<ServerOrgContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { orgId, role } = await ensureOrganization(
    user.id,
    user.email ?? undefined,
    user.user_metadata?.full_name ?? undefined
  )

  const admin = createAdminClient()
  const { data: organization, error } = await admin
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load organization: ${error.message}`)
  }

  return {
    admin,
    orgId,
    orgName: organization?.name ?? 'My Org',
    role,
    user,
  }
}

function getErrorMessage(error: unknown) {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return JSON.stringify(error)
}

export function isMissingTableError(error: unknown, table: string) {
  const message = getErrorMessage(error).toLowerCase()
  const normalizedTable = table.toLowerCase()

  return (
    message.includes(`could not find the table 'public.${normalizedTable}'`) ||
    message.includes(`relation "${normalizedTable}" does not exist`) ||
    (message.includes(normalizedTable) && message.includes('does not exist'))
  )
}