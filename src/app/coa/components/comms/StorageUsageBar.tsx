/* Ported from the financial reporting module (components/fr/comms/StorageUsageBar.tsx),
   which itself came from the quote-details inbox.

   Storage-usage meter pinned to the bottom of the conversation pane. The
   compact caption opens a dark-header hover card - the same anatomy as
   RecordRefHoverCard - breaking down the total inbox storage, with a Settings
   link.

   Once usage crosses `warnThreshold` the meter enters a Gmail-style "almost
   full" state: the bar and caption turn red and a warning banner prompts the
   reader to free up space.

   Two substitutions on the port. The source's shared `Progress` is two plain
   divs here, because this module has no such primitive and a 1px track does
   not need one. The source's Radix tooltip is a portalled card, because it
   asked its tooltip for `border-0 bg-transparent p-0` - a naked surface the
   module's own Tooltip cannot express, since it always draws its own white
   box. The portalled wrapper re-declares `data-comms` because <body> is
   outside the tab root, so the source's colour primitives are still written
   exactly as it wrote them. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HardDrive, Database, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'

const CLOSE_GRACE_MS = 200

/** The shared bar. `track`/`fill` carry the height and colour so the 1px
 *  caption meter and the 1.5px card meter stay one thing. */
function Meter({
  percent,
  className,
  fill,
  label,
}: {
  percent: number
  className?: string
  fill: string
  label?: string
}) {
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-[var(--color-slate-200)]', className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: fill }} />
    </div>
  )
}

export function StorageUsageBar({
  usedGb = 0.78,
  totalGb = 1.5,
  warnThreshold = 80,
  label = 'Inbox storage',
  bannerTitle = 'Your inbox is almost full',
  className,
  onManage,
}: {
  usedGb?: number
  totalGb?: number
  /** Usage percentage at which the "almost full" warning state kicks in. */
  warnThreshold?: number
  /** Hover-card subtitle, e.g. "Chat storage" or "Email storage". */
  label?: string
  /** Warning banner heading, e.g. "Your email inbox is almost full". */
  bannerTitle?: string
  className?: string
  onManage?: () => void
}) {
  const percent = Math.min(100, Math.round((usedGb / totalGb) * 100))
  const freeGb = Math.max(0, totalGb - usedGb)
  // Sub-GB amounts read cleaner in MB (e.g. "400 MB" instead of "0.4 GB").
  const fmt = (n: number) => (n < 1 ? `${Math.round(n * 1000)} MB` : `${Number(n.toFixed(2))} GB`)
  const isNearFull = percent >= warnThreshold

  // Bar fill flips from neutral slate → red once storage is almost full.
  const barFill = isNearFull ? 'var(--color-red-600)' : 'var(--color-slate-500)'

  const [open, setOpen] = useState(false)
  // Anchored bottom-up so the card's height need not be measured: it sits
  // above the caption whatever it grows to.
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null)
  const captionRef = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const handleEnter = useCallback(() => {
    clearTimer()
    const rect = captionRef.current?.getBoundingClientRect()
    if (rect) {
      setAnchor({
        // side="top" align="start", sideOffset 4 - the tooltip's defaults.
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 264)),
        bottom: window.innerHeight - rect.top + 4,
      })
    }
    setOpen(true)
  }, [])

  // The 4px gap between caption and card is not hoverable, so without a grace
  // period the card closes on the way to it.
  const scheduleClose = useCallback(() => {
    clearTimer()
    timer.current = setTimeout(() => setOpen(false), CLOSE_GRACE_MS)
  }, [])

  useEffect(() => () => clearTimer(), [])

  return (
    <div className={cn('shrink-0 w-full border-t border-[var(--color-slate-200)] bg-white px-4 pt-4 pb-2.5', className)}>
      {/* Gmail-style "almost full" warning - mirrors the module's existing
          inline banner pattern: tinted rounded box, icon in the same colour
          family as the copy, and a subtle (non-primary) action button. */}
      {isNearFull && (
        <div className="mb-3 flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] text-red-800" style={{ fontWeight: 600 }}>{bannerTitle}</p>
            <p className="text-[11.5px] text-red-700/80 leading-relaxed">
              You're using {fmt(usedGb)} of {fmt(totalGb)} ({percent}%). Free up space to keep
              sending and receiving emails.
            </p>
            <button
              type="button"
              onClick={onManage}
              className="mt-2 inline-flex items-center h-7 px-2.5 rounded-md border border-red-300 bg-white text-[11.5px] text-red-700 hover:bg-red-50 transition-colors"
              style={{ fontWeight: 500 }}
            >
              Manage storage
            </button>
          </div>
        </div>
      )}

      <div className="w-[20%]">
        <Meter
          percent={percent}
          className="h-1"
          fill={barFill}
          label={`${percent}% of ${totalGb} GB storage used`}
        />
        <button
          ref={captionRef}
          type="button"
          onMouseEnter={handleEnter}
          onMouseLeave={scheduleClose}
          onFocus={handleEnter}
          onBlur={scheduleClose}
          className={cn(
            'mt-1.5 text-[11px] transition-colors cursor-pointer',
            isNearFull
              ? 'text-red-600 hover:text-red-700'
              : 'text-[var(--color-slate-500)] hover:text-[var(--color-slate-900)]',
          )}
          style={{ fontWeight: 500 }}
        >
          {percent}% of {fmt(totalGb)} used
        </button>
        {open && anchor && (
          <StorageHoverCard
            anchor={anchor}
            onMouseEnter={clearTimer}
            onMouseLeave={scheduleClose}
            isNearFull={isNearFull}
            percent={percent}
            barFill={barFill}
            label={label}
            total={fmt(totalGb)}
            used={fmt(usedGb)}
            free={fmt(freeGb)}
            onManage={onManage}
          />
        )}
      </div>
    </div>
  )
}

function StorageHoverCard({
  anchor,
  onMouseEnter,
  onMouseLeave,
  isNearFull,
  percent,
  barFill,
  label,
  total,
  used,
  free,
  onManage,
}: {
  anchor: { left: number; bottom: number }
  onMouseEnter: () => void
  onMouseLeave: () => void
  isNearFull: boolean
  percent: number
  barFill: string
  label: string
  total: string
  used: string
  free: string
  onManage?: () => void
}) {
  return createPortal(
    <div
      data-comms
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="w-64 overflow-hidden rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.08)]"
      style={{
        position: 'fixed',
        left: anchor.left,
        bottom: anchor.bottom,
        zIndex: 9999,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Dark header - icon tile + total storage title, matching the record
          hover card. */}
      <div className="flex items-center gap-2.5 bg-[var(--color-slate-800)] px-3.5 py-2.5">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
            isNearFull
              ? 'border-red-300/40 bg-red-500/15 text-red-300'
              : 'border-[var(--color-blue-100)] bg-[var(--color-blue-50)] text-[var(--color-sky-500)]',
          )}
        >
          <HardDrive className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] leading-tight text-white" style={{ fontWeight: 600 }}>{total}</div>
          <div className="mt-0.5 text-[11px] text-white/65">{label}</div>
        </div>
      </div>
      {/* Light body - usage breakdown + action link. */}
      <div className="flex flex-col gap-2 bg-white px-3.5 py-2.5">
        <Meter percent={percent} className="h-1.5" fill={barFill} />
        <div className="flex items-center gap-2">
          <Database className="h-[13px] w-[13px] shrink-0 text-[var(--color-slate-500)]" />
          <span className="text-[12px] text-[var(--color-slate-700)]">
            <span className="text-[var(--color-slate-900)]" style={{ fontWeight: 600 }}>{used}</span> of {total} used ({percent}%)
          </span>
        </div>
        {isNearFull ? (
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-[13px] w-[13px] shrink-0 text-red-500" />
            <span className="text-[12px] text-red-600" style={{ fontWeight: 500 }}>Almost full — {free} left</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-[13px] w-[13px] shrink-0 text-[var(--color-green-500)]" />
            <span className="text-[12px] text-[var(--color-slate-700)]">{free} free</span>
          </div>
        )}
        <button
          type="button"
          onClick={onManage}
          className="h-auto justify-start p-0 text-left text-[11px] text-[var(--color-sky-500)] hover:no-underline"
          style={{ fontWeight: 500 }}
        >
          Manage storage in Settings
        </button>
      </div>
    </div>,
    document.body,
  )
}
