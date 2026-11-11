// The currency's Linked transactions tab on CoA's register-tab pattern
// (AccountDetail RegisterTab, spec-detail §5.1): one flat table with a Type
// column, a Type pill (the Region pill's dropdown, as CoA's Dimensions is: one
// control however many kinds of transaction there are), a Status filter that
// opens on Open, the table search (which also finds an amount however it is typed), and
// the value of the active transactions in a summary strip above the rows.
import { useEffect, useMemo, useState } from 'react'
import { FileStack, FileText, Inbox, Info } from 'lucide-react'
import type { Currency } from '../../data/currencies'
import { RATE_TOOLTIPS } from '../../utils/rateCopy'
import { Badge, EmptyState, Marked, Tooltip } from '../../coa/components/ui'
import { CoaTableCard, PillRow, TableEmptyState } from '../../coa/components/TableCard'
import { TableToolbar } from '../../coa/components/TableToolbar'
import { CoaDataTable, useCoaTable, type CoaColumn } from '../../coa/components/CoaDataTable'
import { AllPill, FilterPill, FiltersModal, PillGrid, Section } from '../../coa/components/Filters'
import { PillFilter } from '../../coa/components/PillFilter'
import { EmptyCell, PARTNER_CHIP_CLS } from '../../coa/components/cells'
import { fmtDate, fmtNumber } from '../../coa/lib/utils'
import { hasOpenDocuments } from '../../data/currencies'
import { TransactionQuickView } from './TransactionQuickView'
import { ACTIVE_DOC_STATUSES, DOC_TYPES, docStatusTone, docTypeMeta, fmtAmount, isActiveDoc, money, type DocTypeKey, type LinkedDoc } from './model'

/** What the tab opens on: open transactions only. */
const DEFAULT_STATUSES = ['Open']
/** The Status filter's options, in the order a transaction moves through them. */
const STATUS_ORDER = ['Draft', ...ACTIVE_DOC_STATUSES]
/** A payment carries no status; the filter names it so it can still be picked. */
const NO_STATUS = 'No Status'
const statusOf = (d: LinkedDoc) => d.status || NO_STATUS

export function LinkedTransactionsTab({ currency: c, docs }: { currency: Currency; docs: LinkedDoc[] }) {
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState(query)
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(query), 300); return () => clearTimeout(t) }, [query])
  const [types, setTypes] = useState<DocTypeKey[]>([])
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [quick, setQuick] = useState<LinkedDoc | null>(null)
  const dp = c.decimalPlaces
  // Status narrows first, so the Type pill counts what the reader can see.
  const inStatus = useMemo(() => (statuses.length ? docs.filter(d => statuses.includes(statusOf(d))) : docs), [docs, statuses])
  const rows = useMemo(() => (types.length ? inStatus.filter(d => types.includes(d.type)) : inStatus), [inStatus, types])

  const columns = useMemo<CoaColumn<LinkedDoc>[]>(() => [
    {
      key: 'number', label: 'Number', locked: true, width: 180,
      info: 'The transaction’s reference number, like an invoice or order number.',
      // A link, as CoA's journal entry numbers are: it opens the transaction in a
      // quick view without leaving the list.
      render: (d, ctx) => (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setQuick(d) }}
          title="Open transaction"
          className="inline-flex items-center gap-1.5 text-sm tabular-nums whitespace-nowrap text-primary hover:text-[#0862D0] hover:underline underline-offset-2 transition-colors cursor-pointer"
          style={{ fontWeight: 600 }}
        >
          <FileText size={12} className="text-primary/60 shrink-0" /><Marked text={d.number} q={ctx.q} />
        </button>
      ),
      sortValue: d => d.number, searchText: d => d.number, filter: 'text',
    },
    {
      key: 'type', label: 'Type', headerClassName: 'min-w-[160px]',
      info: 'What kind of transaction it is, like a vendor invoice or a sales order.',
      render: (d, ctx) => <Badge tone="neutral" className={PARTNER_CHIP_CLS}><Marked text={docTypeMeta(d.type).label} q={ctx.q} /></Badge>,
      sortValue: d => docTypeMeta(d.type).label, searchText: d => docTypeMeta(d.type).label, filter: 'multiselect',
    },
    {
      key: 'party', label: 'Vendor / Customer', headerClassName: 'min-w-[220px]',
      info: 'Who the transaction is with: the vendor or customer it was raised for.',
      render: (d, ctx) => <span className="text-sm text-slate-700 block truncate max-w-[320px]" title={d.party}><Marked text={d.party} q={ctx.q} /></span>,
      sortValue: d => d.party, searchText: d => d.party, filter: 'multiselect',
    },
    {
      key: 'status', label: 'Status', headerClassName: 'min-w-[110px]',
      info: 'Where the transaction stands, like Open, Pending or Overdue. Payments don’t have one.',
      render: (d, ctx) => d.status ? <Badge tone={docStatusTone(d.status)} className={PARTNER_CHIP_CLS}><Marked text={d.status} q={ctx.q} /></Badge> : <EmptyCell />,
      sortValue: d => d.status || null, searchText: d => d.status, filter: 'multiselect',
    },
    {
      key: 'date', label: 'Date', headerClassName: 'min-w-[130px]',
      info: 'The date on the transaction.',
      render: (d, ctx) => <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap"><Marked text={fmtDate(d.date)} q={ctx.q} /></span>,
      sortValue: d => d.date, searchText: d => fmtDate(d.date), filter: 'date', filterValue: d => d.date,
    },
    {
      key: 'amount', label: 'Amount', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[160px]',
      info: `The transaction’s total, in ${c.code}.`,
      render: (d, ctx) => <span className="text-sm font-medium text-slate-700 tabular-nums whitespace-nowrap"><Marked text={`${c.code} ${fmtAmount(d.amount, dp)}`} q={ctx.q} /></span>,
      // Found however the amount is typed: 85,000.00, 85000 or 85000.00.
      sortValue: d => d.amount, searchText: d => [fmtAmount(d.amount, dp), String(d.amount), d.amount.toFixed(dp)], filter: 'range',
    },
  ], [c.code, dp])

  const table = useCoaTable<LinkedDoc>({ columns, rows, query: debouncedQ, getRowId: d => d.id, rememberAs: 'currency:linked', defaultSort: { key: 'date', dir: 'desc' } })

  // Active transactions only: a draft hasn't started, so it isn't value in play.
  const active = docs.filter(isActiveDoc)
  const activeTotal = active.reduce((s, d) => s + d.amount, 0)
  const shownTotal = table.rows.reduce((s, d) => s + d.amount, 0)
  const blocking = hasOpenDocuments(c)
  const statusOptions = STATUS_ORDER.filter(s => docs.some(d => d.status === s))
    .concat(docs.some(d => !d.status) ? [NO_STATUS] : [])
  const narrowing = types.length > 0 || statuses.length > 0 || Object.keys(table.colFilters).length > 0

  if (docs.length === 0) {
    return (
      <div className="card flex-1 flex items-center justify-center min-h-[calc(100vh-260px)]">
        <EmptyState icon={<Inbox size={20} />} title={`No transactions found for ${c.code}`} description="Transactions in this currency will appear here." />
      </div>
    )
  }

  return (
    <CoaTableCard
      table={table}
      className="min-h-[calc(100vh-260px)]"
      toolbar={
        <TableToolbar
          search={{ value: query, onChange: setQuery, placeholder: 'Search by number, party or amount' }}
          filters={{ count: statuses.length ? 1 : 0, onOpen: () => setFiltersOpen(true), onClear: () => setStatuses([]) }}
          count={{ shown: table.rows.length, total: docs.length, noun: docs.length === 1 ? 'transaction' : 'transactions' }}
          meta={<span className="tabular-nums">{money(c.symbol, shownTotal, dp)} shown</span>}
          density={table.densityMenuProps}
          columns={{ open: table.columnsOpen, onToggle: () => table.setColumnsOpen(o => !o), count: table.visibleCount }}
        />
      }
      pills={
        <PillRow>
          <PillFilter
            label="Type"
            icon={<FileStack size={14} />}
            description="Show the kinds of transaction you tick."
            options={DOC_TYPES.map(t => ({ value: t.key, label: t.plural, count: inStatus.filter(d => d.type === t.key).length }))}
            selected={types}
            onChange={next => setTypes(next as DocTypeKey[])}
          />
        </PillRow>
      }
      notes={
        <div className="px-4 py-2 border-b border-border bg-bg-subtle/40 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            Total Value of Active Transactions:
            <Tooltip content={RATE_TOOLTIPS.totalValueAllDocs} side="bottom" align="left">
              <span className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Info size={12} /></span>
            </Tooltip>
            <span className="text-fg tabular-nums" style={{ fontWeight: 600 }}>{money(c.symbol, activeTotal, dp)}</span>
          </span>
          <span className="w-px h-3.5 bg-border" />
          <span>
            {fmtNumber(active.length)} active {active.length === 1 ? 'transaction' : 'transactions'}
            {blocking && <span className="text-warning-700" style={{ fontWeight: 500 }}> · blocking deactivation</span>}
          </span>
        </div>
      }
    >
      {/* Block-windowed at any length, like CoA's Transactions tab: fifty drawn at a time, never more than a hundred. */}
      <CoaDataTable
        table={table}
        windowAbove={0}
        emptyState={<TableEmptyState noun="transactions" query={debouncedQ} filtersActive={narrowing} onClearSearch={() => setQuery('')} onClearFilters={() => { setTypes([]); setStatuses([]); table.setColFilters({}) }} where={`${c.code}'s transactions`} />}
      />
      {quick && <TransactionQuickView doc={quick} currency={c} onClose={() => setQuick(null)} />}
      <StatusFiltersModal open={filtersOpen} onClose={() => setFiltersOpen(false)} docs={docs} options={statusOptions} statuses={statuses} setStatuses={setStatuses} />
    </CoaTableCard>
  )
}

/** The Status filter, on the library's Filters modal: a draft, applied from the footer. */
function StatusFiltersModal({ open, onClose, docs, options, statuses, setStatuses }: {
  open: boolean
  onClose: () => void
  docs: LinkedDoc[]
  options: string[]
  statuses: string[]
  setStatuses: (s: string[]) => void
}) {
  const [draft, setDraft] = useState<string[]>(statuses)
  useEffect(() => { if (open) setDraft(statuses) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (s: string) => setDraft(d => (d.includes(s) ? d.filter(x => x !== s) : [...d, s]))
  const live = draft.length ? docs.filter(d => draft.includes(statusOf(d))).length : docs.length
  return (
    <FiltersModal
      open={open}
      onClose={onClose}
      activeCount={draft.length ? 1 : 0}
      onClear={() => setDraft([])}
      onApply={() => { setStatuses(draft); onClose() }}
      applyLabel={`Show ${fmtNumber(live)} ${live === 1 ? 'Transaction' : 'Transactions'}`}
    >
      <Section title="Status" desc="Show transactions by where they stand. The tab opens on open ones.">
        <PillGrid>
          <AllPill active={!draft.length} onClick={() => setDraft([])} />
          {options.map(s => (
            <FilterPill key={s} active={draft.includes(s)} onClick={() => toggle(s)} count={docs.filter(d => statusOf(d) === s).length}>{s}</FilterPill>
          ))}
        </PillGrid>
      </Section>
    </FiltersModal>
  )
}
