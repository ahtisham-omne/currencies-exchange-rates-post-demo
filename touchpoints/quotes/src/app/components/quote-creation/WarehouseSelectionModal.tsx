// @ts-nocheck
/**
 * WarehouseSelectionModal — pickup warehouse picker. Single-step
 * multi-select chooser; the user picks one or more warehouses, or
 * skips entirely so the shipment team decides later.
 *
 * Chrome is lifted from existing patterns (no bespoke design):
 *   • Card grid + checkmark + selected chip row → Partner v7
 *     `CreatePartnerModal.tsx` group-selection step.
 *   • Per-card inventory metrics + hover-card breakdown → Quote
 *     `InventoryTooltip.tsx` (Inventory Snapshot pattern).
 *   • "Decide later / Optional" affordance → Partner v7
 *     `CreatePartnerLocationModal.tsx` POC section.
 *
 * Earlier versions of this modal carried a Step 2 location-tree
 * picker. That was scrapped: pickup is now warehouse-only — the
 * shipment team resolves the specific dock/zone downstream.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Search, Building2, MapPin, Check, LayoutGrid, List, Star, Package, Info, ChevronDown,
  Maximize2, Minimize2,
} from "lucide-react";
import { InventoryTooltip } from "../InventoryTooltip";
import { ConfirmationModal } from "@/app/components/ConfirmationModal";
import { HighlightText } from "@/app/components/HighlightText";
import { FilterPill } from "@/app/components/shared/FilterPill";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/app/components/ui/dropdown-menu";

/* ── Types ──────────────────────────────────────────────────── */

export type Warehouse = {
  id: string;
  name: string;
  description: string;
  /* Physical street address — rendered as a MapPin + slate-500
     line inside the card, mirroring Partner v7 location cards. */
  address: string;
};

/* The new pickup shape — an array of warehouseIds. Empty / undefined
   means the user opted to defer ("decide later"). */
export type WarehousePickupSelection = {
  warehouseIds: string[];
};

/* ── Seed data ──────────────────────────────────────────────── */

export const WAREHOUSES: Warehouse[] = [
  { id: "wh-001", name: "Columbus Conversion Plant",   description: "Primary outbound and assembly hub in Columbus, OH",     address: "4200 Industrial Pkwy, Columbus, OH 43204" },
  { id: "wh-002", name: "Lancaster Assembly Center",   description: "Final assembly and packout in Lancaster, PA",           address: "1800 Lancaster Ave, Lancaster, PA 17602" },
  { id: "wh-003", name: "San Antonio Build Facility",  description: "Custom build and outbound shipping from San Antonio, TX", address: "9500 W Commerce St, San Antonio, TX 78227" },
  { id: "wh-004", name: "Tacoma Cross Dock",           description: "Cross docking and transload site in Tacoma, WA",         address: "210 Marine View Dr, Tacoma, WA 98422" },
  { id: "wh-005", name: "Midwest Returns Hub",         description: "Returns and refurbishment center in Joliet, IL",         address: "880 Logistics Blvd, Joliet, IL 60436" },
];

/* Per-warehouse, per-itemCode stock map. Stamped at module load so
   the picker can quote "Available: N units" on each card. Same
   deterministic seed across both Quote and SO so demo data feels
   consistent across the two modules. Numbers picked to mirror SO's
   `initialInventory` distribution. */
export const WAREHOUSE_INVENTORY: Record<string, Record<string, number>> = {
  // OH: chassis + small-parts hub
  "wh-001": {
    "000-100-001": 3,   "000-100-002": 117, "000-100-003": 64,
    "000-100-019": 8,
    "000-100-026": 156, "000-100-041": 89,
    "000-100-049": 45,
    "000-100-059": 23,  "000-100-061": 28,
    "000-100-079": 200, "000-100-081": 62,  "000-100-093": 71,
    "000-100-171": 999, "000-100-175": 999,
  },
  // PA: assembly + packout
  "wh-002": {
    "000-100-002": 30,
    "000-100-019": 22,
    "000-100-026": 50,  "000-100-041": 40,
    "000-100-079": 100, "000-100-081": 140, "000-100-093": 96,
    "000-100-171": 999, "000-100-175": 999,
  },
  // TX: custom equipment hub
  "wh-003": {
    "000-100-001": 5,
    "000-100-049": 20,
    "000-100-059": 15,  "000-100-061": 18,
    "000-100-171": 999, "000-100-175": 999,
  },
  // WA: cross-dock, light inventory
  "wh-004": {
    "000-100-001": 2,
    "000-100-026": 30,  "000-100-041": 25,
    "000-100-079": 80,
  },
  // IL: returns hub, mainly refurb radios
  "wh-005": {
    "000-100-049": 38,
    "000-100-026": 24,
  },
};

/* ── Location provenance (level) ────────────────────────────────
   A location can be surfaced from three ERP configuration layers.
   Priority when the same location appears at multiple layers:
   ITEM > CATEGORY > COMPANY. Only the highest-priority pill is
   rendered on the card, and the level filter treats each location
   as belonging to exactly one bucket per current item scope. */

export type LocationLevel = 'item' | 'category' | 'company';

/** Item master → the warehouses tagged directly on each item record.
 *  Represents the "preferred pickup" set for a specific product. */
export const ITEM_LEVEL_WAREHOUSES: Record<string, string[]> = {
  '000-100-001': ['wh-003'],
  '000-100-002': ['wh-001'],
  '000-100-003': ['wh-001'],
  '000-100-019': ['wh-002'],
  '000-100-026': ['wh-001'],
  '000-100-041': ['wh-001'],
  '000-100-049': ['wh-005'],
  '000-100-059': ['wh-003'],
  '000-100-061': ['wh-003'],
  '000-100-079': ['wh-001'],
  '000-100-081': ['wh-002'],
  '000-100-093': ['wh-002'],
  '000-100-171': [],
  '000-100-175': [],
};

/** Each item belongs to one category. Categories carry their own
 *  warehouse defaults (see `CATEGORY_LEVEL_WAREHOUSES`). */
export const ITEM_CATEGORIES: Record<string, string> = {
  '000-100-001': 'chassis',
  '000-100-002': 'small-parts',
  '000-100-003': 'small-parts',
  '000-100-019': 'small-parts',
  '000-100-026': 'radios',
  '000-100-041': 'radios',
  '000-100-049': 'radios',
  '000-100-059': 'custom-equipment',
  '000-100-061': 'custom-equipment',
  '000-100-079': 'assembly-kits',
  '000-100-081': 'assembly-kits',
  '000-100-093': 'assembly-kits',
  '000-100-171': 'services',
  '000-100-175': 'services',
};

/** Warehouses configured at the category level in item master setup. */
export const CATEGORY_LEVEL_WAREHOUSES: Record<string, string[]> = {
  chassis: ['wh-001', 'wh-003'],
  'small-parts': ['wh-001', 'wh-002'],
  radios: ['wh-001', 'wh-005'],
  'custom-equipment': ['wh-003'],
  'assembly-kits': ['wh-001', 'wh-002'],
  services: [],
};

/** Company-setup warehouses — every location the business set up as
 *  part of the ERP configuration. Acts as the catch-all: if a
 *  warehouse isn't item- or category-level for the current scope, it
 *  falls back to company level here. */
export const COMPANY_LEVEL_WAREHOUSES: string[] = ['wh-001', 'wh-002', 'wh-003', 'wh-004', 'wh-005'];

/** Card + filter labels are user-oriented — they describe the
 *  scope the location applies to, not the config record it lives
 *  on. Reads naturally as "this pickup is [for this item / for
 *  this category / system-wide]". */
const LEVEL_LABEL: Record<LocationLevel, string> = {
  item: 'For this item',
  category: 'For this category',
  company: 'System-wide',
};

/** Card pill tint per level. Item is the most specific (primary
 *  blue), Category sits at violet, Company falls back to slate.
 *  Colours track Partner's payment-term category chrome. */
const LEVEL_PILL_STYLE: Record<LocationLevel, { bg: string; color: string; border: string }> = {
  item:     { bg: 'rgba(10, 119, 255, 0.10)', color: '#0A77FF', border: 'rgba(10, 119, 255, 0.22)' },
  category: { bg: 'rgba(124, 58, 237, 0.10)', color: '#7C3AED', border: 'rgba(124, 58, 237, 0.22)' },
  company:  { bg: '#F1F5F9',                   color: '#64748B', border: '#E2E8F0' },
};

/** Resolve the highest-priority level for a warehouse across the given
 *  item codes. Item > Category > Company. When `itemCodes` is empty or
 *  undefined (order-default context with no scope), locations fall
 *  back to the company level. */
export function getWarehouseLevel(
  warehouseId: string,
  itemCodes?: string[],
): LocationLevel {
  const codes = itemCodes ?? [];
  if (codes.some((code) => ITEM_LEVEL_WAREHOUSES[code]?.includes(warehouseId))) {
    return 'item';
  }
  if (codes.some((code) => {
    const cat = ITEM_CATEGORIES[code];
    return cat ? CATEGORY_LEVEL_WAREHOUSES[cat]?.includes(warehouseId) : false;
  })) {
    return 'category';
  }
  return 'company';
}

export function getLevelLabel(level: LocationLevel): string {
  return LEVEL_LABEL[level];
}

/* ── Scope filter pill ──────────────────────────────────────
   Same dimensions as the shared `FilterPill` (Partner parity)
   but the active state paints in the level's own colour tint
   instead of the generic primary-blue. Mirrors Partner's
   payment-terms category toggle (see `CreatePartnerModal.tsx`
   where each NET/Pre/Split chip carries its own accent). */
function ScopeFilterPill({
  label, count, active, level, onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  level: LocationLevel;
  onClick: () => void;
}) {
  const tint = LEVEL_PILL_STYLE[level];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        active
          ? ''
          : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted'
      }`}
      style={active ? {
        fontWeight: 500,
        borderColor: tint.color,
        backgroundColor: tint.bg,
        color: tint.color,
      } : { fontWeight: 400 }}
    >
      {label}
      <span
        className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
        style={{
          fontWeight: 600,
          backgroundColor: active ? `${tint.color}1A` : undefined,
          color: active ? tint.color : 'hsl(var(--muted-foreground))',
        }}
      >
        {count}
      </span>
    </button>
  );
}

/* ── Helpers ────────────────────────────────────────────────── */

export function findWarehouseById(id?: string): Warehouse | undefined {
  if (!id) return undefined;
  return WAREHOUSES.find((w) => w.id === id);
}

export function getDefaultPickupSelection(): WarehousePickupSelection {
  return { warehouseIds: [WAREHOUSES[0].id] };
}

/** Resolve the stock quantity for a warehouse and an optional item
 *  scope. When `itemCodes` is provided, the function aggregates each
 *  code's stock at the warehouse; when omitted, it sums every code
 *  the warehouse carries (quote/SO-wide view). */
export function getWarehouseStock(warehouseId: string, itemCodes?: string[]): number {
  const inv = WAREHOUSE_INVENTORY[warehouseId];
  if (!inv) return 0;
  if (!itemCodes) {
    return Object.values(inv).reduce((sum, n) => sum + n, 0);
  }
  return itemCodes.reduce((sum, code) => sum + (inv[code] ?? 0), 0);
}

/** Resolve a list of warehouse names from a selection — used by the
 *  caller's summary card to render the chip row. */
export function getWarehouseNamesForSelection(sel?: WarehousePickupSelection): string[] {
  if (!sel) return [];
  return sel.warehouseIds
    .map((id) => findWarehouseById(id)?.name)
    .filter((n): n is string => !!n);
}

/* ── Card ──────────────────────────────────────────────────── */

function WarehouseCard({
  warehouse, selected, stock, isPrimaryHint, level, onToggle, searchTerm,
}: {
  warehouse: Warehouse;
  selected: boolean;
  /** Per-warehouse stock for the current scope — line item or
   *  aggregate across the order. `null` when no scope was provided
   *  (skip the metric row entirely in that case). */
  stock: number | null;
  isPrimaryHint?: boolean;
  /** ERP provenance for this warehouse in the current item scope
   *  (item master vs category vs company setup). Rendered as a
   *  small pill above the description line. Omitted at order/quote
   *  default level where the pill would just read "System-wide" for
   *  every card. */
  level?: LocationLevel;
  onToggle: () => void;
  searchTerm?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const body = (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative text-left p-3 rounded-lg border transition-all duration-150 flex flex-col w-full h-full"
      style={{
        borderColor: selected ? "#0A77FF" : isHovered ? "#CBD5E1" : "#E2E8F0",
        backgroundColor: selected ? "#F5F9FF" : isHovered ? "#FAFCFF" : "#FFFFFF",
        boxShadow: selected
          ? "0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)"
          : isHovered
          ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
          : "none",
        minWidth: 0,
      }}
    >
      {/* Top-right select indicator — Partner v7 multi-select chrome:
          when selected, a primary-blue circle with a white check; when
          hovered on an unselected card, an empty bordered circle so the
          affordance is discoverable; nothing at rest so unselected
          cards stay clean and the eye flows down to the content. */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {isPrimaryHint && selected && !isHovered && (
          <span
            className="inline-flex items-center gap-0.5 rounded-md"
            style={{ padding: "1px 5px", fontSize: 10, fontWeight: 600, backgroundColor: "rgba(10, 119, 255, 0.08)", color: "#0A77FF" }}
            title="Default pickup location"
          >
            <Star className="w-2.5 h-2.5" style={{ fill: "#0A77FF", color: "#0A77FF" }} />
            Primary
          </span>
        )}
        {selected ? (
          <div
            className="rounded-full flex items-center justify-center"
            style={{ width: 20, height: 20, backgroundColor: "#0A77FF" }}
          >
            <Check className="w-3 h-3" style={{ color: "#FFFFFF" }} />
          </div>
        ) : isHovered ? (
          <div
            className="rounded-full border-2 bg-white"
            style={{ width: 20, height: 20, borderColor: "#CBD5E1" }}
          />
        ) : null}
      </div>

      {/* Icon tile above the title. */}
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center mb-1.5"
        style={{ backgroundColor: selected ? "#D6E8FF" : "#F1F5F9" }}
      >
        <Building2 className="w-4 h-4" style={{ color: selected ? "#0A77FF" : "#64748B" }} />
      </div>

      <div className="text-[13px] pr-16 break-words" style={{ fontWeight: selected ? 600 : 500, color: "#0F172A" }}>
        <HighlightText text={warehouse.name} searchTerm={searchTerm ?? ""} />
      </div>

      {/* Level pill — provenance for this warehouse in the current
          item scope. Tinted per level (blue → item, violet →
          category, slate → company) so the type reads at a glance
          before the user parses the label. Omitted at order/quote
          default level where every warehouse would resolve to
          System-wide (see the card `level` prop). */}
      {level && (
        <div className="mt-1">
          <span
            className="inline-flex items-center rounded-md"
            style={{
              padding: "1px 6px",
              fontSize: 10,
              fontWeight: 600,
              backgroundColor: LEVEL_PILL_STYLE[level].bg,
              color: LEVEL_PILL_STYLE[level].color,
              border: `1px solid ${LEVEL_PILL_STYLE[level].border}`,
            }}
          >
            {getLevelLabel(level)}
          </span>
        </div>
      )}

      <div className="text-[11px] mt-1 line-clamp-2 pr-2 break-words" style={{ color: "#94A3B8" }}>
        <HighlightText text={warehouse.description} searchTerm={searchTerm ?? ""} />
      </div>

      {/* Address — Partner v7 location-card pattern: MapPin glyph
          + slate-500 address text, line-clamped to one row so cards
          stay uniformly tall. `marginBottom: 12` guarantees a baseline
          gap between the address and the stock bar below so cards
          with tightly-packed content still breathe (`marginTop: auto`
          on the bar can resolve to zero when content fills the card,
          which made the address read as flush against the bar). */}
      <div
        className="flex items-start gap-1.5 mt-1"
        style={{ minWidth: 0, marginBottom: 12 }}
        title={warehouse.address}
      >
        <MapPin className="w-3 h-3 shrink-0" style={{ color: "#94A3B8", marginTop: 2 }} />
        <span
          className="line-clamp-1"
          style={{ fontSize: 11, color: "#64748B", lineHeight: 1.4, minWidth: 0 }}
        >
          <HighlightText text={warehouse.address} searchTerm={searchTerm ?? ""} />
        </span>
      </div>

      {/* Inventory metric row — pinned to the bottom of the card via
          `mt-auto` so it always anchors at the footer regardless of how
          short the address / description lines render. Card heights
          are uniform across the grid row (parent `<button>` gets
          `h-full`), so this row consistently lines up. Hover the row
          to expand the full Inventory Snapshot (On-Hand, Allocated,
          Available, ATP, Projected). */}
      {stock !== null && (
        <div
          className="rounded-md flex items-center gap-1.5 overflow-hidden"
          style={{
            // White background when the card is selected so the row
            // stays readable against the light primary card tint;
            // soft slate at rest so it reads as a quiet footer.
            backgroundColor: selected ? "#FFFFFF" : "#F8FAFC",
            border: `1px solid ${selected ? "#D6E8FF" : "#EEF2F6"}`,
            padding: "6px 8px",
            // Pin to the bottom of the flex column so the bar stays at
            // the card footer even when the address/description lines
            // are short.
            marginTop: "auto",
            width: "100%",
            minWidth: 0,
          }}
        >
          {/* Items-related glyph (Package) — the units bar is about
              inventory, not the warehouse building itself. */}
          <Package className="w-3 h-3 shrink-0" style={{ color: selected ? "#0A77FF" : "#94A3B8" }} />
          <span
            className="flex-1 min-w-0"
            style={{ fontSize: 11, fontWeight: selected ? 600 : 500, color: selected ? "#0F172A" : "#64748B", fontVariantNumeric: "tabular-nums" }}
          >
            {stock.toLocaleString()} units on hand
          </span>
          {/* Inventory snapshot is now opt-in — the user hovers the
              tiny `Info` glyph instead of triggering it from anywhere
              on the card. Stop pointer events from bubbling to the
              card so hovering the icon doesn't simultaneously flag
              card hover/selection. */}
          <span
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ display: "inline-flex" }}
          >
            <InventoryTooltip stockQuantity={stock} remainingStock={stock}>
              <Info
                className="w-3 h-3 shrink-0 cursor-help"
                style={{ color: "#94A3B8" }}
                aria-label="Inventory snapshot"
              />
            </InventoryTooltip>
          </span>
        </div>
      )}
    </button>
  );

  return body;
}

/* ── Selected-warehouses chip row ───────────────────────────── */

function SelectedChipsRow({
  warehouses, onRemove, onClear,
}: {
  warehouses: Warehouse[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (warehouses.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-3" style={{ minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>
        Selected ({warehouses.length})
      </span>
      <span style={{ fontSize: 11, color: "#CBD5E1" }}>·</span>
      {warehouses.map((w) => (
        <span
          key={w.id}
          className="inline-flex items-center gap-1.5 rounded-lg transition-colors"
          style={{
            padding: "3px 6px 3px 8px",
            fontSize: 11,
            fontWeight: 500,
            backgroundColor: "#F8FAFC",
            color: "var(--muted-foreground)",
            border: "1px solid var(--border)",
          }}
        >
          <Building2 className="w-3 h-3" style={{ color: "#64748B" }} />
          {w.name}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(w.id); }}
            className="rounded-full inline-flex items-center justify-center transition-colors cursor-pointer"
            style={{ width: 16, height: 16, color: "#64748B" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.05)"; e.currentTarget.style.color = "#0F172A"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#64748B"; }}
            aria-label={`Remove ${w.name}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="transition-colors cursor-pointer"
        style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginLeft: 4 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#0F172A"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; }}
      >
        Clear all
      </button>
    </div>
  );
}

/* ── Modal ──────────────────────────────────────────────────── */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  value?: WarehousePickupSelection;
  /** Returns `undefined` when the user explicitly deferred ("Decide
   *  later"), an object with `warehouseIds` otherwise. */
  onSelect: (sel: WarehousePickupSelection | undefined) => void;
  scopeLabel?: string;
  /** Inventory context. Pass `itemCodes` for the current scope so
   *  the per-warehouse "units on hand" + hover snapshot read for
   *  exactly the right set of products. Omit for a header-only
   *  picker with no inventory metrics. */
  inventoryItemCodes?: string[];
  /** Optional default-warehouse hint — when present, the matching
   *  card gets a small "Primary" star pill. Used by line items
   *  whose source product has a canonical home warehouse. */
  primaryWarehouseId?: string;
  /** True when the selection applies to a single line item; false (or
   *  undefined) when it applies to the entire quote/SO default. Used
   *  only to make the discard / close confirmation copy explicit about
   *  what scope the user is exiting. */
  isLineLevel?: boolean;
}

export function WarehouseSelectionModal({
  isOpen, onClose, value, onSelect, scopeLabel, inventoryItemCodes, primaryWarehouseId, isLineLevel,
}: Props) {
  /* `initialIds` snapshots the selection at the moment the modal opened,
     so we can both (a) detect dirty edits for the discard guard and
     (b) revert to it cleanly when the user picks "Discard changes".
     We seed ONLY on the false → true transition of `isOpen` so a parent
     re-render that hands us a new `value` reference doesn't wipe out
     in-flight edits (the prior implementation depended on `[isOpen,
     value]` and would re-seed mid-edit, masking dirty state). */
  const [initialIds, setInitialIds] = useState<string[]>(value?.warehouseIds ?? []);
  const [draftIds, setDraftIds] = useState<string[]>(value?.warehouseIds ?? []);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  /* Scope filter — the three scope pills are multi-select. Empty set
     means "All" is active (every location visible). Selecting a scope
     pill toggles that scope in/out of the set; selecting "All" clears
     the set. When the set becomes empty via de-selection, "All" turns
     back on automatically. */
  const [activeScopes, setActiveScopes] = useState<Set<LocationLevel>>(new Set());
  /* Full-view toggle — matches the Partner "Select Point of Contact"
     pattern (PocModals.tsx) so the chrome reads consistently across
     the app. Default collapsed; user can stretch to fill the viewport. */
  const [isFullView, setIsFullView] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const seeded = value?.warehouseIds ?? [];
      setInitialIds(seeded);
      setDraftIds(seeded);
      setSearch("");
      setActiveScopes(new Set());
      setShowDiscardConfirm(false);
    }
    wasOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  /* Effective level per warehouse for the current item scope. Computed
     once per open/scope so cards and filter buckets stay in sync. */
  const warehouseLevels = useMemo(() => {
    const map = new Map<string, LocationLevel>();
    for (const w of WAREHOUSES) {
      map.set(w.id, getWarehouseLevel(w.id, inventoryItemCodes));
    }
    return map;
  }, [inventoryItemCodes]);

  const levelCounts = useMemo(() => {
    const counts = { all: WAREHOUSES.length, item: 0, category: 0, company: 0 } as Record<'all' | LocationLevel, number>;
    for (const w of WAREHOUSES) {
      counts[warehouseLevels.get(w.id) ?? 'company']++;
    }
    return counts;
  }, [warehouseLevels]);

  const filteredWarehouses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySearch = q
      ? WAREHOUSES.filter(
          (w) => w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q),
        )
      : WAREHOUSES;
    if (activeScopes.size === 0) return bySearch;
    return bySearch.filter((w) => activeScopes.has(warehouseLevels.get(w.id) ?? 'company'));
  }, [search, activeScopes, warehouseLevels]);

  const toggleScope = (scope: LocationLevel) => {
    setActiveScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const selectedWarehouses = useMemo(
    () => draftIds.map((id) => findWarehouseById(id)).filter((w): w is Warehouse => !!w),
    [draftIds]
  );

  const toggle = (id: string) => {
    setDraftIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleConfirm = () => {
    if (draftIds.length === 0) onSelect(undefined);
    else onSelect({ warehouseIds: draftIds });
    onClose();
  };

  /* Returns true when the current draft differs from what was already
     saved on the line (or order) — i.e. there are unsaved edits to
     guard against accidental dismissal. Order-insensitive compare so
     toggling a card off and on doesn't register as dirty. */
  const isDirty = (() => {
    if (initialIds.length !== draftIds.length) return true;
    const a = [...initialIds].sort();
    const b = [...draftIds].sort();
    return a.some((id, i) => id !== b[i]);
  })();

  /* Close interceptor — wired to the X icon, Cancel button, backdrop
     click, and Escape. Triggers the confirmation when there are either
     (a) unsaved edits, or (b) a non-empty staged selection on a clean
     state — the second case still warrants the prompt because it
     surfaces the explicit "Clear and decide later" path so users can
     wipe an inherited pickup without committing through. Genuinely
     empty + clean closes go straight through. */
  const requestClose = () => {
    const hasSelection = draftIds.length > 0;
    if (isDirty || hasSelection) setShowDiscardConfirm(true);
    else onClose();
  };

  /* "Discard changes" path — revert the draft to whatever was on the
     line when the modal opened and dismiss without writing through. */
  const handleDiscard = () => {
    setDraftIds(initialIds);
    setShowDiscardConfirm(false);
    onClose();
  };

  /* "Clear and decide later" path — explicitly drop the current
     selection so downstream allocation / shipment ops handles pickup. */
  const handleClearForLater = () => {
    setDraftIds([]);
    onSelect(undefined);
    setShowDiscardConfirm(false);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12200, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={requestClose}
    >
      <div
        className="bg-white flex flex-col"
        style={{
          width: isFullView ? "calc(100% - 32px)" : "min(1280px, calc(100% - 32px))",
          height: isFullView ? "calc(100vh - 32px)" : "min(860px, calc(100vh - 64px))",
          borderRadius: 16,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          overflow: "hidden",
          transition: "width 280ms cubic-bezier(0.32,0.72,0,1), height 280ms cubic-bezier(0.32,0.72,0,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header — matches the Partner "Select Point of Contact"
            pattern (PocModals.tsx). No left icon, title + subtitle
            stacked, Full view toggle + close on the right. */}
        <div className="px-5 pt-4 pb-3 shrink-0 bg-white border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] sm:text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>
                Select Pickup Location(s)
              </h2>
              <p className="text-[12px] text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                {scopeLabel ?? "Choose one or more locations where this line will be picked up. You can leave it for the shipment team to finalise later."}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullView((v) => !v)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullView ? "Exit full" : "Full view"}
              </button>
              <button
                onClick={requestClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Toolbar — Partner v7 listing-toolbar archetype.
            White background sits flush against the header, search left
            (capped width), count on `ml-auto`, view dropdown right
            (DropdownMenu replaces the prior 2-button toggle for
            cross-module parity with Partner v7 listing pages). The
            inner "Select Warehouse(s) Optional" subheader + helper
            line were dropped because they duplicated the modal
            header's title and subtitle. */}
        <div className="shrink-0 bg-white border-b border-[#EEF2F6]" style={{ padding: "10px 20px 12px" }}>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0" style={{ width: "min(320px, 50%)" }}>
              <Search className="w-3.5 h-3.5 absolute pointer-events-none" style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
              <input
                type="text"
                placeholder="Search locations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 text-[13px] outline-none rounded-lg"
                style={{
                  paddingLeft: 32, paddingRight: 12,
                  backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", color: "#0F172A",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0A77FF"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(10, 119, 255, 0.12)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
            <span className="text-sm tabular-nums ml-auto" style={{ fontWeight: 500 }}>
              <span style={{ color: "#0F172A" }}>{filteredWarehouses.length}</span>
              <span style={{ color: "rgba(100, 116, 139, 0.7)" }}> {filteredWarehouses.length === 1 ? "location" : "locations"}</span>
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white shadow-sm hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  {view === "grid"
                    ? <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />
                    : <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                    {view === "grid" ? "Grid" : "List"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px] p-1.5">
                {(["grid", "list"] as const).map((v) => (
                  <DropdownMenuItem
                    key={v}
                    className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                    onSelect={() => setView(v)}
                  >
                    {v === "grid"
                      ? <LayoutGrid className="w-5 h-5 text-muted-foreground shrink-0" />
                      : <List className="w-5 h-5 text-muted-foreground shrink-0" />}
                    <span className="text-sm flex-1" style={{ fontWeight: 500 }}>
                      {v === "grid" ? "Grid" : "List"}
                    </span>
                    {view === v && <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Scope filter row — only surfaced in a line-level context.
              At order/quote default level there's no item or category
              to scope against, so "For this item" / "For this category"
              would always read zero and the pill row would just be
              noise. Partner-style chrome; sits as a second line inside
              the same white toolbar so pills stay off the slate body. */}
          {isLineLevel === true && (
            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              <FilterPill
                label="All"
                count={levelCounts.all}
                active={activeScopes.size === 0}
                onClick={() => setActiveScopes(new Set())}
              />
              <ScopeFilterPill
                label="For this item"
                count={levelCounts.item}
                active={activeScopes.has('item')}
                level="item"
                onClick={() => toggleScope('item')}
              />
              <ScopeFilterPill
                label="For this category"
                count={levelCounts.category}
                active={activeScopes.has('category')}
                level="category"
                onClick={() => toggleScope('category')}
              />
              <ScopeFilterPill
                label="System-wide"
                count={levelCounts.company}
                active={activeScopes.has('company')}
                level="company"
                onClick={() => toggleScope('company')}
              />
            </div>
          )}
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 20, backgroundColor: "#FAFBFC" }}>
          <SelectedChipsRow
            warehouses={selectedWarehouses}
            onRemove={(id) => setDraftIds((prev) => prev.filter((x) => x !== id))}
            onClear={() => setDraftIds([])}
          />

          {filteredWarehouses.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center"
              style={{ padding: 40, color: "#94A3B8", fontSize: 13 }}
            >
              No warehouses match “{search}”
            </div>
          ) : view === "grid" ? (
            <div
              className="grid"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 10,
              }}
            >
              {filteredWarehouses.map((w) => (
                <WarehouseCard
                  key={w.id}
                  warehouse={w}
                  selected={draftIds.includes(w.id)}
                  stock={inventoryItemCodes ? getWarehouseStock(w.id, inventoryItemCodes) : null}
                  isPrimaryHint={w.id === primaryWarehouseId}
                  level={isLineLevel === true ? warehouseLevels.get(w.id) ?? 'company' : undefined}
                  onToggle={() => toggle(w.id)}
                  searchTerm={search}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: 8 }}>
              {filteredWarehouses.map((w) => (
                <WarehouseListRow
                  key={w.id}
                  warehouse={w}
                  selected={draftIds.includes(w.id)}
                  stock={inventoryItemCodes ? getWarehouseStock(w.id, inventoryItemCodes) : null}
                  isPrimaryHint={w.id === primaryWarehouseId}
                  level={isLineLevel === true ? warehouseLevels.get(w.id) ?? 'company' : undefined}
                  onToggle={() => toggle(w.id)}
                  searchTerm={search}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-2.5">
          {/* Left rail — selection summary only. The legacy "Decide later"
              affordance was removed; users now exit via Cancel/X, which
              opens the discard-confirmation modal where the explicit
              "Clear and decide later" path lives. */}
          <div />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="border rounded-lg transition-colors"
              style={{
                borderColor: "#E2E8F0",
                color: "#64748B",
                backgroundColor: "#FFFFFF",
                fontSize: 13, fontWeight: 500,
                padding: "0 20px",
                height: 36,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#0F172A"; e.currentTarget.style.borderColor = "#CBD5E1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#64748B"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-lg shadow-sm inline-flex items-center gap-1.5"
              style={{
                backgroundColor: "#0A77FF",
                color: "#FFFFFF",
                fontSize: 13, fontWeight: 500,
                padding: "0 20px",
                height: 36,
                border: "1px solid #0A77FF",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#0566D9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#0A77FF"; }}
            >
              {draftIds.length === 0
                ? "Confirm. Decide later"
                : `Confirm ${draftIds.length} warehouse${draftIds.length === 1 ? "" : "s"}`}
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Discard-confirmation guard. Two paths in the primary group:
          revert the in-flight changes, or keep editing. Below them, a
          separated tertiary path lets the user clear every warehouse
          choice and hand pickup off to the allocation team. */}
      <ConfirmationModal
        isOpen={showDiscardConfirm}
        /* Copy adapts to scope (line item vs order default) and to
           whether the user has unsaved edits or just an existing
           selection they're closing on. */
        title={isDirty ? "Discard unsaved changes?" : "Close Location Selection?"}
        message={(() => {
          const scopeNoun = isLineLevel === true
            ? "this line item"
            : isLineLevel === false
              ? "the order default"
              : "this selection";
          if (isDirty) {
            return `Your pickup location changes for ${scopeNoun} have not been saved. Discarding will restore the previously saved selection.`;
          }
          return `Your pickup warehouse selection for ${scopeNoun} is set. Closing will keep it as is.`;
        })()}
        confirmText={isDirty ? "Discard changes" : "Close"}
        cancelText="Keep editing"
        variant="red"
        icon={<Building2 />}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={handleDiscard}
      />
    </div>,
    document.body
  );
}

/* ── List-view row ──────────────────────────────────────────── */

function WarehouseListRow({
  warehouse, selected, stock, isPrimaryHint, level, onToggle, searchTerm,
}: {
  warehouse: Warehouse;
  selected: boolean;
  stock: number | null;
  isPrimaryHint?: boolean;
  level?: LocationLevel;
  onToggle: () => void;
  searchTerm?: string;
}) {
  const body = (
    <button
      type="button"
      onClick={onToggle}
      className="text-left transition-colors cursor-pointer flex items-center gap-3 p-3 rounded-lg border w-full"
      style={{
        borderColor: selected ? "#0A77FF" : "#E2E8F0",
        backgroundColor: selected ? "#F5F9FF" : "#FFFFFF",
        boxShadow: selected ? "0 0 0 1px rgba(10,119,255,0.15)" : "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        className="flex items-center justify-center shrink-0 rounded-md"
        style={{ width: 32, height: 32, backgroundColor: selected ? "#D6E8FF" : "#F1F5F9", color: selected ? "#0A77FF" : "#64748B" }}
      >
        <Building2 className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
          <span className="truncate" style={{ fontSize: 13, fontWeight: selected ? 600 : 500, color: "#0F172A" }}>
            <HighlightText text={warehouse.name} searchTerm={searchTerm ?? ""} />
          </span>
          {isPrimaryHint && (
            <span
              className="inline-flex items-center gap-0.5 rounded-md shrink-0"
              style={{ padding: "1px 5px", fontSize: 10, fontWeight: 600, backgroundColor: "rgba(10, 119, 255, 0.08)", color: "#0A77FF" }}
            >
              <Star className="w-2.5 h-2.5" style={{ fill: "#0A77FF", color: "#0A77FF" }} />
              Primary
            </span>
          )}
          {level && (
            <span
              className="inline-flex items-center rounded-md shrink-0"
              style={{
                padding: "1px 6px",
                fontSize: 10,
                fontWeight: 600,
                backgroundColor: LEVEL_PILL_STYLE[level].bg,
                color: LEVEL_PILL_STYLE[level].color,
                border: `1px solid ${LEVEL_PILL_STYLE[level].border}`,
              }}
            >
              {getLevelLabel(level)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5" style={{ minWidth: 0 }}>
          <span className="truncate" style={{ fontSize: 11, color: "#94A3B8" }}>
            <HighlightText text={warehouse.description} searchTerm={searchTerm ?? ""} />
          </span>
          {stock !== null && (
            <>
              <span style={{ fontSize: 11, color: "#CBD5E1" }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {stock.toLocaleString()} units on hand
              </span>
              <span
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={{ display: "inline-flex" }}
              >
                <InventoryTooltip stockQuantity={stock} remainingStock={stock}>
                  <Info
                    className="w-3 h-3 shrink-0 cursor-help"
                    style={{ color: "#94A3B8" }}
                    aria-label="Inventory snapshot"
                  />
                </InventoryTooltip>
              </span>
            </>
          )}
        </div>
        {/* Address — MapPin + slate-500 single line, Partner v7
            location-card pattern. */}
        <div
          className="flex items-center gap-1.5 mt-1"
          style={{ minWidth: 0 }}
          title={warehouse.address}
        >
          <MapPin className="w-3 h-3 shrink-0" style={{ color: "#94A3B8" }} />
          <span
            className="truncate"
            style={{ fontSize: 11, color: "#64748B", minWidth: 0 }}
          >
            {warehouse.address}
          </span>
        </div>
      </div>
      {selected ? (
        <div
          className="rounded-full flex items-center justify-center shrink-0"
          style={{ width: 20, height: 20, backgroundColor: "#0A77FF" }}
        >
          <Check className="w-3 h-3" style={{ color: "#FFFFFF" }} />
        </div>
      ) : (
        <div
          className="rounded-full border shrink-0 bg-white"
          style={{ width: 20, height: 20, borderColor: "#E2E8F0" }}
        />
      )}
    </button>
  );

  return body;
}

export default WarehouseSelectionModal;
