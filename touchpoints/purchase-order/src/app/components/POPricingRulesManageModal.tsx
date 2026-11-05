/* ═══════════════════════════════════════════════════════════════════════════
 *  POPricingRulesManageModal — Sales Orders V5 "Pricing Rules Library" port
 *  ────────────────────────────────────────────────────────────────────────
 *  Faithful port of `PricingRulesLibrary.tsx`'s modal + card structure
 *  (buyer 2026-07-22 "port same design please don't create anything on
 *   your own"). Ported 1:1 in visible structure:
 *
 *    · Hero header — vendor avatar + "Pricing Rules Applied to this
 *      Vendor" title + subtitle · count · Browse Templates + Create
 *      Rule + X close
 *    · Toolbar — search input · Filters button · Discounts / Premiums
 *      category toggle pills with counts
 *    · Quick filter pill row — All / Template / Custom / Active / Inactive
 *    · Card grid — 1/2/3 cols, fixed h-260 cards with:
 *        Row 1: Type+Basis connected pill left · Status pill + TEMPLATE
 *               /CUSTOM badge right
 *        Row 2: Rule name (13/600)
 *        Row 3: Description (2-line clamp, fixed 32px)
 *        Row 4: Hero value (big % + off/markup) left · VALID / date
 *               range right
 *        Row 5: Multi-tier selector T1..Tn (when applicable) +
 *               minQty–maxQty · discount pill
 *      Footer: itemCount · tierCount · vendorCount + kebab menu
 *
 *  Simplifications vs the SO source (4920 LOC → this file):
 *    · No detail modal / create-rule wizard / browse-templates modal —
 *      the two header CTAs and the kebab actions surface toast
 *      placeholders for now.
 *    · No pagination — the PO rule catalogue is small enough to render
 *      inline.
 *    · No confirmation modals for deactivate/remove — the kebab items
 *      fire the callback directly with a toast.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import {
  X,
  Plus,
  TrendingDown,
  TrendingUp,
  FileText,
  Search,
  SlidersHorizontal,
  MoreHorizontal,
  BadgePercent,
  Lock,
  Package,
  Layers,
  Users,
  Eye,
  Pencil,
  Copy,
  CircleSlash,
  CirclePlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import type { POLineItem } from "./poStore";
import {
  computeLineBreakdowns,
  getVendorRules,
  type VendorPricingRule,
} from "./poPricingRulesData";
import { POPricingRuleDetailModal } from "./POPricingRuleDetailModal";
import { useRuleMoney } from "./currency/useRuleMoney";
import { POBrowsePricingTemplatesModal } from "./POBrowsePricingTemplatesModal";
import { POCreatePricingRuleModal } from "./POCreatePricingRuleModal";

export interface POPricingRulesManageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  lineItems: POLineItem[];
  /** PO-wide deactivation set — ruleId → reason. `USER_UNAPPLIED` can be
   *  reactivated; `EXCEEDS_100_PERCENT` is enforced by the cap. */
  deactivatedRuleIds: Record<string, "USER_UNAPPLIED" | "EXCEEDS_100_PERCENT">;
  onToggleRule: (ruleId: string, nextActive: boolean) => void;
  onToggleRuleForLine: (ruleId: string, lineId: string, nextActive: boolean) => void;
  /** Fires whenever the shared rule catalog (`VENDOR_PRICING_RULES`)
   *  mutates while this modal is open — after Browse Templates → Apply
   *  or Create Rule → Save. Parent bumps its own rev nonce so
   *  downstream memos (pricing breakdowns, sidebar totals) re-derive
   *  (buyer 2026-07-29 bug: "Save Changes saves but doesn't update the
   *  UI"). Optional — legacy callers pre-fix don't need to wire it. */
  onCatalogChanged?: () => void;
}

/* Deterministic avatar tint from the vendor name so the header hero
   badge reads as the same "identity" across the app. */
const AVATAR_PALETTE = [
  { bg: "#DBEAFE", fg: "#1E40AF" },
  { bg: "#D1FAE5", fg: "#065F46" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#FCE7F3", fg: "#9F1239" },
  { bg: "#E0E7FF", fg: "#3730A3" },
  { bg: "#FFEDD5", fg: "#9A3412" },
];
function getAvatarTint(name: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

type CategoryView = "discount" | "premium";
type QuickFilter = "all" | "template" | "custom" | "active" | "inactive";

export function POPricingRulesManageModal({
  open,
  onOpenChange,
  vendorName,
  lineItems,
  deactivatedRuleIds,
  onToggleRule,
  onToggleRuleForLine,
  onCatalogChanged,
}: POPricingRulesManageModalProps) {
  /* Nonce bumped after Browse/Create modals mutate the shared rule
     book — declared up top so the `vendorRules` memo can key on it. */
  const [catalogRev, setCatalogRev] = useState(0);
  const vendorRules = useMemo(
    () => getVendorRules(vendorName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendorName, catalogRev],
  );

  /* Activation map — mirrors the source of truth so aggregate impacts
     update as the buyer toggles switches. Kept for wiring; the card
     itself doesn't surface impact in the SO source, so we don't render
     it here either. */
  const activation = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const rule of vendorRules) {
      if (deactivatedRuleIds[rule.id]) continue;
      const activeLines = new Set<string>();
      for (const li of lineItems) {
        if (!rule.appliesToItemCodes.includes(li.itemNumber)) continue;
        activeLines.add(li.id);
      }
      if (activeLines.size > 0) map.set(rule.id, activeLines);
    }
    return map;
  }, [vendorRules, lineItems, deactivatedRuleIds]);
  // Keep the compute wired so future card-surface additions can read impact.
  // Flat USD tier amounts convert to the PO's currency (ruleAmountFactor).
  const { factor: flatAmountFactor } = useRuleMoney();
  void useMemo(
    () =>
      computeLineBreakdowns(
        lineItems.map((li) => ({
          id: li.id,
          itemCode: li.itemNumber,
          orderedQty: li.quantity,
          unitPrice: li.unitPrice * (1 - li.discount / 100),
        })),
        vendorRules,
        activation,
        flatAmountFactor,
      ),
    [lineItems, vendorRules, activation, flatAmountFactor],
  );

  /* ── Toolbar state ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryView, setCategoryView] = useState<CategoryView>("discount");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  /* Detail modal — opens when the buyer clicks any rule card (buyer
     2026-07-22: "on clicking on the card we need to open the detail
     modal"). SO parity port lives in POPricingRuleDetailModal. */
  const [detailRule, setDetailRule] = useState<VendorPricingRule | null>(null);
  /* Header CTAs — Browse Templates + Create Rule. Both mirror the SO
     Explore Presets / Create Pricing Rule modals; wiring is 1:1 with
     the SO source. `createPrefill` carries a rule shape when the
     Duplicate action on a Browse card fires. */
  const [browseOpen, setBrowseOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{
    name: string;
    description: string;
    type: "discount" | "premium";
    tiers: VendorPricingRule["tiers"];
    appliesToItemCodes?: string[];
    validFrom?: string;
    validTo?: string | null;
  } | undefined>(undefined);
  /* Non-null when the Create wizard is running in Edit mode
     (buyer 2026-07-29 bug: "Edit says 'coming soon'"). Sourced
     from a card's kebab Edit action; cleared on close. */
  const [createEditingId, setCreateEditingId] = useState<string | null>(null);

  const categoryCounts = useMemo(() => {
    return {
      discount: vendorRules.filter((r) => r.type === "discount").length,
      premium: vendorRules.filter((r) => r.type === "premium").length,
    };
  }, [vendorRules]);

  const categoryFiltered = useMemo(() => {
    return vendorRules.filter((r) => r.type === categoryView);
  }, [vendorRules, categoryView]);

  const filterCounts = useMemo(() => {
    return {
      all: categoryFiltered.length,
      template: categoryFiltered.filter((r) => r.source === "template").length,
      custom: categoryFiltered.filter((r) => r.source === "custom").length,
      active: categoryFiltered.filter((r) => !deactivatedRuleIds[r.id]).length,
      inactive: categoryFiltered.filter((r) => !!deactivatedRuleIds[r.id]).length,
    };
  }, [categoryFiltered, deactivatedRuleIds]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categoryFiltered.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) {
        return false;
      }
      switch (quickFilter) {
        case "template":
          return r.source === "template";
        case "custom":
          return r.source === "custom";
        case "active":
          return !deactivatedRuleIds[r.id];
        case "inactive":
          return !!deactivatedRuleIds[r.id];
        default:
          return true;
      }
    });
  }, [categoryFiltered, searchQuery, quickFilter, deactivatedRuleIds]);

  const avatar = getAvatarTint(vendorName);
  const initials = getInitials(vendorName);

  const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "template", label: "Template" },
    { key: "custom", label: "Custom" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden border-0 sm:border [&>[data-slot=dialog-close]]:hidden [&>button.absolute]:hidden !max-w-[min(90vw,1120px)] !max-h-[min(90vh,calc(100dvh-2rem))] !h-[min(90vh,880px)] w-full flex flex-col"
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        <DialogTitle className="sr-only">Pricing Rules Applied to this Vendor</DialogTitle>
        <DialogDescription className="sr-only">
          Manage pricing rules attached to {vendorName}.
        </DialogDescription>

        {/* Header hero + toolbar */}
        <div className="bg-white shrink-0">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center text-[12px] shrink-0"
                style={{ backgroundColor: avatar.bg, color: avatar.fg, fontWeight: 700 }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="text-[14px] text-slate-900 truncate" style={{ fontWeight: 600 }}>
                  Pricing Rules Applied to this Vendor
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5 truncate">
                  Showing pricing rules currently applied to{" "}
                  <span className="text-slate-800" style={{ fontWeight: 500 }}>{vendorName}</span>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm tabular-nums hidden sm:inline" style={{ fontWeight: 500 }}>
                {filtered.length !== categoryFiltered.length ? (
                  <>
                    <span className="text-slate-900">{filtered.length}</span>
                    <span className="text-slate-400"> of </span>
                    <span className="text-slate-500">{categoryFiltered.length}</span>
                    <span className="text-slate-500"> rules</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-900">{categoryFiltered.length}</span>
                    <span className="text-slate-500"> rules</span>
                  </>
                )}
              </span>
              <div className="w-px h-5 bg-slate-200 hidden sm:block" />
              <button
                type="button"
                onClick={() => setBrowseOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300 text-[13px] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Browse Templates</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[13px] shadow-sm transition-colors cursor-pointer"
                style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0862D0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0A77FF")}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Create Rule</span>
              </button>
              <div className="w-px h-5 bg-slate-200 hidden sm:block ml-1" />
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Toolbar — search + filters + category toggle */}
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search pricing rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => toast.info("Advanced filters coming soon.")}
                className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors cursor-pointer shrink-0 text-slate-800"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
              </button>

              <div className="inline-flex items-center rounded-lg bg-slate-50 border border-slate-200 p-0.5 shrink-0">
                {([
                  { key: "discount" as CategoryView, label: "Discounts", icon: TrendingDown, color: "#047857", bg: "#ECFDF5" },
                  { key: "premium" as CategoryView, label: "Premiums", icon: TrendingUp, color: "#6D28D9", bg: "#F5F3FF" },
                ]).map((cat) => {
                  const active = categoryView === cat.key;
                  const count = categoryCounts[cat.key];
                  return (
                    <button
                      key={cat.key}
                      onClick={() => { setCategoryView(cat.key); setQuickFilter("all"); }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all cursor-pointer ${active ? "shadow-sm" : "hover:bg-white/60"}`}
                      style={{
                        fontWeight: active ? 600 : 500,
                        color: active ? cat.color : "#334155",
                        backgroundColor: active ? cat.bg : undefined,
                      }}
                    >
                      <cat.icon className="w-3.5 h-3.5" />
                      {cat.label}
                      <span
                        className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                        style={{
                          fontWeight: 600,
                          color: active ? cat.color : "#64748B",
                          backgroundColor: active ? `${cat.color}15` : "#E2E8F0",
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
            {QUICK_FILTERS.map((f) => {
              const active = quickFilter === f.key;
              const count = filterCounts[f.key];
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setQuickFilter(f.key)}
                  className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] transition-colors cursor-pointer border ${
                    active
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  {f.label}
                  <span
                    className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                    style={{
                      fontWeight: 600,
                      color: active ? "hsl(var(--primary))" : "#64748B",
                      backgroundColor: active ? "hsl(var(--primary) / 0.12)" : "#F1F5F9",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 shrink-0" />

        {/* Card grid */}
        <div className="p-4 min-h-0 overflow-y-auto flex-1" style={{ backgroundColor: "#FAFBFC" }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                <BadgePercent className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>
                  No {categoryView} rules found
                </p>
                <p className="text-[13px] text-slate-400 mt-1">
                  {searchQuery ? "Try a different search term." : `Create a new ${categoryView} rule or browse templates to get started.`}
                </p>
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-primary hover:underline cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((rule) => (
                <PricingRuleCard
                  key={rule.id}
                  rule={rule}
                  isActive={!deactivatedRuleIds[rule.id]}
                  partnerName={vendorName}
                  onOpen={() => setDetailRule(rule)}
                  onDeactivate={() => onToggleRule(rule.id, false)}
                  onActivate={() => onToggleRule(rule.id, true)}
                  onEdit={() => {
                    /* Kebab → Edit Rule (buyer 2026-07-29 bug fix).
                       Custom rules only; template rules gate the item
                       off. Seeds the Create wizard with the source
                       rule's shape + item codes and switches it into
                       edit mode via `editingRuleId`. */
                    setCreatePrefill({
                      name: rule.name,
                      description: rule.description,
                      type: rule.type,
                      tiers: rule.tiers,
                      appliesToItemCodes: rule.appliesToItemCodes,
                      validFrom: rule.validFrom,
                      validTo: rule.validTo,
                    });
                    setCreateEditingId(rule.id);
                    setCreateOpen(true);
                  }}
                  onDuplicate={() => {
                    /* Kebab → Duplicate as Custom (buyer 2026-07-29
                       bug fix). Opens the Create wizard with a
                       "(Copy)" name and no editingRuleId so Save
                       pushes a new custom rule. */
                    setCreatePrefill({
                      name: `${rule.name} (Copy)`,
                      description: rule.description,
                      type: rule.type,
                      tiers: rule.tiers,
                      appliesToItemCodes: rule.appliesToItemCodes,
                      validFrom: rule.validFrom,
                      validTo: rule.validTo,
                    });
                    setCreateEditingId(null);
                    setCreateOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination footer — matches SO's PricingRulesLibrary bottom
            strip. Static demo: rule catalogue is small so everything
            fits on page 1. Wired for parity with the SO chrome; real
            pagination lands with the full library port. */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 shrink-0"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <span>Records per page</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ fontWeight: 500, fontSize: 12 }}
            >
              20
              <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[12px] text-slate-400 disabled:cursor-not-allowed"
              style={{ fontWeight: 500 }}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] tabular-nums bg-primary text-white"
              style={{ fontWeight: 600 }}
            >
              1
            </span>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[12px] text-slate-400 disabled:cursor-not-allowed"
              style={{ fontWeight: 500 }}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </DialogContent>

      {/* Rule detail modal — opens on card click or "View Details"
          kebab item. Layered above the library via its own z-[12151]. */}
      <POPricingRuleDetailModal
        rule={detailRule}
        isActive={detailRule ? !deactivatedRuleIds[detailRule.id] : true}
        isOpen={detailRule !== null}
        onClose={() => setDetailRule(null)}
        onDeactivate={() => detailRule && onToggleRule(detailRule.id, false)}
        onActivate={() => detailRule && onToggleRule(detailRule.id, true)}
        lineItems={lineItems}
        activatedLineIds={
          detailRule ? activation.get(detailRule.id) ?? new Set() : undefined
        }
        onToggleRuleForLine={
          onToggleRuleForLine && detailRule
            ? (lineId, active) => onToggleRuleForLine(detailRule.id, lineId, active)
            : undefined
        }
        onEdit={
          detailRule && detailRule.source === "custom"
            ? () => {
                setCreatePrefill({
                  name: detailRule.name,
                  description: detailRule.description,
                  type: detailRule.type,
                  tiers: detailRule.tiers,
                  appliesToItemCodes: detailRule.appliesToItemCodes,
                  validFrom: detailRule.validFrom,
                  validTo: detailRule.validTo,
                });
                setCreateEditingId(detailRule.id);
                setCreateOpen(true);
              }
            : undefined
        }
      />

      {/* Browse Templates — SO Explore Presets port. Opens from the
          header "Browse Templates" CTA; on Apply, bumps catalogRev
          so vendorRules re-derives with the newly-attached template.
          Duplicate closes this modal and opens the Create Rule form
          seeded with the source rule's name/description/tiers. */}
      <POBrowsePricingTemplatesModal
        open={browseOpen}
        onOpenChange={setBrowseOpen}
        vendorName={vendorName}
        onCatalogChanged={() => {
          setCatalogRev((n) => n + 1);
          onCatalogChanged?.();
        }}
        onCreateNew={() => {
          setCreatePrefill(undefined);
          setCreateOpen(true);
        }}
        onDuplicate={(rule) => {
          setCreatePrefill({
            name: `${rule.name} (Copy)`,
            description: rule.description,
            type: rule.type,
            tiers: rule.tiers,
            validFrom: rule.validFrom,
            validTo: rule.validTo,
          });
          setCreateOpen(true);
        }}
      />

      {/* Create Rule — SO CreatePricingRuleModal port. On save, the
          new custom rule is pushed into VENDOR_PRICING_RULES with the
          current vendor already attached; bumping catalogRev pulls
          it into the manage modal's applied list. */}
      <POCreatePricingRuleModal
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) {
            setCreatePrefill(undefined);
            setCreateEditingId(null);
          }
        }}
        vendorName={vendorName}
        prefill={createPrefill}
        editingRuleId={createEditingId ?? undefined}
        onCreated={() => {
          setCatalogRev((n) => n + 1);
          onCatalogChanged?.();
        }}
      />
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  PricingRuleCard — 1:1 port of the SO source's card structure.
 *  Fixed h-260 · Row 1 type+basis pill + status + TEMPLATE/CUSTOM ·
 *  Row 2 name · Row 3 description (2-line clamp, fixed 32px) · Row 4
 *  hero value + VALID/date · Row 5 multi-tier selector + tier band.
 *  Footer: itemCount · tierCount · vendorCount + kebab menu.
 * ═══════════════════════════════════════════════════════════════════════════ */

function PricingRuleCard({
  rule,
  isActive,
  partnerName,
  onOpen,
  onDeactivate,
  onActivate,
  onEdit,
  onDuplicate,
}: {
  rule: VendorPricingRule;
  isActive: boolean;
  partnerName: string;
  /** Card click — opens the SO-parity detail modal. */
  onOpen: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
  /** Kebab → Edit Rule. Custom rules only; the UI gates the item off
   *  for template rules (buyer 2026-07-29 bug: "Edit says 'coming
   *  soon'"). */
  onEdit: () => void;
  /** Kebab → Duplicate as Custom. Available on both template and
   *  custom rules. */
  onDuplicate: () => void;
}) {
  const isDis = rule.type === "discount";
  const isMulti = rule.tiers.length > 1;
  const isPreset = rule.source === "template";
  const [activeTier, setActiveTier] = useState(0);
  const shownTier = rule.tiers[isMulti ? activeTier : 0];
  const t0 = rule.tiers[0];
  const { tierRate, tierShort, tierConverted } = useRuleMoney();

  const pill = isDis
    ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
    : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };

  const statusPill = {
    color: isActive ? "#065F46" : "#92400E",
    bg: isActive ? "#ECFDF5" : "#FFFBEB",
    border: isActive ? "#A7F3D0" : "#FDE68A",
  };

  /* Flat ("$") tiers are USD per unit: "$15 off per unit", and the tier
     row adds what that is in the PO's currency. */
  const heroValue = t0 ? tierShort(t0) : "—";
  const heroPerUnit = !!t0 && t0.unit !== "%";
  const shownConverted = shownTier ? tierConverted(shownTier) : null;
  const shownMinQty = shownTier ? shownTier.minQty : "—";
  const shownMaxQty = shownTier
    ? shownTier.maxQty === null
      ? "∞"
      : shownTier.maxQty
    : "—";

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="bg-white border border-slate-200 rounded-xl group flex flex-col relative outline-none focus:outline-none focus-visible:outline-none cursor-pointer hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all"
      style={{ height: 260 }}
    >
      <div className="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Row 1: Type+Basis pill left · Status + TEMPLATE/CUSTOM right */}
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <span
            className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0"
            style={{ borderColor: pill.border }}
          >
            <span
              className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
              style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}
            >
              {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {isDis ? "Discount" : "Premium"}
            </span>
            <span
              className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l"
              style={{ fontWeight: 500, borderColor: pill.border }}
            >
              Volume
            </span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="inline-flex items-center px-2 py-[3px] rounded-full text-[10px] border whitespace-nowrap"
              style={{
                fontWeight: 600,
                color: statusPill.color,
                backgroundColor: statusPill.bg,
                borderColor: statusPill.border,
              }}
            >
              {isActive ? "Active" : "Deactivated"}
            </span>
            {isPreset ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-slate-100 border border-slate-300 text-[9px] text-slate-500"
                    style={{ fontWeight: 600 }}
                  >
                    <Lock className="w-2.5 h-2.5" /> TEMPLATE
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={6}
                  className="z-[12300] !bg-white !text-slate-700 !border !border-slate-200 !shadow-sm rounded-lg text-[11px] px-2.5 py-1.5 max-w-[220px]"
                  style={{ fontWeight: 500 }}
                >
                  System preset — tiers &amp; config are locked. You can assign items and vendors.
                </TooltipContent>
              </Tooltip>
            ) : (
              <span
                className="inline-flex items-center px-1.5 py-[3px] rounded-md border border-slate-300 bg-white text-[9px] text-slate-500"
                style={{ fontWeight: 600 }}
              >
                CUSTOM
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>
            {rule.name}
          </p>
        </div>

        {/* Row 3: Description (2-line clamp, fixed 32px) */}
        <div className="h-[32px] shrink-0 mb-2">
          <p
            className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed"
            style={{ fontWeight: 400 }}
          >
            {rule.description}
          </p>
        </div>

        {/* Row 4: Hero value left · Valid date range right */}
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="text-[22px] text-slate-700 tabular-nums leading-none tracking-tight"
              style={{ fontWeight: 600 }}
            >
              {heroValue}
            </span>
            <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
              {/* 2026-07-29: premium hero suffix reads "premium" (Eli
                  sign-off) so the amount reads e.g. "12% premium" — not
                  "12% off" and not "markup". Discount stays "off". */}
              {isDis ? "off" : "premium"}
              {heroPerUnit ? " per unit" : ""}
            </span>
          </div>
          {rule.validTo ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-end shrink-0 leading-tight cursor-default">
                  <span
                    className="text-[9px] uppercase tracking-wide text-slate-400"
                    style={{ fontWeight: 600 }}
                  >
                    Valid
                  </span>
                  <span
                    className="text-[11px] text-slate-700 tabular-nums"
                    style={{ fontWeight: 500 }}
                  >
                    {rule.validFrom} – {rule.validTo}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={6}
                className="z-[12300] !bg-white !text-slate-700 !border !border-slate-200 !shadow-sm rounded-lg text-[11px] px-2.5 py-1.5"
                style={{ fontWeight: 500 }}
              >
                Valid {rule.validFrom} → {rule.validTo}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex flex-col items-end shrink-0 leading-tight">
              <span
                className="text-[9px] uppercase tracking-wide text-slate-400"
                style={{ fontWeight: 600 }}
              >
                Valid
              </span>
              <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Always active
              </span>
            </div>
          )}
        </div>

        {/* Row 5: Tier display */}
        <div className="mt-auto pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Multi-tier selector strip */}
          <div className={`h-[24px] mb-1.5 ${isMulti ? "flex items-center gap-[3px]" : ""}`}>
            {isMulti && rule.tiers.map((tier, i) => {
              const activeTierBtn = activeTier === i;
              return (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setActiveTier(i); }}
                  className={`h-[22px] rounded-md text-[10px] tabular-nums transition-all duration-200 cursor-pointer flex items-center justify-center px-2 ${
                    activeTierBtn ? "shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                  style={{
                    fontWeight: activeTierBtn ? 600 : 500,
                    ...(activeTierBtn
                      ? {
                          backgroundColor: `${pill.text}18`,
                          color: pill.text,
                          boxShadow: `0 0 0 1px ${pill.text}40`,
                        }
                      : {}),
                  }}
                >
                  T{i + 1}
                  {activeTierBtn && (
                    <span className="ml-1 text-[9px] opacity-60" style={{ fontWeight: 400 }}>
                      {tierShort(tier)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Tier detail row */}
          <div
            className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-slate-200 text-[11px] tabular-nums min-w-0"
            style={{ backgroundColor: "#FAFBFC" }}
          >
            <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
              <span style={{ fontWeight: 400 }}>{shownMinQty}</span>
              <span className="text-slate-300">–</span>
              <span style={{ fontWeight: 400 }}>{shownMaxQty}</span>
            </div>
            <span className="shrink-0 ml-2 text-slate-700" style={{ fontWeight: 600 }}>
              {shownTier ? tierRate(shownTier) : "—"}
              {shownConverted && (
                <span className="text-slate-400" style={{ fontWeight: 500 }}> ({shownConverted})</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Footer strip — item · tier · vendor counts + kebab */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-slate-100 shrink-0">
        <span
          className="inline-flex items-center gap-1 text-[10px] text-slate-400"
          style={{ fontWeight: 500 }}
        >
          <Package className="w-3 h-3" /> {rule.appliesToItemCodes.length}
        </span>
        <span className="w-px h-3 bg-slate-200" />
        <span
          className="inline-flex items-center gap-1 text-[10px] text-slate-400"
          style={{ fontWeight: 500 }}
        >
          <Layers className="w-3 h-3" /> {rule.tiers.length}
        </span>
        <span className="w-px h-3 bg-slate-200" />
        <span
          className="inline-flex items-center gap-1 text-[10px] text-slate-400"
          style={{ fontWeight: 500 }}
        >
          <Users className="w-3 h-3" /> {rule.vendors.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="ml-auto w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
              title="Rule actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[220px] p-1 z-[12200]"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              className="gap-2 py-1.5 cursor-pointer text-[13px]"
              onSelect={onOpen}
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" /> View Details
            </DropdownMenuItem>
            {!isPreset && (
              <DropdownMenuItem
                className="gap-2 py-1.5 cursor-pointer text-[13px]"
                onSelect={onEdit}
              >
                <Pencil className="w-3.5 h-3.5 text-slate-500" /> Edit Rule
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="gap-2 py-1.5 cursor-pointer text-[13px]"
              onSelect={onDuplicate}
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" /> Duplicate as Custom
            </DropdownMenuItem>
            {isActive ? (
              <DropdownMenuItem
                className="gap-2 py-1.5 cursor-pointer text-[13px] text-amber-700 focus:text-amber-700 focus:bg-amber-50"
                onSelect={() => {
                  onDeactivate();
                  toast.success(`${rule.name} deactivated.`);
                }}
              >
                <CircleSlash className="w-3.5 h-3.5 text-amber-600" /> Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="gap-2 py-1.5 cursor-pointer text-[13px]"
                onSelect={() => {
                  onActivate();
                  toast.success(`${rule.name} reactivated.`);
                }}
              >
                <CirclePlus className="w-3.5 h-3.5 text-primary" /> Reactivate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 py-1.5 cursor-pointer text-[13px] text-destructive focus:text-destructive focus:bg-red-50"
              onSelect={() => toast.info(`Remove from ${partnerName} coming soon.`)}
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" /> Remove from this Vendor
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
