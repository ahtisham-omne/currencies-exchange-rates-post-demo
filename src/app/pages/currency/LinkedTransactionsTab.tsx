// The currency's Linked transactions tab on CoA's register-tab pattern
// (AccountDetail RegisterTab, spec-detail §5.1): one flat table with a Type
// column, Type, Status and (for vendor invoices) Payment Status pills (the Region pill's dropdown, as CoA's Dimensions
// is: one control however long the list), the statuses each module itself uses
// (Pending Approval, Released, Fully Received, Partially Applied …), opening on the
// active ones, the table search (which also finds an amount however it is typed), and
// nothing else above the rows.
import { useEffect, useMemo, useState } from 'react'
import { CircleDot, FileStack, FileText, Inbox, Wallet } from 'lucide-react'
import type { Currency } from '../../data/currencies'
import { Badge, EmptyState, Marked } from '../../coa/components/ui'
import { CoaTableCard, PillRow, TableEmptyState } from '../../coa/components/TableCard'
import { TableToolbar } from '../../coa/components/TableToolbar'
import { CoaDataTable, useCoaTable, type CoaColumn } from '../../coa/components/CoaDataTable'
import { PillFilter } from '../../coa/components/PillFilter'
import { EmptyCell, PARTNER_CHIP_CLS } from '../../coa/components/cells'
import { cn, fmtDate } from '../../coa/lib/utils'
import { DOC_STATUSES, VENDOR_INVOICE_PAYMENT_STATUSES } from '../../data/currencies'
import { TransactionQuickView } from './TransactionQuickView'
import { DOC_TYPES, docStatusTone, docTypeMeta, fmtAmount, isActiveDoc, money, type DocTypeKey, type LinkedDoc } from './model'

/** Every module's statuses in one list, roughly in the order a transaction moves
 *  through them: not started, waiting, in play, part-way, late, done, stopped. */
const STATUS_ORDER = [
  'Draft', 'Pending Approval', 'Pending Review', 'Exception', 'Rejected', 'Approved', 'Sent', 'Confirmed', 'Released',
  'Unpaid', 'Scheduled', 'Unapplied', 'Partially Paid', 'Partially Received', 'Partially Shipped', 'Partially Cancelled',
  'Partially Applied', 'Active with Cancellation', 'Overdue', 'Paid', 'Applied', 'Fully Received', 'Shipped',
  'Closed with Cancellations', 'Written Off', 'Reversed', 'Void', 'Cancelled', 'Archived',
].filter(s => Object.values(DOC_STATUSES).some(t => (t.all as readonly string[]).includes(s)))
/** A vendor invoice's Payment Status, in Vendor Invoicing's order. */
const PAYMENT_STATUS_ORDER: readonly string[] = VENDOR_INVOICE_PAYMENT_STATUSES.all

export function LinkedTransactionsTab({ currency: c, docs }: { currency: Currency; docs: LinkedDoc[] }) {
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState(query)
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(query), 300); return () => clearTimeout(t) }, [query])
  const [types, setTypes] = useState<DocTypeKey[]>([])
  // Opens on the active ones: what is still in play, as the tab always has. An
  // Approved vendor invoice is active only while money is owed, so the Payment
  // Status pill opens on the owing ones too.
  const [statuses, setStatuses] = useState<string[]>(() => STATUS_ORDER.filter(s => docs.some(d => d.status === s && isActiveDoc(d))))
  const [payStatuses, setPayStatuses] = useState<string[]>(() => PAYMENT_STATUS_ORDER.filter(s => docs.some(d => d.paymentStatus === s && isActiveDoc(d))))
  const [quick, setQuick] = useState<LinkedDoc | null>(null)
  const dp = c.decimalPlaces
  // Each pill counts what the others leave, so a count is what ticking it would show.
  // Payment Status narrows vendor invoices only; other rows have none and pass.
  const byType = (d: LinkedDoc) => !types.length || types.includes(d.type)
  const byStatus = (d: LinkedDoc) => !statuses.length || statuses.includes(d.status)
  const byPay = (d: LinkedDoc) => !payStatuses.length || !d.paymentStatus || payStatuses.includes(d.paymentStatus)
  const inType = useMemo(() => docs.filter(d => byType(d) && byPay(d)), [docs, types, payStatuses]) // eslint-disable-line react-hooks/exhaustive-deps
  const inStatus = useMemo(() => docs.filter(d => byStatus(d) && byPay(d)), [docs, statuses, payStatuses]) // eslint-disable-line react-hooks/exhaustive-deps
  const inPayPill = useMemo(() => docs.filter(d => byType(d) && byStatus(d)), [docs, types, statuses]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => docs.filter(d => byType(d) && byStatus(d) && byPay(d)), [docs, types, statuses, payStatuses]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo<CoaColumn<LinkedDoc>[]>(() => [
    {
      key: 'number', label: 'ID', locked: true, width: 180,
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
      render: (d, ctx) => <Badge tone="neutral" className={PARTNER_CHIP_CLS}><Marked text={docTypeMeta(d.type).label} q={ctx.q} /></Badge>,
      sortValue: d => docTypeMeta(d.type).label, searchText: d => docTypeMeta(d.type).label, filter: 'multiselect',
    },
    {
      key: 'party', label: 'Vendor / Customer', headerClassName: 'min-w-[220px]',
      render: (d, ctx) => <span className="text-sm text-slate-700 block truncate max-w-[320px]" title={d.party}><Marked text={d.party} q={ctx.q} /></span>,
      sortValue: d => d.party, searchText: d => d.party, filter: 'multiselect',
    },
    {
      key: 'status', label: 'Status', headerClassName: 'min-w-[190px]',
      render: (d, ctx) => d.status ? <Badge tone={docStatusTone(d.status)} className={cn(PARTNER_CHIP_CLS, 'whitespace-nowrap')}><Marked text={d.status} q={ctx.q} /></Badge> : <EmptyCell />,
      sortValue: d => d.status || null, searchText: d => d.status, filter: 'multiselect',
    },
    {
      // Vendor invoices' second status, as Vendor Invoicing shows it beside the first.
      key: 'paymentStatus', label: 'Payment Status', headerClassName: 'min-w-[150px]',
      render: (d, ctx) => d.paymentStatus ? <Badge tone={docStatusTone(d.paymentStatus)} className={cn(PARTNER_CHIP_CLS, 'whitespace-nowrap')}><Marked text={d.paymentStatus} q={ctx.q} /></Badge> : <EmptyCell />,
      sortValue: d => d.paymentStatus || null, searchText: d => d.paymentStatus ?? '', filter: 'multiselect',
    },
    {
      key: 'date', label: 'Date', headerClassName: 'min-w-[130px]',
      render: (d, ctx) => <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap"><Marked text={fmtDate(d.date)} q={ctx.q} /></span>,
      sortValue: d => d.date, searchText: d => fmtDate(d.date), filter: 'date', filterValue: d => d.date,
    },
    {
      key: 'amount', label: 'Amount', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[160px]',
      render: (d, ctx) => <span className="text-sm font-medium text-slate-700 tabular-nums whitespace-nowrap"><Marked text={money(c.symbol, d.amount, dp)} q={ctx.q} /></span>,
      // Found however the amount is typed: 85,000.00, 85000 or 85000.00.
      sortValue: d => d.amount, searchText: d => [money(c.symbol, d.amount, dp), fmtAmount(d.amount, dp), String(d.amount), d.amount.toFixed(dp)], filter: 'range',
    },
  ], [c.code, dp])

  const table = useCoaTable<LinkedDoc>({ columns, rows, query: debouncedQ, getRowId: d => d.id, rememberAs: 'currency:linked', defaultSort: { key: 'date', dir: 'desc' } })

  // With types picked, only their statuses are offered (a purchase order is never
  // Partially Paid); with none, every status the transactions here carry.
  const statusOptions = STATUS_ORDER.filter(s => inType.some(d => d.status === s))
  // A status ticked for another type stays ticked, out of sight, so clearing the
  // type brings it back; the pill shows and counts only what it offers.
  const shownStatuses = statuses.filter(s => statusOptions.includes(s))
  const setShownStatuses = (next: string[]) => setStatuses([...statuses.filter(s => !statusOptions.includes(s)), ...next])
  // The same for Payment Status, offered while vendor invoices are in view.
  const payOptions = PAYMENT_STATUS_ORDER.filter(s => inPayPill.some(d => d.paymentStatus === s))
  const shownPay = payStatuses.filter(s => payOptions.includes(s))
  const setShownPay = (next: string[]) => setPayStatuses([...payStatuses.filter(s => !payOptions.includes(s)), ...next])
  const narrowing = types.length > 0 || statuses.length > 0 || payStatuses.length > 0 || Object.keys(table.colFilters).length > 0

  if (docs.length === 0) {
    return (
      <div className="card flex-1 flex items-center justify-center min-h-[calc(100vh-260px)]">
        <EmptyState icon={<Inbox size={20} />} title="No transactions found" description="Transactions in this currency will appear here." />
      </div>
    )
  }

  return (
    <CoaTableCard
      table={table}
      className="min-h-[calc(100vh-260px)]"
      toolbar={
        <TableToolbar
          search={{ value: query, onChange: setQuery, placeholder: 'Search by ID, party or amount' }}
          count={{ shown: table.rows.length, total: docs.length, noun: docs.length === 1 ? 'transaction' : 'transactions' }}
          density={table.densityMenuProps}
          columns={{ open: table.columnsOpen, onToggle: () => table.setColumnsOpen(o => !o), count: table.visibleCount }}
        />
      }
      pills={
        <PillRow>
          <PillFilter
            label="Type"
            icon={<FileStack size={14} />}
            description="Filter by transaction type."
            options={DOC_TYPES.map(t => ({ value: t.key, label: t.plural, count: inStatus.filter(d => d.type === t.key).length }))}
            selected={types}
            onChange={next => setTypes(next as DocTypeKey[])}
          />
          <PillFilter
            label="Status"
            icon={<CircleDot size={14} />}
            description="Filter by transaction status."
            options={statusOptions.map(s => ({ value: s, label: s, count: inType.filter(d => d.status === s).length }))}
            selected={shownStatuses}
            onChange={setShownStatuses}
          />
          {payOptions.length > 0 && (
            <PillFilter
              label="Payment Status"
              icon={<Wallet size={14} />}
              description="Filter vendor invoices by payment status."
              options={payOptions.map(s => ({ value: s, label: s, count: inPayPill.filter(d => d.paymentStatus === s).length }))}
              selected={shownPay}
              onChange={setShownPay}
            />
          )}
        </PillRow>
      }
    >
      {/* Block-windowed at any length, like CoA's Transactions tab: fifty drawn at a time, never more than a hundred. */}
      <CoaDataTable
        table={table}
        windowAbove={0}
        emptyState={<TableEmptyState noun="transactions" query={debouncedQ} filtersActive={narrowing} onClearSearch={() => setQuery('')} onClearFilters={() => { setTypes([]); setStatuses([]); setPayStatuses([]); table.setColFilters({}) }} where={`${c.code}'s transactions`} />}
      />
      {quick && <TransactionQuickView doc={quick} currency={c} onClose={() => setQuick(null)} />}
    </CoaTableCard>
  )
}

