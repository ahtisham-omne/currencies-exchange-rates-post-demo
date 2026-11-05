import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  GripVertical,
  Star,
  Eye,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  MoreHorizontal,
  EyeOff,
  Settings2,
  Layers,
  Tag,
  TrendingDown,
  TrendingUp,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityChip } from "../../items-v3/PriorityChip";
import { PriceWithUom } from "../../items-v3/PriceWithUom";
import { OnTimeCell } from "../../items-v3/OnTimeCell";
import { InitialAvatar } from "../../items-v3/InitialAvatar";
import {
  PartnerLocationsCell,
  PointsOfContactCell,
  CountryCell,
  CreditLimitCell,
  CarrierVendorCell,
} from "./partnerCells";
import type { QualifiedVendor } from "../../../context/purchasing/types";
import {
  QV_PRICING_RULE_PRESETS,
  INHERITED_PRICING_RULE_IDS,
  type QvPricingRule,
} from "./qualifyConfig";

/* ───────────── column model ───────────── */
interface ColDef {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width: number;
}

export const COLUMNS: ColDef[] = [
  { key: "priority",           label: "Priority",                      width: 120 },
  { key: "partner",            label: "Partner",                       sortable: true, width: 240 },
  /* Partner-listing parity identity columns (ported from VendorsListPage). */
  { key: "location",           label: "Partner Locations",             sortable: true, width: 260 },
  { key: "pointOfContact",     label: "Points of Contact",                             width: 280 },
  { key: "country",            label: "Country",                       sortable: true, width: 200 },
  { key: "creditLimit",        label: "Credit Limit ($)",              sortable: true, align: "right", width: 170 },
  /* Captured-at-qualification columns (the important info). */
  { key: "unitsPricing",       label: "Units & Pricing",               width: 260 },
  { key: "leadTime",           label: "Lead Time",                     sortable: true, align: "right", width: 120 },
  { key: "carrierVendor",      label: "Carrier (Vendor)",                              width: 240 },
  { key: "pricingRules",       label: "Pricing Rules",                                 width: 240 },
  { key: "acceptedDeviation",  label: "Accepted Deviation (%)",                        align: "right", width: 170 },
  /* Analytics (history) — available via the column selector, hidden by default. */
  { key: "lastPoPricePerUnit", label: "Last PO Price Per Unit ($)",    sortable: true, align: "right", width: 200 },
  { key: "lastPoTotalAmount",  label: "Last PO Total Amount ($)",      sortable: true, align: "right", width: 200 },
  { key: "shipOnTime",         label: "Ship on Time (%)",              sortable: true, width: 180 },
];

const COLUMN_BY_KEY: Record<string, ColDef> = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
const ACTIONS_COL_WIDTH = 60;

/* Exported column metadata so QualifiedVendorsPanel can drive the
   ColumnSelector (Partners-parity) without duplicating the column list. */
export const QV_COLUMN_DEFS: { key: string; label: string }[] = COLUMNS.map((c) => ({ key: c.key, label: c.label }));
export const QV_LOCKED_COLUMNS = ["priority", "partner"];
/* Default visible = the terms captured while qualifying the vendor
   (units & pricing, order limits, lead time, carrier, pricing rules).
   Deviation + the PO-history analytics stay in the column selector. */
export const QV_DEFAULT_HIDDEN_COLUMNS = ["acceptedDeviation", "lastPoPricePerUnit", "lastPoTotalAmount", "shipOnTime"];

export interface QVTableProps {
  qvs: QualifiedVendor[];
  visibleColumnKeys: string[];
  density: "condensed" | "comfort" | "card";
  lockedColumns?: string[];
  onReorder: (qvs: QualifiedVendor[]) => void;
  onRowClick: (qv: QualifiedVendor) => void;
  onEdit: (qv: QualifiedVendor) => void;
  onDelete: (qv: QualifiedVendor) => void;
  onHideColumn?: (key: string) => void;
  sortKey: string | null;
  sortDirection: "asc" | "desc";
  onSort: (key: string) => void;
  /** Row → "Edit Configuration": opens the qualify modal in edit mode. */
  onEditConfig?: (qv: QualifiedVendor) => void;
  /** Disables the priority drag handle (e.g. while a column sort is active). */
  disableDrag?: boolean;
}

/* ───────────── cell content per column ───────────── */
/* Flattened catalog — resolve captured-config pricing-rule ids → full rules.
   The listing only stores ids, so we rehydrate the preset's label/subtitle/type
   to drive both the inline cell and the rich hover card. Unknown ids (custom or
   copied rules) fall back to a readable label with a neutral discount type. */
const PRICING_RULE_BY_ID: Record<string, QvPricingRule> = Object.fromEntries(
  QV_PRICING_RULE_PRESETS.map((r) => [r.id, r]),
);
const INHERITED_RULE_SET = new Set(INHERITED_PRICING_RULE_IDS);

function resolvePricingRule(id: string): QvPricingRule {
  return (
    PRICING_RULE_BY_ID[id] ?? {
      id,
      label: id,
      subtitle: "Custom pricing rule",
      type: "discount",
      custom: true,
    }
  );
}


const toNum = (v: unknown): number | undefined => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : undefined;
};
const fmtMoney = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtRange = (min?: string | number, max?: string | number) => {
  const a = toNum(min);
  const b = toNum(max);
  if (a != null && b != null) return `${a.toLocaleString()}–${b.toLocaleString()}`;
  if (a != null) return `≥ ${a.toLocaleString()}`;
  if (b != null) return `≤ ${b.toLocaleString()}`;
  return "—";
};

/* One priced unit derived from the captured qualify-config. A vendor may
   sell the same item in several units (Each / Case / Pallet …), each with
   its own price + ordering rules — this is the "multiple UoM" data. */
interface UnitTier {
  uom: string;
  price: number;
  min?: string | number;
  max?: string | number;
  mult?: string | number;
  lead?: string | number;
  isPrimary?: boolean;
}
function getUnitTiers(qv: QualifiedVendor): UnitTier[] {
  const cfg = qv.config;
  if (cfg) {
    const primary: UnitTier = {
      uom: cfg.uom || qv.vendorUOM,
      price: toNum(cfg.pricePerUnit) ?? qv.pricePerUnit,
      min: cfg.minOrderQty,
      max: cfg.maxOrderQty,
      mult: cfg.multiples,
      lead: cfg.leadTimeDays,
      isPrimary: true,
    };
    const extras: UnitTier[] = (cfg.additionalPrices || []).map((t) => ({
      uom: t.uom,
      price: toNum(t.price) ?? 0,
      min: t.minOrderQty,
      max: t.maxOrderQty,
      mult: t.multiples,
      lead: t.leadTimeDays,
    }));
    return [primary, ...extras];
  }
  return [
    {
      uom: qv.vendorUOM,
      price: qv.pricePerUnit,
      min: qv.minOrderQty,
      max: qv.maxOrderQty,
      mult: qv.multiples,
      lead: qv.lastPOLeadTime,
      isPrimary: true,
    },
  ];
}

/* Units & Pricing cell — primary price/unit inline + a "N units" pill when
   the vendor sells in multiple units; the pill opens a per-unit breakdown. */
function UnitsPricingCell({ qv }: { qv: QualifiedVendor }) {
  const tiers = getUnitTiers(qv);
  const primary = tiers[0];
  const multi = tiers.length > 1;
  return (
    <div className="flex items-center gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
      <span className="min-w-0 truncate">
        <PriceWithUom price={primary.price} uom={primary.uom} />
      </span>
      {multi && (
        <HoverCard openDelay={120} closeDelay={100}>
          <HoverCardTrigger asChild>
            <span
              tabIndex={0}
              role="button"
              className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full border text-[10.5px] shrink-0 cursor-default transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              style={{ fontWeight: 600, backgroundColor: "#F5F3FF", color: "#6D28D9", borderColor: "#DDD6FE" }}
              aria-label={`View all ${tiers.length} units this vendor sells in`}
            >
              <Layers className="w-3 h-3" />
              {tiers.length} units
            </span>
          </HoverCardTrigger>
          <HoverCardContent
            align="start"
            sideOffset={6}
            className="p-0 rounded-xl shadow-lg border border-border/80 z-[200] w-[340px] overflow-hidden"
          >
            <div className="px-3.5 py-2.5 border-b border-border/60 bg-[#FAFBFC]">
              <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Pricing by unit</p>
              <p className="text-[11px] text-muted-foreground mt-px truncate">
                {qv.vendorName} sells this item in {tiers.length} units
              </p>
            </div>
            <div className="max-h-[280px] overflow-y-auto divide-y divide-[#F1F5F9]">
              {tiers.map((t, idx) => (
                <div key={`${t.uom}-${idx}`} className="px-3.5 py-2.5 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12.5px] text-slate-800" style={{ fontWeight: 600 }}>{t.uom}</span>
                      {t.isPrimary && (
                        <span
                          className="inline-flex items-center px-1.5 py-px rounded-full text-[9.5px] border"
                          style={{ fontWeight: 600, backgroundColor: "#EFF6FF", color: "#1E40AF", borderColor: "#BFDBFE" }}
                        >
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-x-2.5 gap-y-0.5 flex-wrap text-[10.5px] text-slate-500">
                      <span>Order {fmtRange(t.min, t.max)}</span>
                      {toNum(t.mult) ? <span>· ×{toNum(t.mult)}</span> : null}
                      {toNum(t.lead) ? <span>· {toNum(t.lead)}d lead</span> : null}
                    </div>
                  </div>
                  <span className="text-[12.5px] tabular-nums text-emerald-700 shrink-0" style={{ fontWeight: 600 }}>
                    {fmtMoney(t.price)}
                  </span>
                </div>
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
}

/* Pricing Rules cell — deliberately label-only: shows just a single "{n} rules"
   count pill (single rule → "1 rule"), no rule name or category words. The rule
   names, categories, terms and subtitles all live in the rich hover card (same
   content as the qualify-wizard cards). The pill is the hover trigger so every
   row reveals full detail. */
function PricingRulesCell({ qv }: { qv: QualifiedVendor }) {
  const ids = qv.config?.appliedPricingRuleIds ?? [];
  if (!ids.length) return <span className="text-muted-foreground/50 text-sm">—</span>;
  const rules = ids.map(resolvePricingRule);
  return (
    <div className="flex items-center min-w-0" onClick={(e) => e.stopPropagation()}>
      <HoverCard openDelay={120} closeDelay={100}>
        <HoverCardTrigger asChild>
          <span
            tabIndex={0}
            role="button"
            className="inline-flex items-center min-w-0 cursor-default rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            aria-label={`View all ${rules.length} pricing rule${rules.length > 1 ? "s" : ""} applied to this vendor`}
          >
            <span
              className="inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[11px] shrink-0 transition-colors hover:brightness-95"
              style={{ fontWeight: 600, backgroundColor: "#EEF2FF", color: "#4338CA", borderColor: "#E0E7FF" }}
            >
              <Tag className="w-3 h-3" />
              {rules.length} {rules.length === 1 ? "rule" : "rules"}
            </span>
          </span>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          sideOffset={6}
          className="p-0 rounded-xl shadow-lg border border-border/80 z-[200] w-[340px] overflow-hidden"
        >
          <div className="px-3.5 py-2.5 border-b border-border/60 bg-[#FAFBFC]">
            <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Pricing rules</p>
            <p className="text-[11px] text-muted-foreground mt-px truncate">
              {rules.length} rule{rules.length > 1 ? "s" : ""} applied for {qv.vendorName}
            </p>
          </div>
          <div className="max-h-[280px] overflow-y-auto divide-y divide-[#F1F5F9]">
            {rules.map((r, idx) => {
              const isDiscount = r.type === "discount";
              const pill = isDiscount
                ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
                : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };
              const RuleIcon = isDiscount ? TrendingDown : TrendingUp;
              const inherited = INHERITED_RULE_SET.has(r.id);
              return (
                <div key={`${r.id}-${idx}`} className="px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9.5px] border"
                      style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg, borderColor: pill.border }}
                    >
                      <RuleIcon className="w-2.5 h-2.5" />
                      {isDiscount ? "Discount" : "Premium"}
                    </span>
                    {inherited && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9.5px] border bg-[#EEF2FF] text-[#4338CA] border-[#E0E7FF]" style={{ fontWeight: 600 }}>
                        <Check className="w-2.5 h-2.5" /> Inherited
                      </span>
                    )}
                    {r.custom && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9.5px] border bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE]" style={{ fontWeight: 600 }}>
                        <Layers className="w-2.5 h-2.5" /> Vendor-scoped
                      </span>
                    )}
                  </div>
                  <p className="text-[12.5px] text-slate-800" style={{ fontWeight: 600 }}>{r.label}</p>
                  <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed">{r.subtitle}</p>
                </div>
              );
            })}
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

function renderCell(
  col: ColDef,
  qv: QualifiedVendor,
  attrs: {
    dragHandleProps?: React.HTMLAttributes<HTMLButtonElement> & { ref?: any };
  },
  opts?: { disableDrag?: boolean },
) {
  switch (col.key) {
    case "priority":
      return (
        <div className="flex items-center gap-2">
          {opts?.disableDrag ? (
            /* Drag is only meaningful in the default priority order; when a
               column sort is active we render a spacer instead of the grip. */
            <span className="w-4 -ml-1 inline-block" aria-hidden />
          ) : (
            <button
              type="button"
              className="p-1 -ml-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
              aria-label={`Drag to reorder priority ${qv.priority}`}
              {...attrs.dragHandleProps}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <PriorityChip priority={qv.priority} />
          {qv.isPrimary && (
            <span title="Default vendor — used for auto-PO" className="inline-flex items-center shrink-0">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
            </span>
          )}
        </div>
      );
    case "partner":
      return (
        <div className="flex items-center gap-2.5 min-w-0">
          <InitialAvatar name={qv.vendorName} square />
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate" style={{ fontWeight: 500, color: "#1E293B" }}>
              {qv.vendorName}
            </p>
          </div>
        </div>
      );
    case "location":
      return (
        <PartnerLocationsCell
          rowId={qv.id}
          primaryLocation={qv.location}
          partnerLocations={qv.partnerLocations}
          vendorName={qv.vendorName}
        />
      );
    case "pointOfContact":
      return <PointsOfContactCell rowId={qv.id} contacts={qv.contacts} />;
    case "country":
      return <CountryCell country={qv.country} countryFlag={qv.countryFlag} />;
    case "creditLimit":
      return <CreditLimitCell creditLimit={qv.creditLimit} />;
    case "unitsPricing":
      return <UnitsPricingCell qv={qv} />;
    case "lastPoPricePerUnit":
      return <span className="text-sm tabular-nums text-foreground">${qv.lastPOPricePerUnit.toFixed(2)}</span>;
    case "lastPoTotalAmount":
      return (
        <span className="text-sm tabular-nums text-foreground">
          ${qv.lastPOTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    case "carrierVendor":
      return <CarrierVendorCell carrier={qv.carrierVendor} />;
    case "pricingRules":
      return <PricingRulesCell qv={qv} />;
    case "acceptedDeviation":
      return <span className="text-sm tabular-nums text-foreground">{qv.acceptedDeviation}%</span>;
    case "shipOnTime":
      return (
        <OnTimeCell
          onTimePercent={qv.shipOnTime}
          onTimeCount={qv.onTimeShipments ?? 0}
          onTimeTotal={qv.totalShipments ?? 0}
        />
      );
    case "leadTime":
      return <span className="text-sm tabular-nums text-foreground">{qv.lastPOLeadTime} Days</span>;
    default:
      return null;
  }
}

/* ───────────── column header (Partners-style: ColumnHeaderMenu wrapper with sort/hide) ───────────── */
function QVColumnHeader({
  col,
  isLocked,
  currentSort,
  onSort,
  onHide,
}: {
  col: ColDef;
  isLocked: boolean;
  currentSort: "asc" | "desc" | null;
  onSort: (key: string) => void;
  onHide?: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isRight = col.align === "right";

  const handleSortAsc = () => {
    if (currentSort !== "asc") onSort(col.key);
    else if (currentSort === "asc") {
      // already asc — toggle to desc via parent's onSort cycling
      onSort(col.key);
    }
    setOpen(false);
  };
  const handleSortDesc = () => {
    if (currentSort !== "desc") {
      // Parent toggles asc<->desc when same key. Force desc by calling once or twice as needed.
      if (currentSort === null) {
        onSort(col.key); // asc
        onSort(col.key); // desc
      } else {
        onSort(col.key);
      }
    }
    setOpen(false);
  };

  const labelEl = (
    <div className={cn("inline-flex items-center gap-1", isRight && "justify-end")}>
      <span
        className="text-[13px]"
        style={currentSort ? { color: "hsl(var(--primary))" } : undefined}
      >
        {col.label}
      </span>
      {col.sortable && currentSort === "asc" && (
        <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
      )}
      {col.sortable && currentSort === "desc" && (
        <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
      )}
      {col.sortable && !currentSort && (
        <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
      )}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          "flex items-center w-full h-full text-left cursor-pointer select-none hover:text-foreground transition-colors",
          isRight && "justify-end",
        )}
      >
        {labelEl}
      </PopoverTrigger>
      <PopoverContent
        align={isRight ? "end" : "start"}
        sideOffset={4}
        className="p-0 rounded-lg shadow-lg border border-border/80 z-[200] w-[200px]"
      >
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-muted/30">
            <span className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>
              {col.label}
            </span>
          </div>
        </div>
        <div className="border-t border-border/60" />
        <div className="py-1 px-1">
          {col.sortable && (
            <>
              <button
                type="button"
                onClick={handleSortAsc}
                className={cn(
                  "flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60",
                  currentSort === "asc" ? "text-primary bg-primary/5" : "text-foreground",
                )}
              >
                <ArrowUp className="w-4 h-4 text-muted-foreground" />
                <span style={{ fontWeight: 400 }}>Sort ascending</span>
                {currentSort === "asc" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
              <button
                type="button"
                onClick={handleSortDesc}
                className={cn(
                  "flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60",
                  currentSort === "desc" ? "text-primary bg-primary/5" : "text-foreground",
                )}
              >
                <ArrowDown className="w-4 h-4 text-muted-foreground" />
                <span style={{ fontWeight: 400 }}>Sort descending</span>
                {currentSort === "desc" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
              {!isLocked && onHide && <div className="border-t border-border/60 my-1" />}
            </>
          )}
          {!isLocked && onHide && (
            <button
              type="button"
              onClick={() => { onHide(col.key); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] text-foreground cursor-pointer transition-colors hover:bg-muted/60"
            >
              <EyeOff className="w-4 h-4 text-muted-foreground" />
              <span style={{ fontWeight: 400 }}>Hide</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────── sortable row ───────────── */
function SortableRow({
  qv,
  visibleCols,
  cellPad,
  cellPadY,
  onRowClick,
  onEdit,
  onDelete,
  onEditConfig,
  disableDrag,
}: {
  qv: QualifiedVendor;
  visibleCols: ColDef[];
  cellPad: string;
  cellPadY: string;
  onRowClick: (qv: QualifiedVendor) => void;
  onEdit: (qv: QualifiedVendor) => void;
  onDelete: (qv: QualifiedVendor) => void;
  onEditConfig?: (qv: QualifiedVendor) => void;
  disableDrag?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: qv.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className="cursor-pointer group hover:bg-[#F0F7FF]"
      onClick={() => onRowClick(qv)}
    >
      {visibleCols.map((col) => {
        const isRight = col.align === "right";
        return (
          <TableCell
            key={col.key}
            className={cn(cellPad, isRight && "text-right tabular-nums")}
            style={{
              width: `${col.width}px`,
              minWidth: `${col.width}px`,
              maxWidth: `${col.width}px`,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {renderCell(
              col,
              qv,
              {
                dragHandleProps:
                  col.key === "priority"
                    ? ({ ref: setActivatorNodeRef, ...listeners, ...attributes } as any)
                    : undefined,
              },
              { disableDrag },
            )}
          </TableCell>
        );
      })}
      {/* Actions — sticky right (matches Items listing) */}
      <TableCell
        className={cn("sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2", cellPadY)}
        style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)", width: ACTIONS_COL_WIDTH, minWidth: ACTIONS_COL_WIDTH, maxWidth: ACTIONS_COL_WIDTH }}
      >
        <div data-row-action className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                aria-label="Row actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px] bg-popover">
              <DropdownMenuItem onClick={() => onEdit(qv)} className="cursor-pointer">
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {onEditConfig && (
                <DropdownMenuItem onClick={() => onEditConfig(qv)} className="cursor-pointer">
                  <Settings2 className="w-4 h-4 mr-2" />
                  Edit Configuration
                </DropdownMenuItem>
              )}
              {/* "Set as default" is intentionally NOT offered here — the
                  default vendor is managed from the Configure tier lanes and the
                  Edit Vendors modal, not the listing row menu. */}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(qv)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

/* ───────────── main table ───────────── */
export function QVTable({
  qvs,
  visibleColumnKeys,
  density,
  lockedColumns = [],
  onReorder,
  onRowClick,
  onEdit,
  onDelete,
  onHideColumn,
  sortKey,
  sortDirection,
  onSort,
  onEditConfig,
  disableDrag,
}: QVTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeQV = useMemo(
    () => qvs.find((q) => q.id === activeId) ?? null,
    [qvs, activeId],
  );

  const visibleCols = useMemo(
    () => visibleColumnKeys.map((k) => COLUMN_BY_KEY[k]).filter(Boolean) as ColDef[],
    [visibleColumnKeys],
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const overQv = qvs.find((q) => q.id === over.id);
    if (!overQv) return;
    // Priority allows ties: dropping a vendor onto another puts it in that
    // vendor's tier (a tie) rather than forcing a strict 1-2-3 reorder. Ranks
    // are densified by the context; splitting into a fresh tier is done in the
    // Configure tier lanes.
    const next = qvs.map((q) => (q.id === active.id ? { ...q, priority: overQv.priority } : q));
    onReorder(next);
  };

  const totalContentWidth =
    visibleCols.reduce((sum, c) => sum + c.width, 0) + ACTIONS_COL_WIDTH;

  /* Density-aware row padding (Partners parity — applied per-cell because tailwind-merge can't resolve [&>td]: cross-element conflicts) */
  const cellPadY = density === "condensed" ? "py-1" : density === "comfort" ? "py-2" : "py-1";
  const cellPad = density === "condensed"
    ? "py-1 pl-4 pr-2"
    : density === "comfort"
    ? "py-2 pl-4 pr-2"
    : "py-1 pl-4 pr-2";
  const headerHeight = density === "condensed" ? "[&>th]:h-8" : "[&>th]:h-9";

  return (
    <div className="min-h-0 overflow-auto flex-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Table style={{ tableLayout: "fixed", width: `max(${totalContentWidth}px, 100%)` }}>
          <TableHeader className="sticky top-0 z-20 bg-card">
            <TableRow className={cn("bg-muted/30 hover:bg-muted/30", headerHeight)}>
              {visibleCols.map((col) => {
                const isRight = col.align === "right";
                const currentColSort = sortKey === col.key ? sortDirection : null;
                const isLocked = lockedColumns.includes(col.key);
                return (
                  <TableHead
                    key={col.key}
                    className={cn("whitespace-nowrap relative group/colheader", isRight && "text-right")}
                    style={{ width: col.width, minWidth: col.width, maxWidth: col.width, overflow: "hidden" }}
                  >
                    <QVColumnHeader
                      col={col}
                      isLocked={isLocked}
                      currentSort={currentColSort}
                      onSort={onSort}
                      onHide={onHideColumn}
                    />
                  </TableHead>
                );
              })}
              <TableHead
                className="whitespace-nowrap sticky right-0 bg-[#f8fafc] z-20 !pl-2 !pr-2"
                style={{ width: ACTIONS_COL_WIDTH, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}
              >
                <span className="text-[13px]">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <SortableContext items={qvs.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <TableBody>
              {qvs.map((qv) => (
                <SortableRow
                  key={qv.id}
                  qv={qv}
                  visibleCols={visibleCols}
                  cellPad={cellPad}
                  cellPadY={cellPadY}
                  onRowClick={onRowClick}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onEditConfig={onEditConfig}
                  disableDrag={disableDrag}
                />
              ))}
            </TableBody>
          </SortableContext>
        </Table>
        <DragOverlay dropAnimation={null}>
          {activeQV && (
            <div className="bg-card rounded-md border border-border border-l-[3px] border-l-primary shadow-xl px-3 py-2 flex items-center gap-2 w-[18rem] rotate-1">
              <PriorityChip priority={activeQV.priority} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{activeQV.vendorName}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    ${activeQV.pricePerUnit.toFixed(2)}/{activeQV.vendorUOM.split(" ")[0]}
                  </span>
                  <span className="font-semibold text-emerald-700">{activeQV.shipOnTime}% OTD</span>
                </div>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
