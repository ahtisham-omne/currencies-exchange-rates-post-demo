import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { Checkbox } from "../ui/checkbox";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Tag,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { Vendor } from "../../data/vendors";
import type { GroupBulkApplyTier } from "./groupBulkApplyTiers";

export interface GroupBulkApplyChange {
  /** Human-readable name of the setting being changed. */
  settingLabel: string;
  /** What the setting was before (displayed for clarity). Optional —
   *  per-section saves omit it because multiple fields may have moved. */
  previousValue?: string;
  /** What the setting is being set to (displayed). Optional for the
   *  same reason as previousValue. */
  nextValue?: string;
  /** Itemized list of edits captured between dialog-open and Save —
   *  rendered as a "Changes you made" panel above the option cards
   *  with a count badge. Each entry covers a single field/setting. */
  changes?: Array<{
    field: string;
    previous?: string;
    next?: string;
  }>;
}

interface GroupBulkApplyModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupName: string;
  linkedPartners: Vendor[];
  change: GroupBulkApplyChange | null;
  /** Called when user picks "Save template only". */
  onSaveTemplateOnly: () => void;
  /** Called when user picks "Save + apply to linked partners". All linked partner IDs are passed through.
   *  `opts.makeVendorOnlyCustomers` is only set when `includesCustomerRules` is true and the
   *  group has vendor-only partners (ERP-10410). */
  onSaveAndApply: (applyToIds: string[], opts?: { makeVendorOnlyCustomers: boolean }) => void;
  /** True when the change being pushed includes Customer Rules (or the group is being
   *  switched to customers in the same save). When set and the push would reach
   *  vendor-only partners, the push option shows how many there are and an unchecked
   *  "Make them customers too" box (Eli, 26 Oct 2026 — ERP-10410). */
  includesCustomerRules?: boolean;
  /**
   * Bulk-apply tier. Defaults to "full" for backward compatibility (Pricing Rules).
   *  - "full"          — template-only default + opt-in push (P0).
   *  - "push-cautious" — same options, stronger "doesn't touch anything in motion" copy (P1).
   *  - "template-only" — single "Save template only" button; no push action (Backlog).
   *  - "pending"       — should never reach this modal; logs a warning if it does.
   */
  tier?: GroupBulkApplyTier;
}

/**
 * Bulk-apply confirmation modal for Partner Group setting changes.
 *
 * Eli's baseline rule: change the template; do NOT touch entities already in play.
 * Secondary option (opt-in): also push the change to the currently-linked partners
 * for future transactions; past transactions are never changed.
 */
export function GroupBulkApplyModal({
  open,
  onOpenChange,
  groupName,
  linkedPartners,
  change,
  onSaveTemplateOnly,
  onSaveAndApply,
  tier = "full",
  includesCustomerRules = false,
}: GroupBulkApplyModalProps) {
  // Single-question save framework: one binary choice — push the
  // change to associated partners, or keep it scoped to the template
  // only. New partners always inherit going forward (that's the point
  // of editing a template); the question is whether to also reach
  // back to existing linked partners.
  // Tier kept on the prop for backward compat with consumers that
  // still pass it, but the modal no longer gates UI on it.
  void tier;

  // The push reaches every linked partner. It only changes the defaults new
  // transactions resolve, so nothing in flight is touched and nobody is
  // skipped. (The old "in flight" filter keyed off outstanding balance,
  // which every seeded partner has, so the push silently reached 0.)
  const safePartners = linkedPartners;

  // ERP-10410 — a Customer Rules push never changes a partner's type
  // silently. Count the vendor-only partners the push would reach and
  // let the user opt in (unchecked by default) to making them customers.
  const vendorOnlyCount = useMemo(() => {
    if (!includesCustomerRules) return 0;
    return safePartners.filter((v) => {
      const types = v.partnerTypes || [];
      return types.includes("vendor") && !types.includes("customer");
    }).length;
  }, [includesCustomerRules, safePartners]);
  const showVendorOnlyNotice = vendorOnlyCount > 0;
  const [makeVendorOnlyCustomers, setMakeVendorOnlyCustomers] = useState(false);
  // Reset to unchecked every time the window opens.
  useEffect(() => { if (open) setMakeVendorOnlyCustomers(false); }, [open]);

  if (!change) return null;

  const hasDiff = !!(change.previousValue || change.nextValue);

  // Each option card on the body fires its corresponding save callback
  // directly — there's no aggregate Save button at the footer because
  // the action IS the choice.
  const handleNo = () => onSaveTemplateOnly();
  const handleYes = () =>
    onSaveAndApply(
      safePartners.map((p) => p.id),
      showVendorOnlyNotice ? { makeVendorOnlyCustomers } : undefined,
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0 border-0 sm:border z-[230] !max-w-[600px] !w-[600px] !rounded-2xl overflow-hidden"
        hideCloseButton
        overlayClassName="z-[225]"
      >
        <DialogTitle className="sr-only">Save configuration changes, {groupName}</DialogTitle>
        <DialogDescription className="sr-only">
          Confirm how the {change.settingLabel} change should be applied.
        </DialogDescription>

        {/* Glow header — colored gradient + centered icon disk + uppercase
            badge. Mirrors the Set-as-Primary modal pattern so all
            confirmation dialogs in the Partner Group flow share one
            visual language. */}
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#0A77FF" }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#CFE6FF" }}>
            <Tag className="w-8 h-8" style={{ color: "rgb(var(--primary))" }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", letterSpacing: "0.05em" }}
          >
            Save Changes
          </span>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-white/50 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body — centered title + description, then cards + footer. */}
        <div className="flex flex-col items-center text-center px-7 pb-7">
          <h2 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
            Apply changes to {groupName}?
          </h2>
          <p className="text-[13px] mt-2 max-w-[420px] leading-[1.65]" style={{ color: "rgb(var(--muted-foreground))" }}>
            Pick how these changes should propagate. Past transactions are never affected, only how new transactions resolve their defaults.
          </p>

          {/* Inline change-summary chip pair (legacy single-field case). */}
          {hasDiff && (
            <div className="mt-4 inline-flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-border text-[11px] text-slate-500 line-through">
                {change.previousValue}
              </span>
              <span className="text-slate-400">→</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[11px]" style={{ backgroundColor: "#EEF2FF", color: "#4F46E5", borderColor: "#E0E7FF", fontWeight: 600 }}>
                {change.nextValue}
              </span>
            </div>
          )}

          {/* Itemized "Changes you made" panel — indigo-tinted card with
              count badge + scrollable list. Indigo bg makes the panel
              read as a distinct chunk above the option cards. */}
          {change.changes && change.changes.length > 0 && (
            <div className="w-full mt-5 rounded-xl border px-4 py-3 text-left" style={{ backgroundColor: "#EEF2FF", borderColor: "#E0E7FF" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] tracking-wide" style={{ fontWeight: 600, color: "#4338CA" }}>Changes You Made</p>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border bg-white"
                  style={{ fontWeight: 600, color: "#4F46E5", borderColor: "#C7D2FE" }}
                >
                  {change.changes.length} {change.changes.length === 1 ? "Change" : "Changes"}
                </span>
              </div>
              <ul className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                {change.changes.map((c, i) => (
                  <li key={`${c.field}-${i}`} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#4F46E5] shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>{c.field}</span>
                      {(c.previous != null || c.next != null) && (
                        <span className="text-[11px] text-slate-600 inline-flex items-baseline gap-1.5 flex-wrap">
                          {c.previous != null && (
                            <span className="text-slate-500 line-through">{c.previous}</span>
                          )}
                          {c.previous != null && c.next != null && <span className="text-slate-400">→</span>}
                          {c.next != null && (
                            <span style={{ color: "#4F46E5", fontWeight: 600 }}>{c.next}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Option cards + Cancel. Cards keep left-aligned content for
              readability; bullets replaced with check-prefixed lines for
              cleaner UX. */}
          <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
            {/* Option 1 — Keep changes at Partner Group level only. */}
            <button
              type="button"
              onClick={handleNo}
              className="w-full text-left rounded-xl border border-border bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)] transition-all cursor-pointer p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-slate-100 text-slate-600">
                  <Check className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                    Keep Changes at Partner Group Level Only
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-600 truncate">
                        Saved at Partner Group level only.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-600 truncate">
                        Existing associated partners are not affected.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-600 truncate">
                        New partners going forward inherit the updated configurations.
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-2" />
              </div>
            </button>

            {/* Option 2 — Push changes to associated partners. Wrapped so the
                ERP-10410 vendor-only row can sit inside the same card without
                nesting the checkbox inside the action button. */}
            <div className="w-full rounded-xl border border-blue-100 bg-accent overflow-hidden">
            <button
              type="button"
              onClick={handleYes}
              className="w-full text-left hover:bg-blue-100 transition-colors cursor-pointer p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-primary text-white shadow-[0_1px_4px_rgba(10,119,255,0.25)]">
                  <Zap className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] text-primary" style={{ fontWeight: 600 }}>
                      Push Changes to Associated Partners
                    </p>
                    <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] border bg-white text-primary border-primary/20" style={{ fontWeight: 600 }}>
                      {safePartners.length} {safePartners.length === 1 ? "Partner" : "Partners"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-700 truncate">
                        Past transactions for existing associated partners remain unchanged.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-700 truncate">
                        Future transactions (POs, SOs) use the new configurations.
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-2" />
              </div>
            </button>
            {showVendorOnlyNotice && (
              <div className="border-t border-blue-100 pl-[64px] pr-4 py-3 flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-[11px] text-slate-700">
                    {vendorOnlyCount} {vendorOnlyCount === 1 ? "partner in this group is" : "partners in this group are"} vendor-only.
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none w-fit">
                  <Checkbox
                    checked={makeVendorOnlyCustomers}
                    onCheckedChange={(v) => setMakeVendorOnlyCustomers(v === true)}
                    className="bg-white"
                  />
                  <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                    Make Them Customers Too
                  </span>
                </label>
              </div>
            )}
            </div>

            {/* Cancel — full-width button matching the Set-as-Primary modal. */}
            <button
              onClick={() => onOpenChange(false)}
              className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors mt-1"
              style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Tiny reusable badge component for parity (unused by default, exported in case a
   caller wants to render the "update pending" state elsewhere). */
export function BulkApplyWarningBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px]" style={{ fontWeight: 600 }}>
      <AlertTriangle className="w-2.5 h-2.5" /> {count} pending
    </span>
  );
}

/* Sized pill for when the bulk-apply modal is minimized into a linked-partners pill, etc. */
export function BulkApplyPill({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-white text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
      <Users className="w-3 h-3" /> {count} linked
    </span>
  );
}
