/**
 * Shared pricing-rules catalog + UI primitives for the Purchasing subsystem.
 * Extracted from AddQualifiedVendorModal so the same data, picker modal,
 * and rule card can be reused inside the Partner Detail (VendorDetailModal)
 * "Applied Pricing Rules" block.
 *
 * Source of truth — byte-for-byte port of the Qualified Vendors reference
 * project (`pricing-rules-manager.tsx`).
 */
import React, { useMemo, useState } from "react";
import { Search, X, Check } from "lucide-react";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface PricingRuleOption {
  id: string;
  type: "discount" | "premium";
  name: string;
  description: string;
  discountLabel: string;
  discountValue: string;
  minValue: string;
  maxValue: string;
}

export const PRICING_RULES: PricingRuleOption[] = [
  { id: "pr-1", type: "discount", name: "Standard Discount", description: "10% off on orders over $1,000", discountLabel: "Discount", discountValue: "10%", minValue: "$1,000", maxValue: "$32,000" },
  { id: "pr-2", type: "discount", name: "Standard Discount", description: "15% off on orders of 100+ units", discountLabel: "Discount", discountValue: "10%", minValue: "100 EA", maxValue: "300 EA" },
  { id: "pr-3", type: "discount", name: "Tiered Discount", description: "5% off over $500, 10% over $1,000", discountLabel: "Discount", discountValue: "5%", minValue: "$500", maxValue: "$2,300" },
  { id: "pr-4", type: "discount", name: "Tiered Discount", description: "5% off over 50 units, 10% over 100", discountLabel: "Discount", discountValue: "10%", minValue: "35 EA", maxValue: "500 EA" },
  { id: "pr-5", type: "premium", name: "Standard Premium", description: "Add 10% surcharge on orders under $200", discountLabel: "Discount", discountValue: "30%", minValue: "$200", maxValue: "$12,000" },
  { id: "pr-6", type: "premium", name: "Standard Premium", description: "Add $50 for orders under 10 units", discountLabel: "Discount", discountValue: "16%", minValue: "10 EA", maxValue: "400 EA" },
  { id: "pr-7", type: "premium", name: "Tiered Premium", description: "5% surcharge under $500, 10% under $200", discountLabel: "Discount", discountValue: "—", minValue: "—", maxValue: "—" },
  { id: "pr-8", type: "premium", name: "Tiered Premium", description: "Add $25 for <50 units, $50 for <25 units", discountLabel: "Discount", discountValue: "—", minValue: "—", maxValue: "—" },
];

export const RULE_FILTERS = [
  { value: "all", label: "All rules" },
  { value: "discount", label: "Discounts" },
  { value: "premium", label: "Premium" },
] as const;
export type RuleFilter = (typeof RULE_FILTERS)[number]["value"];

/* ====================================================================
   RuleCard — shared card for both the picker (selectable) and the
   "Applied Pricing Rules" grid (with hover-reveal remove). Layout
   mirrors the reference `pricing-rules-manager.tsx` cards.
   ==================================================================== */
export interface RuleCardProps {
  rule: PricingRuleOption;
  /** Picker mode — renders a checkbox in the top-right and toggles on click. */
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  /** Applied-list mode — renders a hover-reveal ✕ in the top-right. */
  onRemove?: () => void;
}

export function RuleCard({ rule, selectable, selected, onClick, onRemove }: RuleCardProps) {
  const isDiscount = rule.type === "discount";
  const accentClass = isDiscount ? "text-emerald-600" : "text-amber-600";
  const dotClass = isDiscount ? "bg-emerald-500" : "bg-amber-500";

  const Wrapper: React.ElementType = selectable ? "button" : "div";
  const wrapperProps = selectable ? { type: "button" as const, onClick } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "relative flex flex-col text-left p-3 rounded-lg border bg-card transition-colors",
        selectable && "cursor-pointer hover:border-primary/40",
        selectable && selected
          ? "border-primary border-2 bg-[#EDF4FF]"
          : "border-border",
        !selectable && "group",
      )}
    >
      {selectable && (
        <span
          className={cn(
            "absolute top-2 right-2 w-4 h-4 rounded-sm border flex items-center justify-center",
            selected
              ? "bg-primary border-primary text-primary-foreground"
              : "border-border bg-white",
          )}
        >
          {selected && <Check className="w-3 h-3" />}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full border border-border bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove rule"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}

      <div className="flex items-center gap-1.5 mb-2 pr-6">
        <span className={cn("w-2 h-2 rounded-full shrink-0", dotClass)} />
        <span className={cn("text-[11px] font-medium capitalize", accentClass)}>
          {rule.type}
        </span>
      </div>

      <div className="mb-2 pr-6">
        <p className="text-sm font-semibold text-foreground truncate">
          {rule.name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {rule.description}
        </p>
      </div>

      <div className="border-t border-border pt-2 mt-auto space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {rule.discountLabel}
          </span>
          <span className={cn("text-xs font-semibold", accentClass)}>
            {rule.discountValue}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Range</span>
          <span className="text-[11px] font-medium text-foreground/70">
            {rule.minValue} – {rule.maxValue}
          </span>
        </div>
      </div>
    </Wrapper>
  );
}

/* ====================================================================
   PricingRulesPicker — stacked second-layer modal. Mounts on top of any
   parent dialog (overlay z-[60]), so closing it only dismisses this layer
   while the parent keeps its state.
   ==================================================================== */
export interface PricingRulesPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelected: string[];
  onApply: (ids: string[]) => void;
}

export function PricingRulesPicker({
  open,
  onOpenChange,
  initialSelected,
  onApply,
}: PricingRulesPickerProps) {
  const [filter, setFilter] = useState<RuleFilter>("all");
  const [draft, setDraft] = useState<string[]>(initialSelected);
  const [search, setSearch] = useState("");

  React.useEffect(() => {
    if (open) {
      setDraft(initialSelected);
      setFilter("all");
      setSearch("");
    }
  }, [open, initialSelected]);

  const visibleRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PRICING_RULES.filter((r) => filter === "all" || r.type === filter).filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [filter, search]);

  const toggle = (id: string) =>
    setDraft((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[60] bg-black/60" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[60] translate-x-[-50%] translate-y-[-50%]",
            "w-full max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[75vh]",
            "bg-white border shadow-lg sm:rounded-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold text-foreground">
                  Select Pricing Rules
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Choose one or more pricing rules to apply to this vendor.
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="shrink-0 -mt-1 -mr-1 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-6 pt-4 pb-3 shrink-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                placeholder="Search pricing rules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-white border-border/80 focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {RULE_FILTERS.map((f) => {
                const active = filter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      "px-3 py-1 rounded-full border text-xs transition-colors cursor-pointer",
                      active
                        ? "border-primary bg-[#EDF4FF] text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                    style={{ fontWeight: active ? 600 : 500 }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-y-auto px-6 pb-4 max-h-[420px]">
            {visibleRules.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No rules found
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visibleRules.map((rule) => {
                  const isSelected = draft.includes(rule.id);
                  return (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      selectable
                      selected={isSelected}
                      onClick={() => toggle(rule.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {draft.length} {draft.length === 1 ? "rule" : "rules"} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-9"
              >
                Cancel
              </Button>
              <Button onClick={() => onApply(draft)} className="h-9">
                Apply Rules
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}