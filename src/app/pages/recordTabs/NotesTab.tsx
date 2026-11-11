// Vendor Invoicing's Notes tab (invoice-details/NotesTab.tsx) on this module's
// record store: one card filling the column, a header with the tinted icon tile,
// title, one-line scope and a count pill; the composer pinned under it with the
// writer's avatar; then the notes newest first, each with avatar, name, time
// and, on hover, Edit and Delete. Deleting asks first, in the alert dialog.
// Kept in the record store (lib/recordStore) so notes survive navigation and
// the tab's count reads the same list.
import { useState } from 'react'
import { Check, Pencil, Plus, StickyNote, Trash2, X } from 'lucide-react'
import { recordStore, type RecordNote } from '../../coa/lib/recordStore'
import { useRecordNotes } from '../../coa/components/NotesTab'
import { PersonPhoto } from '../../coa/components/AuditCells'
import { cleanName } from '../../coa/components/Avatar'
import { ConfirmModal, EmptyState } from '../../coa/components/ui'
import { pushToast } from '../../coa/lib/toast'
import { fmtDateTime } from '../../coa/lib/utils'
import { cn } from '../../coa/lib/utils'

const EMPTY: RecordNote[] = []
/** Who is writing: the signed-in user, as the header and the comms roster name them. */
const WRITER = 'Ahtisham Ahmad'

export function RecordNotesTab({ noteKey, noun, derived = EMPTY }: {
  /** The record's key, `recordKey(kind, id)`. */
  noteKey: string
  /** What the notes belong to, in the header's scope line: "currency", "exchange rate". */
  noun: string
  /** The notes the record opens with. */
  derived?: RecordNote[]
}) {
  const notes = useRecordNotes(noteKey, derived)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [deleting, setDeleting] = useState<{ note: RecordNote; written: boolean } | null>(null)

  const submit = () => {
    const text = draft.trim()
    // Never disabled: an empty note highlights the field and says why.
    if (!text) {
      setDraftError(true)
      pushToast('Note is empty', 'danger', 'Write the note first, then add it.')
      return
    }
    recordStore.addRecordNote(noteKey, text, WRITER)
    setDraft('')
    pushToast('Note added')
  }

  const saveEdit = (note: RecordNote) => {
    const text = editDraft.trim()
    if (!text) {
      pushToast('Note is empty', 'danger', 'Write something, or delete the note instead.')
      return
    }
    recordStore.updateRecordNote(noteKey, note, text)
    setEditingId(null)
    pushToast('Note updated')
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col" style={{ minHeight: 'max(400px, calc(100vh - 220px))' }}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5 shrink-0">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FFFBEB' }}>
          <StickyNote className="w-3.5 h-3.5" style={{ color: '#B45309' }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] text-foreground tracking-tight" style={{ fontWeight: 600 }}>Notes</h3>
          <p className="text-[11px] text-slate-400">Internal comments scoped to this {noun}. Only your team sees them.</p>
        </div>
        <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0" style={{ fontWeight: 600 }}>
          {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
        </span>
      </div>

      {/* Composer */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/40 shrink-0">
        <div className="flex items-start gap-2.5">
          <PersonPhoto name={WRITER} size={28} />
          <div className="flex-1 min-w-0">
            <textarea
              value={draft}
              onChange={e => { setDraft(e.target.value); setDraftError(false) }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }}
              placeholder="Add a note for your team…"
              rows={2}
              aria-label={`Add a note to this ${noun}`}
              className={cn(
                'w-full text-[12px] rounded-lg border bg-white px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-slate-400 resize-none transition-colors',
                draftError ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200',
              )}
            />
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={submit}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] cursor-pointer transition-colors"
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Note
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notes, newest first */}
      {notes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <EmptyState
            icon={<StickyNote size={20} />}
            title="No notes yet"
            description="Decisions, reminders, and context your team adds will live here with the record."
          />
        </div>
      ) : (
        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {notes.map(({ note, written }) => (
            <div key={note.id} className="px-4 py-3 group/note">
              <div className="flex items-start gap-2.5">
                <PersonPhoto name={note.author} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{cleanName(note.author)}</span>
                    {note.tag && (
                      <span className="text-[10px] rounded px-1.5 py-px bg-slate-100 text-slate-600 shrink-0" style={{ fontWeight: 600 }}>{note.tag}</span>
                    )}
                    <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>
                      {fmtDateTime(note.at)}
                      {note.updatedAt ? ' · edited' : ''}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-0.5 opacity-0 group-hover/note:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => { setEditingId(note.id); setEditDraft(note.text) }}
                        className="p-1 rounded-md text-slate-400 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        aria-label="Edit note"
                        title="Edit note"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting({ note, written })}
                        className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        aria-label="Delete note"
                        title="Delete note"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                  {editingId === note.id ? (
                    <div className="mt-1.5">
                      <textarea
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        rows={2}
                        autoFocus
                        aria-label="Edit note"
                        className="w-full text-[12px] rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"
                      />
                      <div className="flex justify-end gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] cursor-pointer transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(note)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[11px] cursor-pointer transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          <Check className="w-3 h-3" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-600 leading-relaxed mt-1 whitespace-pre-wrap break-words">{note.text}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete asks first, in the module's alert dialog. */}
      <ConfirmModal
        open={!!deleting}
        tone="danger"
        icon={<Trash2 size={26} className="text-danger-600" />}
        badge="Delete Note"
        title="Delete this note?"
        description="The note is removed from the record. This cannot be undone."
        confirmLabel="Delete Note"
        dismissLabel="Keep Note"
        onConfirm={() => {
          if (deleting) recordStore.removeRecordNote(noteKey, deleting.note)
          setDeleting(null)
          pushToast('Note deleted')
        }}
        onDismiss={() => setDeleting(null)}
      />
    </div>
  )
}
