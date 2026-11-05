/* OutdatedConfigsModal — receiving-side counterpart for upstream
 * modules (Partner Management and others) that push updated
 * settings onto a partner this PO already references. When new
 * values arrive, an "Outdated Configurations" pill lights up in
 * the PO detail header. Tapping the pill opens this modal so the
 * buyer can:
 *   - Review the list of drift-from-defaults items
 *   - Selectively sync individual updates (checkbox list), or
 *   - Ignore the whole set (nested destructive confirm)
 *
 * Chrome mirrors Partner Management's amber warning-confirm
 * dialog: amber-glow header + centered body + close-X + amber
 * primary + muted-secondary vertical footer. Ignore fires a
 * nested destructive `ConfirmDiscardModal` at a higher z-index
 * so the one-way action reads as weighty. */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, X, ArrowRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Checkbox } from "./ui/checkbox";
/* Nested ConfirmDiscardModal removed — Ignore now commits directly
   and returns the buyer to the detail page (parent closes on
   `onOpenChange(false)` inside `ignoreAll`). */

export interface OutdatedUpdate {
  id: string;
  /** Field label, e.g. "Currency", "Ship-to address", "Sales rep". */
  field: string;
  /** Optional category grouping (renders as a small muted tag). */
  category?: string;
  /** Previous value the PO is currently pinned to. */
  oldValue: string;
  /** Incoming value from an upstream module. */
  newValue: string;
  /** Optional context line — e.g. "Applies to all 12 line items". */
  note?: string;
}

interface OutdatedConfigsModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  updates: OutdatedUpdate[];
  /** Called with the ids the user chose to sync. */
  onApply: (appliedIds: string[]) => void;
  /** Called with the ids the user chose to ignore permanently. */
  onIgnore?: (ignoredIds: string[]) => void;
  /** Optional context — surfaced in the description copy. */
  partnerName?: string;
}

export function OutdatedConfigsModal({
  open,
  onOpenChange,
  updates,
  onApply,
  onIgnore,
  partnerName,
}: OutdatedConfigsModalProps) {
  /* Selections start empty so Apply reads as disabled until the
     buyer opts in. Ignore stays enabled the whole time so opting
     out never needs a pre-selection. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* Render snapshot — frozen while the modal is visible so a parent
     that drains `updates` to [] (Ignore → markOutdatedIgnored) can't
     cause the AlertDialog to re-render mid-exit-animation with the
     empty state (which would collapse the body to just the "No
     outdated configurations" line and read as a "small modal coming
     back" during the fade-out). Refreshes when the modal RE-opens. */
  const [renderUpdates, setRenderUpdates] = useState(updates);
  useEffect(() => {
    if (open) {
      setRenderUpdates(updates);
      setSelectedIds(new Set());
    }
  }, [open, updates]);

  const total = renderUpdates.length;
  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === total && total > 0;
  const someSelected = selectedCount > 0 && selectedCount < total;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(renderUpdates.map((u) => u.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySelected = () => {
    if (selectedCount === 0) return;
    onApply(Array.from(selectedIds));
    /* Close the modal on apply — the parent immediately plays the
       amber "Configurations Updated" sync overlay which owns the
       success beat, so keeping the modal open would collide. */
    onOpenChange(false);
  };

  const ignoreAll = () => {
    /* Capture ids BEFORE we close so React can't re-render the modal
       with the drained updates list between the two calls. Close
       first, commit after. `renderUpdates` is frozen for the exit
       animation so even if the parent drains updates immediately,
       the visible modal doesn't collapse to the empty state. */
    const ids = renderUpdates.map((u) => u.id);
    onOpenChange(false);
    if (onIgnore) onIgnore(ids);
  };

  const description = useMemo(() => {
    const count = total === 1 ? "1 configuration update is" : `${total} configuration updates are`;
    const target = partnerName ? ` for ${partnerName}` : "";
    return `${count} available${target}. Choose which to sync into this purchase order.`;
  }, [total, partnerName]);

  return (
    <>
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-[560px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] z-[16000]"
        overlayClassName="z-[15900]"
        style={{ zIndex: 16000, backgroundColor: "#FFFFFF" }}
        onInteractOutside={() => onOpenChange(false)}
      >
        {/* Close (×) — same 32×32 rounded chip PM uses on its main
            CreatePartnerModal header, slate-100 hover. */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Cancel"
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Amber glow header — mirrors PM's Duplicate / Discard
            header treatment. Sync/refresh iconography reads as
            "changes are available" without escalating to
            destructive-red. */}
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{
            background:
              "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)",
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
            style={{ backgroundColor: "#F59E0B" }}
          />
          <div
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "#FEF3C7" }}
          >
            <RefreshCw className="w-8 h-8" style={{ color: "#B45309" }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{
              fontWeight: 600,
              backgroundColor: "#FFFBEB",
              color: "#92400E",
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
            }}
          >
            {total} {total === 1 ? "Update" : "Updates"} Available
          </span>
        </div>

        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle
              className="text-[18px] tracking-[-0.02em]"
              style={{ fontWeight: 600, color: "var(--foreground)" }}
            >
              Outdated Configurations
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription
            className="text-[13px] mt-2 max-w-[440px] mx-auto"
            style={{ color: "var(--muted-foreground)", lineHeight: "1.65" }}
          >
            {description}
          </AlertDialogDescription>

          {/* Select-all toolbar + scrollable list */}
          <div className="w-full mt-5 text-left">
            <div className="flex items-center justify-between px-3 py-2 rounded-t-lg border border-b-0 border-border bg-[#FAFBFC]">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  /* Force the primary fill + white glyph when
                     checked/indeterminate; unchecked stays crisp
                     white. Matches the SO-V5 rendering fix. */
                  className={
                    allSelected || someSelected
                      ? "!bg-primary !border-primary text-white"
                      : "data-[state=unchecked]:bg-white"
                  }
                  aria-label="Select all updates"
                />
                <span
                  className="text-[12px] text-foreground"
                  style={{ fontWeight: 600 }}
                >
                  {allSelected
                    ? "All selected"
                    : someSelected
                      ? `${selectedCount} of ${total} selected`
                      : "Select all"}
                </span>
              </label>
              <span
                className="text-[11px]"
                style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
              >
                {total} {total === 1 ? "change" : "changes"}
              </span>
            </div>

            {/* Scrollable so 10+ updates stay tractable. */}
            <div
              className="rounded-b-lg border border-border bg-white overflow-y-auto"
              style={{ maxHeight: 320 }}
            >
              {renderUpdates.map((u, idx) => {
                const checked = selectedIds.has(u.id);
                return (
                  <label
                    key={u.id}
                    className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                    style={{
                      borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleOne(u.id)}
                      className={
                        checked
                          ? "mt-0.5 !bg-primary !border-primary text-white"
                          : "mt-0.5 data-[state=unchecked]:bg-white"
                      }
                      aria-label={`Sync ${u.field}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[13px]"
                          style={{ fontWeight: 600, color: "var(--foreground)" }}
                        >
                          {u.field}
                        </span>
                        {u.category && (
                          <span
                            className="text-[10px] uppercase tracking-wider"
                            style={{ fontWeight: 600, color: "var(--muted-foreground)" }}
                          >
                            {u.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[12px] flex-wrap">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md line-through"
                          style={{
                            backgroundColor: "#F1F5F9",
                            color: "#64748B",
                            border: "1px solid #E2E8F0",
                          }}
                        >
                          {u.oldValue}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md"
                          style={{
                            backgroundColor: "#FFFBEB",
                            color: "#92400E",
                            border: "1px solid #FDE68A",
                            fontWeight: 500,
                          }}
                        >
                          {u.newValue}
                        </span>
                      </div>
                      {u.note && (
                        <div
                          className="mt-1 text-[11px]"
                          style={{ color: "var(--muted-foreground)", lineHeight: 1.4 }}
                        >
                          {u.note}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
              {total === 0 && (
                <div
                  className="px-3 py-6 text-center text-[12px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  No outdated configurations. This purchase order is up to date.
                </div>
              )}
            </div>
          </div>

          {/* Footer buttons — vertical stack, primary on top, secondary
              below. Mirrors Partner Management's Disable Carrier Profile
              confirm dialog: full-width h-11 rounded-xl buttons, amber
              primary + muted secondary. Apply gates on the selection;
              Ignore stays enabled the whole time and fires a nested
              destructive confirm because ignoring is one-way. */}
          <div className="w-full mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={applySelected}
              disabled={selectedCount === 0}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600, backgroundColor: "#F59E0B", color: "#fff" }}
            >
              {selectedCount === 0
                ? "Apply changes"
                : selectedCount === total
                  ? `Apply all ${total} ${total === 1 ? "update" : "updates"}`
                  : `Apply ${selectedCount} ${selectedCount === 1 ? "update" : "updates"}`}
            </button>
            <button
              type="button"
              onClick={ignoreAll}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-80"
              style={{ fontWeight: 500, backgroundColor: "var(--muted)", color: "#334155" }}
            >
              Ignore changes
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export default OutdatedConfigsModal;
