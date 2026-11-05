import React, { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } from "react";
import * as poItemAttachments from "./poItemAttachmentsStore";
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
  ShoppingCart,
  Info,
  Minus,
  Plus,
  ShieldCheck,
  Boxes,
  Paperclip,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  BarChart3,
  BadgePercent,
  Activity,
  Star,
  Pencil,
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
  Layers,
  CalendarDays,
  DollarSign,
  Infinity as InfinityIcon,
} from "lucide-react";
import { Switch } from "./ui/switch";
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
  getVendorOffersForItem,
  getVendorUnitPrice,
  findUnitPrice,
  upsertVendorUnitPrice,
  removeVendorUnitPrice,
  qualifyVendorForItem,
} from "./catalogData";
import type { VendorContactInfo, ItemVendorOffer, VendorUnitPrice } from "./catalogData";
import {
  PriceConfirmationDialog,
  PriceWarningShell,
  classifyPriceChange,
  removePriceCopy,
  changeDefaultCopy,
  type PriceCheckOutcome,
} from "./PriceConfirmationDialog";
import { MultiUnitPriceTable } from "./MultiUnitPriceTable";
import { QualifyVendorPricingModal, type QualifyVendorPricingResult, type QualifySellingUnit } from "./QualifyVendorPricingModal";
import { UnitCombobox } from "./UnitCombobox";
import { conversionFactorOf, findUOM as findRegistryUOM } from "./uomRegistry";
import VendorSelector, { VendorSelectorContent } from "./VendorSelector";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "./ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "./ui/hover-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { SystemDatePicker } from "./_dashboardModalKit";
import { FONT } from "./designTokens";
import { permissionReason, useCan } from "./poPermissions";
import TruncatedItemName from "./TruncatedItemName";
import {
  formatQuantityValue,
  getDraftQuantityValue,
  isValidQuantityDraft,
  parseQuantityDraft,
  preventInvalidQuantityKey,
} from "./quantityInputUtils";
import {
  SHOW_PO_PRICING_RULES,
  getVendorRules,
  computeLineBreakdowns,
  type LinePricingBreakdown,
  type VendorPricingRule,
} from "./poPricingRulesData";
import { POPricingRulesManageModal } from "./POPricingRulesManageModal";
import type { POLineItem, POLineItemInactive } from "./poStore";
import ItemStatusChip from "./ItemStatusChip";
import { LineOneTimeAdjustmentsSection } from "./LineOneTimeAdjustmentsSection";
import { lineOneTimeNet, type LineOneTimeAdjustment } from "./poOrderPricing";
import { AttachmentsTab, MOCK_ATTACHMENTS } from "./attachments/AttachmentsTab";
import { cn } from "./ui/utils";
import { getPO } from "./poStore";
import { DocCurrencyProvider } from "./currency/DocCurrency";
import { useDocCurrency } from "./currency/docCurrencyContext";
import { currencyDecimals, formatMoney, formatRate, moneyPrefix } from "@/app/currency/money";
import { poFx, ruleAmountFactor, ruleAmountFactorToday, toPOCurrency, todayFx, vendorCurrency } from "@/app/currency/poFx";

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
  /** Item-master lifecycle. Set when the item was marked inactive (e.g.
   *  on an existing Draft PO line); absent = Active. Drives the
   *  Active / Inactive status badge in the item header. */
  inactive?: POLineItemInactive;
  /** The currency `unitPrice` is in when it isn't the vendor's
   *  (Procurement Planning's prices are USD). */
  priceCurrency?: string;
}

export interface OrderFlowResult {
  item: OrderFlowItem;
  quantity: number;
  vendorQty: number;
  shipByDate?: string;
  shipmentMethod: string;
  /** Buyer-entered required date — was `dueDeliveryDate` in the legacy
   *  data model. Same semantics: when the buyer needs this line shipped. */
  needByDate: string;
  /** Vendor-committed ship date (optional). New field. */
  promisedShipDate?: string;
  /** Derived expected delivery date (= promisedShipDate + transit). Not
   *  needed by callers — provided for the rare case a receiver wants
   *  the pre-computed value without re-running `computeExpectedDeliveryDate`. */
  expectedDeliveryDate?: string;
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
  /** Item-level one-time discounts/premiums edited in the Pricing Rules
   *  tab. Callers carry them into the cart / new PO / existing PO line. */
  oneTimeAdjustments: LineOneTimeAdjustment[];
  /** The currency the prices above are in: the PO's on a PO line, else
   *  the vendor's (its quote, spec 4.2). */
  currency?: string;
}

export interface OrderFlowPrefill {
  vendorQty?: number;
  shipByDate?: string;
  shipmentMethod?: string;
  needByDate?: string;
  promisedShipDate?: string;
  /** Expected Delivery Date — required primary field in the 2026-07-29
      dates rebuild. When absent, the modal auto-populates it from the
      active vendor's lead time. */
  expectedDeliveryDate?: string;
  inboundLocation?: string;
  /** Existing item-level one-time discounts/premiums on this line. */
  oneTimeAdjustments?: LineOneTimeAdjustment[];
}

/** Optional context shown when the modal is launched from the Demands page —
    surfaces the demand sources being consolidated so the buyer understands
    they are creating ONE PO from multiple demand signals. */
export interface DemandConsolidationContext {
  sources: Array<{
    kind: "SO" | "Request" | "LowStock";
    reference: string;
    qty: number;
    dueDate?: string;
    reason?: string;
    urgency?: string;
  }>;
  totalQty: number;
  uom: string;
}

export type OrderFlowMode = "add-to-cart" | "buy-now" | "edit-cart" | "edit-po" | "add-to-po";

interface OrderFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: OrderFlowItem | null;
  mode: OrderFlowMode;
  prefill?: OrderFlowPrefill | null;
  /** View-only instances (they don't persist edits) show one-time
   *  discounts/premiums read-only. */
  readOnlyAdjustments?: boolean;
  onComplete: (result: OrderFlowResult) => void;
  /** Optional: render notes tab content in right-side tabs */
  renderNotesTab?: React.ReactNode;
  /** Count of notes for badge display */
  notesCount?: number;
  /** Optional: demand-consolidation context for Demands → Draft PO flow */
  demandContext?: DemandConsolidationContext;
  /** PO context — when both are set, the item-attachment picker binds to
   *  the shared `poItemAttachmentsStore` so PO Detail's Item Attachments
   *  section reflects the buyer's picks (and vice-versa). Absent (e.g. in
   *  the create-cart flow) keeps the picker in local-only mode. */
  poId?: string;
  lineItemId?: string;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const EMPTY_SET: Set<string> = new Set();

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

// PRICE_UOM_OPTIONS was retired — every UOM picker now sources from
// `UOM_REGISTRY` via `<UnitCombobox>`. See `src/app/components/uomRegistry.ts`.

function getDefaultShipping(item: OrderFlowItem) {
  const today = new Date();
  const needBy = new Date(today);
  if (item.shortageDate) {
    needBy.setDate(today.getDate() + 10);
  } else {
    needBy.setDate(today.getDate() + 14);
  }
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return {
    needByDate: fmt(needBy),
    shipmentMethod: VENDOR_DEFAULT_SHIPMENT[item.partnerLocation] || "fedex-ground",
    inboundLocation: LOCATION_TO_WAREHOUSE[item.location] || INBOUND_LOCATIONS[0],
  };
}

/* Vendor lead-time table used to auto-populate the Expected Delivery
   Date on the Items Detail Modal (buyer 2026-07-29: "only add expected
   delivery date based on vendors lead time calculated"). The PO
   catalog vendor model (`ItemVendorOffer`) doesn't yet carry a lead
   time field, so we derive one deterministically from the vendor name
   (hash → 3–14 day range) to mirror the planner's `leadTimeDays`
   surface without cross-scope changes to `plannerData`. Range is
   inclusive on both ends. */
function getVendorLeadTimeDays(vendorName: string | null | undefined): number {
  if (!vendorName || !vendorName.trim()) return 7;
  let h = 0;
  for (let i = 0; i < vendorName.length; i++) {
    h = (h * 31 + vendorName.charCodeAt(i)) & 0xffff;
  }
  return 3 + (h % 12); // 3..14
}

/** Expected Delivery ISO date = today + vendor's lead time days.
    Used to prefill the required primary field when the modal opens
    without a stored expectedDeliveryDate. */
function computeExpectedDeliveryFromLeadTime(vendorName: string | null | undefined): string {
  const days = getVendorLeadTimeDays(vendorName);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
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

/* Live input-side warnings surfaced on the Items Detail Modal (spec:
   W-QTY-01..04 + W-DEL-01). Recomputed off the current form state so
   `resolve()` naturally clears the warning by mutating the underlying
   qty/date, not the warning list. */
type InputWarningCode = "W-QTY-01" | "W-QTY-02" | "W-QTY-03" | "W-QTY-04" | "W-DEL-01" | "W-DEL-02";
type InputWarningTarget = "vendorQty" | "baseQty" | "deliveryDate" | "promiseShipDate";
interface InputWarning {
  code: InputWarningCode;
  target: InputWarningTarget;
  title: string;
  /** Full copy shown in the PO Warnings tab. */
  copy: string;
  /** Short copy used as swappable helper text on the input. */
  helper: string;
  /** Human-readable label for the field name used in the confirm-adjust
   *  modal — "quantity", "expected delivery date", etc. */
  fieldLabel: string;
  /** Current value stringified for the confirm modal (e.g. "1 Case",
   *  "Jul 20, 2026"). */
  currentValueLabel: string;
  /** Value the field will be set to after resolve() runs, same format. */
  nextValueLabel: string;
  resolve: () => void;
}

/* Inline warning indicator — replaces the amber helper text on qty/date
 * fields with a compact yellow triangle. Hover surfaces the full copy
 * and the fix button (buyer 2026-08-04 / Eli: "inline colored warning
 * text jams the line view"). HoverCard keeps the button reachable
 * while the pointer moves from icon → panel. */
function warningResolveLabel(code: InputWarningCode): string {
  switch (code) {
    case "W-DEL-01": return "Adjust date to vendor's earliest";
    case "W-DEL-02": return "Pull promise ship earlier";
    case "W-QTY-01": return "Adjust to minimum order quantity";
    case "W-QTY-02": return "Adjust to maximum order quantity";
    case "W-QTY-03":
    case "W-QTY-04": return "Round to nearest valid quantity";
    default: return "Adjust";
  }
}
function WarningIndicator({ warning, onRequestResolve }: { warning: InputWarning; onRequestResolve: (w: InputWarning) => void }) {
  const resolveLabel = warningResolveLabel(warning.code);
  return (
    <HoverCard openDelay={80} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`Warning: ${warning.title}`}
          className="inline-flex items-center justify-center cursor-help"
          style={{ width: 18, height: 18, background: "transparent", border: 0, padding: 0 }}
        >
          <AlertTriangle size={14} style={{ color: "hsl(var(--warning))", fill: "hsl(45, 100%, 88%)" }} />
        </button>
      </HoverCardTrigger>
      {/* Partners-repo tooltip shell — rounded-xl, thin bordered, backdrop
          blur, soft two-layer shadow. Matches Partner-Management-Vendor's
          HoverCardContent aesthetic (VendorsListPage). */}
      <HoverCardContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[280px] p-0 border-0 rounded-xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.98)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.05)",
        }}
      >
        <div className="flex flex-col gap-2.5" style={{ padding: "12px 14px" }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} style={{ color: "hsl(var(--warning))", fill: "hsl(45, 100%, 88%)", marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontSize: "12px", lineHeight: "17px", color: "hsl(var(--foreground))" }}>
              <strong style={{ fontWeight: 600, color: "hsl(var(--warning))" }}>Warning:</strong>{" "}
              {warning.copy}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRequestResolve(warning)}
            className="self-start inline-flex items-center justify-center transition-colors cursor-pointer"
            style={{
              height: 28,
              padding: "0 12px",
              borderRadius: "var(--radius-sm)",
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              border: 0,
              fontFamily: FONT,
              fontSize: "11.5px",
              fontWeight: 600,
              lineHeight: "14px",
              boxShadow: "0 1px 2px rgba(16,24,40,0.06)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.92"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            {resolveLabel}
          </button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
interface InventoryData {
  stockLevels: { currentStock: number; minStockLevel: number; maxStockLevel: number; reorderPoint: number; safetyStock: number };
  orderQuantity: { minOrderQty: number; maxOrderQty: number; orderMultiple: number; economicOrderQty: number };
}
function generateInventoryData(item: OrderFlowItem): InventoryData {
  const h = hashStr(item.id); const min = item.minQuantity; const max = min * (3 + (h % 3));
  return { stockLevels: { currentStock: item.currentStock, minStockLevel: min, maxStockLevel: max, reorderPoint: Math.round(min * 1.2), safetyStock: Math.round(min * 0.3) }, orderQuantity: { minOrderQty: Math.max(1, Math.round(min * 0.5)), maxOrderQty: max * 2, orderMultiple: item.vendorUOMQty > 1 ? item.vendorUOMQty : (h % 5 === 0 ? 10 : h % 3 === 0 ? 5 : 1), economicOrderQty: Math.round(min * 1.5) } };
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

/* ══════════════════════════════════════════════════════════════
   COLLAPSIBLE SECTION
   ═══════════════════════════════════════════════════════════════ */
function Accordion({ title, icon, badge, open, onToggle, children }: { title: string; icon: React.ReactNode; badge?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] overflow-hidden" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
      <button className="w-full flex items-center justify-between px-3.5 py-2 cursor-pointer transition-colors hover:bg-secondary/40" onClick={onToggle}>
        <div className="flex items-center gap-2">{icon}<span className="text-foreground" style={S.secHead}>{title}</span>{badge}</div>
        {open ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
      </button>
      {open && <div style={{ borderTop: "1px solid hsl(var(--border))" }}>{children}</div>}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   DEMAND-SOURCES POPOVER
   Renders a small "View sources" trigger next to the consolidation
   banner. Clicking opens a list of every demand row being merged into
   this PO with quantity + due date / reason / urgency.
   ═════════════════════════════════════════════════════════════ */

function DemandSourcesPopover({
  sources,
  uom,
}: {
  sources: DemandConsolidationContext["sources"];
  uom: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-white hover:!bg-secondary cursor-pointer transition-colors shrink-0"
          style={{ ...S.smallMed, color: "#0A77FF" }}
        >
          View sources <ChevronDown className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] p-0"
        align="end"
        style={{ fontFamily: FONT, backgroundColor: "hsl(var(--card))" }}
      >
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span style={{ ...S.bodySemi, color: "#334155" }}>Demand Sources</span>
          <span style={{ ...S.small, color: "#94A3B8" }}>{sources.length}</span>
        </div>
        <div className="max-h-[280px] overflow-y-auto divide-y divide-border">
          {sources.map((s, i) => (
            <div key={i} className="px-3 py-2 flex items-start gap-2 text-[12px]">
              <span
                className="inline-flex items-center whitespace-nowrap px-1.5 py-0.5 rounded border tabular-nums shrink-0"
                style={{
                  fontWeight: 500,
                  fontSize: 10,
                  backgroundColor: "#F1F5F9",
                  color: "#475569",
                  borderColor: "#E2E8F0",
                  fontFamily: FONT,
                }}
              >
                {s.kind === "LowStock" ? "Low Stock" : s.kind === "SO" ? "SO" : "Request"}
              </span>
              <div className="flex-1 min-w-0">
                <div style={{ ...S.bodyMed, color: "#0F172A" }}>
                  {s.reference}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span style={{ ...S.small, color: "#334155" }}>
                    {s.qty} {uom}
                  </span>
                  <span style={{ color: "#CBD5E1" }}>·</span>
                  <span className="truncate" style={{ ...S.small, color: "#64748B" }}>
                    {s.dueDate
                      ? `Due ${s.dueDate}`
                      : s.reason
                      ? `"${s.reason}"`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ═════════════════════════════════════════════════════════════
   PRICING RULES SECTION CARD — ported from Sales Orders V5's
   LineItemConfigModal (2026-07-22). Renders inside the Items
   Detail Modal's right column, above the Total block. Shows every
   rule that could apply to this line (vendor + item-code match)
   with rich chrome: colored left border, TrendingUp/Down icon,
   name + status pills, metadata pills (Volume/Value · expiry ·
   tier), per-rule Switch, master Switch, "N active" badge, footer
   link to Manage.

   Kept as a plain helper (not a memoised component) — the rule
   set is small (<10 rules per line typical) and the parent's
   render frequency is low.
   ═════════════════════════════════════════════════════════════ */

interface LinePricingRulesCardProps {
  rules: VendorPricingRule[];
  breakdown: LinePricingBreakdown | null;
  deactivatedRuleIds: Set<string>;
  onToggleRule: (ruleId: string, next: boolean) => void;
  onToggleAll: (next: boolean) => void;
  onOpenManage: () => void;
  currentQty: number;
  readOnly?: boolean;
}

function LinePricingRulesCard({
  rules,
  breakdown,
  deactivatedRuleIds,
  onToggleRule,
  onToggleAll,
  onOpenManage,
  currentQty,
  readOnly,
}: LinePricingRulesCardProps) {
  const { currency } = useDocCurrency();
  if (rules.length === 0) return null;

  /* Enrich each rule with the runtime signals SO's UI reads: active
     tier, pending flag, expiry state, per-line impact amount. Compute
     once per rule so the row render below stays lean. */
  const today = new Date();
  const rows = rules.map((r) => {
    const impact = breakdown?.ruleImpacts.find((ri) => ri.ruleId === r.id);
    const isUnapplied = deactivatedRuleIds.has(r.id);
    const isPending = !isUnapplied && !impact && currentQty < (r.tiers[0]?.minQty ?? 1);
    const minQtyFirst = r.tiers[0]?.minQty ?? 1;
    /* Active tier — 1-indexed. Picks the highest tier whose minQty
       the current qty satisfies. */
    let activeTierIdx: number | null = null;
    for (let i = 0; i < r.tiers.length; i++) {
      if (currentQty >= r.tiers[i].minQty) activeTierIdx = i + 1;
    }
    const validTo = r.validTo ? new Date(r.validTo + "T00:00:00") : null;
    const daysUntilExpiry = validTo && !isNaN(validTo.getTime())
      ? Math.floor((validTo.getTime() - today.getTime()) / 86400000)
      : null;
    const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
    return {
      rule: r,
      impact,
      isUnapplied,
      isPending,
      minQtyFirst,
      activeTierIdx,
      validTo,
      daysUntilExpiry,
      isExpiringSoon,
      isExpired,
    };
  });

  const activeRulesCount = rows.filter((r) => !r.isUnapplied && r.impact).length;
  const totalImpact = breakdown
    ? breakdown.discountAmount - breakdown.premiumAmount
    : 0;

  return (
    <div className="border border-slate-200 bg-white" style={{ borderRadius: 12, overflow: "hidden" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "#EEF2F6" }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#EFF6FF" }}>
            <BadgePercent className="w-3.5 h-3.5" style={{ color: "#1B6EF3" }} />
          </div>
          <span className="text-[13px] text-slate-800" style={{ fontWeight: 600 }}>
            Pricing Rules
          </span>
          {activeRulesCount > 0 && (
            <span
              className="inline-flex items-center whitespace-nowrap rounded-md border"
              style={{
                padding: "2px 6px",
                fontSize: 10,
                fontWeight: 500,
                color: "#065F46",
                backgroundColor: "#ECFDF5",
                borderColor: "#A7F3D0",
              }}
            >
              {activeRulesCount} active
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="About pricing rules"
                className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-help shrink-0"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-[320px] text-[11.5px] leading-[1.55] z-[12700]">
              Pricing rules are reusable conditional rules defined on the vendor record. The system applies them to a line item automatically whenever the line meets the rule&apos;s conditions, such as a quantity tier, item category, or contract term, so the same discount or premium is consistent across every purchase order for that vendor.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          {totalImpact !== 0 && (
            <span
              className="text-[13px]"
              style={{
                fontWeight: 600,
                color: totalImpact > 0 ? "#10B981" : "#7C3AED",
              }}
            >
              {totalImpact > 0 ? "−" : "+"}{formatMoney(Math.abs(totalImpact), currency)}
            </span>
          )}
          {!readOnly && (
            <Switch
              checked={activeRulesCount > 0}
              onCheckedChange={(on) => onToggleAll(on)}
              aria-label={activeRulesCount > 0 ? "Deactivate all rules" : "Reactivate all rules"}
            />
          )}
        </div>
      </div>

      {/* Rule rows */}
      {rows.map((row, idx) => {
        const { rule, impact, isUnapplied, isPending, minQtyFirst, activeTierIdx, validTo, daysUntilExpiry, isExpiringSoon, isExpired } = row;
        const isPremium = rule.type === "premium";
        const isDisabled = isUnapplied;
        const leftBorderColor = isDisabled ? "#E5E7EB" : isPremium ? "#7C3AED" : "#10B981";
        const iconColor = isDisabled ? "#9CA3AF" : isPremium ? "#7C3AED" : "#10B981";
        const isLast = idx === rows.length - 1;
        /* Rate label — read from the currently-matched tier when the
           rule is impacting the line; fall back to the first tier when
           it's deactivated/pending so the row still shows the rule's
           headline rate. */
        const impactTier = impact?.tier ?? rule.tiers[0];
        const rateStr = `${impactTier.rate}${impactTier.unit === "%" ? "%" : ""}`;
        const amountStr = impact ? formatMoney(Math.abs(impact.amount), currency) : null;
        const isMultiTier = rule.tiers.length > 1;

        return (
          <div
            key={rule.id}
            className="flex items-start justify-between pr-4"
            style={{
              paddingLeft: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderLeftWidth: 3,
              borderLeftStyle: "solid",
              borderLeftColor: leftBorderColor,
              borderBottom: isLast ? undefined : "1px solid #F3F4F6",
              background: "#FFFFFF",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#FFFFFF"; }}
          >
            <div className="flex items-start gap-2 flex-1 min-w-0">
              {isPremium
                ? <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-[2px]" style={{ color: iconColor }} />
                : <TrendingDown className="w-3.5 h-3.5 flex-shrink-0 mt-[2px]" style={{ color: iconColor }} />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[12px]"
                    style={{
                      fontWeight: 500,
                      color: isDisabled ? "#9CA3AF" : "#1F2937",
                      textDecoration: isDisabled ? "line-through" : undefined,
                    }}
                  >
                    {rule.name}
                  </span>
                  {isUnapplied && (
                    <span
                      className="border"
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 3,
                        fontWeight: 500,
                        color: "#6B7280",
                        backgroundColor: "#F3F4F6",
                        borderColor: "#E5E7EB",
                      }}
                    >
                      Deactivated
                    </span>
                  )}
                </div>
                {isPending && (
                  <div className="text-[10px] mt-0.5" style={{ color: "#92400E", fontWeight: 400 }}>
                    Requires min. {minQtyFirst} units
                  </div>
                )}
                {/* Metadata pill line — Volume/Value + expiry + tier */}
                <div className={`flex items-center gap-1 flex-wrap mt-1 ${isDisabled ? "opacity-60" : ""}`}>
                  <span
                    className="inline-flex items-center gap-1 rounded-full border"
                    style={{
                      padding: "2px 8px",
                      fontSize: 10.5,
                      fontWeight: 500,
                      backgroundColor: "#F8FAFC",
                      color: "#475569",
                      borderColor: "#E2E8F0",
                    }}
                  >
                    <Layers style={{ width: 10, height: 10, color: "#94A3B8" }} />
                    Volume
                  </span>
                  {validTo ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border"
                      style={{
                        padding: "2px 8px",
                        fontSize: 10.5,
                        fontWeight: 500,
                        color: isUnapplied ? "#9CA3AF" : isExpired ? "#B91C1C" : isExpiringSoon ? "#B45309" : "#475569",
                        backgroundColor: isUnapplied ? "#F3F4F6" : isExpired ? "#FEE2E2" : isExpiringSoon ? "#FEF3C7" : "#F8FAFC",
                        borderColor: isUnapplied ? "#E5E7EB" : isExpired ? "#FECACA" : isExpiringSoon ? "#FDE68A" : "#E2E8F0",
                      }}
                      title={`Valid ${rule.validFrom} – ${rule.validTo}`}
                    >
                      <CalendarDays style={{ width: 10, height: 10, color: "#94A3B8" }} />
                      {isExpired ? `Expired ${rule.validTo}` : isExpiringSoon ? `Expires in ${daysUntilExpiry}d` : `Until ${rule.validTo}`}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border"
                      style={{
                        padding: "2px 8px",
                        fontSize: 10.5,
                        fontWeight: 500,
                        backgroundColor: "#F8FAFC",
                        color: "#475569",
                        borderColor: "#E2E8F0",
                      }}
                    >
                      <InfinityIcon style={{ width: 11, height: 11, color: "#94A3B8" }} />
                      No expiry
                    </span>
                  )}
                  {isMultiTier && activeTierIdx !== null && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border tabular-nums"
                      style={{
                        padding: "2px 8px",
                        fontSize: 10.5,
                        fontWeight: 500,
                        backgroundColor: "#F8FAFC",
                        color: "#475569",
                        borderColor: "#E2E8F0",
                      }}
                    >
                      <Layers style={{ width: 10, height: 10, color: "#94A3B8" }} />
                      T{activeTierIdx} of {rule.tiers.length}
                    </span>
                  )}
                  {rule.source === "custom" && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border"
                      style={{
                        padding: "2px 8px",
                        fontSize: 10.5,
                        fontWeight: 500,
                        backgroundColor: "#F8FAFC",
                        color: "#475569",
                        borderColor: "#E2E8F0",
                      }}
                    >
                      <DollarSign style={{ width: 10, height: 10, color: "#94A3B8" }} />
                      Custom
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 mt-[2px]">
              <div className="text-right flex items-baseline justify-end gap-2" style={{ minWidth: 130 }}>
                <span
                  className="text-[12px]"
                  style={{
                    fontWeight: 600,
                    color: iconColor,
                    textDecoration: isDisabled ? "line-through" : undefined,
                  }}
                >
                  {isPremium ? "+" : "−"}{rateStr}
                </span>
                {amountStr && (
                  <span
                    className="text-[11px]"
                    style={{
                      fontWeight: 500,
                      color: iconColor,
                      opacity: 0.8,
                      textDecoration: isDisabled ? "line-through" : undefined,
                    }}
                  >
                    {isPremium ? "+" : "−"}{amountStr}
                  </span>
                )}
              </div>
              {!readOnly && (
                <Switch
                  checked={!isUnapplied}
                  onCheckedChange={(on) => onToggleRule(rule.id, on)}
                  aria-label={isUnapplied ? "Reactivate rule" : "Deactivate rule"}
                />
              )}
            </div>
          </div>
        );
      })}

      {/* Manage footer */}
      {!readOnly && (
        <div className="px-3 py-2 border-t" style={{ borderColor: "#E5E7EB" }}>
          <button
            type="button"
            onClick={onOpenManage}
            className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline underline-offset-2 cursor-pointer transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Tag className="w-3.5 h-3.5" />
            Manage Pricing Rules for this Vendor
          </button>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════ */

/** Vendor tiers → editable selling-unit cards for the pricing modal. */
function tiersToSellingUnits(tiers: VendorUnitPrice[]): QualifySellingUnit[] {
  const str = (n?: number) => (n == null ? "" : String(n));
  return tiers.map((t) => ({
    price: t.price > 0 ? t.price.toFixed(2) : "",
    uom: t.unit,
    poOnly: t.poOnly,
    minOrderQty: str(t.orderingRules?.minOrderQty),
    maxOrderQty: str(t.orderingRules?.maxOrderQty),
    multiples: str(t.orderingRules?.multiples),
    acceptedDeviationPct: str(t.orderingRules?.acceptedDeviationPct),
    leadTimeDays: str(t.orderingRules?.leadTimeDays),
  }));
}

export default function OrderFlow({ open, onOpenChange, item, mode, prefill, readOnlyAdjustments = false, onComplete, renderNotesTab, notesCount = 0, demandContext, poId, lineItemId }: OrderFlowProps) {
  const [vendorQty, setVendorQty] = useState(1);
  const [vendorQtyInput, setVendorQtyInput] = useState("1");
  const [defaultQtyOverride, setDefaultQtyOverride] = useState<number | null>(null);
  const [defaultQtyInput, setDefaultQtyInput] = useState<string | null>(null);
  const [qtySwapped, setQtySwapped] = useState(false);
  const [vendorUnitOverride, setVendorUnitOverride] = useState<string>("");
  const [shipmentMethod, setShipmentMethod] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("FDX");
  /* Delivery-dates model (2026-07-29 rebuild).
     UI names → underlying data fields:
       Expected Delivery Date (required, primary) → expectedDeliveryDate
       Ship By Date            (optional, secondary) → needByDate
       Promise Ship Date       (optional, +Add, record-only) → promisedShipDate
     Data-layer field names kept unchanged so planner + cart + print PO
     surfaces continue to work without cross-scope changes. */
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [needByDate, setNeedByDate] = useState("");
  const [promisedShipDate, setPromisedShipDate] = useState("");
  /* Promise Ship is a third-step optional (buyer 2026-07-29 "hide
     underneath a button so it looks optional a third step optional").
     Ship By stays in-row alongside Expected Delivery per buyer
     2026-07-29 ("I need the ship by date field the same way we have
     previously"), so only Promise Ship carries a toggle here. */
  const [showPromiseShipDate, setShowPromiseShipDate] = useState(false);
  const [inboundLocation, setInboundLocation] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [vendorContacts, setVendorContacts] = useState<VendorContactInfo[]>([]);
  const [vendorOffers, setVendorOffers] = useState<ItemVendorOffer[]>([]);
  const [activeVendor, setActiveVendor] = useState<string>("");
  /* Original vendor snapshot taken when the modal opened for an
     existing-PO edit. Used to detect when the buyer picks a DIFFERENT
     vendor mid-edit — POs are single-vendor, so a mid-edit swap needs
     to spawn a new PO for the new vendor (buyer 2026-08-03: "as soon
     I changed the vendor this needs to give the warning that you are
     changing the vendor and this will create a new PO"). Empty string
     when the modal isn't in a PO editing mode. */
  const originalPOVendorRef = useRef<string>("");
  /* Snapshot of the PO's ship-from location for the active vendor (the
     vendor's default location on modal open). A PO can only cover one
     ship-from location per vendor, so changing it — either directly or
     by qualifying a different location — spawns a new PO (buyer
     2026-08-07). Empty string when the modal isn't in a PO editing
     mode or the vendor doesn't have a default. */
  const originalPOLocationRef = useRef<string>("");
  /* Pending vendor swap awaiting the buyer's confirmation. Populated
     when they click a different vendor in the picker while inside a PO
     editing mode; the actual `setActiveVendor` call is deferred until
     they confirm the "create a new PO" prompt. */
  const [vendorSwapPrompt, setVendorSwapPrompt] = useState<{
    offer: ItemVendorOffer;
    variant: "original" | "additional";
    sourceVendorName?: string;
  } | null>(null);
  /* Same-shape prompt for location swaps — a PO can only cover one
     ship-from location per vendor, so any change fires the same
     "create a new PO" modal. Deferred so we can revert if the buyer
     backs out. */
  const [poLocationSwapPrompt, setPOLocationSwapPrompt] = useState<
    { vendor: string; fromLocation: string; toLocation: string; needsQualification: boolean; apply: () => void } | null
  >(null);
  const [activeUnitPrice, setActiveUnitPrice] = useState<number>(0);
  const [activeDiscount, setActiveDiscount] = useState<number>(0);
  /* Currencies (spec 4.2, 4.3). The vendor's price book is in its default
     currency (`bookCurrency`). The line's price is in the document's: the
     PO's on a PO line (it may have been changed from Order Summary), else
     the vendor's. A book price becoming the line's is converted at the
     PO's rate (`bookToFlow`). */
  /** The currency an offer's prices are in: its own (an offer built from the
   *  item's price), else the vendor's default. */
  const offerCurrencyOf = (vendorName: string | undefined) =>
    vendorOffers.find((o) => o.vendorName === vendorName)?.currency ?? vendorCurrency(vendorName);
  const bookCurrency = offerCurrencyOf(activeVendor || item?.partnerLocation).toUpperCase();
  const linkedPO = poId ? getPO(poId) : undefined;
  const linkedFx = linkedPO ? poFx(linkedPO) : null;
  const flowCurrency = linkedFx ? linkedFx.currency : bookCurrency;
  const flowFx = linkedFx ?? todayFx(flowCurrency);
  const bookToFlow = (price: number, vendorName?: string, currency?: string) =>
    linkedPO ? toPOCurrency(price, currency ?? (vendorName ? offerCurrencyOf(vendorName) : bookCurrency), linkedPO) : price;
  const [sections, setSections] = useState<Record<string, boolean>>({ warnings: false, inventory: false, vendors: false, attachments: false });
  const [activeTab, setActiveTab] = useState<string>("shipping");
  const [inventorySubTab, setInventorySubTab] = useState<"rules" | "status">("rules");
  const [emptyVendorPickerOpen, setEmptyVendorPickerOpen] = useState(false);
  /* Which assigned-vendor card's picker is open (no-vendor items) —
     controlled so a location-qualify pick can close it before the
     scope prompt opens. */
  const [assignedPickerOpenFor, setAssignedPickerOpenFor] = useState<string | null>(null);
  // F20: track which fields have shown the default prompt
  const [defaultPromptShown, setDefaultPromptShown] = useState<Record<string, boolean>>({});
  const [defaultPromptField, setDefaultPromptField] = useState<string | null>(null);
  // F15: Add New Vendor modal — now a system vendor picker
  const [addNewVendorOpen, setAddNewVendorOpen] = useState(false);
  const [addNewVendorSearch, setAddNewVendorSearch] = useState("");
  /* Vendor pricing modal (Partners' selling-unit cards). Every price /
     unit add or edit in this modal routes here — there is no inline
     editing. `isNewVendor` = picked from Add New Vendor (joins the item
     on save); `selectUnitOnSave` = the unpriced unit the buyer picked
     on the Quantity card, switched to once it has a price. */
  const [pricingModal, setPricingModal] = useState<{
    mode: "qualify" | "edit";
    offer: ItemVendorOffer;
    isNewVendor: boolean;
    appendUnit?: string | true;
    focusUnit?: string;
    selectUnitOnSave?: string;
    /** Single-unit edit/add — the modal shows one card; on save it's
     *  merged back into the vendor's full tier set. */
    single?: boolean;
  } | null>(null);
  /* Pricing-rules per-line deactivation — buyer 2026-07-22, mirrors
     Sales Orders V5's per-line pricing-rule Switch state. A rule id in
     this Set means the buyer manually toggled that rule off on this
     line (`unappliedReason === "USER_UNAPPLIED"` in SO's vocab). The
     effective computation below excludes deactivated rules from the
     price breakdown. */
  const [deactivatedRuleIds, setDeactivatedRuleIds] = useState<Set<string>>(new Set());
  const [managePricingRulesOpen, setManagePricingRulesOpen] = useState(false);
  /* Item-level one-time discounts/premiums (ported from Sales Orders'
     line configurator). Local draft — committed via onComplete. */
  const [oneTimeAdjustments, setOneTimeAdjustments] = useState<LineOneTimeAdjustment[]>([]);

  /* PO-attachment selection — per-item picker over the item's library.
     Buyer 2026-08-03: default flipped so NO attachments land on the PO;
     the buyer opts specific files in via the "Not on PO" tab. Reset on
     item change below preserves this empty-by-default behaviour.
     Buyer 2026-08-04: when opened with a PO context (poId+lineItemId),
     bind to the shared `poItemAttachmentsStore` so PO Detail's Item
     Attachments section stays in sync with picks made here. */
  const boundToStore = !!(poId && lineItemId);
  const storeSubscribe = useCallback(
    (cb: () => void) => (poId ? poItemAttachments.subscribe(poId, cb) : () => {}),
    [poId],
  );
  const storeSnapshot = useSyncExternalStore(
    storeSubscribe,
    () => (boundToStore ? poItemAttachments.getPickedAttachmentIds(poId!, lineItemId!) : EMPTY_SET),
    () => EMPTY_SET,
  );
  const [localPoAttachmentIds, setLocalPoAttachmentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const poAttachmentIds = boundToStore ? storeSnapshot : localPoAttachmentIds;
  const togglePoAttachment = useCallback((id: string) => {
    if (boundToStore) {
      poItemAttachments.togglePickedAttachment(poId!, lineItemId!, id);
      return;
    }
    setLocalPoAttachmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [boundToStore, poId, lineItemId]);

  /* Location qualification — mock model: every vendor's *default*
     location is qualified for this item; non-default locations start
     un-qualified and require the buyer to accept a scope prompt
     ("Use on this PO only" vs "Qualify on the vendor") before we
     commit. The Set stores `${vendor}|${location}` pairs that were
     explicitly qualified during this session (buyer 2026-07-30). */
  const [selectedLocByVendor, setSelectedLocByVendor] = useState<
    Record<string, string>
  >({});
  const [qualifiedLocations, setQualifiedLocations] = useState<Set<string>>(new Set());
  const commitLocationChange = useCallback((vendor: string, location: string) => {
    setSelectedLocByVendor((prev) => ({ ...prev, [vendor]: location }));
  }, []);
  /* `qualifyOnApply` — the buyer chose "Use on this PO only" in the
     qualify prompt: the pair only counts as usable once the swap is
     actually applied ("Create new PO"), so backing out with "Keep
     current location" leaves nothing behind (ERP-6264). */
  const handleLocationChangeInFlow = (
    vendor: string,
    location: string,
    alreadyQualified = false,
    qualifyOnApply = false,
  ) => {
    /* PO ships from exactly one vendor+location. Any pick that differs
       from the PO's original — same-vendor location swap, cross-vendor
       pick, or an unqualified location — defers through a single
       "create new PO" confirmation prompt. The apply callback covers
       qualification + vendor swap + location commit in one step, so
       the buyer never sees a stack of modals (buyer 2026-08-10). */
    const originalLoc = originalPOLocationRef.current;
    const originalVendor = originalPOVendorRef.current;
    if (!originalLoc || !originalVendor) {
      commitLocationChange(vendor, location);
      return;
    }
    const vendorChanged = vendor !== originalVendor;
    const locationChanged = location !== originalLoc;
    if (!vendorChanged && !locationChanged) return;
    const needsQualification = !alreadyQualified && !isLocationQualifiedForItem(vendor, location);
    setPOLocationSwapPrompt({
      vendor,
      fromLocation: originalLoc,
      toLocation: location,
      needsQualification,
      apply: () => {
        if (needsQualification || qualifyOnApply) {
          setQualifiedLocations((prev) => new Set(prev).add(`${vendor}|${location}`));
        }
        commitLocationChange(vendor, location);
        if (vendorChanged) {
          const offer = vendorOffers.find((o) => o.vendorName === vendor);
          if (offer) applyVendorOfferOriginal(offer);
        }
      },
    });
  };
  const isLocationQualifiedForItem = useCallback(
    (vendor: string, locationName: string) => {
      if (qualifiedLocations.has(`${vendor}|${locationName}`)) return true;
      const offer = vendorOffers.find((o) => o.vendorName === vendor);
      const loc = offer?.locations.find((l) => l.name === locationName);
      return !!loc?.isDefault;
    },
    [qualifiedLocations, vendorOffers],
  );
  /* Unqualified location pick → scope prompt first (restored from
     #145, buyer 2026-10-16): "Use on this PO only" vs "Qualify on the
     vendor". Once qualified, the pick continues through
     handleLocationChangeInFlow, so edit-PO modes still get the
     "create a new PO" warning when the ship-from changes. */
  const [locationQualifyPrompt, setLocationQualifyPrompt] = useState<
    { vendor: string; location: string } | null
  >(null);
  const handleLocationNeedsQualification = (vendor: string, location: string) => {
    setLocationQualifyPrompt({ vendor, location });
  };
  const applyLocationQualification = (scope: "po-only" | "vendor") => {
    if (!locationQualifyPrompt) return;
    const { vendor, location } = locationQualifyPrompt;
    setLocationQualifyPrompt(null);
    /* "Qualify on the vendor" saves at once and sticks even if the
       buyer then keeps the current location (Eli, ERP-6264). "Use on
       this PO only" is held until the location is actually applied. */
    if (scope === "vendor") {
      setQualifiedLocations((prev) => new Set(prev).add(`${vendor}|${location}`));
      toast.success(`${location} qualified for ${vendor.replace(/ \(.*\)$/, "")}`, {
        description: "Future POs can ship from this location.",
      });
    }
    /* Defer so the swap prompt (if any) reads the freshly-qualified
       pair and opens after this AlertDialog has closed. */
    setTimeout(() => {
      const originalLoc = originalPOLocationRef.current;
      const originalVendor = originalPOVendorRef.current;
      if (!originalLoc || !originalVendor) {
        if (scope === "po-only") {
          setQualifiedLocations((prev) => new Set(prev).add(`${vendor}|${location}`));
        }
        commitLocationChange(vendor, location);
        if (hasOriginalVendor && vendor !== activeVendor) {
          const offer = vendorOffers.find((o) => o.vendorName === vendor);
          if (offer) applyVendorOfferOriginal(offer);
        }
        return;
      }
      handleLocationChangeInFlow(vendor, location, true, scope === "po-only");
    }, 0);
  };

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

  const [assignedVendors, setAssignedVendors] = useState<AssignedVendor[]>([]);
  const [vendorPriceMap, setVendorPriceMap] = useState<Record<string, VendorPriceEntry>>({});
  const vendorPriceMapRef = useRef<Record<string, VendorPriceEntry>>({});
  const [editPriceValue, setEditPriceValue] = useState("");
  const [editPriceUOM, setEditPriceUOM] = useState("");
  const [isAssigningAdditionalVendor, setIsAssigningAdditionalVendor] = useState(false);
  /* Multi-unit price view — expanded reveals the table of all (unit, price)
     tiers for the active vendor on this item. Collapsed shows just the default. */
  const [multiUnitExpanded, setMultiUnitExpanded] = useState(false);
  /* Inline editor for tier rows: which row is being edited + draft values */
  const [editTierUnit, setEditTierUnit] = useState<string | null>(null);
  const [tierDraftPrice, setTierDraftPrice] = useState<string>("");
  const [tierDraftUnit, setTierDraftUnit] = useState<string>("");
  /* "+ Add another unit price" inline row state */
  const [addTierMode, setAddTierMode] = useState(false);
  const [addTierUnit, setAddTierUnit] = useState<string>("");
  const [addTierPrice, setAddTierPrice] = useState<string>("");
  /* Price-change confirmation dialog (scenarios A & B) */
  const [priceConfirmState, setPriceConfirmState] = useState<{
    open: boolean;
    outcome: PriceCheckOutcome | null;
    /** Run when user picks "Save / Update Default" — writes to master */
    onConfirmDefault: () => void;
    /** Run when user picks "Use for this PO only" — writes only the local PO state */
    onUseOnce: () => void;
    /** "add" swaps amber warning chrome for the blue Partners add
     *  chrome — used when the buyer is genuinely adding a new tier. */
    variant?: "warning" | "add";
  }>({ open: false, outcome: null, onConfirmDefault: () => {}, onUseOnce: () => {} });
  /* Generic amber-warning state for the tier-table flows (remove
     tier, change default). Same visual shell as the entered-price
     dialog above, just with custom copy per action so the buyer
     sees a consistent warning family. */
  const [tierWarning, setTierWarning] = useState<{
    open: boolean;
    chipLabel: string;
    title: string;
    description: React.ReactNode;
    primaryLabel: string;
    secondaryLabel: string;
    tone: "amber" | "red";
    /** Push change to the qualified vendor's master record + apply here. */
    onPrimary: () => void;
    /** Apply change only to this PO's local state; master untouched. */
    onSecondary: () => void;
  }>({
    open: false,
    chipLabel: "",
    title: "",
    description: null,
    primaryLabel: "",
    secondaryLabel: "",
    tone: "amber",
    onPrimary: () => {},
    onSecondary: () => {},
  });
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
        // The item's own price: the PO's currency on a PO line, Planning's USD, else the vendor's.
        const linePo = poId ? getPO(poId) : undefined;
        const itemCurrency = linePo ? poFx(linePo).currency : item.priceCurrency?.toUpperCase();
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
          if (o.vendorName === item.partnerLocation) return { ...o, unitPrice: item.unitPrice, priority: "default", isDefault: true, discount: item.discount, currency: itemCurrency };
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

      /* Snapshot the original vendor for PO edit modes so we can
         detect mid-edit swaps and warn about spawning a new PO. */
      originalPOVendorRef.current =
        (mode === "edit-po" || mode === "add-to-po") && item.partnerLocation
          ? item.partnerLocation
          : "";
      /* Snapshot the vendor's default ship-from location — anything
         other than this on this item spawns a new PO. */
      if ((mode === "edit-po" || mode === "add-to-po") && item.partnerLocation) {
        const activeOffer = offers.find((o) => o.vendorName === item.partnerLocation);
        const defaultLoc = activeOffer?.locations.find((l) => l.isDefault);
        originalPOLocationRef.current = defaultLoc?.name ?? "";
      } else {
        originalPOLocationRef.current = "";
      }
      setVendorSwapPrompt(null);
      setPOLocationSwapPrompt(null);
      if (item.partnerLocation) {
        // VENDOR-ASSIGNED: revert to original behavior — auto-populate price
        const offer = offers.find(o => o.vendorName === item.partnerLocation);
        setActiveVendor(item.partnerLocation);
        // A PO line's own price is already in the PO's currency.
        setActiveUnitPrice(offer ? bookToFlow(offer.unitPrice, offer.vendorName, offer.currency) : item.unitPrice);
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
        setNeedByDate(prefill.needByDate ?? "");
        setPromisedShipDate(prefill.promisedShipDate ?? "");
        /* Expected Delivery Date is the required primary. When the modal
           reopens for an existing line we honor whatever was saved; when
           it's blank (new prefill) we auto-populate from the vendor's
           lead time so the buyer sees a sensible default (2026-07-29). */
        setExpectedDeliveryDate(
          prefill.expectedDeliveryDate ?? computeExpectedDeliveryFromLeadTime(item.partnerLocation),
        );
        /* Promise Ship is a third-step optional — always collapsed on
           open, even if a date is on record (buyer 2026-07-29 "hide
           underneath a button so it looks optional a third step
           optional"). Trigger below shows the existing date as an
           editable chip. */
        setShowPromiseShipDate(false);
        setInboundLocation(prefill.inboundLocation ?? "");
      } else {
        setVendorQty(1);
        setVendorQtyInput(formatQuantityValue(1, serializedItem));
        const d = getDefaultShipping(item);
        const carrierPrefix = d.shipmentMethod.split("-")[0]?.toUpperCase();
        const matchedCarrier = SHIPPING_CARRIERS.find((c) => c.code === carrierPrefix);
        setShippingCarrier(matchedCarrier?.code ?? "FDX");
        setShipmentMethod(d.shipmentMethod);
        /* Ship By starts empty on new items — it's optional, so the
           buyer opts in by picking a date (buyer 2026-07-29: "this
           field will be empty and user can choose a date"). Expected
           Delivery is still auto-calc'd from the vendor's lead time
           since that's the required primary. Promise Ship stays hidden
           until the buyer clicks + Add promise ship date. */
        setNeedByDate("");
        setPromisedShipDate("");
        setExpectedDeliveryDate(computeExpectedDeliveryFromLeadTime(item.partnerLocation));
        setShowPromiseShipDate(false);
        setInboundLocation(d.inboundLocation);
      }
      setNotes("");
      setOneTimeAdjustments(prefill?.oneTimeAdjustments ? prefill.oneTimeAdjustments.map((a) => ({ ...a })) : []);
      setSections({ warnings: false, inventory: false, vendors: false, attachments: false });
      // Only reset local-mode picks. When bound to the shared store the
      // picks are persistent per (poId, lineItemId).
      if (!boundToStore) setLocalPoAttachmentIds(new Set());
      setSelectedLocByVendor({});
      setQualifiedLocations(new Set());
      setLocationQualifyPrompt(null);
    }
  }, [item?.id, open, mode]);

  const inventoryData = useMemo(() => (item ? generateInventoryData(item) : null), [item?.id]);
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

  /* ── Input warnings (W-QTY-01..04, W-DEL-01) ─────────────────────
     Live per-input validations that surface as:
       1. A row in the PO Warnings tab (with Adjust to auto-resolve).
       2. Swappable inline helper text on the quantity/date fields.
     The set is recomputed every render off current form state so
     resolving one warning naturally clears it without a manual flag. */
  const setVendorQtyTo = useCallback((next: number) => {
    if (!item) return;
    const serialized = isSerialized(item);
    const n = Math.max(0, Math.round(next));
    setVendorQty(n);
    setVendorQtyInput(formatQuantityValue(n, serialized));
    setDefaultQtyOverride(null);
    setDefaultQtyInput(null);
  }, [item]);

  const inputWarnings = useMemo<InputWarning[]>(() => {
    if (!item || !inventoryData) return [];
    const list: InputWarning[] = [];
    const vendorUOMQty = Math.max(1, item.vendorUOMQty || 1);
    /* `activeVendorUnit` is declared much later in this component body
       (post-vendor-hooks section), so inline its formula here to avoid a
       TDZ error when this useMemo runs during render. */
    const vendorUnit = vendorUnitOverride || item.vendorUOM || item.defaultUOM;
    const baseUnit = item.defaultUOM || item.vendorUOM || "unit";
    const vendorQtyValue = vendorQty;
    const baseQtyValue = defaultQtyOverride ?? (vendorQty * vendorUOMQty);

    // Vendor-side constraints derived from the item's inventory rules.
    const vendorMOQ = Math.max(1, Math.ceil(inventoryData.orderQuantity.minOrderQty / vendorUOMQty));
    const vendorMax = Math.max(vendorMOQ, Math.floor(inventoryData.orderQuantity.maxOrderQty / vendorUOMQty));
    // Vendor multiple is independent from the base-unit multiple so the two
    // warnings (W-QTY-03 vs W-QTY-04) can fire independently. Derived from
    // the item's hash for deterministic mock data.
    const h = hashStr(item.id);
    const vendorMultiple = h % 4 === 0 ? 4 : h % 5 === 0 ? 3 : h % 3 === 0 ? 2 : 1;
    const baseMultiple = Math.max(1, inventoryData.orderQuantity.orderMultiple);

    // Round up helpers.
    const roundUpToMultiple = (n: number, m: number) => (m <= 1 ? n : Math.ceil(n / m) * m);
    const findVendorQtyMatchingBaseMultiple = (startVendor: number) => {
      let v = Math.max(vendorMOQ, startVendor);
      const step = Math.max(1, vendorMultiple);
      for (let i = 0; i < 1000; i++) {
        if ((v * vendorUOMQty) % baseMultiple === 0) return v;
        v += step;
      }
      return v;
    };

    // W-QTY-01: Below minimum order quantity (vendor stocking unit).
    if (vendorQtyValue > 0 && vendorQtyValue < vendorMOQ) {
      list.push({
        code: "W-QTY-01",
        target: "vendorQty",
        title: "Below minimum order quantity",
        copy: `Quantity is below the minimum order quantity of ${vendorMOQ} ${vendorUnit} for this vendor. Adjust to meet the minimum or proceed if intentional.`,
        helper: `Below minimum order quantity of ${vendorMOQ} ${vendorUnit}.`,
        fieldLabel: "quantity",
        currentValueLabel: `${vendorQtyValue} ${vendorUnit}`,
        nextValueLabel: `${vendorMOQ} ${vendorUnit}`,
        resolve: () => setVendorQtyTo(vendorMOQ),
      });
    }
    // W-QTY-02: Exceeded maximum order quantity (vendor stocking unit).
    else if (vendorMax > 0 && vendorQtyValue > vendorMax) {
      list.push({
        code: "W-QTY-02",
        target: "vendorQty",
        title: "Exceeded maximum order quantity",
        copy: `Quantity exceeds the maximum order quantity of ${vendorMax} ${vendorUnit} for this vendor. Adjust or split into multiple POs.`,
        helper: `Exceeds maximum order quantity of ${vendorMax} ${vendorUnit}.`,
        fieldLabel: "quantity",
        currentValueLabel: `${vendorQtyValue} ${vendorUnit}`,
        nextValueLabel: `${vendorMax} ${vendorUnit}`,
        resolve: () => setVendorQtyTo(vendorMax),
      });
    }
    // W-QTY-03: Invalid multiples (vendor selling unit).
    if (vendorMultiple > 1 && vendorQtyValue > 0 && vendorQtyValue % vendorMultiple !== 0) {
      const down = Math.max(vendorMultiple, Math.floor(vendorQtyValue / vendorMultiple) * vendorMultiple);
      const up = down + vendorMultiple;
      const next = roundUpToMultiple(vendorQtyValue, vendorMultiple);
      list.push({
        code: "W-QTY-03",
        target: "vendorQty",
        title: "Invalid multiples (vendor selling unit)",
        copy: `Quantity must be in multiples of ${vendorMultiple} ${vendorUnit}. Closest valid quantities: ${down} or ${up}.`,
        helper: `Must be in multiples of ${vendorMultiple} ${vendorUnit}. Try ${down} or ${up}.`,
        fieldLabel: "quantity",
        currentValueLabel: `${vendorQtyValue} ${vendorUnit}`,
        nextValueLabel: `${next} ${vendorUnit}`,
        resolve: () => setVendorQtyTo(next),
      });
    }
    // W-QTY-04: Invalid multiples (default stocking unit).
    if (baseMultiple > 1 && baseQtyValue > 0 && baseQtyValue % baseMultiple !== 0) {
      const nextVendor = findVendorQtyMatchingBaseMultiple(vendorQtyValue);
      const nextBase = nextVendor * vendorUOMQty;
      list.push({
        code: "W-QTY-04",
        target: "baseQty",
        title: "Invalid multiples (default stocking unit)",
        copy: `Equivalent quantity in default stocking unit is not in valid multiples of ${baseMultiple} ${baseUnit}. Adjust or proceed if conversion difference is acceptable.`,
        helper: `Equivalent ${baseUnit} qty must be in multiples of ${baseMultiple}.`,
        fieldLabel: "equivalent quantity",
        currentValueLabel: `${baseQtyValue} ${baseUnit}`,
        nextValueLabel: `${nextBase} ${baseUnit}`,
        resolve: () => setVendorQtyTo(nextVendor),
      });
    }
    // W-DEL-01: Expected delivery earlier than vendor's lead time allows.
    if (activeVendor && expectedDeliveryDate) {
      const days = getVendorLeadTimeDays(activeVendor);
      const earliest = new Date();
      earliest.setHours(0, 0, 0, 0);
      earliest.setDate(earliest.getDate() + days);
      const entered = new Date(expectedDeliveryDate + "T00:00:00");
      if (!isNaN(entered.getTime()) && entered.getTime() < earliest.getTime()) {
        /* Build the ISO string from local calendar components, NOT via
           toISOString(). In positive-UTC offset zones (e.g. Karachi, +5),
           a local-midnight Date's UTC representation lands the previous
           day, so toISOString().split("T")[0] would return "yesterday"
           and Adjust would set the picker one day earlier than the
           "Earliest" copy suggests. */
        const y = earliest.getFullYear();
        const m = String(earliest.getMonth() + 1).padStart(2, "0");
        const d = String(earliest.getDate()).padStart(2, "0");
        const earliestISO = `${y}-${m}-${d}`;
        const earliestPretty = earliest.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const enteredPretty = entered.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        list.push({
          code: "W-DEL-01",
          target: "deliveryDate",
          title: "Expected delivery date",
          copy: `Expected delivery date is earlier than the vendor's lead time of ${days} days allows. Earliest feasible date: ${earliestPretty}.`,
          helper: `Earlier than vendor's ${days}-day lead time. Earliest: ${earliestPretty}.`,
          fieldLabel: "expected delivery date",
          currentValueLabel: enteredPretty,
          nextValueLabel: earliestPretty,
          resolve: () => setExpectedDeliveryDate(earliestISO),
        });
      }
    }
    // W-DEL-02: Promise ship date + shipping method + expected delivery
    // combination: if shipping on the promised date wouldn't reach the
    // expected-delivery date given the method's transit time, flag it.
    // FYI only (buyer 2026-08-05) — don't block; provide an Adjust that
    // pulls the promise ship earlier so ETA lands on expected delivery.
    if (promisedShipDate && shipmentMethod && expectedDeliveryDate) {
      const found = findCarrierAndMethod(shipmentMethod);
      if (found.method) {
        const etaStr = found.method.eta;
        const daysMatch = etaStr.match(/(\d+)/g);
        const transitDays = daysMatch ? parseInt(daysMatch[daysMatch.length - 1], 10) : 0;
        if (transitDays) {
          const ship = new Date(promisedShipDate + "T00:00:00");
          const eta = new Date(ship);
          eta.setDate(eta.getDate() + transitDays);
          const expected = new Date(expectedDeliveryDate + "T00:00:00");
          if (!isNaN(eta.getTime()) && !isNaN(expected.getTime()) && eta.getTime() > expected.getTime()) {
            /* Pull the promise ship earlier so eta == expected. */
            const targetShip = new Date(expected);
            targetShip.setDate(targetShip.getDate() - transitDays);
            const y = targetShip.getFullYear();
            const m = String(targetShip.getMonth() + 1).padStart(2, "0");
            const d = String(targetShip.getDate()).padStart(2, "0");
            const targetISO = `${y}-${m}-${d}`;
            const shipPretty = ship.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const targetPretty = targetShip.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const expectedPretty = expected.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            list.push({
              code: "W-DEL-02",
              target: "promiseShipDate",
              title: "Promise ship date conflicts with delivery",
              copy: `With ${found.method.label || found.method.value} (${etaStr}), shipping on ${shipPretty} won't arrive by the expected delivery date of ${expectedPretty}. FYI only — no need to change unless the vendor can commit earlier.`,
              helper: `Won't arrive by ${expectedPretty} with ${found.method.label || found.method.value}.`,
              fieldLabel: "promise ship date",
              currentValueLabel: shipPretty,
              nextValueLabel: targetPretty,
              resolve: () => setPromisedShipDate(targetISO),
            });
          }
        }
      }
    }
    return list;
  }, [item, inventoryData, vendorQty, defaultQtyOverride, vendorUnitOverride, activeVendor, expectedDeliveryDate, promisedShipDate, shipmentMethod, setVendorQtyTo]);

  const vendorRowWarning = inputWarnings.find((w) => w.target === "vendorQty");
  const baseRowWarning = inputWarnings.find((w) => w.target === "baseQty");
  const dateRowWarning = inputWarnings.find((w) => w.target === "deliveryDate");
  const promiseShipRowWarning = inputWarnings.find((w) => w.target === "promiseShipDate");

  /* Confirm-adjust + scroll-to-blink flow (buyer 2026-08-04 / Eli):
     both Adjust affordances (hover-card in-field + PO Warnings tab) now
     open an AlertDialog "Are you sure you'd like to change [field] from
     X to Y?" first. On confirm the underlying resolve() fires, the
     target field is scrolled into view, and a green blink pulses on
     that field for ~60s (or until the next mouse/keyboard action) so
     the buyer can see what changed. Mirror of the red error-blink
     pattern; forward-only per design-committee note. */
  const vendorQtyWrapRef = useRef<HTMLDivElement | null>(null);
  const baseQtyWrapRef = useRef<HTMLDivElement | null>(null);
  const deliveryDateWrapRef = useRef<HTMLDivElement | null>(null);
  const promiseShipDateWrapRef = useRef<HTMLDivElement | null>(null);
  const [pendingResolve, setPendingResolve] = useState<InputWarning | null>(null);
  const [blinkTarget, setBlinkTarget] = useState<InputWarningTarget | null>(null);
  const handleRequestResolve = useCallback((w: InputWarning) => {
    setPendingResolve(w);
  }, []);
  const runResolve = useCallback((w: InputWarning) => {
    w.resolve();
    setPendingResolve(null);
    /* Wait one tick so the value update commits before we scroll — the
       DOM reflects the new value which reads more naturally to the eye
       than mid-transition state. */
    setTimeout(() => {
      const wrap =
        w.target === "vendorQty" ? vendorQtyWrapRef.current
        : w.target === "baseQty" ? baseQtyWrapRef.current
        : w.target === "promiseShipDate" ? promiseShipDateWrapRef.current
        : deliveryDateWrapRef.current;
      if (wrap) {
        wrap.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setBlinkTarget(w.target);
    }, 30);
  }, []);
  /* Clear the blink on the next user interaction (mouse or keyboard).
     Belt-and-suspenders: also a 60s auto-clear timer. */
  useEffect(() => {
    if (!blinkTarget) return;
    const clear = () => setBlinkTarget(null);
    const t = window.setTimeout(clear, 60_000);
    const onDown = () => setTimeout(clear, 400); // let the initial blink land before clearing on the next click
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onDown);
    };
  }, [blinkTarget]);

  /* Delivery-dates model (2026-07-29 rebuild): Expected Delivery is now
     the primary buyer input (state). This derivation is retained as a
     *suggestion* — the buyer can accept it (one-tap "Use Mar 18") to
     populate the state, or leave it as a compatibility check target. It
     lands as Ship By + method transit. Returns null until both inputs
     exist. Ship By's data field is still `needByDate` under the hood. */
  const suggestedDeliveryDate = useMemo(() => {
    if (!needByDate || !shipmentMethod) return null;
    const found = findCarrierAndMethod(shipmentMethod);
    if (!found.method) return null;
    const etaStr = found.method.eta;
    const daysMatch = etaStr.match(/(\d+)/g);
    const transitDays = daysMatch ? parseInt(daysMatch[daysMatch.length - 1], 10) : 0;
    if (!transitDays) return null;
    const ship = new Date(needByDate + "T00:00:00");
    ship.setDate(ship.getDate() + transitDays);
    return ship.toISOString().split("T")[0];
  }, [needByDate, shipmentMethod]);

  /* Transit-range compatibility check (buyer 2026-07-29): when Expected
     Delivery + Ship By + Ship Method are all set, verify the gap fits the
     method's stated transit window. ±1-day tolerance on each side. Warn
     only — never block. Returns null when any input is missing or the
     method's eta string can't be parsed. */
  const deliveryCompat = useMemo(() => {
    if (!expectedDeliveryDate || !needByDate || !shipmentMethod) return null;
    const found = findCarrierAndMethod(shipmentMethod);
    if (!found.method) return null;
    const etaStr = found.method.eta;
    const daysMatches = etaStr.match(/(\d+)/g);
    if (!daysMatches || daysMatches.length === 0) return null;
    const nums = daysMatches.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
    if (nums.length === 0) return null;
    const rangeMin = Math.min(...nums);
    const rangeMax = Math.max(...nums);
    const ship = new Date(needByDate + "T00:00:00").getTime();
    const arrive = new Date(expectedDeliveryDate + "T00:00:00").getTime();
    const gapDays = Math.round((arrive - ship) / (1000 * 60 * 60 * 24));
    /* ±1-day tolerance on both edges (buyer 2026-07-29: "1–2–3 day range =
       acceptable variance"). Anything outside triggers a warning banner
       but the buyer can still save. */
    const tolMin = rangeMin - 1;
    const tolMax = rangeMax + 1;
    const inRange = gapDays >= tolMin && gapDays <= tolMax;
    return { gapDays, rangeMin, rangeMax, inRange, methodLabel: found.method.label };
  }, [expectedDeliveryDate, needByDate, shipmentMethod]);

  // F20: Handle optional field change with default prompt
  const handleOptionalFieldChange = useCallback((fieldKey: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (value && !defaultPromptShown[fieldKey] && activeVendor) {
      setDefaultPromptField(fieldKey);
      setDefaultPromptShown(prev => ({ ...prev, [fieldKey]: true }));
    }
  }, [defaultPromptShown, activeVendor]);

  // Vendor pricing modal → save. Writes the selling units (price + UoM +
  // ordering rules per unit) to the vendor's qualification on the master
  // record (PO-only tiers stay local), then updates this line.
  //  · New vendor (F15 Add New Vendor) — joins the item's vendor list.
  //  · Existing vendor — its tiers are replaced with the edited set.
  // The line keeps its current unit when that unit is still priced,
  // otherwise it moves to the primary unit.
  const applyVendorPricing = useCallback((
    baseOffer: ItemVendorOffer,
    result: QualifyVendorPricingResult,
    opts: { isNewVendor: boolean; mode: "qualify" | "edit"; selectUnitOnSave?: string },
  ) => {
    if (!item) return;
    const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
    const tiers: VendorUnitPrice[] = result.units.map((u, i) => ({
      unit: u.uom,
      price: Number.isFinite(parseFloat(u.price)) ? parseFloat(u.price) : 0,
      isDefault: i === result.primaryIndex,
      conversionFactor: conversionFactorOf(u.uom),
      ...(u.poOnly ? { poOnly: true } : {}),
      orderingRules: {
        minOrderQty: num(u.minOrderQty),
        maxOrderQty: num(u.maxOrderQty),
        multiples: num(u.multiples),
        acceptedDeviationPct: num(u.acceptedDeviationPct),
        leadTimeDays: num(u.leadTimeDays),
      },
    }));
    const primary = tiers[result.primaryIndex] ?? tiers[0];
    const vendorName = baseOffer.vendorName;
    const newOffer: ItemVendorOffer = {
      ...baseOffer,
      unitPrice: primary.price,
      ...(opts.isNewVendor ? { priority: String(vendorOffers.length + 1), isDefault: false, discount: 0 } : {}),
      defaultUOM: primary.unit,
      uom: primary.unit,
      uomQty: primary.conversionFactor ?? 1,
      unitPrices: tiers,
    };
    /* Master record never sees PO-only tiers. If the primary is a
       PO-only tier, the vendor keeps its previous default there. */
    const masterTiers = tiers.filter((t) => !t.poOnly).map((t) => ({ ...t }));
    if (masterTiers.length > 0 && !masterTiers.some((t) => t.isDefault)) {
      const prevDefault = baseOffer.unitPrices?.find((t) => t.isDefault)?.unit.toLowerCase();
      (masterTiers.find((t) => t.unit.toLowerCase() === prevDefault) ?? masterTiers[0]).isDefault = true;
    }
    const masterDefault = masterTiers.find((t) => t.isDefault);
    if (masterTiers.length > 0) qualifyVendorForItem(item.id, {
      ...newOffer,
      unitPrices: masterTiers,
      ...(masterDefault ? { unitPrice: masterDefault.price, uom: masterDefault.unit, defaultUOM: masterDefault.unit, uomQty: masterDefault.conversionFactor ?? 1 } : {}),
    });
    setVendorOffers(prev => opts.isNewVendor
      ? [...prev, newOffer]
      : prev.map(o => o.vendorName === vendorName ? newOffer : o));

    // Unit the line should sit on after the save.
    const wanted = opts.selectUnitOnSave
      ?? (opts.isNewVendor ? primary.unit : (vendorUnitOverride || item.vendorUOM));
    const lineTier = tiers.find(t => t.unit.toLowerCase() === wanted.toLowerCase()) ?? primary;

    if (!hasOriginalVendor) {
      setAssignedVendors(prev => prev.some(v => v.vendorName === vendorName)
        ? prev.map(v => v.vendorName === vendorName ? { ...v, price: lineTier.price, priceConfirmed: true, discount: 0 } : v)
        : [...prev, { vendorName, abbr: newOffer.abbr, price: lineTier.price, priceConfirmed: true, discount: 0, priority: newOffer.priority, isDefault: false }]);
    }
    upsertVendorPrice(vendorName, { price: lineTier.price, priceConfirmed: true, discount: 0, unit: lineTier.unit });
    setActiveVendor(vendorName);
    setActiveUnitPrice(bookToFlow(lineTier.price, vendorName));
    setActiveDiscount(0);
    setVendorUnitOverride(lineTier.unit);
    if (opts.isNewVendor) setVendorContacts(getVendorContacts(vendorName));
    setPricingModal(null);
    toast.success(
      opts.mode === "qualify" && result.scope === "po" ? `${vendorName} added to this PO only`
        : opts.mode === "qualify" ? `${vendorName} qualified for ${item.itemNumber}`
        : result.scope === "po" ? "Unit price added to this PO only"
        : result.scope === "vendor" ? `Unit price added to ${vendorName}`
        : `${vendorName} unit prices updated`,
      {
        description: `${tiers.length} selling unit${tiers.length !== 1 ? "s" : ""} · ${primary.unit} is primary`,
        style: { fontFamily: FONT }, duration: 3000,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, vendorOffers, hasOriginalVendor, vendorUnitOverride]);

  // F24: Mock consumption data for sparkline
  const consumptionData = useMemo(() => {
    if (!item) return [];
    const h = hashStr(item.id);
    return Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      usage: Math.max(2, Math.round(10 + Math.sin(i * 0.5 + h) * 5 + (h % 3) * 2)),
    }));
  }, [item?.id]);

  /* Resolve the offer object for the active vendor. Preferred order:
     in-memory vendorOffers (may carry unsaved tier edits), then master record. */
  const activeOffer = useMemo<ItemVendorOffer | undefined>(() => {
    return vendorOffers.find((o) => o.vendorName === activeVendor);
  }, [vendorOffers, activeVendor]);

  /* Sorted tier list — smallest conversionFactor first. Always returns at
     least one entry so the UI has something to render. Tolerates a missing item.
     Also dedupes by lowercase unit name — first occurrence wins so any
     stale duplicate in legacy `unitPrices` data (or a race between a
     commit and a re-render) never surfaces as a doubled row in the
     pricing table or the Vendor Selling Unit dropdown. */
  const activeTiers: VendorUnitPrice[] = useMemo(() => {
    const fromOffer = activeOffer?.unitPrices;
    if (fromOffer && fromOffer.length > 0) {
      const seen = new Set<string>();
      const deduped: VendorUnitPrice[] = [];
      for (const tier of fromOffer) {
        const key = tier.unit.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(tier);
      }
      return deduped.sort((a, b) => (a.conversionFactor ?? 1) - (b.conversionFactor ?? 1));
    }
    return [{
      unit: activeOffer?.uom || item?.vendorUOM || item?.defaultUOM || "Each",
      price: activeOffer?.unitPrice ?? 0,
      isDefault: true,
      conversionFactor: activeOffer?.uomQty ?? 1,
    }];
  }, [activeOffer, item?.vendorUOM, item?.defaultUOM]);

  /* Units already configured — used to filter the "add new tier" UOM picker. */
  const configuredUnits = useMemo(
    () => new Set(activeTiers.map((t) => t.unit.trim().toLowerCase())),
    [activeTiers],
  );

  /* Pioneer v1.0 gates — MUST live above the `if (!item) return null` guard
     so the hooks count stays stable across renders where `item` toggles
     between undefined (modal closed) and set. `po.one_time_discounts`
     gates the item-level One-Time Discounts/Premiums section. */
  const canCreateEditPO = useCan("po.create_edit");
  const canOneTimeDiscounts = useCan("po.one_time_discounts");
  const canNonQualifiedVendor = useCan("po.non_qualified_vendors");
  const canModifyPricingRules = useCan("po.modify_pricing_rules");

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
  };

  const applyDefaultQtyInput = (raw: string) => {
    if (!isValidQuantityDraft(raw, serialized)) return;
    setDefaultQtyInput(raw);
    setDefaultQtyOverride(getDraftQuantityValue(raw, serialized));
  };

  const commitVendorQtyInput = () => {
    const nextQty = parseQuantityDraft(vendorQtyInput, serialized) ?? 0;
    setVendorQty(nextQty);
    setVendorQtyInput(formatQuantityValue(nextQty, serialized));
    setDefaultQtyOverride(null);
    setDefaultQtyInput(null);
  };

  const commitDefaultQtyInput = () => {
    const nextQty = parseQuantityDraft(defaultQtyInput ?? "", serialized) ?? 0;
    setDefaultQtyOverride(nextQty);
    setDefaultQtyInput(formatQuantityValue(nextQty, serialized));
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

  /* ── Tier-edit callbacks ──
     Shared by:
       (a) the new pencil-icon button next to the headline "$X / UOM"
           display in the Unit Price block (so the buyer can edit the
           current price without first expanding the +N other units
           table), and
       (b) the MultiUnitPriceTable rows below.
     Single source of truth keeps both surfaces in sync — `editTierUnit`
     is the lone state token, so opening edit from either entry point
     puts the same row into the same edit mode. */
  const beginTierEdit = (unit: string) => {
    setEditTierUnit(unit);
    const found = activeTiers.find((t) => t.unit === unit);
    // Plain digits for the number input ("49,534.00" would parse as 49).
    setTierDraftPrice(found ? found.price.toFixed(currencyDecimals(bookCurrency)) : "");
    setTierDraftUnit(unit);
  };
  const commitTierEdit = (unit: string) => {
    const parsed = parseFloat(tierDraftPrice);
    // $0 / blank IS valid — never block. Use 0 as the explicit price.
    const nextPrice = Number.isFinite(parsed) ? parsed : 0;
    if (!activeVendor) return;
    // Heal the denormalized conversionFactor against the registry on
    // every edit. Off-registry units keep their existing factor.
    const registryFactor = findRegistryUOM(unit)?.conversionFactor;

    /* Write the new price to the master record + local mirrors. Shared by
       the silent path and the "Update default" branch of the prompt. */
    const writeTier = () => {
      upsertVendorUnitPrice(item.id, activeVendor, unit, nextPrice, {
        ...(registryFactor !== undefined ? { conversionFactor: registryFactor } : {}),
      });
      setVendorOffers((prev) =>
        prev.map((o) => {
          if (o.vendorName !== activeVendor) return o;
          const nextTiers = (o.unitPrices ?? []).map((t) =>
            t.unit === unit
              ? {
                  ...t,
                  price: nextPrice,
                  ...(registryFactor !== undefined
                    ? { conversionFactor: registryFactor }
                    : {}),
                }
              : t,
          );
          return { ...o, unitPrices: nextTiers };
        }),
      );
      /* If the edited tier is the one currently driving the headline
         price (i.e. the active unit), refresh `activeUnitPrice` so the
         "$X / UOM" display updates immediately. Without this the
         vendor-offer write lands but the headline keeps the stale value
         until the user navigates away. */
      const activeUnitNow = vendorUnitOverride || item.vendorUOM;
      if (unit === activeUnitNow) {
        setActiveUnitPrice(bookToFlow(nextPrice));
      }
    };

    // Close the inline editor right away — neither entry point commits on
    // blur (only Enter / the commit button), so this can't re-fire.
    setEditTierUnit(null);
    setTierDraftPrice("");

    /* Changing an existing real price to a DIFFERENT real price routes
       through the same confirmation as the inline price editor, so the
       buyer explicitly okays pushing it to the vendor's saved record.
       Baseline is the price the row is CURRENTLY showing (what's being
       changed) — not getVendorUnitPrice(), because the expanded tier
       rows (Each / Box / Pallet …) aren't all in the master registry, so
       that lookup would miss them and skip the prompt. New/blank tiers
       and unchanged or $0 edits commit silently. */
    const currentTierPrice = activeTiers.find((t) => t.unit === unit)?.price;
    /* Any explicit check-click prompts unless the entered price
       matches the tier the buyer started with (nothing to confirm).
       $0 / blank still prompts so a buyer never silently pushes a
       zero tier to the qualified vendor. */
    const matchesCurrent =
      currentTierPrice !== undefined &&
      Math.abs(currentTierPrice - nextPrice) < 0.005;
    if (matchesCurrent) {
      writeTier();
      return;
    }
    const outcome: PriceCheckOutcome =
      currentTierPrice !== undefined && currentTierPrice > 0
        ? {
            kind: "update-default",
            vendorName: activeVendor,
            unit,
            enteredPrice: nextPrice,
            existingDefaultPrice: currentTierPrice,
          }
        : {
            kind: "save-as-default",
            vendorName: activeVendor,
            unit,
            enteredPrice: nextPrice,
          };
    setPriceConfirmState({
      open: true,
      outcome,
      onConfirmDefault: () => {
        writeTier();
        toast.success("Qualified vendor updated", {
          description: `${activeVendor} · ${formatMoney(nextPrice, bookCurrency)} / ${unit}`,
          style: { fontFamily: FONT }, duration: 2400,
        });
      },
      onUseOnce: () => {
        /* Local-only write — mirror the tier onto this PO's
           vendorOffers without touching the master registry. */
        setVendorOffers((prev) =>
          prev.map((o) => {
            if (o.vendorName !== activeVendor) return o;
            const nextTiers = (o.unitPrices ?? []).map((t) =>
              t.unit === unit ? { ...t, price: nextPrice } : t,
            );
            return { ...o, unitPrices: nextTiers };
          }),
        );
        const activeUnitNow = vendorUnitOverride || item.vendorUOM;
        if (unit === activeUnitNow) setActiveUnitPrice(bookToFlow(nextPrice));
        toast.message(`${formatMoney(nextPrice, bookCurrency)} / ${unit} applied to this PO`, {
          description: "Qualified vendor left unchanged",
          style: { fontFamily: FONT }, duration: 2400,
        });
      },
    });
  };
  const cancelTierEdit = () => {
    setEditTierUnit(null);
    setTierDraftPrice("");
  };
  /* Commit a brand-new tier from the "Add another unit price" row. A real
     (> $0) price routes through the same confirmation as the inline editor
     — the "save as default" variant, since the tier doesn't exist on the
     vendor yet: "Save as Default" persists it to the vendor's record,
     "Use for this PO only" adds it to this PO without touching the master.
     $0 / blank adds silently. Shared by both MultiUnitPriceTable mounts. */
  const commitAddTier = () => {
    if (!activeVendor) return;
    const unit = addTierUnit.trim();
    if (!unit) return;
    const parsed = parseFloat(addTierPrice);
    const price = Number.isFinite(parsed) ? parsed : 0;
    const factor = conversionFactorOf(unit);

    /* If the buyer picked a unit that's ALREADY configured on this
       vendor, don't silently drop the submission. Route it through
       the same "Price differs from default" warning the pencil-
       edit flow uses so overwriting an existing tier is explicit.
       Same warning shell → consistent buyer mental model across the
       tier table's edit and add flows. */
    if (configuredUnits.has(unit.toLowerCase())) {
      const existingTier = activeTiers.find(
        (t) => t.unit.toLowerCase() === unit.toLowerCase(),
      );
      // Close the add-row editor before opening the modal.
      setAddTierMode(false);
      setAddTierUnit("");
      setAddTierPrice("");
      // Same price → nothing to warn about; noop.
      if (existingTier && Math.abs(existingTier.price - price) < 0.005) return;
      /* Every explicit check-click prompts — the buyer has to pick
         between pushing to the qualified vendor and applying only
         to this PO, even for $0. */
      const outcome: PriceCheckOutcome = existingTier && existingTier.price > 0
        ? {
            kind: "update-default",
            vendorName: activeVendor,
            unit,
            enteredPrice: price,
            existingDefaultPrice: existingTier.price,
          }
        : { kind: "save-as-default", vendorName: activeVendor, unit, enteredPrice: price };
      setPriceConfirmState({
        open: true,
        outcome,
        onConfirmDefault: () => {
          upsertVendorUnitPrice(item.id, activeVendor, unit, price, { conversionFactor: factor });
          setVendorOffers((prev) =>
            prev.map((o) => {
              if (o.vendorName !== activeVendor) return o;
              const nextTiers = (o.unitPrices ?? []).map((t) =>
                t.unit.toLowerCase() === unit.toLowerCase()
                  ? { ...t, price, conversionFactor: factor }
                  : t,
              );
              return { ...o, unitPrices: nextTiers };
            }),
          );
          const activeUnitNow = vendorUnitOverride || item.vendorUOM;
          if (unit === activeUnitNow) setActiveUnitPrice(bookToFlow(price));
          toast.success("Qualified vendor updated", {
            description: `${activeVendor} · ${formatMoney(price, bookCurrency)} / ${unit}`,
            style: { fontFamily: FONT }, duration: 2400,
          });
        },
        onUseOnce: () => {
          /* Apply locally so this PO reflects the entered price;
             qualified vendor's saved tier is left untouched. */
          setVendorOffers((prev) =>
            prev.map((o) => {
              if (o.vendorName !== activeVendor) return o;
              const nextTiers = (o.unitPrices ?? []).map((t) =>
                t.unit.toLowerCase() === unit.toLowerCase()
                  ? { ...t, price, conversionFactor: factor }
                  : t,
              );
              return { ...o, unitPrices: nextTiers };
            }),
          );
          const activeUnitNow = vendorUnitOverride || item.vendorUOM;
          if (unit === activeUnitNow) setActiveUnitPrice(bookToFlow(price));
          toast.message(`${formatMoney(price, bookCurrency)} / ${unit} applied to this PO`, {
            description: "Qualified vendor left unchanged",
            style: { fontFamily: FONT }, duration: 2400,
          });
        },
      });
      return;
    }

    // Add the tier to the local PO offers (always — needed to price this PO).
    // If somehow the same unit is added twice (stale `configuredUnits`,
    // race between commit + re-render, legacy data), update the existing
    // row in place instead of appending a second one.
    // `poOnly` tags a tier that was added via "Use for this PO only"
    // (not persisted to the qualified vendor's master price book) —
    // surfaces as a "PO only" badge on the tier row and the Vendor
    // Stocking Unit dropdown so buyers know it's ad-hoc for this PO.
    const addLocal = (opts?: { poOnly?: boolean }) => {
      const poOnly = opts?.poOnly ?? false;
      const unitKey = unit.trim().toLowerCase();
      setVendorOffers((prev) =>
        prev.map((o) => {
          if (o.vendorName !== activeVendor) return o;
          const existing = (o.unitPrices ?? []).find(
            (t) => t.unit.trim().toLowerCase() === unitKey,
          );
          const nextTiers = existing
            ? (o.unitPrices ?? []).map((t) =>
                t.unit.trim().toLowerCase() === unitKey
                  ? {
                      ...t,
                      price,
                      conversionFactor: factor,
                      /* If the buyer explicitly says "save to qualified vendor"
                         (poOnly=false) on an existing PO-only tier, promote it
                         out of PO-only status. Otherwise leave the flag as it
                         was on the existing tier. */
                      ...(poOnly === false ? { poOnly: false } : {}),
                    }
                  : t,
              )
            : [
                ...(o.unitPrices ?? []),
                { unit, price, isDefault: false, conversionFactor: factor, poOnly },
              ];
          return { ...o, unitPrices: nextTiers };
        }),
      );
      // Keep the headline in sync if the new tier is the active unit.
      const activeUnitNow = vendorUnitOverride || item.vendorUOM;
      if (unit === activeUnitNow) setActiveUnitPrice(bookToFlow(price));
    };
    // Persist the tier to the vendor's master price book.
    const saveToMaster = () => {
      upsertVendorUnitPrice(item.id, activeVendor, unit, price, { conversionFactor: factor });
    };

    // Close the add-row editor now (no onBlur commit, so this can't re-fire).
    setAddTierMode(false);
    setAddTierUnit("");
    setAddTierPrice("");

    /* Every explicit check-click prompts. Even $0 / blank routes
       through the "Save for qualified vendor vs this PO only" choice
       so the buyer never adds a tier without seeing where it lands. */
    const outcome: PriceCheckOutcome = {
      kind: "save-as-default",
      vendorName: activeVendor,
      unit,
      enteredPrice: price,
    };
    setPriceConfirmState({
      open: true,
      outcome,
      variant: "add",
      onConfirmDefault: () => {
        saveToMaster();
        addLocal({ poOnly: false });
        toast.success(`${unit} added to ${activeVendor}`, {
          description: `${formatMoney(price, bookCurrency)} / ${unit}`,
          style: { fontFamily: FONT }, duration: 2000,
        });
      },
      onUseOnce: () => {
        addLocal({ poOnly: true });
        toast.message(`${unit} added for this PO only`, {
          description: "Qualified vendor left unchanged",
          style: { fontFamily: FONT }, duration: 2000,
        });
      },
    });
  };

  // For vendor-assigned items: always unlocked. For no-vendor items: check assigned vendor price.
  const activeAssigned = assignedVendors.find(v => v.vendorName === activeVendor);
  const activePriceState = activeVendor ? vendorPriceMap[activeVendor] : undefined;
  const hasActivePrice = hasOriginalVendor
    ? activeUnitPrice > 0
    : ((activePriceState?.priceConfirmed && activePriceState.price > 0) || (activeAssigned?.priceConfirmed && activeAssigned.price > 0));

  /** Apply the vendor swap unconditionally — bypasses the "new PO"
      warning. Used both directly (non-PO modes) and by the warning
      confirm handler. */
  const applyVendorOfferOriginal = (offer: ItemVendorOffer) => {
    setActiveVendor(offer.vendorName);
    setActiveUnitPrice(bookToFlow(offer.unitPrice, offer.vendorName, offer.currency));
    setActiveDiscount(offer.discount);
    setVendorContacts(getVendorContacts(offer.vendorName));
    setShipmentMethod(getDefaultShipping({ ...item, partnerLocation: offer.vendorName }).shipmentMethod);
  };

  /** Handle vendor switch for VENDOR-ASSIGNED items (original flow).
      When the modal is editing an existing PO's line and the buyer
      picks a DIFFERENT vendor from the PO's original vendor, warn
      that this will spawn a new PO (POs are single-vendor). */
  const handleSelectVendorOfferOriginal = (offer: ItemVendorOffer) => {
    if (
      originalPOVendorRef.current &&
      offer.vendorName !== originalPOVendorRef.current &&
      offer.vendorName !== activeVendor
    ) {
      setVendorSwapPrompt({ offer, variant: "original" });
      return;
    }
    applyVendorOfferOriginal(offer);
  };

  /** Called from VendorSelector dropdown for no-vendor items */
  const handleSelectVendorOffer = (offer: ItemVendorOffer, sourceVendorName?: string, bypassPOWarning = false) => {
    /* Same new-PO warning as the vendor-assigned path — if the buyer
       swaps to a vendor other than the PO's original, we need to spawn
       a new PO. Applies to both same-vendor-picker and additional-
       vendor-picker entry points. Bypassed when the warning has
       already been confirmed. */
    if (
      !bypassPOWarning &&
      originalPOVendorRef.current &&
      offer.vendorName !== originalPOVendorRef.current &&
      offer.vendorName !== activeVendor
    ) {
      setVendorSwapPrompt({ offer, variant: "additional", sourceVendorName });
      return;
    }
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

  /**
   * Apply a price to local PO state — does NOT touch the master record.
   * Used both directly (when price matches master / is $0) and as the
   * "use for this PO only" branch of the confirmation prompt.
   */
  const applyVendorPriceLocal = (vendorName: string, price: number, uom?: string) => {
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

  /**
   * Entry point for "Confirm" / Enter on a price input.
   * Classifies the entered price against the master record and either:
   *   - prompts the user (scenario A or B), or
   *   - applies silently (matching default / $0 / blank).
   */
  const confirmVendorPrice = (vendorName: string, price: number, uom?: string) => {
    const savedUnit = uom || getVendorPrice(vendorName)?.unit || item.vendorUOM;
    // $0 / blank → silent. Zero-dollar POs are first-class.
    if (!Number.isFinite(price) || price <= 0) {
      applyVendorPriceLocal(vendorName, price, savedUnit);
      return;
    }
    const masterTier = getVendorUnitPrice(item.id, vendorName, savedUnit);
    const outcome = classifyPriceChange({
      vendorName,
      unit: savedUnit,
      enteredPrice: price,
      existingMasterPrice: masterTier?.price,
    });

    if (outcome.kind === "silent") {
      applyVendorPriceLocal(vendorName, price, savedUnit);
      return;
    }

    setPriceConfirmState({
      open: true,
      outcome,
      onConfirmDefault: () => {
        upsertVendorUnitPrice(item.id, vendorName, savedUnit, price, {
          markAsDefault: !masterTier || masterTier.isDefault,
        });
        applyVendorPriceLocal(vendorName, price, savedUnit);
        toast.success("Default price updated", {
          description: `${vendorName} · ${formatMoney(price, vendorCurrency(vendorName))} / ${savedUnit}`,
          style: { fontFamily: FONT }, duration: 2400,
        });
      },
      onUseOnce: () => {
        applyVendorPriceLocal(vendorName, price, savedUnit);
        toast.message("Price used on this PO only", {
          description: "Master record left unchanged",
          style: { fontFamily: FONT }, duration: 2400,
        });
      },
    });
  };

  /* ── Tier-table warning flows ──
     Wrap the raw remove-tier / set-as-default writes so both
     prompt the buyer via the shared amber warning modal first.
     The actual mutation is deferred until the primary CTA fires,
     so cancelling leaves the master untouched. */
  const requestRemoveTier = (unit: string) => {
    if (!activeVendor || !activeOffer) return;
    const tier = findUnitPrice(activeOffer, unit);
    if (!tier) return;
    const tiers = activeOffer.unitPrices ?? [];
    const isDefault = tier.isDefault === true;
    const fallback = isDefault ? tiers.find((t) => t.unit !== unit) : undefined;
    const copy = removePriceCopy({
      vendorName: activeVendor,
      unit,
      price: tier.price,
      isDefault,
      fallbackUnit: fallback?.unit,
      currency: bookCurrency,
    });
    const applyLocalRemove = () => {
      setVendorOffers((prev) =>
        prev.map((o) => {
          if (o.vendorName !== activeVendor) return o;
          const nextTiers = (o.unitPrices ?? []).filter((t) => t.unit !== unit);
          if (nextTiers.length > 0 && !nextTiers.some((t) => t.isDefault)) {
            nextTiers[0].isDefault = true;
          }
          return { ...o, unitPrices: nextTiers };
        }),
      );
    };
    setTierWarning({
      open: true,
      chipLabel: copy.chipLabel,
      title: copy.title,
      description: copy.description,
      primaryLabel: copy.primaryLabel,
      secondaryLabel: copy.secondaryLabel,
      tone: copy.tone,
      onPrimary: () => {
        removeVendorUnitPrice(item.id, activeVendor, unit);
        applyLocalRemove();
        toast.message(`${unit} removed`, {
          style: { fontFamily: FONT },
          duration: 1800,
        });
      },
      /* Cancel — leave both the qualified vendor and this PO
         untouched. Modal-shell dismiss handles the close. */
      onSecondary: () => {},
    });
  };

  const requestSetDefault = (unit: string) => {
    if (!activeVendor || !activeOffer) return;
    const tier = findUnitPrice(activeOffer, unit);
    if (!tier) return;
    const currentDefault = (activeOffer.unitPrices ?? []).find(
      (t) => t.isDefault,
    );
    // No-op: user picked the current default. Silently ignore.
    if (currentDefault && currentDefault.unit === unit) return;
    const copy = changeDefaultCopy({
      vendorName: activeVendor,
      oldUnit: currentDefault?.unit ?? "—",
      oldPrice: currentDefault?.price ?? 0,
      newUnit: unit,
      newPrice: tier.price,
      currency: bookCurrency,
    });
    /* When the buyer promotes the tier to the master price book
       ("Update Qualified Vendor & Use Here"), the tier is no longer
       PO-only — clear its `poOnly` flag so the amber chip goes away in
       both the pricing table AND the Vendor Selling Unit dropdown.
       When they pick "Use on This PO Only" the master stays untouched,
       so `poOnly` remains as-is. */
    const applyLocalSetDefault = (opts?: { promoteToMaster?: boolean }) => {
      const promote = opts?.promoteToMaster ?? false;
      setVendorOffers((prev) =>
        prev.map((o) => {
          if (o.vendorName !== activeVendor) return o;
          const nextTiers = (o.unitPrices ?? []).map((t) =>
            t.unit === unit
              ? {
                  ...t,
                  isDefault: true,
                  ...(promote ? { poOnly: false } : {}),
                }
              : { ...t, isDefault: false },
          );
          return {
            ...o,
            unitPrices: nextTiers,
            uom: unit,
            unitPrice: tier.price,
          };
        }),
      );
      /* Sync the headline "$X / UOM" area — it reads from
         `activeUnitPrice` and `vendorUnitOverride || item.vendorUOM`,
         so setting a new default has to flip both. Without this the
         table row shows the new default but the headline keeps the
         old unit/price until the buyer manually switches UOMs. */
      setVendorUnitOverride(unit);
      setActiveUnitPrice(bookToFlow(tier.price));
    };
    setTierWarning({
      open: true,
      chipLabel: copy.chipLabel,
      title: copy.title,
      description: copy.description,
      primaryLabel: copy.primaryLabel,
      secondaryLabel: copy.secondaryLabel,
      tone: copy.tone,
      onPrimary: () => {
        upsertVendorUnitPrice(item.id, activeVendor, unit, tier.price, {
          markAsDefault: true,
        });
        applyLocalSetDefault({ promoteToMaster: true });
        toast.success(`${unit} set as default`, {
          style: { fontFamily: FONT },
          duration: 1800,
        });
      },
      onSecondary: () => {
        applyLocalSetDefault();
        toast.success(`${unit} set as default on this PO`, {
          description: "Qualified vendor left unchanged",
          style: { fontFamily: FONT },
          duration: 2400,
        });
      },
    });
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

  /** Open the vendor pricing modal for the active vendor — the single
   *  entry point for adding or editing unit prices (no inline editing).
   *  An active vendor that isn't on the item's master record yet (picked
   *  from the system list on a no-vendor item) opens in qualify mode. */
  const openVendorPricing = (opts: { appendUnit?: string | true; focusUnit?: string; selectUnitOnSave?: string } = {}) => {
    if (!activeVendor || !activeOffer) return;
    const onMaster = !!getVendorOffersForItem(item.id).find((o) => o.vendorName === activeVendor);
    setPricingModal({
      mode: onMaster ? "edit" : "qualify",
      offer: { ...activeOffer, unitPrices: activeTiers },
      isNewVendor: false,
      // Qualified vendor → one card only (the unit being edited, or the
      // new unit being added). Qualifying a vendor keeps the full set.
      single: onMaster && (!!opts.appendUnit || !!opts.focusUnit),
      ...opts,
    });
  };

  /**
   * Change the active UOM. If the vendor already has a tier for the
   * new unit, auto-populate the price; otherwise clear the price so
   * the existing inline "Enter unit price for this vendor" editor
   * appears (the same flow the buyer is used to).
   *
   * Important: clearing the price to 0 normally also locks the qty
   * input via `priceConfirmed`. We compensate below with
   * `isPickingPriceForNewUnit` so the buyer can keep typing the qty
   * while they enter the new tier's price.
   */
  const changeActiveUnit = (nextUnit: string) => {
    if (activeOffer && !findUnitPrice(activeOffer, nextUnit)) {
      /* No price for the picked unit yet → add it through the vendor
         pricing modal. The line only switches to the unit once it's
         priced (Cancel leaves the line on its current unit). */
      openVendorPricing({ appendUnit: nextUnit, selectUnitOnSave: nextUnit });
      return;
    }
    setVendorUnitOverride(nextUnit);
    if (!activeOffer) return;
    const match = findUnitPrice(activeOffer, nextUnit);
    if (match) {
      setActiveUnitPrice(bookToFlow(match.price));
    } else {
      setActiveUnitPrice(0);
      /* No price configured for the picked unit yet → auto-open the
         multi-unit price table with the add-row pre-filled to the
         picked unit. Replaces the old "$0.00 per Unit Confirm" inline
         editor with the same flow the buyer uses elsewhere to add a
         new (unit, price) pair. */
      setMultiUnitExpanded(true);
      setAddTierMode(true);
      setAddTierUnit(nextUnit);
      setAddTierPrice("");
    }
  };
  const subtotal = effectivePrice * defaultQty;
  const discountAmount = subtotal * (effectiveDiscount / 100);
  /* Pricing rules — ported from Sales-Order-V5 (see
     purchase order snapshots/PO_PRICING_RULES_PORT_AUDIT.md).
     Computed as a plain expression (not useMemo) because the surrounding
     component has an `if (!item) return null;` early return above; a
     hook here would break the hooks-order invariant. The computation
     is cheap (one vendor + one line), so recomputing per render is
     fine. Rules are all-active by default for an add-flow (no
     per-line deactivation until a PO draft is opened). */
  const vendorRulesForLine = SHOW_PO_PRICING_RULES && item.partnerLocation
    ? getVendorRules(item.partnerLocation).filter((r) => r.appliesToItemCodes.includes(item.itemNumber))
    : [];
  const rulesBreakdown: LinePricingBreakdown | null = (() => {
    if (!SHOW_PO_PRICING_RULES || !item.partnerLocation) return null;
    const vendorRules = getVendorRules(item.partnerLocation);
    if (vendorRules.length === 0) return null;
    const netPPU = effectivePrice * (1 - effectiveDiscount / 100);
    /* Seed only rules the buyer hasn't manually deactivated on this
       line (buyer 2026-07-22 — SO Pricing Rules per-line Switch). */
    const seededActivation = new Map<string, Set<string>>();
    for (const r of vendorRules) {
      if (r.appliesToItemCodes.includes(item.itemNumber) && !deactivatedRuleIds.has(r.id)) {
        seededActivation.set(r.id, new Set(["orderflow-line"]));
      }
    }
    const [entry] = computeLineBreakdowns(
      [
        {
          id: "orderflow-line",
          itemCode: item.itemNumber,
          orderedQty: defaultQty,
          unitPrice: netPPU,
        },
      ],
      vendorRules,
      seededActivation,
      // Flat rule amounts (USD) in the line's currency, at the PO's or today's rate.
      linkedFx ? ruleAmountFactor(linkedFx) : ruleAmountFactorToday(flowCurrency),
    );
    return entry ?? null;
  })();
  const rulesDiscountAmount = rulesBreakdown?.discountAmount ?? 0;
  const rulesPremiumAmount = rulesBreakdown?.premiumAmount ?? 0;
  /* One-time item-level adjustments — measured against qty × net PPU
     (same base as pricing rules), added on top. */
  const oneTimeBase = subtotal - discountAmount;
  const oneTimeNet = lineOneTimeNet(oneTimeAdjustments, oneTimeBase).net;
  const totalPrice = subtotal - discountAmount - rulesDiscountAmount + rulesPremiumAmount + oneTimeNet;
  const priceConfirmed = !isUnassigned && hasActivePrice;
  /* When the buyer is on a vendor-assigned item and has switched the
     line UOM to one that doesn't have a tier yet, the inline "Enter
     unit price" editor appears below — but we DO NOT want to lock the
     qty input while they're entering it. The buyer is just changing
     the unit, not starting over.
     The action buttons still wait on `canSubmit` (which requires
     `priceConfirmed`), so nothing illegal can be submitted. */
  const isPickingPriceForNewUnit =
    !isUnassigned && !!vendorUnitOverride && !hasActivePrice;
  /** Qty inputs (and visual highlight) treat the form as "in progress"
   *  when the buyer has confirmed-or-is-confirming a price. */
  const qtyEditable = priceConfirmed || isPickingPriceForNewUnit;
  /* F19 (2026-07-29 rebuild): shipping carrier, method, and inbound
     location remain optional. Delivery-dates model flipped: Expected
     Delivery Date is now the required primary field; Ship By and
     Promise Ship are both optional. */
  /* Non-qualified vendor block: `activeOffer` is undefined when the current
     active vendor has no priced offer for this item — i.e. isn't qualified
     for the item. Only enforce when the buyer actually picked a vendor. */
  const blockedByNonQualifiedVendor =
    !canNonQualifiedVendor && !!activeVendor && !activeOffer;
  const canSubmit =
    priceConfirmed &&
    vendorQty > 0 &&
    expectedDeliveryDate &&
    canCreateEditPO &&
    !blockedByNonQualifiedVendor;
  const submitDisabledTitle = !canCreateEditPO
    ? permissionReason("po.create_edit")
    : blockedByNonQualifiedVendor
    ? permissionReason("po.non_qualified_vendors")
    : undefined;



  const handleComplete = (actionMode: "add-to-cart" | "buy-now") => {
    const contact = vendorContacts[0];
    const effectiveItem: OrderFlowItem = { ...item, unitPrice: effectivePrice, discount: effectiveDiscount, partnerLocation: activeVendor || item.partnerLocation };
    onComplete({
      item: effectiveItem,
      quantity: defaultQty,
      vendorQty,
      shipmentMethod,
      needByDate,
      promisedShipDate: promisedShipDate || undefined,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      inboundLocation,
      vendorContactName: contact?.name || "",
      vendorContactEmail: contact?.email || "",
      vendorContactPhone: contact?.phone || "",
      vendorContactRole: contact?.role || "",
      notes,
      totalPrice,
      unitPrice: effectivePrice,
      discount: effectiveDiscount,
      completedMode: actionMode,
      oneTimeAdjustments,
      currency: flowCurrency,
    });
    onOpenChange(false);
  };

  // UOM_OPTIONS was retired — the qty-card UOM picker now uses
  // `<UnitCombobox>` sourcing from the global registry, filtered by
  // the item's dimension.
  const activeContact = vendorContacts[0];

  /* ═══════════════════════════════════════════════════════════════
     RENDER — 2 COLUMN: left = item + ordering, right = tabbed details
     ═══════════════════════════════════════════════════════════════ */

  const TABS = [
    { key: "shipping", label: "Shipping & Delivery", icon: Truck },
    /* Pricing Rules tab — always shown when the feature flag is on
       AND the item has a vendor context (buyer 2026-07-22: "pricing
       rules needs to be available in every items detail modal").
       The tab renders an empty state when no rules match this
       vendor+item, with a Manage-rules affordance so the buyer can
       attach one. Count badge only shows when there are matching
       rules. */
    ...(SHOW_PO_PRICING_RULES && item.partnerLocation
      ? [{
          key: "pricing-rules" as const,
          label: "Pricing Rules",
          icon: BadgePercent,
          count: vendorRulesForLine.length > 0 ? vendorRulesForLine.length : undefined,
        }]
      : []),
    { key: "warnings", label: "PO Warnings", icon: AlertTriangle, count: inputWarnings.length },
    { key: "inventory", label: "Inventory", icon: Boxes },
    ...(renderNotesTab ? [{ key: "notes" as const, label: "Notes", icon: MessageSquare, count: notesCount }] : []),
    { key: "attachments", label: "Attachments", icon: Paperclip, count: poAttachmentIds.size },
  ];

  return (
    <DocCurrencyProvider currency={flowCurrency} fx={flowFx} dateLabel={linkedFx ? "PO date" : "today"} role={linkedFx ? "PO currency" : "vendor currency"}>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        /* Sizing recipe — verbatim port of Partners' canonical
           CONTENT-HEAVY modal recipe (`Partners/.../PaymentTermDetailModal.tsx:329`).
           Shared with `CatalogueModal.tsx` so both PO creation surfaces
           share identical responsive footprints on 1080p, 2K, 4K, and
           ultra-wide.
           Key choices that match Partners 1:1:
           - Width cap `min(70vw, 1480px)` — content-heavy ladder, wider
             than the 1320px single-screen-form cap.
           - **Height cap `min(88vh, 1180px)`** — caps the modal at
             1180px even on 2K/4K. Without the `1180px` ceiling the
             modal would grow with the viewport (1267px on 2K, 1900px
             on 4K) and look stretched. This gives Partners' canonical
             "fixed modal height on big screens" feel.
           - Min height `640px` so empty / short-content states still
             read substantial.
           - Smooth resize transition `transition-[max-width,max-height,
             border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]`. */
        className="flex flex-col p-0 gap-0 overflow-hidden border-0 sm:border [&>[data-slot=dialog-close]]:hidden [&>button.absolute]:hidden !fixed !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !w-[calc(100%-2rem)] transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] !max-w-[100%] sm:!max-w-[min(70vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl"
        style={{
          fontFamily: FONT,
          backgroundColor: "hsl(var(--background))",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
        aria-describedby={undefined}
        /* Radix listens for Escape at document capture phase via its
           DismissableLayer (`useEscapeKeydown`), so a React onKeyDown
           on the input can't stop it from closing the dialog. Intercept
           here: if there's an inline tier-edit in progress, treat
           Escape as "cancel that edit" instead of "close the dialog". */
        onEscapeKeyDown={(event) => {
          // Qualify Vendor modal handles its own Escape (discard prompt).
          if (pricingModal) {
            event.preventDefault();
            return;
          }
          if (editTierUnit !== null) {
            event.preventDefault();
            cancelTierEdit();
          }
        }}
        /* Guard the Dialog from closing when the user interacts with a
           nested popover that lives OUTSIDE this Dialog's DOM subtree —
           the VendorSelector details popover (vendor location + POC)
           is mounted via `createPortal(document.body)` for correct
           positioning. Without this guard Radix's outside-click sees
           the click as "outside the Dialog" and closes the whole
           modal, which broke location selection. Sentinel is the
           `data-vendor-detail-popover` attribute set in VendorSelector.
           Note: Radix passes a `CustomEvent` whose `event.target` is
           the Radix element, NOT the click target — the real target
           lives on `event.detail.originalEvent.target`. */
        onInteractOutside={(event) => {
          const detail = (event as CustomEvent<{ originalEvent?: Event }>).detail;
          const originalTarget = (detail?.originalEvent?.target ?? event.target) as
            | HTMLElement
            | null;
          if (originalTarget?.closest?.("[data-vendor-detail-popover], [data-nested-modal]")) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          const detail = (event as unknown as {
            detail?: { originalEvent?: Event };
          }).detail;
          const originalTarget = (detail?.originalEvent?.target ?? event.target) as
            | HTMLElement
            | null;
          if (originalTarget?.closest?.("[data-vendor-detail-popover], [data-nested-modal]")) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          const detail = (event as unknown as {
            detail?: { originalEvent?: Event };
          }).detail;
          const originalTarget = (detail?.originalEvent?.target ?? event.target) as
            | HTMLElement
            | null;
          if (originalTarget?.closest?.("[data-vendor-detail-popover], [data-nested-modal]")) {
            event.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">Item Detail</DialogTitle>

        {/* ── Top bar with close ── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground" style={S.small}>
              {demandContext ? "Create PO from Demand" : mode === "add-to-po" ? "Add Item to Purchase Order" : "Item Detail"}
            </span>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)] border border-border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-all"
          >
            <X className="size-3.5" />
            <span style={S.small}>Close</span>
          </button>
        </div>

        {/* ── Demand consolidation banner ──
            Shown when launched from the Demands page. For multi-source flows it
            says "Consolidating N sources..."; for single-source flows it tells
            the buyer exactly which SO / Request / Low-stock item this PO is for. */}
        {demandContext && demandContext.sources.length > 0 && (
          <div
            className="shrink-0 px-4 py-2.5 flex items-center gap-3 flex-wrap"
            style={{
              borderBottom: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--primary-tint))",
            }}
          >
            <div
              className="flex items-center justify-center w-7 h-7 rounded-md shrink-0"
              style={{ backgroundColor: "rgba(10,119,255,0.12)" }}
            >
              <Layers className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              {demandContext.sources.length === 1 ? (
                (() => {
                  const s = demandContext.sources[0];
                  const label =
                    s.kind === "SO"
                      ? `Sales Order ${s.reference}`
                      : s.kind === "Request"
                      ? `Request from ${s.reference}`
                      : "Low-stock replenishment";
                  return (
                    <>
                      <span style={{ ...S.bodySemi, color: "#0F172A" }}>
                        Creating PO for {label}
                      </span>
                      <span style={{ ...S.small, color: "#475569" }}>
                        Required: <strong style={{ color: "#0A77FF" }}>{demandContext.totalQty} {demandContext.uom}</strong>
                        {s.dueDate ? <> · Need by <strong style={{ color: "#334155" }}>{s.dueDate}</strong></> : null}
                        {s.reason && !s.dueDate ? <> · &ldquo;{s.reason}&rdquo;</> : null}
                      </span>
                    </>
                  );
                })()
              ) : (
                <>
                  <span style={{ ...S.bodySemi, color: "#0F172A" }}>
                    Consolidating {demandContext.sources.length} demand sources into a single PO
                  </span>
                  <span style={{ ...S.small, color: "#475569" }}>
                    Total required: <strong style={{ color: "#0A77FF" }}>{demandContext.totalQty} {demandContext.uom}</strong>
                    {" · "}
                    {(() => {
                      const so = demandContext.sources.filter((s) => s.kind === "SO").length;
                      const rq = demandContext.sources.filter((s) => s.kind === "Request").length;
                      const ls = demandContext.sources.filter((s) => s.kind === "LowStock").length;
                      const parts = [
                        so > 0 ? `${so} SO` : null,
                        rq > 0 ? `${rq} Request${rq === 1 ? "" : "s"}` : null,
                        ls > 0 ? "Low Stock" : null,
                      ].filter(Boolean);
                      return parts.join(" · ");
                    })()}
                  </span>
                </>
              )}
            </div>
            {demandContext.sources.length > 1 && (
              <DemandSourcesPopover sources={demandContext.sources} uom={demandContext.uom} />
            )}
          </div>
        )}

        {/* ═══════ TWO‑COLUMN BODY ═══════ */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

          {/* ─────── LEFT COLUMN — item card + ordering details ─────── */}
          <div className="md:w-[400px] md:min-w-[400px] md:max-w-[400px] flex flex-col min-h-0 border-r border-border" style={{ backgroundColor: "hsl(var(--card))" }}>

            {/* ── Item header card ── */}
            <div className="shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
              <div className="flex gap-3.5">
                <div className="shrink-0 rounded-[var(--radius)] overflow-hidden border border-border" style={{ width: "64px", height: "64px", backgroundColor: "hsl(var(--secondary))" }}>
                  <ImageWithFallback src={item.image} alt={item.descriptiveName} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Part number — foreground, not blue */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-foreground" style={S.partNum}>{item.itemNumber}</span>
                    {/* Item-master record status — shared chip (Quick View / PO line / here). */}
                    <ItemStatusChip inactive={item.inactive} size="sm" />
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-[var(--radius)]" style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", ...S.badge }}>
                      <Tag className="size-2.5" />{item.category}
                    </span>
                  </div>
                  {/* Item name — up to 3 lines */}
                  <TruncatedItemName name={item.descriptiveName} maxChars={60} style={{ ...S.itemName }} className="text-foreground mb-1.5" />
                  {/* Meta pills — all grey */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full"
                      style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))", ...S.badge }}>
                      <Hash className="size-2.5" />{serialized ? "Serialized" : "Non-Serialized"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full"
                      style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))", ...S.badge }}>
                      {purchased ? <ShoppingCart className="size-2.5" /> : <Wrench className="size-2.5" />}
                      {purchased ? "Purchased" : "Manufactured"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Alert strips removed — "Below min" and "Shortage" tags no longer shown */}
            </div>

            {/* ── Scrollable ordering area ── */}
            <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}>

              {/* Vendor Section */}
              <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
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
                    selectedLocationByVendor={selectedLocByVendor}
                    onLocationChange={handleLocationChangeInFlow}
                    isLocationQualified={isLocationQualifiedForItem}
                    onLocationNeedsQualification={handleLocationNeedsQualification}
                  />
                ) : isUnassigned ? (
                  /* ── NO VENDOR — Empty state: vendor card shell ── */
                  <Popover open={emptyVendorPickerOpen} onOpenChange={setEmptyVendorPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="flex items-center gap-2.5 w-full p-3 rounded-[var(--radius-md)] border border-dashed border-border hover:border-primary/30 hover:bg-primary/[0.03] transition-all cursor-pointer text-left group"
                        style={{ backgroundColor: "hsl(var(--card))" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center size-9 rounded-full shrink-0" style={{ backgroundColor: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
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
                      style={{ fontFamily: FONT, backgroundColor: "hsl(var(--card))" }}
                      align="start"
                      sideOffset={8}
                    >
                      <VendorSelectorContent
                        offers={noVendorDropdownOffers}
                        selectedVendor={activeVendor}
                        onSelect={handleSelectVendorOffer}
                        assignedVendors={assignedVendors.map(v => v.vendorName)}
                        onAddNewVendor={() => { setEmptyVendorPickerOpen(false); setAddNewVendorOpen(true); }}
                        selectedLocationByVendor={selectedLocByVendor}
                        onLocationChange={handleLocationChangeInFlow}
                        isLocationQualified={isLocationQualifiedForItem}
                        onLocationNeedsQualification={(vendor, location) => {
                          setEmptyVendorPickerOpen(false);
                          handleLocationNeedsQualification(vendor, location);
                        }}
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
                          style={{ backgroundColor: "hsl(var(--card))" }}
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
                                  <span className="text-primary" style={{ ...S.small, fontWeight: "var(--font-weight-semibold)" }}>{formatMoney(cardPrice, vendorCurrency(av.vendorName))} / {item.vendorUOM}</span>
                                ) : (
                                  <span className="text-muted-foreground" style={S.small}>Price not set</span>
                                )}
                              </div>
                              {(() => {
                                const offer = vendorOffers.find((o) => o.vendorName === av.vendorName);
                                const picked = selectedLocByVendor[av.vendorName];
                                const loc = picked === "__direct__"
                                  ? null
                                  : offer?.locations.find((l) => l.name === picked)
                                    ?? offer?.locations.find((l) => l.isDefault)
                                    ?? offer?.locations[0];
                                if (!offer || (!loc && picked !== "__direct__")) return null;
                                return (
                                  <div className="flex items-center gap-1 mt-0.5 text-muted-foreground min-w-0" style={S.small}>
                                    <MapPin className="size-3 shrink-0" />
                                    <span className="truncate">{loc ? loc.name : "Direct to vendor"}</span>
                                  </div>
                                );
                              })()}
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
                            <div className="px-3 pb-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
                              <div className="flex items-center gap-1.5 pt-2 text-muted-foreground" style={S.small}>
                                <User className="size-3 shrink-0" />{contact.name} <span style={{ color: "hsl(var(--border))" }}>·</span> <span style={S.tiny}>{contact.role}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );

                      return (
                        <Popover
                          key={av.vendorName}
                          open={assignedPickerOpenFor === av.vendorName}
                          onOpenChange={(o) => setAssignedPickerOpenFor(o ? av.vendorName : null)}
                        >
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
                            style={{ fontFamily: FONT, backgroundColor: "hsl(var(--card))" }}
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
                              selectedLocationByVendor={selectedLocByVendor}
                              onLocationChange={handleLocationChangeInFlow}
                              isLocationQualified={isLocationQualifiedForItem}
                              onLocationNeedsQualification={(vendor, location) => {
                                setAssignedPickerOpenFor(null);
                                handleLocationNeedsQualification(vendor, location);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Unit Price */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground" style={S.fieldLabel}>Unit Price</span>
                  {/* Multi-unit toggle — only shown when there's a real default to start from.
                      Chevron added so the disclosure affordance is obvious; rotates 180° when
                      open. Sits inside a translucent pill so it reads as a tap target rather
                      than a stray inline link. */}
                  {hasOriginalVendor && activeUnitPrice > 0 && activeOffer && (
                    <button
                      type="button"
                      onClick={() => {
                        // Single unit → nothing to show yet; go straight
                        // to adding one in the pricing modal.
                        if (activeTiers.length <= 1) { openVendorPricing({ appendUnit: true }); return; }
                        setMultiUnitExpanded((v) => !v);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-[#0A77FF] bg-[#0A77FF]/8 hover:bg-[#0A77FF]/12 transition-colors cursor-pointer"
                      style={{ fontFamily: FONT, fontWeight: 500 }}
                      aria-expanded={multiUnitExpanded}
                      title={multiUnitExpanded ? "Hide unit prices" : "Show other unit prices"}
                    >
                      <span>
                        {multiUnitExpanded
                          ? "Hide unit prices"
                          : activeTiers.length > 1
                            ? `+ ${activeTiers.length - 1} other unit${activeTiers.length - 1 > 1 ? "s" : ""}`
                            : "+ Add price for other units"}
                      </span>
                      <ChevronDown
                        className="w-3 h-3 transition-transform duration-200"
                        style={{ transform: multiUnitExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                      />
                    </button>
                  )}
                </div>
                {hasOriginalVendor && activeUnitPrice > 0 ? (
                  <>
                    {/* Inline edit on the headline price. When the user clicks
                        the pencil, the price text is replaced by an inline
                        input (mirroring MultiUnitPriceTable's row edit), so
                        the buyer can correct the price without first
                        expanding the +N other units table.
                        Shares `editTierUnit` / `tierDraftPrice` state with
                        the table, so opening edit here and then expanding
                        the table shows the same row in the same edit mode. */}
                    {editTierUnit === item.vendorUOM ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="flex items-center rounded-md border border-[#0A77FF]/40 bg-white overflow-hidden">
                          <span className="pl-2 text-[#94A3B8]" style={{ fontSize: 14, fontFamily: FONT }}>{moneyPrefix(bookCurrency).trim()}</span>
                          <input
                            type="number"
                            min={0}
                            step={10 ** -currencyDecimals(bookCurrency)}
                            value={tierDraftPrice}
                            autoFocus
                            onChange={(e) => setTierDraftPrice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                commitTierEdit(item.vendorUOM);
                              }
                              if (e.key === "Escape") {
                                /* Stop propagation at both React and native
                                   layers so Radix's DismissableLayer doesn't
                                   ALSO catch the Escape and close the
                                   surrounding dialog. */
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                cancelTierEdit();
                              }
                            }}
                            className="h-8 w-[88px] px-1 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            style={{ ...S.priceSm, color: "#0F172A" }}
                            placeholder="0.00"
                          />
                        </div>
                        <span className="text-muted-foreground" style={S.small}>/ {item.vendorUOM}</span>
                        <button
                          type="button"
                          onClick={() => commitTierEdit(item.vendorUOM)}
                          className="w-7 h-7 rounded inline-flex items-center justify-center text-white cursor-pointer"
                          style={{ background: "#0A77FF" }}
                          title="Save price"
                          aria-label="Save price"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelTierEdit}
                          className="w-7 h-7 rounded inline-flex items-center justify-center border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer"
                          title="Cancel"
                          aria-label="Cancel edit"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1 flex-wrap">
                        <span className="text-foreground" style={S.price}>{formatMoney(effectivePrice, flowCurrency)}</span>
                        <span className="text-muted-foreground" style={S.small}>/ {item.vendorUOM}</span>
                        <button
                          type="button"
                          onClick={() => openVendorPricing({ focusUnit: activeVendorUnit })}
                          className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:text-[#0A77FF] hover:bg-blue-50 cursor-pointer transition-colors self-center"
                          title="Edit price"
                          aria-label="Edit unit price"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {effectiveDiscount > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full ml-1" style={{ backgroundColor: "hsl(var(--success-tint))", color: "hsl(var(--success))", ...S.badge }}>
                            <TrendingDown className="size-2.5" />{effectiveDiscount}% off
                          </span>
                        )}
                      </div>
                    )}
                    {multiUnitExpanded && (
                      <MultiUnitPriceTable
                        tiers={activeTiers}
                        currentVendorUnit={item.vendorUOM}
                        configuredUnits={configuredUnits}
                        itemBaseUnit={item.defaultUOM}
                        vendorName={activeVendor}
                        currency={bookCurrency}
                        editTierUnit={editTierUnit}
                        tierDraftPrice={tierDraftPrice}
                        setTierDraftPrice={setTierDraftPrice}
                        addTierMode={addTierMode}
                        addTierUnit={addTierUnit}
                        setAddTierUnit={setAddTierUnit}
                        addTierPrice={addTierPrice}
                        setAddTierPrice={setAddTierPrice}
                        /* Routed through the shared `beginTierEdit` /
                           `commitTierEdit` / `cancelTierEdit` callbacks so
                           this table and the new headline pencil edit are
                           guaranteed to write the same way. */
                        /* Add + edit both open the vendor pricing modal —
                           no inline editing in the table any more. */
                        onBeginEditTier={(unit) => openVendorPricing({ focusUnit: unit })}
                        onCommitEditTier={commitTierEdit}
                        onCancelEditTier={cancelTierEdit}
                        onRemoveTier={requestRemoveTier}
                        onSetDefault={requestSetDefault}
                        onBeginAdd={() => openVendorPricing({ appendUnit: true })}
                        onCancelAdd={() => {
                          setAddTierMode(false);
                          setAddTierUnit("");
                          setAddTierPrice("");
                        }}
                        onCommitAdd={commitAddTier}
                      />
                    )}
                  </>
                ) : hasOriginalVendor && activeUnitPrice === 0 ? (
                  /* No price configured for the active unit on this vendor
                     (either the buyer just picked a new UOM from the
                     Vendor Selling Unit dropdown, or the vendor is newly
                     added with no price yet). Show the multi-unit price
                     table — `changeActiveUnit` already pre-opens it in
                     add-row mode with the picked unit pre-filled. */
                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground" style={S.small}>
                      No price set for {activeVendorUnit}.{" "}
                      <button type="button" onClick={() => openVendorPricing({ appendUnit: activeVendorUnit })} className="text-primary hover:underline cursor-pointer" style={{ fontWeight: 500 }}>
                        Add unit price
                      </button>
                    </span>
                    <MultiUnitPriceTable
                      tiers={activeTiers}
                      currentVendorUnit={activeVendorUnit}
                      configuredUnits={configuredUnits}
                      itemBaseUnit={item.defaultUOM}
                      vendorName={activeVendor}
                      currency={bookCurrency}
                      editTierUnit={editTierUnit}
                      tierDraftPrice={tierDraftPrice}
                      setTierDraftPrice={setTierDraftPrice}
                      addTierMode={addTierMode}
                      addTierUnit={addTierUnit}
                      setAddTierUnit={setAddTierUnit}
                      addTierPrice={addTierPrice}
                      setAddTierPrice={setAddTierPrice}
                      onBeginEditTier={(unit) => openVendorPricing({ focusUnit: unit })}
                      onCommitEditTier={commitTierEdit}
                      onCancelEditTier={cancelTierEdit}
                      onRemoveTier={requestRemoveTier}
                      onSetDefault={requestSetDefault}
                      onBeginAdd={() => openVendorPricing({ appendUnit: true })}
                      onCancelAdd={() => {
                        setAddTierMode(false);
                        setAddTierUnit("");
                        setAddTierPrice("");
                      }}
                      onCommitAdd={commitAddTier}
                    />
                  </div>
                ) : isUnassigned ? (
                  <div className="flex items-center gap-1.5">
                    <Lock className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground" style={S.small}>Assign vendor for pricing</span>
                  </div>
                ) : !hasActivePrice ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground" style={S.small}>No unit price set for this vendor</span>
                    {/* Pricing is captured in the vendor pricing modal
                        (price + unit + ordering rules) — no inline entry. */}
                    <button
                      type="button"
                      onClick={() => openVendorPricing()}
                      className="self-start h-8 px-3 rounded-[var(--radius)] inline-flex items-center gap-1.5 cursor-pointer transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                      style={S.btn}
                    >
                      <Plus className="size-3" /> Add unit price
                    </button>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-foreground" style={S.price}>{formatMoney(effectivePrice, flowCurrency)}</span>
                    <span className="text-muted-foreground" style={S.small}>/ {item.vendorUOM}</span>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="px-4 py-2.5" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                <span className="text-muted-foreground block mb-2" style={S.fieldLabel}>Quantity</span>

                {/* Converter card */}
                <div className="rounded-[var(--radius)] overflow-hidden" style={{
                  backgroundColor: !qtyEditable ? "hsl(var(--secondary))" : "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: !qtyEditable ? "none" : "var(--elevation-sm)",
                  borderLeft: !qtyEditable ? "3px solid hsl(var(--border))" : "3px solid hsl(var(--primary))",
                  opacity: 1,
                }}>

                  {/* ── Top row ── */}
                  <div className="px-3 pt-2.5 pb-2">
                    <span className="text-muted-foreground block mb-1" style={S.small}>
                      {qtySwapped ? "Default Stocking Unit" : "Vendor Selling Unit"}
                    </span>
                    <div
                      ref={qtySwapped ? baseQtyWrapRef : vendorQtyWrapRef}
                      className={cn(
                        "flex items-center rounded-[var(--radius)] border border-border overflow-hidden transition-colors focus-within:border-primary",
                        blinkTarget === (qtySwapped ? "baseQty" : "vendorQty") && "po-warning-blink-green",
                      )}
                      style={{ backgroundColor: !qtyEditable ? "hsl(var(--muted))" : "hsl(var(--input-background))" }}
                    >
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
                        disabled={!qtyEditable}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 h-9 px-3 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        style={{ ...S.priceSm, fontFamily: FONT, color: !qtyEditable ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))", cursor: !qtyEditable ? "not-allowed" : undefined }}
                      />
                      {priceConfirmed && (() => {
                        const w = qtySwapped ? baseRowWarning : vendorRowWarning;
                        return w ? (
                          <span className="shrink-0 h-9 flex items-center pr-1.5">
                            <WarningIndicator warning={w} onRequestResolve={handleRequestResolve} />
                          </span>
                        ) : null;
                      })()}
                      <div className="shrink-0 h-9 flex items-center gap-1.5 border-l border-border px-2.5" style={{ backgroundColor: "hsl(var(--secondary))" }}>
                        {qtySwapped ? (
                          <span className="text-foreground" style={{ ...S.bodyMed, color: !qtyEditable ? "hsl(var(--muted-foreground))" : undefined }}>{item.defaultUOM}</span>
                        ) : (
                          !qtyEditable ? (
                            <span className="text-muted-foreground" style={S.bodyMed}>{item.vendorUOM || "—"}</span>
                          ) : (
                            // Vendor Selling Unit picker — restricted to
                            // units the active vendor is actually
                            // qualified to sell in (i.e. the priced tiers
                            // shown in the MultiUnitPriceTable). Helper
                            // names the qualified vendor + notes that new
                            // units are added via "+ Add another unit
                            // price" and default to THIS PO only.
                            <UnitCombobox
                              value={activeVendorUnit}
                              onChange={changeActiveUnit}
                              allowedUnits={activeTiers.map((t) => t.unit)}
                              itemBaseUnit={item.defaultUOM || item.vendorUOM}
                              helperText={
                                activeVendor
                                  ? `Units qualified with ${activeVendor}. Adding a new unit here saves to this PO only.`
                                  : undefined
                              }
                              unitBadges={Object.fromEntries(
                                activeTiers
                                  .filter((t) => t.poOnly)
                                  .map((t) => [t.unit, "PO only"] as const),
                              )}
                              size="sm"
                              variant="ghost"
                              placeholder="Unit"
                            />
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Swap button ── */}
                  <div className="flex items-center justify-center py-0">
                    <button
                      onClick={() => priceConfirmed && setQtySwapped(!qtySwapped)}
                      disabled={!qtyEditable}
                      className="flex items-center justify-center size-7 rounded-full border border-border transition-all"
                      style={{ backgroundColor: "hsl(var(--card))", cursor: !qtyEditable ? "not-allowed" : "pointer", opacity: !qtyEditable ? 0.4 : 1 }}
                      title="Swap input direction"
                    >
                      <ArrowUpDown className="size-3.5 text-primary" />
                    </button>
                  </div>

                  {/* ── Bottom row ── */}
                  <div className="px-3 pt-1 pb-2.5">
                    <span className="text-muted-foreground block mb-1" style={S.small}>
                      {qtySwapped ? "Vendor Selling Unit" : "Default Stocking Unit"}
                    </span>
                    <div
                      ref={qtySwapped ? vendorQtyWrapRef : baseQtyWrapRef}
                      className={cn(
                        "flex items-center rounded-[var(--radius)] border border-border overflow-hidden transition-colors focus-within:border-primary",
                        blinkTarget === (qtySwapped ? "vendorQty" : "baseQty") && "po-warning-blink-green",
                      )}
                      style={{ backgroundColor: !qtyEditable ? "hsl(var(--muted))" : "hsl(var(--input-background))" }}
                    >
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
                        disabled={!qtyEditable}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 h-9 px-3 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        style={{ ...S.priceSm, fontFamily: FONT, color: !qtyEditable ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))", cursor: !qtyEditable ? "not-allowed" : undefined }}
                      />
                      {priceConfirmed && (() => {
                        const w = qtySwapped ? vendorRowWarning : baseRowWarning;
                        return w ? (
                          <span className="shrink-0 h-9 flex items-center pr-1.5">
                            <WarningIndicator warning={w} onRequestResolve={handleRequestResolve} />
                          </span>
                        ) : null;
                      })()}
                      <div className="shrink-0 h-9 flex items-center gap-1.5 border-l border-border px-2.5" style={{ backgroundColor: "hsl(var(--secondary))" }}>
                        {qtySwapped ? (
                          !qtyEditable ? (
                            <span className="text-muted-foreground" style={S.bodyMed}>{item.vendorUOM || "—"}</span>
                          ) : (
                            // Vendor Selling Unit picker (qty-swapped
                            // layout mirror of the picker above). Same
                            // whitelist + helper copy — vendor-qualified
                            // priced tiers, note about PO-only add.
                            <UnitCombobox
                              value={activeVendorUnit}
                              onChange={changeActiveUnit}
                              allowedUnits={activeTiers.map((t) => t.unit)}
                              itemBaseUnit={item.defaultUOM || item.vendorUOM}
                              helperText={
                                activeVendor
                                  ? `Units qualified with ${activeVendor}. Adding a new unit here saves to this PO only.`
                                  : undefined
                              }
                              unitBadges={Object.fromEntries(
                                activeTiers
                                  .filter((t) => t.poOnly)
                                  .map((t) => [t.unit, "PO only"] as const),
                              )}
                              size="sm"
                              variant="ghost"
                              placeholder="Unit"
                            />
                          )
                        ) : (
                          <span className="text-foreground" style={{ ...S.bodyMed, color: !qtyEditable ? "hsl(var(--muted-foreground))" : undefined }}>{item.defaultUOM}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing Rules card was moved to the right-column tab
                  (buyer 2026-07-22 "adjust this on the right side tab").
                  See the "pricing-rules" tab render below. */}

              {/* Manage Pricing Rules modal — wired from the Pricing
                  Rules tab's footer link (buyer 2026-07-22 "need to
                  enable this now"). Synthesizes a single-line POLineItem
                  from the current OrderFlow state so the modal (which
                  is PO-wide by design) can render this one line. Toggle
                  events flow back into `deactivatedRuleIds` so the tab's
                  card + price breakdown reflect changes in real time. */}
              {managePricingRulesOpen && item.partnerLocation && (() => {
                const syntheticLine: POLineItem = {
                  id: "orderflow-line",
                  itemNumber: item.itemNumber,
                  descriptiveName: item.descriptiveName,
                  description: item.description ?? "",
                  image: item.image ?? "",
                  unitPrice: effectivePrice,
                  vendorQty,
                  vendorUOM: item.vendorUOM ?? "Unit",
                  vendorUOMQty: item.vendorUOMQty ?? 1,
                  quantity: defaultQty,
                  defaultUOM: item.defaultUOM ?? "Unit",
                  discount: effectiveDiscount,
                  lineTotal: totalPrice,
                  shipmentMethod: shipmentMethod || "fedex-ground",
                  needByDate: needByDate || "",
                  promisedShipDate: promisedShipDate || undefined,
                  inboundLocation: inboundLocation || "",
                  category: item.category ?? "",
                  receivedQuantity: 0,
                };
                const deactivatedMap: Record<string, "USER_UNAPPLIED" | "EXCEEDS_100_PERCENT"> = {};
                for (const id of deactivatedRuleIds) {
                  deactivatedMap[id] = "USER_UNAPPLIED";
                }
                return (
                  <POPricingRulesManageModal
                    open={managePricingRulesOpen}
                    onOpenChange={setManagePricingRulesOpen}
                    vendorName={item.partnerLocation}
                    lineItems={[syntheticLine]}
                    deactivatedRuleIds={deactivatedMap}
                    onToggleRule={(ruleId, nextActive) => {
                      setDeactivatedRuleIds((prev) => {
                        const next = new Set(prev);
                        if (nextActive) next.delete(ruleId);
                        else next.add(ruleId);
                        return next;
                      });
                    }}
                    onToggleRuleForLine={(ruleId, _lineId, nextActive) => {
                      /* Single-line context — per-line toggle behaves
                         the same as the wholesale toggle. */
                      setDeactivatedRuleIds((prev) => {
                        const next = new Set(prev);
                        if (nextActive) next.delete(ruleId);
                        else next.add(ruleId);
                        return next;
                      });
                    }}
                  />
                );
              })()}

              {/* Total — stays on `priceConfirmed` because a real total
                  can only be drawn from a confirmed unit price. During a
                  UOM switch (qtyEditable but not priceConfirmed) the
                  qty inputs are usable but the line value is still
                  unknown, so we keep showing the "—" placeholder. */}
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
                      <span className="text-foreground" style={S.bodyMed}>{formatMoney(subtotal, flowCurrency)}</span>
                    </div>
                    {/* Discount + Premium pricing rules (buyer 2026-07-22
                        "everything is pricing rules — either discount or
                        premium"). The line-item's Volume % discount rolls
                        into the discount total since it's the same
                        conceptual thing: a price reduction on this line. */}
                    {(discountAmount + rulesDiscountAmount) > 0 && (
                      <div className="flex items-center justify-between mb-0.5">
                        <span style={{ color: "hsl(var(--success))", ...S.small }}>
                          Discount pricing rules
                        </span>
                        <span style={{ color: "hsl(var(--success))", ...S.bodyMed }}>
                          {formatMoney(-(discountAmount + rulesDiscountAmount), flowCurrency)}
                        </span>
                      </div>
                    )}
                    {rulesPremiumAmount > 0 && (
                      <div className="flex items-center justify-between mb-0.5">
                        <span style={{ color: "#7C3AED", ...S.small }}>
                          Premium pricing rules
                        </span>
                        <span style={{ color: "#7C3AED", ...S.bodyMed }}>
                          +{formatMoney(rulesPremiumAmount, flowCurrency)}
                        </span>
                      </div>
                    )}
                    {oneTimeNet !== 0 && (
                      <div className="flex items-center justify-between mb-0.5">
                        <span style={{ color: oneTimeNet < 0 ? "hsl(var(--success))" : "#7C3AED", ...S.small }}>
                          One-time discounts/premiums
                        </span>
                        <span style={{ color: oneTimeNet < 0 ? "hsl(var(--success))" : "#7C3AED", ...S.bodyMed }}>
                          {oneTimeNet < 0 ? "−" : "+"}{formatMoney(Math.abs(oneTimeNet), flowCurrency)}
                        </span>
                      </div>
                    )}
                    <div className="h-px my-2" style={{ backgroundColor: "hsl(var(--border))" }} />
                    <div className="flex items-center justify-between">
                      <span className="text-foreground" style={S.bodyMed}>Total</span>
                      <span className="text-primary" style={S.total}>{formatMoney(totalPrice, flowCurrency)}</span>
                    </div>
                    {/* The vendor quotes in another currency than this PO's:
                        its book prices are converted at the PO's rate. */}
                    {linkedPO && bookCurrency !== flowCurrency && (
                      <p className="mt-1 text-right text-muted-foreground" style={{ ...S.small, fontSize: 11 }}>
                        {activeVendor || item.partnerLocation} quotes in {bookCurrency}; this PO is in {flowCurrency}
                        {" "}· 1 {bookCurrency} = {formatRate(toPOCurrency(1e6, bookCurrency, linkedPO) / 1e6)} {flowCurrency}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Sticky actions */}
            <div className="shrink-0 px-4 py-3 flex flex-col gap-1.5" style={{ borderTop: "1px solid hsl(var(--border))" }}>
              {mode === "edit-po" ? (
                <button
                  className="w-full h-9 flex items-center justify-center gap-2 rounded-[var(--radius)] transition-all"
                  style={{
                    backgroundColor: canSubmit ? "hsl(var(--primary))" : "hsl(var(--muted))",
                    color: canSubmit ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    ...S.btn,
                  }}
                  disabled={!canSubmit} title={submitDisabledTitle} onClick={() => handleComplete("buy-now")}>
                  <Save className="size-3.5" /> Save Changes
                </button>
              ) : mode === "add-to-po" ? (
                <button
                  className="w-full h-9 flex items-center justify-center gap-2 rounded-[var(--radius)] transition-all"
                  style={{
                    backgroundColor: canSubmit ? "hsl(var(--primary))" : "hsl(var(--muted))",
                    color: canSubmit ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    ...S.btn,
                  }}
                  disabled={!canSubmit} title={submitDisabledTitle} onClick={() => handleComplete("add-to-cart")}>
                  <Plus className="size-3.5" /> Add to Purchase Order
                </button>
              ) : mode === "edit-cart" ? (
                <button
                  className="w-full h-9 flex items-center justify-center gap-2 rounded-[var(--radius)] transition-all"
                  style={{
                    backgroundColor: canSubmit ? "hsl(var(--primary))" : "hsl(var(--muted))",
                    color: canSubmit ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    ...S.btn,
                  }}
                  disabled={!canSubmit} title={submitDisabledTitle} onClick={() => handleComplete("add-to-cart")}>
                  <Save className="size-3.5" /> Update Line Item
                </button>
              ) : (
                <>
                  {/* Add to Cart — SECONDARY (accent tint), top of the stack. */}
                  <button
                    className="w-full h-9 flex items-center justify-center gap-2 rounded-[var(--radius)] transition-all"
                    style={{
                      backgroundColor: canSubmit ? "hsl(var(--accent))" : "hsl(var(--muted))",
                      color: canSubmit ? "hsl(var(--accent-foreground))" : "hsl(var(--muted-foreground))",
                      cursor: canSubmit ? "pointer" : "not-allowed",
                      ...S.btn,
                    }}
                    disabled={!canSubmit} title={submitDisabledTitle} onClick={() => handleComplete("add-to-cart")}>
                    <ShoppingCart className="size-3.5" /> Add to Cart
                  </button>
                  {/* Buy Now — PRIMARY (filled primary), bottom of the stack.
                      Same button style we use everywhere else
                      (`CatalogueModal.tsx:1824`). */}
                  <button
                    className="w-full h-9 flex items-center justify-center gap-1.5 rounded-[var(--radius)] transition-all"
                    style={{
                      backgroundColor: canSubmit ? "hsl(var(--primary))" : "hsl(var(--muted))",
                      color: canSubmit ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                      cursor: canSubmit ? "pointer" : "not-allowed",
                      ...S.btn,
                    }}
                    disabled={!canSubmit} title={submitDisabledTitle} onClick={() => handleComplete("buy-now")}>
                    <Zap className="size-3.5" /> Buy Now
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ─────── RIGHT COLUMN — tabbed detail panels ─────── */}
          <div className="flex-1 md:min-w-0 flex flex-col min-h-0" style={{ backgroundColor: "hsl(var(--background))" }}>

            {/* Tab bar */}
            <div className="shrink-0 flex items-center gap-0 px-4 overflow-x-auto" style={{ borderBottom: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}>
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActiveTab = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    className="relative flex items-center gap-1.5 px-3 py-2.5 shrink-0 cursor-pointer transition-colors"
                    style={{ color: isActiveTab ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <Icon className="size-3.5" />
                    <span style={{ ...S.smallMed, color: "inherit" }}>{tab.label}</span>
                    {"count" in tab && (tab as any).count > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full px-1 min-w-[14px] h-[14px]"
                        style={{ backgroundColor: isActiveTab ? "var(--primary-tint-subtle)" : "hsl(var(--secondary))", color: isActiveTab ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))", ...S.tiny, fontSize: "9px" }}>
                        {(tab as any).count}
                      </span>
                    )}
                    {isActiveTab && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full" style={{ backgroundColor: "hsl(var(--primary))" }} />}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}>

              {/* ── Shipping & Delivery ── */}
              {activeTab === "shipping" && (
                <div className="relative">
                  {!qtyEditable && (
                    /* Vendor-gate overlay — reused from the previous
                       single-card layout. Sits above the whole tab body
                       (both sub-sections) with the same blur + lock chip. */
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius)]" style={{ backgroundColor: "color-mix(in srgb, hsl(var(--card)) 70%, transparent)", backdropFilter: "blur(1px)" }}>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)]" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "var(--elevation-sm)" }}>
                        <Lock className="size-3 text-muted-foreground" /><span className="text-muted-foreground" style={S.small}>Assign vendor first</span>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    {/* ── Sub-section 1: DATES (2026-07-29 rebuild) ──
                        New model resolved after 33-minute debate:
                          • Expected Delivery Date — required primary.
                            Version trigger on change.
                          • Ship By Date — optional. If set, ship method
                            becomes required and the gap between the two
                            is validated against the method's transit
                            window (warn, never block).
                          • Promise Ship Date — optional, record-only,
                            hidden behind +Add. Does NOT trigger a
                            version.
                        Need-by dropped entirely (Eli: "mislabeled and
                        confusing"). Underlying data fields are kept
                        (`expectedDeliveryDate`, `needByDate` = Ship By,
                        `promisedShipDate` = Promise Ship) so planner
                        continues to work without cross-scope changes. */}
                    <SubSection
                      title="Delivery dates"
                      subtitle="Expected delivery is auto-calculated from the vendor's lead time. Ship by is optional; Promise ship is a record-only add-on."
                    >
                      {/* Row 1: Expected Delivery (required, auto-calc'd
                          from vendor lead time) alongside Ship By (visible
                          but labeled Optional). Buyer 2026-07-29 asked to
                          keep Ship By in its previous slot ("I need the
                          ship by date field the same way we have
                          previously"). Only Promise Ship stays hidden
                          behind the third-step +Add trigger below. */}
                      <div className="grid grid-cols-2 gap-3">
                        <FI
                          label="Expected delivery date"
                          required
                          helper={
                            activeVendor
                              ? `Auto-calculated from ${activeVendor.replace(/ \(.*\)$/, "")}'s ${getVendorLeadTimeDays(activeVendor)}-day lead time.`
                              : "When you need this item to arrive. This is the lock date everything forecasts off of."
                          }
                          infoTitle="Expected delivery date"
                          infoText="Required. The date the system uses as the day goods physically arrive at the facility. All forecasting and material-availability calculations flow from this date. Inventory is assumed to land by end of day (24:00) on this date."
                        >
                          <div
                            ref={deliveryDateWrapRef}
                            className={cn(
                              "relative rounded-[var(--radius)]",
                              blinkTarget === "deliveryDate" && "po-warning-blink-green",
                            )}
                          >
                            <SystemDatePicker
                              value={expectedDeliveryDate}
                              onChange={setExpectedDeliveryDate}
                              placeholder="Select date"
                              disabled={!qtyEditable}
                              className="!w-full"
                            />
                            {dateRowWarning && (
                              <span
                                className="absolute top-1/2 -translate-y-1/2 flex items-center"
                                style={{ right: 8, zIndex: 2 }}
                              >
                                <WarningIndicator warning={dateRowWarning} onRequestResolve={handleRequestResolve} />
                              </span>
                            )}
                          </div>
                        </FI>
                        <FI
                          label="Ship by date"
                          optional
                          helper="The date you're instructing the vendor to ship by."
                          infoTitle="Ship by date"
                          infoText="The date you're instructing the vendor to ship by."
                        >
                          <SystemDatePicker
                            value={needByDate}
                            onChange={setNeedByDate}
                            placeholder="Select date"
                            disabled={!qtyEditable}
                            className="!w-full"
                          />
                        </FI>
                      </div>

                      {/* Ship By set but ship method missing — inline nudge
                          (not a hard block; nudges the buyer to pick a
                          method so the transit-range check can run). */}
                      {needByDate && !shipmentMethod && (
                        <div
                          className="flex items-start gap-2 mt-3 px-3 py-2 rounded-[var(--radius)]"
                          style={{
                            backgroundColor: "#FEF3C7",
                            border: "1px solid #FCD34D",
                          }}
                        >
                          <Info className="size-3.5 shrink-0" style={{ color: "#B45309", marginTop: 1 }} />
                          <span className="flex-1" style={{ ...S.small, color: "#78350F", fontFamily: FONT }}>
                            Pick a shipping method below so we can check the transit window against your ship-by date.
                          </span>
                        </div>
                      )}

                      {/* Transit-range compatibility warning — only when
                          Expected + Ship By + Method are all set and the
                          gap falls outside the method's window (±1-day
                          tolerance). Non-blocking. */}
                      {deliveryCompat && !deliveryCompat.inRange && (
                        <div
                          className="flex items-start gap-2 mt-3 px-3 py-2 rounded-[var(--radius)]"
                          style={{
                            backgroundColor: "#FEF3C7",
                            border: "1px solid #FCD34D",
                          }}
                        >
                          <Info className="size-3.5 shrink-0" style={{ color: "#B45309", marginTop: 1 }} />
                          <span className="flex-1" style={{ ...S.small, color: "#78350F", fontFamily: FONT }}>
                            {deliveryCompat.methodLabel} transit is {deliveryCompat.rangeMin === deliveryCompat.rangeMax ? `${deliveryCompat.rangeMin} day${deliveryCompat.rangeMin === 1 ? "" : "s"}` : `${deliveryCompat.rangeMin}–${deliveryCompat.rangeMax} days`}, but expected delivery is {deliveryCompat.gapDays} day{deliveryCompat.gapDays === 1 ? "" : "s"} after ship-by. {deliveryCompat.gapDays < deliveryCompat.rangeMin ? "The window may be too tight." : "The window has extra buffer."}
                          </span>
                        </div>
                      )}

                      {/* Promise Ship Date — third-step optional, hidden
                          behind a chip-style trigger below a dashed
                          divider (buyer 2026-07-29: "hide underneath a
                          button so it looks optional a third step
                          optional"). Always starts collapsed; when a
                          value exists the trigger reads "Promise ship:
                          Mar 11, 2026" so the value stays discoverable
                          without taking a primary field slot. */}
                      <div className="mt-3 pt-3" style={{ borderTop: "1px dashed hsl(var(--border))" }}>
                        {!showPromiseShipDate ? (
                          <button
                            type="button"
                            onClick={() => setShowPromiseShipDate(true)}
                            disabled={!qtyEditable}
                            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] transition-colors"
                            style={{
                              ...S.small,
                              fontFamily: FONT,
                              cursor: qtyEditable ? "pointer" : "not-allowed",
                              opacity: qtyEditable ? 1 : 0.5,
                              padding: "3px 8px",
                              backgroundColor: promisedShipDate ? "hsl(var(--secondary))" : "transparent",
                              color: promisedShipDate ? "hsl(var(--foreground))" : "hsl(var(--primary))",
                              border: promisedShipDate ? "1px dashed hsl(var(--border))" : "1px dashed transparent",
                            }}
                            onMouseEnter={(e) => {
                              if (!qtyEditable) return;
                              e.currentTarget.style.backgroundColor = "hsl(var(--secondary))";
                              e.currentTarget.style.borderColor = "hsl(var(--border))";
                            }}
                            onMouseLeave={(e) => {
                              if (!qtyEditable) return;
                              e.currentTarget.style.backgroundColor = promisedShipDate ? "hsl(var(--secondary))" : "transparent";
                              e.currentTarget.style.borderColor = promisedShipDate ? "hsl(var(--border))" : "transparent";
                            }}
                            aria-label={promisedShipDate ? "Edit promise ship date" : "Add promise ship date"}
                          >
                            {promisedShipDate ? (
                              <>
                                <CalendarClock className="size-3" style={{ color: "hsl(var(--muted-foreground))" }} />
                                <span style={{ color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>Promise ship</span>
                                <span style={{ fontWeight: 600 }}>
                                  {(() => {
                                    const [y, m, d] = promisedShipDate.split("-").map(Number);
                                    if (!y || !m || !d) return promisedShipDate;
                                    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                                  })()}
                                </span>
                                <Pencil className="size-2.5" style={{ color: "hsl(var(--muted-foreground))", marginLeft: 2 }} />
                              </>
                            ) : (
                              <>
                                <Plus className="size-3" />
                                Add promise ship date
                                <span style={{ color: "hsl(var(--muted-foreground))", marginLeft: 4, fontWeight: 400 }}>· Optional</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <FI
                            label="Promise ship date"
                            optional
                            helper="Record the vendor's committed ship date for performance tracking. Does not amend the PO."
                            infoTitle="Promise ship date"
                            infoText="Vendor's promised ship date. Recorded for tracking only — changing it will not create a new PO version and does not affect the expected delivery date."
                          >
                            <div className="flex items-center gap-2">
                              <div
                                ref={promiseShipDateWrapRef}
                                className={cn(
                                  "flex-1 min-w-0 relative rounded-[var(--radius)]",
                                  blinkTarget === "promiseShipDate" && "po-warning-blink-green",
                                )}
                              >
                                <SystemDatePicker
                                  value={promisedShipDate}
                                  onChange={setPromisedShipDate}
                                  placeholder="Select date"
                                  disabled={!qtyEditable}
                                  className="!w-full"
                                />
                                {promiseShipRowWarning && (
                                  <span
                                    className="absolute top-1/2 -translate-y-1/2 flex items-center"
                                    style={{ right: 8, zIndex: 2 }}
                                  >
                                    <WarningIndicator warning={promiseShipRowWarning} onRequestResolve={handleRequestResolve} />
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setPromisedShipDate("");
                                  setShowPromiseShipDate(false);
                                }}
                                disabled={!qtyEditable}
                                className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 h-8 hover:bg-secondary transition-colors shrink-0"
                                style={{
                                  ...S.small,
                                  color: "hsl(var(--muted-foreground))",
                                  fontFamily: FONT,
                                  cursor: qtyEditable ? "pointer" : "not-allowed",
                                  opacity: qtyEditable ? 1 : 0.5,
                                }}
                                aria-label="Cancel promise ship date"
                              >
                                <X className="size-3" />
                                Cancel
                              </button>
                            </div>
                          </FI>
                        )}
                      </div>
                    </SubSection>

                    {/* ── Sub-section 2: SHIPPING ──
                        Carrier / method / destination. Kept below the
                        Dates section because the derived Expected
                        delivery in that section depends on the transit
                        time picked here, but the buyer typically fills
                        Need-by first then picks carrier. */}
                    <SubSection
                      title="Shipping"
                      subtitle="Carrier, method, and inbound destination."
                    >
                      <ShippingCarrierPicker
                        selectedMethodValue={shipmentMethod}
                        onMethodChange={(v) => {
                          handleOptionalFieldChange("shippingMethod", v, setShipmentMethod);
                          const found = findCarrierAndMethod(v);
                          if (found.carrier) setShippingCarrier(found.carrier.code);
                        }}
                        disabled={!qtyEditable}
                      />

                      {/* F20: Default prompt for shipping method */}
                      {defaultPromptField === "shippingMethod" && activeVendor && (
                        <div className="flex items-center gap-2 px-3 py-2 mt-3 rounded-[var(--radius)] border border-primary/20" style={{ backgroundColor: "var(--primary-tint-subtle)" }}>
                          <Info className="size-3.5 text-primary shrink-0" />
                          <span className="text-foreground flex-1" style={S.small}>Make this the default for {activeVendor.replace(/ \(.*\)$/, "")}?</span>
                          <button onClick={() => { setDefaultPromptField(null); toast.success("Default saved", { style: { fontFamily: FONT }, duration: 2000 }); }} className="px-2 py-0.5 rounded-[var(--radius-sm)] text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-primary/20" style={S.tiny}>Set as Default</button>
                          <button onClick={() => setDefaultPromptField(null)} className="px-2 py-0.5 rounded-[var(--radius-sm)] text-muted-foreground hover:bg-secondary transition-colors cursor-pointer border border-border" style={S.tiny}>Just this time</button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <FI label="Inbound location">
                          <div className="relative">
                            <Select value={inboundLocation} onValueChange={(v) => { handleOptionalFieldChange("inboundLocation", v, setInboundLocation); setLocationSearch(""); }} disabled={!qtyEditable}>
                              <SelectTrigger className="h-8 w-full gap-1 border-border" style={{ ...S.body, color: !qtyEditable ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))", backgroundColor: !qtyEditable ? "hsl(var(--muted))" : undefined, cursor: !qtyEditable ? "not-allowed" : undefined }}>
                                <SelectValue placeholder="Select location">{inboundLocation || "Select location"}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <div className="px-2 pb-1.5 pt-1 sticky top-0" style={{ backgroundColor: "hsl(var(--popover))" }}>
                                  <div className="flex items-center gap-1.5 h-7 px-2 rounded-[var(--radius-sm)] border border-border" style={{ backgroundColor: "hsl(var(--input-background))" }}>
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
                        <div /> {/* spacer */}
                      </div>

                      {/* F20: Default prompt for inbound location */}
                      {defaultPromptField === "inboundLocation" && activeVendor && (
                        <div className="flex items-center gap-2 px-3 py-2 mt-3 rounded-[var(--radius)] border border-primary/20" style={{ backgroundColor: "var(--primary-tint-subtle)" }}>
                          <Info className="size-3.5 text-primary shrink-0" />
                          <span className="text-foreground flex-1" style={S.small}>Make this the default for {activeVendor.replace(/ \(.*\)$/, "")}?</span>
                          <button onClick={() => { setDefaultPromptField(null); toast.success("Default saved", { style: { fontFamily: FONT }, duration: 2000 }); }} className="px-2 py-0.5 rounded-[var(--radius-sm)] text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-primary/20" style={S.tiny}>Set as Default</button>
                          <button onClick={() => setDefaultPromptField(null)} className="px-2 py-0.5 rounded-[var(--radius-sm)] text-muted-foreground hover:bg-secondary transition-colors cursor-pointer border border-border" style={S.tiny}>Just this time</button>
                        </div>
                      )}
                    </SubSection>
                  </div>
                </div>
              )}

              {/* ── Pricing Rules (SO-parity) ── */}
              {activeTab === "pricing-rules" && SHOW_PO_PRICING_RULES && item.partnerLocation && (
                <div className="flex flex-col gap-3">
                {vendorRulesForLine.length > 0 ? (
                  <LinePricingRulesCard
                    rules={vendorRulesForLine}
                    breakdown={rulesBreakdown}
                    deactivatedRuleIds={deactivatedRuleIds}
                    onToggleRule={(ruleId, next) => {
                      setDeactivatedRuleIds((prev) => {
                        const nextSet = new Set(prev);
                        if (next) nextSet.delete(ruleId);
                        else nextSet.add(ruleId);
                        return nextSet;
                      });
                    }}
                    onToggleAll={(next) => {
                      if (next) {
                        setDeactivatedRuleIds(new Set());
                      } else {
                        setDeactivatedRuleIds(new Set(vendorRulesForLine.map((r) => r.id)));
                      }
                    }}
                    onOpenManage={
                      canModifyPricingRules
                        ? () => setManagePricingRulesOpen(true)
                        : () =>
                            toast.error("Cannot manage pricing rules", {
                              description: permissionReason("po.modify_pricing_rules"),
                            })
                    }
                    currentQty={defaultQty}
                  />
                ) : (
                  /* Empty state — no rules match this vendor+item yet.
                     Buyer can jump into the Manage modal from here to
                     attach one (buyer 2026-07-22: "pricing rules needs
                     to be available in every items detail modal"). */
                  <div
                    className="rounded-lg border bg-white"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    <div className="flex flex-col items-center text-center px-6 py-10">
                      <div
                        className="flex items-center justify-center rounded-full"
                        style={{ width: 44, height: 44, backgroundColor: "#F1F5F9" }}
                      >
                        <BadgePercent className="w-5 h-5" style={{ color: "#94A3B8" }} />
                      </div>
                      <p
                        className="mt-3 text-slate-800"
                        style={{ fontSize: 13, fontWeight: 600 }}
                      >
                        No pricing rules apply to this item
                      </p>
                      <p
                        className="mt-1 text-slate-500 max-w-[320px]"
                        style={{ fontSize: 11.5, lineHeight: 1.5 }}
                      >
                        {item.partnerLocation}'s pricing rules don't currently match this item or its quantity. Open the library to attach an existing rule or create a new one.
                      </p>
                      <button
                        type="button"
                        onClick={() => canModifyPricingRules && setManagePricingRulesOpen(true)}
                        disabled={!canModifyPricingRules}
                        title={canModifyPricingRules ? undefined : permissionReason("po.modify_pricing_rules")}
                        className="mt-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] shadow-sm transition-colors"
                        style={{
                          backgroundColor: canModifyPricingRules ? "#0A77FF" : "#94A3B8",
                          fontWeight: 600,
                          cursor: canModifyPricingRules ? "pointer" : "not-allowed",
                        }}
                        onMouseEnter={(e) => {
                          if (canModifyPricingRules) e.currentTarget.style.backgroundColor = "#0862D0";
                        }}
                        onMouseLeave={(e) => {
                          if (canModifyPricingRules) e.currentTarget.style.backgroundColor = "#0A77FF";
                        }}
                      >
                        <Tag className="w-3.5 h-3.5" />
                        Manage Pricing Rules
                      </button>
                    </div>
                  </div>
                )}
                {/* One-Time Discounts/Premiums — item-level, below the
                    pricing rules (Sales Orders line-configurator parity). */}
                <LineOneTimeAdjustmentsSection
                  value={oneTimeAdjustments}
                  onChange={setOneTimeAdjustments}
                  baseSubtotal={oneTimeBase}
                  readOnly={readOnlyAdjustments || !canOneTimeDiscounts || !priceConfirmed}
                  itemName={item.itemNumber}
                />
                </div>
              )}

              {/* ── PO Warnings ── */}
              {activeTab === "warnings" && (
                <div className="rounded-[var(--radius)] overflow-hidden" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                  {inputWarnings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Check className="size-8 text-accent" />
                      <span className="text-muted-foreground" style={S.body}>No warnings for this item</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {/* Input-side warnings (W-QTY-01..04, W-DEL-01). Each
                          row carries its own Adjust affordance that resolves
                          the underlying qty/date; the warning clears on the
                          next render once the rule is satisfied. */}
                      {inputWarnings.map((iw) => (
                        <div key={iw.code} className="flex gap-3 px-4 py-3">
                          <div className="size-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: "hsl(var(--warning))" }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-foreground" style={S.bodyMed}>{iw.title}</span>
                              <span className="inline-flex items-center px-1.5 py-0 rounded-full uppercase" style={{ backgroundColor: "hsl(var(--warning-tint))", color: "hsl(var(--warning))", ...S.badge }}>warning</span>
                            </div>
                            <p className="text-muted-foreground" style={S.small}>{iw.copy}</p>
                          </div>
                          <button
                            onClick={() => handleRequestResolve(iw)}
                            className="shrink-0 self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-primary/20"
                            style={S.tiny}
                          >
                            Adjust
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Inventory Details (with sub-tabs) ── */}
              {activeTab === "inventory" && inventoryData && (
                <div className="rounded-[var(--radius)] overflow-hidden" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                  {/* Sub-tab bar */}
                  <div className="flex items-center gap-0 px-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                    {([
                      { key: "rules" as const, label: "Inventory Rules & Recommendations" },
                      { key: "status" as const, label: "Current Inventory Status" },
                    ]).map((st) => (
                      <button
                        key={st.key}
                        className="relative px-3 py-2 cursor-pointer transition-colors shrink-0"
                        style={{ color: inventorySubTab === st.key ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                        onClick={() => setInventorySubTab(st.key)}
                      >
                        <span style={{ ...S.smallMed, color: "inherit" }}>{st.label}</span>
                        {inventorySubTab === st.key && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full" style={{ backgroundColor: "hsl(var(--primary))" }} />}
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
                            <div key={r.l} className="rounded-[var(--radius)] px-3 py-2.5" style={{ backgroundColor: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
                              <span className="text-muted-foreground block mb-1" style={S.small}>{r.l}</span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-foreground" style={S.bodySemi}>{r.v}</span>
                                <span className="text-muted-foreground" style={S.tiny}>{r.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="h-px" style={{ backgroundColor: "hsl(var(--border))" }} />
                      {/* Order Quantities */}
                      <div>
                        <span className="text-muted-foreground uppercase block mb-2.5" style={{ ...S.fieldLabel }}>Order Quantities</span>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { l: "Min Order Qty", v: `${inventoryData.orderQuantity.minOrderQty}` },
                            { l: "Max Order Qty", v: `${inventoryData.orderQuantity.maxOrderQty}` },
                            { l: "Multiples", v: `${inventoryData.orderQuantity.orderMultiple}` },
                          ].map((r) => (
                            <div key={r.l} className="rounded-[var(--radius)] px-3 py-2.5" style={{ backgroundColor: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
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
                            <div key={k.label} className="rounded-[var(--radius)] px-3 py-3 flex flex-col gap-1.5" style={{ border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}>
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
                        <div className="rounded-[var(--radius)] border border-border p-4 flex flex-col" style={{ backgroundColor: "hsl(var(--card))" }}>
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
                                    <div className="flex items-center justify-center size-7 rounded-[var(--radius-sm)]" style={{ background: "color-mix(in srgb, hsl(var(--primary)) 8%, transparent)" }}>
                                      <Activity className="size-3.5" style={{ color: "hsl(var(--primary))" }} />
                                    </div>
                                    <div>
                                      <p className="text-foreground" style={S.bodyMed}>Stock Health</p>
                                      <p className="text-muted-foreground" style={{ ...S.small, fontSize: "10px" }}>Current vs. Min/Max threshold</p>
                                    </div>
                                  </div>
                                  <div className="rounded-[var(--radius-sm)] border border-border px-2 py-1 text-muted-foreground" style={S.small}>{item.defaultUOM} (default)</div>
                                </div>
                                <div className="h-px mb-3" style={{ backgroundColor: "hsl(var(--border))", opacity: 0.5 }} />

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
                                        <line x1={cx} y1={cy - 10} x2={cx} y2={cy - r2 + thickness + 25} stroke="hsl(var(--foreground))" strokeWidth={1.5} strokeLinecap="round" />
                                        <circle cx={cx} cy={cy - 10} r={2.5} fill="hsl(var(--foreground))" />
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
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)]" style={{ background: pct >= 50 ? "color-mix(in srgb, hsl(var(--accent)) 8%, transparent)" : "color-mix(in srgb, hsl(var(--destructive)) 8%, transparent)" }}>
                                    {pct >= 50 ? <Check className="size-3" style={{ color: "hsl(var(--accent))" }} /> : <AlertTriangle className="size-3" style={{ color: "hsl(var(--destructive))" }} />}
                                    <span style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", color: pct >= 50 ? "hsl(var(--accent))" : "hsl(var(--destructive))", fontFamily: FONT }}>{pct}% {pct >= 50 ? "Healthy" : "Critical"}</span>
                                  </div>
                                  <span className="text-muted-foreground" style={{ ...S.small, fontSize: "11px" }}>Max {maxStockLevel} <Info className="inline size-2.5 text-muted-foreground/50" /></span>
                                </div>

                                <div className="h-px my-2" style={{ backgroundColor: "hsl(var(--border))" }} />
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
                        <div className="rounded-[var(--radius)] border border-border p-4 flex flex-col" style={{ backgroundColor: "hsl(var(--card))" }}>
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
                                    <div className="flex items-center justify-center size-7 rounded-[var(--radius-sm)]" style={{ background: "color-mix(in srgb, hsl(var(--primary)) 8%, transparent)" }}>
                                      <Activity className="size-3.5" style={{ color: "hsl(var(--primary))" }} />
                                    </div>
                                    <div>
                                      <p className="text-foreground" style={S.bodyMed}>Inventory Trend</p>
                                      <p className="text-muted-foreground" style={{ ...S.small, fontSize: "10px" }}>On-hand quantity over time</p>
                                    </div>
                                  </div>
                                  <div className="rounded-[var(--radius-sm)] border border-border px-2 py-1 text-muted-foreground" style={S.small}>This Week</div>
                                </div>
                                <div className="h-px mb-3" style={{ backgroundColor: "hsl(var(--border))", opacity: 0.5 }} />

                                <div className="flex items-baseline gap-2 mb-3">
                                  <span className="text-foreground" style={{ fontSize: "20px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT, lineHeight: 1 }}>{latest.toLocaleString()} {item.defaultUOM}</span>
                                  <span className="inline-flex items-center rounded-[var(--radius-sm)] px-1.5" style={{
                                    fontSize: "10px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT,
                                    color: isUp ? "hsl(var(--accent))" : "hsl(var(--destructive))",
                                    background: isUp ? "color-mix(in srgb, hsl(var(--accent)) 8%, transparent)" : "color-mix(in srgb, hsl(var(--destructive)) 8%, transparent)",
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
                                        contentStyle={{ fontSize: 11, fontFamily: FONT, borderRadius: 6, border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
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
                      <div className="rounded-[var(--radius)] border border-border p-4 w-full" style={{ backgroundColor: "hsl(var(--card))", maxWidth: 320 }}>
                        {(() => {
                          const uomData = [
                            { unit: "Each (EA)", qty: 80, converted: 80, color: "hsl(var(--chart-1))" },
                            { unit: "Box (2 EA)", qty: 50, converted: 100, color: "hsl(var(--chart-2))" },
                            { unit: "Carton (8 EA)", qty: 15, converted: 120, color: "hsl(var(--chart-3))" },
                            { unit: "Pallet (80 EA)", qty: 1.87, converted: 150, color: "hsl(var(--chart-4))" },
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
                                <div className="flex items-center justify-center size-7 rounded-[var(--radius-sm)]" style={{ background: "color-mix(in srgb, hsl(var(--primary)) 8%, transparent)" }}>
                                  <BarChart3 className="size-3.5" style={{ color: "hsl(var(--primary))" }} />
                                </div>
                                <div>
                                  <p className="text-foreground" style={S.bodyMed}>On-Hand by Unit of Measure</p>
                                  <p className="text-muted-foreground" style={{ ...S.small, fontSize: "10px" }}>Stock breakdown across UOMs</p>
                                </div>
                              </div>
                              <div className="h-px mb-4" style={{ backgroundColor: "hsl(var(--border))", opacity: 0.5 }} />

                              <div className="flex items-center justify-center mb-4 relative" style={{ maxWidth: 160, margin: "0 auto 16px" }}>
                                <svg width={140} height={140} viewBox={`0 0 ${dCx * 2} ${dCy * 2}`}>
                                  <circle cx={dCx} cy={dCy} r={dR} fill="none" stroke="hsl(var(--border))" strokeWidth={dThick} opacity={0.4} />
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
                                        <span className="text-muted-foreground rounded-[var(--radius-sm)] px-1.5" style={{ ...S.tiny, fontSize: "10px", background: "hsl(var(--secondary))" }}>{pctVal}%</span>
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
                <div className="rounded-[var(--radius)] overflow-hidden" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                  {renderNotesTab}
                </div>
              )}

              {/* ── Attachments ── */}
              {/* Same AttachmentsTab as the PO detail page, but the Item
                  Detail modal runs it in selectionMode (buyer 2026-07-30):
                  every attachment comes from the item's library and the
                  buyer picks which ones travel with THIS PO. Selection
                  state is scoped to the modal / current item. */}
              {activeTab === "attachments" && (
                <div
                  className="rounded-xl border bg-white overflow-hidden"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <AttachmentsTab
                    selectionMode={{
                      selectedIds: poAttachmentIds,
                      onToggle: togglePoAttachment,
                      scopeLabel: "this PO",
                    }}
                  />
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
              <div className="w-[400px] rounded-[var(--radius)] border border-border p-0 overflow-hidden flex flex-col" style={{ backgroundColor: "hsl(var(--card))", boxShadow: "var(--elevation-lg)", fontFamily: FONT, maxHeight: "min(520px, 80vh)" }}>
                <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
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
                      style={{ ...S.body, fontSize: "12px", backgroundColor: "hsl(var(--input-background))", fontFamily: FONT }}
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
                        onClick={() => {
                          setAddNewVendorOpen(false);
                          setAddNewVendorSearch("");
                          setPricingModal({ mode: "qualify", offer, isNewVendor: true });
                        }}
                      >
                        <div className="flex items-center justify-center size-8 rounded-full bg-secondary border border-border shrink-0">
                          <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>{offer.abbr}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground truncate" style={{ fontSize: "13px", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px", fontFamily: FONT }}>{offer.vendorName}</span>
                            <span className="inline-flex items-center px-1.5 py-0 rounded-[var(--radius-sm)] border border-border shrink-0" style={{ fontSize: "9px", fontWeight: "var(--font-weight-medium)", color: "hsl(var(--muted-foreground))", backgroundColor: "hsl(var(--secondary))", lineHeight: "16px" }}>
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

        {/* Vendor pricing — Partners' pricing & ordering rules cards.
            Qualify a new vendor, or add / edit units on the active one. */}
        <QualifyVendorPricingModal
          open={!!pricingModal && !!item}
          mode={pricingModal?.mode}
          initialUnits={(() => {
            if (!pricingModal || pricingModal.isNewVendor || pricingModal.mode === "qualify") return undefined;
            const tiers = pricingModal.offer.unitPrices ?? [];
            if (!pricingModal.single) return tiersToSellingUnits(tiers);
            if (pricingModal.appendUnit) return [];
            const t = tiers.find((x) => x.unit.toLowerCase() === (pricingModal.focusUnit ?? "").toLowerCase()) ?? tiers.find((x) => x.isDefault) ?? tiers[0];
            return t ? tiersToSellingUnits([t]) : undefined;
          })()}
          initialPrimaryIndex={(() => {
            if (!pricingModal || pricingModal.isNewVendor) return 0;
            // Qualify on a vendor that already has priced units on this PO
            // → the new card isn't primary unless the buyer says so.
            if (pricingModal.mode === "qualify") return (pricingModal.offer.unitPrices ?? []).some((t) => t.price > 0) ? -1 : 0;
            const tiers = pricingModal.offer.unitPrices ?? [];
            if (!pricingModal.single) return Math.max(0, tiers.findIndex(t => t.isDefault));
            if (pricingModal.appendUnit) return -1;
            const t = tiers.find((x) => x.unit.toLowerCase() === (pricingModal.focusUnit ?? "").toLowerCase()) ?? tiers.find((x) => x.isDefault);
            return t?.isDefault ? 0 : -1;
          })()}
          single={pricingModal?.single}
          otherUnits={pricingModal?.single
            ? (pricingModal.offer.unitPrices ?? [])
                .filter((t) => pricingModal.appendUnit || t.unit.toLowerCase() !== (pricingModal.focusUnit ?? "").toLowerCase())
                .map((t) => t.unit)
            : undefined}
          appendUnit={pricingModal?.appendUnit}
          focusUnit={pricingModal?.focusUnit}
          vendorName={pricingModal?.offer.vendorName ?? ""}
          vendorAbbr={pricingModal?.offer.abbr}
          itemNumber={item?.itemNumber ?? ""}
          itemName={item?.descriptiveName}
          defaultUnit={item?.vendorUOM || item?.defaultUOM || "Each"}
          onCancel={() => setPricingModal(null)}
          onConfirm={(result) => {
            if (!pricingModal) return;
            /* Single-card modal → merge the card back into the vendor's
               full set: replace the edited unit (matched by its original
               name, else by the card's unit) or append it. Primary moves
               to it only when the buyer marked it primary. A qualify on a
               vendor already on this PO keeps its priced units ($0 seed
               placeholders are dropped). "Add on This PO Only" marks just
               the new card PO-only — nothing for it reaches the vendor's
               master record. */
            const existing = (pricingModal.offer.unitPrices ?? [])
              .filter((t) => pricingModal.mode !== "qualify" || t.price > 0);
            if (!pricingModal.isNewVendor && (pricingModal.single || pricingModal.mode === "qualify")) {
              const all = tiersToSellingUnits(existing);
              const card = { ...result.units[0] };
              if (result.scope === "po") card.poOnly = true;
              const matchUnit = (pricingModal.appendUnit ? card.uom : (pricingModal.focusUnit ?? card.uom)).toLowerCase();
              let idx = all.findIndex((u) => u.uom.toLowerCase() === matchUnit);
              if (idx >= 0) all[idx] = { ...card, poOnly: result.scope === "po" ? true : all[idx].poOnly };
              else { all.push(card); idx = all.length - 1; }
              const prevPrimary = Math.max(0, existing.findIndex((t) => t.isDefault));
              result = { units: all, primaryIndex: result.primaryIndex === 0 || existing.length === 0 ? idx : prevPrimary, scope: result.scope };
            } else if (result.scope === "po") {
              result = { ...result, units: result.units.map((u) => ({ ...u, poOnly: true })) };
            }
            applyVendorPricing(pricingModal.offer, result, {
              isNewVendor: pricingModal.isNewVendor,
              mode: pricingModal.mode,
              selectUnitOnSave: pricingModal.selectUnitOnSave,
            });
          }}
        />
      </DialogContent>

      {/* Price confirmation prompt — fires when entered price differs from
          (or is missing on) the master vendor-item record. */}
      {priceConfirmState.outcome && priceConfirmState.outcome.kind !== "silent" && (
        <PriceConfirmationDialog
          open={priceConfirmState.open}
          onOpenChange={(o) => setPriceConfirmState((s) => ({ ...s, open: o }))}
          scenario={priceConfirmState.outcome.kind === "save-as-default" ? "save-as-default" : "update-default"}
          vendorName={priceConfirmState.outcome.vendorName}
          unit={priceConfirmState.outcome.unit}
          enteredPrice={priceConfirmState.outcome.enteredPrice}
          existingDefaultPrice={
            priceConfirmState.outcome.kind === "update-default" ? priceConfirmState.outcome.existingDefaultPrice : undefined
          }
          onConfirmDefault={priceConfirmState.onConfirmDefault}
          onUseOnce={priceConfirmState.onUseOnce}
          variant={priceConfirmState.variant ?? "warning"}
          currency={bookCurrency}
        />
      )}

      {/* Tier-table warning prompt — fires on remove-tier and
          change-default clicks. Same amber warning shell as the
          entered-price dialog above so the whole pricing family
          reads consistently. */}
      <PriceWarningShell
        open={tierWarning.open}
        onOpenChange={(o) => setTierWarning((s) => ({ ...s, open: o }))}
        chipLabel={tierWarning.chipLabel}
        title={tierWarning.title}
        description={tierWarning.description}
        primaryLabel={tierWarning.primaryLabel}
        secondaryLabel={tierWarning.secondaryLabel}
        tone={tierWarning.tone}
        onPrimary={tierWarning.onPrimary}
        onSecondary={tierWarning.onSecondary}
      />

      {/* Vendor-swap warning — fires when the buyer picks a vendor
          other than the PO's original inside an existing-PO edit.
          Confirming spawns a new PO for the new vendor (POs are
          single-vendor); cancel just closes the prompt and leaves the
          original vendor in place. Buyer 2026-08-03. */}
      <PriceWarningShell
        open={vendorSwapPrompt !== null}
        onOpenChange={(o) => { if (!o) setVendorSwapPrompt(null); }}
        tone="amber"
        chipLabel="New PO"
        title="Change vendor and create a new PO?"
        description={
          <>
            This PO is for{" "}
            <span style={{ fontWeight: 600 }}>
              {originalPOVendorRef.current.replace(/ \(.*\)$/, "")}
            </span>
            . Switching to{" "}
            <span style={{ fontWeight: 600 }}>
              {vendorSwapPrompt?.offer.vendorName.replace(/ \(.*\)$/, "") ?? ""}
            </span>{" "}
            will move this item to a new PO for that vendor — we create
            purchase orders for one vendor at a time.
          </>
        }
        primaryLabel="Create new PO"
        secondaryLabel="Keep current vendor"
        onPrimary={() => {
          if (!vendorSwapPrompt) return;
          const { offer, variant, sourceVendorName } = vendorSwapPrompt;
          setVendorSwapPrompt(null);
          if (variant === "original") {
            applyVendorOfferOriginal(offer);
          } else {
            handleSelectVendorOffer(offer, sourceVendorName, true);
          }
        }}
        onSecondary={() => setVendorSwapPrompt(null)}
      />
      {/* Location-swap "create a new PO" warning (buyer 2026-08-07):
          a PO ships from one vendor location. Changing it — directly
          or by qualifying a different location — will spawn a new PO.
          Confirming applies the pending location change; cancelling
          leaves the picker on the original location. */}
      <PriceWarningShell
        open={poLocationSwapPrompt !== null}
        onOpenChange={(o) => { if (!o) setPOLocationSwapPrompt(null); }}
        tone="amber"
        chipLabel="New PO"
        title={
          poLocationSwapPrompt?.needsQualification
            ? "Qualify location and create a new PO?"
            : "Change location and create a new PO?"
        }
        description={
          <>
            This PO ships from{" "}
            <span style={{ fontWeight: 600 }}>
              {poLocationSwapPrompt?.fromLocation ?? ""}
            </span>
            . Switching to{" "}
            <span style={{ fontWeight: 600 }}>
              {poLocationSwapPrompt?.toLocation ?? ""}
            </span>{" "}
            will move this item to a new PO
            {poLocationSwapPrompt?.needsQualification && (
              <>
                {" "}and qualify{" "}
                <span style={{ fontWeight: 600 }}>
                  {poLocationSwapPrompt?.toLocation ?? ""}
                </span>{" "}
                for{" "}
                <span style={{ fontWeight: 600 }}>
                  {poLocationSwapPrompt?.vendor?.replace(/ \(.*\)$/, "") ?? ""}
                </span>
              </>
            )}
            {" "}— a single PO can only cover one location per vendor.
          </>
        }
        primaryLabel={
          poLocationSwapPrompt?.needsQualification
            ? "Qualify and create new PO"
            : "Create new PO"
        }
        secondaryLabel="Keep current location"
        onPrimary={() => {
          if (!poLocationSwapPrompt) return;
          poLocationSwapPrompt.apply();
          setPOLocationSwapPrompt(null);
        }}
        onSecondary={() => setPOLocationSwapPrompt(null)}
      />
      {/* Location qualification prompt — fires when the buyer picks a
          non-qualified vendor location inside the detail popover.
          Mirrors the vendor-level qualify-scope prompt used in the
          Duplicate flow (`PurchaseOrderDraft.tsx`) so both scope
          decisions read the same across the app. */}
      <PriceWarningShell
        open={locationQualifyPrompt !== null}
        onOpenChange={(o) => { if (!o) setLocationQualifyPrompt(null); }}
        tone="blue"
        chipLabel="Qualify location"
        title="Qualify this location for this item?"
        description={
          <>
            <span style={{ fontWeight: 600 }}>
              {locationQualifyPrompt?.location ?? ""}
            </span>{" "}
            isn't qualified for{" "}
            <span style={{ fontWeight: 600 }}>
              {item?.itemNumber ?? "this item"}
            </span>{" "}
            on{" "}
            <span style={{ fontWeight: 600 }}>
              {locationQualifyPrompt?.vendor?.replace(/ \(.*\)$/, "") ?? ""}
            </span>
            . Use it for this PO only, or qualify it on the vendor so
            future POs can ship there too.
          </>
        }
        primaryLabel="Use on this PO only"
        secondaryLabel="Qualify on the vendor"
        onPrimary={() => applyLocationQualification("po-only")}
        onSecondary={() => applyLocationQualification("vendor")}
        cancelLabel="Cancel"
      />
    </Dialog>
    {/* Confirm-adjust modal (buyer 2026-08-04 / Eli). Fires from both the
        in-field WarningIndicator's Adjust CTA and the PO Warnings tab's
        Adjust button. */}
    <AlertDialog open={!!pendingResolve} onOpenChange={(o) => { if (!o) setPendingResolve(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm adjustment</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingResolve && (
              <>
                Are you sure you'd like to change the {pendingResolve.fieldLabel} from{" "}
                <strong className="text-foreground">{pendingResolve.currentValueLabel}</strong>{" "}
                to <strong className="text-foreground">{pendingResolve.nextValueLabel}</strong>?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => { if (pendingResolve) runResolve(pendingResolve); }}>
            Yes, adjust
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <style>{`
      /* SaaS-standard "just changed" highlight — Notion/Linear/GitHub
       * pattern: single soft green wash that fades in fast and eases
       * out slowly, no pulse loop. Attention-grabbing without being
       * hyperactive. Border stays lit for the whole ~2.6s so the eye
       * has time to lock on before it settles back. */
      @keyframes poWarningFlashGreen {
        0%   { background-color: rgba(5, 150, 105, 0);    box-shadow: 0 0 0 0   rgba(5, 150, 105, 0);    }
        12%  { background-color: rgba(5, 150, 105, 0.18); box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.45); }
        55%  { background-color: rgba(5, 150, 105, 0.10); box-shadow: 0 0 0 1.5px rgba(5, 150, 105, 0.30); }
        100% { background-color: rgba(5, 150, 105, 0);    box-shadow: 0 0 0 0   rgba(5, 150, 105, 0);    }
      }
      .po-warning-blink-green {
        animation: poWarningFlashGreen 2.6s cubic-bezier(0.16, 1, 0.3, 1) 1;
      }
    `}</style>
    </DocCurrencyProvider>
  );
}

/* ── Field input wrapper ── */
/* Sub-section card — one visually distinct group inside a tab body.
   Used inside the Shipping & Delivery tab to split Delivery dates
   from Shipping (carrier / method / destination). Card shell mirrors
   the previous single-block treatment so nothing else in the tab
   looks out of place; a small caps title + optional subtitle sits at
   the top of the card. */
function SubSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[var(--radius)] overflow-hidden"
      style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
    >
      <div className="px-4 pt-3 pb-2 border-b border-border/60">
        <p
          className="text-foreground"
          style={{
            fontSize: "10.5px",
            fontWeight: 700,
            lineHeight: "14px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontFamily: FONT,
          }}
        >
          {title}
        </p>
        {subtitle && (
          <p
            className="mt-0.5 text-muted-foreground"
            style={{ fontSize: "11px", lineHeight: "15px", fontFamily: FONT }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FI({
  label,
  required,
  optional,
  helper,
  infoTitle,
  infoText,
  labelSuffix,
  children,
}: {
  label: string;
  required?: boolean;
  /** When true, renders a subtle "Optional" pill next to the label so
      the field reads as clearly-not-required even when the section is
      dense (buyer 2026-07-29: "the ship by date needs to look optional
      as well"). Mutually exclusive with `required`. */
  optional?: boolean;
  /** Helper text rendered under the field in muted small text. Accepts
      a ReactNode so callers can swap in a warning row (copy + Adjust) in
      place of the default helper when a validation rule fires. */
  helper?: React.ReactNode;
  /** Optional info-tooltip title (appears next to the label). Bolded
      title in the tooltip body. */
  infoTitle?: string;
  /** Optional info-tooltip body copy. Reveals on hover; delay comes
      from the shared TooltipProvider (500ms). */
  infoText?: string;
  /** Optional trailing slot in the label row — used by warning indicators
      that need to sit inline with the label rather than under the input
      (buyer 2026-08-04 / Eli: "inline colored warning text jams the line
      view"). */
  labelSuffix?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-muted-foreground flex items-center gap-1" style={{ fontSize: "10px", fontWeight: "var(--font-weight-semibold)", lineHeight: "14px", fontFamily: FONT, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        <span>{label} {required && <span className="text-destructive">*</span>}</span>
        {optional && (
          <span
            className="inline-flex items-center rounded-[var(--radius-sm)] px-1.5 py-px"
            style={{
              fontSize: "9px",
              fontWeight: 500,
              letterSpacing: "0.02em",
              textTransform: "none",
              backgroundColor: "hsl(var(--secondary))",
              color: "hsl(var(--muted-foreground))",
              lineHeight: "12px",
            }}
          >
            Optional
          </span>
        )}
        {infoText && (
          /* Hover tooltip — replaces the previous click-Popover so the
             info reveals with a gentle hover intent (500ms). Cleaner
             chrome (arrow pointer + tighter padding + inline title),
             feels more like a spec-sheet hint than a mini-modal. */
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center size-4 rounded-[var(--radius-sm)] text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
                aria-label={`${label} info`}
                onClick={(e) => e.stopPropagation()}
              >
                <Info className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="start"
              sideOffset={6}
              className="max-w-[260px] px-2.5 py-2 leading-snug"
              style={{ fontFamily: FONT }}
            >
              {infoTitle && (
                <p
                  className="mb-1"
                  style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.01em" }}
                >
                  {infoTitle}
                </p>
              )}
              <p style={{ fontSize: "10.5px", opacity: 0.92 }}>{infoText}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {labelSuffix && <span className="ml-auto inline-flex items-center">{labelSuffix}</span>}
      </label>
      {children}
      {helper && (
        <p className="mt-1 text-muted-foreground" style={{ fontSize: "10.5px", lineHeight: "14px", fontFamily: FONT }}>{helper}</p>
      )}
    </div>
  );
}