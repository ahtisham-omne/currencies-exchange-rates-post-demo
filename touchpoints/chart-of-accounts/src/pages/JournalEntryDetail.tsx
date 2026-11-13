import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { FileText, ArrowLeft, Undo2, Link2, Layers, Activity, MessageSquare, AlertTriangle } from 'lucide-react'
import { DetailHeaderCard, detailContainerCls } from '../components/DetailHeaderCard'
import { DashInfoCard, DashInfoLabel } from '../components/DashInfoCard'
import { QuickViewCard } from '../components/QuickView'
import { Button, Badge, Tooltip, EmptyState } from '../components/ui'
import { ReverseEntryFlow } from '../components/ReverseEntryFlow'
import { LinkedDocTile } from '../components/LinkedDoc'
import { TagStrip } from '../components/EntityTagChip'
import { CategoryCell, DimensionPills, FxPostingTooltip } from '../components/AccountTable'
import { useStore, useAccountNumberText } from '../store'
import { AttachmentsTab } from '../components/AttachmentsTab'
import { CommsTab, useComms, useCommsCount } from '../components/CommsTab'
import { NotesTab, useRecordNotes } from '../components/NotesTab'
import { entryNotes, noteKey } from '../lib/notes'
import { ChartWidgetCard } from '../components/ChartWidgetCard'
import { ActivityFeed, type ActivityFeedItem } from '../components/ActivityFeed'
import { sourceDocLabel } from '../lib/seed'
import { adjustmentKind, attachmentsForEntry, reconstructEntry, type AdjustmentKind, type JeLine, type ReconstructedEntry, type EntryAttachment } from '../lib/journalEntry'
import { createdHere, type CommThread } from '../lib/comms'
import { ACCOUNT_TYPE_META, type Account, type Transaction } from '../types'
import { cn, fmtCurrencyExact, fmtDate } from '../lib/utils'
import { formatRate } from '../lib/currencies'
import { JOURNAL_INTERNAL_ID_HELP, JOURNAL_INTERNAL_ID_LABEL } from '../lib/internalId'
import { InternalIdField } from '../components/InternalIdField'
import { cleanName } from '../components/Avatar'
import { ADJUSTMENT_FLAG, AdjustmentBadge } from '../components/AdjustmentBadge'

export default function JournalEntryDetailPage() {
  const { jeId } = useParams()
  // Creating is a modal experience launched from the ledger, so a direct hit on
  // /entry/new just bounces back to the General Ledger.
  if (jeId === 'new') return <Navigate to="/general-ledger" replace />
  return <ViewJournalEntry jeNumber={decodeURIComponent(jeId ?? '')} />
}

/* ─────────────────────────── View (posted) ─────────────────────────── */
function ViewJournalEntry({ jeNumber }: { jeNumber: string }) {
  const navigate = useNavigate()
  const transactions = useStore(s => s.transactions)
  const accounts = useStore(s => s.accounts)
  const base = useStore(s => s.company.baseCurrency)

  const tags = useStore(s => s.jeTags[jeNumber])
  const setEntryTags = useStore(s => s.setEntryTags)

  const [reverseOpen, setReverseOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [tab, setTab] = useState('overview')
  const entry = useMemo(() => reconstructEntry(jeNumber, transactions, accounts), [jeNumber, transactions, accounts])
  // The notes the entry opens with, read by its tab and its tab's count alike.
  const derivedNotes = useMemo(() => entryNotes(entry, base), [entry, base])
  const noteCount = useRecordNotes(noteKey('entry', jeNumber), derivedNotes).length

  const openReverse = () => setReverseOpen(true)
  // Files the user uploaded when posting come first, ahead of the paper trail
  // derived from the entry's source system.
  const uploaded = useStore(s => s.jeAttachments[jeNumber])
  const attachments = useMemo(
    () => [...(uploaded ?? []), ...attachmentsForEntry(entry)],
    [uploaded, entry],
  )
  const commsSubject = { subjectId: jeNumber, kind: 'entry' as const, label: jeNumber, anchorIso: entry.date, fresh: createdHere(entry.createdBy) }
  // Messages, not threads, for the same reason the account's badge counts them.
  const commsCount = useCommsCount(commsSubject)
  const commsThreads = useComms(commsSubject)

  if (!entry.found) {
    return (
      /* Unframed: this one is the whole page, so a border would stretch the
         width of it and read as a band rather than a panel. There is nothing
         beside it for a frame to separate it from. */
      <EmptyState
        icon={<FileText size={20} />}
        title="Journal entry not found"
        description={`No entry matches ${jeNumber}.`}
        action={
          <Button variant="secondary" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate('/general-ledger')}>
            Back to General Ledger
          </Button>
        }
      />
    )
  }

  const tone = entry.status === 'Reversed' ? 'danger' : entry.status === 'Draft' ? 'warning' : 'default'
  /* The currency the entry was written in - base, unless it was entered in
     another and converted as it posted. Each line carries its own now, so an
     entry whose lines differ has no one currency, and says so. The rate is the
     one every line in another currency posted at - one EUR line beside base
     lines still has a single rate to state - and "Multiple" where they differ. */
  const entryCurrency = entry.multiCurrency ? 'Multiple' : entry.entryCurrency ?? base
  const foreignRates = new Map(entry.lines.filter(l => l.currency && l.rate).map(l => [`${l.currency}|${l.rate}`, { currency: l.currency!, rate: l.rate! }]))
  const fx = foreignRates.size === 1 ? [...foreignRates.values()][0] : undefined
  const mixedRates = foreignRates.size > 1

  return (
    <div className="pb-12">
      <DetailHeaderCard
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen(v => !v)}
        onBack={() => navigate('/general-ledger')}
        backTitle="Back to General Ledger"
        /* Named by its number: an entry has no title of its own, only its memo
           and its lines' text. Mahad, 2026-09-30: *"Please remove description
           entirly, we will only have memo and line description"* - and, the
           same day, *"Remove type from journal entry detail page."* */
        title={entry.jeNumber}
        typeLine={`Posts to ${entry.period}`}
        tone={tone}
        titleBadges={
          <>
            {entry.reversalNo && (
              <Tooltip side="bottom" content={`Backed out by ${entry.reversalNo}. Both entries stay on the ledger.`}>
                <Badge tone="danger">Reversed</Badge>
              </Tooltip>
            )}
            {/* No currency chip: the rail's Currency field states it (Mahad,
                2026-10-09: *"remove currency from header in the detail pages"*). */}
          </>
        }
        // A posted entry is a permanent record, so it cannot be edited - the way
        // to correct one is a reversing entry, which leaves both the original and
        // the correction on the ledger. That makes reversing the only action here,
        // so it takes the primary slot rather than sitting behind an Actions menu
        // holding one item. Mahad, 2026-10-11: *"Hide the Reverse button on an
        // entry that is itself a reversal. On an entry that's already been
        // reversed, grey the button out and say which entry reversed it."*
        actions={entry.reverses ? undefined : entry.reversalNo ? (
          <span className="inline-flex items-center gap-2.5">
            <span className="text-[12px] text-fg-muted inline-flex items-center gap-1" data-reversed-by>
              Reversed by <EntryLink jeNumber={entry.reversalNo} />
            </span>
            <Tooltip side="bottom" align="right" content={`${entry.jeNumber} has already been reversed by ${entry.reversalNo}, so it can't be reversed again.`}>
              <button type="button" aria-disabled="true" className="h-9 px-4 text-[13px] rounded-lg bg-bg-subtle text-fg-subtle border border-border inline-flex items-center gap-1.5 cursor-not-allowed" style={{ fontWeight: 600 }}>
                <Undo2 className="w-3.5 h-3.5" />
                Reverse this entry
              </button>
            </Tooltip>
          </span>
        ) : (
          <button onClick={openReverse} className="h-9 px-4 text-[13px] rounded-lg bg-primary hover:bg-[#0862D0] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm" style={{ fontWeight: 600 }}>
            <Undo2 className="w-3.5 h-3.5" />
            Reverse this entry
          </button>
        )}
        // The lines and the record they came from are one story, so they share
        // Overview. Then the four tabs every record carries, last and in the
        // account page's order: Notes, Attachments, Communication, Activity.
        // Design review, 2026-09-28 - Eli: *"Like everything else, I should have
        // notes and ... There's four things that everything gets."*
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'notes', label: 'Notes', count: noteCount },
          { id: 'attachments', label: 'Attachments', count: attachments.length },
          // What was said about the entry, kept against the entry. Every question
          // about a posting is asked somewhere, and an inbox is somewhere nobody
          // reading the ledger can see.
          { id: 'comms', label: 'Communications', count: commsCount },
          { id: 'activity', label: 'Activity' },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />
      <ReverseEntryFlow jeNumber={reverseOpen ? entry.jeNumber : null} onClose={() => setReverseOpen(false)} />

      {/* Above every tab, as vendor invoicing carries an exception above its
          tab content: the reason an entry is an adjustment is a fact about the
          whole record, not about one tab of it. */}
      {entry.adjustmentReason && (
        <div className={cn(detailContainerCls(fullscreen), 'pt-3')}>
          <AdjustmentBanner entry={entry} />
        </div>
      )}

      {tab === 'notes' ? (
        <div className={cn(detailContainerCls(fullscreen), 'pt-3 pb-5')}>
          <NotesTab noteKey={noteKey('entry', entry.jeNumber)} noun="journal entry" derived={derivedNotes} />
        </div>
      ) : tab === 'activity' ? (
        <div className={cn(detailContainerCls(fullscreen), 'pt-3 pb-5')}>
          <ChartWidgetCard title="Activity Timeline" icon={Activity}>
            {/* No footer about backend integration: that is our work, not the
                reader's (module review, 2026-10-06, COA-30). */}
            <ActivityFeed items={entryActivity(entry, uploaded ?? [], commsThreads, transactions)} />
          </ChartWidgetCard>
        </div>
      ) : tab === 'attachments' ? (
        <div className={cn(detailContainerCls(fullscreen), 'pt-3 pb-5 flex flex-col')}>
          <AttachmentsTab
            files={attachments}
            uploadedByName="Ahtisham Ahmad (You)"
            document={{ recordLabel: entry.jeNumber, recordKind: 'journal entry' }}
          />
        </div>
      ) : tab === 'comms' ? (
        <div className={cn(detailContainerCls(fullscreen), 'pt-3 pb-5')}>
          <CommsTab {...commsSubject} />
        </div>
      ) : (
      <div className={cn(detailContainerCls(fullscreen), 'pt-3 pb-5 space-y-4')}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">
          {/* LEFT - main content: the entry's lines */}
          <div className="min-w-0 space-y-3">
            {/* Same card and table as the journal entry quick view, down to the
                icon tile and line count, so the glance and the full page read as
                one entry. The page adds the two columns a glance leaves out. */}
            <QuickViewCard title="Lines" icon={Layers} count={entry.lines.length} flush>
              <LinesTable lines={entry.lines} base={base} date={entry.date} totalDebit={entry.totalDebit} totalCredit={entry.totalCredit} entryCurrency={entry.entryCurrency} flagSystemAccounts={!!entry.adjustmentReason} />
            </QuickViewCard>
          </div>

          {/* RIGHT - sticky info rail, mirroring the account detail page. */}
          <div className="space-y-3.5 min-w-0 overflow-hidden xl:sticky xl:top-[160px]">
            <DashInfoCard title="Journal entry information" icon={FileText}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
                <div className="min-w-0">
                  <DashInfoLabel>Date</DashInfoLabel>
                  <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{fmtDate(entry.date)}</p>
                </div>
                <div className="min-w-0">
                  <DashInfoLabel tooltip="The entry's number, the next in sequence for its year when it posted.">Journal entry number</DashInfoLabel>
                  <p className="text-[12px] text-slate-700 truncate tabular-nums" style={{ fontWeight: 600 }}>{entry.jeNumber}</p>
                </div>
              </div>
              <div className="mb-2.5 min-w-0">
                <DashInfoLabel tooltip="The accounting period this entry posts to. Must be an open period.">Posting period</DashInfoLabel>
                <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{entry.period}</p>
              </div>
              <div className="mb-2.5">
                <DashInfoLabel tooltip="Notes about the entry: why it was posted, or where its figures came from.">Memo</DashInfoLabel>
                <p className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]" style={{ fontWeight: 500 }}>{entry.memo || <span className="text-fg-subtle">-</span>}</p>
              </div>
              {/* Why the entry this one backs out was reversed, as whoever
                  reversed it wrote it. Only on a reversing entry. */}
              {entry.reversalReason && (
                <div className="mb-2.5">
                  <DashInfoLabel tooltip="Why the entry this one backs out was reversed, in the words of whoever reversed it.">Reversal reason</DashInfoLabel>
                  <p className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]" style={{ fontWeight: 500 }}>{entry.reversalReason}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div className="min-w-0">
                  <DashInfoLabel tooltip={entry.multiCurrency ? 'The lines are in different currencies. Each line shows its own amount and the base amount under it.' : undefined}>Currency</DashInfoLabel>
                  <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{entryCurrency}</p>
                </div>
                {/* Only on an entry written in another currency: the rate it
                    posted to the ledger at, or "Multiple" where its lines
                    posted at different ones. */}
                {fx && (
                  <div className="min-w-0">
                    <DashInfoLabel tooltip={`The rate the lines in another currency were converted at when the entry posted. The ledger holds the ${base} figures.`}>Exchange rate</DashInfoLabel>
                    <p className="text-[12px] text-slate-700 truncate tabular-nums" style={{ fontWeight: 500 }}>1 {base} = {formatRate(fx.rate)} {fx.currency}</p>
                  </div>
                )}
                {mixedRates && (
                  <div className="min-w-0">
                    <DashInfoLabel tooltip="The lines posted at different rates. Hover a line's amount for its rate.">Exchange rate</DashInfoLabel>
                    <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>Multiple</p>
                  </div>
                )}
              </div>
              {entry.reversalDate && (
                <div className="pt-2.5 mt-2.5 border-t border-muted">
                  <DashInfoLabel tooltip="The date this entry automatically reverses, if set. Used for accruals.">Reversal date</DashInfoLabel>
                  <p className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{fmtDate(entry.reversalDate)}</p>
                </div>
              )}
              {/* Both ends of the correction, so neither half of the pair is ever
                  read without a way to the other. */}
              {(entry.reversalNo || entry.reverses) && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-2.5 mt-2.5 border-t border-muted">
                  {entry.reversalNo && (
                    <div className="min-w-0">
                      <DashInfoLabel tooltip="The entry that backs this one out. Both stay on the ledger.">Reversed by</DashInfoLabel>
                      <EntryLink jeNumber={entry.reversalNo} />
                    </div>
                  )}
                  {entry.reverses && (
                    <div className="min-w-0">
                      <DashInfoLabel tooltip="The entry this one backs out.">Reverses</DashInfoLabel>
                      <EntryLink jeNumber={entry.reverses} />
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-2.5 mt-2.5 border-t border-muted">
                <div className="min-w-0">
                  <DashInfoLabel>Created by</DashInfoLabel>
                  <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{entry.createdBy}</p>
                </div>
                <div className="min-w-0">
                  <DashInfoLabel>Created on</DashInfoLabel>
                  <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{fmtDate(entry.createdAt)}</p>
                </div>
                {/* With the other facts the system stamped, as on the account page. */}
                <InternalIdField id={entry.entryInternalId} help={JOURNAL_INTERNAL_ID_HELP} label={JOURNAL_INTERNAL_ID_LABEL} />
              </div>
              {/* Set when the entry was written, and added to or removed here in
                  the same strip. Last in the card, with the other facts the entry
                  arrived with, rather than beside the number and status up top. */}
              <div className="pt-2.5 mt-2.5 border-t border-muted">
                <DashInfoLabel>Tags</DashInfoLabel>
                <div className="mt-1">
                  <TagStrip tags={tags ?? []} onChange={next => setEntryTags(jeNumber, next)} />
                </div>
              </div>
            </DashInfoCard>

            {/* The document this entry came from - a link out to it, never the
                document itself. Lives in the rail rather than its own tab: it is
                one row naming a record that lives in another module, and it reads
                as provenance alongside the other metadata cards. */}
            <DashInfoCard title="Linked document" icon={Link2} count={entry.hasLinkedDoc ? 1 : 0}>
              <LinkedDocTile source={entry.source} reference={entry.reference} />
            </DashInfoCard>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

function EntryLink({ jeNumber }: { jeNumber: string }) {
  return (
    <Link to={`/general-ledger/entry/${encodeURIComponent(jeNumber)}`}
      className="text-[12px] text-primary hover:underline tabular-nums truncate block" style={{ fontWeight: 600 }}>
      {jeNumber}
    </Link>
  )
}

function AccountLink({ account, accountId }: { account?: Account; accountId: string }) {
  const numberText = useAccountNumberText()
  if (!account) return <span className="text-fg-muted">{accountId}</span>
  return (
    <Link to={`/chart-of-accounts/${accountId}`} className="group inline-flex items-baseline gap-2 min-w-0">
      <span className="text-fg-muted tabular-nums shrink-0" title={account.accountNumber}>{numberText(account.accountNumber)}</span>
      <span className="text-fg group-hover:text-primary group-hover:underline truncate" style={{ fontWeight: 500 }}>{account.accountName}</span>
    </Link>
  )
}

/* An entry written in another currency reads as it was written - each amount in
   its own currency - with the base figure it posted at beneath it, since that is
   the one the ledger and every balance hold. */
/* ───────────────── Posted by hand to a system-kept account ─────────────────
   Ported from vendor invoicing's exception banner (`StatusReasonBanner` in its
   InvoiceDetailScreen): an icon tile, the title, and a line led by a Reason chip
   that ends with who flagged it and when. Mahad, 2026-10-05: *"See how we have
   this in vendor invoicing. We want this instead of this in the details page for
   journal entries"* - replacing the Flags card in the rail. Its colours are
   vendor invoicing's own exception colours.

   No button: vendor invoicing's "Resolve exception" has nothing to answer here,
   since the entry has posted and a correction is a reversal, which the header
   already offers. Which line made it an adjustment is the badge on that line;
   the files posted with it are on the Attachments tab. */
const BANNER = { border: '#FED7AA', tile: '#FFF7ED', ink: '#C2410C' }

function AdjustmentBanner({ entry }: { entry: ReconstructedEntry }) {
  const kinds = [...new Set(entry.lines.filter(l => !l.synthetic).map(l => adjustmentKind(l.account)).filter((k): k is AdjustmentKind => !!k))]
  const title = kinds.length === 1 ? ADJUSTMENT_FLAG[kinds[0]] : 'System account adjustment'
  const at = new Date(entry.createdAt)
  const when = Number.isNaN(at.getTime())
    ? fmtDate(entry.createdAt)
    : `${fmtDate(entry.createdAt)} at ${at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  return (
    <div className="rounded-xl border bg-white px-4 py-3 flex items-start gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]" style={{ borderColor: BANNER.border }} data-system-account-flag-card>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: BANNER.tile }}>
        <AlertTriangle className="w-4 h-4" style={{ color: BANNER.ink }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-fg" style={{ fontWeight: 700 }}>{title}</p>
        <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed [overflow-wrap:anywhere]">
          {/* The Reason chip labels the reason line itself, not the title. */}
          <span className="inline-flex px-1.5 py-px rounded-md text-[9px] align-middle mr-1.5" style={{ fontWeight: 700, backgroundColor: BANNER.tile, color: BANNER.ink }}>
            Reason
          </span>
          {entry.adjustmentReason}
          <span className="text-slate-400"> · by {cleanName(entry.createdBy)} on {when}</span>
        </p>
      </div>
    </div>
  )
}

/* Each line in the currency it was written in, over the base figure it posted
   at; a line in the base currency reads as the base figure alone. The typed
   amount carries the posting card, at the line's own rate and date. The totals
   add up the typed amounts only where every line was typed in one currency -
   amounts in different currencies cannot be added - and the base totals always. */
function LinesTable({ lines, base, date, totalDebit, totalCredit, entryCurrency, flagSystemAccounts }: { lines: JeLine[]; base: string; date: string; totalDebit: number; totalCredit: number; entryCurrency?: string; flagSystemAccounts?: boolean }) {
  const money = (baseValue: number, typed: number | undefined, code: string | undefined, rate?: number, strong = false) => {
    if (!baseValue && !typed) return <span className="text-fg-subtle">-</span>
    if (!code || typed === undefined) return <>{fmtCurrencyExact(baseValue, base)}</>
    const amount = <span className={strong ? undefined : 'text-slate-700'}>{fmtCurrencyExact(typed, code)}</span>
    return (
      <>
        {rate
          ? <FxPostingTooltip code={code} base={base} booked={baseValue} rate={rate} on={fmtDate(date)}><span className="cursor-help">{amount}</span></FxPostingTooltip>
          : amount}
        <span className="block text-[11px] text-fg-muted" style={{ fontWeight: 400 }}>{fmtCurrencyExact(baseValue, base)}</span>
      </>
    )
  }
  const fxTotal = (k: 'fxDebit' | 'fxCredit') => entryCurrency ? Math.round(lines.reduce((s, l) => s + (l[k] ?? 0), 0) * 100) / 100 : undefined
  // Standard accounting order inside an entry: debits first, then credits.
  const orderedLines = useMemo(
    () => [...lines].sort((a, b) => (a.debit > 0 ? 0 : 1) - (b.debit > 0 ? 0 : 1)),
    [lines],
  )
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-13">
        <thead>
          <tr className="border-b border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)] text-muted-foreground text-xs [&>th]:h-10 [&>th]:pl-4 [&>th]:pr-2 [&>th]:align-middle [&>th]:font-normal [&>th]:whitespace-nowrap">
            <th className="text-left">Account</th>
            <th className="text-left">GL account category</th>
            <th className="text-left">Line description</th>
            {/* Read off the account, not set on the line: a line inherits its
                dimensions from the account it posts to, so this restates on the
                entry what the account already decided. */}
            <th className="text-left">Dimensions</th>
            <th className="text-right">Debit</th>
            <th className="text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {orderedLines.map(l => (
            <tr key={l.id} className="border-b border-border-subtle bg-white hover:bg-[#F0F7FF] transition-colors [&>td]:py-3 [&>td]:pl-4 [&>td]:pr-2 [&>td]:align-middle">
              <td>
                <span className="inline-flex items-center gap-1.5">
                  <AccountLink account={l.account} accountId={l.accountId} />
                  {/* The line that made this an adjustment, marked where it is. */}
                  {flagSystemAccounts && adjustmentKind(l.account) && (
                    <span className="inline-flex" data-system-account-flag><AdjustmentBadge kinds={[adjustmentKind(l.account)!]} /></span>
                  )}
                </span>
              </td>
              <td>{l.account ? <CategoryCell meta={ACCOUNT_TYPE_META[l.account.accountType]} /> : <span className="text-fg-subtle">-</span>}</td>
              <td className="text-muted-foreground [overflow-wrap:anywhere]">{l.description || <span className="text-fg-subtle">-</span>}</td>
              <td><DimensionPills dimensionValues={l.dimensionValues} /></td>
              <td className="text-right tabular-nums text-slate-700">{money(l.debit, l.fxDebit || undefined, l.currency ?? entryCurrency, l.rate)}</td>
              <td className="text-right tabular-nums text-slate-700">{money(l.credit, l.fxCredit || undefined, l.currency ?? entryCurrency, l.rate)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)] text-slate-900 [&>td]:py-3 [&>td]:pl-4 [&>td]:pr-2 [&>td]:align-middle" style={{ fontWeight: 600 }}>
            <td colSpan={4}>Totals</td>
            <td className="text-right tabular-nums">{money(totalDebit, fxTotal('fxDebit'), entryCurrency, undefined, true)}</td>
            <td className="text-right tabular-nums">{money(totalCredit, fxTotal('fxCredit'), entryCurrency, undefined, true)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/* ───────────────── Activity ─────────────────
   What has happened to the entry since it posted, newest first: the posting
   itself, the files added to it, what was said about it, the note, and the
   entries it reverses or is reversed by. Read off the records that already hold
   each of these rather than a log of its own, so the timeline cannot disagree
   with the tab that shows the thing it names. */
function entryActivity(
  entry: ReconstructedEntry,
  uploaded: EntryAttachment[],
  threads: CommThread[],
  transactions: Transaction[],
): ActivityFeedItem[] {
  const who = (name: string) => name.replace(/\s*\(.*?\)\s*/g, '').trim() || name
  const rows: (ActivityFeedItem & { iso: string })[] = []
  const posted = entry.source === 'Manual JE' || entry.source === 'Opening balance'
    ? 'posted the journal entry'
    : `posted the entry from a ${sourceDocLabel(entry.source)}`
  rows.push({ id: 'posted', type: 'create', user: who(entry.createdBy), verb: posted, target: entry.jeNumber, date: fmtDate(entry.createdAt), iso: entry.createdAt })
  if (entry.adjustmentReason) {
    rows.push({ id: 'reason', type: 'apply', user: who(entry.createdBy), verb: `posted it as an adjustment: “${entry.adjustmentReason}”`, date: fmtDate(entry.createdAt), iso: entry.createdAt + 'T00:00:01' })
  }
  if (entry.reverses) {
    rows.push({ id: 'reverses', type: 'link', user: who(entry.createdBy), verb: 'posted it to reverse', target: entry.reverses, date: fmtDate(entry.createdAt), iso: entry.createdAt + 'T00:00:02' })
  }
  if (entry.reversalNo) {
    const on = transactions.find(t => t.jeNumber === entry.reversalNo)?.date ?? entry.createdAt
    rows.push({ id: 'reversed', type: 'delete', user: 'The entry', verb: 'was reversed by', target: entry.reversalNo, date: fmtDate(on), iso: on })
  }
  for (const f of uploaded) {
    rows.push({ id: `file-${f.id}`, type: 'link', user: who(f.uploadedBy), verb: 'attached', target: f.name, date: fmtDate(f.date), iso: f.date })
  }
  for (const t of threads) {
    for (const m of t.messages) {
      const verb = m.channel === 'Note' ? 'added a note on the Communications tab' : m.isOutbound ? `emailed ${m.to || 'a colleague'}` : 'sent an email about the entry'
      rows.push({ id: `msg-${m.id}`, type: 'info', user: who(m.from), verb, target: t.subject, date: m.timestamp || fmtDate(m.dateIso), iso: m.dateIso })
    }
  }
  return rows.sort((a, b) => b.iso.localeCompare(a.iso)).map(({ iso: _iso, ...r }) => r)
}
