// =========================
// CodeMapper — rescue the meaning trapped in a glued account number.
//
// Legacy systems baked a location, a category, a department into the number
// itself (100-2000-200). Omne keeps the account number as a plain sort key and
// moves that meaning onto dimensions, which live on the postings. This module
// detects the glue, splits a number into its parts, and turns each part's
// distinct values into dimension values.
//
// Reading only. Nothing here renames, renumbers or deletes, and the arrival
// string is always kept whole. Reading dimensions out of a number is an
// import-time concern only: the chart's own numbering stays flat.
// =========================
import type { SegmentDef } from '../types'
import { splitBySegments } from '../types'

// How a chart's numbers are glued (or not). `segments` is always populated -
// a single whole-number part when `kind` is 'flat', so callers can parse
// uniformly. Part meanings are placeholders ("Part 1", …) until the user
// names them in the mapper; buildSegmentDefs finalises them.
export interface CodeDetection {
  glued: boolean
  kind: 'separator' | 'constant' | 'flat'
  segments: SegmentDef[]
  separator: string | null
}

const cleaned = (numbers: string[]): string[] =>
  numbers.map(n => (n ?? '').trim()).filter(Boolean)

// The one character that separates parts, when a single such character is
// used consistently in numbers that carry one. null when the numbers are all one
// part or use no consistent separator.
//
// Only punctuation can be a separator. A letter is part of a code, so a chart
// numbered AR-1100-40 has one separator and not three: counting the A and the R
// would let either of them win the vote and cut the number in the wrong place.
function dominantSeparator(numbers: string[]): string | null {
  const counts = new Map<string, number>()
  let withSep = 0
  for (const n of numbers) {
    const seps = new Set(n.replace(/[A-Za-z0-9]/g, '').split(''))
    if (seps.size) withSep++
    for (const s of seps) counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  if (!counts.size) return null
  // A separator only counts if (nearly) every number that has punctuation uses
  // the same one, and enough of the chart carries it.
  const [best, hits] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return hits >= withSep && withSep >= Math.ceil(numbers.length / 2) ? best : null
}

/* ──────── What separates segments ────────
   Any character that is not a letter or a digit. The first reader knew only
   hyphens, and real exports use periods, spaces, slashes and separators their
   users picked, so a company with 500 accounts would have had to retype every
   number before importing. Agreed on Sept 3: a rule rather than a list of
   allowed characters, so it covers every common format and never needs
   updating. A run of them counts once, and one at either end separates nothing.

   Its known cost is deliberate: anything typed into a number, such as a note in
   brackets, becomes a segment. The review step and the preview are where that
   is caught. A number with no separator imports whole; cutting one by position
   is in the backlog (priority 6). Numbers are read as text throughout, so a
   leading zero survives. */
const SEPARATOR_RUN = /[^A-Za-z0-9]+/
const segmentsOf = (raw: string): string[] => raw.split(SEPARATOR_RUN).filter(Boolean)

/* Which separator characters the file uses, in the order first met, or null
   when too little of the chart carries one to call it segmented. Held so a
   screen can name them ("contain a hyphen"); the split itself never reads them,
   because every such character separates. */
function fileSeparators(numbers: string[]): string | null {
  const found = new Set<string>()
  let withSep = 0
  for (const n of numbers) {
    const seps = n.replace(/[A-Za-z0-9]/g, '')
    if (!seps) continue
    withSep++
    for (const c of seps) found.add(c)
  }
  return found.size && withSep >= Math.ceil(numbers.length / 2) ? [...found].join('') : null
}

/* What a part of a number may be made of. Letters count: an account number can be
   AR1100, and a dimensional one can be AR-1100-40, so a part that is all letters is
   as readable as one that is all digits. What is still refused is punctuation and
   whitespace inside a part, which means the number was not split where it reads. */
const isCodePart = (part: string) => /^[A-Za-z0-9]+$/.test(part)

// Part widths from a set of already-split rows: the width of each position,
// requiring every row to agree. null when the rows disagree on shape.
//
// Only the legacy rectangle-or-nothing path uses this. The tolerant reader
// further down keeps per-slot maxima instead, so a ragged file still splits.
function consistentWidths(rows: string[][]): number[] | null {
  const count = rows[0].length
  if (!rows.every(r => r.length === count)) return null
  const widths: number[] = []
  for (let i = 0; i < count; i++) {
    const w = rows[0][i].length
    if (!rows.every(r => r[i].length === w)) return null
    widths.push(w)
  }
  return widths
}

// The longest leading run of digits that is identical across every number, and
// shorter than the number itself. 0 when the numbers don't share a prefix.
function constantPrefixLength(numbers: string[]): number {
  const min = Math.min(...numbers.map(n => n.length))
  let k = 0
  while (k < min - 1 && numbers.every(n => n[k] === numbers[0][k])) k++
  return k
}

function placeholderSegments(widths: number[], separator: string): SegmentDef[] {
  return widths.map((length, index) => ({
    index,
    length,
    meaning: `Part ${index + 1}`,
    separator: index < widths.length - 1 ? separator : '',
  }))
}

const flatDetection = (numbers: string[]): CodeDetection => ({
  glued: false,
  kind: 'flat',
  separator: null,
  segments: [{ index: 0, length: numbers[0]?.length || 4, meaning: 'Account', separator: '' }],
})

/**
 * Decide whether a chart's numbers glue several meanings into one code, and how.
 *
 * Two shapes are detected with confidence: a consistent separator character
 * (100-2000-200) and a constant leading block shared by every account
 * (1001020, 1002010 → "100" | "1020"). A plain 4-digit chart (QuickBooks) is
 * left flat, so the mapper stays out of its way. When detection is unsure it
 * returns flat; the caller offers a toggle to force a split by hand.
 */
export function detectGluedCodes(numbers: string[]): CodeDetection {
  const nums = cleaned(numbers)
  if (!nums.length) return flatDetection(nums)

  const sep = dominantSeparator(nums)
  if (sep) {
    const rows = nums.filter(n => n.includes(sep)).map(n => n.split(sep))
    const widths = consistentWidths(rows)
    if (widths && widths.length >= 2) {
      return { glued: true, kind: 'separator', separator: sep, segments: placeholderSegments(widths, sep) }
    }
    return flatDetection(nums)
  }

  // No separator: only a constant leading block is safe to split on. Anything else
  // stays flat rather than risk cutting a real number.
  if (nums.every(isCodePart) && new Set(nums.map(n => n.length)).size === 1) {
    const total = nums[0].length
    const prefix = constantPrefixLength(nums)
    if (prefix > 0 && total - prefix >= 2) {
      return {
        glued: true,
        kind: 'constant',
        separator: null,
        segments: placeholderSegments([prefix, total - prefix], ''),
      }
    }
  }
  return flatDetection(nums)
}

// Split one number into its part strings, or null when it doesn't fit.
export function parseSegments(segments: SegmentDef[], number: string): string[] | null {
  return splitBySegments(segments, (number ?? '').trim())
}

// =========================
// The tolerant reader.
//
// A real export is ragged: most rows are 01-71100-40 but a handful are a bare
// 2000. The rectangle reader above gives up on those files entirely and falls
// back to flat, which loses every dimension in the chart. This reads the file's
// shape as maxima plus a floor instead, so a short row costs that row its
// dimension values and nothing more.
// =========================

// The shape of a file's numbers. `partCount` is the widest row and
// `minPartCount` the shortest, so the two differing is exactly what makes the
// file ragged. `widths` is the per-slot width observed on the full-width rows,
// which are the only rows whose slots are known without inference.
export interface FileShape {
  /** The separator characters the file uses, in the order first met, for naming them on screen. Every character that is not a letter or digit separates. */
  separator: string
  partCount: number
  minPartCount: number
  widths: number[]
}

// One number, read. An absent slot is simply missing from `valuesBySlot`:
// absence is absence, and carries no dimension value. `raw` is the arrival
// string verbatim, which is what gets kept on the account.
export interface RowReading {
  row: number
  raw: string
  accountPart: string | null
  /* The parts that can carry a dimension, so never the account's own slot -
     otherwise every caller would have to remember to skip it, and the account
     number would quietly become a dimension value. */
  valuesBySlot: Map<number, string>
  ambiguous: boolean // more than one legal slot assignment, so ask
  /* The codes the ambiguity is about, and the slots each could sit in. Empty
     whenever `ambiguous` is false. `valuesBySlot` still holds the reader's best
     guess for them, so a file nobody answers still imports. */
  unplaced: UnplacedCode[]
  unfit?: 'width' | 'parts' | 'unreadable'
}

/** A leftover code the evidence could not place, and where it could belong. */
export interface UnplacedCode { code: string; slots: number[] }

/**
 * The customer's answers, as code to slot. Keyed by the code rather than by the
 * row because the same short number shape recurs down a file: "which part is
 * this 40" is one question however many rows ask it.
 */
export type SlotChoices = Record<string, number>

/** One question to put to the customer, and the file rows waiting on it. */
export interface SlotQuestion extends UnplacedCode { rows: number[] }

/**
 * The distinct questions a reading leaves open. Rows asking the same thing are
 * folded together, so answering once settles all of them.
 */
export function slotQuestions(readings: RowReading[]): SlotQuestion[] {
  const byCode = new Map<string, SlotQuestion>()
  for (const r of readings) {
    for (const u of r.unplaced) {
      const found = byCode.get(u.code)
      if (found) { found.rows.push(r.row); continue }
      byCode.set(u.code, { code: u.code, slots: u.slots, rows: [r.row] })
    }
  }
  return [...byCode.values()]
}

// Why a (file, chosen account part) pair cannot be read. The account has to
// exist in every row, so it cannot sit further right than the shortest row
// reaches.
export interface UnsupportedReason {
  kind: 'accountBeyondShortestRow'
  accountIdx: number
  minPartCount: number
  partCount: number
}

// A part the user pointed at a dimension. `valueLabels` renames a raw code to
// something readable, or marks it as meaning nothing via VALUE_MEANS_NOTHING.
export interface SlotDimensionMapping {
  slot: number
  dimensionId: string
  valueLabels?: Record<string, string>
}

/* What the customer picks to say a code that is present means nothing anyway -
   a 00 department on a row that has no department. It is not a stored value:
   like an absent part, it stores nothing at all. Distinct from a label the user
   typed and then cleared, which falls back to the digits. */
export const VALUE_MEANS_NOTHING = '\u0000means-nothing'

/* How many parts the file is built in: the count the most numbers agree on, not
   the count the longest one reaches. A file where one number was typed with an
   extra part is a file with one odd number in it, and taking the longest
   would make every other row in it short.

   A tie goes to the larger count, which is where the ragged files this exists for
   land: 100-2000-200 alongside a bare 2000 has one of each, and reading it as
   three parts with a short row is what rescues the meaning. Reading it as one
   part would throw all of it away. */
function dominantPartCount(lengths: number[]): number {
  const seen = new Map<number, number>()
  for (const n of lengths) seen.set(n, (seen.get(n) ?? 0) + 1)
  let best = 0
  let bestCount = 0
  for (const [n, count] of seen) {
    if (count > bestCount || (count === bestCount && n > best)) { best = n; bestCount = count }
  }
  return best
}

/**
 * Read a file's shape, tolerating ragged rows. null when there is nothing to
 * split, which is the honest answer for a plain four-digit chart.
 *
 * Any character that is not a letter or digit separates (see `SEPARATOR_RUN`);
 * a row carrying none is simply a one-part row rather than a reason to give up.
 * A file whose numbers carry no separator is not split at all: it imports whole.
 */
export function detectFileShape(numbers: string[]): FileShape | null {
  const nums = cleaned(numbers)
  if (!nums.length) return null

  const sep = fileSeparators(nums)
  if (sep) {
    const rows = nums.map(segmentsOf)
    const partCount = dominantPartCount(rows.map(r => r.length))
    if (partCount < 2) return null
    const full = rows.filter(r => r.length === partCount)
    return {
      separator: sep,
      partCount,
      /* Only rows the shape can hold get a say. A row with more parts than the
         file's pattern is off-pattern rather than evidence about it, and letting
         it vote here would move the account picker's cap for everyone else. */
      minPartCount: Math.min(...rows.filter(r => r.length <= partCount).map(r => r.length)),
      widths: Array.from({ length: partCount }, (_, i) => Math.max(...full.map(r => r[i].length))),
    }
  }

  return null
}

/* How much of the file actually splits the way it was read. Nobody is asked
   whether their numbers hold several codes - the file is read and the reading is
   put in front of them - so the reading has to be able to say how well it holds.
   "138 of 140 split into three parts on a dash" is checkable; "your numbers look
   split up" is not.

   Rows are counted by index into the numbers given, so a caller can name the
   offending numbers rather than describe them. */
export interface PatternFit {
  /** Numbers there were to read at all, so blanks are not counted against it. */
  total: number
  /** Split into exactly as many parts as the shape has. */
  conforming: number
  /* Split cleanly but into fewer parts. Ragged rather than wrong: a bare 2000 in
     a 100-2000-200 file is an account with no dimension values, and is read that
     way rather than padded out to a shape nobody wrote. */
  short: number[]
  /** Cannot be cut this way at all. Flagged, and never padded to fit. */
  offPattern: number[]
}

/**
 * Read the file against its own shape and count what holds. Answerable before
 * anyone picks which part is the account, which is the point: the split is
 * confirmed first, and only then is each part named.
 */
export function patternFit(numbers: string[], shape: FileShape): PatternFit {
  const fit: PatternFit = { total: 0, conforming: 0, short: [], offPattern: [] }
  numbers.forEach((n, row) => {
    const raw = (n ?? '').trim()
    // A missing number is that row's own problem, and counting it here would
    // make the split look worse than it reads.
    if (!raw) return
    fit.total++
    const parts = splitNumber(raw, shape)
    if (!parts || !parts.every(isCodePart) || parts.length > shape.partCount) {
      fit.offPattern.push(row)
    } else if (parts.length < shape.partCount) {
      fit.short.push(row)
    } else {
      fit.conforming++
    }
  })
  return fit
}

/**
 * The rows whose number holds no dimensions at all - one part, nothing to cut.
 * Distinct from a short number, which holds dimensions but fewer of them: a bare
 * 2000 in a 01-71100-40 file is not a dimensional number written briefly, it is
 * a number with no dimensions, and there is no part of it to call a location.
 *
 * Answering "yes, they hold dimensions" over a file holding these makes a claim
 * about the file that is not true of every row, so the customer is sent back to
 * fix the file rather than asked to reconcile it here.
 */
export function rowsWithoutDimensions(numbers: string[], shape: FileShape): number[] {
  const out: number[] = []
  numbers.forEach((n, row) => {
    const raw = (n ?? '').trim()
    // A blank number is that row's own problem, and the review grid states it.
    if (!raw) return
    const parts = splitNumber(raw, shape)
    if (!parts || parts.length < 2) out.push(row)
  })
  return out
}

/**
 * A number that splits into every part the shape has, so the split shown to the
 * customer is a whole one. The first row of a file is often a heading with a
 * short number, and cutting that up demonstrates nothing.
 */
export function exampleNumber(numbers: string[], shape: FileShape): string {
  const nums = cleaned(numbers)
  const whole = nums.find(n => {
    const parts = splitNumber(n, shape)
    return parts?.length === shape.partCount && parts.every(isCodePart)
  })
  return whole ?? nums[0] ?? ''
}

/**
 * Whether this file can be read with the account at this position. A property
 * of the pair, not of the file, which is why it is asked separately: the same
 * ragged file reads fine with the account leftmost and is unsupported with the
 * account in the middle.
 */
export function unsupportedReason(shape: FileShape, accountIdx: number): UnsupportedReason | null {
  if (shape.minPartCount >= shape.partCount) return null
  if (accountIdx + 1 <= shape.minPartCount) return null
  return {
    kind: 'accountBeyondShortestRow',
    accountIdx,
    minPartCount: shape.minPartCount,
    partCount: shape.partCount,
  }
}

// The highest account position this file allows, counted from 0. A single-part
// row anywhere in the file pins the account to the first part.
export const maxAccountIdx = (shape: FileShape): number => shape.minPartCount - 1

/**
 * Split one arrival string into its parts, or null when it cannot be cut. Public
 * so a screen can show the customer their own number in pieces, which is the
 * only way the question "what is this part" can be asked at all.
 */
export function splitNumber(raw: string, shape: FileShape): string[] | null {
  if (!shape.separator) return null
  const parts = segmentsOf(raw.trim())
  return parts.length ? parts : null
}

// The distinct values each slot actually takes, read off the full-width rows
// only. These are the rows whose slots are known outright, so they are the only
// safe evidence for placing a short row's parts.
function slotValueSets(raws: string[], shape: FileShape): Set<string>[] {
  const sets = Array.from({ length: shape.partCount }, () => new Set<string>())
  for (const raw of raws) {
    const parts = raw ? splitNumber(raw, shape) : null
    if (!parts || parts.length !== shape.partCount) continue
    parts.forEach((p, i) => sets[i].add(p))
  }
  return sets
}

// Every way to pick k slots out of the pool, keeping the pool's order: a short
// row's parts stay in the order they arrived, only their slots are in question.
function slotCombinations(pool: number[], k: number): number[][] {
  if (k === 0) return [[]]
  if (k > pool.length) return []
  const out: number[][] = []
  const walk = (start: number, acc: number[]) => {
    if (acc.length === k) { out.push([...acc]); return }
    for (let i = start; i <= pool.length - (k - acc.length); i++) {
      acc.push(pool[i])
      walk(i + 1, acc)
      acc.pop()
    }
  }
  walk(0, [])
  return out
}

/**
 * Which slot each of a row's parts belongs to.
 *
 * The account anchors it. Counted from the left it has to exist in every row,
 * so everything up to and including the account holds its own position. That
 * leaves only the parts to the right of the account in question, which is why
 * the whole problem needs at least three parts to exist at all.
 *
 * Evidence first, ask last: a part whose width fits exactly one remaining slot
 * is placed, then a part whose value has been seen in exactly one remaining
 * slot is placed, then the customer's own answer is applied. Only a part that
 * survives all three is handed back unplaced, along with the slots it could sit
 * in - the question can then be put in the customer's own code rather than as a
 * row number.
 */
function assignSlots(
  parts: string[],
  shape: FileShape,
  accountIdx: number,
  distinct: Set<string>[],
  choices?: SlotChoices,
): { slots: number[]; unplaced: UnplacedCode[] } {
  if (parts.length === shape.partCount) {
    return { slots: parts.map((_, i) => i), unplaced: [] }
  }
  const head = Array.from({ length: accountIdx + 1 }, (_, i) => i)
  const tailParts = parts.slice(accountIdx + 1)
  const tailSlots: number[] = []
  for (let s = accountIdx + 1; s < shape.partCount; s++) tailSlots.push(s)

  if (!tailParts.length) return { slots: head, unplaced: [] }
  if (tailParts.length === tailSlots.length) {
    return { slots: [...head, ...tailSlots], unplaced: [] }
  }

  const options = slotCombinations(tailSlots, tailParts.length)
  const byWidth = options.filter(c => c.every((slot, i) => tailParts[i].length === shape.widths[slot]))
  let survivors = byWidth.length ? byWidth : options
  const narrow = (keep: (c: number[]) => boolean) => {
    if (survivors.length < 2) return
    const kept = survivors.filter(keep)
    if (kept.length) survivors = kept
  }
  narrow(c => c.every((slot, i) => distinct[slot].has(tailParts[i])))
  narrow(c => c.every((slot, i) => {
    const chosen = choices?.[tailParts[i]]
    return chosen === undefined || chosen === slot
  }))

  /* Which parts the survivors still disagree about. A part every survivor puts
     in the same slot is placed even when the row as a whole is not, so a
     three-part question never asks about a part nobody was unsure of. */
  const unplaced = tailParts.flatMap((code, i) => {
    const slots = [...new Set(survivors.map(c => c[i]))]
    return slots.length > 1 ? [{ code, slots }] : []
  })
  return { slots: [...head, ...survivors[0]], unplaced }
}

/**
 * Read every number in the file against a shape and a chosen account position.
 * One reading per input entry, index-aligned, so a caller can zip the result
 * straight onto its parsed rows.
 */
export function readRows(
  numbers: string[],
  shape: FileShape,
  accountIdx: number,
  choices?: SlotChoices,
): RowReading[] {
  const raws = numbers.map(n => (n ?? '').trim())
  const distinct = slotValueSets(raws, shape)

  return raws.map((raw, row) => {
    const blank = { row, raw, accountPart: null, valuesBySlot: new Map<number, string>(), ambiguous: false, unplaced: [] }
    if (!raw) return { ...blank, unfit: 'unreadable' as const }

    const parts = splitNumber(raw, shape)
    if (!parts) return { ...blank, unfit: 'width' as const }
    if (!parts.every(isCodePart)) return { ...blank, unfit: 'unreadable' as const }
    if (accountIdx < 0 || accountIdx >= shape.partCount) return { ...blank, unfit: 'parts' as const }
    // Fewer parts than the account position, or more parts than the shape has
    // slots: either way this row cannot say what its account is.
    if (parts.length <= accountIdx || parts.length > shape.partCount) {
      return { ...blank, unfit: 'parts' as const }
    }

    const { slots, unplaced } = assignSlots(parts, shape, accountIdx, distinct, choices)
    const valuesBySlot = new Map<number, string>()
    slots.forEach((slot, i) => { if (slot !== accountIdx) valuesBySlot.set(slot, parts[i]) })
    return { row, raw, accountPart: parts[accountIdx], valuesBySlot, ambiguous: unplaced.length > 0, unplaced }
  })
}

/**
 * How many different codes each slot holds across the file. This is all the
 * evidence there is before anyone is asked anything, and it is enough to
 * propose an answer: the account is the part that varies most, because it is
 * the only part that names the account.
 *
 * Read off the full-width rows, whose slots are known without inference.
 */
export function slotValueCounts(numbers: string[], shape: FileShape): number[] {
  return slotValueSets(cleaned(numbers), shape).map(s => s.size)
}

/**
 * Which slot to propose as the account: the widest part, ties going to the one
 * taking the most different codes and then to the leftmost, and never past where
 * the shortest row reaches - the account has to exist in every row.
 *
 * Width leads rather than variety because variety is actively misleading on the
 * files this exists for. In 01-71100-40 and 01-71100-50 the department takes
 * more codes than the account does, precisely because those two rows are one
 * account - so counting values proposes the department and the whole import
 * lands as accounts 40 and 50. An account number is also the one part with a
 * reason to be wide.
 */
export function suggestAccountSlot(numbers: string[], shape: FileShape): number {
  const counts = slotValueCounts(numbers, shape)
  const limit = maxAccountIdx(shape)
  let best = 0
  for (let i = 1; i <= limit; i++) {
    const wider = shape.widths[i] > shape.widths[best]
    const sameWidth = shape.widths[i] === shape.widths[best]
    if (wider || (sameWidth && counts[i] > counts[best])) best = i
  }
  return best
}

/**
 * What one raw code is worth as a dimension value: the customer's name for it,
 * the digits when they named it and then cleared the field, or null when they
 * said it means nothing.
 */
export function slotValue(raw: string | undefined, labels?: Record<string, string>): string | null {
  if (raw === undefined) return null
  if (labels?.[raw] === VALUE_MEANS_NOTHING) return null
  return labels?.[raw]?.trim() || raw
}

/** One raw code a part takes, and how many rows it appears on. */
export interface SlotTally { code: string; rows: number }

/**
 * Every code a part takes with the number of rows carrying it, in code order.
 *
 * The count is what makes naming these codes a decidable job rather than an open
 * one: twenty codes where two of them cover most of the file is a different task
 * from twenty evenly spread, and only the counts say which it is.
 *
 * Ordered by code rather than by count, because this same list is what a pasted
 * column of names is read against. Somebody copying names out of a spreadsheet
 * has them in the order the codes sort in, not in the order our counts rank them.
 */
export function slotTally(readings: RowReading[], slot: number): SlotTally[] {
  const counts = new Map<string, number>()
  for (const r of readings) {
    const code = r.valuesBySlot.get(slot)
    if (code === undefined) continue
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  return [...counts]
    .map(([code, rows]) => ({ code, rows }))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
}

// The value list a dimension is created with: distinct values of one slot in
// first-seen order. Absent slots and codes marked as meaning nothing contribute
// nothing, so the list never offers a value that stores nothing.
export function distinctSlotValues(
  readings: RowReading[],
  slot: number,
  valueLabels?: Record<string, string>,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of readings) {
    const value = slotValue(r.valuesBySlot.get(slot), valueLabels)
    if (value === null || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/**
 * The customer's numbering style as a SegmentDef[], so future suggestions copy
 * it. One part is designated the account part - the part a suggestion
 * counts from - and marked with the reserved meaning "Account" that the
 * suggesters read. It decides nothing about where the account is filed, which
 * comes from the category and section stated on it. Other parts take the
 * meaning the user gave them, or a placeholder.
 *
 * `accountIndex` is the part the user picked. Left out, the widest part (ties
 * to the earliest) is assumed, which is right often enough for a caller that
 * never asked.
 */
export function buildSegmentDefs(
  segments: SegmentDef[],
  meanings: (string | undefined)[] = [],
  accountIndex?: number,
): SegmentDef[] {
  let account = 0
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].length > segments[account].length) account = i
  }
  if (accountIndex !== undefined && accountIndex >= 0 && accountIndex < segments.length) account = accountIndex
  return segments.map((s, i) => ({
    index: i,
    length: s.length,
    separator: s.separator,
    meaning: i === account ? 'Account' : (meanings[i]?.trim() || `Part ${i + 1}`),
  }))
}
