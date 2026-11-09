// The currency's Linked transactions tab on CoA's register-tab pattern
// (AccountDetail RegisterTab, spec-detail §5.1): one flat table with a Type
// column, type quick-filter pills with counts, the table search, and the totals
// the old grouped sections carried, in a summary strip above the rows.
import { useEffect, useMemo, useState } from 'react'
import { FileText, Inbox, Info } from 'lucide-react'
import type { Currency } from '../../data/currencies'
import { RATE_TOOLTIPS } from '../../utils/rateCopy'
import { Badge, EmptyState, Marked, Tooltip } from '../../coa/components/ui'
import { CoaTableCard, PillRow, TableEmptyState } from '../../coa/components/TableCard'
import { TableToolbar } from '../../coa/components/TableToolbar'
import { CoaDataTable, useCoaTable, type CoaColumn } from '../../coa/components/CoaDataTable'
import { QuickFilterPill } from '../../coa/components/Filters'
import { EmptyCell, PARTNER_CHIP_CLS } from '../../coa/components/cells'
import { fmtDate } from '../../coa/lib/utils'
import { hasOpenDocuments } from '../../data/currencies'
import { DOC_TYPES, countInUse, docStatusTone, docTypeMeta, fmtAmount, money, type DocTypeKey, type LinkedDoc } from './model'

export function LinkedTransactionsTab({ currency: c, docs }: { currency: Currency; docs: LinkedDoc[] }) {
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState(query)
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(query), 300); return () => clearTimeout(t) }, [query])
  const [type, setType] = useState<DocTypeKey | 'all'>('all')
  const dp = c.decimalPlaces
  const rows = useMemo(() => (type === 'all' ? docs : docs.filter(d => d.type === type)), [docs, type])

  const columns = useMemo<CoaColumn<LinkedDoc>[]>(() => [
    {
      key: 'number', label: 'Number', locked: true, width: 180,
      info: 'The transaction\'s own reference.',
      render: (d, ctx) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-800 tabular-nums whitespace-nowrap" style={{ fontWeight: 500 }}>
          <FileText size={12} className="text-fg-subtle shrink-0" /><Marked text={d.number} q={ctx.q} />
        </span>
      ),
      sortValue: d => d.number, searchText: d => d.number, filter: 'text',
    },
    {
      key: 'type', label: 'Type', headerClassName: 'min-w-[160px]',
      render: (d, ctx) => <Badge tone="neutral" className={PARTNER_CHIP_CLS}><Marked text={docTypeMeta(d.type).label} q={ctx.q} /></Badge>,
      sortValue: d => docTypeMeta(d.type).label, searchText: d => docTypeMeta(d.type).label, filter: 'multiselect',
    },
    {
      key: 'party', label: 'Vendor / customer', headerClassName: 'min-w-[220px]',
      info: 'The vendor on invoices and purchase orders, the customer on customer invoices and sales orders, and the party on payments.',
      render: (d, ctx) => <span className="text-sm text-slate-700 block truncate max-w-[320px]" title={d.party}><Marked text={d.party} q={ctx.q} /></span>,
      sortValue: d => d.party, searchText: d => d.party, filter: 'multiselect',
    },
    {
      key: 'status', label: 'Status', headerClassName: 'min-w-[110px]',
      render: (d, ctx) => d.status ? <Badge tone={docStatusTone(d.status)} className={PARTNER_CHIP_CLS}><Marked text={d.status} q={ctx.q} /></Badge> : <EmptyCell />,
      sortValue: d => d.status || null, searchText: d => d.status, filter: 'multiselect',
    },
    {
      key: 'date', label: 'Date', headerClassName: 'min-w-[130px]',
      render: (d, ctx) => <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap"><Marked text={fmtDate(d.date)} q={ctx.q} /></span>,
      sortValue: d => d.date, searchText: d => fmtDate(d.date), filter: 'date', filterValue: d => d.date,
    },
    {
      key: 'amount', label: 'Amount', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[160px]',
      info: `In ${c.code}, the transaction's own currency.`,
      render: (d, ctx) => <span className="text-sm font-medium text-slate-700 tabular-nums whitespace-nowrap"><Marked text={`${c.code} ${fmtAmount(d.amount, dp)}`} q={ctx.q} /></span>,
      sortValue: d => d.amount, searchText: d => fmtAmount(d.amount, dp), filter: 'range',
    },
  ], [c.code, dp])

  const table = useCoaTable<LinkedDoc>({ columns, rows, query: debouncedQ, getRowId: d => d.id, rememberAs: 'currency:linked', defaultSort: { key: 'date', dir: 'desc' } })

  const total = docs.reduce((s, d) => s + d.amount, 0)
  const shownTotal = table.rows.reduce((s, d) => s + d.amount, 0)
  const lastDate = docs[0]?.date
  const inUse = countInUse(c)
  const blocking = hasOpenDocuments(c)

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
          search={{ value: query, onChange: setQuery, placeholder: 'Search transactions' }}
          count={{ shown: table.rows.length, total: docs.length, noun: docs.length === 1 ? 'transaction' : 'transactions' }}
          meta={<span className="tabular-nums">{money(c.symbol, shownTotal, dp)} shown</span>}
          density={table.densityMenuProps}
          columns={{ open: table.columnsOpen, onToggle: () => table.setColumnsOpen(o => !o), count: table.visibleCount }}
        />
      }
      pills={
        <PillRow>
          <QuickFilterPill label="All" count={inUse} active={type === 'all'} onClick={() => setType('all')} />
          {DOC_TYPES.map(t => (
            <QuickFilterPill key={t.key} label={t.plural} count={docs.filter(d => d.type === t.key).length} active={type === t.key} onClick={() => setType(t.key)} />
          ))}
        </PillRow>
      }
      notes={
        <div className="px-4 py-2 border-b border-border bg-bg-subtle/40 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            Total value across all transactions:
            <Tooltip content={RATE_TOOLTIPS.totalValueAllDocs} side="bottom" align="left">
              <span className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Info size={12} /></span>
            </Tooltip>
            <span className="text-fg tabular-nums" style={{ fontWeight: 600 }}>{money(c.symbol, total, dp)}</span>
          </span>
          <span className="w-px h-3.5 bg-border" />
          <span>
            {inUse} active {inUse === 1 ? 'transaction' : 'transactions'}
            {blocking && <span className="text-warning-700" style={{ fontWeight: 500 }}> · blocking deactivation</span>}
            {' · '}Last transaction: {lastDate ? fmtDate(lastDate) : 'N/A'}
            {' · '}{c.usage.totalLifetimeDocuments.toLocaleString('en-US')} {c.usage.totalLifetimeDocuments === 1 ? 'transaction' : 'transactions'} in total
          </span>
        </div>
      }
    >
      {/* Block-windowed at any length, like CoA's Transactions tab: fifty drawn at a time, never more than a hundred. */}
      <CoaDataTable
        table={table}
        windowAbove={0}
        emptyState={<TableEmptyState noun="transactions" query={debouncedQ} filtersActive={type !== 'all' || Object.keys(table.colFilters).length > 0} onClearSearch={() => setQuery('')} onClearFilters={() => { setType('all'); table.setColFilters({}) }} where={`${c.code}'s transactions`} />}
      />
    </CoaTableCard>
  )
}
