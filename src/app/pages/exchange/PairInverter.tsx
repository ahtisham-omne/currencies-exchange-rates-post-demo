// Exchange Rates screens: the one-unit pair inverter. A row's expanded detail on
// the library tables (`layout="row"`) and the pair page's rail card
// (`layout="stack"`): From / To cards, and a swap that turns 1 SRC = rate PKR
// into 1 PKR = 1/rate SRC, the cards changing places.
import { ArrowLeftRight, ArrowUpDown } from 'lucide-react'
import { LayoutGroup, motion } from 'motion/react'
import { INVERSE_BADGE_TOOLTIP } from '../../utils/rateCopy'
import { Tooltip } from '../../coa/components/ui'
import { FlagImage } from '../../coa/components/FlagImage'
import { cn } from '../../coa/lib/utils'
import { BASE, BASE_NAME, countryOf, flagOf, fmtRate } from './rateModel'

const SPRING = { type: 'spring', stiffness: 520, damping: 38 } as const

function SideCard({ label, code, name, amount, stack }: { label: string; code: string; name: string; amount: string; stack?: boolean }) {
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
        <span className="text-[13px] text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 600 }}>{amount}</span>
      </div>
      <p className="text-[11px] text-fg-subtle truncate mt-0.5">{countryOf(code) || ' '}</p>
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
  /** A quiet line after the cards ("Effective Apr 1, 2026"). */
  note?: string
  className?: string
}) {
  const stack = layout === 'stack'
  const src = { id: 'src', label: inverted ? 'To' : 'From', code, name, amount: inverted ? (1 / rate).toFixed(6) : '1.0000' }
  const base = { id: 'base', label: inverted ? 'From' : 'To', code: BASE, name: BASE_NAME, amount: inverted ? '1.0000' : fmtRate(rate) }
  const [first, second] = inverted ? [base, src] : [src, base]
  const Swap = stack ? ArrowUpDown : ArrowLeftRight
  const line = inverted ? `1 ${BASE} = ${(1 / rate).toFixed(6)} ${code}` : `1 ${code} = ${fmtRate(rate)} ${BASE}`
  return (
    <LayoutGroup>
      <div className={cn(stack ? 'flex flex-col items-stretch gap-2' : 'flex items-center gap-3 flex-wrap', className)}>
        <motion.div layout transition={SPRING} key={first.id} className={stack ? '' : 'shrink-0'}>
          <SideCard label={first.label} code={first.code} name={first.name} amount={first.amount} stack={stack} />
        </motion.div>
        <div className={cn('flex items-center', stack && 'justify-center')}>
          <Tooltip content={inverted ? INVERSE_BADGE_TOOLTIP : 'Swap direction'} side="top">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onToggle() }}
              aria-pressed={inverted}
              aria-label={inverted ? 'Show the rate as quoted' : 'Swap direction'}
              className={cn('w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer shadow-xs',
                inverted ? 'border-primary/30 bg-accent text-primary' : 'border-border bg-white text-fg-subtle hover:bg-bg-subtle hover:text-fg')}
            >
              <Swap size={14} />
            </button>
          </Tooltip>
        </div>
        <motion.div layout transition={SPRING} key={second.id} className={stack ? '' : 'shrink-0'}>
          <SideCard label={second.label} code={second.code} name={second.name} amount={second.amount} stack={stack} />
        </motion.div>
        <div className={cn('min-w-0', stack ? 'text-center' : '')}>
          <p className="text-[12px] text-slate-700 tabular-nums" style={{ fontWeight: 600 }}>{line}</p>
          {inverted && <p className="text-[11px] text-fg-subtle">Inverse rate</p>}
          {note && <p className="text-[11px] text-fg-subtle">{note}</p>}
        </div>
      </div>
    </LayoutGroup>
  )
}
