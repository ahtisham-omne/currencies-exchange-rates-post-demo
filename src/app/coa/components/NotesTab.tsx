// Ported from chart-of-accounts-v2.1/src/components/NotesTab.tsx; adapted: notes live in the kit record store (lib/recordStore), scoped per record key; derived notes optional.
import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { recordStore, useRecordStore, type RecordNote } from '../lib/recordStore'
import { pushToast } from '../lib/toast'
import { Button, Textarea, Tooltip } from './ui'
import { cleanName, initialsOf } from './Avatar'
import { fmtDateTime } from '../lib/utils'

/* ─────────────────────── A record's Notes tab ───────────────────────
   The same tab on every detail page that has one - an account (posting or
   summary) and a journal entry - built to the design Mahad supplied on
   2026-10-06: *"Here is the notes tab design. Please implement this in all the
   notes tab in detail pages."* It replaces the Coming Soon placeholder the tab
   carried since 2026-09-29.

   "Add a note" over a text box and its button, then the notes as cards, newest
   first: the text, then who wrote it and when, with a bin to take one off. A
   note taken off can be put back from the toast. A record opens with the notes
   lib/notes derives for it, under any the reader has written.

   Drawn to the design's measurements (its screenshot is at 1.5x): a 600px
   column, 14px notes on 12px-padded cards 8px apart, a 24px avatar in the
   design's pale blue with bold initials, an 11px line for who and when, and
   the design's own greys. Mahad, 2026-10-06, on the first cut: *"This is not
   the same design ... Please make it as it is in the screenshot."*

   The design's "Plan Note" chip marks a note carried over from the record it
   was first written on. A note here can be carried over too - from the
   document that raised an entry, or from the system an account was imported
   from - and those carry the chip, named for where they came from. */

const EMPTY: RecordNote[] = []

/** A record's notes as its tab lists them: what the reader wrote and what the
 *  record opens with (`derived`), less any taken off, newest first. The tab's
 *  count reads the same list, so the two cannot disagree. */
export function useRecordNotes(key: string, derived: RecordNote[] = EMPTY) {
  const written = useRecordStore(s => s.recordNotes[key] ?? EMPTY)
  const removed = useRecordStore(s => s.removedNotes)
  return useMemo(() => {
    const gone = new Set(removed)
    const byId = new Map<string, { note: RecordNote; written: boolean }>()
    for (const n of written) byId.set(n.id, { note: n, written: true })
    for (const n of derived) if (!byId.has(n.id)) byId.set(n.id, { note: n, written: false })
    return [...byId.values()].filter(x => !gone.has(x.note.id)).sort((a, b) => b.note.at.localeCompare(a.note.at))
  }, [written, removed, derived])
}

export function NotesTab({ noteKey, noun, derived = EMPTY }: {
  /** The record's key - `recordKey(kind, id)` from lib/recordStore. */
  noteKey: string
  /** What the record is called in the box's prompt: "account", "journal entry". */
  noun: string
  /** The notes the record opens with (lib/notes). */
  derived?: RecordNote[]
}) {
  const notes = useRecordNotes(noteKey, derived)
  const add = recordStore.addRecordNote
  const remove = recordStore.removeRecordNote
  const restore = recordStore.restoreRecordNote
  const [draft, setDraft] = useState('')
  const text = draft.trim()

  const submit = () => {
    if (!text) return
    add(noteKey, text)
    setDraft('')
  }
  const del = (n: RecordNote, written: boolean) => {
    remove(noteKey, n)
    pushToast('Note deleted', 'success', undefined, {
      label: 'Undo',
      onClick: () => restore(noteKey, n, written),
    })
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4" data-notes-tab>
      <div className="max-w-[37.5rem]">
        <h3 className="text-[0.9375rem] text-black" style={{ fontWeight: 600 }}>Add a Note</h3>
        <div className="mt-3">
          <Textarea
            aria-label="Add a note"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            // Cmd or Ctrl + Enter adds it, as a message box would.
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }}
            placeholder={`Write a note about this ${noun}...`}
            className="!min-h-[5.3125rem] resize-y !rounded-lg !border-[#EAEBF0] !px-3 !py-2.5 text-sm placeholder:text-[#9EA3AE]"
          />
        </div>
        <div className="flex justify-end mt-2">
          <Button onClick={submit} disabled={!text} className="px-4 font-semibold">Add Note</Button>
        </div>

        {notes.length > 0 && (
          <ul className="mt-[1.125rem] space-y-2">
            {notes.map(({ note: n, written }) => (
              <li key={n.id} className="rounded-lg border border-[#EAEBF0] bg-white p-3" data-note>
                <div className="flex items-start gap-3">
                  <p className="flex-1 min-w-0 text-sm text-black leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{n.text}</p>
                  <Tooltip side="top" content="Delete note">
                    <button
                      type="button"
                      onClick={() => del(n, written)}
                      aria-label="Delete note"
                      className="shrink-0 p-1 -mr-0.5 rounded-md text-[#9EA3AE] hover:text-danger-600 hover:bg-danger-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[0.6875rem] leading-none">
                  {n.tag && (
                    <span className="inline-flex items-center h-[1.375rem] px-2 rounded border border-[#EAEBF0] bg-[#F9FAFC] text-xs text-[#6A727C]" style={{ fontWeight: 500 }} data-note-tag>
                      {n.tag}
                    </span>
                  )}
                  <span className="w-6 h-6 rounded-full bg-[#EEF4FB] text-[#364154] inline-flex items-center justify-center shrink-0 text-[0.625rem]" style={{ fontWeight: 700 }} aria-hidden>
                    {initialsOf(n.author)}
                  </span>
                  <span className="text-[#6A727C]" style={{ fontWeight: 500 }}>{cleanName(n.author)}</span>
                  <span className="text-[#9EA3AE]" aria-hidden>·</span>
                  <span className="text-[#9EA3AE] tabular-nums">{fmtDateTime(n.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
