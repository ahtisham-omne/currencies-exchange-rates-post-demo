/**
 * Pricing rule item scope — "Specific items & categories" / "All items" (Eli, 13 Mar Partners review; Design Governance Changelog:
 * "add Apply to all items for this vendor CTA in item selection").
 *
 * All items = the rule prices every item, now and in the future; items
 * added later are covered without anyone touching the rule. Rules:
 *   - never the default — the user picks it on purpose;
 *   - saving an All items rule always asks for confirmation first;
 *   - Specific keeps items and categories together (a rule can carry both);
 *   - no "All categories" option (every item has a primary category, so
 *     it would cover exactly the same items as All items).
 *
 * Shared by every pricing-rule surface (partner detail Pricing Rules tab,
 * Create Partner, Create Partner Group) so the flow reads identically.
 */
import React from "react";
import { Package, Boxes, Check, AlertTriangle, Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

export type PricingRuleItemScope = "specific" | "all";

/** Default for new rules. Never "all" — Eli: too risky as a default. */
export const DEFAULT_ITEM_SCOPE: PricingRuleItemScope = "specific";

const OPTIONS: { key: PricingRuleItemScope; label: string; desc: string; icon: typeof Package }[] = [
  { key: "specific", label: "Specific Items & Categories", desc: "Pick the items and categories this rule prices", icon: Package },
  { key: "all", label: "All Items", desc: "Every item, including new ones", icon: Boxes },
];

/** Step 2 "Applies to" toggle — two mutually exclusive choices. */
export function ItemScopeToggle({
  value,
  onChange,
  disabled,
  wasAllItems,
}: {
  value: PricingRuleItemScope;
  onChange: (v: PricingRuleItemScope) => void;
  disabled?: boolean;
  /** Editing a rule saved as All items — moving off it drops the all-items coverage. */
  wasAllItems?: boolean;
}) {
  return (
    <div>
      <p className="text-[12px] text-foreground mb-2" style={{ fontWeight: 600 }}>Applies To</p>
      <div role="radiogroup" aria-label="Applies To" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const active = value === o.key;
          const Icon = o.icon;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(o.key)}
              className={`relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                active ? "border-primary bg-primary/[0.04] shadow-[0_1px_4px_rgba(10,119,255,0.10)]" : "border-border bg-white hover:border-slate-300"
              } ${disabled ? "cursor-default opacity-80" : "cursor-pointer"}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-primary/10 text-primary" : "bg-slate-50 text-slate-400"}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[12px] truncate ${active ? "text-primary" : "text-slate-700"}`} style={{ fontWeight: 600 }}>{o.label}</p>
                <p className="text-[11px] text-slate-400 truncate">{o.desc}</p>
              </div>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${active ? "bg-primary" : "border-[1.5px] border-[#D1D5DB] bg-white"}`}>
                {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>
      {wasAllItems && value !== "all" && (
        <div className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 mt-2" style={{ backgroundColor: "#EDF4FF", borderColor: "#CFE0FF" }}>
          <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#0A77FF" }} />
          <p className="text-[12px] leading-[1.5]" style={{ color: "#0A4FA3" }}>
            <span style={{ fontWeight: 600 }}>This removes the all-items coverage.</span> Once saved, the rule applies only to the items and categories you pick.
          </p>
        </div>
      )}
    </div>
  );
}

/** Square "All items" pill — replaces item/category counts on rule cards and tab badges. */
export function AllItemsPill({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border ${className}`}
      style={{ fontWeight: 600, backgroundColor: "#EDF4FF", color: "#0A5FCC", borderColor: "#CFE0FF" }}
    >
      <Boxes className="w-3 h-3" /> All
    </span>
  );
}

/**
 * Body for the Items / Categories tabs of an All items rule, so they say
 * what the rule covers instead of looking empty. `showWarning` adds the
 * inline banner used while creating/editing (paired with the save popup).
 */
export function AllItemsCoverage({ kind = "items", showWarning = false }: { kind?: "items" | "categories"; showWarning?: boolean }) {
  return (
    <div className="p-4">
      {showWarning && (
        <div className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 mb-4" style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#B45309" }} />
          <p className="text-[12px] leading-[1.5]" style={{ color: "#92400E" }}>
            <span style={{ fontWeight: 600 }}>This rule will price every item</span>, including items added later. You'll be asked to confirm before saving.
          </p>
        </div>
      )}
      <div className="py-8 text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "#EDF4FF", border: "1px solid #CFE0FF" }}>
          <Boxes className="w-5 h-5" style={{ color: "#0A77FF" }} />
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <p className="text-[13px] text-slate-700" style={{ fontWeight: 600 }}>Covers All Items</p>
          <AllItemsPill />
        </div>
        <p className="text-[11px] text-slate-400 max-w-[300px] mx-auto">
          {kind === "categories"
            ? "This rule applies to every item, so there are no categories to pick. Items in every category are covered."
            : "This rule applies to every item, now and in the future. New items are covered automatically, so there's nothing to add here."}
        </p>
      </div>
    </div>
  );
}

/** Confirmation shown on save whenever the rule's scope is All items. */
export function AllItemsConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  ruleName,
  isEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  ruleName?: string;
  isEdit?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] z-[290]" overlayClassName="z-[285]" onInteractOutside={() => onOpenChange(false)}>
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#F59E0B" }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
            <Boxes className="w-8 h-8" style={{ color: "#B45309" }} />
          </div>
          <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", letterSpacing: "0.05em" }}>All Items</span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
              Apply {ruleName?.trim() ? ruleName.trim() : "this rule"} to every item?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
            This rule will price every item, including items added later. New items are covered automatically, with no one adding them to the rule.
          </AlertDialogDescription>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <AlertDialogAction
              onClick={() => { onOpenChange(false); onConfirm(); }}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: "#F59E0B", color: "#fff" }}
            >
              {isEdit ? "Save for All Items" : "Apply to All Items"}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}>
              Go Back
            </AlertDialogCancel>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
