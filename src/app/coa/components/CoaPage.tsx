// Ported from chart-of-accounts-v2.1/src/components/AppShell.tsx (scroll host, TopBar, page-in wrapper); adapted: renders inside the host's <main>, crumbs come from props, DemoControls dropped, the search box is wired (onSearch, or a quick-jump to the module's pages).
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search as SearchIcon, ArrowUpRight, CornerDownLeft } from 'lucide-react'
import { cn } from '../lib/utils'
import { installColumnHoverHint } from '../lib/columnHoverHint'

export type Crumb = { label: string; to?: string }

/** A destination the TopBar search can jump to when the page passes no `onSearch`. */
export interface SearchDestination {
  label: string
  to: string
  hint?: string
}

/* The module's own pages. A query that names one offers it; any other query is
   offered to the two library pages, which read `?q=` into their table search. */
const DEFAULT_DESTINATIONS: SearchDestination[] = [
  { label: 'Accounting Overview', to: '/accounting', hint: 'Accounting' },
  { label: 'Currency Library', to: '/accounting/currencies', hint: 'Currency & Exchange Rates' },
  { label: 'Exchange Rates', to: '/accounting/exchange-rates', hint: 'Currency & Exchange Rates' },
]
const QUERY_TARGETS: SearchDestination[] = [
  { label: 'Currency Library', to: '/accounting/currencies' },
  { label: 'Exchange Rates', to: '/accounting/exchange-rates' },
]

/**
 * The CoA page frame for a page rendered inside the host's <main>: the one
 * scroll container, CoA's 48px sticky TopBar (breadcrumb, search, user) and the
 * `animate-page-in` wrapper keyed by pathname.
 *
 * A list page that wants only its table to scroll gives its root
 * `flex-1 flex flex-col min-h-0`; a detail page that scrolls as a whole gives
 * its root `flex-1 flex flex-col` and lets this container scroll it.
 */
export function CoaPage({ crumbs, onSearch, searchPlaceholder = 'Search…', destinations = DEFAULT_DESTINATIONS, pageKey, children }: {
  crumbs: Crumb[]
  /** Called with the query on Enter. Omit for the default quick-jump menu. */
  onSearch?: (q: string) => void
  searchPlaceholder?: string
  /** Pages the default quick-jump offers. */
  destinations?: SearchDestination[]
  /** Replaces the pathname as the page-in key, for one page that spans several
   *  paths (its tabs) and shouldn't replay its entrance when switching them. */
  pageKey?: string
  children: ReactNode
}) {
  const location = useLocation()
  useEffect(() => { installColumnHoverHint() }, [])
  return (
    /* TopBar lives INSIDE the scroll container (sticky), like the Partners pages'
       top nav - so it shares the same right edge as the content instead of
       extending under the scrollbar gutter. A column, so a page that wants to
       fill the viewport and scroll only its own table can say so with
       `flex-1 min-h-0` and get the height left over after the TopBar. */
    <div className="flex-1 overflow-auto scrollbar-thin flex flex-col">
      <TopBar crumbs={crumbs} onSearch={onSearch} placeholder={searchPlaceholder} destinations={destinations} />
      {/* Keyed by pathname so every route change remounts this wrapper and
          replays the page-in entrance. The animation keeps its transform, so
          every overlay below it portals to <body>. */}
      <div key={pageKey ?? location.pathname} className="animate-page-in flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}

/** The TopBar's height, for anything that sticks below it (h-12). */
export const TOPBAR_TOP_CLS = 'top-12'

function TopBar({ crumbs, onSearch, placeholder, destinations }: {
  crumbs: Crumb[]
  onSearch?: (q: string) => void
  placeholder: string
  destinations: SearchDestination[]
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 lg:px-8 h-12 border-b border-border bg-card shrink-0">
      {/* Breadcrumb - hand-rolled as in CoA: 13px, "/" text separators,
          weight-500 crumbs, muted parents, foreground current crumb. */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground min-w-0 overflow-hidden whitespace-nowrap">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && <span className="text-muted-foreground">/</span>}
              {!isLast ? (
                <Link to={c.to ?? '/accounting'} className="hover:text-foreground transition-colors cursor-pointer shrink-0" style={{ fontWeight: 500 }}>{c.label}</Link>
              ) : (
                /* Current crumb sits one step smaller than the parent links. */
                <span className="text-foreground text-xs truncate" style={{ fontWeight: 500 }}>{c.label}</span>
              )}
            </Fragment>
          )
        })}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <TopBarSearch onSearch={onSearch} placeholder={placeholder} destinations={destinations} />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(var(--accent))' }}>
            <span className="text-[11px]" style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>AA</span>
          </div>
          <div className="hidden sm:block whitespace-nowrap">
            <p className="text-[13px]" style={{ fontWeight: 500 }}>Ahtisham Ahmad</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Controller</p>
          </div>
        </div>
      </div>
    </header>
  )
}

/* CoA's input, unchanged in look. With `onSearch` it hands the query over on
   Enter; without it, typing opens a small jump list in the Menu panel recipe:
   the module pages whose name matches, then "Search <page> for …", which opens
   that library with its table search filled in (`?q=`). */
function TopBarSearch({ onSearch, placeholder, destinations }: {
  onSearch?: (q: string) => void
  placeholder: string
  destinations: SearchDestination[]
}) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const items = useMemo(() => {
    const t = q.trim()
    if (!t || onSearch) return [] as (SearchDestination & { query?: boolean })[]
    const lower = t.toLowerCase()
    const pages: (SearchDestination & { query?: boolean })[] = destinations.filter(d => d.label.toLowerCase().includes(lower))
    const searches = QUERY_TARGETS.map(d => ({ ...d, label: `Search ${d.label} for "${t}"`, to: `${d.to}?q=${encodeURIComponent(t)}`, query: true }))
    return [...pages, ...searches]
  }, [q, onSearch, destinations])

  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    if (!open || items.length === 0) { setPos(null); return }
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 4, left: Math.max(8, r.right - Math.max(r.width, 320)), width: Math.max(r.width, 320) })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, items.length])
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const go = (to: string) => { setOpen(false); setQ(''); navigate(to) }

  return (
    <div ref={wrapRef} className="relative hidden md:block">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur() }
          else if (e.key === 'Enter') {
            if (onSearch) { onSearch(q.trim()); return }
            const it = items[active]
            if (it) go(it.to)
          } else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
        }}
        placeholder={placeholder}
        aria-label="Search"
        className="pl-9 w-[260px] h-8 bg-white border border-border/60 rounded-md text-[13px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
      />
      {open && pos && items.length > 0 && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          className="fixed z-[200] bg-white border border-border rounded-md shadow-lg animate-popover-down py-1"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {items.map((it, i) => (
            <button
              key={it.to + it.label}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(it.to)}
              className={cn('w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left whitespace-nowrap text-fg', i === active ? 'bg-bg-subtle' : 'hover:bg-bg-subtle')}
            >
              {it.query
                ? <SearchIcon size={14} className="shrink-0 text-fg-subtle" />
                : <ArrowUpRight size={14} className="shrink-0 text-fg-subtle" />}
              <span className="truncate flex-1">{it.label}</span>
              {i === active && <CornerDownLeft size={12} className="shrink-0 text-fg-subtle/60" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
