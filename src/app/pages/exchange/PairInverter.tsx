// Exchange Rates screens: the pair converter. A row's expanded detail on the
// library tables (`layout="row"`) and the pair page's rail card
// (`layout="stack"`): type an amount in one currency and read it in the other at
// this rate. The swap works as Google's converter does: it turns USD → PKR into
// PKR → USD and keeps the amount typed, so 1 USD = 278.52 PKR swaps to
// 1 PKR = 0.0036 USD, the same rate read the other way. (It used to carry the
// converted amount across, so the swap read 278.52 PKR = 1.00 USD.) The result
// carries four decimals like every rate (fmtConverted), so it never reads 0.00.
import { useState } from 'react'
import { ArrowLeftRight, ArrowUpDown } from 'lucide-react'
import { LayoutGroup, motion } from 'motion/react'
import { INVERSE_BADGE_TOOLTIP } from '../../utils/rateCopy'
import { Tooltip } from '../../coa/components/ui'
import { FlagImage } from '../../coa/components/FlagImage'
import { cn } from '../../coa/lib/utils'
import { BASE, BASE_NAME, countryOf, flagOf, fmtConverted, fmtInverse, fmtRate } from './rateModel'

const SPRING = { type: 'spring', stiffness: 520, damping: 38 } as const

function SideCard({ label, code, name, stack, children }: { label: string; code: string; name: string; stack?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg border border-border bg-white px-3 py-2 min-w-0', stack ? 'w-full' : 'w-[260px] shrink-0')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{label}</span>
        <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Amount</span>
      </div>
      <div className="flex items-center justify-between gap-3 mt-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center text-base leading-none shrink-0" aria-hidden><FlagImage code={flagOf(code)} /></span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-info-50 text-info-700 text-2xs font-semibold border border-info-100 shrink-0">{code}</span>
          <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }} title={name}>{name}</span>
        </div>
        {children}
      </div>
      <p className="text-[11px] text-fg-subtle truncate mt-0.5">{countryOf(code) || ' '}</p>
    </div>
  )
}

export function PairInverter({ code, name, rate, inverted, onToggle, layout = 'row', note, className }: {
  code: string
  name: string
  /** 1 SRC in PKR. */
  rate: number
  inverted: boolean
  onToggle: () => void
  layout?: 'row' | 'stack'
  /** A quiet line after the cards ("At the corporate rate"). */
  note?: string
  className?: string
}) {
  const stack = layout === 'stack'
  // What the reader typed, in the From currency. Starts at one unit.
  const [amount, setAmount] = useState('1')
  const n = Number(amount)
  const valid = amount.trim() !== '' && Number.isFinite(n) && n >= 0
  const fromCode = inverted ? BASE : code
  const toCode = inverted ? code : BASE
  // From SRC: multiply by the rate. From PKR: divide by it.
  const converted = valid ? (inverted ? n / rate : n * rate) : 0

  // The amount stays; the currencies trade places.
  const swap = () => onToggle()

  const src = { id: 'src', code, name }
  const base = { id: 'base', code: BASE, name: BASE_NAME }
  const [first, second] = inverted ? [base, src] : [src, base]
  const Swap = stack ? ArrowUpDown : ArrowLeftRight
  const line = inverted ? `1 ${BASE} = ${fmtInverse(rate)} ${code}` : `1 ${code} = ${fmtRate(rate)} ${BASE}`

  return (
    <LayoutGroup>
      <div className={cn(stack ? 'flex flex-col items-stretch gap-2' : 'flex items-center gap-3 flex-wrap', className)} onClick={e => e.stopPropagation()}>
        {stack && <p className="text-[11px] text-fg-subtle leading-snug">Type an amount in {first.code} to see what it comes to in {second.code} at this rate.</p>}
        <motion.div layout transition={SPRING} key={first.id} className={stack ? '' : 'shrink-0'}>
          <SideCard label="From" code={first.code} name={first.name} stack={stack}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              aria-label={`Amount in ${fromCode}`}
              className="w-[110px] text-right text-[13px] text-slate-700 tabular-nums bg-transparent rounded-md px-1.5 py-0.5 -mr-1.5 border border-transparent hover:border-border focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-colors"
              style={{ fontWeight: 600 }}
            />
          </SideCard>
        </motion.div>
        <div className={cn('flex items-center', stack && 'justify-center')}>
          <Tooltip content={INVERSE_BADGE_TOOLTIP} side="top">
            <button
              type="button"
              onClick={swap}
              aria-pressed={inverted}
              aria-label={`Convert from ${toCode} to ${fromCode} instead`}
              className={cn('w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer shadow-xs',
                inverted ? 'border-primary/30 bg-accent text-primary' : 'border-border bg-white text-fg-subtle hover:bg-bg-subtle hover:text-fg')}
            >
              <Swap size={14} />
            </button>
          </Tooltip>
        </div>
        <motion.div layout transition={SPRING} key={second.id} className={stack ? '' : 'shrink-0'}>
          <SideCard label="To" code={second.code} name={second.name} stack={stack}>
            {/* Four decimals, as every rate reads: 1 USD = 278.5200 PKR, 1 PKR = 0.0036 USD. */}
            <span className="text-[13px] text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>
              {valid ? fmtConverted(converted) : '–'}
            </span>
          </SideCard>
        </motion.div>
        <div className={cn('min-w-0', stack ? 'text-center' : '')}>
          <p className="text-[12px] text-slate-700 tabular-nums" style={{ fontWeight: 600 }}>{line}</p>
          {inverted && <p className="text-[11px] text-fg-subtle">Inverse Rate</p>}
          {note && <p className="text-[11px] text-fg-subtle">{note}</p>}
        </div>
      </div>
    </LayoutGroup>
  )
}
