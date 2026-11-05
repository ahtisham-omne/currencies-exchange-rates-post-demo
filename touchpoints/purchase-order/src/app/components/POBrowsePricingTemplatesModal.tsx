/* ═══════════════════════════════════════════════════════════════════════════
 *  POBrowsePricingTemplatesModal — Sales Orders V5 "Explore Presets" port
 *  ──────────────────────────────────────────────────────────────────────
 *  Opens when the buyer clicks "Browse Templates" in the Pricing Rules
 *  Applied to this Vendor modal. Design mirrors SO's Explore Presets:
 *
 *    · Header — Pricing Rule Presets title · subtitle · Full view + X
 *    · Sticky toolbar — search · Discounts/Premiums type toggle (with
 *      counts) · flex spacer · count badge · Sort popover · Create New
 *    · Filter Pills — All / Template / Custom / In Use
 *    · Kickstart banner — "Templates are a kickstart..."
 *    · Card grid — same 3-col @container grid as SO, cards feature the
 *      Discount/Premium+Basis connected pill, name, description clamp,
 *      hero % + VALID range, footer counts, and an Apply / Duplicate
 *      button pair.
 *
 *  Data source is the full VENDOR_PRICING_RULES catalogue (templates
 *  from every vendor + this vendor's customs). Applying a template
 *  calls attachRuleToVendor so the current vendor becomes eligible for
 *  the rule on subsequent renders; the caller re-reads the applied
 *  set from poPricingRulesData after the modal closes.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  Plus,
  TrendingDown,
  TrendingUp,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  Lock,
  Check,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "./ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Input } from "./ui/input";
import { FilterPills } from "./FilterPills";
import {
  VENDOR_PRICING_RULES,
  attachRuleToVendor,
  type VendorPricingRule,
} from "./poPricingRulesData";
import { useRuleMoney } from "./currency/useRuleMoney";

export interface POBrowsePricingTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  /** Called after Apply/Duplicate mutates the shared rule book so the
   *  parent manage modal can re-derive its applied set. */
  onCatalogChanged?: () => void;
  /** Called when the buyer clicks Create New in the toolbar — the
   *  parent closes this modal and opens POCreatePricingRuleModal. */
  onCreateNew?: () => void;
  /** Called when the buyer clicks Duplicate on any card. Parent should
   *  close this modal and open POCreatePricingRuleModal seeded with the
   *  rule's name (+ " Copy"), description, type, and tiers. */
  onDuplicate?: (rule: VendorPricingRule) => void;
}

type CategoryTab = "discount" | "premium";
type SourceFilter = "all" | "template" | "custom" | "in_use";
type SortKey = "name" | "vendorsApplied" | "category" | "basis";
type SortDir = "asc" | "desc";

export function POBrowsePricingTemplatesModal({
  open,
  onOpenChange,
  vendorName,
  onCatalogChanged,
  onCreateNew,
  onDuplicate,
}: POBrowsePricingTemplatesModalProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("discount");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  /* Bump a nonce after each Apply so the memo below re-reads the shared
     rule book without needing external state coordination. */
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSourceFilter("all");
      setCategoryTab("discount");
      setFullscreen(false);
    }
  }, [open]);

  const cards = useMemo(() => {
    void rev;
    return VENDOR_PRICING_RULES.map((r) => ({
      ...r,
      isAppliedToCurrentVendor: r.vendors.includes(vendorName),
      vendorCount: r.vendors.length,
      itemCount: r.appliesToItemCodes.length,
      tierCount: r.tiers.length,
    }));
  }, [vendorName, rev]);

  const categoryCounts = useMemo(
    () => ({
      discount: cards.filter((c) => c.type === "discount").length,
      premium: cards.filter((c) => c.type === "premium").length,
    }),
    [cards],
  );

  const filtered = useMemo(() => {
    let list = cards.filter((c) => c.type === categoryTab);
    if (sourceFilter === "template") list = list.filter((c) => c.source === "template");
    else if (sourceFilter === "custom") list = list.filter((c) => c.source === "custom");
    else if (sourceFilter === "in_use") list = list.filter((c) => c.vendorCount >= 2);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.vendors.some((v) => v.toLowerCase().includes(q)),
      );
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "vendorsApplied") cmp = a.vendorCount - b.vendorCount;
      else if (sortBy === "category") cmp = a.type.localeCompare(b.type);
      else if (sortBy === "basis") cmp = (a.tiers[0]?.unit ?? "").localeCompare(b.tiers[0]?.unit ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [cards, categoryTab, sourceFilter, search, sortBy, sortDir]);

  const filterOptions = useMemo(() => {
    const base = cards.filter((c) => c.type === categoryTab);
    return [
      { key: "all", label: "All", count: base.length, showCount: true },
      { key: "template", label: "Template", count: base.filter((c) => c.source === "template").length, showCount: true },
      { key: "custom", label: "Custom", count: base.filter((c) => c.source === "custom").length, showCount: true },
      { key: "in_use", label: "In Use", count: base.filter((c) => c.vendorCount >= 2).length, showCount: true },
    ];
  }, [cards, categoryTab]);

  function handleApply(rule: VendorPricingRule) {
    const changed = attachRuleToVendor(rule.id, vendorName);
    if (changed) {
      toast.success(`"${rule.name}" applied to ${vendorName}.`);
    } else {
      toast.info(`"${rule.name}" is already applied to ${vendorName}.`);
    }
    setRev((n) => n + 1);
    onCatalogChanged?.();
    /* Do not auto-close (buyer 2026-07-29 bug fix: "Browse Template
       applies the first premium but not the second"). Prior behavior
       closed the modal after each Apply, so the buyer had to reopen
       Browse and re-navigate to apply a second template. Now the
       modal stays open and Apply buttons disable in place for
       already-attached rules. */
  }

  const SORT_LABELS: Record<SortKey, string> = {
    name: "Name",
    vendorsApplied: "In Use",
    category: "Type",
    basis: "Basis",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden border-0 flex flex-col [&>[data-slot=dialog-close]]:hidden [&>button.absolute]:hidden"
        style={
          fullscreen
            ? {
                width: "calc(100% - 1rem)",
                height: "calc(100dvh - 1rem)",
                maxWidth: "calc(100% - 1rem)",
                maxHeight: "calc(100dvh - 1rem)",
                borderRadius: 16,
                boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18)",
              }
            : {
                width: "min(78vw, 1120px)",
                maxWidth: "calc(100% - 2rem)",
                height: "min(88vh, 880px)",
                maxHeight: "calc(100vh - 2rem)",
                minHeight: 640,
                borderRadius: 16,
                boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18)",
              }
        }
      >
        <DialogTitle className="sr-only">Pricing Rule Presets</DialogTitle>
        <DialogDescription className="sr-only">
          Browse and apply pricing rules to {vendorName}.
        </DialogDescription>

        {/* Header — 48px strip, same as SO Explore Presets */}
        <div className="flex items-center justify-between px-6 h-12 border-b border-[#EEF2F6] bg-white shrink-0">
          <div>
            <h3 className="text-[13px] text-slate-900" style={{ fontWeight: 600 }}>
              Pricing Rule Presets
            </h3>
            <p className="text-[11px] text-slate-500" style={{ fontWeight: 400 }}>
              Browse and apply pricing rules to {vendorName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFullscreen((f) => !f)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all"
              style={{ fontWeight: 500 }}
            >
              {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {fullscreen ? "Exit full" : "Full view"}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
          {/* Sticky toolbar */}
          <div className="shrink-0 bg-white border-b border-[#EEF2F6] px-5 pt-4 pb-3 space-y-3">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pricing rules..."
                  className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Type toggle */}
              <div className="inline-flex items-center rounded-lg bg-slate-50 border border-slate-200 p-0.5 shrink-0">
                {([
                  { key: "discount", label: "Discounts", color: "#047857", bg: "#ECFDF5", Icon: TrendingDown },
                  { key: "premium", label: "Premiums", color: "#6D28D9", bg: "#F5F3FF", Icon: TrendingUp },
                ] as const).map((cat) => {
                  const active = categoryTab === cat.key;
                  const count = categoryCounts[cat.key];
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setCategoryTab(cat.key)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all cursor-pointer ${
                        active ? "shadow-sm" : "hover:bg-white/60"
                      }`}
                      style={{
                        fontWeight: active ? 600 : 500,
                        color: active ? cat.color : "#334155",
                        backgroundColor: active ? cat.bg : undefined,
                      }}
                    >
                      <cat.Icon className="w-3.5 h-3.5" />
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

              <div className="flex-1" />

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md bg-blue-50 text-[11px] text-slate-500"
                  style={{ fontWeight: 600 }}
                >
                  {filtered.length}
                </span>
                <Popover open={sortOpen} onOpenChange={setSortOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${
                        sortOpen
                          ? "text-primary bg-blue-50 border-blue-100"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent hover:border-slate-200"
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      {SORT_LABELS[sortBy]}
                      {sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[200px] p-1.5 rounded-lg" sideOffset={6}>
                    <div className="space-y-0.5">
                      {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => {
                        const isActive = sortBy === key;
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              if (isActive) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                              else {
                                setSortBy(key);
                                setSortDir("asc");
                              }
                              setSortOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] transition-all ${
                              isActive ? "bg-blue-50 text-primary" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                            }`}
                            style={{ fontWeight: isActive ? 600 : 500 }}
                          >
                            <span className="flex-1 text-left">{SORT_LABELS[key]}</span>
                            {isActive &&
                              (sortDir === "asc" ? (
                                <ArrowUp className="w-3 h-3 text-primary" />
                              ) : (
                                <ArrowDown className="w-3 h-3 text-primary" />
                              ))}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    onCreateNew?.();
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] shadow-sm transition-colors cursor-pointer"
                  style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0862D0")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0A77FF")}
                >
                  <Plus className="w-3.5 h-3.5" /> Create New
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center overflow-x-auto">
              <FilterPills
                options={filterOptions}
                activeKey={sourceFilter}
                onSelect={(k) => setSourceFilter(k as SourceFilter)}
              />
            </div>
          </div>

          {/* Cards area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            {/* Kickstart banner */}
            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 flex items-start gap-2.5">
              <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                <span className="text-slate-900" style={{ fontWeight: 600 }}>
                  Templates are a kickstart.
                </span>{" "}
                Use them as-is or as a baseline — you can always tailor a rule to this vendor from{" "}
                <span style={{ fontWeight: 600 }}>Create New</span> above.
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-[13px] text-slate-500" style={{ fontWeight: 600 }}>
                  No pricing rules found
                </p>
                <p className="text-[12px] text-slate-400 mt-1">Try adjusting your search or filter</p>
              </div>
            ) : (
              <div className="@container/prgrid">
                <div className="grid grid-cols-1 @[400px]/prgrid:grid-cols-2 @[750px]/prgrid:grid-cols-3 auto-rows-fr gap-4">
                  {filtered.map((card) => (
                    <BrowseTemplateCard
                      key={card.id}
                      rule={card}
                      isAppliedToVendor={card.isAppliedToCurrentVendor}
                      onApply={() => handleApply(card)}
                      onDuplicate={() => {
                        onOpenChange(false);
                        onDuplicate?.(card);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Card ──────────────────────────────────────────────────────────────
 *  Browse-variant card — 1:1 port of the SO PricingRuleCard's
 *  `variant="browse"` shape:
 *
 *    Row 1: Type+Basis connected pill · APPLIED chip · TEMPLATE/CUSTOM
 *    Row 2: Rule name (truncate, 13/600)
 *    Row 3: Description (2-line clamp, fixed 32px)
 *    Row 4: Hero rate + off/markup · VALID / date range
 *    Row 5 (pushed to bottom via mt-auto):
 *      · Multi-tier selector strip (T1..Tn, active tier tinted)
 *      · Tier detail row — minQty–maxQty | rate
 *    Footer: 2-col grid — [Apply] | [Duplicate]
 *
 *  When the rule is already on the current vendor, the Apply button is
 *  muted+disabled and gets an "Applied" label; Duplicate stays live.
 * ──────────────────────────────────────────────────────────────────── */
function BrowseTemplateCard({
  rule,
  isAppliedToVendor,
  onApply,
  onDuplicate,
}: {
  rule: VendorPricingRule & { vendorCount: number; itemCount: number; tierCount: number };
  isAppliedToVendor: boolean;
  onApply: () => void;
  onDuplicate: () => void;
}) {
  const isDis = rule.type === "discount";
  const isPreset = rule.source === "template";
  const isMulti = rule.tiers.length > 1;
  const t0 = rule.tiers[0];
  const [activeTier, setActiveTier] = useState(0);
  const shownTier = rule.tiers[isMulti ? activeTier : 0];
  /* Flat ("$") tiers are USD per unit: "$15 off per unit", and the tier
     row adds what that is in the PO's currency. */
  const { tierRate, tierShort, tierConverted } = useRuleMoney();
  const heroRate = t0 ? tierShort(t0) : "—";
  const heroPerUnit = !!t0 && t0.unit !== "%";
  const shownRate = shownTier ? tierShort(shownTier) : "—";
  const shownConverted = shownTier ? tierConverted(shownTier) : null;

  const pill = isDis
    ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
    : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl group flex flex-col relative h-[260px] outline-none focus:outline-none focus-visible:outline-none"
      style={{ transition: "border-color 150ms ease" }}
    >
      <div className="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Row 1: Type+Basis pill · APPLIED chip · TEMPLATE/CUSTOM */}
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
              {t0?.unit === "%" ? "Volume" : "Value"}
            </span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {isAppliedToVendor && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px]"
                style={{
                  fontWeight: 600,
                  color: "#065F46",
                  backgroundColor: "#ECFDF5",
                  borderColor: "#A7F3D0",
                }}
              >
                <Check className="w-2.5 h-2.5" /> APPLIED
              </span>
            )}
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
                  className="!bg-white !text-slate-700 !border !border-slate-200 !shadow-sm rounded-lg text-[11px] px-2.5 py-1.5 max-w-[220px]"
                  style={{ fontWeight: 500 }}
                >
                  System preset — tiers and rates are locked. You can attach it to this vendor.
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

        {/* Row 3: Description (2-line clamp) */}
        <div className="h-[32px] shrink-0 mb-2">
          <p
            className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed"
            style={{ fontWeight: 400 }}
          >
            {rule.description}
          </p>
        </div>

        {/* Row 4: Hero rate · VALID / date range */}
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="text-[22px] text-slate-700 tabular-nums leading-none tracking-tight"
              style={{ fontWeight: 600 }}
            >
              {heroRate}
            </span>
            <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
              {/* 2026-07-29: premium hero suffix reads "premium" (Eli
                  sign-off), never "markup" or "off". */}
              {isDis ? "off" : "premium"}
              {heroPerUnit ? " per unit" : ""}
            </span>
          </div>
          <div className="flex flex-col items-end shrink-0 leading-tight">
            <span
              className="text-[9px] uppercase tracking-wide text-slate-400"
              style={{ fontWeight: 600 }}
            >
              Valid
            </span>
            <span className="text-[11px] text-slate-700 tabular-nums" style={{ fontWeight: 500 }}>
              {rule.validTo ? `${rule.validFrom} – ${rule.validTo}` : "Always active"}
            </span>
          </div>
        </div>

        {/* Row 5: Multi-tier selector strip + tier detail row —
            fixed-height region pushed to the bottom of the body. */}
        <div className="mt-auto pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className={`h-[24px] mb-1.5 ${isMulti ? "flex items-center gap-[3px]" : ""}`}>
            {isMulti &&
              rule.tiers.map((_, i) => {
                const isActive = activeTier === i;
                return (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTier(i);
                    }}
                    className={`h-[22px] rounded-md text-[10px] tabular-nums transition-all duration-200 cursor-pointer flex items-center justify-center px-2 ${
                      isActive ? "shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                    style={{
                      fontWeight: isActive ? 600 : 500,
                      ...(isActive
                        ? {
                            backgroundColor: `${pill.text}18`,
                            color: pill.text,
                            boxShadow: `0 0 0 1px ${pill.text}40`,
                          }
                        : {}),
                    }}
                  >
                    T{i + 1}
                    {isActive && (
                      <span
                        className="ml-1 text-[9px] opacity-60"
                        style={{ fontWeight: 400 }}
                      >
                        {shownRate}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
            <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
              <span style={{ fontWeight: 400 }}>{shownTier?.minQty ?? "—"}</span>
              <span className="text-slate-300">–</span>
              <span style={{ fontWeight: 400 }}>
                {shownTier ? (shownTier.maxQty === null ? "∞" : shownTier.maxQty) : "—"}
              </span>
            </div>
            <span
              className="shrink-0 ml-2 text-slate-700"
              style={{ fontWeight: 600 }}
            >
              {shownTier ? tierRate(shownTier) : "—"}
              {shownConverted && (
                <span className="text-slate-400" style={{ fontWeight: 500 }}> ({shownConverted})</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Footer — 2-col split · Apply | Duplicate (SO parity).
          When the rule is already on the current vendor, Apply is
          muted+disabled and reads "Applied"; Duplicate stays live so
          the buyer can still fork a tunable copy. */}
      <div className="grid grid-cols-2 border-t border-slate-100 shrink-0">
        {isAppliedToVendor ? (
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] text-slate-400 border-r border-slate-100 cursor-not-allowed bg-slate-50"
            style={{ fontWeight: 500 }}
          >
            <Check className="w-3.5 h-3.5" /> Applied
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onApply();
            }}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors border-r border-slate-100 cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Check className="w-3.5 h-3.5" /> Apply
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="inline-flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <Copy className="w-3.5 h-3.5" /> Duplicate
        </button>
      </div>
    </div>
  );
}
