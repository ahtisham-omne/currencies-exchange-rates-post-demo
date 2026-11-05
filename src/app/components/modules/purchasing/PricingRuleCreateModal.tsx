// @ts-nocheck
/**
 * PricingRuleCreateModal — a STANDALONE "Create/Edit Pricing Rule" wizard,
 * byte-faithful to the Partner app's embedded create-only path of
 * `PricingRulesTabNew` (Partner-Management---Vendor `PricingRulesTab.tsx`).
 *
 * Transcribed verbatim from the reference (Tailwind classes, inline styles,
 * gradients, copy):
 *   • Create state + helpers (createName/Description/Category/Basis/Step/IsEdit,
 *     createItemsTab, createSelectedItems, createItemsSearch, createTiers,
 *     CreateTierState, makeTier/updateTier/addTier/removeTier, resetCreateForm,
 *     handleSaveRule).
 *   • Dialog + header + 2-step stepper.
 *   • Step 1: template suggestion row, Pricing Rule Type cards, name + basis
 *     toggle, description, validity period, tiers editor.
 *   • Step 2: summary banner + Items / Categories / Attachments tabs. The Items
 *     tab is wired to PricingRuleItemPicker; Categories/Attachments are EXACT
 *     stubs from the reference.
 *   • Footer (step-aware): Cancel + Continue on step 1; Back + Discard + Save on
 *     step 2.
 *   • Browse Templates ("Explore Presets") library dialog: header strip, search,
 *     type toggle, FilterPills row, sortable card grid, "Create New", and the
 *     "apply template → clone into the create form" behavior. Data is bound to
 *     pricingRuleConstants `PRICING_RULE_PRESETS`. FilterPills, PctAmountToggle,
 *     InfoTooltip, and the browse PricingRuleCard are inlined as faithful
 *     lightweight equivalents rather than importing partner-app files.
 *
 * Adaptations only: import paths → our primitives; data → our items via the
 * PricingRuleItemPicker; the user-facing word "partner" → "vendor"; the
 * specific name comes from the `scopeName` prop.
 *
 * z-index: the create DialogContent is z-[280] (above the parent
 * Add-Qualified-Vendor modal whose popovers are z-[260]); the Browse Templates
 * dialog is z-[290]; the item picker (PricingRuleItemPicker) is z-[300].
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  X,
  Check,
  Plus,
  Package,
  Maximize2,
  Minimize2,
  ChevronRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Sparkles,
  TrendingDown,
  TrendingUp,
  ChartColumn,
  DollarSign,
  Info,
  Lock,
  Copy,
  Building2,
  Tag,
  FolderOpen,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  PRICING_RULE_PRESETS,
  type PricingRulePreset,
  type PricingRuleBasis,
} from "./pricingRuleConstants";
import {
  PricingRuleItemPicker,
  type PickedItem,
} from "./PricingRuleItemPicker";

/* ──────────────────────────────────────────────────────────────────────────
 * Inlined faithful equivalents of the reference-only helpers.
 * ────────────────────────────────────────────────────────────────────────── */

/** ./ExpandableTextarea — ported 1:1 from the reference. */
function ExpandableTextarea({
  value,
  onChange,
  placeholder,
  maxLength = 5000,
  label,
  expandMode = "full",
  error,
  labelTooltip,
  className,
  showCount = true,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  label?: string;
  expandMode?: "full" | "contained";
  error?: string;
  labelTooltip?: React.ReactNode;
  className?: string;
  showCount?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isContained = expandMode === "contained";

  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [expanded]);

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center gap-1 mb-1.5">
          <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{label}</label>
          {labelTooltip}
        </div>
      )}
      <div className="relative" style={{ height: 72 }}>
        {expanded && <div className="fixed inset-0 z-[99]" onClick={() => setExpanded(false)} />}
        <div
          className="absolute top-0 right-0 z-[100]"
          style={{
            left: expanded ? (isContained ? "-2.5%" : "-80%") : 0,
            marginLeft: expanded ? (isContained ? 0 : -12) : 0,
            marginRight: expanded ? (isContained ? "-2.5%" : -12) : 0,
            marginTop: expanded ? (isContained ? -12 : -32) : 0,
            transition: "left 300ms cubic-bezier(0.16, 1, 0.3, 1), margin 300ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => { if (e.target.value.length <= maxLength) onChange(e.target.value); }}
            onDoubleClick={() => { if (!expanded) setExpanded(true); }}
            placeholder={placeholder}
            className={`w-full rounded-lg bg-white resize-none text-[13px] text-foreground placeholder:text-slate-400 px-3 py-2 pb-6 border outline-none ${
              expanded
                ? "border-primary ring-2 ring-primary/15"
                : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
            }`}
            style={{
              height: expanded ? (isContained ? 140 : 190) : 72,
              boxShadow: expanded ? "0 12px 40px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.03)" : "none",
              transition: "height 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease",
            }}
          />
          {showCount && (
            <p className="absolute bottom-1.5 right-2.5 text-[11px] text-slate-400 pointer-events-none">{value.length}/{maxLength}</p>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer ${
              expanded
                ? "text-primary hover:bg-accent"
                : "text-slate-400 hover:text-primary hover:bg-accent"
            }`}
            style={{ transition: "color 200ms ease, background-color 200ms ease" }}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-500" style={{ fontWeight: 500 }}>{error}</p>}
    </div>
  );
}

/** ../ui/info-tooltip — children-based info tooltip, ported 1:1. */
function InfoTooltip({
  children,
  side = "top",
  sideOffset = 6,
  className,
  iconClassName,
}: {
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
          <Info
            className={`w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors ${iconClassName || ""}`}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={sideOffset}
        className={`z-[300] max-w-[260px] rounded-xl bg-white/95 backdrop-blur-md text-slate-700 border border-border/80 px-3.5 py-2.5 text-[11px] leading-relaxed shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)] ${className || ""}`}
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/** ./PctAmountToggle — % / $ segmented toggle, ported 1:1. */
function PctAmountToggle({
  isFixed,
  onChange,
  percentTooltip = "Enter as a percentage of the base value.",
  amountTooltip = "Enter as a fixed dollar amount.",
  className = "",
}: {
  isFixed: boolean;
  onChange: (fixed: boolean) => void;
  percentTooltip?: string;
  amountTooltip?: string;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center h-[22px] rounded-full bg-muted p-0.5 ${className}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${!isFixed ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={{ fontWeight: 600 }}
          >
            %
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[220px] text-[11px] leading-[1.5] z-[300]">
          <p className="text-slate-500">{percentTooltip}</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${isFixed ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            style={{ fontWeight: 600 }}
          >
            $
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[220px] text-[11px] leading-[1.5] z-[300]">
          <p className="text-slate-500">{amountTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/** ./FilterPills — reusable filter pill bar, ported 1:1. */
interface FilterPillOption {
  key: string;
  label: string;
  count?: number;
  showCount?: boolean;
}
function FilterPills({
  options,
  activeKey,
  onSelect,
}: {
  options: FilterPillOption[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => {
        const isActive = activeKey === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onSelect(opt.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isActive
                ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
            }`}
            style={{
              fontWeight: isActive ? 500 : 400,
              color: isActive ? "hsl(var(--primary))" : undefined,
            }}
          >
            {opt.label}
            {opt.showCount && opt.count !== undefined && (
              <span
                className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
                  isActive ? "bg-primary/10" : "bg-muted"
                }`}
                style={{
                  fontWeight: 600,
                  color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                }}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Browse Templates card data — a lightweight faithful equivalent of the
 * reference `exploreCards`, built directly from PRICING_RULE_PRESETS.
 * ────────────────────────────────────────────────────────────────────────── */
interface ExploreTier {
  minQty: string;
  maxQty: string;
  discount: string;
}
interface ExploreCard {
  id: string;
  ruleNo: string;
  name: string;
  category: "discount" | "premium";
  basis: "value" | "volume";
  tierType: "single" | "multiple";
  totalTiers: number;
  description: string;
  status: string;
  validFrom: string;
  validTo: string;
  hasDateLimit: boolean;
  itemCount: number;
  categoryCount: number;
  partnerCount: number;
  tiers: ExploreTier[];
  createdBy: string;
  isPreset: boolean;
}

/* Browse-variant card, faithful to the reference PricingRuleCard "browse"
 * variant (type pill, TEMPLATE/CUSTOM badge, name, 2-line description, hero
 * value + validity, multi-tier selector strip, tier detail row, and the
 * Apply + Duplicate split footer). */
function PricingRuleCard({
  rule,
  onClick,
  onApply,
  onDuplicate,
}: {
  rule: ExploreCard;
  onClick: () => void;
  onApply?: () => void;
  onDuplicate?: () => void;
}) {
  const [activeTier, setActiveTier] = useState(0);
  const isDis = rule.category === "discount";
  const isMulti = rule.tierType === "multiple" && rule.tiers.length > 1;
  const t0 = rule.tiers[0];
  const shownTier = rule.tiers[isMulti ? activeTier : 0];
  const isPreset = rule.isPreset;

  const pill = isDis
    ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
    : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };

  return (
    <div
      onClick={onClick}
      className="bg-white border border-border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative h-[260px]"
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#BFDBFE";
        e.currentTarget.style.boxShadow = "0 4px 16px -4px rgba(10,119,255,0.10), 0 0 0 1px #BFDBFE";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "hsl(var(--border))";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Row 1: Type pill left · Preset lock / Custom badge right */}
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
            <span
              className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
              style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}
            >
              {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {isDis ? "Discount" : "Premium"}
            </span>
            <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: pill.border }}>
              {rule.basis === "volume" ? "Volume" : "Value"}
            </span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {isPreset ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-muted border border-slate-300 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>
                    <Lock className="w-2.5 h-2.5" /> TEMPLATE
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="z-[300] !bg-white !text-slate-700 !border !border-border !shadow-sm rounded-lg text-[11px] px-2.5 py-1.5 max-w-[220px]" style={{ fontWeight: 500 }}>
                  System preset. Tiers and config are locked; you can still assign items, categories, and vendors.
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="inline-flex items-center px-1.5 py-[3px] rounded-md border border-slate-300 bg-white text-[9px] text-muted-foreground" style={{ fontWeight: 600 }}>CUSTOM</span>
            )}
          </div>
        </div>

        {/* Row 2: Name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{rule.name}</p>
        </div>

        {/* Row 3: Description — fixed 2-line height */}
        <div className="h-[32px] shrink-0 mb-2">
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{rule.description}</p>
        </div>

        {/* Row 4: Hero value left · Valid From / Valid To right */}
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[22px] text-slate-700 tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>
              {t0?.discount ?? "-"}
            </span>
            <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
              {isDis ? "off" : "markup"}
            </span>
          </div>
          {rule.hasDateLimit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-end shrink-0 leading-tight cursor-default">
                  <span className="text-[9px] uppercase tracking-wide text-slate-400" style={{ fontWeight: 600 }}>Valid</span>
                  <span className="text-[11px] text-slate-700 tabular-nums" style={{ fontWeight: 500 }}>
                    {rule.validFrom} · {rule.validTo}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="z-[300] !bg-white !text-slate-700 !border !border-border !shadow-sm rounded-lg text-[11px] px-2.5 py-1.5" style={{ fontWeight: 500 }}>
                Valid {rule.validFrom} → {rule.validTo}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex flex-col items-end shrink-0 leading-tight">
              <span className="text-[9px] uppercase tracking-wide text-slate-400" style={{ fontWeight: 600 }}>Valid</span>
              <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Always active</span>
            </div>
          )}
        </div>

        {/* Row 5: Tier display — fixed height region, pushed to bottom */}
        <div className="mt-auto pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Tier selector strip for multi-tier */}
          <div className={`h-[24px] mb-1.5 ${isMulti ? "flex items-center gap-[3px]" : ""}`}>
            {isMulti && rule.tiers.map((_, i) => {
              const isActive = activeTier === i;
              return (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setActiveTier(i); }}
                  className={`h-[22px] rounded-md text-[10px] tabular-nums transition-all duration-200 cursor-pointer flex items-center justify-center px-2 ${
                    isActive
                      ? "shadow-sm"
                      : "bg-muted text-slate-500 hover:bg-border"
                  }`}
                  style={{
                    fontWeight: isActive ? 600 : 500,
                    ...(isActive ? { backgroundColor: `${pill.text}18`, color: pill.text, boxShadow: `0 0 0 1px ${pill.text}40` } : {}),
                  }}
                >
                  T{i + 1}
                  {isActive && (
                    <span className="ml-1 text-[9px] opacity-60" style={{ fontWeight: 400 }}>
                      {shownTier.discount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Tier detail row */}
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
            <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
              <span style={{ fontWeight: 400 }}>{shownTier?.minQty}</span>
              <span className="text-slate-300">·</span>
              <span style={{ fontWeight: 400 }}>{shownTier?.maxQty}</span>
            </div>
            <span className="shrink-0 ml-2 text-slate-700" style={{ fontWeight: 600 }}>{shownTier?.discount}</span>
          </div>
        </div>
      </div>

      {/* Footer — browse: Apply + Duplicate split */}
      <div className="grid grid-cols-2 border-t border-muted shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onApply?.(); }}
          className="inline-flex items-center justify-center gap-1.5 py-2.5 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors border-r border-muted cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <Check className="w-3.5 h-3.5" /> Apply
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
          className="inline-flex items-center justify-center gap-1.5 py-2.5 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <Copy className="w-3.5 h-3.5" /> Duplicate
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Public API
 * ────────────────────────────────────────────────────────────────────────── */
export interface PricingRuleCreateModalProps {
  open: boolean;
  prefill?: {
    name: string;
    description?: string;
    category: "discount" | "premium";
    basis?: "value" | "volume";
    mode?: "create" | "copy" | "edit";
  } | null;
  /** Vendor name — substituted wherever the reference said "this partner". */
  scopeName: string;
  /** Fire on ANY close: X, Cancel, Discard, backdrop, and after a save. */
  onClose: () => void;
  /** Fire on Save. */
  onSaved: (saved: { name: string; description: string; category: "discount" | "premium" }) => void;
}

interface CreateTierState {
  discount: string;
  fixRate: boolean;
  qtyLimits: boolean;
  minQty: string;
  maxQty: string;
}
const makeTier = (): CreateTierState => ({ discount: "", fixRate: false, qtyLimits: false, minQty: "", maxQty: "" });

export function PricingRuleCreateModal({
  open,
  prefill,
  scopeName,
  onClose,
  onSaved,
}: PricingRuleCreateModalProps) {
  // ── Create Pricing Rule Modal state ──
  const [createFullscreen, setCreateFullscreen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCategory, setCreateCategory] = useState<"discount" | "premium">("discount");
  const [createBasis, setCreateBasis] = useState<PricingRuleBasis>("value");
  const [createLimitDate, setCreateLimitDate] = useState(false);
  const [createValidFrom, setCreateValidFrom] = useState("");
  const [createValidTo, setCreateValidTo] = useState("");
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createIsEdit, setCreateIsEdit] = useState(false);
  const [createItemsTab, setCreateItemsTab] = useState<"items" | "categories" | "attachments">("items");
  const [createItemsPickerOpen, setCreateItemsPickerOpen] = useState(false);
  const [createSelectedItems, setCreateSelectedItems] = useState<PickedItem[]>([]);
  const [createItemsSearch, setCreateItemsSearch] = useState("");
  const [createTiers, setCreateTiers] = useState<CreateTierState[]>([makeTier()]);

  function updateTier(idx: number, patch: Partial<CreateTierState>) {
    setCreateTiers(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  }
  function addTier() { setCreateTiers(prev => [...prev, makeTier()]); }
  function removeTier(idx: number) { setCreateTiers(prev => prev.filter((_, i) => i !== idx)); }

  function resetCreateForm() {
    setCreateName(""); setCreateDescription(""); setCreateCategory("discount");
    setCreateBasis("value"); setCreateLimitDate(false); setCreateValidFrom("");
    setCreateValidTo(""); setCreateStep(1); setCreateItemsTab("items");
    setCreateIsEdit(false);
    setCreateTiers([makeTier()]);
    setCreateSelectedItems([]);
    setCreateItemsSearch("");
    setCreateItemsPickerOpen(false);
  }

  function handleSaveRule() {
    if (!createName.trim()) return;
    onSaved({ name: createName.trim(), description: createDescription, category: createCategory });
    setCreateFullscreen(false);
    onClose();
  }

  // ── Explore Presets Modal state ──
  const [explorePresetsOpen, setExplorePresetsOpen] = useState(false);
  const [explorePresetsFullscreen, setExplorePresetsFullscreen] = useState(false);
  const [explorePresetsSidebar, setExplorePresetsSidebar] = useState("all");
  const [exploreCategoryTab, setExploreCategoryTab] = useState<"discount" | "premium">("discount");
  const [explorePresetsSearch, setExplorePresetsSearch] = useState("");
  const [exploreSortOpen, setExploreSortOpen] = useState(false);
  const [exploreSortBy, setExploreSortBy] = useState<"name" | "vendorsApplied" | "category" | "basis">("name");
  const [exploreSortDir, setExploreSortDir] = useState<"asc" | "desc">("asc");

  // Build the Browse Templates cards from the canonical presets.
  const exploreCards = useMemo<ExploreCard[]>(() => {
    return PRICING_RULE_PRESETS.map((p) => {
      const isCustom = p.id.startsWith("pr-custom-");
      const num = (p.id.split("-").pop() || "0").padStart(3, "0");
      return {
        id: p.id,
        ruleNo: `${isCustom ? "CUS" : "PRE"}-${num}`,
        name: p.name,
        category: (p.category === "all" ? "discount" : p.category) as "discount" | "premium",
        basis: p.basis,
        tierType: p.tierType,
        totalTiers: p.totalTiers,
        description: p.description,
        status: "Active",
        validFrom: "Jan 01, 2026",
        validTo: "Dec 31, 2026",
        hasDateLimit: false,
        itemCount: 0,
        categoryCount: 0,
        partnerCount: p.vendorsApplied,
        tiers: p.tiers.map((t) => ({ minQty: t.minValue, maxQty: t.maxValue, discount: t.discount })),
        createdBy: isCustom ? "Ahtisham Ahmad" : "System",
        isPreset: !isCustom,
      };
    });
  }, []);

  // Clone a preset/card into the create form so the user can edit before
  // saving — the canonical "apply template → clone into the create form"
  // behavior. Original templates are never modified.
  const applyPricingTemplateFromPreset = (tpl: PricingRulePreset) => {
    setCreateName(`Copy of ${tpl.name}`);
    setCreateDescription(tpl.description);
    setCreateCategory(tpl.category === "all" ? "discount" : tpl.category);
    setCreateBasis(tpl.basis);
    const parseNum = (s: string) => (s || "").replace(/[^0-9.]/g, "");
    const parsedTiers = (tpl.tiers || []).map((t) => ({
      discount: parseNum(t.discount),
      fixRate: false,
      qtyLimits: Boolean(t.minValue || t.maxValue),
      minQty: parseNum(t.minValue || ""),
      maxQty: parseNum(t.maxValue || ""),
    }));
    setCreateTiers(parsedTiers.length > 0 ? parsedTiers : [{ discount: "", fixRate: false, qtyLimits: false, minQty: "", maxQty: "" }]);
    toast.success("Template duplicated as a new custom rule. Edit any field before saving; the original template stays unchanged.");
  };

  // Clone a Browse-Templates card into the form (preserves the card's tier
  // min/max strings, matching the reference onDuplicate handler).
  const duplicateCardIntoForm = (card: ExploreCard) => {
    resetCreateForm();
    setCreateName(`${card.name} (Copy)`);
    setCreateDescription(card.description);
    setCreateCategory(card.category);
    setCreateBasis(card.basis);
    setCreateTiers(card.tiers.map((t) => ({ discount: t.discount, fixRate: false, qtyLimits: true, minQty: t.minQty, maxQty: t.maxQty })));
    setExplorePresetsOpen(false);
    setExplorePresetsFullscreen(false);
  };

  /* ── Open / prefill lifecycle ──
     Reset + apply prefill ONLY on the open edge (false→true). Parents build a
     fresh `prefill` object literal each render, so resetting on prefill
     identity would wipe in-progress input and bounce to step 1 on any parent
     re-render mid-edit. The ref pins the reset to the moment the modal opens. */
  const pricingRuleOpenEdgeRef = useRef(false);
  useEffect(() => {
    if (open && !pricingRuleOpenEdgeRef.current) {
      pricingRuleOpenEdgeRef.current = true;
      resetCreateForm();
      if (prefill) {
        setCreateName(prefill.name);
        setCreateDescription(prefill.description ?? "");
        setCreateCategory(prefill.category);
        if (prefill.basis) setCreateBasis(prefill.basis);
        if (prefill.mode === "edit") setCreateIsEdit(true);
      }
      setCreateStep(1);
    } else if (!open && pricingRuleOpenEdgeRef.current) {
      pricingRuleOpenEdgeRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill]);

  return (
    <>
      {/* ── Create New Pricing Rule Modal ── */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setCreateFullscreen(false); resetCreateForm(); onClose(); } }}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden z-[280] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)]"
          style={createFullscreen
            ? { maxWidth: "calc(100% - 1rem)", width: "calc(100% - 1rem)", height: "calc(100dvh - 1rem)", maxHeight: "calc(100dvh - 1rem)", borderRadius: 16 }
            : { maxWidth: "min(65vw, 960px)", width: "calc(100% - 2rem)", height: "min(880px, 92vh)", maxHeight: "92vh", borderRadius: 16 }
          }
          hideCloseButton
        >
          <DialogTitle className="sr-only">{createIsEdit ? "Edit Pricing Rule" : "Create New Pricing Rule"}</DialogTitle>
          <DialogDescription className="sr-only">{createIsEdit ? "Edit this pricing rule. Adjust the type, tiers, and attached items." : `Build a new pricing rule for ${scopeName}. Pick the type, set tiers, and attach items.`}</DialogDescription>

          {/* Header */}
          <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-0 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
            {/* Title row */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>{createIsEdit ? "Edit Pricing Rule" : "Create New Pricing Rule"}</h2>
                  <span className="hidden sm:inline-flex items-center px-1.5 py-[3px] rounded-md border border-slate-300 bg-white text-[9px] text-muted-foreground" style={{ fontWeight: 600 }}>CUSTOM</span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                  {createIsEdit ? "Update the type, tiers, and assigned items for this rule." : "Configure the type, tiers, and assign items for the new rule."}
                </p>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  onClick={() => setCreateFullscreen(!createFullscreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {createFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {createFullscreen ? "Exit full" : "Full view"}
                </button>
                <button
                  onClick={() => { setCreateFullscreen(false); resetCreateForm(); onClose(); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Step tabs */}
            <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
              {[
                { num: 1 as const, label: "Rule Setup", shortLabel: "Setup", active: createStep === 1, completed: createStep === 2 },
                { num: 2 as const, label: "Items & Attachments", shortLabel: "Items", active: createStep === 2, completed: false },
              ].map((tab) => (
                <div
                  key={tab.num}
                  className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${
                    tab.num < createStep || (tab.num === 2 && createStep === 1 && createName.trim()) ? "cursor-pointer" : "cursor-default"
                  }`}
                  onClick={() => {
                    if (tab.num < createStep) setCreateStep(tab.num);
                    if (tab.num === 2 && createStep === 1 && createName.trim()) setCreateStep(2);
                  }}
                >
                  <div
                    className={`w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 transition-all duration-200 ${
                      tab.completed
                        ? "bg-emerald-500 text-white"
                        : tab.active
                        ? "bg-primary text-white"
                        : "border-[1.5px] border-slate-300 text-slate-500 bg-white"
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    {tab.completed ? <Check className="w-3 h-3" /> : tab.num}
                  </div>
                  <span
                    className={`text-[12px] sm:text-[13px] whitespace-nowrap transition-colors ${
                      tab.active
                        ? "text-primary"
                        : tab.completed
                        ? "text-emerald-500"
                        : "text-slate-700"
                    }`}
                    style={{ fontWeight: tab.active || tab.completed ? 600 : 500 }}
                  >
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </span>
                  {(tab.active || tab.completed) && (
                    <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${tab.completed ? "bg-emerald-500" : "bg-primary"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC] scrollbar-hide">
            <div className="px-4 py-4 transition-all duration-300 ease-out">

              {/* ─── Step 1: Rule Setup ─── */}
              {createStep === 1 && (() => {
                const suggestedTemplates = [...PRICING_RULE_PRESETS]
                  .sort((a, b) => b.vendorsApplied - a.vendorsApplied)
                  .slice(0, 4);
                const applyPricingTemplate = applyPricingTemplateFromPreset;
                return (
                <div className="space-y-5">
                  {/* Start-from-template suggestion row */}
                  <div className="rounded-xl border border-dashed border-[#DBE4F0] bg-gradient-to-br from-[#F8FBFF] to-white p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-primary" />
                        </div>
                        <div>
                          <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Start from a template</p>
                          <p className="text-[10px] text-slate-400" style={{ fontWeight: 400 }}>Duplicates the template as a new custom rule. Originals are never modified.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setExplorePresetsOpen(true); setExplorePresetsSidebar("all"); setExploreCategoryTab("discount"); setExplorePresetsSearch(""); }}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer shrink-0"
                        style={{ fontWeight: 600 }}
                      >
                        See all <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {suggestedTemplates.map((tpl) => {
                        const isDis = tpl.category === "discount";
                        const tplPill = isDis
                          ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
                          : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => applyPricingTemplate(tpl)}
                            className="group text-left rounded-lg border border-[#E8ECF1] bg-white p-2.5 hover:border-primary/30 hover:shadow-[0_2px_8px_-2px_rgba(10,119,255,0.10)] transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: tplPill.border }}>
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
                                  style={{ fontWeight: 600, color: tplPill.text, backgroundColor: tplPill.bg }}
                                >
                                  {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                  {isDis ? "Discount" : "Premium"}
                                </span>
                                <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: tplPill.border }}>
                                  {tpl.basis === "volume" ? "Volume" : "Value"}
                                </span>
                              </span>
                              {tpl.tierType === "multiple" && (
                                <span className="inline-flex items-center px-1.5 py-[2px] rounded-full border border-[#E8ECF1] bg-slate-50 text-slate-500 text-[10px]" style={{ fontWeight: 500 }}>
                                  {tpl.totalTiers}-tier
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-foreground line-clamp-1 group-hover:text-primary transition-colors" style={{ fontWeight: 600 }}>
                              {tpl.name}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-snug">
                              {tpl.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing Rule Type — Clean gradient cards */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Type</span>
                      <Tooltip><TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger><TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]"><p className="text-slate-500">Discount lowers prices, Premium adds markup. Hover each card for details.</p></TooltipContent></Tooltip>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Discount card — green accents */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                      <div
                        onClick={() => setCreateCategory("discount")}
                        className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                          createCategory === "discount"
                            ? "border-[#86EFAC]/70 bg-white shadow-[0_1px_4px_rgba(4,120,87,0.06)]"
                            : "border-border bg-white hover:border-[#BBF7D0] hover:shadow-[0_4px_16px_-4px_rgba(4,120,87,0.10)]"
                        }`}
                      >
                        <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                          createCategory === "discount"
                            ? "bg-gradient-to-br from-green-50/50 to-transparent"
                            : "bg-gradient-to-br from-green-50/0 to-green-50/0 group-hover:from-green-50/60 group-hover:to-transparent"
                        }`} />
                        <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                          <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                            createCategory === "discount"
                              ? "bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0] text-[#15803D]"
                              : "bg-gradient-to-br from-green-50 to-[#DCFCE7] text-green-600 group-hover:scale-105"
                          }`}>
                            <TrendingDown className="w-[18px] h-[18px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] transition-colors duration-150 ${
                              createCategory === "discount" ? "text-[#166534]" : "text-foreground group-hover:text-slate-800"
                            }`} style={{ fontWeight: 600 }}>Discount</p>
                            <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${
                              createCategory === "discount" ? "text-[#22C55E]" : "text-slate-400"
                            }`}>Lower price adjustment</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                            createCategory === "discount"
                              ? ""
                              : "border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#86EFAC]"
                          }`} style={createCategory === "discount" ? { backgroundColor: "#16A34A", boxShadow: "0 0 0 2px rgba(22,163,74,0.15)" } : {}}>
                            {createCategory === "discount" && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                          </div>
                        </div>
                      </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-slate-500">Reduce unit price when quantity or value thresholds are met.</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                            <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                            <p className="text-[11px] text-slate-700 mt-1"><span className="text-green-600" style={{ fontWeight: 600 }}>10% off</span> on orders over 500 units.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>

                      {/* Premium card — purple accents */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                      <div
                        onClick={() => setCreateCategory("premium")}
                        className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                          createCategory === "premium"
                            ? "border-[#C4B5FD]/70 bg-white shadow-[0_1px_4px_rgba(124,58,237,0.06)]"
                            : "border-border bg-white hover:border-[#DDD6FE] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.10)]"
                        }`}
                      >
                        <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                          createCategory === "premium"
                            ? "bg-gradient-to-br from-violet-50/50 to-transparent"
                            : "bg-gradient-to-br from-violet-50/0 to-violet-50/0 group-hover:from-violet-50/60 group-hover:to-transparent"
                        }`} />
                        <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                          <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                            createCategory === "premium"
                              ? "bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-violet"
                              : "bg-gradient-to-br from-violet-50 to-[#EDE9FE] text-violet-500 group-hover:scale-105"
                          }`}>
                            <TrendingUp className="w-[18px] h-[18px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] transition-colors duration-150 ${
                              createCategory === "premium" ? "text-[#5B21B6]" : "text-foreground group-hover:text-slate-800"
                            }`} style={{ fontWeight: 600 }}>Premium</p>
                            <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${
                              createCategory === "premium" ? "text-violet-500" : "text-slate-400"
                            }`}>Higher price adjustment</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                            createCategory === "premium"
                              ? ""
                              : "border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#C4B5FD]"
                          }`} style={createCategory === "premium" ? { backgroundColor: "#8B5CF6", boxShadow: "0 0 0 2px rgba(139,92,246,0.15)" } : {}}>
                            {createCategory === "premium" && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                          </div>
                        </div>
                      </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-slate-500">Markup on base price for express or value-added services.</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                            <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                            <p className="text-[11px] text-slate-700 mt-1"><span className="text-violet" style={{ fontWeight: 600 }}>15% markup</span> for expedited and priority shipping.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                  </div>

                  {/* Pricing Rule Details */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Details</span>
                      <Tooltip><TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger><TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]"><p className="text-slate-500">Name and basis shown on POs and invoices.</p><div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted"><p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>TIP</p><p className="text-[11px] text-slate-700 mt-1">Use a descriptive name like &ldquo;Q4 Volume Discount&rdquo; so vendors can identify it on their orders.</p></div></TooltipContent></Tooltip>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-4">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {/* Row 1: Name + Calculation Basis */}
                        <div>
                          <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>{createCategory === "discount" ? "Discount" : "Premium"} Name</label>
                          <Input
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            placeholder={`e.g. ${createCategory === "discount" ? "Volume Discount for Q4" : "Premium Markup for VIP"}`}
                            className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1.5">
                            <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Calculation Basis</label>
                            <Tooltip>
                              <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                              <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                <p className="text-slate-500">Measure thresholds by units ordered or order value.</p>
                                <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                  <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                                  <p className="text-[11px] text-slate-700 mt-1"><span className="text-primary" style={{ fontWeight: 600 }}>Volume</span>: 500+ units. <span className="text-primary" style={{ fontWeight: 600 }}>Value</span>: orders over $10K.</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex items-center gap-2">
                            {(["volume", "value"] as const).map((b) => (
                              <button
                                key={b}
                                onClick={() => {
                                  if (createBasis !== b) {
                                    setCreateBasis(b);
                                    setCreateTiers(prev => prev.map(t => ({ ...t, minQty: "", maxQty: "" })));
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 flex-1 justify-center h-9 rounded-lg border text-[12px] transition-all cursor-pointer ${
                                  createBasis === b
                                    ? createCategory === "discount" ? "border-green-600/30 bg-green-50 text-[#15803D]" : "border-violet/30 bg-violet-50 text-[#6D28D9]"
                                    : "border-border bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                                style={{ fontWeight: createBasis === b ? 600 : 500 }}
                              >
                                {b === "volume" ? <ChartColumn className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                                {b === "volume" ? "Volume-Based" : "Value-Based"}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Row 2: Description (full width) */}
                        <div className="col-span-2">
                          <ExpandableTextarea
                            label="Description"
                            value={createDescription}
                            onChange={setCreateDescription}
                            placeholder="Brief summary of pricing rule purpose or context."
                          />
                        </div>
                      </div>

                      {/* Validity Period */}
                      <div className="mt-3">
                        <div className="flex items-center gap-2.5">
                          <Switch checked={createLimitDate} onCheckedChange={setCreateLimitDate} />
                          <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>Set Validity Period</span>
                          <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>Optional</span>
                          <Tooltip>
                            <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                              <p className="text-slate-500">Set a date range. If off, rule applies indefinitely.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        {createLimitDate && (
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Valid From</label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                    <p className="text-slate-500">Rule starts applying from this date.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Input
                                type="date"
                                value={createValidFrom}
                                onChange={(e) => setCreateValidFrom(e.target.value)}
                                className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Valid To</label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                    <p className="text-slate-500">Rule auto-deactivates after this date.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Input
                                type="date"
                                value={createValidTo}
                                onChange={(e) => setCreateValidTo(e.target.value)}
                                className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tiers — multiple, with add/remove */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{createCategory === "discount" ? "Discount" : "Premium"} Tiers</span>
                        <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>{createTiers.length}</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {createTiers.map((tier, idx) => {
                        const isDis = createCategory === "discount";
                        const accent = isDis ? "#16A34A" : "hsl(var(--violet))";
                        const accentBg = isDis ? "#F0FDF4" : "#F5F3FF";
                        const accentBorder = isDis ? "#BBF7D0" : "#DDD6FE";
                        return (
                        <div key={idx} className="rounded-xl border bg-white overflow-hidden transition-all" style={{ borderColor: tier.qtyLimits ? accentBorder : "hsl(var(--border))" }}>
                          {/* Header */}
                          <div className="flex items-center justify-between px-3.5 py-2 border-b border-muted" style={{ backgroundColor: accentBg }}>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white" style={{ fontWeight: 700, backgroundColor: accent }}>{idx + 1}</span>
                              <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Tier {idx + 1}</span>
                            </div>
                            {idx > 0 && (
                              <button
                                onClick={() => removeTier(idx)}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white/60 transition-all cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Body */}
                          <div className="px-3.5 py-3">
                            <div className="grid grid-cols-2 gap-3">
                              {/* Discount / Premium field */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                                    {isDis ? "Discount" : "Premium"} {tier.fixRate ? "Amount" : "Rate"}
                                  </label>
                                  <PctAmountToggle
                                    isFixed={tier.fixRate}
                                    onChange={(fixed) => updateTier(idx, { fixRate: fixed })}
                                    percentTooltip={`${isDis ? "Discount" : "Premium"} applied as a percentage of the line value.`}
                                    amountTooltip={`${isDis ? "Discount" : "Premium"} applied as a fixed dollar amount.`}
                                  />
                                </div>
                                <div className="relative">
                                  {tier.fixRate && (
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
                                  )}
                                  <Input
                                    value={tier.discount}
                                    onChange={(e) => updateTier(idx, { discount: e.target.value })}
                                    placeholder={tier.fixRate ? "e.g. 25.00" : "e.g. 50"}
                                    className={`rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${tier.fixRate ? "pl-7 pr-3" : "pr-8"}`}
                                  />
                                  {!tier.fixRate && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
                                  )}
                                </div>
                              </div>

                              {/* Quantity limits toggle */}
                              <div className="flex items-end h-full pb-[7px]">
                                <label
                                  className="flex items-center gap-2 cursor-pointer select-none"
                                  onClick={() => updateTier(idx, { qtyLimits: !tier.qtyLimits })}
                                >
                                  <div className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${tier.qtyLimits ? "bg-primary" : "border-[1.5px] border-slate-300 bg-white hover:border-slate-400"}`}>
                                    {tier.qtyLimits && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                  </div>
                                  <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{createBasis === "volume" ? "Order Qty Limits" : "Order Value Limits"}</span>
                                  <span onClick={(e) => e.stopPropagation()}>
                                    <InfoTooltip>{createBasis === "volume"
                                      ? "Restricts this tier to orders within a specific quantity range. When enabled, the tier only applies when the order quantity falls between Min and Max."
                                      : "Restricts this tier to orders within a specific dollar-value range. When enabled, the tier only applies when the order total falls between Min and Max."}</InfoTooltip>
                                  </span>
                                </label>
                              </div>
                            </div>

                            {/* Expanded qty fields */}
                            {tier.qtyLimits && (
                              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-muted">
                                <div>
                                  <div className="flex items-center gap-1 mb-1.5">
                                    <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{createBasis === "volume" ? "Min Qty" : "Min Order Value"}</label>
                                    <InfoTooltip>{createBasis === "volume"
                                      ? "The smallest order quantity at which this tier starts to apply. Orders below this value fall into a lower tier or get no adjustment."
                                      : "The smallest order value (in $) at which this tier starts to apply. Orders below this value fall into a lower tier or get no adjustment."}</InfoTooltip>
                                  </div>
                                  <div className="relative">
                                    {createBasis === "value" && (
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
                                    )}
                                    <Input
                                      value={tier.minQty}
                                      onChange={(e) => updateTier(idx, { minQty: e.target.value })}
                                      placeholder={createBasis === "volume" ? "e.g. 100" : "e.g. 1,000"}
                                      className={`rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${createBasis === "value" ? "pl-7" : ""}`}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center gap-1 mb-1.5">
                                    <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{createBasis === "volume" ? "Max Qty" : "Max Order Value"}</label>
                                    <InfoTooltip>{createBasis === "volume"
                                      ? "The largest order quantity this tier covers. Orders above this value roll into the next tier or stop receiving this adjustment."
                                      : "The largest order value (in $) this tier covers. Orders above this value roll into the next tier or stop receiving this adjustment."}</InfoTooltip>
                                  </div>
                                  <div className="relative">
                                    {createBasis === "value" && (
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
                                    )}
                                    <Input
                                      value={tier.maxQty}
                                      onChange={(e) => updateTier(idx, { maxQty: e.target.value })}
                                      placeholder={createBasis === "volume" ? "e.g. 500" : "e.g. 5,000"}
                                      className={`rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${createBasis === "value" ? "pl-7" : ""}`}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={addTier}
                      className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg border border-dashed text-[12px] transition-all cursor-pointer w-full justify-center ${createCategory === "discount" ? "border-[#BBF7D0] text-green-600 hover:bg-green-50 hover:border-[#86EFAC]" : "border-[#DDD6FE] text-violet hover:bg-violet-50 hover:border-[#C4B5FD]"}`}
                      style={{ fontWeight: 600 }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Tier
                    </button>
                  </div>
                </div>
                );
              })()}

              {/* ─── Step 2: Items, Categories & Attachments ─── */}
              {createStep === 2 && (
                <div className="space-y-5">
                  {/* Summary banner */}
                  <div className="rounded-xl border border-border bg-white p-3.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${createCategory === "discount" ? "bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0]" : "bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE]"}`}>
                      {createCategory === "discount" ? <TrendingDown className="w-4.5 h-4.5 text-[#15803D]" /> : <TrendingUp className="w-4.5 h-4.5 text-violet" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{createName || "Untitled Rule"}</p>
                      <p className="text-[11px] text-slate-500 truncate">{createCategory === "discount" ? "Discount" : "Premium"} · {createBasis === "volume" ? "Volume-Based" : "Value-Based"} · {createTiers.length} tier{createTiers.length !== 1 ? "s" : ""}{createTiers[0]?.discount ? ` · ${createTiers[0].discount}${createTiers[0].fixRate ? "$" : "%"}` : ""}</p>
                    </div>
                    <button
                      onClick={() => setCreateStep(1)}
                      className="text-[11px] text-primary hover:text-[#0862D0] transition-colors cursor-pointer shrink-0"
                      style={{ fontWeight: 600 }}
                    >
                      Edit Setup
                    </button>
                  </div>

                  {/* Items, Categories & Attachments card */}
                  <div className="rounded-xl border border-border bg-white overflow-hidden">
                    <div className="flex items-center gap-0 border-b border-border px-4">
                      {([
                        { key: "items" as const, label: "Items" },
                        { key: "categories" as const, label: "Categories" },
                        { key: "attachments" as const, label: "Attachments" },
                      ]).map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setCreateItemsTab(t.key)}
                          className={`relative px-3 py-2.5 text-[12px] flex items-center transition-colors cursor-pointer ${createItemsTab === t.key ? "text-primary" : "text-slate-500 hover:text-slate-700"}`}
                          style={{ fontWeight: createItemsTab === t.key ? 600 : 500 }}
                        >
                          {t.label}
                          {createItemsTab === t.key && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-primary" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Tab content — Items */}
                    {createItemsTab === "items" && (() => {
                      const q = createItemsSearch.trim().toLowerCase();
                      const visible = q
                        ? createSelectedItems.filter(
                            (it) =>
                              it.partNo.toLowerCase().includes(q) ||
                              it.description.toLowerCase().includes(q) ||
                              (it.category || "").toLowerCase().includes(q),
                          )
                        : createSelectedItems;
                      return (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                              placeholder="Search items to assign..."
                              value={createItemsSearch}
                              onChange={(e) => setCreateItemsSearch(e.target.value)}
                              className="pl-9 rounded-lg border-border bg-slate-50 text-[13px] h-9"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setCreateItemsPickerOpen(true)}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] shadow-sm transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Items
                          </button>
                        </div>
                        {createSelectedItems.length === 0 ? (
                          <div className="py-8 text-center">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                              <Package className="w-5.5 h-5.5 text-slate-400" />
                            </div>
                            <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>No items assigned yet</p>
                            <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">Search and add items that should be affected by this pricing rule.</p>
                          </div>
                        ) : visible.length === 0 ? (
                          <div className="py-8 text-center">
                            <p className="text-[12px] text-slate-500">No items match "{createItemsSearch}"</p>
                            <button
                              type="button"
                              onClick={() => setCreateItemsSearch("")}
                              className="mt-1 text-[11px] text-primary hover:underline cursor-pointer"
                              style={{ fontWeight: 600 }}
                            >
                              Clear search
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y divide-[#F1F5F9] rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
                            {visible.map((it) => (
                              <div key={it.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[#FAFBFC] transition-colors">
                                <img src={it.image} alt={it.partNo} className="w-9 h-9 rounded-md object-cover border border-[#E8ECF1] shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{it.partNo}</p>
                                  <p className="text-[11px] text-slate-500 truncate">{it.description}</p>
                                </div>
                                <span
                                  className="hidden sm:inline-flex items-center px-1.5 py-px rounded-md text-[10px] border bg-violet-50 text-violet-700 border-violet-200"
                                  style={{ fontWeight: 600 }}
                                >
                                  {it.category}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCreateSelectedItems((prev) => prev.filter((x) => x.id !== it.id))}
                                  className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                                  title="Remove item"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      );
                    })()}

                    {/* Tab content — Categories */}
                    {createItemsTab === "categories" && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input placeholder="Search categories to assign..." className="pl-9 rounded-lg border-border bg-slate-50 text-[13px] h-9" />
                          </div>
                          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] shadow-sm transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                            <Plus className="w-3.5 h-3.5" /> Add Categories
                          </button>
                        </div>
                        <div className="py-8 text-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                            <FolderOpen className="w-5.5 h-5.5 text-slate-400" />
                          </div>
                          <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>No categories assigned yet</p>
                          <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">Assign categories to apply this pricing rule to all items within them.</p>
                        </div>
                      </div>
                    )}

                    {/* Tab content — Attachments */}
                    {createItemsTab === "attachments" && (
                      <div className="p-4">
                        <div className="py-8 text-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] border-dashed flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-5.5 h-5.5 text-slate-400" />
                          </div>
                          <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>No attachments yet</p>
                          <p className="text-[11px] text-slate-400 max-w-[280px] mx-auto mb-3">Upload supporting documents, contracts, or approval files for this pricing rule.</p>
                          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-white text-[12px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                            <Upload className="w-3.5 h-3.5" /> Upload Files
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer — step-aware */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            {createStep === 1 ? (
              <>
                <button
                  onClick={() => { resetCreateForm(); setCreateFullscreen(false); onClose(); }}
                  className="px-3 sm:px-5 py-2 rounded-lg border border-border text-xs sm:text-[13px] bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { if (createName.trim()) setCreateStep(2); }}
                  disabled={!createName.trim()}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-lg bg-primary text-white text-xs sm:text-[13px] hover:bg-[#0862D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Continue
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCreateStep(1)}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-slate-500 hover:text-foreground transition-colors mr-auto cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Back</span>
                </button>
                <button
                  onClick={() => { resetCreateForm(); setCreateFullscreen(false); onClose(); }}
                  className="px-3 sm:px-5 py-2 rounded-lg border border-border text-xs sm:text-[13px] bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveRule}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-lg bg-primary text-white text-xs sm:text-[13px] hover:bg-[#0862D0] transition-colors shadow-sm cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  {!createIsEdit && <Plus className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{createIsEdit ? "Save" : "Save & Create"}</span>
                  <span className="sm:hidden">{createIsEdit ? "Save" : "Create"}</span>
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Items picker for the Create Pricing Rule modal */}
      <PricingRuleItemPicker
        open={createItemsPickerOpen}
        onOpenChange={setCreateItemsPickerOpen}
        existingItemIds={new Set(createSelectedItems.map((it) => it.id))}
        contextLabel={createName || undefined}
        contextType={createCategory}
        onItemsAdded={(items) => {
          setCreateSelectedItems((prev) => {
            const existing = new Set(prev.map((it) => it.id));
            const merged = [...prev];
            for (const it of items) if (!existing.has(it.id)) merged.push(it);
            return merged;
          });
        }}
        onItemRemoved={(id) => setCreateSelectedItems((prev) => prev.filter((x) => x.id !== id))}
      />

      {/* ─── Explore Presets (Browse Templates) Modal ─── */}
      <Dialog open={explorePresetsOpen} onOpenChange={(v) => { if (!v) { setExplorePresetsOpen(false); setExplorePresetsFullscreen(false); } }}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden z-[290] border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col"
          style={explorePresetsFullscreen
            ? { maxWidth: "calc(100% - 1rem)", width: "calc(100% - 1rem)", height: "calc(100dvh - 1rem)", maxHeight: "calc(100dvh - 1rem)", borderRadius: 16 }
            : { maxWidth: "min(75vw, 1080px)", width: "calc(100% - 2rem)", height: "min(88vh, 1080px)", maxHeight: "min(88vh, 1080px)", minHeight: 640, borderRadius: 16 }
          }
          hideCloseButton
        >
          <DialogTitle className="sr-only">Pricing rule presets library</DialogTitle>
          <DialogDescription className="sr-only">Browse and select pricing rule presets to apply to {scopeName}.</DialogDescription>

          {/* Header — 12px strip */}
          <div className="flex items-center justify-between px-6 h-12 border-b border-[#EEF2F6] bg-card shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Presets</h3>
                <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Browse and apply pricing rules to this vendor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExplorePresetsFullscreen(f => !f)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all"
                style={{ fontWeight: 500 }}
              >
                {explorePresetsFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {explorePresetsFullscreen ? "Exit full" : "Full view"}
              </button>
              <button onClick={() => { setExplorePresetsOpen(false); setExplorePresetsFullscreen(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
              {/* Sticky toolbar */}
              <div className="shrink-0 bg-white border-b border-[#EEF2F6] px-5 pt-4 pb-3 space-y-3">
                {/* Search + type toggle + sort row */}
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={explorePresetsSearch}
                      onChange={(e) => setExplorePresetsSearch(e.target.value)}
                      placeholder="Search pricing rules..."
                      className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-primary focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
                    />
                    {explorePresetsSearch && (
                      <button onClick={() => setExplorePresetsSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Type toggle */}
                  <div className="inline-flex items-center rounded-lg bg-slate-50 border border-border/60 p-0.5 shrink-0">
                    {([
                      { key: "discount", label: "Discounts", color: "#047857", bg: "#ECFDF5", icon: TrendingDown, tip: "Reduce unit price when quantity or value thresholds are met.", example: <><span className="text-green-600" style={{ fontWeight: 600 }}>10% off</span> on orders over 500 units.</> },
                      { key: "premium", label: "Premiums", color: "hsl(var(--violet))", bg: "#F5F3FF", icon: TrendingUp, tip: "Markup on base price for express or value-added services.", example: <><span className="text-violet" style={{ fontWeight: 600 }}>15% markup</span> for expedited and priority shipping.</> },
                    ] as const).map((cat) => {
                      const active = exploreCategoryTab === cat.key;
                      const count = exploreCards.filter((c) => c.category === cat.key).length;
                      return (
                        <Tooltip key={cat.key}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setExploreCategoryTab(cat.key)}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all cursor-pointer ${
                                active ? "shadow-sm" : "hover:bg-white/60"
                              }`}
                              style={{ fontWeight: active ? 600 : 500, color: active ? cat.color : "#334155", backgroundColor: active ? cat.bg : undefined }}
                            >
                              <cat.icon className="w-3.5 h-3.5" />
                              {cat.label}
                              <span
                                className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                                style={{ fontWeight: 600, color: active ? cat.color: "hsl(var(--muted-foreground))", backgroundColor: active ? `${cat.color}15` : "hsl(var(--border))" }}
                              >
                                {count}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                            <p className="text-slate-500">{cat.tip}</p>
                            <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                              <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                              <p className="text-[11px] text-slate-700 mt-1">{cat.example}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>

                  <div className="flex-1" />
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md bg-primary/[0.04] text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                      {(() => {
                        let c = exploreCards.filter(card => card.category === exploreCategoryTab);
                        if (explorePresetsSidebar === "preset") c = c.filter(card => card.isPreset);
                        else if (explorePresetsSidebar === "custom") c = c.filter(card => !card.isPreset);
                        else if (explorePresetsSidebar === "created_by_me") c = c.filter(card => !card.isPreset && card.createdBy === "Ahtisham Ahmad");
                        else if (explorePresetsSidebar === "vendors_applied") c = c.filter(card => card.partnerCount >= 3);
                        if (explorePresetsSearch.trim()) {
                          const q = explorePresetsSearch.toLowerCase();
                          c = c.filter(card => card.name.toLowerCase().includes(q) || card.description.toLowerCase().includes(q) || card.ruleNo.toLowerCase().includes(q) || card.createdBy.toLowerCase().includes(q));
                        }
                        return c.length;
                      })()}
                    </span>
                    <Popover open={exploreSortOpen} onOpenChange={setExploreSortOpen}>
                      <PopoverTrigger asChild>
                        <button className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${exploreSortOpen ? "text-primary bg-blue-50 border-blue-100" : "text-slate-500 hover:text-foreground hover:bg-slate-50 border-transparent hover:border-border"}`} style={{ fontWeight: 500 }}>
                          <ArrowUpDown className="w-3 h-3" />
                          {exploreSortBy === "name" ? "Name" : exploreSortBy === "vendorsApplied" ? "In Use" : exploreSortBy === "category" ? "Type" : "Basis"}
                          {exploreSortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[200px] p-1.5 rounded-lg z-[295]" sideOffset={6}>
                        <div className="space-y-0.5">
                          {([
                            { key: "name", label: "Name", icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
                            { key: "vendorsApplied", label: "In Use", icon: <Building2 className="w-3.5 h-3.5" /> },
                            { key: "category", label: "Type", icon: <Tag className="w-3.5 h-3.5" /> },
                            { key: "basis", label: "Basis", icon: <ChartColumn className="w-3.5 h-3.5" /> },
                          ] as const).map((opt) => {
                            const isActive = exploreSortBy === opt.key;
                            return (
                              <button
                                key={opt.key}
                                onClick={() => {
                                  if (isActive) {
                                    setExploreSortDir((d) => d === "asc" ? "desc" : "asc");
                                  } else {
                                    setExploreSortBy(opt.key);
                                    setExploreSortDir("asc");
                                  }
                                  setExploreSortOpen(false);
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] transition-all ${
                                  isActive
                                    ? "bg-blue-50 text-primary"
                                    : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                                }`}
                                style={{ fontWeight: isActive ? 600 : 500 }}
                              >
                                <span className={isActive ? "text-primary" : "text-slate-400"}>{opt.icon}</span>
                                <span className="flex-1 text-left">{opt.label}</span>
                                {isActive && (
                                  exploreSortDir === "asc"
                                    ? <ArrowUp className="w-3 h-3 text-primary" />
                                    : <ArrowDown className="w-3 h-3 text-primary" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      onClick={() => {
                        setExplorePresetsOpen(false);
                        setExplorePresetsFullscreen(false);
                        resetCreateForm();
                      }}
                      className="bg-primary text-primary-foreground shrink-0 h-8 px-3 text-[12px]"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Create New
                    </Button>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center overflow-x-auto">
                  <FilterPills
                    options={(() => {
                      const base = exploreCards.filter((c) => c.category === exploreCategoryTab);
                      return [
                        { key: "all", label: "All", count: base.length, showCount: true },
                        { key: "preset", label: "Template", count: base.filter((c) => c.isPreset).length, showCount: true },
                        { key: "custom", label: "Custom", count: base.filter((c) => !c.isPreset).length, showCount: true },
                        { key: "created_by_me", label: "Created by Me", count: base.filter((c) => !c.isPreset && c.createdBy === "Ahtisham Ahmad").length, showCount: true },
                        { key: "vendors_applied", label: "In Use", count: base.filter((c) => c.partnerCount >= 3).length, showCount: true },
                      ];
                    })()}
                    activeKey={explorePresetsSidebar}
                    onSelect={(k) => setExplorePresetsSidebar(k)}
                  />
                </div>
              </div>

              {/* Cards area */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 flex items-start gap-2.5">
                  <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <span className="text-foreground" style={{ fontWeight: 600 }}>Templates are a kickstart.</span> Use them as-is or as a baseline; you can always create a new pricing rule tailored to your business needs from<span style={{ fontWeight: 600 }}>Create New</span> above.
                  </p>
                </div>
                {(() => {
                  let cards = exploreCards;
                  cards = cards.filter(c => c.category === exploreCategoryTab);
                  if (explorePresetsSidebar === "preset") cards = cards.filter(c => c.isPreset);
                  else if (explorePresetsSidebar === "custom") cards = cards.filter(c => !c.isPreset);
                  else if (explorePresetsSidebar === "created_by_me") cards = cards.filter(c => !c.isPreset && c.createdBy === "Ahtisham Ahmad");
                  else if (explorePresetsSidebar === "vendors_applied") cards = cards.filter(c => c.partnerCount >= 3);

                  if (explorePresetsSearch.trim()) {
                    const q = explorePresetsSearch.toLowerCase();
                    cards = cards.filter(c =>
                      c.name.toLowerCase().includes(q) ||
                      c.category.toLowerCase().includes(q) ||
                      c.basis.toLowerCase().includes(q) ||
                      c.description.toLowerCase().includes(q) ||
                      c.ruleNo.toLowerCase().includes(q) ||
                      c.createdBy.toLowerCase().includes(q)
                    );
                  }

                  const sorted = [...cards].sort((a, b) => {
                    let cmp = 0;
                    if (exploreSortBy === "name") cmp = a.name.localeCompare(b.name);
                    else if (exploreSortBy === "vendorsApplied") cmp = a.partnerCount - b.partnerCount;
                    else if (exploreSortBy === "category") cmp = a.category.localeCompare(b.category);
                    else if (exploreSortBy === "basis") cmp = a.basis.localeCompare(b.basis);
                    return exploreSortDir === "asc" ? cmp : -cmp;
                  });

                  if (sorted.length === 0) {
                    return (
                      <div className="py-20 text-center">
                        <div className="w-12 h-12 rounded-lg bg-muted border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                          <Search className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-[13px] text-muted-foreground" style={{ fontWeight: 600 }}>No pricing rules found</p>
                        <p className="text-[12px] text-slate-400 mt-1">Try adjusting your search or filter</p>
                      </div>
                    );
                  }

                  return (
                    <div className="@container/prgrid">
                      <div className="grid grid-cols-1 @[400px]/prgrid:grid-cols-2 @[750px]/prgrid:grid-cols-3 auto-rows-fr gap-4">
                        {sorted.map((card) => {
                          const preset = PRICING_RULE_PRESETS.find((p) => p.id === card.id);
                          const cloneIntoForm = () => {
                            if (preset) {
                              setExplorePresetsOpen(false);
                              setExplorePresetsFullscreen(false);
                              applyPricingTemplateFromPreset(preset);
                            } else {
                              duplicateCardIntoForm(card);
                            }
                          };
                          return (
                          <PricingRuleCard
                            key={card.id}
                            rule={card}
                            onClick={cloneIntoForm}
                            onApply={cloneIntoForm}
                            onDuplicate={() => duplicateCardIntoForm(card)}
                          />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PricingRuleCreateModal;
