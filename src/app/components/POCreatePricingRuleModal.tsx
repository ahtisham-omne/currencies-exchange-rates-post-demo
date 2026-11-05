/* ═══════════════════════════════════════════════════════════════════════════
 *  POCreatePricingRuleModal — Sales Orders V5 "Create Pricing Rule" port
 *  ──────────────────────────────────────────────────────────────────────
 *  Two-step wizard that mirrors SO's `CreatePricingRuleModal`:
 *
 *    Step 1 · Rule Setup
 *      · Type cards — Discount / Premium (green/violet)
 *      · Basis pills — Volume-Based / Value-Based
 *      · Details card — Name, Description, Limit to Date Range toggle
 *      · Tiers list — add/remove, per-tier %/$ toggle, order-qty/value
 *        limits toggle with min/max
 *
 *    Step 2 · Items & Attachments
 *      · Summary banner with the rule's headline shape + "Edit Setup"
 *      · Tabs — Items / Categories / Attachments (empty states)
 *
 *  Footer:
 *    Step 1 → Cancel · Continue (disabled until name)
 *    Step 2 → Back · Discard · Save Rule
 *
 *  Save calls createCustomRuleForVendor with the current vendor so the
 *  rule shows up in the manage modal's Applied set immediately after
 *  the parent re-derives.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  Info,
  Check,
  ChevronRight,
  ArrowLeft,
  Plus,
  TrendingDown,
  TrendingUp,
  BarChart3,
  DollarSign,
  Search,
  Upload,
  Package,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./ui/tooltip";
import {
  createCustomRuleForVendor,
  updateCustomRule,
  type PricingRuleTier,
  type VendorPricingRule,
} from "./poPricingRulesData";
import { CATALOG, type CatalogItem } from "./catalogData";

export interface POCreatePricingRulePrefill {
  name?: string;
  description?: string;
  type?: "discount" | "premium";
  tiers?: PricingRuleTier[];
  appliesToItemCodes?: string[];
  validFrom?: string;
  validTo?: string | null;
}

export interface POCreatePricingRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  /** Optional seed values — supplied by the Browse Templates modal's
   *  Duplicate action so the buyer opens the form with the source
   *  rule's shape and can tweak from there. Also used by Edit Rule
   *  (kebab menu) — when accompanied by `editingRuleId`, Save Rule
   *  overwrites that rule instead of creating a new one. */
  prefill?: POCreatePricingRulePrefill;
  /** When set, the wizard runs in Edit mode: header CTAs read
   *  "Save Changes", Save calls `updateCustomRule(editingRuleId, …)`
   *  instead of `createCustomRuleForVendor`. The rule must be a
   *  custom rule — templates are gated in the manage modal. Fires
   *  the same `onCreated` callback on success so parent nonce logic
   *  is unchanged. */
  editingRuleId?: string;
  onCreated?: (rule: VendorPricingRule) => void;
}

type RuleCategory = "discount" | "premium";
type RuleBasis = "volume" | "value";

interface TierDraft {
  rate: string;
  fixRate: boolean;
  qtyLimits: boolean;
  minQty: string;
  maxQty: string;
}

const makeTier = (): TierDraft => ({
  rate: "",
  fixRate: false,
  qtyLimits: false,
  minQty: "",
  maxQty: "",
});

/* Compact %/$ pill toggle — inlined from SO's PctAmountToggle. */
function PctAmountToggle({
  isFixed,
  onChange,
}: {
  isFixed: boolean;
  onChange: (fixed: boolean) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md bg-slate-50 border border-slate-200 p-0.5">
      {(["pct", "amt"] as const).map((key) => {
        const active = (key === "amt") === isFixed;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key === "amt")}
            className={`inline-flex items-center justify-center w-[26px] h-[22px] rounded text-[11px] transition-all cursor-pointer ${
              active ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
            style={{ fontWeight: active ? 600 : 500 }}
          >
            {key === "pct" ? "%" : "$"}
          </button>
        );
      })}
    </div>
  );
}

/* Small info tooltip trigger — inlined from SO's InfoTooltip. */
function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Info className="w-3 h-3 text-slate-300 cursor-help" />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[240px] text-[11px] leading-[1.5]"
      >
        <p className="text-slate-500">{children}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function POCreatePricingRuleModal({
  open,
  onOpenChange,
  vendorName,
  prefill,
  editingRuleId,
  onCreated,
}: POCreatePricingRuleModalProps) {
  const isEditMode = !!editingRuleId;
  const [step, setStep] = useState<1 | 2>(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RuleCategory>("discount");
  const [basis, setBasis] = useState<RuleBasis>("volume");
  const [limitDate, setLimitDate] = useState(false);
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [tiers, setTiers] = useState<TierDraft[]>([makeTier()]);
  const [itemsTab, setItemsTab] = useState<"items" | "categories" | "attachments">("items");
  /* Items + Categories assignment — Step 2 lists what's assigned and
     the Add Items / Add Categories pickers stage a selection first,
     then commit in one shot (SO parity). */
  const [selectedItems, setSelectedItems] = useState<CatalogItem[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [itemPickerSearch, setItemPickerSearch] = useState("");
  const [catPickerSearch, setCatPickerSearch] = useState("");
  const [itemPickerStaged, setItemPickerStaged] = useState<Set<string>>(new Set());
  const [catPickerStaged, setCatPickerStaged] = useState<Set<string>>(new Set());
  /* Dirty flag + discard confirmation state (buyer 2026-07-29 bug:
     "show the discard/unsaved-changes alert when closing with edits").
     Follows the codebase's nested-discard convention: a scoped
     absolute-inset overlay on top of this modal's content — never the
     page-level ConfirmDiscardModal (see memory
     `feedback-nested-discard-overlay.md`). `dirty` flips true on any
     buyer input; the initial hydration effect resets it. */
  const [dirty, setDirty] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  /* Hydration guard — flipped on the first render pass after `open`
     goes true so the seed-from-prefill useEffect doesn't count as an
     edit. Every subsequent form-state change triggers the dirty
     watcher below. */
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setItemsTab("items");
    setFullscreen(false);
    if (prefill) {
      setName(prefill.name ?? "");
      setDescription(prefill.description ?? "");
      setCategory(prefill.type ?? "discount");
      /* Basis is inferred from the first tier's unit: % → volume,
         $ → value. Matches SO's `basis` field semantics. */
      const firstUnit = prefill.tiers?.[0]?.unit;
      setBasis(firstUnit === "$" ? "value" : "volume");
      setLimitDate(!!(prefill.validFrom || prefill.validTo));
      setValidFrom(prefill.validFrom ?? "");
      setValidTo(prefill.validTo ?? "");
      setTiers(
        prefill.tiers && prefill.tiers.length > 0
          ? prefill.tiers.map((t) => ({
              rate: String(t.rate),
              fixRate: t.unit === "$",
              qtyLimits: t.minQty !== 1 || t.maxQty !== null,
              minQty: String(t.minQty),
              maxQty: t.maxQty === null ? "" : String(t.maxQty),
            }))
          : [makeTier()],
      );
    } else {
      setName("");
      setDescription("");
      setCategory("discount");
      setBasis("volume");
      setLimitDate(false);
      setValidFrom("");
      setValidTo("");
      setTiers([makeTier()]);
    }
    /* Step 2 assignments. In Edit mode we hydrate `selectedItems`
       from the source rule's `appliesToItemCodes` so the buyer sees
       what's currently attached and can add/remove. Duplicate/Create
       paths keep the SO behavior — start empty (rule shape only). */
    if (isEditMode && prefill?.appliesToItemCodes && prefill.appliesToItemCodes.length > 0) {
      const codes = new Set(prefill.appliesToItemCodes);
      setSelectedItems(CATALOG.filter((c) => codes.has(c.itemNumber)));
    } else {
      setSelectedItems([]);
    }
    setSelectedCats([]);
    setItemSearch("");
    setCatSearch("");
    setItemPickerStaged(new Set());
    setCatPickerStaged(new Set());
    setItemPickerSearch("");
    setCatPickerSearch("");
    setConfirmDiscardOpen(false);
    /* Reset dirty AFTER the hydration setters above so the initial
       fill isn't mistaken for a buyer edit. React batches these state
       updates so `dirty` lands false on the next render. */
    setDirty(false);
    hydratedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Dirty watcher — every buyer-editable field is a dep. First pass
     after modal open flips hydratedRef true; every pass after that
     marks the form dirty. Cheaper than wrapping every setter. */
  useEffect(() => {
    if (!open) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    setDirty(true);
  }, [
    open,
    name,
    description,
    category,
    basis,
    limitDate,
    validFrom,
    validTo,
    tiers,
    selectedItems,
    selectedCats,
  ]);

  /* Item + Category listings for Step 2 body — filter the "already
     assigned" list against the top search. Picker modals filter the
     "available" list (everything minus what's already assigned). */
  const filteredSelectedItems = useMemo(() => {
    if (!itemSearch.trim()) return selectedItems;
    const q = itemSearch.toLowerCase();
    return selectedItems.filter(
      (i) =>
        i.itemNumber.toLowerCase().includes(q) ||
        i.descriptiveName.toLowerCase().includes(q),
    );
  }, [selectedItems, itemSearch]);

  const filteredSelectedCats = useMemo(() => {
    if (!catSearch.trim()) return selectedCats;
    const q = catSearch.toLowerCase();
    return selectedCats.filter((c) => c.toLowerCase().includes(q));
  }, [selectedCats, catSearch]);

  const AVAILABLE_CATS = useMemo(() => {
    const set = new Set<string>();
    for (const item of CATALOG) if (item.category) set.add(item.category);
    return Array.from(set).sort();
  }, []);

  const availableItemsFiltered = useMemo(() => {
    const selectedIds = new Set(selectedItems.map((i) => i.id));
    let items = CATALOG.filter((i) => !selectedIds.has(i.id));
    if (itemPickerSearch.trim()) {
      const q = itemPickerSearch.toLowerCase();
      items = items.filter(
        (i) =>
          i.itemNumber.toLowerCase().includes(q) ||
          i.descriptiveName.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      );
    }
    return items;
  }, [selectedItems, itemPickerSearch]);

  const availableCatsFiltered = useMemo(() => {
    const selectedSet = new Set(selectedCats);
    let cats = AVAILABLE_CATS.filter((c) => !selectedSet.has(c));
    if (catPickerSearch.trim()) {
      const q = catPickerSearch.toLowerCase();
      cats = cats.filter((c) => c.toLowerCase().includes(q));
    }
    return cats;
  }, [selectedCats, AVAILABLE_CATS, catPickerSearch]);

  /* Item-count preview per category — helps the buyer see how many
     SKUs will be swept in when they attach a category. */
  const catItemCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of CATALOG) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return map;
  }, []);

  const isDis = category === "discount";
  const accent = isDis
    ? { main: "#16A34A", darker: "#15803D", light: "#DCFCE7", lightest: "#F0FDF4", border: "#BBF7D0", borderDeep: "#86EFAC" }
    : { main: "#8B5CF6", darker: "#6D28D9", light: "#EDE9FE", lightest: "#F5F3FF", border: "#DDD6FE", borderDeep: "#C4B5FD" };

  function updateTier(idx: number, patch: Partial<TierDraft>) {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function addTier() {
    setTiers((prev) => [...prev, makeTier()]);
  }
  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  }
  /* Close with dirty-check (buyer 2026-07-29). Any edit path (X, esc,
     backdrop, Discard button, dialog-onOpenChange) funnels through
     here so the confirm overlay always fires when there are unsaved
     edits. `hardClose` bypasses the check — used by Save success + the
     confirm overlay's Discard button. */
  function requestClose() {
    if (dirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    hardClose();
  }
  function hardClose() {
    setConfirmDiscardOpen(false);
    setDirty(false);
    onOpenChange(false);
    setFullscreen(false);
  }

  function handleSave() {
    if (!name.trim()) return;
    const parsedTiers: PricingRuleTier[] = tiers
      .map((t) => {
        const rate = parseFloat(t.rate);
        if (Number.isNaN(rate) || rate <= 0) return null;
        const minQty = t.qtyLimits ? parseFloat(t.minQty) || 1 : 1;
        const maxQty = t.qtyLimits && t.maxQty.trim() ? parseFloat(t.maxQty) : null;
        return {
          minQty,
          maxQty,
          rate,
          unit: t.fixRate ? "$" : ("%" as const),
        } satisfies PricingRuleTier;
      })
      .filter((t): t is PricingRuleTier => t !== null);
    if (parsedTiers.length === 0) {
      toast.error("Add at least one tier with a rate greater than zero.");
      return;
    }
    /* Sweep in item codes from selected items + every SKU inside each
       selected category so the resulting rule is applied broadly. If
       the buyer skipped Step 2, the rule lands with an empty
       applies-to list (no line ever triggers it) — same behavior as
       SO. */
    const codesFromCats = selectedCats.length
      ? CATALOG.filter((i) => selectedCats.includes(i.category)).map((i) => i.itemNumber)
      : [];
    const appliesToItemCodes = Array.from(
      new Set<string>([
        ...selectedItems.map((i) => i.itemNumber),
        ...codesFromCats,
      ]),
    );

    /* Edit vs Create split (buyer 2026-07-29 bug: "Edit says 'coming
       soon'"). In Edit mode we overwrite the source rule in place so
       it keeps its id + activation state on every PO that references
       it. Create keeps SO's behavior — push a new custom rule. */
    const persisted = isEditMode
      ? updateCustomRule(editingRuleId!, {
          name,
          description,
          type: category,
          tiers: parsedTiers,
          appliesToItemCodes,
          validFrom: limitDate ? validFrom : undefined,
          validTo: limitDate ? validTo : null,
        })
      : createCustomRuleForVendor(vendorName, {
          name,
          description,
          type: category,
          tiers: parsedTiers,
          appliesToItemCodes,
          validFrom: limitDate ? validFrom : undefined,
          validTo: limitDate ? validTo : null,
        });
    if (!persisted) {
      toast.error(
        isEditMode
          ? "Could not save changes. Template rules can't be edited — duplicate them first."
          : "Could not create the pricing rule.",
      );
      return;
    }
    toast.success(
      isEditMode
        ? `Changes to "${persisted.name}" saved.`
        : `"${persisted.name}" was added to ${vendorName}.`,
    );
    onCreated?.(persisted);
    hardClose();
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : requestClose())}>
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
                  width: "min(65vw, 960px)",
                  maxWidth: "calc(100% - 2rem)",
                  height: "auto",
                  maxHeight: "90vh",
                  borderRadius: 16,
                  boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18)",
                }
          }
        >
          <DialogTitle className="sr-only">{isEditMode ? "Edit Pricing Rule" : "Create New Pricing Rule"}</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new pricing rule for {vendorName}.
          </DialogDescription>

          {/* Header */}
          <div className="px-5 pt-4 pb-0 shrink-0 bg-white rounded-t-2xl border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[17px] text-slate-900" style={{ fontWeight: 700 }}>
                    {isEditMode ? "Edit Pricing Rule" : prefill ? "Duplicate Pricing Rule" : "Create New Pricing Rule"}
                  </h2>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] text-slate-500"
                    style={{ fontWeight: 500 }}
                  >
                    <BarChart3 className="w-3 h-3" /> Vendor Pricing Rule
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                  Configure the type, tiers, and assign items for the new rule on{" "}
                  <span className="text-slate-700" style={{ fontWeight: 500 }}>
                    {vendorName}
                  </span>
                  .
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setFullscreen((f) => !f)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {fullscreen ? "Exit full" : "Full view"}
                </button>
                <button
                  onClick={requestClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Step tabs */}
            <div className="flex items-center gap-6 mt-3.5 -mb-px">
              {[
                { num: 1 as const, label: "Rule Setup", active: step === 1, completed: step === 2 },
                { num: 2 as const, label: "Items & Attachments", active: step === 2, completed: false },
              ].map((tab) => (
                <div
                  key={tab.num}
                  className={`relative flex items-center gap-2 pb-3 ${
                    tab.num < step || (tab.num === 2 && step === 1 && name.trim())
                      ? "cursor-pointer"
                      : "cursor-default"
                  }`}
                  onClick={() => {
                    if (tab.num < step) setStep(tab.num);
                    if (tab.num === 2 && step === 1 && name.trim()) setStep(2);
                  }}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] shrink-0 transition-all duration-200 ${
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
                    className={`text-[13px] whitespace-nowrap transition-colors ${
                      tab.active
                        ? "text-primary"
                        : tab.completed
                          ? "text-emerald-500"
                          : "text-slate-700"
                    }`}
                    style={{ fontWeight: tab.active || tab.completed ? 600 : 500 }}
                  >
                    {tab.label}
                  </span>
                  {(tab.active || tab.completed) && (
                    <div
                      className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${
                        tab.completed ? "bg-emerald-500" : "bg-primary"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC]">
            <div className="px-4 py-4">
              {step === 1 && (
                <div className="space-y-5">
                  {/* Type */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                        Pricing Rule Type
                      </span>
                      <InfoTip>Discount lowers prices, Premium adds markup. Hover for details.</InfoTip>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(["discount", "premium"] as const).map((c) => {
                        const isSel = category === c;
                        const isDiscount = c === "discount";
                        const cAccent = isDiscount
                          ? { border: "#86EFAC", ring: "#BBF7D0", from: "#DCFCE7", to: "#BBF7D0", icon: "#15803D", text: "#166534", sub: "#22C55E", radio: "#16A34A" }
                          : { border: "#C4B5FD", ring: "#DDD6FE", from: "#EDE9FE", to: "#DDD6FE", icon: "#6D28D9", text: "#5B21B6", sub: "#8B5CF6", radio: "#8B5CF6" };
                        return (
                          <div
                            key={c}
                            onClick={() => setCategory(c)}
                            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                              isSel ? "bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]" : "bg-white hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.10)]"
                            }`}
                            style={{ borderColor: isSel ? cAccent.border : "#E2E8F0" }}
                          >
                            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                              <div
                                className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                                style={{ background: `linear-gradient(135deg, ${cAccent.from}, ${cAccent.to})`, color: cAccent.icon }}
                              >
                                {isDiscount ? <TrendingDown className="w-[18px] h-[18px]" /> : <TrendingUp className="w-[18px] h-[18px]" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className="text-[13px]"
                                  style={{ fontWeight: 600, color: isSel ? cAccent.text : "#0F172A" }}
                                >
                                  {isDiscount ? "Discount" : "Premium"}
                                </p>
                                <p
                                  className="text-[11px] mt-0.5 truncate"
                                  style={{ color: isSel ? cAccent.sub : "#94A3B8" }}
                                >
                                  {isDiscount ? "Lower price adjustment" : "Higher price adjustment"}
                                </p>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                                  isSel ? "" : "border-[1.5px] border-slate-300 bg-white"
                                }`}
                                style={isSel ? { backgroundColor: cAccent.radio, boxShadow: `0 0 0 2px ${cAccent.ring}` } : {}}
                              >
                                {isSel && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Basis pills */}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[12px] text-slate-500 mr-1" style={{ fontWeight: 500 }}>
                        Basis:
                      </span>
                      {(["volume", "value"] as const).map((b) => {
                        const active = basis === b;
                        return (
                          <button
                            key={b}
                            onClick={() => {
                              if (basis !== b) {
                                setBasis(b);
                                setTiers((prev) => prev.map((t) => ({ ...t, minQty: "", maxQty: "" })));
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap cursor-pointer ${
                              active
                                ? "border-primary bg-blue-50 text-primary"
                                : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                            }`}
                            style={{ fontWeight: active ? 600 : 500 }}
                          >
                            {b === "volume" ? <BarChart3 className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                            {b === "volume" ? "Volume-Based" : "Value-Based"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Details */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                        Pricing Rule Details
                      </span>
                      <InfoTip>Name and description are shown on POs and vendor invoices.</InfoTip>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            className="text-[12px] text-slate-900 mb-1.5 block"
                            style={{ fontWeight: 600 }}
                          >
                            {isDis ? "Discount" : "Premium"} Name
                          </label>
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={
                              isDis ? "e.g. GM Fleet Volume Break Q4" : "e.g. Expedited Build Premium"
                            }
                            className="rounded-lg border-slate-200 bg-white text-[13px]"
                          />
                        </div>
                        <div>
                          <label
                            className="text-[12px] text-slate-900 mb-1.5 block"
                            style={{ fontWeight: 600 }}
                          >
                            Description
                          </label>
                          <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief summary of what this rule covers."
                            className="rounded-lg border-slate-200 bg-white text-[13px]"
                          />
                        </div>
                      </div>

                      {/* Date range */}
                      <div>
                        <div className="flex items-center gap-2.5">
                          <Switch checked={limitDate} onCheckedChange={setLimitDate} />
                          <span className="text-[13px] text-slate-900" style={{ fontWeight: 500 }}>
                            Limit Rule to Date Range
                          </span>
                        </div>
                        {limitDate && (
                          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100">
                            <div>
                              <label
                                className="text-[12px] text-slate-900 mb-1.5 block"
                                style={{ fontWeight: 600 }}
                              >
                                Valid From
                              </label>
                              <Input
                                type="date"
                                value={validFrom}
                                onChange={(e) => setValidFrom(e.target.value)}
                                className="rounded-lg border-slate-200 bg-white text-[13px]"
                              />
                            </div>
                            <div>
                              <label
                                className="text-[12px] text-slate-900 mb-1.5 block"
                                style={{ fontWeight: 600 }}
                              >
                                Valid To
                              </label>
                              <Input
                                type="date"
                                value={validTo}
                                onChange={(e) => setValidTo(e.target.value)}
                                className="rounded-lg border-slate-200 bg-white text-[13px]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tiers */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-slate-900" style={{ fontWeight: 600 }}>
                          {isDis ? "Discount" : "Premium"} Tiers
                        </span>
                        <span
                          className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded"
                          style={{ fontWeight: 600 }}
                        >
                          {tiers.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {tiers.map((tier, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border bg-white overflow-hidden transition-all"
                          style={{ borderColor: tier.qtyLimits ? accent.border : "#E2E8F0" }}
                        >
                          <div
                            className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100"
                            style={{ backgroundColor: accent.lightest }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white"
                                style={{ fontWeight: 700, backgroundColor: accent.main }}
                              >
                                {idx + 1}
                              </span>
                              <span className="text-[12px] text-slate-900" style={{ fontWeight: 600 }}>
                                Tier {idx + 1}
                              </span>
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
                          <div className="px-3.5 py-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <label
                                    className="text-[12px] text-slate-900"
                                    style={{ fontWeight: 500 }}
                                  >
                                    {isDis ? "Discount" : "Premium"} {tier.fixRate ? "Amount" : "Rate"}
                                  </label>
                                  <PctAmountToggle
                                    isFixed={tier.fixRate}
                                    onChange={(fixed) => updateTier(idx, { fixRate: fixed })}
                                  />
                                </div>
                                <div className="relative">
                                  {tier.fixRate && (
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">
                                      $
                                    </span>
                                  )}
                                  <Input
                                    value={tier.rate}
                                    onChange={(e) => updateTier(idx, { rate: e.target.value })}
                                    placeholder={tier.fixRate ? "e.g. 25.00" : "e.g. 5"}
                                    className={`rounded-lg border-slate-200 bg-white text-[13px] h-9 ${
                                      tier.fixRate ? "pl-7 pr-3" : "pr-8"
                                    }`}
                                  />
                                  {!tier.fixRate && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">
                                      %
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-end h-full pb-[7px]">
                                <label
                                  className="flex items-center gap-2 cursor-pointer select-none"
                                  onClick={() => updateTier(idx, { qtyLimits: !tier.qtyLimits })}
                                >
                                  <div
                                    className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${
                                      tier.qtyLimits
                                        ? "bg-primary"
                                        : "border-[1.5px] border-slate-300 bg-white hover:border-slate-400"
                                    }`}
                                  >
                                    {tier.qtyLimits && (
                                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                    )}
                                  </div>
                                  <span
                                    className="text-[12px] text-slate-700"
                                    style={{ fontWeight: 500 }}
                                  >
                                    {basis === "volume" ? "Order Qty Limits" : "Order Value Limits"}
                                  </span>
                                </label>
                              </div>
                            </div>

                            {tier.qtyLimits && (
                              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                                <div>
                                  <label
                                    className="text-[12px] text-slate-900 mb-1.5 block"
                                    style={{ fontWeight: 500 }}
                                  >
                                    {basis === "volume" ? "Min Qty" : "Min Order Value"}
                                  </label>
                                  <div className="relative">
                                    {basis === "value" && (
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">
                                        $
                                      </span>
                                    )}
                                    <Input
                                      value={tier.minQty}
                                      onChange={(e) => updateTier(idx, { minQty: e.target.value })}
                                      placeholder={basis === "volume" ? "e.g. 10" : "e.g. 1,000"}
                                      className={`rounded-lg border-slate-200 bg-white text-[13px] h-9 ${
                                        basis === "value" ? "pl-7" : ""
                                      }`}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label
                                    className="text-[12px] text-slate-900 mb-1.5 block"
                                    style={{ fontWeight: 500 }}
                                  >
                                    {basis === "volume" ? "Max Qty" : "Max Order Value"}
                                  </label>
                                  <div className="relative">
                                    {basis === "value" && (
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">
                                        $
                                      </span>
                                    )}
                                    <Input
                                      value={tier.maxQty}
                                      onChange={(e) => updateTier(idx, { maxQty: e.target.value })}
                                      placeholder={basis === "volume" ? "e.g. 50" : "e.g. 5,000"}
                                      className={`rounded-lg border-slate-200 bg-white text-[13px] h-9 ${
                                        basis === "value" ? "pl-7" : ""
                                      }`}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={addTier}
                      className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg border border-dashed text-[12px] transition-all cursor-pointer w-full justify-center"
                      style={{
                        fontWeight: 600,
                        borderColor: accent.border,
                        color: accent.darker,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = accent.lightest)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Tier
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  {/* Summary banner */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{ background: `linear-gradient(135deg, ${accent.light}, ${accent.borderDeep})`, color: accent.darker }}
                    >
                      {isDis ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>
                        {name || "Untitled Rule"}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {isDis ? "Discount" : "Premium"} · {basis === "volume" ? "Volume-Based" : "Value-Based"} ·{" "}
                        {tiers.length} tier{tiers.length !== 1 ? "s" : ""}
                        {tiers[0]?.rate
                          ? ` · ${tiers[0].fixRate ? "$" : ""}${tiers[0].rate}${tiers[0].fixRate ? "" : "%"}`
                          : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep(1)}
                      className="text-[11px] text-primary hover:text-[#0862D0] transition-colors cursor-pointer shrink-0"
                      style={{ fontWeight: 600 }}
                    >
                      Edit Setup
                    </button>
                  </div>

                  {/* Items / Categories / Attachments tabs */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="flex items-center gap-0 border-b border-slate-200 px-4">
                      {(
                        [
                          { key: "items", label: "Items" },
                          { key: "categories", label: "Categories" },
                          { key: "attachments", label: "Attachments" },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setItemsTab(t.key)}
                          className={`relative px-3 py-2.5 text-[12px] flex items-center transition-colors cursor-pointer ${
                            itemsTab === t.key ? "text-primary" : "text-slate-500 hover:text-slate-700"
                          }`}
                          style={{ fontWeight: itemsTab === t.key ? 600 : 500 }}
                        >
                          {t.label}
                          {itemsTab === t.key && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-primary" />
                          )}
                        </button>
                      ))}
                    </div>

                    {itemsTab === "items" && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                              value={itemSearch}
                              onChange={(e) => setItemSearch(e.target.value)}
                              placeholder="Search items to assign..."
                              className="pl-9 rounded-lg border-slate-200 bg-slate-50 text-[13px] h-9"
                            />
                          </div>
                          <button
                            onClick={() => {
                              setItemPickerSearch("");
                              setItemPickerStaged(new Set());
                              setShowItemPicker(true);
                            }}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-white text-[12px] shadow-sm transition-colors cursor-pointer"
                            style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0862D0")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0A77FF")}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Items
                          </button>
                        </div>
                        {selectedItems.length === 0 ? (
                          <div className="py-8 text-center">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3">
                              <Package className="w-5 h-5 text-slate-400" />
                            </div>
                            <p
                              className="text-[13px] text-slate-700 mb-1"
                              style={{ fontWeight: 600 }}
                            >
                              No items assigned yet
                            </p>
                            <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">
                              Search and add items that should be affected by this pricing rule.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                            {filteredSelectedItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                              >
                                <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                                  <Package className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p
                                    className="text-[12.5px] text-slate-900 truncate"
                                    style={{ fontWeight: 600 }}
                                  >
                                    {item.itemNumber}
                                  </p>
                                  <p className="text-[10.5px] text-slate-500 truncate">
                                    {item.descriptiveName}
                                  </p>
                                </div>
                                <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 shrink-0">
                                  {item.category}
                                </span>
                                <button
                                  onClick={() =>
                                    setSelectedItems((prev) => prev.filter((i) => i.id !== item.id))
                                  }
                                  className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                                  aria-label="Remove item"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            {itemSearch.trim() && filteredSelectedItems.length === 0 && (
                              <p className="text-[12px] text-slate-400 text-center py-6">
                                No assigned items match your search.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {itemsTab === "categories" && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                              value={catSearch}
                              onChange={(e) => setCatSearch(e.target.value)}
                              placeholder="Search categories to assign..."
                              className="pl-9 rounded-lg border-slate-200 bg-slate-50 text-[13px] h-9"
                            />
                          </div>
                          <button
                            onClick={() => {
                              setCatPickerSearch("");
                              setCatPickerStaged(new Set());
                              setShowCatPicker(true);
                            }}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-white text-[12px] shadow-sm transition-colors cursor-pointer"
                            style={{ backgroundColor: "#0A77FF", fontWeight: 600 }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0862D0")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0A77FF")}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Categories
                          </button>
                        </div>
                        {selectedCats.length === 0 ? (
                          <div className="py-8 text-center">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3">
                              <FolderOpen className="w-5 h-5 text-slate-400" />
                            </div>
                            <p
                              className="text-[13px] text-slate-700 mb-1"
                              style={{ fontWeight: 600 }}
                            >
                              No categories assigned yet
                            </p>
                            <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">
                              Assign categories to apply this rule to every item within them.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                            {filteredSelectedCats.map((cat) => (
                              <div
                                key={cat}
                                className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                              >
                                <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center shrink-0">
                                  <FolderOpen className="w-3.5 h-3.5 text-violet-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p
                                    className="text-[12.5px] text-slate-900 truncate"
                                    style={{ fontWeight: 600 }}
                                  >
                                    {cat}
                                  </p>
                                  <p className="text-[10.5px] text-slate-500 truncate">
                                    {catItemCount.get(cat) ?? 0} items
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    setSelectedCats((prev) => prev.filter((c) => c !== cat))
                                  }
                                  className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                                  aria-label="Remove category"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            {catSearch.trim() && filteredSelectedCats.length === 0 && (
                              <p className="text-[12px] text-slate-400 text-center py-6">
                                No assigned categories match your search.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {itemsTab === "attachments" && (
                      <div className="p-4">
                        <div className="py-8 text-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 border-dashed flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-5 h-5 text-slate-400" />
                          </div>
                          <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>
                            No attachments yet
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-[280px] mx-auto mb-3">
                            Upload supporting contracts, approval memos, or supplier confirmations.
                          </p>
                          <button
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
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

          {/* Footer */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-5 py-3 flex items-center justify-end gap-2.5 rounded-b-2xl">
            {step === 1 ? (
              <>
                <button
                  onClick={requestClose}
                  className="px-5 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (name.trim()) setStep(2);
                  }}
                  disabled={!name.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#0862D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Continue
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800 transition-colors mr-auto cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  onClick={requestClose}
                  className="px-5 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#0862D0] transition-colors shadow-sm cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Check className="w-3.5 h-3.5" /> {isEditMode ? "Save Changes" : "Save Rule"}
                </button>
              </>
            )}
          </div>

          {/* ── Discard confirm overlay (buyer 2026-07-29 bug: "show
              the discard/unsaved-changes alert when closing with
              edits"). Scoped absolute-inset per the codebase's nested
              discard convention — never the page-level ConfirmDiscardModal
              (see memory `feedback-nested-discard-overlay.md`). Fires
              only when `dirty` is true. */}
          {confirmDiscardOpen && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center"
              style={{
                /* Neutral grey scrim — buyer 2026-07-29 "grey instead of
                   blue" for the overlay behind the discard modal. Prior
                   rgba(15, 23, 42, …) was slate-900, which reads with a
                   cool/blue cast. Pure-black at 40% is chromatically
                   neutral and matches the app's other scrim conventions. */
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(2px)",
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Discard changes"
            >
              <div
                className="w-[380px] max-w-[92%] rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
                style={{ animation: "poCprMdIn 160ms cubic-bezier(0.16, 1, 0.3, 1)" }}
              >
                <style>{`
                  @keyframes poCprMdIn {
                    from { opacity: 0; transform: scale(0.96); }
                    to   { opacity: 1; transform: scale(1); }
                  }
                `}</style>
                <div className="px-5 pt-4 pb-3">
                  <h3 className="text-[15px] font-semibold text-slate-900 mb-1">
                    Discard unsaved changes?
                  </h3>
                  <p className="text-[13px] text-slate-500 leading-relaxed">
                    {isEditMode
                      ? "Your edits to this rule haven't been saved. Closing now will discard them."
                      : "You'll lose the pricing rule you've been building. This can't be undone."}
                  </p>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
                  <button
                    onClick={() => setConfirmDiscardOpen(false)}
                    className="px-4 py-1.5 rounded-md text-[13px] text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    Keep editing
                  </button>
                  <button
                    onClick={hardClose}
                    className="px-4 py-1.5 rounded-md text-[13px] bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
                    style={{ fontWeight: 600 }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Items picker — SO parity port. Stages the buyer's
          multi-select checkboxes and only commits when they hit
          "Add Selected". Available list hides items that are already
          assigned so it can't be added twice. ── */}
      <Dialog
        open={showItemPicker}
        onOpenChange={(v) => {
          if (!v) {
            setShowItemPicker(false);
            setItemPickerStaged(new Set());
          }
        }}
      >
        <DialogContent
          className="p-0 gap-0 border-0 flex flex-col overflow-hidden [&>[data-slot=dialog-close]]:hidden [&>button.absolute]:hidden"
          style={{
            maxWidth: "min(680px, calc(100vw - 2rem))",
            width: "calc(100% - 2rem)",
            maxHeight: "min(640px, 85vh)",
            height: "min(640px, 85vh)",
            borderRadius: 16,
            boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18)",
          }}
        >
          <DialogTitle className="sr-only">Add items to pricing rule</DialogTitle>
          <DialogDescription className="sr-only">
            Select one or more items to attach to this pricing rule.
          </DialogDescription>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EEF2F6] shrink-0">
            <div className="min-w-0">
              <h3 className="text-[14px] text-slate-900" style={{ fontWeight: 600 }}>
                Add Items
              </h3>
              <p className="text-[11px] text-slate-500" style={{ fontWeight: 400 }}>
                Pick the items this pricing rule should affect.
              </p>
            </div>
            <button
              onClick={() => {
                setShowItemPicker(false);
                setItemPickerStaged(new Set());
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-3 border-b border-[#EEF2F6] shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={itemPickerSearch}
                onChange={(e) => setItemPickerSearch(e.target.value)}
                placeholder="Search by part number, description, category..."
                className="pl-9 rounded-lg border-slate-200 bg-white text-[12.5px] h-9"
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
            {availableItemsFiltered.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                  No items match your search
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {availableItemsFiltered.map((item) => {
                  const isStaged = itemPickerStaged.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                        isStaged ? "bg-blue-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isStaged}
                        onChange={() => {
                          setItemPickerStaged((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/30"
                      />
                      <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[12.5px] text-slate-900 truncate"
                          style={{ fontWeight: 600 }}
                        >
                          {item.itemNumber}
                        </p>
                        <p className="text-[10.5px] text-slate-500 truncate">
                          {item.descriptiveName}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 shrink-0">
                        {item.category}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#EEF2F6] shrink-0 bg-slate-50/40">
            <span
              className="text-[11.5px] text-slate-500"
              style={{ fontWeight: 500 }}
            >
              {itemPickerStaged.size > 0 ? (
                <>
                  <span className="text-slate-900">{itemPickerStaged.size}</span> selected
                </>
              ) : (
                <>Select items to add</>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowItemPicker(false);
                  setItemPickerStaged(new Set());
                }}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                disabled={itemPickerStaged.size === 0}
                onClick={() => {
                  const toAdd = CATALOG.filter((i) => itemPickerStaged.has(i.id));
                  setSelectedItems((prev) => [...prev, ...toAdd]);
                  toast.success(
                    `Added ${toAdd.length} item${toAdd.length !== 1 ? "s" : ""}`,
                  );
                  setShowItemPicker(false);
                  setItemPickerStaged(new Set());
                }}
                className="h-9 px-4 rounded-lg bg-primary text-white text-[12.5px] hover:bg-[#0862D0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                Add Selected{itemPickerStaged.size > 0 ? ` (${itemPickerStaged.size})` : ""}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Categories picker — same shape as the items modal,
          violet accent. Selecting a category attaches every SKU in
          that category to the rule on save. ── */}
      <Dialog
        open={showCatPicker}
        onOpenChange={(v) => {
          if (!v) {
            setShowCatPicker(false);
            setCatPickerStaged(new Set());
          }
        }}
      >
        <DialogContent
          className="p-0 gap-0 border-0 flex flex-col overflow-hidden [&>[data-slot=dialog-close]]:hidden [&>button.absolute]:hidden"
          style={{
            maxWidth: "min(680px, calc(100vw - 2rem))",
            width: "calc(100% - 2rem)",
            maxHeight: "min(640px, 85vh)",
            height: "min(640px, 85vh)",
            borderRadius: 16,
            boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18)",
          }}
        >
          <DialogTitle className="sr-only">Add categories to pricing rule</DialogTitle>
          <DialogDescription className="sr-only">
            Select one or more categories to attach to this pricing rule.
          </DialogDescription>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EEF2F6] shrink-0">
            <div className="min-w-0">
              <h3 className="text-[14px] text-slate-900" style={{ fontWeight: 600 }}>
                Add Categories
              </h3>
              <p className="text-[11px] text-slate-500" style={{ fontWeight: 400 }}>
                Pick the categories this pricing rule should affect.
              </p>
            </div>
            <button
              onClick={() => {
                setShowCatPicker(false);
                setCatPickerStaged(new Set());
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-3 border-b border-[#EEF2F6] shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={catPickerSearch}
                onChange={(e) => setCatPickerSearch(e.target.value)}
                placeholder="Search by name..."
                className="pl-9 rounded-lg border-slate-200 bg-white text-[12.5px] h-9"
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
            {availableCatsFiltered.length === 0 ? (
              <div className="py-12 text-center">
                <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                  No categories match your search
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {availableCatsFiltered.map((cat) => {
                  const isStaged = catPickerStaged.has(cat);
                  const itemCount = catItemCount.get(cat) ?? 0;
                  return (
                    <label
                      key={cat}
                      className={`flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                        isStaged ? "bg-violet-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isStaged}
                        onChange={() => {
                          setCatPickerStaged((prev) => {
                            const next = new Set(prev);
                            if (next.has(cat)) next.delete(cat);
                            else next.add(cat);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/30"
                      />
                      <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center shrink-0">
                        <FolderOpen className="w-3.5 h-3.5 text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[12.5px] text-slate-900 truncate"
                          style={{ fontWeight: 600 }}
                        >
                          {cat}
                        </p>
                        <p className="text-[10.5px] text-slate-500 truncate">
                          {itemCount} item{itemCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#EEF2F6] shrink-0 bg-slate-50/40">
            <span
              className="text-[11.5px] text-slate-500"
              style={{ fontWeight: 500 }}
            >
              {catPickerStaged.size > 0 ? (
                <>
                  <span className="text-slate-900">{catPickerStaged.size}</span> selected
                </>
              ) : (
                <>Select categories to add</>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowCatPicker(false);
                  setCatPickerStaged(new Set());
                }}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12.5px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                disabled={catPickerStaged.size === 0}
                onClick={() => {
                  const toAdd = Array.from(catPickerStaged);
                  setSelectedCats((prev) => [...prev, ...toAdd]);
                  toast.success(
                    `Added ${toAdd.length} categor${toAdd.length !== 1 ? "ies" : "y"}`,
                  );
                  setShowCatPicker(false);
                  setCatPickerStaged(new Set());
                }}
                className="h-9 px-4 rounded-lg bg-primary text-white text-[12.5px] hover:bg-[#0862D0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                Add Selected{catPickerStaged.size > 0 ? ` (${catPickerStaged.size})` : ""}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
