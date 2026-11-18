/**
 * Notes on a return, and the Communication placeholder beside them.
 *
 * Ported from the cycle count detail page's Notes tab (render-companion,
 * `cycle-count-detail.tsx`): a composer at the top, the notes under it newest
 * first, each a card with its text, a delete, and who wrote it when. The
 * layout is theirs; the type, colours and cards are this module's, so the tab
 * reads like Activity and Attachments beside it.
 *
 * The note written when the return was raised is shown first, marked Return
 * note, the way cycle counting marks its plan note. It lives on the return
 * itself because the documents print it, so it cannot be deleted from here.
 */

import { useState } from 'react';
import { MessageSquare, StickyNote, Trash2 } from 'lucide-react';

import RMAConfirmModal from '@/app/components/rma/RMAConfirmModal';
import { PersonAvatar } from '@/app/components/data-table/PersonAvatar';
import { useRMAContext } from '@/app/rma-context';
import type { RMA } from '@/app/data/mockRMAs';

const CREATION_NOTE_ID = 'creation-note';

function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function RMANotesTab({ rma, readOnly = false }: { rma: RMA; readOnly?: boolean }) {
  const { addRMANote, deleteRMANote } = useRMAContext();
  const [draft, setDraft] = useState('');
  const [composing, setComposing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; preview: string } | null>(null);

  const creationNote = rma.notes?.trim();
  const notes = [
    ...(rma.noteLog ?? []),
    ...(creationNote
      ? [
          {
            id: CREATION_NOTE_ID,
            text: creationNote,
            author: rma.createdBy ?? rma.owner,
            at: rma.createdDate,
          },
        ]
      : []),
  ];

  const submit = () => {
    if (!draft.trim()) return;
    addRMANote(rma.id, draft);
    setDraft('');
    setComposing(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
        <h2 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
          Notes
        </h2>
        <span className="text-[11px] text-slate-500 tabular-nums" style={{ fontWeight: 500 }}>
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4" style={{ maxWidth: 600 }}>
        {/* Composer. A past version of the return is read, not written to. */}
        {!readOnly && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor={`rma-note-${rma.id}`}
              className="text-[12px] text-foreground"
              style={{ fontWeight: 500 }}
            >
              Add a note
            </label>
            <textarea
              id={`rma-note-${rma.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setComposing(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
              }}
              placeholder="Write a note about this return..."
              rows={3}
              className="w-full min-h-[72px] resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] leading-relaxed text-foreground outline-none shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
            <div className="flex items-center justify-end gap-2">
              {composing && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft('');
                    setComposing(false);
                  }}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!draft.trim()}
                className="h-8 rounded-lg bg-primary px-3 text-[12px] text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                Add Note
              </button>
            </div>
          </div>
        )}

        {/* Newest first, the return's own note last. */}
        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
              <StickyNote className="h-5 w-5 text-slate-400" />
            </span>
            <span className="text-[12px] text-slate-500">No notes yet</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => {
              const fromCreation = note.id === CREATION_NOTE_ID;
              return (
                <div
                  key={note.id}
                  className="group flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-primary/30 hover:bg-slate-50/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="m-0 flex-1 text-[12px] leading-relaxed text-foreground"
                      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {note.text}
                    </p>
                    {!readOnly && !fromCreation && (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({
                            id: note.id,
                            preview: note.text.length > 40 ? `${note.text.slice(0, 40)}…` : note.text,
                          })
                        }
                        aria-label="Delete note"
                        className="flex shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {fromCreation && (
                      <span
                        className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] text-slate-600"
                        style={{ fontWeight: 500 }}
                      >
                        Return note
                      </span>
                    )}
                    <PersonAvatar name={note.author} size="xs" shape="circle" />
                    <span className="text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                      {note.author}
                    </span>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="text-[11px] text-slate-400">{stamp(note.at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RMAConfirmModal
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        tone="destructive"
        icon={Trash2}
        eyebrow="Delete note"
        title="Delete this note?"
        description={
          <>
            &ldquo;{pendingDelete?.preview}&rdquo; will be removed from {rma.rmaNumber}. This
            cannot be undone.
          </>
        }
        confirmLabel="Delete note"
        cancelLabel="Keep it"
        onConfirm={() => {
          if (pendingDelete) deleteRMANote(rma.id, pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

/** Communication, held as a tab until the feature exists. The same coming
 *  soon state cycle counting shows: a pulsing tile and one line. */
export function RMACommunicationTab() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="relative mb-5 h-24 w-24">
        <div
          className="absolute inset-0 animate-ping bg-slate-400"
          style={{ borderRadius: 22, opacity: 0.12, animationDuration: '2.4s' }}
        />
        <div
          className="relative flex h-24 w-24 items-center justify-center border border-slate-200 bg-white"
          style={{ borderRadius: 22, boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}
        >
          <MessageSquare className="h-11 w-11 text-slate-400" strokeWidth={2} />
        </div>
      </div>
      <span className="mb-1.5 text-[14px] text-foreground" style={{ fontWeight: 600 }}>
        Coming soon
      </span>
      <span className="max-w-[320px] text-[12px] leading-relaxed text-slate-500">
        Communication with the vendor will be available in a future update.
      </span>
    </div>
  );
}
