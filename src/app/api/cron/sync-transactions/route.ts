import { createAdminClient } from '@/lib/supabase/admin'
import { syncTransactions } from '@/lib/services/plaid.service'
import {
  getAccountTransactions,
  extractMerchantName,
} from '@/lib/services/gocardless.service'
import { normalizeVendorName, isSoftwareTransaction } from '@/lib/utils/vendor-normalizer'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const results: { connectionId: string; added: number; errors: string[] }[] = []

  try {
    const { data: connections, error: fetchError } = await admin
      .from('plaid_connections')
      .select('id, org_id, item_id, cursor')
      .eq('status', 'active')

    if (fetchError || !connections) {
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    for (const connection of connections) {
      const connectionResult = { connectionId: connection.id, added: 0, errors: [] as string[] }

      try {
        await admin
          .from('plaid_connections')
          .update({ status: 'syncing' })
          .eq('id', connection.id)

        const { data: accessToken } = await admin.rpc('get_plaid_token', {
          p_connection_id: connection.id,
        })

        if (!accessToken) {
          connectionResult.errors.push('No access token in vault')
          continue
        }

        const { added, removed, nextCursor } = await syncTransactions(
          accessToken,
          connection.cursor
        )

        for (const txn of added) {
          const isSoftware = isSoftwareTransaction(
            txn.merchant_entity_id,
            txn.merchant_name || txn.name,
            txn.personal_finance_category?.primary
          )

          const vendorInfo = txn.merchant_name
            ? normalizeVendorName(txn.merchant_name)
            : { normalizedName: null, displayName: null, category: null }

          await admin.from('transactions').upsert({
            org_id: connection.org_id,
            plaid_connection_id: connection.id,
            plaid_transaction_id: txn.transaction_id,
            vendor: txn.merchant_name || txn.name,
            vendor_normalized: vendorInfo.normalizedName,
            amount: Math.abs(txn.amount),
            currency: txn.iso_currency_code || 'USD',
            date: txn.date,
            mcc_code: txn.merchant_entity_id,
            category: txn.personal_finance_category?.primary,
            description: txn.name,
            is_software: isSoftware,
            pending: txn.pending,
          }, {
            onConflict: 'org_id,plaid_transaction_id',
          })

          if (isSoftware) connectionResult.added++
        }

        for (const removedTxn of removed) {
          await admin
            .from('transactions')
            .delete()
            .eq('org_id', connection.org_id)
            .eq('plaid_transaction_id', removedTxn.transaction_id)
        }

        await admin
          .from('plaid_connections')
          .update({
            cursor: nextCursor,
            status: 'active',
            last_synced_at: new Date().toISOString(),
            error_code: null,
            error_message: null,
          })
          .eq('id', connection.id)

        await recalculateVendorAggregates(admin, connection.org_id)

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        const code = (err as { code?: string }).code
        connectionResult.errors.push(message)
        await admin
          .from('plaid_connections')
          .update({
            status: 'error',
            error_code: code || 'SYNC_ERROR',
            error_message: message,
          })
          .eq('id', connection.id)
      }

      results.push(connectionResult)
    }

    // ─── GoCardless Sync ──────────────────────────────────────────────────────
    const { data: gcConnections, error: gcFetchError } = await admin
      .from('gocardless_connections')
      .select('id, org_id, account_id, cursor, expires_at')
      .eq('status', 'active')

    if (!gcFetchError && gcConnections) {
      for (const gc of gcConnections) {
        const gcResult = { connectionId: gc.id, added: 0, errors: [] as string[] }

        try {
          // Check PSD2 expiry
          if (gc.expires_at && new Date(gc.expires_at) < new Date()) {
            await admin
              .from('gocardless_connections')
              .update({
                status: 'expired',
                error_message: 'Bank access expired — re-authorize required',
              })
              .eq('id', gc.id)
            gcResult.errors.push('Access expired')
            results.push(gcResult)
            continue
          }

          if (!gc.account_id) {
            gcResult.errors.push('No account ID')
            results.push(gcResult)
            continue
          }

          await admin
            .from('gocardless_connections')
            .update({ status: 'syncing' })
            .eq('id', gc.id)

          // Date range: from cursor (or 90 days ago) to today
          const today = new Date().toISOString().split('T')[0]
          const defaultFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]
          const dateFrom = gc.cursor || defaultFrom

          const { booked } = await getAccountTransactions(gc.account_id, dateFrom, today)

          for (const txn of booked) {
            const merchantName = extractMerchantName(txn)
            const isSoftware = isSoftwareTransaction(
              txn.merchantCategoryCode || null,
              merchantName,
              null
            )

            const vendorInfo = merchantName
              ? normalizeVendorName(merchantName)
              : { normalizedName: null, displayName: null, category: null }

            const amount = Math.abs(parseFloat(txn.transactionAmount.amount))

            await admin.from('transactions').upsert({
              org_id: gc.org_id,
              source: 'gocardless',
              gocardless_connection_id: gc.id,
              gocardless_transaction_id: txn.transactionId,
              vendor: merchantName,
              vendor_normalized: vendorInfo.normalizedName,
              amount,
              currency: txn.transactionAmount.currency || 'EUR',
              date: txn.bookingDate,
              mcc_code: txn.merchantCategoryCode || null,
              category: null,
              description: txn.remittanceInformationUnstructured || null,
              is_software: isSoftware,
              pending: false,
            }, {
              onConflict: 'org_id,gocardless_transaction_id',
            })

            if (isSoftware) gcResult.added++
          }

          await admin
            .from('gocardless_connections')
            .update({
              cursor: today,
              status: 'active',
              last_synced_at: new Date().toISOString(),
              error_code: null,
              error_message: null,
            })
            .eq('id', gc.id)

          await recalculateVendorAggregates(admin, gc.org_id)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          const code = (err as { code?: string }).code
          gcResult.errors.push(message)
          await admin
            .from('gocardless_connections')
            .update({
              status: 'error',
              error_code: code || 'SYNC_ERROR',
              error_message: message,
            })
            .eq('id', gc.id)
        }

        results.push(gcResult)
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Transaction sync cron failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function recalculateVendorAggregates(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string
) {
  const { data: vendorStats } = await admin
    .from('transactions')
    .select('vendor_normalized, vendor, amount, date')
    .eq('org_id', orgId)
    .eq('is_software', true)
    .not('vendor_normalized', 'is', null)
    .order('date', { ascending: true })

  if (!vendorStats || vendorStats.length === 0) return

  const grouped: Record<string, typeof vendorStats> = {}
  for (const txn of vendorStats) {
    const key = txn.vendor_normalized!
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(txn)
  }

  for (const [normalizedName, transactions] of Object.entries(grouped)) {
    const totalSpend = transactions.reduce((sum, t) => sum + Number(t.amount), 0)
    const months = new Set(
      transactions.map((t) => t.date.substring(0, 7))
    ).size || 1
    const monthlyCost = totalSpend / months

    const vendorInfo = normalizeVendorName(transactions[0].vendor || normalizedName)
    const dates = transactions.map((t) => t.date).sort()

    await admin.from('saas_vendors').upsert({
      org_id: orgId,
      name: vendorInfo.displayName,
      normalized_name: normalizedName,
      monthly_cost: Math.round(monthlyCost * 100) / 100,
      annual_cost: Math.round(monthlyCost * 12 * 100) / 100,
      category: vendorInfo.category,
      first_seen: dates[0],
      last_seen: dates[dates.length - 1],
      transaction_count: transactions.length,
      is_active: true,
    }, {
      onConflict: 'org_id,normalized_name',
    })
  }
}
