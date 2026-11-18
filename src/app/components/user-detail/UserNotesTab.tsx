import { useRef, useState } from "react";
import { StickyNote, Trash2, TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DestructiveConfirmModal } from "../shared/DestructiveConfirmModal";
import { DiscardDialog } from "./DiscardDialog";
import {
  formatNoteTime,
  sortNotesNewestFirst,
  type UserNote,
} from "../../data/user-notes";

/* ──────────────────────────────────────────────────────────────────
 * Notes tab on the user page (ERP-5167 AC3, backend ERP-5414).
 *
 * The shared Omne notes design, mirrored from the Calendars kit
 * (calendar-omne `shared/recordNotes/RecordNotesTab.tsx`, itself the
 * Vendor Returns / cycle counting Notes design, aligned to ERP-8136):
 * a white card with a "Notes" header and the note count; under it a 600px
 * column with the composer ("Add a Note" over a three-row textarea, Cancel
 * while writing beside Add Note); the notes newest first, each a hairline
 * card with its text, an always-visible trash, and an author line (20px
 * round avatar, name, a dot, the time); "No notes yet." when there are
 * none; and the red confirm ("Delete this note?") before a delete. The copy
 * is spec-approved (ERP-8136) and kept as the Calendars kit has it.
 *
 * Not permission controlled (Eli, 7 Oct 2026): anyone who can open the user
 * can view, add and delete notes, and there is no character limit.
 *
 * UAC differences, stated:
 * - The delete and discard confirms are UAC's own `DestructiveConfirmModal`
 *   (the same red gradient confirm), so its pill is in capitals like every
 *   other confirm in this module.
 * - Add Note's held state uses UAC's tooltip instead of the Calendars
 *   `HeldButton`; it still never fades out of reach, says why on hover, and
 *   a press on an empty note shakes the field.
 * - The time is a fixed "Mar 15, 2026, 9:30 AM": UAC has no company Date and
 *   Time Format setting.
 * - Adds and deletes happen at once: UAC has no simulated connection.
 * ────────────────────────────────────────────────────────────────── */

const FONT = "'Inter', sans-serif";

/* The Calendars kit's avatar tints, so a person gets the same colour there
   and here. */
const AVATAR_TINTS = [
  { bg: "#EBF3FF" },
  { bg: "#F0FDF4" },
  { bg: "#FFF7ED" },
  { bg: "#F5F3FF" },
  { bg: "#ECFEFF" },
  { bg: "#FFF1F2" },
  { bg: "#FEF9C3" },
  { bg: "#F0FDFA" },
  { bg: "#FDF2F8" },
  { bg: "#EBF3FF" },
  { bg: "#F5F5F4" },
];

function tintFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function NoteAvatar({ name }: { name: string }) {
  return (
    <div
      title={name}
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: 20, height: 20, backgroundColor: tintFor(name).bg, color: "#1E293B", fontSize: 9, fontWeight: 600 }}
    >
      {initialsOf(name)}
    </div>
  );
}

/* The house "no": a damped 6px side to side over 380ms. Reduced motion
   keeps the focus and drops the movement. */
function shake(el: HTMLElement | null) {
  if (!el || typeof el.animate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  el.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(5px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(3px)" },
      { transform: "translateX(-1px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 380, easing: "ease-out" },
  );
}

export function UserNotesTab({
  notes,
  onNotesChange,
  author,
  recordName,
  placeholder,
  readOnly = false,
  now,
}: {
  notes: UserNote[];
  onNotesChange: (next: UserNote[]) => void;
  /** Who a new note is signed with: the signed-in user. */
  author: string;
  /** Keys the note field's id. */
  recordName: string;
  placeholder: string;
  /** An archived user is read, not written to: no composer, no trash. */
  readOnly?: boolean;
  /** The moment a note is stamped with; a test can pass its own clock. */
  now?: () => Date;
}) {
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; preview: string } | null>(null);
  /* Cancel on a written note asks first; an empty composer closes at once
     (the Calendars kit's behaviour, 10 Nov 2026). */
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const sorted = sortNotesNewestFirst(notes);
  const empty = !draft.trim();

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    const stamp = (now ? now() : new Date()).toISOString();
    onNotesChange([{ id: `n-${Date.now()}`, text, author, timestamp: stamp }, ...notes]);
    setDraft("");
    setComposing(false);
  };

  const removeNote = (id: string) => onNotesChange(notes.filter((n) => n.id !== id));

  const fieldId = `record-note-${recordName.replace(/\W+/g, "-")}`;

  const addButtonClass = "h-8 rounded-[8px] bg-[#0A77FF] px-3 text-[12px] text-white transition-opacity";

  return (
    <div
      className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden"
      style={{ borderRadius: 12, fontFamily: FONT, color: "#0F172A" }}
    >
      <div className="shrink-0 px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
        <h2 className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600, lineHeight: 1.5 }}>
          Notes
        </h2>
        <span className="text-[11px] text-slate-500 tabular-nums" style={{ fontWeight: 500, lineHeight: 1.5 }}>
          {sorted.length} {sorted.length === 1 ? "note" : "notes"}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4" style={{ maxWidth: 600 }}>
          {!readOnly && (
            <div className="flex flex-col gap-2">
              <label htmlFor={fieldId} className="text-[12px] text-[#0F172A]" style={{ fontWeight: 500, lineHeight: 1.5 }}>
                Add a Note
              </label>
              <textarea
                id={fieldId}
                ref={fieldRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => setComposing(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                }}
                placeholder={placeholder}
                rows={3}
                className="w-full min-h-[72px] resize-y rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-[12px] leading-relaxed text-[#0F172A] outline-none shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors placeholder:text-slate-400 focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/10"
              />
              <div className="flex items-center justify-end gap-2">
                {composing && (
                  <button
                    type="button"
                    onClick={() => {
                      if (draft.trim()) {
                        setConfirmDiscard(true);
                        return;
                      }
                      setDraft("");
                      setComposing(false);
                    }}
                    className="h-8 rounded-[8px] border border-slate-200 bg-white px-3 text-[12px] text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                )}
                {/* Never faded out of reach: with no text it holds at half
                    opacity, says why on hover, and a press shakes the field. */}
                {empty ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-disabled="true"
                        onClick={() => {
                          shake(fieldRef.current);
                          fieldRef.current?.focus();
                        }}
                        className={`${addButtonClass} opacity-50 cursor-not-allowed`}
                        style={{ fontWeight: 600, lineHeight: 1.5 }}
                      >
                        Add Note
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px]">
                      <span className="flex items-center gap-1.5" style={{ fontWeight: 600 }}>
                        <TriangleAlert className="h-3.5 w-3.5 text-red-500" />
                        Empty Note
                      </span>
                      <span className="block mt-0.5">Write the note first, then add it.</span>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    className={`${addButtonClass} hover:opacity-90 cursor-pointer`}
                    style={{ fontWeight: 600, lineHeight: 1.5 }}
                  >
                    Add Note
                  </button>
                )}
              </div>
            </div>
          )}

          {sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                <StickyNote className="h-5 w-5 text-slate-400" />
              </span>
              <span className="text-[12px] text-slate-500">No notes yet.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((note) => (
                <div
                  key={note.id}
                  data-note-id={note.id}
                  className="group flex flex-col gap-2 rounded-[8px] border border-slate-200 bg-white p-3 transition-colors hover:border-[#0A77FF]/30 hover:bg-slate-50/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="m-0 flex-1 text-[12px] leading-relaxed text-[#0F172A]"
                      style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                    >
                      {note.text}
                    </p>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({
                            id: note.id,
                            preview: note.text.length > 40 ? `${note.text.slice(0, 40)}…` : note.text,
                          })
                        }
                        aria-label="Delete note"
                        className="flex shrink-0 rounded-[6px] p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2" style={{ lineHeight: 1.5 }}>
                    <NoteAvatar name={note.author} />
                    <span className="text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                      {note.author}
                    </span>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="text-[11px] text-slate-400">{formatNoteTime(note.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDiscard && (
        <DiscardDialog
          title="Discard This Note?"
          description="Your note will not be added."
          confirmLabel="Discard Note"
          cancelLabel="Keep Editing"
          onDiscard={() => {
            setConfirmDiscard(false);
            setDraft("");
            setComposing(false);
          }}
          onKeepEditing={() => {
            setConfirmDiscard(false);
            fieldRef.current?.focus();
          }}
        />
      )}

      <DestructiveConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        icon={Trash2}
        badge="Delete Note"
        title="Delete this note?"
        description={<>&ldquo;{pendingDelete?.preview}&rdquo; will be permanently removed. This action cannot be undone.</>}
        confirmLabel="Delete Note"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (pendingDelete) removeNote(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
