import { useState } from 'react'
import { CalendarDays, X, Lock, History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Banner, Button, Card, Select } from '../components/ui'
import {
  FISCAL_LOCKED_SETTINGS,
  FiscalYearPicker,
  fiscalYearOptions,
} from '../components/FiscalYearPicker'
import { anyPeriodHasPostings, fiscalYearName } from '../lib/periodClose'
import { useStore } from '../store'

// Where the fiscal year lives once setup is over. The first-time screen promises
// two things about it - that the shape freezes, and that the books can still be
// reached further back - and this is the screen where the second one is done.
//
// The picker itself is the same component the setup screen uses rather than a
// read-only copy of it: a company that has not posted yet can still change its
// mind here, and one that has sees exactly the locked state setup warned about.

// The three rules that make reaching back safe rather than a second, conflicting
// fiscal calendar. Exported so a test can pin them.
export const EARLIER_YEARS_RULES = [
  {
    title: 'Same start month',
    body: 'Earlier years take the shape your fiscal year already has, so every year in your books starts and ends on the same days of the calendar.',
  },
  {
    title: 'Same naming',
    body: 'They are named by the convention already saved, so FY labels read the same way back through your history as they do this year.',
  },
  {
    title: 'Where opening balances go',
    body: 'The first month of the earliest year is the period a migrated opening balance is posted into, which is the reason to reach back at all.',
  },
]

export const EARLIER_YEARS_LEDE = 'Reaching back builds every month between the year you pick and the books you already have. Nothing already posted moves, and closed periods stay closed.'

export default function FiscalYearSettingsPage() {
  const navigate = useNavigate()
  const company = useStore(s => s.company)
  const periods = useStore(s => s.periods)
  const transactions = useStore(s => s.transactions)
  const addEarlierYears = useStore(s => s.addEarlierYears)
  const pushToast = useStore(s => s.pushToast)

  const fyStart = company.fiscalYearStart
  const firstYear = Number(fyStart.slice(0, 4))
  const locked = anyPeriodHasPostings(periods, transactions)
  const thisYear = new Date().getFullYear()

  // Only years before the ones already built. A year inside the books is not a
  // reach back, it is the current setting, and offering it would suggest the
  // first year can be moved forward - which would strand posted periods.
  const earlierOptions = fiscalYearOptions(thisYear, firstYear).filter(y => y < firstYear)
  const [pick, setPick] = useState<string>('')
  const picked = pick ? Number(pick) : null
  const monthsAdded = picked === null ? 0 : (firstYear - picked) * 12

  const add = () => {
    if (picked === null) return
    addEarlierYears(picked)
    setPick('')
    pushToast(
      `Books now reach back to ${fiscalYearName(picked, fyStart, company.fiscalYearNaming)}`,
      'success',
      `${monthsAdded} monthly periods added. Nothing already posted moved.`,
    )
  }

  return (
    <div className="pb-12">
      <PageHeader
        icon={<CalendarDays size={18} />}
        title="Fiscal year"
        subtitle="The 12-month cycle your reports and period closes are built on, and how far back your books reach."
        secondaryActions={<Button variant="ghost" icon={<X size={14} />} onClick={() => navigate('/chart-of-accounts')}>Exit</Button>}
      />

      <div className="px-6 space-y-5">
        {/* Keyed on the saved date so adding earlier years below re-seeds the
            picker's own fields, rather than leaving it showing the first year the
            books used to begin in. */}
        <FiscalYearPicker key={fyStart} value={fyStart} />

        {/* What the setup banner promised, done here. Its own card rather than a
            fourth field in the picker above: the picker asks what shape a year
            has, and this asks how many of them there are. */}
        <Card className="p-5 md:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--primary))' }}>
              <History size={17} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-fg leading-tight">Add earlier years</h3>
              <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">{EARLIER_YEARS_LEDE}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-bg-subtle/40 px-3.5 py-2.5 text-xs text-fg-muted">
            Your books begin in{' '}
            <span className="text-fg tabular-nums" style={{ fontWeight: 600 }}>
              {fiscalYearName(firstYear, fyStart, company.fiscalYearNaming)}
            </span>
            {', '}{periods.length} monthly periods in total.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {EARLIER_YEARS_RULES.map(r => (
              <div key={r.title}>
                <p className="text-2xs uppercase tracking-wide text-fg-subtle font-semibold">{r.title}</p>
                <p className="text-xs text-fg-muted mt-1 leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>

          {earlierOptions.length === 0 ? (
            <Banner tone="info">
              Your books already reach as far back as Omne keeps them, so there is no earlier year to add.
            </Banner>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[200px]">
                <Select
                  label="Reach back to"
                  placeholder="Pick a year"
                  searchable={earlierOptions.length > 6}
                  hint={picked === null
                    ? undefined
                    : `Builds ${monthsAdded} monthly periods, up to where your books begin today.`}
                  value={pick}
                  onChange={e => setPick(e.target.value)}
                >
                  {earlierOptions.map(y => <option key={y} value={String(y)}>{y}</option>)}
                </Select>
              </div>
              <Button disabled={picked === null} onClick={add}>Add years</Button>
            </div>
          )}
        </Card>

        {/* Said here as well as under each field, because a reader who arrives
            after the lock has bitten never saw the setup banner that warned. */}
        <Card className="p-5 md:p-6">
          <div className="flex items-start gap-2.5">
            <Lock size={14} className="text-fg-subtle shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-fg leading-tight">
                {locked ? 'These settings are locked' : 'What locks after your first posted transaction'}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {FISCAL_LOCKED_SETTINGS.map(line => (
                  <li key={line} className="text-xs text-fg-muted leading-relaxed flex gap-2">
                    <span className="text-fg-subtle">·</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-fg-subtle mt-2.5 leading-relaxed">
                Adding earlier years is not one of them, which is why it stays on this screen.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
