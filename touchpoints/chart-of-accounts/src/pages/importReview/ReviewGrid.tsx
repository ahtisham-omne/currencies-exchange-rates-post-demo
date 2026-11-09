import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, X, Check, ChevronDown, AlignJustify, List, GripVertical,
  Upload, SearchX, CheckCircle2, AlertTriangle, Loader2, Copy, RotateCcw, Trash2, MinusCircle,
} from 'lucide-react'
import { Button, EmptyState, Menu, Tooltip } from '../../components/ui'
import { BulkActionBar, type BulkAction } from '../../components/BulkActionBar'
import { PaginationBar, paginate, pageCount, DEFAULT_PER_PAGE } from '../../components/Pagination'
import {
  useColumnWidths, useColumnDragReorder, ResizeHandle, DragGhost, SortIcon, nextSortDir, SEAM_SHADOW_LEFT,
} from '../../components/tableColumns'
import { cn } from '../../lib/utils'
import type { Density } from '../../components/AccountTable'
import { needsDetailsMessage, type ParsedRow } from '../../lib/uploadValidation'
import { templateExamplesMessage } from '../../lib/importTemplate'
import {
  REVIEW_COLUMNS, REVIEW_COLUMN_BY_KEY, REVIEW_COLUMN_ORDER, DEFAULT_COLUMN_WIDTHS,
  ROW_NUM_WIDTH, SELECT_COL_WIDTH, STATUS_COL_WIDTH, ACTIONS_COL_WIDTH,
  MIN_COL_WIDTH, MAX_COL_WIDTH, ROW_HEIGHT_COMFORT, ROW_HEIGHT_CONDENSED, HEADER_BG_OPAQUE,
  isDimensionKey,
  type ColumnKey, type ReviewColumn, type ReviewField, type ReviewRowView,
} from './reviewColumns'
import { filterRows, sortRows, editedFields, errorRowKeys, type ReviewCounts, type ReviewFilter, type SortState } from './reviewDerive'
import { useGridSelection } from './useGridSelection'
import { useCellNavigation } from './useCellNavigation'
import { ReviewRow, type RowMenuAction } from './ReviewRow'

// The Review and fix screen. The toolbar, the bulk bar and the pagination sit
// outside the scroll container, so the search, the filters and the counts stay
// above the grid however far it is scrolled.

/** Shared by every untouched row, so their memo comparison holds. */
const NO_EDITS: Map<ColumnKey, string> = new Map()

export interface ReviewGridProps {
  rows: ReviewRowView[]
  counts: ReviewCounts
  /* The dimensions read out of the account numbers, one column each, after the
     file's own. Empty when the numbers hold none. */
  dimensionColumns: ReviewColumn[]
  /** The rows as parsed, so a cell can say what it used to hold. */
  originals: Map<number, ParsedRow>
  /** Summary accounts a row could sit under: the chart plus this file's own. */
  parentCandidates: { number: string; name: string }[]
  /** The currencies worth offering in bulk: the base first, then any already in use. */
  currencyOptions: string[]
  query: string
  setQuery: (q: string) => void
  filter: ReviewFilter
  setFilter: (f: ReviewFilter) => void
  density: Density
  setDensity: (d: Density) => void
  onEdit: (row: number, field: ReviewField, value: string) => void
  onBulkSet: (rows: number[], field: ReviewField, value: string) => void
  onDeleteRows: (rows: number[]) => void
  onDuplicateRow: (row: number) => void
  onRevertRow: (row: number) => void
  onExcludeRows: (rows: number[]) => void
  /* Rows still saying what the template's examples say. Empty in the usual case,
     which is a file the reader typed over properly. */
  templateExamples: number[]
  onCancelImport: () => void
  /** Set while the import runs, which happens over the grid rather than instead of it. */
  importing: { processed: number; total: number } | null
}

export function ReviewGrid({
  rows, counts, dimensionColumns, originals, parentCandidates, currencyOptions, query, setQuery, filter, setFilter, density, setDensity,
  onEdit, onBulkSet, onDeleteRows, onDuplicateRow, onRevertRow, onExcludeRows, templateExamples, onCancelImport, importing,
}: ReviewGridProps) {
  const [sort, setSort] = useState<SortState | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(DEFAULT_PER_PAGE)
  const [dragOrder, setDragOrder] = useState<ColumnKey[]>(REVIEW_COLUMN_ORDER)
  const [hoveredHeader, setHoveredHeader] = useState<ColumnKey | null>(null)
  const [scrolledX, setScrolledX] = useState(false)
  const [rowMenu, setRowMenu] = useState<{ row: number; x: number; y: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const byKey = useMemo(() => {
    const m = new Map<ColumnKey, ReviewColumn>()
    for (const c of [...REVIEW_COLUMNS, ...dimensionColumns]) m.set(c.key, c)
    return m
  }, [dimensionColumns])

  /* The drag order is reconciled against the real column set rather than kept in
     step with it: a dimension only exists once the mapper has been answered, and
     re-answering it can rename or remove one mid-session. Anything the customer
     has dragged keeps its place, anything new lands at the end. */
  const columns = useMemo(() => {
    const kept = dragOrder.filter(k => byKey.has(k))
    const rest = [...byKey.keys()].filter(k => !kept.includes(k))
    return [...kept, ...rest].map(k => byKey.get(k)!)
  }, [dragOrder, byKey])
  const columnOrder = useMemo(() => columns.map(c => c.key), [columns])
  /* A drag splices against what is on screen, not against the stored order,
     which may not mention the dimension columns yet. */
  const onScreenOrder = useRef(columnOrder)
  onScreenOrder.current = columnOrder

  const { widths, resizing, onResizeStart, resetWidth } = useColumnWidths({
    min: MIN_COL_WIDTH, max: MAX_COL_WIDTH, initial: DEFAULT_COLUMN_WIDTHS,
  })
  const { draggingKey, onHeaderMouseDown, ghostRef, suppressClick } = useColumnDragReorder({
    order: columnOrder,
    setOrder: next => setDragOrder(
      typeof next === 'function' ? next(onScreenOrder.current) as ColumnKey[] : next as ColumnKey[],
    ),
  })

  const visible = useMemo(() => sortRows(filterRows(rows, filter, query), sort), [rows, filter, query, sort])
  const totalPages = pageCount(visible.length, perPage)
  const paged = useMemo(() => paginate(visible, page, perPage), [visible, page, perPage])
  const pageKeys = useMemo(() => paged.map(r => r.row), [paged])

  // A filter or a search that shortens the list can leave the view on a page
  // that no longer exists, which reads as an empty grid rather than a filter.
  useEffect(() => { if (page > totalPages) setPage(1) }, [page, totalPages])

  const selection = useGridSelection(pageKeys)
  const liveKeys = useMemo(() => new Set(rows.map(r => r.row)), [rows])
  useEffect(() => { selection.prune(liveKeys) }, [liveKeys, selection.prune])

  const nav = useCellNavigation({
    pageRowKeys: pageKeys, columns: columnOrder, page, pageCount: totalPages, setPage, enabled: !importing,
  })

  const rowHeight = density === 'condensed' ? ROW_HEIGHT_CONDENSED : ROW_HEIGHT_COMFORT

  const handleSort = (key: ColumnKey) => {
    if (suppressClick()) return
    setSort(prev => {
      const dir = nextSortDir(prev?.key === key ? prev.dir : null)
      return dir ? { key, dir } : null
    })
    setPage(1)
  }

  const handleCommit = useCallback((row: number, key: ColumnKey, value: string, move: 'down' | 'right' | 'left' | 'none') => {
    // Only the file's own columns are editable, so only they can be committed.
    if (!isDimensionKey(key)) onEdit(row, key, value)
    nav.move({ row, key }, move, false)
  }, [onEdit, nav.move])

  const handleRowAction = useCallback((action: RowMenuAction) => {
    if (action.key === 'duplicate') onDuplicateRow(action.row)
    else if (action.key === 'revert') onRevertRow(action.row)
    else onDeleteRows([action.row])
  }, [onDuplicateRow, onRevertRow, onDeleteRows])

  const handleContextMenu = useCallback((row: number, x: number, y: number) => setRowMenu({ row, x, y }), [])

  const focusCell = useCallback((row: number, key: ColumnKey) => nav.setActive({ row, key }), [nav.setActive])
  const editCell = useCallback((row: number, key: ColumnKey) => nav.beginEdit({ row, key }), [nav.beginEdit])

  /* One pass for the whole set rather than one per row per render, so an
     unedited row keeps the same Map identity and React.memo can hold. */
  const editedByRow = useMemo(() => {
    const out = new Map<number, Map<ColumnKey, string>>()
    for (const r of rows) {
      const original = originals.get(r.row)
      if (!original) continue
      const changed = editedFields(original as unknown as Record<string, unknown>, r as unknown as Record<string, unknown>)
      if (changed.size === 0) continue
      const edited = new Map<ColumnKey, string>()
      for (const k of changed) edited.set(k, String((original as unknown as Record<string, unknown>)[k] ?? ''))
      out.set(r.row, edited)
    }
    return out
  }, [rows, originals])

  const errorKeys = useMemo(() => errorRowKeys(rows), [rows])
  const selectedKeys = selection.selectedKeys

  const applyBulk = (field: ReviewField, value: string) => {
    onBulkSet(selectedKeys, field, value)
    selection.clear()
  }
  const bulkActions: BulkAction[] = [
    {
      key: 'exclude', label: 'Exclude rows', icon: MinusCircle, tone: 'warning',
      onClick: () => { onExcludeRows(selectedKeys); selection.clear() },
    },
    {
      key: 'delete', label: 'Delete rows', icon: Trash2, tone: 'destructive',
      onClick: () => { onDeleteRows(selectedKeys); selection.clear() },
    },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-bg-subtle/40">
      {/* Toolbar. Outside the scroll container on purpose: the counts and the
          search are how a long grid is navigated, so they never scroll away. */}
      <div className="shrink-0 bg-white border-b border-border">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="relative w-72 max-w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1) }}
              placeholder="Search accounts…"
              className="input pl-9 pr-8 h-9"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg">
                <X size={14} />
              </button>
            )}
          </div>
          <DensityMenu density={density} setDensity={setDensity} />
        </div>

        {selectedKeys.length > 0 && (
          <BulkActionBar
            count={selectedKeys.length}
            noun="row"
            onClear={selection.clear}
            actions={bulkActions}
            leading={
              <>
                <BulkSetMenu label="Set category" field="type" onPick={applyBulk} />
                <BulkSetMenu label="Set account type" field="glType" onPick={applyBulk} />
                <BulkSetMenu label="Set status" field="status" onPick={applyBulk} />
                <BulkSetMenu label="Set currency" field="currency" onPick={applyBulk} currencies={currencyOptions} />
              </>
            }
          />
        )}

        <div className="flex items-center gap-2 px-4 pb-3">
          <FilterChip active={filter === 'all'} onClick={() => { setFilter('all'); setPage(1) }} label="Show all" count={counts.all} />
          <FilterChip active={filter === 'ready'} onClick={() => { setFilter('ready'); setPage(1) }} label="Ready" count={counts.ready} tone="success" />
          <FilterChip active={filter === 'errors'} onClick={() => { setFilter('errors'); setPage(1) }} label="Errors" count={counts.errors} tone="danger" />
          <FilterChip active={filter === 'warnings'} onClick={() => { setFilter('warnings'); setPage(1) }} label="Warnings" count={counts.warnings} tone="warning" />
          {/* Its own chip, not a slice of the warnings. These rows are correct
              and they import; what they are missing is something no import
              template carries, so it is a to-do rather than a defect. */}
          {counts.needsDetails > 0 && (
            <Tooltip content={needsDetailsMessage(counts.needsDetails)}>
              <span>
                <FilterChip
                  active={filter === 'needsDetails'}
                  onClick={() => { setFilter('needsDetails'); setPage(1) }}
                  label="Needs details"
                  count={counts.needsDetails}
                  tone="info"
                />
              </span>
            </Tooltip>
          )}
          {errorKeys.length > 0 && (
            <Tooltip content="Leaves every row flagged as an error out of this import. The rows stay on screen so they can still be fixed, and the valid rows import either way.">
              <button
                onClick={() => onExcludeRows(errorKeys)}
                className="inline-flex items-center gap-1.5 rounded-full border border-danger-200 bg-danger-50 px-3 h-7 text-xs font-medium text-danger-600 transition-colors hover:bg-danger-100"
              >
                <MinusCircle size={13} />
                Exclude {errorKeys.length} error row{errorKeys.length === 1 ? '' : 's'}
              </button>
            </Tooltip>
          )}
        </div>

        {/* A whole-file notice rather than a flag on each row: nothing is wrong
            with these rows, they are simply not the reader's accounts. */}
        {templateExamples.length > 0 && (
          <div className="flex items-center gap-2.5 border-t border-warning-100 bg-warning-50 px-4 py-2">
            <AlertTriangle size={14} className="shrink-0 text-warning-600" />
            <p className="flex-1 text-xs text-warning-700">{templateExamplesMessage(templateExamples)}</p>
            <button
              onClick={() => onExcludeRows(templateExamples)}
              className="shrink-0 inline-flex h-7 items-center rounded-full border border-warning-500/40 bg-white px-3 text-xs font-medium text-warning-700 transition-colors hover:bg-warning-100"
            >
              Exclude {templateExamples.length === 1 ? 'it' : 'them'}
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        {/* The walkthrough spotlights the dimension columns by unioning the
            cells that make them up, and a row scrolled out of this box still
            reports where it would have been. Marking the box keeps that union
            inside the grid the reader can actually see. */}
        <div
          ref={scrollRef}
          data-walkthrough-clip=""
          onScroll={e => setScrolledX(e.currentTarget.scrollLeft > 0)}
          className="flex-1 min-h-0 overflow-auto scrollbar-thin bg-white"
        >
          <table className="border-separate text-sm" style={{ borderSpacing: 0, tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
            <colgroup>
              <col style={{ width: ROW_NUM_WIDTH }} />
              <col style={{ width: SELECT_COL_WIDTH }} />
              <col style={{ width: STATUS_COL_WIDTH }} />
              {columns.map(c => <col key={c.key} style={{ width: widths[c.key] ?? c.defaultWidth }} />)}
              <col style={{ width: ACTIONS_COL_WIDTH }} />
            </colgroup>
            <thead>
              <tr>
                <HeaderCell pin={{ left: 0 }} density={density} className="text-center">#</HeaderCell>
                <HeaderCell pin={{ left: ROW_NUM_WIDTH }} density={density} className="text-center">
                  <input
                    type="checkbox"
                    checked={selection.allVisibleSelected}
                    ref={el => { if (el) el.indeterminate = !selection.allVisibleSelected && selection.someVisibleSelected }}
                    onChange={selection.toggleVisible}
                    aria-label="Select all rows on this page"
                    className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                  />
                </HeaderCell>
                <HeaderCell pin={{ left: ROW_NUM_WIDTH + SELECT_COL_WIDTH, seam: scrolledX }} density={density}>Result</HeaderCell>
                {columns.map(col => {
                  const key = col.key
                  const dir = sort?.key === key ? sort.dir : null
                  return (
                    <th
                      key={key}
                      data-col-drag-key={key}
                      /* Named for the tour, which is about the columns the
                         reader's own answers added and not about the grid. */
                      data-walkthrough={isDimensionKey(key) ? 'review-dimensions' : undefined}
                      onMouseDown={e => onHeaderMouseDown(e, key)}
                      onMouseEnter={() => setHoveredHeader(key)}
                      onMouseLeave={() => setHoveredHeader(null)}
                      onClick={() => handleSort(key)}
                      title={col.description}
                      className={cn(
                        'group/colheader relative select-none cursor-pointer whitespace-nowrap px-3 text-left align-middle',
                        'sticky top-0 z-20 border-b border-border border-r border-r-border-subtle',
                        density === 'condensed' ? 'h-9' : 'h-11',
                      )}
                      style={{
                        fontSize: 12, fontWeight: 500, color: 'hsl(var(--muted-foreground))', lineHeight: 1.2,
                        // Stuck to the top, so rows pass underneath it; see HEADER_BG_OPAQUE.
                        backgroundColor: HEADER_BG_OPAQUE[
                          draggingKey === key ? 'dragging' : sort?.key === key ? 'sorted' : hoveredHeader === key ? 'hover' : 'plain'
                        ],
                      }}
                    >
                      {draggingKey === key && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
                      <span className="flex items-center gap-1.5">
                        <GripVertical size={12} className="shrink-0 text-fg-subtle/50 opacity-0 transition-opacity group-hover/colheader:opacity-100" />
                        <span className="truncate">{col.label}</span>
                        <SortIcon dir={dir} hovered={hoveredHeader === key} />
                      </span>
                      <ResizeHandle onResizeStart={onResizeStart(key)} onReset={resetWidth(key)} active={resizing === key} />
                    </th>
                  )
                })}
                <HeaderCell pin={{ right: 0 }} density={density} className="text-center">
                  <span className="sr-only">Actions</span>
                </HeaderCell>
              </tr>
            </thead>
            <tbody>
              {paged.map((r, i) => (
                <ReviewRow
                  key={r.row}
                  row={r}
                  position={(page - 1) * perPage + i + 1}
                  columns={columns}
                  widths={widths}
                  rowHeight={rowHeight}
                  query={query}
                  selected={selection.selected.has(r.row)}
                  activeKey={nav.active?.row === r.row ? nav.active.key : null}
                  editingKey={nav.editing?.row === r.row ? nav.editing.key : null}
                  edited={editedByRow.get(r.row) ?? NO_EDITS}
                  zebra={i % 2 === 1}
                  seam={scrolledX}
                  parentCandidates={parentCandidates}
                  onSelect={selection.toggle}
                  onFocusCell={focusCell}
                  onEditCell={editCell}
                  onCommit={handleCommit}
                  onCancelEdit={nav.cancelEdit}
                  onRowAction={handleRowAction}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </tbody>
          </table>
          {paged.length === 0 && (
            <GridEmptyState
              totalRows={rows.length}
              searchActive={!!query.trim()}
              filter={filter}
              onClearSearch={() => setQuery('')}
              onCancel={onCancelImport}
            />
          )}
        </div>

        {visible.length > 0 && (
          <div className="shrink-0 border-t border-border bg-white">
            <PaginationBar total={visible.length} page={page} onPageChange={setPage} perPage={perPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} />
          </div>
        )}

        {importing && <ImportingOverlay processed={importing.processed} total={importing.total} />}
      </div>

      <DragGhost ghostRef={ghostRef} label={draggingKey ? byKey.get(draggingKey as ColumnKey)?.label ?? null : null} />

      {rowMenu && (
        <FloatingRowMenu
          x={rowMenu.x}
          y={rowMenu.y}
          canRevert={editedByRow.has(rowMenu.row)}
          onAction={key => { handleRowAction({ key, row: rowMenu.row }); setRowMenu(null) }}
          onClose={() => setRowMenu(null)}
        />
      )}
    </div>
  )
}

/* One bulk setter. Reads its values off the column table, so a column whose
   options change cannot leave this menu offering the old ones. */
function BulkSetMenu({ label, field, onPick, currencies }: {
  label: string
  field: ReviewField
  onPick: (field: ReviewField, value: string) => void
  currencies?: string[]
}) {
  const options = currencies ?? REVIEW_COLUMN_BY_KEY[field].options ?? []
  return (
    <Menu trigger={
      <button className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2.5 py-1.5 text-xs text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg" style={{ fontWeight: 500 }}>
        {label}
        <ChevronDown size={12} />
      </button>
    }>
      {close => (
        <div className="max-h-64 w-48 overflow-auto scrollbar-thin p-1 -my-1">
          {options.map(o => (
            <button
              key={o}
              onClick={() => { onPick(field, o); close() }}
              className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm text-fg transition-colors hover:bg-bg-subtle"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </Menu>
  )
}

// ── Toolbar pieces ──

function DensityMenu({ density, setDensity }: { density: Density; setDensity: (d: Density) => void }) {
  return (
    <Menu align="right" trigger={
      <button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-medium text-fg shadow-xs transition-colors hover:bg-bg-subtle">
        {density === 'condensed' ? <AlignJustify size={16} className="text-fg-subtle" /> : <List size={16} className="text-fg-subtle" />}
        <span className="hidden md:inline">{density === 'condensed' ? 'Condensed' : 'Comfort'}</span>
        <ChevronDown size={14} className="text-fg-subtle/60" />
      </button>
    }>
      {close => (
        <div className="w-[230px] p-1.5 -my-1">
          {([
            { val: 'condensed' as Density, label: 'Condensed', desc: 'Compact view', Icon: AlignJustify },
            { val: 'comfortable' as Density, label: 'Comfort', desc: 'Spacious view', Icon: List },
          ]).map(o => (
            <button
              key={o.val}
              onClick={() => { setDensity(o.val); close() }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-bg-subtle"
            >
              <o.Icon size={20} className="shrink-0 text-fg-subtle" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-fg">{o.label}</div>
                <div className="text-xs text-fg-muted">{o.desc}</div>
              </div>
              {density === o.val && <Check size={16} className="shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </Menu>
  )
}

export function FilterChip({ active, onClick, label, count, tone }: {
  active: boolean; onClick: () => void; label: string; count: number; tone?: 'success' | 'danger' | 'warning' | 'info'
}) {
  // The active chip is tinted by its own tone, so which slice is being looked at
  // is readable without reading the label.
  const activeChip = tone
    ? { success: 'border-success-500/40 bg-success-50 text-success-700', danger: 'border-danger-500/40 bg-danger-50 text-danger-700', warning: 'border-warning-500/40 bg-warning-50 text-warning-700', info: 'border-info-500/40 bg-info-50 text-info-700' }[tone]
    : 'border-primary/40 bg-primary/5 text-primary'
  const activeBadge = tone
    ? { success: 'text-success-700', danger: 'text-danger-700', warning: 'text-warning-700', info: 'text-info-700' }[tone]
    : 'text-primary'
  return (
    <button onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 h-7 text-xs transition-colors',
      active ? cn(activeChip, 'font-medium') : 'border-border text-fg-muted hover:bg-bg-subtle')}>
      {label}
      <span className={cn('inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-2xs font-semibold tabular-nums',
        active ? cn('bg-white', activeBadge) : 'bg-bg-muted text-fg-muted')}>{count}</span>
    </button>
  )
}

function HeaderCell({ children, pin, density, className }: {
  children: React.ReactNode
  pin: { left?: number; right?: number; seam?: boolean }
  density: Density
  className?: string
}) {
  const style: CSSProperties = {
    position: 'sticky', top: 0, zIndex: 30, fontSize: 12, fontWeight: 500, color: 'hsl(var(--muted-foreground))',
    // Stuck both to the top and to the side, so rows pass under it in two
    // directions at once; see HEADER_BG_OPAQUE.
    backgroundColor: HEADER_BG_OPAQUE.plain,
    ...(pin.left !== undefined ? { left: pin.left } : null),
    ...(pin.right !== undefined ? { right: pin.right } : null),
    boxShadow: pin.seam ? SEAM_SHADOW_LEFT : undefined,
  }
  return (
    <th
      style={style}
      className={cn('whitespace-nowrap px-3 text-left align-middle border-b border-border border-r border-r-border-subtle',
        density === 'condensed' ? 'h-9' : 'h-11', className)}
    >
      {children}
    </th>
  )
}

// ── Empty states ──

function GridEmptyState({ totalRows, searchActive, filter, onClearSearch, onCancel }: {
  totalRows: number; searchActive: boolean; filter: ReviewFilter; onClearSearch: () => void; onCancel: () => void
}) {
  let icon = <Upload size={20} />
  let tone: 'neutral' | 'success' | 'warning' = 'neutral'
  let title = 'No rows to display.'
  let body = ''
  let action: { label: string; onClick: () => void } | null = null

  if (totalRows === 0) {
    title = 'All rows have been removed.'
    body = 'There is nothing left to import.'
    action = { label: 'Cancel import', onClick: onCancel }
  } else if (searchActive) {
    icon = <SearchX size={20} />
    title = 'No rows match your search.'
    body = 'Try a different account number or name.'
    action = { label: 'Clear search', onClick: onClearSearch }
  } else if (filter === 'errors') {
    icon = <CheckCircle2 size={20} />; tone = 'success'
    title = 'No errors.'
    body = 'Every row is ready to import.'
  } else if (filter === 'warnings') {
    icon = <CheckCircle2 size={20} />; tone = 'success'
    title = 'No warnings.'
    body = 'Every row looks good.'
  } else if (filter === 'ready') {
    icon = <AlertTriangle size={20} />; tone = 'warning'
    title = 'No rows are ready yet.'
    body = 'Fix the errors to get your rows ready.'
  } else if (filter === 'needsDetails') {
    icon = <CheckCircle2 size={20} />; tone = 'success'
    title = 'No rows are waiting on details.'
    body = 'Nothing here needs bank or card details.'
  }

  // Inside the grid's own frame, so no second one.
  return (
    <EmptyState
      icon={icon}
      tone={tone}
      title={title}
      description={body || undefined}
      action={action
        ? <Button variant="secondary" size="sm" onClick={action.onClick}>{action.label}</Button>
        : undefined}
    />
  )
}

// ── Right-click menu ──

function FloatingRowMenu({ x, y, canRevert, onAction, onClose }: {
  x: number; y: number; canRevert: boolean
  onAction: (key: 'duplicate' | 'revert' | 'delete') => void
  onClose: () => void
}) {
  useEffect(() => {
    const close = () => onClose()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', close, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', close, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  // Kept inside the viewport: a right-click near the bottom edge would
  // otherwise open a menu nobody can reach.
  const top = Math.min(y, window.innerHeight - 150)
  const left = Math.min(x, window.innerWidth - 190)
  return createPortal(
    <div className="fixed z-[95] w-44 rounded-lg border border-border bg-white p-1 shadow-xl" style={{ top, left }}>
      <MenuRow icon={Copy} label="Duplicate row" onClick={() => onAction('duplicate')} />
      {canRevert && <MenuRow icon={RotateCcw} label="Revert changes" onClick={() => onAction('revert')} />}
      <div className="my-1 h-px bg-border" />
      <MenuRow icon={Trash2} label="Delete row" danger onClick={() => onAction('delete')} />
    </div>,
    document.body,
  )
}

function MenuRow({ icon: Icon, label, onClick, danger }: { icon: typeof Copy; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onMouseDown={e => e.stopPropagation()}
      onClick={onClick}
      className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-bg-subtle', danger ? 'text-danger-600' : 'text-fg')}
    >
      <Icon size={14} className="shrink-0" />
      {label}
    </button>
  )
}

// ── Importing ──

/* The import happens in front of the data being imported. Replacing the grid
   with a spinner made the work look like it was happening somewhere else. */
export function ImportingOverlay({ processed, total }: { processed: number; total: number }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
      <div className="flex flex-col items-center rounded-2xl border border-border bg-white px-10 py-8 text-center" style={{ boxShadow: '0 24px 48px -12px rgba(15,23,42,0.18)' }}>
        <Loader2 size={32} className="mb-4 animate-spin text-primary" />
        <h3 className="text-sm font-semibold text-fg">Importing {total} account{total === 1 ? '' : 's'}…</h3>
        <p className="mt-1 text-[12.5px] tabular-nums text-fg-muted">Importing… {processed} of {total} accounts processed</p>
      </div>
    </div>
  )
}

export { REVIEW_COLUMNS }
