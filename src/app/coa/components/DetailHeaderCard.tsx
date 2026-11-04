// Ported from chart-of-accounts-v2.1/src/components/DetailHeaderCard.tsx; adapted: sticks at top-12 (the CoaPage TopBar's own h-12) instead of a fixed 48px.
import { ReactNode, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronUp, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '../lib/utils'

// =============================================================
// DetailHeaderCard
// =============================================================
// The detail-page header, ported component-for-component from Cash
// Management's BankAccountDetailPage so every module's detail page shares the
// exact same chrome:
//
//   • a full-bleed sticky wrapper (bg-background) that sits below the app top
//     bar and masks content scrolling underneath;
//   • an inner `mx-auto px-… max-w-…` container that must match the body's
//     container so the card and the content below it line up to the pixel;
//   • a white rounded-xl card that morphs to a compact form on scroll (back
//     button, avatar, title, badges and actions all shrink) and gains a
//     stronger shadow;
//   • a fullscreen ("full width") toggle that expands the page from the
//     centered 1440/1600 max-width to full-bleed - the page owns the state and
//     applies the same width to its body;
//   • a bottom gradient fade + a scroll-to-top FAB, both revealed on scroll.
//
// `tone` tints the card the same status hues CM/Partners use (active → white,
// inactive → amber, archived → rose).

const TONE_STYLES: Record<string, React.CSSProperties> = {
  default: { background: '#FFFFFF', borderColor: 'hsl(var(--border))' },
  warning: { background: 'linear-gradient(to top, #FFFBEB 0%, #FFFFFF 55%, #FFFFFF 100%)', borderColor: '#FDE68A' },
  danger: { background: 'linear-gradient(to top, #FEF2F2 0%, #FFFFFF 55%, #FFFFFF 100%)', borderColor: '#FECACA' },
}

// The centered container width shared by the header and the page body. Exported
// so the body can apply the identical class and stay aligned with the card.
export const DETAIL_MAX_WIDTH = 'max-w-[1440px] 2xl:max-w-[1600px]'
export const detailContainerCls = (fullscreen?: boolean) =>
  cn('mx-auto px-4 lg:px-6 xl:px-8 transition-all duration-300', fullscreen ? 'max-w-full' : DETAIL_MAX_WIDTH)

// Walk up the DOM to find the nearest vertically-scrollable ancestor, so the
// morph reacts to the AppShell scroll container regardless of nesting.
function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null
  while (el) {
    const overflowY = getComputedStyle(el).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el
    el = el.parentElement
  }
  return null
}

export function DetailHeaderCard({
  onBack, backTitle, avatar, avatarColor, numberLabel, title, titleBadges, typeLine, description, actions,
  tabs, activeTab, onTabChange, tone = 'default', fullscreen = false, onToggleFullscreen,
}: {
  onBack?: () => void
  backTitle?: string
  /* Avatar contents (initials) and solid fill colour, Partner style. Optional -
     omit both to render the header without an avatar. */
  avatar?: ReactNode
  avatarColor?: string
  /* Optional plain-text lead (e.g. account number) shown before the title. */
  numberLabel?: string
  title: string
  /* Pills rendered inline after the title */
  titleBadges?: ReactNode
  /* Optional one-line descriptor under the title (e.g. "Posting account · …"). */
  typeLine?: ReactNode
  description?: string
  /* Right-hand controls (Actions dropdown, primary CTA, …) */
  actions?: ReactNode
  tabs: { id: string; label: string; count?: number }[]
  activeTab: string
  onTabChange: (id: string) => void
  tone?: 'default' | 'warning' | 'danger'
  /* Fullscreen ("full width") state, owned by the page so its body can widen
     in lock-step. When `onToggleFullscreen` is set, the toggle button renders
     as the leftmost right-hand action. */
  fullscreen?: boolean
  onToggleFullscreen?: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollParentRef = useRef<HTMLElement | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const sp = findScrollParent(rootRef.current)
    scrollParentRef.current = sp
    if (!sp) return
    const onScroll = () => setIsScrolled(sp.scrollTop > 8)
    onScroll()
    sp.addEventListener('scroll', onScroll, { passive: true })
    return () => sp.removeEventListener('scroll', onScroll)
  }, [])

  const FsIcon = fullscreen ? Minimize2 : Maximize2

  return (
    <>
      {/* ══ STICKY MORPHING HEADER ══ */}
      <div ref={rootRef} className="shrink-0 sticky top-12 z-20 bg-background">
        <div style={{ paddingTop: isScrolled ? 8 : 12, paddingBottom: 4, transition: 'padding-top 250ms ease' }}>
          <div className={detailContainerCls(fullscreen)}>
            <div
              className={cn('border rounded-xl overflow-hidden transition-shadow duration-250', isScrolled
                ? 'shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]'
                : 'shadow-sm')}
              style={TONE_STYLES[tone]}
            >
              {/* Main header row */}
              <div
                className="flex items-center justify-between gap-4 transition-all duration-250 ease-in-out"
                style={{ padding: isScrolled ? '6px 16px' : '12px 16px' }}
              >
                {/* Left: Back + Avatar + Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {onBack && (
                    <button
                      onClick={onBack}
                      title={backTitle ?? 'Back'}
                      className="rounded-xl border border-border bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-all duration-250"
                      style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}
                    >
                      <ChevronLeft className="text-slate-400 transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
                    </button>
                  )}
                  {avatar && (
                    <div
                      className="rounded-xl flex items-center justify-center shrink-0 text-white border border-white shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_0_0_2px_rgba(10,119,255,0.10)] transition-all duration-250"
                      style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44, backgroundColor: avatarColor, fontSize: isScrolled ? 11 : 14, fontWeight: 700 }}
                      title={title}
                    >
                      {avatar}
                    </div>
                  )}
                  {/* Name + Badges + Description */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap transition-all duration-250" style={{ gap: isScrolled ? 6 : 8 }}>
                      {numberLabel && <span className="text-foreground shrink-0 transition-all duration-250" style={{ fontSize: isScrolled ? 13 : 16, fontWeight: 700, lineHeight: isScrolled ? '18px' : '22px' }}>{numberLabel}</span>}
                      {numberLabel && <span className="text-slate-300 shrink-0" style={{ fontSize: isScrolled ? 13 : 16, fontWeight: 400, lineHeight: isScrolled ? '18px' : '22px' }} aria-hidden>|</span>}
                      <h1 className="text-foreground truncate transition-all duration-250" style={{ fontSize: isScrolled ? 13 : 16, fontWeight: isScrolled ? 600 : 700, lineHeight: isScrolled ? '18px' : '22px' }}>{title}</h1>
                      {titleBadges}
                    </div>
                    {typeLine && !isScrolled && <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1.5">{typeLine}</p>}
                    {description && !isScrolled && <HeaderDescription text={description} />}
                  </div>
                </div>

                {/* Right: fullscreen toggle + actions */}
                <div className="flex items-center shrink-0 transition-all duration-250" style={{ gap: isScrolled ? 6 : 8 }}>
                  {onToggleFullscreen && (
                    <button
                      type="button"
                      onClick={onToggleFullscreen}
                      title={fullscreen ? 'Exit full screen' : 'Full screen'}
                      aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
                      aria-pressed={fullscreen}
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all duration-250 cursor-pointer shadow-sm"
                      style={{ width: isScrolled ? 32 : 36, height: isScrolled ? 32 : 36 }}
                    >
                      <FsIcon style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                    </button>
                  )}
                  {actions}
                </div>
              </div>

              {/* Tab bar - always visible at the bottom of the card */}
              <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5">
                {tabs.map(tab => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange(tab.id)}
                      className={cn(
                        'flex items-center gap-1.5 border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer',
                        isActive ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                      )}
                      style={{ padding: isScrolled ? '8px 14px' : '10px 14px', fontSize: isScrolled ? 12 : 13, fontWeight: isActive ? 600 : 400, transition: 'padding 250ms ease, font-size 250ms ease' }}
                    >
                      {tab.label}
                      {!!tab.count && (
                        <span className={cn('inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-10',
                          isActive ? 'bg-accent text-primary' : 'bg-bg-muted text-slate-500')} style={{ fontWeight: 600 }}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        {/* Bottom gradient fade - soft edge below the sticky header */}
        <div
          className="pointer-events-none transition-opacity duration-300"
          style={{
            height: 8,
            background: 'linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)',
            opacity: isScrolled ? 1 : 0,
          }}
        />
      </div>

      {/* Scroll-to-top FAB - appears once scrolled */}
      <button
        onClick={() => scrollParentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-white border border-border shadow-[0_2px_12px_-3px_rgba(0,0,0,0.12),0_4px_16px_-4px_rgba(0,0,0,0.08)] flex items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-slate-300 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] active:scale-95 transition-all duration-300"
        style={{
          width: 40,
          height: 40,
          opacity: isScrolled ? 1 : 0,
          transform: isScrolled ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.9)',
          pointerEvents: isScrolled ? 'auto' : 'none',
        }}
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-5 h-5 text-slate-500" />
      </button>
    </>
  )
}

// One-line truncated description with the Partner "... more" / "Show less"
// expander (gradient-faded inline toggle).
function HeaderDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const [needsTruncation, setNeedsTruncation] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) setNeedsTruncation(ref.current.scrollHeight > 22)
  }, [text])
  return (
    <div className="overflow-hidden max-w-3xl relative" style={{ maxHeight: expanded ? 500 : 20, marginTop: 6, transition: 'max-height 250ms ease' }}>
      <div ref={ref} className="overflow-hidden" style={{ maxHeight: expanded ? 500 : 20 }}>
        <p className="text-[12px] text-slate-500 leading-[1.6]">
          {text}
          {expanded && needsTruncation && (
            <>
              {' '}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
                className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#0862D0] cursor-pointer align-baseline"
                style={{ fontWeight: 500 }}
              >
                Show less <ChevronUp className="w-3 h-3 inline" />
              </button>
            </>
          )}
        </p>
      </div>
      {!expanded && needsTruncation && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
          className="absolute right-0 bottom-0 bg-gradient-to-l from-white via-white to-transparent pl-6 pr-0 inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#0862D0] cursor-pointer"
          style={{ fontWeight: 500, lineHeight: '20px' }}
        >
          ... more <ChevronDown className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
