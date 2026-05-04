import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import ShippingCarrierPicker, { SHIPPING_CARRIERS_DATA, findCarrierAndMethod } from "./ShippingCarrierPicker";
import {
  Truck,
  User,
  Check,
  Hash,
  Building2,
  CalendarClock,
  AlertTriangle,
  Zap,
  FileText,
  ShoppingCart,
  Info,
  Minus,
  Plus,
  ShieldCheck,
  Boxes,
  Paperclip,
  Download,
  FileSpreadsheet,
  FileImage,
  File,
  AlertCircle,
  TrendingDown,
  BarChart3,
  Activity,
  Star,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Lock,
  ChevronRight,
  Tag,
  Wrench,
  MapPin,
  Save,
  ArrowUpDown,
  Trash2,
  Mail,
  Phone,
  MessageSquare,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import {
  getAllSystemVendorOffersForItem,
  getVendorContacts,
  getVendorCurrency,
  getVendorOffersForItem,
} from "./catalogData";
import { CurrencyAmount } from "./ui/CurrencyAmount";
import { InfoTooltip } from "./ui/info-tooltip";
import { BASE_CURRENCY, convertBetween, convertToBase, getLibraryCurrency } from "@/app/data/currencyLibrary";
import type { VendorContactInfo, ItemVendorOffer } from "./catalogData";
import VendorSelector, { VendorSelectorContent } from "./VendorSelector";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "./ui/popover";
import { FONT } from "./designTokens";
import TruncatedItemName from "./TruncatedItemName";
import {
  formatQuantityValue,
  getDraftQuantityValue,
  isValidQuantityDraft,
  parseQuantityDraft,
  preventInvalidQuantityKey,
} from "./quantityInputUtils";

/* ═══════════════════════════════════════════════════════════════
   TYPES  (unchanged — preserving public interface)
   ═══════════════════════════════════════════════════════════════ */

export interface OrderFlowItem {
  id: string;
  itemNumber: string;
  descriptiveName: string;
  image: string;
  unitPrice: number;
  currentStock: number;
  minQuantity: number;
  shortageDate: string | null;
  partnerLocation: string;
  category: string;
  location: string;
  vendorUOM: string;
  vendorUOMQty: number;
  defaultUOM: string;
  discount: number;
}

export interface OrderFlowResult {
  item: OrderFlowItem;
  quantity: number;
  vendorQty: number;
  shipByDate?: string;
  shipmentMethod: string;
  dueDeliveryDate: string;
  inboundLocation: string;
  vendorContactName: string;
  vendorContactEmail: string;
  vendorContactPhone: string;
  vendorContactRole: string;
  notes: string;
  totalPrice: number;
  unitPrice: number;
  discount: number;
  completedMode: "add-to-cart" | "buy-now";
}

export interface OrderFlowPrefill {
  vendorQty?: number;
  shipByDate?: string;
  shipmentMethod?: string;
  dueDeliveryDate?: string;
  inboundLocation?: string;
}

export type OrderFlowMode = "add-to-cart" | "buy-now" | "edit-cart" | "edit-po" | "add-to-po";

interface OrderFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: OrderFlowItem | null;
  mode: OrderFlowMode;
  prefill?: OrderFlowPrefill | null;
  onComplete: (result: OrderFlowResult) => void;
  /** Optional: render notes tab content in right-side tabs */
  renderNotesTab?: React.ReactNode;
  /** Count of notes for badge display */
  notesCount?: number;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

/* ── Shipping Carriers & Methods — now using ShippingCarrierPicker data ── */
const SHIPPING_CARRIERS = SHIPPING_CARRIERS_DATA.map((c) => ({ code: c.code, name: c.name }));
const CARRIER_METHODS: Record<string, { value: string; label: string; eta: string }[]> = {};
SHIPPING_CARRIERS_DATA.forEach((c) => {
  CARRIER_METHODS[c.code] = c.methods.map((m) => ({ value: m.value, label: m.label, eta: m.eta }));
});

/* Legacy: flat list for backward compat */
const SHIPMENT_METHODS = Object.values(CARRIER_METHODS).flat();

/* ── Inbound Locations (coded) ── */

export interface InboundLocationOption { code: string; name: string; display: string; }
export const INBOUND_LOCATION_OPTIONS: InboundLocationOption[] = [
  { code: "WH-100-L1", name: "Main Warehouse, Detroit, MI", display: "WH-100-L1 · Main Warehouse, Detroit" },
  { code: "WH-100-L2", name: "Warehouse B, Great Falls, MD", display: "WH-100-L2 · Warehouse B, Great Falls" },
  { code: "WH-200-L1", name: "Distribution Center, Pasadena, OK", display: "WH-200-L1 · Distribution Center, Pasadena" },
  { code: "WH-200-L2", name: "Regional Hub, Portland, IL", display: "WH-200-L2 · Regional Hub, Portland" },
  { code: "WH-300-L1", name: "Assembly Plant Storage, Lansing, IL", display: "WH-300-L1 · Assembly Plant Storage, Lansing" },
  { code: "WH-300-L2", name: "Cold Storage Facility, Lafayette, CA", display: "WH-300-L2 · Cold Storage Facility, Lafayette" },
  { code: "WH-400-L1", name: "East Coast Hub, Great Falls, MD", display: "WH-400-L1 · East Coast Hub, Great Falls" },
  { code: "WH-400-L2", name: "Overflow Warehouse, Stockton, NH", display: "WH-400-L2 · Overflow Warehouse, Stockton" },
  { code: "WH-500-L1", name: "Omne Warehouse Network, Detroit, MI", display: "WH-500-L1 · Omne Warehouse Network, Detroit" },
  { code: "WH-500-L2", name: "Southern Distribution, Houston, TX", display: "WH-500-L2 · Southern Distribution, Houston" },
];

const INBOUND_LOCATIONS = INBOUND_LOCATION_OPTIONS.map((l) => l.code);

const VENDOR_DEFAULT_SHIPMENT: Record<string, string> = {
  "General Motors (GM)": "fdx-ground",
  "Toyota Technical Center (TTC)": "fdx-express",
  "Ford Motor Company": "fdx-ground",
  "Tesla, Inc.": "fdx-express",
  "Chrysler (Stellantis N.V.)": "fdx-freight",
  "Honda Motor Co., Ltd. (USA)": "fdx-ground",
  "Nissan North America": "fdx-express",
  "BMW of North America": "fdx-express",
  "Rivian Automotive": "fdx-express",
  "Lucid Motors": "fdx-express",
};

const LOCATION_TO_WAREHOUSE: Record<string, string> = {
  "Pasadena, Oklahoma": "WH-200-L1",
  "Great Falls, Maryland": "WH-100-L2",
  "Lansing, Illinois": "WH-300-L1",
  "Lafayette, California": "WH-300-L2",
  "Stockton, New Hampshire": "WH-400-L2",
  "Portland, Illinois": "WH-200-L2",
};

const PRICE_UOM_OPTIONS = [
  "Piece", "Box", "Kit", "Carton", "Unit", "Pack", "Bundle", "Bag", "Set", "Each", "Pair", "Pallet",
];

function getDefaultShipping(item: OrderFlowItem) {
  const today = new Date();
  const dueDelivery = new Date(today);
  if (item.shortageDate) {
    dueDelivery.setDate(today.getDate() + 10);
  } else {
    dueDelivery.setDate(today.getDate() + 14);
  }
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return {
    dueDeliveryDate: fmt(dueDelivery),
    shipmentMethod: VENDOR_DEFAULT_SHIPMENT[item.partnerLocation] || "fedex-ground",
    inboundLocation: LOCATION_TO_WAREHOUSE[item.location] || INBOUND_LOCATIONS[0],
  };
}

/* ─── Unified typography — compact, consistent sizing ─── */
const S = {
  /** Part number — the most prominent text in the header */
  partNum:    { fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "20px", fontFamily: FONT } as React.CSSProperties,
  /** Item name — secondary to part number */
  itemName:   { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)" as string, lineHeight: "18px", fontFamily: FONT } as React.CSSProperties,
  /** Section headings inside collapsibles / panels */
  secHead:    { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "18px", fontFamily: FONT } as React.CSSProperties,
  /** Uppercase micro-labels for form fields */
  fieldLabel: { fontSize: "10px", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "14px", fontFamily: FONT, letterSpacing: "0.05em", textTransform: "uppercase" as const } as React.CSSProperties,
  /** Standard body / field value */
  body:       { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)" as string, lineHeight: "18px", fontFamily: FONT } as React.CSSProperties,
  bodyMed:    { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "18px", fontFamily: FONT } as React.CSSProperties,
  bodySemi:   { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "18px", fontFamily: FONT } as React.CSSProperties,
  /** Small helper text */
  small:      { fontSize: "11px", fontWeight: "var(--font-weight-normal)" as string, lineHeight: "15px", fontFamily: FONT } as React.CSSProperties,
  smallMed:   { fontSize: "11px", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "15px", fontFamily: FONT } as React.CSSProperties,
  /** Tiny labels / badges */
  tiny:       { fontSize: "10px", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "14px", fontFamily: FONT } as React.CSSProperties,
  badge:      { fontSize: "10px", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "14px", fontFamily: FONT } as React.CSSProperties,
  /** The single price display — moderately sized, not oversized */
  price:      { fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "24px", fontFamily: FONT } as React.CSSProperties,
  priceSm:    { fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "20px", fontFamily: FONT } as React.CSSProperties,
  /** Total in sidebar */
  total:      { fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "24px", fontFamily: FONT } as React.CSSProperties,
  /** Button label */
  btn:        { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "18px", fontFamily: FONT } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════ */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

interface POWarning { id: string; severity: "critical" | "warning" | "info"; title: string; description: string; date?: string; }
function generatePOWarnings(item: OrderFlowItem): POWarning[] {
  const w: POWarning[] = []; const h = hashStr(item.id);
  if (item.shortageDate) w.push({ id: "w1", severity: "critical", title: "Upcoming Shortage", description: `Stock projected to run out by ${item.shortageDate}. Current: ${item.currentStock} ${item.defaultUOM}. Min: ${item.minQuantity}.`, date: item.shortageDate });
  if (item.currentStock < item.minQuantity) w.push({ id: "w2", severity: "critical", title: "Below Minimum Stock", description: `Current stock (${item.currentStock}) is below minimum (${item.minQuantity}).` });
  if (item.currentStock === 0) w.push({ id: "w3", severity: "critical", title: "Zero Stock", description: "Completely out of stock. Expedited order recommended." });
  if (h % 3 === 0) w.push({ id: "w5", severity: "warning", title: "Lead Time Increased", description: "Vendor reported extended lead times. +3-5 business days." });
  if (h % 5 === 0) w.push({ id: "w6", severity: "info", title: "Price Change Notice", description: "Pending price adjustment next quarter." });
  return w;
}

interface InventoryData {
  stockLevels: { currentStock: number; minStockLevel: number; maxStockLevel: number; reorderPoint: number; safetyStock: number };
  orderQuantity: { minOrderQty: number; maxOrderQty: number; orderMultiple: number; economicOrderQty: number };
}
function generateInventoryData(item: OrderFlowItem): InventoryData {
  const h = hashStr(item.id); const min = item.minQuantity; const max = min * (3 + (h % 3));
  return { stockLevels: { currentStock: item.currentStock, minStockLevel: min, maxStockLevel: max, reorderPoint: Math.round(min * 1.2), safetyStock: Math.round(min * 0.3) }, orderQuantity: { minOrderQty: Math.max(1, Math.round(min * 0.5)), maxOrderQty: max * 2, orderMultiple: item.vendorUOMQty > 1 ? item.vendorUOMQty : (h % 5 === 0 ? 10 : h % 3 === 0 ? 5 : 1), economicOrderQty: Math.round(min * 1.5) } };
}

interface Attachment { id: string; name: string; type: "pdf" | "xlsx" | "image" | "doc"; size: string; uploadedBy: string; uploadedDate: string; }
function generateAttachments(item: OrderFlowItem): Attachment[] {
  const h = hashStr(item.id);
  const a: Attachment[] = [
    { id: "att-1", name: `${item.itemNumber}_Tech_Spec.pdf`, type: "pdf", size: "2.4 MB", uploadedBy: "System", uploadedDate: "Jan 15, 2026" },
    { id: "att-2", name: `${item.itemNumber}_Quality_Cert.pdf`, type: "pdf", size: "1.1 MB", uploadedBy: "QA Dept", uploadedDate: "Dec 20, 2025" },
  ];
  if (h % 2 === 0) a.push({ id: "att-3", name: `${item.itemNumber}_Pricing.xlsx`, type: "xlsx", size: "856 KB", uploadedBy: "Procurement", uploadedDate: "Feb 01, 2026" });
  if (h % 3 === 0) a.push({ id: "att-4", name: `${item.itemNumber}_Image.jpg`, type: "image", size: "3.8 MB", uploadedBy: "Vendor", uploadedDate: "Jan 28, 2026" });
  return a;
}

function generateQualifiedVendors(item: OrderFlowItem): { name: string; abbr: string; unitPrice: number; leadDays: number; isDefault: boolean }[] {
  const offers = getVendorOffersForItem(item.id);
  if (offers.length === 0) return [];
  const h = hashStr(item.id);
  return offers.map((o, idx) => ({ name: o.vendorName, abbr: o.abbr, unitPrice: o.unitPrice, leadDays: 5 + ((h + idx * 7) % 15), isDefault: o.isDefault }));
}

function isSerialized(item: OrderFlowItem): boolean { return hashStr(item.id) % 3 === 0; }
function isPurchased(item: OrderFlowItem): boolean { return !!item.partnerLocation; }

const VENDOR_PALETTES = [
  { bg: "var(--avatar-1-bg)", fg: "var(--avatar-1-text)" },
  { bg: "var(--avatar-2-bg)", fg: "var(--avatar-2-text)" },
  { bg: "var(--avatar-3-bg)", fg: "var(--avatar-3-text)" },
  { bg: "var(--avatar-4-bg)", fg: "var(--avatar-4-text)" },
  { bg: "var(--avatar-5-bg)", fg: "var(--avatar-5-text)" },
  { bg: "var(--avatar-6-bg)", fg: "var(--avatar-6-text)" },
  { bg: "var(--avatar-7-bg)", fg: "var(--avatar-7-text)" },
];
function vendorColor(n: string) { let h = 0; for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h); return VENDOR_PALETTES[Math.abs(h) % VENDOR_PALETTES.length]; }

function FileIcon({ type }: { type: string }) {
  const c = "size-3.5";
  if (type === "pdf") return <FileText className={c} style={{ color: "var(--destructive)" }} />;
  if (type === "xlsx") return <FileSpreadsheet className={c} style={{ color: "var(--accent)" }} />;
  if (type === "image") return <FileImage className={c} style={{ color: "var(--primary)" }} />;
  return <File className={c} style={{ color: "var(--muted-foreground)" }} />;
}

/* ══════════════════════════════════════════════════════════════
   COLLAPSIBLE SECTION
   ═══════════════════════════════════════════════════════════════ */
function Accordion({ title, icon, badge, open, onToggle, children }: { title: string; icon: React.ReactNode; badge?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <button className="w-full flex items-center justify-between px-3.5 py-2 cursor-pointer transition-colors hover:bg-secondary/40" onClick={onToggle}>
        <div className="flex items-center gap-2">{icon}<span className="text-foreground" style={S.secHead}>{title}</span>{badge}</div>
        {open ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
      </button>
      {open && <div style={{ borderTop: "1px solid var(--border)" }}>{children}</div>}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════ */

export default function OrderFlow({ open, onOpenChange, item, mode, prefill, onComplete, renderNotesTab, notesCount = 0 }: OrderFlowProps) {
  const [vendorQty, setVendorQty] = useState(1);
  const [vendorQtyInput, setVendorQtyInput] = useState("1");
  const [defaultQtyOverride, setDefaultQtyOverride] = useState<number | null>(null);
  const [defaultQtyInput, setDefaultQtyInput] = useState<string | null>(null);
  const [wasAdjusted, setWasAdjusted] = useState(false);
  const [qtySwapped, setQtySwapped] = useState(false);
  const [vendorUnitOverride, setVendorUnitOverride] = useState<string>("");
  const [shipmentMethod, setShipmentMethod] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("FDX");
  const [dueDeliveryDate, setDueDeliveryDate] = useState("");
  const [inboundLocation, setInboundLocation] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [vendorContacts, setVendorContacts] = useState<VendorContactInfo[]>([]);
  const [vendorOffers, setVendorOffers] = useState<ItemVendorOffer[]>([]);
  const [activeVendor, setActiveVendor] = useState<string>("");
  const [activeUnitPrice, setActiveUnitPrice] = useState<number>(0);
  const [activeDiscount, setActiveDiscount] = useState<number>(0);
  const [sections, setSections] = useState<Record<string, boolean>>({ warnings: false, inventory: false, vendors: false, attachments: false });
  const [activeTab, setActiveTab] = useState<string>("shipping");
  const [inventorySubTab, setInventorySubTab] = useState<"rules" | "status">("rules");
  const [emptyVendorPickerOpen, setEmptyVendorPickerOpen] = useState(false);
  // F20: track which fields have shown the default prompt
  const [defaultPromptShown, setDefaultPromptShown] = useState<Record<string, boolean>>({});
  const [defaultPromptField, setDefaultPromptField] = useState<string | null>(null);
  // F15: Add New Vendor modal — now a system vendor picker
  const [addNewVendorOpen, setAddNewVendorOpen] = useState(false);
  const [addNewVendorSearch, setAddNewVendorSearch] = useState("");

  // Multi-vendor assignment state (only for no-vendor items)
  interface AssignedVendor {
    vendorName: string;
    abbr: string;
    price: number;
    priceConfirmed: boolean;
    discount: number;
    priority: string;
    isDefault: boolean;
  }
  interface VendorPriceEntry {
    price: number;
    priceConfirmed: boolean;
    discount: number;
    unit: string;
  }

  // Currency view mode — base (PKR) or partner (active vendor's currency). Toggle lives in the top bar.
  const [viewMode, setViewMode] = useState<"base" | "partner">("partner");

  const [assignedVendors, setAssignedVendors] = useState<AssignedVendor[]>([]);
  const [vendorPriceMap, setVendorPriceMap] = useState<Record<string, VendorPriceEntry>>({});
  const vendorPriceMapRef = useRef<Record<string, VendorPriceEntry>>({});
  const [editPriceValue, setEditPriceValue] = useState("");
  const [editPriceUOM, setEditPriceUOM] = useState("");
  const [isAssigningAdditionalVendor, setIsAssigningAdditionalVendor] = useState(false);
  const toggle = (k: string) => setSections((p) => ({ ...p, [k]: !p[k] }));

  const replaceVendorPriceMap = (nextMap: Record<string, VendorPriceEntry>) => {
    vendorPriceMapRef.current = nextMap;
    setVendorPriceMap(nextMap);
  };

  const upsertVendorPrice = (vendorName: string, entry: VendorPriceEntry) => {
    replaceVendorPriceMap({
      ...vendorPriceMapRef.current,
      [vendorName]: entry,
    });
  };

  const removeVendorPrice = (vendorName: string) => {
    if (!(vendorName in vendorPriceMapRef.current)) return;
    const nextMap = { ...vendorPriceMapRef.current };
    delete nextMap[vendorName];
    replaceVendorPriceMap(nextMap);
  };

  const getVendorPrice = (vendorName: string) => vendorPriceMapRef.current[vendorName];

  // Whether the item originally has a vendor assigned
  const hasOriginalVendor = !!(item?.partnerLocation);

  useEffect(() => {
    if (item && open) {
      const serializedItem = isSerialized(item);
      setVendorContacts(getVendorContacts(item.partnerLocation));
      let offers = item.partnerLocation
        ? getVendorOffersForItem(item.id)
        : getAllSystemVendorOffersForItem(item);
      // Fallback: if vendor-assigned item has no pre-built offers (e.g. PO line items
      // that don't map to catalog IDs), build offers from all system vendors with the
      // assigned vendor marked as default.
      if (item.partnerLocation && offers.length === 0) {
        const allSystem = getAllSystemVendorOffersForItem(item);
        const defaultVendor = allSystem.find(o => o.vendorName === item.partnerLocation);
        if (defaultVendor) {
          defaultVendor.unitPrice = item.unitPrice;
          defaultVendor.priority = "default";
          defaultVendor.isDefault = true;
          defaultVendor.discount = item.discount;
        }
        // Re-sort so the assigned vendor is first with "default" priority
        offers = allSystem.map((o, idx) => {
          if (o.vendorName === item.partnerLocation) return { ...o, unitPrice: item.unitPrice, priority: "default", isDefault: true, discount: item.discount };
          return { ...o, priority: `${idx + 1}`, isDefault: false };
        }).sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : 0));
      }
      setVendorOffers(offers);
      setVendorUnitOverride(""); setDefaultQtyOverride(null); setDefaultQtyInput(null);
      setQtySwapped(false);
      setInventorySubTab("rules");
      setLocationSearch("");
      setEmptyVendorPickerOpen(false);
      setIsAssigningAdditionalVendor(false);
      setEditPriceValue("");
      setEditPriceUOM("");
      replaceVendorPriceMap({});
      setDefaultPromptShown({});
      setDefaultPromptField(null);
      setAddNewVendorOpen(false);
      setAddNewVendorSearch("");

      if (item.partnerLocation) {
        // VENDOR-ASSIGNED: revert to original behavior — auto-populate price
        const offer = offers.find(o => o.vendorName === item.partnerLocation);
        setActiveVendor(item.partnerLocation);
        setActiveUnitPrice(offer?.unitPrice ?? item.unitPrice);
        setActiveDiscount(offer?.discount ?? item.discount);
        setAssignedVendors([]); // Not used for vendor-assigned items
      } else {
        // NO VENDOR: use progressive assignment flow
        setAssignedVendors([]);
        setActiveVendor("");
        setActiveUnitPrice(0);
        setActiveDiscount(0);
      }
      setVendorContacts(getVendorContacts(item.partnerLocation));

      if (prefill) {
        const nextVendorQty = prefill.vendorQty ?? 1;
        setVendorQty(nextVendorQty);
        setVendorQtyInput(formatQuantityValue(nextVendorQty, serializedItem));
        const prefillMethod = prefill.shipmentMethod ?? "";
        const carrierPrefix = prefillMethod.split("-")[0]?.toUpperCase();
        const matchedCarrier = SHIPPING_CARRIERS.find((c) => c.code === carrierPrefix);
        setShippingCarrier(matchedCarrier?.code ?? "FDX");
        setShipmentMethod(prefillMethod);
        setDueDeliveryDate(prefill.dueDeliveryDate ?? ""); setInboundLocation(prefill.inboundLocation ?? "");
      } else {
        setVendorQty(1);
        setVendorQtyInput(formatQuantityValue(1, serializedItem));
        const d = getDefaultShipping(item);
        const carrierPrefix = d.shipmentMethod.split("-")[0]?.toUpperCase();
        const matchedCarrier = SHIPPING_CARRIERS.find((c) => c.code === carrierPrefix);
        setShippingCarrier(matchedCarrier?.code ?? "FDX");
        setShipmentMethod(d.shipmentMethod);
        setDueDeliveryDate(d.dueDeliveryDate); setInboundLocation(d.inboundLocation);
      }
      setNotes("");
      setSections({ warnings: false, inventory: false, vendors: false, attachments: false });
    }
  }, [item?.id, open, mode]);

  const poWarnings = useMemo(() => (item ? generatePOWarnings(item) : []), [item?.id]);
  const inventoryData = useMemo(() => (item ? generateInventoryData(item) : null), [item?.id]);
  const attachments = useMemo(() => (item ? generateAttachments(item) : []), [item?.id]);
  const qualifiedVendors = useMemo(() => (item ? generateQualifiedVendors(item) : []), [item?.id]);
  const noVendorDropdownOffers = useMemo(() => {
    if (hasOriginalVendor) return vendorOffers;

    const enriched = vendorOffers.map((offer) => {
      const savedPrice = vendorPriceMap[offer.vendorName];
      if (savedPrice?.priceConfirmed && savedPrice.price > 0) {
        return {
          ...offer,
          unitPrice: savedPrice.price,
          discount: savedPrice.discount,
          defaultUOM: savedPrice.unit || offer.defaultUOM,
        };
      }
      return offer;
    });

    if (assignedVendors.length === 0) return enriched;

    const assignedSet = new Set(assignedVendors.map((v) => v.vendorName));
    const assigned = enriched.filter((offer) => assignedSet.has(offer.vendorName));
    const unassigned = enriched.filter((offer) => !assignedSet.has(offer.vendorName));
    return [...assigned, ...unassigned];
  }, [hasOriginalVendor, vendorOffers, assignedVendors, vendorPriceMap]);

  // F18: Auto-adjust quantity to meet MOQ / multiples
  const handleAdjustQty = useCallback(() => {
    if (!item || !inventoryData) return;
    const { minOrderQty, orderMultiple } = inventoryData.orderQuantity;
    const currentQty = qtySwapped ? (defaultQtyOverride ?? (vendorQty * item.vendorUOMQty)) : vendorQty;
    const isVendorUnit = !qtySwapped;
    const minInUnit = isVendorUnit ? Math.ceil(minOrderQty / item.vendorUOMQty) : minOrderQty;
    const multipleInUnit = isVendorUnit ? Math.max(1, Math.ceil(orderMultiple / item.vendorUOMQty)) : orderMultiple;
    let adjusted = Math.max(currentQty, minInUnit);
    if (multipleInUnit > 1) {
      adjusted = Math.ceil(adjusted / multipleInUnit) * multipleInUnit;
    }
    const serializedItem = isSerialized(item);
    if (isVendorUnit) {
      setVendorQty(adjusted);
      setVendorQtyInput(formatQuantityValue(adjusted, serializedItem));
      setDefaultQtyOverride(null);
      setDefaultQtyInput(null);
    }
    else {
      setDefaultQtyOverride(adjusted);
      setDefaultQtyInput(formatQuantityValue(adjusted, serializedItem));
    }
    setWasAdjusted(true);
  }, [item, inventoryData, qtySwapped, defaultQtyOverride, vendorQty]);

  // F22: Calculated Ship By Date
  const calculatedShipByDate = useMemo(() => {
    if (!dueDeliveryDate || !shipmentMethod) return null;
    const found = findCarrierAndMethod(shipmentMethod);
    if (!found.method) return null;
    const etaStr = found.method.eta;
    const daysMatch = etaStr.match(/(\d+)/);
    const transitDays = daysMatch ? parseInt(daysMatch[daysMatch.length > 1 ? daysMatch.length - 1 : 0]) : 0;
    if (!transitDays) return null;
    const due = new Date(dueDeliveryDate + "T00:00:00");
    due.setDate(due.getDate() - transitDays);
    return due.toISOString().split("T")[0];
  }, [dueDeliveryDate, shipmentMethod]);

  // F20: Handle optional field change with default prompt
  const handleOptionalFieldChange = useCallback((fieldKey: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (value && !defaultPromptShown[fieldKey] && activeVendor) {
      setDefaultPromptField(fieldKey);
      setDefaultPromptShown(prev => ({ ...prev, [fieldKey]: true }));
    }
  }, [defaultPromptShown, activeVendor]);

  // F15: Handle Add New Vendor — pick from system vendors
  const handlePickSystemVendor = useCallback((offer: ItemVendorOffer) => {
    if (!item) return;
    const newOffer: ItemVendorOffer = {
      ...offer,
      unitPrice: 0,
      priority: String(vendorOffers.length + 1),
      isDefault: false,
      defaultUOM: item.vendorUOM,
      uom: item.vendorUOM,
      uomQty: item.vendorUOMQty,
      discount: 0,
    };
    setVendorOffers(prev => [...prev, newOffer]);
    if (!hasOriginalVendor) {
      const newAssigned: AssignedVendor = {
        vendorName: newOffer.vendorName, abbr: newOffer.abbr, price: 0, priceConfirmed: false, discount: 0, priority: newOffer.priority, isDefault: false,
      };
      setAssignedVendors(prev => [...prev, newAssigned]);
    }
    setActiveVendor(newOffer.vendorName);
    setActiveUnitPrice(0);
    setActiveDiscount(0);
    const contacts = getVendorContacts(newOffer.vendorName);
    setVendorContacts(contacts);
    setAddNewVendorOpen(false);
    setAddNewVendorSearch("");
    toast.success(`${newOffer.vendorName} added as vendor`, {
      description: "Enter a unit price to complete assignment",
      style: { fontFamily: FONT }, duration: 3000,
    });
  }, [item, vendorOffers, hasOriginalVendor]);

  // F24: Mock consumption data for sparkline
  const consumptionData = useMemo(() => {
    if (!item) return [];
    const h = hashStr(item.id);
    return Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      usage: Math.max(2, Math.round(10 + Math.sin(i * 0.5 + h) * 5 + (h % 3) * 2)),
    }));
  }, [item?.id]);

  // Active vendor's currency — drives the Base ↔ Partner currency toggle. Declared before the early return so hook order stays stable when `item` is null.
  const activeVendorCurrency = React.useMemo(() => {
    if (!activeVendor) return BASE_CURRENCY;
    return getVendorCurrency(activeVendor).toUpperCase();
  }, [activeVendor]);
  const isVendorBase = activeVendorCurrency === BASE_CURRENCY;
  const effectiveViewMode: "base" | "partner" = isVendorBase ? "base" : viewMode;

  // PO line items arrive with unitPrice in PKR (base); catalog-sourced flows arrive with unitPrice in the vendor's native currency.
  const inputValuesArePKR = mode === "edit-po";

  const MoneyCell = React.useCallback(
    ({ nativeValue, signed, className }: { nativeValue: number; signed?: boolean; className?: string }) => {
      const signPrefix = signed && nativeValue > 0 ? "-" : "";
      const basePKR = inputValuesArePKR
        ? nativeValue
        : convertToBase(nativeValue, activeVendorCurrency);
      const nativeAmount = inputValuesArePKR
        ? (isVendorBase ? nativeValue : convertBetween(nativeValue, BASE_CURRENCY, activeVendorCurrency))
        : nativeValue;

      if (isVendorBase) {
        return (
          <>
            {signPrefix}
            <CurrencyAmount
              mode="single"
              currency={BASE_CURRENCY}
              value={basePKR}
              className={className}
            />
          </>
        );
      }
      if (effectiveViewMode === "partner") {
        return (
          <>
            {signPrefix}
            <CurrencyAmount
              mode="listing-partner"
              currency={activeVendorCurrency}
              value={nativeAmount}
              className={className}
            />
          </>
        );
      }
      return (
        <>
          {signPrefix}
          <CurrencyAmount
            mode="listing-base"
            currency={BASE_CURRENCY}
            value={basePKR}
            partnerDefaultCurrency={activeVendorCurrency}
            partnerDefaultValue={nativeAmount}
            className={className}
          />
        </>
      );
    },
    [activeVendorCurrency, isVendorBase, effectiveViewMode, inputValuesArePKR],
  );

  if (!item) return null;

  const isUnassigned = !hasOriginalVendor && assignedVendors.length === 0;
  const serialized = isSerialized(item);
  const purchased = isPurchased(item);
  const belowMin = item.currentStock < item.minQuantity;
  const defaultQty = defaultQtyOverride ?? vendorQty * item.vendorUOMQty;

  const applyVendorQtyInput = (raw: string) => {
    if (!isValidQuantityDraft(raw, serialized)) return;
    setVendorQtyInput(raw);
    setVendorQty(getDraftQuantityValue(raw, serialized));
    setDefaultQtyOverride(null);
    setDefaultQtyInput(null);
    setWasAdjusted(false);
  };

  const applyDefaultQtyInput = (raw: string) => {
    if (!isValidQuantityDraft(raw, serialized)) return;
    setDefaultQtyInput(raw);
    setDefaultQtyOverride(getDraftQuantityValue(raw, serialized));
    setWasAdjusted(false);
  };

  const commitVendorQtyInput = () => {
    const nextQty = parseQuantityDraft(vendorQtyInput, serialized) ?? 0;
    setVendorQty(nextQty);
    setVendorQtyInput(formatQuantityValue(nextQty, serialized));
    setDefaultQtyOverride(null);
    setDefaultQtyInput(null);
    setWasAdjusted(false);
  };

  const commitDefaultQtyInput = () => {
    const nextQty = parseQuantityDraft(defaultQtyInput ?? "", serialized) ?? 0;
    setDefaultQtyOverride(nextQty);
    setDefaultQtyInput(formatQuantityValue(nextQty, serialized));
    setWasAdjusted(false);
  };

  const resetQtyInput = (field: "vendor" | "default") => {
    if (field === "vendor") {
      setVendorQtyInput(formatQuantityValue(vendorQty, serialized));
      setDefaultQtyInput(null);
      return;
    }

    setDefaultQtyInput(defaultQtyOverride === null ? null : formatQuantityValue(defaultQty, serialized));
  };

  const handleQtyFieldKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, field: "vendor" | "default") => {
    preventInvalidQuantityKey(event, serialized);

    if (event.key === "Enter") {
      event.preventDefault();
      if (field === "vendor") commitVendorQtyInput();
      else commitDefaultQtyInput();
      event.currentTarget.blur();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      resetQtyInput(field);
      event.currentTarget.blur();
    }
  };

  // For vendor-assigned items: always unlocked. For no-vendor items: check assigned vendor price.
  const activeAssigned = assignedVendors.find(v => v.vendorName === activeVendor);
  const activePriceState = activeVendor ? vendorPriceMap[activeVendor] : undefined;
  const hasActivePrice = hasOriginalVendor
    ? activeUnitPrice > 0
    : ((activePriceState?.priceConfirmed && activePriceState.price > 0) || (activeAssigned?.priceConfirmed && activeAssigned.price > 0));

  /** Handle vendor switch for VENDOR-ASSIGNED items (original flow) */
  const handleSelectVendorOfferOriginal = (offer: ItemVendorOffer) => {
    setActiveVendor(offer.vendorName);
    setActiveUnitPrice(offer.unitPrice);
    setActiveDiscount(offer.discount);
    setVendorContacts(getVendorContacts(offer.vendorName));
    setShipmentMethod(getDefaultShipping({ ...item, partnerLocation: offer.vendorName }).shipmentMethod);
  };

  /** Called from VendorSelector dropdown for no-vendor items */
  const handleSelectVendorOffer = (offer: ItemVendorOffer, sourceVendorName?: string) => {
    if (assignedVendors.some(v => v.vendorName === offer.vendorName)) {
      switchActiveVendor(offer.vendorName);
      setEmptyVendorPickerOpen(false);
      setIsAssigningAdditionalVendor(false);
      return;
    }

    const savedPrice = getVendorPrice(offer.vendorName);
    const newVendor: AssignedVendor = {
      vendorName: offer.vendorName,
      abbr: offer.abbr,
      price: savedPrice?.price ?? 0,
      priceConfirmed: savedPrice?.priceConfirmed ?? false,
      discount: savedPrice?.discount ?? 0,
      priority: offer.priority,
      isDefault: offer.isDefault,
    };

    const replaceCurrent = !!sourceVendorName && !isAssigningAdditionalVendor;
    if (replaceCurrent) {
      setAssignedVendors((prev) =>
        prev.map((vendor) =>
          vendor.vendorName === sourceVendorName ? newVendor : vendor,
        ),
      );
      if (sourceVendorName && sourceVendorName !== offer.vendorName) {
        removeVendorPrice(sourceVendorName);
      }
    } else {
      setAssignedVendors(prev => [...prev, newVendor]);
    }

    setActiveVendor(offer.vendorName);
    setActiveUnitPrice(savedPrice?.priceConfirmed ? savedPrice.price : 0);
    setActiveDiscount(savedPrice?.discount ?? 0);
    setVendorContacts(getVendorContacts(offer.vendorName));
    setEditPriceValue(savedPrice?.priceConfirmed ? "" : "");
    setEditPriceUOM("");
    setShipmentMethod(getDefaultShipping({ ...item, partnerLocation: offer.vendorName }).shipmentMethod);
    setEmptyVendorPickerOpen(false);
    setIsAssigningAdditionalVendor(false);
  };

  const switchActiveVendor = (vendorName: string) => {
    if (activeVendor && activeVendor !== vendorName && activeUnitPrice > 0) {
      upsertVendorPrice(activeVendor, {
        price: activeUnitPrice,
        priceConfirmed: true,
        discount: activeDiscount,
        unit: item.vendorUOM,
      });
    }

    setActiveVendor(vendorName);

    const savedPrice = getVendorPrice(vendorName);
    const assignedVendor = assignedVendors.find(v => v.vendorName === vendorName);
    const resolvedPriceConfirmed = savedPrice?.priceConfirmed ?? assignedVendor?.priceConfirmed ?? false;
    const resolvedPrice = savedPrice?.price ?? assignedVendor?.price ?? 0;
    const resolvedDiscount = savedPrice?.discount ?? assignedVendor?.discount ?? 0;

    setActiveUnitPrice(resolvedPriceConfirmed ? resolvedPrice : 0);
    setActiveDiscount(resolvedDiscount);
    setEditPriceValue(resolvedPriceConfirmed ? "" : "");
    setEditPriceUOM("");
    setVendorContacts(getVendorContacts(vendorName));
    setShipmentMethod(getDefaultShipping({ ...item, partnerLocation: vendorName }).shipmentMethod);
  };

  const confirmVendorPrice = (vendorName: string, price: number, uom?: string) => {
    const savedUnit = uom || getVendorPrice(vendorName)?.unit || item.vendorUOM;
    upsertVendorPrice(vendorName, {
      price,
      priceConfirmed: true,
      discount: 0,
      unit: savedUnit,
    });

    setAssignedVendors(prev => prev.map(v => v.vendorName === vendorName ? { ...v, price, priceConfirmed: true, discount: 0 } : v));
    if (vendorName === activeVendor) {
      setActiveUnitPrice(price);
      setActiveDiscount(0);
    }
    setEditPriceValue("");
    setEditPriceUOM("");
  };

  const removeAssignedVendor = (vendorName: string) => {
    const remaining = assignedVendors.filter(v => v.vendorName !== vendorName);
    setAssignedVendors(remaining);
    removeVendorPrice(vendorName);

    if (activeVendor === vendorName) {
      if (remaining.length > 0) {
        switchActiveVendor(remaining[0].vendorName);
      } else {
        setActiveVendor("");
        setActiveUnitPrice(0);
        setActiveDiscount(0);
      }
    }
  };

  const effectivePrice = activeUnitPrice || 0;
  const effectiveDiscount = activeDiscount ?? 0;
  const activeVendorUnit = vendorUnitOverride || item.vendorUOM;
  const subtotal = effectivePrice * defaultQty;
  const discountAmount = subtotal * (effectiveDiscount / 100);
  const totalPrice = subtotal - discountAmount;
  const priceConfirmed = !isUnassigned && hasActivePrice;
  // F19: shipping carrier, method, and inbound location are optional — only dueDeliveryDate is required
  const canSubmit = priceConfirmed && vendorQty > 0 && dueDeliveryDate;



  const handleComplete = (actionMode: "add-to-cart" | "buy-now") => {
    const contact = vendorContacts[0];
    const effectiveItem: OrderFlowItem = { ...item, unitPrice: effectivePrice, discount: effectiveDiscount, partnerLocation: activeVendor || item.partnerLocation };
    onComplete({
      item: effectiveItem, quantity: defaultQty, vendorQty, shipmentMethod, dueDeliveryDate, inboundLocation,
      vendorContactName: contact?.name || "", vendorContactEmail: contact?.email || "", vendorContactPhone: contact?.phone || "", vendorContactRole: contact?.role || "",
      notes, totalPrice, unitPrice: effectivePrice, discount: effectiveDiscount, completedMode: actionMode,
    });
    onOpenChange(false);
  };

  const criticalCount = poWarnings.filter((w) => w.severity === "critical").length;
  const warningCount = poWarnings.filter((w) => w.severity === "warning").length;
  const UOM_OPTIONS = [item.vendorUOM, "Case", "Box", "Pack", "Pallet", "Each", "Unit"].filter((v, i, a) => a.indexOf(v) === i);
  const activeContact = vendorContacts[0];

  /* ═══════════════════════════════════════════════════════════════
     RENDER — 2 COLUMN: left = item + ordering, right = tabbed details
     ═══════════════════════════════════════════════════════════════ */

  const TABS = [
    { key: "shipping", label: "Shipping & Delivery", icon: Truck },
    { key: "warnings", label: "PO Warnings", icon: AlertTriangle, count: poWarnings.length },
    { key: "inventory", label: "Inventory", icon: Boxes },
    ...(renderNotesTab ? [{ key: "notes" as const, label: "Notes", icon: MessageSquare, count: notesCount }] : []),
    { key: "attachments", label: "Attachments", icon: Paperclip, count: attachments.length },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0 overflow-hidden [&>[data-slot=dialog-close]]:hidden [&>button.absolute]:hidden"
        style={{
          fontFamily: FONT,
          maxWidth: "1060px",
          width: "calc(100vw - 48px)",
          height: "min(88vh, 720px)",
          maxHeight: "min(88vh, 720px)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--elevation-lg)",
          border: "1px solid var(--border)",
          backgroundColor: "var(--background)",
        }}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Item Detail</DialogTitle>

        {/* ── Top bar with close ── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground" style={S.small}>{mode === "add-to-po" ? "Add Item to Purchase Order" : "Item Detail"}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isVendorBase && (
              <div className="inline-flex items-center gap-0.5 h-8 rounded-lg border border-border p-0.5 bg-white shadow-sm shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("base")}
                  aria-pressed={effectiveViewMode === "base"}
                  className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                    effectiveViewMode === "base"
                      ? "bg-[var(--primary-tint)] text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                  style={{ fontWeight: effectiveViewMode === "base" ? 600 : 500 }}
                >
                  Base Currency
                  <InfoTooltip side="bottom" iconClassName="w-3 h-3">
                    Show amounts in the company's base currency ({BASE_CURRENCY}). Values stay comparable across all purchase orders regardless of the transaction currency.
                  </InfoTooltip>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("partner")}
                  aria-pressed={effectiveViewMode === "partner"}
                  className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                    effectiveViewMode === "partner"
                      ? "bg-[var(--primary-tint)] text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                  style={{ fontWeight: effectiveViewMode === "partner" ? 600 : 500 }}
                >
                  Vendor Currency
                  <InfoTooltip side="bottom" iconClassName="w-3 h-3">
                    Show amounts in this vendor's own default transaction currency ({activeVendorCurrency || BASE_CURRENCY}). The base-currency equivalent remains available on hover for reporting.
                  </InfoTooltip>
                </button>
              </div>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)] border border-border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-all"
            >
              <X className="size-3.5" />
              <span style={S.small}>Close</span>
            </button>
          </div>
        </div>

        {/* ═══════ TWO‑COLUMN BODY ═══════ */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

          {/* ─────── LEFT COLUMN — item card + ordering details ─────── */}
          <div className="md:w-[400px] md:min-w-[400px] md:max-w-[400px] flex flex-col min-h-0 border-r border-border" style={{ backgroundColor: "var(--card)" }}>

            {/* ── Item header card ── */}
            <div className="shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex gap-3.5">
                <div className="shrink-0 rounded-[var(--radius)] overflow-hidden border border-border" style={{ width: "64px", height: "64px", backgroundColor: "var(--secondary)" }}>
                  <ImageWithFallback src={item.image} alt={item.descriptiveName} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Part number — foreground, not blue */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-foreground" style={S.partNum}>{item.itemNumber}</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-[var(--radius)]" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", ...S.badge }}>
                      <Tag className="size-2.5" />{item.category}
                    </span>
                  </div>
                  {/* Item name — up to 3 lines */}
                  <TruncatedItemName name={item.descriptiveName} maxChars={60} style={{ ...S.itemName }} className="text-foreground mb-1.5" />
                  {/* Meta pills — all grey */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full"
                      style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)", ...S.badge }}>
                      <Hash className="size-2.5" />{serialized ? "Serialized" : "Non-Serialized"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full"
                      style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)", ...S.badge }}>
                      {purchased ? <ShoppingCart className="size-2.5" /> : <Wrench className="size-2.5" />}
                      {purchased ? "Purchased" : "Manufactured"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Alert strips removed — "Below min" and "Shortage" tags no longer shown */}
            </div>

            {/* ── Scrollable ordering area ── */}
            <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}>

              {/* Vendor Section */}
              <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-muted-foreground" style={S.fieldLabel}>Vendor</span>
                  <span className="text-muted-foreground/50" style={S.small}>· {vendorOffers.length} vendor{vendorOffers.length !== 1 ? "s" : ""}</span>
                </div>

                {hasOriginalVendor ? (
                  /* ── VENDOR-ASSIGNED: Use original VendorSelector inline ── */
                  <VendorSelector
                    offers={vendorOffers}
                    selectedVendor={activeVendor}
                    onSelectVendor={handleSelectVendorOfferOriginal}
                    variant="inline"
                    onAddNewVendor={() => setAddNewVendorOpen(true)}
                    viewMode={effectiveViewMode}
                    inputIsPKR={inputValuesArePKR}
                  />
                ) : isUnassigned ? (
                  /* ── NO VENDOR — Empty state: vendor card shell ── */
                  <Popover open={emptyVendorPickerOpen} onOpenChange={setEmptyVendorPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="flex items-center gap-2.5 w-full p-3 rounded-[var(--radius-md)] border border-dashed border-border hover:border-primary/30 hover:bg-primary/[0.03] transition-all cursor-pointer text-left group"
                        style={{ backgroundColor: "var(--card)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center size-9 rounded-full shrink-0" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                          <Building2 className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-foreground block" style={S.bodyMed}>Add a Vendor</span>
                          <span className="text-muted-foreground block" style={S.small}>
                            {vendorOffers.length > 0 ? `No vendor assigned — ${vendorOffers.length} available to add` : "No vendor assigned — add one to get started"}
                          </span>
                        </div>
                        <ChevronDown className="size-4 text-muted-foreground shrink-0 group-hover:text-primary/50 transition-colors" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[400px] p-0 border-border"
                      style={{ fontFamily: FONT, backgroundColor: "var(--card)" }}
                      align="start"
                      sideOffset={8}
                    >
                      <VendorSelectorContent
                        offers={noVendorDropdownOffers}
                        selectedVendor={activeVendor}
                        onSelect={handleSelectVendorOffer}
                        assignedVendors={assignedVendors.map(v => v.vendorName)}
                        onAddNewVendor={() => { setEmptyVendorPickerOpen(false); setAddNewVendorOpen(true); }}
                        viewMode={effectiveViewMode}
                        inputIsPKR={inputValuesArePKR}
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  /* ── NO VENDOR — Assigned vendor cards (after user picks one) ── */
                  <div className="flex flex-col gap-2">
                    {assignedVendors.map((av) => {
                      const isActive = av.vendorName === activeVendor;
                      const contacts = getVendorContacts(av.vendorName);
                      const contact = contacts[0];
                      const savedVendorPrice = vendorPriceMap[av.vendorName];
                      const cardPriceConfirmed = savedVendorPrice?.priceConfirmed ?? av.priceConfirmed;
                      const cardPrice = savedVendorPrice?.price ?? av.price;

                      const cardContent = (
                        <div
                          className={`rounded-[var(--radius-md)] border transition-all ${
                            isActive ? "border-primary/30 ring-1 ring-primary/10" : "border-border hover:border-primary/20"
                          }`}
                          style={{ backgroundColor: "var(--card)" }}
                        >
                          <div className="flex items-center gap-2.5 px-3 py-2.5">
                            <div className={`flex items-center justify-center size-8 rounded-full shrink-0 border ${
                              isActive ? "bg-primary/10 border-primary/20" : "bg-secondary border-border"
                            }`}>
                              <span className={isActive ? "text-primary" : "text-foreground/45"} style={{ fontSize: "11px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>
                                {av.abbr}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-foreground truncate" style={S.bodyMed}>{av.vendorName.replace(/ \(.*\)$/, "").replace(", Inc.", "").replace(", Ltd. (USA)", "").replace(" N.V.", "")}</span>
                                <span className={`inline-flex items-center px-1.5 py-0 rounded-[var(--radius-sm)] border shrink-0 ${
                                  av.isDefault || av.priority === "default" ? "border-primary/30 text-primary bg-primary/5" :
                                  av.priority === "2" ? "border-chart-3/30 text-chart-3 bg-chart-3/5" :
                                  "border-foreground/15 text-foreground/50 bg-secondary"
                                }`} style={S.badge}>
                                  {av.isDefault || av.priority === "default" ? "Default" : (() => { const n = parseInt(av.priority, 10); return n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`; })()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {cardPriceConfirmed ? (
                                  <span className="text-primary" style={{ ...S.small, fontWeight: "var(--font-weight-semibold)" }}>
                                    <MoneyCell nativeValue={cardPrice} /> / {item.vendorUOM}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground" style={S.small}>Price not set</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {assignedVendors.length > 1 && (
                                <button
                                  className="flex items-center justify-center size-6 rounded-[var(--radius-sm)] hover:bg-destructive/10 transition-colors cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); removeAssignedVendor(av.vendorName); }}
                                  title="Remove vendor"
                                >
                                  <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                                </button>
                              )}
                              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                            </div>
                          </div>

                          {contact && (
                            <div className="px-3 pb-2" style={{ borderTop: "1px solid var(--border)" }}>
                              <div className="flex items-center gap-1.5 pt-2 text-muted-foreground" style={S.small}>
                                <User className="size-3 shrink-0" />{contact.name} <span style={{ color: "var(--border)" }}>·</span> <span style={S.tiny}>{contact.role}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );

                      return (
                        <Popover key={av.vendorName}>
                          <PopoverTrigger asChild>
                            <button
                              className="text-left w-full cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isActive) {
                                  switchActiveVendor(av.vendorName);
                                }
                              }}
                            >
                              {cardContent}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[400px] p-0 border-border"
                            style={{ fontFamily: FONT, backgroundColor: "var(--card)" }}
                            align="start"
                            sideOffset={8}
                          >
                            <VendorSelectorContent
                              offers={noVendorDropdownOffers}
                              selectedVendor={activeVendor}
                              onSelect={(offer) => handleSelectVendorOffer(offer, av.vendorName)}
                              assignedVendors={assignedVendors.map(v => v.vendorName)}
                              onAssignAnother={
                                vendorOffers.length > assignedVendors.length
                                  ? () => setIsAssigningAdditionalVendor(true)
                                  : undefined
                              }
                              onAddNewVendor={() => setAddNewVendorOpen(true)}
                              viewMode={effectiveViewMode}
                              inputIsPKR={inputValuesArePKR}
                            />
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Unit Price */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-muted-foreground block mb-1" style={S.fieldLabel}>Unit Price</span>
                {hasOriginalVendor && activeUnitPrice > 0 ? (
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-foreground" style={S.price}>
                      <MoneyCell nativeValue={effectivePrice} />
                    </span>
                    <span className="text-muted-foreground" style={S.small}>/ {item.vendorUOM}</span>
                    {effectiveDiscount > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full ml-1" style={{ backgroundColor: "var(--success-tint)", color: "var(--success)", ...S.badge }}>
                        <TrendingDown className="size-2.5" />{effectiveDiscount}% off
                      </span>
                    )}
                  </div>
                ) : hasOriginalVendor && activeUnitPrice === 0 ? (
                  /* Newly added vendor with no price — show editable input */
                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground" style={S.small}>Enter unit price for this vendor</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center rounded-[var(--radius)] border border-border overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-ring/15" style={{ backgroundColor: "var(--input-background)" }}>
                        <span className="pl-2.5 text-muted-foreground" style={S.body}>{getLibraryCurrency(activeVendorCurrency)?.symbol ?? activeVendorCurrency}</span>
                        <input
                          type="number" min={0} step="0.01"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          placeholder="0.00"
                          className="h-8 w-20 px-1 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          style={{ ...S.priceSm, fontFamily: FONT }}
                          autoFocus
                          onFocus={(e) => e.target.select()}
                        />
                        <span className="px-1.5 text-muted-foreground" style={S.small}>per</span>
                      </div>
                      <select
                        value={editPriceUOM || item.defaultUOM || item.vendorUOM || ""}
                        onChange={(e) => setEditPriceUOM(e.target.value)}
                        className="h-8 rounded-[var(--radius)] border border-border px-2 pr-6 outline-none text-foreground transition-colors focus:border-primary focus:ring-1 focus:ring-ring/15 cursor-pointer appearance-none"
                        style={{ ...S.body, fontFamily: FONT, backgroundColor: "var(--input-background)", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                      >
                        {PRICE_UOM_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <button
                        className="h-8 px-3 rounded-[var(--radius)] flex items-center gap-1.5 transition-all"
                        style={{
                          backgroundColor: parseFloat(editPriceValue) > 0 ? "var(--primary)" : "var(--muted)",
                          color: parseFloat(editPriceValue) > 0 ? "var(--primary-foreground)" : "var(--muted-foreground)",
                          cursor: parseFloat(editPriceValue) > 0 ? "pointer" : "not-allowed",
                          ...S.btn,
                        }}
                        disabled={!(parseFloat(editPriceValue) > 0)}
                        onClick={() => {
                          const price = parseFloat(editPriceValue);
                          const uom = editPriceUOM || item.defaultUOM || item.vendorUOM;
                          if (price > 0) {
                            setActiveUnitPrice(price);
                            setActiveDiscount(0);
                            setVendorOffers(prev => prev.map(o =>
                              o.vendorName === activeVendor ? { ...o, unitPrice: price, discount: 0, uom } : o
                            ));
                            setEditPriceValue("");
                            setEditPriceUOM("");
                            toast.success("Price confirmed", {
                              description: `$${price.toFixed(2)} / ${uom}`,
                              style: { fontFamily: FONT }, duration: 2000,
                            });
                          }
                        }}
                      >
                        <Check className="size-3" /> Confirm
                      </button>
                    </div>
                  </div>
                ) : isUnassigned ? (
                  <div className="flex items-center gap-1.5">
                    <Lock className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground" style={S.small}>Assign vendor for pricing</span>
                  </div>
                ) : !hasActivePrice ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground" style={S.small}>Enter unit price for this vendor</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center rounded-[var(--radius)] border border-border overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-ring/15" style={{ backgroundColor: "var(--input-background)" }}>
                        <span className="pl-2.5 text-muted-foreground" style={S.body}>{getLibraryCurrency(activeVendorCurrency)?.symbol ?? activeVendorCurrency}</span>
                        <input
                          type="number" min={0} step="0.01"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          placeholder="0.00"
                          className="h-8 w-20 px-1 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          style={{ ...S.priceSm, fontFamily: FONT }}
                          autoFocus
                          onFocus={(e) => e.target.select()}
                        />
                        <span className="px-1.5 text-muted-foreground" style={S.small}>per</span>
                      </div>
                      <select
                        value={editPriceUOM || item.defaultUOM || item.vendorUOM || ""}
                        onChange={(e) => setEditPriceUOM(e.target.value)}
                        className="h-8 rounded-[var(--radius)] border border-border px-2 pr-6 outline-none text-foreground transition-colors focus:border-primary focus:ring-1 focus:ring-ring/15 cursor-pointer appearance-none"
                        style={{ ...S.body, fontFamily: FONT, backgroundColor: "var(--input-background)", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                      >
                        {PRICE_UOM_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <button
                        className="h-8 px-3 rounded-[var(--radius)] flex items-center gap-1.5 transition-all"
                        style={{
                          backgroundColor: parseFloat(editPriceValue) > 0 ? "var(--primary)" : "var(--muted)",
                          color: parseFloat(editPriceValue) > 0 ? "var(--primary-foreground)" : "var(--muted-foreground)",
                          cursor: parseFloat(editPriceValue) > 0 ? "pointer" : "not-allowed",
                          ...S.btn,
                        }}
                        disabled={!(parseFloat(editPriceValue) > 0)}
                        onClick={() => {
                          const price = parseFloat(editPriceValue);
                          const uom = editPriceUOM || item.defaultUOM || item.vendorUOM;
                          if (price > 0 && activeVendor) confirmVendorPrice(activeVendor, price, uom);
                        }}
                      >
                        <Check className="size-3" /> Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-foreground" style={S.price}>
                      <MoneyCell nativeValue={effectivePrice} />
                    </span>
                    <span className="text-muted-foreground" style={S.small}>/ {item.vendorUOM}</span>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-muted-foreground block mb-2" style={S.fieldLabel}>Quantity</span>

                {/* Converter card */}
                <div className="rounded-[var(--radius)] overflow-hidden" style={{
                  backgroundColor: !priceConfirmed ? "var(--secondary)" : "var(--card)",
                  border: "1px solid var(--border)",
                  boxShadow: !priceConfirmed ? "none" : "var(--elevation-sm)",
                  borderLeft: !priceConfirmed ? "3px solid var(--border)" : "3px solid var(--primary)",
                  opacity: 1,
                }}>

                  {/* ── Top row ── */}
                  <div className="px-3 pt-2.5 pb-2">
                    <span className="text-muted-foreground block mb-1" style={S.small}>
                      {qtySwapped ? "Default Stocking Unit" : "Vendor Stocking Unit"}
                    </span>
                    <div className="flex items-center rounded-[var(--radius)] border border-border overflow-hidden transition-colors focus-within:border-primary" style={{ backgroundColor: !priceConfirmed ? "var(--muted)" : "var(--input-background)" }}>
                      <input
                        type="text"
                        inputMode={serialized ? "numeric" : "decimal"}
                        value={qtySwapped ? (defaultQtyInput ?? formatQuantityValue(defaultQty, serialized)) : vendorQtyInput}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (qtySwapped) applyDefaultQtyInput(raw);
                          else applyVendorQtyInput(raw);
                        }}
                        onKeyDown={(e) => handleQtyFieldKeyDown(e, qtySwapped ? "default" : "vendor")}
                        onBlur={() => {
                          if (qtySwapped) commitDefaultQtyInput();
                          else commitVendorQtyInput();
                        }}
                        disabled={!priceConfirmed}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 h-9 px-3 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        style={{ ...S.priceSm, fontFamily: FONT, color: !priceConfirmed ? "var(--muted-foreground)" : "var(--foreground)", cursor: !priceConfirmed ? "not-allowed" : undefined }}
                      />
                      <div className="shrink-0 h-9 flex items-center gap-1.5 border-l border-border px-2.5" style={{ backgroundColor: "var(--secondary)" }}>
                        {qtySwapped ? (
                          <span className="text-foreground" style={{ ...S.bodyMed, color: !priceConfirmed ? "var(--muted-foreground)" : undefined }}>{item.defaultUOM}</span>
                        ) : (
                          !priceConfirmed ? (
                            <span className="text-muted-foreground" style={S.bodyMed}>{item.vendorUOM || "—"}</span>
                          ) : (
                            <Select value={activeVendorUnit} onValueChange={setVendorUnitOverride}>
                              <SelectTrigger className="h-7 w-auto gap-1 border-0 shadow-none bg-transparent px-0" style={{ ...S.bodyMed, color: "var(--foreground)" }}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>{UOM_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                            </Select>
                          )
                        )}
                      </div>
                    </div>
                    {priceConfirmed && inventoryData && (() => {
                      const topQty = qtySwapped ? (defaultQtyOverride ?? defaultQty) : vendorQty;
                      const topUnit = qtySwapped ? item.defaultUOM : activeVendorUnit;
                      const topRecommended = qtySwapped ? item.minQuantity : Math.ceil(item.minQuantity / item.vendorUOMQty);
                      const diff = topQty - topRecommended;
                      const absDiff = Math.abs(diff);
                      if (diff >= 0 || wasAdjusted) return null;
                      if (diff < 0) return (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span style={{ ...S.small, color: "var(--warning)" }}>{absDiff} {topUnit} below recommended quantity</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="inline-flex items-center justify-center size-4 rounded-full hover:bg-warning/10 transition-colors cursor-pointer" title="Learn more">
                                <Info className="size-3 text-warning" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" style={{ fontFamily: FONT }} align="start" sideOffset={4}>
                              <p className="text-foreground mb-2" style={S.bodyMed}>Recommended Quantity Rules</p>
                              <p className="text-muted-foreground mb-1.5" style={S.small}>The recommended quantity ensures compliance with vendor ordering constraints:</p>
                              <div className="flex flex-col gap-1">
                                <span className="text-muted-foreground" style={S.small}>• Min order: <strong className="text-foreground">{inventoryData.orderQuantity.minOrderQty} {item.defaultUOM}</strong></span>
                                <span className="text-muted-foreground" style={S.small}>• Max order: <strong className="text-foreground">{inventoryData.orderQuantity.maxOrderQty} {item.defaultUOM}</strong></span>
                                <span className="text-muted-foreground" style={S.small}>• Multiple: <strong className="text-foreground">{inventoryData.orderQuantity.orderMultiple}</strong></span>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <button
                            onClick={handleAdjustQty}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-primary/20"
                            style={S.tiny}
                          >
                            Adjust
                          </button>
                        </div>
                      );
                      return null;
                    })()}
                  </div>

                  {/* ── Swap button ── */}
                  <div className="flex items-center justify-center py-0">
                    <button
                      onClick={() => priceConfirmed && setQtySwapped(!qtySwapped)}
                      disabled={!priceConfirmed}
                      className="flex items-center justify-center size-7 rounded-full border border-border transition-all"
                      style={{ backgroundColor: "var(--card)", cursor: !priceConfirmed ? "not-allowed" : "pointer", opacity: !priceConfirmed ? 0.4 : 1 }}
                      title="Swap input direction"
                    >
                      <ArrowUpDown className="size-3.5 text-primary" />
                    </button>
                  </div>

                  {/* ── Bottom row ── */}
                  <div className="px-3 pt-1 pb-2.5">
                    <span className="text-muted-foreground block mb-1" style={S.small}>
                      {qtySwapped ? "Vendor Stocking Unit" : "Default Stocking Unit"}
                    </span>
                    <div className="flex items-center rounded-[var(--radius)] border border-border overflow-hidden transition-colors focus-within:border-primary" style={{ backgroundColor: !priceConfirmed ? "var(--muted)" : "var(--input-background)" }}>
                      <input
                        type="text"
                        inputMode={serialized ? "numeric" : "decimal"}
                        value={qtySwapped ? vendorQtyInput : (defaultQtyInput ?? formatQuantityValue(defaultQty, serialized))}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (qtySwapped) applyVendorQtyInput(raw);
                          else applyDefaultQtyInput(raw);
                        }}
                        onKeyDown={(e) => handleQtyFieldKeyDown(e, qtySwapped ? "vendor" : "default")}
                        onBlur={() => {
                          if (qtySwapped) commitVendorQtyInput();
                          else commitDefaultQtyInput();
                        }}
                        disabled={!priceConfirmed}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 h-9 px-3 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        style={{ ...S.priceSm, fontFamily: FONT, color: !priceConfirmed ? "var(--muted-foreground)" : "var(--foreground)", cursor: !priceConfirmed ? "not-allowed" : undefined }}
                      />
                      <div className="shrink-0 h-9 flex items-center gap-1.5 border-l border-border px-2.5" style={{ backgroundColor: "var(--secondary)" }}>
                        {qtySwapped ? (
                          !priceConfirmed ? (
                            <span className="text-muted-foreground" style={S.bodyMed}>{item.vendorUOM || "—"}</span>
                          ) : (
                            <Select value={activeVendorUnit} onValueChange={setVendorUnitOverride}>
                              <SelectTrigger className="h-7 w-auto gap-1 border-0 shadow-none bg-transparent px-0" style={{ ...S.bodyMed, color: "var(--foreground)" }}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>{UOM_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                            </Select>
                          )
                        ) : (
                          <span className="text-foreground" style={{ ...S.bodyMed, color: !priceConfirmed ? "var(--muted-foreground)" : undefined }}>{item.defaultUOM}</span>
                        )}
                      </div>
                    </div>
                    {priceConfirmed && inventoryData && (() => {
                      const bottomQty = qtySwapped ? vendorQty : (defaultQtyOverride ?? defaultQty);
                      const bottomUnit = qtySwapped ? activeVendorUnit : item.defaultUOM;
                      const bottomRecommended = qtySwapped ? Math.ceil(item.minQuantity / item.vendorUOMQty) : item.minQuantity;
                      const diff = bottomQty - bottomRecommended;
                      const absDiff = Math.abs(diff);
                      if (diff >= 0 || wasAdjusted) return null;
                      if (diff < 0) return (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span style={{ ...S.small, color: "var(--warning)" }}>{absDiff} {bottomUnit} below recommended quantity</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="inline-flex items-center justify-center size-4 rounded-full hover:bg-warning/10 transition-colors cursor-pointer" title="Learn more">
                                <Info className="size-3 text-warning" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" style={{ fontFamily: FONT }} align="start" sideOffset={4}>
                              <p className="text-foreground mb-2" style={S.bodyMed}>Recommended Quantity Rules</p>
                              <p className="text-muted-foreground mb-1.5" style={S.small}>The recommended quantity ensures compliance with vendor ordering constraints:</p>
                              <div className="flex flex-col gap-1">
                                <span className="text-muted-foreground" style={S.small}>• Min order: <strong className="text-foreground">{inventoryData.orderQuantity.minOrderQty} {item.defaultUOM}</strong></span>
                                <span className="text-muted-foreground" style={S.small}>• Max order: <strong className="text-foreground">{inventoryData.orderQuantity.maxOrderQty} {item.defaultUOM}</strong></span>
                                <span className="text-muted-foreground" style={S.small}>• Multiple: <strong className="text-foreground">{inventoryData.orderQuantity.orderMultiple}</strong></span>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <button
                            onClick={handleAdjustQty}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-primary/20"
                            style={S.tiny}
                          >
                            Adjust
                          </button>
                        </div>
                      );
                      return null;
                    })()}
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="px-4 py-3">
                {!priceConfirmed ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground" style={S.bodyMed}>Total</span>
                    <span className="text-muted-foreground" style={S.total}>—</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-muted-foreground" style={S.small}>Subtotal</span>
                      <span className="text-foreground" style={S.bodyMed}>
                        <MoneyCell nativeValue={subtotal} />
                      </span>
                    </div>
                    {effectiveDiscount > 0 && (
                      <div className="flex items-center justify-between mb-0.5">
                        <span style={{ color: "var(--success)", ...S.small }}>Volume ({effectiveDiscount}%)</span>
                        <span style={{ color: "var(--success)", ...S.bodyMed }}>
                          <MoneyCell nativeValue={discountAmount} signed />
                        </span>
                      </div>
                    )}
                    <div className="h-px my-2" style={{ backgroundColor: "var(--border)" }} />
                    <div className="flex items-center justify-between">
                      <span className="text-foreground" style={S.bodyMed}>Total</span>
                      <span className="text-primary" style={S.total}>
                        <MoneyCell nativeValue={totalPrice} />
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sticky actions */}
            <div className="shrink-0 px-4 py-3 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--border)" }}>
              {mode === "edit-po" ? (
                <button
                  className="w-full h-9 flex items-center justify-center gap-2 rounded-[var(--radius)] transition-all"
                  style={{
                    backgroundColor: canSubmit ? "var(--primary)" : "var(--muted)",
                    color: canSubmit ? "var(--primary-foreground)" : "var(--muted-foreground)",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    ...S.btn,
                  }}
                  disabled={!canSubmit} onClick={() => handleComplete("buy-now")}>
                  <Save className="size-3.5" /> Save Changes
                </button>
              ) : mode === "add-to-po" ? (
                <button
                  className="w-full h-9 flex items-center justify-center gap-2 rounded-[var(--radius)] transition-all"
                  style={{
                    backgroundColor: canSubmit ? "var(--primary)" : "var(--muted)",
                    color: canSubmit ? "var(--primary-foreground)" : "var(--muted-foreground)",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    ...S.btn,
                  }}
                  disabled={!canSubmit} onClick={() => handleComplete("add-to-cart")}>
                  <Plus className="size-3.5" /> Add to Purchase Order
                </button>
              ) : mode === "edit-cart" ? (
                <button
                  className="w-full h-9 flex items-center justify-center gap-2 rounded-[var(--radius)] transition-all"
                  style={{
                    backgroundColor: canSubmit ? "var(--primary)" : "var(--muted)",
                    color: canSubmit ? "var(--primary-foreground)" : "var(--muted-foreground)",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    ...S.btn,
                  }}
                  disabled={!canSubmit} onClick={() => handleComplete("add-to-cart")}>
                  <Save className="size-3.5" /> Update Line Item
                </button>
              ) : (
                <>
                  <button
                    className="w-full h-9 flex items-center justify-center gap-2 rounded-[var(--radius)] transition-all"
                    style={{
                      backgroundColor: canSubmit ? "var(--primary)" : "var(--muted)",
                      color: canSubmit ? "var(--primary-foreground)" : "var(--muted-foreground)",
                      cursor: canSubmit ? "pointer" : "not-allowed",
                      ...S.btn,
                    }}
                    disabled={!canSubmit} onClick={() => handleComplete("add-to-cart")}>
                    <ShoppingCart className="size-3.5" /> Add to Cart
                  </button>
                  <button
                    className="w-full h-9 flex items-center justify-center gap-1.5 rounded-[var(--radius)] transition-all"
                    style={{
                      backgroundColor: canSubmit ? "var(--accent)" : "var(--muted)",
                      color: canSubmit ? "var(--accent-foreground)" : "var(--muted-foreground)",
                      cursor: canSubmit ? "pointer" : "not-allowed",
                      ...S.btn,
                    }}
                    disabled={!canSubmit} onClick={() => handleComplete("buy-now")}>
                    <Zap className="size-3.5" /> Buy Now
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ─────── RIGHT COLUMN — tabbed detail panels ─────── */}
          <div className="flex-1 md:min-w-0 flex flex-col min-h-0" style={{ backgroundColor: "var(--background)" }}>

            {/* Tab bar */}
            <div className="shrink-0 flex items-center gap-0 px-4 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActiveTab = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    className="relative flex items-center gap-1.5 px-3 py-2.5 shrink-0 cursor-pointer transition-colors"
                    style={{ color: isActiveTab ? "var(--primary)" : "var(--muted-foreground)" }}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <Icon className="size-3.5" />
                    <span style={{ ...S.smallMed, color: "inherit" }}>{tab.label}</span>
                    {"count" in tab && (tab as any).count > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full px-1 min-w-[14px] h-[14px]"
                        style={{ backgroundColor: isActiveTab ? "var(--primary-tint-subtle)" : "var(--secondary)", color: isActiveTab ? "var(--primary)" : "var(--muted-foreground)", ...S.tiny, fontSize: "9px" }}>
                        {(tab as any).count}
                      </span>
                    )}
                    {isActiveTab && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full" style={{ backgroundColor: "var(--primary)" }} />}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}>

              {/* ── Shipping & Delivery ── */}
              {activeTab === "shipping" && (
                <div className="relative rounded-[var(--radius)] overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  {!priceConfirmed && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--card) 70%, transparent)", backdropFilter: "blur(1px)" }}>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--elevation-sm)" }}>
                        <Lock className="size-3 text-muted-foreground" /><span className="text-muted-foreground" style={S.small}>Assign vendor first</span>
                      </div>
                    </div>
                  )}
                  <div className="p-4 flex flex-col gap-3">
                    {/* Shipping Carrier + Method — multi-level picker */}
                    <ShippingCarrierPicker
                      selectedMethodValue={shipmentMethod}
                      onMethodChange={(v) => {
                        handleOptionalFieldChange("shippingMethod", v, setShipmentMethod);
                        const found = findCarrierAndMethod(v);
                        if (found.carrier) setShippingCarrier(found.carrier.code);
                      }}
                      disabled={!priceConfirmed}
                    />

                    {/* F20: Default prompt for shipping method */}
                    {defaultPromptField === "shippingMethod" && activeVendor && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] border border-primary/20" style={{ backgroundColor: "var(--primary-tint-subtle)" }}>
                        <Info className="size-3.5 text-primary shrink-0" />
                        <span className="text-foreground flex-1" style={S.small}>Make this the default for {activeVendor.replace(/ \(.*\)$/, "")}?</span>
                        <button onClick={() => { setDefaultPromptField(null); toast.success("Default saved", { style: { fontFamily: FONT }, duration: 2000 }); }} className="px-2 py-0.5 rounded-[var(--radius-sm)] text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-primary/20" style={S.tiny}>Set as Default</button>
                        <button onClick={() => setDefaultPromptField(null)} className="px-2 py-0.5 rounded-[var(--radius-sm)] text-muted-foreground hover:bg-secondary transition-colors cursor-pointer border border-border" style={S.tiny}>Just this time</button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {/* F19: Due delivery — required */}
                      <FI label="Due delivery" required>
                        <input type="date" value={dueDeliveryDate} onChange={(e) => setDueDeliveryDate(e.target.value)}
                          disabled={!priceConfirmed}
                          className="h-8 w-full rounded-[var(--radius)] border border-border px-2 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/15"
                          style={{ ...S.body, backgroundColor: !priceConfirmed ? "var(--muted)" : "var(--input-background)", fontFamily: FONT, color: !priceConfirmed ? "var(--muted-foreground)" : "var(--foreground)", cursor: !priceConfirmed ? "not-allowed" : undefined }} />
                      </FI>

                      {/* F19: Inbound Location — optional (no asterisk) */}
                      <FI label="Inbound location">
                        <div className="relative">
                          <Select value={inboundLocation} onValueChange={(v) => { handleOptionalFieldChange("inboundLocation", v, setInboundLocation); setLocationSearch(""); }} disabled={!priceConfirmed}>
                            <SelectTrigger className="h-8 w-full gap-1 border-border" style={{ ...S.body, color: !priceConfirmed ? "var(--muted-foreground)" : "var(--foreground)", backgroundColor: !priceConfirmed ? "var(--muted)" : undefined, cursor: !priceConfirmed ? "not-allowed" : undefined }}>
                              <SelectValue placeholder="Select location">{inboundLocation || "Select location"}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <div className="px-2 pb-1.5 pt-1 sticky top-0" style={{ backgroundColor: "var(--popover)" }}>
                                <div className="flex items-center gap-1.5 h-7 px-2 rounded-[var(--radius-sm)] border border-border" style={{ backgroundColor: "var(--input-background)" }}>
                                  <Search className="size-3 text-muted-foreground shrink-0" />
                                  <input
                                    type="text"
                                    placeholder="Search locations..."
                                    value={locationSearch}
                                    onChange={(e) => setLocationSearch(e.target.value)}
                                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                                    style={{ fontSize: "11px", fontFamily: FONT }}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                              {INBOUND_LOCATION_OPTIONS
                                .filter((l) => {
                                  if (!locationSearch) return true;
                                  const q = locationSearch.toLowerCase();
                                  return l.code.toLowerCase().includes(q) || l.name.toLowerCase().includes(q);
                                })
                                .map((l) => (
                                  <SelectItem key={l.code} value={l.code}>
                                    <span style={{ fontWeight: "var(--font-weight-semibold)" }}>{l.code}</span>
                                    <span className="text-muted-foreground ml-1">· {l.name.split(",")[0]}</span>
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                      </FI>
                    </div>

                    {/* F20: Default prompt for inbound location */}
                    {defaultPromptField === "inboundLocation" && activeVendor && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] border border-primary/20" style={{ backgroundColor: "var(--primary-tint-subtle)" }}>
                        <Info className="size-3.5 text-primary shrink-0" />
                        <span className="text-foreground flex-1" style={S.small}>Make this the default for {activeVendor.replace(/ \(.*\)$/, "")}?</span>
                        <button onClick={() => { setDefaultPromptField(null); toast.success("Default saved", { style: { fontFamily: FONT }, duration: 2000 }); }} className="px-2 py-0.5 rounded-[var(--radius-sm)] text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-primary/20" style={S.tiny}>Set as Default</button>
                        <button onClick={() => setDefaultPromptField(null)} className="px-2 py-0.5 rounded-[var(--radius-sm)] text-muted-foreground hover:bg-secondary transition-colors cursor-pointer border border-border" style={S.tiny}>Just this time</button>
                      </div>
                    )}

                    {/* F22: Ship By Date — calculated, read-only */}
                    {calculatedShipByDate && shipmentMethod && (
                      <div className="grid grid-cols-2 gap-3">
                        <FI label="Ship By (calculated)">
                          <div className="flex items-center gap-1.5">
                            <div className="h-8 flex-1 flex items-center rounded-[var(--radius)] border border-border px-2.5"
                              style={{ backgroundColor: "var(--muted)", ...S.body, fontFamily: FONT, color: "var(--foreground)" }}>
                              {calculatedShipByDate}
                            </div>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="inline-flex items-center justify-center size-6 rounded-[var(--radius-sm)] hover:bg-secondary transition-colors cursor-pointer" title="How this is calculated">
                                  <Info className="size-3.5 text-muted-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-60 p-3" style={{ fontFamily: FONT }} align="start" sideOffset={4}>
                                <p className="text-foreground mb-1" style={S.bodyMed}>Ship By Calculation</p>
                                <p className="text-muted-foreground" style={S.small}>
                                  Calculated as Due Delivery Date minus estimated transit time for the selected shipping method ({findCarrierAndMethod(shipmentMethod).method?.eta || "—"}).
                                </p>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </FI>
                        <div /> {/* spacer for grid alignment */}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── PO Warnings ── */}
              {activeTab === "warnings" && (
                <div className="rounded-[var(--radius)] overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  {poWarnings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Check className="size-8 text-accent" />
                      <span className="text-muted-foreground" style={S.body}>No warnings for this item</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {poWarnings.map((w) => {
                        const dc = { critical: "var(--destructive)", warning: "var(--warning)", info: "var(--primary)" }[w.severity];
                        return (
                          <div key={w.id} className="flex gap-3 px-4 py-3">
                            <div className="size-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: dc }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-foreground" style={S.bodyMed}>{w.title}</span>
                                <span className="inline-flex items-center px-1.5 py-0 rounded-full uppercase" style={{ backgroundColor: w.severity === "critical" ? "var(--status-cancelled-bg)" : w.severity === "warning" ? "var(--warning-tint)" : "var(--primary-tint-subtle)", color: dc, ...S.badge }}>{w.severity}</span>
                              </div>
                              <p className="text-muted-foreground" style={S.small}>{w.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Inventory Details (with sub-tabs) ── */}
              {activeTab === "inventory" && inventoryData && (
                <div className="rounded-[var(--radius)] overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  {/* Sub-tab bar */}
                  <div className="flex items-center gap-0 px-4" style={{ borderBottom: "1px solid var(--border)" }}>
                    {([
                      { key: "rules" as const, label: "Inventory Rules & Recommendations" },
                      { key: "status" as const, label: "Current Inventory Status" },
                    ]).map((st) => (
                      <button
                        key={st.key}
                        className="relative px-3 py-2 cursor-pointer transition-colors shrink-0"
                        style={{ color: inventorySubTab === st.key ? "var(--primary)" : "var(--muted-foreground)" }}
                        onClick={() => setInventorySubTab(st.key)}
                      >
                        <span style={{ ...S.smallMed, color: "inherit" }}>{st.label}</span>
                        {inventorySubTab === st.key && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full" style={{ backgroundColor: "var(--primary)" }} />}
                      </button>
                    ))}
                  </div>

                  {inventorySubTab === "rules" ? (
                    <div className="p-4 flex flex-col gap-4">
                      {/* Stock Levels */}
                      <div>
                        <span className="text-muted-foreground uppercase block mb-2.5" style={{ ...S.fieldLabel }}>Stock Levels</span>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { l: "Minimum Stock Level", v: `${inventoryData.stockLevels.minStockLevel}`, unit: item.defaultUOM },
                            { l: "Maximum Stock Level", v: `${inventoryData.stockLevels.maxStockLevel}`, unit: item.defaultUOM },
                          ].map((r) => (
                            <div key={r.l} className="rounded-[var(--radius)] px-3 py-2.5" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                              <span className="text-muted-foreground block mb-1" style={S.small}>{r.l}</span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-foreground" style={S.bodySemi}>{r.v}</span>
                                <span className="text-muted-foreground" style={S.tiny}>{r.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="h-px" style={{ backgroundColor: "var(--border)" }} />
                      {/* Order Quantities */}
                      <div>
                        <span className="text-muted-foreground uppercase block mb-2.5" style={{ ...S.fieldLabel }}>Order Quantities</span>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { l: "Min Order Qty", v: `${inventoryData.orderQuantity.minOrderQty}` },
                            { l: "Max Order Qty", v: `${inventoryData.orderQuantity.maxOrderQty}` },
                            { l: "Multiples", v: `${inventoryData.orderQuantity.orderMultiple}` },
                          ].map((r) => (
                            <div key={r.l} className="rounded-[var(--radius)] px-3 py-2.5" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                              <span className="text-muted-foreground block mb-1" style={S.small}>{r.l}</span>
                              <span className="text-foreground" style={S.bodySemi}>{r.v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* F24: Current Inventory Status — Physical Inventory style widgets */
                    <div className="p-4 flex flex-col gap-5">
                      {/* ── KPI Cards Grid ── */}
                      <div className="grid grid-cols-3 gap-2.5">
                        {(() => {
                          const onHand = inventoryData.stockLevels.currentStock;
                          const allocated = Math.round(onHand * 0.12);
                          const available = onHand - allocated;
                          const unitTurnoverRate = 4.2;
                          const dsi = Math.round(365 / unitTurnoverRate);
                          const kpis: { label: string; value: string; icon: React.ReactNode }[] = [
                            { label: "On-Hand", value: `${onHand.toLocaleString()} ${item.defaultUOM}`, icon: <Boxes className="size-3.5 text-muted-foreground" /> },
                            { label: "Available", value: `${available.toLocaleString()} ${item.defaultUOM}`, icon: <User className="size-3.5 text-muted-foreground" /> },
                            { label: "Allocated", value: `${allocated.toLocaleString()} ${item.defaultUOM}`, icon: <ArrowUpDown className="size-3.5 text-muted-foreground" /> },
                            { label: "Quarantined", value: "—", icon: <TrendingDown className="size-3.5 text-muted-foreground" /> },
                            { label: "Upcoming Shipment(s)", value: "3", icon: <Truck className="size-3.5 text-muted-foreground" /> },
                            { label: "Next Incoming Shipment(s)", value: "10/23/2025", icon: <Truck className="size-3.5 text-muted-foreground" /> },
                            { label: "Unit Turnover Rate", value: `${unitTurnoverRate}x`, icon: <Activity className="size-3.5 text-muted-foreground" /> },
                            { label: "Days Sales of Inventory", value: `${dsi} Days`, icon: <CalendarClock className="size-3.5 text-muted-foreground" /> },
                          ];
                          return kpis.map((k) => (
                            <div key={k.label} className="rounded-[var(--radius)] px-3 py-3 flex flex-col gap-1.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-medium)", lineHeight: "14px", display: "flex", alignItems: "center", gap: "4px" }}>
                                  {k.label}
                                  <Info className="size-3 text-muted-foreground/40" />
                                </span>
                                {k.icon}
                              </div>
                              <span className="text-foreground" style={{ fontSize: "16px", fontWeight: "var(--font-weight-semibold)", lineHeight: "22px", letterSpacing: "-0.01em" }}>
                                {k.value}
                              </span>
                            </div>
                          ));
                        })()}
                      </div>

                      {/* ── Stock Health Gauge + Inventory Trend ── */}
                      <div className="grid grid-cols-1 gap-3">
                        {/* Stock Health Gauge */}
                        <div className="rounded-[var(--radius)] border border-border p-4 flex flex-col" style={{ backgroundColor: "var(--card)" }}>
                          {(() => {
                            const { currentStock, minStockLevel, maxStockLevel } = inventoryData.stockLevels;
                            const allocated = Math.round(currentStock * 0.12);
                            const available = currentStock - allocated;
                            const onOrder = Math.round(currentStock * 4.4);
                            const projected = available + onOrder;
                            const pct = Math.round(((currentStock - minStockLevel) / (maxStockLevel - minStockLevel)) * 100);
                            const svgW = 200; const svgH = 130; const cx = svgW / 2; const cy = 110; const r2 = 85; const thickness = 18;

                            const zones = [
                              { pct: 8, color: "rgba(255,69,58,0.38)" },
                              { pct: 12, color: "rgba(239,162,47,0.45)" },
                              { pct: 50, color: "rgba(39,185,115,1)" },
                              { pct: 12, color: "rgba(239,162,47,0.45)" },
                              { pct: 8, color: "rgba(255,69,58,0.38)" },
                              { pct: 10, color: "rgba(234,235,240,0.3)" },
                            ];
                            const totalDeg = 240; const startAngle = 150; const midR = r2 - thickness / 2;
                            function arcPath(s: number, e: number) {
                              const s1 = ((startAngle + s) * Math.PI) / 180;
                              const e1 = ((startAngle + e) * Math.PI) / 180;
                              const la = e - s > 180 ? 1 : 0;
                              return `M ${cx + midR * Math.cos(s1)} ${cy + midR * Math.sin(s1)} A ${midR} ${midR} 0 ${la} 1 ${cx + midR * Math.cos(e1)} ${cy + midR * Math.sin(e1)}`;
                            }
                            let cum = 0;
                            const nPct = Math.max(0, Math.min(1, (currentStock - minStockLevel) / (maxStockLevel - minStockLevel)));
                            const nAngle = -120 + nPct * 240;

                            return (
                              <>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center justify-center size-7 rounded-[var(--radius-sm)]" style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
                                      <Activity className="size-3.5" style={{ color: "var(--primary)" }} />
                                    </div>
                                    <div>
                                      <p className="text-foreground" style={S.bodyMed}>Stock Health</p>
                                      <p className="text-muted-foreground" style={{ ...S.small, fontSize: "10px" }}>Current vs. Min/Max threshold</p>
                                    </div>
                                  </div>
                                  <div className="rounded-[var(--radius-sm)] border border-border px-2 py-1 text-muted-foreground" style={S.small}>{item.defaultUOM} (default)</div>
                                </div>
                                <div className="h-px mb-3" style={{ backgroundColor: "var(--border)", opacity: 0.5 }} />

                                <div className="flex justify-center" style={{ marginBottom: 4 }}>
                                  <div className="relative" style={{ width: svgW, height: svgH }}>
                                    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ overflow: "visible" }}>
                                      {zones.map((z, i) => {
                                        const segStart = cum;
                                        const segEnd = cum + (z.pct / 100) * totalDeg;
                                        cum += (z.pct / 100) * totalDeg;
                                        return <path key={i} d={arcPath(segStart, segEnd)} fill="none" stroke={z.color} strokeWidth={thickness} strokeLinecap={i === 0 || i === zones.length - 1 ? "round" : "butt"} />;
                                      })}
                                      <g style={{ transform: `rotate(${nAngle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "transform 0.8s cubic-bezier(0.34,1.56,0.64,1)" }}>
                                        <line x1={cx} y1={cy - 10} x2={cx} y2={cy - r2 + thickness + 25} stroke="var(--foreground)" strokeWidth={1.5} strokeLinecap="round" />
                                        <circle cx={cx} cy={cy - 10} r={2.5} fill="var(--foreground)" />
                                      </g>
                                    </svg>
                                    <div className="absolute flex flex-col items-center" style={{ bottom: 2, left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }}>
                                      <span className="text-foreground" style={{ fontSize: "22px", fontWeight: "var(--font-weight-semibold)", lineHeight: 1, fontFamily: FONT }}>{currentStock}</span>
                                      <span className="text-muted-foreground" style={{ fontSize: "10px", lineHeight: 1.4, marginTop: 2, fontFamily: FONT }}>{item.defaultUOM} On-Hand</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-muted-foreground" style={{ ...S.small, fontSize: "11px" }}>Min {minStockLevel} <Info className="inline size-2.5 text-muted-foreground/50" /></span>
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)]" style={{ background: pct >= 50 ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "color-mix(in srgb, var(--destructive) 8%, transparent)" }}>
                                    {pct >= 50 ? <Check className="size-3" style={{ color: "var(--accent)" }} /> : <AlertTriangle className="size-3" style={{ color: "var(--destructive)" }} />}
                                    <span style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", color: pct >= 50 ? "var(--accent)" : "var(--destructive)", fontFamily: FONT }}>{pct}% {pct >= 50 ? "Healthy" : "Critical"}</span>
                                  </div>
                                  <span className="text-muted-foreground" style={{ ...S.small, fontSize: "11px" }}>Max {maxStockLevel} <Info className="inline size-2.5 text-muted-foreground/50" /></span>
                                </div>

                                <div className="h-px my-2" style={{ backgroundColor: "var(--border)" }} />
                                <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                                  {[
                                    { l: "Available", v: `${available} ${item.defaultUOM}` },
                                    { l: "Allocated", v: `${allocated} ${item.defaultUOM}` },
                                    { l: "On Order", v: `${onOrder.toLocaleString()} ${item.defaultUOM}` },
                                    { l: "Quarantined", v: "0" },
                                    { l: "In Production", v: "0" },
                                    { l: "Projected", v: `${projected.toLocaleString()} ${item.defaultUOM}` },
                                  ].map((s) => (
                                    <div key={s.l} className="flex flex-col gap-0.5">
                                      <span className="text-muted-foreground" style={{ ...S.small, fontSize: "11px" }}>{s.l}</span>
                                      <span className="text-foreground" style={{ ...S.bodySemi, fontSize: "12px" }}>{s.v}</span>
                                    </div>
                                  ))}
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Inventory Trend */}
                        <div className="rounded-[var(--radius)] border border-border p-4 flex flex-col" style={{ backgroundColor: "var(--card)" }}>
                          {(() => {
                            const trendData = [
                              { day: "Mon", value: 420 }, { day: "Tue", value: 435 }, { day: "Wed", value: 410 },
                              { day: "Thu", value: 450 }, { day: "Fri", value: 445 }, { day: "Sat", value: 430 }, { day: "Sun", value: 450 },
                            ];
                            const latest = trendData[trendData.length - 1].value;
                            const first = trendData[0].value;
                            const changePct = (((latest - first) / first) * 100).toFixed(1);
                            const isUp = latest >= first;
                            return (
                              <>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center justify-center size-7 rounded-[var(--radius-sm)]" style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
                                      <Activity className="size-3.5" style={{ color: "var(--primary)" }} />
                                    </div>
                                    <div>
                                      <p className="text-foreground" style={S.bodyMed}>Inventory Trend</p>
                                      <p className="text-muted-foreground" style={{ ...S.small, fontSize: "10px" }}>On-hand quantity over time</p>
                                    </div>
                                  </div>
                                  <div className="rounded-[var(--radius-sm)] border border-border px-2 py-1 text-muted-foreground" style={S.small}>This Week</div>
                                </div>
                                <div className="h-px mb-3" style={{ backgroundColor: "var(--border)", opacity: 0.5 }} />

                                <div className="flex items-baseline gap-2 mb-3">
                                  <span className="text-foreground" style={{ fontSize: "20px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT, lineHeight: 1 }}>{latest.toLocaleString()} {item.defaultUOM}</span>
                                  <span className="inline-flex items-center rounded-[var(--radius-sm)] px-1.5" style={{
                                    fontSize: "10px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT,
                                    color: isUp ? "var(--accent)" : "var(--destructive)",
                                    background: isUp ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "color-mix(in srgb, var(--destructive) 8%, transparent)",
                                  }}>
                                    {isUp ? "↑" : "↓"} {changePct}%
                                  </span>
                                </div>

                                <div style={{ flex: 1, minHeight: 0, height: 160 }}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                                      <defs>
                                        <linearGradient id="inventoryTrendGrad" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="0%" stopColor="rgba(10,119,255,0.19)" />
                                          <stop offset="100%" stopColor="rgba(10,119,255,0.01)" />
                                        </linearGradient>
                                      </defs>
                                      <Area type="monotone" dataKey="value" stroke="rgba(10,119,255,1)" strokeWidth={2} fill="url(#inventoryTrendGrad)" />
                                      <RechartsTooltip
                                        contentStyle={{ fontSize: 11, fontFamily: FONT, borderRadius: 6, border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
                                        formatter={(v: number) => [`${v} ${item.defaultUOM}`, "On-Hand"]}
                                      />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* ── On-Hand by Unit of Measure (Donut) ── */}
                      <div className="rounded-[var(--radius)] border border-border p-4 w-full" style={{ backgroundColor: "var(--card)", maxWidth: 320 }}>
                        {(() => {
                          const uomData = [
                            { unit: "Each (EA)", qty: 80, converted: 80, color: "var(--chart-1)" },
                            { unit: "Box (2 EA)", qty: 50, converted: 100, color: "var(--chart-2)" },
                            { unit: "Carton (8 EA)", qty: 15, converted: 120, color: "var(--chart-3)" },
                            { unit: "Pallet (80 EA)", qty: 1.87, converted: 150, color: "var(--chart-4)" },
                          ];
                          const totalConverted = uomData.reduce((s, d) => s + d.converted, 0);
                          const dCx = 70; const dCy = 70; const dR = 52; const circumference = 2 * Math.PI * dR; const dThick = 14;
                          let cumOff = 0;
                          const segments = uomData.map((entry) => {
                            const pctVal = entry.converted / totalConverted;
                            const dashLen = pctVal * circumference;
                            const gapLen = circumference - dashLen;
                            const offset = -cumOff;
                            cumOff += dashLen;
                            return { ...entry, dashLen, gapLen, offset, pctVal };
                          });

                          return (
                            <>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center justify-center size-7 rounded-[var(--radius-sm)]" style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
                                  <BarChart3 className="size-3.5" style={{ color: "var(--primary)" }} />
                                </div>
                                <div>
                                  <p className="text-foreground" style={S.bodyMed}>On-Hand by Unit of Measure</p>
                                  <p className="text-muted-foreground" style={{ ...S.small, fontSize: "10px" }}>Stock breakdown across UOMs</p>
                                </div>
                              </div>
                              <div className="h-px mb-4" style={{ backgroundColor: "var(--border)", opacity: 0.5 }} />

                              <div className="flex items-center justify-center mb-4 relative" style={{ maxWidth: 160, margin: "0 auto 16px" }}>
                                <svg width={140} height={140} viewBox={`0 0 ${dCx * 2} ${dCy * 2}`}>
                                  <circle cx={dCx} cy={dCy} r={dR} fill="none" stroke="var(--border)" strokeWidth={dThick} opacity={0.4} />
                                  {segments.map((seg) => (
                                    <circle key={seg.unit} cx={dCx} cy={dCy} r={dR} fill="none" stroke={seg.color} strokeWidth={dThick}
                                      strokeDasharray={`${seg.dashLen} ${seg.gapLen}`} strokeDashoffset={seg.offset} strokeLinecap="butt"
                                      style={{ transform: "rotate(-90deg)", transformOrigin: `${dCx}px ${dCy}px` }} />
                                  ))}
                                </svg>
                                <div className="absolute flex flex-col items-center" style={{ pointerEvents: "none" }}>
                                  <span className="text-foreground" style={{ fontSize: "20px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT, lineHeight: 1 }}>{totalConverted}</span>
                                  <span className="text-muted-foreground" style={{ fontSize: "10px", fontFamily: FONT, marginTop: 2 }}>Total EA</span>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                {uomData.map((uItem) => {
                                  const pctVal = Math.round((uItem.converted / totalConverted) * 100);
                                  return (
                                    <div key={uItem.unit} className="flex items-center justify-between px-1.5 py-1 rounded-[var(--radius-sm)] hover:bg-secondary/50 transition-colors">
                                      <div className="flex items-center gap-2">
                                        <div className="rounded-full" style={{ width: 8, height: 8, background: uItem.color, flexShrink: 0 }} />
                                        <span className="text-foreground" style={{ ...S.bodyMed, fontSize: "12px" }}>{uItem.unit}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-foreground" style={{ ...S.bodySemi, fontSize: "12px" }}>{uItem.converted}</span>
                                        <span className="text-muted-foreground rounded-[var(--radius-sm)] px-1.5" style={{ ...S.tiny, fontSize: "10px", background: "var(--secondary)" }}>{pctVal}%</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Notes ── */}
              {activeTab === "notes" && renderNotesTab && (
                <div className="rounded-[var(--radius)] overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  {renderNotesTab}
                </div>
              )}

              {/* ── Attachments ── */}
              {activeTab === "attachments" && (
                <div className="rounded-[var(--radius)] overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  {attachments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Paperclip className="size-8 text-muted-foreground/40" />
                      <span className="text-muted-foreground" style={S.body}>No attachments</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex items-center justify-center size-9 rounded-[var(--radius)] shrink-0" style={{ backgroundColor: "var(--secondary)" }}>
                            <FileIcon type={att.type} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-foreground block truncate" style={S.bodyMed}>{att.name}</span>
                            <span className="text-muted-foreground" style={S.small}>{att.size} · {att.uploadedBy} · {att.uploadedDate}</span>
                          </div>
                          <button className="flex items-center justify-center size-8 rounded-[var(--radius)] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer shrink-0 border border-border">
                            <Download className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* F15: Add New Vendor — System Vendor Picker */}
        {addNewVendorOpen && item && (() => {
          const allSystem = getAllSystemVendorOffersForItem(item);
          const assignedNames = new Set(vendorOffers.map(o => o.vendorName));
          const available = allSystem.filter(o => !assignedNames.has(o.vendorName));
          const q = addNewVendorSearch.toLowerCase();
          const filtered = q ? available.filter(o => o.vendorName.toLowerCase().includes(q) || o.abbr.toLowerCase().includes(q)) : available;

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
              <div className="w-[400px] rounded-[var(--radius)] border border-border p-0 overflow-hidden flex flex-col" style={{ backgroundColor: "var(--card)", boxShadow: "var(--elevation-lg)", fontFamily: FONT, maxHeight: "min(520px, 80vh)" }}>
                <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <span className="text-foreground block" style={S.secHead}>Add New Vendor</span>
                    <span className="text-muted-foreground block" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "16px" }}>
                      {available.length} vendor{available.length !== 1 ? "s" : ""} available to assign
                    </span>
                  </div>
                  <button onClick={() => { setAddNewVendorOpen(false); setAddNewVendorSearch(""); }} className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] hover:bg-secondary transition-colors cursor-pointer">
                    <X className="size-4 text-muted-foreground" />
                  </button>
                </div>
                {/* Search */}
                <div className="px-3 pt-2.5 pb-1.5 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={addNewVendorSearch}
                      onChange={(e) => setAddNewVendorSearch(e.target.value)}
                      placeholder="Search vendors..."
                      className="w-full h-8 rounded-[var(--radius)] border border-border pl-8 pr-8 text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/15"
                      style={{ ...S.body, fontSize: "12px", backgroundColor: "var(--input-background)", fontFamily: FONT }}
                      autoFocus
                    />
                    {addNewVendorSearch && (
                      <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" onClick={() => setAddNewVendorSearch("")}>
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Vendor list */}
                <div className="flex-1 overflow-y-auto min-h-0 py-1" style={{ scrollbarWidth: "thin" }}>
                  {filtered.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <span className="text-muted-foreground" style={{ fontSize: "12px" }}>
                        {available.length === 0 ? "All system vendors are already assigned to this item" : "No vendors match your search"}
                      </span>
                    </div>
                  ) : filtered.map((offer) => {
                    const contacts = getVendorContacts(offer.vendorName);
                    const nextPriority = vendorOffers.length + 1;
                    const ordinal = nextPriority === 2 ? "2nd" : nextPriority === 3 ? "3rd" : `${nextPriority}th`;
                    return (
                      <button
                        key={offer.vendorName}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 mx-1.5 rounded-[var(--radius)] cursor-pointer transition-all hover:bg-primary/5 text-left"
                        style={{ width: "calc(100% - 12px)" }}
                        onClick={() => handlePickSystemVendor(offer)}
                      >
                        <div className="flex items-center justify-center size-8 rounded-full bg-secondary border border-border shrink-0">
                          <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>{offer.abbr}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground truncate" style={{ fontSize: "13px", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px", fontFamily: FONT }}>{offer.vendorName}</span>
                            <span className="inline-flex items-center px-1.5 py-0 rounded-[var(--radius-sm)] border border-border shrink-0" style={{ fontSize: "9px", fontWeight: "var(--font-weight-medium)", color: "var(--muted-foreground)", backgroundColor: "var(--secondary)", lineHeight: "16px" }}>
                              {ordinal}
                            </span>
                          </div>
                          <span className="text-muted-foreground" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px" }}>
                            {contacts[0]?.name ?? "No contact"} · {offer.locations?.[0]?.name ?? "—"}
                          </span>
                        </div>
                        <Plus className="size-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}

/* ── Field input wrapper ── */
function FI({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-muted-foreground flex items-center gap-1" style={{ fontSize: "10px", fontWeight: "var(--font-weight-semibold)", lineHeight: "14px", fontFamily: FONT, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}