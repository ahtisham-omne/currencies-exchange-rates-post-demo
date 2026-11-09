// Ported from chart-of-accounts-v2.1/src/components/AccountTable.tsx (CurrencyCell, OverflowCard, OVERFLOW_PILL, DimensionPills, ExpandToggle, PARTNER_CHIP_CLS, NewBadge, rowCells' name cell, NAME_INDENT_BASE / LEAF_LEAD); adapted: typed to plain values instead of Account - CurrencyCell takes the flag's country code, OverflowCard can draw its own row icon, DimensionPills became OverflowPills over any values.
import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Layers, Minus, Plus } from 'lucide-react'
import { cn } from '../lib/utils'
import { Marked } from './ui'
import { FlagImage } from './FlagImage'
import { searchMatcher } from '../lib/tableSearch'

/** Table chips that read as entries rather than badges: the `.chip` recipe
 *  squared off and one step larger (rounded-md, 12px). Pass to `<Badge className>`. */
export const PARTNER_CHIP_CLS = '!px-2.5 !py-0.5 !h-auto !text-xs !rounded-md'

export const NAME_INDENT_BASE = 14
export const INDENT_STEP = 26
/** The spacer a leaf row takes where an expandable row draws its toggle. */
export const LEAF_LEAD = 6

/* ── The row's primary text ───────────────────────────────────────────────
   CoA's name cell: 14px slate-800 text, truncating, weight 400 (600 on a
   summary or special row). When the row opens, it is a real <button> - the
   keyboard's door to the row, since the click lives on the <tr> - styled
   exactly like the span, and it stops the click bubbling so the row does not
   fire it twice. */
export function PrimaryCellText({ text, q = '', strong, onOpen, title }: {
  text: string
  q?: string
  strong?: boolean
  onOpen?: () => void
  title?: string
}) {
  const style = { fontWeight: strong ? 600 : 400, color: '#1E293B' }
  return onOpen ? (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onOpen() }}
      title={title}
      className="text-sm truncate text-left min-w-0 bg-transparent p-0 m-0 border-0 cursor-pointer"
      style={style}
    ><Marked text={text} q={q} /></button>
  ) : (
    <span className="text-sm truncate" style={style} title={title}><Marked text={text} q={q} /></span>
  )
}

/* ── Currency: flag + code chip ───────────────────────────────────────────
   CoA's Currency cell. The full name lives in the title tooltip rather than the
   cell, keeping the column compact; pass `name` to print it beside the chip too
   (the Currency Library's identity column). */
export function CurrencyCell({ code, country, name, q = '', showName, trailing, onOpen, strong }: {
  code: string
  /** ISO 3166 alpha-2 for the flag ('us', 'eu'). Omit to draw the code's own letters. */
  country?: string | null
  name?: string
  q?: string
  /** Print the name after the chip, as the row's primary text. */
  showName?: boolean
  /** After the name, e.g. a "Base" chip. */
  trailing?: ReactNode
  /** Makes the name the row's keyboard door (see PrimaryCellText). */
  onOpen?: () => void
  strong?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0" title={name}>
      <span className="inline-flex items-center text-base leading-none shrink-0" aria-hidden><FlagImage code={country ?? ''} /></span>
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-info-50 text-info-700 text-2xs font-semibold border border-info-100 shrink-0"><Marked text={code} q={q} /></span>
      {showName && name && <PrimaryCellText text={name} q={q} onOpen={onOpen} strong={strong} />}
      {trailing}
    </div>
  )
}

/* ── "New" / small markers ─────────────────────────────────────────────── */
export function NewBadge({ label = 'New' }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold leading-none bg-info-50 text-info-700 border border-info-100 shrink-0">
      {label}
    </span>
  )
}

/* ── Expand toggle ─────────────────────────────────────────────────────────
   Nested-row expand/collapse control. `arrows` (the default here) is the bare
   chevron; the disc (+/−) is the tree-lines variant. The ::after pad widens
   only the click target so a near miss still toggles instead of opening the row. */
export function ExpandToggle({ expanded, onClick, arrows = true }: { expanded: boolean; onClick: (e: React.MouseEvent) => void; arrows?: boolean }) {
  if (arrows) return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? 'Collapse' : 'Expand'}
      aria-expanded={expanded}
      className="relative flex items-center justify-center size-5 rounded-md transition-colors duration-200 ease-out cursor-pointer shrink-0 text-muted-foreground hover:bg-bg-subtle hover:text-foreground after:content-[''] after:absolute after:-inset-y-1 after:-left-2 after:-right-1.5"
    >
      {expanded ? <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} /> : <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />}
    </button>
  )
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? 'Collapse' : 'Expand'}
      aria-expanded={expanded}
      className="relative flex items-center justify-center size-5 rounded-full transition-all duration-200 ease-out cursor-pointer border-2 shrink-0 active:scale-90 hover:ring-2 hover:ring-primary/25 after:content-[''] after:absolute after:-inset-y-1 after:-left-2 after:-right-1.5"
      style={{
        backgroundColor: expanded ? 'hsl(var(--accent))' : '#FFFFFF',
        borderColor: expanded ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--muted-foreground) / 0.3)',
        color: expanded ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
      }}
    >
      {expanded ? <Minus className="w-2 h-2" strokeWidth={2.5} /> : <Plus className="w-2 h-2" strokeWidth={2.5} />}
    </button>
  )
}

/* ── Overflow pill + hover card ─────────────────────────────────────────────
   The listing's multi-value cell: the first value as a squared pill, the rest
   behind "+N", which opens a portalled card on hover (180ms in, 120ms out). */
const TIP_ROW_H = 44
const TIP_ROWS_VISIBLE = 5
const TIP_OPEN_MS = 180
const TIP_CLOSE_MS = 120

const tipWidth = () => {
  if (typeof window === 'undefined') return 280
  const w = window.innerWidth
  return w < 640 ? 220 : w < 1024 ? 250 : 280
}

export interface OverflowItem { name: string; subtitle?: string; icon?: ReactNode }

export function OverflowCard({ category, items, icon: RowIcon = Layers, children }: {
  category: string
  /** A row's subtitle may be omitted where the category alone says what it is.
   *  A row's own `icon` (a flag, say) replaces the category icon in its tile. */
  items: OverflowItem[]
  icon?: ElementType
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState({ top: 0, left: 0, width: 280, above: false })
  const trigger = useRef<HTMLSpanElement>(null)
  const openAt = useRef<number>()
  const closeAt = useRef<number>()

  const place = useCallback(() => {
    const el = trigger.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = tipWidth()
    const h = Math.min(items.length, TIP_ROWS_VISIBLE) * TIP_ROW_H + 40
    const above = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0
    setBox({
      top: above ? r.top - h - 6 : r.bottom + 6,
      left: Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8)),
      width,
      above,
    })
  }, [items.length])

  useEffect(() => {
    if (!open) return
    const on = () => place()
    window.addEventListener('scroll', on, true)
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on, true); window.removeEventListener('resize', on) }
  }, [open, place])

  useEffect(() => () => {
    window.clearTimeout(openAt.current)
    window.clearTimeout(closeAt.current)
  }, [])

  const enter = () => {
    window.clearTimeout(closeAt.current)
    openAt.current = window.setTimeout(() => { place(); setOpen(true) }, TIP_OPEN_MS)
  }
  const leave = () => {
    window.clearTimeout(openAt.current)
    closeAt.current = window.setTimeout(() => setOpen(false), TIP_CLOSE_MS)
  }

  const scrolls = items.length > TIP_ROWS_VISIBLE

  return (
    <>
      {/* inline-flex: a pill inside sits level with its neighbours instead of
          dropping to the text baseline (the "+N" beside a value pill). */}
      <span ref={trigger} onMouseEnter={enter} onMouseLeave={leave} className="inline-flex shrink-0 cursor-default">
        {children}
      </span>

      {open && createPortal(
        <div
          onMouseEnter={() => window.clearTimeout(closeAt.current)}
          onMouseLeave={leave}
          className="fixed z-[300]"
          style={{ top: box.top, left: box.left, width: box.width, animation: 'coaOverflowTipIn 120ms ease-out forwards' }}
        >
          <div className="absolute left-1/2 -translate-x-1/2" style={box.above ? { bottom: -4 } : { top: -4 }}>
            <div
              className="w-2 h-2 rotate-45 bg-white"
              style={box.above
                ? { borderBottom: '1px solid rgba(226, 232, 240, 0.5)', borderRight: '1px solid rgba(226, 232, 240, 0.5)' }
                : { borderTop: '1px solid rgba(226, 232, 240, 0.5)', borderLeft: '1px solid rgba(226, 232, 240, 0.5)' }}
            />
          </div>

          <div
            className="bg-white rounded-lg overflow-hidden"
            style={{ border: '1px solid rgba(226, 232, 240, 0.5)', boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
              <span className="text-[11px] tracking-wide uppercase" style={{ fontWeight: 600, color: 'rgba(71, 85, 105, 0.7)' }}>{category}</span>
              <span className="text-[10px] tabular-nums" style={{ color: 'rgba(71, 85, 105, 0.5)' }}>{items.length}</span>
            </div>

            <div
              className={cn('px-1.5 pb-1.5', scrolls && 'overflow-y-auto')}
              style={scrolls ? { maxHeight: TIP_ROWS_VISIBLE * TIP_ROW_H } : undefined}
            >
              {items.map((it, i) => (
                <div key={i} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-muted" style={{ color: '#64748B' }}>
                    {it.icon ?? <RowIcon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] truncate block text-foreground" style={{ fontWeight: 500 }}>{it.name}</span>
                    {it.subtitle && <span className="text-[10px] block truncate" style={{ color: 'rgba(71, 85, 105, 0.6)' }}>{it.subtitle}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

/* Squared off rather than the module's fully-rounded `chip`: a pill that is one
   of several values reads as an entry in a list, not as a status. */
export const OVERFLOW_PILL = 'inline-flex items-center h-[22px] rounded-md text-xs border bg-muted text-muted-foreground border-border'

/** The first value as a pill, the rest behind "+N" with a hover card. An empty
 *  cell is an en dash. `values[0]` may carry a leading icon (a flag). When a
 *  search matches only a value behind "+N", that value takes the pill's place,
 *  so the row shows why it matched ("germany" shows Germany on the EUR row). */
export function OverflowPills({ values, category, icon, q = '', plain }: {
  values: OverflowItem[]
  /** The hover card's heading, e.g. "Countries / Regions". */
  category: string
  icon?: ElementType
  q?: string
  /** Print the first value as plain text rather than a pill. */
  plain?: boolean
}) {
  if (!values.length) return <span className="text-2xs text-fg-subtle">–</span>
  const match = q.trim() ? searchMatcher(q) : null
  const hit = match && !match(values[0].name) ? values.findIndex(v => match(v.name)) : -1
  const ordered = hit > 0 ? [values[hit], ...values.filter((_, i) => i !== hit)] : values
  const [first, ...rest] = ordered
  return (
    <div className="flex items-center gap-1 min-w-0">
      {plain ? (
        <span className="inline-flex items-center gap-1.5 min-w-0 text-sm text-slate-700" title={first.name}>
          {first.icon}
          <span className="truncate"><Marked text={first.name} q={q} /></span>
        </span>
      ) : (
        <span className={cn(OVERFLOW_PILL, 'px-2 min-w-0 max-w-[180px] gap-1.5')} style={{ fontWeight: 500 }} title={first.name}>
          {first.icon}
          <span className="truncate"><Marked text={first.name} q={q} /></span>
        </span>
      )}
      {rest.length > 0 && (
        <OverflowCard category={category} items={rest} icon={icon}>
          <span className={cn(OVERFLOW_PILL, 'px-1.5')} style={{ fontWeight: 600 }}>+{rest.length}</span>
        </OverflowCard>
      )}
    </div>
  )
}

/** A dash for an empty cell: an en dash, never "None", a hyphen or an em dash. */
export function EmptyCell() {
  return <span className="text-fg-subtle">–</span>
}
