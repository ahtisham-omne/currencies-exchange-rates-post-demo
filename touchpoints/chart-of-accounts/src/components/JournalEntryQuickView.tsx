import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Layers } from 'lucide-react'
import { QuickViewModal, QuickViewCard } from './QuickView'
import { useStore, useAccountNumberText } from '../store'
import { reconstructEntry } from '../lib/journalEntry'
import { cn, fmtCurrencyExact, fmtDate } from '../lib/utils'

// Clicking a journal entry from inside an account's register opens this rather
// than navigating: the reader's question is almost always "what was the other
// side of this?", which is one glance, and leaving the account to answer it
// costs them their filters, sort and scroll position. The full page is one click
// away for anything more than a glance - which is why the lines are all this
// carries. Period, source and the linked document are the full entry's job;
// repeating them here only pads out the one answer the reader came for. Status,
// type and date sit in the meta row because they are what tells the reader this
// is the entry they meant to open.
//
// The shell comes from QuickView, shared with the source document quick view.

export function JournalEntryQuickView({ jeNumber, onClose, highlightAccountId }: {
  jeNumber: string | null
  onClose: () => void
  /* The account whose register this was opened from. Its line is marked so the
     reader can immediately tell which side of the entry they were looking at. */
  highlightAccountId?: string
}) {
  const navigate = useNavigate()
  const numberText = useAccountNumberText()
  const transactions = useStore(s => s.transactions)
  const accounts = useStore(s => s.accounts)
  const base = useStore(s => s.company.baseCurrency)

  const entry = useMemo(
    () => (jeNumber ? reconstructEntry(jeNumber, transactions, accounts) : null),
    [jeNumber, transactions, accounts],
  )

  if (!jeNumber || !entry?.found) return null

  const openFull = () => {
    onClose()
    navigate(`/general-ledger/entry/${encodeURIComponent(jeNumber)}`)
  }

  return (
    <QuickViewModal
      open
      onClose={onClose}
      icon={<FileText size={17} />}
      id={entry.jeNumber}
      title={entry.memo}
      meta={{
        status: { label: entry.status, tone: entry.status === 'Posted' ? 'success' : entry.status === 'Draft' ? 'warning' : 'slate' },
        facts: [`${entry.entryType} entry`, fmtDate(entry.date)],
      }}
      openLabel="Open full entry"
      onOpen={openFull}
    >
        <QuickViewCard
          title="Lines"
          icon={Layers}
          count={entry.lines.length}
          flush
        >
          {/* Table recipe is the Partners DataTable one the full-page entry
              already uses - asymmetric pl-4/pr-2, 40px header row, blue hover -
              so the two views of the same entry read as one. */}
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-13">
              <thead>
                <tr className="border-b border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)] text-muted-foreground text-xs [&>th]:h-10 [&>th]:pl-4 [&>th]:pr-2 [&>th]:align-middle [&>th]:font-normal [&>th]:whitespace-nowrap">
                  <th className="text-left">GL account</th>
                  <th className="text-left">Line description</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map(l => {
                  const mine = !!highlightAccountId && l.accountId === highlightAccountId
                  return (
                    <tr
                      key={l.id}
                      // A left accent bar rather than a row fill: the fill would
                      // collide with the blue hover and stop reading as a state.
                      className={cn(
                        'border-b border-border-subtle bg-white hover:bg-[#F0F7FF] transition-colors [&>td]:py-3 [&>td]:pl-4 [&>td]:pr-2 [&>td]:align-middle',
                        mine && '[&>td:first-child]:shadow-[inset_2px_0_0_0_hsl(var(--primary))]',
                      )}
                    >
                      <td>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground tabular-nums shrink-0" title={l.account?.accountNumber}>{l.account ? numberText(l.account.accountNumber) : '-'}</span>
                          <span className="text-fg truncate" style={{ fontWeight: 500 }}>{l.account?.accountName ?? l.accountId}</span>
                          {mine && (
                            <span className="shrink-0 inline-flex items-center px-1.5 py-[3px] rounded-md border border-primary/30 bg-accent text-10 text-primary" style={{ fontWeight: 600 }}>
                              THIS ACCOUNT
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-muted-foreground">{l.description || '-'}</td>
                      <td className="text-right tabular-nums text-slate-700">
                        {l.debit ? fmtCurrencyExact(l.debit, base) : <span className="text-fg-subtle">-</span>}
                      </td>
                      <td className="text-right tabular-nums text-slate-700">
                        {l.credit ? fmtCurrencyExact(l.credit, base) : <span className="text-fg-subtle">-</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)] text-slate-900 [&>td]:py-3 [&>td]:pl-4 [&>td]:pr-2 [&>td]:align-middle" style={{ fontWeight: 600 }}>
                  <td colSpan={2}>Totals</td>
                  <td className="text-right tabular-nums">{fmtCurrencyExact(entry.totalDebit, base)}</td>
                  <td className="text-right tabular-nums">{fmtCurrencyExact(entry.totalCredit, base)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </QuickViewCard>
    </QuickViewModal>
  )
}
