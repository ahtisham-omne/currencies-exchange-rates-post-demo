import { useState } from "react";
import { Plus, MessageSquare, Paperclip } from "lucide-react";
import type { UserDetail } from "../../data/user-detail-data";
import { useAccessMode } from "../access-mode";
import { isNewTenant, sampleOnly } from "../../data/tenant";
import { CURRENT_USER } from "../../data/current-user";

interface Note {
  id: string;
  author: string;
  timestamp: string;
  text: string;
}

const INITIAL_NOTES: Note[] = [
  {
    id: "n1",
    author: "Andrea Davis",
    timestamp: "03/15/2026 - 09:30",
    text: "Discussed role transition with this user during Q1 planning. They expressed interest in moving to a warehouse supervisor position once a spot opens up.",
  },
  {
    id: "n2",
    author: "Taylor Dimas",
    timestamp: "02/20/2026 - 14:15",
    text: "Completed onboarding checklist. All required training modules finished ahead of schedule.",
  },
];

/* ─── Reusable content card matching partner management design ─── */
function ContentCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="px-4 py-2.5 border-b border-[#F1F5F9] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#EDF4FF] flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-[#0A77FF]" />
          </div>
          <span className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>
            {title}
          </span>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ─── Empty state matching partner management ─── */
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="relative mb-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center shadow-sm">
          <Icon className="w-5 h-5 text-[#94A3B8]" />
        </div>
      </div>
      <p className="text-[13px] text-[#334155] mb-0.5" style={{ fontWeight: 600 }}>
        {title}
      </p>
      <p className="text-[12px] text-[#94A3B8] max-w-xs leading-relaxed">{description}</p>
    </div>
  );
}

export function NotesTab({ user }: { user: UserDetail }) {
  const access = useAccessMode();
  /* The sample's notes, and the sample's author for new ones; a company
   * from onboarding starts with none, and its notes are the signed-in
   * person's. (This tab isn't mounted today; the Overview widget is.) */
  const [notes, setNotes] = useState<Note[]>(() => sampleOnly(INITIAL_NOTES));
  const [newNote, setNewNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const now = new Date();
    const timestamp = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()} - ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setNotes((prev) => [
      {
        id: `n-${Date.now()}`,
        author: isNewTenant() ? CURRENT_USER.name : "Andrea Davis",
        timestamp,
        text: newNote.trim(),
      },
      ...prev,
    ]);
    setNewNote("");
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* ─── Notes Card ─── */}
      <ContentCard
        title="Notes"
        icon={MessageSquare}
        action={
          !isAdding && access.canManageNotes ? (
            <button
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-1.5 px-3 h-7 rounded-[6px] border border-[#E2E8F0] bg-white text-[11px] text-[#0A77FF] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <Plus className="w-3 h-3" />
              Add Note
            </button>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {/* New note input */}
          {isAdding && (
            <div
              className="rounded-lg border p-3 space-y-2.5"
              style={{
                borderColor: "#007FFF",
                boxShadow: "0 0 0 3px rgba(0, 127, 255, 0.08)",
              }}
            >
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a note about this user..."
                rows={3}
                autoFocus
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-[6px] text-[12px] text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8] resize-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewNote("");
                  }}
                  className="px-3 h-7 rounded-[6px] border border-[#E2E8F0] bg-white text-[11px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-3 h-7 rounded-[6px] bg-[#007FFF] hover:bg-[#0066D6] text-white text-[11px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontWeight: 600 }}
                >
                  Save Note
                </button>
              </div>
            </div>
          )}

          {/* Notes list */}
          {notes.length === 0 && !isAdding ? (
            <EmptyState
              icon={MessageSquare}
              title="No Notes"
              description="Notes about this user will appear here."
            />
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="rounded-md bg-[#FAFBFC] border border-[#F1F5F9] p-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-[11px] text-[#0F172A]"
                    style={{ fontWeight: 550 }}
                  >
                    {note.author}
                  </span>
                  <span className="text-[#CBD5E1]">&middot;</span>
                  <span
                    className="text-[10px] text-[#94A3B8]"
                    style={{ fontWeight: 400 }}
                  >
                    {note.timestamp}
                  </span>
                </div>
                <p
                  className="text-[12px] leading-relaxed whitespace-pre-wrap"
                  style={{ color: "#475569", fontWeight: 400 }}
                >
                  {note.text}
                </p>
              </div>
            ))
          )}
        </div>
      </ContentCard>

      {/* ─── Attachments Card ─── */}
      <ContentCard title="Attachments" icon={Paperclip}>
        <EmptyState
          icon={Paperclip}
          title="No Attachments"
          description="File attachments will be displayed here once uploaded. This feature will be available with backend integration."
        />
      </ContentCard>
    </div>
  );
}
