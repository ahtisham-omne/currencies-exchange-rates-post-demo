/**
 * POVersionSaveModal — version-save confirmation with itemized change preview.
 *
 * Visual recipe ported verbatim from Partners' GroupBulkApplyModal:
 *   - Glow header (blue gradient + 64px icon disk + blurred backlight)
 *   - Uppercase "SAVE VERSION" pill badge
 *   - Centered title + description
 *   - Indigo-tinted "Changes you made" panel with bullet list + count badge
 *   - Diff layout per row: line-through previous → tinted next
 *
 * Differences from Partners' modal (intentional — PO save is a binary action):
 *   - Two simple buttons (Save Version + Cancel) instead of multi-option cards
 *   - Header icon is `Save` (not `Tag`) — semantically correct for this flow
 *   - Bullet colour varies by action — indigo for Changed, emerald + glyph for
 *     Added, red − glyph for Removed
 *   - Header includes a Version N+1 chip so the buyer knows which version is
 *     about to be created
 */
import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Save, X, Plus, Minus, GitBranch } from "lucide-react";
import { FONT } from "./designTokens";
import type { POChangeType } from "./poStore";

export interface POVersionSaveChange {
  tag: string;
  type: POChangeType;
  action: "Added" | "Removed" | "Changed";
  subject: string;
  detail?: string;
}

interface POVersionSaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** PO number — used in the description copy. */
  poNumber: string;
  /** Version number that will be created when the user confirms. */
  nextVersion: number;
  /** Itemised list of changes recorded during this editing session. */
  changes: POVersionSaveChange[];
  /** Fires when the user confirms Save Version. */
  onConfirm: () => void;
}

/* ─── Helpers ─── */

/** Split "before → after" detail into [previous, next] using common arrow glyphs. */
function splitDiff(detail?: string): [string | undefined, string | undefined] {
  if (!detail) return [undefined, undefined];
  const arrows = [" → ", " -> ", " => "];
  for (const arrow of arrows) {
    const idx = detail.indexOf(arrow);
    if (idx >= 0) return [detail.slice(0, idx).trim(), detail.slice(idx + arrow.length).trim()];
  }
  return [undefined, detail];
}

/** Per-action visual config — bullet glyph + colour. */
function getActionVisual(action: POVersionSaveChange["action"]) {
  switch (action) {
    case "Added":   return { glyph: "+" as const, color: "#10B981", bg: "#ECFDF5", label: "Added"   };
    case "Removed": return { glyph: "−" as const, color: "#EF4444", bg: "#FEF2F2", label: "Removed" };
    case "Changed":
    default:        return { glyph: "●" as const, color: "#4F46E5", bg: "#EEF2FF", label: "Changed" };
  }
}

/* ─── Component ─── */

export default function POVersionSaveModal({
  open,
  onOpenChange,
  poNumber,
  nextVersion,
  changes,
  onConfirm,
}: POVersionSaveModalProps) {
  const hasChanges = changes.length > 0;
  const handleConfirm = () => {
    if (!hasChanges) return;
    onConfirm();
    onOpenChange(false);
  };
  const handleCancel = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // PO's Dialog primitive renders a built-in close button — `[&>button.absolute]:hidden`
        // suppresses it so our custom X (in the glow header) is the only close affordance.
        className="flex flex-col p-0 gap-0 border-0 sm:border z-[230] !max-w-[600px] !w-[600px] !rounded-2xl overflow-hidden [&>button.absolute]:hidden"
        style={{ fontFamily: FONT }}
      >
        <DialogTitle className="sr-only">Save version — {poNumber}</DialogTitle>
        <DialogDescription className="sr-only">
          Review the changes made to this purchase order before saving them as a new version.
        </DialogDescription>

        {/* ─── Glow header — verbatim from GroupBulkApplyModal ─── */}
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: "linear-gradient(180deg, #EFF6FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
            style={{ backgroundColor: "#3B82F6" }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "#DBEAFE" }}
          >
            <Save className="w-8 h-8" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: "#EFF6FF", color: "#1E40AF", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
          >
            Save Version
          </span>
          <button
            onClick={handleCancel}
            className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-white/50 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="flex flex-col items-center text-center px-7 pb-7">
          {/* Title row — title + version chip */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <h2 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
              Save changes as a new version?
            </h2>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-white tabular-nums"
              style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--primary))", borderColor: "#BFDBFE" }}
            >
              <GitBranch className="w-3 h-3" />
              Version {nextVersion}
            </span>
          </div>
          <p
            className="text-[13px] mt-2 max-w-[440px] leading-[1.65]"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Review the changes below. Once saved, this becomes Version {nextVersion} on{" "}
            <span className="text-foreground" style={{ fontWeight: 500 }}>{poNumber}</span> and the PO returns to Draft so you can keep iterating.
          </p>

          {/* ─── "Changes you made" panel — indigo tint, scrollable list ─── */}
          <div
            className="w-full mt-5 rounded-xl border px-4 py-3 text-left"
            style={{ backgroundColor: "#EEF2FF", borderColor: "#E0E7FF" }}
          >
            <div className="flex items-center justify-between mb-2">
              <p
                className="text-[10.5px] uppercase tracking-wide"
                style={{ fontWeight: 600, color: "#4338CA" }}
              >
                Changes you made
              </p>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] border bg-white"
                style={{ fontWeight: 600, color: "#4F46E5", borderColor: "#C7D2FE" }}
              >
                {changes.length} {changes.length === 1 ? "change" : "changes"}
              </span>
            </div>

            {hasChanges ? (
              <ul className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1">
                {changes.map((c, i) => {
                  const vis = getActionVisual(c.action);
                  const [prev, next] = splitDiff(c.detail);
                  return (
                    <li key={`${c.tag}-${i}`} className="flex items-start gap-2">
                      {/* Bullet — coloured by action.
                          • Changed = indigo dot
                          • Added   = emerald + in pill
                          • Removed = red − in pill */}
                      {c.action === "Changed" ? (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: vis.color }} />
                      ) : (
                        <span
                          className="mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: vis.bg, color: vis.color }}
                        >
                          {c.action === "Added" ? <Plus className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                        </span>
                      )}

                      <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        {/* Subject — the field that changed (or item number that was added/removed) */}
                        <span className="text-[11.5px] text-foreground" style={{ fontWeight: 500 }}>
                          {c.subject}
                        </span>

                        {/* Diff — "previous → next" when both sides exist, else just next/detail */}
                        {(prev != null || next != null) && (
                          <span className="text-[11px] text-slate-600 inline-flex items-baseline gap-1.5 flex-wrap">
                            {prev != null && (
                              <span className="text-slate-500 line-through tabular-nums">{prev}</span>
                            )}
                            {prev != null && next != null && <span className="text-slate-400">→</span>}
                            {next != null && (
                              <span
                                className="tabular-nums"
                                style={{
                                  color: c.action === "Removed" ? "#B91C1C" : vis.color,
                                  fontWeight: 600,
                                }}
                              >
                                {next}
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Tag — small muted chip on the right, gives buyer context for which area */}
                      <span
                        className="text-[10px] text-slate-400 shrink-0 px-1.5 py-0.5 rounded bg-white/60 whitespace-nowrap"
                        style={{ fontWeight: 500 }}
                      >
                        {c.tag}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="py-3 text-center">
                <p className="text-[12px]" style={{ color: "#4F46E5", fontWeight: 500 }}>
                  No changes recorded
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Make an edit before saving a new version.
                </p>
              </div>
            )}
          </div>

          {/* ─── Actions — Save Version (primary, full-width) + Cancel (muted) ─── */}
          <div className="w-full mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!hasChanges}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl text-[13px] shadow-sm transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                fontWeight: 600,
                color: "hsl(var(--primary-foreground))",
                backgroundColor: "hsl(var(--primary))",
                border: "none",
                fontFamily: FONT,
              }}
              onMouseEnter={(e) => { if (hasChanges) e.currentTarget.style.backgroundColor = "#0862D0"; }}
              onMouseLeave={(e) => { if (hasChanges) e.currentTarget.style.backgroundColor = "hsl(var(--primary))"; }}
            >
              <Save className="w-4 h-4" />
              Save Version {nextVersion}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155", fontFamily: FONT }}
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
