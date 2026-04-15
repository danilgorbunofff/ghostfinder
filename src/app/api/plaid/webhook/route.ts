import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.text()
  let payload: Record<string, unknown>

  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()
  const webhookType = payload.webhook_type as string
  const webhookCode = payload.webhook_code as string
  const itemId = payload.item_id as string

  console.log(`Plaid webhook: ${webhookType}.${webhookCode} for item ${itemId}`)

  switch (webhookType) {
    case 'TRANSACTIONS': {
      if (['SYNC_UPDATES_AVAILABLE', 'DEFAULT_UPDATE', 'INITIAL_UPDATE'].includes(webhookCode)) {
        await admin
          .from('plaid_connections')
          .update({ status: 'active' })
          .eq('item_id', itemId)
      }
      break
    }

    case 'ITEM': {
      if (webhookCode === 'ERROR') {
        const error = payload.error as Record<string, string> | undefined
        await admin
          .from('plaid_connections')
          .update({
            status: 'error',
            error_code: error?.error_code,
            error_message: error?.error_message,
          })
          .eq('item_id', itemId)
      }

      if (webhookCode === 'PENDING_EXPIRATION') {
        await admin
          .from('plaid_connections')
          .update({
            status: 'error',
            error_code: 'PENDING_EXPIRATION',
            error_message: 'Bank connection will expire soon. User must re-authenticate.',
          })
          .eq('item_id', itemId)
      }
      break
    }

    default:
      console.log(`Unhandled Plaid webhook type: ${webhookType}.${webhookCode}`)
  }

  return NextResponse.json({ received: true })
}
