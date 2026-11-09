import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, Lock, ArrowRight, Info } from 'lucide-react'
import { Card, Select, Tooltip } from './ui'
import { cn, todayIso } from '../lib/utils'
import { anyPeriodHasPostings, buildPeriodsFromFirstYear, fiscalYearName } from '../lib/periodClose'
import type { FiscalYearNaming } from '../types'
import { useStore } from '../store'

// Fiscal-year section for the first-time view. Three separate questions: the
// start month, which sets the repeating shape of every fiscal year; the first year
// of books, which says how far back periods are built; and, only when the year
// spans two calendar years, which of them names it. Books are always kept monthly,
// so the cadence is not a choice - twelve monthly periods, always. Everything else
// - the end date and the period chips - is derived, never entered. The answers are
// written back together, and the periods they imply are built with them, because a
// transaction can only post into a period that exists.
//
// The name matters beyond this screen: period labels, report titles and every
// period dropdown print it, so the screen commits to one rather than showing both
// calendar years and leaving the reader to guess which one their filings use.
//
// Layout borrows the Partners "config + live preview" split: inputs on the left,
// a derived read-only preview panel on the right (hero value + inset chips).
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad2 = (n: number) => String(n).padStart(2, '0')

// How far back the first year of books can reach, which is how much history a
// migration can carry. Nothing ahead of this year: the first year of books is
// where history starts, and history does not start in a year yet to begin.
const YEARS_BACK = 25

// Newest first, so the list opens on the answer nearly everyone keeps instead of
// on the twenty-five-year-old floor of the window. A year already saved is always
// offered, even once it ages out of the window, so an old setting is never
// silently replaced by a nearer year.
export function fiscalYearOptions(thisYear: number, selected?: number): number[] {
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, i) => thisYear - i)
  if (selected !== undefined && !years.includes(selected)) years.push(selected)
  return years.sort((a, b) => b - a)
}

const fmtLong = (y: number, mIdx: number, d: number) => `${MONTHS_SHORT[mIdx]} ${d}, ${y}`
const isoOf = (startMonth: number, fiscalYear: number) => `${fiscalYear}-${pad2(startMonth + 1)}-01`

// The four things a reader can hover for. Each one defines its term, says what it
// costs to get wrong, and names what freezes later, so the fields themselves can
// ask their question with nothing written underneath. Exported so a test can pin
// the wording.
export const FISCAL_TIPS = {
  fiscalYear: 'The 12-month cycle Omne uses to group transactions and run reports.',
  startMonth: 'The month your fiscal year starts. For example, April gives you a year that runs from April to March. You can change it until your first transaction posts to the General Ledger.',
  firstYear: "The year you'll start recording transactions in. If you're importing older transactions, pick the year they start in, or add earlier years later.",
  naming: 'How Omne names each fiscal year. Some companies name it by the year it starts, others by the year it ends. This only matters when your year spans two calendar years.',
}

// The whole list, for the reader who wants to know what else is at stake before
// touching any of it. One line per setting, each carrying the reason it cannot
// move afterwards - a lock with no reason reads as an arbitrary restriction.
export const FISCAL_LOCKED_SETTINGS = [
  'Fiscal year start month, because moving it would reshape every period.',
  'Fiscal year naming, because reports have already been read under the current name.',
  'First fiscal year, because the periods it built already hold postings.',
]
export const FISCAL_LOCK_EXCEPTION = 'Adding earlier years stays open, and is the one change to your fiscal calendar you can still make.'

// Every explainer here runs to several sentences, past the plain tooltip's width,
// so all five use the same card. Fixed width rather than intrinsic: five tooltips
// of five different widths on one screen read as five different kinds of thing.
const tipCard = (text: string) => (
  <div className="w-[300px] px-3.5 py-3 text-xs text-fg-muted leading-relaxed">{text}</div>
)

// The one trigger, matching the house label-adjacent info icon. Select renders
// exactly this markup for its own `info` prop, so the two section headings build
// it by hand rather than picking a second icon or a second size.
function InfoTip({ label, align = 'left', size = 12, className, children }: {
  label: string
  align?: 'left' | 'right'
  // Only the banner's own icon overrides these: it is a 16px icon already tinted
  // to its tone, and shrinking or greying it would read as a second control.
  size?: number
  className?: string
  children: ReactNode
}) {
  return (
    <Tooltip rich content={children} side="top" align={align}>
      <span className={cn('inline-flex shrink-0 cursor-help', className ?? 'text-fg-subtle/60 hover:text-fg-subtle')} aria-label={label}>
        <Info size={size} />
      </span>
    </Tooltip>
  )
}

// The full list of what freezes, on the trigger the setup banner already shows.
// Lives here rather than at the call site so the three lines and the per-field
// cue cannot drift apart.
export function FiscalYearLockInfo({ size, className }: { size?: number; className?: string }) {
  return (
    <InfoTip label="What locks after your first posted transaction" size={size} className={className}>
      <div className="w-[320px] px-3.5 py-3 space-y-2">
        <p className="text-xs text-fg-muted leading-relaxed">Once any transaction posts, three settings freeze:</p>
        <ul className="space-y-1.5">
          {FISCAL_LOCKED_SETTINGS.map(line => (
            <li key={line} className="flex gap-1.5 text-xs text-fg-muted leading-relaxed">
              <Lock size={11} className="mt-[3px] shrink-0 text-fg-subtle" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-fg-subtle leading-relaxed pt-0.5">{FISCAL_LOCK_EXCEPTION}</p>
      </div>
    </InfoTip>
  )
}

export function FiscalYearPicker({
  value, onChange, preview,
}: {
  value?: string | null
  onChange?: (iso: string) => void
  preview?: boolean
}) {
  const setStoreFiscalYear = useStore(s => s.setFiscalYear)
  // Editable until a period holds a posting. After that its dates cannot move
  // without shifting recorded history, so the whole shape freezes.
  const periods = useStore(s => s.periods)
  const transactions = useStore(s => s.transactions)
  const savedNaming = useStore(s => s.company.fiscalYearNaming)
  const locked = anyPeriodHasPostings(periods, transactions)

  const init = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  const thisYear = new Date().getFullYear()
  const [startMonth, setStartMonth] = useState(init ? Number(init[2]) - 1 : 0)
  const [fiscalYear, setFiscalYear] = useState(init ? Number(init[1]) : thisYear)
  const [naming, setNaming] = useState<FiscalYearNaming>(savedNaming ?? 'start')

  // Push the chosen start date up to the parent and, unless this is a throwaway
  // preview, into company settings along with the periods it implies.
  const commit = (sm: number, fy: number, nm: FiscalYearNaming) => {
    const iso = isoOf(sm, fy)
    onChange?.(iso)
    if (!preview) setStoreFiscalYear(iso, nm)
  }
  // Seed the default (January, current year) on mount so the value is committed
  // and the parent's Continue gate opens without forcing interaction.
  useEffect(() => { commit(startMonth, fiscalYear, naming) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onMonth = (v: number) => { setStartMonth(v); commit(v, fiscalYear, naming) }
  const onYear = (v: number) => { setFiscalYear(v); commit(startMonth, v, naming) }
  const onNaming = (v: FiscalYearNaming) => { setNaming(v); commit(startMonth, fiscalYear, v) }

  // Derived end date: one year after the start, minus a day.
  const end = new Date(fiscalYear + 1, startMonth, 1)
  end.setDate(end.getDate() - 1)
  // A year that begins in January ends in December, so both naming conventions
  // agree and the question is not worth asking. Any other start month splits the
  // year across two calendar years, which is the only case where the name is a
  // choice - so that is exactly when the field appears.
  const spansTwoYears = startMonth !== 0

  // Derived period chips - the twelve months of the year, rolling across the
  // calendar boundary when the start isn't January. Grouped in threes under
  // Q1-Q4, which is the same slicing the close engine uses, so a reader who
  // thinks in quarters can find them without the chart keeping quarterly books.
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = startMonth + i
    return { key: i, main: MONTHS_SHORT[m % 12], sub: String(fiscalYear + Math.floor(m / 12)) }
  })
  const quarters = Array.from({ length: 4 }, (_, q) => ({ id: `Q${q + 1}`, months: months.slice(q * 3, q * 3 + 3) }))

  // Reaching back builds a year for every year since, so the count has to come
  // from the same builder the store uses, or the screen would promise twelve
  // periods and the ledger would hold thirty-six. The chips below show one year;
  // the total is stated separately rather than folded into the same figure.
  const iso = isoOf(startMonth, fiscalYear)
  const built = buildPeriodsFromFirstYear(iso, todayIso())
  const yearsBuilt = built.length / 12
  const fyName = fiscalYearName(fiscalYear, iso, naming)
  const lastFyName = fiscalYearName(fiscalYear + yearsBuilt - 1, iso, naming)

  const yearOptions = fiscalYearOptions(thisYear, fiscalYear)

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ── Left: inputs the user sets ── */}
        <div className="p-5 md:p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))' }}>
              <CalendarDays size={17} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-fg leading-tight flex items-center gap-1.5">
                Fiscal year
                <InfoTip label="What a fiscal year is">{tipCard(FISCAL_TIPS.fiscalYear)}</InfoTip>
              </h3>
              <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">
                It drives every report and period close.
              </p>
              {preview && <p className="text-2xs text-warning-700 mt-1.5">Preview only; changes won't be saved.</p>}
            </div>
          </div>

          {locked && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-fg-muted">
              <Lock size={13} className="text-fg-subtle shrink-0" />
              Transactions have posted into your periods, so your fiscal year settings are locked.
            </div>
          )}

          {/* The fields ask their question and nothing more. Every definition, the
              consequence of each answer and the fact that these settings freeze
              live on the one info trigger per question, and the preview beside
              them already shows the answer taking effect. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <Select
              label="Fiscal year start month"
              info={tipCard(FISCAL_TIPS.startMonth)}
              infoRich
              value={String(startMonth)}
              onChange={(e) => onMonth(Number(e.target.value))}
              disabled={locked}
            >
              {MONTHS.map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
            </Select>
            <Select
              /* "First fiscal year" (Mahad, 2026-10-08), after a day as "First
                 year of books"; its tooltip says how far back the books go. */
              label="First fiscal year"
              info={tipCard(FISCAL_TIPS.firstYear)}
              infoRich
              value={String(fiscalYear)}
              onChange={(e) => onYear(Number(e.target.value))}
              disabled={locked}
            >
              {yearOptions.map(y => <option key={y} value={String(y)}>{y}</option>)}
            </Select>
            {/* Asked only when there are two calendar years to choose between,
                which is also how the reader learns their year spans two of them. */}
            {/* On one line: the label is longer than its half of the row, and
                the half beside it is empty, so it runs into that rather than
                wrapping and pushing its field below its neighbour's. */}
            {spansTwoYears && (
              <div className="[&>div>label]:whitespace-nowrap">
              <Select
                label="Fiscal year naming convention"
                info={tipCard(FISCAL_TIPS.naming)}
                infoRich
                value={naming}
                onChange={(e) => onNaming(e.target.value as FiscalYearNaming)}
                disabled={locked}
              >
                <option value="start">Start year</option>
                <option value="end">End year</option>
              </Select>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: live preview (read-only) ── */}
        <div className="border-t lg:border-t-0 lg:border-l border-border bg-bg-subtle/40 p-5 md:p-6 space-y-4">
          {/* No tooltip on the heading (Mahad, 2026-10-08). */}
          <span className="block text-2xs uppercase tracking-wide text-fg-subtle font-semibold">Live preview</span>

          {/* Full date range - the hero of the preview */}
          <div className="rounded-lg border border-border bg-white px-3.5 py-3">
            <p className="text-2xs uppercase tracking-wide text-fg-subtle mb-1.5">Fiscal year runs</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-fg tabular-nums">{fmtLong(fiscalYear, startMonth, 1)}</span>
              <ArrowRight size={13} className="text-fg-subtle shrink-0" />
              <span className="text-sm font-semibold text-fg tabular-nums">{fmtLong(end.getFullYear(), end.getMonth(), end.getDate())}</span>
            </div>
          </div>

          {/* Hero name and count - mirrors the Partners "N days" stat. The name is
              the one this year will carry everywhere, which is the whole reason the
              naming question is asked. */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-semibold text-fg tabular-nums leading-none tracking-tight">{fyName}</span>
            <span className="text-11 text-fg-subtle font-medium">· 12 monthly periods</span>
          </div>

          {/* The chips below are one year. Reaching back builds every year since,
              so the total is stated here rather than swapped into the count above,
              where it would contradict the twelve chips. */}
          {yearsBuilt > 1 && (
            <p className="text-11 text-fg-subtle leading-relaxed">
              {fyName} through {lastFyName} are all built, {built.length} monthly periods in total.
            </p>
          )}

          {/* Period chips - auto-generated inset pills, three to a quarter */}
          {/* Two quarters to a row only where three months fit in half of one;
              below that a month's name ran past its pill into the next. */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-1.5">
            {quarters.map(q => (
              <div key={q.id} className="rounded-lg border border-border/60 px-1.5 py-1.5">
                <p className="text-2xs uppercase tracking-wide text-fg-subtle font-semibold mb-1 px-0.5">{q.id}</p>
                {/* Three equal columns rather than a wrapping row: a quarter is
                    always three months, and wrapping printed the third one on a
                    line of its own, which reads as a quarter of two. */}
                <div className="grid grid-cols-3 gap-1">
                  {q.months.map(p => (
                    /* Flat grey, no white fill or border: they are what the year
                       will hold, not buttons (Mahad, 2026-10-08: *"These look like
                       they are clickable"*). */
                    <span key={p.key} className="inline-flex min-w-0 items-center justify-center gap-0.5 rounded-md bg-slate-100 px-1 py-1 text-11 tabular-nums">
                      <span className="font-semibold text-fg-muted">{p.main}</span>
                      <span className="text-fg-subtle">{p.sub}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
