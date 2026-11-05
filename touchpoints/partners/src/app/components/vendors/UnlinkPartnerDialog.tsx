import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Eye, ShieldAlert, Unlink2 } from "lucide-react";

/**
 * Canonical unlink-from-group confirmation with the built-in primary-group
 * guard (ERP-5770: every partner keeps ≥1 group + a primary). Mirrors the
 * PartnerGroupDetailsPage Linked Partners dialog exactly, extended with a
 * bulk variant, so every surface that unlinks partners from a group —
 * group details page, Edit Partner Group, Add Partners modal — shows the
 * same prompts:
 *
 * - single, not primary  → red confirm ("Unlink X from G?")
 * - single, primary here → amber guard ("Can't unlink X yet") + CTA to
 *                          open the partner and reassign their primary
 * - bulk, none primary   → red confirm scaled to N
 * - bulk, all primary    → amber guard, nothing to unlink
 * - bulk, mixed          → red confirm for the removable subset + amber
 *                          note listing how many primary rows are skipped
 */
export type UnlinkPending =
  | { kind: "single"; id: string; name: string }
  | { kind: "bulk"; ids: string[] }
  | null;

interface UnlinkPartnerDialogProps {
  pending: UnlinkPending;
  onClose: () => void;
  groupName: string;
  /** Partner ids whose primary group is THIS group — they can't be unlinked. */
  lockedPrimaryIds: Set<string>;
  /** Perform the unlink for the non-locked ids. Skipped ids are reported in the toastable second arg. */
  onConfirm: (removableIds: string[], skippedCount: number) => void;
  /** Open the partner page to reassign their primary (single-locked CTA). */
  onOpenPartner: (id: string) => void;
  zIndex?: number;
  overlayClassName?: string;
}

export function UnlinkPartnerDialog({
  pending,
  onClose,
  groupName,
  lockedPrimaryIds,
  onConfirm,
  onOpenPartner,
  zIndex = 220,
  overlayClassName,
}: UnlinkPartnerDialogProps) {
  const ids = pending ? (pending.kind === "single" ? [pending.id] : pending.ids) : [];
  const lockedIds = ids.filter((id) => lockedPrimaryIds.has(id));
  const removableIds = ids.filter((id) => !lockedPrimaryIds.has(id));
  // Guard layout when nothing at all can be unlinked (single-primary or
  // bulk where every selected row is primary here).
  const isGuard = !!pending && ids.length > 0 && removableIds.length === 0;
  const isMixed = !!pending && lockedIds.length > 0 && removableIds.length > 0;
  const singleName = pending?.kind === "single" ? pending.name : null;

  const tone = isGuard
    ? { wash: "#FFFBEB", washSoft: "rgba(255,251,235,0.3)", glow: "#F59E0B", iconBg: "#FEF3C7", iconColor: "#B45309", chipBg: "#FFFBEB", chipFg: "#92400E" }
    : { wash: "#FEF2F2", washSoft: "rgba(254,242,242,0.3)", glow: "#EF4444", iconBg: "#FEE2E2", iconColor: "rgb(var(--destructive))", chipBg: "#FEF2F2", chipFg: "#991B1B" };

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        style={{ zIndex }}
        overlayClassName={overlayClassName}
        onInteractOutside={onClose}
      >
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: `linear-gradient(180deg, ${tone.wash} 0%, ${tone.washSoft} 70%, transparent 100%)` }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: tone.glow }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: tone.iconBg }}>
            {isGuard ? <ShieldAlert className="w-8 h-8" style={{ color: tone.iconColor }} /> : <Unlink2 className="w-8 h-8" style={{ color: tone.iconColor }} />}
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: tone.chipBg, color: tone.chipFg, letterSpacing: "0.05em" }}
          >
            {isGuard ? "Primary Group" : pending?.kind === "bulk" ? "Bulk · Unlink" : "Unlink"}
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
              {isGuard
                ? singleName
                  ? `Can't unlink ${singleName} yet`
                  : `Can't unlink ${ids.length === 1 ? "this partner" : "these partners"} yet`
                : pending?.kind === "bulk"
                  ? `Unlink ${removableIds.length} partner${removableIds.length === 1 ? "" : "s"} from ${groupName}?`
                  : `Unlink ${singleName ?? "this partner"} from ${groupName}?`}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
            {isGuard
              ? singleName
                ? <>{groupName} is the primary group for {singleName}. A partner must always have a primary group, so set a different group as their primary first, then you can unlink them from {groupName}.</>
                : <>{groupName} is the primary group for {ids.length === 1 ? "the selected partner" : `all ${ids.length} selected partners`}. A partner must always have a primary group, so set a different group as their primary first, then you can unlink them from {groupName}.</>
              : <>Only the group association is removed. The {removableIds.length === 1 && pending?.kind !== "bulk" ? "partner's" : "partners'"} existing payment terms, pricing rules, credit settings, and transaction history all stay exactly as-is, they just stop inheriting future template updates from {groupName}.</>}
          </AlertDialogDescription>

          {isGuard && (
            <div className="w-full mt-4 flex items-start gap-2 px-3 py-2 rounded-lg border text-left" style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}>
              <ShieldAlert className="w-4 h-4 shrink-0 mt-px" style={{ color: "#B45309" }} />
              <p className="text-[12px]" style={{ fontWeight: 500, color: "#92400E" }}>
                Reassign {singleName ? "this partner's" : "each partner's"} primary group, then return here to unlink.
              </p>
            </div>
          )}

          {isMixed && (
            <div className="w-full mt-4 flex items-start gap-2 px-3 py-2 rounded-lg border text-left" style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}>
              <ShieldAlert className="w-4 h-4 shrink-0 mt-px" style={{ color: "#B45309" }} />
              <p className="text-[12px]" style={{ fontWeight: 500, color: "#92400E" }}>
                {lockedIds.length} partner{lockedIds.length === 1 ? "" : "s"} will be skipped — {groupName} is their primary group. Reassign their primary from the partner page to unlink them.
              </p>
            </div>
          )}

          <div className="w-full mt-7 flex flex-col gap-2.5">
            {isGuard ? (
              singleName ? (
                <button
                  onClick={() => {
                    const id = pending?.kind === "single" ? pending.id : ids[0];
                    onClose();
                    if (id) onOpenPartner(id);
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90 inline-flex items-center justify-center gap-1.5"
                  style={{ fontWeight: 600, backgroundColor: "rgb(var(--primary))", color: "#fff" }}
                >
                  <Eye className="w-4 h-4" /> Open partner to reassign primary
                </button>
              ) : null
            ) : (
              <button
                onClick={() => {
                  onConfirm(removableIds, lockedIds.length);
                  onClose();
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
              >
                {pending?.kind === "bulk"
                  ? `Unlink ${removableIds.length} Partner${removableIds.length === 1 ? "" : "s"}`
                  : "Unlink Partner"}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
            >
              Keep Linked
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
