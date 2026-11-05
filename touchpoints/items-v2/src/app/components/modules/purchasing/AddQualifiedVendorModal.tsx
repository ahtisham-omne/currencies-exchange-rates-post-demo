import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  X,
  Check,
  Plus,
  Trash2,
  Package,
  Maximize2,
  Minimize2,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Settings2,
  ListOrdered,
  Star,
  GripVertical,
  Tag,
  Layers,
  Truck,
  ChartColumn,
  Sparkles,
  TrendingDown,
  TrendingUp,
  ArrowLeft,
  AlertTriangle,
  Users,
  Pencil,
  MapPin,
  Globe,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AVAILABLE_VENDORS } from "../../../context/purchasing/mockData";
import type {
  AvailableVendor,
  QualifiedVendor,
  QualifiedVendorConfig,
  AdditionalPriceTier,
} from "../../../context/purchasing/types";
import { InitialAvatar, getInitials } from "../../items-v3/InitialAvatar";
import {
  PointsOfContactCell,
  CountryCell,
  CreditLimitCell,
  CarrierVendorCell,
  getLocationPhoto,
  getLocationAddress,
} from "./partnerCells";
import {
  UomPicker,
  FieldInfo,
  numericInput,
  QV_UOM_OPTIONS,
  QV_UOM_ALL_INDEXABLE,
  lookupUom,
  QV_PRICING_RULE_PRESETS,
  INHERITED_PRICING_RULE_IDS,
  INHERITED_FREIGHT_METHOD_IDS,
  type QvPricingRule,
} from "./qualifyConfig";
import {
  ShippingMethodCarrierCard,
  SHIPPING_CARRIER_CATALOG,
  SHIPPING_CARRIER_METHODS,
  type ShippingCarrierEntry,
} from "./ShippingCarrierCard";
import { PricingRuleCreateModal } from "./PricingRuleCreateModal";
import { RemoveVendorDialog } from "./RemoveVendorDialog";
import { PrimaryPill } from "./PrimaryPill";
import { VendorPriorityList, computeRoster, type RosterCard, type RosterInputVendor } from "./VendorPriorityList";
import { MAX_PRIORITY } from "../../../context/PurchasingContext";
import { pricePrefix, vendorCurrencyFor, vendorRate } from "../../../currency/vendorFx";
import { formatMoney } from "../../../currency/money";
import { DEFAULT_RATE_TYPE } from "../../../currency/rates";
import { VendorCurrencyChip, VendorPriceFields } from "../../currency/VendorPriceFields";

/* ──────────────────────────────────────────────────────────────
   buildQualifiedVendor — kept for existing callers (ProcurementSection,
   ItemPurchasingTab) which still add vendors with a default config and
   configure later. `priority` is cosmetic — PurchasingContext.addQV
   re-sequences.
   ────────────────────────────────────────────────────────────── */
export function buildQualifiedVendor({
  itemId,
  vendor,
  priority,
  seq = 0,
  config,
}: {
  itemId: string;
  vendor: AvailableVendor;
  priority: number;
  /** Disambiguates ids when several vendors are added in the same tick. */
  seq?: number;
  /** Captured qualify-flow configuration, when added via the wizard. */
  config?: QualifiedVendorConfig;
}): QualifiedVendor {
  const num = (s: string | undefined) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    id: `qv-${itemId}-${vendor.id}-${seq}`,
    priority: config && config.priority !== "auto" ? num(config.priority) || priority : priority,
    vendorName: vendor.name,
    vendorId: vendor.id,
    location: vendor.location,
    pricePerUnit: config ? num(config.pricePerUnit) : 0,
    // The partner's currency (spec 4.2): its prices are entered in it.
    currency: vendor.currency ?? vendorCurrencyFor(vendor.country),
    acceptedDeviation: config ? num(config.acceptedDeviationPct) : 0,
    vendorUOM: config?.uom || "Each",
    isPrimary: false,
    lastPOLeadTime: config ? num(config.leadTimeDays) : 0,
    averageLeadTime: 0,
    lastPOTotalAmount: 0,
    lastPOPricePerUnit: 0,
    averagePricePerUnit: 0,
    priceFluctuation30d: 0,
    shipOnTime: 0,
    totalShipments: 0,
    onTimeShipments: 0,
    minOrderQty: config ? num(config.minOrderQty) : undefined,
    maxOrderQty: config ? num(config.maxOrderQty) : undefined,
    multiples: config ? num(config.multiples) : undefined,
    partnerGroup: vendor.partnerGroup,
    /* Carry the partner-identity fields so a wizard-added vendor renders the
       same rich listing columns (Partner Locations, Country, Carrier, Credit
       Limit, Contacts) as the seeded rows. The location scope chosen during
       qualification is applied on top via qvFieldsFromConfig. */
    partnerLocations: vendor.partnerLocations,
    country: vendor.country,
    countryFlag: vendor.countryFlag,
    carrierVendor: vendor.carrierVendor,
    creditLimit: vendor.creditLimit,
    contacts: vendor.contacts,
    config,
  };
}

/* Vendor avatar — name-based InitialAvatar (matches the Items module
   person-cell idiom). Wrapped so size variants stay consistent. */
function VendorAvatar({ name, size = "md", square = false }: { name: string; size?: "sm" | "md" | "lg"; square?: boolean }) {
  return <InitialAvatar name={name} size={size} square={square} />;
}

/* Sticky-cell base background — opaque so horizontally-scrolled cells
   don't bleed through the frozen checkbox + identity columns. Mirrors the
   partner select-items table's stickyCellBg pattern. */
const STICKY_SHADOW = "inset -1px 0 0 0 rgba(0,0,0,0.06), 3px 0 6px -2px rgba(0,0,0,0.05)";
function stickyBg(selected: boolean) {
  return selected ? "!bg-accent/30" : "bg-white group-hover:bg-[#F0F7FF]";
}

/* Single-list row dispositions. The Browse/Added split was merged into ONE
   list: vendors already qualified for the item, plus the ones picked this
   session, pin to the top with a green state; the rest of the pool sits below
   with an Add button. */
type RowState = "qualified" | "selected" | "available";

/** Resolve the rich AvailableVendor behind an already-qualified vendor so it
 *  renders with the same columns as the pool. Falls back to the partner-identity
 *  fields the QV already carries when the pool no longer lists it. */
function qvToAvailable(qv: QualifiedVendor): AvailableVendor {
  const fromPool = AVAILABLE_VENDORS.find(
    (v) => v.id === qv.vendorId || v.name.toLowerCase() === qv.vendorName.toLowerCase(),
  );
  if (fromPool) return fromPool;
  return {
    id: qv.vendorId,
    name: qv.vendorName,
    location: qv.location,
    partnerGroup: qv.partnerGroup,
    partnerLocations: qv.partnerLocations ?? [qv.location],
    contacts: qv.contacts ?? [],
    country: qv.country,
    countryFlag: qv.countryFlag,
    carrierVendor: qv.carrierVendor,
    creditLimit: qv.creditLimit,
  } as AvailableVendor;
}

/** Wrap the first case-insensitive match of `query` inside `text` in an amber
 *  highlight (matches the Configure rail's search highlighting). */
function highlightText(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-100 text-foreground rounded-sm px-px">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/**
 * LocationScopePicker — pick which of a vendor's locations the qualification
 * applies to: ALL (default) or one OR MORE specific sites (multi-select).
 * Keeps the rich Partner-Locations look (photo thumbnail + primary site +
 * "+N more") as the trigger, and opens the same image-row dropdown used by the
 * listing's location overflow. Shared by the Browse cell and the Configure
 * card. `value` = selected site strings; empty = all locations.
 */
function LocationScopePicker({
  locations,
  value,
  onChange,
  size = "cell",
  className,
}: {
  locations: string[];
  value: string[];
  onChange: (next: string[]) => void;
  /** "cell" = compact Browse-table trigger; "field" = full-width Configure card; "chip" = compact inline chip (rail / headers). */
  size?: "cell" | "field" | "chip";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const sites = locations.length ? locations : [];
  const isAll = value.length === 0;
  // Sites effectively in scope right now (every site when nothing specific is
  // chosen). The trigger renders the REAL site list — primary site name + a
  // "+N" count — rather than a generic "All locations" label, so the cell
  // carries actual information at a glance (mirrors the listing's Partner
  // Locations cell). The all-vs-subset distinction stays legible in the
  // dropdown's master checkbox; pick specific sites from there.
  const inScope = isAll ? sites : value;
  const primary = inScope[0] ?? "All locations";
  const extra = Math.max(0, inScope.length - 1);
  const hasSites = inScope.length > 0;
  // Master "All locations" checkbox — same select-all / indeterminate logic as
  // the listing table's header checkbox: checked when every site is in scope,
  // indeterminate when only a subset is.
  const masterChecked: boolean | "indeterminate" = isAll ? true : "indeterminate";
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visibleSites = q
    ? sites.filter((s) => s.toLowerCase().includes(q) || getLocationAddress(s).toLowerCase().includes(q))
    : sites;

  const toggleSite = (site: string) => {
    // Standard select-all group logic: from "all" (every site checked),
    // unchecking one narrows to a subset; selecting every site (or none)
    // collapses back to "all".
    const base = isAll ? sites : value;
    const next = base.includes(site) ? base.filter((s) => s !== site) : [...base, site];
    if (next.length === 0 || next.length === sites.length) onChange([]);
    else onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {size === "chip" ? (
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 min-w-0 max-w-full h-5 pl-0.5 pr-1.5 rounded-full bg-[#F1F5F9] border border-[#E8ECF1] hover:border-primary/40 hover:bg-accent/40 transition-colors text-left cursor-pointer",
              className,
            )}
            title={
              isAll
                ? `All ${sites.length} location${sites.length === 1 ? "" : "s"}: ${sites.join(", ")}`
                : `${value.length} of ${sites.length}: ${value.join(", ")}`
            }
          >
            {hasSites ? (
              <span className="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-muted">
                <img src={getLocationPhoto(primary)} alt="" className="w-full h-full object-cover" />
              </span>
            ) : (
              <span className="w-4 h-4 rounded-full bg-[#EEF2FF] flex items-center justify-center shrink-0">
                <Globe className="w-2.5 h-2.5 text-[#4338CA]" />
              </span>
            )}
            <span className="text-[10.5px] text-slate-600 truncate" style={{ fontWeight: 500 }}>{primary}</span>
            {extra > 0 && (
              <span className="text-[10px] text-[#4338CA] shrink-0" style={{ fontWeight: 700 }}>+{extra}</span>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-0.5" />
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 min-w-0 rounded-full border bg-white transition-colors text-left border-[#E8ECF1] hover:border-primary/40 hover:bg-accent/30",
              size === "field" ? "h-9 pl-1 pr-3 w-full text-[13px]" : "h-8 pl-1 pr-2.5 max-w-full text-[13px]",
              className,
            )}
            title={
              isAll
                ? `All ${sites.length} location${sites.length === 1 ? "" : "s"}: ${sites.join(", ")}`
                : `${value.length} of ${sites.length}: ${value.join(", ")}`
            }
          >
            {hasSites ? (
              <span className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-[#E8ECF1] bg-muted">
                <img src={getLocationPhoto(primary)} alt="" className="w-full h-full object-cover" />
              </span>
            ) : (
              <span className="w-6 h-6 rounded-full bg-[#EEF2FF] flex items-center justify-center shrink-0 border border-[#E0E7FF]">
                <Globe className="w-3.5 h-3.5 text-[#4338CA]" />
              </span>
            )}
            <span className="truncate text-foreground" style={{ fontWeight: 500 }}>{primary}</span>
            {extra > 0 && (
              <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1.5 rounded-full bg-[#EEF2FF] text-[#4338CA] text-[10.5px] shrink-0" style={{ fontWeight: 600 }}>
                +{extra}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[300px] p-0 rounded-xl overflow-hidden z-[400] shadow-lg border border-border/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between border-b border-border/50">
          <span className="text-[11px] tracking-wide uppercase text-muted-foreground/70" style={{ fontWeight: 600 }}>Locations</span>
          <span className="text-[10px] text-muted-foreground/60 tabular-nums">{isAll ? `All · ${sites.length}` : `${value.length} of ${sites.length}`}</span>
        </div>
        {/* Search — filter sites by name or address. Design mirrors the Partners
            shipping-method dropdown search (raw input, rounded-lg, slate border). */}
        <div className="p-2 border-b border-[#F1F5F9]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search locations..."
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E8ECF1] bg-white text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-slate-300"
            />
          </div>
        </div>
        <div className="px-1.5 pb-1.5 max-h-[260px] overflow-y-auto">
          {/* All locations — master select-all. Always visible (when not
              searching): checked when every site is in scope, indeterminate on a
              subset, and clicking it re-selects every location. */}
          {!q && (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onChange([])}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange([]); } }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-[#F1F5F9] cursor-pointer"
              >
                <Checkbox checked={masterChecked} aria-hidden tabIndex={-1} className="pointer-events-none" />
                <span className="w-7 h-7 rounded-md bg-[#EEF2FF] flex items-center justify-center shrink-0 border border-[#E0E7FF]">
                  <Globe className="w-3.5 h-3.5 text-[#4338CA]" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] text-foreground block" style={{ fontWeight: 600 }}>All locations</span>
                  <span className="text-[10px] text-muted-foreground/60 block">Applies to every site</span>
                </div>
              </div>
              {sites.length > 0 && <div className="h-px bg-border/40 my-1 mx-2" />}
            </>
          )}
          {visibleSites.length === 0 ? (
            <div className="px-2.5 py-6 text-center text-[11px] text-muted-foreground/60">
              No locations match "{search}"
            </div>
          ) : (
            visibleSites.map((loc) => {
              const sel = isAll || value.includes(loc);
              return (
                <div
                  key={loc}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSite(loc)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSite(loc); } }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors hover:bg-[#F1F5F9] cursor-pointer"
                >
                  <Checkbox checked={sel} aria-hidden tabIndex={-1} className="pointer-events-none" />
                  <span className="w-7 h-7 rounded-md bg-muted overflow-hidden shrink-0 border border-[#E8ECF1]">
                    <img src={getLocationPhoto(loc)} alt="" className="w-full h-full object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] text-foreground block truncate" style={{ fontWeight: 500 }} title={loc}>{loc}</span>
                    <span className="text-[10px] text-muted-foreground/60 block truncate" title={getLocationAddress(loc)}>{getLocationAddress(loc)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * LocationScopeSummary — read-only companion to LocationScopePicker. Surfaces a
 * vendor's chosen location scope (primary site + "+N" count) as a compact chip
 * on the Configure-step identity cards, so the scope is visible alongside the
 * vendor without opening the picker. `value` = selected sites; empty = all.
 */
function LocationScopeSummary({
  locations,
  value,
  className,
}: {
  locations: string[];
  value: string[];
  className?: string;
}) {
  const sites = locations.length ? locations : [];
  const isAll = value.length === 0;
  const inScope = isAll ? sites : value;
  const primary = inScope[0];
  if (!primary) return null;
  const extra = Math.max(0, inScope.length - 1);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 min-w-0 max-w-full h-5 pl-0.5 pr-1.5 rounded-full bg-[#F1F5F9] border border-[#E8ECF1]",
        className,
      )}
      title={
        isAll
          ? `All ${sites.length} location${sites.length === 1 ? "" : "s"}: ${sites.join(", ")}`
          : `${value.length} of ${sites.length}: ${value.join(", ")}`
      }
    >
      <span className="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-muted">
        <img src={getLocationPhoto(primary)} alt="" className="w-full h-full object-cover" />
      </span>
      <span className="text-[10.5px] text-slate-600 truncate" style={{ fontWeight: 500 }}>{primary}</span>
      {extra > 0 && (
        <span className="text-[10px] text-[#4338CA] shrink-0" style={{ fontWeight: 700 }}>+{extra}</span>
      )}
    </span>
  );
}

export interface AddQualifiedVendorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The item's currently-qualified vendors (shown in the priority panel + the "Added" view). */
  existingVendors: QualifiedVendor[];
  /**
   * Commit (add): one entry per picked vendor with its captured config.
   * The canonical shape is `{ vendor, config }[]`; the bare `AvailableVendor[]`
   * member is a back-compat allowance for existing callers that add vendors
   * with a default config (e.g. ItemPurchasingTab) and configure later — it
   * keeps the modal a drop-in replacement without re-typing those handlers.
   */
  onAdd: (
    entries: { vendor: AvailableVendor; config: QualifiedVendorConfig }[] | AvailableVendor[],
    /** Re-ranked priority/default for the item's already-qualified vendors,
     *  edited from the roster list. Apply these to the existing rows on commit.
     *  `config` is present only when that saved vendor's pricing/freight/rules
     *  were edited inline this session — apply it like a new vendor's config. */
    existingPriority?: Record<string, { priority: number; isDefault: boolean; config?: QualifiedVendorConfig }>,
    /** The roster's full flat key order (top to bottom). The commit orders the
     *  combined list by this so within-tie sequence is preserved (densifyRanks
     *  breaks ties by array order). */
    order?: string[],
  ) => void;
  /** Remove a qualified vendor from the Added view. */
  onRemove?: (qv: QualifiedVendor) => void;
  /** Edit mode: open straight in Configure for this one vendor. */
  editMode?: boolean;
  editVendor?: QualifiedVendor | null;
  /** Edit-all mode: open straight in the Configure master-detail for the whole
   *  roster (no stepper, no Browse) so any existing vendor's pricing, priority,
   *  and details can be edited. Commits via onAdd (existingPriority). */
  editAll?: boolean;
  /** Edit-all entry focus: when opening editAll from a row's "Edit Configuration",
   *  the vendor to land on (else the first roster vendor). */
  editAllFocusVendorId?: string | null;
  /** Save edit: persist updated config for an existing qualified vendor. */
  onEditSave?: (qvId: string, config: QualifiedVendorConfig) => void;
}

type ModalView = "browse" | "added" | "configure";
const PER_PAGE = 15;
/* Single shared key for the Configure-step priority order. Unlike the
   partner flow (one list per item, one draft each), every vendor in this
   batch competes in ONE list, so the dragged order is stored once for the
   whole batch rather than per-focused-vendor. */
const PRIORITY_BATCH_KEY = "__batch__";
const DRAFT_PREFIX = "draft:";

/* Builds a fresh default config for a newly-picked vendor. Freight +
   Pricing Rules seed from the inherited defaults so the user sees
   concrete cards instead of empty states. */
function makeDefaultConfig(): QualifiedVendorConfig {
  return {
    priority: "auto",
    pricePerUnit: "",
    uom: "Each",
    minOrderQty: "",
    maxOrderQty: "",
    multiples: "",
    acceptedDeviationPct: "",
    leadTimeDays: "",
    locationIds: [], // empty = applies to all of the vendor's locations
    additionalPrices: [],
    shippingMethodIds: [...INHERITED_FREIGHT_METHOD_IDS],
    defaultShippingMethodId: INHERITED_FREIGHT_METHOD_IDS[0] || "",
    appliedPricingRuleIds: [...INHERITED_PRICING_RULE_IDS],
  };
}

/* Rebuilds the editable config for an ALREADY-qualified vendor so it can be
   tuned inline from the roster (not just re-ranked). Prefers the full config
   captured when it was first qualified (lossless); otherwise reconstructs the
   standard fields from the row's numeric columns. Priority/default always
   reflect the row's current values — the roster owns those. */
function configFromQv(qv: QualifiedVendor): QualifiedVendorConfig {
  if (qv.config) {
    return { ...qv.config, priority: String(qv.priority), isDefault: !!qv.isPrimary };
  }
  const numStr = (n?: number) => (n != null && n > 0 ? String(n) : "");
  return {
    ...makeDefaultConfig(),
    priority: String(qv.priority),
    isDefault: !!qv.isPrimary,
    pricePerUnit: numStr(qv.pricePerUnit),
    uom: qv.vendorUOM || "Each",
    minOrderQty: numStr(qv.minOrderQty),
    maxOrderQty: numStr(qv.maxOrderQty),
    multiples: numStr(qv.multiples),
    acceptedDeviationPct: numStr(qv.acceptedDeviation),
    leadTimeDays: numStr(qv.lastPOLeadTime),
    locationIds: qv.partnerLocations && qv.partnerLocations.length ? [...qv.partnerLocations] : [],
  };
}

/* The roster entry shape used inside the Vendor-priority panel. Mirrors
   the source `OtherQualifiedVendor`, built from the item's existing
   qualified vendors (the inverse of the source's per-item QV lookup). */
interface PriorityRosterVendor {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  priority: number;
  price: number;
  uom: string;
  leadTimeDays: number;
}

export function AddQualifiedVendorModal({
  open,
  onOpenChange,
  existingVendors,
  onAdd,
  onRemove,
  editMode,
  editVendor,
  editAll,
  editAllFocusVendorId,
  onEditSave,
}: AddQualifiedVendorModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addedSelectedIds, setAddedSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ModalView>("browse");
  const [addedSearch, setAddedSearch] = useState("");
  const [addedPage, setAddedPage] = useState(1);

  // Per-vendor config captured in the Configure step. Keyed by vendor id
  // so jumping back to Browse and refining the selection doesn't lose
  // values the user already typed.
  const [configById, setConfigById] = useState<Record<string, QualifiedVendorConfig>>({});
  // Priority/default overrides for the item's ALREADY-qualified vendors, edited
  // from the left roster list (existing QVs are re-rankable alongside new ones).
  // Absent entries fall back to the QV's own priority / isPrimary.
  const [existingPriorityById, setExistingPriorityById] = useState<Record<string, { priority: number; isDefault: boolean }>>({});
  // Explicit flat order of the roster, set when the user repositions a card with
  // the insertion line. Absent = the natural existing-then-new order. Tiers come
  // from priority (computeRoster); this only sequences cards that SHARE a tier,
  // and is the order committed on Save (densifyRanks breaks ties by array order).
  const [rosterOrderById, setRosterOrderById] = useState<Record<string, number>>({});
  // Per-vendor location scope — empty array / absent = all of the vendor's
  // locations, else the chosen subset of sites (multi-select). Single source of
  // truth for both the Browse picker and the Configure card; folded into
  // config.locationIds at commit.
  const [vendorLocationsById, setVendorLocationsById] = useState<Record<string, string[]>>({});
  const setVendorLocations = useCallback(
    (id: string, next: string[]) => setVendorLocationsById((prev) => ({ ...prev, [id]: next })),
    [],
  );
  // Apply-to-all helper draft — lives at the Configure-step header and
  // can be stamped onto every selected card with one click.
  const [bulkConfigDraft, setBulkConfigDraft] = useState<QualifiedVendorConfig>(() => makeDefaultConfig());

  // Configure step layout — split-pane wizard (left rail list, right
  // panel form). Only one vendor is focused at a time.
  const [focusedVendorId, setFocusedVendorId] = useState<string | null>(null);
  const [configureRailSearch, setConfigureRailSearch] = useState("");

  type ConfigSection = "config" | "freight" | "pricing";
  const [openSections, setOpenSections] = useState<Set<ConfigSection>>(() => new Set(["config", "freight", "pricing"]));
  const toggleSection = (s: ConfigSection) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  // Exit-warning state — unsaved work prompts a discard confirmation.
  const [exitWarnOpen, setExitWarnOpen] = useState(false);

  // Apply-to-all lives in a Popover anchored to the toolbar.
  const [bulkPopoverOpen, setBulkPopoverOpen] = useState(false);
  // Add-Carrier / Add-Rule picker popovers — track which vendor the
  // picker is open for. Only one of each may be open at a time.
  const [addCarrierOpenForVendor, setAddCarrierOpenForVendor] = useState<string | null>(null);
  const [addRuleOpenForVendor, setAddRuleOpenForVendor] = useState<string | null>(null);
  // Search terms for the carrier / rule pickers (both list a full, growable
  // catalog, so they get a filter box). Cleared when the popover closes.
  const [carrierSearch, setCarrierSearch] = useState("");
  const [ruleSearch, setRuleSearch] = useState("");
  // Priority picker in the focused-vendor header (master-detail view).
  const [headerPriorityOpen, setHeaderPriorityOpen] = useState(false);
  // Per-card "Additional configuration" collapse state for the Pricing
  // section. Keyed by `${vendorId}:p` (primary) / `${vendorId}:${ti}`.
  const [pricingConfigOpen, setPricingConfigOpen] = useState<Set<string>>(new Set());

  // Per-vendor priority slot map (sparse 10-slot array, index 0 = priority 1).
  const [qvOrderById, setQvOrderById] = useState<Record<string, (string | null)[]>>({});
  const [qvDragId, setQvDragId] = useState<string | null>(null);
  const [qvDragOverId, setQvDragOverId] = useState<string | null>(null);
  const qvDragIdRef = useRef<string | null>(null);
  // The focused draft's row in the priority list — used to scroll it into
  // view when Configure opens / focus changes, so a vendor that lands at
  // slot 10+ (below the fold) is revealed instead of hidden.
  const focusedDraftRowRef = useRef<HTMLLIElement | null>(null);

  // Inherited-id sets per vendor — let the Freight + Pricing Rules cards
  // render an "Inherited" pill on the seeded rows.
  const [inheritedFreightByVendor, setInheritedFreightByVendor] = useState<Record<string, Set<string>>>({});
  const [inheritedPricingByVendor, setInheritedPricingByVendor] = useState<Record<string, Set<string>>>({});

  // ── Pricing-rule actions (shared-rule edit warning / remove confirm / create+edit wizard) ──
  const [pendingRuleEdit, setPendingRuleEdit] = useState<{ vendorId: string; rule: QvPricingRule } | null>(null);
  const [pendingRuleRemove, setPendingRuleRemove] = useState<{ vendorId: string; rule: QvPricingRule } | null>(null);
  /** Drives the canonical Create/Edit Pricing Rule wizard. 'create' = fresh,
   *  'copy' = vendor-scoped copy of a shared rule, 'edit' = edit (shared
   *  override for presets, in-place for vendor-scoped customs). */
  const [ruleSession, setRuleSession] = useState<{ mode: "create" | "copy" | "edit"; vendorId: string; rule?: QvPricingRule } | null>(null);
  /** Vendor-scoped rules minted this session (copies + Create New). They join
   *  the presets everywhere rules are listed. */
  const [customVendorRules, setCustomVendorRules] = useState<QvPricingRule[]>([]);
  /** "Edit for all vendors" outcomes: label/subtitle/type overrides on presets. */
  const [sharedRuleOverrides, setSharedRuleOverrides] = useState<Record<string, Partial<QvPricingRule>>>({});
  const allPricingRules = useMemo<QvPricingRule[]>(
    () => [
      ...QV_PRICING_RULE_PRESETS.map((r) => (sharedRuleOverrides[r.id] ? { ...r, ...sharedRuleOverrides[r.id] } : r)),
      ...customVendorRules,
    ],
    [customVendorRules, sharedRuleOverrides],
  );
  /** Deterministic affected-vendors roster for the shared-rule edit warning:
   *  other vendors that use the rule (stable subset seeded from the rule id). */
  const affectedVendorsForRule = useMemo<AvailableVendor[]>(() => {
    if (!pendingRuleEdit) return [];
    const others = AVAILABLE_VENDORS.filter((x) => x.id !== pendingRuleEdit.vendorId);
    if (others.length === 0) return [];
    const seed = pendingRuleEdit.rule.id.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
    const count = Math.min(3 + (seed % 4), others.length);
    const start = seed % others.length;
    return Array.from({ length: count }, (_, i) => others[(start + i) % others.length]);
  }, [pendingRuleEdit]);
  const vendorNameById = (id: string) =>
    AVAILABLE_VENDORS.find((x) => x.id === id)?.name ||
    (editMode && editVendor && editVendor.id === id ? editVendor.vendorName : "this vendor");
  const vendorCurrencyById = (id: string) =>
    existingVendors.find((q) => q.id === id)?.currency ||
    AVAILABLE_VENDORS.find((x) => x.id === id)?.currency ||
    (editMode && editVendor && editVendor.id === id ? editVendor.currency : undefined);

  function handleRemoveRuleFromVendor() {
    if (!pendingRuleRemove) return;
    const { vendorId, rule } = pendingRuleRemove;
    const ids = configById[vendorId]?.appliedPricingRuleIds || [];
    updateVendorConfig(vendorId, { appliedPricingRuleIds: ids.filter((rid) => rid !== rule.id) });
    toast.success(`"${rule.label}" removed from ${vendorNameById(vendorId)}.`);
    setPendingRuleRemove(null);
  }
  function handleCreateRuleCopy() {
    if (!pendingRuleEdit) return;
    setRuleSession({ mode: "copy", vendorId: pendingRuleEdit.vendorId, rule: pendingRuleEdit.rule });
    setPendingRuleEdit(null);
  }
  function handleEditRuleForAll() {
    if (!pendingRuleEdit) return;
    setRuleSession({ mode: "edit", vendorId: pendingRuleEdit.vendorId, rule: pendingRuleEdit.rule });
    setPendingRuleEdit(null);
  }
  function handleRuleSaved(saved: { name: string; description: string; category: "discount" | "premium" }) {
    if (!ruleSession) return;
    const { mode, vendorId, rule } = ruleSession;
    const ids = configById[vendorId]?.appliedPricingRuleIds || [];
    if (mode === "create") {
      const id = `custom-${vendorId}-${customVendorRules.length + 1}-${saved.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const created: QvPricingRule = { id, label: saved.name.trim(), subtitle: saved.description || (saved.category === "discount" ? "Discount rule" : "Premium rule"), type: saved.category, custom: true };
      setCustomVendorRules((prev) => [...prev, created]);
      updateVendorConfig(vendorId, { appliedPricingRuleIds: [...ids, id] });
      toast.success(`"${created.label}" created and applied to ${vendorNameById(vendorId)}.`);
    } else if (mode === "copy" && rule) {
      const copy: QvPricingRule = { id: `${rule.id}--copy-${vendorId}`, label: saved.name.trim(), subtitle: saved.description || rule.subtitle, type: saved.category, custom: true };
      setCustomVendorRules((prev) => (prev.some((r) => r.id === copy.id) ? prev.map((r) => (r.id === copy.id ? copy : r)) : [...prev, copy]));
      updateVendorConfig(vendorId, { appliedPricingRuleIds: ids.map((rid) => (rid === rule.id ? copy.id : rid)) });
      toast.success(`"${copy.label}" saved and applied to ${vendorNameById(vendorId)}. Other vendors keep the original.`);
    } else if (mode === "edit" && rule) {
      if (rule.custom) {
        setCustomVendorRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, label: saved.name.trim(), subtitle: saved.description || r.subtitle, type: saved.category } : r)));
        toast.success(`"${saved.name.trim()}" updated.`);
      } else {
        setSharedRuleOverrides((prev) => ({ ...prev, [rule.id]: { label: saved.name.trim(), subtitle: saved.description || rule.subtitle, type: saved.category } }));
        toast.success(`"${saved.name.trim()}" updated for all vendors using this rule.`);
      }
    }
    setRuleSession(null);
  }

  const [bulkRemoveConfirmOpen, setBulkRemoveConfirmOpen] = useState(false);
  const [pendingSingleRemoveId, setPendingSingleRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setAddedSelectedIds(new Set());
      setPage(1);
      setAddedSearch("");
      setAddedPage(1);
      setBulkConfigDraft(makeDefaultConfig());
      setOpenSections(new Set(["config", "freight", "pricing"]));
      setBulkPopoverOpen(false);
      setInheritedFreightByVendor({});
      setInheritedPricingByVendor({});
      setQvOrderById({});
      // Edit-Configuration entry — jump straight to Configure with the
      // single edited vendor pre-selected and its existing config seeded.
      if (editMode && editVendor) {
        setSelectedIds(new Set([editVendor.id]));
        setFocusedVendorId(editVendor.id);
        setView("configure");
        const existing = editVendor.config;
        setConfigById({
          [editVendor.id]: existing ? { ...existing } : makeDefaultConfig(),
        });
        setVendorLocationsById({ [editVendor.id]: existing?.locationIds ?? [] });
      } else if (editAll) {
        // Edit-all entry — jump straight to the Configure master-detail for the
        // whole existing roster (no Browse, no new selection). Each existing
        // vendor's config is seeded lazily on focus (handleFocusVendor) / edit.
        setSelectedIds(new Set());
        setConfigById({});
        setVendorLocationsById({});
        setView("configure");
        // Land on the vendor whose row was clicked (Edit Configuration); fall
        // back to the first roster vendor for the "Edit vendor list" button.
        setFocusedVendorId(
          (editAllFocusVendorId && existingVendors.some((v) => v.id === editAllFocusVendorId)
            ? editAllFocusVendorId
            : existingVendors[0]?.id) ?? null,
        );
      } else {
        setSelectedIds(new Set());
        setConfigById({});
        setVendorLocationsById({});
        setView("browse");
        setFocusedVendorId(null);
      }
    }
  }, [open, editMode, editVendor, editAll, editAllFocusVendorId]);

  // Scroll the focused vendor's draft row into view inside the priority
  // list whenever Configure opens or focus changes (issue: a 10th-slot
  // vendor was below the fold). rAF lets the list lay out first.
  useEffect(() => {
    if (view !== "configure") return;
    if (!openSections.has("config")) return;
    const raf = window.requestAnimationFrame(() => {
      focusedDraftRowRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [view, focusedVendorId, openSections]);

  // Browse pool = AVAILABLE_VENDORS minus any whose name matches an
  // existing vendor's vendorName (case-insensitive).
  const usedNames = useMemo(
    () => new Set(existingVendors.map((v) => v.vendorName.toLowerCase())),
    [existingVendors],
  );
  const available = useMemo(
    () => AVAILABLE_VENDORS.filter((v) => !usedNames.has(v.name.toLowerCase())),
    [usedNames],
  );

  const matchesSearch = (v: AvailableVendor, q: string) =>
    v.name.toLowerCase().includes(q) ||
    v.id.toLowerCase().includes(q) ||
    v.location.toLowerCase().includes(q) ||
    (v.partnerGroup ?? "").toLowerCase().includes(q);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? available.filter((v) => matchesSearch(v, q)) : available;
  }, [available, search]);

  const addedFiltered = useMemo(() => {
    let list = existingVendors;
    if (addedSearch.trim()) {
      const q = addedSearch.toLowerCase();
      list = list.filter(
        (v) =>
          v.vendorName.toLowerCase().includes(q) ||
          v.vendorId.toLowerCase().includes(q) ||
          v.location.toLowerCase().includes(q) ||
          (v.partnerGroup ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [existingVendors, addedSearch]);

  // The browse list shows ONLY vendors that are NOT already qualified: the
  // vendors picked this session pin to the top, then the rest of the addable
  // pool. Already-added vendors are managed from the Edit Vendors flow, so they
  // are intentionally excluded here (the `available` pool already drops them).
  // (browse list = not-yet-qualified vendors only.)
  const sortedBrowse = useMemo<{ vendor: AvailableVendor; state: RowState; qv?: QualifiedVendor }[]>(() => {
    // Selected vendors stay pinned to the top regardless of the search query,
    // so picking one then searching for another never makes it disappear. They
    // come from the full pool, not the search-filtered one.
    const selectedRows = available
      .filter((v) => selectedIds.has(v.id))
      .map((vendor) => ({ vendor, state: "selected" as RowState, qv: undefined }));
    // Addable rows below — search-filtered, minus anything already selected.
    const availableRows = filtered
      .filter((v) => !selectedIds.has(v.id))
      .map((vendor) => ({ vendor, state: "available" as RowState, qv: undefined }));
    return [...selectedRows, ...availableRows];
  }, [available, filtered, selectedIds]);

  const browseTotalPages = Math.max(1, Math.ceil(sortedBrowse.length / PER_PAGE));
  const browsePaginated = sortedBrowse.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // The Browse/Added tab split was merged; view is only "browse" | "configure"
  // now. Keep the alias shape the rest of the component reads.
  const currentSearch = search;
  const setCurrentSearch = setSearch;
  const currentPage = page;
  const setCurrentPage = setPage;
  const currentTotalPages = browseTotalPages;
  const currentTotal = sortedBrowse.length;

  function toggleVendor(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleAddedVendor(id: string) {
    setAddedSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Browse-step CTA — step into Configure to capture pricing + ordering
  // params per vendor before commit.
  function handleAdd() {
    const vendors = AVAILABLE_VENDORS.filter((v) => selectedIds.has(v.id));
    // Vendors picked THIS round have no config yet (configById holds the ones
    // already configured). Focus the first of them so the roster scrolls to the
    // newly added vendor and its config form opens.
    const newlyAdded = vendors.filter((v) => !configById[v.id]);
    setConfigById((prev) => {
      const next: Record<string, QualifiedVendorConfig> = { ...prev };
      vendors.forEach((v) => {
        if (!next[v.id]) next[v.id] = makeDefaultConfig();
      });
      return next;
    });
    setInheritedFreightByVendor((prev) => {
      const next = { ...prev };
      vendors.forEach((v) => {
        if (!next[v.id]) next[v.id] = new Set(INHERITED_FREIGHT_METHOD_IDS);
      });
      return next;
    });
    setInheritedPricingByVendor((prev) => {
      const next = { ...prev };
      vendors.forEach((v) => {
        if (!next[v.id]) next[v.id] = new Set(INHERITED_PRICING_RULE_IDS);
      });
      return next;
    });
    setFocusedVendorId((newlyAdded[0] ?? vendors[0])?.id || null);
    setOpenSections(new Set(["config", "freight", "pricing"]));
    setView("configure");
  }

  // Configure-step Save. Stamps each selected vendor with its captured
  // config, then commits via onAdd (or onEditSave in edit mode).
  function handleSaveConfigured() {
    if (editMode && editVendor) {
      const editCfg = { ...(configById[editVendor.id] || makeDefaultConfig()), locationIds: vendorLocationsById[editVendor.id] || [] };
      onEditSave?.(editVendor.id, editCfg);
      onOpenChange(false);
      toast.success("Configuration updated");
      return;
    }
    const vendors = AVAILABLE_VENDORS.filter((v) => selectedIds.has(v.id) && !existingVendors.some((q) => q.id === v.id));
    const entries = vendors.map((v) => ({
      vendor: v,
      // Fold the chosen location scope + the roster-resolved priority/default
      // into the committed config (empty locations = all of the vendor's sites).
      config: {
        ...(configById[v.id] || makeDefaultConfig()),
        locationIds: vendorLocationsById[v.id] || [],
        priority: String(roster.tierByKey[v.id] ?? MAX_PRIORITY),
        isDefault: roster.defaultKey === v.id,
      },
    }));
    // Re-ranked priority/default for the item's existing qualified vendors,
    // plus their full config when it was edited inline this session.
    const existingPriority: Record<string, { priority: number; isDefault: boolean; config?: QualifiedVendorConfig }> = {};
    existingVendors.forEach((q) => {
      const priority = roster.tierByKey[q.id] ?? q.priority;
      const isDefault = roster.defaultKey === q.id;
      const edited = configById[q.id];
      existingPriority[q.id] = {
        priority,
        isDefault,
        ...(edited
          ? { config: { ...edited, locationIds: vendorLocationsById[q.id] ?? edited.locationIds ?? [], priority: String(priority), isDefault } }
          : {}),
      };
    });
    onAdd(entries, existingPriority, roster.cards.map((c) => c.key));
    onOpenChange(false);
    if (entries.length > 0) {
      toast.success(`${entries.length} vendor${entries.length !== 1 ? "s" : ""} added as qualified`);
    } else {
      toast.success("Vendor changes saved");
    }
  }

  function updateVendorConfig(id: string, patch: Partial<QualifiedVendorConfig>) {
    setConfigById((prev) => {
      // First touch of a saved vendor seeds from its real config, so an inline
      // edit patches the existing values rather than a blank default.
      const existing = prev[id];
      const seed =
        existing ?? (() => {
          const qv = existingVendors.find((q) => q.id === id);
          return qv ? configFromQv(qv) : makeDefaultConfig();
        })();
      return { ...prev, [id]: { ...seed, ...patch } };
    });
  }

  /* ── Roster (left priority list) ──────────────────────────────────────
     One unified, priority-ranked list of EVERY qualified vendor for the item:
     those already saved plus the ones being added now. Raw ranks come from each
     existing QV (or its override) and from each new draft's captured config;
     computeRoster densifies them into tie-allowing, gap-free tiers and picks the
     single default. Shared by the list render and the Save commit. */
  const rosterInput = useMemo<RosterInputVendor[]>(() => {
    // Each vendor's price in its own currency (spec 4.1).
    const fmtPrice = (n: number, code: string) => (n > 0 ? formatMoney(n, code) : "Not set");
    const fmtLead = (d: number) => (d > 0 ? (d < 7 ? `${d}d` : `${Math.round((d / 7) * 10) / 10}wk`) : "Not set");
    const existing: RosterInputVendor[] = existingVendors.map((q) => {
      const o = existingPriorityById[q.id];
      return {
        id: q.id,
        name: q.vendorName,
        location: q.location,
        isNew: false,
        priority: o ? o.priority : q.priority,
        isDefault: o ? o.isDefault : !!q.isPrimary,
        priceLabel: fmtPrice(q.pricePerUnit, q.currency),
        uomLabel: q.vendorUOM || "Each",
        leadLabel: fmtLead(q.lastPOLeadTime),
        priced: q.pricePerUnit > 0,
      };
    });
    // Each newly-picked vendor seeds into its OWN priority lane (one per tier),
    // appended below the lowest existing rank, instead of all landing in
    // Priority 1. The user then drags to re-rank or to share a tier.
    const maxExistingRaw = existing.reduce((m, e) => Math.max(m, e.priority), 0);
    const newOnes: RosterInputVendor[] = editMode
      ? []
      : AVAILABLE_VENDORS.filter((v) => selectedIds.has(v.id) && !existingVendors.some((q) => q.id === v.id)).map((v, i) => {
          const cfg = configById[v.id] || makeDefaultConfig();
          const parsed = cfg.priority && cfg.priority !== "auto" ? parseFloat(cfg.priority) : NaN;
          return {
            id: v.id,
            name: v.name,
            location: v.location,
            isNew: true,
            priority: Number.isFinite(parsed) ? parsed : maxExistingRaw + 1 + i,
            isDefault: !!cfg.isDefault,
            priceLabel: cfg.pricePerUnit.trim() ? fmtPrice(Number(cfg.pricePerUnit), v.currency ?? vendorCurrencyFor(v.country)) : "Not set",
            uomLabel: cfg.uom || "Each",
            leadLabel: cfg.leadTimeDays ? fmtLead(Number(cfg.leadTimeDays)) : "Not set",
            priced: !!cfg.pricePerUnit.trim(),
          };
        });
    const all = [...existing, ...newOnes];
    // Within-tie sequence: honor the user's explicit order when present; the
    // default is the natural existing-then-new order. computeRoster groups by
    // priority (tier), so this only sequences cards that SHARE a tier.
    const defaultPos = new Map(all.map((v, idx) => [v.id, idx]));
    const orderOf = (id: string) => rosterOrderById[id] ?? defaultPos.get(id) ?? 0;
    return [...all].sort((a, b) => orderOf(a.id) - orderOf(b.id));
  }, [existingVendors, existingPriorityById, configById, selectedIds, editMode, rosterOrderById]);

  const roster = useMemo(() => computeRoster(rosterInput), [rosterInput]);

  /* ── Edit Vendors: change tracking + revert vs the saved baseline ─────────
     Mirrors the category config revert. A field is "Modified" when the value
     Save would persist differs from the vendor's saved config (configFromQv).
     Tracks pricing, priority, default, locations, carriers, and pricing rules.
     Only already-qualified vendors have a baseline; new ones are "New" here. */
  const VENDOR_CONFIG_DIFF_KEYS = [
    "pricePerUnit", "uom", "minOrderQty", "maxOrderQty", "multiples",
    "acceptedDeviationPct", "leadTimeDays", "additionalPrices", "rateType", "exchangeRate",
    "shippingMethodIds", "defaultShippingMethodId", "appliedPricingRuleIds",
  ] as const;
  const sameVendorVal = (a: unknown, b: unknown) => {
    const norm = (v: unknown) =>
      v == null ? "" : Array.isArray(v) ? JSON.stringify([...v].map((x) => JSON.stringify(x)).sort()) : typeof v === "object" ? JSON.stringify(v) : String(v);
    return norm(a) === norm(b);
  };
  const vendorChangedKeys = useCallback(
    (id: string | null): Set<string> => {
      const keys = new Set<string>();
      if (!id) return keys;
      const qv = existingVendors.find((q) => q.id === id);
      if (!qv) return keys; // new vendors have no saved baseline
      const base = configFromQv(qv) as Record<string, unknown>;
      const cur = configById[id] as Record<string, unknown> | undefined;
      if (cur) {
        for (const k of VENDOR_CONFIG_DIFF_KEYS) {
          // A vendor with no rate type saved is on the default (mid-market).
          if (k === "rateType") {
            if ((cur[k] ?? DEFAULT_RATE_TYPE) !== (base[k] ?? DEFAULT_RATE_TYPE)) keys.add(k);
          } else if (!sameVendorVal(cur[k], base[k])) keys.add(k);
        }
      }
      const o = existingPriorityById[id];
      if (o && o.priority !== qv.priority) keys.add("priority");
      if ((roster.defaultKey === id) !== !!qv.isPrimary) keys.add("isDefault");
      const locs = vendorLocationsById[id];
      if (locs && !sameVendorVal(locs, (base.locationIds as string[]) ?? [])) keys.add("locationIds");
      return keys;
    },
    [existingVendors, configById, existingPriorityById, vendorLocationsById, roster],
  );
  const modifiedVendorIds = useMemo(() => {
    const m = new Set<string>();
    existingVendors.forEach((q) => { if (vendorChangedKeys(q.id).size > 0) m.add(q.id); });
    return m;
  }, [existingVendors, vendorChangedKeys]);
  const totalVendorChanges = useMemo(() => {
    let n = 0;
    existingVendors.forEach((q) => { n += vendorChangedKeys(q.id).size; });
    return n;
  }, [existingVendors, vendorChangedKeys]);
  const revertVendorField = useCallback(
    (id: string, key: string) => {
      const qv = existingVendors.find((q) => q.id === id);
      if (!qv) return;
      const base = configFromQv(qv) as Record<string, unknown>;
      // The typed rate belongs to the rate type: reverting the type restores both.
      updateVendorConfig(id, (key === "rateType"
        ? { rateType: base.rateType, exchangeRate: base.exchangeRate }
        : { [key]: base[key] }) as Partial<QualifiedVendorConfig>);
    },
    [existingVendors], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const revertVendor = useCallback(
    (id: string) => {
      const qv = existingVendors.find((q) => q.id === id);
      if (!qv) return;
      const base = configFromQv(qv);
      setConfigById((prev) => ({ ...prev, [id]: { ...base } }));
      setExistingPriorityById((prev) => ({ ...prev, [id]: { priority: qv.priority, isDefault: !!qv.isPrimary } }));
      setVendorLocationsById((prev) => ({ ...prev, [id]: base.locationIds ?? [] }));
      setRosterOrderById((prev) => { const n = { ...prev }; delete n[id]; return n; });
    },
    [existingVendors],
  );
  const revertAllVendors = useCallback(() => {
    setConfigById((prev) => {
      const n = { ...prev };
      existingVendors.forEach((q) => { if (n[q.id]) n[q.id] = { ...configFromQv(q) }; });
      return n;
    });
    setExistingPriorityById(() => {
      const n: Record<string, { priority: number; isDefault: boolean }> = {};
      existingVendors.forEach((q) => { n[q.id] = { priority: q.priority, isDefault: !!q.isPrimary }; });
      return n;
    });
    setVendorLocationsById((prev) => {
      const n = { ...prev };
      existingVendors.forEach((q) => { if (n[q.id]) n[q.id] = configFromQv(q).locationIds ?? []; });
      return n;
    });
    setRosterOrderById({});
  }, [existingVendors]);

  // Write a raw rank for a key — existing vendors store an override, new drafts
  // store it on their config. The next render re-densifies (so no gaps appear).
  const setRosterRaw = useCallback(
    (k: string, p: number) => {
      if (existingVendors.some((q) => q.id === k)) {
        setExistingPriorityById((prev) => {
          const qv = existingVendors.find((q) => q.id === k);
          const cur = prev[k] ?? { priority: qv?.priority ?? MAX_PRIORITY, isDefault: !!qv?.isPrimary };
          return { ...prev, [k]: { ...cur, priority: p } };
        });
      } else {
        setConfigById((prev) => ({ ...prev, [k]: { ...(prev[k] || makeDefaultConfig()), priority: String(p) } }));
      }
    },
    [existingVendors],
  );
  const handleRosterSetPriority = useCallback((k: string, tier: number) => setRosterRaw(k, tier), [setRosterRaw]);
  // Reposition via the insertion line: drop `key` just before `beforeKey` (or at
  // the very end when null). Unlike a lane drop (which joins a tier), this sets
  // the card's RANK from its new neighbours — landing between two tiers gives it
  // its own rank; landing between two cards that share a tier joins that tie at
  // this position. The new flat order is recorded for within-tie sequence + Save.
  const handleRosterReposition = useCallback(
    (key: string, beforeKey: string | null) => {
      const current = roster.cards.map((c) => c.key);
      const flat = current.filter((k) => k !== key);
      const insertAt = beforeKey == null ? flat.length : (flat.indexOf(beforeKey) === -1 ? flat.length : flat.indexOf(beforeKey));
      flat.splice(insertAt, 0, key);
      // No-op drop (same position): skip so it doesn't spuriously mark changes.
      if (flat.length === current.length && flat.every((k, i) => k === current[i])) return;
      const tierOf = (k: string) => roster.tierByKey[k] ?? MAX_PRIORITY;
      const curTier = roster.tierByKey[key] ?? MAX_PRIORITY; // the dragged card's tier
      const prevK = insertAt > 0 ? flat[insertAt - 1] : null;
      const nextK = insertAt < flat.length - 1 ? flat[insertAt + 1] : null;
      const aboveTier = prevK != null ? tierOf(prevK) : null;
      const belowTier = nextK != null ? tierOf(nextK) : null;
      let newRank: number;
      if (aboveTier != null && belowTier != null && aboveTier === belowTier) {
        newRank = aboveTier; // dropped strictly between two tied cards -> join that tie
      } else if (aboveTier == null) {
        // Top boundary: stay in the top tier when the card already lives there
        // (reorder within the tie), otherwise take a fresh top rank.
        newRank = belowTier === curTier ? curTier : (belowTier ?? 1) - 0.5;
      } else if (belowTier == null) {
        // Bottom boundary: stay in the last tier when already there, else a
        // fresh bottom rank.
        newRank = aboveTier === curTier ? curTier : aboveTier + 0.5;
      } else {
        newRank = (aboveTier + belowTier) / 2; // between two tiers -> own rank
      }
      // Recompute integer tiers for the WHOLE roster from (current tiers + the
      // moved card's new rank) and write them back, so a card's stored raw rank
      // always equals its displayed tier. Otherwise a fractional raw left here
      // would mismatch a later lane drop (which sets raw = the tier number).
      const rawOf = (k: string) => (k === key ? newRank : tierOf(k));
      const distinct = Array.from(new Set(flat.map(rawOf))).sort((a, b) => a - b);
      const tierMap = new Map(distinct.map((v, i) => [v, Math.min(i + 1, MAX_PRIORITY)]));
      flat.forEach((k) => setRosterRaw(k, tierMap.get(rawOf(k))!));
      const orderMap: Record<string, number> = {};
      flat.forEach((k, idx) => { orderMap[k] = idx; });
      setRosterOrderById(orderMap);
    },
    [roster, setRosterRaw],
  );
  // Exactly one default across the WHOLE roster (existing + new).
  const handleRosterDefault = useCallback(
    (k: string) => {
      setExistingPriorityById((prev) => {
        const next = { ...prev };
        existingVendors.forEach((q) => {
          const cur = next[q.id] ?? { priority: q.priority, isDefault: !!q.isPrimary };
          next[q.id] = { ...cur, isDefault: q.id === k };
        });
        return next;
      });
      setConfigById((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          next[id] = { ...next[id], isDefault: id === k };
        });
        return next;
      });
    },
    [existingVendors],
  );
  // Setting priority from the header pill. The default (auto-PO anchor) must be a
  // Priority 1 vendor, so moving a vendor off tier 1 clears its default flag
  // (ensureOneDefault then re-anchors the top rank).
  const handleHeaderSetPriority = useCallback(
    (k: string, tier: number) => {
      setRosterRaw(k, tier);
      if (tier !== 1) {
        setExistingPriorityById((prev) => {
          const cur = prev[k];
          return cur?.isDefault ? { ...prev, [k]: { ...cur, isDefault: false } } : prev;
        });
        setConfigById((prev) => {
          const cur = prev[k];
          return cur?.isDefault ? { ...prev, [k]: { ...cur, isDefault: false } } : prev;
        });
      }
    },
    [setRosterRaw],
  );
  const handleRosterRemove = useCallback(
    (k: string) =>
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(k);
        return n;
      }),
    [],
  );
  // Focus a roster card. For a saved vendor, seed its editable config + per-vendor
  // maps the first time, so clicking it opens its real pricing/freight/rules.
  const handleFocusVendor = useCallback(
    (k: string) => {
      setFocusedVendorId(k);
      const qv = existingVendors.find((q) => q.id === k);
      if (!qv) return;
      setConfigById((prev) => (prev[k] ? prev : { ...prev, [k]: configFromQv(qv) }));
      setVendorLocationsById((prev) =>
        prev[k] ? prev : { ...prev, [k]: (qv.config?.locationIds?.length ? qv.config.locationIds : qv.partnerLocations) ?? [] },
      );
      setInheritedFreightByVendor((prev) => (prev[k] ? prev : { ...prev, [k]: new Set(INHERITED_FREIGHT_METHOD_IDS) }));
      setInheritedPricingByVendor((prev) => (prev[k] ? prev : { ...prev, [k]: new Set(INHERITED_PRICING_RULE_IDS) }));
    },
    [existingVendors],
  );
  // Delete a priority lane: its vendors merge up into the lane above, and any
  // lower lanes shift up one rank. Operates on the resolved (densified) tiers,
  // writing raw ranks back to whichever store owns each card.
  const handleRosterDeleteLane = useCallback(
    (tier: number) => {
      const remap = (t: number) => (t === tier ? tier - 1 : t > tier ? t - 1 : t);
      setExistingPriorityById((prev) => {
        const next = { ...prev };
        existingVendors.forEach((q) => {
          const cur = next[q.id] ?? { priority: q.priority, isDefault: !!q.isPrimary };
          const curTier = roster.tierByKey[q.id] ?? cur.priority;
          next[q.id] = { ...cur, priority: remap(curTier) };
        });
        return next;
      });
      setConfigById((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          if (existingVendors.some((q) => q.id === id)) return;
          const curTier = roster.tierByKey[id];
          if (curTier == null) return;
          next[id] = { ...next[id], priority: String(remap(curTier)) };
        });
        return next;
      });
    },
    [existingVendors, roster],
  );

  function handleBulkRemove() {
    if (onRemove) {
      existingVendors.filter((v) => addedSelectedIds.has(v.id)).forEach(onRemove);
    }
    setAddedSelectedIds(new Set());
    setBulkRemoveConfirmOpen(false);
  }

  function handleSingleRemoveConfirm() {
    if (!pendingSingleRemoveId) return;
    const removed = existingVendors.find((v) => v.id === pendingSingleRemoveId);
    if (onRemove && removed) onRemove(removed);
    setAddedSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(pendingSingleRemoveId);
      return next;
    });
    setPendingSingleRemoveId(null);
  }

  // Unsaved-work check — any uncommitted browse selection, per-vendor
  // Configure draft, or having stepped past Browse into Configure.
  const hasUnsavedWork =
    !editMode && (selectedIds.size > 0 || Object.keys(configById).length > 0 || view === "configure");

  const handleCloseIntent = useCallback(() => {
    if (hasUnsavedWork) setExitWarnOpen(true);
    else onOpenChange(false);
  }, [hasUnsavedWork, onOpenChange]);

  const discardAndClose = useCallback(() => {
    setSelectedIds(new Set());
    setAddedSelectedIds(new Set());
    setConfigById({});
    setView("browse");
    setExitWarnOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  // Detail-modal sizing standard — tabbed modal gets the stable frame.
  const modalBaseTransition =
    "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const editModeWidth = editMode ? "sm:!max-w-[min(67.5vw,1332px)]" : "sm:!max-w-[min(75vw,1480px)]";
  const modalSizeClass = isFullScreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[100%] ${editModeWidth} !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;

  // Browse-view row renderer. Mirrors the partner select-items table
  // grammar: sticky checkbox + sticky identity column, then a wide
  // scrollable column set. Density + header styling match the source.
  const renderUnifiedRow = (row: { vendor: AvailableVendor; state: RowState; qv?: QualifiedVendor }) => {
    const { vendor, state, qv } = row;
    const isGreen = state !== "available";
    const cellBg = "bg-white group-hover:bg-[#F0F7FF]";
    const clickable = state !== "qualified";
    return (
      <TableRow
        key={`${state}-${vendor.id}`}
        className={cn(
          "group bg-white hover:bg-[#F0F7FF] [&>td]:py-1.5 [&>td]:pl-4 [&>td]:pr-2 transition-colors",
          clickable ? "cursor-pointer" : "cursor-default",
        )}
        onClick={clickable ? () => toggleVendor(vendor.id) : undefined}
      >
        {/* Status indicator doubles as an Add affordance — green check once added,
            hollow "+" otherwise. Clicking it adds/removes the vendor: for clickable
            rows it toggles directly; we let it fall through to the row handler so
            the "+" is one of the three add paths (the + icon, the row, the Add btn). */}
        <TableCell
          className={cn("sticky left-0 z-10 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0", cellBg)}
          onClick={clickable ? (e) => { e.stopPropagation(); toggleVendor(vendor.id); } : (e) => e.stopPropagation()}
        >
          {isGreen ? (
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-emerald-500 text-white">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border-[1.5px] border-slate-300 text-slate-300 group-hover:border-primary group-hover:text-primary transition-colors">
              <Plus className="w-3 h-3" />
            </span>
          )}
        </TableCell>
        <TableCell
          className={cn("sticky left-[40px] z-10", cellBg)}
          style={{ boxShadow: STICKY_SHADOW, width: 240, minWidth: 240, maxWidth: 240, overflow: "hidden" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <VendorAvatar name={vendor.name} size="md" square />
            <p className="text-sm truncate" style={{ fontWeight: 600, color: "#1E293B" }}>{highlightText(vendor.name, search)}</p>
          </div>
        </TableCell>
        {/* Partner Locations — interactive scope picker for addable/selected rows;
            read-only summary for already-qualified ones. Click-through stopped. */}
        <TableCell style={{ width: 260, minWidth: 260, maxWidth: 260, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
          {state === "qualified" ? (
            <LocationScopeSummary
              locations={vendor.partnerLocations ?? [vendor.location]}
              value={qv?.config?.locationIds ?? []}
            />
          ) : (
            <LocationScopePicker
              locations={vendor.partnerLocations ?? [vendor.location]}
              value={vendorLocationsById[vendor.id] ?? []}
              onChange={(next) => setVendorLocations(vendor.id, next)}
            />
          )}
        </TableCell>
        <TableCell style={{ width: 280, minWidth: 280, maxWidth: 280, overflow: "hidden" }}>
          <PointsOfContactCell rowId={vendor.id} contacts={vendor.contacts} />
        </TableCell>
        <TableCell style={{ width: 200, minWidth: 200, maxWidth: 200, overflow: "hidden" }}>
          <CountryCell country={vendor.country} countryFlag={vendor.countryFlag} />
        </TableCell>
        <TableCell className="text-right tabular-nums" style={{ width: 170, minWidth: 170, maxWidth: 170 }}>
          <CreditLimitCell creditLimit={vendor.creditLimit} currency={vendor.currency} />
        </TableCell>
        <TableCell style={{ width: 240, minWidth: 240, maxWidth: 240, overflow: "hidden" }}>
          <CarrierVendorCell carrier={vendor.carrierVendor} />
        </TableCell>
        {/* Per-vendor action — Add / Added (toggle off) / remove (already qualified). */}
        <TableCell
          className={cn("sticky right-0 z-10 text-right !pr-4", cellBg)}
          style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.06)", width: 132, minWidth: 132, maxWidth: 132 }}
          onClick={(e) => e.stopPropagation()}
        >
          {state === "available" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleVendor(vendor.id)}
              className="h-7 gap-1 rounded-lg border-primary/40 text-primary hover:bg-accent hover:border-primary px-2.5 text-[12px]"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          )}
          {state === "selected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleVendor(vendor.id)}
              className="h-7 gap-1 rounded-lg border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive px-2.5 text-[12px]"
              style={{ fontWeight: 600 }}
              title={`Remove ${vendor.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </Button>
          )}
          {state === "qualified" && onRemove && qv && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPendingSingleRemoveId(qv.id)}
              className="h-7 gap-1 rounded-lg border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive px-2.5 text-[12px]"
              style={{ fontWeight: 600 }}
              title={`Remove ${vendor.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const renderAddedRow = (qv: QualifiedVendor) => {
    const isSelected = addedSelectedIds.has(qv.id);
    const cellBg = stickyBg(isSelected);
    return (
      <TableRow
        key={qv.id}
        className={cn(
          "group bg-white hover:bg-[#F0F7FF] [&>td]:py-1.5 [&>td]:pl-4 [&>td]:pr-2",
          isSelected && "!bg-accent/30",
        )}
      >
        <TableCell className={cn("sticky left-0 z-10 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0", cellBg)}>
          <Checkbox checked={isSelected} onCheckedChange={() => toggleAddedVendor(qv.id)} />
        </TableCell>
        <TableCell
          className={cn("sticky left-[40px] z-10", cellBg)}
          style={{ boxShadow: STICKY_SHADOW, width: 240, minWidth: 240, maxWidth: 240, overflow: "hidden" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <VendorAvatar name={qv.vendorName} size="md" />
            <p className="text-sm truncate" style={{ fontWeight: 600, color: "#1E293B" }}>{qv.vendorName}</p>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm text-foreground">{qv.location}</span>
        </TableCell>
        <TableCell>
          {qv.partnerGroup ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-muted text-muted-foreground border border-border whitespace-nowrap" style={{ fontWeight: 500 }}>
              {qv.partnerGroup}
            </span>
          ) : (
            <span className="text-muted-foreground/50 text-sm">—</span>
          )}
        </TableCell>
        <TableCell className="text-right" style={{ width: 150, minWidth: 150 }}>
          <span className="text-sm tabular-nums text-foreground">
            {qv.pricePerUnit > 0 ? formatMoney(qv.pricePerUnit, qv.currency) : "—"}
          </span>
        </TableCell>
        {onRemove && (
          <TableCell
            className={cn("sticky right-0 z-10 text-right !pr-4", cellBg)}
            style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.06)", width: 70, minWidth: 70, maxWidth: 70 }}
          >
            <button
              type="button"
              onClick={() => setPendingSingleRemoveId(qv.id)}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
              title={`Remove ${qv.vendorName}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) onOpenChange(true);
          else handleCloseIntent();
        }}
      >
        <DialogContent
          className={`flex flex-col p-0 gap-0 border-0 sm:border ${modalSizeClass}`}
          hideCloseButton
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
        >
          <DialogTitle className="sr-only">{editMode ? "Edit Configuration" : editAll ? "Edit Vendors" : "Add Qualified Vendors"}</DialogTitle>
          <DialogDescription className="sr-only">
            {editMode
              ? "Edit qualified-vendor configuration for this vendor."
              : editAll
                ? "Edit pricing, priority, and details for any qualified vendor."
                : "Browse the vendor pool to qualify vendors for this item, or remove already-qualified vendors."}
          </DialogDescription>

          {/* Header — edit-Configuration variant shows the single vendor it
              scopes (avatar + name + Qualified Vendor pill on the left). */}
          {editMode && editVendor ? (
            <div className="px-3 sm:px-5 pt-3 sm:pt-3.5 pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <VendorAvatar name={editVendor.vendorName} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-[15px] sm:text-[16px] text-foreground tracking-[-0.005em] mr-1" style={{ fontWeight: 700 }}>
                        {editVendor.vendorName}
                      </h2>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] border"
                        style={{ fontWeight: 600, backgroundColor: "#EFF6FF", color: "#1E40AF", borderColor: "#BFDBFE" }}
                      >
                        <ShoppingCart className="w-2.5 h-2.5" />
                        Qualified Vendor
                      </span>
                      {editVendor.partnerGroup && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[10px] border bg-violet-50 text-violet-700 border-violet-200"
                          style={{ fontWeight: 600 }}
                        >
                          {editVendor.partnerGroup}
                        </span>
                      )}
                      {(() => {
                        const ecfg = configById[editVendor.id];
                        const efx = vendorRate(editVendor.currency, { rateType: ecfg?.rateType, exchangeRate: ecfg?.exchangeRate });
                        return (
                          <VendorCurrencyChip
                            fx={efx}
                            rateType={efx.rateType}
                            onRateTypeChange={(t) => updateVendorConfig(editVendor.id, { rateType: t, exchangeRate: undefined })}
                          />
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <p className="text-[11.5px] sm:text-[12px] text-slate-500 truncate">
                        {editVendor.location}
                      </p>
                      <LocationScopePicker
                        size="chip"
                        locations={editVendor.partnerLocations ?? [editVendor.location]}
                        value={vendorLocationsById[editVendor.id] ?? []}
                        onChange={(next) => setVendorLocations(editVendor.id, next)}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {isFullScreen ? "Exit full" : "Full view"}
                  </button>
                  <button
                    onClick={handleCloseIntent}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                      {editAll ? "Edit Vendors" : "Add Qualified Vendors"}
                    </h2>
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border"
                      style={{ fontWeight: 600, backgroundColor: "#EFF6FF", color: "#1E40AF", borderColor: "#BFDBFE" }}
                    >
                      <ShoppingCart className="w-3 h-3" />
                      Qualified Vendor
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1" style={{ fontWeight: 400 }}>
                    {editAll
                      ? "Click any vendor to edit its pricing, priority, and details. Changes save when you click Save."
                      : "Browse the vendor pool to qualify vendors for this item, then set pricing & lead times on each."}
                  </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {isFullScreen ? "Exit full" : "Full view"}
                  </button>
                  <button
                    onClick={handleCloseIntent}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stepper: Select Vendors then Configure Pricing. Hidden in edit-all mode (no stepper). */}
              {!editAll && (
              <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
                {[
                  {
                    num: 1,
                    label: "Select Vendors",
                    shortLabel: "Select",
                    active: view === "browse" || view === "added",
                    completed: view === "configure",
                    clickable: view === "configure",
                    onClick: () => setView("browse"),
                  },
                  {
                    num: 2,
                    label: "Configure Pricing",
                    shortLabel: "Configure",
                    active: view === "configure",
                    completed: false,
                    clickable: (view === "browse" || view === "added") && selectedIds.size > 0,
                    onClick: () => {
                      if (selectedIds.size > 0) handleAdd();
                    },
                  },
                ].map((tab) => (
                  <div
                    key={tab.num}
                    className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${tab.clickable ? "cursor-pointer" : "cursor-default"}`}
                    onClick={() => {
                      if (tab.clickable) tab.onClick();
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
                        tab.active ? "text-primary" : tab.completed ? "text-emerald-500" : "text-slate-700"
                      }`}
                      style={{ fontWeight: tab.active || tab.completed ? 600 : 500 }}
                    >
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.shortLabel}</span>
                    </span>
                    {tab.num === 1 && selectedIds.size > 0 && view !== "configure" && (
                      <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] bg-accent text-primary border border-[#BFDBFE]" style={{ fontWeight: 600 }}>
                        {selectedIds.size}
                      </span>
                    )}
                    {(tab.active || tab.completed) && (
                      <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${tab.completed ? "bg-emerald-500" : "bg-primary"}`} />
                    )}
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          {/* Search + View tabs + Sorting pills — hidden in Configure. */}
          {view !== "configure" && (
            <div className="px-3 sm:px-5 pt-2 pb-2 bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                  <Input
                    placeholder="Search vendors by name, location, or group..."
                    value={currentSearch}
                    onChange={(e) => {
                      setCurrentSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 pr-8 h-8 text-[13px] bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
                  />
                  {currentSearch && (
                    <button
                      onClick={() => {
                        setCurrentSearch("");
                        setCurrentPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5 ml-auto shrink-0">
                  {existingVendors.length > 0 && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[12px] text-emerald-600" style={{ fontWeight: 600 }}>
                      <Check className="w-3.5 h-3.5" />
                      {existingVendors.length} qualified
                    </span>
                  )}
                  {selectedIds.size > 0 && (
                    <>
                      <span className="inline-flex items-center gap-1 text-[12px] text-emerald-600" style={{ fontWeight: 600 }}>
                        +{selectedIds.size} adding
                      </span>
                      <button
                        onClick={clearSelection}
                        className="text-[12px] text-slate-400 hover:text-foreground transition-colors cursor-pointer"
                        style={{ fontWeight: 500 }}
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Table — hidden in Configure. */}
          {view !== "configure" && (
            <div className="flex-1 min-h-0 overflow-auto bg-white border-t border-border/60">
              {currentTotal === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
                  <Package className="w-8 h-8" />
                  <p className="text-sm">No vendors found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 z-20 bg-[#f8fafc]">
                    <TableRow className="hover:bg-transparent [&>th]:h-8 [&>th]:text-[11px] [&>th]:text-slate-500" style={{ fontWeight: 500 }}>
                      <TableHead className="sticky left-0 z-20 bg-[#f8fafc] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0" />
                      <TableHead
                        className="sticky left-[40px] z-20 bg-[#f8fafc] !pl-4"
                        style={{ boxShadow: STICKY_SHADOW, width: 240, minWidth: 240, maxWidth: 240 }}
                      >Vendor</TableHead>
                      {/* Partner-identity columns (mirrors the QV listing, minus Priority). */}
                      <TableHead className="!pl-4" style={{ width: 260, minWidth: 260, maxWidth: 260 }}>Partner Locations</TableHead>
                      <TableHead className="!pl-4" style={{ width: 280, minWidth: 280, maxWidth: 280 }}>Points of Contact</TableHead>
                      <TableHead className="!pl-4" style={{ width: 200, minWidth: 200, maxWidth: 200 }}>Country</TableHead>
                      <TableHead className="text-right !pr-4" style={{ width: 170, minWidth: 170, maxWidth: 170 }}>Credit Limit</TableHead>
                      <TableHead className="!pl-4" style={{ width: 240, minWidth: 240, maxWidth: 240 }}>Carrier (Vendor)</TableHead>
                      <TableHead
                        className="sticky right-0 z-20 bg-[#f8fafc] text-right !pr-4"
                        style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.06)", width: 132, minWidth: 132, maxWidth: 132 }}
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {browsePaginated.map((r) => renderUnifiedRow(r))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {/* Pagination — hidden in Configure. */}
          {view !== "configure" && (
            <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-2.5 border-t border-border gap-3 shrink-0 bg-white">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-[13px] text-muted-foreground"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                >
                  <ChevronLeft className="w-3 h-3" />
                  Prev
                </Button>

                {(() => {
                  const pages: (number | "...")[] = [];
                  if (currentTotalPages <= 7) {
                    for (let i = 1; i <= currentTotalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push("...");
                    for (let i = Math.max(2, currentPage - 1); i <= Math.min(currentTotalPages - 1, currentPage + 1); i++) pages.push(i);
                    if (currentPage < currentTotalPages - 2) pages.push("...");
                    pages.push(currentTotalPages);
                  }
                  return pages.map((p, idx) =>
                    p === "..." ? (
                      <span key={`d${idx}`} className="px-1 text-muted-foreground text-[13px]">...</span>
                    ) : (
                      <Button
                        key={p}
                        variant={currentPage === p ? "default" : "ghost"}
                        size="sm"
                        className={`h-7 w-7 p-0 text-[13px] ${currentPage === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                        onClick={() => setCurrentPage(p as number)}
                      >
                        {p}
                      </Button>
                    ),
                  );
                })()}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-[13px] text-muted-foreground"
                  disabled={currentPage === currentTotalPages}
                  onClick={() => setCurrentPage(Math.min(currentTotalPages, currentPage + 1))}
                >
                  Next
                  <ChevronRight className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={currentPage === currentTotalPages} onClick={() => setCurrentPage(currentTotalPages)}>
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Configure step — per-vendor pricing + ordering parameters. */}
          {view === "configure" &&
            (() => {
              const cards = roster.cards;
              const allKeys = cards.map((c) => c.key);
              const focusedKey =
                focusedVendorId && allKeys.includes(focusedVendorId) ? focusedVendorId : allKeys[0] ?? null;
              const focusedChanged = vendorChangedKeys(focusedKey);
              // Per-field "Modified" + "Revert" (category-parity), bound to the focused vendor.
              const renderFieldTag = (key: string) =>
                focusedKey && focusedChanged.has(key) ? (
                  <span className="inline-flex items-center gap-1 ml-1 align-middle">
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9999, padding: "1px 6px", lineHeight: 1.3 }}>Modified</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); revertVendorField(focusedKey as string, key); }} className="text-[10px] hover:underline cursor-pointer" style={{ fontWeight: 600, color: "#0A77FF" }}>Revert</button>
                  </span>
                ) : null;
              const draftVendor =
                editMode && editVendor
                  ? ({ id: editVendor.id, name: editVendor.vendorName, location: editVendor.location, partnerGroup: editVendor.partnerGroup, partnerLocations: editVendor.partnerLocations, currency: editVendor.currency } as AvailableVendor)
                  : AVAILABLE_VENDORS.find((v) => v.id === focusedKey) || null;
              const focusedQv = existingVendors.find((q) => q.id === focusedKey) || null;
              const focused: AvailableVendor | null =
                draftVendor && draftVendor.id === focusedKey
                  ? draftVendor
                  : focusedQv
                    ? ({ id: focusedQv.id, name: focusedQv.vendorName, location: focusedQv.location, partnerGroup: focusedQv.partnerGroup, partnerLocations: focusedQv.partnerLocations, currency: focusedQv.currency } as AvailableVendor)
                    : null;
              return (
                <div className="flex-1 min-h-0 overflow-hidden bg-[#F7F9FC] flex flex-col">
                  <div className="flex-1 min-h-0 flex overflow-hidden">
                    {/* Left rail — the item's full qualified-vendor roster, ranked here. */}
                    {!editMode && (
                      <div className="hidden md:flex w-[30%] min-w-[260px] max-w-[360px] shrink-0 border-r border-[#EEF2F6] bg-white flex-col">
                        <div className="px-3 py-2.5 border-b border-[#EEF2F6] shrink-0 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>Qualified vendors</p>
                            <p className="text-[10.5px] text-slate-400 mt-px">{cards.length} total · drag a card to rank</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setView("browse")}
                            className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[#E8ECF1] bg-white text-[11.5px] text-slate-700 hover:border-primary/40 hover:text-primary hover:bg-accent/50 transition-colors cursor-pointer shrink-0"
                            style={{ fontWeight: 600 }}
                            title="Add more vendors"
                          >
                            <Plus className="w-3 h-3" />
                            Add more
                          </button>
                        </div>
                        <VendorPriorityList
                          cards={cards}
                          modifiedKeys={modifiedVendorIds}
                          focusedKey={focusedKey}
                          onFocus={handleFocusVendor}
                          onSetPriority={handleRosterSetPriority}
                          onReposition={handleRosterReposition}
                          onToggleDefault={handleRosterDefault}
                          onDeleteLane={handleRosterDeleteLane}
                          onRemove={handleRosterRemove}
                          onRemoveSaved={(k) => setPendingSingleRemoveId(k)}
                          onAddMore={() => setView("browse")}
                          avatar={(name) => <VendorAvatar name={name} size="md" />}
                          locationChip={(card) =>
                            card.isNew ? (
                              <LocationScopePicker
                                size="chip"
                                locations={AVAILABLE_VENDORS.find((x) => x.id === card.key)?.partnerLocations ?? [card.location]}
                                value={vendorLocationsById[card.key] ?? []}
                                onChange={(next) => setVendorLocations(card.key, next)}
                              />
                            ) : null
                          }
                        />
                      </div>
                    )}

                    {/* Right panel — focused vendor form */}
                    <div className="flex-1 min-w-0 overflow-y-auto">
                      {/* Unsaved-changes banner — category-parity revert (Edit Vendors) */}
                      {totalVendorChanges > 0 && (
                        <div className="sticky top-0 z-20 flex items-center justify-between gap-3" style={{ padding: "8px 16px", backgroundColor: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <AlertTriangle style={{ width: 14, height: 14, color: "#B45309", flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>{totalVendorChanges} unsaved change{totalVendorChanges === 1 ? "" : "s"}</span>
                            <span style={{ fontSize: 12, color: "#A16207" }}>across {modifiedVendorIds.size} vendor{modifiedVendorIds.size === 1 ? "" : "s"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {focusedKey && focusedChanged.size > 0 && (
                              <button type="button" onClick={() => revertVendor(focusedKey as string)} className="inline-flex items-center gap-1 transition-colors hover:brightness-95" style={{ height: 26, padding: "0 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "#92400E", backgroundColor: "transparent", border: "1px solid #FCD34D", cursor: "pointer" }}>
                                Revert this vendor ({focusedChanged.size})
                              </button>
                            )}
                            <button type="button" onClick={revertAllVendors} className="inline-flex items-center gap-1 transition-colors hover:brightness-95" style={{ height: 26, padding: "0 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#FFFFFF", backgroundColor: "#B45309", border: "1px solid #B45309", cursor: "pointer" }}>
                              Revert all
                            </button>
                          </div>
                        </div>
                      )}
                      {!focused ? (
                        <div className="h-full flex items-center justify-center px-6 py-12">
                          <div className="rounded-xl border border-dashed border-[#E8ECF1] bg-white px-8 py-12 text-center max-w-md">
                            <div className="w-12 h-12 mx-auto rounded-xl bg-[#F1F5F9] flex items-center justify-center mb-3">
                              <Package className="w-5 h-5 text-slate-400" />
                            </div>
                            <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>No vendors left to configure</p>
                            <p className="text-[12px] text-slate-500 mt-1">Go back to selection and pick at least one vendor.</p>
                            <button
                              type="button"
                              onClick={() => setView("browse")}
                              className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] cursor-pointer shadow-sm transition-colors"
                              style={{ fontWeight: 600 }}
                            >
                              <ChevronLeft className="w-3.5 h-3.5" /> Back to selection
                            </button>
                          </div>
                        </div>
                      ) : (
                        (() => {
                          const v = focused;
                          // Saved vendors fall back to their real config so clicking one opens
                          // its actual pricing/freight/rules (editable), not a blank default.
                          const cfg =
                            configById[v.id] ||
                            (focusedQv ? configFromQv(focusedQv) : makeDefaultConfig());
                          const shippingMethodIds = cfg.shippingMethodIds || [];
                          const appliedRuleIds = cfg.appliedPricingRuleIds || [];
                          /* The vendor quotes in its partner's currency; its rate to base
                             (mid-market, or corporate) is shared by every selling unit. */
                          const vfx = vendorRate(v.currency ?? vendorCurrencyFor(v.country ?? v.location), { rateType: cfg.rateType, exchangeRate: cfg.exchangeRate });
                          const setVendorRateType = (t: "mid" | "corporate") => updateVendorConfig(v.id, { rateType: t, exchangeRate: undefined });
                          const setVendorRate = (r: string | null) => updateVendorConfig(v.id, { exchangeRate: r ?? undefined });
                          // Priority for the header pill: densified display tier of the
                          // focused card + how many tiers exist (mirrors the left rail).
                          const focusedCard = roster.cards.find((c) => c.key === focusedKey);
                          const priorityTierCount = Math.max(1, Math.min(new Set(roster.cards.map((c) => c.priority)).size, MAX_PRIORITY));
                          const currentPriority = focusedCard?.priority ?? MAX_PRIORITY;
                          const isFocusedDefault = focusedCard?.isDefault ?? false;
                          return (
                            <>
                              {/* Focused-vendor header — sticky. Hidden in edit mode. */}
                              {!editMode && (
                                <div className="sticky top-0 z-20 bg-white border-b border-[#EEF2F6] px-4 sm:px-5 py-3">
                                  <div className="flex items-center gap-3">
                                    <VendorAvatar name={v.name} size="lg" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-[14px] text-foreground tracking-[-0.005em] mr-1" style={{ fontWeight: 600 }}>{v.name}</p>
                                        <span
                                          className="inline-flex items-center gap-1.5 px-2 py-px rounded-md text-[10px] border"
                                          style={{ fontWeight: 600, backgroundColor: "#EFF6FF", color: "#1E40AF", borderColor: "#BFDBFE" }}
                                        >
                                          <ShoppingCart className="w-2.5 h-2.5" />
                                          Qualified Vendor
                                        </span>
                                        {v.partnerGroup && (
                                          <span
                                            className="inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[10px] border bg-violet-50 text-violet-700 border-violet-200"
                                            style={{ fontWeight: 600 }}
                                          >
                                            {v.partnerGroup}
                                          </span>
                                        )}
                                        <VendorCurrencyChip fx={vfx} rateType={vfx.rateType} onRateTypeChange={setVendorRateType} />
                                        {renderFieldTag("rateType")}
                                        {/* Priority: view + change inline (mirrors the left rail). */}
                                        <Popover open={headerPriorityOpen} onOpenChange={setHeaderPriorityOpen}>
                                          <PopoverTrigger asChild>
                                            <button
                                              type="button"
                                              className="inline-flex items-center gap-1 px-2 py-px rounded-md text-[10px] border bg-primary/5 text-primary border-primary/25 hover:bg-primary/10 hover:border-primary/40 transition-colors cursor-pointer"
                                              style={{ fontWeight: 600 }}
                                              title="Change priority"
                                            >
                                              {isFocusedDefault ? <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" /> : <ListOrdered className="w-2.5 h-2.5" />}
                                              Priority {currentPriority}
                                              <ChevronDown className={`w-2.5 h-2.5 opacity-70 transition-transform duration-200 ${headerPriorityOpen ? "rotate-180" : ""}`} />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent align="start" sideOffset={6} className="w-[190px] p-0 z-[260] rounded-xl border border-[#EEF2F6] bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.22)] overflow-hidden">
                                            <div className="px-3 pt-2.5 pb-1.5 border-b border-[#EEF2F6]">
                                              <p className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>Set priority</p>
                                            </div>
                                            <div className="p-1.5">
                                              {Array.from({ length: priorityTierCount }, (_, i) => i + 1).map((t) => {
                                                const active = t === currentPriority;
                                                // The default (auto-PO anchor) is a Priority 1 concept, so the
                                                // star toggle lives inline on the active Priority 1 row.
                                                const showStar = t === 1 && currentPriority === 1;
                                                return (
                                                  <div
                                                    key={t}
                                                    className={cn(
                                                      "w-full flex items-center rounded-lg transition-colors",
                                                      active ? "bg-primary/10" : "hover:bg-[#F7FAFE]",
                                                    )}
                                                  >
                                                    <button
                                                      type="button"
                                                      onClick={() => { if (focusedKey) handleHeaderSetPriority(focusedKey, t); setHeaderPriorityOpen(false); }}
                                                      className={cn(
                                                        "flex-1 min-w-0 flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-lg text-[12px] cursor-pointer text-left",
                                                        active ? "text-primary" : "text-foreground",
                                                      )}
                                                      style={{ fontWeight: active ? 600 : 500 }}
                                                    >
                                                      <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded-md text-[10.5px] tabular-nums border shrink-0", active ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-[#E8ECF1]")} style={{ fontWeight: 700 }}>{t}</span>
                                                      Priority {t}
                                                    </button>
                                                    {showStar ? (
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <button
                                                            type="button"
                                                            onClick={() => { if (focusedKey) handleRosterDefault(focusedKey); }}
                                                            aria-label={isFocusedDefault ? "Default vendor" : "Set as default"}
                                                            className="shrink-0 mr-1.5 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-amber-100/70 transition-colors cursor-pointer"
                                                          >
                                                            <Star className={cn("w-4 h-4 transition-colors", isFocusedDefault ? "fill-amber-400 text-amber-500" : "text-slate-300 hover:text-amber-400")} />
                                                          </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="z-[300]">{isFocusedDefault ? "Default vendor" : "Set as default"}</TooltipContent>
                                                      </Tooltip>
                                                    ) : (
                                                      active && <Check className="w-3.5 h-3.5 mr-2.5 text-primary shrink-0" />
                                                    )}
                                                  </div>
                                                );
                                              })}
                                              {priorityTierCount < MAX_PRIORITY && (
                                                <button
                                                  type="button"
                                                  onClick={() => { if (focusedKey) handleHeaderSetPriority(focusedKey, priorityTierCount + 1); setHeaderPriorityOpen(false); }}
                                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-primary hover:bg-primary/5 transition-colors cursor-pointer text-left mt-0.5"
                                                  style={{ fontWeight: 600 }}
                                                >
                                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-md border border-dashed border-primary/40"><Plus className="w-3 h-3" /></span>
                                                  New tier
                                                </button>
                                              )}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap mt-1">
                                        <p className="text-[11.5px] text-slate-500 truncate">{v.location}</p>
                                        <LocationScopePicker
                                          size="chip"
                                          locations={v.partnerLocations ?? [v.location]}
                                          value={vendorLocationsById[v.id] ?? []}
                                          onChange={(next) => setVendorLocations(v.id, next)}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div className="p-4 sm:p-5 space-y-3">
                                {/* Edit mode has no left rail, so priority + default live here. */}
                                {editMode && editVendor && (() => {
                                  const ecfg = configById[editVendor.id] || makeDefaultConfig();
                                  const curP = ecfg.priority && ecfg.priority !== "auto" ? parseInt(ecfg.priority, 10) || 1 : 1;
                                  return (
                                    <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                      <div className="px-4 py-3 flex items-center gap-2.5 border-b border-[#EEF2F6]">
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#E8EEFB] border border-blue-200">
                                          <ListOrdered className="w-3.5 h-3.5 text-[#1E40AF]" />
                                        </span>
                                        <div>
                                          <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Priority &amp; default</p>
                                          <p className="text-[11px] text-slate-500 mt-px">Rank used to pick this vendor for auto-POs.</p>
                                        </div>
                                      </div>
                                      <div className="p-4 flex items-center gap-4 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Priority</span>
                                          {[1, 2, 3, 4, 5].map((t) => (
                                            <button
                                              key={t}
                                              type="button"
                                              onClick={() =>
                                                updateVendorConfig(
                                                  editVendor.id,
                                                  // The default must be a Priority 1 vendor, so leaving
                                                  // Priority 1 clears this vendor's default flag.
                                                  t === 1 ? { priority: "1" } : { priority: String(t), isDefault: false },
                                                )
                                              }
                                              className={cn(
                                                "w-7 h-7 rounded-md text-[12px] tabular-nums border transition-colors cursor-pointer",
                                                curP === t ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-[#E8ECF1] hover:border-primary/40",
                                              )}
                                              style={{ fontWeight: 600 }}
                                            >
                                              {t}
                                            </button>
                                          ))}
                                        </div>
                                        <button
                                          type="button"
                                          disabled={curP !== 1}
                                          onClick={() => updateVendorConfig(editVendor.id, { isDefault: !ecfg.isDefault })}
                                          title={curP !== 1 ? "The default vendor must be at Priority 1" : undefined}
                                          className={cn(
                                            "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                                            ecfg.isDefault && curP === 1 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-[#E8ECF1] text-slate-600 hover:border-amber-300",
                                          )}
                                          style={{ fontWeight: 600 }}
                                        >
                                          <Star className={cn("w-3.5 h-3.5", ecfg.isDefault && curP === 1 ? "fill-amber-400 text-amber-500" : "text-slate-300")} />
                                          {ecfg.isDefault && curP === 1 ? "Default vendor" : "Set as default"}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })()}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                                  <div className="space-y-3">
                                {/* Section: Pricing & Ordering */}
                                {(() => {
                                  const isOpen = openSections.has("config");
                                  const additionalPrices = cfg.additionalPrices || [];
                                  return (
                                    <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                      <button type="button" onClick={() => toggleSection("config")} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#FAFBFC] transition-colors cursor-pointer text-left">
                                        <div className="flex items-center gap-2.5">
                                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#DBEAFE] border border-blue-200">
                                            <Tag className="w-3.5 h-3.5 text-primary" />
                                          </span>
                                          <div>
                                            <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Pricing &amp; Ordering</p>
                                            <p className="text-[11px] text-slate-500 mt-px">{additionalPrices.length + 1} selling {additionalPrices.length === 0 ? "unit" : "units"} · price, order limits, and lead time.</p>
                                          </div>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                      </button>
                                      <div aria-hidden={!isOpen} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                                        <div className="overflow-hidden">
                                          <div className="border-t border-[#EEF2F6] p-3 sm:p-4 space-y-2.5 bg-white">
                                                      {/* Primary card */}
                                                      {(() => {
                                                        // Base card is primary unless the draft pointer names one of the tier cards.
                                                        const pti = cfg.primaryTierIndex;
                                                        const basePrimary = pti == null || pti < 0 || pti >= additionalPrices.length;
                                                        return (
                                                          <div className="rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
                                                            <div className="px-3 py-2 border-b border-[#F1F5F9] bg-[#FAFBFC] flex items-center justify-between gap-2">
                                                              <div className="flex items-center gap-1.5 min-w-0">
                                                                <p className="text-[11.5px] text-slate-500" style={{ fontWeight: 500 }}>Vendor sells as</p>
                                                                {basePrimary ? (
                                                                  <PrimaryPill className="shrink-0" />
                                                                ) : (
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                      updateVendorConfig(v.id, { primaryTierIndex: -1 });
                                                                      toast.success(`${lookupUom(cfg.uom || "Each").label} is now the primary selling unit.`);
                                                                    }}
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
                                                                {(() => {
                                                                  const u = lookupUom(cfg.uom || "Each");
                                                                  return (
                                                                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-md bg-[#EFF6FF] border border-blue-200 text-[11px] text-primary" style={{ fontWeight: 600 }}>
                                                                      {u.label}
                                                                      <span className="text-primary/55 text-[10px]" style={{ fontWeight: 500 }}>{u.symbol}</span>
                                                                    </span>
                                                                  );
                                                                })()}
                                                                {additionalPrices.length > 0 && (
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                      const [promoted, ...rest] = additionalPrices;
                                                                      // First tier slides into the base slot, so a pointer at
                                                                      // tier 0 (or at the deleted base) resolves to the base
                                                                      // card; later tiers shift down one.
                                                                      const ptiPrev = cfg.primaryTierIndex;
                                                                      updateVendorConfig(v.id, {
                                                                        pricePerUnit: promoted.price,
                                                                        uom: promoted.uom,
                                                                        additionalPrices: rest,
                                                                        minOrderQty: promoted.minOrderQty ?? "",
                                                                        maxOrderQty: promoted.maxOrderQty ?? "",
                                                                        multiples: promoted.multiples ?? "",
                                                                        acceptedDeviationPct: promoted.acceptedDeviationPct ?? "",
                                                                        leadTimeDays: promoted.leadTimeDays ?? "",
                                                                        primaryTierIndex: ptiPrev != null && ptiPrev > 0 ? ptiPrev - 1 : undefined,
                                                                      });
                                                                    }}
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
                                                                <label className="flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                                  Price per unit
                                                                  <FieldInfo content="The unit price this vendor charges for this item, expressed in the chosen unit of measure. The price does NOT convert between pack sizes — each pack carries its own rate. Quantities still convert at PO time." />
                                                                  {renderFieldTag("pricePerUnit")}
                                                                </label>
                                                                <div className="flex items-stretch rounded-lg border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 overflow-hidden bg-white">
                                                                  <span className="inline-flex items-center justify-center min-w-9 px-1.5 text-[12px] text-slate-400 bg-[#FAFBFC] border-r border-border" style={{ fontWeight: 500 }}>{pricePrefix(vfx.currency)}</span>
                                                                  <Input
                                                                    inputMode="decimal"
                                                                    value={cfg.pricePerUnit}
                                                                    onChange={(e) => updateVendorConfig(v.id, { pricePerUnit: numericInput(e.target.value, { decimal: true }) })}
                                                                    placeholder="0.00"
                                                                    className="h-9 text-[13px] border-0 focus-visible:ring-0 focus-visible:border-0 rounded-none flex-1 min-w-0"
                                                                  />
                                                                  <UomPicker
                                                                    variant="embedded"
                                                                    value={cfg.uom}
                                                                    onChange={(val) => updateVendorConfig(v.id, { uom: val })}
                                                                    disabledIds={new Set(additionalPrices.map((t) => t.uom))}
                                                                  />
                                                                </div>
                                                                <div className="mt-2">
                                                                  <VendorPriceFields
                                                                    key={`${v.id}:p`}
                                                                    price={cfg.pricePerUnit}
                                                                    onPriceChange={(p) => updateVendorConfig(v.id, { pricePerUnit: p })}
                                                                    fx={vfx}
                                                                    onRateChange={setVendorRate}
                                                                    rateTag={renderFieldTag("exchangeRate")}
                                                                  />
                                                                </div>
                                                              </div>
                                                              <div className="border-t border-dashed border-[#E2E8F0]" />
                                                              <div className="grid grid-cols-3 gap-2">
                                                                <label className="block">
                                                                  <span className="flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                                    Min Order
                                                                    <FieldInfo content="Smallest quantity that can be ordered in a single PO line for this pack size. Orders below this are rejected at submit." />
                                                                    {renderFieldTag("minOrderQty")}
                                                                  </span>
                                                                  <Input inputMode="numeric" value={cfg.minOrderQty} onChange={(e) => updateVendorConfig(v.id, { minOrderQty: numericInput(e.target.value) })} placeholder="0" className="h-9 text-[13px]" />
                                                                </label>
                                                                <label className="block">
                                                                  <span className="flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                                    Max Order
                                                                    <FieldInfo content="Largest quantity that can be ordered in a single PO line. Leave blank for no cap. Useful when the vendor can't fulfil oversized requests in one go." />
                                                                    {renderFieldTag("maxOrderQty")}
                                                                  </span>
                                                                  <Input inputMode="numeric" value={cfg.maxOrderQty} onChange={(e) => updateVendorConfig(v.id, { maxOrderQty: numericInput(e.target.value) })} placeholder="0" className="h-9 text-[13px]" />
                                                                </label>
                                                                <label className="block">
                                                                  <span className="flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                                    Multiples
                                                                    <FieldInfo content="Quantities must be a multiple of this number (e.g. 12 = case packs of 12). Set to 1 for any-quantity orders." />
                                                                    {renderFieldTag("multiples")}
                                                                  </span>
                                                                  <Input inputMode="numeric" value={cfg.multiples} onChange={(e) => updateVendorConfig(v.id, { multiples: numericInput(e.target.value) })} placeholder="1" className="h-9 text-[13px]" />
                                                                </label>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        );
                                                      })()}
                                                      {/* Additional UoM-priced tiers */}
                                                      {additionalPrices.map((tier, ti) => {
                                                        const patchTier = (patch: Partial<AdditionalPriceTier>) => {
                                                          const next = additionalPrices.slice();
                                                          next[ti] = { ...next[ti], ...patch };
                                                          updateVendorConfig(v.id, { additionalPrices: next });
                                                        };
                                                        return (
                                                          <div key={ti} className="rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
                                                            <div className="px-3 py-2 border-b border-[#F1F5F9] bg-[#FAFBFC] flex items-center justify-between gap-2">
                                                              <div className="flex items-center gap-1.5 min-w-0">
                                                                <p className="text-[11.5px] text-slate-500" style={{ fontWeight: 500 }}>Vendor sells as</p>
                                                                {cfg.primaryTierIndex === ti ? (
                                                                  <PrimaryPill className="shrink-0" />
                                                                ) : (
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                      updateVendorConfig(v.id, { primaryTierIndex: ti });
                                                                      toast.success(`${lookupUom(tier.uom || "Each").label} is now the primary selling unit.`);
                                                                    }}
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
                                                                {(() => {
                                                                  const u = lookupUom(tier.uom || "Each");
                                                                  return (
                                                                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-md bg-[#EFF6FF] border border-blue-200 text-[11px] text-primary" style={{ fontWeight: 600 }}>
                                                                      {u.label}
                                                                      <span className="text-primary/55 text-[10px]" style={{ fontWeight: 500 }}>{u.symbol}</span>
                                                                    </span>
                                                                  );
                                                                })()}
                                                                <button
                                                                  type="button"
                                                                  onClick={() => {
                                                                    const next = additionalPrices.filter((_, j) => j !== ti);
                                                                    // If the removed tier was primary → reset to base.
                                                                    // If a later tier was primary → shift the pointer down by one.
                                                                    const ptiPrev = cfg.primaryTierIndex;
                                                                    const ptiNext =
                                                                      ptiPrev == null
                                                                        ? undefined
                                                                        : ptiPrev === ti
                                                                        ? undefined
                                                                        : ptiPrev > ti
                                                                        ? ptiPrev - 1
                                                                        : ptiPrev;
                                                                    updateVendorConfig(v.id, {
                                                                      additionalPrices: next,
                                                                      primaryTierIndex: ptiNext,
                                                                    });
                                                                  }}
                                                                  className="w-6 h-6 rounded-md text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer flex items-center justify-center"
                                                                  title="Remove this selling unit"
                                                                  aria-label="Remove this selling unit"
                                                                >
                                                                  <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                              </div>
                                                            </div>
                                                            <div className="p-3 space-y-3">
                                                              <div>
                                                                <label className="flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                                  Price per unit
                                                                  <FieldInfo content="The unit price this vendor charges for this item, expressed in the chosen unit of measure. The price does NOT convert between pack sizes — each pack carries its own rate. Quantities still convert at PO time." />
                                                                </label>
                                                                <div className="flex items-stretch rounded-lg border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 overflow-hidden bg-white">
                                                                  <span className="inline-flex items-center justify-center min-w-9 px-1.5 text-[12px] text-slate-400 bg-[#FAFBFC] border-r border-border" style={{ fontWeight: 500 }}>{pricePrefix(vfx.currency)}</span>
                                                                  <Input
                                                                    inputMode="decimal"
                                                                    value={tier.price}
                                                                    onChange={(e) => patchTier({ price: numericInput(e.target.value, { decimal: true }) })}
                                                                    placeholder="0.00"
                                                                    className="h-9 text-[13px] border-0 focus-visible:ring-0 focus-visible:border-0 rounded-none flex-1 min-w-0"
                                                                  />
                                                                  <UomPicker
                                                                    variant="embedded"
                                                                    value={tier.uom}
                                                                    onChange={(val) => patchTier({ uom: val })}
                                                                    disabledIds={new Set([cfg.uom, ...additionalPrices.filter((_, j) => j !== ti).map((t) => t.uom)])}
                                                                  />
                                                                </div>
                                                                <div className="mt-2">
                                                                  <VendorPriceFields
                                                                    key={`${v.id}:${ti}`}
                                                                    price={tier.price}
                                                                    onPriceChange={(p) => patchTier({ price: p })}
                                                                    fx={vfx}
                                                                    onRateChange={setVendorRate}
                                                                  />
                                                                </div>
                                                              </div>
                                                              <div className="border-t border-dashed border-[#E2E8F0]" />
                                                              <div className="grid grid-cols-3 gap-2">
                                                                <label className="block">
                                                                  <span className="flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                                    Min Order
                                                                    <FieldInfo content="Smallest quantity that can be ordered in a single PO line for this pack size. Orders below this are rejected at submit." />
                                                                  </span>
                                                                  <Input inputMode="numeric" value={tier.minOrderQty ?? ""} onChange={(e) => patchTier({ minOrderQty: numericInput(e.target.value) })} placeholder="0" className="h-9 text-[13px]" />
                                                                </label>
                                                                <label className="block">
                                                                  <span className="flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                                    Max Order
                                                                    <FieldInfo content="Largest quantity that can be ordered in a single PO line. Leave blank for no cap. Useful when the vendor can't fulfil oversized requests in one go." />
                                                                  </span>
                                                                  <Input inputMode="numeric" value={tier.maxOrderQty ?? ""} onChange={(e) => patchTier({ maxOrderQty: numericInput(e.target.value) })} placeholder="0" className="h-9 text-[13px]" />
                                                                </label>
                                                                <label className="block">
                                                                  <span className="flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                                    Multiples
                                                                    <FieldInfo content="Quantities must be a multiple of this number (e.g. 12 = case packs of 12). Set to 1 for any-quantity orders." />
                                                                  </span>
                                                                  <Input inputMode="numeric" value={tier.multiples ?? ""} onChange={(e) => patchTier({ multiples: numericInput(e.target.value) })} placeholder="1" className="h-9 text-[13px]" />
                                                                </label>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        );
                                                      })}
                                                      {/* Add another row — next free UoM */}
                                                      {(() => {
                                                        const usedUoms = new Set([cfg.uom, ...additionalPrices.map((t) => t.uom)]);
                                                        const nextUom =
                                                          QV_UOM_OPTIONS.find((u) => !usedUoms.has(u.id)) ||
                                                          QV_UOM_ALL_INDEXABLE.find((u) => !usedUoms.has(u.id));
                                                        const exhausted = !nextUom;
                                                        return (
                                                          <button
                                                            type="button"
                                                            disabled={exhausted}
                                                            onClick={() => {
                                                              if (!nextUom) return;
                                                              updateVendorConfig(v.id, { additionalPrices: [...additionalPrices, { price: "", uom: nextUom.id }] });
                                                            }}
                                                            className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] transition-colors ${exhausted ? "border-[#E8ECF1] text-slate-300 cursor-not-allowed" : "border-[#BFDBFE] bg-[#EFF6FF] text-primary hover:bg-[#DBEAFE] cursor-pointer"}`}
                                                            style={{ fontWeight: 600 }}
                                                            title={exhausted ? "All units of measure have been priced" : "Add pricing for another unit of measure."}
                                                          >
                                                            <Plus className="w-3.5 h-3.5" />
                                                            Add pricing for alternate units
                                                          </button>
                                                        );
                                                      })()}
                                                      {/* Vendor-level — captured ONCE for the vendor, not per selling unit. */}
                                                      <div className="rounded-lg border border-[#E8ECF1] bg-white overflow-hidden">
                                                        <div className="px-3 py-2 border-b border-[#F1F5F9] bg-[#FAFBFC]">
                                                          <p className="text-[11.5px] text-slate-500" style={{ fontWeight: 500 }}>Order tolerance &amp; lead time</p>
                                                          <p className="text-[10.5px] text-slate-400 mt-px">Applies to this vendor across every selling unit above.</p>
                                                        </div>
                                                        <div className="p-3 grid grid-cols-2 gap-2">
                                                          <label className="block">
                                                            <span className="flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                              Accepted Deviation %
                                                              <FieldInfo content="Vendors often ship a little more or less than you ordered. This sets how far the delivered quantity can differ from the order and still count as a complete delivery, measured as a percentage of the ordered quantity. Anything outside the range is flagged as short or over." />
                                                            </span>
                                                            <div className="relative">
                                                              <Input inputMode="decimal" value={cfg.acceptedDeviationPct} onChange={(e) => updateVendorConfig(v.id, { acceptedDeviationPct: numericInput(e.target.value, { decimal: true }) })} placeholder="0" className="h-9 text-[13px] pr-7" />
                                                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 pointer-events-none" style={{ fontWeight: 500 }}>%</span>
                                                            </div>
                                                            <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">Example: at 5%, an order of 100 accepts any delivery from 95 to 105 as complete.</p>
                                                          </label>
                                                          <label className="block">
                                                            <span className="flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>
                                                              Lead Time
                                                              <FieldInfo content="Number of days from placing an order with this vendor to receiving it. Used to plan when to reorder so stock arrives before you run out." />
                                                            </span>
                                                            <div className="relative">
                                                              <Input inputMode="numeric" value={cfg.leadTimeDays} onChange={(e) => updateVendorConfig(v.id, { leadTimeDays: numericInput(e.target.value) })} placeholder="0" className="h-9 text-[13px] pr-12" />
                                                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none" style={{ fontWeight: 500 }}>days</span>
                                                            </div>
                                                          </label>
                                                        </div>
                                                      </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}

                                  </div>
                                  <div className="space-y-3">
                                {/* Section: Freight & Logistics */}
                                {(() => {
                                  const isOpen = openSections.has("freight");
                                  const inheritedSet = inheritedFreightByVendor[v.id] || new Set<string>();
                                  const methodsByCarrier = new Map<string, string[]>();
                                  shippingMethodIds.forEach((methodId) => {
                                    for (const c of SHIPPING_CARRIER_CATALOG) {
                                      const list = SHIPPING_CARRIER_METHODS[c.id] || [];
                                      if (list.some((m) => m.id === methodId)) {
                                        const arr = methodsByCarrier.get(c.id) || [];
                                        arr.push(methodId);
                                        methodsByCarrier.set(c.id, arr);
                                        break;
                                      }
                                    }
                                  });
                                  return (
                                    <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                      <button type="button" onClick={() => toggleSection("freight")} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#FAFBFC] transition-colors cursor-pointer text-left">
                                        <div className="flex items-center gap-2.5">
                                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200">
                                            <Truck className="w-3.5 h-3.5 text-[#0E7490]" />
                                          </span>
                                          <div>
                                            <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Freight &amp; Logistics{renderFieldTag("shippingMethodIds")}</p>
                                            <p className="text-[11px] text-slate-500 mt-px">{methodsByCarrier.size === 0 ? "No carriers configured" : `${methodsByCarrier.size} carrier${methodsByCarrier.size === 1 ? "" : "s"} configured`}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {methodsByCarrier.size > 0 && (
                                            <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] bg-cyan-50 text-cyan-800 border border-cyan-200" style={{ fontWeight: 600 }}>{methodsByCarrier.size}</span>
                                          )}
                                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                        </div>
                                      </button>
                                      <div
                                        aria-hidden={!isOpen}
                                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                                      >
                                        <div className="overflow-hidden">
                                          <div className="border-t border-[#EEF2F6] px-4 sm:px-5 py-4 bg-white">
                                            <div className="flex items-center justify-between gap-2 mb-3">
                                              <p className="text-[11.5px] text-slate-500">Pulled from the defaults. Remove or add more as the item needs.</p>
                                              <Popover open={addCarrierOpenForVendor === v.id} onOpenChange={(o) => { setAddCarrierOpenForVendor(o ? v.id : null); if (!o) setCarrierSearch(""); }}>
                                                <PopoverTrigger asChild>
                                                  <button type="button" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer shrink-0" style={{ fontWeight: 600 }}>
                                                    <Plus className="w-3 h-3" /> Add Carrier
                                                  </button>
                                                </PopoverTrigger>
                                                <PopoverContent align="end" sideOffset={8} className="w-[440px] p-0 z-[260] rounded-2xl border border-[#EEF2F6] bg-white shadow-[0_24px_64px_-16px_rgba(15,23,42,0.22)] overflow-hidden">
                                                  <div className="px-4 pt-3.5 pb-3 border-b border-[#EEF2F6]" style={{ background: "linear-gradient(180deg, #F0FDFF 0%, #FFFFFF 100%)" }}>
                                                    <div className="flex items-start gap-2.5">
                                                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-cyan-200 shadow-sm shrink-0">
                                                        <Truck className="w-3.5 h-3.5 text-[#0E7490]" />
                                                      </span>
                                                      <div className="min-w-0 flex-1">
                                                        <p className="text-[13px] text-foreground tracking-[-0.005em]" style={{ fontWeight: 600 }}>Available carriers</p>
                                                        <p className="text-[11px] text-slate-500 mt-px leading-snug">Carriers available for this item. Tap to add or remove for this vendor.</p>
                                                      </div>
                                                    </div>
                                                  </div>
                                                  <div className="px-3 pt-2.5 pb-1">
                                                    <div className="relative">
                                                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                      <input
                                                        type="text"
                                                        value={carrierSearch}
                                                        onChange={(e) => setCarrierSearch(e.target.value)}
                                                        placeholder="Search carriers..."
                                                        className="w-full h-8 pl-8 pr-7 rounded-lg border border-[#E8ECF1] bg-white text-[12px] text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
                                                      />
                                                      {carrierSearch && (
                                                        <button type="button" onClick={() => setCarrierSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 cursor-pointer" aria-label="Clear search">
                                                          <X className="w-3.5 h-3.5" />
                                                        </button>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="max-h-[380px] overflow-y-auto px-2 pb-2 pt-1 space-y-1">
                                                    {(() => {
                                                      const q = carrierSearch.trim().toLowerCase();
                                                      const list = SHIPPING_CARRIER_CATALOG.filter((c) => c.status === "Active" && !c.isPickup).filter((c) => {
                                                        if (!q) return true;
                                                        const methods = SHIPPING_CARRIER_METHODS[c.id] || [];
                                                        const pm = methods.find((m) => m.isDefault) || methods[0];
                                                        return c.name.toLowerCase().includes(q) || (pm?.name || "").toLowerCase().includes(q);
                                                      });
                                                      if (list.length === 0) {
                                                        return (
                                                          <div className="px-3 py-8 text-center">
                                                            <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>No carriers found</p>
                                                            <p className="text-[11px] text-slate-500 mt-0.5">Try a different search.</p>
                                                          </div>
                                                        );
                                                      }
                                                      return list.map((carrier) => {
                                                      const carrierMethods = SHIPPING_CARRIER_METHODS[carrier.id] || [];
                                                      const primaryMethod = carrierMethods.find((m) => m.isDefault) || carrierMethods[0];
                                                      if (!primaryMethod) return null;
                                                      const isAdded = shippingMethodIds.includes(primaryMethod.id);
                                                      return (
                                                        <button
                                                          key={carrier.id}
                                                          type="button"
                                                          onClick={() => {
                                                            if (isAdded) {
                                                              const remaining = shippingMethodIds.filter((mid) => mid !== primaryMethod.id);
                                                              const newDefault = cfg.defaultShippingMethodId === primaryMethod.id ? remaining[0] || "" : cfg.defaultShippingMethodId || "";
                                                              updateVendorConfig(v.id, { shippingMethodIds: remaining, defaultShippingMethodId: newDefault });
                                                            } else {
                                                              const next = [...shippingMethodIds, primaryMethod.id];
                                                              updateVendorConfig(v.id, {
                                                                shippingMethodIds: next,
                                                                defaultShippingMethodId: cfg.defaultShippingMethodId || primaryMethod.id,
                                                              });
                                                            }
                                                          }}
                                                          className={`group w-full flex items-center gap-3 px-2.5 py-2 rounded-xl border transition-all duration-150 text-left cursor-pointer ${
                                                            isAdded ? "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50" : "bg-white border-transparent hover:bg-[#F7FAFE] hover:border-[#E8ECF1]"
                                                          }`}
                                                        >
                                                          <div
                                                            className="w-9 h-9 rounded-xl border border-[#EEF2F6] flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                                                            style={{ backgroundColor: carrier.logoImg ? "#FFFFFF" : `${carrier.color}10` }}
                                                          >
                                                            {carrier.logoImg ? (
                                                              <img src={carrier.logoImg} alt={carrier.name} className="w-full h-full object-contain p-0.5" />
                                                            ) : (
                                                              <Truck className="w-4 h-4" style={{ color: carrier.color }} />
                                                            )}
                                                          </div>
                                                          <div className="flex-1 min-w-0">
                                                            <p className="text-[12.5px] text-foreground truncate" style={{ fontWeight: 600 }}>{carrier.name}</p>
                                                            <p className="text-[10.5px] text-slate-500 truncate mt-px">{primaryMethod.name}</p>
                                                          </div>
                                                          {isAdded ? (
                                                            <span className="inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[10.5px] bg-emerald-500 text-white shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08)]" style={{ fontWeight: 600 }}>
                                                              <Check className="w-3 h-3" /> Added
                                                            </span>
                                                          ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[10.5px] bg-white text-primary border border-[#BFDBFE] shrink-0 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors" style={{ fontWeight: 600 }}>
                                                              <Plus className="w-3 h-3" /> Add
                                                            </span>
                                                          )}
                                                        </button>
                                                      );
                                                      });
                                                    })()}
                                                  </div>
                                                  <div className="px-3.5 py-2.5 border-t border-[#EEF2F6] bg-[#FAFBFC] flex items-center justify-between gap-2">
                                                    <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                                                      <span className="text-foreground" style={{ fontWeight: 600 }}>{shippingMethodIds.length}</span> added
                                                    </span>
                                                    <button
                                                      type="button"
                                                      onClick={() => setAddCarrierOpenForVendor(null)}
                                                      className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] bg-primary text-white hover:bg-[#0862D0] cursor-pointer transition-colors shadow-sm"
                                                      style={{ fontWeight: 600 }}
                                                    >
                                                      <Check className="w-3.5 h-3.5" />
                                                      Done
                                                    </button>
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            </div>
                                            {methodsByCarrier.size === 0 ? (
                                              <div className="rounded-lg border border-dashed border-[#E8ECF1] bg-[#FAFBFC] px-4 py-8 text-center">
                                                <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>No carriers configured</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">Add a carrier from the picker above.</p>
                                              </div>
                                            ) : (
                                              <div className="grid grid-cols-1 gap-3 items-stretch">
                                                {Array.from(methodsByCarrier.entries()).map(([carrierId, methodIds]) => {
                                                  const isInherited = methodIds.some((mid) => inheritedSet.has(mid));
                                                  const primaryMethodId = methodIds.includes(cfg.defaultShippingMethodId || "") ? cfg.defaultShippingMethodId! : methodIds[0];
                                                  const entry: ShippingCarrierEntry = {
                                                    id: carrierId,
                                                    carrier: carrierId,
                                                    methods: methodIds.join(","),
                                                    isDefault: cfg.defaultShippingMethodId === primaryMethodId,
                                                    primaryMethod: primaryMethodId,
                                                  };
                                                  return (
                                                    <ShippingMethodCarrierCard
                                                      key={carrierId}
                                                      entry={entry}
                                                      inherited={isInherited}
                                                      onEdit={() => toast.info("Editing carrier methods lives on the Freight & Logistics tab.")}
                                                      onRemove={() => {
                                                        const remaining = shippingMethodIds.filter((mid) => !methodIds.includes(mid));
                                                        const newDefault = methodIds.includes(cfg.defaultShippingMethodId || "") ? "" : cfg.defaultShippingMethodId || "";
                                                        updateVendorConfig(v.id, { shippingMethodIds: remaining, defaultShippingMethodId: newDefault });
                                                      }}
                                                      onSetPrimary={() => updateVendorConfig(v.id, { defaultShippingMethodId: primaryMethodId })}
                                                    />
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Section: Pricing Rules */}
                                {(() => {
                                  const isOpen = openSections.has("pricing");
                                  const inheritedSet = inheritedPricingByVendor[v.id] || new Set<string>();
                                  const appliedRules = allPricingRules.filter((r) => appliedRuleIds.includes(r.id));
                                  return (
                                    <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                      <button type="button" onClick={() => toggleSection("pricing")} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#FAFBFC] transition-colors cursor-pointer text-left">
                                        <div className="flex items-center gap-2.5">
                                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 border border-violet-200">
                                            <ChartColumn className="w-3.5 h-3.5 text-violet-700" />
                                          </span>
                                          <div>
                                            <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Pricing Rules{renderFieldTag("appliedPricingRuleIds")}</p>
                                            <p className="text-[11px] text-slate-500 mt-px">{appliedRules.length === 0 ? "No rules applied" : `${appliedRules.length} rule${appliedRules.length === 1 ? "" : "s"} applied`}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {appliedRules.length > 0 && (
                                            <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] bg-violet-50 text-violet-800 border border-violet-200" style={{ fontWeight: 600 }}>{appliedRules.length}</span>
                                          )}
                                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                        </div>
                                      </button>
                                      <div
                                        aria-hidden={!isOpen}
                                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                                      >
                                        <div className="overflow-hidden">
                                          <div className="border-t border-[#EEF2F6] px-4 sm:px-5 py-4 bg-white">
                                            <div className="flex items-center justify-between gap-2 mb-3">
                                              <p className="text-[11.5px] text-slate-500">Pulled from the defaults. Remove or add more as the item needs.</p>
                                              <Popover open={addRuleOpenForVendor === v.id} onOpenChange={(o) => { setAddRuleOpenForVendor(o ? v.id : null); if (!o) setRuleSearch(""); }}>
                                                <PopoverTrigger asChild>
                                                  <button type="button" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer shrink-0" style={{ fontWeight: 600 }}>
                                                    <Plus className="w-3 h-3" /> Add Rule
                                                  </button>
                                                </PopoverTrigger>
                                                <PopoverContent align="end" sideOffset={8} className="w-[440px] p-0 z-[260] rounded-2xl border border-[#EEF2F6] bg-white shadow-[0_24px_64px_-16px_rgba(15,23,42,0.22)] overflow-hidden">
                                                  <div className="px-4 pt-3.5 pb-3 border-b border-[#EEF2F6]" style={{ background: "linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 100%)" }}>
                                                    <div className="flex items-start gap-2.5">
                                                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-violet-200 shadow-sm shrink-0">
                                                        <ChartColumn className="w-3.5 h-3.5 text-violet-700" />
                                                      </span>
                                                      <div className="min-w-0 flex-1">
                                                        <p className="text-[13px] text-foreground tracking-[-0.005em]" style={{ fontWeight: 600 }}>Available pricing rules</p>
                                                        <p className="text-[11px] text-slate-500 mt-px leading-snug">Rules available for this item. Tap to add or remove for this vendor.</p>
                                                      </div>
                                                    </div>
                                                  </div>
                                                  <div className="px-3 pt-2.5 pb-1">
                                                    <div className="relative">
                                                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                      <input
                                                        type="text"
                                                        value={ruleSearch}
                                                        onChange={(e) => setRuleSearch(e.target.value)}
                                                        placeholder="Search rules..."
                                                        className="w-full h-8 pl-8 pr-7 rounded-lg border border-[#E8ECF1] bg-white text-[12px] text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
                                                      />
                                                      {ruleSearch && (
                                                        <button type="button" onClick={() => setRuleSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 cursor-pointer" aria-label="Clear search">
                                                          <X className="w-3.5 h-3.5" />
                                                        </button>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="max-h-[380px] overflow-y-auto px-2 pb-2 pt-1 space-y-1">
                                                    {(() => {
                                                      const q = ruleSearch.trim().toLowerCase();
                                                      const list = allPricingRules.filter((r) => {
                                                        if (!q) return true;
                                                        return r.label.toLowerCase().includes(q) || (r.subtitle || "").toLowerCase().includes(q);
                                                      });
                                                      if (list.length === 0) {
                                                        return (
                                                          <div className="px-3 py-8 text-center">
                                                            <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>No rules found</p>
                                                            <p className="text-[11px] text-slate-500 mt-0.5">Try a different search, or create a new rule below.</p>
                                                          </div>
                                                        );
                                                      }
                                                      return list.map((rule) => {
                                                      const isAdded = appliedRuleIds.includes(rule.id);
                                                      const isDiscount = rule.type === "discount";
                                                      const pill = isDiscount
                                                        ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
                                                        : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };
                                                      return (
                                                        <button
                                                          key={rule.id}
                                                          type="button"
                                                          onClick={() => {
                                                            if (isAdded) {
                                                              const next = appliedRuleIds.filter((id) => id !== rule.id);
                                                              updateVendorConfig(v.id, { appliedPricingRuleIds: next });
                                                            } else {
                                                              updateVendorConfig(v.id, { appliedPricingRuleIds: [...appliedRuleIds, rule.id] });
                                                            }
                                                          }}
                                                          className={`group w-full flex items-start gap-3 px-2.5 py-2 rounded-xl border transition-all duration-150 text-left cursor-pointer ${
                                                            isAdded ? "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50" : "bg-white border-transparent hover:bg-[#F7FAFE] hover:border-[#E8ECF1]"
                                                          }`}
                                                        >
                                                          <span
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] border shrink-0 mt-0.5"
                                                            style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg, borderColor: pill.border }}
                                                          >
                                                            {isDiscount ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
                                                            {isDiscount ? "Discount" : "Premium"}
                                                          </span>
                                                          <div className="flex-1 min-w-0">
                                                            <p className="text-[12.5px] text-foreground truncate" style={{ fontWeight: 600 }}>{rule.label}</p>
                                                            <p className="text-[10.5px] text-slate-500 line-clamp-2 mt-px">{rule.subtitle}</p>
                                                          </div>
                                                          {isAdded ? (
                                                            <span className="inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[10.5px] bg-emerald-500 text-white shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08)] mt-0.5" style={{ fontWeight: 600 }}>
                                                              <Check className="w-3 h-3" /> Added
                                                            </span>
                                                          ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[10.5px] bg-white text-primary border border-[#BFDBFE] shrink-0 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors mt-0.5" style={{ fontWeight: 600 }}>
                                                              <Plus className="w-3 h-3" /> Add
                                                            </span>
                                                          )}
                                                        </button>
                                                      );
                                                      });
                                                    })()}
                                                  </div>
                                                  <div className="px-3.5 py-2.5 border-t border-[#EEF2F6] bg-[#FAFBFC] flex items-center justify-between gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => { setAddRuleOpenForVendor(null); setRuleSession({ mode: "create", vendorId: v.id }); }}
                                                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                                                      style={{ fontWeight: 600 }}
                                                    >
                                                      <Plus className="w-3 h-3" /> Create New Rule
                                                    </button>
                                                    <div className="flex items-center gap-2.5">
                                                      <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                                                        <span className="text-foreground" style={{ fontWeight: 600 }}>{appliedRuleIds.length}</span> added
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={() => setAddRuleOpenForVendor(null)}
                                                        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] bg-primary text-white hover:bg-[#0862D0] cursor-pointer transition-colors shadow-sm"
                                                        style={{ fontWeight: 600 }}
                                                      >
                                                        <Check className="w-3.5 h-3.5" />
                                                        Done
                                                      </button>
                                                    </div>
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            </div>
                                            {appliedRules.length === 0 ? (
                                              <div className="rounded-lg border border-dashed border-[#E8ECF1] bg-[#FAFBFC] px-4 py-8 text-center">
                                                <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>No pricing rules applied</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">Add a rule from the picker above, or</p>
                                                <button
                                                  type="button"
                                                  onClick={() => setRuleSession({ mode: "create", vendorId: v.id })}
                                                  className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-primary hover:underline cursor-pointer"
                                                  style={{ fontWeight: 600 }}
                                                >
                                                  <Plus className="w-3 h-3" /> Create New Rule
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="grid grid-cols-1 gap-3 items-stretch">
                                                {appliedRules.map((rule) => {
                                                  const isInherited = inheritedSet.has(rule.id);
                                                  const isDiscount = rule.type === "discount";
                                                  const pill = isDiscount
                                                    ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
                                                    : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };
                                                  return (
                                                    <div key={rule.id} className="bg-white border border-border rounded-xl group transition-all duration-200 flex flex-col relative h-full">
                                                      <div className="p-3 flex-1 flex flex-col min-h-0">
                                                        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                                                          <div className="flex items-center gap-1.5 min-w-0">
                                                            <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10px] border" style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg, borderColor: pill.border }}>
                                                              {isDiscount ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                                              {isDiscount ? "Discount" : "Premium"}
                                                            </span>
                                                            {isInherited && (
                                                              <span className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[10px] border bg-[#EEF2FF] text-[#4338CA] border-[#E0E7FF] whitespace-nowrap" style={{ fontWeight: 600 }} title="Inherited from default">
                                                                <Check className="w-2.5 h-2.5" /> Inherited
                                                              </span>
                                                            )}
                                                            {rule.custom && (
                                                              <span className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[10px] border bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE] whitespace-nowrap" style={{ fontWeight: 600 }} title="Scoped to this vendor only; other vendors are not affected">
                                                                <Layers className="w-2.5 h-2.5" /> Vendor-scoped
                                                              </span>
                                                            )}
                                                          </div>
                                                          <span className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border bg-emerald-50 text-emerald-700 border-emerald-200" style={{ fontWeight: 500 }}>Active</span>
                                                        </div>
                                                        <p className="text-[13px] text-slate-700 truncate mb-1" style={{ fontWeight: 600 }}>{rule.label}</p>
                                                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{rule.subtitle}</p>
                                                        <div className="mt-auto pt-2.5">
                                                          <div className="flex items-center justify-between px-2.5 py-[5px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px]">
                                                            <span className="inline-flex items-center gap-1 text-slate-500">
                                                              <Sparkles className="w-3 h-3 text-slate-400" />
                                                              <span style={{ fontWeight: 500 }}>{rule.custom ? "Vendor-scoped rule" : "Rule preset"}</span>
                                                            </span>
                                                            <span className="text-slate-400">·</span>
                                                            <span className="text-slate-500" style={{ fontWeight: 500 }}>Auto-applied</span>
                                                          </div>
                                                        </div>
                                                      </div>
                                                      <div className="absolute -top-2 -right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            if (rule.custom) {
                                                              setRuleSession({ mode: "edit", vendorId: v.id, rule });
                                                            } else {
                                                              setPendingRuleEdit({ vendorId: v.id, rule });
                                                            }
                                                          }}
                                                          className="w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-blue-50 transition-all flex items-center justify-center cursor-pointer"
                                                          title="Edit rule"
                                                        >
                                                          <Pencil className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => setPendingRuleRemove({ vendorId: v.id, rule })}
                                                          className="w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-destructive hover:border-destructive/30 hover:bg-red-50 transition-all flex items-center justify-center cursor-pointer"
                                                          title="Remove rule from this vendor"
                                                        >
                                                          <X className="w-3 h-3" />
                                                        </button>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* Footer — actions. */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-5 py-2.5 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            {view === "configure" && !editMode && !editAll && (
              <button
                onClick={() => setView("browse")}
                className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-slate-500 hover:text-foreground transition-colors mr-auto"
                style={{ fontWeight: 500 }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            <div className={`flex items-center gap-2 text-[12px] text-slate-500 ${view === "configure" && !editMode && !editAll ? "" : "mr-auto"}`}>
              <span style={{ fontWeight: 500 }}>
                {editMode
                  ? "Editing qualified-vendor configuration"
                  : editAll
                    ? `Editing ${existingVendors.length} qualified vendor${existingVendors.length !== 1 ? "s" : ""}`
                    : view === "configure"
                      ? `${selectedIds.size} vendor${selectedIds.size !== 1 ? "s" : ""} to configure`
                      : `${existingVendors.length} qualified vendor${existingVendors.length !== 1 ? "s" : ""} added`}
              </span>
              {view === "browse" && selectedIds.size > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-primary" style={{ fontWeight: 600 }}>{selectedIds.size} ready to configure</span>
                </>
              )}
              {view === "added" && addedSelectedIds.size > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-destructive" style={{ fontWeight: 600 }}>{addedSelectedIds.size} selected</span>
                </>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleCloseIntent}
              className="border-border text-slate-500 hover:text-foreground hover:border-slate-300 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9"
            >
              Cancel
            </Button>
            {view === "added" && addedSelectedIds.size > 0 && onRemove && (
              <Button
                onClick={() => setBulkRemoveConfirmOpen(true)}
                className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 bg-destructive text-white hover:bg-[#B91C1C] shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove {addedSelectedIds.size} Vendor{addedSelectedIds.size !== 1 ? "s" : ""}
              </Button>
            )}
            {view === "added" && (addedSelectedIds.size === 0 || !onRemove) && (
              <Button onClick={() => onOpenChange(false)} className="rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 bg-primary text-white hover:bg-[#0862D0] shadow-sm">
                Done
              </Button>
            )}
            {view === "browse" && (
              <Button
                onClick={handleAdd}
                disabled={selectedIds.size === 0}
                className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 bg-primary text-white hover:bg-[#0862D0] shadow-sm disabled:opacity-50"
              >
                Continue
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
            {view === "configure" && (
              <Button
                onClick={handleSaveConfigured}
                disabled={!editAll && selectedIds.size === 0}
                className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 bg-primary text-white hover:bg-[#0862D0] shadow-sm disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {editMode || editAll ? "Save Changes" : `Add ${selectedIds.size} Vendor${selectedIds.size !== 1 ? "s" : ""} as Qualified`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Per-row remove confirmation */}
      {(() => {
        const removed = pendingSingleRemoveId ? existingVendors.find((v) => v.id === pendingSingleRemoveId) : null;
        return (
          <RemoveVendorDialog
            open={!!pendingSingleRemoveId}
            onOpenChange={(o) => { if (!o) setPendingSingleRemoveId(null); }}
            vendorName={removed?.vendorName}
            isDefault={!!removed && roster.defaultKey === removed.id}
            onConfirm={handleSingleRemoveConfirm}
          />
        );
      })()}

      {/* Bulk remove confirmation */}
      <AlertDialog open={bulkRemoveConfirmOpen} onOpenChange={setBulkRemoveConfirmOpen}>
        <AlertDialogContent
          className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Trash2 className="w-8 h-8" style={{ color: "hsl(var(--destructive))" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              Remove Vendors
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
                Remove {addedSelectedIds.size} vendor{addedSelectedIds.size !== 1 ? "s" : ""}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription asChild>
              <div className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
                <p>The following vendors will be removed. You can add them back later.</p>
                <div className="mt-3 max-h-[120px] overflow-y-auto text-left rounded-lg border border-border bg-slate-50">
                  {Array.from(addedSelectedIds).slice(0, 10).map((id) => {
                    const qv = existingVendors.find((v) => v.id === id);
                    return qv ? (
                      <div key={id} className="flex items-center gap-2 px-3 py-1.5 border-b border-muted last:border-0">
                        <Users className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{qv.vendorName}</span>
                        <span className="text-[11px] text-slate-500 truncate">{qv.location}</span>
                      </div>
                    ) : null;
                  })}
                  {addedSelectedIds.size > 10 && (
                    <div className="px-3 py-1.5 text-[11px] text-slate-400 text-center" style={{ fontWeight: 500 }}>
                      +{addedSelectedIds.size - 10} more vendors
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={handleBulkRemove}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "hsl(var(--destructive))", color: "#fff" }}
              >
                Remove {addedSelectedIds.size} Vendor{addedSelectedIds.size !== 1 ? "s" : ""}
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}
              >
                Cancel
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exit warning */}
      <AlertDialog open={exitWarnOpen} onOpenChange={setExitWarnOpen}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        >
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <AlertTriangle className="w-8 h-8" style={{ color: "hsl(var(--destructive))" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              Discard
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
                Discard changes?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription asChild>
              <div className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
                <p>
                  {(selectedIds.size > 0 || Object.keys(configById).length > 0) && (
                    <>
                      {selectedIds.size > 0 && `${selectedIds.size} vendor${selectedIds.size !== 1 ? "s" : ""} selected`}
                      {selectedIds.size > 0 && Object.keys(configById).length > 0 && " · "}
                      {Object.keys(configById).length > 0 && `${Object.keys(configById).length} pricing draft${Object.keys(configById).length !== 1 ? "s" : ""}`}
                      {". "}
                    </>
                  )}
                  All unsaved changes will be lost. This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={discardAndClose}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "hsl(var(--destructive))", color: "#fff" }}
              >
                Discard changes
              </AlertDialogAction>
              <AlertDialogCancel
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}
              >
                Continue editing
              </AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shared-rule edit warning — editing a shared pricing rule touches
          every vendor using it, so we list the affected vendors and offer
          the safe alternative: a vendor-scoped copy. Amber = caution. */}
      <AlertDialog open={!!pendingRuleEdit} onOpenChange={(o) => { if (!o) setPendingRuleEdit(null); }}>
        <AlertDialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]">
          {pendingRuleEdit && (() => {
            const scopeName = vendorNameById(pendingRuleEdit.vendorId);
            return (
              <>
                <div className="relative flex flex-col items-center pt-8 pb-5" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#F59E0B" }} />
                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
                    <Pencil className="w-7 h-7" style={{ color: "#B45309" }} />
                  </div>
                  <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                    Shared Rule
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-7 pb-7">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                    <AlertDialogTitle className="text-[17px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
                      {`Edit "${pendingRuleEdit.rule.label}"?`}
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription asChild>
                    <div className="text-[13px] mt-2 max-w-[380px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
                      <p>This pricing rule is shared. Editing it here updates it for <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>every vendor using this rule</span>, not just {scopeName}.</p>
                    </div>
                  </AlertDialogDescription>
                  <div className="w-full mt-4 rounded-xl border border-border bg-white text-left overflow-hidden">
                    <div className="px-3.5 py-2 border-b border-border bg-slate-50 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500" style={{ fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Vendors using this rule</span>
                      <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] bg-amber-50 text-amber-800 border border-amber-200" style={{ fontWeight: 600 }}>{affectedVendorsForRule.length}</span>
                    </div>
                    <div className="max-h-[168px] overflow-y-auto divide-y divide-border/60">
                      {affectedVendorsForRule.map((p) => (
                        <div key={p.id} className="flex items-center gap-2.5 px-3.5 py-2">
                          <VendorAvatar name={p.name} size="sm" />
                          <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{p.name}</span>
                          <span className="ml-auto inline-flex items-center px-1.5 py-px rounded-md text-[10px] border bg-slate-50 text-slate-500 border-slate-200 shrink-0 truncate max-w-[150px]" style={{ fontWeight: 500 }}>{p.location || p.status || "Vendor"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-full mt-5 flex flex-col gap-2.5">
                    <button onClick={handleCreateRuleCopy} className="w-full rounded-xl border border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.08] px-4 py-3 text-left transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-primary/30 shrink-0 mt-0.5">
                          <Layers className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px]" style={{ fontWeight: 600, color: "hsl(var(--primary))" }}>
                            Create a copy for this vendor
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-px rounded-full text-[10px] bg-primary/10 align-middle" style={{ fontWeight: 600, color: "hsl(var(--primary))" }}>Recommended</span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Saves a vendor-scoped copy that replaces the shared rule on {scopeName}. Other vendors keep the original.</p>
                        </div>
                      </div>
                    </button>
                    <button onClick={handleEditRuleForAll} className="w-full rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 px-4 py-3 text-left transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-amber-200 shrink-0 mt-0.5">
                          <Pencil className="w-4 h-4" style={{ color: "#B45309" }} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px]" style={{ fontWeight: 600, color: "#92400E" }}>Edit for all vendors</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Updates the shared rule everywhere; all {affectedVendorsForRule.length} vendor{affectedVendorsForRule.length !== 1 ? "s" : ""} listed above will see the change.</p>
                        </div>
                      </div>
                    </button>
                    <AlertDialogCancel className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}>
                      Cancel
                    </AlertDialogCancel>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove-rule confirmation — detaches the rule from this vendor. The
          rule itself stays available to other vendors. */}
      <AlertDialog open={!!pendingRuleRemove} onOpenChange={(o) => { if (!o) setPendingRuleRemove(null); }}>
        <AlertDialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]">
          {pendingRuleRemove && (() => {
            const scopeName = vendorNameById(pendingRuleRemove.vendorId);
            return (
              <>
                <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                    <Trash2 className="w-8 h-8" style={{ color: "hsl(var(--destructive))" }} />
                  </div>
                  <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                    Remove Rule
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-8 pb-8">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                    <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
                      {`Remove "${pendingRuleRemove.rule.label}" from ${scopeName}?`}
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription asChild>
                    <div className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
                      <p>This removes the pricing rule from {scopeName}. The rule itself isn't deleted and stays available to other vendors. Are you sure you want to continue?</p>
                    </div>
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <AlertDialogAction onClick={handleRemoveRuleFromVendor} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "hsl(var(--destructive))", color: "#fff" }}>
                      Remove rule
                    </AlertDialogAction>
                    <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}>
                      Keep rule
                    </AlertDialogCancel>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Canonical Create / Edit Pricing Rule wizard — copy + edit-for-all
          (from the shared-rule warning) and Create New all route here. */}
      <PricingRuleCreateModal
        open={!!ruleSession}
        prefill={ruleSession && ruleSession.rule
          ? {
              name: ruleSession.mode === "copy" ? `${ruleSession.rule.label} (Copy)` : ruleSession.rule.label,
              description: ruleSession.rule.subtitle,
              category: ruleSession.rule.type,
              mode: ruleSession.mode,
            }
          : ruleSession
            ? { name: "", category: "discount", mode: "create" }
            : null}
        scopeName={ruleSession ? vendorNameById(ruleSession.vendorId) : "this vendor"}
        currency={ruleSession ? vendorCurrencyById(ruleSession.vendorId) : undefined}
        onClose={() => setRuleSession(null)}
        onSaved={handleRuleSaved}
      />
    </>
  );
}
