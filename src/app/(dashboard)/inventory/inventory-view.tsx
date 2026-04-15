'use client'

import { useState, useMemo } from 'react'
import { VendorFilters, type StatusFilter } from '@/components/dashboard/vendor-filters'
import { VendorTable } from '@/components/dashboard/vendor-table'
import type { VendorRow } from '@/lib/types'

export function InventoryView({
  vendors,
  totalSpend,
}: {
  vendors: VendorRow[]
  totalSpend: number
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      const matchesSearch = !search || v.name.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = status === 'all' || v.status === status
      return matchesSearch && matchesStatus
    })
  }, [vendors, search, status])

  return (
    <div className="space-y-4">
      <VendorFilters
        searchQuery={search}
        onSearchChange={setSearch}
        statusFilter={status}
        onStatusChange={setStatus}
        totalCount={vendors.length}
        filteredCount={filtered.length}
      />
      <VendorTable vendors={filtered} totalSpend={totalSpend} />
    </div>
  )
}
