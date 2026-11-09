import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Landmark, Merge } from 'lucide-react'
import { Marked, Tooltip } from '../../components/ui'
import { cn } from '../../lib/utils'
import { NEEDS_DETAILS_LABEL, REVIEW_STATUS_LABEL, mergedChipText, type ReviewColumn, type ReviewStatus } from './reviewColumns'

// The pieces a review cell is made of: the verdict chip, the explanation that
// appears on hover, the corner that marks an edit, and the editors themselves.

export type CellTone = 'error' | 'warning'
export interface CellFlag { tone: CellTone; message: string }

// ── Verdict ──

const STATUS_CLS: Record<ReviewStatus, string> = {
  ready: 'bg-success-50 text-success-700 border-success-100',
  warning: 'bg-warning-50 text-warning-700 border-warning-100',
  error: 'bg-danger-50 text-danger-700 border-danger-100',
}

/* The Result column's chips take the search too: it reads them as they print
   (see `searchableTexts`), so a row found by its verdict shows why. */
export function StatusChip({ status, query = '' }: { status: ReviewStatus; query?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold whitespace-nowrap', STATUS_CLS[status])}>
      <Marked text={REVIEW_STATUS_LABEL[status]} q={query} />
    </span>
  )
}

/* A summary the file stated more than once. The count sits where the verdict is
   read, and the numbers those statements arrived as are on it: a row that says
   the file had two of these has to be able to show which two. */
export function MergedChip({ from, query = '' }: { from: string[]; query?: string }) {
  return (
    <Tooltip
      side="bottom"
      content={
        <span className="block max-w-[240px]">
          <span className="block">Your file states this summary more than once. A summary holds no balance and takes no transactions, so it is imported once.</span>
          <span className="block mt-1 tabular-nums" style={{ fontWeight: 600 }}>{from.slice(0, 6).join('   ')}</span>
          {from.length > 6 && <span className="block text-fg-subtle mt-0.5">+{from.length - 6} more</span>}
        </span>
      }
    >
      <span className="inline-flex items-center gap-1 rounded-full border border-info-100 bg-info-50 px-2 py-0.5 text-2xs font-semibold text-info-700 whitespace-nowrap cursor-default">
        <Merge size={10} className="shrink-0" />
        <Marked text={mergedChipText(from)} q={query} />
        {/* Hovering is not available to a screen reader, and the count on its own
            gives nobody a way to check which rows it is about. */}
        <span className="sr-only">{`: ${from.join(', ')}`}</span>
      </span>
    </Tooltip>
  )
}

/* A row that is right and unfinished. The import template has no columns for a
   bank's name or a card's number, so the file could not have carried them and
   their absence is nobody's mistake. It sits beside the verdict rather than in
   it: this is a to-do, and reading as an Error or a Warning would put it in the
   list of things to fix before importing. */
export function NeedsDetailsChip({ query = '' }: { query?: string }) {
  return (
    <Tooltip
      side="bottom"
      content={
        <span className="block max-w-[240px]">
          Bank and credit card accounts hold details the import template does not carry. This account imports, and you add them to it afterwards.
        </span>
      }
    >
      <span className="inline-flex items-center gap-1 rounded-full border border-info-100 bg-info-50 px-2 py-0.5 text-2xs font-semibold text-info-700 whitespace-nowrap cursor-default">
        <Landmark size={10} className="shrink-0" />
        <Marked text={NEEDS_DETAILS_LABEL} q={query} />
      </span>
    </Tooltip>
  )
}

// ── Tinting ──

/** The ring a cell draws, strongest state first: editing, focused, then flagged. */
export function cellRing({ editing, active, flag }: { editing?: boolean; active?: boolean; flag?: CellFlag }): string {
  if (editing) return 'ring-2 ring-inset ring-primary shadow-[inset_0_0_0_3px_hsl(var(--primary)/0.15)]'
  if (active) return 'ring-2 ring-inset ring-primary'
  if (flag?.tone === 'error') return 'ring-1 ring-inset ring-danger-200'
  if (flag?.tone === 'warning') return 'ring-1 ring-inset ring-warning-200'
  return ''
}

export const flagBg = (flag?: CellFlag) =>
  flag?.tone === 'error' ? 'bg-danger-50/60' : flag?.tone === 'warning' ? 'bg-warning-50/60' : ''

// ── Explanation ──

export function useFlagPopover(active: boolean) {
  const ref = useRef<HTMLTableCellElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const onEnter = () => { if (active && ref.current) setRect(ref.current.getBoundingClientRect()) }
  const onLeave = () => setRect(null)
  return { ref, rect: active ? rect : null, onEnter, onLeave }
}

/* A tinted badge, the sentence, and the value that earned it. Portalled, since
   the grid scrolls in both directions and would otherwise clip it. */
export function FlagPopover({ rect, flag, example, options }: {
  rect: DOMRect; flag: CellFlag; example?: string; options?: string[]
}) {
  const above = rect.top > 220
  const badge = flag.tone === 'error'
    ? 'bg-danger-50 text-danger-700 border-danger-100'
    : 'bg-warning-50 text-warning-700 border-warning-100'
  return createPortal(
    <div
      className="fixed z-[90] w-80 bg-white border border-border rounded-xl shadow-xl p-3 text-left"
      style={{ left: rect.left + rect.width / 2, top: above ? rect.top - 8 : rect.bottom + 8, transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }}
    >
      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold', badge)}>
        {flag.tone === 'error' ? 'Error' : 'Warning'}
      </span>
      <p className="text-xs text-fg-muted leading-relaxed mt-2">{flag.message}</p>
      {options?.length ? (
        <div className="mt-2 rounded-lg border border-border bg-bg-subtle/50 px-2.5 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Options</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {options.map(o => (
              <span key={o} className="inline-flex items-center rounded-md border border-border bg-white px-1.5 py-0.5 text-2xs text-fg">{o}</span>
            ))}
          </div>
        </div>
      ) : example ? (
        <div className="mt-2 rounded-lg border border-border bg-bg-subtle/50 px-2.5 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Example</div>
          <div className="text-xs font-mono text-fg mt-0.5 break-all">{example}</div>
        </div>
      ) : null}
      <span className={cn('absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-white border-border', above ? '-bottom-1 border-b border-r' : '-top-1 border-t border-l')} aria-hidden />
    </div>,
    document.body,
  )
}

// ── Edit marker ──

/* A corner triangle on a cell that was changed, holding what it said before.
   Without it a fixed row is indistinguishable from a row that arrived correct. */
export function EditedCorner({ original }: { original: string }) {
  const [hover, setHover] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  return (
    <>
      <span
        ref={ref}
        onMouseEnter={() => { setHover(true); if (ref.current) setRect(ref.current.getBoundingClientRect()) }}
        onMouseLeave={() => setHover(false)}
        className="absolute top-0 left-0 z-[2]"
        style={{ width: 0, height: 0, borderTop: '6px solid hsl(var(--primary))', borderRight: '6px solid transparent' }}
      />
      {hover && rect && createPortal(
        <div
          className="fixed z-[95] max-w-xs rounded-lg bg-fg px-2.5 py-1.5 text-2xs text-white shadow-lg"
          style={{ left: rect.left, top: rect.top - 8, transform: 'translate(-25%, -100%)' }}
        >
          Edited, original value: {original ? `"${original}"` : 'empty'}
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Reading a cell ──

/** A cell's text with the search hit marked, or a dash when there is nothing. */
export function CellText({ value, query, mono, muted }: { value: string; query: string; mono?: boolean; muted?: boolean }) {
  if (!value) return <span className="text-fg-subtle/60">-</span>
  return (
    <span className={cn('truncate', mono && 'tabular-nums', muted && 'text-fg-muted')}>
      <Marked text={value} q={query} />
    </span>
  )
}

// ── Editing a cell ──

/* A text editor that fills its cell. Enter commits and steps down, Tab commits
   and steps across, Escape abandons the change; a single guard makes sure the
   commit fires once however the editor is left. */
export function TextCellEditor({ value, mono, onCommit, onCancel }: {
  value: string
  mono?: boolean
  onCommit: (next: string, move: 'down' | 'right' | 'left' | 'none') => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  const doneRef = useRef(false)
  useLayoutEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  const finish = (move: 'down' | 'right' | 'left' | 'none') => {
    if (doneRef.current) return
    doneRef.current = true
    onCommit(draft.trim(), move)
  }
  return (
    <input
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => finish('none')}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); finish('down') }
        else if (e.key === 'Tab') { e.preventDefault(); finish(e.shiftKey ? 'left' : 'right') }
        else if (e.key === 'Escape') { e.preventDefault(); doneRef.current = true; onCancel() }
      }}
      className={cn('w-full h-full bg-transparent border-0 outline-none text-[13px] text-fg px-3', mono && 'tabular-nums')}
      style={{ margin: 0 }}
    />
  )
}

/* A fixed list of values. Rendered as a floating panel rather than a native
   select so the options read the same as everywhere else in the app, and so a
   blank option can clear an optional column. */
export function EnumCellEditor({ value, options, allowBlank, onCommit, onCancel }: {
  value: string
  options: string[]
  allowBlank?: boolean
  onCommit: (next: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  useLayoutEffect(() => { if (ref.current) setRect(ref.current.getBoundingClientRect()) }, [])
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-cell-dropdown]')) onCancel()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true) }
  }, [onCancel])

  const items = allowBlank ? ['', ...options] : options
  return (
    <div ref={ref} className="w-full h-full">
      {rect && createPortal(
        <div
          data-cell-dropdown
          className="fixed z-[95] max-h-64 w-max min-w-[--w] overflow-auto scrollbar-thin rounded-lg border border-border bg-white p-1 shadow-xl"
          style={{ left: rect.left, top: rect.bottom + 2, ['--w' as string]: `${rect.width}px` }}
        >
          {items.map(o => (
            <button
              key={o || '(blank)'}
              onMouseDown={e => { e.preventDefault(); onCommit(o) }}
              className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-bg-subtle',
                o === value ? 'text-primary font-medium' : 'text-fg')}
            >
              {o || <span className="text-fg-subtle italic">Clear</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

/* The parent column: an autocomplete over the summary accounts a row could sit
   under, which is the existing chart plus the summary rows in this same file. A
   parent that is not a summary account is the commonest reason a hierarchy
   arrives wrong, so the list is offered rather than the field left free. */
export function ParentCellEditor({ value, candidates, onCommit, onCancel }: {
  value: string
  candidates: { number: string; name: string }[]
  onCommit: (next: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  useLayoutEffect(() => {
    inputRef.current?.focus(); inputRef.current?.select()
    if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect())
  }, [])
  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    const pool = q ? candidates.filter(c => c.number.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) : candidates
    return pool.slice(0, 40)
  }, [candidates, draft])
  return (
    <div ref={wrapRef} className="w-full h-full">
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onCommit(draft.trim()) }
          else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
          else if (e.key === 'Tab') { e.preventDefault(); onCommit(draft.trim()) }
        }}
        onBlur={() => onCommit(draft.trim())}
        className="w-full h-full bg-transparent border-0 outline-none text-[13px] text-fg px-3 tabular-nums"
        style={{ margin: 0 }}
      />
      {rect && matches.length > 0 && createPortal(
        <div
          data-cell-dropdown
          className="fixed z-[95] max-h-64 w-64 overflow-auto scrollbar-thin rounded-lg border border-border bg-white p-1 shadow-xl"
          style={{ left: rect.left, top: rect.bottom + 2 }}
        >
          {matches.map(c => (
            <button
              key={c.number}
              onMouseDown={e => { e.preventDefault(); onCommit(c.number) }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-bg-subtle"
            >
              <span className="text-[13px] tabular-nums text-fg">{c.number}</span>
              <span className="truncate text-xs text-fg-muted">{c.name}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

/** Dispatch to the editor a column's values deserve. */
export function CellEditor({ column, value, options, candidates, onCommit, onCancel }: {
  column: ReviewColumn
  value: string
  /** The column's list narrowed to this row, where the row narrows it. */
  options?: string[]
  candidates: { number: string; name: string }[]
  onCommit: (next: string, move: 'down' | 'right' | 'left' | 'none') => void
  onCancel: () => void
}) {
  const list = options ?? column.options
  if (column.editor === 'enum' && list) {
    return <EnumCellEditor value={value} options={list} allowBlank={column.key !== 'type'} onCommit={v => onCommit(v, 'none')} onCancel={onCancel} />
  }
  if (column.editor === 'parent') {
    return <ParentCellEditor value={value} candidates={candidates} onCommit={v => onCommit(v, 'none')} onCancel={onCancel} />
  }
  return <TextCellEditor value={value} mono={column.mono} onCommit={onCommit} onCancel={onCancel} />
}
