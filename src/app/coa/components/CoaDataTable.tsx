// Ported from chart-of-accounts-v2.1/src/components/AccountTable.tsx (AccountTree / TreeNode / HeaderCell / Th / ResizeHandle / useColumnWidths / leftPinStyle / rightPinStyle / filler constants / Z tiers) and src/pages/ChartOfAccounts.tsx (search, reveal, selection and column state wiring); adapted: generic over the row type and column definitions instead of welded to Account - a flat list with optional pinned rows, expandable rows and block windowing.
import {
  createContext, Fragment, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, GripVertical, Info, MoreHorizontal } from 'lucide-react'
import { cn } from '../lib/utils'
import { useRememberedState, useStoredState } from '../lib/rememberedState'
import { searchMatcher } from '../lib/tableSearch'
import { BLOCK_SIZE } from '../lib/blockWindow'
import { useBlockWindow } from './useBlockWindow'
import { Menu, Tooltip } from './ui'
import { GridComfort, PERSON_PAD } from './AuditCells'
import { blankFilter, filterActive, HeaderMenu, matchColFilter, type ColFilter, type ColFilters, type ColFilterType } from './columnFilters'
import { DragBar, DragGhost, draggedHeaderStyle, useColumnDragReorder } from './tableColumns'
import { lookSections, rowNumberGutter, useCrosshair, useTableLook, type ColumnSizing, type Density } from './tableLook'
import { orderWithRevealed, useSearchReveal } from './SearchReveal'
import { ExpandToggle, LEAF_LEAD } from './cells'
import { pageCount, paginate } from './Pagination'

/* ── Column definitions ───────────────────────────────────────────────────── */

/** What a cell renderer is told about its row. */
export interface CellCtx {
  /** The table search, to mark with <Marked>. */
  q: string
  /** Comfort density, for the person cells. */
  comfort: boolean
  selected: boolean
  /** A pinned special row (base currency, banner row): CoA's category-band fill. */
  band: boolean
  expanded: boolean
  toggleExpand: () => void
  /** The row's open action, for the primary cell's keyboard button. */
  openRow?: () => void
}

export interface CoaColumn<T> {
  key: string
  /** Sentence case, never uppercase ("Linked transactions"). */
  label: string
  /** The header's info icon: a plain-English one-liner. */
  info?: string
  infoRich?: ReactNode
  align?: 'right'
  /** Extra <th> classes, as CoA's HEADER_DEFS carry them ('min-w-[180px]'). */
  headerClassName?: string
  /** <td> classes; the density padding is added. Defaults to 'px-4'. */
  cellClassName?: string
  /** `person` seats an avatar cell on PERSON_PAD instead of the density padding. */
  pad?: 'density' | 'person'
  render: (row: T, ctx: CellCtx) => ReactNode
  /** Present = sortable from the header menu. Nulls sort last ascending. */
  sortValue?: (row: T) => string | number | null | undefined
  /** Present = filterable from the header menu, with this editor. */
  filter?: ColFilterType
  /** What the filter reads (text / chip label / number / ISO date). Defaults to sortValue. */
  filterValue?: (row: T) => string | number | null | undefined
  /** Multiselect values offered; defaults to the distinct filterValues. */
  filterOptions?: string[] | ((rows: T[]) => string[])
  /** The text the cell prints, for the search (every column is searched, shown or hidden). */
  searchText?: (row: T) => string | number | null | undefined | (string | number | null | undefined)[]
  /** The identity column(s): pinned left by construction, never hidden or moved. */
  locked?: boolean
  /** Width when pinned (locked or frozen). Locked default 280; frozen default 160. */
  width?: number
  /** Off until the reader turns it on (still searched). */
  defaultHidden?: boolean
  /** May the reader freeze it? Default true for non-locked columns. */
  freezable?: boolean
}

export interface SortState { key: string; dir: 'asc' | 'desc' }

/* ── Pinning (AccountTable.tsx 80-180) ───────────────────────────────────── */

const Z_FROZEN = 2
const Z_HEAD_FROZEN = 9
// Opaque header fill (muted/30 composited over white) so a sticky header cell
// never shows columns scrolling underneath it. A flat colour: the Row numbers
// gutter paints into background-image.
export const HEADER_FILL = 'color-mix(in srgb, hsl(var(--muted)) 30%, #ffffff)'
/** The band fill CoA gives a category head row; used for pinned special rows. */
export const BAND_FILL = 'color-mix(in srgb, hsl(var(--muted)) 30%, #fff)'
const LEFT_EDGE_SHADOW = 'inset -2px 0 0 0 hsl(var(--border)), 6px 0 8px -8px rgba(15,23,42,0.18)'
const RIGHT_EDGE_SHADOW = 'inset 1px 0 0 0 hsl(var(--border)), -6px 0 8px -6px rgba(15,23,42,0.12)'

interface PinOpts { header?: boolean; z?: number; background?: string }

export function leftPinStyle({ left, width, edge, header, z, background }: PinOpts & { left: number; width?: number; edge?: boolean }): CSSProperties {
  return {
    position: 'sticky',
    left,
    zIndex: z ?? (header ? Z_HEAD_FROZEN : Z_FROZEN),
    // The longhand, never the `background` shorthand: the shorthand resets
    // background-image, and that is where the Row numbers gutter draws.
    backgroundColor: background ?? (header ? HEADER_FILL : 'inherit'),
    transition: 'background-color 200ms ease-out',
    ...(width != null ? { width, minWidth: width, maxWidth: width } : null),
    boxShadow: edge ? LEFT_EDGE_SHADOW : undefined,
  }
}

export function rightPinStyle({ header, z, background }: PinOpts = {}): CSSProperties {
  return {
    position: 'sticky',
    right: 0,
    zIndex: z ?? (header ? Z_HEAD_FROZEN : Z_FROZEN),
    backgroundColor: background ?? (header ? HEADER_FILL : 'inherit'),
    transition: 'background-color 200ms ease-out',
    boxShadow: RIGHT_EDGE_SHADOW,
  }
}

/* The empty column in front of Actions takes the spare width, so Actions keeps
   the width of its button and stays pinned right (AccountTable.tsx 141-168). */
const ACTIONS_HEAD_W = 1
const FILLER_W: CSSProperties = { width: '100%' }
const EQUAL_FILLER_W: CSSProperties = { width: 0 }
const ACTIONS_EQUAL_W = 64
const fillerProps = { 'data-actions-filler': '', 'aria-hidden': true, className: 'p-0' } as const

const SELECT_W = 52
const LOCKED_W_DEFAULT = 280
const FROZEN_W_DEFAULT = 160
const MIN_COL_W = 60

/* ── Table state ──────────────────────────────────────────────────────────── */

const textsOf = <T,>(c: CoaColumn<T>, row: T): string[] => {
  if (!c.searchText) return []
  const v = c.searchText(row)
  const arr = Array.isArray(v) ? v : [v]
  return arr.filter(x => x != null && x !== '').map(String)
}
const filterValueOf = <T,>(c: CoaColumn<T>, row: T) => (c.filterValue ?? c.sortValue)?.(row)

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined): number {
  const an = a == null || a === '', bn = b == null || b === ''
  if (an || bn) return an && bn ? 0 : an ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export interface UseCoaTableOptions<T> {
  columns: CoaColumn<T>[]
  /** The rows the page's own narrowing (pills, panel filters) left. */
  rows: T[]
  /** The (debounced) table search. Searches every column, shown or hidden. */
  query?: string
  getRowId: (row: T) => string
  /** Remember columns, widths, sort, filters and look for the session under this key. */
  rememberAs?: string
  /** Rows that always lead, whatever the sort or search (e.g. the base currency). */
  pinTop?: (row: T) => boolean
  /** Rows that always trail the rest, whatever the sort (e.g. inactive currencies). */
  sinkBottom?: (row: T) => boolean
  /** Opening sort; null = the rows' own order with no indicator. */
  defaultSort?: SortState | null
  /** Opening density etc. (CoA: Condensed, crosshair on). */
  initialDensity?: Density
  /** Opening Column widths mode (CoA: Default). */
  initialColumnSizing?: ColumnSizing
  /** Page the rows: CoaTableCard draws the Records per page select and pager
   *  under the table, and the table draws one page. Omit to draw every row. */
  pagination?: {
    /** Opening page size. The reader's choice is kept in this browser's storage
     *  (under `rememberAs`), so it comes back after a reload. */
    perPage: number
    /** The page-size choices ('all' offers All). */
    options?: (number | 'all')[]
    /** Pinned rows lead every page and stay out of the page count; otherwise
     *  they are the first rows of page 1. */
    pinnedOnEveryPage?: boolean
    /** Back to page 1 when this changes: the page's own pills and panel
     *  filters (search, header filters and sort already go back). */
    resetKey?: string
  }
}

/**
 * Everything a CoA table holds, in one place: column order / visibility / frozen
 * set (shared with the docked Columns panel), widths, sort, header filters, the
 * look (density, widths mode, Configure Visuals), selection and expansion - and
 * the rows after search, header filters and sort, which is what the toolbar's
 * "N of M" counts and what `CoaDataTable` draws.
 */
export function useCoaTable<T>(o: UseCoaTableOptions<T>) {
  const { columns, getRowId, rememberAs, pinTop, sinkBottom } = o
  const query = o.query ?? ''
  const key = (k: string) => (rememberAs ? `${rememberAs}:${k}` : undefined)
  const allKeys = useMemo(() => columns.map(c => c.key), [columns])
  const lockedKeys = useMemo(() => columns.filter(c => c.locked).map(c => c.key), [columns])
  const defaultVisibility = useMemo(
    () => Object.fromEntries(columns.map(c => [c.key, c.locked || !c.defaultHidden])) as Record<string, boolean>,
    [columns],
  )

  const [order, setOrder] = useRememberedState<string[]>(key('order'), allKeys)
  const [visibility, setVisibility] = useRememberedState<Record<string, boolean>>(key('columns'), defaultVisibility)
  const [frozen, setFrozen] = useRememberedState<string[]>(key('frozen'), [])
  const [colFilters, setColFilters] = useRememberedState<ColFilters>(key('colFilters'), {})
  const [sort, setSort] = useRememberedState<SortState | null>(key('sort'), o.defaultSort ?? null)
  const [widths, setWidths] = useRememberedState<Record<string, number>>(key('widths'), {})
  const lookState = useTableLook({
    ...(o.initialDensity && { density: o.initialDensity }),
    ...(o.initialColumnSizing && { columnSizing: o.initialColumnSizing }),
  }, key('look'))
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // A column added to the definitions after the order was remembered joins at its default place.
  const fullOrder = useMemo(() => {
    const known = order.filter(k => allKeys.includes(k))
    const missing = allKeys.filter(k => !known.includes(k))
    return missing.length ? [...known, ...missing] : known
  }, [order, allKeys])
  const isShown = (k: string) => (visibility[k] ?? defaultVisibility[k]) !== false

  // Search: every column's printed text, shown or hidden.
  const matcher = useMemo(() => searchMatcher(query), [query])
  const searching = !!query.trim()
  const searched = useMemo(
    () => (searching ? o.rows.filter(r => columns.some(c => textsOf(c, r).some(matcher))) : o.rows),
    [o.rows, columns, matcher, searching],
  )
  // Hidden columns a listed row matched in come out for the search, after the identity column.
  const hiddenHits = useMemo(() => {
    if (!searching) return [] as string[]
    const hit = new Set<string>()
    for (const r of searched) for (const c of columns) if (!isShown(c.key) && !hit.has(c.key) && textsOf(c, r).some(matcher)) hit.add(c.key)
    return fullOrder.filter(k => hit.has(k))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, columns, matcher, searching, visibility, fullOrder])
  const { revealed, hide: unreveal } = useSearchReveal(query, hiddenHits)

  const filtered = useMemo(() => {
    const active = columns.filter(c => filterActive(colFilters[c.key]))
    if (!active.length) return searched
    return searched.filter(r => active.every(c => matchColFilter(colFilters[c.key], filterValueOf(c, r))))
  }, [searched, columns, colFilters])

  const rows = useMemo(() => {
    const col = sort ? columns.find(c => c.key === sort.key) : undefined
    const dir = sort?.dir === 'desc' ? -1 : 1
    const indexed = filtered.map((r, i) => ({ r, i }))
    if (col?.sortValue) {
      indexed.sort((a, b) => {
        const av = col.sortValue!(a.r), bv = col.sortValue!(b.r)
        // Nulls stay last whichever way the column runs.
        const an = av == null || av === '', bn = bv == null || bv === ''
        if (an !== bn) return an ? 1 : -1
        const c = compareValues(av, bv)
        return c !== 0 ? c * dir : a.i - b.i
      })
    }
    const sorted = indexed.map(x => x.r)
    const sunk = sinkBottom ? sorted.filter(r => sinkBottom(r) && !pinTop?.(r)) : []
    const sunkSet = new Set(sunk)
    const rest = sunk.length ? sorted.filter(r => !sunkSet.has(r)) : sorted
    if (!pinTop) return [...rest, ...sunk]
    return [...rest.filter(pinTop), ...rest.filter(r => !pinTop(r)), ...sunk]
  }, [filtered, sort, columns, pinTop, sinkBottom])

  // Paging: one page of the rows, pinned rows leading every page when asked.
  const pg = o.pagination
  const [perPage, setPerPage] = useStoredState<number>(key('perPage'), pg?.perPage ?? -1)
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [query, colFilters, sort, pg?.resetKey])
  const paging = useMemo(() => {
    if (!pg) return { rows, total: rows.length, page: 1, offset: 0 }
    const lead = pg.pinnedOnEveryPage && pinTop ? rows.filter(pinTop) : []
    const list = lead.length ? rows.filter(r => !pinTop!(r)) : rows
    const current = Math.min(Math.max(1, page), pageCount(list.length, perPage))
    return {
      rows: [...lead, ...paginate(list, current, perPage)],
      total: list.length,
      page: current,
      offset: perPage === -1 ? 0 : (current - 1) * perPage,
    }
  }, [pg, rows, pinTop, page, perPage])

  const shownVisibility = useMemo(
    () => (revealed.length ? { ...visibility, ...Object.fromEntries(revealed.map(k => [k, true])) } : visibility),
    [visibility, revealed],
  )
  const shownOrder = useMemo(
    () => orderWithRevealed(fullOrder, revealed, lockedKeys[lockedKeys.length - 1] ?? fullOrder[0]),
    [fullOrder, revealed, lockedKeys],
  )

  const hideColumn = (k: string) => { if (!unreveal(k)) setVisibility(v => ({ ...v, [k]: false })) }
  const toggleFreeze = (k: string) => setFrozen(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]))

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (ids: string[], checked: boolean) => setSelected(prev => {
    const n = new Set(prev)
    ids.forEach(id => (checked ? n.add(id) : n.delete(id)))
    return n
  })
  const clearSelection = () => setSelected(new Set())
  const toggleExpand = (id: string) => setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const visibleCount = allKeys.filter(isShown).length
  const { look, set: setLook, toggle: toggleVisual, lookClass } = lookState

  return {
    columns, getRowId, pinTop, query,
    /** Every row the table holds: searched, header-filtered and sorted, pinned
     *  rows first. What the toolbar counts and the exports take. */
    rows,
    /** The rows `CoaDataTable` draws: `rows`, or the current page of them. */
    pageRows: paging.rows,
    /** Rows on the pages before this one, so Row numbers carry on. */
    pageOffset: paging.offset,
    /** Spread onto <PaginationBar /> (CoaTableCard does); undefined when not paged. */
    pagination: pg ? {
      total: paging.total,
      page: paging.page,
      onPageChange: setPage,
      perPage,
      onPerPageChange: setPerPage,
      options: pg.options,
    } : undefined,
    order: fullOrder, setOrder,
    visibility, setVisibility,
    shownOrder, shownVisibility,
    isShown,
    frozen, toggleFreeze,
    colFilters, setColFilters,
    sort, setSort,
    widths, setWidths,
    look, setLook, toggleVisual, lookClass,
    columnsOpen, setColumnsOpen,
    selected, setSelected, toggleSelect, toggleAll, clearSelection,
    expanded, toggleExpand, setExpanded,
    hideColumn,
    /** Labels of hidden columns the search brought out, for SearchRevealNote. */
    revealedLabels: revealed.map(k => columns.find(c => c.key === k)?.label ?? k),
    /** The Columns button's badge. */
    visibleCount,
    /** Spread onto <ColumnSelector />. */
    columnSelectorProps: {
      open: columnsOpen,
      onOpenChange: setColumnsOpen,
      columns: columns.map(c => ({ key: c.key, label: c.label })),
      columnOrder: fullOrder,
      columnVisibility: Object.fromEntries(allKeys.map(k => [k, isShown(k)])) as Record<string, boolean>,
      lockedColumns: lockedKeys,
      onColumnOrderChange: (next: string[]) => setOrder(next),
      onColumnVisibilityChange: (v: Record<string, boolean>) => setVisibility(v),
      frozenColumns: frozen,
      onToggleFreeze: toggleFreeze,
      canFreeze: (k: string) => { const c = columns.find(x => x.key === k); return !!c && !c.locked && c.freezable !== false },
      visual: { values: look, offers: {}, onToggle: toggleVisual },
      // Reset puts back the table as it ships: hidden-by-default columns stay hidden.
      defaults: { visibility: defaultVisibility, order: allKeys },
    },
    /** Spread onto <DensityMenu />: Condensed / Comfort plus Column widths. */
    densityMenuProps: {
      value: look.density,
      onChange: (d: Density) => setLook('density', d),
      sections: lookSections({ widths: { value: look.columnSizing, onChange: v => { setLook('columnSizing', v); setWidths({}) } } }),
    },
  }
}

export type CoaTable<T> = ReturnType<typeof useCoaTable<T>>

/* ── Header cells ─────────────────────────────────────────────────────────── */

interface DnDProps { 'data-col-drag-key': string; onMouseDown: (e: React.MouseEvent) => void; onClickCapture: (e: React.MouseEvent) => void }

// Right-edge resize grip rendered inside a header cell (AccountTable.tsx 1986).
function ResizeHandle({ onResizeStart }: { onResizeStart: (e: React.MouseEvent) => void }) {
  return (
    <span
      onMouseDown={onResizeStart}
      onClick={e => e.stopPropagation()}
      title="Drag to resize"
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none opacity-0 group-hover/col:opacity-100 bg-primary/20 hover:bg-primary/50 transition-opacity"
    />
  )
}

function HeaderCell<T>({ col, sort, onSortDir, dnd, dragging, hiding, width, onResizeStart, filter, onFilterChange, uniqueValues, onHide, onToggleFreeze, frozen, stickyStyle, colFloor }: {
  col: CoaColumn<T>
  sort: SortState | null
  onSortDir: (dir: 'asc' | 'desc' | null) => void
  dnd?: DnDProps; dragging?: boolean; hiding?: boolean
  width?: number; onResizeStart?: (e: React.MouseEvent) => void
  filter: ColFilter | undefined; onFilterChange: (f: ColFilter) => void; uniqueValues: string[]
  onHide?: () => void
  onToggleFreeze?: () => void
  frozen?: boolean
  stickyStyle?: CSSProperties
  colFloor?: number
}) {
  const heading = col.label
  const sortable = !!col.sortValue
  const active = sortable && sort?.key === col.key
  const hasFilter = filterActive(filter)
  const baseWidthStyle: CSSProperties | undefined = stickyStyle ? {} : (width ? { width, minWidth: width, maxWidth: width } : colFloor ? { minWidth: colFloor } : undefined)
  const thStyle = stickyStyle ? { backgroundColor: HEADER_FILL, ...stickyStyle } : baseWidthStyle
  const dragStyle = dragging ? { ...thStyle, ...draggedHeaderStyle(!!hiding) } : thStyle
  // A column with no filter editor still opens the menu (sort, hide, freeze); the
  // Filter row only shows for one that has an editor.
  const editor = filter ?? (col.filter ? blankFilter(col.filter) : undefined)
  return (
    <th {...dnd} data-col-head={col.key} data-col-key={col.key} style={dragStyle}
      className={cn('relative group/col h-10 pr-2 align-middle font-normal text-muted-foreground whitespace-nowrap select-none pl-4', col.align === 'right' ? 'text-right' : 'text-left', dnd && 'cursor-grab', !dragging && hasFilter && 'bg-primary/[0.03]', col.headerClassName)}>
      {dragging && <DragBar hiding={!!hiding} />}
      {dnd && <GripVertical size={12} className={cn('absolute left-1 top-1/2 -translate-y-1/2 transition-opacity pointer-events-none', dragging ? (hiding ? 'opacity-100 text-danger-600' : 'opacity-100 text-primary') : 'text-fg-subtle/50 opacity-0 group-hover/col:opacity-100')} />}
      <HeaderMenuSlot
        label={heading}
        sortable={sortable}
        currentSort={active ? sort!.dir : null}
        onSortDir={onSortDir}
        filter={editor}
        onFilterChange={onFilterChange}
        uniqueValues={uniqueValues}
        align={col.align}
        onHide={onHide}
        onToggleFreeze={onToggleFreeze}
        frozen={frozen}
      >
        <span style={active || hasFilter ? { color: 'hsl(var(--primary))' } : undefined}>{heading}</span>
        {(col.info || col.infoRich) && (
          <Tooltip rich={!!col.infoRich} content={col.infoRich ?? col.info} side="bottom" align={col.align === 'right' ? 'right' : 'left'}>
            <span onClick={e => e.stopPropagation()} className={cn('inline-flex cursor-help', active || hasFilter ? 'text-primary' : 'text-fg-subtle/60 hover:text-fg-subtle')}><Info size={12} /></span>
          </Tooltip>
        )}
        {hasFilter && !active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--primary))' }} />}
        {active && sort?.dir === 'asc' && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
        {active && sort?.dir === 'desc' && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
        {!active && !hasFilter && sortable && <ArrowUpDown className="coa-col-hint w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/col:opacity-100 transition-opacity" />}
        {!active && !hasFilter && !sortable && <ChevronDown className="coa-col-hint w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/col:opacity-100 transition-opacity" />}
      </HeaderMenuSlot>
      {onResizeStart && <ResizeHandle onResizeStart={onResizeStart} />}
    </th>
  )
}

/* HeaderMenu always shows a Filter row; a column without a filter editor gets
   the same popover minus that row, by handing it a filter it will never offer. */
function HeaderMenuSlot(props: Omit<Parameters<typeof HeaderMenu>[0], 'filter'> & { filter?: ColFilter }) {
  const { filter, ...rest } = props
  if (filter) return <HeaderMenu {...rest} filter={filter} />
  return <HeaderMenu {...rest} filter={NO_FILTER} noFilter />
}
const NO_FILTER = blankFilter('text')

function Th({ children, className, style, ...rest }: { children?: ReactNode; className?: string; style?: CSSProperties } & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th {...rest} style={style} className={cn('relative group/col h-10 pl-4 pr-2 align-middle text-left font-normal text-muted-foreground whitespace-nowrap', className)}>
      {children}
    </th>
  )
}

/* ── The table ────────────────────────────────────────────────────────────── */

/** The colSpan of the table a row sits in, for full-width rows a page adds. */
const ColSpanContext = createContext(1)
/* A row a page adds after another (TableNoteRow) has to count toward its block
   when the table is windowed, so it carries the block marker too. */
const BlockRowContext = createContext(false)
function BlockRowMark({ children }: { children: ReactNode }) {
  return <BlockRowContext.Provider value={true}>{children}</BlockRowContext.Provider>
}

/**
 * A full-width row inside the table (a caption under the base row, a banner
 * row). Its content sticks to the left edge so it stays in view while the
 * columns scroll sideways.
 */
export function TableNoteRow({ children, className, band }: { children: ReactNode; className?: string; band?: boolean }) {
  const span = useContext(ColSpanContext)
  const inBlock = useContext(BlockRowContext)
  return (
    <tr data-note-row data-block-row={inBlock ? '' : undefined} className={cn(band ? '' : 'bg-white')} style={band ? { backgroundColor: BAND_FILL } : undefined}>
      <td colSpan={span} className={cn('p-0', className)}>
        <div className="sticky left-0 px-4 py-2 text-xs text-fg-muted" style={{ width: 'var(--coa-scroll-w, 100%)' }}>{children}</div>
      </td>
    </tr>
  )
}

export interface CoaDataTableProps<T> {
  table: CoaTable<T>
  /** Leading checkbox column; the header box selects exactly the visible rows. */
  selectable?: boolean
  /** Rows that cannot be ticked (a banner row). */
  isSelectable?: (row: T) => boolean
  /** Row click; the whole <tr> becomes clickable. */
  onRowClick?: (row: T) => void
  /** The Actions kebab's menu. Omit for no Actions column. */
  rowMenu?: (row: T, close: () => void) => ReactNode
  /** Rows with CoA's band treatment (pinned special rows). */
  isBand?: (row: T) => boolean
  /** Expandable rows: the toggle leads the first identity cell, and this renders the detail row. */
  renderExpanded?: (row: T) => ReactNode
  canExpand?: (row: T) => boolean
  /** `chevron` (default) or the tree-lines disc. */
  expandStyle?: 'chevron' | 'disc'
  /** Rendered after a given row (a caption under the base row): use <TableNoteRow>. */
  afterRow?: (row: T) => ReactNode
  /** Shown in place of the rows when there are none. */
  emptyState?: ReactNode
  /** Block-window the rows past this many (CoA GL: 50-row blocks, at most two drawn). Default 120. */
  windowAbove?: number
  /** The scroll container's classes. Defaults to CoA's `flex-1 min-h-0 overflow-auto scrollbar-thin`. */
  scrollClassName?: string
  /** Text size of the body. CoA list `text-sm`; GL `text-[13px]`. */
  textClassName?: string
}

export function CoaDataTable<T>({
  table, selectable, isSelectable, onRowClick, rowMenu, isBand, renderExpanded, canExpand, expandStyle = 'chevron',
  afterRow, emptyState, windowAbove = 120, scrollClassName, textClassName = 'text-sm',
}: CoaDataTableProps<T>) {
  const { columns, look, getRowId, pinTop, query: q } = table
  // One page when the table is paged (useCoaTable's `pagination`), else every row.
  const rows = table.pageRows
  const condensed = look.density === 'condensed'
  const padCls = condensed ? 'py-0.5' : 'py-3'
  const sizing: ColumnSizing = look.columnSizing
  const engineSized = sizing === 'fit' || sizing === 'equal'
  const hasActions = !!rowMenu
  const colByKey = useMemo(() => new Map(columns.map(c => [c.key, c])), [columns])

  // Which columns draw, in which order: identity columns lead (pinned), then the
  // ones the reader froze, then the rest in panel order.
  const lockedKeys = table.shownOrder.filter(k => colByKey.get(k)?.locked)
  const lockedInDefOrder = columns.filter(c => c.locked).map(c => c.key).filter(k => lockedKeys.includes(k))
  const scrolling = table.shownOrder.filter(k => !colByKey.get(k)?.locked && table.shownVisibility[k] !== false && (table.shownVisibility[k] ?? !colByKey.get(k)?.defaultHidden))
  const frozenKeys = scrolling.filter(k => table.frozen.includes(k))
  const colKeys = [...frozenKeys, ...scrolling.filter(k => !frozenKeys.includes(k))]

  // Header drag-to-reorder (tableColumns), hide on drag off the top.
  const orderRef = useRef(table.order)
  orderRef.current = table.order
  const drag = useColumnDragReorder({
    order: table.order,
    setOrder: next => table.setOrder(typeof next === 'function' ? next(orderRef.current) : next),
    locked: new Set(columns.filter(c => c.locked).map(c => c.key)),
    onHide: k => table.hideColumn(k),
    canHide: k => !colByKey.get(k)?.locked,
  })
  const dragKey = drag.draggingKey
  const dnd = (key: string): DnDProps => ({
    'data-col-drag-key': key,
    onMouseDown: e => drag.onHeaderMouseDown(e, key),
    onClickCapture: e => { if (drag.suppressClick()) { e.stopPropagation(); e.preventDefault() } },
  })

  // Resize (AccountTable useColumnWidths): 60px floor, a drag takes Column widths to custom.
  const widths = engineSized ? EMPTY_WIDTHS : table.widths
  const onResizeStart = engineSized ? undefined : (key: string) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const th = (e.currentTarget as HTMLElement).closest('th')
    const startX = e.clientX
    const startW = th ? th.getBoundingClientRect().width - parseFloat(getComputedStyle(th).borderLeftWidth || '0') : 120
    table.setLook('columnSizing', 'custom')
    const move = (ev: MouseEvent) => {
      const w = Math.max(MIN_COL_W, Math.round(startW + (ev.clientX - startX)))
      table.setWidths(prev => ({ ...prev, [key]: w }))
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Pin geometry. The Row numbers gutter is the first cell's left border, so the
  // column that leads holds that much more width.
  const gutter = look.rowNumbers ? rowNumberGutter(table.pageOffset + rows.length) : 0
  const selW = selectable ? SELECT_W + gutter : 0
  const lockedW = (k: string, i: number) => (widths[k] ?? colByKey.get(k)?.width ?? LOCKED_W_DEFAULT) + (!selectable && i === 0 ? gutter : 0)
  const frozenW = (k: string) => widths[k] ?? colByKey.get(k)?.width ?? FROZEN_W_DEFAULT
  const lockedLefts: number[] = []
  {
    let acc = selW
    lockedInDefOrder.forEach((k, i) => { lockedLefts.push(acc); acc += lockedW(k, i) })
  }
  const lockedRunW = lockedInDefOrder.reduce((s, k, i) => s + lockedW(k, i), 0)
  const pinOf = (k: string): { left: number; width: number; edge: boolean } | undefined => {
    if (engineSized) return undefined
    const li = lockedInDefOrder.indexOf(k)
    if (li !== -1) return { left: lockedLefts[li], width: lockedW(k, li), edge: li === lockedInDefOrder.length - 1 && frozenKeys.length === 0 }
    const fi = frozenKeys.indexOf(k)
    if (fi === -1) return undefined
    const left = selW + lockedRunW + frozenKeys.slice(0, fi).reduce((s, c) => s + frozenW(c), 0)
    return { left, width: frozenW(k), edge: fi === frozenKeys.length - 1 }
  }
  const drawKeys = [...lockedInDefOrder, ...colKeys]
  const colSpan = (selectable ? 1 : 0) + drawKeys.length + (hasActions ? 2 : 0)

  // Scroll container: crosshair, and its width for full-width rows' sticky content.
  const scrollRef = useRef<HTMLDivElement>(null)
  useCrosshair(scrollRef, look.crosshair)
  const [scrollW, setScrollW] = useState(0)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const read = () => setScrollW(el.clientWidth)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Block windowing for long lists (GL Journal entries): pinned rows stay out of it.
  const pinned = pinTop ? rows.filter(pinTop) : []
  const body = pinTop ? rows.filter(r => !pinTop(r)) : rows
  const windowed = body.length > windowAbove
  const blocks = useMemo(() => {
    const out: T[][] = []
    for (let i = 0; i < body.length; i += BLOCK_SIZE) out.push(body.slice(i, i + BLOCK_SIZE))
    return out
  }, [body])
  const expanded = table.expanded
  /* Detail rows just opened by their toggle, which ease in (CoA's
     coa-row-reveal, played for the rows a click reveals). Only those: a
     row remounted by the block window or a re-sort keeps still. */
  const [revealing, setRevealing] = useState<Set<string>>(() => new Set())
  const toggleRow = (id: string) => {
    if (!expanded.has(id)) setRevealing(prev => new Set(prev).add(id))
    table.toggleExpand(id)
  }
  const revealed = (id: string) => setRevealing(prev => { const n = new Set(prev); n.delete(id); return n })
  const trCount = (r: T) => 1 + (renderExpanded && expanded.has(getRowId(r)) && (!canExpand || canExpand(r)) ? 1 : 0) + (afterRow && afterRow(r) ? 1 : 0)
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const headRef = useRef<HTMLTableSectionElement>(null)
  const win = useBlockWindow({
    enabled: windowed,
    bodyRef,
    headRef,
    rowSelector: 'tr[data-block-row]',
    sizes: windowed ? blocks.map(b => b.reduce((n, r) => n + trCount(r), 0)) : [],
    keys: windowed ? blocks.map(b => `${getRowId(b[0])}|${getRowId(b[b.length - 1])}|${b.length}|${b.filter(r => expanded.has(getRowId(r))).length}`) : [],
    layoutKey: JSON.stringify([look.density, drawKeys, table.widths, sizing, look.rowNumbers]),
    resetKey: JSON.stringify([q, table.colFilters, table.sort, body.length, body[0] ? getRowId(body[0]) : '']),
    colAttr: 'data-col-key',
    floorCols: sizing !== 'equal',
  })
  const drawnBody = windowed ? blocks.slice(win.first, win.last + 1).flat() : body
  const floorOf = (k: string) => (windowed ? win.colFloor?.[k] : undefined)

  // Selection: the header box selects exactly the rows on screen.
  const selectableRows = selectable ? rows.filter(r => !isSelectable || isSelectable(r)) : []
  const visibleIds = selectableRows.map(getRowId)
  const allSelected = selectable && visibleIds.length > 0 && visibleIds.every(id => table.selected.has(id))
  const anySelected = selectable && visibleIds.some(id => table.selected.has(id))

  const uniqueValues = (c: CoaColumn<T>): string[] => {
    if (c.filter !== 'multiselect') return []
    if (Array.isArray(c.filterOptions)) return c.filterOptions
    if (typeof c.filterOptions === 'function') return c.filterOptions(table.rows)
    const seen = new Set<string>()
    for (const r of table.rows) { const v = filterValueOf(c, r); if (v != null && v !== '') seen.add(String(v)) }
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }

  const comfort = !condensed
  const firstKey = drawKeys[0]

  // Row numbers on a later page carry on from the pages before it: the page's
  // first body row sets the counter (pinned rows drawn on this page count too).
  const countFrom = table.pageOffset > 0 && body.length ? pinned.length + table.pageOffset : 0
  const firstBodyId = countFrom ? getRowId(body[0]) : undefined

  const renderRow = (r: T, blockRow: boolean) => {
    const id = getRowId(r)
    const selected = table.selected.has(id)
    const band = !!isBand?.(r)
    const expandable = !!renderExpanded && (!canExpand || canExpand(r))
    const isExp = expandable && expanded.has(id)
    const openRow = onRowClick ? () => onRowClick(r) : undefined
    const ctx: CellCtx = { q, comfort, selected, band, expanded: isExp, toggleExpand: () => toggleRow(id), openRow }
    const fbg = band ? BAND_FILL : 'inherit'
    const cellStyle = (k: string): CSSProperties | undefined => {
      const pin = pinOf(k)
      if (pin) return leftPinStyle({ ...pin, background: fbg })
      return band ? { backgroundColor: fbg } : undefined
    }
    const after = afterRow?.(r)
    return (
      <Fragment key={id}>
        <tr
          data-tree-account
          data-block-row={blockRow ? '' : undefined}
          data-row-hover={onRowClick ? '' : undefined}
          data-selected={selected ? '' : undefined}
          className={cn('border-b group transition-colors duration-200 ease-out',
            selected ? 'bg-[#F8FAFF]' : 'bg-white',
            band ? 'border-border' : 'border-border-subtle',
            onRowClick && 'cursor-pointer hover:bg-[#F0F7FF]')}
          style={id === firstBodyId ? ({ counterSet: `fr-row ${countFrom}` } as CSSProperties) : undefined}
          onClick={openRow}
        >
          {selectable && (
            <td
              className={cn('pl-4 pr-1 align-middle', padCls)}
              style={engineSized ? { backgroundColor: fbg } : leftPinStyle({ left: 0, width: selW, background: fbg })}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-1">
                {(!isSelectable || isSelectable(r)) && (
                  <input type="checkbox" className="coa-check" aria-label="Select row" checked={selected} onChange={() => table.toggleSelect(id)} />
                )}
              </div>
            </td>
          )}
          {drawKeys.map(k => {
            const c = colByKey.get(k)!
            const isFirst = k === firstKey
            const content = c.render(r, ctx)
            return (
              <td key={k} className={cn(c.cellClassName ?? 'px-4', c.pad === 'person' ? PERSON_PAD : padCls, c.align === 'right' && 'text-right')} style={cellStyle(k)}>
                {isFirst && (renderExpanded || !hasActions) ? (
                  // The first identity cell carries the expand toggle (CoA's
                  // nameLead), and reserves the kebab's 32px row height when the
                  // table has no Actions column.
                  <div className={cn('flex items-center gap-1.5 min-w-0', !hasActions && 'min-h-8')}>
                    {renderExpanded && (expandable
                      ? <ExpandToggle arrows={expandStyle === 'chevron'} expanded={isExp} onClick={e => { e.stopPropagation(); toggleRow(id) }} />
                      : <span className="shrink-0" style={{ width: expandStyle === 'chevron' ? 20 : LEAF_LEAD }} />)}
                    <div className="min-w-0 flex-1">{content}</div>
                  </div>
                ) : content}
              </td>
            )
          })}
          {hasActions && <td {...fillerProps} style={{ ...FILLER_W, ...(band ? { backgroundColor: fbg } : null) }} />}
          {hasActions && (
            <td data-actions-cell className={cn('px-2 text-right', padCls)} style={rightPinStyle({ background: fbg })} onClick={e => e.stopPropagation()}>
              <Menu trigger={<button type="button" aria-haspopup="menu" aria-label="Row actions" className="btn-icon text-fg-subtle"><MoreHorizontal size={14} /></button>}>
                {close => rowMenu!(r, close)}
              </Menu>
            </td>
          )}
        </tr>
        {isExp && (
          <tr
            data-detail-row
            data-block-row={blockRow ? '' : undefined}
            className={cn(selected ? 'bg-[#F8FAFF]' : 'bg-white', revealing.has(id) && 'coa-row-reveal')}
            onAnimationEnd={e => { if (e.target === e.currentTarget) revealed(id) }}
          >
            <td colSpan={colSpan} className="p-0">
              <div className="sticky left-0" style={{ width: scrollW || '100%' }}>{renderExpanded!(r)}</div>
            </td>
          </tr>
        )}
        {after && (blockRow ? <BlockRowMark>{after}</BlockRowMark> : after)}
      </Fragment>
    )
  }

  return (
    <div ref={scrollRef} className={scrollClassName ?? 'flex-1 min-h-0 overflow-auto scrollbar-thin'} style={{ ['--coa-scroll-w' as string]: scrollW ? `${scrollW}px` : '100%' } as CSSProperties}>
      <DragGhost ghostRef={drag.ghostRef} label={dragKey ? colByKey.get(dragKey)?.label ?? null : null} hiding={drag.hiding} caps={false} />
      <GridComfort.Provider value={comfort}>
        <ColSpanContext.Provider value={colSpan}>
          <table
            className={cn(textClassName, 'coa-frozen-first border-separate border-spacing-0', sizing === 'fit' ? 'w-max min-w-full' : 'w-full', table.lookClass)}
            style={{
              ...(gutter ? { ['--fr-rownum-w' as string]: `${gutter}px` } : null),
              tableLayout: sizing === 'equal' ? 'fixed' : 'auto',
            } as CSSProperties}
          >
            <thead ref={headRef}>
              <tr data-grid-head-row className={cn('border-b border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)] text-muted-foreground text-xs', condensed && '[&>th]:!h-7')}>
                {selectable && (
                  <th style={{ position: 'sticky', left: 0, zIndex: Z_HEAD_FROZEN, backgroundColor: 'inherit', width: selW, minWidth: selW, maxWidth: selW }} className="align-middle pl-4 pr-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        className="coa-check"
                        aria-label="Select all rows"
                        checked={!!allSelected}
                        ref={el => { if (el) el.indeterminate = !!anySelected && !allSelected }}
                        onChange={e => table.toggleAll(visibleIds, e.target.checked)}
                      />
                    </div>
                  </th>
                )}
                {drawKeys.map(k => {
                  const c = colByKey.get(k)!
                  const pin = pinOf(k)
                  const locked = !!c.locked
                  return (
                    <HeaderCell<T>
                      key={k}
                      col={c}
                      sort={table.sort}
                      onSortDir={dir => table.setSort(dir ? { key: k, dir } : null)}
                      dnd={locked ? undefined : dnd(k)}
                      dragging={dragKey === k}
                      hiding={dragKey === k && drag.hiding}
                      width={pin ? pin.width : widths[k]}
                      colFloor={floorOf(k)}
                      onResizeStart={onResizeStart?.(k)}
                      stickyStyle={pin && leftPinStyle({ ...pin, header: true })}
                      onHide={!locked ? () => table.hideColumn(k) : undefined}
                      onToggleFreeze={!locked && c.freezable !== false ? () => table.toggleFreeze(k) : undefined}
                      frozen={table.frozen.includes(k)}
                      filter={table.colFilters[k] ?? (c.filter ? blankFilter(c.filter) : undefined)}
                      onFilterChange={f => table.setColFilters({ ...table.colFilters, [k]: f })}
                      uniqueValues={uniqueValues(c)}
                    />
                  )
                })}
                {hasActions && <th {...fillerProps} style={sizing === 'equal' ? EQUAL_FILLER_W : FILLER_W} />}
                {hasActions && <Th data-actions-cell className="text-right !px-2" style={{ ...rightPinStyle({ header: true }), width: sizing === 'equal' ? ACTIONS_EQUAL_W : ACTIONS_HEAD_W }}>Actions</Th>}
              </tr>
            </thead>
            {rows.length === 0 && emptyState ? (
              <tbody>
                <tr><td colSpan={colSpan}>{emptyState}</td></tr>
              </tbody>
            ) : (
              <tbody ref={bodyRef}>
                {pinned.map(r => renderRow(r, false))}
                {windowed && win.first > 0 && (
                  <tr aria-hidden data-coa-spacer="above" style={{ counterIncrement: `fr-row ${win.rowsAbove}` }}>
                    <td colSpan={colSpan} style={{ height: win.spaceAbove, padding: 0, borderBottom: 'none' }} />
                  </tr>
                )}
                {drawnBody.map(r => renderRow(r, windowed))}
                {windowed && win.spaceBelow > 0 && (
                  <tr aria-hidden data-coa-spacer="below">
                    <td colSpan={colSpan} style={{ height: win.spaceBelow, padding: 0, borderBottom: 'none' }} />
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </ColSpanContext.Provider>
      </GridComfort.Provider>
    </div>
  )
}
const EMPTY_WIDTHS: Record<string, number> = {}

