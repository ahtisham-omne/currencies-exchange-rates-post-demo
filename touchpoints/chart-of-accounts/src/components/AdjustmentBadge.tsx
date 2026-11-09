import { AlertTriangle } from 'lucide-react'
import { Badge, Marked, Tooltip } from './ui'
import { cn } from '../lib/utils'
import type { AdjustmentKind } from '../lib/journalEntry'

/* ───────────────── Posted by hand to a system-kept account ─────────────────
   The mark an adjustment carries wherever it is listed: on the line that made
   it one on the entry's page, and in the ledger on both tabs - the General
   ledger tab's posting, and on the Journal entries tab both the entry and that
   line. Mahad, 2026-10-05: *"can we also have a more prominent badge than this?
   Please make sure to use it in the listing table as well both in general
   ledger and journal entries. please use our own UI patterns not anything
   new."* So it is the module's warning Badge with its icon, the shape the
   Confidential mark on a thread already takes, and it replaces a bare triangle
   that read as a stray glyph beside the account name. */

export const ADJUSTMENT_FLAG: Record<AdjustmentKind, string> = {
  'retained-earnings': 'Retained earnings adjustment',
  control: 'Control account adjustment',
}

export const ADJUSTMENT_WHY: Record<AdjustmentKind, string> = {
  'retained-earnings': 'Retained earnings is normally kept by the year-end close. This line was posted by hand.',
  control: 'This balance normally comes from invoices, bills or payments. This line was posted by hand.',
}

/** What the badge prints, for a search to read. */
export const ADJUSTMENT_BADGE_LABEL = 'Adjustment'

/** The badge, with what kind of adjustment it is on hover. An entry passes every
 *  kind its lines hold; a line passes its own. `compact` keeps the chip and its
 *  icon and puts the word in the hover, for a cell the reader has dragged too
 *  narrow to hold both it and the entry number it sits beside. */
export function AdjustmentBadge({ kinds, q = '', compact = false }: { kinds: AdjustmentKind[]; q?: string; compact?: boolean }) {
  if (!kinds.length) return null
  const tip = kinds.length === 1
    ? `${ADJUSTMENT_FLAG[kinds[0]]}. ${ADJUSTMENT_WHY[kinds[0]]}`
    : 'Posted by hand to accounts the system normally keeps: retained earnings and a control account.'
  return (
    <Tooltip side="top" content={compact ? `${ADJUSTMENT_BADGE_LABEL}. ${tip}` : tip}>
      <span className="inline-flex shrink-0 cursor-help" data-adjustment-badge aria-label={compact ? ADJUSTMENT_BADGE_LABEL : undefined}>
        {/* The icon at the size the Confidential badge on a thread carries it. */}
        <Badge tone="warning" className={cn('whitespace-nowrap', compact && '!px-1.5')}>
          <AlertTriangle className="w-2.5 h-2.5" />
          {!compact && <Marked text={ADJUSTMENT_BADGE_LABEL} q={q} />}
        </Badge>
      </span>
    </Tooltip>
  )
}
