/* Number ranges on Summary accounts.
 *
 * A summary reserves a block of numbers, so a reader creating an account under
 * it can tell where the number belongs before typing it, and so the numbers a
 * branch will grow into are not taken by some other branch first.
 *
 * The rules, as settled in the design review of 2026-09-24 (Eli, Nophil,
 * Mahreen, Mahad):
 *
 *   - A reservation is a ONE-WAY block. It stops every account that is not
 *     under the summary from taking a number inside it. It does not force the
 *     summary's own accounts to stay inside it - they may sit outside, so a
 *     full block never leaves the reader unable to add an account.
 *
 *   - Number protection (a module setting, on by default) goes one step
 *     further: the numbers from a summary's own number to its last account are
 *     kept for its accounts even where no range was typed. It is what stops a
 *     summary that has nothing to do with a branch being injected between that
 *     branch's accounts. Charts imported from a system that numbered things
 *     another way turn it off.
 *
 *   - The defaults cascade: a category reserves its whole block, and each level
 *     down reserves a block one zero smaller (10,000 → 1,000 → 100 → 10). The
 *     offer for a new summary is the next clean block of that size, never the
 *     leftover tail of its parent's block.
 *
 * Optional. What a summary totals is what names it as a parent, not what happens
 * to fall in its range. Numeric-only, because a range is arithmetic and a
 * lettered number like AR100 has no numeric value: it sits inside no range, and
 * reserving around it is the customer opting out of the block, not breaking it.
 *
 * On Summary accounts only. A posting is a leaf; nothing sits under it, so a
 * range would guard nothing.
 */

import type { Account } from '../types'
import { isNumericAccountNumber } from '../types'

export interface NumberRange {
  start: number
  end: number
}

/** The range set on an account, or `null` when it has none (or half of one). */
export function accountRange(a: Pick<Account, 'numberRangeStart' | 'numberRangeEnd'>): NumberRange | null {
  const s = a.numberRangeStart
  const e = a.numberRangeEnd
  if (typeof s !== 'number' || typeof e !== 'number') return null
  if (!Number.isInteger(s) || !Number.isInteger(e)) return null
  if (s > e) return null
  return { start: s, end: e }
}

/** The integer inside an account number, or `null` when it carries letters. */
export function numericValueOf(accountNumber: string): number | null {
  const t = accountNumber.trim()
  if (!isNumericAccountNumber(t)) return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

/* ── Numbers of another length ───────────────────────────────────────────

   A chart may hold numbers of different lengths (decision 26), and a number of
   another length is saved with a soft warning, never refused (decisions 26 and
   40). Ranges are arithmetic on numbers of the chart's own length: 110400 is
   not "far above" 11999 in a five-digit chart, it is a number written another
   way, and measuring it against five-digit blocks pushed 11000 Current Assets'
   span into 52100 Payroll & Benefits. So a number of another length sits inside
   no range, exactly as a lettered one does. Module review, 2026-10-06 (COA-07).

   The chart's length is the one most of its numbers have; the longer wins a
   tie. Null for a chart with no numeric numbers yet, where every number is
   measured. */
export function chartNumberWidth(chart: { accountNumber: string }[]): number | null {
  const counts = new Map<number, number>()
  for (const a of chart) {
    const t = a.accountNumber.trim()
    if (isNumericAccountNumber(t)) counts.set(t.length, (counts.get(t.length) ?? 0) + 1)
  }
  let best: number | null = null
  let bestCount = 0
  for (const [len, c] of counts) {
    if (c > bestCount || (c === bestCount && best !== null && len > best)) { best = len; bestCount = c }
  }
  return best
}

/** The number's value for range arithmetic: null when it carries letters or is
    not the chart's length. */
export function measuredValueOf(accountNumber: string, width: number | null): number | null {
  const n = numericValueOf(accountNumber)
  if (n === null) return null
  return width === null || accountNumber.trim().length === width ? n : null
}

/** The soft warning a number of another length gets, or null. It never blocks. */
export function numberLengthWarning(accountNumber: string, chart: { id?: string; accountNumber: string }[], selfId?: string): string | null {
  const t = accountNumber.trim()
  if (!isNumericAccountNumber(t)) return null
  const width = chartNumberWidth(selfId ? chart.filter(a => a.id !== selfId) : chart)
  if (width === null || t.length === width) return null
  return `This number has ${t.length} digits, and your other account numbers have ${width}. You can still save it.`
}

export const rangeContainsNumber = (r: NumberRange, n: number): boolean =>
  n >= r.start && n <= r.end

export const rangeContainsRange = (outer: NumberRange, inner: NumberRange): boolean =>
  inner.start >= outer.start && inner.end <= outer.end

export const rangesOverlap = (a: NumberRange, b: NumberRange): boolean =>
  a.start <= b.end && b.start <= a.end

/** How a range reads on the chart: "10000–19999", with an en dash. */
export const formatRange = (r: NumberRange): string => `${r.start}–${r.end}`

/* Reading two form inputs into a range. Both are supplied together, because a
   half-set range names no block and the reader will have meant to fill the
   other half. */
export type ParsedRangeInputs =
  | { kind: 'empty' }
  | { kind: 'range'; range: NumberRange }
  | { kind: 'error'; error: string }

export function parseRangeInputs(startStr: string, endStr: string): ParsedRangeInputs {
  const a = startStr.trim()
  const b = endStr.trim()
  if (!a && !b) return { kind: 'empty' }
  if (!a || !b) return { kind: 'error', error: 'Enter both numbers of the range.' }
  if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) {
    return { kind: 'error', error: 'Use whole numbers only.' }
  }
  const start = parseInt(a, 10)
  const end = parseInt(b, 10)
  if (start > end) return { kind: 'error', error: 'The start of the range can\'t be higher than the end.' }
  return { kind: 'range', range: { start, end } }
}

/* ── The chart the rules read ─────────────────────────────────────────────── */

export type RangeChartRow = Pick<Account,
  'id' | 'parentId' | 'glAccountType' | 'accountNumber' | 'accountName' | 'numberRangeStart' | 'numberRangeEnd'>

/** The account a message is about, drawn as a pill where the message names it. */
export interface Holder {
  accountNumber: string
  accountName: string
}

/* Why a number or a range cannot go where it was put. `text` carries a
   `{holder}` token, and sometimes `{other}`, where the account names go - the
   form draws each as a gray pill, so the account in the way reads as a thing
   rather than as part of the sentence (Nophil, 2026-09-24: *"I want 1000
   assets to be in a pill"*). `problemText` flattens it for places that only
   take a string. */
export interface RangeProblem {
  text: string
  /** The summary's own number is the fault, not its range: the form says so on
      the number field. */
  onNumber?: boolean
  holder?: Holder
  other?: Holder
}

const nameOf = (h?: Holder) => (h ? `${h.accountNumber} ${h.accountName}` : '')

export function problemText(p: RangeProblem): string {
  return p.text.replace('{holder}', nameOf(p.holder)).replace('{other}', nameOf(p.other))
}

const holderOf = (a: RangeChartRow): Holder => ({ accountNumber: a.accountNumber, accountName: a.accountName })

interface ChartIndex {
  /** The chart's number length; numbers of another length sit inside no range. */
  width: number | null
  byId: Map<string, RangeChartRow>
  children: Map<string | null, RangeChartRow[]>
  /** Every account above this one, nearest first. Guarded against a cycle. */
  ancestorsOf: (id: string) => RangeChartRow[]
  /** Every account below this one, at any depth. */
  descendantsOf: (id: string) => RangeChartRow[]
}

function indexChart(chart: RangeChartRow[], width: number | null = chartNumberWidth(chart)): ChartIndex {
  const byId = new Map(chart.map(a => [a.id, a]))
  const children = new Map<string | null, RangeChartRow[]>()
  for (const a of chart) {
    const k = a.parentId ?? null
    const list = children.get(k) ?? []
    list.push(a)
    children.set(k, list)
  }
  const ancestorsOf = (id: string) => {
    const out: RangeChartRow[] = []
    const seen = new Set<string>([id])
    let cur = byId.get(id)?.parentId ?? null
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      const p = byId.get(cur)
      if (!p) break
      out.push(p)
      cur = p.parentId ?? null
    }
    return out
  }
  const descMemo = new Map<string, RangeChartRow[]>()
  const descendantsOf = (id: string) => {
    const hit = descMemo.get(id)
    if (hit) return hit
    const out: RangeChartRow[] = []
    const seen = new Set<string>([id])
    const walk = (pid: string) => {
      for (const c of children.get(pid) ?? []) {
        if (seen.has(c.id)) continue
        seen.add(c.id)
        out.push(c)
        walk(c.id)
      }
    }
    walk(id)
    descMemo.set(id, out)
    return out
  }
  return { width, byId, children, ancestorsOf, descendantsOf }
}

/* What a summary keeps for the accounts under it.

   Its typed range, always. With number protection on, also the stretch from its
   own number to its last account - Eli, 2026-09-24: *"we're auto-reserving the
   range from the parent summary number to the end of the child range."* Both at
   once where both apply, because an account the one-way block let sit outside
   the typed range is still one of the summary's, and the numbers between it and
   its siblings are still what a stranger would be injected into.

   Null for a summary that keeps nothing: no range, and protection off (or no
   numeric number to measure from). */
export interface Span {
  range: NumberRange
  /** True when some of the span comes from protection rather than a typed range. */
  auto: boolean
}

function spanOf(s: RangeChartRow, idx: ChartIndex, protection: boolean): Span | null {
  if (s.glAccountType !== 'Summary') return null
  const typed = accountRange(s)
  if (!protection) return typed ? { range: typed, auto: false } : null
  const nums = [s, ...idx.descendantsOf(s.id)]
    .map(a => measuredValueOf(a.accountNumber, idx.width))
    .filter((n): n is number => n !== null)
  if (!nums.length && !typed) return null
  let start = typed ? typed.start : Math.min(...nums)
  let end = typed ? typed.end : Math.max(...nums)
  for (const n of nums) { if (n < start) start = n; if (n > end) end = n }
  const auto = !typed || start < typed.start || end > typed.end
  return { range: { start, end }, auto }
}

/** The span a summary keeps, for display and for tests. */
export function protectedSpan(summaryId: string, chart: RangeChartRow[], protection: boolean): Span | null {
  const idx = indexChart(chart)
  const s = idx.byId.get(summaryId)
  return s ? spanOf(s, idx, protection) : null
}

/* One way the chart breaks the rules. Two kinds, because a reservation can be
   broken two ways: an account that is not the summary's holding a number inside
   it, or another summary's reservation reaching into it. */
type Violation =
  | { kind: 'number'; summary: RangeChartRow; span: Span; account: RangeChartRow }
  | { kind: 'overlap'; a: RangeChartRow; aSpan: Span; b: RangeChartRow; bSpan: Span }

const violationKey = (v: Violation) => v.kind === 'number'
  ? `n:${v.summary.id}:${v.account.id}`
  : `o:${[v.a.id, v.b.id].sort().join(':')}`

function violationsOf(chart: RangeChartRow[], protection: boolean, idx = indexChart(chart)): Violation[] {
  const out: Violation[] = []
  const summaries = chart.filter(a => a.glAccountType === 'Summary')
  const spans = new Map<string, Span>()
  for (const s of summaries) {
    const sp = spanOf(s, idx, protection)
    if (sp) spans.set(s.id, sp)
  }
  const numbered = chart
    .map(a => ({ a, n: measuredValueOf(a.accountNumber, idx.width) }))
    .filter((x): x is { a: RangeChartRow; n: number } => x.n !== null)

  for (const [sid, span] of spans) {
    const s = idx.byId.get(sid)!
    const own = new Set([sid, ...idx.descendantsOf(sid).map(d => d.id)])
    for (const { a, n } of numbered) {
      if (!own.has(a.id) && rangeContainsNumber(span.range, n)) {
        out.push({ kind: 'number', summary: s, span, account: a })
      }
    }
  }
  const ids = [...spans.keys()]
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = idx.byId.get(ids[i])!
      const b = idx.byId.get(ids[j])!
      // A branch nests inside the branch above it; that is not an overlap.
      if (idx.ancestorsOf(a.id).some(x => x.id === b.id) || idx.ancestorsOf(b.id).some(x => x.id === a.id)) continue
      const aSpan = spans.get(a.id)!
      const bSpan = spans.get(b.id)!
      if (rangesOverlap(aSpan.range, bSpan.range)) out.push({ kind: 'overlap', a, aSpan, b, bSpan })
    }
  }
  return out
}

/* Every place a chart breaks its own reservations. Empty for a chart that keeps
   them. The importer reads this to tell a reader whether their numbering can
   live with number protection on; the seed test reads it to keep the demo chart
   honest. */
export interface ChartConflict {
  account: Holder
  accountId: string
  holder: Holder
  holderId: string
  text: string
}

export function chartConflicts(chart: RangeChartRow[], protection: boolean): ChartConflict[] {
  return violationsOf(chart, protection).map(v => {
    if (v.kind === 'number') {
      return {
        accountId: v.account.id, account: holderOf(v.account),
        holderId: v.summary.id, holder: holderOf(v.summary),
        text: `${nameOf(holderOf(v.account))} is inside the range ${nameOf(holderOf(v.summary))} sets aside (${formatRange(v.span.range)}).`,
      }
    }
    return {
      accountId: v.b.id, account: holderOf(v.b),
      holderId: v.a.id, holder: holderOf(v.a),
      text: `${nameOf(holderOf(v.b))} and ${nameOf(holderOf(v.a))} have overlapping ranges (${formatRange(v.bSpan.range)} and ${formatRange(v.aSpan.range)}).`,
    }
  })
}

/* ── Checking one account's number and range ─────────────────────────────── */

export const NEW_ACCOUNT_ID = '__new_account__'

export interface PlacementInput {
  /** The account being edited. Omitted when creating one. */
  accountId?: string
  accountNumber: string
  accountName?: string
  glAccountType: 'Posting' | 'Summary'
  parentId: string | null
  /** The block a summary reserves. Null or omitted for none. */
  range?: NumberRange | null
  /** Accounts that will move under this one as it is saved - the account a
   *  "Move under a new summary account" wraps. Their numbers are this
   *  summary's, not a stranger's. */
  adopts?: string[]
  chart: RangeChartRow[]
  protection: boolean
}

/* The chart as it would stand once this account is saved. */
function withPlacement(p: PlacementInput): { chart: RangeChartRow[]; selfId: string } {
  const selfId = p.accountId ?? NEW_ACCOUNT_ID
  const self: RangeChartRow = {
    id: selfId,
    parentId: p.parentId,
    glAccountType: p.glAccountType,
    accountNumber: p.accountNumber.trim(),
    accountName: p.accountName ?? '',
    numberRangeStart: p.glAccountType === 'Summary' ? p.range?.start : undefined,
    numberRangeEnd: p.glAccountType === 'Summary' ? p.range?.end : undefined,
  }
  const adopts = new Set(p.adopts ?? [])
  const rest = p.chart
    .filter(a => a.id !== selfId)
    .map(a => (adopts.has(a.id) ? { ...a, parentId: selfId } : a))
  return { chart: [...rest, self], selfId }
}

/* Why this account cannot be saved with this number (and, for a summary, this
   range) - or null when it can.

   Only what the change itself breaks is reported. A chart that already broke a
   reservation before - an import let in with protection off, say - does not
   hold every unrelated edit hostage to it; the reader is told about what they
   are doing now. */
export function checkPlacement(p: PlacementInput): RangeProblem | null {
  const chartWidth = chartNumberWidth(p.chart)
  const n = measuredValueOf(p.accountNumber, chartWidth)
  const range = p.glAccountType === 'Summary' ? p.range ?? null : null

  /* A summary's number is the first number of the block it reserves (decision
     84). Inside but further along - 11655 reserving 11650-11699 - it takes a
     number one of its own accounts should have. Module review, 2026-10-06
     (COA-14); Outline 09, Where the prototype differs. */
  const own = numericValueOf(p.accountNumber)
  if (range && own !== null && own !== range.start) {
    return { text: `A summary's number is the first number of the range it reserves. Use ${range.start}, or change the range.`, onNumber: true }
  }
  if (n === null && !range) return null

  const before = new Set(violationsOf(p.chart, p.protection, indexChart(p.chart, chartWidth)).map(violationKey))
  const { chart, selfId } = withPlacement(p)
  const idx = indexChart(chart, chartWidth)
  const fresh = violationsOf(chart, p.protection, idx).filter(v => !before.has(violationKey(v)))
  if (!fresh.length) return null

  const adopts = new Set(p.adopts ?? [])
  const ancestors = idx.ancestorsOf(selfId)
  const isAncestor = (id: string) => ancestors.some(a => a.id === id)
  const isSelf = (id: string) => id === selfId || adopts.has(id)

  /* Nearest cause first: the account's own number landing in someone's block
     reads plainer than the ripple it causes further up the tree. */
  const rank = (v: Violation) =>
    v.kind === 'number' && isSelf(v.account.id) ? 0
      : v.kind === 'number' && v.summary.id === selfId ? 1
        : v.kind === 'overlap' && (v.a.id === selfId || v.b.id === selfId) ? 2
          : 3
  /* Within a rank, the tightest block first: a number inside both Cash
     (11100-11199) and Current Assets (11000-11999) is in Cash's way before it is
     in Current Assets', and Cash is the account the reader has to look at. */
  const width = (v: Violation) => v.kind === 'number'
    ? v.span.range.end - v.span.range.start
    : Math.min(v.aSpan.range.end - v.aSpan.range.start, v.bSpan.range.end - v.bSpan.range.start)
  const v = [...fresh].sort((x, y) => rank(x) - rank(y) || width(x) - width(y))[0]

  if (v.kind === 'number' && isSelf(v.account.id)) {
    // An auto span is not set aside by anyone: it is where the summary's own
    // accounts already run, from its number to its last account.
    const where = v.span.auto
      ? `the numbers the accounts under {holder} already use (${formatRange(v.span.range)})`
      : `the range {holder} sets aside (${formatRange(v.span.range)})`
    return { text: `This number is inside ${where}. Pick a number outside it.`, holder: holderOf(v.summary) }
  }
  if (v.kind === 'number' && v.summary.id === selfId) {
    return { text: `{holder} already uses a number in this range. Pick a different range.`, holder: holderOf(v.account) }
  }
  if (v.kind === 'overlap' && (v.a.id === selfId || v.b.id === selfId)) {
    const other = v.a.id === selfId ? v.b : v.a
    const otherSpan = v.a.id === selfId ? v.bSpan : v.aSpan
    return { text: `This range overlaps the one {holder} sets aside (${formatRange(otherSpan.range)}). Pick a range that doesn't overlap it.`, holder: holderOf(other) }
  }
  /* The ripple: with protection on, placing an account far from its siblings
     stretches the span every summary above it keeps, and the stretch runs into
     somebody else's numbers. */
  const stretched = v.kind === 'number' ? v.summary : (isAncestor(v.a.id) ? v.a : v.b)
  const intoWhom = v.kind === 'number' ? v.account : (isAncestor(v.a.id) ? v.b : v.a)
  return {
    text: `This number is too far from the other accounts under {holder}. It would push that range into the numbers of {other}. Pick a number closer to the others.`,
    holder: holderOf(stretched),
    other: holderOf(intoWhom),
  }
}

/* ── What to offer ────────────────────────────────────────────────────────── */

/* The size of block a summary under this parent reserves: one zero smaller than
   the parent's. Eli, 2026-09-24: *"Each one reserves a digit inside of that
   digit ... 10,000 for the top one, 1,000 for the next one, 100 for the next
   one."*

   Read off the parent's own block when it has one - a block of 1,000 is divided
   into tens of 100. A parent reserving a block that is not a round power of ten
   (an imported 1015-1049) is divided by the largest power of ten that still
   leaves room for ten of them. A parent reserving nothing is sized by where it
   sits instead: the number's width, less one zero per level down. Null when the
   answer would be a block of fewer than ten numbers, which is not a block. */
export function childBlockSize(parent: RangeChartRow, chart: RangeChartRow[]): number | null {
  const typed = accountRange(parent)
  let size: number
  if (typed) {
    const span = typed.end - typed.start + 1
    size = Math.pow(10, Math.floor(Math.log10(span)) - 1)
  } else {
    const n = numericValueOf(parent.accountNumber)
    if (n === null) return null
    const depth = indexChart(chart).ancestorsOf(parent.id).length
    size = Math.pow(10, parent.accountNumber.trim().length - 2 - depth)
  }
  return size >= 10 ? size : null
}

/* The block a parent is divided in: its typed range, or - for a parent that
   reserves nothing - the ten child blocks after its own number, which is the
   stretch the cascade would have given it. */
function parentBlock(parent: RangeChartRow, size: number): NumberRange | null {
  const typed = accountRange(parent)
  if (typed) return typed
  const n = numericValueOf(parent.accountNumber)
  return n === null ? null : { start: n, end: n + size * 10 - 1 }
}

export interface BlockOffer {
  /** The parent's own typed reservation, when it has one. */
  parentRange: NumberRange | null
  /** The size of block this level of the tree reserves. Null when none fits. */
  blockSize: number | null
  /** Clean blocks inside the parent, in order. */
  inParent: NumberRange[]
  /** The one to take: the next clean block after the ones already used. */
  recommended: NumberRange | null
  /** Clean blocks elsewhere, offered only when the parent has none left. */
  outside: NumberRange[]
}

const EMPTY_OFFER: BlockOffer = { parentRange: null, blockSize: null, inParent: [], recommended: null, outside: [] }

/* The blocks a new summary under this parent can reserve.

   Clean blocks of the cascade's size only - Eli, 2026-09-24: *"What you
   wouldn't want to do is take the last 500, because then if you want to come in
   afterwards, you don't have a block that you could take."* A block is clean
   when `checkPlacement` would accept a summary reserving it, which makes the
   offer and the check the same rule read in two directions.

   Recommended is the first clean block after everything the parent already
   holds - *"the next block is 1120, so my expectation is to pick the next
   one"* - falling back to the first clean block anywhere under it.

   Outside the parent only when nothing is left inside it (Mahreen,
   2026-09-24), searched through the blocks of the nearest level above that
   reserves one. */
export function offerBlocks(ctx: {
  parent: RangeChartRow | null
  chart: RangeChartRow[]
  protection: boolean
  /** The summary being edited, so its own block does not read as taken. */
  accountId?: string
  adopts?: string[]
}): BlockOffer {
  const { parent, chart, protection } = ctx
  if (!parent) return EMPTY_OFFER
  const size = childBlockSize(parent, chart)
  const parentRange = accountRange(parent)
  if (!size) return { ...EMPTY_OFFER, parentRange }
  const block = parentBlock(parent, size)
  if (!block) return { ...EMPTY_OFFER, parentRange, blockSize: size }

  const clean = (r: NumberRange) => !checkPlacement({
    accountId: ctx.accountId,
    accountNumber: String(r.start),
    glAccountType: 'Summary',
    parentId: parent.id,
    range: r,
    adopts: ctx.adopts,
    chart,
    protection,
  })
  const blocksIn = (outer: NumberRange, s: number): NumberRange[] => {
    const out: NumberRange[] = []
    const first = Math.ceil(outer.start / s) * s
    for (let start = first; start + s - 1 <= outer.end && out.length < 200; start += s) {
      out.push({ start, end: start + s - 1 })
    }
    return out
  }

  /* A block opening on the number of an account that is moving under the new
     summary - "Move under a new summary account" - cannot open there: the
     moving account keeps its number, and the summary cannot share it. So the
     summary takes the number directly in front of the account, and the block
     runs from there to the block's own end: Petty Cash at 11110 gets a summary
     at 11109 reserving 11109-11119. A parent sits above what it totals, the
     way every summary in the chart does, and the account keeps the number it
     had. Design review, 2026-10-02 - Eli: *"The ideal account is 11109, so that
     petty cash remains 11110, and eats up till 11119 ... So the end number is
     fine, right? But the first number is not."* It is why blocks step in tens:
     there is room one upward without reaching into the block above.

     Where the number in front is taken or would break a rule, the block opens
     one past the account instead, as it used to - a summary below its account
     is odd, but not wrong. Only for the accounts being moved. A block opening on
     anyone else's number is simply not clean, and trimming it would be
     squeezing a summary in beside them. */
  const adoptedNums = new Set(
    (ctx.adopts ?? [])
      .map(id => chart.find(a => a.id === id))
      .map(a => (a ? numericValueOf(a.accountNumber) : null))
      .filter((n): n is number => n !== null),
  )
  const opened = (r: NumberRange): NumberRange | null => {
    if (!adoptedNums.has(r.start)) return r
    const inFront = { start: r.start - 1, end: r.end }
    if (!adoptedNums.has(inFront.start) && clean(inFront)) return inFront
    let start = r.start
    while (start <= r.end && adoptedNums.has(start)) start++
    return start <= r.end ? { start, end: r.end } : null
  }
  const inParent = blocksIn(block, size)
    .map(opened)
    .filter((r): r is NumberRange => !!r && clean(r))

  const idx = indexChart(chart)
  const under = idx.descendantsOf(parent.id).filter(a => a.id !== ctx.accountId)
  const highWater = Math.max(
    -Infinity,
    ...under.map(a => numericValueOf(a.accountNumber) ?? -Infinity),
    ...under.map(a => accountRange(a)?.end ?? -Infinity),
  )
  /* Moving an account under a new summary: the block nearest the account, so the
     summary lands beside what it is taking in. Otherwise the next block after
     everything the parent already holds. */
  const nearestTo = [...adoptedNums][0]
  const recommended = nearestTo !== undefined
    ? [...inParent].sort((a, b) => Math.abs(a.start - nearestTo) - Math.abs(b.start - nearestTo))[0] ?? null
    : inParent.find(r => r.start > highWater) ?? inParent[0] ?? null

  let outside: NumberRange[] = []
  if (!inParent.length) {
    const above = idx.ancestorsOf(parent.id).find(a => accountRange(a))
    const outer = above ? accountRange(above)! : null
    if (outer) {
      outside = blocksIn(outer, size)
        .filter(r => !rangesOverlap(r, block))
        .map(opened)
        .filter((r): r is NumberRange => !!r && clean(r))
        .slice(0, 6)
    }
  }
  return { parentRange, blockSize: size, inParent, recommended, outside }
}

/* The number a new posting account under this parent would take.

   Next after its siblings, on the step they already keep - a branch numbered
   11110, 11120, 11130 is offered 11140, not 11101. A branch with no postings
   yet is offered its parent's number plus ten. Whatever the arithmetic lands
   on has to pass `checkPlacement`, so a number inside a child summary's block
   is stepped over; and where the step runs out, the lowest number the rules
   accept in the parent's block is offered instead.

   Null only where there is nothing to count from: a parent with a lettered
   number and no block. The form offers nothing then rather than inventing a
   number. */
export function suggestPostingNumber(ctx: {
  parent: RangeChartRow | null
  chart: RangeChartRow[]
  protection: boolean
}): number | null {
  const { parent, chart, protection } = ctx
  if (!parent) return null
  const parentNum = numericValueOf(parent.accountNumber)
  const typed = accountRange(parent)
  if (parentNum === null && !typed) return null

  const held = new Set(chart.map(a => numericValueOf(a.accountNumber)).filter((n): n is number => n !== null))
  /* The blocks a posting here can never take - every summary's but its own
     parent's and those above it - read once, so the walk below can step over
     them without re-checking the whole chart at every number. */
  const idx = indexChart(chart)
  const mine = new Set([parent.id, ...idx.ancestorsOf(parent.id).map(a => a.id)])
  const barred = chart
    .filter(a => a.glAccountType === 'Summary' && !mine.has(a.id))
    .map(a => spanOf(a, idx, protection)?.range)
    .filter((r): r is NumberRange => !!r)
  let checks = 0
  const ok = (n: number) => {
    if (held.has(n) || barred.some(r => rangeContainsNumber(r, n))) return false
    if (++checks > 40) return false
    return !checkPlacement({ accountNumber: String(n), glAccountType: 'Posting', parentId: parent.id, chart, protection })
  }

  const siblings = chart
    .filter(a => a.parentId === parent.id && a.glAccountType === 'Posting')
    .map(a => numericValueOf(a.accountNumber))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b)
  const gaps = siblings.slice(1).map((n, i) => n - siblings[i]).filter(g => g > 0)
  const countOf = (g: number) => gaps.filter(x => x === g).length
  /* The step the siblings keep, when they keep a posting-sized one. Two postings
     filed a whole block apart under a division (32000 and 34000 under EQUITY)
     are not a series stepping in thousands, so anything over ten reads as ten. */
  const kept = gaps.length ? [...gaps].sort((a, b) => countOf(b) - countOf(a) || a - b)[0] : 10
  const step = kept <= 10 ? kept : 10
  const from = siblings.length ? siblings[siblings.length - 1] : (typed?.start ?? parentNum!)
  const ceiling = typed?.end ?? from + step * 100
  for (let n = from + step; n <= ceiling; n += step) if (ok(n)) return n

  const lo = typed?.start ?? parentNum!
  const hi = typed?.end ?? lo + 999
  for (let n = lo; n <= hi; n++) if (ok(n)) return n
  return null
}

/* ── A number beside an account ──────────────────────────────────────────

   For "Create account above" and "Create account below" on a row's menu.
   Design review, 2026-10-02 - Eli: *"I'm clicking on this, and I'm like, I want
   to create an account above it or below it."* The new account is the row's
   sibling, under the same parent, and its number falls in the gap on the side
   asked for: between the account above and this one, or between this one and
   the account below. A summary's side is everything it keeps, so "below" a
   summary lands after its whole branch rather than inside it.

   Between two neighbours, the middle of the gap, so the next insert still has
   room on both sides: 11120 and 11130 offer 11125. With nothing further on that
   side, one step of ten away (below the last account, 11170 offers 11180),
   or the middle where ten does not fit. Whatever that lands on has to pass the
   same rules `suggestPostingNumber` keeps, so the walk moves outward from it to
   the nearest number they accept. Null when the gap holds none - two accounts
   numbered one apart - and the form then leaves the number to the reader, with
   its own recommendation under the field. */
export function numberBeside(ctx: {
  account: RangeChartRow
  side: 'above' | 'below'
  chart: RangeChartRow[]
  protection: boolean
}): number | null {
  const { account, side, chart, protection } = ctx
  if (!account.parentId) return null
  const idx = indexChart(chart)
  const parent = idx.byId.get(account.parentId)
  if (!parent) return null
  const extent = (a: RangeChartRow): NumberRange | null => {
    const n = numericValueOf(a.accountNumber)
    const span = spanOf(a, idx, protection)?.range ?? null
    if (n === null) return span
    return span ? { start: Math.min(n, span.start), end: Math.max(n, span.end) } : { start: n, end: n }
  }
  const mine = extent(account)
  if (!mine) return null
  const others = (idx.children.get(parent.id) ?? [])
    .filter(a => a.id !== account.id)
    .map(extent)
    .filter((r): r is NumberRange => !!r)
  const parentNum = numericValueOf(parent.accountNumber)
  const parentRange = accountRange(parent)

  // The gap, as exclusive bounds, and where in it to start looking.
  let lo: number, hi: number, start: number
  if (side === 'above') {
    hi = mine.start
    const before = others.filter(r => r.end < mine.start).map(r => r.end)
    lo = before.length ? Math.max(...before) : (parentNum ?? (parentRange ? parentRange.start - 1 : hi - 11))
    start = before.length || hi - 10 <= lo ? Math.floor((lo + hi) / 2) : hi - 10
  } else {
    lo = mine.end
    const after = others.filter(r => r.start > mine.end).map(r => r.start)
    hi = after.length ? Math.min(...after) : (parentRange ? parentRange.end + 1 : lo + 11)
    start = after.length || lo + 10 >= hi ? Math.floor((lo + hi) / 2) : lo + 10
  }
  if (hi - lo < 2) return null

  const held = new Set(chart.map(a => numericValueOf(a.accountNumber)).filter((n): n is number => n !== null))
  const mineIds = new Set([parent.id, ...idx.ancestorsOf(parent.id).map(a => a.id)])
  const barred = chart
    .filter(a => a.glAccountType === 'Summary' && !mineIds.has(a.id))
    .map(a => spanOf(a, idx, protection)?.range)
    .filter((r): r is NumberRange => !!r)
  let checks = 0
  const ok = (n: number) => {
    if (n <= lo || n >= hi || held.has(n) || barred.some(r => rangeContainsNumber(r, n))) return false
    if (++checks > 60) return false
    return !checkPlacement({ accountNumber: String(n), glAccountType: 'Posting', parentId: parent.id, chart, protection })
  }
  for (let d = 0; d < hi - lo && checks <= 60; d++) {
    if (ok(start - d)) return start - d
    if (d && ok(start + d)) return start + d
  }
  return null
}

/* ── Defaults for a chart the product builds ──────────────────────────────── */

/* The cascade, for charts Omne numbers itself (guided setup, build from
   scratch). A category of width W opens on its first digit followed by zeros
   and reserves everything that starts with that digit; each level below takes
   one zero less. Eli, 2026-09-24: *"Top level reserves the whole range, its
   entire block."* These are defaults - every one of them can be changed on the
   summary afterwards. */
export function categoryBlock(firstDigit: number, width: number): NumberRange {
  const size = Math.pow(10, width - 1)
  return { start: firstDigit * size, end: firstDigit * size + size - 1 }
}

/** The k-th child block (1-based) of a block, one zero smaller. */
export function childBlock(parent: NumberRange, k: number): NumberRange | null {
  const size = Math.pow(10, Math.floor(Math.log10(parent.end - parent.start + 1)) - 1)
  if (size < 10) return null
  const start = parent.start + k * size
  const end = start + size - 1
  return end <= parent.end ? { start, end } : null
}
