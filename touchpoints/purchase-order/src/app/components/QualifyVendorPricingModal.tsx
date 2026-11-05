/* ═══════════════════════════════════════════════════════════════
   Qualify Vendor — Pricing & ordering rules
   ─────────────────────────────────────────────────────────────
   Opens from the Items Detail Modal (OrderFlow) in two modes:
     · "qualify" — the buyer adds a vendor that is NOT yet qualified
       for the item (Add New Vendor / Enter unit price).
     · "edit" — every other price/unit change on an already-qualified
       vendor: the headline price pencil, a tier row's pencil, "Add
       another unit price", "+ Add price for other units", and picking
       an unpriced unit. There is no inline add/edit any more — all of
       it happens here so the ordering rules travel with the price.
       Edit mode is single-unit: editing shows only that unit's card,
       adding shows only the new unit's card (no Add another / Apply to
       all / remove). The caller merges the one card back into the
       vendor's full set. Ported from Partners'
   qualify-item Configure step (`Partners/.../PartnerItemsTab.tsx` —
   "Pricing & ordering rules" section) so the same selling-unit cards
   are used on both surfaces:

     · one card per selling unit — Price per unit + UoM picker, then
       Min Order / Max Order / Multiples / Accepted Deviation % / Lead
       Time underneath a dashed divider
     · "Add another" stacks a card for a different unit (independent
       price; quantity converts at PO time, price does not)
     · "Set as Primary" moves the primary marker; the primary unit is
       the one the PO line uses
     · "Apply to all" copies the unit-agnostic rules (deviation, lead
       time) across every card

   Warning modals carried over from the Partners qualify flow:
     · "Discard changes?" when closing with unsaved work. Rendered as
       an in-context overlay over this modal (not the page-level
       ConfirmDiscardModal), matching the nested-discard convention.

   UoM list: Partners ships its own mock roster; here we feed the same
   picker from the PO app's `uomRegistry` so conversion factors stay
   consistent with the rest of the PO flow.
   ═══════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Info,
  Layers,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "./ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { FONT } from "./designTokens";
import {
  UOM_REGISTRY,
  DIMENSION_LABELS,
  findUOM,
  getCompatibleUOMs,
  type UOMDimension,
} from "./uomRegistry";

/* ── Data model ─────────────────────────────────────────────── */

/** One selling-unit card. Strings while editing (same as Partners'
 *  `AdditionalPriceTier`); blank = no rule for that unit. */
export interface QualifySellingUnit {
  price: string;
  /** Carried through untouched for tiers that were added "for this PO
   *  only" — they stay off the vendor's master record. */
  poOnly?: boolean;
  uom: string;
  minOrderQty: string;
  maxOrderQty: string;
  multiples: string;
  acceptedDeviationPct: string;
  leadTimeDays: string;
}

export interface QualifyVendorPricingResult {
  units: QualifySellingUnit[];
  /** Index into `units` of the primary selling unit. */
  primaryIndex: number;
  /** Add mode only — "vendor" qualifies the new unit on the vendor's
   *  master record; "po" keeps it on this PO only (PO-only tier). */
  scope?: "vendor" | "po";
}

const blankUnit = (uom: string): QualifySellingUnit => ({
  price: "",
  uom,
  minOrderQty: "",
  maxOrderQty: "",
  multiples: "",
  acceptedDeviationPct: "",
  leadTimeDays: "",
});

/** Digits only (optionally one decimal point) — verbatim from Partners. */
function numericInput(raw: string, opts: { decimal?: boolean } = {}): string {
  if (opts.decimal) {
    const stripped = raw.replace(/[^0-9.]/g, "");
    const firstDot = stripped.indexOf(".");
    if (firstDot < 0) return stripped;
    return stripped.slice(0, firstDot + 1) + stripped.slice(firstDot + 1).replace(/\./g, "");
  }
  return raw.replace(/[^0-9]/g, "");
}

/** Short symbol for a unit — first short alias, else the name. */
function uomSymbol(name: string): string {
  const def = findUOM(name);
  const alias = def?.aliases?.find((a) => a.length <= 4);
  return alias ?? def?.name ?? name;
}

/** Min > Max is the one combination that can never be ordered. */
function minMaxError(u: QualifySellingUnit): string | null {
  if (!u.minOrderQty || !u.maxOrderQty) return null;
  return Number(u.minOrderQty) > Number(u.maxOrderQty) ? "Max order must be at least the min order." : null;
}

/* ── Small pieces (ported from Partners) ────────────────────── */

function FieldInfo({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-label="More info"
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-help align-middle"
        >
          <Info className="w-3 h-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[260px] text-[11px] leading-relaxed z-[300]">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

function PrimaryPill({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-[2px] rounded-md text-blue-800 bg-blue-50 border border-blue-200 text-[10px] ${className}`}
      style={{ fontWeight: 600 }}
    >
      <Star className="w-2.5 h-2.5 fill-blue-800 text-blue-800" />
      Primary
    </span>
  );
}

/** Searchable UoM picker — Partners' `UomPicker` chrome, fed from the
 *  PO `uomRegistry`. "Defined alternatives" = units compatible with the
 *  item's base unit; the rest are grouped by dimension underneath. */
function UomPicker({
  value,
  onChange,
  referenceUnit,
  disabledIds = new Set<string>(),
}: {
  value: string;
  onChange: (next: string) => void;
  referenceUnit?: string;
  disabledIds?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => { if (!open) setSearch(""); }, [open]);

  const highlight = (text: string) => {
    if (!search) return text;
    const idx = text.toLowerCase().indexOf(search.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-amber-100 text-foreground rounded-sm">{text.slice(idx, idx + search.length)}</mark>
        {text.slice(idx + search.length)}
      </>
    );
  };

  const defined = useMemo(() => getCompatibleUOMs(referenceUnit), [referenceUnit]);
  const othersByDimension = useMemo(() => {
    const definedNames = new Set(defined.map((u) => u.name));
    const map = new Map<UOMDimension, typeof UOM_REGISTRY>();
    UOM_REGISTRY.filter((u) => !definedNames.has(u.name)).forEach((u) => {
      const list = map.get(u.dimension) || [];
      list.push(u);
      map.set(u.dimension, list);
    });
    map.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [defined]);

  const renderItem = (name: string) => {
    const disabled = disabledIds.has(name) && name !== value;
    return (
      <CommandItem
        key={name}
        value={`${name} ${uomSymbol(name)}`}
        disabled={disabled}
        onSelect={() => {
          if (disabled) return;
          onChange(name);
          setOpen(false);
        }}
        className="flex items-center justify-between gap-2 py-1.5"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="truncate text-[12px]">{highlight(name)}</span>
          <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{highlight(uomSymbol(name))}</span>
        </span>
        {name === value && <Check className="w-3.5 h-3.5 text-primary" />}
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-between gap-2 h-9 text-[12px] w-[130px] border-0 border-l border-border rounded-none bg-[#FAFBFC] px-3 cursor-pointer"
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <span className="truncate">{value || "Choose unit"}</span>
            {value && <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>{uomSymbol(value)}</span>}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        data-nested-modal
        className="w-[300px] p-0 z-[280] border border-[#E8ECF1] rounded-xl shadow-[0_24px_56px_-12px_rgba(15,23,42,0.22)] overflow-hidden flex flex-col"
        style={{ fontFamily: FONT }}
      >
        <Command className="flex flex-col min-h-0">
          <div className="p-2 border-b border-[#F1F5F9] shrink-0 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <CommandPrimitive.Input
                placeholder="Search units..."
                value={search}
                onValueChange={setSearch}
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E8ECF1] bg-white text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-slate-300"
              />
            </div>
          </div>
          <CommandList className="max-h-[260px]">
            <CommandEmpty className="py-5 text-center text-[11px] text-slate-500">
              <p style={{ fontWeight: 500 }}>No matching unit.</p>
            </CommandEmpty>
            {defined.length > 0 && (
              <CommandGroup heading={<span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>Defined alternatives</span>}>
                {defined.map((u) => renderItem(u.name))}
              </CommandGroup>
            )}
            {Array.from(othersByDimension.entries()).map(([dim, units]) => (
              <CommandGroup
                key={dim}
                heading={<span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>{DIMENSION_LABELS[dim]}</span>}
              >
                {units.map((u) => renderItem(u.name))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ── Selling-unit card ──────────────────────────────────────── */

const PRICE_INFO = "The unit price this vendor charges for this item, expressed in the chosen unit of measure. The price does NOT convert between pack sizes, each pack carries its own rate. Quantities still convert at PO time.";

function SellingUnitCard({
  unit,
  isPrimary,
  canRemove,
  referenceUnit,
  takenUnits,
  onChange,
  onSetPrimary,
  onRemove,
}: {
  unit: QualifySellingUnit;
  isPrimary: boolean;
  canRemove: boolean;
  referenceUnit?: string;
  takenUnits: Set<string>;
  onChange: (patch: Partial<QualifySellingUnit>) => void;
  onSetPrimary: () => void;
  onRemove: () => void;
}) {
  const err = minMaxError(unit);
  return (
    <div className="rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-[#F1F5F9] bg-[#FAFBFC] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Vendor sells as</p>
          {isPrimary ? (
            <PrimaryPill className="shrink-0" />
          ) : (
            <button
              type="button"
              onClick={onSetPrimary}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-white text-[11px] text-slate-600 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
              style={{ fontWeight: 500 }}
              aria-label="Set as primary selling unit"
              title="Set as primary selling unit"
            >
              <Star className="w-3 h-3" />
              Set as Primary
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 h-5 px-2 rounded-md bg-[#EBF3FF] border border-blue-200 text-[11px] text-primary" style={{ fontWeight: 600 }}>
            {unit.uom}
            <span className="text-primary/55 text-[10px]" style={{ fontWeight: 500 }}>{uomSymbol(unit.uom)}</span>
          </span>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="w-6 h-6 rounded-md text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer flex items-center justify-center"
              title="Remove this selling unit"
              aria-label="Remove this selling unit"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="p-3 space-y-3">
        <div>
          <label className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
            Price per unit
            <FieldInfo content={PRICE_INFO} />
          </label>
          <div className="flex items-stretch rounded-lg border border-border overflow-hidden bg-white focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
            <span className="inline-flex items-center justify-center w-9 text-[12px] text-slate-400 bg-[#FAFBFC] border-r border-border" style={{ fontWeight: 500 }}>$</span>
            <input
              inputMode="decimal"
              value={unit.price}
              onChange={(e) => onChange({ price: numericInput(e.target.value, { decimal: true }) })}
              placeholder="0.00"
              className="h-9 px-3 text-[13px] border-0 outline-none bg-transparent flex-1 min-w-0 text-foreground"
            />
            <UomPicker
              value={unit.uom}
              onChange={(v) => onChange({ uom: v })}
              referenceUnit={referenceUnit}
              disabledIds={takenUnits}
            />
          </div>
        </div>
        <div className="border-t border-dashed border-[#E2E8F0]" />
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Min Order" info="Smallest quantity that can be ordered in a single PO line for this pack size. Orders below this are rejected at submit." value={unit.minOrderQty} placeholder="0" invalid={!!err} onChange={(v) => onChange({ minOrderQty: numericInput(v) })} />
          <NumField label="Max Order" info="Largest quantity that can be ordered in a single PO line. Leave blank for no cap. Useful when the vendor can't fulfil oversized requests in one go." value={unit.maxOrderQty} placeholder="0" invalid={!!err} onChange={(v) => onChange({ maxOrderQty: numericInput(v) })} />
          <NumField label="Multiples" info="Quantities must be a multiple of this number (e.g. 12 = case packs of 12). Set to 1 for any-quantity orders." value={unit.multiples} placeholder="1" onChange={(v) => onChange({ multiples: numericInput(v) })} />
        </div>
        {err && <p className="-mt-1.5 text-[11px] text-destructive" style={{ fontWeight: 500 }}>{err}</p>}
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Accepted Deviation %" info="Allowed over- or under-ship as a % of the ordered quantity. e.g. 5 means shipping within ±5% of the PO is accepted without exception." value={unit.acceptedDeviationPct} placeholder="0" suffix="%" onChange={(v) => onChange({ acceptedDeviationPct: numericInput(v, { decimal: true }) })} />
          <NumField label="Lead Time" info="Typical days between order placement and delivery for this pack size from this vendor. Drives promise dates and replenishment planning downstream." value={unit.leadTimeDays} placeholder="0" suffix="days" onChange={(v) => onChange({ leadTimeDays: numericInput(v) })} />
        </div>
      </div>
    </div>
  );
}

function NumField({
  label, info, value, placeholder, suffix, invalid, onChange,
}: {
  label: string; info: string; value: string; placeholder: string; suffix?: string; invalid?: boolean;
  onChange: (raw: string) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
        {label}
        <FieldInfo content={info} />
      </span>
      <div className="relative">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full h-9 px-3 rounded-md border bg-white text-[13px] text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20 ${invalid ? "border-destructive" : "border-border"} ${suffix ? (suffix === "%" ? "pr-7" : "pr-12") : ""}`}
        />
        {suffix && (
          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${suffix === "%" ? "text-[12px]" : "text-[11px]"}`} style={{ fontWeight: 500 }}>
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

/* ── Modal ──────────────────────────────────────────────────── */

export function QualifyVendorPricingModal({
  open,
  mode = "qualify",
  initialUnits,
  initialPrimaryIndex = 0,
  appendUnit,
  focusUnit,
  single: singleProp = false,
  otherUnits = [],
  vendorName,
  vendorAbbr,
  itemNumber,
  itemName,
  defaultUnit,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  mode?: "qualify" | "edit";
  /** Edit mode — the vendor's current selling units. */
  initialUnits?: QualifySellingUnit[];
  initialPrimaryIndex?: number;
  /** Append a fresh card on open ("Add another unit price"). A unit name
   *  pre-selects it; `true` picks the next free unit. */
  appendUnit?: string | true;
  /** Scroll to + highlight this unit's card on open (row pencil). */
  focusUnit?: string;
  /** Single-unit mode (edit / add one unit). `primaryIndex` in the
   *  result is 0 when the card is primary, -1 otherwise. */
  single?: boolean;
  /** Single mode: the vendor's other units — can't be picked again. */
  otherUnits?: string[];
  vendorName: string;
  vendorAbbr?: string;
  itemNumber: string;
  itemName?: string;
  /** Pre-selected unit on the first card (the item's vendor/stocking unit). */
  defaultUnit: string;
  onCancel: () => void;
  onConfirm: (result: QualifyVendorPricingResult) => void;
}) {
  const [units, setUnits] = useState<QualifySellingUnit[]>([blankUnit(defaultUnit)]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const cardRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const isEdit = mode === "edit";
  /* Qualifying a vendor uses the same single-unit "Add unit price"
     modal as adding a unit to a qualified vendor — one card, two scope
     buttons (this PO only / qualified vendor). */
  const single = singleProp || !isEdit;
  const [dirty, setDirty] = useState(false);
  const [exitWarnOpen, setExitWarnOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDraft, setBulkDraft] = useState({ acceptedDeviationPct: "", leadTimeDays: "" });

  // Fresh draft every time the modal opens for a vendor.
  useEffect(() => {
    if (!open) return;
    let seed = initialUnits && initialUnits.length > 0 ? initialUnits.map((u) => ({ ...u })) : [blankUnit(defaultUnit)];
    if (single && appendUnit) seed = [];
    let target: number | null = focusUnit ? seed.findIndex((u) => u.uom.toLowerCase() === focusUnit.toLowerCase()) : null;
    if (appendUnit) {
      const used = new Set([...seed.map((u) => u.uom), ...otherUnits].map((u) => u.toLowerCase()));
      const pick =
        (typeof appendUnit === "string" && !used.has(appendUnit.toLowerCase()) ? appendUnit : undefined) ??
        getCompatibleUOMs(defaultUnit).find((u) => !used.has(u.name.toLowerCase()))?.name ??
        UOM_REGISTRY.find((u) => !used.has(u.name.toLowerCase()))?.name;
      if (pick) {
        seed.push(blankUnit(pick));
        target = seed.length - 1;
      }
    }
    setUnits(seed);
    setPrimaryIndex(single ? (initialPrimaryIndex === 0 ? 0 : -1) : Math.min(Math.max(initialPrimaryIndex, 0), seed.length - 1));
    setHighlightIndex(single || target == null || target < 0 ? null : target);
    setDirty(false);
    setExitWarnOpen(false);
    setBulkOpen(false);
    setBulkDraft({ acceptedDeviationPct: "", leadTimeDays: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vendorName, defaultUnit]);

  // Bring the targeted card into view once it has rendered.
  useEffect(() => {
    if (!open || highlightIndex == null) return;
    const t = window.setTimeout(() => cardRefs.current[highlightIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
    return () => window.clearTimeout(t);
  }, [open, highlightIndex]);

  if (!open) return null;

  const patchUnit = (i: number, patch: Partial<QualifySellingUnit>) => {
    setUnits((prev) => prev.map((u, j) => (j === i ? { ...u, ...patch } : u)));
    setDirty(true);
  };
  const removeUnit = (i: number) => {
    setUnits((prev) => prev.filter((_, j) => j !== i));
    // Keep the primary marker on the same card; removing the primary
    // falls back to the first card.
    setPrimaryIndex((p) => (p === i ? 0 : p > i ? p - 1 : p));
    setHighlightIndex(null);
    setDirty(true);
  };
  const usedUnits = new Set(units.map((u) => u.uom));
  const nextUnit =
    getCompatibleUOMs(defaultUnit).find((u) => !usedUnits.has(u.name))?.name ??
    UOM_REGISTRY.find((u) => !usedUnits.has(u.name))?.name;
  const addUnit = () => {
    if (!nextUnit) return;
    setUnits((prev) => [...prev, blankUnit(nextUnit)]);
    setHighlightIndex(units.length);
    setDirty(true);
  };

  const hasErrors = units.some((u) => !!minMaxError(u));
  const handleCloseIntent = () => {
    if (dirty) setExitWarnOpen(true);
    else onCancel();
  };
  const isAdd = !isEdit || (single && !!appendUnit);
  const handleConfirm = (scope?: "vendor" | "po") => {
    if (hasErrors) return;
    onConfirm({ units, primaryIndex, ...(scope ? { scope } : {}) });
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", fontFamily: FONT }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleCloseIntent(); }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        if (exitWarnOpen) setExitWarnOpen(false);
        else handleCloseIntent();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isAdd ? `${vendorName} add unit price` : `${vendorName} unit prices`}
        className="relative w-[580px] max-w-[calc(100vw-32px)] rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden flex flex-col shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        style={{ maxHeight: "min(760px, 90vh)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#EEF2F6] shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-secondary border border-border shrink-0 text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>
              {vendorAbbr || vendorName.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] text-foreground truncate" style={{ fontWeight: 600 }}>{isAdd ? `${vendorName} · Add unit price` : single ? `${vendorName} · Edit unit price` : `${vendorName} · Unit prices`}</p>
              <p className="text-[12px] text-slate-500 truncate">
                {itemNumber}{itemName ? ` · ${itemName}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseIntent}
            className="flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Context note — amber for a not-yet-qualified vendor, neutral
            blue when editing an existing qualification. */}
        {isEdit ? (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-[#F5F9FF] px-3 py-2 shrink-0">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
            <p className="text-[12px] leading-4 text-slate-600">
              {single && appendUnit
                ? `Add it to ${vendorName}'s qualification for this item so it's available on future POs, or use it on this PO only.`
                : `Changes are saved to ${vendorName}'s qualification for this item and apply to this PO.`}
            </p>
          </div>
        ) : (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#B45309]" />
            <p className="text-[12px] leading-4 text-[#78350F]">
              {vendorName} isn't qualified for this item yet. Add the unit price to qualify them for this item, or use it on this PO only.
            </p>
          </div>
        )}

        {/* Pricing & ordering rules — Partners section chrome */}
        <div className="px-5 py-4 flex-1 min-h-0 overflow-y-auto">
          <div className="rounded-xl border border-blue-200 bg-white overflow-hidden flex flex-col">
            <div className="px-3.5 py-3 border-b border-blue-200 bg-[#F5F9FF] flex items-center gap-3 shrink-0">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#CFE6FF] border border-blue-200 shrink-0">
                <Tag className="w-3.5 h-3.5 text-primary" />
              </span>
              <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                <p className="text-[13px] text-primary" style={{ fontWeight: 600 }}>Pricing &amp; ordering rules</p>
                <span className="text-[11px] text-slate-400">·</span>
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  {single ? (isAdd ? "New selling unit" : "1 selling unit") : `${units.length} ${units.length === 1 ? "selling unit" : "selling units"}`}
                </span>
              </div>
              {units.length > 1 && !single && (
                <Popover open={bulkOpen} onOpenChange={setBulkOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-blue-200 bg-white text-[11px] text-primary hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                      style={{ fontWeight: 600 }}
                    >
                      <Layers className="w-3 h-3" />
                      Apply to all
                    </button>
                  </PopoverTrigger>
                  <PopoverContent data-nested-modal align="end" sideOffset={6} className="w-[320px] p-0 z-[260] border-[#E8ECF1] shadow-[0_12px_40px_-8px_rgba(15,23,42,0.18)]" style={{ fontFamily: FONT }}>
                    <div className="px-4 py-3 border-b border-[#EEF2F6] bg-[#FAFBFC] flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#EEF2FF] border border-[#E0E7FF] shrink-0">
                        <Layers className="w-3.5 h-3.5 text-[#4338CA]" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Apply to all packs</p>
                        <p className="text-[10px] text-slate-500 mt-px">Quantity rules stay per-unit, different units, different quantities.</p>
                      </div>
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>Deviation %</label>
                        <input inputMode="decimal" value={bulkDraft.acceptedDeviationPct} onChange={(e) => setBulkDraft((p) => ({ ...p, acceptedDeviationPct: numericInput(e.target.value, { decimal: true }) }))} placeholder="0" className="w-full h-8 px-2.5 rounded-md border border-border text-[12px] outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1" style={{ fontWeight: 500 }}>Lead Time (days)</label>
                        <input inputMode="numeric" value={bulkDraft.leadTimeDays} onChange={(e) => setBulkDraft((p) => ({ ...p, leadTimeDays: numericInput(e.target.value) }))} placeholder="0" className="w-full h-8 px-2.5 rounded-md border border-border text-[12px] outline-none focus:border-primary" />
                      </div>
                    </div>
                    <div className="px-4 py-2.5 border-t border-[#EEF2F6] bg-white flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setBulkDraft({ acceptedDeviationPct: "", leadTimeDays: "" })}
                        className="h-8 px-2.5 rounded-md text-[11px] text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUnits((prev) => prev.map((u) => ({
                            ...u,
                            acceptedDeviationPct: bulkDraft.acceptedDeviationPct.trim() ? bulkDraft.acceptedDeviationPct : u.acceptedDeviationPct,
                            leadTimeDays: bulkDraft.leadTimeDays.trim() ? bulkDraft.leadTimeDays : u.leadTimeDays,
                          })));
                          setDirty(true);
                          setBulkOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary hover:bg-[#086AE6] text-white text-[12px] cursor-pointer shadow-sm transition-colors"
                        style={{ fontWeight: 600 }}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Apply to {units.length} units
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="p-3 space-y-2.5 bg-white">
              {units.map((u, i) => (
                <div
                  key={i}
                  ref={(el) => { cardRefs.current[i] = el; }}
                  className={`rounded-lg transition-shadow ${i === highlightIndex ? "ring-2 ring-primary/40 ring-offset-1" : ""}`}
                >
                <SellingUnitCard
                  unit={u}
                  isPrimary={i === primaryIndex}
                  canRemove={units.length > 1 && !single}
                  referenceUnit={defaultUnit}
                  takenUnits={new Set([...otherUnits, ...units.filter((_, j) => j !== i).map((x) => x.uom)])}
                  onChange={(patch) => patchUnit(i, patch)}
                  onSetPrimary={() => { setPrimaryIndex(i); setDirty(true); }}
                  onRemove={() => removeUnit(i)}
                />
                </div>
              ))}
              {!single && <button
                type="button"
                disabled={!nextUnit}
                onClick={addUnit}
                className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] transition-colors ${!nextUnit ? "border-[#E8ECF1] text-slate-300 cursor-not-allowed" : "border-[#A8D2FF] bg-[#EBF3FF] text-primary hover:bg-[#CFE6FF] cursor-pointer"}`}
                style={{ fontWeight: 600 }}
                title={!nextUnit ? "All units of measure have been priced" : "Add a new row for a different UoM."}
              >
                <Plus className="w-3.5 h-3.5" />
                Add another
              </button>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#EEF2F6] bg-white px-5 py-3">
          {/* Add mode already has two actions — no Cancel (the header ✕
              closes, with the same discard prompt). */}
          {!isAdd && (
            <button
              type="button"
              onClick={handleCloseIntent}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
            >
              Cancel
            </button>
          )}
          {/* Add mode — same two scopes as the PO price prompt: this PO
              only (PO-only tier, vendor record untouched) or qualify the
              unit at the vendor level. */}
          {isAdd && (
            <button
              type="button"
              onClick={() => handleConfirm("po")}
              disabled={hasErrors}
              className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-primary/30 bg-white px-3.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              Add on This PO Only
            </button>
          )}
          <button
            type="button"
            onClick={() => handleConfirm(isAdd ? "vendor" : undefined)}
            disabled={hasErrors}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#0866DE] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
            {isAdd ? "Add to Qualified Vendor & Use Here" : single ? "Save unit price" : "Save unit prices"}
          </button>
        </div>

        {/* Exit warning — Partners' "Discard changes?" prompt, scoped
            to this modal as an in-context overlay. */}
        {exitWarnOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-2xl" onMouseDown={(e) => { if (e.target === e.currentTarget) setExitWarnOpen(false); }}>
            <div role="alertdialog" aria-label="Discard changes?" className="w-[360px] max-w-[calc(100%-32px)] rounded-2xl bg-white overflow-hidden shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]">
              <div className="relative flex flex-col items-center pt-8 pb-5" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                  <AlertTriangle className="w-7 h-7 text-destructive" />
                </div>
                <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Discard
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-7 pb-7">
                <p className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600 }}>Discard changes?</p>
                <p className="text-[13px] mt-2 max-w-[300px] text-muted-foreground" style={{ lineHeight: "1.65" }}>
                  {isEdit
                    ? (single && appendUnit ? `The new unit price for ${vendorName} won't be added. ` : `Your changes to ${vendorName}'s unit prices won't be saved. `)
                    : `The unit price for ${vendorName} won't be added and ${vendorName} won't be added to this item. `}
                  All unsaved changes will be lost. This action cannot be undone.
                </p>
                <div className="w-full mt-6 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setExitWarnOpen(false); onCancel(); }}
                    className="w-full h-11 text-[14px] rounded-xl cursor-pointer transition-colors hover:opacity-90 bg-destructive text-white"
                    style={{ fontWeight: 600 }}
                  >
                    Discard changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setExitWarnOpen(false)}
                    className="w-full h-11 text-[14px] rounded-xl cursor-pointer transition-colors bg-muted text-slate-700 hover:bg-muted/80"
                    style={{ fontWeight: 500 }}
                  >
                    Continue editing
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
