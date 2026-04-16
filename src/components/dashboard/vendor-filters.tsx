'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Filter, X, LayoutGrid, LayoutList, Download, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export type StatusFilter = 'all' | 'active' | 'warning' | 'inactive'
export type CostRange = 'all' | 'low' | 'mid' | 'high'
export type ViewMode = 'table' | 'grid'

interface VendorFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: StatusFilter
  onStatusChange: (status: StatusFilter) => void
  totalCount: number
  filteredCount: number
  // Enhanced filters
  categories?: string[]
  selectedCategories?: string[]
  onCategoryChange?: (categories: string[]) => void
  costRange?: CostRange
  onCostRangeChange?: (range: CostRange) => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  onExport?: () => void
}

const costRangeLabels: Record<CostRange, string> = {
  all: 'All',
  low: '<$50',
  mid: '$50–$500',
  high: '$500+',
}

export function VendorFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  totalCount,
  filteredCount,
  categories = [],
  selectedCategories = [],
  onCategoryChange,
  costRange = 'all',
  onCostRangeChange,
  viewMode = 'table',
  onViewModeChange,
  onExport,
}: VendorFiltersProps) {
  const hasFilters = searchQuery || statusFilter !== 'all' || selectedCategories.length > 0 || costRange !== 'all'

  function clearAll() {
    onSearchChange('')
    onStatusChange('all')
    onCategoryChange?.([])
    onCostRangeChange?.('all')
  }

  function toggleCategory(cat: string) {
    if (!onCategoryChange) return
    if (selectedCategories.includes(cat)) {
      onCategoryChange(selectedCategories.filter(c => c !== cat))
    } else {
      onCategoryChange([...selectedCategories, cat])
    }
  }

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Main filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-sm group/search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within/search:text-brand" />
            <Input
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 transition-all focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                <Filter className="h-3.5 w-3.5" />
                Status
                {statusFilter !== 'all' && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {statusFilter}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(['all', 'active', 'warning', 'inactive'] as const).map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={statusFilter === s}
                  onClick={() => onStatusChange(s)}
                >
                  {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category filter */}
          {categories.length > 0 && onCategoryChange && (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                  <Tag className="h-3.5 w-3.5" />
                  Category
                  {selectedCategories.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {selectedCategories.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                {categories.map((cat) => (
                  <DropdownMenuCheckboxItem
                    key={cat}
                    checked={selectedCategories.includes(cat)}
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Clear */}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="shrink-0 gap-1 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Right group */}
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {hasFilters
              ? `${filteredCount} of ${totalCount} vendors`
              : `${totalCount} vendors`}
          </p>

          {/* View toggle */}
          {onViewModeChange && (
            <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
              <button
                onClick={() => onViewModeChange('table')}
                className={`flex items-center justify-center h-7 w-7 rounded-md transition-all ${
                  viewMode === 'table'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onViewModeChange('grid')}
                className={`flex items-center justify-center h-7 w-7 rounded-md transition-all ${
                  viewMode === 'grid'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Export */}
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={totalCount === 0}
              className="gap-1.5 shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Cost range pills */}
      {onCostRangeChange && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground mr-1">Cost:</span>
          {(Object.entries(costRangeLabels) as [CostRange, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onCostRangeChange(key)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-all ${
                costRange === key
                  ? 'bg-brand text-brand-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
