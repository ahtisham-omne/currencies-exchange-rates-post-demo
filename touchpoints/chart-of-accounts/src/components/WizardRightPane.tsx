import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { EmptyState } from './ui'
import { ACCOUNT_TYPE_META, AccountType, StatementClassification } from '../types'
import { MasterChartEntry, TYPE_TO_CODE } from '../lib/masterChart'
import type { Account } from '../types'
import { cn } from '../lib/utils'
import { AccountChartChip } from './AccountChartChip'

// The wizard's focused right pane on data-collection steps. Shows only the
// accounts the current step's answers added, grouped by Type with classification
// sub-headers, atop the dotted-grid preview surface. A chip at the top opens the
// full accumulated chart; a live count sits at the bottom.
//
// `coreEntries` puts the always-included baseline above that list, collapsed. A
// pane that shows only the extras reads as though answering nothing produces
// nothing, so the baseline is visible; it is closed by default because it is not
// what changes as the reader answers.

const TONE_DOT: Record<string, string> = {
  info: 'bg-info-500', warning: 'bg-warning-500', brand: 'bg-brand-500', purple: 'bg-purple-500', teal: 'bg-teal-500',
  success: 'bg-success-500', danger: 'bg-danger-500', neutral: 'bg-fg-subtle',
}
const TYPE_ORDER: AccountType[] = ['AST', 'LIA', 'EQT', 'REV', 'EXP']
const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Tween a number toward `value` over ~400ms; snaps instantly under reduced motion.
function useCountTween(value: number): number {
  const [shown, setShown] = useState(value)
  const raf = useRef<number>()
  useEffect(() => {
    if (reducedMotion()) { setShown(value); return }
    const from = shown
    if (from === value) return
    const start = performance.now()
    const dur = 400
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(from + (value - from) * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return shown
}

interface TypeGroup {
  code: AccountType
  entries: MasterChartEntry[]
  sections: { statementClassification: StatementClassification; entries: MasterChartEntry[] }[]
}

// Group by Type, then classification, preserving master-chart order within each.
function groupByType(postings: MasterChartEntry[]): TypeGroup[] {
  return TYPE_ORDER
    .map(code => {
      const entries = postings.filter(e => TYPE_TO_CODE[e.type] === code)
      if (!entries.length) return null
      const sections: { statementClassification: StatementClassification; entries: MasterChartEntry[] }[] = []
      for (const e of entries) {
        const last = sections[sections.length - 1]
        if (last && last.statementClassification === e.statementClassification) last.entries.push(e)
        else sections.push({ statementClassification: e.statementClassification, entries: [e] })
      }
      return { code, entries, sections }
    })
    .filter(Boolean) as TypeGroup[]
}

// The grouped cards. Shared so the baseline and the additions read as one list
// split in two, rather than two designs stacked. The additions animate in as
// they arrive; the baseline was never new, so it does not.
function TypeGroupCards({ groups, countLabel, animate }: {
  groups: TypeGroup[]
  countLabel: (n: number) => string
  animate: boolean
}) {
  return (
    <div className="space-y-4">
      {groups.map((group, gi) => {
        const meta = ACCOUNT_TYPE_META[group.code]
        return (
          <div key={group.code} className="rounded-lg bg-white border border-border/60 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', TONE_DOT[meta.color] ?? 'bg-fg-subtle')} />
                <span className="text-sm font-semibold text-fg">{meta.label}</span>
              </div>
              <span className="text-2xs text-fg-subtle">{countLabel(group.entries.length)}</span>
            </div>
            <div className="mt-2 space-y-2">
              {group.sections.map((sec, si) => (
                <div key={sec.statementClassification}>
                  {sec.statementClassification && <div className="text-2xs uppercase tracking-wider text-fg-subtle/80 mb-1">{sec.statementClassification}</div>}
                  <div className="space-y-0.5">
                    {sec.entries.map((e, ei) => {
                      const moves = animate && !reducedMotion()
                      return (
                        <div
                          key={e.number}
                          className={cn('text-sm text-fg pl-1', moves && 'coa-acct-in')}
                          style={moves ? { animationDelay: `${(gi * 3 + si * 2 + ei) * 40}ms` } : undefined}
                        >
                          {e.name}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function WizardRightPane({
  newEntries, priorCount, fullAccounts, emptyHint, coreEntries,
  title = 'Adding from this step', footerSuffix = 'on this step',
  hideChartChip = false,
}: {
  newEntries: MasterChartEntry[]
  priorCount: number
  fullAccounts: Account[]
  emptyHint: string
  /** The always-included baseline, shown collapsed above the additions. */
  coreEntries?: MasterChartEntry[]
  title?: string
  footerSuffix?: string
  hideChartChip?: boolean
}) {
  // Posting accounts the user can recognise - headers are structural, not "new
  // accounts" the user chose, so they're excluded from the focused list/count.
  const postings = newEntries.filter(e => e.posting === 'Posting')
  const total = postings.length
  const shownTotal = useCountTween(total)
  const byType = groupByType(postings)

  const [coreOpen, setCoreOpen] = useState(false)
  const corePostings = (coreEntries ?? []).filter(e => e.posting === 'Posting')
  const coreGroups = groupByType(corePostings)

  return (
    <div className="h-full">
      {!hideChartChip && <AccountChartChip priorCount={priorCount} accounts={fullAccounts} />}

      {!hideChartChip && priorCount > 0 && <div className="border-t border-border/70 my-4" />}

      {corePostings.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setCoreOpen(o => !o)}
            aria-expanded={coreOpen}
            className="w-full flex items-center justify-between gap-2 text-left group"
          >
            <span className="text-xs text-fg-subtle font-semibold">Core accounts (always included)</span>
            <span className="flex items-center gap-1.5 text-2xs text-fg-subtle">
              {corePostings.length}
              <ChevronDown size={14} className={cn('transition-transform', coreOpen && 'rotate-180')} />
            </span>
          </button>
          {coreOpen && (
            <div className="mt-3">
              <TypeGroupCards groups={coreGroups} countLabel={n => String(n)} animate={false} />
            </div>
          )}
          <div className="border-t border-border/70 my-4" />
        </>
      )}

      <div className="text-xs text-fg-subtle font-semibold mb-3">{title}</div>

      {total === 0 ? (
        <EmptyState framed icon={<Plus size={20} />} title="Nothing added yet" description={emptyHint} />
      ) : (
        <TypeGroupCards groups={byType} countLabel={n => `${n} new`} animate />
      )}

      {total > 0 && (
        <>
          <div className="border-t border-border/70 my-4" />
          <div className="text-sm text-fg-muted">
            <span className="coa-count-bump inline-block" key={shownTotal}>{shownTotal}</span> new {shownTotal === 1 ? 'account' : 'accounts'} {footerSuffix}
          </div>
        </>
      )}
    </div>
  )
}
