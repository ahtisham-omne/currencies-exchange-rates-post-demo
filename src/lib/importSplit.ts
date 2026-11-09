/* =====================================================================================
   Turning a file whose numbers hold dimensions into accounts.

   The rows stay; the code splits. A file carrying 01-71100-40 and 01-71100-50 is
   two accounts, both numbered 71100, and what tells them apart is that one is
   Department 40 and the other Department 50. Those are read off the number and
   kept as labelled attributes of the account, so the chart shows what was
   actually written down: two rows, one number, different dimensions. No parent
   nobody wrote, and no name nobody typed.

   The one thing that does fold is a summary. A summary holds no balance and takes
   no transactions, so it carries no dimensions - and a file that repeats its
   structure once per entity states the same summary many times over. Those are
   one summary. That also settles parent matching: a stated parent number resolves
   to exactly one row, because the only rows that can be parents are the ones that
   never repeat.

   This module is about rows. codeMapper is about numbers, and it does the reading
   this consumes.
   ===================================================================================== */
import { slotValue, type RowReading } from './codeMapper'
import type { ParsedRow } from './uploadValidation'

/** What the customer said one part of the number means. */
export interface SlotMeaning {
  slot: number
  /** The dimension's name, as it will read on the account. */
  name: string
  /** Raw code to what it stands for. A code marked as meaning nothing stores nothing. */
  labels?: Record<string, string>
}

export interface SplitResult {
  /** One per account, keyed by the file row it came from, in file order. */
  rows: ParsedRow[]
  /** Row key to the full code that arrived on that account. One per account: a
   *  summary the file states once per group keeps the statement that landed, and
   *  `folded` is where the rest are named. */
  arrivals: Map<number, string>
  /** Row key to the numbers of the other rows that folded into it. Summaries only. */
  folded: Map<number, string[]>
  /* Rows the split did not hold for, which keep their whole code as the account
     number. Reported rather than corrected: a number that does not split is
     still a number somebody keeps, and padding it out to the shape of its
     neighbours would be inventing a code they never wrote. */
  unsplit: Set<number>
}

/* Only posting accounts can have dimensions (Mahad, 2026-10-02), so a summary's
   number is never read for segments: its shape is not the file's shape, and
   nothing it holds becomes a dimension. Exported so the import reads the file's
   shape off posting rows alone. */
export const isSummary = (r: ParsedRow) => /summary|heading|header|total/i.test((r.glType ?? '').trim())

/**
 * Read every row against the customer's answers.
 *
 * `readParent` reads a stated parent number the same way a row's own number is
 * read, because a parent is glued exactly like its child. Without it a row points
 * at 01-70000-00 while the chart holds 70000.
 */
export function splitRows(
  parsed: ParsedRow[],
  readings: RowReading[],
  meanings: SlotMeaning[],
  readParent: (raw: string) => string | null,
): SplitResult {
  const byRow = new Map(readings.map(r => [r.row, r]))
  const rows: ParsedRow[] = []
  const arrivals = new Map<number, string>()
  const folded = new Map<number, string[]>()
  const unsplit = new Set<number>()
  // Where a summary already landed, so the next statement of it folds in.
  const summaryAt = new Map<string, number>()

  parsed.forEach((row, i) => {
    const reading = byRow.get(i)
    const raw = row.number.trim()

    /* A summary takes its GL account number out of a segmented number when its
       number is segmented the file's way, and keeps the number whole when it is
       not - a summary written 11000 over postings written 01-11100-40 is the
       ordinary shape of a chart, not a number that failed to split. Either way it
       carries no dimensions. */
    if (isSummary(row)) {
      const number = (reading && !reading.unfit && reading.accountPart) || readParent(raw) || raw
      const parent = row.parent?.trim() ? readParent(row.parent.trim()) ?? row.parent.trim() : row.parent
      const at = summaryAt.get(number)
      if (at !== undefined) {
        /* Folded, not appended. The summary keeps the statement that landed as
           its prior account number - Mahad, 2026-09-22: *"prior account number
           is always one number that was imported."* The other statements are
           named here, which the review grid reads. */
        folded.set(at, [...(folded.get(at) ?? []), raw])
        return
      }
      summaryAt.set(number, row.row)
      rows.push({ ...row, number, parent, dimensions: undefined })
      arrivals.set(row.row, raw)
      return
    }

    /* A number the reader could not cut up keeps its whole code as the account
       number and carries no dimensions. Nothing is padded and nothing is
       dropped: the row is imported as what the file actually said, and the split
       not holding for it is reported so the review grid can say so. Whether the
       whole code is a legal account number is validation's question, not this
       one. */
    if (!reading || reading.unfit || !reading.accountPart) {
      unsplit.add(row.row)
      rows.push({ ...row, number: raw, dimensions: undefined })
      arrivals.set(row.row, raw)
      return
    }

    const number = reading.accountPart
    const parent = row.parent?.trim() ? readParent(row.parent.trim()) ?? row.parent.trim() : row.parent


    const dimensions: { name: string; value: string }[] = []
    for (const m of meanings) {
      const name = m.name.trim()
      if (!name) continue
      const value = slotValue(reading.valuesBySlot.get(m.slot), m.labels)
      // An absent part carries no value, and neither does a code the customer
      // said means nothing. Absence is absence, not an "Unassigned" to store.
      if (value !== null) dimensions.push({ name, value })
    }
    rows.push({ ...row, number, parent, dimensions: dimensions.length ? dimensions : undefined })
    arrivals.set(row.row, raw)
  })

  return { rows, arrivals, folded, unsplit }
}
