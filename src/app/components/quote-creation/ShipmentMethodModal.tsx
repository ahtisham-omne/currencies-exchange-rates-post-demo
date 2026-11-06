// @ts-nocheck
/**
 * ShipmentMethodModal — shared shipment editor used by the SO sidebar
 * (defaults applied to every line) and the line-item configurator
 * (per-line overrides). Chrome mirrors Partner Management's "Add
 * Freight & Logistics" modal: white header strip with title chip,
 * #FAFBFC body, white card stack, footer with Cancel/Save.
 *
 * Hierarchy is explicit:
 *   STEP 1 — Method (3 cards, no self-managed delivery)
 *   STEP 2 — Locations (single selected-card tile + Change CTA → opens
 *            the existing LocationSelectionModal; conditional on
 *            method)
 *   STEP 3 — Freight Shipping Method (only for courier methods) — uses
 *            the Partner-style CarrierShippingCard inline, with a
 *            "Change Freight Shipping Method" button that opens a modal
 *            stocked with the same Partner cards plus inline radio
 *            method selection
 *   STEP 4 — Customer Pickup details (only for customer-pickup)
 *   STEP 5 — Dates (editable inputs; the saved values feed the
 *            quote/SO timeline at the parent level)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  X, Truck, MapPin, Package, Check, Calendar as CalendarIcon, ChevronRight,
  ShieldCheck, Clock, FileText, Phone, User, Users, Hash, RefreshCw, Star, Search, DollarSign,
  Pencil, Plus, ArrowRight, Building2, GitBranch, ChevronLeft, Maximize2, Minimize2,
} from "lucide-react";
import { DatePickerField, TimePickerField } from "./date-picker-field";
import { LocationSelectionModal, type Location as LocationOption } from "./LocationSelectionModal";
import {
  WarehouseSelectionModal,
  WAREHOUSES,
  findWarehouseById,
  getDefaultPickupSelection,
  getWarehouseNamesForSelection,
  type WarehousePickupSelection,
} from "./WarehouseSelectionModal";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { ChevronDown } from "lucide-react";
import { ConfirmationModal } from "@/app/components/ConfirmationModal";

/* ── Catalog data ───────────────────────────────────────────── */

/* "courier-dropby" (Carrier Drop-off) is a valid method on the type
   so saved configs keep parsing, but we hide it from the picker
   list — the flow is paused while the back-office side is being
   refined. Restore by adding it back to SHIPMENT_METHOD_OPTIONS. */
export type ShipmentMethodId = "courier-pickup" | "courier-dropby" | "customer-pickup";

export const SHIPMENT_METHOD_OPTIONS: Array<{
  id: ShipmentMethodId;
  name: string;
  description: string;
  icon: "truck-in" | "truck-out" | "user";
  dateLabel: string;
  productionDays: number;
}> = [
  {
    id: "courier-pickup",
    name: "Carrier Pickup",
    description: "Carrier collects from our facility",
    icon: "truck-in",
    dateLabel: "Pick Up Date",
    productionDays: 2,
  },
  {
    id: "customer-pickup",
    name: "Customer Pickup",
    description: "Customer collects from our facility",
    icon: "user",
    dateLabel: "Pick Up Date",
    productionDays: 1,
  },
];

export type CarrierMethod = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  minDays: number;
  maxDays: number;
  isDefault: boolean;
};

export type Carrier = {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  isDefault: boolean;
  methods: CarrierMethod[];
};

// Customer-side Freight & Logistics roster — mirrors what the Partner
// module shows on the Customer Freight & Logistics tab so the picker
// reads as the same data set.
export const SHIPMENT_CARRIERS: Carrier[] = [
  {
    id: "fl-c-1",
    name: "DHL Express",
    description: "Door-to-door international express for outbound deliveries",
    status: "active",
    isDefault: true,
    methods: [
      { id: "flc1-m1", name: "DHL Express Worldwide", shortName: "Air", description: "Premium worldwide express service.", minDays: 2, maxDays: 4, isDefault: true },
      { id: "flc1-m2", name: "DHL Economy Select", shortName: "Ground", description: "Affordable ground freight.", minDays: 5, maxDays: 8, isDefault: false },
    ],
  },
  {
    id: "fl-c-2",
    name: "Aramex",
    description: "Express delivery + logistics for the Middle East and South Asia",
    status: "active",
    isDefault: false,
    methods: [
      { id: "flc2-m1", name: "Aramex Express", shortName: "Air", description: "International express delivery.", minDays: 3, maxDays: 7, isDefault: true },
      { id: "flc2-m2", name: "Aramex Domestic", shortName: "Ground", description: "In-country domestic delivery.", minDays: 1, maxDays: 3, isDefault: false },
    ],
  },
  {
    id: "fl-c-3",
    name: "USPS Priority Mail",
    description: "Domestic ground network for low-cost outbound parcels",
    status: "active",
    isDefault: false,
    methods: [
      { id: "flc3-m1", name: "USPS Priority", shortName: "Ground", description: "2–3 day domestic priority shipping.", minDays: 2, maxDays: 3, isDefault: true },
    ],
  },
  {
    id: "fl-c-4",
    name: "Blue Dart",
    description: "Domestic express courier — South Asia regional coverage",
    status: "active",
    isDefault: false,
    methods: [
      { id: "flc4-m1", name: "Blue Dart Apex", shortName: "Air", description: "Same-day to 24-hour delivery.", minDays: 0, maxDays: 1, isDefault: true },
    ],
  },
  {
    id: "fl-c-5",
    name: "FedEx Freight",
    description: "Reliable LTL ground freight across North America",
    status: "active",
    isDefault: false,
    methods: [
      { id: "flc5-m1", name: "FedEx Priority Overnight", shortName: "Air", description: "Next business day delivery.", minDays: 1, maxDays: 1, isDefault: true },
      { id: "flc5-m2", name: "FedEx Ground", shortName: "Ground", description: "Standard ground; widest US coverage.", minDays: 3, maxDays: 5, isDefault: false },
      { id: "flc5-m3", name: "FedEx Freight LTL", shortName: "Freight", description: "Less-than-truckload palletized freight.", minDays: 5, maxDays: 8, isDefault: false },
    ],
  },
];

/* Module-level store for custom carriers added via the picker's
   green "+ Add Customer Freight & Logistics" button. The picker
   seeds its local state from this array on mount; new carriers are
   pushed back into the store on save so they survive across modal
   close + re-open within the same session. */
const CUSTOM_CARRIERS_STORE: Carrier[] = [];

const WAREHOUSE_LOCATIONS: LocationOption[] = [
  { id: "wh-001", name: "Conversion Plant — OH", address: "4200 Industrial Pkwy", city: "Columbus", state: "Ohio", country: "United States", isDefault: true,  status: "active", contacts: 18, items: 312, pocCount: 4, primaryContact: "Jane Ellison",  image: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&h=200&fit=crop",  createdBy: { name: "Sarah Chen",     initials: "SC", bgColor: "#DCFCE7", fgColor: "#166534" }, lastUpdated: "Apr 12, 2026" },
  { id: "wh-002", name: "Assembly Center — PA", address: "1800 Lancaster Ave", city: "Lancaster", state: "Pennsylvania", country: "United States", isDefault: false, status: "active", contacts: 12, items: 240, pocCount: 3, primaryContact: "Robert Johnson", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=200&fit=crop", createdBy: { name: "Maria Garcia",   initials: "MG", bgColor: "#E0E7FF", fgColor: "#3730A3" }, lastUpdated: "Mar 02, 2026" },
  { id: "wh-003", name: "South Build Facility — TX", address: "9500 W Commerce St", city: "San Antonio", state: "Texas", country: "United States", isDefault: false, status: "active", contacts: 22, items: 401, pocCount: 5, primaryContact: "Marcus Webb",    image: "https://images.unsplash.com/photo-1601598851547-4302969d0614?w=400&h=200&fit=crop", createdBy: { name: "Lisa Anderson",  initials: "LA", bgColor: "#FEF3C7", fgColor: "#92400E" }, lastUpdated: "Feb 18, 2026" },
  { id: "wh-004", name: "North Bay Cross-dock — WA", address: "210 Marine View Dr",  city: "Tacoma",   state: "Washington",   country: "United States", isDefault: false, status: "active", contacts: 6,  items: 158, pocCount: 2, primaryContact: "Anna Kim",       image: "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=400&h=200&fit=crop", createdBy: { name: "Maria Garcia",   initials: "MG", bgColor: "#E0E7FF", fgColor: "#3730A3" }, lastUpdated: "Jan 28, 2026" },
  { id: "wh-005", name: "Midwest Returns Hub — IL",  address: "880 Logistics Blvd",  city: "Joliet",   state: "Illinois",     country: "United States", isDefault: false, status: "active", contacts: 9,  items: 196, pocCount: 2, primaryContact: "Tom Mitchell",   image: "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=400&h=200&fit=crop", createdBy: { name: "Sarah Chen",     initials: "SC", bgColor: "#DCFCE7", fgColor: "#166534" }, lastUpdated: "Dec 15, 2025" },
];

const CARRIER_HUB_LOCATIONS: LocationOption[] = [
  { id: "hub-fed-cmh",  name: "FedEx Freight — Columbus Hub", address: "3050 Westbelt Dr", city: "Columbus",    state: "Ohio",         country: "United States", isDefault: true,  status: "active", contacts: 0, items: 0, pocCount: 0, primaryContact: "—", image: "https://images.unsplash.com/photo-1565891741441-64926e441838?w=400&h=200&fit=crop", createdBy: { name: "System", initials: "SY", bgColor: "#DBEAFE", fgColor: "#1E40AF" }, lastUpdated: "Apr 30, 2026" },
  { id: "hub-ups-lnc",  name: "UPS Customer Center — Lancaster", address: "1601 Old Philadelphia Pike", city: "Lancaster", state: "Pennsylvania", country: "United States", isDefault: false, status: "active", contacts: 0, items: 0, pocCount: 0, primaryContact: "—", image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=200&fit=crop", createdBy: { name: "System", initials: "SY", bgColor: "#DBEAFE", fgColor: "#1E40AF" }, lastUpdated: "Apr 30, 2026" },
  { id: "hub-dhl-sat",  name: "DHL Service Point — San Antonio", address: "100 NE Loop 410",  city: "San Antonio", state: "Texas",        country: "United States", isDefault: false, status: "active", contacts: 0, items: 0, pocCount: 0, primaryContact: "—", image: "https://images.unsplash.com/photo-1605647540924-852290f6b0d5?w=400&h=200&fit=crop", createdBy: { name: "System", initials: "SY", bgColor: "#DBEAFE", fgColor: "#1E40AF" }, lastUpdated: "Apr 30, 2026" },
  { id: "hub-usps-tac", name: "USPS Regional — Tacoma",       address: "1801 S Lawrence St", city: "Tacoma",     state: "Washington",   country: "United States", isDefault: false, status: "active", contacts: 0, items: 0, pocCount: 0, primaryContact: "—", image: "https://images.unsplash.com/photo-1601598851547-4302969d0614?w=400&h=200&fit=crop", createdBy: { name: "System", initials: "SY", bgColor: "#DBEAFE", fgColor: "#1E40AF" }, lastUpdated: "Apr 30, 2026" },
];

function findWarehouse(id?: string): LocationOption | undefined {
  return WAREHOUSE_LOCATIONS.find((l) => l.id === id);
}
function findHub(id?: string): LocationOption | undefined {
  return CARRIER_HUB_LOCATIONS.find((l) => l.id === id);
}

export type Poc = { id: string; name: string; role: string; phone: string };

export const VEHICLE_TYPES = [
  "Pickup Truck",
  "Box Truck",
  "Van",
  "Flatbed",
  "Tractor-Trailer",
  "Customer Carrier (3PL)",
] as const;
export type VehicleType = typeof VEHICLE_TYPES[number];

/* ── Shipment shape (kept stable for callers) ───────────────── */

export interface ShipmentConfig {
  method: ShipmentMethodId;

  // courier methods
  carrierId?: string;
  carrierMethodId?: string;

  // courier-pickup + customer-pickup: where carrier/customer collects.
  // The new field carries a warehouse + nested-location path. The
  // legacy string id is kept on the type so persisted older configs
  // still parse cleanly; readers should prefer `pickupLocation`.
  pickupLocation?: WarehousePickupSelection;
  /** @deprecated Use `pickupLocation`. */
  pickupLocationId?: string;
  // courier-dropby: where we drop off (carrier hub)
  dropoffLocationId?: string;

  // customer-pickup details
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  authorizedPersonName?: string;
  authorizedPersonPhone?: string;
  authorizedPocId?: string;
  idVerificationRequired?: boolean;
  vehicleType?: VehicleType;
  vehiclePlateOrDot?: string;
  customerCarrierName?: string;
  bolReference?: string;
  specialInstructions?: string;

  // dates (ISO yyyy-mm-dd; empty string = auto-compute). When the
  // user opts into a range for "Estimated Delivery", the second
  // bound lands in `estimatedDeliveryDateEnd`. Absence of the
  // second bound means single-date mode (back-compat with older
  // saved configs).
  expectedShipDate?: string;
  estimatedDeliveryDate?: string;
  estimatedDeliveryDateEnd?: string;

  /* Shipment cost (USD). At the quote/SO level this is the default
     freight charge for the order. At the line level it overrides
     the quote default for that one line. Aggregation rule lives in
     `sumLineShipmentCosts` below: if any line carries a numeric
     cost, the sum of line costs replaces the quote-level total in
     the summary. */
  shipmentCost?: number;
}

export const DEFAULT_SHIPMENT: ShipmentConfig = {
  method: "courier-pickup",
  carrierId: SHIPMENT_CARRIERS[0].id,
  carrierMethodId: SHIPMENT_CARRIERS[0].methods.find((m) => m.isDefault)!.id,
  pickupLocation: getDefaultPickupSelection(),
  dropoffLocationId: CARRIER_HUB_LOCATIONS[0].id,
  /* Off by default — operators can opt in per-shipment when the
     pickup actually needs ID verification. Forcing it on for every
     draft created friction in the customer-pickup flow. */
  idVerificationRequired: false,
  vehicleType: "Pickup Truck",
  expectedShipDate: "",
  estimatedDeliveryDate: "",
  shipmentCost: undefined,
};

/* Aggregate per-line shipment costs into a single quote/SO-level
   total. Returns `undefined` when no line carries a numeric cost —
   the caller should fall back to the order-level shipmentCost in
   that case. As soon as ANY line specifies a cost, the sum across
   lines wins (lines without a cost contribute 0). */
export function sumLineShipmentCosts(lineShipments: Array<ShipmentConfig | undefined>): number | undefined {
  const numericLines = lineShipments.filter((s) => typeof s?.shipmentCost === "number");
  if (numericLines.length === 0) return undefined;
  return lineShipments.reduce((acc, s) => acc + (typeof s?.shipmentCost === "number" ? s.shipmentCost : 0), 0);
}

/* ── Helpers ────────────────────────────────────────────────── */

/* Deep-equality for pickup selections — both selections deferred
   counts as equal; one set + the other unset counts as different.
   Used to decide whether the scope-confirmation modal should fire. */
function pickupSelectionsEqual(a?: WarehousePickupSelection, b?: WarehousePickupSelection): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.warehouseIds.length !== b.warehouseIds.length) return false;
  return a.warehouseIds.every((id, i) => id === b.warehouseIds[i]);
}

function getCarrier(id?: string): Carrier | undefined {
  return SHIPMENT_CARRIERS.find((c) => c.id === id);
}
function getCarrierMethod(c?: Carrier, mId?: string): CarrierMethod | undefined {
  if (!c) return undefined;
  return c.methods.find((m) => m.id === mId) ?? c.methods.find((m) => m.isDefault);
}
function fmtDateRange(min: number, max: number): string {
  if (min === max) return `${min} day${min === 1 ? "" : "s"}`;
  return `${min}–${max} days`;
}
function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start); let added = 0;
  while (added < days) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) added += 1; }
  return d;
}
/* Extract up to two uppercase initials from a free-form label.
   Used by the item summary card to render an avatar tile when the
   caller only provides a name string (no thumbnail). Mirrors the
   Partner item-row pattern used elsewhere in the app. */
function initialsFromLabel(label: string): string {
  const cleaned = label.replace(/[^A-Za-z0-9 ]/g, " ").trim();
  if (!cleaned) return "—";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const second = parts[1]?.charAt(0) ?? "";
  const combined = (first + second).toUpperCase();
  return combined || cleaned.slice(0, 2).toUpperCase();
}

function toIso(d: Date): string {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromIso(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function fmtShortDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* Countdown label for the Pick Up Date helper row. Mirrors the
   "X days left" copy the user expects: returns "Picks up today",
   "Tomorrow", "N days left", or "N months left" for further
   horizons; "Picked up N days ago" once the date is in the past. */
function pickupCountdownLabel(iso: string): string {
  if (!iso) return "";
  const target = fromIso(iso);
  if (!target) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  const days = Math.round((t.getTime() - today.getTime()) / 86400000);
  if (days === 0) return "Picks up today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Picked up yesterday";
  if (days > 0) {
    if (days >= 60) return `${Math.round(days / 30)} months left`;
    return `${days} days left`;
  }
  return `Picked up ${Math.abs(days)} days ago`;
}

/* ── Public describe (used by sidebars + line tables) ───────── */

export function describeShipment(s: ShipmentConfig | undefined): { primary: string; secondary?: string } {
  if (!s) return { primary: "—" };
  const method = SHIPMENT_METHOD_OPTIONS.find((m) => m.id === s.method);
  if (!method) return { primary: "—" };
  if (s.method === "customer-pickup") {
    // Selection can now carry multiple warehouses. When more than
    // one is set, fall back to a count summary; when none is set
    // the line is intentionally deferred.
    const names = getWarehouseNamesForSelection(s.pickupLocation);
    let loc: string | undefined;
    if (names.length === 1) loc = names[0];
    else if (names.length > 1) loc = `${names.length} locations`;
    else if (s.pickupLocationId) loc = findWarehouse(s.pickupLocationId)?.name;
    return { primary: method.name, secondary: loc ? `From ${loc}` : undefined };
  }
  const c = getCarrier(s.carrierId);
  const m = getCarrierMethod(c, s.carrierMethodId);
  return {
    primary: method.name,
    secondary: c && m ? `${c.name} · ${m.shortName}` : c?.name,
  };
}

/* Return the saved-or-computed ship/delivery dates for a shipment
   config. Used by the parent timeline builders so the sidebar shows
   real customer-facing dates instead of hardcoded mocks. When the
   user hasn't pinned a date, the function falls back to today +
   production + transit days. */
export function getShipmentDates(s: ShipmentConfig | undefined, today: Date = new Date()): { shipBy: Date; deliveryMin: Date; deliveryMax: Date } {
  const method = SHIPMENT_METHOD_OPTIONS.find((m) => m.id === s?.method) ?? SHIPMENT_METHOD_OPTIONS[0];
  const shipBy = (s && fromIso(s.expectedShipDate || "")) ?? addBusinessDays(today, method.productionDays);
  const isCustomerPickup = s?.method === "customer-pickup";
  let transitMin = 0; let transitMax = 0;
  if (!isCustomerPickup && s) {
    const c = getCarrier(s.carrierId);
    const m = getCarrierMethod(c, s.carrierMethodId);
    if (m) { transitMin = m.minDays; transitMax = m.maxDays; }
  }
  const pinned = s && fromIso(s.estimatedDeliveryDate || "");
  const deliveryMin = pinned ?? (isCustomerPickup ? shipBy : addBusinessDays(shipBy, transitMin));
  const deliveryMax = pinned ?? (isCustomerPickup ? shipBy : addBusinessDays(shipBy, transitMax));
  return { shipBy, deliveryMin, deliveryMax };
}

/* ── Top-level modal ────────────────────────────────────────── */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  value: ShipmentConfig;
  onSave: (next: ShipmentConfig) => void;
  scopeLabel?: string;
  pocs?: Poc[];
  isLineOverride?: boolean;
  onResetToDefault?: () => void;
  customerName?: string;
  /** Inventory scope for the warehouse picker — pass the line's
   *  itemCode (per-line) or the quote's full set (order-default).
   *  When omitted, warehouse cards skip the inventory metric. */
  inventoryItemCodes?: string[];
}

export function ShipmentMethodModal({
  isOpen, onClose, value, onSave, scopeLabel, pocs, isLineOverride, onResetToDefault, customerName, inventoryItemCodes,
}: Props) {
  const [draft, setDraft] = useState<ShipmentConfig>(value);
  const [showCarrierPicker, setShowCarrierPicker] = useState(false);
  const [showPickupLocPicker, setShowPickupLocPicker] = useState(false);
  const [showDropoffLocPicker, setShowDropoffLocPicker] = useState(false);
  const [showPocPicker, setShowPocPicker] = useState(false);
  /* Pending-change confirmations. When the picker saves a *real*
     change (i.e. value differs from current AND isn't a deferral), we
     stage the new value here and pop a scope confirmation modal
     instead of patching immediately. Mirrors PartnerPriceChangeModal —
     yellow chrome, icon + copy vary. */
  const [pendingCarrierChange, setPendingCarrierChange] = useState<{ carrierId: string; methodId: string } | null>(null);
  const [pendingPickupChange, setPendingPickupChange] = useState<WarehousePickupSelection | null>(null);
  /* Discard-confirm guard for unsaved freight settings. */
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(value);
      setShowDiscardConfirm(false);
    }
  }, [isOpen, value]);

  if (!isOpen) return null;

  /* Defensive fallback: if a caller hands us a partial ShipmentConfig
     (e.g. only `shipmentCost` set), the `find` would return undefined
     and downstream access to `method.dateLabel` / `method.productionDays`
     blows up the whole modal. Falling back to the first option lets
     the editor render so the user can pick a valid method, instead
     of crashing the page. */
  const method = SHIPMENT_METHOD_OPTIONS.find((m) => m.id === draft.method) ?? SHIPMENT_METHOD_OPTIONS[0];
  const carrier = getCarrier(draft.carrierId);
  const carrierMethod = getCarrierMethod(carrier, draft.carrierMethodId);
  const usesCarrier = draft.method !== "customer-pickup";
  const usesPickupLocation = draft.method === "courier-pickup" || draft.method === "customer-pickup" || draft.method === "courier-dropby";
  const usesDropoffLocation = draft.method === "courier-dropby";
  const isCustomerPickup = draft.method === "customer-pickup";

  /* Pickup selection resolution — read the new `pickupLocation`
     (multi-warehouse array) first and fall through to the legacy
     single-id field by synthesising a one-entry selection. Writes
     use the new field exclusively so the legacy field decays. */
  const pickupSelection: WarehousePickupSelection | undefined =
    draft.pickupLocation
      ?? (draft.pickupLocationId
        ? { warehouseIds: [draft.pickupLocationId] }
        : undefined);
  const pickupWarehouseNames = getWarehouseNamesForSelection(pickupSelection);
  const dropoffLoc = findHub(draft.dropoffLocationId);

  const patch = (p: Partial<ShipmentConfig>) => setDraft((prev) => ({ ...prev, ...p }));

  /* Dirty when the draft differs from the value the modal opened with.
     Drives the close-confirmation guard so the user can't lose unsaved
     freight settings via the backdrop / X / Cancel. */
  const isDirty = JSON.stringify(draft) !== JSON.stringify(value);

  const requestClose = () => {
    if (isDirty) setShowDiscardConfirm(true);
    else onClose();
  };

  /* "Discard changes" path — wipe the draft and dismiss without
     committing through onSave. */
  const handleDiscard = () => {
    setDraft(value);
    setShowDiscardConfirm(false);
    onClose();
  };

  /* "Clear and decide later" path — explicitly hand freight off to the
     shipment team. We commit a cleared shape (no carrier / method /
     freight cost) and close. */
  const handleClearForLater = () => {
    const cleared: ShipmentConfig = {
      ...draft,
      carrierId: undefined,
      carrierMethodId: undefined,
      shipmentCost: 0,
    };
    onSave(cleared);
    setShowDiscardConfirm(false);
    onClose();
  };

  const handleMethodChange = (next: ShipmentMethodId) => {
    setDraft((prev) => ({
      ...prev,
      method: next,
      carrierId: next === "customer-pickup" ? undefined : prev.carrierId ?? SHIPMENT_CARRIERS[0].id,
      carrierMethodId: next === "customer-pickup" ? undefined : prev.carrierMethodId ?? SHIPMENT_CARRIERS[0].methods.find((m) => m.isDefault)?.id,
      pickupLocation: prev.pickupLocation ?? getDefaultPickupSelection(),
      pickupLocationId: undefined,
      dropoffLocationId: next === "courier-dropby" ? prev.dropoffLocationId ?? CARRIER_HUB_LOCATIONS[0].id : undefined,
    }));
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      /* Configurator modal sits at zIndex 11000/12000 and the
         LocationSelectionModal opens at 12100/12101 — the shipment
         modal needs to sit above the configurator and BELOW the
         location picker it spawns so the inner modal layers right. */
      style={{ zIndex: 11500, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={requestClose}
    >
      <div
        className="bg-white flex flex-col"
        style={{
          /* Side-layout: 272-wide method sidebar on the left + linear
             settings column on the right. 1080 leaves ~780 for the
             right column, which is wide enough for the carrier + date
             rows without crowding. Fixed height (not max-) so the modal
             does not resize between methods — the right column uses its
             own scroll when content overflows; short content sits on
             whitespace instead of shrinking the dialog. */
          width: "min(1080px, calc(100% - 32px))",
          height: "min(720px, calc(100vh - 64px))",
          borderRadius: 16,
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header — Partner v7 modal pattern (PartnerGroupDetail
            Modal.tsx:2460). 40-px primary/10 icon tile + 16/17-px
            semibold title + 12-px slate-500 subtitle. Reset-to-default
            stays as an icon button next to the close so the chrome
            doesn't get crowded. */}
        <div className="px-5 pt-4 pb-3.5 shrink-0 bg-white border-b border-[#EEF2F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(10, 119, 255, 0.10)", color: "#0A77FF" }}
              >
                <Truck className="w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-[16px] sm:text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>
                  Freight &amp; Logistics
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                  {isLineOverride
                    ? (scopeLabel ?? "Settings for this line only")
                    : "Default applied to every line on this quote"}
                </p>
              </div>
            </div>
            <div className="flex items-center shrink-0" style={{ gap: 6 }}>
              {isLineOverride && onResetToDefault && (
                <button
                  type="button"
                  onClick={onResetToDefault}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md transition-colors cursor-pointer"
                  style={{ border: "1px solid #E2E8F0", backgroundColor: "#FFFFFF", color: "#475569", fontSize: 12, fontWeight: 500 }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
                >
                  <RefreshCw className="w-3 h-3" /> Reset to default
                </button>
              )}
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

        {/* ── Side-layout body — Partner Configure-Customer pattern.
            Left rail = method list (Partner profile-sidebar pattern),
            right column = linear settings for the selected method. */}
        <div className="flex-1 min-h-0 flex flex-row" style={{ backgroundColor: "#FAFBFC" }}>

          {/* Left sidebar — method picker. Each row is a Partner
              "profile" nav item: icon bubble + name + description +
              radio dot on the right. Selected uses `bg-accent` + a
              subtle `ring-primary/15`, matching the Partner pattern
              exactly (no toggle, no card chrome around each item). */}
          <aside
            className="shrink-0 flex flex-col"
            style={{
              width: 272,
              backgroundColor: "#FFFFFF",
              borderRight: "1px solid #EEF2F6",
            }}
          >
            <div className="shrink-0" style={{ padding: "12px 14px 8px", borderBottom: "1px solid #EEF2F6" }}>
              <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                Shipment Method
              </span>
              <p className="text-[11.5px] text-slate-500 mt-1" style={{ lineHeight: 1.45 }}>
                Pick how items leave our facility. Settings on the right adapt to this choice.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ padding: 10 }}>
              <div className="flex flex-col" style={{ gap: 4 }}>
                {SHIPMENT_METHOD_OPTIONS.map((opt) => {
                  const isActive = draft.method === opt.id;
                  const IconCmp = opt.icon === "user" ? User : Truck;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleMethodChange(opt.id)}
                      className="w-full flex items-center text-left transition-all cursor-pointer"
                      style={{
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: 10,
                        backgroundColor: isActive ? "rgba(10,119,255,0.08)" : "transparent",
                        boxShadow: isActive ? "inset 0 0 0 1px rgba(10,119,255,0.15)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = "#F8FAFC";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div
                        className="flex items-center justify-center shrink-0 rounded-lg"
                        style={{
                          width: 32, height: 32,
                          backgroundColor: isActive ? "#DBEAFE" : "#F1F5F9",
                          color: isActive ? "#0A77FF" : "#94A3B8",
                        }}
                      >
                        <IconCmp className="w-4 h-4" style={{ transform: opt.icon === "truck-out" ? "scaleX(-1)" : undefined }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="truncate"
                          style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", lineHeight: 1.3 }}
                        >
                          {opt.name}
                        </div>
                        <div
                          className="truncate"
                          style={{ fontSize: 10.5, color: "#64748B", marginTop: 1, lineHeight: 1.4 }}
                        >
                          {opt.description}
                        </div>
                      </div>
                      <PartnerRadio active={isActive} />
                    </button>
                  );
                })}
              </div>
            </div>

          </aside>

          {/* Right content — linear settings stack for the selected
              method. Sections render top-to-bottom in a single column;
              each uses Partner's heading-row + card-body pattern. */}
          <div className="flex-1 min-w-0 overflow-y-auto" style={{ padding: "16px 20px" }}>
            <div className="mb-3">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}>
                {method.name}
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                {isCustomerPickup
                  ? "The customer collects directly from our facility. Set the pickup location, the authorized POC, and any verification we need at the door."
                  : usesDropoffLocation
                    ? "We drop off at the carrier's hub. Pick the pickup location, the hub, and the carrier + method."
                    : "The carrier collects from our facility. Pick the pickup location and the carrier + method."}
              </p>
            </div>

            <div className="flex flex-col" style={{ gap: 14 }}>
              {usesPickupLocation && (
                <PickupSummaryCard
                  title={isCustomerPickup ? "Customer Pickup Location" : "Pickup From"}
                  selection={pickupSelection}
                  warehouseNames={pickupWarehouseNames}
                  onChange={() => setShowPickupLocPicker(true)}
                />
              )}

              {usesDropoffLocation && (
                <LocationStepCard
                  icon={MapPin}
                  title="Drop-off At"
                  subtitle="Where we drop off with the carrier"
                  loc={dropoffLoc}
                  onChange={() => setShowDropoffLocPicker(true)}
                />
              )}

              {usesCarrier && (
                <CarrierStepCard
                  carrier={carrier}
                  methodId={carrierMethod?.id}
                  onChange={() => setShowCarrierPicker(true)}
                />
              )}

              {/* Customer Pickup: a single "Pickup Date & Window" card
                  groups the date with the time window, then a "Pickup
                  Authorization" card carries the POC + ID rule. Delivery
                  date + freight cost are intentionally not rendered —
                  the customer collects in person, so the quote has no
                  carrier transit and no freight charge to bill. */}
              {isCustomerPickup ? (
                <>
                  <SectionCard
                    icon={CalendarIcon}
                    title="When can the customer come?"
                    subtitle="Pick the day and a time slot at the pickup location"
                  >
                    <CustomerPickupDateAndWindow
                      iso={draft.expectedShipDate || toIso(getShipmentDates(draft).shipBy)}
                      onIsoChange={(iso) => patch({ expectedShipDate: iso })}
                      windowStart={draft.pickupWindowStart ?? "09:00"}
                      windowEnd={draft.pickupWindowEnd ?? "12:00"}
                      onWindowStartChange={(v) => patch({ pickupWindowStart: v })}
                      onWindowEndChange={(v) => patch({ pickupWindowEnd: v })}
                    />
                  </SectionCard>
                  <SectionCard
                    icon={User}
                    title="Pickup Authorization"
                    subtitle="Who's coming, what verification we need at the door"
                  >
                    <CustomerPickupFields
                      draft={draft} patch={patch}
                      pocs={pocs ?? []}
                      showPocPicker={showPocPicker}
                      setShowPocPicker={setShowPocPicker}
                    />
                  </SectionCard>
                </>
              ) : (
                <>
                  {/* Dates — header on its own row; two equal-width white
                      cards underneath in a 2-col grid (full row each, even
                      when the inputs themselves stay compact, so the cards
                      stay symmetrical with the Partner-style sections).
                      The Estimated Delivery card hosts a Single/Range
                      toggle so the user can promote it to a date range
                      when the carrier's transit is uncertain. */}
                  <div className="flex flex-col" style={{ gap: 8 }}>
                    <div className="flex items-center" style={{ gap: 8 }}>
                      <CalendarIcon className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
                      <span className="text-xs text-foreground" style={{ fontWeight: 600 }}>Dates</span>
                      <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>
                        {isCustomerPickup
                          ? "Pick Up Date sets this line's Ship By. The customer collects on this date."
                          : draft.method === "courier-pickup"
                            ? "Pick Up Date sets this line's Ship By. The carrier collects from us on this date."
                            : "Sets this line's Ship By and Delivery on the timeline"}
                      </span>
                    </div>
                    {/* Both cards render identical chrome: same padding,
                        same FieldLabel, same trigger height. Pick Up Date
                        uses the single picker; Estimated Delivery uses the
                        range picker — picking two dates on the calendar
                        promotes a single date to a range without any
                        toggle. The helper line under Estimated Delivery
                        sits below the trigger so it doesn't shift the
                        upper rows out of alignment with Pick Up Date. */}
                    <div className="grid grid-cols-2 items-start" style={{ gap: 10 }}>
                      <div
                        className="bg-white rounded-xl"
                        style={{
                          border: "1px solid #E2E8F0",
                          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                          padding: 14,
                        }}
                      >
                        <DatePickerSingle
                          label={method.dateLabel}
                          iso={draft.expectedShipDate || toIso(getShipmentDates(draft).shipBy)}
                          onChange={(iso) => patch({ expectedShipDate: iso })}
                          /* Countdown helper keeps this card the same
                             height as the Estimated Delivery card next
                             to it (which renders a "Transit: …" helper).
                             Reads as "Picks up today" / "Tomorrow" /
                             "N days left" so the user always sees how
                             far off the pickup is. */
                          helper={pickupCountdownLabel(draft.expectedShipDate || toIso(getShipmentDates(draft).shipBy))}
                        />
                      </div>
                      <div
                        className="bg-white rounded-xl"
                        style={{
                          border: "1px solid #E2E8F0",
                          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                          padding: 14,
                        }}
                      >
                        <DatePickerRange
                          label="Estimated Delivery"
                          startIso={draft.estimatedDeliveryDate || toIso(getShipmentDates(draft).deliveryMin)}
                          endIso={draft.estimatedDeliveryDateEnd ?? ""}
                          onStartChange={(iso) => patch({ estimatedDeliveryDate: iso })}
                          onEndChange={(iso) => patch({ estimatedDeliveryDateEnd: iso || undefined })}
                          helper={
                            carrierMethod
                              ? `Transit: ${fmtDateRange(carrierMethod.minDays, carrierMethod.maxDays)}`
                              : "Select a carrier + method to compute transit"
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Freight Charges section pinned for later — feature
                      paused per product. The saved value still lives on
                      `draft.shipmentCost`, so re-enabling is just a matter
                      of un-commenting this block. Do not delete the field
                      from `ShipmentConfig`; downstream callers keep
                      reading and writing it for forward compatibility. */}
                  {false && (
                    <SectionCard
                      icon={DollarSign}
                      title="Freight Charges"
                      subtitle={isLineOverride
                        ? "This line's freight charge. Per-line totals replace the quote default."
                        : "Default freight for the quote. Per-line overrides take precedence."}
                    >
                      <FreightChargesField
                        value={draft.shipmentCost}
                        onChange={(v) => patch({ shipmentCost: v })}
                        isLineOverride={Boolean(isLineOverride)}
                      />
                    </SectionCard>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-end gap-2 bg-white" style={{ padding: "12px 20px", borderTop: "1px solid #EEF2F6" }}>
          <button
            onClick={requestClose}
            className="h-9 px-4 rounded-lg transition-colors cursor-pointer"
            style={{ fontSize: 13, fontWeight: 600, color: "#64748B", border: "1px solid #E2E8F0", backgroundColor: "#FFFFFF" }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(draft); onClose(); }}
            className="h-9 px-4 rounded-lg transition-colors cursor-pointer"
            style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", backgroundColor: "#0A77FF" }}
          >
            Save Settings
          </button>
        </div>

        {/* Discard-confirmation guard for the outer Freight & Logistics
            modal. Two paths in the primary group: discard the
            in-flight changes, or keep editing. Below them, a separated
            tertiary path clears the freight settings so the shipment
            team can finalise them later. */}
        <ConfirmationModal
          isOpen={showDiscardConfirm}
          title="Discard unsaved changes?"
          message={`Your freight setting changes for ${isLineOverride ? "this line item" : "the order default"} have not been saved. Discarding will restore the previously saved values.`}
          confirmText="Discard changes"
          cancelText="Keep editing"
          variant="red"
          icon={<Truck />}
          onCancel={() => setShowDiscardConfirm(false)}
          onConfirm={handleDiscard}
        />
      </div>

      {/* ── Pickup warehouse picker (multi-select) ──────────── */}
      {showPickupLocPicker && (
        <WarehouseSelectionModal
          isOpen
          onClose={() => setShowPickupLocPicker(false)}
          value={pickupSelection}
          onSelect={(sel) => {
            setShowPickupLocPicker(false);
            /* Skip the scope confirmation when:
               - selection is "Decide later" (sel is undefined)
               - we're not in a line-item context (order-default
                 changes don't need the "this line vs item record"
                 prompt — only line items do)
               - nothing actually changed
               In all those cases, patch the draft immediately. */
            if (!sel || !isLineOverride || pickupSelectionsEqual(sel, pickupSelection)) {
              patch({ pickupLocation: sel, pickupLocationId: undefined });
              return;
            }
            setPendingPickupChange(sel);
          }}
          scopeLabel={isLineOverride
            ? `For ${scopeLabel ?? "this line"} only`
            : "Default applied to every line on this quote"}
          inventoryItemCodes={inventoryItemCodes}
          isLineLevel={!!isLineOverride}
        />
      )}

      {/* ── Drop-off (carrier hub) location picker ───────────── */}
      {showDropoffLocPicker && (
        <LocationSelectionModal
          isOpen
          onClose={() => setShowDropoffLocPicker(false)}
          onSelect={(loc) => { patch({ dropoffLocationId: loc.id }); setShowDropoffLocPicker(false); }}
          currentLocationId={draft.dropoffLocationId ?? ""}
          customerName="Carrier Hubs"
          locations={CARRIER_HUB_LOCATIONS}
        />
      )}

      {/* ── Carrier picker (Partner-style grid + inline method radios) ── */}
      {showCarrierPicker && (
        <CarrierSelectionModal
          isOpen
          onClose={() => setShowCarrierPicker(false)}
          isLineLevel={!!isLineOverride}
          selectedCarrierId={draft.carrierId}
          selectedMethodId={draft.carrierMethodId}
          onApply={(cId, mId) => {
            setShowCarrierPicker(false);
            /* "Decide later" or unchanged → patch immediately, no
               confirmation. The scope modal fires only when the
               picker saved a real carrier + method pair. */
            const isDeferred = !cId || !mId;
            const unchanged = cId === draft.carrierId && mId === draft.carrierMethodId;
            if (isDeferred || unchanged) {
              patch({ carrierId: cId, carrierMethodId: mId });
              return;
            }
            setPendingCarrierChange({ carrierId: cId, methodId: mId });
          }}
        />
      )}

      {/* ── Pending pickup-change scope confirmation ────────── */}
      {pendingPickupChange && (
        <ChangeScopeModal
          icon={Building2}
          badge="Pickup change"
          title="Apply pickup change"
          subtitle={<>You're updating the pickup location for this line. Choose where this change should apply.</>}
          primaryOption={{ key: "line", title: "This quote only", description: "Override the pickup location for this line item. The item record stays unchanged." }}
          secondaryOption={{ key: "master", title: "Update item record", description: "Set as the new default pickup location for this item across all future quotes.", badge: "GLOBAL" }}
          onCancel={() => setPendingPickupChange(null)}
          onApply={(scope) => {
            patch({ pickupLocation: pendingPickupChange, pickupLocationId: undefined });
            if (scope === "master") {
              toast.success("Pickup updated on this quote and on the item record");
            } else {
              toast.success("Pickup updated for this line on this quote");
            }
            setPendingPickupChange(null);
          }}
        />
      )}

      {/* ── Pending freight-change scope confirmation ───────── */}
      {pendingCarrierChange && (
        <ChangeScopeModal
          icon={Truck}
          badge="Freight change"
          title="Apply freight change"
          subtitle={<>You're updating the carrier and delivery method. Choose where this change should apply.</>}
          primaryOption={{
            key: "scope",
            title: isLineOverride ? "This quote only" : "This quote only",
            description: isLineOverride
              ? "Override the freight method for this line item. The customer record stays unchanged."
              : "Apply to this quote only. The customer record stays unchanged.",
          }}
          secondaryOption={{
            key: "master",
            title: "Update customer default",
            description: "Set as the new default freight carrier and method for this customer across all future quotes.",
            badge: "GLOBAL",
          }}
          onCancel={() => setPendingCarrierChange(null)}
          onApply={(scope) => {
            patch({ carrierId: pendingCarrierChange.carrierId, carrierMethodId: pendingCarrierChange.methodId });
            if (scope === "master") {
              toast.success("Freight method updated on this quote and on the customer record");
            } else {
              toast.success("Freight method updated for this quote");
            }
            setPendingCarrierChange(null);
          }}
        />
      )}
    </div>,
    document.body
  );
}

/* ── Section card — Partner pattern (heading row outside, card chrome below) ─
   Replaces the legacy StepCard (which used a blue numbered circle —
   non-Partner). The heading row hosts an icon, label, optional
   subtitle, and an optional right-aligned action button. The content
   card below is a plain rounded-xl/border surface so it reads as one
   continuous section instead of a tiny banner + nested body. */

function SectionCard({
  icon: Icon, title, subtitle, action, children, headingAccent = "#64748B",
}: {
  icon: any;
  title: string;
  subtitle?: string;
  action?: any;
  children: any;
  headingAccent?: string;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <div className="flex items-center justify-between" style={{ gap: 10 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          {Icon && <Icon className="w-3.5 h-3.5" style={{ color: headingAccent }} />}
          <span className="text-xs text-foreground" style={{ fontWeight: 600 }}>
            {title}
          </span>
          {subtitle && (
            <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>
              {subtitle}
            </span>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div
        className="bg-white rounded-xl"
        style={{
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          padding: 14,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* Partner-faithful radio dot — thin border + filled inner circle.
   Color follows the optional `accent` so destructive / warning /
   neutral states can re-use the same primitive. Mirrors the
   Enforcement Policy radio in CreatePartnerModal. */
function PartnerRadio({ active, accent = "#0A77FF" }: { active: boolean; accent?: string }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: 16,
        height: 16,
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: active ? `${accent}99` : "#CBD5E1",
        backgroundColor: "transparent",
      }}
    >
      {active && (
        <div
          className="rounded-full"
          style={{ width: 8, height: 8, backgroundColor: accent }}
        />
      )}
    </div>
  );
}

/* Back-compat alias — existing call sites import `Radio`. */
const Radio = PartnerRadio;

/* ── Partner "1 Group Selected" summary card (1:1 mirror) ─────
   Header bar: 24-px primary/8 icon tile, count label, primary pill
   with star, status pill, subtitle line below, Edit Groups button
   anchored on the right. Chip row below the header, separated by
   bottom padding (no divider).

   Source pattern: CreatePartnerModal.tsx:3238-3300 (Selected Partner
   Groups Banner). We use the same Tailwind classes / inline styles
   so the two surfaces are visually identical. */
function PartnerSummaryCard({
  icon: Icon,
  countLabel,
  primaryName,
  isPrimary,
  statusActive,
  subtitle,
  chips,
  /* Default CTA is "Change" across the whole modal — every summary
     card in here (Pickup From, Freight Shipping Method, Drop-off At)
     swaps the selection rather than editing fields, so "Change" reads
     more accurately than "Edit". Callers can still override. */
  editLabel = "Change",
  editIcon,
  onEdit,
}: {
  icon: any;
  countLabel: string;
  primaryName?: string;
  isPrimary?: boolean;
  statusActive?: boolean;
  subtitle?: string;
  chips?: any;
  editLabel?: string;
  /** Optional icon shown on the edit button. Defaults to a pencil; pass
   *  a pre-sized icon JSX (`w-3 h-3`) for the empty/Add state. */
  editIcon?: any;
  onEdit: () => void;
}) {
  return (
    <div
      className="rounded-lg bg-white overflow-hidden"
      style={{
        border: "1px solid rgba(10, 119, 255, 0.25)",
        boxShadow: "0 1px 4px rgba(10, 119, 255, 0.06), 0 4px 12px -2px rgba(0, 0, 0, 0.06)",
      }}
    >
      {/* Header row — px-3 py-2 */}
      <div className="flex items-center justify-between gap-2" style={{ padding: "8px 12px" }}>
        <div className="flex items-center min-w-0" style={{ gap: 8 }}>
          <div
            className="flex items-center justify-center shrink-0 rounded-md"
            style={{ width: 24, height: 24, backgroundColor: "rgba(10, 119, 255, 0.08)" }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
              <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                {countLabel}
              </span>
              {primaryName && (
                <span
                  className="inline-flex items-center gap-1 rounded-md"
                  style={{
                    padding: "1px 6px",
                    fontSize: 10, fontWeight: 600,
                    backgroundColor: "rgba(10, 119, 255, 0.08)", color: "#0A77FF",
                  }}
                >
                  {isPrimary && <Star className="w-2.5 h-2.5" style={{ fill: "#0A77FF", color: "#0A77FF" }} />}
                  {isPrimary ? `Primary: ${primaryName}` : primaryName}
                </span>
              )}
              {statusActive !== undefined && (
                <span
                  className="inline-flex items-center rounded-md"
                  style={{
                    padding: "2px 8px",
                    fontSize: 10, fontWeight: 600,
                    backgroundColor: statusActive ? "#ECFDF5" : "#FFFBEB",
                    color: statusActive ? "#065F46" : "#92400E",
                    border: `1px solid ${statusActive ? "#A7F3D0" : "#FDE68A"}`,
                  }}
                >
                  {statusActive ? "Active" : "Inactive"}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="truncate" style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, lineHeight: 1.4 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center transition-all cursor-pointer shrink-0"
          style={{
            gap: 6,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--border, #E2E8F0)",
            backgroundColor: "#FFFFFF",
            color: "#64748B",
            fontSize: 12, fontWeight: 600,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#0A77FF";
            e.currentTarget.style.color = "#0A77FF";
            e.currentTarget.style.backgroundColor = "rgba(10, 119, 255, 0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border, #E2E8F0)";
            e.currentTarget.style.color = "#64748B";
            e.currentTarget.style.backgroundColor = "#FFFFFF";
          }}
        >
          {editIcon ?? <Pencil className="w-3 h-3" />}
          {editLabel}
        </button>
      </div>

      {/* Chip row — Partner GroupChipsRow pattern: px-3 pb-2 line of
          small rounded chips. Caller renders the actual chips so each
          section can carry its own data. */}
      {chips && (
        <div className="flex items-center flex-wrap" style={{ padding: "0 12px 8px", gap: 6, minWidth: 0 }}>
          {chips}
        </div>
      )}
    </div>
  );
}

/* Partner GroupChip — single chip used inside PartnerSummaryCard's
   chip row. Mirrors GroupChipsRow.tsx:GroupChipWithPopover trigger:
   accent bg / primary border when "primary", neutral slate-50 / border
   otherwise. */
function PartnerChip({
  isPrimary, leading, label, trailing,
}: {
  isPrimary?: boolean;
  leading?: any;
  label: string;
  trailing?: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-lg shrink-0"
      style={{
        gap: 6,
        padding: "2px 8px",
        fontSize: 11, fontWeight: 500,
        border: `1px solid ${isPrimary ? "rgba(10, 119, 255, 0.25)" : "#E2E8F0"}`,
        backgroundColor: isPrimary ? "rgba(10, 119, 255, 0.08)" : "#F8FAFC",
        color: isPrimary ? "#0A77FF" : "#64748B",
      }}
    >
      {isPrimary && <Star className="w-2.5 h-2.5" style={{ fill: "#0A77FF", color: "#0A77FF" }} />}
      {leading}
      <span>{label}</span>
      {trailing && (
        <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 400 }}>· {trailing}</span>
      )}
    </span>
  );
}

/* Empty-state stub used by both summary cards when nothing is
   selected. Renders just enough chrome to point the user at the
   Edit button. */
function PartnerSummaryEmpty({
  icon: Icon, label, onEdit,
}: {
  icon: any; label: string; onEdit: () => void;
}) {
  return (
    <div
      className="rounded-lg bg-white flex items-center justify-between"
      style={{
        border: "1px dashed #CBD5E1",
        padding: "10px 12px",
      }}
    >
      <div className="flex items-center min-w-0" style={{ gap: 8 }}>
        <div
          className="flex items-center justify-center shrink-0 rounded-md"
          style={{ width: 24, height: 24, backgroundColor: "#F1F5F9" }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#64748B" }}>{label}</span>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center transition-colors cursor-pointer"
        style={{
          gap: 6,
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid #0A77FF",
          backgroundColor: "#FFFFFF",
          color: "#0A77FF",
          fontSize: 12, fontWeight: 600,
        }}
      >
        <Plus className="w-3 h-3" /> Select
      </button>
    </div>
  );
}

/* ── Wrapper components — pre-fill PartnerSummaryCard with the data
   shape each section needs, so the call sites in the modal body
   stay short and declarative. */

/* Pickup summary card — delegates to PartnerSummaryCard so the
   chrome (icon tile, count label, primary-name pill with Star,
   Active status pill, subtitle line, chip row, Edit/Change button)
   matches the Freight Shipping Method card pixel-for-pixel. The
   wrapper just builds the prop shape from a WarehousePickupSelection:
     • primaryName = warehouse name (rendered as `Primary: …` pill
       when it's the warehouse's declared default leaf).
     • subtitle = breadcrumb path, middle-truncated when > 2 levels
       so the row never wraps.
     • chips = leaf code chip + first leaf tag chip — short string
       data only, matching the user's "no long names in pills" rule. */
/* Pickup summary card — delegates to PartnerSummaryCard so the
   chrome matches the Freight Shipping Method card pixel-for-pixel.
   The selection is now multi-warehouse:
     • Empty selection (`undefined` or no ids) → "Decide later" pill
       in primary slot, deferred subtitle. Encourages the user to
       open the picker without claiming a missing warehouse.
     • One warehouse → name in pill, location subtitle.
     • Many → "N warehouses" pill, comma-list subtitle, every name
       repeated as a chip in the chip row.
   */
function PickupSummaryCard({
  title, selection, warehouseNames, onChange,
}: {
  title: string;
  selection?: WarehousePickupSelection;
  warehouseNames: string[];
  onChange: () => void;
}) {
  const count = warehouseNames.length;
  const isDeferred = !selection || count === 0;

  if (isDeferred) {
    return (
      <PartnerSummaryCard
        icon={Building2}
        countLabel={title}
        statusActive={undefined}
        subtitle="No pickup location picked yet. The team will choose one before allocation and pickup."
        onEdit={onChange}
        editLabel="Add"
        editIcon={<Plus className="w-3 h-3" />}
      />
    );
  }

  const primaryName = count === 1 ? warehouseNames[0] : `${count} locations`;
  /* When a single location is picked the pill already shows its name,
     so the subtitle drops to keep the card compact; multi-location
     selections list the names dot-separated. */
  const subtitle = count === 1
    ? ""
    : warehouseNames.join(" · ");

  return (
    <PartnerSummaryCard
      icon={Building2}
      countLabel={title}
      primaryName={primaryName}
      statusActive={true}
      subtitle={subtitle}
      onEdit={onChange}
      editLabel="Change"
      chips={
        count > 1 ? (
          <>
            {warehouseNames.map((name) => (
              <PartnerChip
                key={name}
                leading={<Building2 className="w-2.5 h-2.5" style={{ color: "#94A3B8" }} />}
                label={name}
              />
            ))}
          </>
        ) : undefined
      }
    />
  );
}

function LocationStepCard({
  title, loc, onChange,
}: {
  step?: number;
  title: string;
  subtitle?: string;
  loc?: LocationOption;
  onChange: () => void;
  icon?: any;
}) {
  if (!loc) {
    return <PartnerSummaryEmpty icon={MapPin} label={title} onEdit={onChange} />;
  }
  const isActive = loc.status !== "inactive";
  const subtitleLine = [loc.address, loc.city, loc.state]
    .filter(Boolean)
    .join(", ") + (loc.country ? ` · ${loc.country}` : "");
  return (
    <PartnerSummaryCard
      icon={MapPin}
      countLabel={title}
      primaryName={loc.name}
      isPrimary={loc.isDefault}
      statusActive={isActive}
      subtitle={subtitleLine}
      onEdit={onChange}
      chips={
        <>
          <PartnerChip
            isPrimary={loc.isDefault}
            label={loc.city ? `${loc.city}, ${loc.state ?? ""}`.replace(/, $/, "") : loc.name}
            trailing={typeof loc.items === "number" && loc.items > 0 ? `${loc.items} items` : undefined}
          />
          {typeof loc.contacts === "number" && loc.contacts > 0 && (
            <PartnerChip
              leading={<Users className="w-2.5 h-2.5" style={{ color: "#94A3B8" }} />}
              label={`${loc.contacts} contacts`}
            />
          )}
        </>
      }
    />
  );
}

function CarrierStepCard({
  carrier, methodId, onChange,
}: {
  carrier?: Carrier;
  methodId?: string;
  onChange: () => void;
}) {
  if (!carrier) {
    /* Deferred state — matches the Pickup card's empty treatment:
       no pill, helpful subtitle, "Add" CTA with a Plus icon. The
       shipment team picks the carrier later if the user leaves it. */
    return (
      <PartnerSummaryCard
        icon={Truck}
        countLabel="Freight Shipping Method"
        statusActive={undefined}
        subtitle="No carrier picked yet. The team will choose one before shipping."
        onEdit={onChange}
        editLabel="Add"
        editIcon={<Plus className="w-3 h-3" />}
      />
    );
  }
  const isActive = carrier.status === "active";
  const activeMethod =
    carrier.methods.find((m) => m.id === methodId) ??
    carrier.methods.find((m) => m.isDefault) ??
    carrier.methods[0];
  const subtitleLine = activeMethod
    ? `${activeMethod.name} · ${fmtDateRange(activeMethod.minDays, activeMethod.maxDays)}`
    : carrier.description;
  return (
    <PartnerSummaryCard
      icon={Truck}
      countLabel="Freight Shipping Method"
      primaryName={carrier.name}
      isPrimary={carrier.isDefault}
      statusActive={isActive}
      subtitle={subtitleLine}
      onEdit={onChange}
      chips={
        <>
          {carrier.methods.map((m) => (
            <PartnerChip
              key={m.id}
              isPrimary={m.id === activeMethod?.id}
              label={m.shortName}
              trailing={m.isDefault ? "default" : undefined}
            />
          ))}
        </>
      }
    />
  );
}

/* ── Freight Charges field — proper inherit/override UX ─────── */

/* Replaces the previous "Leave empty to inherit" placeholder (which
   was an instruction crammed into the input). The field now has a
   real two-state UI:
   • Inherit (default): the input is disabled, shows a muted "Using
     quote default" pill in-line, and the user clicks Override to
     enter a custom cost.
   • Override: the input is editable with a clean `$` prefix and a
     `0.00` placeholder. A "Reset" link reverts to inherit.
   No half-sentence placeholders, no double instructions. */
function FreightChargesField({
  value, onChange, isLineOverride,
}: {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  isLineOverride: boolean;
}) {
  const isOverride = typeof value === "number";

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <div className="text-xs text-foreground" style={{ fontWeight: 600 }}>Cost (USD)</div>
        {isOverride ? (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="inline-flex items-center gap-1 transition-colors cursor-pointer"
            style={{ fontSize: 11, fontWeight: 600, color: "#0A77FF" }}
            title="Revert to the quote default"
          >
            <RefreshCw className="w-3 h-3" /> Reset to inherit
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="inline-flex items-center gap-1 transition-colors cursor-pointer"
            style={{ fontSize: 11, fontWeight: 600, color: "#0A77FF" }}
            title="Set a custom freight cost for this scope"
          >
            Override
          </button>
        )}
      </div>

      <div className="relative">
        <div
          className="absolute left-0 top-0 bottom-0 flex items-center justify-center"
          style={{
            width: 36,
            borderRight: "1px solid #E2E8F0",
            backgroundColor: isOverride ? "#F8FAFC" : "#F1F5F9",
            borderTopLeftRadius: 8,
            borderBottomLeftRadius: 8,
          }}
        >
          <span style={{ fontSize: 12, color: isOverride ? "#64748B" : "#94A3B8", fontWeight: 500 }}>$</span>
        </div>
        <input
          type="text"
          inputMode="decimal"
          disabled={!isOverride}
          value={isOverride
            ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value as number)
            : ""}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9.]/g, "");
            onChange(cleaned === "" ? 0 : Math.max(0, parseFloat(cleaned) || 0));
          }}
          placeholder={isOverride ? "0.00" : ""}
          className="w-full h-10 text-[13px] outline-none"
          style={{
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            paddingLeft: 48,
            paddingRight: 12,
            fontWeight: 500,
            color: isOverride ? "#0F172A" : "#94A3B8",
            backgroundColor: isOverride ? "#FFFFFF" : "#F8FAFC",
            cursor: isOverride ? "text" : "not-allowed",
          }}
        />
        {!isOverride && (
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex items-center px-1.5 py-[2px] rounded-md border whitespace-nowrap"
            style={{
              fontSize: 10, fontWeight: 500, lineHeight: 1,
              backgroundColor: "#F1F5F9",
              color: "#475569",
              borderColor: "#E2E8F0",
            }}
          >
            Inherits {isLineOverride ? "quote default" : "no default"}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground" style={{ marginTop: 6, lineHeight: 1.45 }}>
        {isOverride
          ? (isLineOverride
              ? "This line's freight charge replaces the quote default in the summary."
              : "Quote-level freight applies to every line unless a line overrides it.")
          : (isLineOverride
              ? "This line follows the quote's default freight. Click Override to set a custom amount."
              : "No quote-level freight set yet. Click Override to enter a single quote charge.")}
      </p>
    </div>
  );
}

/* ── Customer Pickup fields ─────────────────────────────────── */

function CustomerPickupFields({
  draft, patch, pocs, showPocPicker, setShowPocPicker,
}: {
  draft: ShipmentConfig;
  patch: (p: Partial<ShipmentConfig>) => void;
  pocs: Poc[];
  showPocPicker: boolean;
  setShowPocPicker: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Authorized person + phone */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel icon={User}>Authorized Pickup Person</FieldLabel>
          <div className="relative">
            <input
              type="text"
              value={draft.authorizedPersonName ?? ""}
              onChange={(e) => patch({ authorizedPersonName: e.target.value, authorizedPocId: undefined })}
              placeholder="Full name"
              className="w-full h-9 px-3 text-[13px] outline-none"
              style={{ border: "1px solid #E2E8F0", borderRadius: 8, paddingRight: pocs.length ? 88 : 12 }}
            />
            {pocs.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPocPicker(!showPocPicker)}
                className="absolute right-1 top-1 h-7 px-2 rounded-md transition-colors cursor-pointer"
                style={{ fontSize: 11, fontWeight: 600, color: "#0A77FF", backgroundColor: "#EFF6FF" }}
              >
                Pick POC
              </button>
            )}
            {showPocPicker && pocs.length > 0 && (
              <div
                className="absolute z-10 left-0 right-0 mt-1 bg-white shadow-lg overflow-hidden"
                style={{ border: "1px solid #E2E8F0", borderRadius: 8, maxHeight: 200, overflowY: "auto" }}
              >
                {pocs.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      patch({ authorizedPocId: p.id, authorizedPersonName: p.name, authorizedPersonPhone: p.phone });
                      setShowPocPicker(false);
                    }}
                    className="w-full px-3 py-2 text-left transition-colors"
                    style={{ borderBottom: "1px solid #F1F5F9", cursor: "pointer", backgroundColor: draft.authorizedPocId === p.id ? "#EFF6FF" : "transparent" }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: "#64748B" }}>{p.role} · {p.phone}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <FieldLabel icon={Phone}>Authorized Phone</FieldLabel>
          <PhoneField
            value={draft.authorizedPersonPhone ?? ""}
            onChange={(next) => patch({ authorizedPersonPhone: next })}
          />
        </div>
      </div>

      {/* ID Verification toggle */}
      <button
        type="button"
        onClick={() => patch({ idVerificationRequired: !draft.idVerificationRequired })}
        className="w-full text-left flex items-center justify-between transition-colors"
        style={{ border: "1px solid #E2E8F0", borderRadius: 8, backgroundColor: "#FAFBFC", padding: "10px 12px", cursor: "pointer" }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" style={{ color: draft.idVerificationRequired ? "#0A77FF" : "#94A3B8" }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>ID Verification Required</div>
            <div style={{ fontSize: 10, color: "#64748B" }}>Driver must present a valid government ID at pickup</div>
          </div>
        </div>
        <Toggle on={!!draft.idVerificationRequired} />
      </button>

      <div>
        <FieldLabel icon={FileText}>Special Instructions <span style={{ color: "#94A3B8", fontWeight: 400 }}>(optional)</span></FieldLabel>
        <textarea
          value={draft.specialInstructions ?? ""}
          onChange={(e) => patch({ specialInstructions: e.target.value })}
          placeholder="Gate code, dock number, after-hours contact, etc."
          rows={2}
          className="w-full px-3 py-2 text-[13px] outline-none resize-none"
          style={{ border: "1px solid #E2E8F0", borderRadius: 8 }}
        />
      </div>
    </div>
  );
}

/* Combined "Pickup Date & Window" card body — date input on the left,
   start/end time pickers on the right. Window enforces 24-hour entry
   AND validates that the end time stays at or after the start: editing
   start nudges end forward when needed; editing end clamps to ≥ start. */
function CustomerPickupDateAndWindow({
  iso, onIsoChange, windowStart, windowEnd, onWindowStartChange, onWindowEndChange,
}: {
  iso: string;
  onIsoChange: (iso: string) => void;
  windowStart: string;
  windowEnd: string;
  onWindowStartChange: (v: string) => void;
  onWindowEndChange: (v: string) => void;
}) {
  const handleStart = (v: string) => {
    onWindowStartChange(v);
    if (toMinutes(windowEnd) <= toMinutes(v)) {
      onWindowEndChange(addMinutes(v, 30));
    }
  };
  const handleEnd = (v: string) => {
    if (toMinutes(v) < toMinutes(windowStart)) {
      onWindowEndChange(windowStart);
      return;
    }
    onWindowEndChange(v);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <DateInput
        label="Pick Up Date"
        iso={iso}
        onChange={onIsoChange}
      />
      <div>
        <FieldLabel>Pickup time range</FieldLabel>
        {/* Inline range — Cycle Count TimePickerField chrome, two
            side-by-side pickers separated by an arrow. handleEnd
            still guards the start ≤ end invariant so the user can't
            pick an end before the start even though the picker
            itself doesn't enforce a min-time. */}
        <div className="flex items-center" style={{ gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TimePickerField value={windowStart} onChange={handleStart} />
          </div>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <TimePickerField value={windowEnd} onChange={handleEnd} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Time helpers — operate on "HH:MM" strings, 24-hour only. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}
function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function addMinutes(hhmm: string, delta: number): string {
  return fromMinutes(toMinutes(hhmm) + delta);
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/* Partner v7 field-label typography: title-case, 12.5/13 px, weight
   500, no uppercase / letter-spacing tricks. The icon prop is kept
   optional for callers that want a leading affordance but the field
   labels next to the date/time inputs render the affordance inside
   the input chrome instead, so this row stays icon-less. */
function FieldLabel({ icon: Icon, children }: { icon?: any; children: any }) {
  return (
    <div
      className="flex items-center gap-1.5 text-foreground"
      style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}
    >
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
      <span>{children}</span>
    </div>
  );
}

/* Country-code roster — lifted from Partner v7's
   CreatePartnerLocationModal so the phone-field affordance reads
   identically across modules. */
const COUNTRY_CODES = [
  { code: "+1",   flag: "\u{1F1FA}\u{1F1F8}", country: "United States" },
  { code: "+1",   flag: "\u{1F1E8}\u{1F1E6}", country: "Canada" },
  { code: "+44",  flag: "\u{1F1EC}\u{1F1E7}", country: "United Kingdom" },
  { code: "+49",  flag: "\u{1F1E9}\u{1F1EA}", country: "Germany" },
  { code: "+33",  flag: "\u{1F1EB}\u{1F1F7}", country: "France" },
  { code: "+81",  flag: "\u{1F1EF}\u{1F1F5}", country: "Japan" },
  { code: "+86",  flag: "\u{1F1E8}\u{1F1F3}", country: "China" },
  { code: "+91",  flag: "\u{1F1EE}\u{1F1F3}", country: "India" },
  { code: "+61",  flag: "\u{1F1E6}\u{1F1FA}", country: "Australia" },
  { code: "+55",  flag: "\u{1F1E7}\u{1F1F7}", country: "Brazil" },
  { code: "+971", flag: "\u{1F1E6}\u{1F1EA}", country: "UAE" },
  { code: "+65",  flag: "\u{1F1F8}\u{1F1EC}", country: "Singapore" },
  { code: "+82",  flag: "\u{1F1F0}\u{1F1F7}", country: "South Korea" },
  { code: "+52",  flag: "\u{1F1F2}\u{1F1FD}", country: "Mexico" },
  { code: "+31",  flag: "\u{1F1F3}\u{1F1F1}", country: "Netherlands" },
  { code: "+46",  flag: "\u{1F1F8}\u{1F1EA}", country: "Sweden" },
  { code: "+41",  flag: "\u{1F1E8}\u{1F1ED}", country: "Switzerland" },
  { code: "+34",  flag: "\u{1F1EA}\u{1F1F8}", country: "Spain" },
  { code: "+39",  flag: "\u{1F1EE}\u{1F1F9}", country: "Italy" },
  { code: "+48",  flag: "\u{1F1F5}\u{1F1F1}", country: "Poland" },
];

/* Phone field — Partner v7 CreatePartnerLocationModal pattern. A
   left button (flag + country dialing code) opens a Popover with a
   searchable country list, joined visually with a right-hand
   `<input>` for the digits. The two render as a single rounded
   field thanks to `rounded-l-none` / `rounded-r-none` on each side
   and a shared border that drops the seam between them.

   Storage shape: the parent owns a single `${code} ${digits}`
   string. The component parses the leading `+NN` token on mount,
   keeps the country code in local state, and re-joins on every
   change so the caller stays unaware of the split. */
function PhoneField({
  id, value, onChange, placeholder = "(555) 123-4567",
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const parsed = useMemo(() => {
    const match = (value ?? "").match(/^(\+\d{1,3})\s*(.*)$/);
    if (match) return { code: match[1], digits: match[2] };
    return { code: "+1", digits: value ?? "" };
  }, [value]);

  const [phoneCountryCode, setPhoneCountryCode] = useState(parsed.code);
  const [digits, setDigits] = useState(parsed.digits);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  /* Keep local state in sync when the controlled value flips out
     from under us (e.g. POC-picker fill-in). */
  useEffect(() => {
    setPhoneCountryCode(parsed.code);
    setDigits(parsed.digits);
  }, [parsed.code, parsed.digits]);

  const selected = useMemo(
    () => COUNTRY_CODES.find((c) => c.code === phoneCountryCode) ?? COUNTRY_CODES[0],
    [phoneCountryCode]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(
      (c) => c.country.toLowerCase().includes(q) || c.code.includes(q)
    );
  }, [search]);

  const emit = (code: string, d: string) => {
    onChange(d ? `${code} ${d}` : "");
  };

  return (
    <div className="flex items-stretch">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            style={{
              height: 36,
              paddingLeft: 10, paddingRight: 6,
              border: "1px solid #E2E8F0",
              borderRight: "none",
              borderRadius: "8px 0 0 8px",
              backgroundColor: "#FFFFFF",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
            aria-label="Select country code"
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{selected.flag}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
              {phoneCountryCode}
            </span>
            <ChevronDown className="w-3 h-3" style={{ color: "#94A3B8" }} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-0 !z-[12300]"
          align="start"
          sideOffset={4}
          style={{ borderRadius: 12, boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)" }}
        >
          <div style={{ padding: 8, borderBottom: "1px solid #EEF2F6" }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
              <input
                type="text"
                placeholder="Search country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full outline-none"
                style={{
                  paddingLeft: 30, paddingRight: 10,
                  height: 32, borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 13,
                  backgroundColor: "#FFFFFF",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#0A77FF"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(10, 119, 255, 0.12)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto" style={{ padding: 4 }}>
            {filtered.map((c, i) => {
              const isActive = phoneCountryCode === c.code && selected.country === c.country;
              return (
                <button
                  key={`${c.code}-${c.country}-${i}`}
                  type="button"
                  onClick={() => {
                    setPhoneCountryCode(c.code);
                    setOpen(false);
                    setSearch("");
                    emit(c.code, digits);
                  }}
                  className="w-full flex items-center gap-2.5 text-left transition-colors"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    backgroundColor: isActive ? "rgba(10, 119, 255, 0.08)" : "transparent",
                    color: isActive ? "#0A77FF" : "#334155",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F8FAFC"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                >
                  <span style={{ fontSize: 16 }}>{c.flag}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }} className="truncate">
                    {c.country}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B" }}>
                    {c.code}
                  </span>
                  {isActive && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#0A77FF" }} />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", padding: 16 }}>
                No countries found
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <input
        id={id}
        type="tel"
        placeholder={placeholder}
        value={digits}
        onChange={(e) => {
          setDigits(e.target.value);
          emit(phoneCountryCode, e.target.value);
        }}
        className="flex-1 outline-none transition-shadow"
        style={{
          height: 36,
          paddingLeft: 12, paddingRight: 12,
          border: "1px solid #E2E8F0",
          borderRadius: "0 8px 8px 0",
          fontSize: 13,
          color: "#0F172A",
          backgroundColor: "#FFFFFF",
          minWidth: 0,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#0A77FF"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(10, 119, 255, 0.12)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

/* 24-hour time input — figma design-system spec.
   Two number-style segments for HH (0-23) and MM (0-59) separated by a
   colon. Browser locale can't flip this to 12-hour because we render
   the digits ourselves; tabular-nums keep the columns aligned. Focus
   chrome lifts a 3-px primary glow + primary border like the date
   picker. When `min` is supplied, the value clamps to ≥ min on commit. */
function TimeInput24({
  value, onChange, disabled, min, "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  min?: string;
  "aria-label"?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [hh, mm] = useMemo(() => {
    const [h, m] = (value || "00:00").split(":");
    return [h ?? "00", m ?? "00"];
  }, [value]);
  const hourRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);

  const commit = (nextH: number, nextM: number) => {
    const h = clamp(Number.isFinite(nextH) ? nextH : 0, 0, 23);
    const m = clamp(Number.isFinite(nextM) ? nextM : 0, 0, 59);
    let next = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (min && toMinutes(next) < toMinutes(min)) next = min;
    onChange(next);
  };

  const onHourChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, "").slice(0, 2);
    const n = parseInt(cleaned || "0", 10);
    commit(n, parseInt(mm, 10));
    if (cleaned.length === 2) minRef.current?.focus();
  };
  const onMinChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, "").slice(0, 2);
    const n = parseInt(cleaned || "0", 10);
    commit(parseInt(hh, 10), n);
  };

  return (
    <div
      className="inline-flex items-center h-9 transition-shadow"
      style={{
        /* Fixed content-width so the HH:MM display sits tightly
           inside the chrome — no more half-row of empty space to
           the right of the digits when this lives in a 2-col grid. */
        width: 86,
        border: "1px solid #E2E8F0",
        borderRadius: 8,
        backgroundColor: disabled ? "#F8FAFC" : "#FFFFFF",
        boxShadow: focused && !disabled ? "0 0 0 3px rgba(10, 119, 255, 0.12)" : "none",
        borderColor: focused && !disabled ? "#0A77FF" : "#E2E8F0",
        padding: "0 10px",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "text",
      }}
      onClick={() => hourRef.current?.focus()}
      role="group"
      aria-label={ariaLabel}
    >
      <input
        ref={hourRef}
        type="text"
        inputMode="numeric"
        value={hh}
        disabled={disabled}
        onChange={(e) => onHourChange(e.target.value)}
        onFocus={(e) => { setFocused(true); e.currentTarget.select(); }}
        onBlur={(e) => {
          setFocused(false);
          const n = clamp(parseInt(e.currentTarget.value || "0", 10) || 0, 0, 23);
          commit(n, parseInt(mm, 10));
        }}
        className="text-[13px] text-center outline-none bg-transparent"
        style={{
          width: 22,
          fontFeatureSettings: "'tnum'",
          fontVariantNumeric: "tabular-nums",
          color: disabled ? "#94A3B8" : "#0F172A",
          cursor: disabled ? "not-allowed" : "text",
        }}
        aria-label="Hours"
        maxLength={2}
      />
      <span
        style={{
          color: disabled ? "#CBD5E1" : "#94A3B8",
          padding: "0 2px",
          fontFeatureSettings: "'tnum'",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        :
      </span>
      <input
        ref={minRef}
        type="text"
        inputMode="numeric"
        value={mm}
        disabled={disabled}
        onChange={(e) => onMinChange(e.target.value)}
        onFocus={(e) => { setFocused(true); e.currentTarget.select(); }}
        onBlur={(e) => {
          setFocused(false);
          const n = clamp(parseInt(e.currentTarget.value || "0", 10) || 0, 0, 59);
          commit(parseInt(hh, 10), n);
        }}
        className="text-[13px] text-center outline-none bg-transparent"
        style={{
          width: 22,
          fontFeatureSettings: "'tnum'",
          fontVariantNumeric: "tabular-nums",
          color: disabled ? "#94A3B8" : "#0F172A",
          cursor: disabled ? "not-allowed" : "text",
        }}
        aria-label="Minutes"
        maxLength={2}
      />
    </div>
  );
}

/* ── Date pickers (Cycle Count chrome) ──────────────────────── */

/* Both `DatePickerSingle` and `DatePickerRange` delegate to
   `DatePickerField` (lifted from Cycle Count Web's
   `date-picker-field.tsx`) so every date input in the modal
   shares one chrome: MM/DD/YYYY trigger, custom month + year
   dropdowns inside the calendar, no react-day-picker or Radix
   Popover. The Quote ShipmentConfig still stores ISO yyyy-MM-dd
   strings — the wrappers below just marshal Date ↔ ISO and
   surface an optional label + helper. */

function DatePickerSingle({
  label, iso, onChange, helper, minIso,
}: {
  label?: string;
  iso: string;
  onChange: (iso: string) => void;
  helper?: string;
  minIso?: string;
}) {
  const date = iso ? fromIso(iso) ?? undefined : undefined;
  const min = minIso ? fromIso(minIso) ?? undefined : undefined;
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <DatePickerField
        value={date}
        onChange={(d) => onChange(d ? toIso(d) : "")}
        minDate={min}
        placeholder="MM/DD/YYYY"
      />
      {helper && <div className="text-[11px] text-slate-500" style={{ marginTop: 4 }}>{helper}</div>}
    </div>
  );
}

/* Range picker — Cycle Count's planner uses two side-by-side
   single-date pickers (Start + Due) with the due field constrained
   by `minDate={startDate}`. We follow that pattern: the user picks
   a start, then a separate End that can't predate it. No
   in-calendar range selection — keeps every picker behaving the
   same way. */
function DatePickerRange({
  label, startIso, endIso, onStartChange, onEndChange, helper,
}: {
  label?: string;
  startIso: string;
  endIso: string;
  onStartChange: (iso: string) => void;
  onEndChange: (iso: string) => void;
  helper?: string;
}) {
  const start = startIso ? fromIso(startIso) ?? undefined : undefined;
  const end = endIso ? fromIso(endIso) ?? undefined : undefined;
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="flex items-center" style={{ gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DatePickerField
            value={start}
            onChange={(d) => onStartChange(d ? toIso(d) : "")}
            placeholder="MM/DD/YYYY"
          />
        </div>
        <span style={{ fontSize: 12, color: "#94A3B8" }}>→</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DatePickerField
            value={end}
            onChange={(d) => onEndChange(d ? toIso(d) : "")}
            minDate={start}
            placeholder="MM/DD/YYYY"
          />
        </div>
      </div>
      {helper && <div className="text-[11px] text-slate-500" style={{ marginTop: 4 }}>{helper}</div>}
    </div>
  );
}

/* Back-compat wrapper — older call sites (CustomerPickupDateAndWindow,
   etc.) still hand us `DateInput` with iso + helper props. Forward
   to the new single picker so every date input in the modal paints
   the same chrome. */
function DateInput({ label, iso, onChange, helper }: { label: string; iso: string; onChange: (iso: string) => void; helper?: string; disabled?: boolean }) {
  return <DatePickerSingle label={label} iso={iso} onChange={onChange} helper={helper} />;
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      style={{
        width: 32, height: 18, borderRadius: 9,
        backgroundColor: on ? "#0A77FF" : "#CBD5E1",
        position: "relative", transition: "background-color 150ms",
      }}
    >
      <div
        style={{
          position: "absolute", top: 2, left: on ? 16 : 2,
          width: 14, height: 14, borderRadius: "50%", backgroundColor: "#FFFFFF",
          transition: "left 150ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
}

/* ── Carrier selection sub-modal ────────────────────────────── */

function CarrierSelectionModal({
  isOpen, onClose, selectedCarrierId, selectedMethodId, onApply, isLineLevel,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedCarrierId?: string;
  selectedMethodId?: string;
  /* Both args are optional — when the user clears the selection the
     picker fires `onApply(undefined, undefined)` and the parent wipes
     its draft. */
  onApply: (carrierId: string | undefined, methodId: string | undefined) => void;
  /** True when the carrier choice applies to a single line item;
   *  false (or undefined) when it applies to the entire quote/SO
   *  default. Used only to scope the confirmation dialog copy. */
  isLineLevel?: boolean;
}) {
  const [search, setSearch] = useState("");
  /* Draft state — the picker stages the selection locally so the
     dialog stays open until the user presses Save Changes (matches
     the other selection modals in this app). Detail modal commits
     into the draft, not into the parent's onApply. */
  const [draftCarrierId, setDraftCarrierId] = useState<string | undefined>(selectedCarrierId);
  const [draftMethodId, setDraftMethodId] = useState<string | undefined>(selectedMethodId);
  const [detailCarrierId, setDetailCarrierId] = useState<string | null>(null);
  /* Custom carriers added via the green "+" button. New rows are
     unshifted to the front so the user immediately sees them in
     the grid as the first card. Persisted in the module-level
     store so they survive across modal close + re-open. */
  const [customCarriers, setCustomCarriers] = useState<Carrier[]>(CUSTOM_CARRIERS_STORE);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  /* Full-view toggle — matches the Partner "Select Point of Contact"
     pattern (PocModals.tsx) so this modal's chrome matches every other
     selection modal in the app. */
  const [isFullView, setIsFullView] = useState(false);

  const allCarriers = useMemo(() => [...customCarriers, ...SHIPMENT_CARRIERS], [customCarriers]);

  useEffect(() => {
    if (isOpen) {
      setDraftCarrierId(selectedCarrierId);
      setDraftMethodId(selectedMethodId);
      setSearch("");
      setDetailCarrierId(null);
      setShowDiscardConfirm(false);
    }
  }, [isOpen, selectedCarrierId, selectedMethodId]);

  if (!isOpen) return null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCarriers;
    return allCarriers.filter((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [search, allCarriers]);

  const dirty = draftCarrierId !== selectedCarrierId || draftMethodId !== selectedMethodId;
  const draftCarrier = draftCarrierId ? allCarriers.find((c) => c.id === draftCarrierId) : undefined;
  const draftMethod = draftCarrier?.methods.find((m) => m.id === draftMethodId);

  /* Close interceptor — wired to the X icon, Cancel button, and
     backdrop click. Triggers the confirmation when there are either
     (a) unsaved edits, or (b) a non-empty staged carrier on a clean
     state — the second case still warrants the prompt so the user can
     explicitly clear the carrier via "Clear and decide later" without
     committing through. Genuinely empty + clean closes go straight. */
  const requestClose = () => {
    const hasSelection = !!draftCarrierId;
    if (dirty || hasSelection) setShowDiscardConfirm(true);
    else onClose();
  };

  /* "Discard changes" path — drop the staged draft and close without
     writing through. */
  const handleDiscard = () => {
    setDraftCarrierId(selectedCarrierId);
    setDraftMethodId(selectedMethodId);
    setShowDiscardConfirm(false);
    onClose();
  };

  /* "Clear and decide later" path — wipe both carrier and method so
     the shipment team finalises the carrier later. */
  const handleClearForLater = () => {
    onApply(undefined, undefined);
    setShowDiscardConfirm(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12200, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={requestClose}
    >
      <div
        className="bg-white flex flex-col"
        style={{
          /* Fixed footprint — Partner v7 selection-modal sizing
             (~1280 wide / 860 tall). Same dimensions as the location
             picker so flipping between sub-pickers feels seamless,
             and the dialog does not resize as carrier rows are
             filtered/added. */
          width: isFullView ? "calc(100% - 32px)" : "min(1280px, calc(100% - 32px))",
          height: isFullView ? "calc(100vh - 32px)" : "min(860px, calc(100vh - 64px))",
          borderRadius: 16,
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — matches the Partner "Select Point of Contact"
            pattern (PocModals.tsx). No left icon, title + subtitle
            stacked, Full view toggle + close on the right. The carrier
            count and "+ Add Customer Freight" CTA live in the toolbar
            row below so the header reads identity-only. */}
        <div className="px-5 pt-4 pb-3 shrink-0 bg-white border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] sm:text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>
                Select Shipment Method
              </h2>
              <p className="text-[12px] text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                Choose a carrier and its delivery method. You can leave it for the shipment team to finalise later.
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

        {/* Toolbar — Partner v7 listing-toolbar archetype: a compact
            search input on the left + a right-rail with the dynamic
            count and the primary "+ Add" action. Search width is
            capped (not flex-1) so it doesn't dominate the row. */}
        <div className="shrink-0 bg-white" style={{ padding: "10px 20px", borderBottom: "1px solid #EEF2F6" }}>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0" style={{ width: "min(320px, 50%)" }}>
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search carriers"
                className="w-full h-9 pl-8 pr-3 text-[13px] outline-none rounded-lg"
                style={{ border: "1px solid #E2E8F0" }}
              />
            </div>
            <div className="flex-1" />
            <span className="text-sm tabular-nums hidden sm:inline" style={{ fontWeight: 500 }}>
              <span style={{ color: "#0F172A" }}>{filtered.length}</span>
              <span style={{ color: "rgba(100, 116, 139, 0.7)" }}> {filtered.length === 1 ? "carrier" : "carriers"}</span>
            </span>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 shrink-0"
              style={{ fontWeight: 600, backgroundColor: "#ECFDF5", borderColor: "#A7F3D0", color: "#065F46" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#D1FAE5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#ECFDF5"; }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Customer Freight and Logistics
            </button>
          </div>
        </div>

        {/* Body — carrier grid only. Tapping a carrier opens the
            method picker sub-modal. The legacy "Carrier" subheader and
            its helper text were dropped to reclaim vertical space; the
            cards' affordances make their behaviour self-evident. */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#FAFBFC", padding: 16 }}>
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 160, fontSize: 12, color: "#94A3B8" }}>
              No carriers match "{search}"
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((c) => (
                <CarrierPickCard
                  key={c.id}
                  carrier={c}
                  isSelected={draftCarrierId === c.id}
                  selectedMethodId={draftCarrierId === c.id ? draftMethodId : undefined}
                  /* Whole-card click — toggles the carrier. Selecting an
                     unselected card seeds its default method; clicking
                     the already-selected card deselects it (so the user
                     can hand pickup off to the shipment team without
                     opening a separate "clear" affordance). */
                  onCardSelect={() => {
                    if (draftCarrierId === c.id) {
                      setDraftCarrierId(undefined);
                      setDraftMethodId(undefined);
                    } else {
                      const defaultMethod = c.methods.find((m) => m.isDefault) ?? c.methods[0];
                      setDraftCarrierId(c.id);
                      setDraftMethodId(defaultMethod?.id);
                    }
                  }}
                  /* Method-pill / gray-strip click — opens the method
                     sub-modal with the current carrier+method
                     preselected. */
                  onSelect={() => {
                    if (draftCarrierId !== c.id) {
                      const defaultMethod = c.methods.find((m) => m.isDefault) ?? c.methods[0];
                      setDraftCarrierId(c.id);
                      setDraftMethodId(defaultMethod?.id);
                    }
                    setDetailCarrierId(c.id);
                  }}
                  /* Inline pill click on the same card — swap the
                     preview AND the draft's method without opening
                     the sub-modal. */
                  onPickMethod={(methodId) => {
                    setDraftCarrierId(c.id);
                    setDraftMethodId(methodId);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer — selection summary on the left, Cancel/Save on the
            right. The legacy "Decide later" link was removed; users now
            exit via Cancel/X, which surfaces the discard-confirmation
            where the explicit "Clear and decide later" path lives. */}
        <div className="shrink-0 flex items-center justify-between gap-2 bg-white" style={{ padding: "12px 20px", borderTop: "1px solid #EEF2F6" }}>
          <div />

          <div className="flex items-center" style={{ gap: 8 }}>
            <button
              onClick={requestClose}
              className="h-9 px-4 rounded-lg cursor-pointer"
              style={{ fontSize: 13, fontWeight: 600, color: "#64748B", border: "1px solid #E2E8F0", backgroundColor: "#FFFFFF" }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApply(draftCarrierId, draftMethodId);
                onClose();
              }}
              className="h-9 px-4 rounded-lg cursor-pointer"
              style={{
                fontSize: 13, fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "#0A77FF",
                border: "none",
              }}
            >
              {(!draftCarrierId || !draftMethodId) ? "Save. Decide later" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Discard-confirmation guard. Two paths in the primary group:
          revert the in-flight changes, or keep editing. Below them, a
          separated tertiary path lets the user clear the carrier and
          method so the shipment team can finalise them later. */}
      <ConfirmationModal
        isOpen={showDiscardConfirm}
        title={dirty ? "Discard unsaved changes?" : "Close Shipment Method?"}
        message={(() => {
          const scopeNoun = isLineLevel === true
            ? "this line item"
            : isLineLevel === false
              ? "the order default"
              : "this shipment";
          if (dirty) {
            return `Your shipment method changes for ${scopeNoun} have not been saved. Discarding will restore the previously saved carrier and method.`;
          }
          return `A carrier and method are set for ${scopeNoun}. Closing will keep them as is.`;
        })()}
        confirmText={dirty ? "Discard changes" : "Close"}
        cancelText="Keep editing"
        variant="red"
        icon={<Truck />}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={handleDiscard}
      />

      {/* ── Carrier detail sub-modal ───────────────────────────
          Method picker. Apply stages BOTH the carrier and method
          into the draft; the parent picker stays open so the user
          confirms via Save Changes. */}
      {detailCarrierId && (
        <CarrierDetailModal
          carrier={allCarriers.find((c) => c.id === detailCarrierId)!}
          currentMethodId={draftCarrierId === detailCarrierId ? draftMethodId : undefined}
          onClose={() => setDetailCarrierId(null)}
          onApply={(methodId) => {
            setDraftCarrierId(detailCarrierId);
            setDraftMethodId(methodId);
            setDetailCarrierId(null);
          }}
        />
      )}

      {/* ── Add Customer Freight & Logistics sub-modal ─────────
          Lifted from Partner v7 VendorDetailsPage's freight tab.
          New carriers persist in the module-level CUSTOM_CARRIERS_STORE
          so they survive a parent-modal close + re-open. Each new
          row appears at the top of the grid and is auto-selected. */}
      {showAddModal && (
        <AddCarrierModal
          onClose={() => setShowAddModal(false)}
          onSave={(carriers, primaryId) => {
            /* Newest first — match Partner's "new row at top" UX so
               the user sees what they just added without scrolling. */
            for (let i = carriers.length - 1; i >= 0; i--) {
              CUSTOM_CARRIERS_STORE.unshift(carriers[i]);
            }
            setCustomCarriers([...CUSTOM_CARRIERS_STORE]);
            /* Auto-select the draft marked primary, falling back to
               the first saved carrier. Pull its default method so
               the picker draft is ready for Save Changes. */
            const target = (primaryId && carriers.find((c) => c.id === primaryId)) ?? carriers[0];
            if (target) {
              const def = target.methods.find((m) => m.isDefault) ?? target.methods[0];
              setDraftCarrierId(target.id);
              setDraftMethodId(def?.id);
            }
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}

/* ── Partner-faithful carrier detail sub-modal ───────────────
   Same chrome as the Partner detailsCarrier dialog: title row
   with pills, name + description, methods listed as rows with
   a left-side radio for selection. Footer: Close / Apply. */

function CarrierDetailModal({
  carrier, currentMethodId, onClose, onApply,
}: {
  carrier: Carrier;
  currentMethodId?: string;
  onClose: () => void;
  onApply: (methodId: string) => void;
}) {
  const [draftMethodId, setDraftMethodId] = useState<string>(
    currentMethodId ?? carrier.methods.find((m) => m.isDefault)?.id ?? carrier.methods[0]?.id ?? ""
  );

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12300, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="bg-white flex flex-col"
        style={{
          /* Partner v7 detail-modal sizing — `min(65vw, 960px)` wide,
             auto height with 90vh ceiling. Same dimensions Partner
             uses for its carrier detail / edit dialog so the sub-
             modal feels lifted from there. */
          width: "min(65vw, 960px)",
          maxWidth: "calc(100% - 32px)",
          maxHeight: "90vh",
          height: "auto",
          borderRadius: 16,
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-white" style={{ padding: "16px 20px 14px", borderBottom: "1px solid #EEF2F6" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-stretch rounded-full overflow-hidden shrink-0" style={{ border: "1px solid #BFDBFE" }}>
                  <span className="inline-flex items-center gap-1 px-2 py-[2px]" style={{ fontSize: 10, fontWeight: 600, color: "#1E40AF", backgroundColor: "#EFF6FF" }}>
                    <Truck className="w-3 h-3" /> Carrier
                  </span>
                  <span className="inline-flex items-center px-2 py-[2px]" style={{ fontSize: 10, fontWeight: 500, color: "#64748B", backgroundColor: "#FFFFFF", borderLeft: "1px solid #BFDBFE" }}>
                    {carrier.methods.length} Method{carrier.methods.length !== 1 ? "s" : ""}
                  </span>
                </span>
                {carrier.isDefault && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 rounded-md"
                    style={{ fontSize: 10, fontWeight: 700, height: 20, backgroundColor: "#EFF6FF", color: "#0A77FF", border: "1px solid #BFDBFE" }}
                  >
                    <Star className="w-2.5 h-2.5" /> Primary
                  </span>
                )}
                <span
                  className="inline-flex items-center px-1.5 rounded-md"
                  style={{
                    fontSize: 10, fontWeight: 500, height: 20,
                    backgroundColor: carrier.status === "active" ? "#F0FDF4" : "#F1F5F9",
                    color: carrier.status === "active" ? "#166534" : "#94A3B8",
                    border: `1px solid ${carrier.status === "active" ? "#BBF7D0" : "#E2E8F0"}`,
                  }}
                >
                  {carrier.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", marginTop: 8, lineHeight: 1.3 }}>
                {carrier.name}
              </h2>
              <p style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{carrier.description}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer"
              style={{ color: "#94A3B8" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F1F5F9"; e.currentTarget.style.color = "#64748B"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#94A3B8"; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body — methods list */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#FAFBFC", padding: "16px 20px" }}>
          <div className="text-[13px] text-foreground" style={{ fontWeight: 600, marginBottom: 8 }}>
            Methods
          </div>
          <div className="space-y-2">
            {carrier.methods.map((m) => {
              const isActive = draftMethodId === m.id;
              return (
                <label
                  key={m.id}
                  className="flex items-center gap-3 cursor-pointer transition-all"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: isActive ? "1.5px solid #0A77FF" : "1px solid #E2E8F0",
                    backgroundColor: isActive ? "#EFF6FF" : "#FFFFFF",
                    boxShadow: isActive ? "0 2px 12px -4px rgba(10,119,255,0.18)" : "none",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = "#BFDBFE"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = "#E2E8F0"; }}
                  onClick={() => setDraftMethodId(m.id)}
                >
                  <PartnerRadio active={isActive} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }} className="truncate">{m.name}</span>
                      {m.isDefault && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 rounded"
                          style={{ fontSize: 9, fontWeight: 700, height: 16, backgroundColor: "#EFF6FF", color: "#0A77FF" }}
                        >
                          <Star className="w-2.5 h-2.5" style={{ fill: "#0A77FF" }} /> Default
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: "#64748B", marginTop: 1 }} className="line-clamp-1">{m.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                      <Clock className="w-3 h-3" style={{ color: "#94A3B8" }} />
                      {m.minDays === m.maxDays
                        ? `${m.minDays} day${m.minDays === 1 ? "" : "s"}`
                        : `${m.minDays}–${m.maxDays} days`}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 bg-white" style={{ padding: "12px 20px", borderTop: "1px solid #EEF2F6" }}>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg cursor-pointer"
            style={{ fontSize: 13, fontWeight: 600, color: "#64748B", border: "1px solid #E2E8F0", backgroundColor: "#FFFFFF" }}
          >
            Close
          </button>
          <button
            onClick={() => onApply(draftMethodId)}
            disabled={!draftMethodId}
            className="h-9 px-4 rounded-lg cursor-pointer inline-flex items-center gap-1.5"
            style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", backgroundColor: "#0A77FF", opacity: draftMethodId ? 1 : 0.5 }}
          >
            <Check className="w-3.5 h-3.5" /> Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Carrier-only card (master) — Partner v7 ShippingMethodCarrierCard
   port from ShippingCarrierCard.tsx:193. Same row scaffold:
   • Row 1: "Carrier · N Methods" type pill (left) + Primary + Active
   • Row 2: carrier name
   • Row 3: 32-px description block (line-clamp-2, fixed height)
   • Row 4: method tier chips (only when >1 method; primary tag carries
           a star)
   • Row 5: bottom strip — Package + method name (left), Clock +
           transit days (right), pinned via `mt-auto` so cards stay
           uniformly tall in the grid
   The inner content lives in `p-3 flex-1 flex flex-col min-h-0
   overflow-hidden` so the strip can lock to the bottom edge. */
function CarrierPickCard({
  carrier, isSelected, selectedMethodId, onSelect, onCardSelect, onPickMethod,
}: {
  carrier: Carrier;
  isSelected: boolean;
  selectedMethodId?: string;
  /* Method-picker trigger — fired by the active-method pill and the
     bottom gray strip. Opens the method sub-modal with the carrier's
     current/default method preselected. */
  onSelect: () => void;
  /* Whole-card click — selects the carrier (and seeds its default
     method) WITHOUT opening the method sub-modal. The pill and the
     gray strip remain the explicit way to change the method. */
  onCardSelect: () => void;
  /* Inline method-pill click — sets the carrier + method in the
     parent draft without opening the sub-modal. */
  onPickMethod: (methodId: string) => void;
}) {
  const isPrimary = carrier.isDefault;
  const status = carrier.status;
  const statusStyle = status === "active"
    ? { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" }
    : { bg: "#F1F5F9", color: "#64748B", border: "#E2E8F0" };
  const activeMethod = (isSelected && selectedMethodId
    ? carrier.methods.find((m) => m.id === selectedMethodId)
    : null) ?? carrier.methods.find((m) => m.isDefault) ?? carrier.methods[0];

  return (
    <div
      onClick={onCardSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCardSelect(); } }}
      aria-pressed={isSelected}
      className="bg-white border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative h-full"
      style={{
        border: isSelected ? "1px solid rgba(10, 119, 255, 0.55)" : "1px solid #E2E8F0",
        backgroundColor: isSelected ? "#F5F9FF" : "#FFFFFF",
        boxShadow: isSelected
          ? "0 1px 3px rgba(0,0,0,0.04)"
          : "0 1px 3px rgba(0,0,0,0.03)",
      }}
      onMouseEnter={(e) => {
        if (isSelected) return;
        e.currentTarget.style.borderColor = "#BFDBFE";
        e.currentTarget.style.boxShadow = "0 4px 16px -4px rgba(10,119,255,0.10), 0 0 0 1px #BFDBFE";
      }}
      onMouseLeave={(e) => {
        if (isSelected) return;
        e.currentTarget.style.borderColor = "#E2E8F0";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";
      }}
    >
      {isSelected ? (
        <span
          className="absolute flex items-center justify-center"
          style={{
            top: 8, right: 8,
            width: 22, height: 22, borderRadius: 999,
            backgroundColor: "#0A77FF",
          }}
        >
          <Check style={{ width: 12, height: 12, color: "#FFFFFF" }} strokeWidth={3} />
        </span>
      ) : (
        /* Hover-only empty circle — matches the Partner v7 multi-select
           chrome (Warehouse card + group-selection grid). Nothing at
           rest so unselected cards read clean. */
        <span
          className="absolute hidden group-hover:flex items-center justify-center bg-white"
          style={{
            top: 8, right: 8,
            width: 22, height: 22, borderRadius: 999,
            border: "2px solid #CBD5E1",
          }}
          aria-hidden
        />
      )}

      <div className="p-3 flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0" style={{ paddingRight: 26 }}>
          <span className="inline-flex items-stretch rounded-full overflow-hidden shrink-0" style={{ border: "1px solid #BFDBFE" }}>
            <span className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]" style={{ fontWeight: 600, color: "#1E40AF", backgroundColor: "#EFF6FF" }}>
              <Truck className="w-3 h-3" /> Carrier
            </span>
            <span className="inline-flex items-center px-2 py-[2px] text-[10px]" style={{ fontWeight: 500, color: "#64748B", backgroundColor: "#FFFFFF", borderLeft: "1px solid #BFDBFE" }}>
              {carrier.methods.length} Method{carrier.methods.length !== 1 ? "s" : ""}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            {isPrimary && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-md text-[10px]"
                style={{ fontWeight: 600, backgroundColor: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE" }}
              >
                <Star className="w-2.5 h-2.5" style={{ fill: "#1E40AF" }} />
                Primary
              </span>
            )}
            <span
              className="px-1.5 py-[2px] rounded-md text-[10px] whitespace-nowrap"
              style={{ fontWeight: 500, backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}
            >
              {status === "active" ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="shrink-0 mb-1">
          <p className="text-[13px] truncate" style={{ fontWeight: 600, color: "#334155" }}>{carrier.name}</p>
        </div>

        <div className="shrink-0 mb-2" style={{ height: 32 }}>
          <p className="text-[11px] line-clamp-2" style={{ fontWeight: 400, color: "#64748B", lineHeight: 1.45 }}>
            {carrier.description}
          </p>
        </div>

        {/* Method row — Partner v7 method-chip pill chrome (lifted
            from ShippingMethodCarrierCard's tier-chip block: 10px
            text, `#EFF6FF` bg with `var(--primary)` color, ring
            `0 0 0 1px #0A77FF30`, primary star). NOTE: we use bare
            `var(--primary)` not `hsl(var(--primary))` because the
            module's theme tokens are stored as raw hex strings — the
            `hsl()` wrapper would resolve to `hsl(#0A77FF)` and fall
            back to inherited slate text, which is why the pill was
            reading as near-black before.
            Carries the active method's short name and — when the
            carrier has more than one method — a trailing "Change"
            affordance + pencil glyph. Click stops propagation so it
            opens the method picker without triggering the
            whole-card select. */}
        {/* Method block — single bordered container with two stacked rows:
            top row is the "Selected method" trigger that opens the picker
            (only when carrier has >1 method); bottom row is informational
            (full method name + transit window). Both rows share the same
            outer border so they read as one paired control. */}
        {activeMethod && (() => {
          const isInteractive = carrier.methods.length > 1;
          return (
            <div className="mt-auto pt-2 shrink-0">
              <div
                role={isInteractive ? "button" : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                aria-label={isInteractive ? `Change method (currently ${activeMethod.shortName})` : `Method: ${activeMethod.shortName}`}
                onClick={isInteractive ? (e) => { e.stopPropagation(); onSelect(); } : undefined}
                onKeyDown={isInteractive ? (e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onSelect(); }
                } : undefined}
                className="group/methodbox w-full rounded-lg border overflow-hidden transition-colors"
                style={{
                  borderColor: "#E8ECF1",
                  cursor: isInteractive ? "pointer" : "default",
                }}
                onMouseEnter={isInteractive ? (e) => {
                  e.currentTarget.style.borderColor = "#CBD5E1";
                } : undefined}
                onMouseLeave={isInteractive ? (e) => {
                  e.currentTarget.style.borderColor = "#E8ECF1";
                } : undefined}
              >
                {/* Top row — white bg so the "Change" affordance reads cleanly */}
                <div
                  className="flex items-center justify-between gap-2 px-2.5 py-[5px] text-[10px] transition-colors group-hover/methodbox:bg-[#F8FAFC]"
                  style={{ backgroundColor: "#FFFFFF" }}
                >
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span style={{ fontWeight: 500, color: "#64748B" }}>Selected method:</span>
                    <span className="inline-flex items-center gap-1">
                      <span style={{ fontWeight: 600, color: "#0F172A" }}>{activeMethod.shortName}</span>
                      {activeMethod.isDefault && (
                        <Star className="w-2.5 h-2.5" style={{ color: "#94A3B8", fill: "#94A3B8" }} />
                      )}
                    </span>
                  </span>
                  {isInteractive && (
                    <span className="shrink-0 inline-flex items-center gap-1" style={{ fontWeight: 500, color: "var(--primary)" }}>
                      <Pencil className="w-2.5 h-2.5" style={{ color: "var(--primary)" }} />
                      <span>Change</span>
                    </span>
                  )}
                </div>
                {/* Internal divider */}
                <div style={{ height: 1, backgroundColor: "#E8ECF1" }} />
                {/* Bottom row — gray bg, informational */}
                <div
                  className="flex items-center justify-between px-2.5 py-[5px] text-[11px] tabular-nums transition-colors group-hover/methodbox:bg-[#F1F5F9]"
                  style={{ backgroundColor: "#FAFBFC" }}
                >
                  <div className="flex items-center gap-1.5 min-w-0" style={{ color: "#64748B" }}>
                    <Package className="w-3 h-3 shrink-0" style={{ color: "#94A3B8" }} />
                    <span className="truncate" style={{ fontWeight: 400 }}>{activeMethod.name}</span>
                  </div>
                  <span className="shrink-0 ml-2 inline-flex items-center gap-1" style={{ color: "#64748B", fontWeight: 600 }}>
                    <Clock className="w-3 h-3" style={{ color: "#94A3B8" }} />
                    {fmtDateRange(activeMethod.minDays, activeMethod.maxDays)}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ── Add Freight & Logistics modal ───────────────────────────
   Ported from Partner v7 VendorDetailsPage.tsx:8742-9333 — the
   "+ Add Customer Freight & Logistics" multi-carrier draft form.
   Same chrome, same draft array shape, same dropdowns (carrier
   popover + multi-select method popover + add-another-row), so
   the picker's green-button flow now reads identically to Partner.
   Each saved draft becomes one carrier in the picker grid; the
   parent picker auto-selects the primary draft once saved. */

/* Partner v7's FL_MASTER_CARRIERS catalog — the carrier roster the
   add-modal picks from. Includes a "Customer Pickup" pseudo-carrier
   so the user can stage a self-pickup mode with no methods. */
type AddMasterCarrier = {
  id: string;
  name: string;
  type: string;
  desc: string;
  status: "Active" | "Under Review" | "Inactive";
  methods: { id: string; name: string; shortName: string; desc: string; minDays: number; maxDays: number; isDefault: boolean; cost: string }[];
  isPickup?: boolean;
};

const FL_MASTER_CARRIERS: AddMasterCarrier[] = [
  { id: "FLMC-CUST-PICKUP", name: "Customer Pickup", type: "Pickup", status: "Active",
    desc: "Customer picks up the order from our staging location — no third-party carrier handoff.",
    methods: [], isPickup: true },
  { id: "FLMC-1", name: "FedEx Express", type: "Air & Ground", status: "Active",
    desc: "Premium express shipping for time-critical deliveries", methods: [
      { id: "flmc1-m1", name: "FedEx Express (Air)", shortName: "Air", desc: "Premium air freight", minDays: 1, maxDays: 2, isDefault: true, cost: "$45.00" },
      { id: "flmc1-m2", name: "FedEx Ground",         shortName: "Ground", desc: "Standard ground delivery", minDays: 3, maxDays: 5, isDefault: false, cost: "$12.00" },
    ]},
  { id: "FLMC-2", name: "DHL International", type: "International", status: "Active",
    desc: "Global logistics and international shipping solutions", methods: [
      { id: "flmc2-m1", name: "DHL Express", shortName: "Air", desc: "International express", minDays: 3, maxDays: 5, isDefault: true, cost: "$38.00" },
      { id: "flmc2-m2", name: "DHL Ocean",  shortName: "Sea", desc: "Ocean freight",          minDays: 14, maxDays: 21, isDefault: false, cost: "$8.50" },
    ]},
  { id: "FLMC-3", name: "UPS Freight", type: "Ground & Freight", status: "Active",
    desc: "Reliable ground freight and LTL services", methods: [
      { id: "flmc3-m1", name: "UPS Ground",     shortName: "Ground",  desc: "Ground shipping",            minDays: 3, maxDays: 7, isDefault: true, cost: "$15.00" },
      { id: "flmc3-m2", name: "UPS Freight LTL", shortName: "Freight", desc: "Less-than-truckload freight", minDays: 5, maxDays: 10, isDefault: false, cost: "$22.00" },
    ]},
  { id: "FLMC-4", name: "Maersk Line", type: "Ocean Freight", status: "Active",
    desc: "World-leading ocean container shipping", methods: [
      { id: "flmc4-m1", name: "Maersk Ocean", shortName: "Sea", desc: "Container shipping", minDays: 14, maxDays: 21, isDefault: true, cost: "$6.50" },
    ]},
  { id: "FLMC-5", name: "XPO Logistics", type: "LTL & Freight", status: "Under Review",
    desc: "Freight brokerage and logistics management", methods: [
      { id: "flmc5-m1", name: "XPO LTL", shortName: "Freight", desc: "LTL freight", minDays: 5, maxDays: 10, isDefault: true, cost: "$18.00" },
    ]},
  { id: "FLMC-6", name: "TCS (Tranzum Courier)", type: "Regional", status: "Active",
    desc: "Regional express courier for South Asian markets", methods: [
      { id: "flmc6-m1", name: "TCS Express", shortName: "Air", desc: "Express courier", minDays: 1, maxDays: 3, isDefault: true, cost: "$5.00" },
    ]},
  { id: "FLMC-7", name: "Aramex", type: "International", status: "Active",
    desc: "International express delivery and logistics", methods: [
      { id: "flmc7-m1", name: "Aramex Express", shortName: "Air",    desc: "International express", minDays: 3, maxDays: 7, isDefault: true, cost: "$28.00" },
      { id: "flmc7-m2", name: "Aramex Ground",  shortName: "Ground", desc: "Domestic ground",       minDays: 5, maxDays: 8, isDefault: false, cost: "$9.00" },
    ]},
  { id: "FLMC-8", name: "USPS Priority Mail", type: "Ground", status: "Active",
    desc: "USPS domestic priority shipping network", methods: [
      { id: "flmc8-m1", name: "USPS Priority", shortName: "Ground", desc: "2–3 day priority shipping", minDays: 2, maxDays: 3, isDefault: true, cost: "$8.00" },
    ]},
];

function getCarrierInitials(name: string): string {
  if (name.includes("FedEx"))  return "FE";
  if (name.includes("DHL"))    return "DHL";
  if (name.includes("UPS"))    return "UPS";
  if (name.includes("TCS"))    return "TCS";
  if (name.includes("Aramex")) return "AR";
  if (name.includes("Maersk")) return "MK";
  if (name.includes("XPO"))    return "XPO";
  if (name.includes("USPS"))   return "USPS";
  return name.slice(0, 2).toUpperCase();
}

type AddDraft = {
  id: string;
  carrierId: string;
  methodIds: string[];
  primaryMethodId: string;
  isDefault: boolean;
  carrierOpen: boolean;
  methodOpen: boolean;
  carrierSearch: string;
  methodSearch: string;
};

const makeAddDraft = (): AddDraft => ({
  id: `addd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  carrierId: "",
  methodIds: [],
  primaryMethodId: "",
  isDefault: true,
  carrierOpen: false,
  methodOpen: false,
  carrierSearch: "",
  methodSearch: "",
});

function AddCarrierModal({
  onClose, onSave,
}: {
  onClose: () => void;
  /* Fires once per saved draft. The caller pushes each carrier into
     CUSTOM_CARRIERS_STORE in order, then auto-selects the primary. */
  onSave: (carriers: Carrier[], primaryId?: string) => void;
}) {
  const [addDrafts, setAddDrafts] = useState<AddDraft[]>([makeAddDraft()]);
  const [addCarrierErrors, setAddCarrierErrors] = useState<Record<string, boolean>>({});

  const updateAddDraft = (id: string, patch: Partial<AddDraft>) => {
    setAddDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const addAnotherDraft = () => {
    setAddDrafts((prev) => [...prev, { ...makeAddDraft(), isDefault: false }]);
  };
  const removeAddDraft = (id: string) => {
    setAddDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (next.length > 0 && !next.some((d) => d.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return next.length > 0 ? next : [makeAddDraft()];
    });
  };
  const setPrimaryDraft = (id: string) => {
    setAddDrafts((prev) => prev.map((d) => ({ ...d, isDefault: d.id === id })));
  };

  const handleSave = () => {
    /* Validate — first flag drafts missing a carrier, then bail if
       nothing got picked. Pickup-type drafts can skip the method
       check; everyone else needs ≥ 1 method. */
    const carrierMissing = addDrafts.filter((d) => !d.carrierId);
    if (carrierMissing.length > 0) {
      const next: Record<string, boolean> = {};
      for (const d of carrierMissing) next[d.id] = true;
      setAddCarrierErrors((p) => ({ ...p, ...next }));
      return;
    }
    const valid = addDrafts.filter((d) => {
      if (!d.carrierId) return false;
      const c = FL_MASTER_CARRIERS.find((x) => x.id === d.carrierId);
      if (!c) return false;
      return c.isPickup || d.methodIds.length > 0;
    });
    if (valid.length === 0) {
      toast.error("Add at least one shipping method");
      return;
    }
    const carriers: Carrier[] = valid.map((d) => {
      const c = FL_MASTER_CARRIERS.find((x) => x.id === d.carrierId)!;
      const picked = c.methods.filter((m) => d.methodIds.includes(m.id));
      return {
        id: `custom-${c.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: c.name,
        description: c.desc,
        status: c.status === "Active" ? "active" : "inactive",
        isDefault: false,
        methods: picked.length > 0
          ? picked.map((m) => ({
              id: `${Date.now()}-${m.id}`,
              name: m.name,
              shortName: m.shortName,
              description: m.desc,
              minDays: m.minDays,
              maxDays: m.maxDays,
              isDefault: m.id === d.primaryMethodId,
            }))
          /* Pickup pseudo-carrier — synthesize a single method so
             the picker grid still has something to display. */
          : [{ id: `${Date.now()}-pickup`, name: c.name, shortName: "Pickup", description: c.desc, minDays: 0, maxDays: 1, isDefault: true }],
      };
    });
    const primaryDraft = valid.find((d) => d.isDefault) ?? valid[0];
    const primaryId = primaryDraft && carriers[valid.indexOf(primaryDraft)]?.id;
    toast.success(`${carriers.length} carrier${carriers.length > 1 ? "s" : ""} added`);
    onSave(carriers, primaryId);
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12400, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="bg-white flex flex-col"
        style={{
          width: "min(65vw, 960px)",
          maxWidth: "calc(100% - 32px)",
          maxHeight: "90vh",
          height: "auto",
          borderRadius: 16,
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Partner v7 add-freight chrome */}
        <div className="px-4 sm:px-5 pt-4 pb-3.5 shrink-0 bg-white border-b border-[#EEF2F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-[16px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                  Add Customer Freight &amp; Logistics
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  <Truck className="w-3 h-3" /> Carrier · Methods
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-1" style={{ fontWeight: 400 }}>
                Pick a carrier and the methods it offers. Add another carrier below to stack multiple.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body — N carrier draft cards + "Add Another Carrier" */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#FAFBFC", padding: 20 }}>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {addDrafts.map((draft, dIdx) => {
              const isMulti = addDrafts.length > 1;
              const selectedCarrier = draft.carrierId ? FL_MASTER_CARRIERS.find((c) => c.id === draft.carrierId) : undefined;
              const filteredMethods = (() => {
                if (!selectedCarrier) return [];
                const q = draft.methodSearch.trim().toLowerCase();
                if (!q) return selectedCarrier.methods;
                return selectedCarrier.methods.filter(
                  (m) => m.name.toLowerCase().includes(q) || m.shortName.toLowerCase().includes(q),
                );
              })();
              const q = draft.carrierSearch.trim().toLowerCase();
              const scoped = FL_MASTER_CARRIERS.filter((c) => !c.isPickup || c.id === "FLMC-CUST-PICKUP");
              const carrierFiltered = q
                ? scoped.filter((c) => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q))
                : scoped;
              const pickups = carrierFiltered.filter((c) => c.isPickup);
              const carriers = carrierFiltered.filter((c) => !c.isPickup);

              const renderCarrierRow = (c: AddMasterCarrier) => {
                const isActive = draft.carrierId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => updateAddDraft(draft.id, { carrierId: c.id, methodIds: [], primaryMethodId: "", carrierOpen: false, carrierSearch: "" })}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${isActive ? "bg-primary/10" : "hover:bg-muted/60"}`}
                  >
                    {c.isPickup ? (
                      <div className="w-6 h-6 rounded bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                        <Package className="w-3 h-3 text-amber-700" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
                        <span className="text-[9px] text-muted-foreground" style={{ fontWeight: 700 }}>{getCarrierInitials(c.name)}</span>
                      </div>
                    )}
                    <span className="text-sm text-foreground flex-1 truncate" style={{ fontWeight: isActive ? 600 : 400 }}>{c.name}</span>
                    {isActive && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              };

              return (
                <div key={draft.id} className="rounded-xl bg-white" style={{ border: "1px solid #E2E8F0", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
                  {/* Header strip */}
                  <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[#EEF2F6] bg-[#FAFBFC]">
                    <div className="flex items-center gap-2 min-w-0">
                      {isMulti && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px]" style={{ backgroundColor: "rgba(10, 119, 255, 0.10)", color: "#0A77FF", fontWeight: 700 }}>
                          {dIdx + 1}
                        </span>
                      )}
                      {selectedCarrier ? (
                        <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{selectedCarrier.name}</span>
                      ) : (
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Carrier {dIdx + 1}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isMulti && (
                        draft.isDefault ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md"
                            style={{ fontWeight: 700, fontSize: 10, height: 20, backgroundColor: "#EFF6FF", color: "#0A77FF", border: "1px solid #BFDBFE" }}
                          >
                            <Star className="w-2.5 h-2.5" style={{ fill: "#0A77FF" }} /> Primary
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPrimaryDraft(draft.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-white text-[10.5px] text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-accent transition-all cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
                            <Star className="w-2.5 h-2.5" /> Set as Primary
                          </button>
                        )
                      )}
                      {isMulti && (
                        <button
                          type="button"
                          onClick={() => removeAddDraft(draft.id)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                          aria-label="Remove carrier"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body — carrier + methods grid */}
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2" style={{ gap: 16 }}>
                    {/* Shipping Carrier */}
                    <div>
                      <label className="text-xs text-foreground" style={{ fontWeight: 500 }}>
                        Shipping Carrier <span className="text-destructive">*</span>
                      </label>
                      <Popover open={draft.carrierOpen} onOpenChange={(o) => updateAddDraft(draft.id, { carrierOpen: o })}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={`mt-1 w-full flex items-center justify-between h-10 px-3 rounded-lg border bg-white text-sm transition-colors cursor-pointer ${addCarrierErrors[draft.id] ? "border-destructive focus-within:ring-1 focus-within:ring-destructive" : "border-border hover:border-slate-300"}`}
                          >
                            {selectedCarrier ? (
                              <div className="flex items-center gap-2 min-w-0">
                                {selectedCarrier.isPickup ? (
                                  <div className="w-6 h-6 rounded bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                                    <Package className="w-3 h-3 text-amber-700" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
                                    <span className="text-[9px] text-muted-foreground" style={{ fontWeight: 700 }}>{getCarrierInitials(selectedCarrier.name)}</span>
                                  </div>
                                )}
                                <span className="text-foreground text-sm truncate">{selectedCarrier.name}</span>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-sm">Select a carrier</span>
                            )}
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="p-0 !w-[var(--radix-popover-trigger-width)] !z-[12500]"
                          align="start"
                          sideOffset={4}
                          style={{ maxHeight: 360, borderRadius: 10, boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)" }}
                        >
                          <div className="p-2 border-b border-border bg-white" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                              <input
                                type="text"
                                value={draft.carrierSearch}
                                onChange={(e) => updateAddDraft(draft.id, { carrierSearch: e.target.value })}
                                placeholder="Search carriers..."
                                className="w-full h-8 pl-8 pr-3 text-[13px] outline-none rounded-md"
                                style={{ border: "1px solid #E2E8F0", backgroundColor: "#FFFFFF" }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => toast.info("Custom carriers will be available soon — pick from the catalog for now.")}
                              className="w-full mt-2 inline-flex items-center justify-center gap-1.5 h-8 rounded-md transition-colors cursor-pointer"
                              style={{ color: "#0A77FF", fontSize: 12, fontWeight: 600 }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(10, 119, 255, 0.06)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                            >
                              <Plus className="w-3 h-3" /> Create New Carrier
                            </button>
                          </div>
                          <div className="overflow-y-auto" style={{ maxHeight: 260, padding: 6 }}>
                            {pickups.length > 0 && (
                              <>
                                <div className="px-2 pt-1 pb-1 text-[10px] tracking-wider" style={{ color: "#94A3B8", fontWeight: 700 }}>PICKUP</div>
                                {pickups.map(renderCarrierRow)}
                              </>
                            )}
                            {carriers.length > 0 && (
                              <>
                                <div className="px-2 pt-2 pb-1 text-[10px] tracking-wider" style={{ color: "#94A3B8", fontWeight: 700 }}>CARRIERS</div>
                                {carriers.map(renderCarrierRow)}
                              </>
                            )}
                            {carrierFiltered.length === 0 && (
                              <div className="text-center text-[12px] text-slate-400 py-6">No carriers match "{draft.carrierSearch}"</div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Shipping Methods */}
                    <div>
                      <label className="text-xs text-foreground" style={{ fontWeight: 500 }}>
                        Shipping Methods
                      </label>
                      <Popover open={draft.methodOpen} onOpenChange={(o) => updateAddDraft(draft.id, { methodOpen: o })}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={!selectedCarrier || (selectedCarrier?.isPickup === true)}
                            className={`mt-1 w-full flex items-center justify-between h-10 px-3 rounded-lg border bg-white text-sm transition-colors ${(!selectedCarrier || selectedCarrier.isPickup) ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-slate-300"}`}
                            style={{ borderColor: "#E2E8F0" }}
                          >
                            <span className={draft.methodIds.length === 0 ? "text-slate-300 text-sm" : "text-foreground text-sm"}>
                              {selectedCarrier?.isPickup
                                ? "No methods (pickup)"
                                : draft.methodIds.length === 0
                                  ? "Select methods"
                                  : `${draft.methodIds.length} method${draft.methodIds.length === 1 ? "" : "s"} selected`}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="p-0 !w-[var(--radix-popover-trigger-width)] !z-[12500]"
                          align="start"
                          sideOffset={4}
                          style={{ maxHeight: 360, borderRadius: 10, boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)" }}
                        >
                          <div className="p-2 border-b border-border bg-white" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                              <input
                                type="text"
                                value={draft.methodSearch}
                                onChange={(e) => updateAddDraft(draft.id, { methodSearch: e.target.value })}
                                placeholder="Search methods..."
                                className="w-full h-8 pl-8 pr-3 text-[13px] outline-none rounded-md"
                                style={{ border: "1px solid #E2E8F0", backgroundColor: "#FFFFFF" }}
                              />
                            </div>
                          </div>
                          <div className="overflow-y-auto" style={{ maxHeight: 280, padding: 6 }}>
                            {filteredMethods.length === 0 ? (
                              <div className="text-center text-[12px] text-slate-400 py-6">
                                {selectedCarrier ? `No methods match "${draft.methodSearch}"` : "Pick a carrier first"}
                              </div>
                            ) : filteredMethods.map((m) => {
                              const checked = draft.methodIds.includes(m.id);
                              const isPrimary = draft.primaryMethodId === m.id;
                              const daysLabel = m.minDays === m.maxDays ? `${m.minDays} day${m.minDays === 1 ? "" : "s"}` : `${m.minDays}-${m.maxDays} days`;
                              return (
                                <div
                                  key={m.id}
                                  onClick={() => {
                                    const isRemoving = checked;
                                    const next = isRemoving
                                      ? draft.methodIds.filter((x) => x !== m.id)
                                      : [...draft.methodIds, m.id];
                                    let nextPrimary = draft.primaryMethodId;
                                    if (isRemoving && draft.primaryMethodId === m.id) nextPrimary = next[0] || "";
                                    else if (!isRemoving && !draft.primaryMethodId) nextPrimary = m.id;
                                    updateAddDraft(draft.id, { methodIds: next, primaryMethodId: nextPrimary });
                                  }}
                                  className={`group/m flex items-start gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${checked ? "bg-primary/5" : "hover:bg-muted/60"}`}
                                >
                                  <div className={`mt-0.5 w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${checked ? "border-primary bg-primary" : "border-border bg-background"}`}>
                                    {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{m.name}</span>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{m.desc}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                                    <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{daysLabel}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const nextIds = checked ? draft.methodIds : [...draft.methodIds, m.id];
                                        updateAddDraft(draft.id, { methodIds: nextIds, primaryMethodId: m.id });
                                      }}
                                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                                        isPrimary
                                          ? "text-primary"
                                          : checked
                                            ? "text-slate-300 hover:text-amber-500 hover:bg-white"
                                            : "text-slate-200 opacity-0 group-hover/m:opacity-100 hover:text-amber-500 hover:bg-white"
                                      }`}
                                      title={isPrimary ? "Primary method" : "Set as primary"}
                                    >
                                      <Star className={`w-3 h-3 ${isPrimary ? "fill-primary" : ""}`} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* "+ Add Another Carrier" — dashed-border row */}
            <button
              type="button"
              onClick={addAnotherDraft}
              className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed bg-white text-[12.5px] text-primary hover:bg-accent hover:border-primary/30 transition-all cursor-pointer"
              style={{ fontWeight: 600, borderColor: "#DBE4F0" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Another Carrier
            </button>
          </div>
        </div>

        {/* Footer — Cancel + Save Methods (Partner v7 pattern) */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E8ECF1] bg-white shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-border bg-white text-xs text-slate-500 hover:bg-muted transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-primary text-white text-xs hover:bg-[#0960D0] transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            Save Methods
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Change-scope confirmation modal ─────────────────────────
   Lifted from LineItemConfigModal's `PartnerPriceChangeModal` —
   same yellow-gradient header, same icon tile, same radio-card
   chrome, same stacked CTA. Only the icon glyph + copy strings
   vary per call site (pickup vs freight). Used to ask the user
   whether a freshly-changed pickup warehouse or carrier+method
   applies to this quote alone, or should overwrite the item /
   customer record so future quotes inherit the new default. */
function ChangeScopeModal({
  icon: Icon, badge, title, subtitle, primaryOption, secondaryOption, onApply, onCancel,
}: {
  icon: any;
  badge: string;
  title: string;
  subtitle: React.ReactNode;
  primaryOption: { key: string; title: string; description: string };
  secondaryOption: { key: string; title: string; description: string; badge?: string };
  onApply: (key: string) => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState(primaryOption.key);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onApply(choice);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [choice, onApply, onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12600, backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)", padding: 24 }}
      onClick={onCancel}
    >
      <div
        style={{
          borderRadius: 16, width: 480, maxWidth: "100%",
          overflow: "hidden",
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
          backgroundColor: "#FFFFFF",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colored glow header */}
        <div
          className="relative flex flex-col items-center"
          style={{
            paddingTop: 40, paddingBottom: 24,
            background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)",
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{ width: 180, height: 80, borderRadius: "50%", filter: "blur(50px)", opacity: 0.25, backgroundColor: "#F59E0B" }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "#FEF3C7" }}
          >
            <Icon style={{ width: 32, height: 32, color: "#B45309" }} />
          </div>
          <span
            style={{
              marginTop: 16, padding: "4px 12px", borderRadius: 999,
              fontSize: 11, fontWeight: 600, lineHeight: 1,
              backgroundColor: "#FFFBEB", color: "#92400E",
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}
          >
            {badge}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center" style={{ padding: "0 28px 28px" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--foreground)", margin: 0 }}>
            {title}
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--muted-foreground)", margin: "8px 0 0 0", maxWidth: 360 }}>
            {subtitle}
          </p>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, marginTop: 20, textAlign: "left" }}>
            <ScopeRadioCard
              selected={choice === primaryOption.key}
              onClick={() => setChoice(primaryOption.key)}
              title={primaryOption.title}
              description={primaryOption.description}
            />
            <ScopeRadioCard
              selected={choice === secondaryOption.key}
              onClick={() => setChoice(secondaryOption.key)}
              title={secondaryOption.title}
              description={secondaryOption.description}
              badge={secondaryOption.badge}
            />
          </div>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
            <button
              onClick={() => onApply(choice)}
              className="w-full"
              style={{
                height: 44, fontSize: 14, fontWeight: 600,
                backgroundColor: "#0A77FF", color: "#FFFFFF",
                border: "none", borderRadius: 12, cursor: "pointer",
                transition: "background-color 120ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#0D5ED7"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#0A77FF"; }}
            >
              Apply change
            </button>
            <button
              onClick={onCancel}
              className="w-full"
              style={{
                height: 44, fontSize: 14, fontWeight: 500,
                backgroundColor: "var(--muted)", color: "#334155",
                border: "none", borderRadius: 12, cursor: "pointer",
                transition: "opacity 120ms",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ScopeRadioCard({ selected, onClick, title, description, badge }: {
  selected: boolean; onClick: () => void; title: string; description: string; badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        width: "100%", padding: "12px 14px", textAlign: "left",
        backgroundColor: selected ? "#FFFBEB" : "#FFFFFF",
        border: `1px solid ${selected ? "#F59E0B" : "var(--border)"}`,
        borderRadius: 10, cursor: "pointer",
        transition: "all 120ms",
        fontFamily: "Inter, system-ui, sans-serif",
        boxShadow: selected ? "0 0 0 3px rgba(245,158,11,0.12)" : "none",
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 18, height: 18, marginTop: 2,
          borderRadius: "50%",
          border: `2px solid ${selected ? "#0A77FF" : "#94A3B8"}`,
          backgroundColor: "#FFFFFF",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "border-color 120ms",
        }}
      >
        {selected && (
          <span style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: "#0A77FF" }} />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.3 }}>{title}</span>
          {badge && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#B45309", backgroundColor: "#FEF3C7",
              border: "1px solid #FDE68A",
              padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em",
            }}>
              {badge}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3, lineHeight: 1.45 }}>{description}</div>
      </div>
    </button>
  );
}
