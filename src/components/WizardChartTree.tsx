import { useEffect, useRef, useState } from 'react'
import { ACCOUNT_TYPE_META, AccountType, StatementClassification, CLASSIFICATIONS_BY_CATEGORY } from '../types'
import { MasterChartEntry, TYPE_TO_CODE } from '../lib/masterChart'
import { cn, fmtCurrency } from '../lib/utils'

// "How this shapes your chart", the live, colour-coded, animated tree shown in
// the wizard's right pane. classifications are coloured by ACCOUNT_TYPE_META tone;
// accounts fade in on add and fade/collapse out on removal; dashed guide lines
// shimmer beside each section's children. Honors prefers-reduced-motion via the
// CSS in index.css.

const TONE_DOT: Record<string, string> = {
  info: 'bg-info-500', warning: 'bg-warning-500', brand: 'bg-brand-500', purple: 'bg-purple-500', teal: 'bg-teal-500',
  success: 'bg-success-500', danger: 'bg-danger-500', neutral: 'bg-fg-subtle',
}
const TONE_TEXT: Record<string, string> = {
  info: 'text-info-700', warning: 'text-warning-700', brand: 'text-brand-700', purple: 'text-purple-700', teal: 'text-teal-700',
  success: 'text-success-700', danger: 'text-danger-700', neutral: 'text-fg',
}
const toneOf = (e: MasterChartEntry) => ACCOUNT_TYPE_META[TYPE_TO_CODE[e.type]].color
const TYPE_ORDER: AccountType[] = ['AST', 'LIA', 'EQT', 'REV', 'EXP']

type Display = MasterChartEntry & { leaving?: boolean; entering?: boolean }

// Keeps removed accounts mounted briefly so they can animate out, and tags
// newly-added accounts as `entering` so they can be highlighted (blue) until
// the next change.
function useAnimatedEntries(entries: MasterChartEntry[]): Display[] {
  const [display, setDisplay] = useState<Display[]>(entries)
  const prev = useRef<MasterChartEntry[]>(entries)
  useEffect(() => {
    const prevNums = new Set(prev.current.map(e => e.number))
    const nextNums = new Set(entries.map(e => e.number))
    const added = new Set(entries.filter(e => !prevNums.has(e.number)).map(e => e.number))
    const removed = prev.current.filter(e => !nextNums.has(e.number)).map(e => ({ ...e, leaving: true } as Display))
    prev.current = entries
    const base: Display[] = entries.map(e => ({ ...e, entering: added.has(e.number) }))
    if (removed.length === 0) { setDisplay(base); return }
    setDisplay([...base, ...removed].sort((a, b) => Number(a.number) - Number(b.number)))
    const t = setTimeout(() => setDisplay(base), 230)
    return () => clearTimeout(t)
  }, [entries])
  return display
}

const LINE = 'border-[#93B8F7]'

// Children block: an indented container; each child row draws its own dashed
// elbow (vertical → rounded corner → horizontal) that meets the parent, plus a
// continuation line down to the next sibling.
function Children({ kids, childMap, depth, balances, baseCurrency }: { kids: Display[]; childMap: Map<string | null, Display[]>; depth: number; balances: Record<string, number>; baseCurrency: string }) {
  if (kids.length === 0) return null
  return (
    <div className="relative ml-1">
      {kids.map((k, i) => <Node key={k.number} e={k} childMap={childMap} depth={depth} last={i === kids.length - 1} balances={balances} baseCurrency={baseCurrency} />)}
    </div>
  )
}

function Node({ e, childMap, depth, last, balances, baseCurrency }: { e: Display; childMap: Map<string | null, Display[]>; depth: number; last?: boolean; balances: Record<string, number>; baseCurrency: string }) {
  const kids = childMap.get(e.number) ?? []
  const isHeader = e.posting === 'Summary'
  const cls = e.leaving ? 'coa-acct-out' : e.entering ? 'coa-acct-in' : ''
  if (depth === 0) {
    const tone = toneOf(e)
    return (
      <div className={cls}>
        <div className="flex items-center gap-2 py-0.5">
          <span className={cn('w-2 h-2 rounded-full inline-block shrink-0', TONE_DOT[tone])} />
          <span className={cn('text-sm font-semibold', TONE_TEXT[tone])}>{e.name}</span>
        </div>
        <Children kids={kids} childMap={childMap} depth={depth + 1} balances={balances} baseCurrency={baseCurrency} />
      </div>
    )
  }
  // New (just-added) posting accounts render in blue; existing in default fg.
  const textCls = e.entering ? 'text-primary font-medium' : isHeader ? 'italic text-fg-muted' : 'text-fg'
  const bal = balances[e.number] ?? 0
  return (
    <div className={cls}>
      <div data-entering={e.entering ? '1' : undefined} className="relative flex items-center gap-2 py-1 pl-[22px] min-h-[26px]">
        {/* dashed elbow: vertical from the row top to its centre, a rounded
            corner, then a horizontal stub out to the account name */}
        <span className={cn('absolute left-[6px] top-0 h-1/2 w-3 border-l border-b border-dashed rounded-bl-[6px]', LINE)} aria-hidden />
        {/* continuation down to the next sibling (omitted on the last child) */}
        {!last && <span className={cn('absolute left-[6px] top-1/2 bottom-0 border-l border-dashed', LINE)} aria-hidden />}
        <span className={cn('text-xs', textCls)}>{e.name}</span>
        {bal > 0 && <span className="ml-auto pl-2 text-2xs text-fg-muted shrink-0">{fmtCurrency(bal, baseCurrency)}</span>}
      </div>
      <Children kids={kids} childMap={childMap} depth={depth + 1} balances={balances} baseCurrency={baseCurrency} />
    </div>
  )
}

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function WizardChartTree({ entries, placeholder, balances = {}, baseCurrency = 'USD' }: { entries: MasterChartEntry[]; placeholder?: boolean; balances?: Record<string, number>; baseCurrency?: string }) {
  const display = useAnimatedEntries(placeholder ? [] : entries)
  const count = placeholder ? 0 : entries.length

  // Group the (animated) entries by Type → classification → in-section hierarchy so the
  // pane mirrors the main tree's explicit classification sub-headers. Per-entry
  // animation flags (entering / leaving) are preserved, only the layout
  // changes. Within a classification an account nests under its parent only when the
  // parent is in the same classification; otherwise it is a classification root.
  const byNum = (a: Display, b: Display) => Number(a.number) - Number(b.number)
  const typeGroups = TYPE_ORDER.map(type => {
    const inType = display.filter(d => d.type === type)
    if (!inType.length) return null
    const secs = CLASSIFICATIONS_BY_CATEGORY[type].map(section => {
      const inSec = inType.filter(d => d.statementClassification === section)
      if (!inSec.length) return null
      const byNumMap = new Map(inSec.map(d => [d.number, d]))
      // Hide structural roll-up headers that restate the Type or classification
      // (e.g. "Assets", "Current Assets"), the Type / classification header rows
      // already represent them, and promote their children.
      const isRollup = (d: Display) => d.posting === 'Summary' && (d.parentNumber == null || d.name === section)
      const effParent = (d: Display): string | null => {
        let p = d.parentNumber
        while (p && byNumMap.has(p)) {
          const pd = byNumMap.get(p)!
          if (!isRollup(pd)) return pd.number
          p = pd.parentNumber
        }
        return null
      }
      const visible = inSec.filter(d => !isRollup(d))
      if (!visible.length) return null
      const scMap = new Map<string | null, Display[]>()
      visible.forEach(d => {
        const k = effParent(d)
        if (!scMap.has(k)) scMap.set(k, [])
        scMap.get(k)!.push(d)
      })
      scMap.forEach(list => list.sort(byNum))
      return { section, scMap, roots: scMap.get(null) ?? [] }
    }).filter(Boolean) as { section: StatementClassification; scMap: Map<string | null, Display[]>; roots: Display[] }[]
    return secs.length ? { type, secs } : null
  }).filter(Boolean) as { type: AccountType; secs: { section: StatementClassification; scMap: Map<string | null, Display[]>; roots: Display[] }[] }[]

  // Summary of the accounts added in the latest change (entering posting
  // accounts), broken down by account type with subtle type colour coding.
  const addedPosting = display.filter(d => d.entering && d.posting === 'Posting')
  const addedCount = addedPosting.length
  const byCode = new Map<string, number>()
  addedPosting.forEach(e => { const c = TYPE_TO_CODE[e.type]; byCode.set(c, (byCode.get(c) ?? 0) + 1) })
  const breakdown = (Object.keys(ACCOUNT_TYPE_META) as (keyof typeof ACCOUNT_TYPE_META)[])
    .filter(c => byCode.has(c))
    .map(c => ({ code: c, n: byCode.get(c)!, meta: ACCOUNT_TYPE_META[c] }))

  // Counter scale + colour bump when the count changes.
  const [bump, setBump] = useState(false)
  const prevCount = useRef(count)
  useEffect(() => {
    if (prevCount.current === count) return
    prevCount.current = count
    if (prefersReducedMotion()) return
    setBump(true)
    const t = setTimeout(() => setBump(false), 400)
    return () => clearTimeout(t)
  }, [count])

  // Gently scroll the pane to the last newly-added account, once entrance
  // animations have settled and only if it isn't already in view.
  const scrollRef = useRef<HTMLDivElement>(null)
  const enteringKey = display.filter(d => d.entering).map(d => d.number).join(',')
  useEffect(() => {
    if (!enteringKey) return
    const reduced = prefersReducedMotion()
    const t = setTimeout(() => {
      const el = scrollRef.current
      if (!el) return
      const targets = el.querySelectorAll<HTMLElement>('[data-entering="1"]')
      const last = targets[targets.length - 1]
      if (!last) return
      const cr = el.getBoundingClientRect(), tr = last.getBoundingClientRect()
      const inView = tr.top >= cr.top && tr.bottom <= cr.bottom
      if (!inView) last.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' })
    }, reduced ? 0 : 500)
    return () => clearTimeout(t)
  }, [enteringKey])

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-fg">How this shapes your chart</div>
          <div className="text-xs text-fg-muted mt-0.5">Updates as you answer</div>
        </div>
        <span className="text-xs shrink-0">
          <span className={cn('inline-block font-medium', bump ? 'coa-count-bump text-primary' : 'text-fg-muted')}>{count}</span>
          <span className="text-fg-muted"> account{count === 1 ? '' : 's'}</span>
        </span>
      </div>
      {/* Summary of what the latest answer added, broken down by type. */}
      <div className="px-4 py-2.5 border-b border-border bg-bg-subtle/40">
        {addedCount > 0 ? (
          <>
            <div className="text-xs font-semibold text-fg">{addedCount} account{addedCount === 1 ? '' : 's'} added</div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {breakdown.map(b => (
                <span key={b.code} className="inline-flex items-center gap-1.5 text-2xs text-fg-muted">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', TONE_DOT[b.meta.color])} />
                  {b.n} {b.meta.label} account{b.n === 1 ? '' : 's'}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="text-xs text-fg-subtle">No new accounts added</div>
        )}
      </div>
      <div ref={scrollRef} className="p-4 overflow-y-auto scrollbar-thin space-y-2 transition-[max-height] duration-200 ease-out motion-reduce:transition-none" style={{ maxHeight: 'calc(100vh - 268px)' }}>
        {placeholder ? (
          <div className="space-y-3">
            <p className="text-xs text-fg-muted leading-relaxed">Your tree appears here as you answer each question. It fills in by category, Assets, Liabilities, Equity, Revenue, and Expenses.</p>
            <div className="space-y-1.5 opacity-40">
              {['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses'].map(s => (
                <div key={s} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-fg-subtle inline-block" /><span className="text-sm font-semibold text-fg-subtle">{s}</span></div>
              ))}
            </div>
          </div>
        ) : typeGroups.length === 0 ? (
          <p className="text-xs text-fg-subtle">No accounts yet.</p>
        ) : (
          typeGroups.map(g => {
            const tone = ACCOUNT_TYPE_META[g.type].color
            return (
              <div key={g.type}>
                {/* Type header, colour-coded dot + label (matches the main tree) */}
                <div className="flex items-center gap-2 py-0.5">
                  <span className={cn('w-2 h-2 rounded-full inline-block shrink-0', TONE_DOT[tone])} />
                  <span className={cn('text-sm font-semibold', TONE_TEXT[tone])}>{ACCOUNT_TYPE_META[g.type].label}</span>
                </div>
                {/* classification sub-headers nested inside the Type */}
                {g.secs.map(s => (
                  <div key={s.section}>
                    <div className="pl-[22px] pt-1.5 pb-0.5 text-2xs uppercase tracking-wider text-fg-subtle font-semibold">{s.section}</div>
                    <Children kids={s.roots} childMap={s.scMap} depth={1} balances={balances} baseCurrency={baseCurrency} />
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
