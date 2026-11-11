/* Ported from the financial reporting module (components/fr/comms/SystemNoticeCard.tsx).

   The card a system-issued chat message draws under its lead sentence.

   An automation's in-app notice used to be one long sentence with the file
   hanging under it, while the same delivery's email had grown a proper
   anatomy: greeting, one-line opening, then a key/value table of the facts
   (AutomatedEmailTemplate). The chat now reads the same way, and a little
   richer, because a chat can do what a mail cannot: the card carries the run's
   reference and two links, one straight to the report it is about and one to
   the automation that built it. The file itself stays under the card as the
   ordinary chat attachment row.

   The table is the email's `DetailTable` in its bare form, so the icons, the
   slate label column and the row rhythm are identical to the mail's.

   One addition on the port: `onNavigate`. The report and the automation both
   live outside this module, so a bare href would open a dead tab. Given a
   handler the links call it instead; left undefined they render exactly the
   anchors the source wrote.

   Colours are the source's own primitives, which resolve because this renders
   inside the tab's `data-comms` root. */
import { ArrowUpRight, FileText } from 'lucide-react'
import { DetailTable, type DetailRow } from './AutomatedEmailTemplate'

export interface SystemNoticeCardData {
  /** The sentence above the card - what arrived. */
  lead: string
  /** The facts, one row each. */
  rows: DetailRow[]
  /** The run's reference, printed in the card's header. */
  runId: string
  reportHref: string
  automationHref: string
}

/** The record chips in the conversation open in a new tab so the reader never
 *  loses their place in the channel (see MessageRichText); the card's links do
 *  the same, unless the host intercepts them. */
function CardLink({
  href,
  onActivate,
  children,
}: {
  href: string
  onActivate?: () => void
  children: string
}) {
  const className =
    'inline-flex items-center gap-1 text-[12.5px] text-[var(--color-sky-500)] hover:text-[var(--color-blue-650)] hover:underline'

  if (onActivate) {
    return (
      <button type="button" onClick={onActivate} className={className} style={{ fontWeight: 500 }}>
        {children}
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      style={{ fontWeight: 500 }}
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
    </a>
  )
}

/** The attachment is NOT inside the card: it renders under it as the ordinary
 *  chat attachment row, so a file reads the same whoever posted it and the card
 *  is not a box holding another box. */
export function SystemNoticeCard({
  card,
  onNavigate,
}: {
  card: SystemNoticeCardData
  /** Intercepts both links. Absent, they open their href in a new tab. */
  onNavigate?: (target: 'report' | 'automation', href: string) => void
}) {
  return (
    <div className="mt-1.5 w-full max-w-[560px] overflow-hidden rounded-lg border border-[var(--color-gray-200)] bg-white">
      {/* Header: what kind of thing this is, and its reference. */}
      <div
        className="flex items-center gap-2 border-b border-[var(--color-gray-200)] px-3.5 py-2"
        style={{ backgroundColor: 'var(--color-slate-50)' }}
      >
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: 'var(--color-brand-75)' }}
        >
          <FileText className="h-3.5 w-3.5 text-[var(--color-sky-500)]" strokeWidth={1.75} />
        </div>
        <span className="text-[12.5px] text-[var(--color-slate-900)]" style={{ fontWeight: 600 }}>
          Report Delivered
        </span>
        <span
          className="ml-auto text-[11px] text-[var(--color-slate-400)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {card.runId}
        </span>
      </div>

      {/* The facts, exactly as the email tables them. */}
      <DetailTable rows={card.rows} bare />

      {/* The two places a reader may want to go next. */}
      <div className="border-t border-[var(--color-gray-200)] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <CardLink
            href={card.reportHref}
            onActivate={onNavigate ? () => onNavigate('report', card.reportHref) : undefined}
          >
            Open Report
          </CardLink>
          <span className="text-[var(--color-slate-300)]" aria-hidden="true">·</span>
          <CardLink
            href={card.automationHref}
            onActivate={onNavigate ? () => onNavigate('automation', card.automationHref) : undefined}
          >
            Open Automation
          </CardLink>
        </div>
      </div>
    </div>
  )
}
