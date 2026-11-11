// A date range as a pill on a table's quick-filter row, opening onto From and To
// date fields: CoA's ledger Amount pill (GeneralLedger AmountRangeControl) with
// dates where it has amounts. Same trigger (icon, label, chevron; the range once
// set), same panel (a title, a line on what it matches, the two fields) and the
// same Clear / Done footer. Applies as the dates are picked, as the Amount pill
// does; Done only closes it.
import { CalendarDays, ChevronDown } from 'lucide-react'
import { Button, Menu } from './ui'
import { DateRangeFromTo } from './Filters'
import { cn, fmtDate } from '../lib/utils'

export function DateRangePill({ label, description, from, to, onChange }: {
  /** The pill and panel title, in Title Case: "Effective Date". */
  label: string
  /** One sentence on what the range matches. */
  description: string
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const active = from !== '' || to !== ''
  const text = !active ? label
    : from && to ? `${fmtDate(from)} – ${fmtDate(to)}`
      : from ? `From ${fmtDate(from)}` : `Until ${fmtDate(to)}`
  return (
    <Menu align="left" flush trigger={open => (
      <button
        type="button"
        aria-label={active ? `${label}: ${text}` : label}
        className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums',
          active || open
            ? 'border-primary bg-accent hover:bg-[#DBEAFE] active:bg-[#BFDBFE]'
            : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted')}
        style={{ fontWeight: active || open ? 500 : 400, color: active || open ? 'hsl(var(--primary))' : undefined }}
      >
        <CalendarDays size={14} className={active || open ? 'text-primary' : undefined} />
        {text}
        <ChevronDown size={12} className={cn('shrink-0 opacity-60 transition-transform duration-150', open && 'rotate-180')} />
      </button>
    )}>
      {close => (
        <div className="w-[340px] p-3.5 space-y-3">
          <div>
            <p className="text-[13px] text-fg" style={{ fontWeight: 600 }}>{label}</p>
            <p className="text-2xs text-fg-muted leading-relaxed mt-0.5">{description}</p>
          </div>
          <DateRangeFromTo from={from} to={to} onFromChange={v => onChange(v, to)} onToChange={v => onChange(from, v)} />
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
