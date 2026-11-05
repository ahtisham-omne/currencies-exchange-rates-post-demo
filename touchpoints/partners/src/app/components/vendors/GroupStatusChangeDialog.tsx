import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../ui/alert-dialog";
import { Archive, ArchiveRestore, CircleCheck, CircleSlash } from "lucide-react";

export type GroupStatusChangeMode = "archive" | "disable" | "unarchive" | "enable";

interface GroupStatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  /** Which lifecycle transition is being confirmed. */
  mode: GroupStatusChangeMode;
  /** When set on an archive confirm, the dialog becomes the "reassign
   *  first" gate: it explains that this many partners use the group as
   *  their primary and must be reassigned before archiving. Confirming
   *  then opens the reassignment modal (the parent wires onConfirm to
   *  do so) rather than archiving immediately. */
  reassignCount?: number;
  /** Fired when the user confirms — the parent persists the new status
   *  and surfaces its own toast. */
  onConfirm: () => void;
}

/**
 * Shared lifecycle-confirmation dialog for Partner Groups (Active ↔
 * Inactive ↔ Archived). One visual language across the detail-page header
 * menu and the listing-page row menu so the interaction reads identically
 * everywhere. Archive of a group that is primary for some partners is NOT
 * handled here — that opens the reassignment flow (ArchivePartnerGroupModal)
 * instead; this dialog only covers the no-reassignment-needed transitions.
 */
export function GroupStatusChangeDialog({
  open,
  onOpenChange,
  groupName,
  mode,
  reassignCount,
  onConfirm,
}: GroupStatusChangeDialogProps) {
  const isUnarchive = mode === "unarchive";
  const isArchive = mode === "archive";
  const isEnable = mode === "enable";
  // Archive gate: this group is primary for `reassignCount` partners, who
  // must be reassigned before it can be archived.
  const isReassignGate = isArchive && typeof reassignCount === "number" && reassignCount > 0;
  const plural = (reassignCount ?? 0) === 1 ? "partner" : "partners";

  const greenTone = { wash: "#ECFDF5", washSoft: "rgba(236,253,245,0.3)", glow: "#10B981", iconBg: "#D1FAE5", iconColor: "#065F46", chipBg: "#ECFDF5", chipFg: "#065F46", primaryBg: "#10B981" };
  const redTone = { wash: "#FEF2F2", washSoft: "rgba(254,242,242,0.3)", glow: "#EF4444", iconBg: "#FEE2E2", iconColor: "rgb(var(--destructive))", chipBg: "#FEF2F2", chipFg: "#991B1B", primaryBg: "rgb(var(--destructive))" };
  const amberTone = { wash: "#FFFBEB", washSoft: "rgba(255,251,235,0.3)", glow: "#F59E0B", iconBg: "#FEF3C7", iconColor: "#B45309", chipBg: "#FFFBEB", chipFg: "#92400E", primaryBg: "#F59E0B" };
  const tone = isUnarchive || isEnable ? greenTone : isArchive ? redTone : amberTone;
  const Icon = isUnarchive ? ArchiveRestore : isEnable ? CircleCheck : isArchive ? Archive : CircleSlash;
  const chipLabel = isUnarchive ? "Unarchive" : isEnable ? "Mark as Active" : isArchive ? "Archive" : "Mark as Inactive";
  const title = isUnarchive
    ? `Unarchive ${groupName}?`
    : isEnable
      ? `Mark ${groupName} as Active?`
      : isArchive
        ? `Archive ${groupName}?`
        : `Mark ${groupName} as Inactive?`;
  const desc = isReassignGate
    ? `${reassignCount} ${plural} use this group as their primary and must be moved to a new primary group before it can be archived. You'll pick where each one goes next.`
    : isUnarchive
      ? "The group goes back to Active and reappears in default listings and pickers. Linked partners keep their existing settings, unarchiving doesn't reapply the template."
      : isEnable
        ? "The group goes back to Active. It reappears in pickers and resumes seeding new partners. Linked partners keep their existing settings, re-activating doesn't reapply the template."
        : isArchive
          ? "This group is removed from active lists and stops seeding new partners. Existing linked partners keep their settings, and the group can be restored from the archive at any time. Existing transactions are unaffected."
          : "This group stops appearing in pickers and stops seeding new partners. Existing linked partners keep their settings exactly as-is. Re-activate from the header CTA when you're ready.";
  const primaryLabel = isReassignGate
    ? `Move ${reassignCount} ${plural}`
    : isUnarchive ? "Unarchive Group" : isEnable ? "Mark as Active" : isArchive ? "Archive Group" : "Mark as Inactive";
  const cancelLabel = isReassignGate ? "Cancel" : isUnarchive ? "Keep Archived" : isEnable ? "Keep Inactive" : "Keep Active";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        style={{ zIndex: 220 }}
        onInteractOutside={() => onOpenChange(false)}
      >
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: `linear-gradient(180deg, ${tone.wash} 0%, ${tone.washSoft} 70%, transparent 100%)` }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: tone.glow }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: tone.iconBg }}>
            <Icon className="w-8 h-8" style={{ color: tone.iconColor }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: tone.chipBg, color: tone.chipFg, letterSpacing: "0.05em" }}
          >
            {chipLabel}
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
              {title}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
            {desc}
          </AlertDialogDescription>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              onClick={() => { onConfirm(); onOpenChange(false); }}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: tone.primaryBg, color: "#fff" }}
            >
              {primaryLabel}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
