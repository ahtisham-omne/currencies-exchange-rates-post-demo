import { PERIOD_STATUS_LABEL } from '../types'
import type { Account, FiscalYearNaming, Period, PeriodStatus, QuarterId, Transaction } from '../types'
import { QUARTERS, fiscalYearName, fiscalYearOf, periodsForQuarter, quarterDateRange } from './periodClose'
import { normalSideDelta } from './monthlyLedger'
import { buildChartIndex } from './chartTree'
import { withEarningsFigures } from './currentYearEarnings'
import { typedCorrection } from './currencies'
import type { ChartIndex } from './chartTree'

// =========================
// Period selection (pure, derived - no store, no mutation).
//
// One accounting period drives every money figure on the Chart of Accounts, the
// General Ledger and the journal entries beneath it. A selection is a *choice of
// span*, not a stored balance: it resolves to an inclusive [startDate, endDate]
// plus the monthly periods that span overlaps, and every figure is then derived
// against that span.
//
// The six scopes mirror how an accountant names a span, from narrowest out:
//   month    - one monthly accounting period ("Aug FY2026")
//   quarter  - three consecutive monthly periods of one fiscal year
//   year     - a whole fiscal year
//   ytd      - the current fiscal year up to today
//   all      - every posting on record, unbounded at both ends
//   custom   - any two dates, for a span the calendar doesn't name
// =========================

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/* Written out, for a list that has already said which fiscal year it is showing.
   The abbreviations above are for the places a span is named in passing - a chip,
   a column, a sentence - where the whole name would be three words of furniture. */
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const monthDay = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
const spanText = (from: string, to: string) => `${monthDay(from)} - ${monthDay(to)}`

export type PeriodScope = 'month' | 'quarter' | 'year' | 'ytd' | 'all' | 'custom'

export type PeriodSelection =
  | { scope: 'month'; periodId: string }
  | { scope: 'quarter'; fiscalYear: number; quarter: QuarterId }
  | { scope: 'year'; fiscalYear: number }
  | { scope: 'ytd' }
  | { scope: 'all' }
  | { scope: 'custom'; from: string; to: string }

export interface ResolvedPeriod {
  selection: PeriodSelection
  scope: PeriodScope
  /** Names the span the way an accountant would: "Aug FY2026", "Q3 FY2026", "FY2026". */
  label: string
  /** The span in month-and-day form, e.g. "Aug 1 - Aug 31". Empty for `all`. */
  range: string
  /** Inclusive bounds. Both empty for `all`, which is unbounded on purpose. */
  startDate: string
  endDate: string
  /** Monthly periods the span overlaps, in date order. */
  periods: Period[]
  /** The one status every overlapped period shares, or null when they differ. */
  status: PeriodStatus | null
  /** "Open" / "Closed" / "Locked" / "Mixed" / "No period". Display copy. */
  statusLabel: string
  statusCounts: Record<PeriodStatus, number>
  /** True when the span covers today - the period actually being posted into.
   *  An Open period that isn't current (a prior month still open for late
   *  postings) is open, but it is not *the* active accounting period. */
  current: boolean
}

// The monthly periods a span touches. Overlap rather than containment, so a
// custom span that starts mid-month still names the period it starts in.
export function periodsInSpan(periods: Period[], startDate: string, endDate: string): Period[] {
  const ordered = [...periods].sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
  if (!startDate && !endDate) return ordered
  return ordered.filter(p => (!endDate || p.startDate <= endDate) && (!startDate || p.endDate >= startDate))
}

function describeStatus(ps: Period[]): Pick<ResolvedPeriod, 'status' | 'statusLabel' | 'statusCounts'> {
  const statusCounts: Record<PeriodStatus, number> = { 'Open': 0, 'Soft-Closed': 0, 'Hard-Locked': 0 }
  ps.forEach(p => { statusCounts[p.status]++ })
  const present = (Object.keys(statusCounts) as PeriodStatus[]).filter(s => statusCounts[s] > 0)
  if (present.length === 0) return { status: null, statusLabel: 'No period', statusCounts }
  if (present.length === 1) return { status: present[0], statusLabel: PERIOD_STATUS_LABEL[present[0]], statusCounts }
  // A span wider than one period routinely straddles a close, and claiming any
  // one of those statuses for the whole span would be wrong. The breakdown goes
  // in the badge's tooltip instead.
  return { status: null, statusLabel: 'Mixed', statusCounts }
}

function resolveSpan(
  selection: PeriodSelection,
  scope: PeriodScope,
  label: string,
  range: string,
  startDate: string,
  endDate: string,
  periods: Period[],
  today: string,
): ResolvedPeriod {
  const inSpan = periodsInSpan(periods, startDate, endDate)
  // "Covers today" only counts for a bounded span. An unbounded `all` reaches
  // today too, but "All dates" is not a period anyone posts into, so it is never
  // the active one.
  const current = (!!startDate || !!endDate) && isInSelection(today, { startDate, endDate })
  return { selection, scope, label, range, startDate, endDate, periods: inSpan, current, ...describeStatus(inSpan) }
}

// The fiscal year today falls in, which is what "current" means everywhere below.
export function currentFiscalYear(fiscalYearStart: string, today: string): number {
  return fiscalYearOf(today.slice(0, 10), fiscalYearStart)
}

// The fiscal year's first and last day, taken from its defined periods so a
// short or stub year resolves to what actually exists rather than to 12 months.
export function fiscalYearSpan(
  periods: Period[],
  fiscalYear: number,
  fiscalYearStart: string,
): { startDate: string; endDate: string } | null {
  const ps = periods
    .filter(p => fiscalYearOf(p.startDate, fiscalYearStart) === fiscalYear)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
  if (!ps.length) return null
  return { startDate: ps[0].startDate, endDate: ps[ps.length - 1].endDate }
}

// Turns a selection into the span every figure is read against. Falls back to
// `all` whenever the selection points at something that no longer exists (a
// deleted period, a fiscal year with no months), so a stale choice degrades to
// "everything" rather than to an empty table.
export function resolvePeriodSelection(
  selection: PeriodSelection,
  periods: Period[],
  fiscalYearStart: string,
  today: string,
  naming: FiscalYearNaming = 'start',
): ResolvedPeriod {
  const day = today.slice(0, 10)
  const all = () => resolveSpan({ scope: 'all' }, 'all', 'All dates', '', '', '', periods, day)
  const fyName = (fy: number) => fiscalYearName(fy, fiscalYearStart, naming)

  switch (selection.scope) {
    case 'month': {
      const p = periods.find(x => x.id === selection.periodId)
      if (!p) return all()
      const fy = fiscalYearOf(p.startDate, fiscalYearStart)
      const label = `${MONTHS[Number(p.startDate.slice(5, 7)) - 1]} ${fyName(fy)}`
      return resolveSpan(selection, 'month', label, spanText(p.startDate, p.endDate), p.startDate, p.endDate, periods, day)
    }
    case 'quarter': {
      const span = quarterDateRange(periods, selection.fiscalYear, selection.quarter, fiscalYearStart)
      if (!span) return all()
      const label = `${selection.quarter} ${fyName(selection.fiscalYear)}`
      return resolveSpan(selection, 'quarter', label, spanText(span.startDate, span.endDate), span.startDate, span.endDate, periods, day)
    }
    case 'year': {
      const span = fiscalYearSpan(periods, selection.fiscalYear, fiscalYearStart)
      if (!span) return all()
      return resolveSpan(selection, 'year', fyName(selection.fiscalYear), spanText(span.startDate, span.endDate), span.startDate, span.endDate, periods, day)
    }
    case 'ytd': {
      const fy = currentFiscalYear(fiscalYearStart, day)
      const span = fiscalYearSpan(periods, fy, fiscalYearStart)
      if (!span) return all()
      // Stops at today even when the fiscal year runs on, which is the whole
      // point of a year-to-date reading.
      const end = day < span.endDate ? day : span.endDate
      return resolveSpan(selection, 'ytd', `${fyName(fy)} to date`, spanText(span.startDate, end), span.startDate, end, periods, day)
    }
    case 'all':
      return all()
    case 'custom': {
      const { from, to } = selection
      if (!from || !to || from > to) return all()
      return resolveSpan(selection, 'custom', 'Custom', spanText(from, to), from, to, periods, day)
    }
  }
}

// The selection a surface lands on before the reader touches anything: the
// accounting period today falls in, which is the period being posted into. Falls
// back to the current fiscal year when no period covers today, so a chart whose
// periods have run out still opens on something real rather than on nothing.
export function defaultPeriodSelection(periods: Period[], fiscalYearStart: string, today: string): PeriodSelection {
  const day = today.slice(0, 10)
  const current = periods.find(p => p.startDate <= day && day <= p.endDate)
  return current
    ? { scope: 'month', periodId: current.id }
    : { scope: 'year', fiscalYear: currentFiscalYear(fiscalYearStart, day) }
}

export function isInSelection(iso: string, resolved: Pick<ResolvedPeriod, 'startDate' | 'endDate'>): boolean {
  const day = iso.slice(0, 10)
  if (resolved.startDate && day < resolved.startDate) return false
  if (resolved.endDate && day > resolved.endDate) return false
  return true
}

// True when the span reaches every posting in the ledger, so figures can be read
// straight off the chart with no rewinding.
export function selectionCoversAll(resolved: Pick<ResolvedPeriod, 'startDate' | 'endDate'>, transactions: Transaction[]): boolean {
  if (!resolved.startDate && !resolved.endDate) return true
  return transactions.every(t => isInSelection(t.date, resolved))
}

export interface PeriodChoice {
  key: string
  selection: PeriodSelection
  /** Names the span outright - "March FY2026" - for anywhere it stands alone. */
  label: string
  /** The span's own name, without the fiscal year: "March", "Q3", "FY2026". For a
   *  list already filtered to one fiscal year, where repeating it on every row
   *  says nothing the list has not said once above. */
  shortLabel: string
  /** The fiscal year the span falls in, so a list can be filtered to one. */
  fiscalYear: number
  range: string
  status: PeriodStatus | null
  statusLabel: string
  /** True for the month/quarter/year that today sits in. */
  current: boolean
}

/* The concrete spans the picker offers under each of the three absolute scopes,
   in fiscal order. Built from the defined periods rather than from a calendar, so
   the list can never offer a period the ledger has no room for.

   Spans that have not begun are left out. The calendar declares the whole fiscal
   year ahead of time so the close flow and the posting rules have months to work
   with, but nothing has happened in a month that has not started, and offering it
   here is offering the reader a view of an empty ledger they have to work out for
   themselves. The period covering today always survives the cut - it has begun,
   it is simply not over. */
export function buildPeriodChoices(
  periods: Period[],
  fiscalYearStart: string,
  today: string,
  naming: FiscalYearNaming = 'start',
): Record<'month' | 'quarter' | 'year', PeriodChoice[]> {
  const day = today.slice(0, 10)
  const toChoice = (selection: PeriodSelection, fiscalYear: number, shortLabel: string, current: boolean): PeriodChoice => {
    const r = resolvePeriodSelection(selection, periods, fiscalYearStart, day, naming)
    return {
      key: choiceKey(selection), selection, label: r.label, shortLabel, fiscalYear,
      range: r.range, status: r.status, statusLabel: r.statusLabel, current,
    }
  }
  const fiscalYears = [...new Set(periods.map(p => fiscalYearOf(p.startDate, fiscalYearStart)))].sort((a, b) => a - b)
  const ordered = [...periods].sort((a, b) => (a.startDate < b.startDate ? -1 : 1))

  const begun = (span: { startDate: string } | null | undefined) => !!span && span.startDate <= day

  return {
    month: ordered
      .filter(begun)
      .map(p => toChoice(
        { scope: 'month', periodId: p.id },
        fiscalYearOf(p.startDate, fiscalYearStart),
        MONTH_NAMES[Number(p.startDate.slice(5, 7)) - 1],
        day >= p.startDate && day <= p.endDate)),
    quarter: fiscalYears.flatMap(fy => QUARTERS
      .filter(q => periodsForQuarter(periods, fy, q, fiscalYearStart).length > 0)
      .map(q => ({ q, span: quarterDateRange(periods, fy, q, fiscalYearStart) }))
      .filter(({ span }) => begun(span))
      .map(({ q, span }) => toChoice(
        { scope: 'quarter', fiscalYear: fy, quarter: q }, fy, q,
        !!span && day >= span.startDate && day <= span.endDate))),
    year: fiscalYears
      .map(fy => ({ fy, span: fiscalYearSpan(periods, fy, fiscalYearStart) }))
      .filter(({ span }) => begun(span))
      // A fiscal year is its own name, so there is nothing to take off it.
      .map(({ fy, span }) => toChoice(
        { scope: 'year', fiscalYear: fy }, fy, fiscalYearName(fy, fiscalYearStart, naming),
        !!span && day >= span.startDate && day <= span.endDate)),
  }
}

// Identity of a selection, for list keys and for marking the selected row.
export function choiceKey(selection: PeriodSelection): string {
  switch (selection.scope) {
    case 'month': return `month:${selection.periodId}`
    case 'quarter': return `quarter:${selection.fiscalYear}:${selection.quarter}`
    case 'year': return `year:${selection.fiscalYear}`
    case 'ytd': return 'ytd'
    case 'all': return 'all'
    case 'custom': return `custom:${selection.from}:${selection.to}`
  }
}

export interface AccountPeriodFigures {
  /** Closing balance at the end of the span, normal-side signed. */
  balance: number
  /** Normal-side net movement inside the span. */
  netChange: number
}

// A posting account's figures for a span.
//
// Rewinds rather than re-derives: `Account.balance` is the authored balance after
// the last posting in the ledger, so subtracting the normal-side movement of the
// postings dated *after* the span gives the closing balance at the span's end.
// That keeps a span covering the whole ledger printing exactly the figures the
// chart was authored with, instead of silently restating every number in the
// module the moment a period selector appears.
export function accountFiguresFor(
  account: Account,
  transactions: Transaction[],
  resolved: Pick<ResolvedPeriod, 'startDate' | 'endDate'>,
): AccountPeriodFigures {
  let after = 0
  let inside = 0
  for (const t of transactions) {
    if (t.accountId !== account.id) continue
    const day = t.date.slice(0, 10)
    if (resolved.endDate && day > resolved.endDate) { after += normalSideDelta(account, t); continue }
    if (resolved.startDate && day < resolved.startDate) continue
    inside += normalSideDelta(account, t)
  }
  return { balance: account.balance - after, netChange: inside }
}

// The same rewind applied across a chart. Only posting accounts hold figures of
// their own, so they are the only rows there is anything to rewind; a summary
// row's amount is the sum of these (already scoped) postings, taken at render.
// Current Year Earnings is then worked out from the rewound revenue and expense
// accounts, so it reads the same period as every row around it.
export function scopeAccountsToPeriod(
  accounts: Account[],
  transactions: Transaction[],
  resolved: Pick<ResolvedPeriod, 'startDate' | 'endDate'>,
): Account[] {
  const byAccount = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const list = byAccount.get(t.accountId)
    if (list) list.push(t)
    else byAccount.set(t.accountId, [t])
  }
  /* The balances as they stand today, which the running balance reads whatever
     the period. Mahad, 2026-10-11: *"Running balance always shows the current
     balance. Does not change with the period filter."* */
  const today = withEarningsFigures(accounts)
  const scoped = withEarningsFigures(accounts.map(a => {
    if (a.glAccountType !== 'Posting') return a
    const own = byAccount.get(a.id) ?? []
    const figures = accountFiguresFor(a, own, resolved)
    // What was typed in the account's own currency, up to the span's end, and
    // up to today.
    const correction = typedCorrection(a, own, resolved.endDate || undefined)
    const currentCorrection = resolved.endDate ? typedCorrection(a, own) : correction
    if (figures.balance === a.balance && figures.netChange === (a.netChange ?? 0) && !correction && !currentCorrection) return a
    return {
      ...a, ...figures,
      ...(correction ? { typedCorrection: correction } : {}),
      ...(currentCorrection !== correction ? { currentTypedCorrection: currentCorrection } : {}),
    }
  }))
  return scoped.map((a, i) => (today[i].balance !== a.balance ? { ...a, currentBalance: today[i].balance } : a))
}

// A period-scoped chart and its tree, in the one order that is correct: rewind
// the posting leaves first, then index, so every summary sums figures that have
// already been scoped. Indexing first and scoping after would leave summary
// amounts reading the whole ledger while their children read the period.
export function scopeChartToPeriod(
  accounts: Account[],
  transactions: Transaction[],
  resolved: Pick<ResolvedPeriod, 'startDate' | 'endDate'>,
): { accounts: Account[]; index: ChartIndex } {
  const scoped = scopeAccountsToPeriod(accounts, transactions, resolved)
  return { accounts: scoped, index: buildChartIndex(scoped) }
}
