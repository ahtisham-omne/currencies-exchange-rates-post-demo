import React, { useState, useMemo } from "react";
import UserHoverCard, { isInternalUser } from "./UserHoverCard";
import {
  FileText,
  Lock,
  Eye,
  Send,
  Pencil,
  Trash2,
  MessageSquare,
  Plus,
} from "lucide-react";
import { FONT } from "./designTokens";
import type { PONote, PONoteType } from "./poStore";
import { addPONote, editPONote, deletePONote, getPONotes } from "./poStore";
import { CollapsibleSection } from "./POSidebarSections";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY
   ═══════════════════════════════════════════════════════════════ */

const s = {
  tabLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  noteAuthor: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  noteTime: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
  } as React.CSSProperties,
  noteText: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.55",
    fontFamily: FONT,
  } as React.CSSProperties,
  typeBadge: {
    fontSize: "9px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1",
    fontFamily: FONT,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  emptyText: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.5",
    fontFamily: FONT,
  } as React.CSSProperties,
  inputStyle: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.5",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ── Avatar colors ── */
const AVATAR_BG = [
  "var(--avatar-1-bg)", "var(--avatar-3-bg)", "var(--avatar-4-bg)",
  "var(--avatar-2-bg)", "var(--avatar-5-bg)", "var(--avatar-6-bg)", "var(--avatar-7-bg)",
];
const AVATAR_TEXT = [
  "var(--avatar-1-text)", "var(--avatar-3-text)", "var(--avatar-4-text)",
  "var(--avatar-2-text)", "var(--avatar-5-text)", "var(--avatar-6-text)", "var(--avatar-7-text)",
];

function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % AVATAR_BG.length;
}

const CURRENT_USER = "Areeb Tanvir";

/* ═══════════════════════════════════════════════════════════════
   NOTE CARD
   ═══════════════════════════════════════════════════════════════ */

function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: PONote;
  onEdit: (noteId: string, text: string) => void;
  onDelete: (noteId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const ci = getColorIndex(note.author);
  const isOwner = note.author === CURRENT_USER;

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(note.id, editText.trim());
      setIsEditing(false);
    }
  };

  return (
    <div className="group rounded-[var(--radius-md)] border border-border/50 bg-card px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <UserHoverCard name={note.author}>
          <div
            className="flex items-center justify-center size-7 rounded-full shrink-0 mt-0.5 cursor-pointer"
            style={{ backgroundColor: AVATAR_BG[ci] }}
          >
            <span style={{ fontSize: "9px", fontWeight: 600, fontFamily: FONT, color: AVATAR_TEXT[ci] }}>
              {note.authorInitials}
            </span>
          </div>
        </UserHoverCard>
        <div className="min-w-0 flex-1">
          {/* Header: name + time + actions */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-foreground truncate" style={s.noteAuthor}>{note.author}</span>
              <span className="text-muted-foreground/40" style={s.noteTime}>{note.timestamp}</span>
            </div>
            {isOwner && !isEditing && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  className="flex items-center justify-center size-5 rounded-[var(--radius-sm)] text-muted-foreground/40 hover:text-primary hover:bg-primary/8 transition-all cursor-pointer"
                  onClick={() => { setEditText(note.text); setIsEditing(true); }}
                >
                  <Pencil className="size-2.5" />
                </button>
                <button
                  className="flex items-center justify-center size-5 rounded-[var(--radius-sm)] text-muted-foreground/40 hover:text-destructive hover:bg-destructive/8 transition-all cursor-pointer"
                  onClick={() => onDelete(note.id)}
                >
                  <Trash2 className="size-2.5" />
                </button>
              </div>
            )}
          </div>
          {/* Body */}
          {isEditing ? (
            <div className="mt-1.5">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full px-2.5 py-2 rounded-[var(--radius-sm)] border border-border bg-background text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                style={s.inputStyle}
                rows={2}
                autoFocus
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <button
                  className="h-6 px-2.5 rounded-[var(--radius-sm)] bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
                  style={{ fontSize: "11px", fontWeight: 500, fontFamily: FONT }}
                  onClick={handleSaveEdit}
                >
                  Save
                </button>
                <button
                  className="h-6 px-2.5 rounded-[var(--radius-sm)] text-muted-foreground hover:bg-secondary cursor-pointer transition-colors"
                  style={{ fontSize: "11px", fontWeight: 500, fontFamily: FONT }}
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-foreground/80 mt-0.5" style={s.noteText}>{note.text}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN NOTES SECTION
   Used in both PO sidebar (PO-level) and item detail modal (line-item level)
   ═══════════════════════════════════════════════════════════════ */

interface PONotesSectionProps {
  poId: string;
  /** If set, show notes for this line item only */
  lineItemId?: string;
  /** All notes for the PO (parent provides for reactivity) */
  allNotes: PONote[];
  /** Whether the user can add/edit/delete notes */
  canEdit: boolean;
  /** Called when a note is added/edited/deleted so parent can trigger guardEdit */
  onNoteChange?: (action: "added" | "edited" | "deleted", noteType: PONoteType, subject?: string) => void;
  /** Show as collapsible sidebar card (true) or inline section (false) */
  asCollapsible?: boolean;
  defaultOpen?: boolean;
  /** When true, renders as a full-width tab panel (no collapsible wrapper, wider layout) */
  embedded?: boolean;
}

export default function PONotesSection({
  poId,
  lineItemId,
  allNotes,
  canEdit,
  onNoteChange,
  asCollapsible = true,
  defaultOpen = false,
  embedded = false,
}: PONotesSectionProps) {
  const [activeTab, setActiveTab] = useState<PONoteType>("vendor");
  const [newNoteText, setNewNoteText] = useState("");

  /* Filter notes for this context */
  const contextNotes = useMemo(() => {
    if (lineItemId) {
      return allNotes.filter(n => n.lineItemId === lineItemId);
    }
    return allNotes.filter(n => !n.lineItemId);
  }, [allNotes, lineItemId]);

  const vendorNotes = contextNotes.filter(n => n.type === "vendor");
  const internalNotes = contextNotes.filter(n => n.type === "internal");
  const displayedNotes = activeTab === "vendor" ? vendorNotes : internalNotes;

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    addPONote(poId, activeTab, newNoteText.trim(), CURRENT_USER, lineItemId);
    onNoteChange?.("added", activeTab, lineItemId ? `line item note` : "PO note");
    setNewNoteText("");
  };

  const handleEditNote = (noteId: string, text: string) => {
    editPONote(poId, noteId, text);
    onNoteChange?.("edited", activeTab);
  };

  const handleDeleteNote = (noteId: string) => {
    deletePONote(poId, noteId);
    onNoteChange?.("deleted", activeTab);
  };

  const content = (
    <div className={embedded ? "px-5 py-4" : "px-4 py-3"}>
      {/* Tab toggle */}
      <div className="flex items-center border-b border-border mb-3" role="tablist">
        {([
          { id: "vendor" as const, label: "Vendor Visible", icon: Eye, count: vendorNotes.length },
          { id: "internal" as const, label: "Internal", icon: Lock, count: internalNotes.length },
        ]).map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              className="flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors duration-150 relative cursor-pointer bg-transparent border-none"
              style={{
                padding: '8px 16px 10px',
                color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                lineHeight: 1,
                fontFamily: FONT,
              }}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'hsl(var(--foreground))'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'hsl(var(--muted-foreground))'; }}
            >
              <Icon className="size-3" />
              {tab.label}
              {tab.count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    lineHeight: 1,
                    color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    backgroundColor: isActive
                      ? 'color-mix(in srgb, hsl(var(--primary)) 10%, transparent)'
                      : 'color-mix(in srgb, hsl(var(--muted-foreground)) 10%, transparent)',
                    padding: '3px 6px',
                    borderRadius: 5,
                    minWidth: 18,
                    textAlign: 'center' as const,
                  }}
                >
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span
                  className="absolute bottom-0 left-4 right-4"
                  style={{
                    height: 2,
                    backgroundColor: 'hsl(var(--primary))',
                    borderRadius: '1px 1px 0 0',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>


      {/* Notes list */}
      <div className="flex flex-col gap-2 mb-3">
        {displayedNotes.length === 0 && (
          <div className="py-4 text-center">
            <span className="text-muted-foreground/50" style={s.emptyText}>
              {activeTab === "vendor"
                ? "No vendor-facing notes yet"
                : "No internal notes yet"}
            </span>
          </div>
        )}
        {displayedNotes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            onEdit={handleEditNote}
            onDelete={handleDeleteNote}
          />
        ))}
      </div>

      {/* Add note input */}
      {canEdit && (
        <div className="flex flex-col gap-2">
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder={
              activeTab === "vendor"
                ? "Add a vendor-facing note..."
                : "Add an internal note..."
            }
            className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-border bg-background text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors resize-none placeholder:text-muted-foreground/40"
            style={s.inputStyle}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote();
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/40" style={{ fontSize: "10px", fontFamily: FONT }}>
              ⌘+Enter to submit
            </span>
            <button
              className="h-7 px-3 rounded-[var(--radius-sm)] bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              style={{ fontSize: "11px", fontWeight: 500, fontFamily: FONT }}
              onClick={handleAddNote}
              disabled={!newNoteText.trim()}
            >
              <Plus className="size-3" />
              Add Note
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-card" style={{ fontFamily: FONT }}>
        {content}
      </div>
    );
  }

  if (asCollapsible) {
    return (
      <CollapsibleSection icon={FileText} title="Notes" badge={
        (vendorNotes.length + internalNotes.length) > 0 ? (
          <span
            className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: "var(--avatar-1-bg)", color: "hsl(var(--primary))", fontFamily: FONT }}
          >
            {vendorNotes.length + internalNotes.length}
          </span>
        ) : undefined
      } defaultOpen={defaultOpen}>
        {content}
      </CollapsibleSection>
    );
  }

  return content;
}

/* ═══════════════════════════════════════════════════════════════
   LINE ITEM NOTE INDICATOR
   Small icon shown on line item rows when notes exist
   ═══════════════════════════════════════════════════════════════ */

export function LineItemNoteIndicator({
  vendorCount,
  internalCount,
}: {
  vendorCount: number;
  internalCount: number;
}) {
  const total = vendorCount + internalCount;
  if (total === 0) return null;

  const tooltipText = [
    vendorCount > 0 ? `${vendorCount} vendor note${vendorCount !== 1 ? "s" : ""}` : null,
    internalCount > 0 ? `${internalCount} internal note${internalCount !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 text-muted-foreground/60 hover:text-primary/80 transition-colors cursor-default ml-1.5">
          <MessageSquare className="size-3" />
          <span style={{ fontSize: "10px", fontWeight: 500, fontFamily: FONT }}>{total}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}
