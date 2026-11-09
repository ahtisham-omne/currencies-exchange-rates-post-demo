/* The entity tag chip, drawn to the Cycle Count + Partners spec (shipped 21 Aug
   2026, "EntityTagChip"): one chip, one validator, two placements. Mahad,
   2026-09-30, for journal entries only - a Tags field while the entry is being
   written, and the same chips on its detail page, where they can still be added
   and removed.

   The values the spec ships: a slate-50 surface, a 1px slate-200 edge, slate-800
   text, an 8px corner, 12px / 500 on a 16px line, so the chip is 22px tall with
   its 2px padding and border. Lucide `tag` at 14px leads the strip on a detail
   page; Lucide `x` at 12px removes, going from muted to the text colour on hover.
   Add Tag is the same chip on a 1px dashed slate-300 edge. Colours are the
   palette's slate steps, never literals, so the look changes in one place. */
import { useRef, useState, type KeyboardEvent } from 'react'
import { Plus, Tag, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { Marked } from './ui'

export const MAX_TAGS = 8
export const MAX_TAG_LENGTH = 30

/* Trimmed at both ends and inner runs collapsed, so "dock 5" and "dock  5" are
   one tag. */
export const normaliseTag = (raw: string) => raw.replace(/\s+/g, ' ').trim()

/* The one validator both placements share. Returns the tag to add, or why it
   cannot be. Length is clamped as the reader types rather than refused here, so
   a long tag is never lost - the slice is only a guard for pasted text. */
export function checkTag(raw: string, existing: string[]): { tag: string } | { error: string } | null {
  const tag = normaliseTag(raw).slice(0, MAX_TAG_LENGTH)
  if (!tag) return null
  // Duplicate matching ignores case.
  if (existing.some(t => t.toLowerCase() === tag.toLowerCase())) return { error: `"${tag}" is already added.` }
  if (existing.length >= MAX_TAGS) return { error: `Up to ${MAX_TAGS} tags.` }
  return { tag }
}

const CHIP = 'inline-flex items-center gap-1 h-[22px] px-2 py-[2px] rounded-md border text-[12px] leading-4 whitespace-nowrap'

/* `q` marks a search match on the chip, the way a table marks any cell. */
export function TagChip({ label, onRemove, q }: { label: string; onRemove?: () => void; q?: string }) {
  return (
    <span className={cn(CHIP, 'border-slate-200 bg-slate-50 text-slate-800')} style={{ fontWeight: 500 }}>
      {q ? <Marked text={label} q={q} /> : label}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove tag ${label}`}
          className="inline-flex shrink-0 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}

/* The detail page's strip: the tag icon, the chips with their remove control,
   and Add Tag. Add Tag opens a 24px editor row - input, Save, Cancel. Save and
   Enter commit and close; Cancel and Escape discard. Nothing commits on blur,
   because blur fires before the click and Cancel would have saved the text. At
   eight tags Add Tag goes, since a ninth would be refused. */
export function TagStrip({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const close = () => { setEditing(false); setDraft(''); setError(null) }
  const save = () => {
    const r = checkTag(draft, tags)
    if (!r) return close()
    if ('error' in r) return setError(r.error)
    onChange([...tags, r.tag])
    close()
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
        {tags.map(t => <TagChip key={t} label={t} onRemove={() => onChange(tags.filter(x => x !== t))} />)}
        {!editing && tags.length < MAX_TAGS && (
          <button type="button" onClick={() => setEditing(true)}
            className={cn(CHIP, 'border-dashed border-slate-300 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-400 transition-colors cursor-pointer')}
            style={{ fontWeight: 500 }}>
            <Plus className="w-3 h-3" /> Add Tag
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-2 flex items-center gap-1.5">
          <input autoFocus aria-label="New tag" value={draft} placeholder="Enter tag..."
            onChange={e => { setDraft(e.target.value.slice(0, MAX_TAG_LENGTH)); setError(null) }}
            onKeyDown={onKey}
            className={cn('h-6 min-w-0 flex-1 px-2 rounded-md border bg-white text-[12px] text-slate-800 outline-none transition-colors',
              error ? 'border-danger-500' : 'border-primary focus:ring-2 focus:ring-primary/15')} />
          <button type="button" onClick={save}
            className="h-6 px-2.5 rounded-md bg-primary hover:bg-[#0862D0] text-white text-[11px] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
            Save
          </button>
          <button type="button" onClick={close}
            className="h-6 px-2.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-[11px] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-danger-600">{error}</p>}
    </div>
  )
}

/* The creation flow's field. It keeps the form's own border and focus ring;
   only the chips inside it are the spec's. Enter or a comma adds what is typed,
   Backspace in an empty box takes the last chip back off, and leaving the field
   adds what is left in it, so text typed just before Post is not dropped. */
export function TagInputField({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const commit = () => {
    const r = checkTag(draft, tags)
    if (!r) { setDraft(''); return }
    if ('error' in r) { setError(r.error); return }
    onChange([...tags, r.tag])
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
    else if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1))
  }

  return (
    <div>
      <div onClick={() => input.current?.focus()}
        className={cn('min-h-9 w-full px-2 py-1.5 flex flex-wrap items-center gap-1.5 bg-white border rounded-lg transition-all cursor-text focus-within:ring-2 focus-within:ring-fg/5',
          error ? 'border-danger-500' : 'border-border focus-within:border-primary')}>
        {tags.map(t => <TagChip key={t} label={t} onRemove={() => onChange(tags.filter(x => x !== t))} />)}
        <input ref={input} aria-label="Tags" value={draft}
          placeholder={tags.length ? '' : 'e.g. accrual, month-end'}
          disabled={tags.length >= MAX_TAGS && !draft}
          onChange={e => { setDraft(e.target.value.replace(/,/g, '').slice(0, MAX_TAG_LENGTH)); setError(null) }}
          onKeyDown={onKey}
          onBlur={commit}
          className="flex-1 min-w-[120px] h-6 px-1 text-sm text-fg bg-transparent outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed" />
      </div>
      {error
        ? <p className="mt-1.5 text-2xs leading-snug text-danger-600">{error}</p>
        : <p className="mt-1.5 text-2xs leading-snug text-fg-muted">Press enter or comma to add tags. Up to {MAX_TAGS} tags, {MAX_TAG_LENGTH} characters each.</p>}
    </div>
  )
}
