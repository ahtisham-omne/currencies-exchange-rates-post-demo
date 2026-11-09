/* Ported from the financial reporting module
   (components/fr/comms/AutomatedEmailTemplate.tsx).

   The shell every message from no-reply@omnesoft.com renders in.

   The body is still a STRING, which is the load-bearing part: reply, forward,
   compose, search and the thread preview all read the same text, so the table
   below is a rendering of the mail rather than a second source of it. */
import React from 'react'
import {
  Activity, CalendarClock, CalendarRange, Clock, FileText, FileType2, Gauge,
  Landmark, Layers, LayoutTemplate, Mail, Paperclip, PencilLine, Scale, User,
  Workflow, Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const AUTOMATED_LABEL_STYLES: Record<string, { bg: string; fg: string; valueClass?: string }> = {
  Sent: { bg: 'var(--color-slate-100)', fg: 'var(--color-slate-600)' },
  Read: { bg: 'var(--color-green-100)', fg: 'var(--color-green-800)', valueClass: 'text-[var(--color-green-800)]' },
  Delivered: { bg: 'var(--color-green-100)', fg: 'var(--color-green-800)', valueClass: 'text-[var(--color-green-800)]' },
  Failed: { bg: 'var(--color-red-100)', fg: 'var(--color-red-800)', valueClass: 'text-[var(--color-red-800)]' },
  Reason: { bg: 'var(--color-red-100)', fg: 'var(--color-red-800)' },
  Subject: { bg: 'var(--color-brand-75)', fg: 'var(--color-sky-500)' },
  To: { bg: 'var(--color-slate-100)', fg: 'var(--color-slate-600)' },
  'What to do next': { bg: 'var(--color-amber-100)', fg: 'var(--color-amber-800)' },
}

export function AutomatedEmailTemplate({ body }: { body: string }) {
  return (
    <div>
      {/* The pane already names "Omne System" above this, so the mark
          identifies the mail rather than repeating the address. */}
      <OmneWordmark />
      <AutomatedEmailBody body={body} />
    </div>
  )
}

/* Drawn rather than fetched. The source points an <img> at
   omnesoft.com/assets/brand-logo.svg, and a demo that renders a broken image
   when it cannot reach the network is worse than one that owns its mark. */
function OmneWordmark() {
  return (
    <div className="flex items-center gap-1 mb-4" aria-label="Omne">
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" role="presentation">
        <path
          d="M12 3.6a8.4 8.4 0 1 0 5.94 2.46"
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>
      <span
        className="text-[17px] leading-none"
        style={{ fontWeight: 600, color: 'var(--color-brand-500)', letterSpacing: '-0.01em' }}
      >
        omne
      </span>
    </div>
  )
}

/* ─── The detail table ──────────────────────────────────────────────────────
   Every automated template writes its facts the same way: a bare caption line
   ("Report Details:") and then one `• Label: value` per fact. That is a table,
   so it is drawn as one. The icon is chosen from the LABEL, which is why one
   renderer serves every template without being told which it has. */
const DETAIL_ICONS: Record<string, LucideIcon> = {
  account: Landmark,
  accounts: Landmark,
  entry: FileText,
  period: CalendarRange,
  generated: Clock,
  automation: Zap,
  trigger: Workflow,
  'sent to': Mail,
  recipient: Mail,
  recipients: Mail,
  attachment: Paperclip,
  format: FileType2,
  status: Activity,
  change: PencilLine,
  template: LayoutTemplate,
  'changed by': User,
  'posted by': User,
  'raised by': User,
  'applies from': CalendarClock,
  'next run': CalendarClock,
  'grouped by': Layers,
  bucket: Layers,
  balance: Scale,
  amount: Scale,
  limit: Gauge,
  owner: User,
  'requested by': User,
  report: FileText,
  reports: FileText,
}

export interface DetailRow { label: string; value: string }

/** A caption is a line that is nothing but `Words:` with no value after it. */
function captionOf(line: string): string | null {
  const m = line.trim().match(/^([A-Za-z][A-Za-z ]{1,40}):$/)
  return m ? m[1] : null
}

/** A bullet, with its `Label: value` split when it has one. The label charset
 *  admits record names, because a mail covering several writes one row per
 *  record, the record as the label and its own figure as the value. */
function bulletOf(line: string): DetailRow | null {
  const m = line.trim().match(/^[•·*-]\s+(.*)$/)
  if (!m) return null
  const rest = m[1]
  const split = rest.match(/^([A-Za-z][A-Za-z0-9 ()&#+.'/-]{1,60}):\s*(.*)$/)
  return split ? { label: split[1], value: split[2] } : { label: '', value: rest }
}

/** The key/value table. `bare` drops the caption and the outer border, for a
 *  table sitting inside a card that already has both. */
export function DetailTable({ caption, rows, bare }: { caption?: string; rows: DetailRow[]; bare?: boolean }) {
  return (
    <div className={bare ? undefined : 'mt-1 mb-1'}>
      {caption && (
        <div className="text-[12.5px] mb-2" style={{ fontWeight: 600, color: 'var(--color-slate-900)' }}>
          {caption}
        </div>
      )}
      {/* The label column is sized BY ITS CONTENT: a row's label can be a whole
          account name, and a fixed width truncated it. */}
      <div
        className={`overflow-hidden grid${bare ? '' : ' rounded-lg border border-[var(--color-gray-200)]'}`}
        style={{ gridTemplateColumns: 'max-content 1fr' }}
      >
        {rows.map((row, i) => {
          /* An unmapped label is almost always a record naming its own figure,
             so the fallback is the record glyph rather than a generic tag. */
          const Icon = DETAIL_ICONS[row.label.toLowerCase()] ?? FileText
          const divider = i > 0 ? ' border-t border-[var(--color-gray-200)]' : ''
          /* A bullet with no label spans the row, so a template that writes a
             plain sentence into the block does not lose it. */
          if (!row.label) {
            return (
              <div
                key={i}
                className={`col-span-2 px-3.5 py-2.5 text-[13px]${divider}`}
                style={{ color: 'var(--color-slate-700)' }}
              >
                {row.value}
              </div>
            )
          }
          return (
            <React.Fragment key={i}>
              <div
                className={`flex items-center gap-2 px-3.5 py-2.5 border-r border-[var(--color-gray-200)]${divider}`}
                style={{ backgroundColor: 'var(--color-slate-50)' }}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-slate-400)' }} strokeWidth={1.75} />
                <span className="text-[12.5px] whitespace-nowrap" style={{ color: 'var(--color-slate-500)' }}>{row.label}</span>
              </div>
              <div
                className={`px-3.5 py-2.5 text-[13px] min-w-0${divider}`}
                style={{ fontWeight: 500, lineHeight: 1.5, color: 'var(--color-slate-900)' }}
              >
                {row.value}
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

export function AutomatedEmailBody({ body }: { body: string }) {
  const lines = body.split('\n')
  /* Everything after the `---` rule is fine print. Without this the rule
     rendered as three literal hyphens and the sign-off after it read at full
     body weight, so a real email's quietest line was one of its loudest. */
  const ruleAt = lines.findIndex(l => /^-{3,}$/.test(l.trim()))

  const out: React.ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isFine = ruleAt !== -1 && i > ruleAt

    /* A caption whose next line is a bullet opens a detail table, and every
       bullet up to the first non-bullet is consumed into it. */
    const caption = isFine ? null : captionOf(line)
    if (caption && bulletOf(lines[i + 1] ?? '')) {
      const rows: DetailRow[] = []
      let j = i + 1
      for (; j < lines.length; j++) {
        const row = bulletOf(lines[j])
        if (!row) break
        rows.push(row)
      }
      out.push(<DetailTable key={i} caption={caption} rows={rows} />)
      i = j - 1
      continue
    }

    if (/^-{3,}$/.test(line.trim())) {
      out.push(<div key={i} className="mt-4 mb-2 border-t border-[var(--color-gray-200)]" />)
      continue
    }
    if (line.trim() === '') {
      out.push(<div key={i} className="h-2" />)
      continue
    }
    if (isFine) {
      out.push(
        <div key={i} className="text-[11.5px] italic" style={{ lineHeight: 1.5, color: 'var(--color-slate-400)' }}>
          {line}
        </div>,
      )
      continue
    }
    const match = line.match(/^([A-Za-z][A-Za-z ]{1,30}):\s*(.+)$/)
    const style = match ? AUTOMATED_LABEL_STYLES[match[1]] : undefined
    if (!match || !style) {
      out.push(<div key={i}>{line}</div>)
      continue
    }
    const [, label, value] = match
    out.push(
      <div key={i} className="flex items-baseline gap-1.5 flex-wrap">
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] leading-none shrink-0"
          style={{ fontWeight: 600, backgroundColor: style.bg, color: style.fg }}
        >
          {label}
        </span>
        <span className={`text-[13px]${style.valueClass ? ` ${style.valueClass}` : ''}`} style={{ fontWeight: style.valueClass ? 600 : 400 }}>
          {value}
        </span>
      </div>,
    )
  }

  return (
    <div
      className="whitespace-normal space-y-1 text-[13px]"
      style={{ lineHeight: 1.6, color: 'var(--color-slate-700)' }}
    >
      {out}
    </div>
  )
}
