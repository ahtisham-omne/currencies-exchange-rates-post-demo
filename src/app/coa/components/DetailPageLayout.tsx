// Ported from chart-of-accounts-v2.1/src/pages/AccountDetail.tsx (page root 460-568, OPENS_IN_FULL_VIEW + fullViewChoice 348-381, OverviewTab grid 881-1006, not-found 432-440) and JournalEntryDetail's EmptyState not-found; adapted: generic slots, and the rail's sticky offset is measured from the CoaPage TopBar (3rem) instead of a fixed 160px.
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '../lib/utils'
import { useRememberedState } from '../lib/rememberedState'
import { useSwapIn } from '../lib/swapIn'
import { detailContainerCls } from './DetailHeaderCard'
import { Button, EmptyState } from './ui'
import { avatarColor, cleanName, initialsOf } from './Avatar'

/**
 * The detail page skeleton (spec-detail §2.1): root, the sticky header card you
 * pass as `header`, then the body in the same centred container so card and
 * body edges align. A table tab (`fillsWindow`) lets its card reach the bottom
 * of the window (`pb-1`), others keep CoA's `pb-12`. Modals go in `overlays`.
 * Pass the active tab as `swapKey` and the body steps in on each tab change
 * while the header card stays still (useSwapIn). A tab that opens at the other
 * width (a table tab in full view) moves as the full-view toggle does: the
 * container stays mounted and its width eases with the header card's, with no
 * step-in on top.
 */
export function DetailPageLayout({ header, fullscreen, fillsWindow, swapKey, children, overlays }: {
  header: ReactNode
  fullscreen: boolean
  fillsWindow?: boolean
  swapKey?: string
  children: ReactNode
  overlays?: ReactNode
}) {
  const swapIn = useSwapIn(swapKey)
  const [last, setLast] = useState({ swapKey, fullscreen })
  const [resized, setResized] = useState(false)
  if (last.swapKey !== swapKey || last.fullscreen !== fullscreen) {
    setLast({ swapKey, fullscreen })
    setResized(last.fullscreen !== fullscreen)
  }
  return (
    <div className={cn('flex-1 flex flex-col', fillsWindow ? 'pb-1' : 'pb-12')}>
      {header}
      <div className={cn(detailContainerCls(fullscreen), 'w-full flex-1 flex flex-col pt-3 pb-5')}>
        <div key={swapKey} className={cn('flex-1 flex flex-col space-y-4', !resized && swapIn)}>
          {children}
        </div>
      </div>
      {overlays}
    </div>
  )
}

/* The rail sticks 112px below the TopBar: CoA's 160px less its 48px TopBar, so
   it clears the compact sticky header card and its gap at any root font size. */
export const RAIL_STICKY_CLS = 'xl:sticky xl:top-[calc(3rem+112px)]'

/**
 * The Dashboard tab's two columns: a fluid main column (blocks 12px apart) and
 * a 340px right rail (cards 14px apart) that sticks under the header on xl and
 * stacks under the main column below 1280px.
 */
export function DashboardGrid({ main, rail }: { main: ReactNode; rail: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="min-w-0 space-y-3">{main}</div>
        <div className={cn('space-y-3.5 min-w-0 overflow-hidden', RAIL_STICKY_CLS)}>{rail}</div>
      </div>
    </div>
  )
}

/**
 * The page's "full width" toggle, as CoA keeps it: table tabs open wide by
 * default until the reader toggles once; from then on their choice holds for
 * every tab for the session (remembered under `rememberAs`).
 */
export function useDetailFullView(rememberAs: string, tab: string, opensInFullView: Partial<Record<string, boolean>> = {}) {
  const [choice, setChoice] = useRememberedState<boolean | null>(rememberAs, null)
  const fullscreen = choice ?? opensInFullView[tab] ?? false
  const toggle = () => setChoice(!fullscreen)
  return [fullscreen, toggle] as const
}

/**
 * The tab state, read from and written to `?tab=` so a deep link opens the tab
 * it names. Unknown values fall back to the first tab; a new record id resets
 * to the first tab (CoA's `useEffect(() => setTab('overview'), [id])`).
 */
export function useDetailTab<T extends string>(tabs: readonly T[], recordId: string | undefined) {
  const [params, setParams] = useSearchParams()
  const fromUrl = params.get('tab') as T | null
  const initial = fromUrl && tabs.includes(fromUrl) ? fromUrl : tabs[0]
  const [tab, setTabState] = useState<T>(initial)
  const [lastId, setLastId] = useState(recordId)
  if (recordId !== lastId) { setLastId(recordId); setTabState(fromUrl && tabs.includes(fromUrl) ? fromUrl : tabs[0]) }
  useEffect(() => {
    const t = params.get('tab') as T | null
    if (t && tabs.includes(t) && t !== tab) setTabState(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  const setTab = (next: T) => {
    setTabState(next)
    const p = new URLSearchParams(params)
    if (next === tabs[0]) p.delete('tab'); else p.set('tab', next)
    setParams(p, { replace: true })
  }
  return [tab, setTab] as const
}

/** Not-found for a detail route (JE page's EmptyState version). */
export function DetailNotFound({ icon, title, onBack, backLabel }: { icon: ReactNode; title: string; onBack: () => void; backLabel: string }) {
  return (
    <div className="flex-1 flex items-center justify-center py-24">
      <EmptyState icon={icon} title={title} action={<Button variant="secondary" size="sm" onClick={onBack}>{backLabel}</Button>} />
    </div>
  )
}

/** The rail cards' field grid (OverviewTab 1010-1197): two columns, 16px x 10px. */
export function InfoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5', className)}>{children}</div>
}
/** The audit block at a rail card's foot. */
export function InfoAuditGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-2.5 border-t border-muted">{children}</div>
}
/** A value in the rail: `strong` (identity, 12.5px/600), plain (12px/500), or `empty` (slate-400). */
export function InfoValue({ children, strong, empty, className, title }: { children: ReactNode; strong?: boolean; empty?: boolean; className?: string; title?: string }) {
  if (empty) return <p className={cn('text-[12px] text-slate-400 mt-0.5', className)} style={{ fontWeight: 500 }}>{children}</p>
  if (strong) return <p className={cn('text-[12.5px] text-slate-700 truncate', className)} style={{ fontWeight: 600 }} title={title}>{children}</p>
  return <p className={cn('text-[12px] text-slate-700 mt-0.5 truncate', className)} style={{ fontWeight: 500 }} title={title}>{children}</p>
}

/** A person in the rail: 20px initials disc in the name's colour, then the name. */
export function InfoPerson({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] shrink-0" style={{ backgroundColor: avatarColor(cleanName(name)), fontWeight: 600 }}>{initialsOf(cleanName(name))}</div>
      <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{cleanName(name)}</span>
    </div>
  )
}
