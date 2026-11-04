// Ported from chart-of-accounts-v2.1/src/components/AccountTable.tsx (STATUS_CHIP, StatusChip, STATUS_VERB, StatusMenu); adapted: generic over the status values - colours come from a tone (CoA's Active / Inactive / Archived palette by default), and the menu takes its options, verbs and meaning lines as props.
import type { ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'
import { Marked, Menu } from './ui'

export interface StatusChipColours { bg: string; text: string; border: string }

/* Status chip matching the Partners table Status column: a rounded-full pill,
   emerald for Active / amber for Inactive / rose for Archived, no dot. */
export const STATUS_TONES = {
  active: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  inactive: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  archived: { bg: '#FEF2F2', text: '#9F1239', border: '#FECDD3' },
  // Not in CoA's three; the same recipe in slate and blue for a status that is
  // neither live nor out of service (e.g. "Draft", "Scheduled").
  neutral: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
  info: { bg: '#EFF6FF', text: '#1D4ED8', border: '#DBEAFE' },
} satisfies Record<string, StatusChipColours>
export type StatusTone = keyof typeof STATUS_TONES

/** Which tone a status name takes when the caller does not say. */
export function toneOfStatus(status: string): StatusTone {
  const s = status.toLowerCase()
  if (s === 'active') return 'active'
  if (s === 'inactive') return 'inactive'
  if (s === 'archived' || s === 'deleted') return 'archived'
  return 'neutral'
}

export function StatusChip({ status, tone, chevron, label, q = '' }: {
  /** The state's name, as the chip prints it ("Active"). */
  status: string
  /** Colours; defaults from the status name (Active / Inactive / Archived). */
  tone?: StatusTone
  chevron?: boolean
  /** A table search, marked in the chip. */
  q?: string
  /** Overrides the text while keeping the state's colours, so an option can read
   *  as the verb it performs ("Deactivate") and the chip as the state it is. */
  label?: string
}) {
  const c = STATUS_TONES[tone ?? toneOfStatus(status)]
  // The chevron is the whole difference between a chip that states the status and
  // one that changes it, so it decides the element too: a control is a button and
  // a label is not.
  const Tag = chevron ? 'button' : 'span'
  return (
    <Tag
      {...(chevron ? { type: 'button' as const, 'aria-haspopup': 'menu' as const, 'aria-label': `Status: ${status}. Change status` } : {})}
      className={cn(
        // Fixed 22px height matching .chip so the status pill sits flush with
        // the other header chips.
        'inline-flex items-center justify-center rounded-full border px-2.5 h-[22px] text-xs whitespace-nowrap shrink-0 gap-1',
        // Interactive variant: chevron inside the pill + hover ring on the chip.
        chevron && 'cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-offset-1 hover:ring-border',
      )}
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border, fontWeight: 500 }}
    >
      <Marked text={label ?? status} q={q} />
      {chevron && <ChevronDown className="w-3 h-3" />}
    </Tag>
  )
}

/** One state the menu offers. */
export interface StatusOption<S extends string = string> {
  value: S
  /** The chip's text for the current state; defaults to `value`. */
  label?: string
  /** What the option reads as when it is not the current state ("Deactivate"). */
  verb: string
  /** One short line per kind of record, what the state means. */
  meaning: ReactNode[]
  tone?: StatusTone
}

/* The status cell as a control: every state on show with what each one means,
   so the reader picks the state instead of hunting for the verb in the row menu.
   Every pick goes out through `onPick`, which should hand it to the page's
   lifecycle flow, so it meets the same rules and confirmations as the menu does. */
export function StatusMenu<S extends string>({ status, options, onPick, q = '', readOnly }: {
  status: S
  options: StatusOption<S>[]
  onPick: (next: S) => void
  q?: string
  /** A status that cannot change here (e.g. a mid-market rate): a plain chip. */
  readOnly?: boolean
}) {
  const current = options.find(o => o.value === status)
  const tone = current?.tone
  if (readOnly) return <StatusChip status={current?.label ?? status} tone={tone} q={q} />
  return (
    // The row opens the record on click, and choosing a status is not that.
    <span onClick={e => e.stopPropagation()} className="inline-flex">
      <Menu align="left" flush trigger={<StatusChip status={current?.label ?? status} tone={tone} chevron q={q} />}>
        {close => (
          <div className="w-[min(440px,calc(100vw-32px))] p-2 space-y-0.5">
            {options.map(o => {
              const isCurrent = o.value === status
              return (
                <button
                  key={o.value}
                  onClick={() => { close(); if (!isCurrent) onPick(o.value) }}
                  className={cn('w-full text-left rounded-md border p-3 transition-colors',
                    isCurrent ? 'bg-accent border-[#D0E3F7] cursor-default' : 'border-transparent hover:bg-bg-subtle')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusChip status={o.label ?? o.value} tone={o.tone} label={isCurrent ? (o.label ?? o.value) : o.verb} />
                    {isCurrent && <Check className="w-3.5 h-3.5 text-fg-subtle shrink-0" />}
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {o.meaning.map((line, i) => (
                      <p key={i} className="text-xs leading-[17px] text-fg-muted">{line}</p>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Menu>
    </span>
  )
}
