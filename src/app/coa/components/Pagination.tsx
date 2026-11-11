import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '../lib/utils'

// Pagination bar ported from the Partner module's data tables
// (DataTableStyleReference): centered "Records per page" select
// (10/20/50/100/All unless the table offers its own) + first/prev/numbered/
// next/last pager. The app-wide default page size is 100. useCoaTable's
// `pagination` option drives it, and CoaTableCard draws it under the table.
export const DEFAULT_PER_PAGE = 100

export function pageCount(total: number, perPage: number) {
  return perPage === -1 ? 1 : Math.max(1, Math.ceil(total / perPage))
}

// Slice a list to the current page, clamping the page into range.
export function paginate<T>(list: T[], page: number, perPage: number): T[] {
  if (perPage === -1) return list
  const current = Math.min(Math.max(1, page), pageCount(list.length, perPage))
  return list.slice((current - 1) * perPage, current * perPage)
}

// 1 … current-1 current current+1 … last, with ellipses (Partner logic).
function pageNumbers(current: number, totalPages: number): (number | '...')[] {
  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current > 3) pages.push('...')
    for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i++) pages.push(i)
    if (current < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }
  return pages
}

export const DEFAULT_PER_PAGE_OPTIONS: (number | 'all')[] = [10, 20, 50, 100, 'all']

export function PaginationBar({ total, page, onPageChange, perPage, onPerPageChange, options = DEFAULT_PER_PAGE_OPTIONS }: {
  total: number
  page: number
  onPageChange: (p: number) => void
  perPage: number               // -1 = All
  onPerPageChange: (n: number) => void
  /** The "Records per page" choices; 'all' offers All. */
  options?: (number | 'all')[]
}) {
  if (total === 0) return null
  const totalPages = pageCount(total, perPage)
  const current = Math.min(Math.max(1, page), totalPages)

  const ghostBtn = 'inline-flex items-center justify-center h-8 rounded-md text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per Page</span>
        <div className="relative">
          <select
            value={perPage === -1 ? 'all' : String(perPage)}
            onChange={e => { onPerPageChange(e.target.value === 'all' ? -1 : Number(e.target.value)); onPageChange(1) }}
            className="h-9 w-[76px] pl-3.5 pr-7 text-sm text-foreground bg-white border border-border rounded-lg appearance-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 cursor-pointer"
          >
            {options.map(o => (
              <option key={o} value={String(o)}>{o === 'all' ? 'All' : o}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button className={cn(ghostBtn, 'w-8 p-0')} disabled={current === 1} onClick={() => onPageChange(1)} title="First page">
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button className={cn(ghostBtn, 'gap-1 px-2')} disabled={current === 1} onClick={() => onPageChange(Math.max(1, current - 1))}>
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>

        {pageNumbers(current, totalPages).map((p, idx) =>
          p === '...' ? (
            <span key={`dots-${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn('inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-sm transition-colors cursor-pointer',
                current === p ? 'text-white' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}
              style={current === p ? { backgroundColor: 'hsl(var(--primary))', fontWeight: 600 } : undefined}
            >
              {p}
            </button>
          )
        )}

        <button className={cn(ghostBtn, 'gap-1 px-2')} disabled={current === totalPages} onClick={() => onPageChange(Math.min(totalPages, current + 1))}>
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button className={cn(ghostBtn, 'w-8 p-0')} disabled={current === totalPages} onClick={() => onPageChange(totalPages)} title="Last page">
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
