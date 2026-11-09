import { Fragment, cloneElement, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { useRememberedState } from '../lib/rememberedState'
import { postingDimensions } from '../lib/dimensionDefaults'
import { createPortal } from 'react-dom'
import { Book, Search, BarChart3, Banknote, Columns3, ChevronDown, Check, X, GripVertical, ArrowUp, ArrowDown, ArrowUpDown, ChevronRight, Plus, FileText, UnfoldVertical, FoldVertical, Info, MoreHorizontal, Printer, Undo2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { ReverseEntryFlow } from '../components/ReverseEntryFlow'
import { Button, Card, Marked, Menu, MenuItem, Tooltip, useResponsiveIconSize } from '../components/ui'
import { PeriodStrip, LEDGER_PERIOD_HINT, LEDGER_PERIOD_COPY } from '../components/PeriodStrip'
import { ColumnSelector } from '../components/ColumnSelector'
import { DensityMenu } from '../components/DensityMenu'
import { COUNT_BADGE, TOOL_BTN, TOOL_BTN_ACTIVE, lookSections, rowNumberGutter, useCrosshair, useTableLook } from '../components/tableLook'
import { LinkedDocLink } from '../components/LinkedDoc'
import { HeaderMenu, filterActive, CategoryCell, ColumnFiltersBar, CurrencyCell, DimensionPills, ExpandToggle, type ColFilter, type ColFilterType } from '../components/AccountTable'
import { Section, FDivider, PillGrid, FilterPill as ModalFilterPill, AllPill, RangeMinMax, QuickFilterPill, DateRangeFromTo, FiltersButton, AuditFacet } from '../components/Filters'
import { PersonCell, StampCell, PERSON_PAD, personText, stampText } from '../components/AuditCells'
import { SearchRevealNote, orderWithRevealed, useSearchReveal } from '../components/SearchReveal'
import { searchMatcher } from '../lib/tableSearch'
import { useBlockWindow } from '../components/useBlockWindow'
import { BLOCK_SIZE } from '../lib/blockWindow'
import { MultiSelectFilter } from '../components/MultiSelectFilter'
import {
  PerformanceInsights, KpiInsightsPanel, DEFAULT_GL_KPIS, ALL_GL_KPIS,
  type GlKpiCtx, type GlKpiTarget,
} from '../components/GlInsights'
import { useNavigate } from 'react-router-dom'
import { NewJournalEntryModal } from '../components/NewJournalEntryModal'
import { useSelectedPeriod, useStore, useAccountNumberText } from '../store'
import { Account, Transaction, ACCOUNT_TYPE_META, AccountCategory, CATEGORY_ORDER } from '../types'
import { adjustmentKind, reversedByOf, reversedNumberFromMemo, entryChangesOf, entryCreatedAt, entryCreatedBy, entryMemo, reconstructEntry, type AdjustmentKind } from '../lib/journalEntry'
import { ADJUSTMENT_BADGE_LABEL, AdjustmentBadge } from '../components/AdjustmentBadge'
import { SOURCE_DOC, sourceDocLabel, sourceDocName } from '../lib/seed'
import { JOURNAL_INTERNAL_ID_LABEL, journalInternalIdSeq } from '../lib/internalId'
import { TagChip } from '../components/EntityTagChip'
import { useColumnDragReorder, DragGhost, draggedHeaderStyle, DragBar } from '../components/tableColumns'
import { runningBalanceLedger, comparePostingOrder } from '../lib/monthlyLedger'
import { isInSelection, scopeAccountsToPeriod } from '../lib/periodSelection'
import { cn, fmtCurrency, fmtCurrencyExact, fmtDate, fmtNumber, localDayOf, withinMagnitude } from '../lib/utils'

/* The ledger is read by scanning many rows at once, so it opens condensed - and
   that is now the density control's default rather than the only setting. */
const ROW_PAD_Y = 'py-2'
const ROW_PAD_Y_COMFORT = 'py-3'
const HEADER_ROW_H = '[&>th]:!h-7'
// The two tables this page holds, one per header tab. They are two readings of the
// same postings rather than two layouts of one table, which is why each gets its own
// tab instead of a layout switch:
//   'tree' - General ledger, grouped under the account each posting belongs to, so a
//            reader follows one account's activity and its running balance down the page.
//   'list' - Journal entries, grouped by entry, so a reader sees each entry whole and
//            can check that its two sides balance.
// The keys stay 'tree' / 'list' because the row markup, CSS classes and pin geometry
// are all named after the two layouts.
type ViewMode = 'list' | 'tree'
const GL_TABS: { id: ViewMode; label: string }[] = [
  { id: 'tree', label: 'General ledger' },
  { id: 'list', label: 'Journal entries' },
]
// Whether rows start open or closed; individual toggles are tracked as exceptions
// to this mode so later-revealed rows follow it too.
type ExpandMode = 'expanded' | 'collapsed'

// ── List view horizontal-pin geometry ─────────────────────────────────────
// Chevron and Date pin to the left; Debit and Credit pin to the right. Widths
// are fixed on the four pinned columns so the sticky offsets stay accurate.
const LIST_CHEV_W = 36
const LIST_DATE_W = 130
const LIST_MONEY_W = 100
// The list view's Account column is not pinned, so nothing forced a width on it and
// it grew to the longest name in the ledger. It takes the tree's width instead, which
// is what lets the name truncate and the drag grip actually narrow the column.
const LIST_ACCOUNT_W = 280
// The narrowest a reader may drag a column. A flat floor put every column at 60px,
// which on Account left a number and a single letter of the name - narrow enough to
// stop naming the account it belongs to. Account's floor is the point where a name
// still reads as a name; the rest keep enough to hold their own header.
const MIN_COL_W_DEFAULT = 80
// Account went from 200 to 210 when the chart went to five-digit numbers (2026-09-25):
// the extra digit took 7px from the name, and the floor exists to keep the name.
const MIN_COL_W: Partial<Record<GLColKey, number>> = { account: 210, balance: 130 }
// The list view's counterpart to TREE_PIN_W, for the same reason: a pinned column's
// offset is the sum of the widths beside it, so each one has to be nameable here.
const LIST_PIN_W: Partial<Record<GLColKey, number>> = {
  date: LIST_DATE_W, account: LIST_ACCOUNT_W, debit: LIST_MONEY_W, credit: LIST_MONEY_W,
}

// Tree connector gutter: the x offset of the parent account row's disclosure
// centre (px-4 = 16, half of size-5 = 10), which every guide segment under that
// account hangs from.
const GUIDE_X = 26
// Lines the total row's label up with the account number on the parent row above
// it: the disclosure toggle's width plus the gap that follows it.
const TOTAL_INDENT = 30
// Same edge treatment as the Chart of Accounts frozen columns: a thin border
// followed by a soft outward shadow that only appears once the row scrolls
// under the pinned cell.
const LIST_LEFT_EDGE_SHADOW = 'inset -2px 0 0 0 hsl(var(--border)), 6px 0 8px -8px rgba(15,23,42,0.18)'
const LIST_RIGHT_EDGE_SHADOW = 'inset 1px 0 0 0 hsl(var(--border)), -6px 0 8px -6px rgba(15,23,42,0.12)'
// Body-cell z sits above scrolling content; header-cell z sits above pinned
// body cells so the column header stays legible when both stickies engage.
const Z_LIST_PIN = 3
const Z_LIST_HEAD_PIN = 12

// Columns for the cross-account General Ledger. Account is the key addition
// versus the per-account register - every posting carries its owning account.
type GLColKey = 'date' | 'account' | 'category' | 'source' | 'entry' | 'internalId' | 'reference' | 'description' | 'lineDescription' | 'dimensions' | 'tags' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt' | 'amount' | 'currency' | 'fxAmount' | 'debit' | 'credit' | 'period' | 'balance'
/* Column flags:
     required      - Account: always shown, never moved.
     alwaysShown   - always shown, but the reader may move and freeze it.
     defaultHidden - off until the reader turns it on; search and filters still
                     reach it (design review, 2026-09-24: *"search should include
                     hidden columns"*).
     treeOnly / listOnly - drawn on one tab only.
     info          - the header's (i) tooltip, in plain English. Design review,
                     2026-09-28 - Eli: *"I need very clear, plain English info
                     hover states that tell me what they are."* One line on every
                     column, Mahad, 2026-10-14: *"Can we have one liners for
                     tooltips for all columns? ... plain simple english that is
                     easy to understand."* The columns he then wrote copy for
                     carry his words (2026-10-14).
     treeInfo      - the (i) on the General ledger tab, where it differs. */
const GL_COLS: { key: GLColKey; label: string; right?: boolean; required?: boolean; alwaysShown?: boolean; defaultHidden?: boolean; treeOnly?: boolean; listOnly?: boolean; info?: string; treeInfo?: string }[] = [
  { key: 'date', label: 'Date', info: 'Date the entry posts to the ledger.' },
  { key: 'account', label: 'Account', required: true, info: 'GL account each line of the entry posts to.', treeInfo: 'GL account number and name, with every posting to it grouped underneath.' },
  /* "GL category", not "GL account category", and off by default. Design
     review, 2026-09-24: the long name set the column's minimum width, the
     category pills above the table already filter by it, and the account
     number beside it already says it. */
  { key: 'category', label: 'GL category', defaultHidden: true, info: 'The type of account: asset, liability, equity, revenue or expense.' },
  /* Entries tab only. On the General ledger tab the entry number sits under
     the account, in the posting row's Account cell, where the tree left dead
     space (design review, 2026-09-24 - Eli: *"move the journal entry number
     underneath the account itself"*). */
  /* Mahad, 2026-09-30: *"Change this to journal entry number."* The entry form,
     the entry page and the account's register name it the same way. */
  { key: 'entry', label: 'Journal entry number', listOnly: true, info: 'Reference number that identifies this entry across Omne.' },
  /* Four columns on both tabs, Mahad, 2026-09-30: *"Additional column for
     Journal Internal ID. Column for currency. Column for Amount (Foreign
     currency) - if transaction was in a different currency. Column for tags in
     journal entries. Column for tags in general ledger as well."* ID, currency
     and tags are the entry's, so a General ledger row repeats its entry's; the
     foreign amount there is the row's own line. */
  { key: 'internalId', label: JOURNAL_INTERNAL_ID_LABEL, info: 'Internal system ID for the entry.' },
  /* What kind of thing produced the posting - a manual entry, a vendor bill,
     a payroll run. Filed alongside the entry number so the pair reads together:
     what this event is and how it can be looked up. */
  /* No Description: an entry's text is its Memo and its lines' Line description.
     Design review, 2026-09-28 added one; Mahad, 2026-09-30, removed it: *"Please
     remove description entirly, we will only have memo and line description."* */
  { key: 'source', label: 'Source', info: 'Module that originated the entry, or Manual journal entry for entries created directly in the general ledger.' },
  /* "Linked document" on both tabs. The General ledger tab said "Link
     Description" (Mahad, 2026-09-21), which the design review of 2026-09-24
     read as a slip - Nophil: *"It's not link description. It's link
     document."* - and it is what the entry detail page calls it. */
  { key: 'reference', label: 'Linked document', info: 'Transaction in the source module that generated this entry, such as a vendor payment or payroll run.' },
  /* The entry's memo, read through `entryMemo`. Entries tab only since
     2026-09-30 - Mahad: *"the General Ledger listing page should display line
     item descriptions instead of a header memo ... A memo is suitable at the
     overall Journal Entry level since it applies to the entire transaction,
     whereas individual line items require specific line descriptions."* A General
     ledger row is one debit or credit, so it shows Line description instead. */
  { key: 'description', label: 'Memo', listOnly: true, info: 'Note that describes the journal entry as a whole.' },
  /* Each line's own text. On the entries tab it is shown on the lines when an
     entry is opened - design review, 2026-09-28, Mahreen: *"you have line
     descriptions for each entry, and then you have a memo for the entire
     entry"*. On the General ledger tab, where a row is one line, it takes the
     Memo column's place (see above). */
  { key: 'lineDescription', label: 'Line description', info: 'Note that describes this specific line.' },
  // Off by default, but searched and filterable (the Filters panel has a
  // Dimensions section) - the condition Nophil set for hiding it.
  { key: 'dimensions', label: 'Dimensions', defaultHidden: true, info: 'Reporting labels, such as location or department, taken from the account.' },
  { key: 'tags', label: 'Tags', info: 'Labels used to group and filter entries in reports.' },
  /* Who posted the entry and when, and who changed it last and when - the
     entry's, so every line of it repeats them. Design review, 2026-10-02, Eli,
     looking for the entry he had just posted: *"I should have a user in here ...
     there's no created by?"* Off by default and filterable from the Filters
     panel, as on the chart of accounts. */
  { key: 'createdBy', label: 'Created by', defaultHidden: true, info: 'The person who posted the entry.' },
  { key: 'createdAt', label: 'Created on', defaultHidden: true, info: 'When the entry was posted.' },
  { key: 'updatedBy', label: 'Last updated by', defaultHidden: true, info: 'The person who last changed the entry.' },
  { key: 'updatedAt', label: 'Last updated on', defaultHidden: true, info: 'When the entry was last changed.' },
  /* The entry's total, on the entry's own row, so a collapsed list still says
     how big each entry is. Design review, 2026-09-28 - Eli: *"When it's
     collapsed, it's not showing me the quantity ... the total transaction
     amount is always going to be one number, so why don't we surface that at
     the header?"* It stays on the entry row when the entry is opened; its lines
     carry their own debit and credit and leave it blank. Entries tab only: a
     General ledger row is one posting, which the running balance follows. */
  { key: 'currency', label: 'Currency', info: 'Currency the transaction was recorded in.' },
  { key: 'amount', label: 'Amount', right: true, listOnly: true, info: 'Entry total, which equals the sum of its debits.' },
  /* The three figures are what a ledger is (Mahreen: *"this is what a general
     ledger is about"*), so they cannot be hidden. They are no longer pinned to
     the right by default - Eli: *"Don't pin it here and it won't look as
     weird"* - and the reader can freeze them. */
  { key: 'fxAmount', label: 'Amount (foreign currency)', right: true, info: "Original amount in the transaction currency, shown only when it isn't the base currency." },
  { key: 'debit', label: 'Debit', right: true, alwaysShown: true, info: 'Amount debited to the account, in base currency.' },
  { key: 'credit', label: 'Credit', right: true, alwaysShown: true, info: 'Amount credited to the account, in base currency.' },
  // A running balance only means anything along one account's own postings in date
  // order. The list view interleaves every account under each journal entry, where
  // consecutive rows belong to different accounts and a running figure would be
  // arithmetic across unrelated ledgers - so this column exists in the tree only.
  { key: 'balance', label: 'Running balance', right: true, treeOnly: true, alwaysShown: true, info: 'Account balance after this posting, in base currency.' },
]
/* Where the Journal entries tab puts its columns until the reader moves them.
   Debit and Credit sit near the account they post to, not at the far edge.
   Design review, 2026-09-28 - Eli: *"I would put my credit and debit here
   because it would be right next to the account as opposed to at the end."*
   And the same review settled what sits between: the entry's Memo, then its
   total, Amount, then Debit and Credit (decision 98). Memo had drifted to the
   far right with Amount beside the account; module review, 2026-10-06 (COA-29)
   and Outline 09. The General ledger tab keeps GL_COLS order. */
const LIST_COLUMN_ORDER: GLColKey[] = [
  // The foreign amount and its currency after the figures they restate; the
  // internal ID after the entry number; tags after the text.
  'date', 'account', 'description', 'amount', 'debit', 'credit', 'fxAmount', 'currency', 'entry', 'internalId', 'source', 'reference',
  'lineDescription', 'tags', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'category', 'dimensions', 'period', 'balance',
]

/** Whether a column is drawn on a tab at all. */
const onTab = (c: (typeof GL_COLS)[number], view: 'list' | 'tree') =>
  (view === 'tree' || !c.treeOnly) && (view === 'list' || !c.listOnly)

// ── Tree view horizontal-pin geometry ─────────────────────────────────────
// Same shape as the Chart of Accounts listing, where GL account no. + name stay
// put while the rest of the chart scrolls under them. Here Account pins to the
// left: it carries the disclosure and the connector guides, so scrolling it away
// loses the reader's place in the hierarchy.
//
// Nothing else pins by default. The three figure columns used to pin to the
// right, and on a laptop the pinned pair took most of the width and squeezed
// everything between them. Design review, 2026-09-24 - Eli: *"the account
// should be pinned in the default state, but I wouldn't pin the other ones."*
// A reader who wants them held freezes them, from the header menu or the
// Columns panel, and they join the left run like any frozen column.
//
// The widths below are fixed all the same. Running balance is the widest of the
// three: it is signed and carries the largest figures in the table. All four are
// as narrow as their content allows - Mahad, 2026-09-22: the frustration is
// smaller screens, so a long account name truncates rather than costing the
// descriptive columns their room.
//
// Debit and Credit hold one period's movement for one account, which runs to six
// figures ("$ 845,300" measures 65px at the cell's 12px tabular figures, and the
// px-4 edges take 32 more). Running balance cannot follow them down: its own
// 15-character header measures 95px, so anything under 127 clips the label rather
// than the figures, and the table auto-layout would refuse the width anyway.
const TREE_PIN_W: Partial<Record<GLColKey, number>> = {
  account: 280, debit: 100, credit: 100, balance: 130,
}
// What a column the reader froze from its header menu holds, for the same reason:
// it joins the left run, where each offset is the sum of the widths before it.
const FROZEN_COL_W = 170
// The tree needs its own z tiers because its account rows are already vertically
// sticky at z-index 2 (see `tbody.gl-group.gl-expanded` in index.css). A posting's
// pinned cells must therefore stay *below* that, or they would scroll up over the
// account row stuck to the top of the viewport; the account row's own pinned cells
// have to sit above it.
// The widest a memo line draws before it is cut; see the Memo cell.
const MEMO_MAX_W = 340
const SHRINK_TO_CONTENT = new Set<GLColKey>(['date', 'category', 'entry', 'source', 'reference', 'period'])

/* The Journal entries tab has no pages. It scrolls through every entry, drawing
   them fifty at a time and never more than two blocks at once; a block scrolled
   well past leaves the DOM and comes back when the reader returns to it. Mahad,
   2026-11-03 - see `lib/blockWindow` and `listWindow`. An open entry's lines
   travel with it, so a block is fifty entries, not fifty rows. */

/* Print one journal entry: its header, its lines and its total, on a page of its
   own. Opened in a new window so the ledger behind it keeps its place. */
function printJournalEntry(e: {
  jeNumber: string; date: string; memo: string; source: string; reference: string
  total: number; currency: string
  lines: { account: string; description: string; debit: number; credit: number }[]
}) {
  const w = window.open('', '_blank', 'width=820,height=900')
  if (!w) return
  const esc = (v: string) => v.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  const money = (n: number) => (n ? esc(fmtCurrencyExact(n, e.currency)) : '')
  const rows = e.lines.map(l => `<tr><td>${esc(l.account)}</td><td>${esc(l.description || '')}</td><td class="n">${money(l.debit)}</td><td class="n">${money(l.credit)}</td></tr>`).join('')
  w.document.write(`<!doctype html><html><head><title>${esc(e.jeNumber)}</title><style>
    body{font:13px/1.45 system-ui,sans-serif;color:#0f172a;margin:32px}
    h1{font-size:18px;margin:0 0 4px}.meta{color:#475569;margin:0 0 20px}
    table{width:100%;border-collapse:collapse}th,td{padding:7px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
    th{font-weight:600;color:#475569;font-size:12px}.n{text-align:right;font-variant-numeric:tabular-nums}
    tfoot td{font-weight:700;border-bottom:0}
  </style></head><body>
    <h1>Journal entry ${esc(e.jeNumber)}</h1>
    <p class="meta">${esc(fmtDate(e.date))} · ${esc(e.source)}${e.reference ? ' · ' + esc(e.reference) : ''}${e.memo ? '<br>' + esc(e.memo) : ''}</p>
    <table><thead><tr><th>Account</th><th>Line description</th><th class="n">Debit</th><th class="n">Credit</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="n">${money(e.total)}</td><td class="n">${money(e.total)}</td></tr></tfoot></table>
  </body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

/* The insight cards the page opens with: none. See `activeKpis`. */
export const GL_KPIS_OPEN_ON: string[] = []

const Z_TREE_PIN = 1
const Z_TREE_PARENT_PIN = 3
// Which kind of row a pinned cell belongs to, which is what decides its z tier.
type PinRow = 'body' | 'parent' | 'header'

// Ledger filter facets, driven by the Filters modal. Mirrors the Partners
// FiltersModal structure: a posting-side chip row, an amount min/max range, and
// a posted-on date range. No Period: the accounting period strip already scopes
// the table (Mahad, 2026-10-09). (Category lives in the
// quick-filter pill row, matching Chart of Accounts where the category pills sit
// outside the modal. Source and free-text matching are filtered from their
// column headers instead.)
type PostingSide = 'debit' | 'credit'
interface GLFilters {
  sides: PostingSide[]
  amountMin: string
  amountMax: string
  dateFrom: string
  dateTo: string
  /* Dimension values, each as `dimensionId:value`. Filterable here because the
     column ships hidden (design review, 2026-09-24 - Mahreen: *"Dimensions
     should be a filter"*; Nophil: hidden *"if it's still searchable and
     filterable"*). Values of one dimension widen each other; two dimensions
     narrow, as the Chart of Accounts filters do. */
  dims: string[]
  /* Who posted the entry and when, and who changed it last and when, as the
     chart of accounts' panel asks it. Days are the day it was posted, not the
     date it is dated - that is Posted on, above. */
  createdBy: string[]
  createdFrom: string
  createdTo: string
  updatedBy: string[]
  updatedFrom: string
  updatedTo: string
}
const EMPTY_GL_FILTERS: GLFilters = {
  sides: [], amountMin: '', amountMax: '', dateFrom: '', dateTo: '', dims: [],
  createdBy: [], createdFrom: '', createdTo: '', updatedBy: [], updatedFrom: '', updatedTo: '',
}
const dimKey = (dimensionId: string, value: string) => `${dimensionId}:${value}`
/* What the Filters panel holds. The amount range is not counted: it lives on the
   toolbar now (see AmountRangeControl), and a count on the Filters button for a
   control that is not in the panel would send the reader looking for it there. */
const countGlFilters = (f: GLFilters) =>
  f.sides.length + f.dims.length +
  (f.dateFrom || f.dateTo ? 1 : 0) +
  f.createdBy.length + (f.createdFrom || f.createdTo ? 1 : 0) +
  f.updatedBy.length + (f.updatedFrom || f.updatedTo ? 1 : 0)
/** Clears what the Filters panel holds and leaves the toolbar's amount range. */
const clearPanelGlFilters = (f: GLFilters): GLFilters => ({ ...EMPTY_GL_FILTERS, amountMin: f.amountMin, amountMax: f.amountMax })

// Shared predicate: does a posting pass the modal filters? Used by both the live
// table (`filtered`) and the modal's footer count so the two never diverge.
function matchesGlFilters(t: Transaction, f: GLFilters, changes: EntryChanges, amountOf?: number): boolean {
  if (f.sides.length) {
    const wantsDebit = f.sides.includes('debit')
    const wantsCredit = f.sides.includes('credit')
    const isDebit = t.debit > 0
    const isCredit = t.credit > 0
    if (!((wantsDebit && isDebit) || (wantsCredit && isCredit))) return false
  }
  const amount = amountOf ?? Math.max(t.debit, t.credit)
  if (!withinMagnitude(amount, f.amountMin, f.amountMax)) return false
  if (f.dateFrom && t.date < f.dateFrom) return false
  if (f.dateTo && t.date > f.dateTo) return false
  if (f.createdBy.length && !f.createdBy.includes(personText(entryCreatedBy(t)))) return false
  if (f.createdFrom || f.createdTo) {
    const day = localDayOf(entryCreatedAt(t))
    if (f.createdFrom && day < f.createdFrom) return false
    if (f.createdTo && day > f.createdTo) return false
  }
  if (f.updatedBy.length || f.updatedFrom || f.updatedTo) {
    const last = lastChangeOf(t, changes)
    if (f.updatedBy.length && !f.updatedBy.includes(personText(last.by))) return false
    const day = localDayOf(last.at)
    if (f.updatedFrom && day < f.updatedFrom) return false
    if (f.updatedTo && day > f.updatedTo) return false
  }
  if (f.dims.length) {
    const wanted = new Map<string, Set<string>>()
    for (const k of f.dims) {
      const i = k.indexOf(':')
      const id = k.slice(0, i)
      if (!wanted.has(id)) wanted.set(id, new Set())
      wanted.get(id)!.add(k.slice(i + 1))
    }
    for (const [id, values] of wanted) {
      if (!t.dimensionValues.some(tv => tv.dimensionId === id && values.has(tv.value))) return false
    }
  }
  return true
}

// ── Per-column header menu (Filter / Sort), ported from the Chart of Accounts
// table. Each ledger column gets its own inline filter editor + sort toggle,
// keyed to the posting/account data behind the column. ──
type GLRow = { t: Transaction; acct: Account | undefined }
type AuditKey = 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'
const GL_FILTER_TYPE: Record<GLColKey, ColFilterType> = {
  date: 'date', account: 'text', category: 'multiselect', source: 'multiselect',
  entry: 'text', internalId: 'text', tags: 'text', currency: 'multiselect',
  createdBy: 'multiselect', createdAt: 'date', updatedBy: 'multiselect', updatedAt: 'date', fxAmount: 'range', reference: 'text', description: 'text', lineDescription: 'text', dimensions: 'text', debit: 'range', credit: 'range', period: 'multiselect',
  amount: 'range',
  // Running balance is derived from the account's full history, so filtering or
  // sorting the table by it would contradict the figure shown. Its header menu is
  // suppressed instead; this entry only exists to satisfy the record type.
  balance: 'range',
}
const blankGlFilter = (k: GLColKey): ColFilter => ({ type: GL_FILTER_TYPE[k], values: [], text: '', min: '', max: '', from: '', to: '' })

/* What a column needs that a posting does not carry: the total of the entry it
   belongs to, for the Amount column; the same in the entry's own currency, for
   Amount (foreign currency); the entry's tags, which the store keeps beside the
   entry; the base currency; and which tab is asking, since the foreign amount is
   the entry's on one and the line's on the other. */
interface GLRowCtx {
  entryTotal: (jeNumber: string) => number
  fxTotal: (jeNumber: string) => number | undefined
  tagsOf: (jeNumber: string) => string[]
  base: string
  entries: boolean
  /** The entries changed since they were posted - see `entryChangesOf`. */
  changes: EntryChanges
}
type EntryChanges = ReturnType<typeof entryChangesOf>
/** Who changed an entry last, and when: its reversal, or else its posting. */
const lastChangeOf = (t: Transaction, changes: EntryChanges) =>
  changes.get(t.jeNumber) ?? { by: entryCreatedBy(t), at: entryCreatedAt(t) }
// A posting's foreign amount - its own line, in the entry's currency - or none.
const fxLine = (t: Transaction) => (t.entryCurrency ? (t.fxDebit || t.fxCredit || 0) : undefined)
const fxFor = (t: Transaction, ctx: GLRowCtx) => (ctx.entries ? ctx.fxTotal(t.jeNumber) : fxLine(t))

/* ─────────────────────── What the search reads ───────────────────────
   Every column on the tab, shown or hidden, by the text its cell prints - the
   date as the Date column writes it, a figure as the figure columns write it,
   a person as the Created by cell names them. Mahad, 2026-10-05: *"the search
   should have everything in it ... When I have search for "System" and the
   created by column is active, it doesn't highlight it ... do this carefully
   for both active and hidden columns."* It follows the design review of
   2026-09-24 (Nophil: *"You should absolutely be searching [hidden columns]
   ... It's a global change."*), which this ledger had answered with a partial
   list of fields and a banner offering to show the column.

   Two catalogues, because the entries tab draws two kinds of row. A posting's
   text is what a posting row prints: a General ledger row, or a line under an
   entry on the Journal entries tab (which draws only the line's own columns -
   see LINE_COLS). An entry's text is what an entry row prints. Both are a
   `Record` over every column, so a column added to the ledger cannot be left out
   of search without the compiler saying so. Matching and marking share one
   pattern (lib/tableSearch), so a row never comes back for a reason the reader
   cannot see marked. */
interface GLTextCtx extends GLRowCtx {
  /** The account number as the Account column writes it. */
  numberText: (n: string) => string
  /** A dimension's name by id, for "Location: USA". */
  dimensionName: (id: string) => string | undefined
  /** The running balance printed after a posting, if it has one. */
  balanceOf: (txId: string) => number | undefined
  /** Formatters, memoised: the ledger asks the same few thousand figures and
   *  days again on every search. */
  money: (n: number, code: string) => string
  day: (iso: string) => string
}

/** What a line prints in Account on the entries tab: the account's number and name. */
const accountText = (acct: Account | undefined, c: GLTextCtx) =>
  acct ? `${c.numberText(acct.accountNumber)} ${acct.accountNumber} ${acct.accountName}` : ''

/* A line posted by hand to an account the system keeps carries the Adjustment
   badge (components/AdjustmentBadge), and so does its entry; the badge prints a
   word, so the search reads it on the cell it sits in. */
const lineAdjustment = (t: Transaction, acct: Account | undefined): AdjustmentKind | undefined =>
  (t.adjustmentReason ? adjustmentKind(acct) : undefined)
const withBadge = (text: string, flagged: boolean) => (flagged ? `${text} ${ADJUSTMENT_BADGE_LABEL}` : text)

const dimensionsText = (t: Transaction, c: GLTextCtx) =>
  t.dimensionValues.map(tv => `${c.dimensionName(tv.dimensionId) ?? tv.dimensionId}: ${tv.value}`).join('\n')

const POSTING_TEXT: Record<GLColKey, (r: GLRow, c: GLTextCtx) => string> = {
  date: ({ t }, c) => c.day(t.date),
  // A General ledger row names its entry in Account - the account is on the
  // row above (see accountRowText). A line under an entry names its account.
  account: ({ t, acct }, c) => withBadge(c.entries ? accountText(acct, c) : t.jeNumber, !!lineAdjustment(t, acct)),
  category: ({ acct }) => (acct ? ACCOUNT_TYPE_META[acct.accountType]?.label ?? '' : ''),
  source: ({ t }) => sourceDocName(t.source),
  entry: ({ t }) => t.jeNumber,
  internalId: ({ t }) => t.entryInternalId ?? '',
  reference: ({ t }) => t.reference,
  description: ({ t }) => entryMemo(t),
  lineDescription: ({ t }) => t.description,
  dimensions: ({ t }, c) => dimensionsText(t, c),
  tags: ({ t }, c) => c.tagsOf(t.jeNumber).join('\n'),
  createdBy: ({ t }) => personText(entryCreatedBy(t)),
  createdAt: ({ t }) => stampText(entryCreatedAt(t)),
  updatedBy: ({ t }, c) => personText(lastChangeOf(t, c.changes).by),
  updatedAt: ({ t }, c) => stampText(lastChangeOf(t, c.changes).at),
  // The entry's total, printed on the entry's own row only.
  amount: () => '',
  currency: ({ t }, c) => t.entryCurrency ?? c.base,
  fxAmount: ({ t }, c) => { const fx = fxLine(t); return fx !== undefined && t.entryCurrency ? c.money(fx, t.entryCurrency) : '' },
  debit: ({ t }, c) => (t.debit ? c.money(t.debit, c.base) : ''),
  credit: ({ t }, c) => (t.credit ? c.money(t.credit, c.base) : ''),
  // Not a column of this ledger: GL_COLS draws no Period.
  period: () => '',
  balance: ({ t }, c) => { const b = c.balanceOf(t.id); return b === undefined ? '' : c.money(b, c.base) },
}

/* What a line under an entry prints: renderJeChildCell draws these and leaves
   the entry's own columns blank. */
const LINE_COLS: GLColKey[] = ['account', 'category', 'dimensions', 'debit', 'credit', 'lineDescription']

const ENTRY_TEXT: Record<GLColKey, (head: Transaction, c: GLTextCtx) => string> = {
  date: (t, c) => c.day(t.date),
  entry: t => withBadge(t.jeNumber, !!t.adjustmentReason),
  source: t => sourceDocName(t.source),
  reference: t => t.reference,
  description: t => entryMemo(t),
  amount: (t, c) => { const total = c.entryTotal(t.jeNumber); return total ? c.money(total, c.base) : '' },
  internalId: t => t.entryInternalId ?? '',
  currency: (t, c) => t.entryCurrency ?? c.base,
  tags: (t, c) => c.tagsOf(t.jeNumber).join('\n'),
  fxAmount: (t, c) => { const fx = c.fxTotal(t.jeNumber); return fx !== undefined && t.entryCurrency ? c.money(fx, t.entryCurrency) : '' },
  createdBy: t => personText(entryCreatedBy(t)),
  createdAt: t => stampText(entryCreatedAt(t)),
  updatedBy: (t, c) => personText(lastChangeOf(t, c.changes).by),
  updatedAt: (t, c) => stampText(lastChangeOf(t, c.changes).at),
  // Left blank on the entry row: an entry straddles accounts and sides, so its
  // lines carry these (LINE_COLS).
  account: () => '', category: () => '', dimensions: () => '', debit: () => '', credit: () => '', lineDescription: () => '',
  // Not drawn on the entries tab.
  period: () => '', balance: () => '',
}

// Does a single row pass one column's active filter?
function matchesGlColFilter(row: GLRow, k: GLColKey, f: ColFilter, ctx: GLRowCtx): boolean {
  const { t, acct } = row
  const text = f.text.trim().toLowerCase()
  switch (k) {
    case 'date':
      if (f.from && t.date < f.from) return false
      if (f.to && t.date > f.to) return false
      return true
    case 'account':
      return !text || `${acct?.accountNumber ?? ''} ${acct?.accountName ?? ''}`.toLowerCase().includes(text)
    case 'category':
      return !f.values.length || (!!acct && f.values.includes(ACCOUNT_TYPE_META[acct.accountType].label))
    case 'source':
      return !f.values.length || f.values.includes(t.source)
    case 'entry':
      return !text || t.jeNumber.toLowerCase().includes(text)
    case 'reference':
      return !text || t.reference.toLowerCase().includes(text)
    case 'internalId':
      return !text || (t.entryInternalId ?? '').toLowerCase().includes(text)
    case 'tags':
      return !text || ctx.tagsOf(t.jeNumber).join(' ').toLowerCase().includes(text)
    case 'currency':
      return !f.values.length || f.values.includes(t.entryCurrency ?? ctx.base)
    case 'fxAmount': {
      const v = fxFor(t, ctx)
      // An entry in the base currency has no foreign amount, so a range leaves it out.
      if (f.min === '' && f.max === '') return true
      return v !== undefined && withinMagnitude(v, f.min, f.max)
    }
    // Memo reads the entry's note; Line description, the line's own.
    case 'description':
      return !text || entryMemo(t).toLowerCase().includes(text)
    case 'lineDescription':
      return !text || t.description.toLowerCase().includes(text)
    case 'amount':
      return withinMagnitude(ctx.entryTotal(t.jeNumber), f.min, f.max)
    case 'dimensions':
      return !text || t.dimensionValues.map(tv => tv.value).join(' ').toLowerCase().includes(text)
    // Sizes, like the filter panel's amount bounds: a debit is never negative,
    // so a signed bound is one the column cannot honour either way.
    case 'debit':
      return withinMagnitude(t.debit, f.min, f.max)
    case 'credit':
      return withinMagnitude(t.credit, f.min, f.max)
    case 'period':
      return !f.values.length || f.values.includes(t.period)
    case 'createdBy':
      return !f.values.length || f.values.includes(personText(entryCreatedBy(t)))
    case 'updatedBy':
      return !f.values.length || f.values.includes(personText(lastChangeOf(t, ctx.changes).by))
    case 'createdAt':
    case 'updatedAt': {
      const day = localDayOf(k === 'createdAt' ? entryCreatedAt(t) : lastChangeOf(t, ctx.changes).at)
      if (f.from && day < f.from) return false
      if (f.to && day > f.to) return false
      return true
    }
    // Never reached - the running balance column offers no header menu.
    case 'balance':
      return true
  }
}

// Column comparator for the header sort toggle.
function compareGlRows(a: GLRow, b: GLRow, key: GLColKey, ctx: GLRowCtx): number {
  switch (key) {
    // Date is posting order: the entry number settles a day holding more than
    // one entry, so the register never shows two orders for the same sort.
    case 'date': return comparePostingOrder(a.t, b.t)
    case 'account': return (a.acct?.accountNumber ?? '').localeCompare(b.acct?.accountNumber ?? '', undefined, { numeric: true })
    case 'category': return (a.acct ? CATEGORY_ORDER.indexOf(a.acct.accountType) : 99) - (b.acct ? CATEGORY_ORDER.indexOf(b.acct.accountType) : 99)
    case 'source': return a.t.source.localeCompare(b.t.source)
    case 'entry': return a.t.jeNumber.localeCompare(b.t.jeNumber, undefined, { numeric: true })
    case 'reference': return a.t.reference.localeCompare(b.t.reference, undefined, { numeric: true })
    case 'internalId': return journalInternalIdSeq(a.t.entryInternalId) - journalInternalIdSeq(b.t.entryInternalId)
    case 'tags': return ctx.tagsOf(a.t.jeNumber).join(' ').localeCompare(ctx.tagsOf(b.t.jeNumber).join(' '))
    case 'currency': return (a.t.entryCurrency ?? ctx.base).localeCompare(b.t.entryCurrency ?? ctx.base)
    case 'fxAmount': return (fxFor(a.t, ctx) ?? -1) - (fxFor(b.t, ctx) ?? -1)
    case 'description': return entryMemo(a.t).localeCompare(entryMemo(b.t))
    case 'lineDescription': return a.t.description.localeCompare(b.t.description)
    case 'amount': return ctx.entryTotal(a.t.jeNumber) - ctx.entryTotal(b.t.jeNumber)
    case 'dimensions': return a.t.dimensionValues.map(tv => tv.value).join(' ').localeCompare(b.t.dimensionValues.map(tv => tv.value).join(' '))
    case 'debit': return a.t.debit - b.t.debit
    case 'credit': return a.t.credit - b.t.credit
    case 'period': return a.t.period.localeCompare(b.t.period)
    case 'createdBy': return personText(entryCreatedBy(a.t)).localeCompare(personText(entryCreatedBy(b.t)))
    case 'createdAt': return entryCreatedAt(a.t).localeCompare(entryCreatedAt(b.t))
    case 'updatedBy': return personText(lastChangeOf(a.t, ctx.changes).by).localeCompare(personText(lastChangeOf(b.t, ctx.changes).by))
    case 'updatedAt': return lastChangeOf(a.t, ctx.changes).at.localeCompare(lastChangeOf(b.t, ctx.changes).at)
    case 'balance': return 0
  }
}


/* A drawn group's postings and total row, redrawn only when something they
   show has changed. Without it, every group that Expand all drew as it scrolled
   into view redrew every group drawn before it, so scrolling down a month got
   slower with each screen - a second a step by the bottom. `version` names
   everything the cells read that is not the group itself or `data`; `render`
   is whatever closure the page last built, used only when one of those moved. */
const DrawnGroupRows = memo(
  function DrawnGroupRows({ render }: { group: unknown; version: string; data: object; render: () => ReactElement }) {
    return render()
  },
  (a, b) => a.group === b.group && a.version === b.version && a.data === b.data,
)

export default function GeneralLedgerPage() {
  const transactions = useStore(s => s.transactions)
  const accounts = useStore(s => s.accounts)
  const base = useStore(s => s.company.baseCurrency)
  const numberText = useAccountNumberText()
  const fiscalYearStart = useStore(s => s.company.fiscalYearStart)
  const seedQ1Openings = useStore(s => s.seedQ1Openings)
  // The accounting period in force, set from the strip above the table.
  const period = useSelectedPeriod()
  const navigate = useNavigate()
  // The entry a row's "Reverse entry" opened, while its dialog is up.
  const [reverseJe, setReverseJe] = useState<string | null>(null)
  const goToKpiTarget = useCallback((target: GlKpiTarget) => {
    if (target.kind === 'account') navigate(`/chart-of-accounts/${target.id}`)
    else navigate(`/general-ledger/entry/${encodeURIComponent(target.id)}`)
  }, [navigate])
  const ic16 = useResponsiveIconSize(16)
  const ic14 = useResponsiveIconSize(14)

  /* What the reader was looking at - the search, the quick filters, the Filters
     panel, the column filters and sort, and the columns as they set them up - is
     there again when they come back from an entry or an account, as it is on the
     Chart of Accounts (Mahad, 2026-10-09: *"if we search something and then go to
     the details page, the search should persist when we come back ... the
     columns that we configured should also be the same"*). See
     `useRememberedState`. */
  const [query, setQuery] = useRememberedState('gl:query', '')
  // Brief load shimmer on first mount - the ledger can carry thousands of
  // postings, so we show a skeleton rather than a blank table while it settles.
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setLoading(false), 450)
    return () => clearTimeout(id)
  }, [])
  // Which header tab is open. Held in the store so returning from a journal entry
  // lands back on the tab the reader left, rather than resetting to Postings.
  const view = useStore(s => s.glView)
  const setView = useStore(s => s.setGlView)
  // Row expansion, per tab. Storing a *mode* plus the rows that deviate from it
  // (rather than a set of open rows) means entries revealed later by a filter,
  // search or page change inherit the mode instead of snapping back to collapsed.
  // Both tabs land collapsed, and nothing is seeded open. The list is a list of
  // entries, and every one of them open at once buries that list under its own
  // postings: the reader cannot scan what the page is a list of. One branch was
  // briefly seeded open on arrival, on the argument that the demo chart is small
  // enough to make a closed page look empty - but the chart is not the volume the
  // page is built for. Mahad, 2026-09-11: *"a single account can easily have 500
  // to 1,000 transactions in a single day. Because of this high volume,
  // everything must start collapsed to avoid overwhelming the user."* At that
  // size the seeded branch is the thousand rows. A row is opened when there is a
  // reason to look inside it.
  const [expandMode, setExpandMode] = useState<Record<ViewMode, ExpandMode>>({ list: 'collapsed', tree: 'collapsed' })
  const [jeExceptions, setJeExceptions] = useState<Set<string>>(new Set())
  const [acctExceptions, setAcctExceptions] = useState<Set<string>>(new Set())
  /* An entry the page opens by itself, before the reader says otherwise: the
     first one on arrival, and any a search matched only inside its lines (see
     `autoOpenJes`). Toggling one records an exception like any other row. */
  const isJeOpen = (jeNumber: string) =>
    (expandMode.list === 'expanded' || autoOpenJes.has(jeNumber)) !== jeExceptions.has(jeNumber)
  /* And an account the search found inside - see `autoOpenAccts`. The two tabs
     answer a search the same way because they hide the same thing: a row the
     reader is told matched, with the match shut inside it. */
  const isAcctOpen = (id: string) =>
    (expandMode.tree === 'expanded' || autoOpenAccts.has(id)) !== acctExceptions.has(id)
  const toggleAcct = (id: string) => setAcctExceptions(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  // closingJes stages entries for removal so the collapse animation can play
  // before the child rows unmount.
  const [closingJes, setClosingJes] = useState<Set<string>>(new Set())
  const clearClosing = (jes: string[]) => {
    window.setTimeout(() => setClosingJes(prev => {
      const n = new Set(prev); jes.forEach(j => n.delete(j)); return n
    }), 180)
  }
  const toggleJe = (jeNumber: string) => {
    if (isJeOpen(jeNumber)) {
      setClosingJes(prev => new Set(prev).add(jeNumber))
      clearClosing([jeNumber])
    } else {
      setClosingJes(prev => { const n = new Set(prev); n.delete(jeNumber); return n })
    }
    setJeExceptions(prev => { const n = new Set(prev); n.has(jeNumber) ? n.delete(jeNumber) : n.add(jeNumber); return n })
  }
  // Category quick-chip filter (by the posting account's category).
  const [catFilter, setCatFilter] = useRememberedState<'all' | AccountCategory>('gl:category', 'all')
  /* The entries tab's own quick chips, by what raised the entry. Category cannot
     be asked on that tab without unbalancing an entry, but source can: every
     posting of an entry carries the same one, so keeping a source keeps whole
     entries. It is also the question the tab invites - "show me the payroll
     run", "show me what came off customer invoices". */
  const [srcFilter, setSrcFilter] = useRememberedState<string[]>('gl:source', [])
  // The Filters modal's facets (posting side, dates, dimensions, who and when).
  const [filters, setFilters] = useRememberedState<GLFilters>('gl:filters', EMPTY_GL_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Per-column header menus (Chart of Accounts parity): each column carries its
  // own inline filter, and one column at a time can drive the sort.
  const [colFilters, setColFilters] = useRememberedState<Partial<Record<GLColKey, ColFilter>>>('gl:colFilters', {})
  const [colSort, setColSort] = useRememberedState<{ key: GLColKey; dir: 'asc' | 'desc' } | null>('gl:sort', null)
  /* The Journal entries tab opens newest first, by date, until the reader sorts
     it otherwise (Mahad, 2026-10-09: *"Journal entries should be sorted by the
     last date in the listing table by default."*). The General ledger tab keeps
     posting order, oldest first, because its running balance reads down the page. */
  const activeSort: { key: GLColKey; dir: 'asc' | 'desc' } | null =
    colSort ?? (view === 'list' ? { key: 'date', dir: 'desc' } : null)
  // Column visibility + order - driven by the docked ColumnSelector drawer
  // (same component as Chart of Accounts).
  const [visible, setVisible] = useRememberedState<Record<string, boolean>>('gl:columns',
    () => Object.fromEntries(GL_COLS.map(c => [c.key, !c.defaultHidden])),
  )
  // Each tab keeps its own column order: they are two readings of the ledger
  // and were settled separately (see LIST_COLUMN_ORDER).
  const [orderByView, setOrderByView] = useRememberedState<Record<ViewMode, string[]>>('gl:columnOrder', () => ({
    tree: GL_COLS.map(c => c.key),
    list: [...LIST_COLUMN_ORDER],
  }))
  const columnOrder = orderByView[view]
  const setColumnOrder = useCallback((next: string[] | ((prev: string[]) => string[])) => {
    setOrderByView(o => ({ ...o, [view]: typeof next === 'function' ? next(o[view]) : next }))
  }, [view])
  const [columnsOpen, setColumnsOpen] = useState(false)
  const colByKey = useMemo(() => new Map(GL_COLS.map(c => [c.key, c])), [])
  /* How the ledger is drawn. Both tabs group, so Pin group headings is real on
     each; Tree layout is offered on the General ledger tab only, where a row
     nests under the account it was posted to. */
  const { look, set: setLook, toggle: toggleVisual, lookClass } = useTableLook(undefined, 'gl:look')
  const engineSized = look.columnSizing === 'fit' || look.columnSizing === 'equal'

  // Performance Insights (Partners-parity): active KPI keys (ordered, draggable),
  // the drawer open state, and a refreshed timestamp. There is no lens of its own
  // - the page's accounting period is what scopes the cards.
  //
  // The shelf opens empty, so the ledger starts right under the period strip.
  // Design review, 2026-09-24 - Nophil: *"we're almost consuming 50% of the
  // screen with all of this junk"*; Eli: *"have the default state not have the
  // widgets open ... If someone wants to see it, no problems."* The Insights
  // button puts cards back, and its Reset brings the usual four.
  const [activeKpis, setActiveKpis] = useState<string[]>(GL_KPIS_OPEN_ON)
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false)
  const [newEntryOpen, setNewEntryOpen] = useState(false)
  const [lastInsightsRefreshed, setLastInsightsRefreshed] = useState(() => new Date())
  const toggleKpi = (key: string) => setActiveKpis(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  // Join each posting to its account once, then sort by date, then by account
  // number, then reference - a stable, sensible cross-account ledger order.
  const acctById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])
  const rows = useMemo(() => {
    const joined = transactions.map(t => ({ t, acct: acctById.get(t.accountId) }))
    return joined.sort((a, b) => {
      const d = a.t.date.localeCompare(b.t.date)
      if (d !== 0) return d
      const an = (a.acct?.accountNumber ?? '').localeCompare(b.acct?.accountNumber ?? '', undefined, { numeric: true })
      if (an !== 0) return an
      return a.t.reference.localeCompare(b.t.reference, undefined, { numeric: true })
    })
  }, [transactions, acctById])

  // The ledger, cut down to the accounting period in force. Everything the table
  // counts, facets and lists reads from here rather than from the whole ledger, so
  // a period is a genuine narrowing of the ledger and not just a caption. The one
  // deliberate exception is the running balance below, which stays a fact about the
  // account.
  const periodRows = useMemo(() => rows.filter(r => isInSelection(r.t.date, period)), [rows, period])
  const periodTx = useMemo(() => periodRows.map(r => r.t), [periodRows])

  // Distinct sources, with counts, for the Source column's header filter.
  const sourceCounts = useMemo(() => {
    const m: Record<string, number> = {}
    periodTx.forEach(t => { if (t.source) m[t.source] = (m[t.source] ?? 0) + 1 })
    return m
  }, [periodTx])
  const sources = useMemo(() => Object.keys(sourceCounts).sort(), [sourceCounts])
  /* The same sources the Source column filter offers, counted the way the
     entries tab counts everything else - in entries, not postings, so a chip
     reading 145 and the "of 1,133 entries" beside it share one unit. Ordered by
     the SOURCE_DOC catalogue rather than alphabetically: that is the order the
     module declares its sources in, and a source the data holds but the
     catalogue does not still gets a chip rather than being silently dropped. */
  const srcEntryCounts = useMemo(() => {
    const seen = new Map<string, Set<string>>()
    for (const t of periodTx) {
      if (!t.source) continue
      const held = seen.get(t.source) ?? new Set<string>()
      held.add(t.jeNumber)
      seen.set(t.source, held)
    }
    const known = Object.keys(SOURCE_DOC).filter(s => seen.has(s))
    const rest = [...seen.keys()].filter(s => !(s in SOURCE_DOC)).sort()
    return [...known, ...rest].map(source => ({ source, count: seen.get(source)!.size }))
  }, [periodTx])
  /* The same sources in the same order, counted for the General ledger tab: in
     postings, because a row there is one posting and the tally beside the
     dropdown counts postings. One dropdown, one list of sources, and each tab's
     numbers in the unit that tab lists. */
  const srcOptions = useMemo(() => srcEntryCounts.map(({ source, count }) => ({
    id: source,
    // Named the way the Source column names them, so an option and the column
    // it narrows read the same - the raw key would say "Payroll" against the
    // column's "Payroll Run".
    label: sourceDocName(source),
    count: view === 'list' ? count : (sourceCounts[source] ?? 0),
  })), [srcEntryCounts, sourceCounts, view])
  const storePeriods = useStore(s => s.periods)

  // The balance after each individual posting, along its own account's ledger.
  // Derived from the full transaction set rather than the filtered one: a balance
  // is a fact about the account, not about what the reader happens to be looking
  // at, so narrowing the table must not restate it.
  const balanceByTx = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of accounts) {
      for (const p of runningBalanceLedger(a, transactions, seedQ1Openings[a.id] ?? 0)) {
        m.set(p.transaction.id, p.runningBalance)
      }
    }
    return m
  }, [accounts, transactions, seedQ1Openings])
  // Where the selected period leaves each account, and where it found it. The
  // account's own `balance` is the as-of-now figure, so printing it above an
  // earlier period's postings would contradict the running balance in the same
  // column. Both figures come out of one pass so they cannot drift apart: the
  // opening is the closing less the movement inside the span, which is exactly
  // what the postings between the two rows add up to.
  const { periodBalanceById, periodOpeningById } = useMemo(() => {
    const closing = new Map<string, number>()
    const opening = new Map<string, number>()
    for (const a of scopeAccountsToPeriod(accounts, transactions, period)) {
      closing.set(a.id, a.balance)
      opening.set(a.id, a.balance - (a.netChange ?? 0))
    }
    return { periodBalanceById: closing, periodOpeningById: opening }
  }, [accounts, transactions, period])
  // Posting-side counts + the per-line amount spread, for the modal's side chips
  // and the amount min/max range placeholders.
  const sideCounts = useMemo(() => {
    let debit = 0, credit = 0
    periodTx.forEach(t => { if (t.debit > 0) debit++; if (t.credit > 0) credit++ })
    return { debit, credit }
  }, [periodTx])
  const amountValues = useMemo(() => periodTx.map(t => Math.max(t.debit, t.credit)), [periodTx])
  // Read off the whole ledger: a reversal can post in a later period than the
  // entry it changes.
  const entryChanges = useMemo(() => entryChangesOf(transactions), [transactions])
  // The entry that reversed each reversed entry, for the row menu to name.
  const reversedBy = useMemo(() => reversedByOf(transactions), [transactions])
  // Who posted and who last changed the period's postings, with counts, for the
  // Filters panel's people pills and the two columns' own filters.
  const auditPeople = useMemo(() => {
    const creators = new Map<string, number>()
    const modifiers = new Map<string, number>()
    for (const t of periodTx) {
      const c = personText(entryCreatedBy(t))
      const m = personText(lastChangeOf(t, entryChanges).by)
      creators.set(c, (creators.get(c) ?? 0) + 1)
      modifiers.set(m, (modifiers.get(m) ?? 0) + 1)
    }
    const sorted = (m: Map<string, number>) => [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }))
    return { creators: sorted(creators), modifiers: sorted(modifiers) }
  }, [periodTx, entryChanges])
  // The dimension values the period carries, with posting counts, grouped by
  // dimension and named the way the Dimensions page names them.
  const storeDimensions = useStore(s => s.dimensions)
  const dimensionOptions = useMemo(() => {
    const byDim = new Map<string, Map<string, number>>()
    for (const t of periodTx) {
      for (const tv of t.dimensionValues) {
        if (!byDim.has(tv.dimensionId)) byDim.set(tv.dimensionId, new Map())
        const m = byDim.get(tv.dimensionId)!
        m.set(tv.value, (m.get(tv.value) ?? 0) + 1)
      }
    }
    return [...byDim.entries()].map(([id, values]) => ({
      id,
      name: storeDimensions.find(d => d.id === id)?.name ?? id,
      values: [...values.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count })),
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [periodTx, storeDimensions])

  /* Which categories the period holds, and how many postings each - everything in
     the period, before the search and filters narrow it further. Counted in
     postings because the chips it feeds are a General ledger tab control and a
     tree row is one posting, which is also the unit the count beside them reports
     on that tab. `uniqueGlValues` reads the keys only, so the Category column
     filter still offers every category present on either tab. */
  const catCounts = useMemo(() => {
    const m = new Map<AccountCategory, number>()
    for (const { acct } of periodRows) {
      if (!acct) continue
      m.set(acct.accountType, (m.get(acct.accountType) ?? 0) + 1)
    }
    return m
  }, [periodRows])

  // Distinct values behind each multiselect column filter.
  const uniqueGlValues = useCallback((k: GLColKey): string[] => {
    switch (k) {
      case 'category': return CATEGORY_ORDER.filter(c => catCounts.has(c)).map(c => ACCOUNT_TYPE_META[c].label)
      case 'source': return sources
      // The currencies the period's entries were written in, base first.
      case 'currency': return [...new Set([base, ...periodTx.map(t => t.entryCurrency ?? base)])]
      case 'createdBy': return auditPeople.creators.map(p => p.name)
      case 'updatedBy': return auditPeople.modifiers.map(p => p.name)
      default: return []
    }
  }, [catCounts, sources, periodTx, base, auditPeople])

  /* Everything an entry can be searched by, gathered from all of its lines.
     Searching matched one line at a time, and the entries tab then rebuilt each
     entry out of whichever lines had survived - so the same entry came back
     describing itself as "Amortize patent family over remaining useful life" or
     as "Accumulate amortization, software and patent register" depending on
     which of its two accounts had been typed, and a line the ledger never stored
     could not be reached at all.

     `reconstructEntry` only adds a line where the stored ones do not balance, so
     that is the only case worth paying for - and paying for it keeps what the
     search can find and what expanding the entry shows the same set of lines.

     Lazy and cached: the cache outlives a keystroke because it is keyed on the
     ledger, and a reader who never searches never builds it. */
  /* Each entry's total, for the Amount column, its filter and its sort. The
     larger of the entry's debits and its credits as stored: they are equal on a
     whole entry, and a seeded entry stores only its primary side, which
     `reconstructEntry` balances with a contra of exactly the difference - so the
     larger side is the entry page's total too, without rebuilding every entry. */
  const entryTotals = useMemo(() => {
    const side = new Map<string, { d: number; c: number }>()
    for (const t of transactions) {
      const s = side.get(t.jeNumber)
      if (s) { s.d += t.debit; s.c += t.credit } else side.set(t.jeNumber, { d: t.debit, c: t.credit })
    }
    const out = new Map<string, number>()
    for (const [je, s] of side) out.set(je, Math.max(s.d, s.c))
    return out
  }, [transactions])
  /* The same for an entry written in another currency, in that currency: the
     larger side of what was typed. Absent for a base-currency entry. */
  const entryFxTotals = useMemo(() => {
    const side = new Map<string, { d: number; c: number }>()
    for (const t of transactions) {
      if (!t.entryCurrency) continue
      const s = side.get(t.jeNumber)
      if (s) { s.d += t.fxDebit ?? 0; s.c += t.fxCredit ?? 0 } else side.set(t.jeNumber, { d: t.fxDebit ?? 0, c: t.fxCredit ?? 0 })
    }
    return new Map([...side].map(([je, s]) => [je, Math.round(Math.max(s.d, s.c) * 100) / 100]))
  }, [transactions])
  const jeTags = useStore(s => s.jeTags)
  const rowCtx = useMemo<GLRowCtx>(() => ({
    entryTotal: je => entryTotals.get(je) ?? 0,
    fxTotal: je => entryFxTotals.get(je),
    tagsOf: je => jeTags[je] ?? [],
    base,
    entries: view === 'list',
    changes: entryChanges,
  }), [entryTotals, entryFxTotals, jeTags, base, view, entryChanges])
  // The same spread for whole entries, which is what the entries tab's range asks about.
  const entryAmountValues = useMemo(
    () => [...new Set(periodTx.map(t => t.jeNumber))].map(je => entryTotals.get(je) ?? 0),
    [periodTx, entryTotals],
  )

  /* What the search reads, built once per ledger and asked lazily: a posting's
     text, an account row's, and an entry's - see POSTING_TEXT and ENTRY_TEXT. */
  const textCtx = useMemo<GLTextCtx>(() => {
    const names = new Map(storeDimensions.map(d => [d.id, d.name]))
    const moneyCache = new Map<string, string>()
    const dayCache = new Map<string, string>()
    return {
      ...rowCtx,
      numberText,
      dimensionName: id => names.get(id),
      balanceOf: id => balanceByTx.get(id),
      money: (n, code) => {
        const k = `${n}|${code}`
        let v = moneyCache.get(k)
        if (v === undefined) moneyCache.set(k, (v = fmtCurrencyExact(n, code)))
        return v
      },
      day: iso => {
        let v = dayCache.get(iso)
        if (v === undefined) dayCache.set(iso, (v = fmtDate(iso)))
        return v
      },
    }
  }, [rowCtx, numberText, storeDimensions, balanceByTx])
  // The same, as a line under an entry reads it, whichever tab is open.
  const lineCtx = useMemo<GLTextCtx>(() => ({ ...textCtx, entries: true }), [textCtx])
  const treeTextCols = useMemo(() => GL_COLS.filter(c => onTab(c, 'tree')).map(c => c.key), [])
  const listTextCols = useMemo(() => GL_COLS.filter(c => onTab(c, 'list')).map(c => c.key), [])
  const found = useMemo(() => searchMatcher(query), [query])
  const searching = query.trim().length > 0

  /* A posting row's own text, on the General ledger tab. Without the account it
     sits under: the tab names the account on the row above, so an account found
     by its own name has nothing further to show inside, and an account found by a
     posting's text has to open onto it (see `autoOpenAccts`). */
  const postingText = useMemo(() => {
    const cache = new Map<string, string>()
    return (row: GLRow): string => {
      let v = cache.get(row.t.id)
      if (v === undefined) cache.set(row.t.id, (v = treeTextCols.map(k => POSTING_TEXT[k](row, textCtx)).join('\n')))
      return v
    }
  }, [textCtx, treeTextCols])

  /* An account row's text: what it prints shut - its number, its name, the
     period's debit and credit totals and where the period leaves it. The figures
     are the period's own rather than what the search leaves, so finding an
     account by its total keeps every posting that makes it up. The opening
     balance is not here: the row prints it only once open, and a row this text
     finds stays shut. */
  const accountRowText = useMemo(() => {
    const totals = new Map<string, { d: number; c: number }>()
    for (const { t, acct } of periodRows) {
      const id = acct?.id ?? '__unassigned__'
      const s = totals.get(id)
      if (s) { s.d += t.debit; s.c += t.credit } else totals.set(id, { d: t.debit, c: t.credit })
    }
    const cache = new Map<string, string>()
    return (acct: Account | undefined): string => {
      const id = acct?.id ?? '__unassigned__'
      let v = cache.get(id)
      if (v !== undefined) return v
      const s = totals.get(id) ?? { d: 0, c: 0 }
      const closing = acct ? periodBalanceById.get(acct.id) ?? acct.balance : undefined
      v = [
        acct ? `${numberText(acct.accountNumber)}\n${acct.accountNumber}\n${acct.accountName}` : 'Unassigned',
        s.d ? textCtx.money(s.d, base) : '', s.c ? textCtx.money(s.c, base) : '',
        closing !== undefined ? textCtx.money(closing, base) : '',
      ].join('\n')
      cache.set(id, v)
      return v
    }
  }, [periodRows, periodBalanceById, numberText, textCtx, base])

  /* Everything an entry can be searched by: its own row, and every one of its
     lines. Searching matched one line at a time, and the entries tab then rebuilt
     each entry out of whichever lines had survived - so the same entry came back
     describing itself as "Amortize patent family over remaining useful life" or
     as "Accumulate amortization, software and patent register" depending on
     which of its two accounts had been typed, and a line the ledger never stored
     could not be reached at all.

     `reconstructEntry` only adds a line where the stored ones do not balance, so
     that is the only case worth paying for - and paying for it keeps what the
     search can find and what expanding the entry shows the same set of lines.

     Lazy and cached: the cache outlives a keystroke because it is keyed on the
     ledger, and a reader who never searches never builds it. */
  const entryText = useMemo(() => {
    const byJe = new Map<string, GLRow[]>()
    for (const row of periodRows) {
      const g = byJe.get(row.t.jeNumber)
      if (g) g.push(row); else byJe.set(row.t.jeNumber, [row])
    }
    const cache = new Map<string, { head: Transaction; own: string; lines: GLRow[]; linesText: string }>()
    return (jeNumber: string) => {
      const hit = cache.get(jeNumber)
      if (hit) return hit
      const rows = byJe.get(jeNumber) ?? []
      const head = rows[0].t
      const lines = [...rows]
      const imbalance = rows.reduce((s, r) => s + r.t.debit - r.t.credit, 0)
      if (Math.abs(imbalance) > 0.005) {
        for (const l of reconstructEntry(jeNumber, transactions, accounts).lines) {
          if (!l.synthetic) continue
          lines.push({
            acct: l.account,
            t: {
              id: l.id, accountId: l.accountId, date: head.date, source: head.source,
              jeNumber, reference: head.reference, entryType: 'Simple' as const,
              description: l.description, debit: l.debit, credit: l.credit, runningBalance: 0,
              dimensionValues: postingDimensions(l.account?.defaultDimensionValues), period: head.period,
            },
          })
        }
      }
      const entry = {
        head, lines,
        own: listTextCols.map(k => ENTRY_TEXT[k](head, textCtx)).join('\n'),
        linesText: lines.map(r => LINE_COLS.map(k => POSTING_TEXT[k](r, lineCtx)).join('\n')).join('\n'),
      }
      cache.set(jeNumber, entry)
      return entry
    }
  }, [periodRows, transactions, accounts, textCtx, lineCtx, listTextCols])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const activeColKeys = (Object.keys(colFilters) as GLColKey[]).filter(k => filterActive(colFilters[k]))
    const out = periodRows.filter(row => {
      const { t, acct } = row
      // Only where the chips that set it are on screen. Otherwise a category
      // chosen on the tree tab would go on narrowing the entries tab with no
      // control showing it and nothing to clear it from.
      if (view === 'tree' && catFilter !== 'all' && acct?.accountType !== catFilter) return false
      // Source is drawn on both tabs, so it holds on both, as Amount does: the
      // tab switched to shows the dropdown that set it, and clears it.
      if (srcFilter.length && !srcFilter.includes(t.source)) return false
      // On the entries tab the Amount range asks about the entry's size, the
      // figure the Amount column shows; on the General ledger tab, a posting's.
      if (!matchesGlFilters(t, filters, rowCtx.changes, view === 'list' ? rowCtx.entryTotal(t.jeNumber) : undefined)) return false
      for (const k of activeColKeys) { if (!matchesGlColFilter(row, k, colFilters[k]!, rowCtx)) return false }
      if (!q) return true
      /* On the entries tab the search names an entry, so an entry it names comes
         back whole. On the accounts tab a posting sits under its own account, and
         pulling in the other side would file a line under an account the reader
         never asked about - there the line answers for itself. */
      if (view === 'list') { const e = entryText(t.jeNumber); return found(e.own) || found(e.linesText) }
      return found(accountRowText(acct)) || found(postingText(row))
    })
    if (activeSort) {
      const dir = activeSort.dir === 'asc' ? 1 : -1
      // Posting order breaks every tie, so a column with repeated values still
      // reads as a register rather than as an arbitrary shuffle.
      out.sort((a, b) => (compareGlRows(a, b, activeSort.key, rowCtx) || comparePostingOrder(a.t, b.t)) * dir)
    }
    return out
  }, [periodRows, query, catFilter, srcFilter, view, filters, colFilters, activeSort?.key, activeSort?.dir, entryText, postingText, accountRowText, found, rowCtx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ===== KPI stats bag - scoped to the selected accounting period =====
  // Deliberately built from `periodRows` rather than from the search-and-filter
  // result: these describe what the period holds, and a card that moved every
  // time the reader typed in the search box would be describing the query.
  const stats = useMemo(() => {
    let totalDebit = 0
    let biggest: { jeNumber: string; value: number } | null = null
    // Manual entries counted as documents, not lines - one entry with six lines
    // is one thing to review.
    const manualEntries = new Set<string>()
    for (const { t } of periodRows) {
      totalDebit += t.debit
      if (t.source === 'Manual JE') manualEntries.add(t.jeNumber)
      const amount = Math.max(t.debit, t.credit)
      if (!biggest || amount > biggest.value) biggest = { jeNumber: t.jeNumber, value: amount }
    }
    return {
      // Debits alone. Double-entry makes the credit total identical, so adding
      // them together would state the period's activity at twice its size.
      totalActivity: totalDebit,
      postingCount: periodRows.length,
      manualEntryCount: manualEntries.size,
      largestPosting: biggest ? { jeNumber: biggest.jeNumber, label: biggest.jeNumber, value: biggest.value } : null,
    }
  }, [periodRows])

  const kpiCtx: GlKpiCtx = useMemo(
    () => ({ stats, base, periodLabel: period.label }),
    [stats, base, period.label],
  )

  /* The columns that are off and that the search found something in, across
     the rows it listed: brought out for the search, next to Account, with the
     note above the table naming them - as every searchable table in the module
     does (components/SearchReveal). On the entries tab an entry row is read for
     the entry's own columns and its lines for theirs. */
  const hiddenHits = useMemo(() => {
    if (!searching) return [] as GLColKey[]
    const off = GL_COLS.filter(c => onTab(c, view) && !visible[c.key] && !c.alwaysShown && !c.required).map(c => c.key)
    if (!off.length) return [] as GLColKey[]
    const hit = new Set<GLColKey>()
    if (view === 'list') {
      for (const je of new Set(filtered.map(r => r.t.jeNumber))) {
        const e = entryText(je)
        for (const k of off) {
          if (hit.has(k)) continue
          if (found(ENTRY_TEXT[k](e.head, textCtx)) || (LINE_COLS.includes(k) && e.lines.some(r => found(POSTING_TEXT[k](r, lineCtx))))) hit.add(k)
        }
        if (hit.size === off.length) break
      }
    } else {
      for (const r of filtered) {
        for (const k of off) if (!hit.has(k) && found(POSTING_TEXT[k](r, textCtx))) hit.add(k)
        if (hit.size === off.length) break
      }
    }
    return (columnOrder as GLColKey[]).filter(k => hit.has(k))
  }, [searching, view, visible, filtered, entryText, found, textCtx, lineCtx, columnOrder])
  const { revealed: revealedCols, hide: unreveal } = useSearchReveal(query, hiddenHits)
  // Takes a column down: one the search brought out goes back for the rest of
  // this search, anything else is switched off.
  const hideColumn = (k: GLColKey) => { if (!unreveal(k)) setVisible(prev => ({ ...prev, [k]: false })) }

  // Ordered + visible columns (order from the ColumnSelector drawer), with any the
  // search brought out placed after Account.
  const cols = orderWithRevealed(columnOrder as GLColKey[], revealedCols, 'account')
    .map(k => colByKey.get(k))
    .filter((c): c is (typeof GL_COLS)[number] => !!c && (!!visible[c.key] || !!c.alwaysShown || revealedCols.includes(c.key)) && onTab(c, view))
  // The column the view holds at the left edge by construction: in the tree that is
  // Account, which carries the disclosure and the connector guides, and in the
  // journal-entry list it is Date, which orders everything under it.
  const structuralLeft: GLColKey = view === 'list' ? 'date' : 'account'
  // Columns the reader froze from a header menu. They join the end of the left run
  // rather than pinning where they sit: a cell pinned mid-table would let the
  // columns before it slide underneath it.
  const [frozenCols, setFrozenCols] = useRememberedState<GLColKey[]>('gl:frozen', [])
  const leftPinRun = useMemo(() => {
    const run: GLColKey[] = []
    if (visible[structuralLeft]) run.push(structuralLeft)
    for (const k of frozenCols) {
      if (k === structuralLeft || !visible[k]) continue
      if (view === 'list' && colByKey.get(k)?.treeOnly) continue
      run.push(k)
    }
    return run
  }, [view, visible, frozenCols, structuralLeft, colByKey])
  // Tree view leads with Account (it carries the disclosure + connector guides);
  // everything after it keeps its drawer order. List view is untouched.
  const baseCols = view === 'tree'
    ? (() => {
        const account = cols.find(c => c.key === 'account')
        return [...(account ? [account] : []), ...cols.filter(c => c.key !== 'account')]
      })()
    : cols
  // The left run leads the row, in run order, for the same reason the right run
  // trails it.
  const displayCols = leftPinRun.length > 1
    ? [
        ...leftPinRun
          .map(k => baseCols.find(c => c.key === k))
          .filter((c): c is (typeof GL_COLS)[number] => !!c),
        ...baseCols.filter(c => !leftPinRun.includes(c.key)),
      ]
    : baseCols
  // One header per column per tab - the header row, the Columns drawer and the
  // filter chips all read it from here, so a column named differently on the two
  // tabs is named that way everywhere the tab shows it.
  const labelFor = (key: GLColKey): string => colByKey.get(key)?.label ?? key

  // A column the current view can't render has nothing to toggle, so it's kept
  // out of the drawer rather than offered as a switch that does nothing.
  // In the tab's own default order, which is what the panel's Reset puts back.
  const colSpecs = (view === 'list'
    ? [...GL_COLS].sort((a, b) => LIST_COLUMN_ORDER.indexOf(a.key) - LIST_COLUMN_ORDER.indexOf(b.key))
    : GL_COLS)
    .filter(c => onTab(c, view))
    .map(c => ({ key: c.key, label: labelFor(c.key) }))
  const lockedCols = GL_COLS.filter(c => c.required).map(c => c.key)
  const alwaysShownCols = GL_COLS.filter(c => c.alwaysShown).map(c => c.key)
  // Columns a header drag can't move. Required columns are locked outright, and
  // so is the left pin run, because `displayCols` fixes its position and a drag
  // would only snap back.
  const dragLockedSet = useMemo(() => new Set<string>([
    ...GL_COLS.filter(c => c.required).map(c => c.key),
    ...(view === 'tree' ? ['account'] : []),
    ...leftPinRun,
  ]), [view, leftPinRun])
  // Columns the view already holds at an edge. A freeze switch on one of these would
  // promise something the column does anyway, so its menu doesn't offer it.
  const alwaysPinned = useMemo(() => new Set<GLColKey>([structuralLeft]), [structuralLeft])
  const padY = look.density === 'comfort' ? ROW_PAD_Y_COMFORT : ROW_PAD_Y
  /* Row numbers opens a gutter down the left of whichever cell leads the row
     (spec §7). It is sized off the postings the period holds rather than off
     what happens to be expanded, so opening an entry never shifts the columns
     sideways. The gutter itself is a transparent border-left drawn in CSS; what
     the view owes it is the extra width on the leading cell, because with
     border-box sizing the border comes out of the declared width. */
  const gutter = look.rowNumbers ? rowNumberGutter(filtered.length) : 0
  // In the list the chevron gutter always leads; in the tree it is the first
  // column on show.
  const leadCol: GLColKey | undefined = view === 'list' ? undefined : displayCols[0]?.key
  const chevW = LIST_CHEV_W + gutter
  const treeLines = look.treeStyle === 'lines'
  const filtersActive = countGlFilters(filters)

  // Per-column widths - drag the right edge of a header to resize, mirroring the
  // Chart of Accounts table. The width is applied via each cell's inline style so
  // the header and body columns stay aligned.
  const [colWidths, setColWidths] = useRememberedState<Partial<Record<GLColKey, number>>>('gl:widths', {})
  // Picking a Column widths card clears every hand-dragged width (spec §7).
  useEffect(() => {
    if (look.columnSizing !== 'custom') setColWidths(prev => (Object.keys(prev).length ? {} : prev))
  }, [look.columnSizing])
  const handleColResizeStart = (key: GLColKey) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const th = (e.currentTarget as HTMLElement).closest('th')
    const startX = e.clientX
    // Off the BORDER box minus its left border: the Row numbers gutter is that
    // border, and counting it in would add itself again on the next render and
    // walk the column wider on every drag.
    const startW = th
      ? th.getBoundingClientRect().width - parseFloat(getComputedStyle(th).borderLeftWidth || '0')
      : 120
    // A hand-dragged edge takes Column widths to `custom`, so no card is lit.
    setLook('columnSizing', 'custom')
    const move = (ev: MouseEvent) => {
      const w = Math.max(MIN_COL_W[key] ?? MIN_COL_W_DEFAULT, Math.round(startW + (ev.clientX - startX)))
      setColWidths(prev => ({ ...prev, [key]: w }))
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
  // Inline width style for a column (applied to both th and td) so a resized
  // column holds its width instead of the browser auto-fitting to content.
  const widthStyle = (key: GLColKey): CSSProperties | undefined => {
    // Fit and Equal hand every width to the layout engine (spec §8).
    if (engineSized) return undefined
    // The leading column declares the gutter on top of its own width, so the
    // border the gutter is drawn as comes out of the extra rather than out of
    // the column's content.
    const fixed = (n: number): CSSProperties => {
      const w = n + (key === leadCol ? gutter : 0)
      return { width: w, minWidth: w, maxWidth: w }
    }
    const w = colWidths[key]
    if (w) return fixed(w)
    // Tree view: the right-pinned figure columns are fixed-width, because each of
    // those offsets is the sum of the widths after it. Account also packs the number,
    // name, and posting count together, so left to itself it auto-sizes very wide and
    // pushes the figure columns off-screen.
    if (view === 'tree') {
      const pinW = TREE_PIN_W[key]
      if (pinW) return fixed(pinW)
    }
    // List view: columns whose content only appears on the expanded child rows
    // (account / debit / credit / category) would collapse to nothing while
    // every entry is closed and then jump wider on the first expansion,
    // flickering the whole table. Reserve a stable minimum so widths stay put
    // regardless of expansion state. Date / Debit / Credit widths are fully
    // fixed so the sticky-left / sticky-right pinning offsets stay accurate.
    if (view === 'list') {
      if (key === 'date') return fixed(LIST_DATE_W)
      if (key === 'account') return fixed(LIST_ACCOUNT_W)
      if (key === 'debit' || key === 'credit') return fixed(LIST_MONEY_W)
      // An entry's total runs a digit or two past one line's figure.
      if (key === 'amount') return fixed(LIST_MONEY_W + 20)
    }
    /* The short columns take the width their content needs and no more, so the
       room left over goes to Memo, the one column with prose in it. Left to the
       table, the spare width was dealt out to every column, and on a wide screen
       Journal entry grew to several times its number (design review,
       2026-09-24 - Eli: *"I don't know why it's so wide ... narrow up some of
       the columns"*). Every one of these cells is nowrap, so 1px resolves to
       its content. */
    if (SHRINK_TO_CONTENT.has(key)) return { width: 1 }
    return undefined
  }
  /* What the Account cell's content may occupy: the column's width, less its
     px-4 edges. The cell packs number, name and posting count, all nowrap, so
     left to itself its min-content wins over the column's nominal width in an
     auto-layout table and the column runs to 500-odd px whatever `TREE_PIN_W`
     says. Bounding the content is what makes the width real - the name
     truncates, and the drag grip on the header actually narrows the column
     instead of stopping at the longest name in the ledger. */
  const accountInnerW = (() => {
    const w = colWidths.account ?? (view === 'tree' ? TREE_PIN_W.account : LIST_ACCOUNT_W)
    return w === undefined ? undefined : w - 32
  })()
  /* The number and the posting count are both nowrap, so every pixel the reader
     drags off the column comes out of the name between them - at the floor that
     left "1030 O" where an account's identity should be. The count is the one
     part that can go: it is a second fact about the account, not what names it. */
  const showPostingCount = (accountInnerW ?? Infinity) >= 208
  /* A posting's Account cell holds its entry number and, on an adjustment, the
     Adjustment badge (30 indent + 118 number + 6 gap + 90 badge). Narrower than
     that, the badge keeps its chip and drops its word to the hover, so the entry
     number - what names the posting - is not the part that gives. */
  const fullAdjustmentBadge = (accountInnerW ?? Infinity) >= 244
  const headRowRef = useRef<HTMLTableRowElement>(null)
  const [pinnedWidths, setPinnedWidths] = useState<Record<string, number>>({})
  // The list view's leading chevron gutter, which pins ahead of every data column.
  // Stands down with the rest of the run under Fit and Equal (spec §8): a lone
  // pinned chevron over columns that scroll freely past it reads as a stuck cell,
  // not as a frozen edge.
  const chevronPin = (header = false): CSSProperties | undefined =>
    engineSized ? undefined : { position: 'sticky', left: 0, zIndex: header ? Z_LIST_HEAD_PIN : Z_LIST_PIN }
  const pinZ = (row: PinRow) =>
    row === 'header' ? Z_LIST_HEAD_PIN
      : view === 'list' ? Z_LIST_PIN
        : row === 'parent' ? Z_TREE_PARENT_PIN : Z_TREE_PIN
  // Every column in the left run needs a width of its own, because each offset is
  // the sum of the widths before it.
  const pinnedColW = (key: GLColKey): number =>
    colWidths[key]
    ?? (view === 'list' ? LIST_PIN_W[key] : undefined)
    ?? (view === 'tree' ? TREE_PIN_W[key] : undefined)
    ?? FROZEN_COL_W
  // The run's offsets are summed from measured widths rather than nominal ones,
  // because a column the reader froze carries no width of its own and is as wide
  // as its content negotiates - and an offset short by a few pixels leaves a seam
  // or laps the column before it. Width is what's measured, not position: a sticky
  // cell's `offsetLeft` carries the shift the pin itself applied, so feeding that
  // back in would walk the column off the table.
  useLayoutEffect(() => {
    const row = headRowRef.current
    if (!row) return
    const next: Record<string, number> = {}
    // The chevron gutter leads the list view's run and negotiates its own width too,
    // so it is measured rather than assumed for the same reason the columns are.
    const lead = row.querySelector<HTMLElement>('th[data-col-lead]')
    if (lead) next.__lead = Math.round(lead.getBoundingClientRect().width)
    for (const k of leftPinRun) {
      const th = row.querySelector<HTMLElement>(`th[data-col-drag-key="${k}"]`)
      if (th) next[k] = Math.round(th.getBoundingClientRect().width)
    }
    setPinnedWidths(prev => {
      const keys = Object.keys(next)
      const same = keys.length === Object.keys(prev).length && keys.every(k => prev[k] === next[k])
      return same ? prev : next
    })
  })
  const leftPin = (key: GLColKey, row: PinRow): CSSProperties | undefined => {
    const idx = leftPinRun.indexOf(key)
    if (idx < 0) return undefined
    return {
      position: 'sticky',
      left: (view === 'list' ? pinnedWidths.__lead ?? chevW : 0)
        + leftPinRun.slice(0, idx).reduce((sum, k) => sum + (pinnedWidths[k] ?? pinnedColW(k)), 0),
      zIndex: pinZ(row),
      // Only the last cell of the run draws the edge, since that's the one the
      // scrolling columns pass under.
      boxShadow: idx === leftPinRun.length - 1 ? LIST_LEFT_EDGE_SHADOW : undefined,
    }
  }
  const pinStyle = (key: GLColKey, row: PinRow = 'body'): CSSProperties | undefined =>
    // A frozen offset is a sum of widths, so the whole run stands down with the
    // widths it was summed from (spec §8).
    engineSized ? undefined : leftPin(key, row)
  // A frozen column can be any column in the table, so the pin has to reach cells
  // whose own renderer never expected one. The cell is rebuilt with the pin merged
  // in rather than threading the style through every branch of every renderer.
  // The opaque fill a pinned cell needs comes from `--gl-row-bg` in the list view,
  // and in the tree from the `tbody.gl-group` rules, which already paint every cell.
  const withPin = (cell: ReactElement, pin: CSSProperties | undefined): ReactElement => {
    if (!pin) return cell
    const props = cell.props as { style?: CSSProperties; className?: string }
    return cloneElement(cell as ReactElement<{ style?: CSSProperties; className?: string }>, {
      style: { ...pin, ...props.style },
      className: cn(props.className, view === 'list' && 'gl-list-pin'),
    })
  }

  // In-table column reorder - drag a header to move it, Partners-parity: a
  // floating chip tracks the cursor and the column moves live as the pointer
  // crosses into a neighbouring header. The same hook every table here uses
  // (tableColumns.tsx), which also hides the column when it is dropped off the
  // top of the table - red while a release would - unless it is one the header
  // menu would not hide either.
  const glDrag = useColumnDragReorder({
    order: columnOrder,
    setOrder: setColumnOrder,
    locked: dragLockedSet,
    onHide: k => hideColumn(k as GLColKey),
    canHide: k => { const c = colByKey.get(k as GLColKey); return !!c && !c.required && !c.alwaysShown },
  })
  const draggingColumnKey = glDrag.draggingKey
  const handleHeaderMouseDown = glDrag.onHeaderMouseDown

  const scrollRef = useRef<HTMLDivElement>(null)
  // The entries in the drawn blocks, for Collapse all's animation.
  const drawnJesRef = useRef<string[]>([])
  // The Journal entries tab's rows, which `listWindow` measures.
  const listBodyRef = useRef<HTMLTableSectionElement>(null)
  // Crosshair on hover shades the row and column under the pointer (spec §7). It
  // reads the table out of the scroller, so it is bound here rather than inside
  // the table markup.
  useCrosshair(scrollRef, look.crosshair)
  // Tree view: the column header pins at top:0, and expanded account rows pin
  // just beneath it. Measure the header height so the sticky parent rows offset
  // flush below it (re-measures on resize).
  const theadRef = useRef<HTMLTableSectionElement>(null)
  const [headTop, setHeadTop] = useState(41)
  useLayoutEffect(() => {
    const el = theadRef.current
    if (!el) return
    const measure = () => setHeadTop(Math.floor(el.getBoundingClientRect().height))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  // Every expanded account's parent row pins at the same `headTop`, stacking as
  // you scroll. Each pinned row draws its own drop shadow, so letting them all
  // stay "stuck" sums the shadows into a darkening band. Track the single
  // frontmost pinned group - the one whose <tbody> straddles the pin line - and
  // let only that one carry the shadow.
  const [stuckAcct, setStuckAcct] = useState<string | null>(null)
  // List view: group the filtered postings under their journal entry. Each group
  // carries one collapsible entry-level row plus its posting lines; group order
  // follows the filtered/sorted line order (first line encountered per JE wins).
  const jeGroups = useMemo(() => {
    type JeGroup = {
      jeNumber: string
      date: string
      source: GLRow['t']['source']
      reference: string
      description: string
      // The memo the entry was posted with, where someone wrote one.
      memo: string
      period: string
      rows: GLRow[]
      debit: number
      credit: number
    }
    const m = new Map<string, JeGroup>()
    for (const row of filtered) {
      const je = row.t.jeNumber
      let g = m.get(je)
      if (!g) {
        g = {
          jeNumber: je,
          date: row.t.date,
          source: row.t.source,
          reference: row.t.reference,
          description: row.t.description,
          /* Off the entry's first posting in posting order - the one the search
             reads - not the first in sort order: a seeded entry with no memo of its
             own borrows a line's narration, and sorting must not change which. */
          memo: entryMemo(entryText(je).head),
          period: row.t.period,
          rows: [],
          debit: 0,
          credit: 0,
        }
        m.set(je, g)
      }
      g.rows.push(row)
      g.debit += row.t.debit
      g.credit += row.t.credit
    }
    // Standard accounting order inside each entry: debits first, then credits.
    for (const g of m.values()) {
      g.rows.sort((a, b) => (a.t.debit > 0 ? 0 : 1) - (b.t.debit > 0 ? 0 : 1))
    }
    return [...m.values()]
  }, [filtered, entryText])

  /* What an expanded entry shows. Not `g.rows`, which is the postings that
     survived the filter, and not the postings sharing the number either: the
     ledger stores one row per posting and a seeded entry carries only its primary
     side, so both of those open an entry onto one side of itself. This tab's whole
     claim is that a reader can see an entry whole and check that it balances,
     which it could not do.

     Read through `reconstructEntry` so the ledger and the entry's own page show
     the same lines, down to the synthesised contra. Lazy and cached rather than
     built for the page, because most entries are never expanded.

     Handed only the entry's own postings. Given the whole ledger it filtered
     every posting to find them, once per entry, which is fine for twenty open
     entries and not for the thousands a large page opens under Expand all. Only
     the lines are read here, and they come out the same from the entry's own
     postings; the reversal links it would otherwise scan for are the entry page's
     business. */
  const txById = useMemo(() => new Map(transactions.map(t => [t.id, t])), [transactions])
  const txByJe = useMemo(() => {
    const m = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const list = m.get(t.jeNumber)
      if (list) list.push(t); else m.set(t.jeNumber, [t])
    }
    return m
  }, [transactions])
  const entryRows = useMemo(() => {
    const cache = new Map<string, GLRow[]>()
    return (g: (typeof jeGroups)[number]): GLRow[] => {
      const hit = cache.get(g.jeNumber)
      if (hit) return hit
      const rows = reconstructEntry(g.jeNumber, txByJe.get(g.jeNumber) ?? [], accounts).lines
        .sort((a, b) => (a.debit > 0 ? 0 : 1) - (b.debit > 0 ? 0 : 1))
        .map(l => ({
          acct: l.account,
          /* A real posting keeps its own row, so the columns the line does not
             carry - its period, its dimensions - stay the ledger's rather than
             this table's guess. Only the synthesised contra needs standing in. */
          t: txById.get(l.id) ?? {
            id: l.id, accountId: l.accountId, date: g.date, source: g.source,
            jeNumber: g.jeNumber, reference: g.reference, entryType: 'Simple' as const,
            description: l.description, debit: l.debit, credit: l.credit,
            runningBalance: 0,
            // The account's default per dimension, as any posting takes it (2026-10-02).
            dimensionValues: postingDimensions(l.account?.defaultDimensionValues),
            period: g.period,
          },
        }))
      cache.set(g.jeNumber, rows)
      return rows
    }
  }, [accounts, txById, txByJe])
  /* The entries the tab opens by itself.

     The first entry on arrival, so a reader sees at once that an entry opens
     into its lines. Design review, 2026-09-28 - Mahreen: *"whenever you open it,
     the default will open one line so that the user can see that, but the rest
     will be standard collapse."* This replaces the everything-closed rule of
     2026-09-11 for this tab only, and only for the one entry.

     And, while searching, every entry with a line the search matched - its
     account, the line's description, a dimension, a figure - so the lines that
     answered are on screen. Eli: *"if you have results that are in the buried
     structure, then open those structures ... Don't surface them and force the
     user to open, open, open."* An entry matched only on its own row (its
     number, its document) stays closed: there is nothing more inside to show. */
  const [firstOpenJe, setFirstOpenJe] = useState<string | null>(null)
  const seededFirstOpen = useRef(false)
  useEffect(() => {
    if (seededFirstOpen.current || view !== 'list' || loading || !jeGroups.length) return
    seededFirstOpen.current = true
    setFirstOpenJe(jeGroups[0].jeNumber)
  }, [view, loading, jeGroups])
  const autoOpenJes = useMemo(() => {
    const out = new Set<string>()
    if (firstOpenJe) out.add(firstOpenJe)
    if (!searching) return out
    for (const g of jeGroups) {
      // Its lines as the lines print them (LINE_COLS), which are what opening it shows.
      if (found(entryText(g.jeNumber).linesText)) out.add(g.jeNumber)
    }
    return out
  }, [firstOpenJe, searching, jeGroups, entryText, found])
  // A new search starts from what it opens, not from what the last one did.
  useEffect(() => { setJeExceptions(prev => (prev.size ? new Set() : prev)) }, [query])

  // Denominator for the Journal entries tab's row count: entries in the period, not
  // postings, so it's comparable to the filtered entry count beside it. Scoped to
  // the period for the same reason - "12 of 40 entries" has to mean 40 entries the
  // reader could reach by clearing the search, not 40 somewhere in the ledger.
  const totalEntryCount = useMemo(
    () => new Set(periodTx.map(t => t.jeNumber)).size, [periodTx],
  )

  // Expand/collapse every row in whichever view is showing: set the mode and drop
  // the per-row exceptions. Collapsing the list stages the open entries first so
  // their children animate out instead of vanishing.
  const currentExpandMode = expandMode[view]
  const setAllExpanded = (mode: ExpandMode) => {
    if (view === 'list') {
      // Collapse all means all, including the entry opened on arrival.
      if (mode === 'collapsed') setFirstOpenJe(null)
      if (mode === 'collapsed') {
        // Only the drawn entries animate shut; nothing of the rest is on screen.
        const open = drawnJesRef.current.filter(isJeOpen)
        setClosingJes(new Set(open))
        clearClosing(open)
      } else {
        setClosingJes(new Set())
      }
      setJeExceptions(new Set())
    } else {
      setAcctExceptions(new Set())
    }
    setExpandMode(prev => ({ ...prev, [view]: mode }))
  }

  // Tree view: group the filtered postings under their owning account, ordered by
  // account number. An account expands straight into its postings - `filtered`
  // already runs oldest first, so the running balance column reads top to bottom
  // as one continuous figure without a level in between.
  const treeGroups = useMemo(() => {
    type Group = { acct: Account | undefined; rows: GLRow[]; debit: number; credit: number }
    const m = new Map<string, Group>()
    for (const row of filtered) {
      const id = row.acct?.id ?? '__unassigned__'
      let g = m.get(id)
      if (!g) { g = { acct: row.acct, rows: [], debit: 0, credit: 0 }; m.set(id, g) }
      g.rows.push(row)
      g.debit += row.t.debit
      g.credit += row.t.credit
    }
    return [...m.values()].sort((a, b) =>
      (a.acct?.accountNumber ?? '~').localeCompare(b.acct?.accountNumber ?? '~', undefined, { numeric: true }))
  }, [filtered])

  /* The accounts the ledger tab opens by itself: every one whose postings hold
     the search, so the lines that answered are on screen rather than shut behind
     a row that gives no sign of holding them.

     Searching "rent" used to return six collapsed accounts with no yellow
     anywhere, one of them 11130 Operating - Chase Bank, which does not contain
     the word: the reader had to open each in turn to find out why it was there.

     An account matched only on its own row - its number, its name, its category,
     all of which that row prints and marks - stays shut, because there is
     nothing further inside to show. The entries tab draws the same line. */
  const autoOpenAccts = useMemo(() => {
    const out = new Set<string>()
    if (!searching) return out
    for (const g of treeGroups) {
      if (g.rows.some(r => found(postingText(r)))) out.add(g.acct?.id ?? '__unassigned__')
    }
    return out
  }, [searching, treeGroups, found, postingText])
  // A new search starts from what it opens, not from what the last one did.
  useEffect(() => { setAcctExceptions(prev => (prev.size ? new Set() : prev)) }, [query])

  /* Which open groups have drawn their postings. Expand all on a month of
     postings drew some 2,000 rows in one go and froze the page for seconds -
     Eli, 2026-09-24: *"it's very laggy, and it's laggy even in your prototype"*,
     with a month here being what a busy company posts in a day. So under Expand
     all a group draws its postings once it comes within a screen or so of the
     viewport, and until then holds their height with a single spacer row. Once
     drawn it stays drawn, so scrolling back up never redraws anything.

     A group the reader opened by hand is always drawn: they clicked it, so it
     is on screen, and it is one group. A group a *search* opened goes through
     the same gate as Expand all, because one letter in the box opens as many
     accounts at once. */
  const [drawnGroups, setDrawnGroups] = useState<Set<string>>(new Set())
  const openedInBulk = (id: string) => expandMode.tree === 'expanded' || autoOpenAccts.has(id)
  const isDrawn = (id: string) => !openedInBulk(id) || drawnGroups.has(id)
  // The height a posting row will have, for the spacer. Measured off a drawn row
  // when there is one, so a density change or a zoomed page still lines up.
  const [rowH, setRowH] = useState(37)
  useEffect(() => { setDrawnGroups(new Set()) }, [expandMode.tree, treeGroups, look.density])
  useEffect(() => {
    if (view !== 'tree' || (expandMode.tree !== 'expanded' && !autoOpenAccts.size)) return
    const root = scrollRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(entries => {
      const near = entries.filter(e => e.isIntersecting).map(e => (e.target as HTMLElement).dataset.acct!)
      if (!near.length) return
      setDrawnGroups(prev => {
        if (near.every(id => prev.has(id))) return prev
        const next = new Set(prev)
        near.forEach(id => next.add(id))
        return next
      })
    }, { root, rootMargin: '1000px 0px' })
    root.querySelectorAll<HTMLElement>('tbody[data-acct]').forEach(tb => io.observe(tb))
    const drawnRow = root.querySelector<HTMLElement>('tr.gl-child')
    if (drawnRow) {
      const h = Math.round(drawnRow.getBoundingClientRect().height)
      if (h > 0) setRowH(prev => (prev === h ? prev : h))
    }
    return () => io.disconnect()
  }, [view, expandMode.tree, autoOpenAccts, treeGroups, drawnGroups])

  // Two jobs, both driven off the same per-scroll measurement of every account
  // group's <tbody>:
  //
  // 1. Release each pinned parent row when its own postings run out. A sticky
  //    table cell is constrained by the table, not by its row group, so the
  //    browser keeps an expanded account's parent row pinned for the rest of the
  //    ledger. --gl-pin-top supplies the missing row-group constraint: the row may
  //    sit at `headTop` only while its <tbody> still extends a row height below
  //    that line; past that it tracks the tbody's bottom edge and slides up out of
  //    view, so it never outlives its last transaction.
  //
  // 2. Track the frontmost pinned group so only it carries the drop shadow (each
  //    pinned row draws its own, and stacked shadows sum into a dark band). An
  //    expanded group's <tbody> straddles the pin line exactly while its parent row
  //    is stuck, so the group crossing that line is the pinned one.
  useEffect(() => {
    if (view !== 'tree') { setStuckAcct(null); return }
    const update = () => {
      const sp = scrollRef.current
      if (!sp) return
      const spTop = sp.getBoundingClientRect().top
      const pinY = spTop + headTop
      const scrolled = sp.scrollTop > 0
      let active: string | null = null
      sp.querySelectorAll<HTMLElement>('tbody[data-acct]').forEach(tb => {
        const r = tb.getBoundingClientRect()
        if (scrolled && r.top <= pinY + 1 && r.bottom > pinY + 1) active = tb.getAttribute('data-acct')
        // Only expanded groups pin, so only they need the constraint.
        if (!tb.classList.contains('gl-expanded')) { tb.style.removeProperty('--gl-pin-top'); return }
        const rowH = tb.querySelector<HTMLElement>('tr.gl-parent')?.getBoundingClientRect().height ?? 0
        tb.style.setProperty('--gl-pin-top', `${Math.min(headTop, r.bottom - spTop - rowH)}px`)
      })
      setStuckAcct(scrolled ? active : null)
    }
    update()
    const sp = scrollRef.current
    sp?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => { sp?.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [view, headTop, expandMode.tree, acctExceptions, treeGroups])


  /* The four entry columns, drawn once for both tabs. Tags are the entry's
     chips, read-only here (they are added on the entry's page) and marked when
     the search matches them. */
  const entryColCell = (key: 'internalId' | 'currency' | 'fxAmount' | 'tags' | AuditKey, t: Transaction, fx: number | undefined) => {
    switch (key) {
      case 'createdBy': return <td key={key} className={cn('px-4 max-w-[220px]', PERSON_PAD)}><PersonCell name={entryCreatedBy(t)} comfort={look.density === 'comfort'} q={query} /></td>
      case 'createdAt': return <td key={key} className={cn('px-4', padY)}><StampCell at={entryCreatedAt(t)} q={query} /></td>
      case 'updatedBy': return <td key={key} className={cn('px-4 max-w-[220px]', PERSON_PAD)}><PersonCell name={lastChangeOf(t, rowCtx.changes).by} comfort={look.density === 'comfort'} q={query} /></td>
      case 'updatedAt': return <td key={key} className={cn('px-4', padY)}><StampCell at={lastChangeOf(t, rowCtx.changes).at} q={query} /></td>
      case 'internalId': return <td key={key} className={cn('px-4 whitespace-nowrap tabular-nums text-slate-700', padY)}>{t.entryInternalId ? <Marked text={t.entryInternalId} q={query} /> : <span className="text-fg-subtle">-</span>}</td>
      // The chart's cell, flag and code chip, so a currency reads the same in
      // every table of the module (Mahad, 2026-10-09: *"I want the same UI"*).
      case 'currency': return <td key={key} className={cn('px-4', padY)}><CurrencyCell code={t.entryCurrency ?? base} q={query} /></td>
      case 'fxAmount': return (
        <td key={key} className={cn('px-4 text-right tabular-nums whitespace-nowrap text-slate-800', padY)}>
          {fx !== undefined && t.entryCurrency ? <Marked text={fmtCurrencyExact(fx, t.entryCurrency)} q={query} /> : <span className="text-fg-subtle">-</span>}
        </td>
      )
      case 'tags': {
        const tags = rowCtx.tagsOf(t.jeNumber)
        return (
          <td key={key} className={cn('px-4', padY)}>
            {tags.length
              ? <div className="flex flex-wrap gap-1 max-w-[260px]">{tags.map(tag => <TagChip key={tag} label={tag} q={query} />)}</div>
              : <span className="text-fg-subtle">-</span>}
          </td>
        )
      }
    }
  }

  // One place that renders a body cell for a given column key.
  const renderCell = (key: GLColKey, t: Transaction, acct: Account | undefined) => {
    const cat = acct ? ACCOUNT_TYPE_META[acct.accountType] : undefined
    const pin = pinStyle(key)
    // The opaque fill for a pinned cell comes from `--gl-row-bg` in the list view and
    // from the `tbody.gl-group` rules in the tree, so this class is list-only: in the
    // tree that variable is undefined and the cell would turn transparent.
    const pinCls = pin && view === 'list' ? 'gl-list-pin' : ''
    switch (key) {
      case 'date': return <td key={key} className={cn('px-4 text-slate-600 whitespace-nowrap', padY, pinCls)} style={pin}><Marked text={fmtDate(t.date)} q={query} /></td>
      case 'account': return (
        <td key={key} className={cn('px-4', padY)}>
          {acct ? (
            <div className="flex items-baseline gap-2 min-w-0" style={{ width: accountInnerW }}>
              <span className="text-slate-500 tabular-nums whitespace-nowrap" title={acct.accountNumber}><Marked text={numberText(acct.accountNumber)} q={query} /></span>
              <span className="text-slate-800 truncate" style={{ fontWeight: 500 }} title={acct.accountName}><Marked text={acct.accountName} q={query} /></span>
              {lineAdjustment(t, acct) && <span className="self-center"><AdjustmentBadge kinds={[lineAdjustment(t, acct)!]} q={query} /></span>}
            </div>
          ) : <span className="text-fg-subtle">-</span>}
        </td>
      )
      case 'category': return (
        <td key={key} className={cn('px-4 whitespace-nowrap', padY)}>
          {cat ? <CategoryCell meta={cat} q={query} /> : <span className="text-fg-subtle">-</span>}
        </td>
      )
      case 'entry': return (
        <td key={key} className={cn('px-4 whitespace-nowrap', padY)}>
          <button
            type="button"
            onClick={() => navigate(`/general-ledger/entry/${encodeURIComponent(t.jeNumber)}`)}
            className="inline-flex items-center gap-1.5 tabular-nums text-primary hover:text-[#0862D0] hover:underline underline-offset-2 transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
            title="Open journal entry"
          >
            <FileText size={12} className="text-primary/60 shrink-0" />
            <Marked text={t.jeNumber} q={query} />
          </button>
        </td>
      )
      case 'source': return (
        <td key={key} className={cn('px-4 whitespace-nowrap text-slate-700', padY)}>
          <Marked text={sourceDocName(t.source)} q={query} />
        </td>
      )
      case 'reference': return (
        <td key={key} className={cn('px-4 whitespace-nowrap', padY)}>
          {t.reference ? (
            <LinkedDocLink source={t.source} reference={t.reference} q={query} />
          ) : (
            <span className="text-fg-subtle" title="No source document. This entry was created directly in the ledger.">-</span>
          )}
        </td>
      )
      // A line needn't have its own narration - the entry's memo lives on the
      // entry, so an em-dash here is a fact rather than missing data.
      /* One line, cut at MEMO_MAX_W with the whole text on hover. Left to run,
         the longest memo in the month set the column's width and pushed Debit,
         Credit and Running balance off the right edge of a 1600px screen, now
         that nothing pins them there. */
      // A posting's own line text: the General ledger tab's Line description.
      case 'lineDescription': return <td key={key} className={cn('px-4 text-slate-800', padY)} style={{ fontWeight: 500 }}>{t.description ? <div className="truncate" style={{ maxWidth: MEMO_MAX_W }} title={t.description}><Marked text={t.description} q={query} /></div> : <span className="text-fg-subtle">-</span>}</td>
      /* The entry's memo, the same on every posting of it. Drawn on the entries
         tab only now (the column is `listOnly`); kept here for the flat cell. */
      case 'description': {
        const memo = entryMemo(t)
        return <td key={key} className={cn('px-4 text-slate-800', padY)} style={{ fontWeight: 500 }}>{memo ? <div className="truncate" style={{ maxWidth: MEMO_MAX_W }} title={memo}><Marked text={memo} q={query} /></div> : <span className="text-fg-subtle">-</span>}</td>
      }
      case 'dimensions': return <td key={key} className={cn('px-4', padY)}><DimensionPills dimensionValues={t.dimensionValues} q={query} /></td>
      // A General ledger row is one line, so its foreign amount is the line's.
      case 'internalId': case 'currency': case 'tags':
      case 'createdBy': case 'createdAt': case 'updatedBy': case 'updatedAt': return entryColCell(key, t, undefined)
      case 'fxAmount': return entryColCell(key, t, fxLine(t))
      case 'debit': return <td key={key} className={cn('px-4 text-right tabular-nums whitespace-nowrap text-slate-800', padY, pinCls)} style={pin}>{t.debit ? <Marked text={fmtCurrencyExact(t.debit, base)} q={query} /> : <span className="text-fg-subtle">-</span>}</td>
      case 'credit': return <td key={key} className={cn('px-4 text-right tabular-nums whitespace-nowrap text-slate-800', padY, pinCls)} style={pin}>{t.credit ? <Marked text={fmtCurrencyExact(t.credit, base)} q={query} /> : <span className="text-fg-subtle">-</span>}</td>
      // The account's balance immediately after this posting, signed the same way
      // the register signs it so the two views of one ledger agree.
      case 'balance': return (
        <td key={key} className={cn('px-4 text-right tabular-nums whitespace-nowrap text-slate-900', padY, pinCls)} style={{ ...pin, fontWeight: 600 }}>
          {balanceByTx.has(t.id) ? <Marked text={fmtCurrencyExact(balanceByTx.get(t.id)!, base)} q={query} /> : <span className="text-fg-subtle">-</span>}
        </td>
      )
      default: return <td key={key} className={cn('px-4', padY)} />
    }
  }

  // List view - journal-entry parent row: shows only the entry-level fields
  // (date, entry number, linked document, description, period). Account /
  // Category / Debit / Credit are left blank on the parent since one entry
  // straddles multiple accounts and sides.
  const renderJeParentCell = (key: GLColKey, g: (typeof jeGroups)[number]) => {
    const pin = pinStyle(key)
    const pinCls = pin ? 'gl-list-pin' : ''
    switch (key) {
      case 'date': return <td key={key} className={cn('px-4 text-slate-600 whitespace-nowrap', padY, pinCls)} style={{ ...pin, fontWeight: 500 }}><Marked text={fmtDate(g.date)} q={query} /></td>
      case 'entry': return (
        <td key={key} className={cn('px-4 whitespace-nowrap', padY)}>
          {/* One row centred on itself: the number is an inline-flex button that
              sits on its text's baseline, and a badge beside it on `align-middle`
              landed a couple of pixels below it. */}
          <span className="inline-flex items-center gap-2 align-middle">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/general-ledger/entry/${encodeURIComponent(g.jeNumber)}`) }}
            className="inline-flex items-center gap-1.5 tabular-nums text-primary hover:text-[#0862D0] hover:underline underline-offset-2 transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
            title="Open journal entry"
          >
            <FileText size={12} className="text-primary/60 shrink-0" />
            <Marked text={g.jeNumber} q={query} />
          </button>
          {g.rows[0]?.t.adjustmentReason && (
            <AdjustmentBadge kinds={[...new Set(entryText(g.jeNumber).lines.map(r => lineAdjustment(r.t, r.acct)).filter((k): k is AdjustmentKind => !!k))]} q={query} />
          )}
          </span>
        </td>
      )
      /* Where the entry came from. The entry row never drew it, so the column
         read blank on this tab from top to bottom - the one column the review
         asked to have explained. */
      case 'source': return (
        <td key={key} className={cn('px-4 whitespace-nowrap text-slate-700', padY)}>
          <Marked text={sourceDocName(g.source)} q={query} />
        </td>
      )
      case 'reference': return (
        // Stops the click reaching the row, which would expand the entry behind
        // the tab the reader just sent the document to.
        <td key={key} className={cn('px-4 whitespace-nowrap', padY)} onClick={e => e.stopPropagation()}>
          {g.reference ? (
            <LinkedDocLink source={g.source} reference={g.reference} q={query} />
          ) : (
            <span className="text-fg-subtle" title="No source document. This entry was created directly in the ledger.">-</span>
          )}
        </td>
      )
      /* The memo the entry was posted with, or on a seeded entry, which nobody
         wrote, the narration its first line carries (see `entryMemo`). */
      case 'description': {
        const text = g.memo
        return <td key={key} className={cn('px-4 text-slate-800', padY)} style={{ fontWeight: 500 }}>{text ? <div className="truncate" style={{ maxWidth: MEMO_MAX_W }} title={text}><Marked text={text} q={query} /></div> : <span className="text-fg-subtle">-</span>}</td>
      }
      case 'amount': {
        const total = rowCtx.entryTotal(g.jeNumber)
        return (
          <td key={key} className={cn('px-4 text-right tabular-nums whitespace-nowrap text-slate-900', padY)} style={{ fontWeight: 600 }}>
            {total ? <Marked text={fmtCurrencyExact(total, base)} q={query} /> : <span className="text-fg-subtle">-</span>}
          </td>
        )
      }
      case 'period': return <td key={key} className={cn('px-4 text-slate-600 whitespace-nowrap', padY)}>{g.period ? <Marked text={g.period} q={query} /> : <span className="text-fg-subtle">-</span>}</td>
      // The entry's own, on its row; its lines below leave them blank. The
      // foreign amount here is the entry's total in its own currency.
      case 'internalId': case 'currency': case 'tags': case 'fxAmount':
      case 'createdBy': case 'createdAt': case 'updatedBy': case 'updatedAt': {
        const head = g.rows[0]?.t
        return head ? entryColCell(key, head, rowCtx.fxTotal(g.jeNumber)) : <td key={key} className={cn('px-4', padY)} />
      }
      // account / category / debit / credit are intentionally blank on the JE
      // parent row: the entry-level view hides sides and account breakdowns.
      // Debit / Credit still need to pin to the right - the empty cell holds
      // the pinned real estate so scrolled content doesn't leak under them.
      default: return <td key={key} className={cn('px-4', padY, pinCls)} style={pin} />
    }
  }

  // List view - JE child row: reuse the flat renderer for account/debit/credit,
  // leave the entry-level columns blank so they don't repeat the parent row.
  const renderJeChildCell = (key: GLColKey, t: Transaction, acct: Account | undefined) => {
    if (key === 'account' || key === 'debit' || key === 'credit' || key === 'category' || key === 'dimensions') {
      return renderCell(key, t, acct)
    }
    // Each line's own note, under the entry's memo.
    if (key === 'lineDescription') {
      return <td key={key} className={cn('px-4 text-slate-700', padY)}>{t.description ? <div className="truncate" style={{ maxWidth: MEMO_MAX_W }} title={t.description}><Marked text={t.description} q={query} /></div> : <span className="text-fg-subtle">-</span>}</td>
    }
    // Non-content columns still need to hold pinned real estate (Date in
    // particular) so scrolled content can't leak under the left-pin run.
    const pin = pinStyle(key)
    const pinCls = pin ? 'gl-list-pin' : ''
    return <td key={key} className={cn('px-4', padY, pinCls)} style={pin} />
  }

  // Tree view - parent account row: the +/− disclosure + full number/name sit in
  // the Account column; every other column stays empty so the transaction columns
  // below read as children.
  //
  // The figures change meaning with the disclosure, because the row's job does.
  // Expanded, it opens the account: no Debit or Credit of its own, and a Balance
  // that is where the period *found* the account. What follows then reads as one
  // continuous column - opening, then a running balance per posting, then the
  // closing on the total row that shuts the group. Collapsed, that total row
  // isn't rendered, so this is the only summary the reader gets and it carries
  // the period's debit and credit totals against the closing balance.
  const renderParentCell = (key: GLColKey, g: (typeof treeGroups)[number], open: boolean) => {
    const acctId = g.acct?.id ?? '__unassigned__'
    // No inline background here: `tbody.gl-group` already paints these cells opaque
    // and handles the hover fill, which an inline colour would freeze.
    const pin = pinStyle(key, 'parent')
    switch (key) {
      case 'account': return (
        <td key={key} className={cn('relative px-4', padY)} style={pin}>
          {/* Trunk stub dropping from this row's toggle into its first posting,
              shown only while one of its postings is hovered. */}
          {treeLines && open && (
            <span aria-hidden className="gl-guide gl-guide-stub absolute w-px bg-slate-400" style={{ left: GUIDE_X, top: 'calc(50% + 14px)', bottom: 0 }} />
          )}
          <div className="flex items-center gap-2.5 min-w-0" style={{ width: accountInnerW }}>
            <ExpandToggle expanded={open} onClick={() => toggleAcct(acctId)} arrows={!treeLines} />
            {g.acct ? (
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-slate-500 tabular-nums whitespace-nowrap" title={g.acct.accountNumber}><Marked text={numberText(g.acct.accountNumber)} q={query} /></span>
                <span className="text-slate-800 truncate" style={{ fontWeight: 600 }} title={g.acct.accountName}><Marked text={g.acct.accountName} q={query} /></span>
                {showPostingCount && (
                  <span className="text-fg-subtle text-xs whitespace-nowrap">· {g.rows.length} {g.rows.length === 1 ? 'posting' : 'postings'}</span>
                )}
              </div>
            ) : <span className="text-slate-800" style={{ fontWeight: 600 }}><Marked text="Unassigned" q={query} /></span>}
          </div>
        </td>
      )
      // Blank while expanded: the movements belong to the postings underneath and
      // are totalled once, on the row that closes the group.
      case 'debit': return <td key={key} className={cn('px-4 text-right tabular-nums whitespace-nowrap text-slate-800', padY)} style={{ ...pin, fontWeight: 600 }}>{!open && g.debit ? <Marked text={fmtCurrencyExact(g.debit, base)} q={query} /> : <span className="text-fg-subtle">-</span>}</td>
      case 'credit': return <td key={key} className={cn('px-4 text-right tabular-nums whitespace-nowrap text-slate-800', padY)} style={{ ...pin, fontWeight: 600 }}>{!open && g.credit ? <Marked text={fmtCurrencyExact(g.credit, base)} q={query} /> : <span className="text-fg-subtle">-</span>}</td>
      // Expanded: the opening balance, so the first posting's running balance
      // reads as a step from it. Collapsed: where the account stands at the end
      // of the period, the same figure the Chart of Accounts lists there.
      case 'balance': return (
        <td
          key={key}
          className={cn('px-4 text-right tabular-nums whitespace-nowrap text-slate-900', padY)}
          style={{ ...pin, fontWeight: 700 }}
          title={open ? 'Opening balance for this period' : 'Closing balance for this period'}
        >
          {g.acct
            ? <Marked text={fmtCurrencyExact((open ? periodOpeningById : periodBalanceById).get(g.acct.id) ?? g.acct.balance, base)} q={query} />
            : <span className="text-fg-subtle">-</span>}
        </td>
      )
      default: return <td key={key} className={cn('px-4', padY)} />
    }
  }

  // Tree view - child posting row: reuse the flat-cell renderer, but the Account
  // column carries the connector gutter and, past it, the journal entry number.
  //
  // The entry number sits here rather than in a column of its own. The account
  // is named on the row above, so this cell was empty on every posting. Design
  // review, 2026-09-24 - Nophil: *"This is dead real estate"*; Eli: *"It's
  // pointing to it. You can clearly click on it. I could live with that."*
  //
  // The guide is a hover affordance that traces the branch from the account row
  // down to the hovered posting: a full-height trunk on the rows between, and an
  // elbow pointing at the hovered row. It used to be React state set on every
  // row's mouseenter, which re-rendered the whole ledger on each move of the
  // pointer - the lag the review hit with every account expanded. Now every
  // posting carries both shapes and CSS shows the right one (`.gl-guide` rules in
  // index.css, read off `:hover` and `:has()`), so hovering renders nothing.
  const renderChildCell = (key: GLColKey, t: Transaction, acct: Account | undefined) => {
    if (key === 'account') return (
      <td key={key} className={cn('relative px-4', padY)} style={pinStyle('account')}>
        {treeLines && (
          <>
            <span aria-hidden className="gl-guide gl-guide-through absolute w-px bg-slate-400" style={{ left: GUIDE_X, top: 0, bottom: 0 }} />
            {/* Trunk from the top of the row down to the elbow start. */}
            <span aria-hidden className="gl-guide gl-guide-elbow absolute w-px bg-slate-400" style={{ left: GUIDE_X, top: 0, height: 'calc(50% - 8px)' }} />
            {/* Rounded elbow pointing right toward the posting, stopping 3px short
                so the arrowhead completes the horizontal segment instead of sitting
                on top of it. */}
            <span aria-hidden className="gl-guide gl-guide-elbow absolute border-l border-b border-slate-400 rounded-bl-[8px]" style={{ left: GUIDE_X, top: 'calc(50% - 8px)', width: 10, height: 8 }} />
            {/* Solid arrowhead: a zero-size box whose left border draws the triangle
                and whose transparent top/bottom borders give it height. A filled head
                stays crisp at this size, where a rotated 1px chevron lands on
                half-pixels and reads fuzzy. */}
            <span aria-hidden className="gl-guide gl-guide-elbow absolute text-slate-400" style={{ left: GUIDE_X + 10, top: 'calc(50% - 4.5px)', width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '6px solid currentColor' }} />
          </>
        )}
        <div className="flex items-center min-w-0" style={{ width: accountInnerW, paddingLeft: TOTAL_INDENT }}>
          <button
            type="button"
            onClick={() => navigate(`/general-ledger/entry/${encodeURIComponent(t.jeNumber)}`)}
            className="inline-flex items-center gap-1.5 min-w-0 tabular-nums text-primary hover:text-[#0862D0] hover:underline underline-offset-2 transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
            title="Open journal entry"
          >
            <FileText size={12} className="text-primary/60 shrink-0" />
            <span className="truncate"><Marked text={t.jeNumber} q={query} /></span>
          </button>
          {lineAdjustment(t, acct) && <span className="ml-1.5 inline-flex shrink-0"><AdjustmentBadge kinds={[lineAdjustment(t, acct)!]} q={query} compact={!fullAdjustmentBadge} /></span>}
        </div>
      </td>
    )
    return renderCell(key, t, acct)
  }

  // Tree view - the closing total row that ends an expanded account, and the only
  // place an expanded account's Debit and Credit totals appear: the parent row
  // above opens the account rather than summarising it. It restates the account's
  // number and name because the parent row's pin releases as the group's last
  // postings scroll past, so a reader reaching the bottom of a long account has
  // lost the account's identity off the top of the viewport.
  //
  // Pinned as a 'body' row, not a 'parent' one. The total row doesn't stick, so it
  // has to pass *under* its own pinned parent rather than over it.
  const renderTotalCell = (key: GLColKey, g: (typeof treeGroups)[number]) => {
    const pin = pinStyle(key, 'body')
    // Ruled on both edges, so the row reads as closing the account rather than
    // opening the next one - the group below carries the same tint, and without a
    // bottom rule the two would merge into a single block. Borders go on the cell,
    // not the row: this table collapses its borders, where a cell border outranks
    // the neighbouring row's and so wins the shared edge outright instead of
    // stacking with it.
    const cls = cn('px-4 border-y border-border', padY)
    switch (key) {
      case 'account': return (
        <td key={key} className={cls} style={pin}>
          <div className="flex items-baseline gap-2 min-w-0" style={{ width: accountInnerW, paddingLeft: TOTAL_INDENT }}>
            <span className="text-slate-800 whitespace-nowrap" style={{ fontWeight: 600 }}>Total</span>
            {g.acct && <span className="text-slate-500 tabular-nums whitespace-nowrap" title={g.acct.accountNumber}><Marked text={numberText(g.acct.accountNumber)} q={query} /></span>}
            <span className="text-slate-700 truncate" title={g.acct?.accountName}><Marked text={g.acct?.accountName ?? 'Unassigned'} q={query} /></span>
          </div>
        </td>
      )
      case 'debit': return <td key={key} className={cn(cls, 'text-right tabular-nums whitespace-nowrap text-slate-800')} style={{ ...pin, fontWeight: 600 }}>{g.debit ? <Marked text={fmtCurrencyExact(g.debit, base)} q={query} /> : <span className="text-fg-subtle">-</span>}</td>
      case 'credit': return <td key={key} className={cn(cls, 'text-right tabular-nums whitespace-nowrap text-slate-800')} style={{ ...pin, fontWeight: 600 }}>{g.credit ? <Marked text={fmtCurrencyExact(g.credit, base)} q={query} /> : <span className="text-fg-subtle">-</span>}</td>
      // The period closing balance, deliberately the scoped figure rather than
      // the last listed posting's running balance: a column filter can hide the
      // account's final posting, and the row would then disagree with the Chart
      // of Accounts about where the account stands.
      case 'balance': return (
        <td key={key} className={cn(cls, 'text-right tabular-nums whitespace-nowrap text-slate-900')} style={{ ...pin, fontWeight: 700 }}>
          {g.acct ? <Marked text={fmtCurrencyExact(periodBalanceById.get(g.acct.id) ?? g.acct.balance, base)} q={query} /> : <span className="text-fg-subtle">-</span>}
        </td>
      )
      default: return <td key={key} className={cls} style={pin} />
    }
  }

  // ── Journal entries tab: the blocks of entries, and the two of them drawn ──
  /* Every entry the tab lists, BLOCK_SIZE to a block, each followed by its
     lines if it is open (or animating shut). Built each render - a walk over the
     entries, with the lines from `entryRows`, which caches. */
  type JeGroupT = (typeof jeGroups)[number]
  type ListItem =
    | { kind: 'entry'; g: JeGroupT }
    | { kind: 'line'; g: JeGroupT; row: GLRow; idx: number; closing: boolean }
  const listBlockItems: ListItem[][] = []
  if (view === 'list' && !loading) {
    for (let i = 0; i < jeGroups.length; i += BLOCK_SIZE) {
      const items: ListItem[] = []
      for (const g of jeGroups.slice(i, i + BLOCK_SIZE)) {
        items.push({ kind: 'entry', g })
        const closing = closingJes.has(g.jeNumber)
        if (isJeOpen(g.jeNumber) || closing) entryRows(g).forEach((row, idx) => items.push({ kind: 'line', g, row, idx, closing }))
      }
      listBlockItems.push(items)
    }
  }
  /* Which blocks are drawn: the one at the top of the screen and, once the reader
     nears it, the next or the one before - never more than two, so the DOM holds
     at most a hundred entries however far down the list the reader is. See
     `useBlockWindow` for what keeps the rows and columns still. A block is named
     by the entries and rows it holds; a new result set starts again from the top. */
  const listWindow = useBlockWindow({
    enabled: view === 'list' && !loading,
    bodyRef: listBodyRef,
    headRef: theadRef,
    rowSelector: 'tr.gl-je-parent, tr.gl-je-child',
    sizes: listBlockItems.map(items => items.length),
    keys: listBlockItems.map(items => `${items[0]?.g.jeNumber}|${items[items.length - 1]?.g.jeNumber}|${items.length}`),
    layoutKey: JSON.stringify([padY, displayCols.map(c => c.key), colWidths, look.columnSizing, look.rowNumbers]),
    resetKey: JSON.stringify([view, query, catFilter, srcFilter, filters, colFilters, colSort, period.startDate, period.endDate]),
    colAttr: 'data-col-drag-key',
    floorCols: look.columnSizing !== 'equal',
  })
  const drawnBlocks = listBlockItems.slice(listWindow.first, listWindow.last + 1)
  drawnJesRef.current = drawnBlocks.flatMap(items => items.filter(i => i.kind === 'entry').map(i => i.g.jeNumber))

  /* The entry actions column holds the right edge, as the chart's Actions column
     does: past a wide Memo it would otherwise sit off-screen, where nobody finds
     it. Its cells take the row's fill so the columns scrolling under it stay out
     of sight. */
  const actionsPin = (header = false): CSSProperties => ({
    position: 'sticky', right: 0, zIndex: header ? Z_LIST_HEAD_PIN : Z_LIST_PIN, boxShadow: LIST_RIGHT_EDGE_SHADOW,
  })

  const renderJeParentRow = (g: JeGroupT) => {
    const open = isJeOpen(g.jeNumber)
    return (
      <tr
        key={g.jeNumber}
        onClick={() => toggleJe(g.jeNumber)}
        data-tree-account
        data-export-row="leaf"
        data-export-indent={0}
        data-row-hover=""
        className="gl-je-parent gl-list-parent-row border-b border-border-subtle bg-white hover:bg-[#F0F7FF] transition-colors duration-200 ease-out cursor-pointer"
      >
        <td className={cn('pl-3 pr-1 align-middle gl-list-pin', padY)} style={{ width: chevW, ...chevronPin() }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleJe(g.jeNumber) }}
            aria-label={open ? 'Collapse entry' : 'Expand entry'}
            aria-expanded={open}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <ChevronRight size={14} className={cn('transition-transform duration-200 ease-out', open && 'rotate-90')} />
          </button>
        </td>
        {displayCols.map(c => withPin(renderJeParentCell(c.key, g), pinStyle(c.key)))}
        {/* The entry's actions. Print is one of them, not a column - Eli: *"the
            print field or the action fields ... can be part of our bulk actions
            or capabilities. They don't have to be a column."* */}
        <td className={cn('px-2 text-right gl-list-pin', padY)} style={actionsPin()} onClick={e => e.stopPropagation()}>
          <Menu align="right" trigger={
            <button type="button" aria-label={`Actions for ${g.jeNumber}`} className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <MoreHorizontal size={15} />
            </button>
          }>
            {close => (
              <>
                <MenuItem icon={<FileText size={14} />} onClick={() => { close(); navigate(`/general-ledger/entry/${encodeURIComponent(g.jeNumber)}`) }}>Open entry</MenuItem>
                <MenuItem icon={<Printer size={14} />} onClick={() => {
                  close()
                  printJournalEntry({
                    jeNumber: g.jeNumber, date: g.date, memo: g.memo, source: sourceDocLabel(g.source),
                    reference: g.reference, total: rowCtx.entryTotal(g.jeNumber), currency: base,
                    lines: entryRows(g).map(({ t, acct }) => ({
                      account: acct ? `${numberText(acct.accountNumber)} ${acct.accountName}` : 'Unassigned',
                      description: t.description, debit: t.debit, credit: t.credit,
                    })),
                  })
                }}>Print entry</MenuItem>
                {/* The same flow as the entry's own "Reverse this entry" (Mahad,
                    2026-10-08), and the same rules (Mahad, 2026-10-11): none on
                    an entry that is itself a reversal, and greyed, naming the
                    reversal, on one already reversed. */}
                {!reversedNumberFromMemo(g.memo) && (
                  <MenuItem icon={<Undo2 size={14} />}
                    disabled={reversedBy.has(g.jeNumber)}
                    disabledReason={reversedBy.has(g.jeNumber) ? `Already reversed by ${reversedBy.get(g.jeNumber)}.` : undefined}
                    onClick={() => { close(); setReverseJe(g.jeNumber) }}>Reverse entry</MenuItem>
                )}
              </>
            )}
          </Menu>
        </td>
      </tr>
    )
  }

  const renderJeChildRow = (item: Extract<ListItem, { kind: 'line' }>) => {
    const { row: { t, acct }, idx, closing } = item
    return (
      <tr
        key={t.id}
        data-tree-account
        data-export-row="leaf"
        data-export-indent={1}
        data-row-hover=""
        className={cn(
          'gl-je-child gl-list-child-row border-b border-border-subtle bg-slate-50 hover:bg-[#F0F7FF] transition-colors duration-200 ease-out',
          closing ? 'gl-je-child-out' : 'gl-je-child-in',
        )}
        style={{ animationDelay: closing ? undefined : `${Math.min(idx, 6) * 20}ms` }}
      >
        <td className={cn('pl-3 pr-1 gl-list-pin', padY)} style={{ width: chevW, ...chevronPin() }} />
        {displayCols.map(c => withPin(renderJeChildCell(c.key, t, acct), pinStyle(c.key)))}
        <td className={cn('gl-list-pin', padY)} style={actionsPin()} />
      </tr>
    )
  }

  /* What a drawn group's rows read besides the group itself - see
     DrawnGroupRows. Every input of renderChildCell, renderCell, renderTotalCell,
     pinStyle and withPin belongs in one of these two. */
  const cellVersion = JSON.stringify([
    view, displayCols.map(c => c.key), leftPinRun, pinnedWidths, colWidths, engineSized,
    padY, treeLines, query, accountInnerW,
  ])
  const cellData = useMemo(() => ({}), [balanceByTx, periodBalanceById, numberText, base, navigate])

  return (
    /* The page is the viewport, and the register is the only thing in it that
       scrolls. Everything above it - the header, the insight cards, the period
       strip, the toolbar - is fixed chrome, so scrolling the page could only ever
       run the card off the bottom and show blank canvas under it. */
    <div className="flex-1 flex flex-col min-h-0 pb-6">
      <PageHeader
        icon={<Book size={16} />}
        title="General Ledger"
        subtitle={view === 'tree'
          ? 'Every posting across all accounts.'
          : 'Every journal entry posted to the ledger.'}
        primaryAction={
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setNewEntryOpen(true)}>
            New journal entry
          </Button>
        }
        tabs={GL_TABS}
        activeTab={view}
        onTabChange={id => setView(id as ViewMode)}
      />
      <NewJournalEntryModal open={newEntryOpen} onClose={() => setNewEntryOpen(false)} />
      <ReverseEntryFlow jeNumber={reverseJe} onClose={() => setReverseJe(null)} />

      {/* Performance Insights - Partners-parity KPI row: draggable cards and a
          "Customize insights" drawer, scoped to the selected accounting period. */}
      <div className="px-6 lg:px-8 mt-4">
        <PerformanceInsights
          ctx={kpiCtx}
          activeKpis={activeKpis}
          setActiveKpis={setActiveKpis}
          onOpenPanel={() => setInsightsPanelOpen(true)}
          onReset={() => setActiveKpis([...DEFAULT_GL_KPIS])}
          lastRefreshed={lastInsightsRefreshed}
          onRefresh={() => setLastInsightsRefreshed(new Date())}
          onNavigate={goToKpiTarget}
        />
      </div>

      {/* Main panel - takes whatever height the chrome above it left. */}
      <div className="px-6 lg:px-8 mt-4 flex-1 min-h-0 flex flex-col">
        <Card className="overflow-visible flex-1 min-h-0 flex flex-col">
          <PeriodStrip periods={storePeriods} fiscalYearStart={fiscalYearStart} hint={LEDGER_PERIOD_HINT} copy={LEDGER_PERIOD_COPY} />
          {/* Toolbar, row 1: search + filters (left) · count + insights + columns (right) */}
          {/* The pill row below always renders now - Amount holds on both tabs -
              so it is always the thing that closes the toolbar off from the table.
              Its top edge is where a dragged header turns into a hide (tableColumns). */}
          <div data-col-hide-edge className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3.5 pb-2">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search size={ic16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  // Short enough to read whole (the long one was cut off); the box
                  // searches every column, hidden ones included.
                  placeholder={view === 'list' ? 'Search entries' : 'Search postings'}
                  aria-label={view === 'list' ? 'Search entries' : 'Search postings'}
                  className="h-9 w-full pl-9 pr-8 text-sm bg-white rounded-lg border border-border shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-bg-muted text-fg-subtle hover:text-fg">
                    <X size={14} />
                  </button>
                )}
              </div>
              <FiltersButton
                count={filtersActive}
                onOpen={() => setFiltersOpen(true)}
                onClear={() => setFilters(clearPanelGlFilters)}
                iconSize={ic14}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {/* Visible rows out of the full set, Partner-style: "100 of 143 postings".
                  Counted in the unit the open tab actually lists, so the figure matches
                  the rows on screen rather than the postings behind them. */}
              <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                <span className="text-fg">{fmtNumber(view === 'list' ? jeGroups.length : filtered.length)}</span>
                <span className="text-fg-muted/60"> of </span>
                <span className="text-fg-muted">{fmtNumber(view === 'list' ? totalEntryCount : periodTx.length)}</span>
                <span className="text-fg-muted/70">{view === 'list' ? ' entries' : ' postings'}</span>
              </span>
              <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
              {/* Insights - opens the KPI toggle drawer (Partners parity). */}
              <button
                onClick={() => setInsightsPanelOpen(true)}
                className={cn('inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-xs transition-colors text-sm',
                  insightsPanelOpen ? 'border-primary/30 bg-primary/[0.04] text-fg' : 'border-border bg-white text-fg hover:bg-bg-subtle')}
                style={{ fontWeight: 500 }}
              >
                <BarChart3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                <span className="hidden md:inline">Insights</span>
                {/* The cards actually on the shelf, so the badge and the drawer's
                    own counter cannot report two different numbers. */}
                <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-11 font-semibold bg-accent text-primary">{ALL_GL_KPIS.reduce((n, k) => (activeKpis.includes(k.key) ? n + 1 : n), 0)}</span>
              </button>
              {/* Expand scope - opens or closes every row in the active view. Mirrors
                  the Chart of Accounts row-scope menu so the two pages read alike. */}
              {(() => {
                const opts = [
                  { val: 'expanded' as ExpandMode, label: 'Expand all', Icon: UnfoldVertical,
                    desc: view === 'list' ? 'Show the postings under every entry' : 'Show the postings under every account' },
                  { val: 'collapsed' as ExpandMode, label: 'Collapse all', Icon: FoldVertical,
                    desc: view === 'list' ? 'Show entry lines only' : 'Show account lines only' },
                ]
                const cur = opts.find(o => o.val === currentExpandMode) ?? opts[0]
                return (
                  <Menu align="right" trigger={
                    <button className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-fg shadow-xs hover:bg-bg-subtle transition-colors text-sm font-medium">
                      <cur.Icon size={ic16} className="text-fg-subtle" />
                      <span className="hidden md:inline">{cur.label}</span>
                      <ChevronDown size={14} className="text-fg-subtle/60" />
                    </button>
                  }>
                    {(close) => (
                      <div className="w-[250px] p-1.5 -my-1">
                        {opts.map(o => {
                          const sel = currentExpandMode === o.val
                          return (
                            <button key={o.val} onClick={() => { setAllExpanded(o.val); close() }}
                              className="w-full flex items-center gap-3 py-2.5 px-3 rounded-md text-left hover:bg-bg-subtle transition-colors">
                              <o.Icon size={20} className="text-fg-subtle shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-fg">{o.label}</div>
                                <div className="text-xs text-fg-muted">{o.desc}</div>
                              </div>
                              {sel && <Check size={14} className="text-primary shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </Menu>
                )
              })()}
              {/* The toolbar pair, in this order and 6px apart (spec §1). */}
              <div className="flex items-center" style={{ gap: 6 }}>
                <DensityMenu
                  value={look.density}
                  onChange={d => setLook('density', d)}
                  sections={lookSections({
                    // Journal entries is an entry and its postings, not a chart:
                    // there is no tree there to restyle, so it is not offered.
                    tree: view === 'tree' ? { value: look.treeStyle, onChange: v => setLook('treeStyle', v) } : undefined,
                    widths: { value: look.columnSizing, onChange: v => setLook('columnSizing', v) },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setColumnsOpen(o => !o)}
                  className="fr-tool-btn"
                  data-active={columnsOpen}
                  aria-expanded={columnsOpen}
                  style={{ ...TOOL_BTN, ...(columnsOpen ? TOOL_BTN_ACTIVE : null) }}
                >
                  <Columns3 style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <span className="hidden md:inline">Columns</span>
                  <span style={COUNT_BADGE}>{Object.values(visible).filter(Boolean).length}</span>
                </button>
              </div>
            </div>
          </div>

          {/* The reader's own ways of narrowing the rows, in one row. Mahad,
              2026-09-29: *"Dont you think this filter be next to see all pill?
              Similar to what we did here in the COA listing page"* - so Amount
              stands where Dimensions stands on the chart, and the divider falls
              where the chart's does: controls that open a panel on its left, the
              one-click row filters on its right. Show All is a category state
              like the five that follow it, so it belongs with them rather than
              alone ahead of them, which is where the ledger used to draw it.

              Each tab then offers the chips its own row unit can answer. A tree
              row is one posting, so keeping the postings of one category is a
              coherent thing to ask for. An entries row is a whole journal entry
              built from the surviving postings, so category would strike out the
              other half of every entry that crosses two and print a debit total
              against a credit total that no longer matches it - source cannot,
              because every posting of an entry carries the same one. Amount asks
              about the whole entry's total, so it holds on both. */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin px-4 pb-3 border-b border-border">
            <AmountRangeControl
              min={filters.amountMin}
              max={filters.amountMax}
              values={view === 'list' ? entryAmountValues : amountValues}
              ofWhat={view === 'list' ? 'entry' : 'posting'}
              currency={base}
              onChange={(amountMin, amountMax) => setFilters(f => ({ ...f, amountMin, amountMax }))}
            />
            {/* Source on both tabs, beside Amount: both open a panel, so both
                stand left of the divider. Mahad, 2026-09-30: *"can we also have
                the source filter in general ledger listing page as well similar
                to what we did in general entries."* Source is the filter that
                grows with the data, so it is a dropdown - vendor invoicing's
                quick filter, ported 1 to 1: *"this design doesn't look scalable
                at all."* */}
            <MultiSelectFilter
              label="Source"
              searchable
              options={srcOptions}
              selected={srcFilter}
              onChange={setSrcFilter}
            />
            {/* Category stays a pill per value - five, fixed, so the row never
                grows - and on this tab only (see above). */}
            {view === 'tree' && (
              <>
                <div className="w-px h-5 bg-border shrink-0 mx-0.5" />
                <QuickFilterPill label="Show All" active={catFilter === 'all'} onClick={() => setCatFilter('all')} />
                {CATEGORY_ORDER.map(code => (
                  <QuickFilterPill
                    key={code}
                    label={ACCOUNT_TYPE_META[code].label}
                    active={catFilter === code}
                    onClick={() => setCatFilter(code)}
                    count={catCounts.get(code) ?? 0}
                  />
                ))}
              </>
            )}
          </div>

          <SearchRevealNote labels={revealedCols.map(labelFor)} />

          {/* Active column-filter chips - without this a filter set from a
              column header menu is invisible and has no affordance to remove. */}
          <ColumnFiltersBar
            filters={colFilters}
            onChange={setColFilters}
            availableColumns={displayCols.map(c => c.key)}
            labelOf={k => labelFor(k as GLColKey)}
            uniqueValuesOf={uniqueGlValues}
            blankFilterOf={blankGlFilter}
          />

          {/* Table + docked Columns drawer (the table shrinks beside it, exactly
              like Chart of Accounts). */}
          <div className="flex items-stretch flex-1 min-h-0">
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto scrollbar-thin">
              <table
                className={cn('text-[13px]', look.columnSizing === 'equal' ? 'w-full' : 'min-w-full w-max', lookClass)}
                style={{
                  ['--gl-head-top' as string]: `${headTop}px`,
                  ...(gutter ? { ['--fr-rownum-w' as string]: `${gutter}px` } : null),
                  // Equal splits the frame between the visible columns, which is
                  // what a fixed layout does with no width set (spec §7).
                  tableLayout: look.columnSizing === 'equal' ? 'fixed' : 'auto',
                } as CSSProperties}
              >
                <thead ref={theadRef} className={cn('sticky top-0 z-10 bg-card', draggingColumnKey && 'select-none')}>
                  {/* Header chrome mirrors the Chart of Accounts table exactly: an
                      opaque muted/30 fill composited over white, 13px normal-weight
                      muted-foreground labels (no uppercase), h-7 when condensed. */}
                  <tr ref={headRowRef} data-grid-head-row className={cn('gl-list-header-row border-b border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)] text-muted-foreground text-xs', look.density === 'condensed' && HEADER_ROW_H)}>
                    {/* Leading chevron gutter, list view only. Kept out of the
                        drag/resize/reorder system - it's a fixed affordance, not a
                        data column. Pinned so the affordance stays put during
                        horizontal scroll. */}
                    {view === 'list' && (
                      <th aria-hidden data-col-lead className="gl-list-pin h-10 pl-3 pr-1" style={{ width: chevW, minWidth: chevW, ...chevronPin(true) }} />
                    )}
                    {displayCols.map(c => {
                      const isDraggable = !dragLockedSet.has(c.key)
                      const isBeingDragged = draggingColumnKey === c.key
                      const colFilter = colFilters[c.key] ?? blankGlFilter(c.key)
                      const hasFilter = filterActive(colFilter)
                      const sortDir = activeSort?.key === c.key ? activeSort.dir : null
                      const highlight = isBeingDragged || hasFilter || !!sortDir
                      // `gl-list-pin` is right for pinned headers in both views: the
                      // header row always carries `gl-list-header-row`, which is where
                      // `--gl-row-bg` is defined.
                      const headPin = pinStyle(c.key, 'header')
                      return (
                        <th key={c.key}
                          data-col-drag-key={c.key}
                          style={{ ...(view === 'list' && listWindow.colFloor?.[c.key] ? { minWidth: listWindow.colFloor[c.key] } : null), ...widthStyle(c.key), ...headPin, ...(isBeingDragged ? draggedHeaderStyle(glDrag.hiding) : {}) }}
                          onMouseDown={isDraggable ? (e) => handleHeaderMouseDown(e, c.key) : undefined}
                          onClickCapture={isDraggable ? (e) => {
                            if (glDrag.suppressClick()) { e.stopPropagation(); e.preventDefault() }
                          } : undefined}
                          className={cn('group/colheader relative h-10 px-4 align-middle font-normal text-muted-foreground whitespace-nowrap',
                            c.right ? 'text-right' : 'text-left',
                            isDraggable && 'cursor-grab select-none',
                            hasFilter && !isBeingDragged && 'bg-primary/[0.03]',
                            headPin && 'gl-list-pin')}>
                          {isBeingDragged && <DragBar hiding={glDrag.hiding} />}
                          {isDraggable && (
                            <GripVertical className={cn('absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 z-[5] pointer-events-none transition-opacity',
                              isBeingDragged ? (glDrag.hiding ? 'opacity-100 text-danger-600' : 'opacity-100 text-primary') : 'opacity-0 group-hover/colheader:opacity-100 text-fg-subtle/50')} />
                          )}
                          {/* Running balance is a position, not a value the reader can
                              filter or sort the register by: both would restate every
                              figure below the row they acted on. Its header carries the
                              label alone rather than an inert menu. */}
                          {c.key === 'balance' ? (
                            <span className="inline-flex items-center gap-1.5">
                              {labelFor(c.key)}
                              {c.info && (
                                <Tooltip content={(view === 'tree' && c.treeInfo) || c.info} side="bottom" align="right">
                                  <span className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle" aria-label={`About ${labelFor(c.key)}`}><Info size={12} /></span>
                                </Tooltip>
                              )}
                            </span>
                          ) : (
                          <HeaderMenu
                            label={labelFor(c.key)}
                            sortable
                            currentSort={sortDir}
                            onSortDir={(dir) => setColSort(dir ? { key: c.key, dir } : null)}
                            filter={colFilter}
                            onFilterChange={(f) => setColFilters(prev => ({ ...prev, [c.key]: f }))}
                            uniqueValues={uniqueGlValues(c.key)}
                            align={c.right ? 'right' : undefined}
                            onHide={c.required || c.alwaysShown ? undefined : () => hideColumn(c.key)}
                            onToggleFreeze={alwaysPinned.has(c.key) ? undefined : () => setFrozenCols(prev =>
                              prev.includes(c.key) ? prev.filter(k => k !== c.key) : [...prev, c.key])}
                            frozen={frozenCols.includes(c.key)}
                          >
                            <span style={highlight ? { color: 'hsl(var(--primary))' } : undefined}>{labelFor(c.key)}</span>
                            {c.info && (
                              <Tooltip content={(view === 'tree' && c.treeInfo) || c.info} side="bottom" align={c.right ? 'right' : 'left'}>
                                {/* Its own click stays its own: the header cell behind it opens the column menu. */}
                                <span onClick={e => e.stopPropagation()} className={cn('inline-flex cursor-help', highlight ? 'text-primary' : 'text-fg-subtle/60 hover:text-fg-subtle')} aria-label={`About ${labelFor(c.key)}`}><Info size={12} /></span>
                              </Tooltip>
                            )}
                            {sortDir === 'asc' && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
                            {sortDir === 'desc' && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
                            {hasFilter && !sortDir && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--primary))' }} />}
                            {!hasFilter && !sortDir && <ArrowUpDown className="coa-col-hint w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />}
                          </HeaderMenu>
                          )}
                          {/* Right-edge grip - drag to resize this column. */}
                          <span
                            onMouseDown={handleColResizeStart(c.key)}
                            onClick={e => e.stopPropagation()}
                            title="Drag to resize"
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none opacity-0 group-hover/colheader:opacity-100 bg-primary/20 hover:bg-primary/50 transition-opacity z-[6]"
                          />
                        </th>
                      )
                    })}
                    {/* The entry actions column (see renderJeParentRow). */}
                    {view === 'list' && <th aria-label="Actions" className="h-10 w-12 gl-list-pin" style={actionsPin(true)} />}
                  </tr>
                </thead>
                <tbody ref={listBodyRef}>
                  {loading && Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`sk-${i}`} className={cn('border-b border-border-subtle', view === 'list' && 'gl-list-parent-row')}>
                      {view === 'list' && (
                        <td className={cn('px-3 gl-list-pin', padY)} style={{ width: chevW, ...chevronPin() }} />
                      )}
                      {displayCols.map(c => {
                        const skPin = pinStyle(c.key)
                        return (
                          <td key={c.key} className={cn('px-4', padY, skPin && 'gl-list-pin')} style={skPin}>
                            <div
                              className="h-3 rounded bg-slate-100 animate-pulse"
                              style={{ width: c.right ? '55%' : '80%', marginLeft: c.right ? 'auto' : undefined }}
                            />
                          </td>
                        )
                      })}
                      {view === 'list' && <td className={padY} />}
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={displayCols.length + (view === 'list' ? 2 : 0)} className="text-center py-16 text-fg-subtle text-[13px]">
                        {transactions.length === 0
                          ? 'No postings yet. Ledger entries appear here once journals are posted.'
                          // An empty period is not a failed search, and telling the
                          // reader to change their search would send them the wrong way.
                          : periodTx.length === 0
                            ? `Nothing was posted in ${period.label}. Choose a wider period above.`
                            : view === 'list'
                              ? 'No journal entries match your search.'
                              : 'No postings match your search.'}
                      </td>
                    </tr>
                  )}
                  {!loading && view === 'list' && (
                    <>
                      {listWindow.first > 0 && (
                        /* The blocks above the drawn ones: one row as tall as they
                           are, counting their rows so Row numbers below stay right. */
                        <tr aria-hidden data-gl-list-spacer="above" style={{ counterIncrement: `fr-row ${listWindow.rowsAbove}` }}>
                          <td colSpan={displayCols.length + 2} style={{ height: listWindow.spaceAbove, padding: 0 }} />
                        </tr>
                      )}
                      {drawnBlocks.flat().map(item =>
                        item.kind === 'entry' ? renderJeParentRow(item.g) : renderJeChildRow(item))}
                      {listWindow.spaceBelow > 0 && (
                        <tr aria-hidden data-gl-list-spacer="below">
                          <td colSpan={displayCols.length + 2} style={{ height: listWindow.spaceBelow, padding: 0 }} />
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
                {!loading && view === 'tree' && treeGroups.map(g => {
                    const acctId = g.acct?.id ?? '__unassigned__'
                    const open = isAcctOpen(acctId)
                    // See `drawnGroups`: an open group far from the viewport holds
                    // its place with one spacer row until it is scrolled near.
                    const drawn = !open || isDrawn(acctId)
                    return (
                      <tbody key={acctId} data-acct={acctId}
                        className={cn('gl-group', open && 'gl-expanded', treeLines && 'gl-lines', look.pinGroups && open && stuckAcct === acctId && 'is-stuck')}>
                        {/* The band over an account's postings. A band takes no
                            number and does not advance the count (spec §8). */}
                        <tr data-export-row="section" data-export-indent={0} data-row-hover=""
                          className="gl-parent border-b border-border-subtle transition-colors duration-200 ease-out">
                          {displayCols.map(c => withPin(renderParentCell(c.key, g, open), pinStyle(c.key, 'parent')))}
                        </tr>
                        {open && !drawn && g.rows.length > 0 && (
                          /* The postings and the total row, not yet drawn: one row
                             as tall as they will be, so the scrollbar and every
                             group below sit where they will once it is. It counts
                             the postings it stands for, so Row numbers below it
                             stay right. */
                          <tr aria-hidden data-gl-spacer={acctId} style={{ counterIncrement: `fr-row ${g.rows.length}` }}>
                            <td colSpan={displayCols.length} style={{ height: (g.rows.length + 1) * rowH, padding: 0 }} />
                          </tr>
                        )}
                        {/* Arrows drops the connectors along with the disc: the
                            trunk and its elbow are the disc-and-elbow lines
                            followed downward (spec §7). */}
                        {open && drawn && (
                          <DrawnGroupRows group={g} version={cellVersion} data={cellData} render={() => (
                            <>
                              {g.rows.map(({ t, acct }) => (
                                <tr key={t.id}
                                  data-tree-account
                                  data-export-row="leaf"
                                  data-export-indent={1}
                                  data-row-hover=""
                                  className="gl-child coa-row-reveal border-b border-border-subtle transition-colors duration-200 ease-out">
                                  {displayCols.map(c => withPin(renderChildCell(c.key, t, acct), pinStyle(c.key)))}
                                </tr>
                              ))}
                              {g.rows.length > 0 && (
                                <tr data-export-row="total" data-export-indent={1} className="gl-total coa-row-reveal">
                                  {displayCols.map(c => withPin(renderTotalCell(c.key, g), pinStyle(c.key)))}
                                </tr>
                              )}
                            </>
                          )} />
                        )}
                      </tbody>
                    )
                  })}
              </table>
            </div>
            </div>

            <ColumnSelector
              open={columnsOpen}
              onOpenChange={setColumnsOpen}
              columns={colSpecs}
              columnOrder={columnOrder}
              columnVisibility={visible}
              onColumnOrderChange={setColumnOrder}
              onColumnVisibilityChange={setVisible}
              lockedColumns={lockedCols}
              requiredColumns={alwaysShownCols}
              frozenColumns={frozenCols}
              onToggleFreeze={k => setFrozenCols(prev => prev.includes(k as GLColKey) ? prev.filter(x => x !== k) : [...prev, k as GLColKey])}
              canFreeze={k => !alwaysPinned.has(k as GLColKey)}
              visual={{ values: look, offers: { pinGroups: true }, onToggle: toggleVisual }}
              // Each tab's own order; which columns show is one setting for both.
              defaults={{ visibility: Object.fromEntries(GL_COLS.map(c => [c.key, !c.defaultHidden])), order: view === 'list' ? [...LIST_COLUMN_ORDER] : GL_COLS.map(c => c.key) }}
            />
          </div>
        </Card>
      </div>

      <GlFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        setFilters={setFilters}
        sideCounts={sideCounts}
        dimensionOptions={dimensionOptions}
        // Counted over the postings the selected accounting period holds, the same
        // base the side chips count, so the footer total and the chips can never
        // disagree - and so "Show N postings" names what the grid will actually
        // show rather than the whole ledger's every-period count.
        auditPeople={auditPeople}
        computeCount={(f) => periodTx.filter(t => matchesGlFilters(t, f, rowCtx.changes, view === 'list' ? rowCtx.entryTotal(t.jeNumber) : undefined)).length}
      />

      <KpiInsightsPanel
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        activeKpis={activeKpis}
        onToggleKpi={toggleKpi}
        onReset={() => setActiveKpis([...DEFAULT_GL_KPIS])}
        ctx={kpiCtx}
      />

      {/* Column drag chip - Partners', red while a release would hide the column. */}
      <DragGhost ghostRef={glDrag.ghostRef} label={draggingColumnKey ? labelFor(draggingColumnKey as GLColKey) : null} hiding={glDrag.hiding} caps={false} />
    </div>
  )
}


/* The amount range, on the toolbar rather than inside Filters. Design review,
   2026-09-28 - Eli: *"The only way I was able to find it ... is to look for the
   numbers ... find me anything that's more than $50 and less than $100,000"*,
   and *"I would bring the range out for starters, for sure."* On the entries tab
   it asks about an entry's total, the figure in the Amount column; on the
   General ledger tab, about one posting. Matches on size either way, so 1,000
   finds a $1,000 debit and a $1,000 credit.

   Drawn as a quick-filter pill and standing in the pill row, for the reason
   Dimensions does on the chart: beside Filters it read as a second filter panel,
   beside the pills it reads as what it is. The icon and chevron are what tell it
   from the category pills it now sits with - without them a pill reading
   "Amount" is a category name. Banknote rather than a dollar sign because the
   ledger has a base currency and the label already prints it. */
function AmountRangeControl({ min, max, values, ofWhat, currency, onChange }: {
  min: string
  max: string
  values: number[]
  ofWhat: 'entry' | 'posting'
  currency: string
  onChange: (min: string, max: string) => void
}) {
  const active = min !== '' || max !== ''
  const money = (v: string) => fmtCurrency(Number(v), currency)
  const label = !active ? 'Amount'
    : min !== '' && max !== '' ? `${money(min)} – ${money(max)}`
      : min !== '' ? `${money(min)} or more` : `Up to ${money(max)}`
  return (
    <Menu align="left" flush trigger={open => (
      <button
        type="button"
        aria-label={active ? `Amount range: ${label}` : 'Amount range'}
        className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums',
          active || open
            ? 'border-primary bg-accent hover:bg-[#DBEAFE] active:bg-[#BFDBFE]'
            : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted')}
        style={{ fontWeight: active || open ? 500 : 400, color: active || open ? 'hsl(var(--primary))' : undefined }}
      >
        <Banknote size={14} className={active || open ? 'text-primary' : undefined} />
        {label}
        <ChevronDown size={12} className={cn('shrink-0 opacity-60 transition-transform duration-150', open && 'rotate-180')} />
      </button>
    )}>
      {close => (
        <div className="w-[340px] p-3.5 space-y-3" data-amount-range>
          <div>
            <p className="text-[13px] text-fg" style={{ fontWeight: 600 }}>Amount</p>
            <p className="text-2xs text-fg-muted leading-relaxed mt-0.5">
              {ofWhat === 'entry'
                ? "The entry's total. Matches on size, so 1,000 finds an entry of $1,000 whichever side it started on."
                : 'The size of one posting. Matches on size, so 1,000 finds both a $1,000 debit and a $1,000 credit.'}
            </p>
          </div>
          <RangeMinMax values={values} min={min} max={max} onMinChange={v => onChange(v, max)} onMaxChange={v => onChange(min, v)} magnitude />
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={() => onChange('', '')} disabled={!active}
              className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 disabled:opacity-40 disabled:no-underline"
              style={{ fontWeight: 500 }}>Clear</button>
            <Button size="sm" onClick={close}>Done</Button>
          </div>
        </div>
      )}
    </Menu>
  )
}

// Ledger Filters modal - same centered-modal chrome and building blocks as the
// Chart of Accounts FiltersSlideOver (Section / PillGrid / SearchableDropdownSelect
// / RangeMinMax / DateRangeFromTo), so the two share one filter language.
function GlFiltersModal({
  open, onClose, filters, setFilters, sideCounts, dimensionOptions, auditPeople, computeCount,
}: {
  open: boolean
  onClose: () => void
  filters: GLFilters
  setFilters: (f: GLFilters) => void
  sideCounts: { debit: number; credit: number }
  dimensionOptions: { id: string; name: string; values: { value: string; count: number }[] }[]
  auditPeople: { creators: { name: string; count: number }[]; modifiers: { name: string; count: number }[] }
  computeCount: (f: GLFilters) => number
}) {
  const [draft, setDraft] = useState<GLFilters>(filters)
  useEffect(() => {
    if (!open) return
    setDraft(filters)
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const activeCount = countGlFilters(draft)
  const liveCount = computeCount(draft)
  const update = <K extends keyof GLFilters>(key: K, value: GLFilters[K]) => setDraft(d => ({ ...d, [key]: value }))
  const toggleArr = (key: 'sides' | 'dims' | 'createdBy' | 'updatedBy', value: string) => setDraft(d => {
    const arr = d[key] as string[]
    const has = arr.includes(value)
    return { ...d, [key]: has ? arr.filter(x => x !== value) : [...arr, value] }
  })

  // Portaled to <body> so the overlay covers the sidebar and top bar - inside
  // the page tree the shell's animate-page-in transform is its containing
  // block, which would clip it to the content area.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 coa-scrim animate-overlay-in" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[680px] max-h-[85vh] flex flex-col overflow-hidden animate-modal-in">
        {/* Header - centered title + active count, circular X at left */}
        <div className="flex items-center justify-center relative px-6 h-12 border-b border-border/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="text-[14px]" style={{ fontWeight: 600 }}>Filters</span>
          {activeCount > 0 && (
            <span className="ml-2 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white" style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}>
              {activeCount}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
          {/* Posting side - Any + Debit / Credit chip row (Partners "Status" pattern). */}
          <Section title="Posting side" desc="Show only debit lines, or only credit lines.">
            <PillGrid>
              <AllPill active={draft.sides.length === 0} onClick={() => setDraft(d => ({ ...d, sides: [] }))} />
              <ModalFilterPill active={draft.sides.includes('debit')} onClick={() => toggleArr('sides', 'debit')} count={sideCounts.debit}>Debit</ModalFilterPill>
              <ModalFilterPill active={draft.sides.includes('credit')} onClick={() => toggleArr('sides', 'credit')} count={sideCounts.credit}>Credit</ModalFilterPill>
            </PillGrid>
          </Section>

          <FDivider />

          {/* No Period section: the accounting period strip above the table
              already scopes every row to one period (Mahad, 2026-10-09:
              *"remove this filter from general ledger and journal entries"*). */}

          <Section title="Posted on" desc="Show entries posted between these dates.">
            <DateRangeFromTo
              from={draft.dateFrom}
              to={draft.dateTo}
              onFromChange={iso => update('dateFrom', iso)}
              onToChange={iso => update('dateTo', iso)}
            />
          </Section>

          {dimensionOptions.length > 0 && (
            <>
              <FDivider />
              <Section title="Dimensions" desc="Show postings with the values you pick. Picking from two dimensions narrows the list.">
                <div className="space-y-3">
                  {dimensionOptions.map(dim => (
                    <div key={dim.id}>
                      <p className="text-[12px] text-fg-muted mb-1.5" style={{ fontWeight: 600 }}>{dim.name}</p>
                      <PillGrid>
                        {dim.values.map(v => {
                          const k = dimKey(dim.id, v.value)
                          return (
                            <ModalFilterPill key={k} active={draft.dims.includes(k)} onClick={() => toggleArr('dims', k)} count={v.count}>{v.value}</ModalFilterPill>
                          )
                        })}
                      </PillGrid>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}

          <FDivider />

          <Section title="Created" desc="Who posted the entry, and when.">
            <AuditFacet
              people={auditPeople.creators.map(p => p.name)}
              selected={draft.createdBy}
              onToggle={name => toggleArr('createdBy', name)}
              onAll={() => update('createdBy', [])}
              getCount={name => auditPeople.creators.find(p => p.name === name)?.count ?? 0}
              from={draft.createdFrom}
              to={draft.createdTo}
              onFromChange={iso => update('createdFrom', iso)}
              onToChange={iso => update('createdTo', iso)}
            />
          </Section>

          <FDivider />

          <Section title="Last updated" desc="Who last changed the entry, and when.">
            <AuditFacet
              people={auditPeople.modifiers.map(p => p.name)}
              selected={draft.updatedBy}
              onToggle={name => toggleArr('updatedBy', name)}
              onAll={() => update('updatedBy', [])}
              getCount={name => auditPeople.modifiers.find(p => p.name === name)?.count ?? 0}
              from={draft.updatedFrom}
              to={draft.updatedTo}
              onFromChange={iso => update('updatedFrom', iso)}
              onToChange={iso => update('updatedTo', iso)}
            />
          </Section>
        </div>

        {/* Sticky footer - underlined Clear all (left) · primary Apply (right) */}
        <div className="flex items-center justify-between px-6 h-14 border-t border-border/60 shrink-0">
          <button
            type="button"
            onClick={() => setDraft(clearPanelGlFilters)}
            className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => { setFilters(draft); onClose() }}
            className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-white text-[13px] cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}
          >
            Show {liveCount.toLocaleString()} posting{liveCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
