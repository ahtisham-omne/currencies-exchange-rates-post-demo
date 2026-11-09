/* Ported from the financial reporting module (components/fr/comms/PersonHoverCard.tsx,
   whose own export delegates to components/fr/PersonHoverCard.tsx - that
   delegate is the implementation, so it is what is reproduced here).

   Hovering a sender reveals a dark-header card with their role and contact
   details; clicking opens the full contact card. The 250ms delay before opening
   and the 300ms grace before closing are the source's: without the grace the
   card closes on the way to it, and its rows are meant to be readable.

   Hand-rolled rather than built on this module's `Tooltip rich`, which cannot
   express any of what a hover card is: it positions on mouseEnter with no
   delay, drops its content the moment the pointer leaves the trigger, has no
   notion of a click-through, and draws its own light card and caret over the
   dark header this one needs.

   The card portals so it is never clipped by the thread list's scroll
   container, and its wrapper re-declares `data-comms`: <body> is outside the
   tab root, so without it the source's colour primitives would resolve to
   nothing. Every colour below is therefore still the source's own. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Briefcase, Mail, Phone } from 'lucide-react'
import { senderTint } from '../../lib/comms'
import { getInitials, getPersonDetail } from './peopleData'
import { PersonContactCardModal } from './PersonContactCardModal'

const OPEN_DELAY_MS = 250
const CLOSE_GRACE_MS = 300

const FONT = 'Inter, system-ui, sans-serif'

function HoverDetailCard({ name, email }: { name: string; email?: string }) {
  const person = getPersonDetail(name, email)
  const tint = senderTint(person.name, person.email)
  return (
    <div
      data-comms
      style={{
        background: 'var(--color-white)',
        border: '1px solid var(--color-slate-200)',
        borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        fontFamily: FONT,
      }}
    >
      <div className="flex items-center" style={{ padding: '14px 16px', gap: 12, background: 'var(--color-slate-800)' }}>
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 44,
            height: 44,
            borderRadius: 9999,
            background: tint.bg,
            border: '2px solid color-mix(in srgb, var(--color-white) 20%, transparent)',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: tint.fg }}>{getInitials(person.name)}</span>
        </div>
        <div className="flex flex-col" style={{ minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {person.name}
          </span>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'color-mix(in srgb, var(--color-white) 60%, transparent)', whiteSpace: 'nowrap' }}>
            {person.role}
          </span>
        </div>
      </div>
      <div style={{ padding: '10px 16px 14px' }}>
        <div className="flex flex-col" style={{ gap: 10 }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <Mail size={14} style={{ color: 'var(--color-slate-400)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--color-slate-900)' }}>{person.email}</span>
          </div>
          {person.phone && (
            <div className="flex items-center" style={{ gap: 10 }}>
              <Phone size={14} style={{ color: 'var(--color-slate-400)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--color-slate-900)' }}>{person.phone}</span>
            </div>
          )}
          <div className="flex items-center" style={{ gap: 10 }}>
            <Briefcase size={14} style={{ color: 'var(--color-slate-400)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--color-slate-900)' }}>{person.department}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface PersonHoverCardProps {
  name: string
  /** The address the thread carries. Used only when the name is off the roster. */
  email?: string
  /** Accepted for call-site compatibility. The card derives them from the name. */
  initials?: string
  children: ReactNode
  noHoverBg?: boolean
  /** When true (default), clicking the trigger opens the contact card. */
  clickable?: boolean
  /** Fires when the card or the contact modal opens or closes, so a host overlay can pin itself open. */
  onOpenChange?: (open: boolean) => void
}

export function PersonHoverCard({ name, email, children, noHoverBg, clickable = true, onOpenChange }: PersonHoverCardProps) {
  const [open, setOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const handleEnter = useCallback(() => {
    clearTimer()
    timer.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) setPos({ top: rect.bottom + 6, left: rect.left })
      setOpen(true)
    }, OPEN_DELAY_MS)
  }, [])

  const scheduleClose = useCallback(() => {
    clearTimer()
    timer.current = setTimeout(() => setOpen(false), CLOSE_GRACE_MS)
  }, [])

  useEffect(() => () => clearTimer(), [])

  // Reported on transitions only, and settled on unmount, so a host that pins
  // itself open is not left pinned by a card that has gone away.
  const anyOpen = open || modalOpen
  const report = useRef(onOpenChange)
  report.current = onOpenChange
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current === anyOpen) return
    wasOpen.current = anyOpen
    report.current?.(anyOpen)
  }, [anyOpen])
  useEffect(() => () => { if (wasOpen.current) report.current?.(false) }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!clickable) return
    e.stopPropagation()
    clearTimer()
    setOpen(false)
    setModalOpen(true)
  }, [clickable])

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={e => {
          handleEnter()
          if (!noHoverBg) {
            e.currentTarget.style.background = 'var(--color-brand-50)'
            e.currentTarget.style.borderRadius = '6px'
          }
        }}
        onMouseLeave={e => {
          scheduleClose()
          if (!noHoverBg) e.currentTarget.style.background = 'transparent'
        }}
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          minWidth: 0,
          cursor: clickable ? 'pointer' : 'default',
          padding: noHoverBg ? 0 : '2px 4px',
          margin: noHoverBg ? 0 : '-2px -4px',
          borderRadius: 4,
          transition: 'background 0.18s ease',
        }}
      >
        {children}
      </span>
      {open && !modalOpen && createPortal(
        <div
          onMouseEnter={clearTimer}
          onMouseLeave={scheduleClose}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, minWidth: 260, maxWidth: 320 }}
        >
          <HoverDetailCard name={name} email={email} />
        </div>,
        document.body,
      )}
      {modalOpen && (
        <PersonContactCardModal
          open
          name={name}
          email={email}
          initials={getInitials(name)}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
