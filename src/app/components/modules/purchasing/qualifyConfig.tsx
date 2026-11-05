/**
 * qualifyConfig — helpers + constants + pickers for the "Add/Edit qualified
 * vendor" Configure step. Ported verbatim from the current Partner app
 * (Partner-Management---Vendor `PartnerItemsTab.tsx`) so the qualify flow uses
 * the exact same logic/components, just inverted (vendors-for-an-item).
 */
import React from "react";
import { ChevronDown, Search, Plus, Check, Info } from "lucide-react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

/**
 * Strips anything that isn't a digit (and optionally a single decimal
 * point) so the user can't type letters into a numeric field.
 */
export function numericInput(raw: string, opts: { decimal?: boolean } = {}): string {
  if (opts.decimal) {
    const stripped = raw.replace(/[^0-9.]/g, "");
    const firstDot = stripped.indexOf(".");
    if (firstDot < 0) return stripped;
    return stripped.slice(0, firstDot + 1) + stripped.slice(firstDot + 1).replace(/\./g, "");
  }
  return raw.replace(/[^0-9]/g, "");
}

/** "Defined Alternatives" — canonical short-list of UoMs surfaced first. */
export const QV_UOM_OPTIONS: { id: string; label: string; symbol: string }[] = [
  { id: "Each", label: "Each", symbol: "EA" },
  { id: "Box", label: "Box", symbol: "BX" },
  { id: "Case", label: "Case", symbol: "CS" },
  { id: "Pallet", label: "Pallet", symbol: "PL" },
  { id: "Kg", label: "Kilogram", symbol: "kg" },
  { id: "lb", label: "Pound", symbol: "lb" },
  { id: "Liter", label: "Liter", symbol: "L" },
  { id: "Roll", label: "Roll", symbol: "RL" },
  { id: "Pair", label: "Pair", symbol: "PR" },
  { id: "Foot", label: "Foot", symbol: "ft" },
  { id: "Meter", label: "Meter", symbol: "m" },
];

/** All other indexable units, grouped by base measure. */
export const QV_UOM_ALL_INDEXABLE: { id: string; label: string; symbol: string; group: string }[] = [
  { id: "Dozen", label: "Dozen", symbol: "doz", group: "Count" },
  { id: "Gross", label: "Gross", symbol: "gr", group: "Count" },
  { id: "Pack", label: "Pack", symbol: "pk", group: "Count" },
  { id: "Carton", label: "Carton", symbol: "ctn", group: "Count" },
  { id: "Bundle", label: "Bundle", symbol: "bdl", group: "Count" },
  { id: "Set", label: "Set", symbol: "set", group: "Count" },
  { id: "Sheet", label: "Sheet", symbol: "sh", group: "Count" },
  { id: "Unit", label: "Unit", symbol: "u", group: "Count" },
  { id: "Gram", label: "Gram", symbol: "g", group: "Mass" },
  { id: "Milligram", label: "Milligram", symbol: "mg", group: "Mass" },
  { id: "Ton", label: "Metric ton", symbol: "t", group: "Mass" },
  { id: "Ounce", label: "Ounce", symbol: "oz", group: "Mass" },
  { id: "STon", label: "Short ton", symbol: "ston", group: "Mass" },
  { id: "Milliliter", label: "Milliliter", symbol: "mL", group: "Volume" },
  { id: "Gallon", label: "Gallon", symbol: "gal", group: "Volume" },
  { id: "Quart", label: "Quart", symbol: "qt", group: "Volume" },
  { id: "Pint", label: "Pint", symbol: "pt", group: "Volume" },
  { id: "FluidOz", label: "Fluid ounce", symbol: "fl oz", group: "Volume" },
  { id: "Barrel", label: "Barrel", symbol: "bbl", group: "Volume" },
  { id: "CubicFt", label: "Cubic foot", symbol: "ft³", group: "Volume" },
  { id: "CubicM", label: "Cubic meter", symbol: "m³", group: "Volume" },
  { id: "Millimeter", label: "Millimeter", symbol: "mm", group: "Length" },
  { id: "Centimeter", label: "Centimeter", symbol: "cm", group: "Length" },
  { id: "Inch", label: "Inch", symbol: "in", group: "Length" },
  { id: "Yard", label: "Yard", symbol: "yd", group: "Length" },
  { id: "Mile", label: "Mile", symbol: "mi", group: "Length" },
  { id: "Kilometer", label: "Kilometer", symbol: "km", group: "Length" },
  { id: "SqFt", label: "Square foot", symbol: "ft²", group: "Area" },
  { id: "SqMeter", label: "Square meter", symbol: "m²", group: "Area" },
  { id: "SqYard", label: "Square yard", symbol: "yd²", group: "Area" },
  { id: "Acre", label: "Acre", symbol: "ac", group: "Area" },
  { id: "Hour", label: "Hour", symbol: "hr", group: "Time" },
  { id: "Day", label: "Day", symbol: "d", group: "Time" },
  { id: "Month", label: "Month", symbol: "mo", group: "Time" },
];

/** Lookup the display label/symbol for any UoM id. */
export function lookupUom(id: string): { id: string; label: string; symbol: string } {
  const defined = QV_UOM_OPTIONS.find((u) => u.id === id);
  if (defined) return defined;
  const indexable = QV_UOM_ALL_INDEXABLE.find((u) => u.id === id);
  if (indexable) return { id: indexable.id, label: indexable.label, symbol: indexable.symbol };
  return { id, label: id, symbol: id };
}

/** Maps short stocking units to UoM dropdown labels for sensible defaults. */
export const ON_HAND_UNIT_TO_UOM: Record<string, string> = {
  ea: "Each",
  pk: "Pack",
  sh: "Sheet",
  ft: "Foot",
  lb: "lb",
  gal: "Liter",
};

/** Shape of a pricing rule shown in the Configure step. Presets are shared
 *  rules (used by other vendors too); `custom: true` marks vendor-scoped
 *  rules minted in the qualify flow (copies + Create New) — those never
 *  trigger the shared-rule edit warning. */
export type QvPricingRule = {
  id: string;
  label: string;
  subtitle: string;
  type: "discount" | "premium";
  custom?: boolean;
};

/** Placeholder pricing-rule presets for the Configure step. */
export const QV_PRICING_RULE_PRESETS: QvPricingRule[] = [
  { id: "early-pay-2-10", label: "Early Payment Discount · 2/10", subtitle: "2% off if paid in 10 days", type: "discount" },
  { id: "volume-tier-100", label: "Volume Tier · 100+ units", subtitle: "5% off on orders of 100+ units", type: "discount" },
  { id: "fuel-surcharge", label: "Fuel Surcharge · 3.5%", subtitle: "Applied on freight invoices", type: "premium" },
];

/** Pricing-rule ids inherited by default (seed two discount rules). */
export const INHERITED_PRICING_RULE_IDS: string[] = ["early-pay-2-10", "volume-tier-100"];

/** Carrier-method ids inherited by default (FedEx + DHL primary methods). */
export const INHERITED_FREIGHT_METHOD_IDS: string[] = ["fedex-air", "dhl-express"];

/**
 * UomPicker — searchable cmdk popover with "Defined alternatives" + grouped
 * indexable units + a "Create new unit" link. `disabledIds` grays out units
 * already claimed by another tier so the same UoM can't be picked twice.
 */
export function UomPicker({
  value,
  onChange,
  disabledIds = new Set<string>(),
  triggerClassName = "",
  variant = "default",
}: {
  value: string;
  onChange: (next: string) => void;
  disabledIds?: Set<string>;
  triggerClassName?: string;
  variant?: "default" | "embedded";
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  React.useEffect(() => { if (!open) setSearch(""); }, [open]);
  const selected = lookupUom(value);
  const highlight = React.useCallback((text: string) => {
    if (!search) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = search.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-amber-100 text-foreground rounded-sm">
          {text.slice(idx, idx + search.length)}
        </mark>
        {text.slice(idx + search.length)}
      </>
    );
  }, [search]);
  const definedIds = React.useMemo(() => new Set(QV_UOM_OPTIONS.map((u) => u.id)), []);
  const indexableByGroup = React.useMemo(() => {
    const map = new Map<string, typeof QV_UOM_ALL_INDEXABLE>();
    QV_UOM_ALL_INDEXABLE.filter((u) => !definedIds.has(u.id)).forEach((u) => {
      const list = map.get(u.group) || [];
      list.push(u);
      map.set(u.group, list);
    });
    map.forEach((list) => list.sort((a, b) => a.label.localeCompare(b.label)));
    return map;
  }, [definedIds]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center justify-between gap-2 ${variant === "embedded"
            ? "h-9 text-[12px] w-[130px] border-0 border-l border-border rounded-none bg-[#FAFBFC] px-3"
            : "h-8 text-[12px] w-full rounded-md border border-border bg-white hover:border-slate-300 px-3"} ${triggerClassName}`}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <span className="truncate">{selected.label}</span>
            <span className="text-[10.5px] text-slate-400 tabular-nums shrink-0" style={{ fontWeight: 500 }}>{selected.symbol}</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverPrimitive.Content
        align="end"
        sideOffset={6}
        className="w-[340px] p-0 z-[280] border border-[#E8ECF1] rounded-xl shadow-[0_24px_56px_-12px_rgba(15,23,42,0.22)] overflow-hidden bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 outline-hidden flex flex-col"
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
          <div className="px-1.5 pt-1.5 pb-1 shrink-0 border-b border-[#F1F5F9]">
            <a
              href="https://swift-peek-studio.lovable.app/uom"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create new unit</span>
            </a>
          </div>
          <CommandList className="max-h-[260px]">
            <CommandEmpty className="py-5 text-center text-[11.5px] text-slate-500">
              <p style={{ fontWeight: 500 }}>No matching unit.</p>
              <p className="text-[11px] text-slate-400 mt-1">Use "Create new unit" above to add it.</p>
            </CommandEmpty>
            <CommandGroup
              heading={<span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>Defined alternatives</span>}
            >
              {QV_UOM_OPTIONS.map((u) => {
                const disabled = disabledIds.has(u.id) && u.id !== value;
                return (
                  <CommandItem
                    key={u.id}
                    value={`${u.label} ${u.symbol} ${u.id}`}
                    disabled={disabled}
                    onSelect={() => { if (disabled) return; onChange(u.id); setOpen(false); }}
                    className="flex items-center justify-between gap-2 py-1.5"
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span className="truncate text-[12.5px]">{highlight(u.label)}</span>
                      <span className="text-[10.5px] text-slate-400 tabular-nums" style={{ fontWeight: 500 }}>{highlight(u.symbol)}</span>
                    </span>
                    {u.id === value && <Check className="w-3.5 h-3.5 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {Array.from(indexableByGroup.entries()).map(([group, units]) => (
              <CommandGroup
                key={group}
                heading={<span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>{group}</span>}
              >
                {units.map((u) => {
                  const disabled = disabledIds.has(u.id) && u.id !== value;
                  return (
                    <CommandItem
                      key={u.id}
                      value={`${u.label} ${u.symbol} ${u.id}`}
                      disabled={disabled}
                      onSelect={() => { if (disabled) return; onChange(u.id); setOpen(false); }}
                      className="flex items-center justify-between gap-2 py-1.5"
                    >
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <span className="truncate text-[12.5px]">{highlight(u.label)}</span>
                        <span className="text-[10.5px] text-slate-400 tabular-nums" style={{ fontWeight: 500 }}>{highlight(u.symbol)}</span>
                      </span>
                      {u.id === value && <Check className="w-3.5 h-3.5 text-primary" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverPrimitive.Content>
    </Popover>
  );
}

/** Small hover-info icon → tooltip used on each Configure field label. */
export function FieldInfo({ content }: { content: string }) {
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
      <TooltipContent side="top" align="start" className="max-w-[260px] text-[11.5px] leading-relaxed z-[300]">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
