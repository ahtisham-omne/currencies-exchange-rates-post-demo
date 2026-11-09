import type { ReactNode } from 'react'
import { Input, Toggle } from './ui'
import { cn } from '../lib/utils'
import type { Account } from '../types'
import { formatRange, parseRangeInputs, type BlockOffer, type Holder, type NumberRange, type RangeProblem } from '../lib/numberRange'

/* The account a refusal is about, drawn as a gray pill. Nophil, 2026-09-24,
   reading "1000 Assets reserves...": *"I want 1000 assets to be in a pill. In
   like a gray pill."* A name run into the sentence read as part of the sentence;
   in a pill it reads as the thing standing in the way, which is what the reader
   has to go and look at. */
export function AccountPill({ account }: { account: Holder }) {
  return (
    <span
      className="inline-flex items-center gap-1 align-baseline rounded-md border border-slate-200 bg-slate-100 px-1.5 py-px text-[11px] leading-4 text-slate-700 whitespace-nowrap"
      style={{ fontWeight: 600 }}
    >
      <span className="tabular-nums">{account.accountNumber}</span>
      <span style={{ fontWeight: 500 }}>{account.accountName}</span>
    </span>
  )
}

/** A range refusal, with the accounts it names drawn as pills. */
export function RangeMessage({ problem }: { problem: RangeProblem }) {
  const parts = problem.text.split(/(\{holder\}|\{other\})/)
  return (
    <>
      {parts.map((part, i) =>
        part === '{holder}' && problem.holder ? <AccountPill key={i} account={problem.holder} />
          : part === '{other}' && problem.other ? <AccountPill key={i} account={problem.other} />
            : <span key={i}>{part}</span>)}
    </>
  )
}

/* The block of numbers a Summary reserves.

   Reserving is a switch, on by default - Eli, 2026-09-24: *"It should be a
   toggle it on and then show this to you ... the default structure should be
   with the toggle on, with the preset next available reserve in there
   pre-done."* Off, the fields go, nothing is pre-filled, and the summary takes
   whatever number the reader types. On, the fields hold the recommended block
   until the reader changes them.

   Under the fields, the blocks the parent has left - clean blocks one zero
   smaller than the parent's own, never the leftover tail of it (*"you just
   took the last 500 numbers in this block"*). The next one is marked
   Recommended. Blocks outside the parent are offered only when the parent has
   none left (Mahreen, 2026-09-24).

   Every pill is a button and fills both fields. `onChange` says which way a
   value arrived: typed into a field, or picked from a pill. Only a typed range
   is the reader's own - Mahad, 2026-09-30: *"Unless you manually type and define
   the range in the input ... only then should that value stay"* - so a picked
   one is re-offered from the new parent when the parent changes, where a typed
   one is kept. The fields stay editable
   through every conflict, because a conflict is information the reader needs
   while typing; Save is what enforces it.

   History: this was a proportional bar until 2026-09-24, which Mahad rejected
   (*"removing this weird bar is a must"*), and listed the taken blocks beside
   the free ones until he asked for only the available ones. Neither comes back. */
export function NumberRangeCard({ reserving, onReservingChange, startValue, endValue, onChange, parent, offer, error }: {
  reserving: boolean
  onReservingChange: (on: boolean) => void
  startValue: string
  endValue: string
  onChange: (start: string, end: string, how: 'typed' | 'picked') => void
  parent: Account | null
  offer: BlockOffer
  error: ReactNode | null
}) {
  const typed = parseRangeInputs(startValue, endValue)
  const proposed = typed.kind === 'range' ? typed.range : null
  const same = (r: NumberRange) => !!proposed && r.start === proposed.start && r.end === proposed.end
  const parentName = parent ? `${parent.accountNumber} ${parent.accountName}` : ''

  const pill = (r: NumberRange, recommended = false) => {
    const held = same(r)
    return (
      <button
        key={`${r.start}-${r.end}`}
        type="button"
        onClick={() => onChange(String(r.start), String(r.end), 'picked')}
        aria-pressed={held}
        className={cn(
          'chip tabular-nums border transition-colors inline-flex items-center gap-1.5',
          held
            ? 'bg-brand-600 text-white border-brand-600'
            : 'bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100 hover:border-brand-200',
        )}
        style={{ fontWeight: 600 }}
      >
        {formatRange(r)}
        {recommended && (
          <span className={cn('rounded px-1 text-[9px] uppercase tracking-[0.5px]', held ? 'bg-white/20 text-white' : 'bg-white text-brand-700')}>
            Recommended
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-white px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] text-fg" style={{ fontWeight: 600 }}>Reserve a number range</div>
          <p className="text-2xs text-slate-400 leading-relaxed mt-0.5">
            {reserving
              ? 'Sets aside a block of numbers for the accounts you add under this summary. No other account can use them.'
              : 'No numbers are set aside. Type this summary\'s number below.'}
          </p>
        </div>
        <Toggle checked={reserving} onChange={onReservingChange} inline />
      </div>

      {reserving && (
        <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mt-3">
            <Input
              value={startValue}
              onChange={e => onChange(e.target.value, endValue, 'typed')}
              placeholder={offer.recommended ? String(offer.recommended.start) : 'e.g. 11600'}
              inputMode="numeric"
              aria-label="Range start"
            />
            <span className="text-slate-400 text-sm">to</span>
            <Input
              value={endValue}
              onChange={e => onChange(startValue, e.target.value, 'typed')}
              placeholder={offer.recommended ? String(offer.recommended.end) : 'e.g. 11699'}
              inputMode="numeric"
              aria-label="Range end"
            />
          </div>
          {error && (
            <p data-field-error className="text-2xs text-danger-600 mt-2 leading-relaxed">{error}</p>
          )}

          {/* Only once there is a parent to divide. A summary with no parent is a
              category, and its block is the whole of its first digit. */}
          {parent && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[1px] text-fg-muted mb-1" style={{ fontWeight: 600 }}>
                Available ranges under {parent.accountNumber}
              </div>
              {/* The pills alone, the recommended one marked on itself. The line
                  under them spelling out the recommendation and the one-zero-
                  smaller rule went, Mahad, 2026-09-30: *"Can we remove this copy
                  under available ranges?"* */}
              {offer.inParent.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {offer.inParent.map(r => pill(r, !!offer.recommended && r.start === offer.recommended.start))}
                </div>
              ) : (
                <p className="text-2xs text-slate-400">
                  {offer.blockSize
                    ? `There's no free block of ${offer.blockSize.toLocaleString()} left under ${parentName}. You can type a range instead.`
                    : `${parentName}'s range is too small to split into blocks. You can type a range instead.`}
                </p>
              )}

              {offer.outside.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-[1px] text-fg-muted mb-1" style={{ fontWeight: 600 }}>
                    Next free ranges elsewhere
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {offer.outside.map(r => pill(r))}
                  </div>
                  <p className="text-2xs text-slate-400 mt-2 leading-relaxed">
                    These are outside {parentName}'s range. The summary still goes under {parentName}.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
