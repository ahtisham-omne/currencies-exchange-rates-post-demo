import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { InactiveItemPill } from "../shared/InactiveItemPill";
import {
  Search,
  MapPin,
  Hash,
  Package,
  Check,
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
  Layers,
  Warehouse,
  ClipboardList,
  BoxSelect,
  Info,
  Zap,
  X,
  Undo2,
  AlertTriangle,
  Eye,
  Clock,
  ArrowDownUp,
  Sparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Separator } from "@/app/components/ui/separator";
import { cn } from "@/app/components/ui/utils";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import type { SalesOrder as SOSalesOrder, SOLine, WarehouseInventory as SOWarehouseInventory } from "./types";
import { ItemTypeBadge } from "./StatusBadge";
import { HighlightText } from "./SearchHighlight";
import { useSOStore } from "./store";
import { toast } from "sonner";
import { ConfirmDiscardModal } from "@/app/components/shared/ConfirmDiscardModal";

/* ═══ Real SO inventory injected by the facade — generators read from this ═══ */
let __SO_INVENTORY__: SOWarehouseInventory[] = [];

/* ═══ Internal modal types (Shipment-shape, kept local so SO data shape stays untouched) ═══ */
type InventoryType = "sterilized" | "non_sterilized" | "lot_serialized" | "lot_non_serialized";
const INVENTORY_TYPE_LABELS: Record<InventoryType, string> = {
  sterilized: "Serialized",
  non_sterilized: "Non-Serialized",
  lot_serialized: "Lot Serialized",
  lot_non_serialized: "Lot Non-Serialized",
};

interface LineItem {
  id: string;
  image: string;
  partNumber: string;
  description: string;
  longDescription: string;
  inventoryType: InventoryType;
  uom: string;
  salesOrderQty: number;
  qtyToShip: number;
  allocatedQty: number;
  allocatedTotal: number;
  pickedQty: number;
  pickedTotal: number;
  backorderQty: number;
  dueDate?: string;
}

interface ModalSalesOrder { id: string; orderNumber: string; dueDates: string[]; lineItems: LineItem[]; }
interface Shipment { id: string; salesOrders: ModalSalesOrder[]; }

/* ═══ Adapt SO line.itemType → Shipment InventoryType ═══ */
/**
 * Allocation progress colour helper.
 *
 *   none   (0)            → muted slate (matches the empty progress track)
 *   partial   (0 < x <100) → amber #F59E0B
 *   complete  (x === 100)  → emerald #10B981
 *   over   (x > 100)       → orange #F97316  (over-allocation allowed)
 *
 * One source-of-truth so every progress bar / count label in the modal
 * agrees about what "partial / complete / over" reads as visually.
 */
type AllocBucket = "none" | "partial" | "complete" | "over";

function allocBucket(allocated: number, total: number): AllocBucket {
  if (allocated <= 0 || total <= 0) return "none";
  if (allocated < total) return "partial";
  if (allocated === total) return "complete";
  return "over";
}

const ALLOC_BAR_COLOR: Record<AllocBucket, string> = {
  none: "transparent",
  partial: "#F59E0B",
  complete: "#10B981",
  over: "#F97316",
};
const ALLOC_TEXT_COLOR: Record<AllocBucket, string> = {
  none: "rgba(15, 23, 42, 0.30)",
  partial: "#B45309",
  complete: "#047857",
  over: "#C2410C",
};

function soItemTypeToInventoryType(itemType: SOLine["itemType"]): InventoryType {
  if (itemType === "Serialized") return "sterilized";
  if (itemType === "Lot Serialized") return "lot_serialized";
  if (itemType === "Lot Non-Serialized") return "lot_non_serialized";
  return "non_sterilized";
}

/* ═══ Adapt SalesOrder → Shipment shape the modal expects ═══ */
function adaptSalesOrderToShipment(so: SOSalesOrder): Shipment {
  const lineItems: LineItem[] = so.lines
    .filter((l) => !l.cancelled)
    .map((l) => ({
      id: l.id,
      image: "",
      partNumber: l.itemCode,
      description: l.itemName,
      longDescription: l.itemName,
      inventoryType: soItemTypeToInventoryType(l.itemType),
      uom: "EA",
      salesOrderQty: l.orderedQty,
      qtyToShip: Math.max(0, l.orderedQty - l.shippedQty),
      allocatedQty: l.allocatedQty,
      allocatedTotal: l.orderedQty,
      pickedQty: l.pickedQty,
      pickedTotal: l.orderedQty,
      backorderQty: 0,
    }));
  return {
    id: so.id,
    salesOrders: [{ id: so.id, orderNumber: so.soNumber, dueDates: [], lineItems }],
  };
}

/* ═══════════════════════════════════════════════════════
   Allocation Specificity Model (OMNESOFT)
   ═══════════════════════════════════════════════════════ */

type SpecificityLevel = "qty_only" | "location" | "lot" | "serial";

interface SpecificityOption {
  key: SpecificityLevel;
  label: string;
  description: string;
  pickerDiscretion: string;
}

function getAvailableSpecificities(type: InventoryType): SpecificityOption[] {
  const base: SpecificityOption[] = [
    { key: "qty_only", label: "Quantity Only", description: "Reserve units without specifying where from.", pickerDiscretion: "Full. Any available units." },
    { key: "location", label: "By Location", description: "Reserve units from specific warehouse locations.", pickerDiscretion: "Must pull from specified location." },
  ];
  if (type === "lot_non_serialized") {
    base.push({ key: "lot", label: "By Lot", description: "Reserve units from specific lot numbers at locations.", pickerDiscretion: "Must pull from specified lot." });
  }
  if (type === "lot_serialized") {
    base.push({ key: "lot", label: "By Lot", description: "Reserve units from specific lot numbers at locations. Serial tracking is enforced within each lot.", pickerDiscretion: "Must pull from specified lot and serial." });
  }
  if (type === "sterilized") {
    base.push({ key: "serial", label: "By Serial", description: "Reserve exact serial numbers from locations.", pickerDiscretion: "None. Must pick exact units." });
  }
  return base;
}

/* ═══════════════════════════════════════════════════════
   Shared helpers
   ═══════════════════════════════════════════════════════ */

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

const LOCATION_CODES = [
  "A-01-01", "A-01-03", "A-02-05", "A-03-02",
  "B-01-01", "B-01-04", "B-02-03", "B-03-06",
  "C-01-02", "C-02-01", "C-02-07", "C-03-04",
  "D-01-01", "D-02-03", "D-03-05",
  "E-01-02", "E-02-04", "E-03-01",
];

function getLocationAddress(code: string): string {
  const parts = code.split("-");
  const zone = parts[0] ?? "A";
  const aisle = parts[1] ?? "01";
  const shelf = parts[2] ?? "01";
  const ZONE_NAMES: Record<string, string> = { A: "Main Warehouse", B: "East Wing", C: "Cold Storage", D: "Overflow Facility", E: "Receiving Dock" };
  return `${ZONE_NAMES[zone] ?? "Warehouse " + zone}, Aisle ${aisle}, Shelf ${shelf}`;
}

const LOT_PREFIXES = [
  "LOT-2025-11", "LOT-2025-12", "LOT-2026-01", "LOT-2026-02",
  "LOT-2026-03", "LOT-2024-08", "LOT-2024-09", "LOT-2025-04",
];

/* ═══════════════════════════════════════════════════════
   Inventory data generators — beefed up for 20+ per location
   ═══════════════════════════════════════════════════════ */

interface WarehouseLocation { locationCode: string; onHand: number; alreadyAllocated: number; }
interface LotAtLocation { lotNumber: string; locationCode: string; onHand: number; alreadyAllocated: number; serialNumbers?: string[]; }
interface AvailableSerial { serialNumber: string; locationCode: string; isAllocated: boolean; }

/**
 * Active-only lot selector. Quarantine lots must never reach the allocation UI,
 * so every consumer of `inventory.lots` goes through this helper. Lots without
 * a status default to Active for backwards compatibility with legacy mock data.
 * Mirrors Physical Inventory's status semantics ("Active" | "Quarantine").
 */
function getAllocatableLots(inv: SOWarehouseInventory): NonNullable<SOWarehouseInventory["lots"]> {
  return (inv.lots ?? []).filter((l) => (l.status ?? "Active") === "Active");
}

/** Lot with serial numbers — used in the Select Units sub-modal for lot_serialized items */
interface LotWithSerials { lotNumber: string; serialNumbers: string[]; onHand: number; }

/** Generate serial numbers at a specific location (for sterilized items in Select Units) */
function generateSerialsAtLocation(lineItem: LineItem, locationCode: string, allocQty: number): string[] {
  const hash = simpleHash(lineItem.id + locationCode);
  const count = Math.max(allocQty, allocQty + 2 + (hash % 6));
  const prefix = lineItem.partNumber.split("-").slice(0, 2).join("-");
  return Array.from({ length: count }, (_, i) =>
    `${prefix}-${String(1000 + (hash % 9000) + i).padStart(6, "0")}`
  );
}

/** Generate lots with serial numbers at a specific location (for lot_serialized items in Select Units) */
function generateLotsWithSerialsAtLocation(lineItem: LineItem, locationCode: string, allocQty: number): LotWithSerials[] {
  const hash = simpleHash(lineItem.id + locationCode + "lot-ser");
  const lotCount = 2 + (hash % 3);
  const prefix = lineItem.partNumber.split("-").slice(0, 2).join("-");
  const lots: LotWithSerials[] = [];
  let totalSerials = allocQty + 4 + (hash % 8);
  for (let i = 0; i < lotCount; i++) {
    const lotIdx = (hash + i * 3) % LOT_PREFIXES.length;
    const suffix = String((hash + i * 7) % 100).padStart(3, "0");
    const lotNum = `${LOT_PREFIXES[lotIdx]}-${suffix}`;
    const isLast = i === lotCount - 1;
    const serialCount = isLast ? Math.max(2, totalSerials) : Math.max(2, Math.ceil(totalSerials / (lotCount - i)));
    totalSerials -= serialCount;
    const serialNumbers = Array.from({ length: serialCount }, (_, j) =>
      `${prefix}-${lotNum.slice(-3)}-${String(hash % 900 + i * 100 + j + 1).padStart(5, "0")}`
    );
    lots.push({ lotNumber: lotNum, serialNumbers, onHand: serialCount });
  }
  return lots;
}

/** Generate lots at a specific location (for lot_non_serialized items in Select Lots) */
function generateSimpleLotsAtLocation(lineItem: LineItem, locationCode: string, allocQty: number): { lotNumber: string; onHand: number }[] {
  const hash = simpleHash(lineItem.id + locationCode + "simple-lots");
  const lotCount = 2 + (hash % 4);
  const lots: { lotNumber: string; onHand: number }[] = [];
  let totalOnHand = allocQty + 5 + (hash % 10);
  for (let i = 0; i < lotCount; i++) {
    const lotIdx = (hash + i * 3) % LOT_PREFIXES.length;
    const suffix = String((hash + i * 7) % 100).padStart(3, "0");
    const lotNum = `${LOT_PREFIXES[lotIdx]}-${suffix}`;
    const isLast = i === lotCount - 1;
    const onHand = isLast ? Math.max(1, totalOnHand) : Math.max(1, Math.ceil(totalOnHand / (lotCount - i)));
    totalOnHand -= onHand;
    lots.push({ lotNumber: lotNum, onHand });
  }
  return lots;
}

function generateLocationsForItem(lineItem: LineItem): WarehouseLocation[] {
  // ── Real SO inventory takes priority if we have data for this part number
  const real = __SO_INVENTORY__.filter((inv) => inv.itemCode === lineItem.partNumber);
  if (real.length > 0) {
    return real.map((inv) => ({
      locationCode: inv.warehouse,
      onHand: inv.onHand,
      alreadyAllocated: inv.reserved,
    }));
  }
  const hash = simpleHash(lineItem.id);
  const count = 5 + (hash % 4);
  const locs: WarehouseLocation[] = [];
  const used = new Set<string>();
  let allocRemaining = lineItem.allocatedQty;

  // Determine inventory sufficiency scenario based on hash
  // ~30% insufficient, ~15% exact match, ~55% sufficient
  const sufficiencyBucket = hash % 20;
  const isInsufficient = sufficiencyBucket < 6;
  const isExactMatch = sufficiencyBucket >= 6 && sufficiencyBucket < 9;

  for (let i = 0; i < count; i++) {
    const idx = (hash + i * 7) % LOCATION_CODES.length;
    const code = LOCATION_CODES[idx];
    if (used.has(code)) continue;
    used.add(code);

    let onHand: number;
    if (isInsufficient) {
      onHand = Math.max(1, Math.floor(lineItem.qtyToShip / (count + 2)) + ((hash + i * 3) % 3));
    } else if (isExactMatch) {
      const perLoc = Math.floor(lineItem.qtyToShip / count);
      onHand = i === 0 ? lineItem.qtyToShip - perLoc * (count - 1) : perLoc;
      if (onHand <= 0) onHand = 1;
    } else {
      onHand = 8 + ((hash + i * 13) % 60);
    }

    const maxAlloc = Math.min(onHand, allocRemaining);
    const allocAtLoc = i < 2 && allocRemaining > 0 ? Math.max(0, Math.min(maxAlloc, Math.round(maxAlloc * 0.6))) : 0;
    allocRemaining -= allocAtLoc;
    locs.push({ locationCode: code, onHand, alreadyAllocated: allocAtLoc });
  }
  return locs;
}

function generateLotsForItem(lineItem: LineItem): LotAtLocation[] {
  // ── Real SO inventory takes priority if we have lots for this part number
  const real = __SO_INVENTORY__
    .filter((inv) => inv.itemCode === lineItem.partNumber && inv.lots && inv.lots.length > 0)
    .map((inv) => ({ inv, activeLots: getAllocatableLots(inv) }))
    .filter(({ activeLots }) => activeLots.length > 0);
  if (real.length > 0) {
    const out: LotAtLocation[] = [];
    const isLotSerialized = lineItem.inventoryType === "lot_serialized";
    const prefix = lineItem.partNumber.split("-").slice(0, 2).join("-");
    const hash = simpleHash(lineItem.id);
    /* For lot_serialized items the store data carries lots and a
       warehouse-level pool of serial numbers, but does not map serials
       to lots. Synthesise stable per-lot serial numbers here so the
       "View Units" sub-modal can render the expand affordance and the
       per-serial checkbox grid. Format mirrors the random-data path
       below so the rest of the modal sees a consistent shape. */
    for (const { inv, activeLots } of real) {
      for (const lot of activeLots) {
        let serialNumbers: string[] | undefined;
        if (isLotSerialized) {
          const locHash = simpleHash(inv.warehouse + lot.lotNumber);
          serialNumbers = Array.from({ length: lot.qty }, (_, k) =>
            `${prefix}-${lot.lotNumber.slice(-3)}-${String((hash ^ locHash) % 900 + k + 1).padStart(5, "0")}`,
          );
        }
        out.push({
          lotNumber: lot.lotNumber,
          locationCode: inv.warehouse,
          onHand: lot.qty,
          alreadyAllocated: lot.reserved,
          serialNumbers,
        });
      }
    }
    return out;
  }
  const hash = simpleHash(lineItem.id);
  const locCount = 3 + (hash % 3);
  const lots: LotAtLocation[] = [];
  const usedLocs: string[] = [];
  let allocRemaining = lineItem.allocatedQty;

  for (let i = 0; i < locCount; i++) {
    const locIdx = (hash + i * 5) % LOCATION_CODES.length;
    const loc = LOCATION_CODES[locIdx];
    if (usedLocs.includes(loc)) continue;
    usedLocs.push(loc);
  }

  // Generate a pool of lot numbers that can appear at multiple locations
  const lotPool: string[] = [];
  const poolSize = 8 + (hash % 6);
  for (let j = 0; j < poolSize; j++) {
    const lotIdx = (hash + j * 11) % LOT_PREFIXES.length;
    const suffix = String((hash + j * 7) % 1000).padStart(3, "0");
    lotPool.push(`${LOT_PREFIXES[lotIdx]}-${suffix}`);
  }

  // Distribute lots across locations — some lots appear at multiple locations
  for (let i = 0; i < usedLocs.length; i++) {
    const loc = usedLocs[i];
    const lotsAtLoc = 4 + ((hash + i * 3) % 5);
    for (let j = 0; j < lotsAtLoc; j++) {
      const lotNum = lotPool[(j + i * 2) % lotPool.length];
      // Prevent duplicate lot+location combos
      if (lots.some((l) => l.lotNumber === lotNum && l.locationCode === loc)) continue;
      const onHand = 2 + ((hash + i * 2 + j * 5) % 30);
      const maxAlloc = Math.min(onHand, allocRemaining);
      const allocAtLot = i === 0 && j < 2 && allocRemaining > 0 ? Math.min(maxAlloc, Math.round(maxAlloc * 0.4)) : 0;
      allocRemaining -= allocAtLot;
      let serialNumbers: string[] | undefined;
      if (lineItem.inventoryType === "lot_serialized") {
        const prefix = lineItem.partNumber.split("-").slice(0, 2).join("-");
        serialNumbers = Array.from({ length: onHand }, (_, k) => `${prefix}-${lotNum.slice(-3)}-${String(hash % 900 + i * 100 + j * 10 + k + 1).padStart(5, "0")}`);
      }
      lots.push({ lotNumber: lotNum, locationCode: loc, onHand, alreadyAllocated: allocAtLot, serialNumbers });
    }
  }
  return lots;
}

/**
 * Generate locations for an allocated lot (used by the Allocations section when
 * a lot-only card is clicked).  This creates 2-4 warehouse locations where the
 * specified lot is present, with realistic on-hand and available quantities.
 * For lot_serialized items, serial numbers are generated at each location.
 */
function generateLocationsForAllocatedLot(
  lineItem: LineItem,
  lotNumber: string,
  allocQty: number,
): LotAtLocation[] {
  const hash = simpleHash(lineItem.id + lotNumber);
  const locCount = 2 + (hash % 3); // 2-4 locations
  const usedLocs: string[] = [];
  for (let i = 0; i < locCount; i++) {
    const locIdx = (hash + i * 7) % LOCATION_CODES.length;
    const loc = LOCATION_CODES[locIdx];
    if (usedLocs.includes(loc)) continue;
    usedLocs.push(loc);
  }

  // Distribute on-hand across locations — ensure total available >= allocQty
  const locs: LotAtLocation[] = [];
  for (let i = 0; i < usedLocs.length; i++) {
    const loc = usedLocs[i];
    // Each location has some on-hand qty for this lot
    const baseOnHand = Math.max(2, Math.ceil(allocQty / usedLocs.length) + ((hash + i * 3) % 8));
    const onHand = baseOnHand;
    const preAlloc = 0;
    let serialNumbers: string[] | undefined;
    if (lineItem.inventoryType === "lot_serialized") {
      const prefix = lineItem.partNumber.split("-").slice(0, 2).join("-");
      serialNumbers = Array.from({ length: onHand }, (_, k) =>
        `${prefix}-${lotNumber.slice(-3)}-${String(hash % 900 + i * 100 + k + 1).padStart(5, "0")}`
      );
    }
    locs.push({ lotNumber, locationCode: loc, onHand, alreadyAllocated: preAlloc, serialNumbers });
  }
  return locs;
}

function generateSerialsForItem(lineItem: LineItem): AvailableSerial[] {
  // ── Real SO inventory takes priority if we have serials for this part number
  const real = __SO_INVENTORY__.filter((inv) => inv.itemCode === lineItem.partNumber && inv.serialNumbers && inv.serialNumbers.length > 0);
  if (real.length > 0) {
    const out: AvailableSerial[] = [];
    for (const inv of real) {
      for (const sn of inv.serialNumbers ?? []) {
        out.push({ serialNumber: sn.serial, locationCode: inv.warehouse, isAllocated: !sn.available });
      }
    }
    return out;
  }
  const hash = simpleHash(lineItem.id);
  const locCount = 3 + (hash % 3);
  const usedLocs: string[] = [];
  for (let i = 0; i < locCount; i++) {
    usedLocs.push(LOCATION_CODES[(hash + i * 5) % LOCATION_CODES.length]);
  }
  const serialsPerLoc = 20 + (hash % 10);
  const totalCount = serialsPerLoc * usedLocs.length;
  const serials: AvailableSerial[] = [];
  for (let i = 0; i < totalCount; i++) {
    const prefix = lineItem.partNumber.split("-").slice(0, 2).join("-");
    const sn = `${prefix}-${String(1000 + (hash % 9000) + i).padStart(6, "0")}`;
    const loc = usedLocs[i % usedLocs.length];
    serials.push({ serialNumber: sn, locationCode: loc, isAllocated: i < lineItem.allocatedQty });
  }
  return serials;
}

/* ═══════════════════════════════════════════════════════
   Reusable sub-components
   ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   TruncatedSerial — ports the Cycle Count `truncated-serial.tsx`
   interaction:

   - Serial ≤ SUFFIX_LENGTH chars → render in full, no pill.
   - Serial > SUFFIX_LENGTH chars → render a clickable `···` pill +
     the last N chars (the unique suffix). Native `title` attr puts
     the full serial in a browser tooltip on hover, satisfying the
     "show complete serial on hover" requirement.
   - Click the `···` pill → expand inline to the full serial, with
     an `↑` collapse pill. Click again to re-truncate.

   Click events on the pill `stopPropagation()` so the chip's outer
   selection toggle isn't accidentally fired when the user just wants
   to peek at the full serial. The pill is a <span> (not <button>) to
   avoid nested interactive elements inside the outer chip button.
   ═══════════════════════════════════════════════════════ */
const SERIAL_SUFFIX_LENGTH = 10;

function TruncatedSerial({
  serialNo,
  query,
  isSelected,
  isDisabled,
}: {
  serialNo: string;
  query?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = serialNo.length > SERIAL_SUFFIX_LENGTH;

  const pillBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 5px",
    minWidth: 22,
    height: 14,
    marginRight: 4,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "1px",
    fontVariantNumeric: "tabular-nums",
    cursor: isDisabled ? "not-allowed" : "pointer",
    userSelect: "none",
    transition: "background 0.15s ease, border-color 0.15s ease",
    background: isSelected
      ? "rgba(15, 98, 214, 0.10)"
      : isDisabled
        ? "transparent"
        : "var(--secondary)",
    border: isSelected
      ? "1px solid rgba(15, 98, 214, 0.30)"
      : isDisabled
        ? "1px solid transparent"
        : "1px solid var(--border)",
    color: isSelected
      ? "var(--primary)"
      : isDisabled
        ? "rgba(15, 23, 42, 0.30)"
        : "var(--muted-foreground)",
    lineHeight: 1,
  };

  const togglePill = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isDisabled) setExpanded((p) => !p);
  };

  if (!needsTruncation) {
    return <HighlightText text={serialNo} search={query ?? ""} />;
  }

  if (expanded) {
    return (
      <span style={{ whiteSpace: "normal", wordBreak: "break-all" }}>
        <span
          style={pillBase}
          onClick={togglePill}
          role="button"
          aria-label="Collapse serial"
          title="Collapse"
        >
          ↑
        </span>
        <HighlightText text={serialNo} search={query ?? ""} />
      </span>
    );
  }

  const suffix = serialNo.slice(-SERIAL_SUFFIX_LENGTH);
  return (
    <span style={{ whiteSpace: "nowrap" }} title={serialNo}>
      <span
        style={pillBase}
        onClick={togglePill}
        role="button"
        aria-label={`Show full serial ${serialNo}`}
        title={serialNo}
      >
        &middot;&middot;&middot;
      </span>
      <HighlightText text={suffix} search={query ?? ""} />
    </span>
  );
}

function LocationIcon({ selected, size = "md", variant = "default" }: { selected?: boolean; size?: "sm" | "md"; variant?: "default" | "primary" }) {
  const s = size === "sm" ? "size-6 rounded-md" : "size-8 rounded-lg";
  const i = size === "sm" ? "size-3" : "size-3.5";
  if (variant === "primary") {
    return (
      <div className={cn("shrink-0 flex items-center justify-center", s, "bg-primary/10")}>
        <MapPin className={cn(i, "text-primary")} />
      </div>
    );
  }
  return (
    <div className={cn("shrink-0 flex items-center justify-center", s, selected ? "bg-accent/10" : "bg-primary/8")}>
      <MapPin className={cn(i, selected ? "text-accent" : "text-primary/60")} />
    </div>
  );
}

/* InventoryTypeBadge — delegates to the shared `ItemTypeBadge` used by
   the line items table in SODetail so the pill chrome (Serialized,
   Non-Serialized, Lot Serialized, Lot Non-Serialized) stays consistent
   across the allocation modal and the row badges. Updating
   `ItemTypeBadge` updates both surfaces together. The `compact` prop is
   accepted for API compatibility — the shared component sizes itself
   uniformly. */
function InventoryTypeBadge({ type }: { type: InventoryType; compact?: boolean }) {
  return <ItemTypeBadge type={INVENTORY_TYPE_LABELS[type]} />;
}

/* Reusable line item identity — part number + inventory badge + description */
export function LineItemIdentity({ partNumber, inventoryType, description, compact, search }: { partNumber: string; inventoryType: InventoryType; description?: string; compact?: boolean; search?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-foreground font-sans truncate" style={{ fontSize: compact ? 12 : 14, fontWeight: 600, letterSpacing: 0 }}>
          {search ? <HighlightText text={partNumber} search={search} /> : partNumber}
        </span>
        <InactiveItemPill code={partNumber} size="md" />
        <InventoryTypeBadge type={inventoryType} compact={compact} />
      </div>
      {description && (
        <p className="font-sans text-muted-foreground truncate mt-0.5" style={{ fontSize: compact ? 11 : 12, lineHeight: 1.35, fontWeight: 400 }}>
          {search ? <HighlightText text={description} search={search} /> : description}
        </p>
      )}
    </div>
  );
}

/* Inventory Sufficiency Badge */
function SufficiencyBadge({ lineItem }: { lineItem: LineItem }) {
  const totalOnHand = useMemo(() => {
    const locs = generateLocationsForItem(lineItem);
    return locs.reduce((s, l) => s + l.onHand, 0);
  }, [lineItem]);

  const needed = lineItem.qtyToShip;
  const diff = totalOnHand - needed;

  let label: string;
  let bg: string;
  let text: string;
  let border: string;
  if (diff >= 0) {
    label = `Sufficient (+${diff})`;
    bg = "rgba(5, 150, 105, 0.10)";
    text = "var(--success)";
    border = "rgba(5, 150, 105, 0.25)";
  } else {
    label = `Insufficient (${diff})`;
    bg = "rgba(220, 38, 38, 0.10)";
    text = "var(--destructive)";
    border = "rgba(220, 38, 38, 0.25)";
  }

  return (
    <span
      className="inline-flex items-center rounded-md font-sans shrink-0"
      style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", backgroundColor: bg, color: text, border: `1px solid ${border}` }}
    >
      {label}
    </span>
  );
}

function StatCard({ label, value, uom, variant = "default" }: { label: string; value: number; uom: string; variant?: "default" | "primary" | "accent" | "warning" }) {
  const styles = {
    default: "border-border bg-card",
    primary: "border-primary/20 bg-primary/[0.04]",
    accent: "border-accent bg-accent/40",
    warning: "border-chart-3/25 bg-chart-3/[0.06]",
  };
  const valueColor = variant === "primary" ? "var(--primary)" : variant === "accent" ? "var(--primary)" : variant === "warning" ? "var(--chart-3)" : "var(--foreground)";
  return (
    <div
      className={cn("flex-1 rounded-lg border px-3 py-2 min-w-0", styles[variant])}
      style={{ boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}
    >
      {/* Label first (Partners stat-card pattern), value below with the UoM
          dimmed so the eye lands on the number, not the unit. */}
      <span className="font-sans block" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</span>
      <span className="font-sans flex items-baseline gap-1 mt-1" style={{ color: valueColor }}>
        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value.toLocaleString()}</span>
        <span style={{ fontWeight: 500, fontSize: 11, color: "var(--muted-foreground)" }}>{uom}</span>
      </span>
    </div>
  );
}

function CardSection({ icon: Icon, title, subtitle, expanded, onToggle, children, badge }: { icon: React.ElementType; title: string; subtitle?: string; expanded: boolean; onToggle: () => void; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden"
      style={{ boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}
    >
      <button type="button" onClick={onToggle} className={cn("w-full flex items-center gap-2 px-3 py-2.5 cursor-pointer group transition-colors", expanded ? "bg-muted/40" : "hover:bg-muted/30")}>
        <span className="text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">{expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</span>
        <div className="size-6 rounded-md bg-accent flex items-center justify-center shrink-0"><Icon className="size-3 text-primary" /></div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-foreground font-sans" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{title}</span>
            {badge}
          </div>
          {subtitle && <span className="font-sans block" style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.3, marginTop: 1 }}>{subtitle}</span>}
        </div>
      </button>
      {expanded && <div className="border-t border-border bg-card">{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Specificity Selector
   ═══════════════════════════════════════════════════════ */

function SpecificitySelector({ options, selected, onSelect, counts }: { options: SpecificityOption[]; selected: SpecificityLevel; onSelect: (level: SpecificityLevel) => void; counts?: Partial<Record<SpecificityLevel, number>> }) {
  const selectedOpt = options.find((o) => o.key === selected);
  return (
    <div className="px-5 pb-2">
      {/* Partners filter-chip pattern (SalesOrdersTable.tsx:153). Each pill is
          standalone with its own border — no outer wrapper. Inactive uses muted
          border + foreground hover; active uses primary border + accent bg.
          Count chips: rounded-full, bg-primary/10 (active) or bg-muted. */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-2">
        {options.map((opt) => {
          const isActive = opt.key === selected;
          const c = counts?.[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelect(opt.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap shrink-0 cursor-pointer",
                isActive
                  ? "border-primary bg-accent"
                  : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "hsl(var(--primary))" : undefined,
              }}
            >
              {opt.label}
              {c !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-center",
                    isActive ? "bg-primary/10" : "bg-muted",
                  )}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    minWidth: 18,
                    color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {c}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selectedOpt && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
          <Info className="size-3.5 text-muted-foreground shrink-0 mt-px" />
          <span className="text-foreground/70 font-sans" style={{ fontSize: "var(--text-xs)", lineHeight: "1.4" }}>{selectedOpt.description}</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Flat line item type
   ═══════════════════════════════════════════════════════ */

interface FlatLineItem extends LineItem { soId: string; soNumber: string; soDueDate?: string; }

function flattenLineItems(shipment: Shipment): FlatLineItem[] {
  const items: FlatLineItem[] = [];
  for (const so of shipment.salesOrders) {
    const earliestDue = so.dueDates.length > 0 ? [...so.dueDates].sort()[0] : undefined;
    for (const li of so.lineItems) { items.push({ ...li, soId: so.id, soNumber: so.orderNumber, soDueDate: li.dueDate || earliestDue }); }
  }
  return items;
}

/* ═══════════════════════════════════════════════════════
   Left Panel — Compact Line Item List
   ═══════════════════════════════════════════════════════ */

function LineItemList({ items, selectedId, onSelect, search, onSearchChange, pendingDeltas }: {
  items: FlatLineItem[]; selectedId: string | null; onSelect: (id: string) => void; search: string; onSearchChange: (v: string) => void; pendingDeltas: Record<string, number>;
}) {
  const filtered = items.filter((li) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return li.partNumber.toLowerCase().includes(q) || li.description.toLowerCase().includes(q) || li.soNumber.toLowerCase().includes(q);
  });

  const grouped = useMemo(() => {
    const map = new Map<string, FlatLineItem[]>();
    for (const li of filtered) { const arr = map.get(li.soNumber) ?? []; arr.push(li); map.set(li.soNumber, arr); }
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search items..."
            className="pl-9 h-9 rounded-lg border-border text-foreground placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-2"
            style={{ fontSize: 13, backgroundColor: "#FFFFFF" }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 px-0.5">
          <span className="font-sans" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>{filtered.length} items</span>
          <span className="font-sans" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>{filtered.filter((li) => li.allocatedQty >= li.allocatedTotal).length} fully allocated</span>
        </div>
      </div>

      <Separator className="shrink-0" />

      <div className="flex-1 overflow-y-auto">
        {Array.from(grouped.entries()).map(([soNum, soItems]) => (
          <div key={soNum}>
            <div className="sticky top-0 z-10 px-3 py-1.5 bg-muted/60 backdrop-blur-sm border-b border-border/50">
              <span className="font-sans" style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>{soNum}</span>
            </div>
            {soItems.map((li) => {
              const isSelected = li.id === selectedId;
              const effectiveAllocated = li.allocatedQty + (pendingDeltas[li.id] ?? 0);
              const allocPct = li.allocatedTotal > 0 ? Math.round((effectiveAllocated / li.allocatedTotal) * 100) : 0;
              const bucket = allocBucket(effectiveAllocated, li.allocatedTotal);
              const hasPending = (pendingDeltas[li.id] ?? 0) > 0;

              return (
                <button
                  key={li.id}
                  onClick={() => onSelect(li.id)}
                  className={cn("w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-all cursor-pointer border-l-[3px]", isSelected ? "bg-primary/[0.06] border-l-primary" : "border-l-transparent hover:bg-secondary/50")}
                >
                  <div className="shrink-0 size-8 rounded-lg overflow-hidden bg-secondary mt-0.5">
                    <ImageWithFallback src={li.image} alt={li.description} className="size-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5">
                      <div className="flex-1 min-w-0">
                        <LineItemIdentity partNumber={li.partNumber} inventoryType={li.inventoryType} description={li.description} compact search={search} />
                      </div>
                      {hasPending && <span className="shrink-0 size-1.5 rounded-full bg-accent mt-1.5" />}
                    </div>
                    {/* Allocation progress with qty context — amber (partial),
                        emerald (complete) or orange (over-allocated). */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-sans shrink-0" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)", color: ALLOC_TEXT_COLOR[bucket] }}>
                        {effectiveAllocated}/{li.allocatedTotal}
                      </span>
                      <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, allocPct)}%`,
                            backgroundColor: ALLOC_BAR_COLOR[bucket],
                          }}
                        />
                      </div>
                      <span className="text-foreground/20 font-sans shrink-0" style={{ fontSize: "var(--text-2xs)" }}>{li.uom}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Qty-Only Allocation Panel
   ═══════════════════════════════════════════════════════ */

function QtyOnlyPanel({ lineItem, remaining, qtyOnlyValue, onQtyOnlyChange }: { lineItem: LineItem; remaining: number; qtyOnlyValue: number; onQtyOnlyChange: (v: number) => void }) {
  const totalAvailable = useMemo(() => {
    const locs = generateLocationsForItem(lineItem);
    return locs.reduce((s, l) => s + (l.onHand - l.alreadyAllocated), 0);
  }, [lineItem]);

  return (
    <div className="px-5 pb-2">
      <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
        <div className="px-3 py-2 bg-muted/40 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded-md bg-accent flex items-center justify-center shrink-0"><Package className="size-3 text-primary" /></div>
            <span className="text-foreground font-sans" style={{ fontSize: 13, fontWeight: 600 }}>Quantity-only allocation</span>
            <span className="font-sans" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>The warehouse picks the source location at pick time.</span>
          </div>
        </div>
        <div className="px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-start gap-1">
              <span className="font-sans" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Allocate qty</span>
              {/* +/- stepper. Center input widened so 6-digit allocations
                  read centered in the field (was w-12 / 48 px which capped
                  the visual breathing room to 2-3 chars). Capped at `remaining`
                  on both the +1 button and direct typing — over-allocation
                  is no longer permitted. */}
              <div className="inline-flex items-center border border-border rounded-md overflow-hidden bg-card" style={{ boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
                <button type="button" onClick={() => onQtyOnlyChange(Math.max(0, qtyOnlyValue - 1))} disabled={qtyOnlyValue <= 0} className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><Minus className="size-3.5" /></button>
                <input type="number" value={qtyOnlyValue || ""} placeholder="0" onChange={(e) => onQtyOnlyChange(Math.max(0, Math.min(parseInt(e.target.value) || 0, remaining)))} className="w-24 h-8 text-center bg-card text-foreground font-sans outline-none border-x border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" style={{ fontSize: 13, fontWeight: 600 }} />
                <button type="button" onClick={() => onQtyOnlyChange(Math.min(qtyOnlyValue + 1, remaining))} disabled={qtyOnlyValue >= remaining} className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><Plus className="size-3.5" /></button>
              </div>
              <span className="font-sans" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>of {remaining} {lineItem.uom} remaining</span>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border px-3 py-2 bg-card" style={{ boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
                <span className="font-sans block mb-1" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Total available</span>
                <span className="text-foreground font-sans" style={{ fontSize: 13, fontWeight: 600 }}>{totalAvailable} <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>{lineItem.uom}</span></span>
              </div>
              <div className="rounded-md border border-border px-3 py-2 bg-card" style={{ boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
                <span className="font-sans block mb-1" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Across</span>
                <span className="text-foreground font-sans" style={{ fontSize: 13, fontWeight: 600 }}>{generateLocationsForItem(lineItem).length} <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>locations</span></span>
              </div>
            </div>
            {qtyOnlyValue >= remaining && remaining > 0 ? (
              <button type="button" onClick={() => onQtyOnlyChange(0)} className="shrink-0 px-3 py-1.5 rounded-md border border-chart-1/25 bg-chart-1/[0.05] text-chart-1 hover:bg-chart-1/10 hover:border-chart-1/40 font-sans transition-all cursor-pointer" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}>
                Undo
              </button>
            ) : (
              <button type="button" onClick={() => onQtyOnlyChange(remaining)} disabled={qtyOnlyValue >= remaining} className="shrink-0 px-3 py-1.5 rounded-md border border-primary/20 bg-primary/[0.04] text-primary hover:bg-primary/10 font-sans transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}>Allocate All</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Location-Specific Panel
   ═══════════════════════════════════════════════════════ */

function LocationPanel({ lineItem, remaining, allocQtys, onQtyChange, searchFilter, onUpgradeToSerial }: { lineItem: LineItem; remaining: number; allocQtys: Record<string, number>; onQtyChange: (loc: string, qty: number) => void; searchFilter?: string; onUpgradeToSerial?: (serials: string[]) => void; }) {
  const locations = useMemo(() => generateLocationsForItem(lineItem), [lineItem]);
  const [search, setSearch] = useState("");
  const effectiveSearch = searchFilter || search;
  const filtered = locations.filter((l) => {
    const available = l.onHand - l.alreadyAllocated;
    if (available <= 0) return false;
    if (!effectiveSearch) return true;
    const q = effectiveSearch.toLowerCase();
    return l.locationCode.toLowerCase().includes(q) || getLocationAddress(l.locationCode).toLowerCase().includes(q);
  });
  const totalNewlyAllocated = Object.values(allocQtys).reduce((s, v) => s + v, 0);

  const handleAllocateMax = (locCode: string, onHand: number, alreadyAllocated: number) => {
    const available = onHand - alreadyAllocated;
    const currentForThis = allocQtys[locCode] ?? 0;
    const usedElsewhere = totalNewlyAllocated - currentForThis;
    onQtyChange(locCode, Math.max(0, Math.min(available, remaining - usedElsewhere)));
  };

  // Sub-modal state for Select Units / View Lots
  const [subModalLoc, setSubModalLoc] = useState<string | null>(null);
  const subModalAvailable = subModalLoc ? (() => {
    const loc = locations.find((l) => l.locationCode === subModalLoc);
    return loc ? loc.onHand - loc.alreadyAllocated : 0;
  })() : 0;

  const isSterilized = lineItem.inventoryType === "sterilized";
  const isLotType = lineItem.inventoryType === "lot_serialized" || lineItem.inventoryType === "lot_non_serialized";

  const getActionButton = (locCode: string, onHand: number, alreadyAllocated: number) => {
    const available = onHand - alreadyAllocated;
    if (isSterilized) {
      return (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleAllocateMax(locCode, onHand, alreadyAllocated)}
            disabled={available <= 0 || totalNewlyAllocated >= remaining}
            className="whitespace-nowrap px-1.5 py-1 rounded-md border border-border bg-background text-foreground hover:bg-secondary/60 font-sans transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
          >
            Allocate max
          </button>
          <button
            onClick={() => setSubModalLoc(locCode)}
            disabled={available <= 0 || totalNewlyAllocated >= remaining}
            className="whitespace-nowrap px-1.5 py-1 rounded-md border border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:border-primary/30 font-sans transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
          >
            Select Units
          </button>
        </div>
      );
    }
    if (isLotType) {
      return (
        <button
          onClick={() => setSubModalLoc(locCode)}
          disabled={available <= 0 || totalNewlyAllocated >= remaining}
          className="whitespace-nowrap px-1.5 py-1 rounded-md border border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:border-primary/30 font-sans transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
        >
          View Units
        </button>
      );
    }
    return (
      <button
        onClick={() => handleAllocateMax(locCode, onHand, alreadyAllocated)}
        disabled={available <= 0 || totalNewlyAllocated >= remaining}
        className="whitespace-nowrap px-1.5 py-1 rounded-md border border-border text-foreground/50 hover:text-primary hover:border-primary/30 hover:bg-primary/[0.04] font-sans transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
      >
        Allocate max
      </button>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="px-5 pb-1.5 space-y-1.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search locations..." className="pl-9 h-9 rounded-lg font-sans border-border text-foreground placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-2" style={{ fontSize: 13, backgroundColor: "#FFFFFF" }} />
        </div>
        <div className="flex items-center">
          <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>{filtered.length} locations</span>
        </div>
      </div>
      {/* Partners single-table chrome: tinted header row + data rows live in
          one bordered container, divided by border-b. Matches the LotPanel
          treatment and the SalesOrdersTable.tsx pattern. */}
      <div className="px-5 pb-2">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-2.5 py-2 bg-muted/30 border-b border-border">
            <span className="flex-1 min-w-0 font-sans" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Location</span>
            <span className="w-[88px] text-right font-sans" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Available</span>
            <span className="w-[120px] text-center font-sans" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Qty from this location</span>
            <span className={isSterilized ? "w-[160px]" : "w-[80px]"} />
          </div>
          {filtered.map((loc, idx) => {
            const newQty = allocQtys[loc.locationCode] ?? 0;
            const available = loc.onHand - loc.alreadyAllocated;
            const hasAlloc = newQty > 0;
            return (
              <div
                key={loc.locationCode}
                className={cn(
                  "flex items-center gap-3 px-2.5 py-1.5 transition-colors relative",
                  hasAlloc ? "bg-primary/[0.04]" : "hover:bg-muted/30",
                  idx < filtered.length - 1 && "border-b border-border",
                )}
              >
                {/* Selected-row left accent — gives the active row a clear,
                    glanceable affordance distinct from hover. */}
                {hasAlloc && <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <LocationIcon selected={hasAlloc} size="sm" />
                  <div className="min-w-0 flex flex-col leading-tight">
                    <span className="text-foreground font-sans truncate" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}><HighlightText text={loc.locationCode} search={effectiveSearch} /></span>
                    <span className="text-muted-foreground font-sans truncate" style={{ fontSize: "var(--text-2xs)" }}><HighlightText text={getLocationAddress(loc.locationCode)} search={effectiveSearch} /></span>
                  </div>
                </div>
                {/* Available value — column header already says "Available",
                    so the row shows just the number + EA. */}
                <div className="w-[88px] text-right">
                  <span className="text-foreground font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
                    {available.toLocaleString()} <span className="text-muted-foreground" style={{ fontWeight: 500, fontSize: 10 }}>{lineItem.uom}</span>
                  </span>
                </div>
                <div className="w-[120px] flex flex-col items-center justify-center gap-0.5">
                  <div className="inline-flex items-center border border-border rounded-md overflow-hidden">
                    <button type="button" onClick={() => onQtyChange(loc.locationCode, Math.max(0, newQty - 1))} disabled={newQty <= 0} className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><Minus className="size-2.5" /></button>
                    <input type="number" value={newQty || ""} placeholder="0" onChange={(e) => { const val = parseInt(e.target.value) || 0; const cur = allocQtys[loc.locationCode] ?? 0; const ue = totalNewlyAllocated - cur; const maxPickable = Math.min(available, remaining - ue); onQtyChange(loc.locationCode, Math.max(0, Math.min(val, maxPickable))); }} className="w-9 h-6 text-center bg-background text-foreground font-sans outline-none border-x border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }} />
                    <button type="button" onClick={() => { const cur = allocQtys[loc.locationCode] ?? 0; const ue = totalNewlyAllocated - cur; onQtyChange(loc.locationCode, Math.min(newQty + 1, Math.min(available, remaining - ue))); }} disabled={newQty >= available || totalNewlyAllocated >= remaining} className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><Plus className="size-2.5" /></button>
                  </div>

                </div>
                <div className={cn(isSterilized ? "w-[160px]" : "w-[80px]", "flex justify-end")}>
                  {getActionButton(loc.locationCode, loc.onHand, loc.alreadyAllocated)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-modal: Select Units for sterilized items */}
      {subModalLoc && isSterilized && (
        <AssignUnitsSubModal
          lineItem={lineItem}
          locationCode={subModalLoc}
          allocQty={allocQtys[subModalLoc] || Math.min(subModalAvailable, Math.max(1, remaining - totalNewlyAllocated + (allocQtys[subModalLoc] ?? 0)))}
          onClose={() => setSubModalLoc(null)}
          onConfirm={(selectedCount) => {
            if (selectedCount > 0) {
              onQtyChange(subModalLoc!, selectedCount);
            }
          }}
          onConfirmWithSerials={onUpgradeToSerial ? (serials) => {
            if (serials.length > 0) {
              onUpgradeToSerial(serials);
            }
          } : undefined}
        />
      )}

      {/* Sub-modal: View Lots for lot types */}
      {subModalLoc && isLotType && (
        <LocationLotsSubModal
          lineItem={lineItem}
          locationCode={subModalLoc}
          allocQty={allocQtys[subModalLoc] || Math.min(subModalAvailable, Math.max(1, remaining - totalNewlyAllocated + (allocQtys[subModalLoc] ?? 0)))}
          onClose={(confirmedQty) => {
            if (confirmedQty !== undefined && confirmedQty > 0) {
              onQtyChange(subModalLoc!, confirmedQty);
            }
            setSubModalLoc(null);
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Sub-Modal — Units Browser Overlay
   Sits on top of the allocate modal for viewing/managing
   units at a specific location.
   ═══════════════════════════════════════════════════════ */

function UnitsSubModal({
  open,
  onClose,
  locationCode,
  title,
  children,
  width = 640,
}: {
  open: boolean;
  onClose: () => void;
  locationCode?: string;
  title: string;
  children: React.ReactNode;
  /** Override default 640px width — set higher (e.g. 880) for two-pane layouts. */
  width?: number;
}) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-foreground/40 backdrop-blur-[2px] pointer-events-auto"
      style={{ zIndex: 10100 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onFocusCapture={(e) => e.stopPropagation()}
        className="bg-card rounded-xl border border-border shadow-xl flex flex-col overflow-hidden"
        style={{ width: `${width}px`, maxWidth: "90vw", maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            {locationCode ? (
              <LocationIcon selected size="md" />
            ) : (
              <div className="size-8 rounded-lg shrink-0 flex items-center justify-center bg-primary/8">
                <Layers className="size-3.5 text-primary/60" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-foreground font-sans block" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>{title}</span>
              {locationCode && (
                <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>{locationCode} · {getLocationAddress(locationCode)}</span>
              )}
            </div>
            <button type="button" onClick={onClose} className="size-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
              <X className="size-4" />
            </button>
          </div>
        </div>
        {/* Body — a flex column that does NOT scroll on its own.
            Children are expected to declare their own scroll area
            (flex-1 min-h-0 overflow-y-auto for a single scrollable block,
            or flex-1 min-h-0 flex layout for two-pane layouts). A sticky
            footer rendered as the last child stays pinned to the bottom
            because of the column layout + its own `shrink-0`. This
            removes the double-scroll bug where the body's auto scroll
            stacked on top of inner-pane scroll. */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════
   Existing Allocations — Location cards with sub-modal
   ═══════════════════════════════════════════════════════ */

interface ExistingAllocLocation {
  /** Location code — undefined for qty-only allocations (no location specified) */
  code?: string;
  qty: number;
  lotNumber?: string;
  serials?: string[];
  specificity: string;
  /** Origin of the allocation — "so" = inherited from Sales Order, "shipment" = refined for this shipment */
  source: "so" | "shipment";
  /** Allocation type discriminator:
   *  "qty_only"         — only quantity allocated, no location/serial specified, picker has full discretion
   *  "location_qty"     — location + quantity allocated, pick X from this location
   *  "location_serial"  — location + exact serial units allocated, pick these exact units
   */
  allocationType: "qty_only" | "location_qty" | "location_serial";
}

/**
 * Generate mock SO allocations for a line item.
 *
 * KEY CONCEPT:  All allocations are location-based at different levels of specificity:
 *  • "Location"       — assigned to a specific warehouse location with a pick qty
 *  • "Serial"         — assigned to specific serial numbers at locations (sterilized items)
 *  • "Lot + Location" — assigned to a specific lot at a location (lot_non_serialized items)
 *  • "Lot + Serial"   — assigned to a specific lot + serial numbers (lot_serialized items)
 *
 * bucket 0 = location-only (location + qty), bucket 1 = detailed (with serials where applicable)
 */
function generateExistingAllocations(lineItem: LineItem): ExistingAllocLocation[] {
  if (lineItem.allocatedQty === 0) return [];
  const hash = simpleHash(lineItem.id + "existing");

  /**
   * Allocation mix bucket — determines the combination of allocation types generated:
   *   0 = qty-only + location-based (mix)
   *   1 = all location-based (location+qty or location+serial)
   *   2 = all qty-only (common for serialized items with deferred picking)
   */
  const mixBucket = hash % 3;
  // Allocations are scoped to the shipment quantity (qtyToShip), not the full SO qty
  const effectiveTotal = Math.min(lineItem.allocatedQty, lineItem.qtyToShip);

  const isLotType = lineItem.inventoryType === "lot_serialized" || lineItem.inventoryType === "lot_non_serialized";
  const isSerialized = lineItem.inventoryType === "sterilized";
  const isLotSerialized = lineItem.inventoryType === "lot_serialized";

  // Detail bucket: 0 = location+qty, 1 = location+serial (where applicable)
  const detailBucket = hash % 2;

  const source: "so" | "shipment" = "so";
  const locs: ExistingAllocLocation[] = [];

  /* ── Bucket 2: All quantity-only allocations ── */
  if (mixBucket === 2) {
    locs.push({
      qty: effectiveTotal,
      specificity: "Qty Only",
      source,
      allocationType: "qty_only",
    });
    return locs;
  }

  /* ── Bucket 0: Mix — first entry is qty-only, rest are location-based ── */
  const numEntries = Math.min(2 + (hash % 2), Math.ceil(effectiveTotal / 2));
  let rem = effectiveTotal;

  for (let i = 0; i < numEntries; i++) {
    const isLast = i === numEntries - 1;
    const qty = isLast ? rem : Math.max(1, Math.min(Math.round(rem / (numEntries - i)), rem - (numEntries - i - 1)));
    rem -= qty;

    const locIdx = (hash + i * 3) % LOCATION_CODES.length;
    const loc = LOCATION_CODES[locIdx];

    // First entry in mixBucket 0 is qty-only
    if (mixBucket === 0 && i === 0) {
      locs.push({
        qty,
        specificity: "Qty Only",
        source,
        allocationType: "qty_only",
      });
      continue;
    }

    // Location-based entries
    if (isSerialized) {
      const entry: ExistingAllocLocation = { code: loc, qty, specificity: "Location", source, allocationType: "location_qty" };
      if (detailBucket === 1) {
        const prefix = lineItem.partNumber.split("-").slice(0, 2).join("-");
        entry.serials = Array.from({ length: qty }, (_, j) => `${prefix}-A${String(hash % 9000 + i * 100 + j + 1).padStart(5, "0")}`);
        entry.specificity = "Serial";
        entry.allocationType = "location_serial";
      }
      locs.push(entry);
    } else if (isLotType && i % 2 === 1) {
      // Lot-based allocation
      const lotIdx2 = (hash + i * 3) % LOT_PREFIXES.length;
      const lotNum = `${LOT_PREFIXES[lotIdx2]}-A${String((hash + i * 7) % 100).padStart(3, "0")}`;
      const entry: ExistingAllocLocation = { qty, lotNumber: lotNum, specificity: "Lot + Location", source, allocationType: "location_qty" };
      if (isLotSerialized && detailBucket === 1) {
        const prefix = lineItem.partNumber.split("-").slice(0, 2).join("-");
        entry.serials = Array.from({ length: qty }, (_, j) => `${prefix}-L${String(hash % 9000 + i * 100 + j + 1).padStart(5, "0")}`);
        entry.specificity = "Lot + Serial";
        entry.allocationType = "location_serial";
      }
      locs.push(entry);
    } else if (isLotType) {
      locs.push({ code: loc, qty, specificity: "Location", source, allocationType: "location_qty" });
    } else {
      locs.push({ code: loc, qty, specificity: "Location", source, allocationType: "location_qty" });
    }
  }
  return locs;
}

/* ═══════════════════════════════════════════════════════
   Qty-Only Allocation → Location Browser Sub-Modal
   Opened when user clicks "Select Units" on a qty-only SO allocation card.
   Shows all warehouse locations with serial inventory for this item.
   User can define qty per location or drill into specific serials.
   ═══════════════════════════════════════════════════════ */

function QtyAllocLocationBrowser({
  lineItem,
  allocQty,
  onClose,
  onConfirm,
  onConfirmAsSerial,
}: {
  lineItem: LineItem;
  allocQty: number;
  onClose: () => void;
  onConfirm?: (data: { locations: string[]; totalQty: number }) => void;
  /** Called when user explicitly selects serial numbers — upgrades allocation to serial type */
  onConfirmAsSerial?: (serials: string[]) => void;
}) {
  const isSerialized = lineItem.inventoryType === "sterilized";
  const isLotSerialized = lineItem.inventoryType === "lot_serialized";
  const isLotNonSerialized = lineItem.inventoryType === "lot_non_serialized";

  const locations = useMemo(() => generateLocationsForItem(lineItem), [lineItem]);
  const availableLocations = useMemo(
    () => locations.filter((l) => l.onHand - l.alreadyAllocated > 0),
    [locations]
  );
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search) return availableLocations;
    const q = search.toLowerCase();
    return availableLocations.filter(
      (l) =>
        l.locationCode.toLowerCase().includes(q) ||
        getLocationAddress(l.locationCode).toLowerCase().includes(q)
    );
  }, [search, availableLocations]);

  // Per-location qty selections
  const [locQtys, setLocQtys] = useState<Record<string, number>>({});
  const totalSelected = Object.values(locQtys).reduce((s, v) => s + v, 0);
  const isComplete = totalSelected >= allocQty;

  const setLocQty = (code: string, qty: number, maxAvailable: number) => {
    const currentForThis = locQtys[code] ?? 0;
    const usedElsewhere = totalSelected - currentForThis;
    const clamped = Math.max(0, Math.min(qty, Math.min(maxAvailable, allocQty - usedElsewhere)));
    setLocQtys((prev) => {
      const next = { ...prev };
      if (clamped === 0) delete next[code];
      else next[code] = clamped;
      return next;
    });
  };

  const allocateMax = (code: string, maxAvailable: number) => {
    const currentForThis = locQtys[code] ?? 0;
    const usedElsewhere = totalSelected - currentForThis;
    setLocQty(code, Math.min(maxAvailable, allocQty - usedElsewhere), maxAvailable);
  };

  // Sub-modal for selecting specific serial units at a location
  const [serialSubLoc, setSerialSubLoc] = useState<string | null>(null);

  // Track explicitly selected serial numbers across all locations
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const hasExplicitSerials = selectedSerials.length > 0;

  return (
    <UnitsSubModal open onClose={onClose} title="Select Units">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {/* Summary header */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/30 border border-border">
          <Package className="size-3.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <span
              className="text-foreground font-sans block"
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--font-weight-semibold)",
              }}
            >
              {hasExplicitSerials ? "Serial Allocation" : "Quantity Allocation"} — {allocQty} {lineItem.uom}
            </span>
            <span
              className="text-muted-foreground font-sans"
              style={{ fontSize: "var(--text-xs)" }}
            >
              {hasExplicitSerials
                ? `${selectedSerials.length} serial${selectedSerials.length !== 1 ? "s" : ""} selected — will upgrade to serial allocation`
                : "Choose locations and optionally select specific units"}
            </span>
          </div>
          <span
            className={cn(
              "font-sans shrink-0",
              isComplete
                ? "text-accent"
                : totalSelected > 0
                  ? "text-chart-3"
                  : "text-foreground/25"
            )}
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: "var(--font-weight-semibold)",
            }}
          >
            {totalSelected}/{allocQty} {lineItem.uom}
          </span>
        </div>

        {/* Progress bar — uses the shared allocBucket palette so the
            right-panel matches the line-item list colour rules. */}
        {(() => {
          const bucketHere = allocBucket(totalSelected, allocQty);
          const pctRaw = allocQty > 0 ? (totalSelected / allocQty) * 100 : 0;
          return (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${Math.min(100, pctRaw)}%`, backgroundColor: ALLOC_BAR_COLOR[bucketHere] }}
            />
          </div>
          <span
            className="font-sans shrink-0"
            style={{ color: ALLOC_TEXT_COLOR[bucketHere], fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
          >
            {allocQty > 0 ? Math.round((totalSelected / allocQty) * 100) : 0}%
          </span>
        </div>
          );
        })()}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search locations..."
            className="pl-9 h-9 rounded-lg font-sans border-border text-foreground placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-2"
            style={{ fontSize: 13, backgroundColor: "#FFFFFF" }}
          />
        </div>

        {/* Location list */}
        <div className="space-y-1.5">
          {filtered.map((loc) => {
            const available = loc.onHand - loc.alreadyAllocated;
            const locQty = locQtys[loc.locationCode] ?? 0;
            const hasAlloc = locQty > 0;
            return (
              <div
                key={loc.locationCode}
                className={cn(
                  "rounded-lg border overflow-hidden transition-colors",
                  hasAlloc ? "border-accent/20 bg-accent/[0.02]" : "border-border"
                )}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <LocationIcon selected={hasAlloc} size="sm" />
                  <div className="flex-1 min-w-0 flex flex-col leading-tight">
                    <span
                      className="text-foreground font-sans"
                      style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: "var(--font-weight-semibold)",
                      }}
                    >
                      <HighlightText text={loc.locationCode} search={search} />
                    </span>
                    <span
                      className="text-muted-foreground font-sans truncate"
                      style={{ fontSize: "var(--text-2xs)" }}
                    >
                      <HighlightText text={getLocationAddress(loc.locationCode)} search={search} />
                    </span>
                  </div>
                  <span
                    className="text-foreground font-sans shrink-0"
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--font-weight-semibold)",
                    }}
                  >
                    {available} avail
                  </span>
                  {/* Qty stepper */}
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <div className="inline-flex items-center border border-border rounded-md overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setLocQty(
                            loc.locationCode,
                            Math.max(0, locQty - 1),
                            available
                          )
                        }
                        disabled={locQty <= 0}
                        className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Minus className="size-2.5" />
                      </button>
                      <input
                        type="number"
                        value={locQty || ""}
                        placeholder="0"
                        onChange={(e) =>
                          setLocQty(
                            loc.locationCode,
                            parseInt(e.target.value) || 0,
                            available
                          )
                        }
                        className="w-9 h-6 text-center bg-background text-foreground font-sans outline-none border-x border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        style={{
                          fontSize: "var(--text-xs)",
                          fontWeight: "var(--font-weight-semibold)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLocQty(loc.locationCode, locQty + 1, available)
                        }
                        disabled={locQty >= available || totalSelected >= allocQty}
                        className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Plus className="size-2.5" />
                      </button>
                    </div>
                    <span className="text-foreground/25 font-sans" style={{ fontSize: "var(--text-3xs)" }}>max {Math.min(available, allocQty - totalSelected + locQty)}</span>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => allocateMax(loc.locationCode, available)}
                      disabled={
                        available <= 0 || totalSelected >= allocQty
                      }
                      className="whitespace-nowrap px-1.5 py-1 rounded-md border border-border bg-background text-foreground hover:bg-secondary/60 font-sans transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        fontSize: "var(--text-2xs)",
                        fontWeight: "var(--font-weight-medium)",
                      }}
                    >
                      Allocate max
                    </button>
                    {(isSerialized || isLotSerialized) && (
                      <button
                        onClick={() => setSerialSubLoc(loc.locationCode)}
                        disabled={available <= 0}
                        className="whitespace-nowrap px-1.5 py-1 rounded-md border border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:border-primary/30 font-sans transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                          fontSize: "var(--text-2xs)",
                          fontWeight: "var(--font-weight-medium)",
                        }}
                      >
                        Select Units
                      </button>
                    )}
                    {isLotNonSerialized && (
                      <button
                        onClick={() => setSerialSubLoc(loc.locationCode)}
                        disabled={available <= 0}
                        className="whitespace-nowrap px-1.5 py-1 rounded-md border border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:border-primary/30 font-sans transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                          fontSize: "var(--text-2xs)",
                          fontWeight: "var(--font-weight-medium)",
                        }}
                      >
                        View Units
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t border-border flex items-center justify-between">
        <span
          className="text-muted-foreground font-sans"
          style={{ fontSize: "var(--text-xs)" }}
        >
          {totalSelected === 0
            ? "Define quantities per location or select specific units"
            : hasExplicitSerials
              ? `${selectedSerials.length} serial${selectedSerials.length !== 1 ? "s" : ""} — will become serial allocation`
              : `${totalSelected} of ${allocQty} ${lineItem.uom} across ${Object.keys(locQtys).length} location${Object.keys(locQtys).length !== 1 ? "s" : ""} — location allocation`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border bg-white text-muted-foreground text-[13px] hover:bg-slate-50 transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (hasExplicitSerials && onConfirmAsSerial) {
                // User explicitly selected serial numbers — upgrade to serial allocation
                onConfirmAsSerial(selectedSerials);
              } else if (onConfirm) {
                const selectedLocs = Object.entries(locQtys).filter(([, q]) => q > 0).map(([loc]) => loc);
                onConfirm({ locations: selectedLocs, totalQty: totalSelected });
              }
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#0862D0] transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            {totalSelected > 0 ? (hasExplicitSerials ? "Confirm as Serial Allocation" : "Confirm Selection") : "Done"}
          </button>
        </div>
      </div>

      {/* Nested sub-modal: Select specific serials at a location */}
      {serialSubLoc && (isSerialized || isLotSerialized) && (
        <AssignUnitsSubModal
          lineItem={lineItem}
          locationCode={serialSubLoc}
          allocQty={
            locQtys[serialSubLoc] ||
            Math.min(
              (locations.find((l) => l.locationCode === serialSubLoc)?.onHand ?? 1) -
                (locations.find((l) => l.locationCode === serialSubLoc)?.alreadyAllocated ?? 0),
              Math.max(1, allocQty - totalSelected + (locQtys[serialSubLoc] ?? 0))
            )
          }
          onClose={() => setSerialSubLoc(null)}
          onConfirm={(selectedCount) => {
            if (selectedCount > 0) {
              const maxAvail =
                (locations.find((l) => l.locationCode === serialSubLoc)?.onHand ?? 0) -
                (locations.find((l) => l.locationCode === serialSubLoc)?.alreadyAllocated ?? 0);
              setLocQty(serialSubLoc!, selectedCount, maxAvail);
            }
          }}
          onConfirmWithSerials={(serials) => {
            if (serials.length > 0) {
              // Track selected serial numbers for serial upgrade
              setSelectedSerials((prev) => [...prev.filter((s) => !serials.includes(s)), ...serials]);
              const maxAvail =
                (locations.find((l) => l.locationCode === serialSubLoc)?.onHand ?? 0) -
                (locations.find((l) => l.locationCode === serialSubLoc)?.alreadyAllocated ?? 0);
              setLocQty(serialSubLoc!, serials.length, maxAvail);
            }
          }}
        />
      )}

      {/* Nested sub-modal: View lots at a location for lot types */}
      {serialSubLoc && isLotNonSerialized && (
        <LocationLotsSubModal
          lineItem={lineItem}
          locationCode={serialSubLoc}
          allocQty={
            locQtys[serialSubLoc] ||
            Math.min(
              (locations.find((l) => l.locationCode === serialSubLoc)?.onHand ?? 1) -
                (locations.find((l) => l.locationCode === serialSubLoc)?.alreadyAllocated ?? 0),
              Math.max(1, allocQty - totalSelected + (locQtys[serialSubLoc] ?? 0))
            )
          }
          onClose={(confirmedQty) => {
            if (confirmedQty !== undefined && confirmedQty > 0) {
              const maxAvail =
                (locations.find((l) => l.locationCode === serialSubLoc)?.onHand ?? 0) -
                (locations.find((l) => l.locationCode === serialSubLoc)?.alreadyAllocated ?? 0);
              setLocQty(serialSubLoc!, confirmedQty, maxAvail);
            }
            setSerialSubLoc(null);
          }}
        />
      )}
    </UnitsSubModal>
  );
}

function ExistingAllocDisplay({
  lineItem,
  removals,
  onToggleRemoval,
  onUndoAllRemovals,
  newAllocated,
  specificity,
  allocQtys,
  lotSelections,
  selectedSerials,
  qtyOnlyValue,
}: {
  lineItem: LineItem;
  removals: Set<string>;
  onToggleRemoval: (key: string) => void;
  onUndoAllRemovals: () => void;
  newAllocated?: number;
  specificity?: SpecificityLevel;
  allocQtys?: Record<string, number>;
  lotSelections?: Record<string, number>;
  selectedSerials?: Set<string>;
  qtyOnlyValue?: number;
}) {
  const allocations = useMemo(() => generateExistingAllocations(lineItem), [lineItem]);
  const [viewingLocation, setViewingLocation] = useState<ExistingAllocLocation | null>(null);
  const [viewingAllocIdx, setViewingAllocIdx] = useState<number>(-1);
  // Track which allocations have been "confirmed" via Select Units/Lots — changes button to "View Units"/"View Lots"
  const [confirmedAllocs, setConfirmedAllocs] = useState<Set<number>>(new Set());
  // Store refinement details per allocation index — used to update the card and show in View Units
  const [allocRefinements, setAllocRefinements] = useState<Map<number, { type: 'locations' | 'serials' | 'lots'; locations?: string[]; serials?: string[]; lots?: string[]; totalQty: number; summary: string }>>(new Map());
  // For lot-only cards → lot locations sub-modal
  const [viewingLotAlloc, setViewingLotAlloc] = useState<{ lotNumber: string; allocIdx: number; allocQty: number } | null>(null);
  const lotLocationsData = useMemo(() => {
    if (!viewingLotAlloc) return [];
    return generateLocationsForAllocatedLot(lineItem, viewingLotAlloc.lotNumber, viewingLotAlloc.allocQty);
  }, [viewingLotAlloc, lineItem]);
  // Local lot selection state for lot-only card sub-modal
  const [lotAllocSelections, setLotAllocSelections] = useState<Record<string, number>>({});
  // Serial selection state for lot_serialized items in the lot locations sub-modal
  const [lotAllocSerials, setLotAllocSerials] = useState<Set<string>>(new Set());
  const toggleLotAllocLot = (key: string, available: number) => {
    setLotAllocSelections((prev) => {
      const next = { ...prev };
      if (key in next) delete next[key]; else next[key] = Math.min(available, 1);
      return next;
    });
  };
  const changeLotAllocQty = (key: string, qty: number, max: number) => {
    setLotAllocSelections((prev) => ({ ...prev, [key]: Math.max(0, Math.min(qty, max)) }));
  };
  const toggleLotAllocSerial = (sn: string, _locationCode: string) => {
    setLotAllocSerials((prev) => {
      const next = new Set(prev);
      if (next.has(sn)) next.delete(sn); else next.add(sn);
      return next;
    });
  };
  // For qty-only cards → location browser sub-modal
  const [viewingQtyOnlyAlloc, setViewingQtyOnlyAlloc] = useState<{ allocIdx: number; allocQty: number } | null>(null);

  const openAllocSubModal = (alloc: ExistingAllocLocation, idx: number) => {
    // For qty-only cards, open the location browser
    if (alloc.allocationType === "qty_only") {
      setViewingQtyOnlyAlloc({ allocIdx: idx, allocQty: alloc.qty });
      return;
    }
    // For lot-only cards, open the lot locations view
    if (!alloc.code && alloc.lotNumber) {
      setLotAllocSelections({});
      setLotAllocSerials(new Set());
      setViewingLotAlloc({ lotNumber: alloc.lotNumber, allocIdx: idx, allocQty: alloc.qty });
      return;
    }
    setViewingLocation(alloc);
    setViewingAllocIdx(idx);
  };
  const handleAssignConfirm = (refinement?: { type: 'locations' | 'serials' | 'lots'; locations?: string[]; serials?: string[]; lots?: string[]; totalQty: number; summary: string }) => {
    if (viewingAllocIdx >= 0) {
      setConfirmedAllocs((prev) => { const next = new Set(prev); next.add(viewingAllocIdx); return next; });
      if (refinement) {
        setAllocRefinements((prev) => { const next = new Map(prev); next.set(viewingAllocIdx, refinement); return next; });
      }
    }
    setViewingLocation(null);
    setViewingAllocIdx(-1);
  };

  // Build shipment allocation cards from pending inventory selections
  const shipmentCards = useMemo(() => {
    if (!newAllocated || newAllocated === 0 || !specificity) return [];
    const cards: { key: string; icon: "location" | "lot" | "serial" | "qty"; label: string; sublabel: string; qty: number; specificity: string }[] = [];
    if (specificity === "qty_only" && (qtyOnlyValue ?? 0) > 0) {
      cards.push({ key: "qty-only", icon: "qty", label: `${qtyOnlyValue} ${lineItem.uom}`, sublabel: "Quantity only · any available stock", qty: qtyOnlyValue!, specificity: "Qty Only" });
    } else if (specificity === "location" && allocQtys) {
      Object.entries(allocQtys).forEach(([loc, qty]) => {
        if (qty > 0) cards.push({ key: `loc-${loc}`, icon: "location", label: loc, sublabel: getLocationAddress(loc), qty, specificity: "Location" });
      });
    } else if (specificity === "lot" && lotSelections) {
      Object.entries(lotSelections).forEach(([key, qty]) => {
        if (qty > 0) {
          const [locCode, lotNumber] = key.split("::");
          cards.push({ key: `lot-${key}`, icon: "lot", label: lotNumber || locCode, sublabel: lotNumber ? `at ${locCode}` : "Lot allocation", qty, specificity: "Lot" });
        }
      });
    } else if (specificity === "serial" && selectedSerials && selectedSerials.size > 0) {
      cards.push({ key: "serials", icon: "serial", label: `${selectedSerials.size} serial units`, sublabel: "Exact serial numbers selected", qty: selectedSerials.size, specificity: "Serial" });
    }
    return cards;
  }, [newAllocated, specificity, qtyOnlyValue, allocQtys, lotSelections, selectedSerials, lineItem.uom]);

  const hasShipmentAllocs = shipmentCards.length > 0;
  const hasNoContent = allocations.length === 0 && !hasShipmentAllocs;

  if (hasNoContent) {
    return (
      <div className="px-4 py-4 flex flex-col items-center gap-1.5">
        <BoxSelect className="size-5 text-muted-foreground/70" />
        <span className="text-foreground font-sans" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>No allocation made</span>
        <span className="text-muted-foreground font-sans text-center max-w-[260px]" style={{ fontSize: "var(--text-xs)", lineHeight: "1.5", fontWeight: 400 }}>
          Use the inventory section below to allocate quantity or pick specific locations.
        </span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {/* Undo all at top if any removals */}
      {removals.size > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-chart-1/[0.06] border border-chart-1/15 mb-1">
          <div className="flex items-center gap-2">
            <Undo2 className="size-3 text-chart-1" />
            <span className="text-chart-1 font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}>
              {removals.size} {lineItem.uom} marked for un-allocation
            </span>
          </div>
          <button
            onClick={onUndoAllRemovals}
            className="text-chart-1 hover:text-chart-1/80 font-sans transition-colors cursor-pointer"
            style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}
          >
            Undo All
          </button>
        </div>
      )}

      {/* ── Sales Order Allocations sub-section ── */}
      {allocations.length > 0 && (() => {
        const qtyOnlyCount = allocations.filter((a) => a.allocationType === "qty_only").length;
        const locCount = allocations.filter((a) => a.allocationType === "location_qty").length;
        const serialCount = allocations.filter((a) => a.allocationType === "location_serial").length;
        const typeParts: string[] = [];
        if (qtyOnlyCount > 0) typeParts.push(`${qtyOnlyCount} qty-only`);
        if (locCount > 0) typeParts.push(`${locCount} location`);
        if (serialCount > 0) typeParts.push(`${serialCount} serial`);
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 px-0.5">
              <ClipboardList className="size-3 text-foreground/25" />
              <span className="font-sans" style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>Sales order allocations</span>
              <span className="text-foreground/20 font-sans" style={{ fontSize: "var(--text-2xs)" }}>({allocations.reduce((s, a) => s + a.qty, 0)} {lineItem.uom})</span>
            </div>
            {typeParts.length > 0 && (
              <div className="flex items-center gap-1 px-0.5 flex-wrap">
                {typeParts.map((tp) => (
                  <span key={tp} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-secondary border border-border/60 text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>
                    {tp}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* SO Allocation cards */}
      {allocations.map((alloc, allocIdx) => {
        const isQtyOnly = alloc.allocationType === "qty_only";
        const isLotCard = !isQtyOnly && !alloc.code && !!alloc.lotNumber;
        const allocKey = isQtyOnly ? `qty-${allocIdx}` : isLotCard ? `lot-${alloc.lotNumber}` : (alloc.code ?? `loc-${allocIdx}`);
        const hasSerials = !!alloc.serials && alloc.serials.length > 0;
        const unitKeys = isQtyOnly
          ? [`qty-only-${allocIdx}`]
          : alloc.serials
            ? alloc.serials.map((sn) => `${alloc.code ?? alloc.lotNumber}::${sn}`)
            : alloc.lotNumber
              ? [`${alloc.code ?? alloc.lotNumber}::${alloc.lotNumber}`]
              : alloc.code
                ? [`${alloc.code}::location`]
                : [];
        const removedCount = unitKeys.filter((k) => removals.has(k)).length;
        const isPendingRemoval = removedCount > 0 && removedCount === unitKeys.length;
        const hasPartialRemovals = removedCount > 0 && removedCount < unitKeys.length;
        const refinement = allocRefinements.get(allocIdx);

        return (
          <div key={allocKey}>
            <div className={cn("border rounded-lg overflow-hidden transition-colors", isPendingRemoval ? "border-chart-3/30 bg-chart-3/[0.02]" : isQtyOnly ? "border-chart-3/20 bg-chart-3/[0.01]" : "border-border")}>
              <div className="flex items-center gap-2 px-3 py-1.5">
                {isQtyOnly ? (
                  <div className="shrink-0 size-5 rounded-md flex items-center justify-center bg-chart-3/10">
                    <Package className="size-3 text-chart-3" />
                  </div>
                ) : isLotCard ? (
                  <div className="shrink-0 size-5 rounded-md flex items-center justify-center bg-primary/10">
                    <Layers className="size-3 text-primary" />
                  </div>
                ) : (
                  <LocationIcon variant="primary" size="sm" />
                )}
                <div className="flex-1 min-w-0 flex flex-col leading-tight">
                  {isQtyOnly ? (
                    <>
                      <span className={cn("font-sans", isPendingRemoval ? "text-muted-foreground" : "text-foreground")} style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>{alloc.qty} {lineItem.uom} — Quantity Allocation</span>
                      <span className={cn("font-sans", refinement ? "text-primary/50" : "text-muted-foreground")} style={{ fontSize: "var(--text-2xs)" }}>
                        {refinement ? refinement.summary : "Any available location · warehouse picks at pick time"}
                      </span>
                    </>
                  ) : isLotCard ? (
                    <>
                      <span className={cn("font-sans", isPendingRemoval ? "text-muted-foreground" : "text-foreground")} style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>{alloc.lotNumber}</span>
                      <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)" }}>Lot allocation · across locations</span>
                    </>
                  ) : (
                    <>
                      <span className={cn("font-sans", isPendingRemoval ? "text-muted-foreground" : "text-foreground")} style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>{alloc.code}</span>
                      <span className={cn("font-sans", refinement ? "text-primary/50" : "text-muted-foreground")} style={{ fontSize: "var(--text-2xs)" }}>
                        {refinement ? refinement.summary : getLocationAddress(alloc.code!)}
                      </span>
                    </>
                  )}
                </div>
                <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-sans shrink-0", refinement ? "bg-primary/10 border-primary/20 text-primary" : "bg-secondary border-border text-foreground/60")} style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>
                  {refinement ? (refinement.type === 'serials' ? 'Serial' : refinement.type === 'lots' ? 'Lot' : 'Location') : alloc.specificity}
                </span>
                <Badge variant="secondary" className={cn("font-sans shrink-0", isPendingRemoval && "line-through opacity-50")} style={{ fontSize: "var(--text-2xs)" }}>{alloc.qty} {lineItem.uom}</Badge>
                {isPendingRemoval && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-chart-3/10 border border-chart-3/20 font-sans text-chart-3 shrink-0" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>
                    Pending Removal
                  </span>
                )}
                {hasPartialRemovals && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-chart-3/10 border border-chart-3/20 font-sans text-chart-3 shrink-0" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>
                    {removedCount} Removing
                  </span>
                )}
                {/* Undo removal on card — only shown when fully pending removal */}
                {isPendingRemoval && (
                  <button
                    onClick={() => unitKeys.forEach((k) => { if (removals.has(k)) onToggleRemoval(k); })}
                    className="px-2 py-1 rounded-md border border-chart-1/20 text-chart-1 hover:bg-chart-1/[0.04] font-sans transition-all cursor-pointer shrink-0"
                    style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
                  >
                    Undo
                  </button>
                )}
                {/* View Units / Select Units buttons */}
                {!isPendingRemoval && (isQtyOnly ? (
                  confirmedAllocs.has(allocIdx) ? (
                    <button
                      onClick={() => openAllocSubModal(alloc, allocIdx)}
                      className="px-2 py-1 rounded-md border border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:border-primary/30 font-sans transition-all cursor-pointer shrink-0"
                      style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
                    >
                      View Units
                    </button>
                  ) : (
                    <button
                      onClick={() => openAllocSubModal(alloc, allocIdx)}
                      className="px-2 py-1 rounded-md border border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:border-primary/30 font-sans transition-all cursor-pointer shrink-0"
                      style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
                    >
                      Select Units
                    </button>
                  )
                ) : hasSerials ? (
                  <button
                    onClick={() => openAllocSubModal(alloc, allocIdx)}
                    className="px-2 py-1 rounded-md border border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:border-primary/30 font-sans transition-all cursor-pointer shrink-0"
                    style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
                  >
                    View Units
                  </button>
                ) : confirmedAllocs.has(allocIdx) ? (
                  <button
                    onClick={() => openAllocSubModal(alloc, allocIdx)}
                    className="px-2 py-1 rounded-md border border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:border-primary/30 font-sans transition-all cursor-pointer shrink-0"
                    style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
                  >
                    View Units
                  </button>
                ) : (
                  <button
                    onClick={() => openAllocSubModal(alloc, allocIdx)}
                    className="px-2 py-1 rounded-md border border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:border-primary/30 font-sans transition-all cursor-pointer shrink-0"
                    style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
                  >
                    Select Units
                  </button>
                ))}
              </div>
              {/* Refinement summary — shown when allocation has been refined at shipment level */}
              {refinement && confirmedAllocs.has(allocIdx) && !isPendingRemoval && (
                <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border/60 bg-primary/[0.02]">
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-sans shrink-0"
                    style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
                  >
                    Shipment
                  </span>
                  <span className="text-foreground/50 font-sans truncate" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>
                    {refinement.summary}
                  </span>
                  {refinement.locations && refinement.locations.length > 0 && (
                    <div className="flex items-center gap-1 ml-auto shrink-0">
                      {refinement.locations.slice(0, 3).map((loc) => (
                        <span key={loc} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-secondary border border-border/60 text-muted-foreground font-mono truncate" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)", maxWidth: "80px" }}>
                          {loc}
                        </span>
                      ))}
                      {refinement.locations.length > 3 && (
                        <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)" }}>+{refinement.locations.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Shipment Allocations sub-section — only visible when user has made allocations ── */}
      {hasShipmentAllocs && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 px-0.5">
            <Package className="size-3 text-primary/50" />
            <span className="font-sans" style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)" }}>Shipment allocations</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>+{newAllocated} {lineItem.uom}</span>
          </div>
          {shipmentCards.map((card) => (
            <div key={card.key} className="border border-primary/15 bg-primary/[0.02] rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5">
                {card.icon === "location" ? (
                  <LocationIcon variant="primary" size="sm" />
                ) : card.icon === "lot" ? (
                  <div className="shrink-0 size-5 rounded-md flex items-center justify-center bg-primary/10"><Layers className="size-2.5 text-primary" /></div>
                ) : card.icon === "serial" ? (
                  <div className="shrink-0 size-5 rounded-md flex items-center justify-center bg-primary/10"><Hash className="size-2.5 text-primary" /></div>
                ) : (
                  <div className="shrink-0 size-5 rounded-md flex items-center justify-center bg-primary/10"><Package className="size-2.5 text-primary" /></div>
                )}
                <div className="flex-1 min-w-0 flex flex-col leading-tight">
                  <span className="text-foreground font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}>{card.label}</span>
                  <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)" }}>{card.sublabel}</span>
                </div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-sans shrink-0 bg-secondary border-border text-foreground/60" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>
                  {card.specificity}
                </span>
                <Badge variant="secondary" className="font-sans shrink-0" style={{ fontSize: "var(--text-2xs)" }}>{card.qty} {lineItem.uom}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sub-modal for viewing serial units — with per-unit un-allocate */}
      {viewingLocation && viewingLocation.serials && (() => {
        const locPrefix = viewingLocation.code ?? viewingLocation.lotNumber;
        const serialKeys = viewingLocation.serials!.map((sn) => `${locPrefix}::${sn}`);
        const removedInView = serialKeys.filter((k) => removals.has(k)).length;
        const allRemovedInView = removedInView === serialKeys.length;

        return (
          <UnitsSubModal
            open
            onClose={() => { setViewingLocation(null); setViewingAllocIdx(-1); }}
            locationCode={locPrefix}
            title="View Allocated Units"
          >
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {/* Shipment refinement banner — shown when this allocation was refined at shipment level */}
              {confirmedAllocs.has(viewingAllocIdx) && allocRefinements.has(viewingAllocIdx) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/[0.04] border border-primary/15">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-sans shrink-0" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>Shipment</span>
                  <span className="text-foreground/50 font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}>
                    {allocRefinements.get(viewingAllocIdx)!.summary}
                  </span>
                </div>
              )}

              {/* Lot header for lot_serialized */}
              {viewingLocation.lotNumber && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/30 border border-border">
                  <Layers className="size-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground font-sans block" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>{viewingLocation.lotNumber}</span>
                    <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>{viewingLocation.qty} {lineItem.uom} · {viewingLocation.serials!.length} serial numbers</span>
                  </div>
                </div>
              )}

              {/* Removal summary banner */}
              {removedInView > 0 && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-chart-1/[0.06] border border-chart-1/15">
                  <div className="flex items-center gap-2">
                    <Undo2 className="size-3 text-chart-1" />
                    <span className="text-chart-1 font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}>
                      {removedInView} of {serialKeys.length} {lineItem.uom} marked for un-allocation
                    </span>
                  </div>
                  <button
                    onClick={() => serialKeys.forEach((k) => { if (removals.has(k)) onToggleRemoval(k); })}
                    className="text-chart-1 hover:text-chart-1/80 font-sans transition-colors cursor-pointer"
                    style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}
                  >
                    Undo All
                  </button>
                </div>
              )}

              {/* Serial units grid — with per-unit un-allocate */}
              <div className="grid grid-cols-2 gap-1.5">
                {viewingLocation.serials!.map((sn) => {
                  const unitKey = `${locPrefix}::${sn}`;
                  const isMarked = removals.has(unitKey);
                  return (
                    <div key={sn} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border transition-[border-color,background-color,box-shadow,color] duration-300 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1", isMarked ? "border-chart-3/30 bg-chart-3/[0.03]" : "border-border")}>
                      <Hash className={cn("size-3 shrink-0", isMarked ? "text-chart-3/40" : "text-muted-foreground")} />
                      <span className={cn("flex-1 font-sans truncate", isMarked ? "text-muted-foreground line-through" : "text-foreground")} style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-medium)" }}>{sn}</span>
                      {isMarked ? (
                        <button
                          onClick={() => onToggleRemoval(unitKey)}
                          className="shrink-0 px-1.5 py-0.5 rounded-md border border-chart-1/20 text-chart-1 hover:bg-chart-1/[0.06] font-sans transition-all cursor-pointer"
                          style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => onToggleRemoval(unitKey)}
                          className="shrink-0 px-1.5 py-0.5 rounded-md border border-destructive/15 text-destructive/50 hover:text-destructive hover:border-destructive/30 hover:bg-destructive/[0.04] font-sans transition-all cursor-pointer"
                          style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
                        >
                          Un-allocate
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Footer */}
            <div className="shrink-0 px-5 py-3 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!allRemovedInView && (
                  <button
                    onClick={() => serialKeys.forEach((k) => { if (!removals.has(k)) onToggleRemoval(k); })}
                    className="px-3 py-1.5 rounded-lg border border-destructive/20 text-destructive/60 hover:text-destructive hover:border-destructive/35 hover:bg-destructive/[0.04] font-sans transition-all cursor-pointer"
                    style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}
                  >
                    Un-allocate All
                  </button>
                )}
                {allRemovedInView && (
                  <button
                    onClick={() => serialKeys.forEach((k) => { if (removals.has(k)) onToggleRemoval(k); })}
                    className="px-3 py-1.5 rounded-lg border border-chart-1/20 text-chart-1 hover:bg-chart-1/[0.06] font-sans transition-all cursor-pointer"
                    style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}
                  >
                    Undo All
                  </button>
                )}
              </div>
              <button onClick={() => { setViewingLocation(null); setViewingAllocIdx(-1); }} className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#0862D0] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                Done
              </button>
            </div>
          </UnitsSubModal>
        );
      })()}

      {/* Sub-modal for Select/View Units — serialized items without pre-assigned serials (location-based only) */}
      {viewingLocation && viewingLocation.code && !viewingLocation.serials && (lineItem.inventoryType === "sterilized" || lineItem.inventoryType === "lot_serialized") && (
        <AssignUnitsSubModal
          lineItem={lineItem}
          locationCode={viewingLocation.code}
          allocQty={viewingLocation.qty}
          onClose={() => handleAssignConfirm()}
          onConfirm={(selectedCount) => {
            handleAssignConfirm({
              type: 'serials',
              locations: [viewingLocation.code!],
              totalQty: selectedCount,
              summary: `${selectedCount} serial unit${selectedCount !== 1 ? 's' : ''} at ${viewingLocation.code}`,
            });
          }}
        />
      )}

      {/* Sub-modal for Select/View Lots — lot_non_serialized items (location-based only) */}
      {viewingLocation && viewingLocation.code && !viewingLocation.serials && lineItem.inventoryType === "lot_non_serialized" && (
        <AssignLotsSubModal
          lineItem={lineItem}
          locationCode={viewingLocation.code}
          allocQty={viewingLocation.qty}
          onClose={() => handleAssignConfirm()}
          onConfirm={(data) => {
            handleAssignConfirm({
              type: 'lots',
              locations: [viewingLocation.code!],
              lots: data.lots,
              totalQty: data.totalQty,
              summary: `${data.totalQty} ${lineItem.uom} across ${data.lots.length} lot${data.lots.length !== 1 ? 's' : ''} at ${viewingLocation.code}`,
            });
          }}
        />
      )}

      {/* Sub-modal for qty-only allocation cards — location browser */}
      {viewingQtyOnlyAlloc && (
        <QtyAllocLocationBrowser
          lineItem={lineItem}
          allocQty={viewingQtyOnlyAlloc.allocQty}
          onClose={() => setViewingQtyOnlyAlloc(null)}
          onConfirm={(data) => {
            const idx = viewingQtyOnlyAlloc.allocIdx;
            setConfirmedAllocs((prev) => { const next = new Set(prev); next.add(idx); return next; });
            if (data.locations.length > 0) {
              setAllocRefinements((prev) => {
                const next = new Map(prev);
                next.set(idx, {
                  type: 'locations',
                  locations: data.locations,
                  totalQty: data.totalQty,
                  summary: `${data.totalQty} ${lineItem.uom} across ${data.locations.length} location${data.locations.length !== 1 ? 's' : ''}`,
                });
                return next;
              });
            }
          }}
          onConfirmAsSerial={(serials) => {
            const idx = viewingQtyOnlyAlloc.allocIdx;
            setConfirmedAllocs((prev) => { const next = new Set(prev); next.add(idx); return next; });
            setAllocRefinements((prev) => {
              const next = new Map(prev);
              next.set(idx, {
                type: 'serials',
                serials,
                totalQty: serials.length,
                summary: `${serials.length} serial${serials.length !== 1 ? 's' : ''} selected — serial allocation`,
              });
              return next;
            });
          }}
        />
      )}

      {/* Sub-modal for lot-only allocation cards — shows locations for that lot */}
      {viewingLotAlloc && (() => {
        const isSerializedLot = lineItem.inventoryType === "lot_serialized";
        const totalSelected = isSerializedLot ? lotAllocSerials.size : Object.values(lotAllocSelections).reduce((s, v) => s + v, 0);
        const allocQty = viewingLotAlloc.allocQty;
        const isComplete = totalSelected >= allocQty;
        return (
          <UnitsSubModal
            open
            onClose={() => { setViewingLotAlloc(null); }}
            title={`Select Units — ${viewingLotAlloc.lotNumber}`}
          >
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {/* Summary header with allocation context */}
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/30 border border-border">
                <Layers className="size-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-foreground font-sans block" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>{viewingLotAlloc.lotNumber}</span>
                  <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
                    {allocQty} {lineItem.uom} allocated · {lotLocationsData.length} location{lotLocationsData.length !== 1 ? "s" : ""} available
                  </span>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className={cn("font-sans", isComplete ? "text-accent" : totalSelected > 0 ? "text-chart-3" : "text-foreground/25")} style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}>
                    {totalSelected}/{allocQty} {lineItem.uom}
                  </span>
                </div>
              </div>

              {/* Progress bar — shared allocBucket palette */}
              {(() => {
                const bucketLot = allocBucket(totalSelected, allocQty);
                const pctRawLot = allocQty > 0 ? (totalSelected / allocQty) * 100 : 0;
                return (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full transition-all duration-300" style={{ width: `${Math.min(100, pctRawLot)}%`, backgroundColor: ALLOC_BAR_COLOR[bucketLot] }} />
                </div>
                <span className="font-sans shrink-0" style={{ color: ALLOC_TEXT_COLOR[bucketLot], fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>
                  {allocQty > 0 ? Math.round((totalSelected / allocQty) * 100) : 0}%
                </span>
              </div>
                );
              })()}

              {/* Locations list */}
              <LotLocationsView
                lineItem={lineItem}
                viewingLot={viewingLotAlloc.lotNumber}
                viewingLocations={lotLocationsData}
                lotSelections={lotAllocSelections}
                totalNewlyAllocated={totalSelected}
                remaining={allocQty}
                onToggleLot={toggleLotAllocLot}
                onLotQtyChange={changeLotAllocQty}
                selectedSerials={isSerializedLot ? lotAllocSerials : undefined}
                onToggleSerial={isSerializedLot ? toggleLotAllocSerial : undefined}
              />
            </div>
            {/* Footer */}
            <div className="shrink-0 px-5 py-3 border-t border-border flex items-center justify-between">
              <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
                {isSerializedLot ? "Expand locations to select serial units" : "Set pick quantities per location"}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => { setViewingLotAlloc(null); }} className="px-4 py-2 rounded-lg border border-border bg-white text-muted-foreground text-[13px] hover:bg-slate-50 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>Cancel</button>
                <button onClick={() => {
                  setConfirmedAllocs((prev) => { const next = new Set(prev); next.add(viewingLotAlloc.allocIdx); return next; });
                  setViewingLotAlloc(null);
                }} className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#0862D0] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                  Done
                </button>
              </div>
            </div>
          </UnitsSubModal>
        );
      })()}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Select Units Sub-Modal — pick serial numbers at a location
   For sterilized: flat list of serials at the location.
   For lot_serialized: lots grouped with expandable serial numbers.
   ═══════════════════════════════════════════════════════ */

function AssignUnitsSubModal({ lineItem, locationCode, allocQty, onClose, onConfirm, onConfirmWithSerials }: {
  lineItem: LineItem; locationCode: string; allocQty: number; onClose: () => void; onConfirm?: (selectedCount: number) => void; onConfirmWithSerials?: (serials: string[]) => void;
}) {
  const isLotSerialized = lineItem.inventoryType === "lot_serialized";

  /* ── Sterilized: flat serial list at this location ── */
  const flatSerials = useMemo(() => {
    if (isLotSerialized) return [];
    return generateSerialsAtLocation(lineItem, locationCode, allocQty);
  }, [lineItem, locationCode, allocQty, isLotSerialized]);

  /* ── Lot Serialized: lots with serials at this location ── */
  const lotsWithSerials = useMemo(() => {
    if (!isLotSerialized) return [];
    return generateLotsWithSerialsAtLocation(lineItem, locationCode, allocQty);
  }, [lineItem, locationCode, allocQty, isLotSerialized]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedLots, setExpandedLots] = useState<Set<string>>(() => new Set(lotsWithSerials.map((l) => l.lotNumber)));

  const toggleSerial = (sn: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sn)) next.delete(sn); else next.add(sn);
      return next;
    });
  };

  const toggleLotExpand = (lotNumber: string) => {
    setExpandedLots((prev) => {
      const next = new Set(prev);
      if (next.has(lotNumber)) next.delete(lotNumber); else next.add(lotNumber);
      return next;
    });
  };

  const totalSerials = isLotSerialized
    ? lotsWithSerials.reduce((s, l) => s + l.serialNumbers.length, 0)
    : flatSerials.length;

  return (
    <UnitsSubModal open onClose={onClose} locationCode={locationCode} title="Select Units">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}>
            {totalSerials} serial{totalSerials !== 1 ? "s" : ""} available at {locationCode}
            {isLotSerialized && ` · ${lotsWithSerials.length} lot${lotsWithSerials.length !== 1 ? "s" : ""}`}
          </span>
          {selected.size > 0 && (
            <span className="text-primary font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}>
              {selected.size} / {allocQty} selected
            </span>
          )}
        </div>

        {/* ── Sterilized: flat serial grid ── */}
        {!isLotSerialized && (
          <div className="grid grid-cols-2 gap-1.5">
            {flatSerials.map((sn) => {
              const isSelected = selected.has(sn);
              const isDisabled = !isSelected && selected.size >= allocQty;
              return (
                <label
                  key={sn}
                  className={cn(
                    // Partner v7 selected-row chrome: primary border + light
                    // primary tint background + primary text. Disabled (at
                    // limit) rows use a muted background instead of a heavy
                    // opacity reduction so they remain legible.
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-[border-color,background-color,box-shadow,color] duration-300 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
                    isSelected
                      ? "border-primary bg-primary/[0.06] text-primary cursor-pointer"
                      : isDisabled
                        ? "border-border bg-secondary/40 text-foreground/40 cursor-not-allowed"
                        : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-[0_0_0_1px_rgba(10,119,255,0.10)] cursor-pointer",
                  )}
                >
                  <Checkbox checked={isSelected} onCheckedChange={() => !isDisabled && toggleSerial(sn)} disabled={isDisabled} className="shrink-0" />
                  <Hash className={cn("size-3 shrink-0", isSelected ? "text-primary" : "text-foreground/35")} />
                  <span className={cn("flex-1 font-sans truncate", isSelected ? "text-primary" : "text-foreground/75")} style={{ fontSize: "var(--text-sm)", fontWeight: isSelected ? "var(--font-weight-semibold)" : "var(--font-weight-medium)" }}>
                    {sn}
                  </span>
                  {isSelected && <Check className="size-3 text-primary shrink-0" />}
                </label>
              );
            })}
          </div>
        )}

        {/* ── Lot Serialized: grouped lots with expandable serials ── */}
        {isLotSerialized && (
          <div className="space-y-2">
            {lotsWithSerials.map((lot) => {
              const isExpanded = expandedLots.has(lot.lotNumber);
              const selectedInLot = lot.serialNumbers.filter((sn) => selected.has(sn)).length;
              return (
                <div key={lot.lotNumber} className="border border-border rounded-lg overflow-hidden">
                  {/* Lot header — click to expand/collapse */}
                  <button
                    onClick={() => toggleLotExpand(lot.lotNumber)}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    {isExpanded ? <ChevronDown className="size-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />}
                    <Layers className={cn("size-3.5 shrink-0", selectedInLot > 0 ? "text-primary/60" : "text-muted-foreground")} />
                    <div className="flex-1 min-w-0 text-left">
                      <span className="text-foreground font-sans block" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>{lot.lotNumber}</span>
                      <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
                        {lot.serialNumbers.length} serial{lot.serialNumbers.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {selectedInLot > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-sans shrink-0" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>
                        {selectedInLot} selected
                      </span>
                    )}
                  </button>
                  {/* Expanded serial list */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-border bg-secondary/20">
                      <div className="grid grid-cols-2 gap-1.5">
                        {lot.serialNumbers.map((sn) => {
                          const isSelected = selected.has(sn);
                          const isDisabled = !isSelected && selected.size >= allocQty;
                          return (
                            <label
                              key={sn}
                              className={cn(
                                "flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/[0.06] text-primary cursor-pointer"
                                  : isDisabled
                                    ? "border-border bg-secondary/40 text-foreground/40 cursor-not-allowed"
                                    : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-[0_0_0_1px_rgba(10,119,255,0.10)] cursor-pointer",
                              )}
                            >
                              <Checkbox checked={isSelected} onCheckedChange={() => !isDisabled && toggleSerial(sn)} disabled={isDisabled} className="shrink-0" />
                              <Hash className={cn("size-3 shrink-0", isSelected ? "text-primary" : "text-foreground/35")} />
                              <span className={cn("flex-1 font-sans truncate", isSelected ? "text-primary" : "text-foreground/75")} style={{ fontSize: "var(--text-sm)", fontWeight: isSelected ? "var(--font-weight-semibold)" : "var(--font-weight-medium)" }}>
                                {sn}
                              </span>
                              {isSelected && <Check className="size-3 text-primary shrink-0" />}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="shrink-0 px-5 py-3 border-t border-border flex items-center justify-between">
        <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
          {selected.size === 0 ? "Select serial numbers" : `${selected.size} of ${allocQty} selected`}
        </span>
        <button onClick={() => { if (selected.size > 0) { if (onConfirmWithSerials) onConfirmWithSerials(Array.from(selected)); else if (onConfirm) onConfirm(selected.size); } onClose(); }} className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#0862D0] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
          {selected.size > 0 ? "Confirm Selection" : "Done"}
        </button>
      </div>
    </UnitsSubModal>
  );
}

/* ═══════════════════════════════════════════════════════
   Select Lots Sub-Modal — pick lot numbers at a location
   ═══════════════════════════════════════════════════════ */

function AssignLotsSubModal({ lineItem, locationCode, allocQty, onClose, onConfirm }: {
  lineItem: LineItem; locationCode: string; allocQty: number; onClose: () => void; onConfirm?: (data: { lots: string[]; totalQty: number }) => void;
}) {
  const lotsAtLocation = useMemo(() => {
    return generateSimpleLotsAtLocation(lineItem, locationCode, allocQty);
  }, [lineItem, locationCode, allocQty]);
  const [selectedLots, setSelectedLots] = useState<Map<string, number>>(new Map());
  const totalSelected = Array.from(selectedLots.values()).reduce((s, v) => s + v, 0);

  const toggleLot = (lotNumber: string, onHand: number) => {
    setSelectedLots((prev) => {
      const next = new Map(prev);
      if (next.has(lotNumber)) next.delete(lotNumber);
      else {
        const currentTotal = Array.from(next.values()).reduce((s, v) => s + v, 0);
        next.set(lotNumber, Math.min(onHand, Math.max(1, allocQty - currentTotal)));
      }
      return next;
    });
  };

  const updateLotQty = (lotNumber: string, qty: number, onHand: number) => {
    setSelectedLots((prev) => {
      const next = new Map(prev);
      next.set(lotNumber, Math.max(0, Math.min(qty, onHand)));
      return next;
    });
  };

  return (
    <UnitsSubModal open onClose={onClose} locationCode={locationCode} title="Select Units">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}>
            {lotsAtLocation.length} lot{lotsAtLocation.length !== 1 ? "s" : ""} available at {locationCode}
          </span>
          {totalSelected > 0 && (
            <span className="text-primary font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}>
              {totalSelected} / {allocQty} {lineItem.uom} assigned
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          {lotsAtLocation.map((lot) => {
            const isSelected = selectedLots.has(lot.lotNumber);
            const lotQty = selectedLots.get(lot.lotNumber) ?? 0;
            const available = lot.onHand;
            const isDisabled = !isSelected && totalSelected >= allocQty;
            return (
              <div
                key={lot.lotNumber}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors",
                  isSelected ? "bg-primary/[0.04] border-primary/20" : isDisabled ? "border-border opacity-40" : "border-border hover:border-foreground/20"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleLot(lot.lotNumber, available)}
                  disabled={isDisabled}
                  className="shrink-0"
                />
                <Layers className={cn("size-3.5 shrink-0", isSelected ? "text-primary/60" : "text-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <span className={cn("font-sans block", isSelected ? "text-foreground" : "text-foreground/60")} style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>
                    {lot.lotNumber}
                  </span>
                  <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
                    {lot.onHand} available
                  </span>
                </div>
                {isSelected && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateLotQty(lot.lotNumber, lotQty - 1, available)}
                      disabled={lotQty <= 1}
                      className="size-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="w-8 text-center font-sans text-foreground" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>
                      {lotQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateLotQty(lot.lotNumber, lotQty + 1, available)}
                      disabled={lotQty >= available || totalSelected >= allocQty}
                      className="size-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                )}
                {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
      <div className="shrink-0 px-5 py-3 border-t border-border flex items-center justify-between">
        <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
          {totalSelected === 0 ? "Select lots" : `${totalSelected} of ${allocQty} ${lineItem.uom} selected across ${selectedLots.size} lot${selectedLots.size !== 1 ? "s" : ""}`}
        </span>
        <button onClick={() => {
          if (totalSelected > 0 && onConfirm) {
            const lots = Array.from(selectedLots.keys());
            onConfirm({ lots, totalQty: totalSelected });
          }
          onClose();
        }} className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#0862D0] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
          {totalSelected > 0 ? "Confirm Selection" : "Done"}
        </button>
      </div>
    </UnitsSubModal>
  );
}

/* ═══════════════════════════════════════════════════════
   Location Lots Sub-Modal — View lots at a specific location
   For lot_non_serialized: select lots and define qty per lot.
   For lot_serialized: select lots then drill into serial units.
   Opened from LocationPanel when user clicks "View Lots".
   ═══════════════════════════════════════════════════════ */

function LocationLotsSubModal({ lineItem, locationCode, allocQty, onClose }: {
  lineItem: LineItem; locationCode: string; allocQty: number; onClose: (confirmedQty?: number) => void;
}) {
  const isLotSerialized = lineItem.inventoryType === "lot_serialized";

  // Generate lots at this location
  const lotsAtLocation = useMemo(() => {
    if (isLotSerialized) {
      // For lot_serialized, generate lots with serial numbers
      return generateLotsWithSerialsAtLocation(lineItem, locationCode, allocQty).map((lot) => ({
        lotNumber: lot.lotNumber,
        onHand: lot.onHand,
        serialNumbers: lot.serialNumbers,
      }));
    }
    // For lot_non_serialized, generate simple lots
    return generateSimpleLotsAtLocation(lineItem, locationCode, allocQty).map((lot) => ({
      lotNumber: lot.lotNumber,
      onHand: lot.onHand,
      serialNumbers: undefined as string[] | undefined,
    }));
  }, [lineItem, locationCode, allocQty, isLotSerialized]);

  // Lot qty selections (for lot_non_serialized, plus whole-lot mode for lot_serialized)
  const [selectedLots, setSelectedLots] = useState<Map<string, number>>(new Map());
  // Per-serial selections (for lot_serialized when not in whole-lot mode)
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set());

  // For lot_serialized: selectedLots tracks lot-level selections (whole lot),
  // selectedSerials tracks individual serial selections.
  // totalSelected = lot-level qty + individual serial selections (not double-counted)
  const lotLevelTotal = Array.from(selectedLots.values()).reduce((s, v) => s + v, 0);
  const totalSelected = isLotSerialized
    ? (() => {
        // Count serials selected individually that are NOT part of a lot-level selection
        let count = lotLevelTotal;
        for (const lot of lotsAtLocation) {
          if (selectedLots.has(lot.lotNumber)) continue; // Already counted at lot level
          if (lot.serialNumbers) {
            count += lot.serialNumbers.filter((sn) => selectedSerials.has(sn)).length;
          }
        }
        return count;
      })()
    : lotLevelTotal;

  const toggleLot = (lotNumber: string, onHand: number) => {
    setSelectedLots((prev) => {
      const next = new Map(prev);
      if (next.has(lotNumber)) {
        next.delete(lotNumber);
      } else {
        const currentTotal = Array.from(next.values()).reduce((s, v) => s + v, 0);
        // For lot_serialized, also account for individually selected serials in other lots
        let otherSerialCount = 0;
        if (isLotSerialized) {
          for (const lot of lotsAtLocation) {
            if (lot.lotNumber === lotNumber || next.has(lot.lotNumber)) continue;
            if (lot.serialNumbers) {
              otherSerialCount += lot.serialNumbers.filter((sn) => selectedSerials.has(sn)).length;
            }
          }
        }
        const usedElsewhere = currentTotal + otherSerialCount;
        next.set(lotNumber, Math.min(onHand, Math.max(1, allocQty - usedElsewhere)));
      }
      return next;
    });
    // If lot_serialized and selecting whole lot, also select all its serials
    if (isLotSerialized) {
      const lot = lotsAtLocation.find((l) => l.lotNumber === lotNumber);
      if (lot?.serialNumbers) {
        if (selectedLots.has(lotNumber)) {
          // Deselecting: remove all serials of this lot
          setSelectedSerials((prev) => {
            const next = new Set(prev);
            lot.serialNumbers!.forEach((sn) => next.delete(sn));
            return next;
          });
        } else {
          // Selecting: add all serials of this lot
          setSelectedSerials((prev) => {
            const next = new Set(prev);
            lot.serialNumbers!.forEach((sn) => next.add(sn));
            return next;
          });
        }
      }
    }
  };

  const updateLotQty = (lotNumber: string, qty: number, onHand: number) => {
    setSelectedLots((prev) => {
      const next = new Map(prev);
      next.set(lotNumber, Math.max(0, Math.min(qty, onHand)));
      return next;
    });
  };

  const toggleSerial = (sn: string) => {
    setSelectedSerials((prev) => {
      const next = new Set(prev);
      if (next.has(sn)) next.delete(sn); else next.add(sn);
      return next;
    });
  };

  const handleConfirm = () => {
    onClose(totalSelected > 0 ? totalSelected : undefined);
  };

  /* Two-pane rebuild: lots LEFT, focused lot's units/qty RIGHT (Cycle Count
     interaction pattern, Partners chrome). Replaces the prior single-list
     accordion which mixed in-row steppers, expand buttons, and inline serial
     grids in the same row — the user flagged that as overloaded. */
  const [focusedLotNum, setFocusedLotNum] = useState<string | null>(
    lotsAtLocation[0]?.lotNumber ?? null,
  );
  const [serialSearch, setSerialSearch] = useState("");
  const handleFocusLot = (lotNum: string) => {
    setFocusedLotNum(lotNum);
    setSerialSearch("");
  };

  const focusedLot = focusedLotNum
    ? lotsAtLocation.find((l) => l.lotNumber === focusedLotNum) ?? null
    : null;

  const countSelectedAtLot = (lot: typeof lotsAtLocation[number]): number => {
    if (selectedLots.has(lot.lotNumber)) return selectedLots.get(lot.lotNumber) ?? 0;
    if (!isLotSerialized || !lot.serialNumbers) return 0;
    return lot.serialNumbers.filter((sn) => selectedSerials.has(sn)).length;
  };

  /** Toggle only the currently-visible (post-search) serials of the focused lot.
      Selections outside the visible set remain — matches Cycle Count. */
  const toggleAllVisibleSerialsInLot = (
    lot: typeof lotsAtLocation[number],
    visibleSerials: string[],
  ) => {
    if (!lot.serialNumbers) return;
    // If the user has the WHOLE lot selected at lot-level, drop that and switch
    // to per-serial mode so we don't double-count.
    if (selectedLots.has(lot.lotNumber)) {
      setSelectedLots((prev) => { const next = new Map(prev); next.delete(lot.lotNumber); return next; });
      setSelectedSerials((prev) => {
        const next = new Set(prev);
        lot.serialNumbers!.forEach((sn) => { if (next.has(sn)) next.delete(sn); });
        visibleSerials.forEach((sn) => next.add(sn));
        return next;
      });
      return;
    }
    const allSelected = visibleSerials.every((sn) => selectedSerials.has(sn));
    if (allSelected) {
      setSelectedSerials((prev) => {
        const next = new Set(prev);
        visibleSerials.forEach((sn) => next.delete(sn));
        return next;
      });
    } else {
      setSelectedSerials((prev) => {
        const next = new Set(prev);
        let room = allocQty - totalSelected;
        visibleSerials.forEach((sn) => {
          if (!next.has(sn) && room > 0) { next.add(sn); room--; }
        });
        return next;
      });
    }
  };

  /* Selection progress (sub-modal scope) — same chrome as parent modal's
     header progress bar. Here the denominator is `allocQty` (what the caller
     said this location may contribute), since the sub-modal's job is to
     fulfil that quantity at this single location. Multi-lot is reflected:
     `totalSelected` already sums lot-level + per-serial selections across
     ALL lots at this location. */
  const subModalBucket = allocBucket(totalSelected, allocQty);
  const subModalPct = allocQty > 0 ? (totalSelected / allocQty) * 100 : 0;
  /* Distinct lots contributing to the count, so the bar's subtitle can call
     out multi-lot coverage at this location. */
  const lotsContributing = (() => {
    const out = new Set<string>();
    for (const lot of lotsAtLocation) {
      if (selectedLots.has(lot.lotNumber)) { out.add(lot.lotNumber); continue; }
      if (isLotSerialized && lot.serialNumbers) {
        if (lot.serialNumbers.some((sn) => selectedSerials.has(sn))) out.add(lot.lotNumber);
      }
    }
    return out.size;
  })();

  return (
    <UnitsSubModal open onClose={() => onClose()} locationCode={locationCode} title="Select Units" width={880}>
      {/* Body: flex column that fills available modal height. No outer scroll
          on the modal body — the two-pane view inside manages its own. */}
      <div className="flex-1 min-h-0 flex flex-col p-4 gap-3 overflow-hidden">
        {/* Allocation progress (location scope) — mirrors parent modal's bar. */}
        <div className="shrink-0 flex flex-col gap-1.5 px-3 py-2 rounded-lg bg-muted/40 border border-border">
          <div className="flex items-center gap-3">
            <span
              className="font-sans shrink-0"
              style={{
                color: ALLOC_TEXT_COLOR[subModalBucket],
                fontSize: "var(--text-xs)",
                fontWeight: "var(--font-weight-semibold)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {totalSelected.toLocaleString()} / {allocQty.toLocaleString()} {lineItem.uom}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${Math.min(100, subModalPct)}%`, backgroundColor: ALLOC_BAR_COLOR[subModalBucket] }}
              />
            </div>
            <span
              className="font-sans shrink-0"
              style={{
                color: ALLOC_TEXT_COLOR[subModalBucket],
                fontSize: "var(--text-2xs)",
                fontWeight: "var(--font-weight-semibold)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(subModalPct)}%
            </span>
          </div>
          {lotsContributing > 1 && (
            <span className="text-muted-foreground font-sans" style={{ fontSize: 10, fontWeight: 500 }}>
              Drawn from {lotsContributing} lots at this location.
            </span>
          )}
        </div>

        {/* Single top-level selection pill — derived from internal state.
            Mirrors the Partners FilterPills count chrome. */}
        {totalSelected > 0 && (
          <div className="shrink-0 flex items-center justify-end gap-2">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full font-sans"
              style={{
                fontSize: "var(--text-2xs)",
                fontWeight: "var(--font-weight-semibold)",
                background: "rgba(27, 110, 243, 0.10)",
                color: "var(--primary)",
              }}
            >
              {totalSelected} of {allocQty} {lineItem.uom} selected
            </span>
            <button
              type="button"
              onClick={() => { setSelectedLots(new Map()); setSelectedSerials(new Set()); }}
              className="text-muted-foreground hover:text-destructive font-sans transition-colors cursor-pointer"
              style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
            >
              Clear all
            </button>
          </div>
        )}

        {lotsAtLocation.length === 0 ? (
          <div className="flex-1 min-h-0 py-12 text-center text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
            No lots at this location.
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 border border-border rounded-lg overflow-hidden bg-card">
            {/* ─── LEFT pane: lots at this location ─── */}
            <div className="w-[280px] shrink-0 border-r border-border bg-secondary/30 flex flex-col">
              <div className="shrink-0 px-3 py-2.5 border-b border-border bg-card">
                <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>
                  {lotsAtLocation.length} lot{lotsAtLocation.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {lotsAtLocation.map((lot) => {
                  const selectedAt = countSelectedAtLot(lot);
                  const isFocused = lot.lotNumber === focusedLotNum;
                  const hasSelection = selectedAt > 0;
                  return (
                    <button
                      key={lot.lotNumber}
                      type="button"
                      onClick={() => handleFocusLot(lot.lotNumber)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md border transition-all cursor-pointer flex items-center gap-2.5 relative",
                        isFocused
                          ? "border-primary bg-primary/[0.06] shadow-[0_1px_2px_rgba(15,98,214,0.06)]"
                          : hasSelection
                            ? "border-accent/30 bg-card hover:border-accent/50"
                            : "border-border bg-card hover:border-foreground/25",
                      )}
                      style={{ minHeight: 56 }}
                    >
                      <div className={cn(
                        "shrink-0 size-8 rounded-md flex items-center justify-center transition-colors",
                        isFocused ? "bg-primary/12" : hasSelection ? "bg-accent/12" : "bg-primary/8",
                      )}>
                        <Layers className={cn(
                          "size-3.5",
                          isFocused ? "text-primary" : hasSelection ? "text-accent" : "text-primary/60",
                        )} />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col leading-tight gap-0.5">
                        <span className={cn("font-sans truncate", hasSelection || isFocused ? "text-foreground" : "text-foreground/80")} style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}>
                          {lot.lotNumber}
                        </span>
                        <span
                          className={cn("font-sans truncate", hasSelection ? "text-primary" : "text-muted-foreground")}
                          style={{ fontSize: "var(--text-2xs)", fontWeight: hasSelection ? "var(--font-weight-semibold)" : "var(--font-weight-medium)" }}
                        >
                          {hasSelection
                            ? `${selectedAt} of ${lot.onHand} ${lineItem.uom} selected`
                            : `${lot.onHand} ${lineItem.uom}${isLotSerialized && lot.serialNumbers ? ` · ${lot.serialNumbers.length} serials` : ""}`}
                        </span>
                      </div>
                      {isFocused && (
                        <span className="shrink-0 size-1.5 rounded-full bg-primary" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── RIGHT pane: focused lot detail ─── */}
            <div className="flex-1 min-w-0 flex flex-col bg-card">
              {focusedLot ? (
                (() => {
                  if (isLotSerialized && focusedLot.serialNumbers) {
                    const allSerials = focusedLot.serialNumbers;
                    const q = serialSearch.trim().toLowerCase();
                    const visibleSerials = q
                      ? allSerials.filter((sn) => sn.toLowerCase().includes(q))
                      : allSerials;
                    const isWholeLotSelected = selectedLots.has(focusedLot.lotNumber);
                    const wholeLotQty = selectedLots.get(focusedLot.lotNumber) ?? 0;
                    const selectedHere = isWholeLotSelected
                      ? wholeLotQty
                      : allSerials.filter((sn) => selectedSerials.has(sn)).length;
                    const visibleSelectedCount = isWholeLotSelected
                      ? visibleSerials.length
                      : visibleSerials.filter((sn) => selectedSerials.has(sn)).length;
                    const allVisibleSelected = visibleSerials.length > 0 && visibleSelectedCount === visibleSerials.length;

                    return (
                      <>
                        <div className="shrink-0 px-4 py-3 border-b border-border space-y-2.5">
                          <div className="flex items-start gap-2.5">
                            <div className="shrink-0 size-9 rounded-md bg-primary/12 flex items-center justify-center">
                              <Layers className="size-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col leading-tight gap-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-foreground font-sans truncate" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>{focusedLot.lotNumber}</span>
                                <span
                                  className="shrink-0 inline-flex items-center px-1.5 rounded-full font-sans"
                                  style={{
                                    fontSize: 10,
                                    fontWeight: "var(--font-weight-semibold)",
                                    background: "#ECFDF5",
                                    color: "#065F46",
                                    border: "1px solid #A7F3D0",
                                    lineHeight: "16px",
                                    minHeight: 16,
                                  }}
                                >
                                  Active
                                </span>
                              </div>
                              <span className="text-muted-foreground font-sans truncate" style={{ fontSize: "var(--text-2xs)" }}>
                                {locationCode} · {allSerials.length} {lineItem.uom}
                              </span>
                            </div>
                            <div
                              className="shrink-0 flex flex-col items-end px-3 py-1.5 rounded-md leading-tight"
                              style={{
                                background: "var(--secondary)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <span
                                className="font-sans"
                                style={{
                                  fontSize: "var(--text-sm)",
                                  fontWeight: "var(--font-weight-semibold)",
                                  color: "var(--foreground)",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {selectedHere.toLocaleString()} / {allSerials.length.toLocaleString()} {lineItem.uom}
                              </span>
                              <span
                                className="font-sans"
                                style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  color: "var(--muted-foreground)",
                                }}
                              >
                                to allocate
                              </span>
                            </div>
                          </div>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                            <Input
                              value={serialSearch}
                              onChange={(e) => setSerialSearch(e.target.value)}
                              placeholder="Search serial numbers..."
                              className="pl-9 h-8 rounded-md font-sans border-border text-foreground placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-2"
                              style={{ fontSize: 12, backgroundColor: "#FFFFFF" }}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-secondary/40 border border-border">
                            <button
                              type="button"
                              onClick={() => toggleAllVisibleSerialsInLot(focusedLot, visibleSerials)}
                              disabled={visibleSerials.length === 0 || (!allVisibleSelected && totalSelected >= allocQty)}
                              className="flex items-center gap-1.5 text-primary hover:text-primary/80 font-sans transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
                            >
                              <Checkbox
                                checked={allVisibleSelected}
                                disabled={visibleSerials.length === 0 || (!allVisibleSelected && totalSelected >= allocQty)}
                                className="size-3.5 pointer-events-none"
                                tabIndex={-1}
                              />
                              {allVisibleSelected ? `Clear visible (${visibleSerials.length})` : `Select all visible (${visibleSerials.length})`}
                            </button>
                            <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)" }}>
                              {q ? `${visibleSerials.length} of ${allSerials.length} match` : `${allSerials.length} total`}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
                          {visibleSerials.length === 0 ? (
                            <div className="py-10 text-center text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
                              {q ? "No serials match your search." : "No serials available in this lot."}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-1.5">
                              {visibleSerials.map((sn, idx) => {
                                const isSNSelected = isWholeLotSelected || selectedSerials.has(sn);
                                const isSNDisabled = !isSNSelected && totalSelected >= allocQty;
                                return (
                                  <button
                                    key={sn}
                                    type="button"
                                    onClick={() => {
                                      if (isSNDisabled && !isSNSelected) return;
                                      // If lot is whole-selected, split into per-serial mode and remove just this one
                                      if (isWholeLotSelected) {
                                        setSelectedLots((prev) => { const next = new Map(prev); next.delete(focusedLot.lotNumber); return next; });
                                        setSelectedSerials((prev) => {
                                          const next = new Set(prev);
                                          allSerials.forEach((s) => { if (s !== sn) next.add(s); });
                                          return next;
                                        });
                                      } else {
                                        toggleSerial(sn);
                                      }
                                    }}
                                    disabled={isSNDisabled}
                                    className={cn(
                                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md border font-sans text-left transition-[border-color,background-color,box-shadow,color] duration-300 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
                                      isSNSelected
                                        ? "border-primary bg-primary/[0.06] text-primary cursor-pointer"
                                        : isSNDisabled
                                          ? "border-border bg-secondary/40 text-foreground/40 cursor-not-allowed"
                                          : "border-border bg-card text-foreground/75 hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground hover:shadow-[0_0_0_1px_rgba(10,119,255,0.10)] cursor-pointer",
                                    )}
                                    style={{ fontSize: "var(--text-xs)" }}
                                  >
                                    <Checkbox
                                      checked={isSNSelected}
                                      disabled={isSNDisabled}
                                      className="shrink-0 pointer-events-none size-3.5"
                                      tabIndex={-1}
                                    />
                                    <span
                                      className={cn(
                                        "shrink-0 font-sans",
                                        isSNSelected ? "text-primary/60" : isSNDisabled ? "text-foreground/30" : "text-muted-foreground",
                                      )}
                                      style={{ fontSize: 10, fontWeight: 500, fontVariantNumeric: "tabular-nums", minWidth: 22 }}
                                    >
                                      {String(idx + 1).padStart(3, "0")}
                                    </span>
                                    <span className={cn("truncate flex-1", isSNSelected && "font-semibold")}>
                                      <TruncatedSerial
                                        serialNo={sn}
                                        query={q}
                                        isSelected={isSNSelected}
                                        isDisabled={isSNDisabled}
                                      />
                                    </span>
                                    {isSNSelected && <Check className="size-3 text-primary shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  }

                  // ─── lot_non_serialized: qty stepper for the focused lot ───
                  const lotQty = selectedLots.get(focusedLot.lotNumber) ?? 0;
                  const isSelected = selectedLots.has(focusedLot.lotNumber);
                  const maxForThis = Math.min(focusedLot.onHand, allocQty - totalSelected + lotQty);
                  return (
                    <>
                      <div className="shrink-0 px-4 py-3 border-b border-border">
                        <div className="flex items-start gap-2.5">
                          <div className="shrink-0 size-9 rounded-md bg-primary/12 flex items-center justify-center">
                            <Layers className="size-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col leading-tight gap-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-foreground font-sans truncate" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>{focusedLot.lotNumber}</span>
                              <span
                                className="shrink-0 inline-flex items-center px-1.5 rounded-full font-sans"
                                style={{
                                  fontSize: 10,
                                  fontWeight: "var(--font-weight-semibold)",
                                  background: "#ECFDF5",
                                  color: "#065F46",
                                  border: "1px solid #A7F3D0",
                                  lineHeight: "16px",
                                  minHeight: 16,
                                }}
                              >
                                Active
                              </span>
                            </div>
                            <span className="text-muted-foreground font-sans truncate" style={{ fontSize: "var(--text-2xs)" }}>{locationCode}</span>
                          </div>
                          <div
                            className="shrink-0 flex flex-col items-end px-3 py-1.5 rounded-md leading-tight"
                            style={{
                              background: "var(--secondary)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <span
                              className="font-sans"
                              style={{
                                fontSize: "var(--text-sm)",
                                fontWeight: "var(--font-weight-semibold)",
                                color: "var(--foreground)",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {lotQty.toLocaleString()} / {focusedLot.onHand.toLocaleString()} {lineItem.uom}
                            </span>
                            <span
                              className="font-sans"
                              style={{
                                fontSize: 10,
                                fontWeight: 500,
                                color: "var(--muted-foreground)",
                              }}
                            >
                              to allocate
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 flex flex-col items-center justify-center gap-3">
                        <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>
                          Qty from this lot
                        </span>
                        <div className="inline-flex items-center border border-border rounded-md overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.max(0, lotQty - 1);
                              if (next === 0) {
                                setSelectedLots((prev) => { const m = new Map(prev); m.delete(focusedLot.lotNumber); return m; });
                              } else {
                                updateLotQty(focusedLot.lotNumber, next, focusedLot.onHand);
                              }
                            }}
                            disabled={lotQty <= 0}
                            className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Minus className="size-3" />
                          </button>
                          <input
                            type="number"
                            value={lotQty || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, maxForThis));
                              if (val > 0 && !isSelected) {
                                setSelectedLots((prev) => { const m = new Map(prev); m.set(focusedLot.lotNumber, val); return m; });
                              } else if (val === 0) {
                                setSelectedLots((prev) => { const m = new Map(prev); m.delete(focusedLot.lotNumber); return m; });
                              } else {
                                updateLotQty(focusedLot.lotNumber, val, focusedLot.onHand);
                              }
                            }}
                            className="w-12 h-8 text-center bg-background text-foreground font-sans outline-none border-x border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = Math.min(lotQty + 1, maxForThis);
                              if (next > 0 && !isSelected) {
                                setSelectedLots((prev) => { const m = new Map(prev); m.set(focusedLot.lotNumber, next); return m; });
                              } else if (next > 0) {
                                updateLotQty(focusedLot.lotNumber, next, focusedLot.onHand);
                              }
                            }}
                            disabled={lotQty >= maxForThis}
                            className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (maxForThis <= 0) return;
                            setSelectedLots((prev) => { const m = new Map(prev); m.set(focusedLot.lotNumber, maxForThis); return m; });
                          }}
                          disabled={maxForThis <= 0}
                          className="text-primary hover:text-primary/80 font-sans transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
                        >
                          Allocate max ({maxForThis})
                        </button>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
                  Select a lot from the left.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="shrink-0 px-5 py-3 border-t border-border flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onClose()}
          className="px-4 py-2 rounded-lg border border-border bg-white text-muted-foreground text-[13px] hover:bg-slate-50 transition-colors cursor-pointer"
          style={{ fontWeight: 600 }}
        >
          Cancel
        </button>
        <button onClick={handleConfirm} className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#0862D0] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
          {totalSelected > 0 ? "Confirm selection" : "Done"}
        </button>
      </div>
    </UnitsSubModal>
  );
}

/* ═══════════════════════════════════════════════════════
   Lot Locations View — shows locations for a specific lot
   lot_serialized: each location is expandable to show serials
   lot_non_serialized: each location shows qty available
   ═══════════════════════════════════════════════════════ */

/**
 * Two-pane lot-locations view (Cycle Count interaction pattern):
 *   LEFT  — list of locations carrying this lot, click to focus
 *   RIGHT — focused location's serials grid (lot_serialized) or qty stepper
 *           (lot_non_serialized), with in-modal search.
 *
 * Selection state is the SAME `selectedSerials` Set / `lotSelections` Record
 * the parent owns. Search filters the right-pane rendering only — selections
 * in filtered-out rows are preserved (they still count in the aggregate).
 */
function LotLocationsView({ lineItem, viewingLot, viewingLocations, lotSelections, totalNewlyAllocated, remaining, onToggleLot, onLotQtyChange, selectedSerials, onToggleSerial, lotStatus = "Active" }: {
  lineItem: LineItem;
  viewingLot: string;
  viewingLocations: LotAtLocation[];
  lotSelections: Record<string, number>;
  totalNewlyAllocated: number;
  remaining: number;
  onToggleLot: (key: string, onHand: number) => void;
  onLotQtyChange: (key: string, qty: number, onHand: number) => void;
  /** Optional — when provided, serial units become selectable (lot_serialized) */
  selectedSerials?: Set<string>;
  onToggleSerial?: (sn: string, locationCode: string) => void;
  /** Surfacing of lot status so users can confirm the lot they're allocating from
      is still Active. Quarantine lots are filtered out at the data selector, so
      this is informational confirmation, not a gate. */
  lotStatus?: "Active" | "Quarantine";
}) {
  const isLotSerialized = lineItem.inventoryType === "lot_serialized";
  const serialSelectionEnabled = isLotSerialized && !!selectedSerials && !!onToggleSerial;
  const uom = lineItem.uom;

  const allocatableLocations = useMemo(
    () => viewingLocations.filter((l) => l.onHand - l.alreadyAllocated > 0),
    [viewingLocations],
  );

  /** Auto-focus the first location with selections, else the first allocatable. */
  const initialFocus = useMemo(() => {
    const withSelection = allocatableLocations.find((loc) => {
      if (serialSelectionEnabled) {
        return (loc.serialNumbers ?? []).some((sn) => selectedSerials!.has(sn));
      }
      return `${loc.locationCode}::${viewingLot}` in lotSelections;
    });
    return (withSelection ?? allocatableLocations[0])?.locationCode ?? null;
  }, [allocatableLocations, lotSelections, selectedSerials, serialSelectionEnabled, viewingLot]);

  const [focusedLocCode, setFocusedLocCode] = useState<string | null>(initialFocus);
  const [serialSearch, setSerialSearch] = useState("");

  /* Clearing search when the focused location changes mirrors Cycle Count's
     behaviour — the user's intent shifts when they pick a different location,
     so the previous query shouldn't bleed across. Selections, however, are
     keyed in the parent Set and survive the change untouched. */
  const handleFocusLoc = (locCode: string) => {
    setFocusedLocCode(locCode);
    setSerialSearch("");
  };

  const focusedLoc = focusedLocCode
    ? allocatableLocations.find((l) => l.locationCode === focusedLocCode) ?? null
    : null;

  const countSelectedAt = (loc: LotAtLocation): number => {
    if (serialSelectionEnabled) {
      return (loc.serialNumbers ?? []).filter((sn) => selectedSerials!.has(sn)).length;
    }
    return lotSelections[`${loc.locationCode}::${viewingLot}`] ?? 0;
  };

  /** Toggle all serials at the focused location — only across the
      currently-visible (post-search) set so the user can target a filtered
      subset without disturbing selections in rows that scrolled out. */
  const toggleAllVisibleSerialsAt = (loc: LotAtLocation, visibleSerials: string[]) => {
    if (!selectedSerials || !onToggleSerial) return;
    const allSelected = visibleSerials.every((sn) => selectedSerials.has(sn));
    if (allSelected) {
      visibleSerials.forEach((sn) => { if (selectedSerials.has(sn)) onToggleSerial(sn, loc.locationCode); });
    } else {
      const currentTotal = selectedSerials.size;
      let added = 0;
      visibleSerials.forEach((sn) => {
        if (!selectedSerials.has(sn) && (currentTotal + added) < remaining) {
          onToggleSerial(sn, loc.locationCode);
          added++;
        }
      });
    }
  };

  if (allocatableLocations.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
        No allocatable inventory at any location for this lot.
      </div>
    );
  }

  return (
    <div className="flex h-[55vh] border border-border rounded-lg overflow-hidden bg-card">
      {/* ─── LEFT pane: locations carrying this lot ─── */}
      <div className="w-[280px] shrink-0 border-r border-border bg-secondary/30 flex flex-col">
        <div className="shrink-0 px-3 py-2.5 border-b border-border bg-card">
          <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>
            {allocatableLocations.length} location{allocatableLocations.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {allocatableLocations.map((loc) => {
            const available = loc.onHand - loc.alreadyAllocated;
            const selectedAt = countSelectedAt(loc);
            const isFocused = loc.locationCode === focusedLocCode;
            const hasSelection = selectedAt > 0;
            return (
              <button
                key={loc.locationCode}
                type="button"
                onClick={() => handleFocusLoc(loc.locationCode)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md border transition-all cursor-pointer flex items-center gap-2.5 relative",
                  isFocused
                    ? "border-primary bg-primary/[0.06] shadow-[0_1px_2px_rgba(15,98,214,0.06)]"
                    : hasSelection
                      ? "border-accent/30 bg-card hover:border-accent/50"
                      : "border-border bg-card hover:border-foreground/25",
                )}
                style={{ minHeight: 56 }}
              >
                <div className={cn(
                  "shrink-0 size-8 rounded-md flex items-center justify-center transition-colors",
                  isFocused ? "bg-primary/12" : hasSelection ? "bg-accent/12" : "bg-primary/8",
                )}>
                  <MapPin className={cn(
                    "size-3.5",
                    isFocused ? "text-primary" : hasSelection ? "text-accent" : "text-primary/60",
                  )} />
                </div>
                <div className="flex-1 min-w-0 flex flex-col leading-tight gap-0.5">
                  <span className={cn("font-sans truncate", hasSelection || isFocused ? "text-foreground" : "text-foreground/80")} style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}>
                    {loc.locationCode}
                  </span>
                  <span
                    className={cn("font-sans truncate", hasSelection ? "text-primary" : "text-muted-foreground")}
                    style={{ fontSize: "var(--text-2xs)", fontWeight: hasSelection ? "var(--font-weight-semibold)" : "var(--font-weight-medium)" }}
                  >
                    {hasSelection ? `${selectedAt} of ${available} ${uom} selected` : `${available} ${uom}`}
                  </span>
                </div>
                {isFocused && (
                  <span className="shrink-0 size-1.5 rounded-full bg-primary" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── RIGHT pane: focused location detail ─── */}
      <div className="flex-1 min-w-0 flex flex-col bg-card">
        {focusedLoc ? (
          (() => {
            const available = focusedLoc.onHand - focusedLoc.alreadyAllocated;
            const key = `${focusedLoc.locationCode}::${viewingLot}`;

            if (serialSelectionEnabled) {
              const allSerials = focusedLoc.serialNumbers ?? [];
              const q = serialSearch.trim().toLowerCase();
              const visibleSerials = q
                ? allSerials.filter((sn) => sn.toLowerCase().includes(q))
                : allSerials;
              const selectedHere = allSerials.filter((sn) => selectedSerials!.has(sn));
              const visibleSelectedCount = visibleSerials.filter((sn) => selectedSerials!.has(sn)).length;
              const allVisibleSelected = visibleSerials.length > 0 && visibleSelectedCount === visibleSerials.length;

              return (
                <>
                  <div className="shrink-0 px-4 py-3 border-b border-border space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="shrink-0 size-9 rounded-md bg-primary/12 flex items-center justify-center">
                        <MapPin className="size-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col leading-tight gap-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-foreground font-sans truncate" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>{focusedLoc.locationCode}</span>
                          <span
                            className="shrink-0 inline-flex items-center px-1.5 rounded-full font-sans"
                            style={{
                              fontSize: 10,
                              fontWeight: "var(--font-weight-semibold)",
                              background: lotStatus === "Active" ? "#ECFDF5" : "#FEF2F2",
                              color: lotStatus === "Active" ? "#065F46" : "#991B1B",
                              border: `1px solid ${lotStatus === "Active" ? "#A7F3D0" : "#FECACA"}`,
                              lineHeight: "16px",
                              minHeight: 16,
                            }}
                          >
                            {lotStatus}
                          </span>
                        </div>
                        <span className="text-muted-foreground font-sans truncate" style={{ fontSize: "var(--text-2xs)" }}>{getLocationAddress(focusedLoc.locationCode)}</span>
                      </div>
                      <div
                        className="shrink-0 flex flex-col items-end px-3 py-1.5 rounded-md leading-tight"
                        style={{
                          background: "var(--secondary)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <span
                          className="font-sans"
                          style={{
                            fontSize: "var(--text-sm)",
                            fontWeight: "var(--font-weight-semibold)",
                            color: "var(--foreground)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {selectedHere.length.toLocaleString()} / {allSerials.length.toLocaleString()} {uom}
                        </span>
                        <span
                          className="font-sans"
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: "var(--muted-foreground)",
                          }}
                        >
                          to allocate
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input
                        value={serialSearch}
                        onChange={(e) => setSerialSearch(e.target.value)}
                        placeholder="Search serial numbers..."
                        className="pl-9 h-8 rounded-md font-sans border-border text-foreground placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-2"
                        style={{ fontSize: 12, backgroundColor: "#FFFFFF" }}
                      />
                    </div>
                    {allSerials.length > 0 && (
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-secondary/40 border border-border">
                        <button
                          type="button"
                          onClick={() => toggleAllVisibleSerialsAt(focusedLoc, visibleSerials)}
                          disabled={visibleSerials.length === 0 || (!allVisibleSelected && totalNewlyAllocated >= remaining)}
                          className="flex items-center gap-1.5 text-primary hover:text-primary/80 font-sans transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
                        >
                          <Checkbox
                            checked={allVisibleSelected}
                            disabled={visibleSerials.length === 0 || (!allVisibleSelected && totalNewlyAllocated >= remaining)}
                            className="size-3.5 pointer-events-none"
                            tabIndex={-1}
                          />
                          {allVisibleSelected ? `Clear visible (${visibleSerials.length})` : `Select all visible (${visibleSerials.length})`}
                        </button>
                        <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)" }}>
                          {q ? `${visibleSerials.length} of ${allSerials.length} match` : `${allSerials.length} total`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
                    {visibleSerials.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
                        {q ? "No serials match your search." : `No serials available at this location.`}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {visibleSerials.map((sn, idx) => {
                          const isSNSelected = selectedSerials!.has(sn);
                          const isSNDisabled = !isSNSelected && totalNewlyAllocated >= remaining;
                          return (
                            <button
                              key={sn}
                              type="button"
                              onClick={() => { if (!isSNDisabled || isSNSelected) onToggleSerial!(sn, focusedLoc.locationCode); }}
                              disabled={isSNDisabled}
                              className={cn(
                                "flex items-center gap-1.5 px-2 py-1.5 rounded-md border font-sans text-left transition-[border-color,background-color,box-shadow,color] duration-300 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
                                isSNSelected
                                  ? "border-primary bg-primary/[0.06] text-primary cursor-pointer"
                                  : isSNDisabled
                                    ? "border-border bg-secondary/40 text-foreground/40 cursor-not-allowed"
                                    : "border-border bg-card text-foreground/75 hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground hover:shadow-[0_0_0_1px_rgba(10,119,255,0.10)] cursor-pointer",
                              )}
                              style={{ fontSize: "var(--text-xs)" }}
                            >
                              <Checkbox
                                checked={isSNSelected}
                                disabled={isSNDisabled}
                                className="shrink-0 pointer-events-none size-3.5"
                                tabIndex={-1}
                              />
                              <span
                                className={cn(
                                  "shrink-0 font-sans",
                                  isSNSelected ? "text-primary/60" : isSNDisabled ? "text-foreground/30" : "text-muted-foreground",
                                )}
                                style={{ fontSize: 10, fontWeight: 500, fontVariantNumeric: "tabular-nums", minWidth: 22 }}
                              >
                                {String(idx + 1).padStart(3, "0")}
                              </span>
                              <span className={cn("truncate flex-1", isSNSelected && "font-semibold")}>
                                <TruncatedSerial
                                  serialNo={sn}
                                  query={q}
                                  isSelected={isSNSelected}
                                  isDisabled={isSNDisabled}
                                />
                              </span>
                              {isSNSelected && <Check className="size-3 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              );
            }

            // ─── lot_non_serialized: qty stepper for the focused location ───
            const qty = lotSelections[key] ?? 0;
            const isSelected = key in lotSelections;
            const maxForThis = Math.min(available, remaining - totalNewlyAllocated + qty);
            return (
              <>
                <div className="shrink-0 px-4 py-3 border-b border-border">
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 size-9 rounded-md bg-primary/12 flex items-center justify-center">
                      <MapPin className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col leading-tight gap-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-foreground font-sans truncate" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}>{focusedLoc.locationCode}</span>
                        <span
                          className="shrink-0 inline-flex items-center px-1.5 rounded-full font-sans"
                          style={{
                            fontSize: 10,
                            fontWeight: "var(--font-weight-semibold)",
                            background: lotStatus === "Active" ? "#ECFDF5" : "#FEF2F2",
                            color: lotStatus === "Active" ? "#065F46" : "#991B1B",
                            border: `1px solid ${lotStatus === "Active" ? "#A7F3D0" : "#FECACA"}`,
                            lineHeight: "16px",
                            minHeight: 16,
                          }}
                        >
                          {lotStatus}
                        </span>
                      </div>
                      <span className="text-muted-foreground font-sans truncate" style={{ fontSize: "var(--text-2xs)" }}>{getLocationAddress(focusedLoc.locationCode)}</span>
                    </div>
                    <div
                      className="shrink-0 flex flex-col items-end px-3 py-1.5 rounded-md leading-tight"
                      style={{
                        background: "var(--secondary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span
                        className="font-sans"
                        style={{
                          fontSize: "var(--text-sm)",
                          fontWeight: "var(--font-weight-semibold)",
                          color: "var(--foreground)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {qty.toLocaleString()} / {available.toLocaleString()} {uom}
                      </span>
                      <span
                        className="font-sans"
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: "var(--muted-foreground)",
                        }}
                      >
                        to allocate
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 flex flex-col items-center justify-center gap-3">
                  <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>
                    Qty from this location
                  </span>
                  <div className="inline-flex items-center border border-border rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.max(0, qty - 1);
                        if (next === 0 && isSelected) onToggleLot(key, available);
                        else onLotQtyChange(key, next, available);
                      }}
                      disabled={qty <= 0}
                      className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Minus className="size-3" />
                    </button>
                    <input
                      type="number"
                      value={qty || ""}
                      placeholder="0"
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, maxForThis));
                        if (val > 0 && !isSelected) onToggleLot(key, available);
                        onLotQtyChange(key, val, available);
                        if (val === 0 && isSelected) onToggleLot(key, available);
                      }}
                      className="w-12 h-8 text-center bg-background text-foreground font-sans outline-none border-x border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = Math.min(qty + 1, maxForThis);
                        if (next > 0 && !isSelected) onToggleLot(key, available);
                        else if (next > 0) onLotQtyChange(key, next, available);
                      }}
                      disabled={qty >= maxForThis}
                      className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSelected) onToggleLot(key, available);
                      onLotQtyChange(key, Math.max(0, maxForThis), available);
                    }}
                    disabled={maxForThis <= 0}
                    className="text-primary hover:text-primary/80 font-sans transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
                  >
                    Allocate max ({maxForThis})
                  </button>
                </div>
              </>
            );
          })()
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)" }}>
            Select a location from the left.
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Lot-Specific Panel — grouped by LOT with "View Locations"
   ═══════════════════════════════════════════════════════ */

function LotPanel({ lineItem, remaining, lotSelections, onToggleLot, onLotQtyChange, onClearAllLots, removals, onToggleRemoval, searchFilter }: {
  lineItem: LineItem; remaining: number; lotSelections: Record<string, number>; onToggleLot: (key: string, onHand: number) => void; onLotQtyChange: (key: string, qty: number, onHand: number) => void; onClearAllLots: () => void; removals?: Set<string>; onToggleRemoval?: (key: string) => void; searchFilter?: string;
}) {
  const allLots = useMemo(() => generateLotsForItem(lineItem), [lineItem]);
  const [search, setSearch] = useState("");

  // Group by lot number → list of locations
  const groupedByLot = useMemo(() => {
    const m = new Map<string, LotAtLocation[]>();
    for (const l of allLots) {
      const a = m.get(l.lotNumber) ?? [];
      a.push(l);
      m.set(l.lotNumber, a);
    }
    return m;
  }, [allLots]);
  const lotNumbers = useMemo(() => Array.from(groupedByLot.keys()), [groupedByLot]);
  const effectiveLotSearch = searchFilter || search;
  const filteredLots = lotNumbers.filter((lot) => {
    if (!effectiveLotSearch) return true;
    const q = effectiveLotSearch.toLowerCase();
    if (lot.toLowerCase().includes(q)) return true;
    return (groupedByLot.get(lot) ?? []).some((l) => l.locationCode.toLowerCase().includes(q));
  });
  // Only show lots with available qty > 0
  const availableLots = filteredLots.filter((lot) => {
    const entries = groupedByLot.get(lot) ?? [];
    return entries.some((e) => e.onHand - e.alreadyAllocated > 0);
  });
  const totalNewlyAllocated = Object.values(lotSelections).reduce((s, v) => s + v, 0);
  const [viewingLot, setViewingLot] = useState<string | null>(null);
  const viewingLocations = viewingLot ? (groupedByLot.get(viewingLot) ?? []) : [];
  // Serial selection state for lot_serialized in By Lot tab
  const isLotSerialized = lineItem.inventoryType === "lot_serialized";
  const [lotPanelSerials, setLotPanelSerials] = useState<Set<string>>(new Set());
  const toggleLotPanelSerial = (sn: string, _locCode: string) => {
    setLotPanelSerials((prev) => {
      const next = new Set(prev);
      if (next.has(sn)) next.delete(sn); else next.add(sn);
      return next;
    });
  };

  /** Set lot-level qty by distributing across its locations automatically */
  const setLotLevelQty = (lotNum: string, targetQty: number) => {
    const entries = groupedByLot.get(lotNum) ?? [];
    // Clear existing selections for this lot, then redistribute
    let rem = Math.max(0, targetQty);
    for (const e of entries) {
      const key = `${e.locationCode}::${lotNum}`;
      const available = Math.max(0, e.onHand - e.alreadyAllocated);
      const wasSelected = (lotSelections[key] ?? 0) > 0;
      const alloc = Math.min(available, rem);
      if (alloc > 0) {
        if (!wasSelected) onToggleLot(key, available);
        onLotQtyChange(key, alloc, available);
        rem -= alloc;
      } else if (wasSelected) {
        onToggleLot(key, available); // deselect
      }
    }
  };

  return (
    <div className="flex flex-col">
      <div className="px-5 pb-1.5 space-y-1.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lots or locations..." className="pl-9 h-9 rounded-lg font-sans border-border text-foreground placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-2" style={{ fontSize: 13, backgroundColor: "#FFFFFF" }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>{availableLots.length} lots available</span>
          {totalNewlyAllocated > 0 && (
            <button type="button" onClick={onClearAllLots} className="text-muted-foreground hover:text-chart-1 font-sans transition-colors cursor-pointer" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>
              Undo All
            </button>
          )}
        </div>
      </div>
      {/* Partners single-table chrome (SalesOrdersTable.tsx pattern):
          one rounded-lg bordered container wraps a tinted header row plus
          all data rows. Dividers between rows are border-b — no individual
          card borders — so the header and rows read as one unit. */}
      <div className="px-5 pb-2">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
            <span className="flex-1 min-w-0 font-sans pl-10" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Lot</span>
            <span className="shrink-0 w-[88px] text-right font-sans" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Available</span>
            <span className="shrink-0 w-[100px] text-center font-sans" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Qty from this lot</span>
            <span className="shrink-0 w-[96px]" />
          </div>
          {availableLots.map((lotNum, idx) => {
            const entries = groupedByLot.get(lotNum) ?? [];
            const totalAvailable = entries.reduce((s, e) => s + Math.max(0, e.onHand - e.alreadyAllocated), 0);
            const locationCount = entries.length;
            // Check if any location of this lot is selected
            const lotSelectedQty = entries.reduce((s, e) => s + (lotSelections[`${e.locationCode}::${lotNum}`] ?? 0), 0);
            const hasSelection = lotSelectedQty > 0;
            const maxLotAlloc = Math.min(totalAvailable, remaining - totalNewlyAllocated + lotSelectedQty);
            return (
              <div
                key={lotNum}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 transition-colors relative",
                  idx < availableLots.length - 1 && "border-b border-border",
                  hasSelection ? "bg-primary/[0.04]" : "hover:bg-muted/30",
                )}
              >
                {/* Selected-row left accent — same pattern as the LocationPanel. */}
                {hasSelection && <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />}
                <div className={cn("shrink-0 size-8 rounded-md flex items-center justify-center", hasSelection ? "bg-accent/12" : "bg-primary/8")}>
                  <Layers className={cn("size-3.5", hasSelection ? "text-accent" : "text-primary/60")} />
                </div>
                <div className="flex-1 min-w-0 flex flex-col leading-tight gap-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-foreground font-sans truncate" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}>
                      <HighlightText text={lotNum} search={effectiveLotSearch} />
                    </span>
                    <span
                      className="shrink-0 inline-flex items-center px-1.5 rounded-full font-sans"
                      style={{
                        fontSize: 10,
                        fontWeight: "var(--font-weight-semibold)",
                        background: "#ECFDF5",
                        color: "#065F46",
                        border: "1px solid #A7F3D0",
                        lineHeight: "14px",
                        minHeight: 14,
                      }}
                    >
                      Active
                    </span>
                  </div>
                  <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)" }}>
                    Across {locationCount} location{locationCount !== 1 ? "s" : ""}
                  </span>
                </div>
                {/* Available value — column header already says "Available". */}
                <div className="shrink-0 w-[88px] text-right">
                  <span className="text-foreground font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
                    {totalAvailable.toLocaleString()} <span className="text-muted-foreground" style={{ fontWeight: 500, fontSize: 10 }}>{lineItem.uom}</span>
                  </span>
                </div>
                {/* Quantity stepper — allocate at lot level from any of its locations */}
                <div className="shrink-0 w-[100px] flex items-center justify-center">
                  <div className="inline-flex items-center border border-foreground/20 rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLotLevelQty(lotNum, Math.max(0, lotSelectedQty - 1))}
                      disabled={lotSelectedQty <= 0}
                      className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Minus className="size-2.5" />
                    </button>
                    <input
                      type="number"
                      value={lotSelectedQty || ""}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setLotLevelQty(lotNum, Math.max(0, Math.min(val, maxLotAlloc)));
                      }}
                      className="w-8 h-6 text-center bg-background text-foreground font-sans outline-none border-x border-foreground/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)", fontVariantNumeric: "tabular-nums" }}
                    />
                    <button
                      type="button"
                      onClick={() => setLotLevelQty(lotNum, Math.min(lotSelectedQty + 1, maxLotAlloc))}
                      disabled={lotSelectedQty >= maxLotAlloc}
                      className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus className="size-2.5" />
                    </button>
                  </div>
                </div>
                <div className="shrink-0 w-[96px] flex justify-end">
                  <button
                    onClick={() => setViewingLot(lotNum)}
                    className="px-1.5 py-0.5 rounded-md border border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10 hover:border-primary/30 font-sans transition-all cursor-pointer whitespace-nowrap"
                    style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}
                  >
                    View Units ({locationCount})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-modal for locations of a lot.
          Why this exists: the lot row in LotPanel has a single qty stepper
          that auto-distributes across the lot's locations. This sub-modal
          lets a user override that and manually pick which locations the
          lot is drawn from (and how much from each). Selections mutate
          the parent's `lotSelections` live, so Done is purely a close
          action that confirms the user is finished editing this lot. */}
      {viewingLot && (() => {
        const selectedLocations = viewingLocations.filter((l) => `${l.locationCode}::${viewingLot}` in lotSelections);
        const selectedCount = isLotSerialized
          ? viewingLocations.reduce((acc, loc) => acc + (loc.serialNumbers ?? []).filter((sn) => lotPanelSerials.has(sn)).length, 0)
          : selectedLocations.reduce((acc, loc) => acc + (lotSelections[`${loc.locationCode}::${viewingLot}`] ?? 0), 0);
        const hasSelection = isLotSerialized ? selectedCount > 0 : selectedLocations.length > 0;
        /* Line-item allocation progress shown inside the sub-modal so users
           know how much of the overall requirement is covered while they pick.
           Mirrors the bar in DetailPanel — same allocBucket palette + chrome.
           `newAllocForItem` aggregates ALL lots (not just the focused one), so
           the bar accurately reflects multi-lot allocations as they accumulate. */
        const newAllocForItem = isLotSerialized ? lotPanelSerials.size : totalNewlyAllocated;
        const effectiveAllocated = lineItem.allocatedQty + newAllocForItem;
        const allocTotal = lineItem.allocatedTotal;
        const progressBucket = allocBucket(effectiveAllocated, allocTotal);
        const progressPct = allocTotal > 0 ? (effectiveAllocated / allocTotal) * 100 : 0;
        /* Distinct-lot counter so the bar's subtitle can call out multi-lot
           coverage explicitly when more than one lot contributes. */
        const lotsCovered = (() => {
          if (isLotSerialized) {
            const out = new Set<string>();
            for (const lot of allLots) {
              if ((lot.serialNumbers ?? []).some((sn) => lotPanelSerials.has(sn))) {
                out.add(lot.lotNumber);
              }
            }
            return out.size;
          }
          const out = new Set<string>();
          for (const [key, qty] of Object.entries(lotSelections)) {
            if (qty > 0) {
              const lotNum = key.split("::")[1];
              if (lotNum) out.add(lotNum);
            }
          }
          return out.size;
        })();
        const otherLotsCount = Math.max(0, lotsCovered - (hasSelection ? 1 : 0));
        return (
        <UnitsSubModal
          open
          onClose={() => setViewingLot(null)}
          title={`Locations for ${viewingLot}`}
          width={880}
        >
          {/* Body: flex column that fills available modal height, with the
              inner two-pane view taking the remainder. No outer scroll on
              the modal body — only the panes inside scroll if needed. */}
          <div className="flex-1 min-h-0 flex flex-col p-4 gap-3 overflow-hidden">
            {/* Allocation progress (line-item scope) — sums across all lots,
                so multi-lot allocations are reflected in real time. */}
            <div className="shrink-0 flex flex-col gap-1.5 px-3 py-2 rounded-lg bg-muted/40 border border-border">
              <div className="flex items-center gap-3">
                <span
                  className="font-sans shrink-0"
                  style={{
                    color: ALLOC_TEXT_COLOR[progressBucket],
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--font-weight-semibold)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {effectiveAllocated.toLocaleString()} / {allocTotal.toLocaleString()} {lineItem.uom}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, progressPct)}%`, backgroundColor: ALLOC_BAR_COLOR[progressBucket] }}
                  />
                </div>
                <span
                  className="font-sans shrink-0"
                  style={{
                    color: ALLOC_TEXT_COLOR[progressBucket],
                    fontSize: "var(--text-2xs)",
                    fontWeight: "var(--font-weight-semibold)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.round(progressPct)}%
                </span>
              </div>
              {/* Multi-lot subtitle — only shown when more than one lot is
                  contributing, so the user can see the bar reflects the whole
                  line item, not just the focused lot. */}
              {lotsCovered > 1 && (
                <span className="text-muted-foreground font-sans" style={{ fontSize: 10, fontWeight: 500 }}>
                  Across {lotsCovered} lots ({selectedCount} {lineItem.uom} from this lot, +{newAllocForItem - selectedCount} {lineItem.uom} from {otherLotsCount} other lot{otherLotsCount !== 1 ? "s" : ""})
                </span>
              )}
            </div>

            {/* Single top-level selection pill — derived from selection state,
                mirrors the Partners FilterPills count chrome. The per-row counts
                inside the left pane are intrinsic state, not a duplicate. */}
            {hasSelection && (
              <div className="shrink-0 flex items-center justify-end gap-2">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full font-sans"
                  style={{
                    fontSize: "var(--text-2xs)",
                    fontWeight: "var(--font-weight-semibold)",
                    background: "rgba(27, 110, 243, 0.10)",
                    color: "var(--primary)",
                  }}
                >
                  {selectedCount} {lineItem.uom} from this lot
                </span>
                <button
                  onClick={() => {
                    if (isLotSerialized) {
                      for (const loc of viewingLocations) {
                        for (const sn of loc.serialNumbers ?? []) {
                          if (lotPanelSerials.has(sn)) toggleLotPanelSerial(sn, loc.locationCode);
                        }
                      }
                    } else {
                      for (const loc of viewingLocations) {
                        const key = `${loc.locationCode}::${viewingLot}`;
                        if (key in lotSelections) onToggleLot(key, loc.onHand - loc.alreadyAllocated);
                      }
                    }
                  }}
                  className="text-muted-foreground hover:text-destructive font-sans transition-colors cursor-pointer"
                  style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
                >
                  Clear all
                </button>
              </div>
            )}

            <LotLocationsView
              lineItem={lineItem}
              viewingLot={viewingLot!}
              viewingLocations={viewingLocations}
              lotSelections={lotSelections}
              totalNewlyAllocated={isLotSerialized ? lotPanelSerials.size : totalNewlyAllocated}
              remaining={remaining}
              onToggleLot={onToggleLot}
              onLotQtyChange={onLotQtyChange}
              selectedSerials={isLotSerialized ? lotPanelSerials : undefined}
              onToggleSerial={isLotSerialized ? toggleLotPanelSerial : undefined}
            />
          </div>
          <div className="shrink-0 px-5 py-3 border-t border-border flex justify-end">
            <button
              onClick={() => setViewingLot(null)}
              className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#0862D0] transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              Done
            </button>
          </div>
        </UnitsSubModal>
        );
      })()}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Serial-Specific Panel — flat list of all serial units
   ═══════════════════════════════════════════════════════ */

function SerialPanel({ lineItem, remaining, selectedSerials, onToggleSerial, onClearAllSerials, removals, onToggleRemoval, searchFilter }: {
  lineItem: LineItem; remaining: number; selectedSerials: Set<string>; onToggleSerial: (sn: string) => void; onClearAllSerials: () => void; removals?: Set<string>; onToggleRemoval?: (key: string) => void; searchFilter?: string;
}) {
  const allSerials = useMemo(() => generateSerialsForItem(lineItem), [lineItem]);
  const [search, setSearch] = useState("");
  const effectiveSearch = searchFilter || search;

  const availableSerials = useMemo(() => allSerials.filter((s) => !s.isAllocated), [allSerials]);
  const allocatedSerials = useMemo(() => allSerials.filter((s) => s.isAllocated), [allSerials]);

  const filtered = useMemo(() => {
    if (!effectiveSearch) return availableSerials;
    const q = effectiveSearch.toLowerCase();
    return availableSerials.filter((s) => s.serialNumber.toLowerCase().includes(q));
  }, [effectiveSearch, availableSerials]);

  const [showAllocated, setShowAllocated] = useState(false);

  return (
    <div className="flex flex-col">
      <div className="px-5 pb-1.5 space-y-1.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search serial numbers..." className="pl-9 h-9 rounded-lg font-sans border-border text-foreground placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-2" style={{ fontSize: 13, backgroundColor: "#FFFFFF" }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>{filtered.length} serial{filtered.length !== 1 ? "s" : ""} available</span>
          {selectedSerials.size > 0 && (
            <button type="button" onClick={onClearAllSerials} className="text-primary hover:text-primary/80 font-sans transition-colors cursor-pointer" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Already allocated section (collapsible) */}
      {allocatedSerials.length > 0 && (
        <div className="px-5 pb-1.5">
          <button type="button" onClick={() => setShowAllocated(!showAllocated)} className="flex items-center gap-1.5 cursor-pointer group mb-1">
            <span className="text-foreground/25 group-hover:text-muted-foreground transition-colors">{showAllocated ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}</span>
            <span className="font-sans" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Already allocated</span>
            <span className="text-foreground/20 font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>({allocatedSerials.length})</span>
          </button>
          {showAllocated && (
            <div className="grid grid-cols-2 gap-1.5">
              {allocatedSerials.map((s) => {
                const removalKey = `alloc-serial::${s.locationCode}::${s.serialNumber}`;
                const isMarkedForRemoval = removals?.has(removalKey);
                return (
                  <div key={s.serialNumber} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border transition-[border-color,background-color,box-shadow,color] duration-300 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1", isMarkedForRemoval ? "bg-chart-3/[0.04] border-chart-3/20" : "border-border/60 bg-secondary/30")}>
                    <Hash className="size-2.5 text-foreground/15 shrink-0" />
                    <span className={cn("flex-1 min-w-0 font-sans truncate", isMarkedForRemoval ? "text-chart-3 line-through" : "text-muted-foreground")} style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}><HighlightText text={s.serialNumber} search={effectiveSearch} /></span>
                    {onToggleRemoval && (
                      <button
                        onClick={() => onToggleRemoval(removalKey)}
                        className={cn("shrink-0 font-sans transition-colors cursor-pointer", isMarkedForRemoval ? "text-chart-1 hover:text-chart-1/80" : "text-muted-foreground hover:text-destructive")}
                        style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
                      >
                        {isMarkedForRemoval ? "Undo" : "Remove"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Available serials — flat grid */}
      <div className="px-5 pb-2">
        {remaining > 0 && (() => {
          const unselected = filtered.filter((s) => !selectedSerials.has(s.serialNumber));
          const allSelected = unselected.length === 0 && filtered.length > 0;
          const canSelect = selectedSerials.size < remaining;
          return (
            <div className="flex items-center justify-end mb-1.5">
              {unselected.length > 0 && canSelect ? (
                <button
                  onClick={() => {
                    let slotsLeft = remaining - selectedSerials.size;
                    for (const s of unselected) {
                      if (slotsLeft <= 0) break;
                      onToggleSerial(s.serialNumber);
                      slotsLeft--;
                    }
                  }}
                  className="px-2 py-1 rounded-md border border-primary/20 bg-primary/[0.04] text-primary hover:bg-primary/10 font-sans transition-all cursor-pointer"
                  style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
                >
                  Select All ({Math.min(unselected.length, remaining - selectedSerials.size)})
                </button>
              ) : allSelected ? (
                <span className="text-accent font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>
                  All Selected
                </span>
              ) : null}
            </div>
          );
        })()}
        <div className="grid grid-cols-2 gap-1.5">
          {filtered.map((s, idx) => {
            const isSelected = selectedSerials.has(s.serialNumber);
            const atLimit = selectedSerials.size >= remaining && !isSelected;
            return (
              <label
                key={s.serialNumber}
                className={cn(
                  // Physical Inventory select-serials chrome: leading index
                  // + checkbox + serial primary + location subtitle. Selected
                  // = primary tint; disabled (at limit) = muted-bg but
                  // legible; default = card.
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-[border-color,background-color,box-shadow,color] duration-300 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
                  isSelected
                    ? "border-primary bg-primary/[0.06] text-primary cursor-pointer"
                    : atLimit
                      ? "border-border bg-secondary/40 text-foreground/40 cursor-not-allowed"
                      : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-[0_0_0_1px_rgba(10,119,255,0.10)] cursor-pointer",
                )}
              >
                <Checkbox checked={isSelected} onCheckedChange={() => onToggleSerial(s.serialNumber)} disabled={atLimit} className="shrink-0" />
                <span
                  className={cn(
                    "shrink-0 font-sans",
                    isSelected ? "text-primary/60" : atLimit ? "text-foreground/30" : "text-muted-foreground",
                  )}
                  style={{ fontSize: 10, fontWeight: 500, fontVariantNumeric: "tabular-nums", minWidth: 22 }}
                >
                  {String(idx + 1).padStart(3, "0")}
                </span>
                <div className="flex-1 min-w-0 flex flex-col leading-tight">
                  <span
                    className={cn("font-sans truncate", isSelected ? "text-primary" : "text-foreground/75")}
                    style={{ fontSize: "var(--text-xs)", fontWeight: isSelected ? "var(--font-weight-semibold)" : "var(--font-weight-medium)" }}
                  >
                    <TruncatedSerial
                      serialNo={s.serialNumber}
                      query={effectiveSearch}
                      isSelected={isSelected}
                      isDisabled={atLimit}
                    />
                  </span>
                  <span
                    className={cn(
                      "font-sans truncate",
                      isSelected ? "text-primary/70" : atLimit ? "text-foreground/30" : "text-muted-foreground",
                    )}
                    style={{ fontSize: 10, fontWeight: 500 }}
                  >
                    {s.locationCode}
                  </span>
                </div>
                {isSelected && <Check className="size-3 text-primary shrink-0" />}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Collapsible "Already Allocated" serials — with un-allocate support */
function AllocatedSerialsToggle({ allocatedSerials, removals, onToggleRemoval }: { allocatedSerials: AvailableSerial[]; removals?: Set<string>; onToggleRemoval?: (key: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const removedCount = removals ? allocatedSerials.filter((s) => removals.has(`alloc-serial::${s.locationCode}::${s.serialNumber}`)).length : 0;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 cursor-pointer group">
          <span className="text-foreground/25 group-hover:text-muted-foreground transition-colors">{expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}</span>
          <span className="font-sans" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Already allocated</span>
          <span className="text-foreground/20 font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>({allocatedSerials.length})</span>
        </button>
        {removedCount > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-chart-3/10 border border-chart-3/20 font-sans text-chart-3 shrink-0" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>
            {removedCount} pending removal
          </span>
        )}
      </div>
      {expanded && (
        <div className="grid grid-cols-2 gap-1.5">
          {allocatedSerials.map((s) => {
            const key = `alloc-serial::${s.locationCode}::${s.serialNumber}`;
            const isRemoved = removals?.has(key) ?? false;
            return (
              <div key={s.serialNumber} className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-md border transition-colors", isRemoved ? "border-chart-3/20 bg-chart-3/[0.03]" : "bg-primary/[0.04] border-primary/12")}>
                <Hash className={cn("size-2.5 shrink-0", isRemoved ? "text-chart-3/40" : "text-primary/40")} />
                <span className={cn("flex-1 font-sans truncate", isRemoved ? "line-through text-muted-foreground" : "text-foreground/50")} style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}>{s.serialNumber}</span>
                {onToggleRemoval && (
                  <button
                    onClick={() => onToggleRemoval(key)}
                    className={cn("shrink-0 px-1.5 py-0.5 rounded-md font-sans transition-colors cursor-pointer border", isRemoved ? "border-chart-1/20 text-chart-1 hover:bg-chart-1/[0.06]" : "border-destructive/20 text-destructive hover:bg-destructive/[0.06]")}
                    style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
                  >
                    {isRemoved ? "Restore" : "Un-allocate"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Collapsible "Already Allocated" lots — mirrors AllocatedSerialsToggle for consistency */
function AllocatedLotsToggle({ allocatedLots, locationCode, removals, onToggleRemoval, uom = "EA" }: { allocatedLots: LotAtLocation[]; locationCode: string; removals?: Set<string>; onToggleRemoval?: (key: string) => void; uom?: string }) {
  const [expanded, setExpanded] = useState(false);
  const removedCount = removals ? allocatedLots.filter((l) => removals.has(`alloc-lot::${locationCode}::${l.lotNumber}`)).length : 0;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 cursor-pointer group">
          <span className="text-foreground/25 group-hover:text-muted-foreground transition-colors">{expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}</span>
          <span className="font-sans" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>Already allocated</span>
          <span className="text-foreground/20 font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-medium)" }}>({allocatedLots.length} lots)</span>
        </button>
        {removedCount > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-chart-3/10 border border-chart-3/20 font-sans text-chart-3 shrink-0" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>
            {removedCount} pending removal
          </span>
        )}
      </div>
      {expanded && (
        <div className="space-y-1">
          {allocatedLots.map((lot) => {
            const key = `alloc-lot::${locationCode}::${lot.lotNumber}`;
            const isRemoved = removals?.has(key) ?? false;
            return (
              <div key={lot.lotNumber} className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors", isRemoved ? "border-chart-3/20 bg-chart-3/[0.03]" : "bg-primary/[0.04] border-primary/12")}>
                <Layers className={cn("size-3 shrink-0", isRemoved ? "text-chart-3/40" : "text-primary/40")} />
                <span className={cn("flex-1 font-sans truncate", isRemoved ? "line-through text-muted-foreground" : "text-foreground/50")} style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}>{lot.lotNumber}</span>
                <span className={cn("font-sans shrink-0", isRemoved ? "line-through text-foreground/20" : "text-muted-foreground")} style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-semibold)" }}>{lot.alreadyAllocated} {uom}</span>
                {onToggleRemoval && (
                  <button
                    onClick={() => onToggleRemoval(key)}
                    className={cn("shrink-0 px-1.5 py-0.5 rounded-md font-sans transition-colors cursor-pointer border", isRemoved ? "border-chart-1/20 text-chart-1 hover:bg-chart-1/[0.06]" : "border-destructive/20 text-destructive hover:bg-destructive/[0.06]")}
                    style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}
                  >
                    {isRemoved ? "Restore" : "Un-allocate"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Right Panel — Detail View
   ═══════════════════════════════════════════════════════ */

function DetailPanel({ lineItem, newAllocated, specificity, onSpecificityChange, qtyOnlyValue, onQtyOnlyChange, allocQtys, lotSelections, selectedSerials, onQtyChange, onToggleLot, onLotQtyChange, onToggleSerial, removals, onToggleRemoval, onUndoAllRemovals, onClearAllLots, onClearAllSerials, onUpgradeToSerial }: {
  lineItem: FlatLineItem; newAllocated: number; specificity: SpecificityLevel; onSpecificityChange: (level: SpecificityLevel) => void; qtyOnlyValue: number; onQtyOnlyChange: (v: number) => void; allocQtys: Record<string, number>; lotSelections: Record<string, number>; selectedSerials: Set<string>; onQtyChange: (loc: string, qty: number) => void; onToggleLot: (key: string, onHand: number) => void; onLotQtyChange: (key: string, qty: number, onHand: number) => void; onToggleSerial: (sn: string) => void; removals: Set<string>; onToggleRemoval: (key: string) => void; onUndoAllRemovals: () => void; onClearAllLots: () => void; onClearAllSerials: () => void; onUpgradeToSerial?: (serials: string[]) => void;
}) {
  const [existingExpanded, setExistingExpanded] = useState(false);
  const [detailSearch, setDetailSearch] = useState("");

  const effectiveAllocated = lineItem.allocatedQty + newAllocated;
  const isFullyAllocated = effectiveAllocated >= lineItem.allocatedTotal;
  const wasAlreadyFullyAllocated = lineItem.allocatedQty >= lineItem.allocatedTotal;
  const remaining = Math.max(0, lineItem.allocatedTotal - lineItem.allocatedQty);
  const remainingToAllocate = Math.max(0, remaining - newAllocated);
  // Hide inventory section only if item was already fully allocated before this session and user hasn't started new allocations
  const showInventorySection = !wasAlreadyFullyAllocated || newAllocated > 0;
  const specificityOptions = getAvailableSpecificities(lineItem.inventoryType);

  return (
    <div className="flex flex-col h-full">
      {/* Item header */}
      <div className="px-5 pt-3 pb-0 shrink-0">
        <div className="flex items-start gap-3.5">
          <div className="shrink-0 size-12 rounded-xl overflow-hidden bg-secondary border border-border">
            <ImageWithFallback src={lineItem.image} alt={lineItem.description} className="size-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-foreground font-sans truncate" style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)" }}>{lineItem.partNumber}</span>
                <InactiveItemPill code={lineItem.partNumber} size="md" />
                <InventoryTypeBadge type={lineItem.inventoryType} />
                <SufficiencyBadge lineItem={lineItem} />
              </div>
              {lineItem.description && (
                <p className="font-sans text-muted-foreground truncate mt-0.5" style={{ fontSize: "var(--text-xs)", lineHeight: "1.4" }}>{lineItem.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <ClipboardList className="size-3 text-foreground/25" />
              <span className="text-muted-foreground font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}>{lineItem.soNumber}</span>
              {lineItem.soDueDate && (
                <>
                  <span className="size-0.5 rounded-full bg-chart-3/40" />
                  <span className="inline-flex items-center gap-1 text-chart-3 font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)" }}>
                    <Clock className="size-3" />
                    Due {new Date(lineItem.soDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats bar — 3 cards: To Ship, Available (total on-hand inventory), Allocated */}
        {(() => {
          const locs = generateLocationsForItem(lineItem);
          const totalOnHand = locs.reduce((s, l) => s + l.onHand, 0);
          return (
            <div className="grid grid-cols-3 gap-1.5 mt-3 mb-2.5">
              <StatCard label="On Hand Available" value={totalOnHand} uom={lineItem.uom} />
              <StatCard label="To Ship" value={lineItem.qtyToShip} uom={lineItem.uom} />
              <StatCard label="Allocated" value={lineItem.allocatedQty} uom={lineItem.uom} />
            </div>
          );
        })()}

        {/* Allocation progress with explicit label so the numbers don't float
            without context. Bucket palette colors track none/partial/complete/over. */}
        {(() => {
          const bucketHeader = allocBucket(effectiveAllocated, lineItem.allocatedTotal);
          const pctRawHeader = lineItem.allocatedTotal > 0 ? (effectiveAllocated / lineItem.allocatedTotal) * 100 : 0;
          const shortRemaining = Math.max(0, lineItem.allocatedTotal - effectiveAllocated);
          return (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground font-sans" style={{ fontSize: 11, fontWeight: 500 }}>
              Allocation progress
            </span>
            <span className="font-sans" style={{ color: ALLOC_TEXT_COLOR[bucketHeader], fontSize: 11, fontWeight: 600 }}>
              {shortRemaining > 0 ? `${shortRemaining.toLocaleString()} ${lineItem.uom} remaining` : "Fully allocated"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="font-sans shrink-0"
              style={{
                color: ALLOC_TEXT_COLOR[bucketHeader],
                fontSize: "var(--text-xs)",
                fontWeight: "var(--font-weight-semibold)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {effectiveAllocated.toLocaleString()} / {lineItem.allocatedTotal.toLocaleString()} {lineItem.uom}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full transition-all duration-300" style={{ width: `${Math.min(100, pctRawHeader)}%`, backgroundColor: ALLOC_BAR_COLOR[bucketHeader] }} />
            </div>
            <span
              className="font-sans shrink-0"
              style={{
                color: ALLOC_TEXT_COLOR[bucketHeader],
                fontSize: "var(--text-2xs)",
                fontWeight: "var(--font-weight-semibold)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(pctRawHeader)}%
            </span>
          </div>
        </div>
          );
        })()}

        {/* Top-level search removed (was duplicating each panel's own search
            input). Each specificity panel renders its contextual search bar
            inside its own header now, so users see the relevant placeholder
            and the search lives next to the rows it filters. */}
        <div className="mt-3" />
      </div>

      <Separator className="shrink-0" />

      {/* Scrollable body — primary action first, reference second.
          Order matters: users open this modal to ALLOCATE. The previous
          ordering placed "Current allocations" first, which read as the
          reason for being here — but it's reference info. Allocate from
          inventory is the actual workspace and now sits on top. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="py-2 flex flex-col gap-2 px-5">
          {/* PRIMARY ACTION: Allocate from inventory. */}
          {showInventorySection && <div
            className="bg-card border border-border rounded-lg overflow-hidden"
            style={{ boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/40 border-b border-border">
              <div className="size-6 rounded-md bg-accent flex items-center justify-center shrink-0">
                <Warehouse className="size-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground font-sans" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{remainingToAllocate > 0 ? "Allocate from inventory" : "Available inventory"}</span>
                  {remainingToAllocate > 0 ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-chart-3/10 text-chart-3 font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>{remainingToAllocate} {lineItem.uom} remaining</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-sans" style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>Fully allocated</span>
                  )}
                </div>
                <span className="font-sans block" style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.3, marginTop: 1 }}>{remainingToAllocate > 0 ? "Choose how to allocate, then pick units from the list below." : "Inventory available at warehouse locations."}</span>
              </div>
            </div>
            <div>
              <div className="pt-2.5">
                {(() => {
                  /* Per-tab counts feed the count chips on the pill tabs (CC pattern).
                     Cheap to compute since each generator already memoises. */
                  const locs = generateLocationsForItem(lineItem);
                  const lots = lineItem.inventoryType === "lot_serialized" || lineItem.inventoryType === "lot_non_serialized" ? generateLotsForItem(lineItem) : [];
                  const lotNumbers = new Set(lots.map((l) => l.lotNumber));
                  const serials = lineItem.inventoryType === "sterilized" ? generateSerialsForItem(lineItem).filter((s) => !s.isAllocated) : [];
                  const tabCounts: Partial<Record<SpecificityLevel, number>> = {
                    location: locs.filter((l) => l.onHand - l.alreadyAllocated > 0).length,
                    lot: lotNumbers.size,
                    serial: serials.length,
                  };
                  return <SpecificitySelector options={specificityOptions} selected={specificity} onSelect={onSpecificityChange} counts={tabCounts} />;
                })()}
              </div>
              {specificity === "qty_only" && <QtyOnlyPanel lineItem={lineItem} remaining={remaining} qtyOnlyValue={remaining > 0 ? qtyOnlyValue : 0} onQtyOnlyChange={remaining > 0 ? onQtyOnlyChange : () => {}} />}
              {specificity === "location" && <LocationPanel lineItem={lineItem} remaining={remaining} allocQtys={remaining > 0 ? allocQtys : {}} onQtyChange={remaining > 0 ? onQtyChange : () => {}} searchFilter={detailSearch} onUpgradeToSerial={onUpgradeToSerial} />}
              {specificity === "lot" && <LotPanel lineItem={lineItem} remaining={remaining} lotSelections={remaining > 0 ? lotSelections : {}} onToggleLot={remaining > 0 ? onToggleLot : () => {}} onLotQtyChange={remaining > 0 ? onLotQtyChange : () => {}} onClearAllLots={remaining > 0 ? onClearAllLots : () => {}} removals={removals} onToggleRemoval={onToggleRemoval} searchFilter={detailSearch} />}
              {specificity === "serial" && <SerialPanel lineItem={lineItem} remaining={remaining} selectedSerials={remaining > 0 ? selectedSerials : new Set()} onToggleSerial={remaining > 0 ? onToggleSerial : () => {}} onClearAllSerials={remaining > 0 ? onClearAllSerials : () => {}} removals={removals} onToggleRemoval={onToggleRemoval} searchFilter={detailSearch} />}
            </div>
          </div>}

          {/* SECONDARY (reference): Current allocations + pending changes.
              Title is "Current allocations" (vs. the "Allocated" stat card
              above, which shows only what's already committed). Sits below
              the primary workspace so it acts as a record, not a gate. */}
          <CardSection
            icon={ClipboardList}
            title="Current allocations"
            subtitle={(() => {
              const soQty = lineItem.allocatedQty;
              const parts: string[] = [];
              if (soQty > 0) parts.push(`${soQty} ${lineItem.uom} committed`);
              if (newAllocated > 0) parts.push(`+${newAllocated} ${lineItem.uom} pending`);
              return parts.length > 0 ? parts.join(" · ") : "Nothing allocated yet.";
            })()}
            expanded={existingExpanded}
            onToggle={() => setExistingExpanded(!existingExpanded)}
            badge={(() => {
              const total = lineItem.allocatedQty + newAllocated;
              if (total === 0) return null;
              return <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-sans", newAllocated > 0 ? "bg-primary/10 text-primary" : "bg-secondary text-foreground/50")} style={{ fontSize: "var(--text-2xs)", fontWeight: "var(--font-weight-semibold)" }}>{total} {lineItem.uom}</span>;
            })()}
          >
            <ExistingAllocDisplay
              lineItem={lineItem}
              removals={removals}
              onToggleRemoval={onToggleRemoval}
              onUndoAllRemovals={onUndoAllRemovals}
              newAllocated={newAllocated}
              specificity={specificity}
              allocQtys={allocQtys}
              lotSelections={lotSelections}
              selectedSerials={selectedSerials}
              qtyOnlyValue={qtyOnlyValue}
            />
          </CardSection>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Empty State
   ═══════════════════════════════════════════════════════ */

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-10">
      <div className="size-16 rounded-2xl bg-secondary/60 flex items-center justify-center"><Layers className="size-7 text-foreground/12" /></div>
      <div className="text-center">
        <span className="text-muted-foreground font-sans block" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)" }}>Select a line item</span>
        <span className="text-foreground/25 font-sans block mt-1.5 max-w-[280px]" style={{ fontSize: "var(--text-sm)", lineHeight: "1.6" }}>Choose an item from the list to view its allocation details and assign inventory from warehouse locations</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Modal
   ═══════════════════════════════════════════════════════ */

interface AllocateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: Shipment;
  onAllocate: (lineItemId: string, additionalQty: number) => void;
}

export function AllocateModal({ open, onOpenChange, shipment, onAllocate }: AllocateModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [specificities, setSpecificities] = useState<Record<string, SpecificityLevel>>({});
  const [qtyOnlyValues, setQtyOnlyValues] = useState<Record<string, number>>({});
  const [allocQtys, setAllocQtys] = useState<Record<string, Record<string, number>>>({});
  const [lotSelections, setLotSelections] = useState<Record<string, Record<string, number>>>({});
  const [serialSelections, setSerialSelections] = useState<Record<string, Set<string>>>({});
  const [removalSelections, setRemovalSelections] = useState<Record<string, Set<string>>>({});

  const allItems = useMemo(() => flattenLineItems(shipment), [shipment]);
  const selectedItem = selectedId ? allItems.find((li) => li.id === selectedId) ?? null : null;

  const pendingDeltas = useMemo(() => {
    const deltas: Record<string, number> = {};
    for (const item of allItems) {
      const spec = specificities[item.id] ?? "qty_only";
      if (spec === "qty_only") { deltas[item.id] = qtyOnlyValues[item.id] ?? 0; }
      else if (spec === "location") { deltas[item.id] = Object.values(allocQtys[item.id] ?? {}).reduce((s, v) => s + v, 0); }
      else if (spec === "lot") { deltas[item.id] = Object.values(lotSelections[item.id] ?? {}).reduce((s, v) => s + v, 0); }
      else if (spec === "serial") { deltas[item.id] = (serialSelections[item.id] ?? new Set()).size; }
    }
    return deltas;
  }, [allItems, specificities, qtyOnlyValues, allocQtys, lotSelections, serialSelections]);

  const totalNewAllocated = Object.values(pendingDeltas).reduce((s, v) => s + v, 0);
  const totalItems = allItems.length;
  const fullyAllocated = allItems.filter((li) => (li.allocatedQty + (pendingDeltas[li.id] ?? 0)) >= li.allocatedTotal).length;
  /* Removals also count as "changes" — without this, staging only
     deallocations leaves the Save CTA disabled because pendingDeltas
     measures additions only. */
  const totalRemovals = useMemo(
    () => Object.values(removalSelections).reduce((s, set) => s + set.size, 0),
    [removalSelections],
  );
  const hasChanges = totalNewAllocated > 0 || totalRemovals > 0;

  // Auto allocate all: for every item, set qty_only to its remaining
  const handleAutoAllocateAll = useCallback(() => {
    const newQtyOnly: Record<string, number> = {};
    const newSpecificities: Record<string, SpecificityLevel> = {};
    for (const item of allItems) {
      const remaining = Math.max(0, item.allocatedTotal - item.allocatedQty);
      if (remaining > 0) {
        newSpecificities[item.id] = "qty_only";
        newQtyOnly[item.id] = remaining;
      }
    }
    setSpecificities((prev) => ({ ...prev, ...newSpecificities }));
    setQtyOnlyValues((prev) => ({ ...prev, ...newQtyOnly }));
    setAllocQtys({});
    setLotSelections({});
    setSerialSelections({});
  }, [allItems]);

  const handleSpecificityChange = (level: SpecificityLevel) => { if (selectedId) setSpecificities((prev) => ({ ...prev, [selectedId]: level })); };
  /* Quantity Only is hard-capped at the line item's remaining requirement.
     Over-allocation is no longer permitted anywhere in this flow. */
  const handleQtyOnlyChange = (v: number) => {
    if (!selectedId || !selectedItem) return;
    const remaining = Math.max(0, selectedItem.allocatedTotal - selectedItem.allocatedQty);
    const clamped = Math.max(0, Math.min(v, remaining));
    setQtyOnlyValues((prev) => ({ ...prev, [selectedId]: clamped }));
  };

  /* Clamping is computed inside the setter so back-to-back stepper writes
     (e.g. setLotLevelQty iterating over multiple locations of one lot)
     see the up-to-date selection sum, not a closure snapshot. Reading
     `lotSelections` / `allocQtys` from the outer scope produced stale totals
     and let one row's qty drift another row's value during rapid edits. */
  const handleQtyChange = (loc: string, qty: number) => {
    if (!selectedId || !selectedItem) return;
    const remaining = Math.max(0, selectedItem.allocatedTotal - selectedItem.allocatedQty);
    setAllocQtys((prev) => {
      const itemQtys = { ...(prev[selectedId] ?? {}) };
      const currentTotal = Object.values(itemQtys).reduce((s, v) => s + v, 0);
      const currentForThis = itemQtys[loc] ?? 0;
      const maxAllow = remaining - currentTotal + currentForThis;
      const clamped = Math.max(0, Math.min(qty, maxAllow));
      if (clamped === 0) delete itemQtys[loc]; else itemQtys[loc] = clamped;
      return { ...prev, [selectedId]: itemQtys };
    });
  };

  const handleToggleLot = (key: string, onHand: number) => {
    if (!selectedId || !selectedItem) return;
    const remaining = Math.max(0, selectedItem.allocatedTotal - selectedItem.allocatedQty);
    setLotSelections((prev) => {
      const itemLots = { ...(prev[selectedId] ?? {}) };
      if (itemLots[key]) {
        delete itemLots[key];
      } else {
        const currentTotal = Object.values(itemLots).reduce((s, v) => s + v, 0);
        itemLots[key] = Math.max(0, Math.min(onHand, remaining - currentTotal));
      }
      return { ...prev, [selectedId]: itemLots };
    });
  };

  const handleLotQtyChange = (key: string, qty: number, onHand: number) => {
    if (!selectedId || !selectedItem) return;
    const remaining = Math.max(0, selectedItem.allocatedTotal - selectedItem.allocatedQty);
    setLotSelections((prev) => {
      const itemLots = { ...(prev[selectedId] ?? {}) };
      const currentTotal = Object.values(itemLots).reduce((s, v) => s + v, 0);
      const currentForThis = itemLots[key] ?? 0;
      const maxAllow = Math.min(onHand, remaining - currentTotal + currentForThis);
      const clamped = Math.max(0, Math.min(qty, maxAllow));
      if (clamped === 0) delete itemLots[key]; else itemLots[key] = clamped;
      return { ...prev, [selectedId]: itemLots };
    });
  };

  const handleToggleSerial = (sn: string) => {
    if (!selectedId || !selectedItem) return;
    const remaining = Math.max(0, selectedItem.allocatedTotal - selectedItem.allocatedQty);
    setSerialSelections((prev) => {
      const current = new Set(prev[selectedId] ?? []);
      if (current.has(sn)) { current.delete(sn); } else { if (current.size >= remaining) return prev; current.add(sn); }
      return { ...prev, [selectedId]: current };
    });
  };

  const handleToggleRemoval = (key: string) => {
    if (!selectedId) return;
    setRemovalSelections((prev) => {
      const current = new Set(prev[selectedId] ?? []);
      if (current.has(key)) { current.delete(key); } else { current.add(key); }
      return { ...prev, [selectedId]: current };
    });
  };

  const handleUndoAllRemovals = () => {
    if (!selectedId) return;
    setRemovalSelections((prev) => ({ ...prev, [selectedId]: new Set() }));
  };

  const handleClearAllLots = () => {
    if (!selectedId) return;
    setLotSelections((prev) => ({ ...prev, [selectedId]: {} }));
  };

  const handleClearAllSerials = () => {
    if (!selectedId) return;
    setSerialSelections((prev) => ({ ...prev, [selectedId]: new Set() }));
  };

  /** Auto-upgrade from location → serial when user explicitly selects serial numbers in the sub-modal */
  const handleUpgradeToSerial = (serials: string[]) => {
    if (!selectedId) return;
    // Switch specificity to serial
    setSpecificities((prev) => ({ ...prev, [selectedId]: "serial" }));
    // Store the selected serial numbers
    setSerialSelections((prev) => ({ ...prev, [selectedId]: new Set(serials) }));
    // Clear location-level allocations since we're now serial-specific
    setAllocQtys((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    // Clear qty_only value
    setQtyOnlyValues((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
  };

  const handleSave = () => {
    for (const [id, delta] of Object.entries(pendingDeltas)) { if (delta > 0) onAllocate(id, delta); }
    setQtyOnlyValues({}); setAllocQtys({}); setLotSelections({}); setSerialSelections({}); setSpecificities({}); setRemovalSelections({});
    onOpenChange(false);
  };

  /* Discard guard — surfaced when the user attempts to close the
     modal after staging any allocation/deallocation. `hasChanges`
     already tracks both additions (pendingDeltas) and removals, so
     we can reuse it as the dirty flag. */
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const requestClose = useCallback(() => {
    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      onOpenChange(false);
    }
  }, [hasChanges, onOpenChange]);
  const confirmDiscard = useCallback(() => {
    /* Drop every staged change so the parent sees a clean close (no
       pending deltas leak into the SO record after a discard). */
    setQtyOnlyValues({}); setAllocQtys({}); setLotSelections({});
    setSerialSelections({}); setSpecificities({}); setRemovalSelections({});
    setShowDiscardConfirm(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const currentNewAllocated = selectedId ? (pendingDeltas[selectedId] ?? 0) : 0;
  const currentSpecificity = selectedId ? (specificities[selectedId] ?? "qty_only") : "qty_only";
  const [autoAllocateOpen, setAutoAllocateOpen] = useState(false);
  const [selectedMethodology, setSelectedMethodology] = useState<string | null>(null);
  /* Full-view toggle — mirrors the Partner-consistent Full view button
     used across other modals in the suite. Ported verbatim from the
     Shipment module's allocate-modal so a user familiar with either
     module gets the same size behaviour. */
  const [isFullScreen, setIsFullScreen] = useState(false);

  const METHODOLOGY_LABELS: Record<string, string> = {
    fifo: "FIFO",
    lifo: "LIFO",
  };

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10001, backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(1px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div
        className="flex flex-col transition-[width,height,max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: isFullScreen ? "calc(100% - 24px)" : "1100px",
          maxWidth: isFullScreen ? "calc(100% - 24px)" : "96vw",
          height: isFullScreen ? "calc(100% - 24px)" : "92vh",
          maxHeight: isFullScreen ? "calc(100% - 24px)" : "920px",
          borderRadius: 12,
          background: "var(--card)",
          boxShadow: "0 24px 64px -12px rgba(15, 23, 42, 0.18), 0 8px 24px -8px rgba(15, 23, 42, 0.12)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="allocate-modal-title"
        aria-describedby="allocate-modal-description"
      >
        {/* Header — Partner-style canonical chrome */}
        <div className="shrink-0 flex items-center gap-3 border-b border-border" style={{ padding: "16px 20px" }}>
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="allocate-modal-title" className="text-foreground" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, margin: 0 }}>Allocate Inventory</h2>
            <p id="allocate-modal-description" style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.3, margin: 0, marginTop: 2 }}>
              Hard-commit inventory to sales-order line items at your chosen specificity level
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 relative">
            {totalNewAllocated > 0 && (
              // Quieter than the Auto Allocate CTA next to it: ghost-style
              // (no border, muted text), with an Undo2 glyph on the left
              // so the affordance is iconographic rather than colour-based.
              // Hover lightens to slate-50, matching the Partner v7 ghost
              // button hover pattern.
              <button
                onClick={() => {
                  setQtyOnlyValues({});
                  setAllocQtys({});
                  setLotSelections({});
                  setSerialSelections({});
                  setSelectedMethodology(null);
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-muted-foreground text-[13px] hover:bg-slate-50 hover:text-foreground transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo All
              </button>
            )}
            <div className="relative">
              {/* Auto-Allocate All — trigger + popover ported verbatim
                  from the Shipment module's allocate-modal so both
                  modules share the same auto-allocate UI. Trigger keeps
                  the Partner-consistent outlined pill chrome; popover
                  is Partners' Partner-level-pricing-rules recipe with
                  a violet-tinted gradient header, white icon chip,
                  Apply / Added chips per row, and a slate footer that
                  carries Undo All + Done. */}
              <button
                type="button"
                onClick={() => setAutoAllocateOpen(!autoAllocateOpen)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                <Zap className="w-3.5 h-3.5" />
                Auto-Allocate All Line Items{selectedMethodology ? ` (${METHODOLOGY_LABELS[selectedMethodology]})` : ""}
                <ChevronDown className={cn("w-3 h-3 transition-transform", autoAllocateOpen && "rotate-180")} />
              </button>
              {autoAllocateOpen && (
                <>
                  <div className="fixed inset-0 z-[55]" onClick={() => setAutoAllocateOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-[260] w-[440px] rounded-2xl border border-[#EEF2F6] bg-white shadow-[0_24px_64px_-16px_rgba(15,23,42,0.22)] overflow-hidden">
                    {/* Header — violet-gradient with white icon chip */}
                    <div
                      className="px-4 pt-3.5 pb-3 border-b border-[#EEF2F6]"
                      style={{ background: "linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 100%)" }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-violet-200 shadow-sm shrink-0">
                          <Zap className="w-3.5 h-3.5 text-violet-700" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-foreground tracking-[-0.005em]" style={{ fontWeight: 600 }}>
                            Pick Allocation Method
                          </p>
                          <p className="text-[11px] text-slate-500 mt-px leading-snug">
                            Pick one method to automatically allocate inventory across all unallocated line items. Selecting a new method replaces the current one.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Body — FIFO / LIFO rows */}
                    <div className="max-h-[380px] overflow-y-auto px-2 py-2 space-y-1">
                      {[
                        {
                          key: "fifo",
                          icon: Clock,
                          label: "FIFO",
                          subtitle: "First In, First Out",
                          desc: "Allocates inventory starting with the oldest stock received. This helps rotate stock evenly and lowers the chance that older items sit unused or become outdated.",
                          pill: { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" },
                        },
                        {
                          key: "lifo",
                          icon: ArrowDownUp,
                          label: "LIFO",
                          subtitle: "Last In, First Out",
                          desc: "Allocates inventory starting with the most recently received stock. This can be useful when newer inventory is easier to access or when older stock does not need to move as quickly.",
                          pill: { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" },
                        },
                      ].map((method) => {
                        const isAdded = selectedMethodology === method.key;
                        const Icon = method.icon;
                        return (
                          <button
                            key={method.key}
                            type="button"
                            onClick={() => {
                              /* Radio semantics — clicking the same
                                 method again clears it, matching the
                                 shipment module's behaviour. */
                              if (isAdded) {
                                setSelectedMethodology(null);
                              } else {
                                setSelectedMethodology(method.key);
                                handleAutoAllocateAll();
                              }
                            }}
                            className={cn(
                              "group w-full flex items-start gap-3 px-2.5 py-2 rounded-xl border transition-all duration-150 text-left cursor-pointer",
                              isAdded
                                ? "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50"
                                : "bg-white border-transparent hover:bg-[#F7FAFE] hover:border-[#E8ECF1]",
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>
                                  {method.subtitle}
                                </p>
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] border shrink-0"
                                  style={{ fontWeight: 600, color: method.pill.text, backgroundColor: method.pill.bg, borderColor: method.pill.border }}
                                >
                                  <Icon className="w-2.5 h-2.5" />
                                  {method.label}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-px leading-snug">
                                {method.desc}
                              </p>
                            </div>
                            {isAdded ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[10px] bg-emerald-500 text-white shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.08)] mt-0.5"
                                style={{ fontWeight: 600 }}
                              >
                                <Check className="w-3 h-3" /> Added
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[10px] bg-white text-primary border border-[#A8D2FF] shrink-0 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors mt-0.5"
                                style={{ fontWeight: 600 }}
                              >
                                <Plus className="w-3 h-3" /> Apply
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Footer — Undo All + Done */}
                    <div className="px-3.5 py-2.5 border-t border-[#EEF2F6] bg-[#FAFBFC] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setQtyOnlyValues({});
                          setAllocQtys({});
                          setLotSelections({});
                          setSerialSelections({});
                          setSelectedMethodology(null);
                        }}
                        disabled={totalNewAllocated === 0 && !selectedMethodology}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-[12px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ fontWeight: 500 }}
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Undo All
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoAllocateOpen(false)}
                        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px] bg-primary text-white hover:bg-[#086AE6] cursor-pointer transition-colors shadow-sm"
                        style={{ fontWeight: 600 }}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Done
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Full view toggle — Partner-consistent outlined pill,
                same chrome as the Auto-Allocate trigger next to it. */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isFullScreen ? "Exit full" : "Full view"}
            </button>
          </div>
        </div>

        {/* Two-panel body */}
        <div className="flex-1 min-h-0 flex">
          <div className="w-[300px] shrink-0 border-r border-border bg-card flex flex-col">
            <LineItemList items={allItems} selectedId={selectedId} onSelect={setSelectedId} search={search} onSearchChange={setSearch} pendingDeltas={pendingDeltas} />
          </div>
          <div className="flex-1 min-w-0 flex flex-col bg-card">
            {selectedItem ? (
              <DetailPanel
                key={selectedItem.id}
                lineItem={selectedItem}
                newAllocated={currentNewAllocated}
                specificity={currentSpecificity}
                onSpecificityChange={handleSpecificityChange}
                qtyOnlyValue={qtyOnlyValues[selectedItem.id] ?? 0}
                onQtyOnlyChange={handleQtyOnlyChange}
                allocQtys={allocQtys[selectedItem.id] ?? {}}
                lotSelections={lotSelections[selectedItem.id] ?? {}}
                selectedSerials={serialSelections[selectedItem.id] ?? new Set()}
                onQtyChange={handleQtyChange}
                onToggleLot={handleToggleLot}
                onLotQtyChange={handleLotQtyChange}
                onToggleSerial={handleToggleSerial}
                removals={removalSelections[selectedItem.id] ?? new Set()}
                onToggleRemoval={handleToggleRemoval}
                onUndoAllRemovals={handleUndoAllRemovals}
                onClearAllLots={handleClearAllLots}
                onClearAllSerials={handleClearAllSerials}
                onUpgradeToSerial={handleUpgradeToSerial}
              />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3 border-t border-border flex items-center gap-4">
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="flex-1 max-w-[180px] h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${totalItems > 0 ? Math.round((fullyAllocated / totalItems) * 100) : 0}%`,
                  backgroundColor: ALLOC_BAR_COLOR[allocBucket(fullyAllocated, totalItems)],
                }}
              />
            </div>
            <span className="font-sans" style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-medium)", color: ALLOC_TEXT_COLOR[allocBucket(fullyAllocated, totalItems)] }}>{fullyAllocated}/{totalItems} items fully allocated</span>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Partner v7 modal-footer chrome ported from
                CreatePartnerModal.tsx:9148+ — raw <button> with explicit
                border/bg/hover so Cancel and Save read consistently with
                every other Partner-style modal. */}
            <button
              onClick={requestClose}
              className="px-4 py-2 rounded-lg border border-border bg-white text-muted-foreground text-[13px] hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#0862D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Check className="size-3.5" />
              Save Allocation
              {totalNewAllocated > 0 && <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-white/15 font-sans" style={{ fontSize: "var(--text-xs)" }}>+{totalNewAllocated}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Discard guard — surfaced when the user attempts to close the
          modal after staging any allocation. Mirrors the Partner
          red-themed discard chrome used elsewhere in the suite. */}
      <ConfirmDiscardModal
        open={showDiscardConfirm}
        onOpenChange={(o) => { if (!o) setShowDiscardConfirm(false); }}
        title="Discard allocation changes?"
        description="Your staged allocations and removals will be cleared. Reopening the modal starts from the saved allocations."
        confirmLabel="Discard changes"
        cancelLabel="Continue editing"
        onConfirm={confirmDiscard}
      />
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════
   SO-facing facade — matches the props used by SODetail
   ═══════════════════════════════════════════════════════ */

interface AllocateInventoryModalProps {
  so: SOSalesOrder;
  onClose: () => void;
  initialLineId?: string;
  singleLineMode?: boolean;
}

export function AllocateInventoryModal({ so, onClose }: AllocateInventoryModalProps) {
  const store = useSOStore();
  const shipment = useMemo(() => adaptSalesOrderToShipment(so), [so]);

  // Inject real SO inventory into the module-level pointer the generators read.
  // Done synchronously so the very first render of the modal already sees real data.
  __SO_INVENTORY__ = store.inventory;
  useEffect(() => {
    __SO_INVENTORY__ = store.inventory;
    return () => { __SO_INVENTORY__ = []; };
  }, [store.inventory]);

  // Buffer pending deltas across multiple onAllocate() calls in one save flow.
  // Modal calls onAllocate() per line synchronously inside handleSave, then onOpenChange(false).
  // We aggregate here so a single store.updateSO() commits them atomically (no stale-closure stomping).
  const pendingRef = useRef<Map<string, number>>(new Map());

  const handleAllocate = useCallback((lineItemId: string, additionalQty: number) => {
    if (additionalQty <= 0) return;
    pendingRef.current.set(lineItemId, (pendingRef.current.get(lineItemId) ?? 0) + additionalQty);
  }, []);

  const handleClose = useCallback((open: boolean) => {
    if (open) return;
    const pending = pendingRef.current;
    if (pending.size > 0) {
      const updatedLines = so.lines.map((l) => {
        const delta = pending.get(l.id) ?? 0;
        if (delta <= 0) return l;
        const newAlloc = {
          id: `ALC-${Date.now()}-${l.id.slice(-4)}-${Math.random().toString(36).slice(2, 5)}`,
          warehouse: l.warehouse || so.warehouse,
          qty: delta,
          locked: false,
        };
        return { ...l, allocatedQty: l.allocatedQty + delta, allocations: [...l.allocations, newAlloc] };
      });
      store.updateSO(so.id, { lines: updatedLines });
      pendingRef.current = new Map();
      toast.success(`Allocation saved. ${Array.from(pending.values()).reduce((s, v) => s + v, 0)} EA committed.`);
    }
    onClose();
  }, [so, store, onClose]);

  return (
    <AllocateModal
      open
      onOpenChange={handleClose}
      shipment={shipment}
      onAllocate={handleAllocate}
    />
  );
}
