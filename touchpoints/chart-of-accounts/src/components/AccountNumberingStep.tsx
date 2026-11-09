import { useState } from 'react'
import { Minus, Plus, ChevronUp, ChevronDown, Check, Pencil } from 'lucide-react'
import { AccountType, categoryFirstNumber, NumberingScheme } from '../types'
import { cn } from '../lib/utils'
import { Banner } from './ui'
import { jumpToError } from '../lib/formErrors'

// =============================================================
// AccountNumberingStep
// =============================================================
// The numbering step: how long a suggested account number is, and nothing else.
// It is the first step of each of the three ways to build a chart (upload, build
// from scratch, guided setup), because each one needs to know how wide to write
// a number before it can suggest one. It draws no heading of its own - the flow
// that hosts it already shows one - and owns no state: the host holds the width,
// every edit calls onChange, and the host commits it when the step is left.
//
// It also sets the block each category keeps. That was asked here until number
// ranges were retired (2026-08-28) and came back with them: Mahad, 2026-10-01,
// *"We had setting up the ranges in the first-time view before. Can we bring it
// back?"* The blocks default from the width and stay locked until Edit ranges is
// pressed. They ride on the scheme (`categoryRanges`), and `seedCategoryAccounts`
// gives each category's summary its block, so the chart a flow builds is the one
// this step states. A category's block still files nothing: an account is filed by
// the category stated on it, never by its digits.
//
// DEPRECATED (spec §2 - subcategory cleanup): this step no longer routes account
// creation through the legacy `Subcategory` picker. Accounts are organised by
// Category → classification and by the summary each one names as its parent, never by a
// Subcategory pick. The `Subcategory`/`subType` concept is intentionally kept in
// types.ts for backward compatibility but must NOT drive creation from here. Do
// not reintroduce a Subcategory <Select> in this step.

const TYPE_ORDER: AccountType[] = ['AST', 'LIA', 'EQT', 'REV', 'EXP']
const TYPE_LABEL: Record<AccountType, string> = { AST: 'Assets', LIA: 'Liabilities', EQT: 'Equity', REV: 'Revenue', EXP: 'Expenses' }
// Per-category colour coding, reused by the preview row.
const TYPE_DOT: Record<AccountType, string> = {
  AST: 'bg-emerald-500', LIA: 'bg-amber-500', EQT: 'bg-violet-500', REV: 'bg-sky-500', EXP: 'bg-rose-500',
}

/* Never below four (decision 40; module review, 2026-10-06, COA-14): a
   three-digit chart runs out of the room the cascading blocks are cut from. */
const MIN_DIGITS = 4
const MAX_DIGITS = 8

/* One wording for the step, read by all three flows that host it. The tab names
   the single question the step asks rather than the subject it belongs to:
   "Numbering" sounded like a scheme to be designed, and there is no scheme left
   to design here. */
export const NUMBERING_STEP_LABEL = 'Number length'
// Copy: Mahad, 2026-10-02 (Build from scratch UX copy), verbatim.
export const NUMBERING_STEP_TITLE = 'Set up your account numbers'
// Says what the step does and, just as importantly, what it does not do. The
// earlier wording promised that this decided how reports were built, which was
// the range table talking; a width decides nothing but how a suggestion is
// written, and a customer who reads more into it will go looking for a rule that
// is not there.
export const NUMBERING_STEP_SUBTITLE = 'Choose how your account numbers will look before you add accounts.'

// The width the customer chose, in range. The stepper cannot leave it otherwise,
// so this holds nothing back. Kept because all three hosts gate Continue on it
// and a step with no gate should still say so out loud.
export function numberWidthValid(digits: number): boolean {
  return digits >= MIN_DIGITS && digits <= MAX_DIGITS
}

// Translate the width into the app's NumberingScheme: one segment, written at
// the width asked for. A flat chart is the only thing this step can produce.
export function schemeFromNumberWidth(digits: number): NumberingScheme {
  return { segments: [{ index: 0, length: digits, meaning: 'Account', separator: '' }] }
}

/* The category blocks as the step edits them: text, because a range is typed a
   digit at a time and passes through states that are not yet numbers. */
export type CategoryRangeDraft = Record<AccountType, { from: string; to: string }>

/** Each category's block at this width: its first digit, then 10^(width-1) numbers. */
export function defaultCategoryRanges(digits: number): CategoryRangeDraft {
  const size = 10 ** (digits - 1)
  return Object.fromEntries(TYPE_ORDER.map(code => {
    const first = categoryFirstNumber(code, digits)
    return [code, { from: String(first), to: String(first + size - 1) }]
  })) as CategoryRangeDraft
}

/* What is wrong with each category's block, if anything. One message per row,
   naming the fix. A block is held to the width asked for, has to hold at least a
   hundred numbers - the least a block can be cut into groups from (`childBlock`)
   - and may not overlap another category's, since every number in a block is
   kept for that category. */
export function categoryRangeProblems(ranges: CategoryRangeDraft, digits: number): Partial<Record<AccountType, string>> {
  const out: Partial<Record<AccountType, string>> = {}
  const read = (code: AccountType) => {
    const { from, to } = ranges[code]
    const a = /^\d+$/.test(from) ? parseInt(from, 10) : NaN
    const b = /^\d+$/.test(to) ? parseInt(to, 10) : NaN
    return { a, b, ok: Number.isFinite(a) && Number.isFinite(b) }
  }
  for (const code of TYPE_ORDER) {
    const { from, to } = ranges[code]
    const { a, b, ok } = read(code)
    const name = TYPE_LABEL[code]
    if (!ok) { out[code] = `${name} needs a start and an end number.`; continue }
    if (from.length !== digits || to.length !== digits) { out[code] = `The ${name} range needs numbers ${digits} digits long.`; continue }
    if (b <= a) { out[code] = `${name} needs an end number above its start.`; continue }
    if (b - a + 1 < 100) { out[code] = `${name} needs a block of at least 100 numbers.`; continue }
    const other = TYPE_ORDER.find(o => {
      if (o === code) return false
      const r = read(o)
      return r.ok && r.b > r.a && a <= r.b && r.a <= b
    })
    if (other) out[code] = `${name} overlaps the ${TYPE_LABEL[other]} range, ${ranges[other].from} to ${ranges[other].to}.`
  }
  return out
}

/* The error standard (decision 120; module review, 2026-10-06, COA-28):
   Continue stays pressable, and pressing it over a problem lists every one in
   a summary that stays on screen and takes the reader to the first. The
   summary is drawn by the step (`attempted`); the host calls this on Continue. */
export function jumpToRangeProblem() {
  window.setTimeout(() => jumpToError(document.querySelector<HTMLElement>('[data-range-problem]')?.closest<HTMLElement>('[data-category-range]') ?? null), 0)
}

export const categoryRangesValid = (ranges: CategoryRangeDraft, digits: number) =>
  Object.keys(categoryRangeProblems(ranges, digits)).length === 0

/** The scheme, carrying the blocks the reader set. */
export function schemeFromNumbering(digits: number, ranges: CategoryRangeDraft): NumberingScheme {
  return {
    ...schemeFromNumberWidth(digits),
    categoryRanges: Object.fromEntries(TYPE_ORDER.map(code => [code, { start: parseInt(ranges[code].from, 10), end: parseInt(ranges[code].to, 10) }])),
  }
}

/* `ranges` and `onRangesChange` make the blocks editable. A flow that builds no
   chart of its own - an import brings its own - leaves them out, and the step
   states the default blocks without offering to change them. */
export function AccountNumberingStep({ digits, onChange, ranges, onRangesChange, lengthOnly, attempted }: {
  digits: number
  onChange: (next: number) => void
  /** Continue has been pressed: the summary of what is wrong shows, and stays
      until each is fixed. */
  attempted?: boolean
  /* The length alone, for the Account numbers settings page: after setup each
     category's block is on its own row in the chart, so a table of defaults
     here would state blocks the chart may no longer have. */
  lengthOnly?: boolean
  ranges?: CategoryRangeDraft
  onRangesChange?: (next: CategoryRangeDraft) => void
}) {
  // A new width rebuilds every block to that width's defaults.
  const set = (d: number) => {
    const next = Math.min(MAX_DIGITS, Math.max(MIN_DIGITS, d))
    if (next === digits) return
    onChange(next)
    onRangesChange?.(defaultCategoryRanges(next))
  }
  const editable = !!ranges && !!onRangesChange
  const shown = ranges ?? defaultCategoryRanges(digits)
  // The blocks follow the defaults and stay locked until the reader opts in.
  const [editing, setEditing] = useState(false)
  const problems = editable ? categoryRangeProblems(shown, digits) : {}
  const problemList = TYPE_ORDER.flatMap(code => (problems[code] ? [problems[code]!] : []))
  const showSummary = !!attempted && problemList.length > 0
  const patch = (code: AccountType, part: Partial<{ from: string; to: string }>) =>
    onRangesChange?.({ ...shown, [code]: { ...shown[code], ...part } })
  // Nudge a field by one; a blank one steps off its default.
  const step = (code: AccountType, field: 'from' | 'to', dir: 1 | -1) => {
    const cur = parseInt(shown[code][field] || defaultCategoryRanges(digits)[code][field], 10)
    patch(code, { [field]: String(Math.max(0, (Number.isFinite(cur) ? cur : 0) + dir)) })
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-4 sm:p-5">
      {showSummary && (
        <div data-range-summary className="mb-4">
          <Banner tone="danger" title={`These ranges can't be saved yet - ${problemList.length} ${problemList.length === 1 ? 'thing' : 'things'} to fix.`}>
            <ul className="mt-1.5 space-y-1 list-disc pl-4 marker:text-danger-400">
              {problemList.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </Banner>
        </div>
      )}
      {/* Number length. The stepper sits on the heading's own line rather than
          under it, which is the one place in this step where a control is small
          enough to share a line with its question. It carries no label of its
          own: the heading beside it is the label, and repeating it would put the
          same three words twice on one line. */}
      <div data-walkthrough="numbering-length" className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm text-fg" style={{ fontWeight: 600 }}>Default account number length</h3>
          <p className="text-xs text-fg-muted mt-0.5 max-w-md leading-relaxed">Omne uses 5 digits by default, so you have room to add more accounts as your business grows. You can change this to suit your company. This only affects the numbers Omne suggests.</p>
        </div>
        <div className="inline-flex items-center rounded-lg border border-border overflow-hidden shrink-0">
          <button type="button" aria-label="Default account number length: one fewer digit" onClick={() => set(digits - 1)} disabled={digits <= MIN_DIGITS} className="w-8 h-8 flex items-center justify-center text-fg-muted hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed"><Minus size={14} /></button>
          <span className="w-9 h-8 flex items-center justify-center text-sm tabular-nums border-x border-border" style={{ fontWeight: 600 }}>{digits}</span>
          <button type="button" aria-label="Default account number length: one more digit" onClick={() => set(digits + 1)} disabled={digits >= MAX_DIGITS} className="w-8 h-8 flex items-center justify-center text-fg-muted hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed"><Plus size={14} /></button>
        </div>
      </div>

      {!lengthOnly && <>
      <div className="border-t border-border my-4" />

      {/* What the width produces, and how the chart keeps it tidy. Design review,
          2026-09-24: each category reserves its whole block, each group under it
          a block one zero smaller, and number protection keeps the stretch from a
          summary to its last account for its own accounts. Said here because this
          is where the reader decides the width those blocks are cut from - and
          because the setting that switches protection off lives on a page this
          flow never shows. */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm text-fg" style={{ fontWeight: 600 }}>Number ranges by category</h3>
            <p className="text-xs text-fg-muted mt-0.5 max-w-xl leading-relaxed">
              Set the range of numbers each category can use.
            </p>
          </div>
          {editable && (
            <button
              type="button"
              data-walkthrough="numbering-edit"
              onClick={() => setEditing(v => !v)}
              className={cn('shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs transition-colors',
                editing ? 'border-primary text-primary bg-primary/5 hover:bg-primary/10' : 'border-border text-fg-muted hover:bg-bg-subtle')}
              style={{ fontWeight: 500 }}
            >
              {editing ? <Check size={14} /> : <Pencil size={14} />}
              {editing ? 'Done' : 'Edit ranges'}
            </button>
          )}
        </div>

        {/* One layout locked and open: the numbers sit in their From and To
            columns either way, so nothing moves when Edit ranges is pressed - the
            fields simply become typeable. */}
        <div className="mt-3" data-walkthrough="numbering-ranges">
          <div className={cn(RANGE_GRID, 'gap-2 pb-1.5 border-b border-border text-2xs text-fg-subtle')} style={{ fontWeight: 600 }}>
            <div>Category</div>
            <div>From</div>
            <div>To</div>
          </div>
          <div className="divide-y divide-border">
            {TYPE_ORDER.map(code => {
              const problem = problems[code]
              const field = cn(NUM_INPUT, problem && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/10')
              return (
                <div key={code} className={cn(RANGE_GRID, 'gap-2 items-center py-1.5')} data-category-range={code}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[code]}`} />
                    <span className="text-sm text-fg truncate">{TYPE_LABEL[code]}</span>
                  </div>
                  <StepperInput label={`${TYPE_LABEL[code]} from`} value={shown[code].from} className={field} disabled={!editing}
                    onChange={v => patch(code, { from: v })} onStep={dir => step(code, 'from', dir)} />
                  <StepperInput label={`${TYPE_LABEL[code]} to`} value={shown[code].to} className={field} disabled={!editing}
                    onChange={v => patch(code, { to: v })} onStep={dir => step(code, 'to', dir)} />
                  {/* Continue is held while a block does not read, so the row
                      holding it says so on itself. */}
                  {problem && <p data-range-problem className="col-span-full text-2xs text-danger-600 pb-0.5">{problem}</p>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      </>}
    </div>
  )
}

const RANGE_GRID = 'grid grid-cols-[minmax(0,1fr)_84px_84px] sm:grid-cols-[minmax(0,1fr)_110px_110px]'
const NUM_INPUT = 'w-full h-8 px-2.5 rounded-lg border border-border bg-white text-sm tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none placeholder:text-fg-subtle/50 disabled:bg-bg-subtle/40 disabled:text-fg-muted disabled:cursor-not-allowed'

// A numeric text input with a stacked up/down spinner docked at the right edge,
// as the step drew it before ranges were retired. The chevrons nudge the value
// by one; typing accepts digits only.
function StepperInput({ label, value, className, onChange, onStep, disabled }: {
  label: string
  value: string
  className?: string
  onChange: (value: string) => void
  onStep: (dir: 1 | -1) => void
  disabled?: boolean
}) {
  const chevronBtn = 'h-[11px] w-5 flex items-center justify-center rounded-sm text-fg-subtle hover:bg-bg-subtle hover:text-fg transition-colors'
  return (
    <div className="relative">
      <input
        aria-label={label}
        value={value}
        inputMode="numeric"
        disabled={disabled}
        onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        className={cn(className, disabled ? 'pr-2.5' : 'pr-6')}
      />
      {!disabled && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-px">
          <button type="button" tabIndex={-1} aria-label={`${label}: up one`} onClick={() => onStep(1)} className={chevronBtn}><ChevronUp size={12} /></button>
          <button type="button" tabIndex={-1} aria-label={`${label}: down one`} onClick={() => onStep(-1)} className={chevronBtn}><ChevronDown size={12} /></button>
        </div>
      )}
    </div>
  )
}
