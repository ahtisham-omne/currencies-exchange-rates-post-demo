import { ReactNode, useEffect, useRef, useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import { Tooltip } from './ui'
import { cn } from '../lib/utils'

// Ported from Partner Management - Vendors' DashInfoCard / DashInfoLabel
// (VendorDetailsPage): the collapsible dashboard info card with an accent
// icon tile, 12px/600 title, animated chevron, hairline separator, and
// label-above-value field typography (10px slate-400 label, 12px slate-700
// value). Use for detail-page sidebar cards like Account Information.

export function DashInfoCard({ title, icon: Icon, count, tooltip: cardTooltip, children, defaultOpen = true, tone }: {
  title: string
  /** An alert card (a flag): its count reads amber. Only the count - the
      frame and icon tile stay as every card has them (Mahad, 2026-10-02). */
  tone?: 'warning'
  icon?: React.ElementType
  count?: number
  tooltip?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined)

  /* Followed rather than read once, so content that grows on its own - an
     editor opening inside the card, a message under it - is not clipped by a
     height measured before it was there. */
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    setContentHeight(el.scrollHeight)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setContentHeight(el.scrollHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [children])

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <button
        type="button"
        className="w-full px-3.5 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-[#FAFBFC] transition-colors"
        style={{ borderBottom: isOpen ? '1px solid #F1F5F9' : 'none' }}
        onClick={() => setIsOpen(v => !v)}
      >
        {Icon && (
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
            <Icon className="w-3 h-3 text-primary" />
          </div>
        )}
        <span className="text-[12px] text-slate-700 text-left" style={{ fontWeight: 600 }}>{title}</span>
        {cardTooltip && (
          <Tooltip content={cardTooltip} side="bottom">
            <span className="inline-flex shrink-0" onClick={(e) => e.stopPropagation()}>
              <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
            </span>
          </Tooltip>
        )}
        {count != null && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md', tone === 'warning' ? 'text-amber-700 bg-amber-100' : 'text-primary bg-accent')} style={{ fontWeight: 600 }}>{count}</span>
        )}
        <ChevronDown
          className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{
          maxHeight: isOpen ? (contentHeight != null ? contentHeight + 24 + 'px' : '1000px') : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="px-3.5 py-3">{children}</div>
      </div>
    </div>
  )
}

/* ── Small label for dashboard info fields ── */
export function DashInfoLabel({ children, tooltip: labelTooltip, align = 'left', rich }: {
  children: ReactNode
  tooltip?: ReactNode
  align?: 'left' | 'center' | 'right'
  /** The tooltip supplies its own card chrome and padding (see RoleTooltip). */
  rich?: boolean
}) {
  return (
    <div className="flex items-center gap-1 mb-px">
      <p className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{children}</p>
      {labelTooltip && (
        <Tooltip rich={rich} content={labelTooltip} side="bottom" align={align}>
          <span className="inline-flex shrink-0"><Info className="w-2.5 h-2.5 text-[#D1D5DB] hover:text-slate-400 transition-colors cursor-help" /></span>
        </Tooltip>
      )}
    </div>
  )
}
