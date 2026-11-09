import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Download, X, Search, Lock, GripVertical, Maximize2, Minimize2, ChevronsUp, ChevronsDown,
  ListTree, Loader2, FileType, Columns3, Info,
} from 'lucide-react'
import { Tooltip } from '../components/ui'
import { useStore, usePeriodScopedAccounts, useSelectedPeriod } from '../store'
import { buildChartIndex, type ChartFigures } from '../lib/chartTree'
import { fmtCurrencyExact, fmtDate, fmtDateTime, todayIso } from '../lib/utils'
import { personText } from '../components/AuditCells'
import { ACCOUNT_TYPE_META, isCategoryRoot, type Account } from '../types'
import {
  DEFAULT_COLUMNS, DEFAULT_COLUMN_ORDER, HEADER_DEFS, chartRowValues, arrivalCodeText, importedText, restrictedText, modifiedByOf, modifiedAtOf,
  type ColKey,
} from '../components/AccountTable'
import { bookedFromBase, currentOwnBalanceOf } from '../lib/currencies'
import { accountRange } from '../lib/numberRange'
import { exportCsv, exportExcel, exportPdf, exportFilename, type ExportColumn } from '../lib/accountsExport'

/* Export accounts. Ported from User Access Control's `ExportUsersModal`, which
   is the surface Mahad asked this one to match: the same two-panel body, the
   same format cards, the same column picker with its search, drag-reorder and
   quick-move controls, and the same footer that names the format it will write.

   The file that claimed the port before this one was a quarter of its size. It
   kept the layout and dropped the behaviour - no full-view toggle, no
   move-to-top, no live shuffle while dragging, no search highlighting, tooltips
   downgraded to `title` attributes, and an Excel option that wrote CSV. The
   writers now live in lib/accountsExport.ts and each one writes its own format. */

export type ExportFormat = 'pdf' | 'excel' | 'csv'

/** Which trigger opened the modal, which is what the scope banner reports. */
export type ExportScope =
  | { kind: 'all'; totalCount: number }
  | { kind: 'filtered'; filteredCount: number; totalCount: number }
  | { kind: 'selected'; selectedCount: number }

/* ── Format cards ────────────────────────────────────────────────────────── */

// Only the badge tint changes per format. The selected border, radio, card wash
// and CTA are one blue whichever card is picked, so choosing a format does not
// restyle the modal around it.
const SHARED_BLUE = { border: '#2563EB', cardBg: '#F5FAFF', radio: '#2563EB', button: '#2563EB' }

const FORMAT_THEMES: Record<ExportFormat, { badgeBg: string; badgeText: string; radio: string; button: string }> = {
  pdf: { badgeBg: '#EFF6FF', badgeText: '#2563EB', ...SHARED_BLUE },
  excel: { badgeBg: '#ECFDF5', badgeText: '#047857', ...SHARED_BLUE },
  csv: { badgeBg: '#FFFBEB', badgeText: '#B45309', ...SHARED_BLUE },
}

const FORMAT_CARDS: { key: ExportFormat; badge: string; title: string; description: string }[] = [
  {
    key: 'pdf',
    badge: 'PDF',
    title: 'PDF Document',
    description: 'Best for reading and printing. Looks the same on any device, but cannot be edited.',
  },
  {
    key: 'excel',
    badge: 'XLS',
    title: 'Excel Spreadsheet',
    description: 'Best for working with the data. Opens in Excel or Google Sheets, ready to sort, filter, and total.',
  },
  {
    key: 'csv',
    badge: 'CSV',
    title: 'CSV File',
    description: 'Best for moving data between systems. A plain file that opens almost anywhere and keeps the raw values with no formatting.',
  },
]

/* ── Column catalogue ────────────────────────────────────────────────────── */

/** One tick in the picker. A field writes one column, or two: a number range is
 *  a start and an end, and neither is useful as half a string. */
export type ExportField = {
  key: string
  label: string
  info?: string
  locked?: boolean
  columns: ExportColumn<Account>[]
}

/* Drag reorder holds the locked column at the front, so a file always opens on
   the name of the account the row is about. */
const LOCKED_KEYS = new Set(['name'])

/* Mahad, 2026-09-24: *"Open the column configurator and click Show All - only
   those columns should be present in the exports as well."*

   So the picker's catalogue is the Columns panel's catalogue, in the panel's own
   order, and the only way to add a field to the file is to add a column to the
   table. It used to carry five of its own on top - Net change, Income/Balance,
   Contra, Direct posting and Effective date - all naming facts no column on the
   listing states, the last two keyed off `ColumnConfig` entries the panel has
   never offered. A number range was two ticks against the panel's one, which is
   the same drift in miniature.

   Parent is the one survivor, and not as an exception to the rule: a file is
   flat, so the parent's number is how it writes the tree the listing draws with
   indentation. It ships unticked like anything the listing is not showing. */
const EXPORT_ONLY_KEYS = ['parent']

// The cents a workbook shows its money to.
const MONEY_FMT = '#,##0.00'

export const EXPORT_FIELD_ORDER: string[] = [
  'name', ...DEFAULT_COLUMN_ORDER.filter(k => k !== 'name'), ...EXPORT_ONLY_KEYS,
]

/** How a row is read, per column. Handed in so the catalogue below can be built
 *  - and checked - without a chart to roll figures out of. */
export interface ExportReaders {
  parentNumber: (a: Account) => string
  dimensions: (a: Account) => string
  figure: (pick: (f: ChartFigures) => number) => Omit<ExportColumn<Account>, 'label'>
  fx: Omit<ExportColumn<Account>, 'label'>
}

/* Labels come from HEADER_DEFS rather than a second set kept here, so a column
   is named the same thing in the panel, on the header and in the file. */
export function buildExportFields(read: ExportReaders): ExportField[] {
  const of = (key: ColKey, col: Omit<ExportColumn<Account>, 'label'>): ExportField => ({
    key,
    label: HEADER_DEFS[key].label,
    info: HEADER_DEFS[key].info,
    locked: LOCKED_KEYS.has(key),
    columns: [{ label: HEADER_DEFS[key].label, ...col }],
  })

  const fields: Record<string, ExportField> = {
    name: of('name', { text: a => a.accountName }),
    number: of('number', { text: a => a.accountNumber }),
    /* Named as well as valued, the way the pills on the listing are: a chart read
       out of glued numbers holds 71100 once per department, and a bare "London"
       in a cell would not say which dimension it came from. */
    dimensions: of('dimensions', { text: read.dimensions }),
    /* Two cells, not one formatted span. A file is read in a spreadsheet, and
       "1000-1999" in one cell is text that has to be split before it can be
       compared to anything. One tick all the same: the reader is choosing the
       reservation, not two halves of it. */
    numberRange: {
      key: 'numberRange',
      label: HEADER_DEFS.numberRange.label,
      info: HEADER_DEFS.numberRange.info,
      columns: [
        { label: `${HEADER_DEFS.numberRange.label} start`, text: a => (accountRange(a) ? String(accountRange(a)!.start) : ''), number: a => accountRange(a)?.start ?? null },
        { label: `${HEADER_DEFS.numberRange.label} end`, text: a => (accountRange(a) ? String(accountRange(a)!.end) : ''), number: a => accountRange(a)?.end ?? null },
      ],
    },
    type: of('type', { text: a => ACCOUNT_TYPE_META[a.accountType]?.label ?? '' }),
    /* Blank on the five category rows, as the listing's dash is: a category spans
       its classifications, and the value stored on its root is only a default. */
    classification: of('classification', { text: a => (isCategoryRoot(a) ? '' : a.statementClassification) }),
    glType: of('glType', { text: a => a.glAccountType }),
    role: of('role', { text: a => a.accountRole ?? '' }),
    normalBalance: of('normalBalance', { text: a => a.normalBalance }),
    /* The figure columns carry a `number` so the workbook holds a number Excel
       can total, rather than text that merely looks like one. The opening figure
       is derived the way the listing's cell derives it, there being no stored
       opening balance to read. */
    openingBalance: of('openingBalance', read.figure(f => f.balance - f.netChange)),
    // As it stands today, whatever the period, as the listing prints it.
    runningBalance: of('runningBalance', read.figure(f => f.current)),
    fxBalance: of('fxBalance', read.fx),
    currency: of('currency', { text: a => a.currencyCode }),
    status: of('status', { text: a => a.status }),
    description: of('description', { text: a => a.description ?? '' }),
    internalId: of('internalId', { text: a => a.internalId }),
    originalNumber: of('originalNumber', { text: arrivalCodeText }),
    imported: of('imported', { text: importedText }),
    restricted: of('restricted', { text: restrictedText }),
    /* Names without the role in brackets, and moments with their time of day, as
       the cells show them. */
    createdBy: of('createdBy', { text: a => personText(a.createdBy) }),
    createdAt: of('createdAt', { text: a => fmtDateTime(a.createdAt) }),
    updatedBy: of('updatedBy', { text: a => personText(modifiedByOf(a)) }),
    updatedAt: of('updatedAt', { text: a => fmtDateTime(modifiedAtOf(a)) }),
    parent: {
      key: 'parent',
      label: 'Parent',
      info: 'The number of the summary account this one rolls up into. Blank at the top of the chart.',
      columns: [{ label: 'Parent', text: read.parentNumber }],
    },
  }

  return EXPORT_FIELD_ORDER.map(k => fields[k])
}

/** What the picker opens ticked: the columns the listing is drawing, and the
 *  locked one it cannot be asked about. */
export function exportOpensChecked(listingVisibility: Record<string, boolean>): Set<string> {
  const next = new Set<string>()
  for (const key of EXPORT_FIELD_ORDER) {
    if (LOCKED_KEYS.has(key) || listingVisibility[key]) next.add(key)
  }
  return next
}

const AUTO_SCROLL_ZONE = 40   // px from an edge before the list starts scrolling
const AUTO_SCROLL_MAX_SPEED = 12 // px per frame at the very edge
const DRAG_THRESHOLD_PX = 5   // travel before a press becomes a drag rather than a click

/* ── Small pieces ────────────────────────────────────────────────────────── */

/** Native checkbox on the app's own `.coa-check` styling, with a third state. */
function Check({ checked, indeterminate, disabled, onChange, label }: {
  checked: boolean; indeterminate?: boolean; disabled?: boolean; onChange?: () => void; label: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="coa-check shrink-0"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={() => onChange?.()}
    />
  )
}

/** Yellow-mark the part of a label the search matched. */
function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim()
  if (!q) return text
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) => i % 2 === 1
        ? <mark key={i} className="px-0.5 rounded-sm" style={{ backgroundColor: '#FEFCE8', color: '#854D0E', fontWeight: 500 }}>{part}</mark>
        : <span key={i}>{part}</span>)}
    </>
  )
}

function FormatCardRow({ card, isSelected, onSelect }: {
  card: (typeof FORMAT_CARDS)[number]; isSelected: boolean; onSelect: () => void
}) {
  const t = FORMAT_THEMES[card.key]
  const [isHovered, setIsHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full text-left rounded-[12px] border p-3.5 transition-all duration-150 cursor-pointer"
      style={{
        borderColor: isSelected ? '#0A77FF' : isHovered ? '#CBD5E1' : '#E2E8F0',
        borderWidth: 1,
        backgroundColor: isSelected ? '#F5F9FF' : isHovered ? '#FAFCFF' : '#FFFFFF',
        boxShadow: isSelected
          ? '0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)'
          : isHovered
            ? '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)'
            : '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)',
      }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <span
          className="inline-flex items-center justify-center w-9 h-9 rounded-[8px] text-[10px] tracking-[0.04em]"
          style={{ backgroundColor: t.badgeBg, color: t.badgeText, fontWeight: 700 }}
        >
          {card.badge}
        </span>
        <span
          className="shrink-0 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center mt-1"
          style={{ borderColor: isSelected ? t.radio : '#CBD5E1' }}
        >
          {isSelected && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.radio }} />}
        </span>
      </div>
      <div className="text-[13px] leading-[18px]" style={{ fontWeight: 600, color: '#0F172A' }}>{card.title}</div>
      <div className="text-[11.5px] leading-[15px] mt-1" style={{ color: '#64748B', fontWeight: 400 }}>{card.description}</div>
    </button>
  )
}

function FieldCard({ col, checked, isDragging, onCardPointerDown, searchQuery, showQuickReorder, onMoveToTop, onMoveToBottom, isRecentlyMoved }: {
  col: ExportField
  checked: boolean
  isDragging: boolean
  /* Card-wide pointerdown opens a drag-or-click session; the parent decides on
     pointer-up which it was, by whether the pointer crossed the threshold. */
  onCardPointerDown: (e: React.PointerEvent, key: string) => void
  searchQuery: string
  showQuickReorder: boolean
  onMoveToTop: () => void
  onMoveToBottom: () => void
  isRecentlyMoved: boolean
}) {
  const isLocked = !!col.locked
  const [isHovered, setIsHovered] = useState(false)
  // Locked, dragging and just-moved cards opt out, so hover does not fight
  // their own indicators.
  const showHover = isHovered && !isLocked && !isDragging && !isRecentlyMoved

  const borderColor = isRecentlyMoved ? '#007FFF' : showHover ? '#CBD5E1' : checked ? '#BFDBFE' : '#E2E8F0'

  return (
    <div
      data-field-id={col.key}
      onPointerDown={e => onCardPointerDown(e, col.key)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-150 ${
        isLocked ? 'cursor-default' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${isDragging ? 'opacity-40 scale-[0.97]' : ''} ${isRecentlyMoved ? 'ring-2 ring-[#007FFF]/60' : ''}`}
      style={{
        backgroundColor: isDragging ? 'rgba(10,119,255,0.04)' : showHover ? '#FAFCFF' : '#FFFFFF',
        border: isDragging ? '1px dashed rgba(10,119,255,0.4)' : `1px solid ${borderColor}`,
        boxShadow: isDragging ? 'none' : showHover ? '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' : undefined,
      }}
    >
      {/* Affordance only: the whole card drives the drag. */}
      <div
        className={`shrink-0 flex items-center justify-center w-5 h-5 transition-colors ${
          isLocked ? 'text-[#E2E8F0]' : isDragging ? 'text-[#475569]' : 'text-[#94A3B8] group-hover:text-[#475569]'
        }`}
        aria-hidden="true"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div style={isLocked && checked ? { opacity: 0.55 } : undefined}>
        <Check checked={checked} disabled={isLocked} label={`Select ${col.label}`} />
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isLocked && (
          <Tooltip layer="menu" content="Account name is always included. It is how each account is identified in the file.">
            <span
              onPointerDown={e => e.stopPropagation()}
              className="shrink-0 inline-flex items-center justify-center cursor-help"
              aria-label="Locked"
            >
              <Lock className="w-3.5 h-3.5" style={{ color: '#94A3B8' }} />
            </span>
          </Tooltip>
        )}
        <span className="text-[13px] truncate" style={{ color: isLocked ? '#64748B' : '#0F172A', fontWeight: 500 }}>
          {highlightMatch(col.label, searchQuery)}
        </span>
        {col.info && (
          <Tooltip layer="menu" content={col.info}>
            <span
              onPointerDown={e => e.stopPropagation()}
              className="shrink-0 inline-flex items-center justify-center cursor-help"
              aria-label={`About ${col.label}`}
            >
              <Info className="w-3.5 h-3.5" style={{ color: '#94A3B8' }} />
            </span>
          </Tooltip>
        )}
      </div>

      {/* Reaching the top of a long list by dragging is the thing these avoid,
          so they only appear once a card is far enough down to need them. */}
      {!isLocked && showQuickReorder && (
        <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip layer="menu" content="Move to Top">
            <button
              type="button"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onMoveToTop() }}
              className="w-6 h-6 rounded-[6px] border bg-white flex items-center justify-center text-[#475569] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              style={{ borderColor: '#F1F5F9' }}
              aria-label="Move to Top"
            >
              <ChevronsUp className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip layer="menu" content="Move to Bottom">
            <button
              type="button"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onMoveToBottom() }}
              className="w-6 h-6 rounded-[6px] border bg-white flex items-center justify-center text-[#475569] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              style={{ borderColor: '#F1F5F9' }}
              aria-label="Move to Bottom"
            >
              <ChevronsDown className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  )
}

function scopeBannerOf(scope: ExportScope | null): { count: string; subtext: string } | null {
  if (!scope) return null
  const word = (n: number) => (n === 1 ? 'account' : 'accounts')
  if (scope.kind === 'filtered') {
    return {
      count: `${scope.filteredCount} ${word(scope.filteredCount)}`,
      subtext: 'Only the accounts matching your current filters will be exported',
    }
  }
  if (scope.kind === 'selected') {
    return {
      count: `${scope.selectedCount} ${word(scope.selectedCount)}`,
      subtext: 'Only the accounts you selected will be exported',
    }
  }
  return {
    count: `${scope.totalCount} ${word(scope.totalCount)}`,
    subtext: 'Every account on your list will be exported',
  }
}

/* What the picker opens on when no caller hands it a listing to read. The
   listing's own default set, not a second list of keys - which is how the two
   drifted apart: the export used to open on Category, Currency and Direct
   Posting long after the listing had hidden all three, and left Number range,
   Role, Normal balance and Opening balance unticked while it was showing them. */
const DEFAULT_LISTING_VISIBILITY = DEFAULT_COLUMNS as unknown as Record<string, boolean>

/* ── The modal ───────────────────────────────────────────────────────────── */

export function ExportAccountsModal({ open, onClose, accounts, scope, columnVisibility }: {
  open: boolean
  onClose: () => void
  /** Already resolved by the caller from the scope: all, filtered, or selected. */
  accounts: Account[]
  scope?: ExportScope | null
  /** The listing's own column visibility, so the picker opens on what is on screen. */
  columnVisibility?: Record<string, boolean>
}) {
  const base = useStore(s => s.company.baseCurrency)
  const pushToast = useStore(s => s.pushToast)
  const dimensions = useStore(s => s.dimensions)

  /* The whole chart, structure and rolled figures both. Read here rather than
     off `accounts`, which is only the rows this export is scoped to: a parent is
     usually outside a selection of one, and a summary's total is the sum of
     children a selection need not contain. */
  const scopedAccounts = usePeriodScopedAccounts()
  const chart = useMemo(() => buildChartIndex(scopedAccounts), [scopedAccounts])

  /* Where a row sits in the chart, written as the parent's number so the file
     can be read back in. Blank at the top of the chart.

     Mahad, 2026-09-24: *"Exporting a single account drops its parent."* Looked
     up in the export's own rows, the parent of the only row selected was never
     among them, and the column came back empty on every export narrow enough to
     need it. */
  const parentNumberOf = useCallback(
    (a: Account) => (a.parentId ? chart.byId.get(a.parentId)?.accountNumber ?? '' : ''),
    [chart],
  )

  /* A figure column, read through the same rollup the listing prints. A summary
     account stores no balance of its own - its figure is the sum of what hangs
     beneath it - so a file reading `a.balance` reported every summary as zero
     while the row above it on screen showed the real total.

     Mahad, 2026-09-24: *"Exports show summary totals as zero."*

     No figures at all means print none: a summary that has stopped totalling
     shows a blank cell on the listing, and a zero here would be the file
     asserting a total the chart is deliberately not claiming. */
  const figureCol = useCallback(
    (pick: (f: ChartFigures) => number) => ({
      text: (a: Account) => { const f = chartRowValues(a, chart); return f ? String(pick(f)) : '' },
      number: (a: Account) => { const f = chartRowValues(a, chart); return f ? pick(f) : null },
      // A page is read by a person, so it prints money the way the listing does.
      display: (a: Account) => { const f = chartRowValues(a, chart); return f ? fmtCurrencyExact(pick(f), base) : '' },
      numFmt: MONEY_FMT,
    }),
    [chart, base],
  )

  // The running balance in the account's own currency, for the accounts not
  // held in the base one. Rolled first, then converted: a summary's foreign
  // total is the conversion of what it totals.
  const fxCol = useMemo(() => {
    const booked = (a: Account) => {
      const f = chartRowValues(a, chart)
      if (!f || a.currencyCode === base) return null
      // A posting account counts what was typed in its own currency as typed.
      return a.isPosting ? currentOwnBalanceOf(a) : bookedFromBase(f.current, a.currencyCode)
    }
    return {
      text: (a: Account) => { const v = booked(a); return v == null ? '' : String(v) },
      number: booked,
      display: (a: Account) => { const v = booked(a); return v == null ? '' : fmtCurrencyExact(v, a.currencyCode) },
      numFmt: MONEY_FMT,
    }
  }, [chart, base])

  /* The day the running balance is struck at: today, whatever the period
     (Mahad, 2026-10-11). Printed on the PDF, where the figures have nothing else
     to say which day they belong to. */
  const period = useSelectedPeriod()
  const asOf = fmtDate(todayIso())
  /* The opening figure is struck at the other end of the period: the balance
     before the period's first posting. Mahad, 2026-09-30: *"The PDF's Opening
     balance column has no date. The header says balances are as of Sep 30, but
     the opening balance is as of Sep 1."* So each figure column is dated by
     name, and only the columns the file carries are named. */
  const openedOn = fmtDate(period.startDate)
  const figureDates = (picked: Set<string>) => {
    const named = (keys: ColKey[]) => keys.filter(k => picked.has(k)).map(k => HEADER_DEFS[k].label).join(' and ')
    const opening = named(['openingBalance'])
    const closing = named(['runningBalance', 'fxBalance'])
    return [opening && `${opening} as of ${openedOn}`, closing && `${closing} as of ${asOf}`].filter(Boolean).join(' · ') || undefined
  }

  const dimensionText = useMemo(() => {
    const nameOf = new Map(dimensions.map(d => [d.id, d.name]))
    return (a: Account) =>
      a.defaultDimensionValues
        .map(v => {
          const label = nameOf.get(v.dimensionId) ?? v.dimensionId
          return v.value ? `${label}: ${v.value}` : label
        })
        .join('; ')
  }, [dimensions])

  const COLUMNS = useMemo(
    () => buildExportFields({ parentNumber: parentNumberOf, dimensions: dimensionText, figure: figureCol, fx: fxCol }),
    [parentNumberOf, dimensionText, figureCol, fxCol],
  )

  const byKey = useMemo(() => new Map(COLUMNS.map(c => [c.key, c])), [COLUMNS])

  /* The picker opens on the columns the listing is showing, plus the locked one -
     Mahad, 2026-09-24: *"Pre-selected are ones that are in the default view in
     listing."* The listing answers for its own columns outright; it used to be
     asked only to veto a separate list kept here, so a column the reader had put
     on screen still arrived unticked. */
  const defaultChecked = useCallback(
    () => exportOpensChecked(columnVisibility ?? DEFAULT_LISTING_VISIBILITY),
    [columnVisibility],
  )

  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [checked, setChecked] = useState<Set<string>>(defaultChecked)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [fieldOrder, setFieldOrder] = useState<string[]>(() => COLUMNS.map(c => c.key))
  const [draggedKey, setDraggedKey] = useState<string | null>(null)
  /* The order while a drag is in flight. Rows reflow as it changes and it is
     committed to `fieldOrder` on pointer-up. */
  const [liveOrder, setLiveOrder] = useState<string[] | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [recentlyMovedKey, setRecentlyMovedKey] = useState<string | null>(null)

  /* Read by the global pointermove handler, which would otherwise close over
     stale state. */
  const liveOrderRef = useRef<string[] | null>(null)
  const draggedKeyRef = useRef<string | null>(null)
  const fieldOrderRef = useRef(fieldOrder)
  const pointerYRef = useRef(0)
  const autoScrollRaf = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const recentMoveTimer = useRef<number | null>(null)
  liveOrderRef.current = liveOrder
  draggedKeyRef.current = draggedKey
  fieldOrderRef.current = fieldOrder

  useEffect(() => {
    if (!open) return
    setFormat('pdf')
    setChecked(defaultChecked())
    setSearch('')
    setFieldOrder(COLUMNS.map(c => c.key))
    setDraggedKey(null)
    setLiveOrder(null)
    setIsFullScreen(false)
    setRecentlyMovedKey(null)
    setExporting(false)
    if (recentMoveTimer.current !== null) {
      window.clearTimeout(recentMoveTimer.current)
      recentMoveTimer.current = null
    }
  }, [open, COLUMNS, defaultChecked])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const banner = scopeBannerOf(scope ?? { kind: 'all', totalCount: accounts.length })
  const theme = FORMAT_THEMES[format]

  /** The chosen fields, in the reader's order, as the columns they write. */
  const exportCols = useMemo(
    () => fieldOrder.filter(k => checked.has(k)).flatMap(k => byKey.get(k)?.columns ?? []),
    [fieldOrder, checked, byKey],
  )

  const handleExport = async () => {
    if (exporting || exportCols.length === 0 || accounts.length === 0) return
    setExporting(true)
    try {
      if (format === 'csv') {
        exportCsv(accounts, exportCols, 'Chart_of_Accounts')
      } else if (format === 'excel') {
        await exportExcel(accounts, exportCols, 'Chart_of_Accounts', 'Accounts')
      } else {
        await exportPdf(accounts, exportCols, 'Chart_of_Accounts', 'Chart of Accounts Export', figureDates(checked))
      }
      pushToast(`Exported ${exportFilename('Chart_of_Accounts', format === 'excel' ? 'xlsx' : format)}`, 'success')
      onClose()
    } catch (err) {
      console.error('Export failed', err)
      pushToast('Export failed. Please try again.', 'danger')
    } finally {
      setExporting(false)
    }
  }

  const exportLabel = exporting
    ? 'Exporting…'
    : format === 'pdf' ? 'Export as PDF' : format === 'excel' ? 'Export as Excel' : 'Export as CSV'

  /* ── Picker derived data ───────────────────────────────────────────────── */

  const normalizedQuery = search.trim().toLowerCase()
  const currentOrder = liveOrder ?? fieldOrder
  const orderedCols = useMemo(
    () => currentOrder.map(k => byKey.get(k)).filter((c): c is ExportField => !!c),
    [currentOrder, byKey],
  )
  const shown = useMemo(
    () => (normalizedQuery ? orderedCols.filter(c => c.label.toLowerCase().includes(normalizedQuery)) : orderedCols),
    [orderedCols, normalizedQuery],
  )
  const noResults = shown.length === 0

  // The master checkbox speaks for what the search has left on screen, not for
  // the whole catalogue.
  const visibleSelectable = shown.filter(c => !c.locked)
  const allVisibleSelected = visibleSelectable.length > 0 && visibleSelectable.every(c => checked.has(c.key))
  const someVisibleSelected = visibleSelectable.some(c => checked.has(c.key)) && !allVisibleSelected

  const handleSelectAllToggle = () => {
    setChecked(prev => {
      const next = new Set(prev)
      for (const c of visibleSelectable) allVisibleSelected ? next.delete(c.key) : next.add(c.key)
      return next
    })
  }

  /* ── Drag reorder ──────────────────────────────────────────────────────── */

  const startAutoScroll = useCallback(() => {
    const tick = () => {
      const el = listRef.current
      if (!el || !draggedKeyRef.current) { autoScrollRaf.current = null; return }
      const rect = el.getBoundingClientRect()
      const y = pointerYRef.current
      const fromTop = y - rect.top
      const fromBottom = rect.bottom - y
      if (fromTop < AUTO_SCROLL_ZONE && fromTop > 0) {
        el.scrollTop -= Math.round(AUTO_SCROLL_MAX_SPEED * (1 - fromTop / AUTO_SCROLL_ZONE))
      } else if (fromBottom < AUTO_SCROLL_ZONE && fromBottom > 0) {
        el.scrollTop += Math.round(AUTO_SCROLL_MAX_SPEED * (1 - fromBottom / AUTO_SCROLL_ZONE))
      }
      autoScrollRaf.current = requestAnimationFrame(tick)
    }
    if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current)
    autoScrollRaf.current = requestAnimationFrame(tick)
  }, [])

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRaf.current) { cancelAnimationFrame(autoScrollRaf.current); autoScrollRaf.current = null }
  }, [])

  /* Reorder by comparing the pointer to each other row's midpoint. Skipping the
     dragged row makes a deadzone over its own slot, so the card sits under the
     pointer instead of jumping a slot away on the first move. */
  const performReorder = useCallback((clientY: number) => {
    const el = listRef.current
    const key = draggedKeyRef.current
    if (!el || !key) return

    const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-field-id]')).filter(r => {
      const id = r.getAttribute('data-field-id')
      return id !== null && id !== key && !LOCKED_KEYS.has(id)
    })
    if (rows.length === 0) return

    let insertAt = rows.length
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) { insertAt = i; break }
    }

    setLiveOrder(prev => {
      if (!prev) return prev
      const locked = prev.filter(k => LOCKED_KEYS.has(k))
      const rest = prev.filter(k => !LOCKED_KEYS.has(k) && k !== key)

      // Translate the on-screen position into one in the full list, so a search
      // that hides rows does not drop the hidden ones out of their places.
      let at: number
      if (insertAt >= rows.length) {
        const lastKey = rows[rows.length - 1].getAttribute('data-field-id')
        const idx = lastKey ? rest.indexOf(lastKey) : -1
        at = idx === -1 ? rest.length : idx + 1
      } else {
        const targetKey = rows[insertAt].getAttribute('data-field-id')
        const idx = targetKey ? rest.indexOf(targetKey) : -1
        at = idx === -1 ? rest.length : idx
      }

      const next = [...rest]
      next.splice(at, 0, key)
      const order = [...locked, ...next]
      return order.length === prev.length && order.every((k, i) => k === prev[i]) ? prev : order
    })
  }, [])

  /* A press is not yet a drag. Committing only after DRAG_THRESHOLD_PX means a
     plain click anywhere on the card still toggles it. */
  const handleCardPointerDown = useCallback((e: React.PointerEvent, key: string) => {
    if (e.button !== 0 || LOCKED_KEYS.has(key)) return
    const startX = e.clientX
    const startY = e.clientY
    let activated = false

    const handleMove = (ev: PointerEvent) => {
      if (!activated) {
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < DRAG_THRESHOLD_PX) return
        activated = true
        setDraggedKey(key)
        setLiveOrder(fieldOrderRef.current)
        pointerYRef.current = ev.clientY
        startAutoScroll()
        document.body.style.userSelect = 'none'
      }
      pointerYRef.current = ev.clientY
      performReorder(ev.clientY)
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      document.body.style.userSelect = ''
      if (activated) {
        const final = liveOrderRef.current
        if (final) setFieldOrder(final)
        setDraggedKey(null)
        setLiveOrder(null)
        stopAutoScroll()
      } else {
        setChecked(prev => {
          const next = new Set(prev)
          next.has(key) ? next.delete(key) : next.add(key)
          return next
        })
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }, [startAutoScroll, stopAutoScroll, performReorder])

  const smoothScrollTo = (el: HTMLElement, targetTop: number, duration = 800) => {
    const start = el.scrollTop
    const distance = targetTop - start
    if (Math.abs(distance) < 1) return
    const startTime = performance.now()
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      el.scrollTop = start + distance * easeOutCubic(progress)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  const flashRecentlyMoved = (key: string) => {
    setRecentlyMovedKey(key)
    if (recentMoveTimer.current !== null) window.clearTimeout(recentMoveTimer.current)
    recentMoveTimer.current = window.setTimeout(() => {
      setRecentlyMovedKey(null)
      recentMoveTimer.current = null
    }, 1500)
  }

  /* The list is scrolled back to where it was before the reorder, then animated
     to the end the card went to, so the reader can see it arrive. */
  const moveTo = (key: string, edge: 'top' | 'bottom') => {
    if (LOCKED_KEYS.has(key)) return
    const el = listRef.current
    const startScroll = el?.scrollTop ?? 0
    setFieldOrder(prev => {
      const next = prev.filter(k => k !== key)
      if (edge === 'bottom') { next.push(key); return next }
      let at = 0
      while (at < next.length && LOCKED_KEYS.has(next[at])) at++
      next.splice(at, 0, key)
      return next
    })
    flashRecentlyMoved(key)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!el) return
      el.scrollTop = startScroll
      smoothScrollTo(el, edge === 'top' ? 0 : el.scrollHeight)
    }))
  }

  if (!open) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] coa-scrim animate-overlay-in" onClick={onClose} />
      <div className="fixed inset-0 z-[61] flex items-center justify-center pointer-events-none">
        <div
          data-export-panel
          className="bg-white flex flex-col overflow-hidden pointer-events-auto animate-modal-in transition-[max-width,max-height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            width: '100vw',
            height: '100vh',
            maxWidth: isFullScreen ? 'calc(100vw - 2rem)' : '1024px',
            maxHeight: isFullScreen ? 'calc(100vh - 2rem)' : 'min(860px, calc(100vh - 48px))',
            borderRadius: 16,
            boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
          }}
        >
          {/* ── Header ── */}
          <div className="px-4 lg:px-5 pt-4 pb-4 shrink-0 bg-white border-b border-[#EEF2F6]" style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                  <Download className="w-[18px] h-[18px]" style={{ color: '#2563EB' }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>Export Accounts</h2>
                  <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                    Choose a format and the columns to include. Your export covers the accounts shown on the list now, with any filters or search you have applied.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setIsFullScreen(v => !v)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {isFullScreen ? 'Exit Full' : 'Full View'}
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 min-h-0 bg-[#FAFBFC] overflow-hidden px-4 lg:px-6 py-4 lg:py-5 flex flex-col gap-4">
            {banner && (
              <div
                className="shrink-0 rounded-[10px] border px-4 py-2.5 flex items-center gap-2.5 transition-colors hover:bg-[#ECF0F4] hover:border-[#D6DCE5]"
                style={{ backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
              >
                <ListTree className="w-[18px] h-[18px] shrink-0" style={{ color: '#64748B' }} />
                <div className="flex-1 min-w-0 text-[13px] leading-[20px] truncate text-left" style={{ color: '#1E293B' }}>
                  <span style={{ fontWeight: 600 }}>{banner.count}</span>{' '}
                  <span style={{ color: '#64748B', fontWeight: 400 }}>({banner.subtext})</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5 flex-1 min-h-0">
              {/* ── Left: format ── */}
              <div className="rounded-[12px] border bg-white flex flex-col overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                <div className="px-5 pt-3 pb-3 shrink-0 flex items-center gap-2" style={{ backgroundColor: '#F8FAFC' }}>
                  <FileType className="w-4 h-4 shrink-0" style={{ color: '#64748B' }} />
                  <h3 className="text-[14px]" style={{ color: '#0F172A', fontWeight: 600 }}>File Format</h3>
                </div>
                <div className="border-t shrink-0" style={{ borderColor: '#E2E8F0' }} />
                <div className="flex-1 overflow-y-auto px-5 pb-3 pt-4" style={{ minHeight: 0 }}>
                  <div className="space-y-3">
                    {FORMAT_CARDS.map(card => (
                      <FormatCardRow key={card.key} card={card} isSelected={format === card.key} onSelect={() => setFormat(card.key)} />
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Right: columns ── */}
              <div className="rounded-[12px] border bg-white flex flex-col overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                <div className="px-5 pt-3 pb-3 shrink-0 flex items-center gap-2" style={{ backgroundColor: '#F8FAFC' }}>
                  <Columns3 className="w-4 h-4 shrink-0" style={{ color: '#64748B' }} />
                  <h3 className="text-[14px]" style={{ color: '#0F172A', fontWeight: 600 }}>Columns to Include</h3>
                </div>
                <div className="border-t shrink-0" style={{ borderColor: '#E2E8F0' }} />

                <div className="px-5 pt-4 pb-2 shrink-0">
                  <div className="flex items-center gap-2 px-3 h-9 rounded-[8px] border bg-white" style={{ borderColor: '#E2E8F0' }}>
                    <Search className="w-4 h-4 text-[#94A3B8]" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search columns"
                      className="flex-1 outline-none text-[13px] bg-transparent"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="p-0.5 rounded-full hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#475569] transition-colors cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-5 py-2 flex items-center gap-2 shrink-0">
                  <Check
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onChange={handleSelectAllToggle}
                    label="Select All Columns"
                  />
                  <span className="text-[12px]" style={{ color: '#475569', fontWeight: 500 }}>
                    {allVisibleSelected
                      ? `All ${COLUMNS.length} columns selected`
                      : checked.size > 0
                        ? `${checked.size} of ${COLUMNS.length} columns selected`
                        : 'Select All Columns'}
                  </span>
                </div>

                {checked.size === 0 && !noResults && (
                  <div className="px-5 py-2 border-b shrink-0" style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A', color: '#92400E' }}>
                    <span className="text-[12px]" style={{ fontWeight: 500 }}>Pick at least one column to export.</span>
                  </div>
                )}

                <div
                  ref={listRef}
                  className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5"
                  style={{ minHeight: 0, scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent', overflowAnchor: 'none' }}
                >
                  {noResults ? (
                    <div className="px-4 py-12 text-center text-[12.5px]" style={{ color: '#94A3B8' }}>
                      No Columns Match Your Search.
                    </div>
                  ) : (
                    shown.map((col, idx) => (
                      <FieldCard
                        key={col.key}
                        col={col}
                        checked={checked.has(col.key)}
                        isDragging={draggedKey === col.key}
                        onCardPointerDown={handleCardPointerDown}
                        searchQuery={search}
                        showQuickReorder={idx >= 6}
                        onMoveToTop={() => moveTo(col.key, 'top')}
                        onMoveToBottom={() => moveTo(col.key, 'bottom')}
                        isRecentlyMoved={recentlyMovedKey === col.key}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div
            className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-2.5"
            style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
          >
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={checked.size === 0 || exporting || accounts.length === 0}
              className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600, backgroundColor: theme.button }}
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {exportLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
