// Ported from chart-of-accounts-v2.1/src/components/comms/RecordRefHoverCard.tsx; adapted: previews a currency or an exchange rate out of the store instead of an account or a journal entry.
/* Ported from the financial reporting module (components/fr/comms/RecordRefHoverCard.tsx).

   Hovering the record chip on a thread reveals the record it is filed against:
   a dark header with the reference and the kind, then a light body naming the
   record, its status and who or when. Same family as PersonHoverCard so the two
   read as one thing.

   Where the source hashed a fake status and owner out of the id, this reads the
   real currency or rate out of the store. A demo where the chip on a thread
   about USD previews some other currency's status is worse than no preview.

   Hand-rolled for the same reasons PersonHoverCard is, and the chip tints come
   from `entityRef.tsx` rather than a second colour table. The portalled wrapper
   re-declares `data-comms` because <body> is outside the tab root, so the
   source's colour primitives are still written exactly as it wrote them. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, CircleDot, FileText, User as UserIcon } from 'lucide-react'
import { longDate, type CommRecordKind } from '../../lib/comms'
import { useStore } from '../../store'
import { ENTITY_META, entityLabelOf, formatEntityRef } from './entityRef'

const CLOSE_GRACE_MS = 300

/* The source's five status colours, reused for this module's statuses so a
   record keeps the weight it had there. */
const CURRENCY_STATUS_COLOR: Record<string, string> = {
  Active: 'var(--color-green-600)',
  Inactive: 'var(--color-amber-600)',
  Archived: 'var(--color-slate-400)',
}

const RATE_STATUS_COLOR: Record<string, string> = {
  Active: 'var(--color-emerald-600)',
  Archived: 'var(--color-slate-400)',
}

interface RecordPreview {
  name: string
  status: string
  statusColor: string
  /** Who last changed a currency, or when a rate took effect. */
  meta: string
  metaIcon: 'person' | 'date'
}

export function RecordRefHoverCard({
  recordId,
  module,
  children,
}: {
  /** Full record reference as stored, e.g. "CUR-USD", "CR-USD/PKR". */
  recordId: string
  /** Drives the header label and accent. Falls back to "Other" when undefined. */
  module?: CommRecordKind
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currencies = useStore(s => s.currencies)
  const midMarketRates = useStore(s => s.midMarketRates)
  const standardRates = useStore(s => s.standardRates)

  const kind: CommRecordKind = module ?? 'Other'
  const meta = ENTITY_META[kind] ?? ENTITY_META.Other
  const ref = formatEntityRef(recordId)

  let preview: RecordPreview | null = null
  if (kind === 'Currency') {
    const currency = currencies.find(c => c.code === ref)
    if (currency) {
      const status = currency.status === 'active' ? 'Active' : 'Inactive'
      preview = {
        name: currency.name,
        status,
        statusColor: CURRENCY_STATUS_COLOR[status] ?? 'var(--color-slate-400)',
        meta: currency.auditLog[0]?.changedBy ?? 'System',
        metaIcon: 'person',
      }
    }
  } else if (kind === 'Exchange Rate') {
    const code = ref.split('/')[0]
    if (recordId.startsWith('CR-')) {
      const mine = standardRates.filter(r => r.sourceCurrency === code)
      const rate = mine.find(r => r.status === 'active') ?? [...mine].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      if (rate) {
        const status = rate.status === 'active' ? 'Active' : 'Archived'
        preview = {
          name: `${rate.sourceCurrencyName} corporate rate`,
          status,
          statusColor: RATE_STATUS_COLOR[status] ?? 'var(--color-slate-400)',
          meta: longDate(rate.effectiveDate),
          metaIcon: 'date',
        }
      }
    } else {
      const rate = midMarketRates.find(r => r.sourceCurrency === code)
      if (rate) {
        preview = {
          name: `${rate.sourceCurrencyName} mid-market rate`,
          status: 'Active',
          statusColor: RATE_STATUS_COLOR.Active,
          meta: longDate(rate.effectiveDate),
          metaIcon: 'date',
        }
      }
    }
  }

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const handleEnter = useCallback(() => {
    clearTimer()
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 })
    setOpen(true)
  }, [])

  // The 6px gap between chip and card is not hoverable, so without a grace
  // period the card closes on the way to it.
  const scheduleClose = useCallback(() => {
    clearTimer()
    timer.current = setTimeout(() => setOpen(false), CLOSE_GRACE_MS)
  }, [])

  useEffect(() => () => clearTimer(), [])

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={scheduleClose}
      style={{ display: 'inline-flex', minWidth: 0 }}
    >
      {children}
      {open && pos && createPortal(
        <div
          data-comms
          onMouseEnter={clearTimer}
          onMouseLeave={scheduleClose}
          style={{
            position: 'fixed',
            left: Math.min(pos.x - 130, window.innerWidth - 280),
            top: pos.y,
            width: 260,
            zIndex: 9999,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            fontFamily: 'Inter, system-ui, sans-serif',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ background: 'var(--color-slate-800)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: meta.bg,
                color: meta.color,
                border: `1px solid ${meta.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
                letterSpacing: 0.2,
              }}
            >
              {kind.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-white)', lineHeight: 1.2 }}>{ref}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{entityLabelOf(kind)}</div>
            </div>
          </div>
          <div style={{ background: 'var(--color-white)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {preview ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <FileText style={{ width: 13, height: 13, color: 'var(--color-slate-400)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--color-slate-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {preview.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CircleDot style={{ width: 13, height: 13, color: preview.statusColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--color-slate-700)' }}>{preview.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {preview.metaIcon === 'person'
                    ? <UserIcon style={{ width: 13, height: 13, color: 'var(--color-slate-400)', flexShrink: 0 }} />
                    : <Calendar style={{ width: 13, height: 13, color: 'var(--color-slate-400)', flexShrink: 0 }} />}
                  <span style={{ fontSize: 12, color: 'var(--color-slate-700)' }}>{preview.meta}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CircleDot style={{ width: 13, height: 13, color: 'var(--color-slate-400)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--color-slate-700)' }}>
                  {kind === 'Other' ? 'Not filed against a record' : 'Record not found'}
                </span>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
