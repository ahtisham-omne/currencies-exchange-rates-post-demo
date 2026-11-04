import { useState } from 'react';
import { StickyNote, Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { PhotoPersonAvatar } from '@/app/components/data-table';
import { EmptyState } from '@/app/components/EmptyState';
import { DestructiveConfirmDialog } from '@/app/components/DestructiveConfirmDialog';

/* Notes tab (GPT QC02, 9/30 — the Sept 28 OMNE standard requires a real
 * Notes surface on every record): free-text notes scoped to the invoice,
 * kept in App state like credit memos so they survive navigation. Card
 * chrome mirrors the ActivityTab; author avatars reuse the people
 * standard (8/7/26). */

export interface InvoiceNote {
  id: string;
  text: string;
  author: string;
  createdAt: string; // ISO datetime
  updatedAt?: string;
}

function fmtStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export function NotesTab({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  recordNoun = 'invoice',
}: {
  notes: InvoiceNote[];
  onAddNote: (text: string) => void;
  onUpdateNote: (noteId: string, text: string) => void;
  onDeleteNote: (noteId: string) => void;
  /** What the notes belong to (user 10/22/26): the same tab serves
   *  payments ("payment") and payment runs ("payment run"). */
  recordNoun?: string;
}) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState(false);

  const submit = () => {
    const text = draft.trim();
    // Never-disabled CTA (9/23/26): an empty note highlights the field.
    if (!text) {
      setDraftError(true);
      toast.error('Note is empty', { description: 'Write the note first, then add it.' });
      return;
    }
    onAddNote(text);
    setDraft('');
    toast.success('Note added');
  };

  return (
    // Fills the column to the viewport bottom (user 10/2, matching the
    // Coming Soon / Payments empty-state treatment); the notes list grows
    // into the space and the composer stays pinned under the header.
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col" style={{ minHeight: 'max(400px, calc(100vh - 269px))' }}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5 shrink-0">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FFFBEB' }}>
          <StickyNote className="w-3.5 h-3.5" style={{ color: '#B45309' }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] text-foreground tracking-tight" style={{ fontWeight: 600 }}>Notes</h3>
          <p className="text-[11px] text-slate-400">Internal comments scoped to this {recordNoun}. The vendor never sees them.</p>
        </div>
        <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0" style={{ fontWeight: 600 }}>
          {notes.length} Note{notes.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Composer */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/40 shrink-0">
        <div className="flex items-start gap-2.5">
          <PhotoPersonAvatar name="Ahtisham Ahmad" size="sm" />
          <div className="flex-1 min-w-0">
            <textarea
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setDraftError(false); }}
              placeholder="Add a note for your team…"
              rows={2}
              className={`w-full text-[12px] rounded-lg border bg-white px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-slate-400 resize-none transition-colors ${
                draftError ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'
              }`}
            />
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={submit}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] cursor-pointer transition-colors"
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add note
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notes list — newest first */}
      {notes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <EmptyState
            icon={StickyNote}
            title="No notes yet"
            description="Decisions, reminders, and context your team adds will live here with the record."
          />
        </div>
      ) : (
        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {[...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((note) => (
            <div key={note.id} className="px-4 py-3 group/note">
              <div className="flex items-start gap-2.5">
                <PhotoPersonAvatar name={note.author} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{note.author}</span>
                    <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                      {fmtStamp(note.createdAt)}
                      {note.updatedAt ? ' · edited' : ''}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => { setEditingId(note.id); setEditDraft(note.text); }}
                        className="p-1 rounded-md text-slate-400 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        aria-label="Edit Note"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(note.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        aria-label="Delete Note"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                  {editingId === note.id ? (
                    <div className="mt-1.5">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={2}
                        autoFocus
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
                          onClick={() => {
                            const text = editDraft.trim();
                            if (!text) {
                              toast.error('Note is empty', { description: 'Write something, or delete the note instead.' });
                              return;
                            }
                            onUpdateNote(note.id, text);
                            setEditingId(null);
                            toast.success('Note updated');
                          }}
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

      {/* Delete confirm in the modal design language (user 10/10). */}
      <DestructiveConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        icon={Trash2}
        pill="Delete Note"
        title="Delete this note?"
        description="The note is removed from the record. This cannot be undone."
        confirmLabel="Delete Note"
        cancelLabel="Keep Note"
        onConfirm={() => {
          if (deleteId) onDeleteNote(deleteId);
          setDeleteId(null);
          toast.success('Note deleted');
        }}
      />
    </div>
  );
}
