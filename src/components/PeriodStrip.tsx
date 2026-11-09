import { Calendar } from 'lucide-react'
import { Badge, Tooltip } from './ui'
import { cn } from '../lib/utils'
import { AccountingPeriodPicker, PERIOD_STATUS_TONE } from './AccountingPeriodPicker'
import { DateField } from './DateField'
import { useSelectedPeriod, useStore } from '../store'
import { PERIOD_STATUS_LABEL, Period, PeriodStatus } from '../types'
import type { PeriodScope, PeriodSelection, ResolvedPeriod } from '../lib/periodSelection'

// States the accounting period every money figure on the surface is read against,
// and lets the reader change it.
//
// Shared by the account listing, the ledger and both account-detail templates so
// all of them state the period in identical words - two wordings would reintroduce
// the confusion with the Insights date range that this strip exists to remove. The
// selection itself is module-wide (store.periodSelection), so switching period on
// one surface switches it on all of them.

const STATUS_ORDER: PeriodStatus[] = ['Open', 'Soft-Closed', 'Hard-Locked']

// A span wider than one period can straddle a close, so the badge says "Mixed"
// and this spells out what it mixes.
function statusBreakdown(counts: Record<PeriodStatus, number>): string {
  return STATUS_ORDER
    .filter(s => counts[s] > 0)
    .map(s => `${counts[s]} ${PERIOD_STATUS_LABEL[s].toLowerCase()}`)
    .join(', ')
}

// A month carries one status, and a quarter is the unit the close engine works
// in, so "Mixed" is worth saying there. A fiscal year or a hand-picked range
// almost always straddles a close, where the badge would be permanent noise -
// those spans state their dates and leave it at that.
const MIXED_BADGE_SCOPES: PeriodScope[] = ['month', 'quarter']

// The compact bordered field the two ends are set in. Taller than the picker's
// 22px trigger on purpose: the picker is a word to click, these are boxes to
// type a date into, and a bordered box the height of a line of text reads as
// decoration rather than as a field.
const BOUND_FIELD_CLS = 'w-[116px] h-7 px-2 rounded-md border border-border bg-white text-11 hover:border-primary/50 transition-colors cursor-pointer'

/* The span's two ends, stated and editable in place.
   Naming a period fills them; setting one by hand is a span the calendar has no
   name for, so the selection becomes custom and the picker relabels itself
   "Custom". That is how the accounting period reads in Financial Reporting, and
   it is the reason these are fields rather than the sentence of text that used
   to sit here - a reader who wants the 12th to the 20th should not have to find
   the Custom pane to say so. */
function PeriodBounds({ resolved, periods, onChange }: {
  resolved: ResolvedPeriod
  periods: Period[]
  onChange: (next: PeriodSelection) => void
}) {
  // "All dates" is unbounded on purpose, so it has no dates to show. Editing one
  // end of it still has to produce a bounded span, and the outermost period the
  // ledger defines is what "everything" actually means.
  const days = periods.map(p => p.startDate).concat(periods.map(p => p.endDate)).sort()
  const outerFrom = days[0] ?? ''
  const outerTo = days[days.length - 1] ?? ''

  const set = (edge: 'from' | 'to') => (iso: string) => {
    // The calendar can clear a field; an accounting period with one end missing
    // is not a period, so an empty pick is ignored rather than committed.
    if (!iso) return
    const from = resolved.startDate || outerFrom || iso
    const to = resolved.endDate || outerTo || iso
    // The far end follows the one just set rather than letting the range invert.
    const next = edge === 'from'
      ? { from: iso, to: iso > to ? iso : to }
      : { from: iso < from ? iso : from, to: iso }
    // Re-picking the day already in force is not an edit. Without this, opening
    // a field and clicking the day it already shows would relabel a named
    // accounting period "Custom" and say nothing changed.
    if (next.from === resolved.startDate && next.to === resolved.endDate) return
    onChange({ scope: 'custom', ...next })
  }

  return (
    <>
      <span className="text-11 text-muted-foreground shrink-0">From</span>
      <DateField
        value={resolved.startDate}
        onChange={set('from')}
        placeholder="Earliest"
        ariaLabel="Period from"
        triggerClassName={BOUND_FIELD_CLS}
      />
      <span className="text-11 text-muted-foreground shrink-0">to</span>
      <DateField
        value={resolved.endDate}
        onChange={set('to')}
        placeholder="Latest"
        ariaLabel="Period to"
        triggerClassName={BOUND_FIELD_CLS}
      />
    </>
  )
}

/* What the picker's hover says, page by page, in plain English: what changing
   the period changes there. Mahad, 2026-10-14: *"Tooltip on period to be in
   simple plain english that is easy to understand."* The chart's is his own
   (ChartOfAccounts, PERIOD_HINT). */
export const ACCOUNT_PERIOD_HINT = "Pick the period to look at. It changes the opening balance and this period's figures, but not the running balance."

/** A page's own words for the strip: what the picker reads, and what each
 *  status badge says on hover. Pages that pass none keep the strip's own. */
export interface PeriodStripCopy {
  label?: (r: ResolvedPeriod) => string
  /** null is a span over more than one period. */
  statusHint?: (status: PeriodStatus | null) => string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/* The General ledger's and Journal entries' words, Mahad's copy of 2026-10-14:
   a month reads as the calendar names it ("Oct 2026"), dates edited by hand read
   "Custom range", and each status badge says what it means for posting. */
export const LEDGER_PERIOD_HINT = 'Accounting period to view, set to the current period by default.'
export const LEDGER_PERIOD_COPY: PeriodStripCopy = {
  label: r => {
    if (r.scope === 'custom') return 'Custom range'
    if (r.scope === 'month' && r.startDate) return `${MONTHS[Number(r.startDate.slice(5, 7)) - 1]} ${r.startDate.slice(0, 4)}`
    return r.label
  },
  statusHint: s => s === null
    ? 'The date range covers more than one accounting period.'
    : s === 'Open' ? 'Entries can be posted to this period.' : 'This period is closed. No new entries can be posted.',
}

export function PeriodStrip({ periods, fiscalYearStart, variant = 'card', hint, copy }: {
  periods: Period[]
  fiscalYearStart: string
  /** `card` sits flush atop a table card; `standalone` floats in page flow. */
  variant?: 'card' | 'standalone'
  /** What the picker's hover says the period changes on this page. */
  hint: string
  copy?: PeriodStripCopy
}) {
  const selection = useStore(s => s.periodSelection)
  const setSelection = useStore(s => s.setPeriodSelection)
  // Read here rather than passed in: what a fiscal year is called is a company
  // setting no caller has reason to override, and every surface has to print the
  // same name for the same year.
  const fiscalYearNaming = useStore(s => s.company.fiscalYearNaming)
  const resolved = useSelectedPeriod()
  const total = resolved.periods.length
  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-2 bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)]',
      // The card variant sits flush inside a `.card`, which is `rounded-xl` and
      // deliberately `overflow-visible` so the picker and column popovers aren't
      // clipped. Nothing crops this strip for us, so it has to carry the card's
      // own top radius or its tint squares off the corners.
      variant === 'card' ? 'border-b border-border-subtle rounded-t-xl' : 'border border-border-subtle rounded-lg',
    )}>
      <Calendar size={13} className="text-fg-subtle shrink-0" />
      <span className="text-11 text-muted-foreground">Period</span>
      {/* Delayed hover on the picker itself, not on a separate Info icon: the
          picker is the control, and a reader hovering it briefly on their way
          past should not see a hint they were not asking for. The 600ms delay
          says "sustained hover", which is the shape of the reader wanting to
          know what this control does. */}
      <Tooltip delayMs={600} content={hint} side="bottom">
        <span className="inline-flex">
          <AccountingPeriodPicker
            value={selection}
            resolved={resolved}
            onChange={setSelection}
            periods={periods}
            fiscalYearStart={fiscalYearStart}
            fiscalYearNaming={fiscalYearNaming}
            triggerLabel={copy?.label?.(resolved)}
          />
        </span>
      </Tooltip>
      <PeriodBounds resolved={resolved} periods={periods} onChange={setSelection} />
      {resolved.status ? (
        // Only the open period that covers today is *the* one being posted into,
        // so only it earns "Active accounting period". A prior month left open
        // for late postings is open, but calling it active would tell the reader
        // they are posting into a month they have already moved past - it just
        // reads "Open", the plain close-status the other periods show.
        <HintedBadge hint={copy?.statusHint?.(resolved.status)}>
          <Badge tone={PERIOD_STATUS_TONE[resolved.status]}>
            {resolved.status === 'Open' && resolved.current ? 'Active accounting period' : PERIOD_STATUS_LABEL[resolved.status]}
          </Badge>
        </HintedBadge>
      ) : total > 0 && MIXED_BADGE_SCOPES.includes(resolved.scope) ? (
        <Tooltip content={copy?.statusHint?.(null) ?? `This span covers ${total} accounting ${total === 1 ? 'period' : 'periods'}: ${statusBreakdown(resolved.statusCounts)}.`}>
          <span className="inline-flex"><Badge tone="neutral">Mixed</Badge></span>
        </Tooltip>
      ) : null}
    </div>
  )
}

// A status badge with its meaning on hover, where the page gives one.
function HintedBadge({ hint, children }: { hint?: string; children: React.ReactElement }) {
  if (!hint) return children
  return <Tooltip content={hint}><span className="inline-flex">{children}</span></Tooltip>
}
