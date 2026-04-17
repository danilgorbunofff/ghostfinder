'use client'

import { useState, useMemo, useSyncExternalStore, useCallback } from 'react'
import { VendorFilters, type StatusFilter, type CostRange, type ViewMode } from '@/components/dashboard/vendor-filters'
import { VendorTable } from '@/components/dashboard/vendor-table'
import { VendorGrid } from '@/components/dashboard/vendor-grid'
import { VendorDrawer } from '@/components/dashboard/vendor-drawer'
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [costRange, setCostRange] = useState<CostRange>('all')
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null)

  // Read persisted view mode from localStorage
  const storageSubscribe = useCallback((cb: () => void) => {
    window.addEventListener('storage', cb)
    return () => window.removeEventListener('storage', cb)
  }, [])
  const savedViewMode = useSyncExternalStore(
    storageSubscribe,
    () => localStorage.getItem('inventory-view-mode'),
    () => null,
  )
  const [viewModeOverride, setViewModeOverride] = useState<ViewMode | null>(null)
  const viewMode = (viewModeOverride ?? (savedViewMode === 'grid' ? 'grid' : 'table')) as ViewMode

  function handleViewModeChange(mode: ViewMode) {
    setViewModeOverride(mode)
    localStorage.setItem('inventory-view-mode', mode)
  }

  // Distinct categories
  const categories = useMemo(() => {
    const cats = new Set<string>()
    vendors.forEach(v => { if (v.category) cats.add(v.category) })
    return Array.from(cats).sort()
  }, [vendors])

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      const matchesSearch = !search || v.name.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = status === 'all' || v.status === status
      const matchesCategory = selectedCategories.length === 0 || (v.category && selectedCategories.includes(v.category))
      let matchesCost = true
      if (costRange === 'low') matchesCost = v.monthlyCost < 50
      else if (costRange === 'mid') matchesCost = v.monthlyCost >= 50 && v.monthlyCost <= 500
      else if (costRange === 'high') matchesCost = v.monthlyCost > 500
      return matchesSearch && matchesStatus && matchesCategory && matchesCost
    })
  }, [vendors, search, status, selectedCategories, costRange])

  const handleExport = useCallback(() => {
    const headers = ['Vendor', 'Monthly Cost', 'Seats', 'Last Activity', 'Status', 'Category']
    const rows = filtered.map(v => [
      v.name,
      v.monthlyCost.toString(),
      v.seats.toString(),
      v.lastActivity,
      v.status,
      v.category ?? '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vendors.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered])

  return (
    <div className="space-y-4">
      <VendorFilters
        searchQuery={search}
        onSearchChange={setSearch}
        statusFilter={status}
        onStatusChange={setStatus}
        totalCount={vendors.length}
        filteredCount={filtered.length}
        categories={categories}
        selectedCategories={selectedCategories}
        onCategoryChange={setSelectedCategories}
        costRange={costRange}
        onCostRangeChange={setCostRange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onExport={handleExport}
      />

      {/* Zero-results state */}
      {filtered.length === 0 && vendors.length > 0 ? (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in-up">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <span className="text-2xl">🔍</span>
          </div>
          <p className="text-sm font-medium">No vendors match your filters</p>
          <button
            onClick={() => { setSearch(''); setStatus('all'); setSelectedCategories([]); setCostRange('all') }}
            className="text-xs text-brand hover:underline mt-1.5"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className={`transition-all duration-300 ${viewMode === 'grid' ? 'opacity-100' : 'opacity-100'}`}>
          {viewMode === 'table' ? (
            <VendorTable
              vendors={filtered}
              totalSpend={totalSpend}
              onVendorClick={setSelectedVendor}
            />
          ) : (
            <VendorGrid
              vendors={filtered}
              totalSpend={totalSpend}
              onVendorClick={setSelectedVendor}
            />
          )}
        </div>
      )}

      {/* Vendor detail drawer */}
      <VendorDrawer
        vendor={selectedVendor}
        totalSpend={totalSpend}
        onClose={() => setSelectedVendor(null)}
      />
    </div>
  )
}
