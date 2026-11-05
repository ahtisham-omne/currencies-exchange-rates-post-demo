/* ═══════════════════════════════════════════════════════════════
   PO Store — Simple module-level store for created Purchase Orders
   No external dependencies. Works as an in-memory singleton.
   ═══════════════════════════════════════════════════════════════ */

import { getVendorContacts, CATALOG, isItemFulfillableByVendor } from "./catalogData";
import { computePOPricing, lineAdjustmentsToPO, type POAdjustment, type LineOneTimeAdjustment } from "./poOrderPricing";

export type POStatus = "Draft" | "Sent" | "Confirmed" | "Partially Received" | "Fully Received" | "Cancelled" | "Active with Cancellations" | "Fully Received with Cancellations";

export interface ReceivingRecord {
  id: string;
  lineItemId: string;
  quantityReceived: number;
  receivedDate: string;
  receivedBy: string;
  condition: "good" | "damaged" | "rejected";
  notes: string;
}

export type PONoteType = "vendor" | "internal";

export interface PONote {
  id: string;
  type: PONoteType;
  text: string;
  author: string;
  authorInitials: string;
  timestamp: string;
  /** If set, this note belongs to a specific line item */
  lineItemId?: string;
}

export interface POLineItemInactive {
  /** Who marked the item master inactive (display name). */
  by: string;
  /** Their role, e.g. "Engineer". */
  role: string;
  /** ISO date the item was marked inactive. */
  at: string;
}

export interface POLineItem {
  id: string;
  itemNumber: string;
  descriptiveName: string;
  description?: string;
  image: string;
  unitPrice: number;
  vendorQty: number;
  vendorUOM: string;
  vendorUOMQty: number;
  quantity: number; // default UOM qty
  defaultUOM: string;
  discount: number;
  lineTotal: number;
  shipmentMethod: string;
  /** Pricing-rules activation set — the set of `VendorPricingRule.id`s
   *  currently applied to this specific line. Ported from Sales Orders
   *  2026-07-20; see purchase order snapshots/PO_PRICING_RULES_PORT_AUDIT.md.
   *  Unset / empty = no rules active on this line. A rule can be attached
   *  to the vendor's book AND applicable to this itemNumber but still
   *  inactive on this specific line (buyer toggled it off for this line
   *  only). Compute logic lives in `poPricingRulesData.ts`. */
  activatedRuleIds?: string[];
  /** Buyer-entered "when we need this shipped from the vendor" date.
   *  Was `dueDeliveryDate` in the previous data model — semantically the
   *  same field, renamed for clarity. Read paths still tolerate the old
   *  key via `hydrateLegacyLineItem`. */
  needByDate: string;
  /** Vendor's committed ship date (optional). If the vendor doesn't
   *  commit / slips, this stays empty and `expectedDeliveryDate` shows
   *  "Pending promised ship date". */
  promisedShipDate?: string;
  /** Derived = `promisedShipDate + transit(shipmentMethod)`. Optional
   *  because we compute it lazily via `computeExpectedDeliveryDate`
   *  everywhere it's displayed; storing it here is cache-only. */
  expectedDeliveryDate?: string;
  inboundLocation: string;
  category: string;
  receivedQuantity: number;
  shipByDate?: string;
  cancelled?: boolean;
  cancelledDate?: string;
  /** Unreceived quantity cancelled by "Cancel remaining" on a partly
   *  received line; `quantity` is trimmed to what was received. */
  cancelledQuantity?: number;
  /** Set when the item master was marked inactive after this line was
   *  added. Inactive never cancels an existing PO — the line stays and
   *  can be worked on — but moving a Draft toward an active state
   *  surfaces a non-blocking warning (see PurchaseOrderDraft). */
  inactive?: POLineItemInactive;
  /** Set at Duplicate PO time on lines whose new vendor doesn't carry
   *  the item — the buyer hasn't yet decided whether to Remove the line
   *  or Qualify it for the new vendor. Value is the new vendor name.
   *  Draft surfaces this as a "Needs review" chip + amber row highlight
   *  above the Line Items table so the decision happens inline instead
   *  of in a modal step. Cleared when the buyer picks Qualify (value
   *  moves into `qualifiedForVendor`) or when the line is removed. */
  needsQualificationForVendor?: string;
  /** Vendor ship-from location for THIS line item (2026-07-28). Ship-
   *  from is per-line — different lines on the same PO can source from
   *  different vendor locations. Seeded at Duplicate PO time from the
   *  modal's picked location (or the vendor's default), then adjustable
   *  per row on the Draft. Undefined on lines that predate the field or
   *  when the vendor has no location catalog. */
  vendorLocationId?: string;
  vendorLocationName?: string;
  /** Set when the buyer chose "Qualify for this vendor" on a line whose
   *  new vendor doesn't carry the item. Value is the vendor name it was
   *  qualified against. Downstream UIs surface a "Qualified" chip so
   *  the buyer remembers the line needs a follow-up item↔vendor setup
   *  in Partners. Cleared when the line is edited via OrderFlow (a real
   *  vendor pick supersedes the qualification). */
  qualifiedForVendor?: string;
  /** Scope of the qualification decision (2026-07-28), mirroring the
   *  "Add to Qualified Vendor & Use Here" vs "Add on This PO Only"
   *  pattern from the price-add flow (`PriceConfirmationDialog`).
   *    · "vendor"  — buyer added the item↔vendor pairing globally;
   *                  future POs on this vendor will see the item as
   *                  qualified without prompting.
   *    · "po-only" — buyer kept the qualification scoped to this PO;
   *                  the master item↔vendor mapping is untouched.
   *  Undefined on lines that predate the scope prompt (treated as
   *  "po-only" for tooltip purposes). */
  qualifiedScope?: "vendor" | "po-only";
  /** Set at duplicate time when the CURRENT catalog price for this
   *  itemNumber differs from the price on the SOURCE PO's line (i.e.
   *  the catalog moved between the original PO and the duplicate).
   *  Value is the current catalog unit price. Draft surfaces this as
   *  a "Price changed" chip so the buyer knows the number is stale
   *  and can decide whether to sync to the new price. Cleared when
   *  the buyer edits the line's unit price (implicit acknowledgement). */
  priceChangedFromCatalog?: number;
}

export interface POVendor {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
}

export interface PORecipient {
  name: string;
  role: string;
  email: string;
  phone: string;
}

export interface POPaymentDelivery {
  paymentTerms: string;
  payTo: string;
  paymentMethod: string;
  shippedTo: string;
  fundedBy: string;
}

export type POVersionStatus = "draft" | "sent" | "confirmed" | "partially-received";

/* Version-change taxonomy — mirrors the Sales Order module's
   `VersionChangeType` (`omne-erp/src/modules/sales/types/versions.ts`)
   so the two modules can render the same categories. `vendor-changed`
   is the PO-side equivalent of SO's `customer-changed`. */
export type POChangeType =
  | "line-item-added"
  | "line-item-removed"
  | "line-item-modified"
  | "pricing-changed"
  | "vendor-changed"
  | "config-changed"
  | "attachment-added"
  | "rule-applied"
  | "adjustment-applied";

export interface POChangeRecord {
  id: string;
  type: POChangeType;
  action: "Added" | "Removed" | "Changed";
  subject: string;
  /** Optional secondary line under the subject (e.g. "Unit price · $12 → $14").
      Matches SO's `subjectDetail` field. */
  subjectDetail?: string;
  detail?: string;
  /** Reference to the item / attachment / rule this change touches
      (mirrors SO's `itemRef`). Kept optional so existing rows stay valid. */
  itemRef?: string;
  timestamp: string;
  user: string;
  /** Pre-computed initials for the author avatar. Mirrors SO's `initials`
      so the row renderer doesn't have to derive them. */
  initials?: string;
}

export interface POLineItemSnapshot {
  id: string;
  itemNumber: string;
  descriptiveName: string;
  quantity: number;
  vendorQty: number;
  vendorUOM: string;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  needByDate: string;
  promisedShipDate?: string;
  inboundLocation: string;
  cancelled?: boolean;
}

export interface POVersionSnapshot {
  poNumber: string;
  vendorName: string;
  status: POStatus;
  deliveryDate: string;
  notes: string;
  lineItemCount: number;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  total: number;
  payment: POPaymentDelivery;
  lineItems: POLineItemSnapshot[];
  /** One-time discounts/premiums at this version (so revert/restore
   *  brings them back). */
  adjustments?: POAdjustment[];
  vendor?: POVendor;
  recipient?: PORecipient;
  secondaryContactNames?: string[];
  orderDate?: string;
  confirmationDate?: string | null;
  sentDate?: string | null;
}

export interface POVersionEntry {
  version: number;
  versionStatus: POVersionStatus;
  createdAt: string;
  createdBy: string;
  avatar: string;
  reason: string;
  changes: POChangeRecord[];
  snapshot: POVersionSnapshot;
  isRevert?: boolean;
  revertedFrom?: number;
  changeTags?: string[];
  previousStatus?: string;
  newStatus?: string;
  /* Latest revert reason stamped when the buyer reverts the PO to
     this version. Populated by `revertPOToVersion`. Buyer 2026-07-31
     wanted the reason surfaced on the version card. Overwritten each
     time the same version is reverted to (we only keep the most
     recent). */
  revertReason?: string;
  revertReasonAt?: string;
  revertReasonBy?: string;
}

export interface PurchaseOrderData {
  id: string;
  poNumber: string;
  status: POStatus;
  orderDate: string;
  deliveryDate: string;
  confirmationDate: string | null;
  sentDate: string | null;
  receivingStartDate: string | null;
  vendor: POVendor;
  recipient: PORecipient;
  secondaryContactNames: string[];
  lineItems: POLineItem[];
  payment: POPaymentDelivery;
  subtotal: number;
  shippingFee: number;
  discountTotal: number;
  total: number;
  notes: string;
  /** Structured notes (vendor-facing + internal, PO-level + line-item-level) */
  poNotes: PONote[];
  /** Pricing-rules — PO-wide deactivation set. When a rule id is in this
   *  set the rule is considered wholesale-off on this PO regardless of
   *  any per-line activation state (per-line wins when NOT in this set,
   *  loses when it IS). Also records the reason the rule was
   *  deactivated so the manage modal can render the right explainer —
   *  buyers can reactivate `USER_UNAPPLIED` but not `EXCEEDS_100_PERCENT`. */
  deactivatedRuleIds?: Record<string, "USER_UNAPPLIED" | "EXCEEDS_100_PERCENT">;
  /** One-time discounts/premiums (order-level `scope: 'quote'` and
   *  item-level `scope: 'item'` + `appliedTo`). Ported from Sales
   *  Orders — see `poOrderPricing.ts`. Included in `total`. */
  adjustments?: POAdjustment[];
  createdBy: string;
  /** ISO timestamp of when the PO was first created (versioning row
      init). Same value as `versions[0].createdAt` — surfaced here so
      the sidebar's People section can read it without walking
      versions. */
  createdAt?: string;
  /** Person who approved the PO for sending. Optional — Draft POs
      may not have an approval yet. Set when a buyer with authority
      transitions the PO out of Draft. */
  approvedBy?: string;
  /** ISO timestamp of the approval event. Paired with approvedBy. */
  approvedAt?: string;
  receivingRecords: ReceivingRecord[];
  currentVersion: number;
  versions: POVersionEntry[];
  /* Cancellation fields */
  preCancellationStatus?: POStatus;
  cancellationReason?: string;
  cancellationNotes?: string;
  cancellationDate?: string;
  reactivationReason?: string;
  /* Archive fields (ERP-4744 / ERP-4772) — set while the PO is
     archived; cleared on restore. */
  archivedDate?: string;
  archiveReason?: string;
  /**
   * Audit linkage — Procurement Planner Sandbox provenance.
   *
   * When a PO is created from the Sandbox, this array holds the IDs of the
   * `PlannerDemandEvent` records the proposal was designed to cover (the SO
   * lines / Requests / forecast entries that drove the shortage). Lets the
   * PO Detail page surface a "Created from Planner" badge with a list of
   * triggering demand events, and lets the Cause modal reverse-resolve from
   * "this PO" → "the demand it satisfies."
   *
   * Optional — only Sandbox-created POs populate it. Buy-now / catalogue
   * creation paths leave it undefined, which the UI reads as "ad-hoc, not
   * planner-driven."
   */
  linkedDemandIds?: string[];
}

/* ── Vendor defaults (pulled from "system") ── */

const VENDOR_DETAILS: Record<string, Omit<POVendor, "name">> = {
  "General Motors (GM)": {
    address: "300 Renaissance Center, Detroit, MI 48265",
    phone: "+1 (313) 556-5000",
    email: "procurement@gm.com",
    taxId: "38-0572515",
  },
  "Toyota Technical Center (TTC)": {
    address: "1555 Woodridge Ave, Ann Arbor, MI 48105",
    phone: "+1 (734) 995-2600",
    email: "sourcing@toyota-tech.com",
    taxId: "38-2745861",
  },
  "Ford Motor Company": {
    address: "One American Road, Dearborn, MI 48126",
    phone: "+1 (313) 322-3000",
    email: "supply.chain@ford.com",
    taxId: "38-0549190",
  },
  "Tesla, Inc.": {
    address: "3500 Deer Creek Rd, Palo Alto, CA 94304",
    phone: "+1 (650) 681-5000",
    email: "vendorops@tesla.com",
    taxId: "91-2197729",
  },
  "Chrysler (Stellantis N.V.)": {
    address: "1000 Chrysler Dr, Auburn Hills, MI 48326",
    phone: "+1 (248) 576-5741",
    email: "purchasing@stellantis.com",
    taxId: "38-1612444",
  },
  "Honda Motor Co., Ltd. (USA)": {
    address: "1919 Torrance Blvd, Torrance, CA 90501",
    phone: "+1 (310) 783-2000",
    email: "parts.procurement@honda.com",
    taxId: "95-3025497",
  },
  "Nissan North America": {
    address: "One Nissan Way, Franklin, TN 37067",
    phone: "+1 (615) 725-1000",
    email: "supply@nissan-usa.com",
    taxId: "62-1310715",
  },
  "BMW of North America": {
    address: "300 Chestnut Ridge Rd, Woodcliff Lake, NJ 07677",
    phone: "+1 (201) 307-4000",
    email: "procurement@bmwna.com",
    taxId: "22-2478476",
  },
  "Rivian Automotive": {
    address: "14600 Myford Rd, Irvine, CA 92606",
    phone: "+1 (888) 748-4261",
    email: "supply.chain@rivian.com",
    taxId: "83-1632215",
  },
  "Lucid Motors": {
    address: "7373 Gateway Blvd, Newark, CA 94560",
    phone: "+1 (510) 648-3553",
    email: "vendoraccts@lucidmotors.com",
    taxId: "46-5554035",
  },
};

const DEFAULT_VENDOR: Omit<POVendor, "name"> = {
  address: "123 Industrial Pkwy, Unknown City, ST 00000",
  phone: "+1 (555) 000-0000",
  email: "info@vendor.com",
  taxId: "00-0000000",
};

/* ── Payment defaults ── */

const PAYMENT_DEFAULTS: Record<string, POPaymentDelivery> = {
  "General Motors (GM)": { paymentTerms: "Net 30", payTo: "General Motors Financial", paymentMethod: "Wire Transfer", shippedTo: "Omne Warehouse Network", fundedBy: "Omne Manufacturing Corp." },
  "Toyota Technical Center (TTC)": { paymentTerms: "Net 45", payTo: "Toyota Motor Credit", paymentMethod: "ACH Transfer", shippedTo: "Northeast Fulfillment", fundedBy: "Omne Manufacturing Corp." },
  "Ford Motor Company": { paymentTerms: "Net 30", payTo: "Ford Motor Credit", paymentMethod: "Wire Transfer", shippedTo: "Great Lakes Depot", fundedBy: "Omne Manufacturing Corp." },
  "Tesla, Inc.": { paymentTerms: "Net 15", payTo: "Tesla Financial Services", paymentMethod: "Wire Transfer", shippedTo: "Pacific Distribution Hub", fundedBy: "Omne Manufacturing Corp." },
  "Chrysler (Stellantis N.V.)": { paymentTerms: "Net 30", payTo: "Stellantis Financial", paymentMethod: "ACH Transfer", shippedTo: "Southern Cross Logistics", fundedBy: "Omne Manufacturing Corp." },
};

const DEFAULT_PAYMENT: POPaymentDelivery = {
  paymentTerms: "Net 30",
  payTo: "General Motors Financial",
  paymentMethod: "Wire Transfer",
  shippedTo: "Omne Warehouse Network",
  fundedBy: "Omne Manufacturing Corp.",
};

const SHIPMENT_METHOD_LABELS: Record<string, string> = {
  "fedex-ground": "FedEx Ground",
  "fedex-express": "FedEx Express",
  "fedex-freight": "FedEx Freight",
  "air-standard": "Air - Standard",
  "air-express": "Air - Express",
};

/**
 * Rough transit-days lookup for a shipmentMethod code. Mirrors the
 * `SHIPPING_CARRIERS_DATA` ETAs in `ShippingCarrierPicker.tsx` closely
 * enough that the header/list surfaces (which don't import the carrier
 * data) can still derive an `expectedDeliveryDate` without depending on
 * that heavier module.
 *
 * Kept intentionally simple — the source of truth for the Items Detail
 * Modal is still `findCarrierAndMethod(...).method.eta`.
 */
const TRANSIT_DAYS_BY_METHOD: Record<string, number> = {
  "fedex-ground": 5,
  "fedex-express": 2,
  "fedex-freight": 7,
  "air-standard": 3,
  "air-express": 1,
  Standard: 5,
  Ground: 5,
  "Standard Ground": 5,
};

/**
 * Compute the expected delivery date for a single line = promised ship
 * date + transit days for the selected shipping method. Returns null
 * when the vendor hasn't promised a ship date yet, or the method is
 * unknown to the transit lookup.
 */
export function computeExpectedDeliveryDate(
  promisedShipDate?: string,
  shipmentMethod?: string,
): string | null {
  if (!promisedShipDate || !shipmentMethod) return null;
  const transit = TRANSIT_DAYS_BY_METHOD[shipmentMethod];
  if (!transit) return null;
  const d = new Date(promisedShipDate + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + transit);
  return d.toISOString().split("T")[0];
}

/**
 * Expected PO completion = max(expectedDeliveryDate) across active lines.
 * Falls back to max(needByDate) if no line has a promisedShipDate yet
 * so the header still surfaces something meaningful.
 */
export function computeExpectedPOCompletion(po: PurchaseOrderData): string | null {
  if (!po.lineItems || po.lineItems.length === 0) return null;
  const active = po.lineItems.filter((li) => !li.cancelled);
  const source = active.length > 0 ? active : po.lineItems;

  const expected: string[] = [];
  for (const li of source) {
    const ed =
      li.expectedDeliveryDate ||
      computeExpectedDeliveryDate(li.promisedShipDate, li.shipmentMethod);
    if (ed) expected.push(ed);
  }
  if (expected.length > 0) {
    return expected.reduce((a, b) => (a > b ? a : b));
  }
  // Fallback: latest need-by across the lines.
  const needBys = source.map((li) => li.needByDate).filter(Boolean);
  if (needBys.length === 0) return null;
  return needBys.reduce((a, b) => (a > b ? a : b));
}

/**
 * Tolerant hydration for line items loaded from legacy sources (older
 * localStorage seeds, snapshot revert payloads). Accepts either the new
 * `needByDate` or the legacy `dueDeliveryDate` and returns a POLineItem
 * with the canonical shape. Extra fields on `raw` are preserved so
 * callers can spread it without losing metadata.
 */
export function hydrateLegacyLineItem<T extends Record<string, any>>(raw: T): T & { needByDate: string } {
  if (typeof raw.needByDate === "string" && raw.needByDate) return raw as T & { needByDate: string };
  const legacy = (raw as any).dueDeliveryDate;
  if (typeof legacy === "string") {
    return { ...raw, needByDate: legacy } as T & { needByDate: string };
  }
  return { ...raw, needByDate: "" } as T & { needByDate: string };
}

function toVersionStatus(status: POStatus): POVersionStatus {
  if (status === "Draft") return "draft";
  if (status === "Sent") return "sent";
  if (status === "Partially Received") return "partially-received";
  return "confirmed";
}

function clonePayment(payment: POPaymentDelivery): POPaymentDelivery {
  return {
    paymentTerms: payment.paymentTerms,
    payTo: payment.payTo,
    paymentMethod: payment.paymentMethod,
    shippedTo: payment.shippedTo,
    fundedBy: payment.fundedBy,
  };
}

/** Recompute the stored money fields from the shared pricing engine
 *  (`poOrderPricing.computePOPricing`): subtotal, line-% discount total,
 *  and a total that includes pricing rules + one-time adjustments.
 *  Shipping stays on `shippingFee` but is excluded from `total`. Also
 *  refreshes each line's `lineTotal` (static % discount only). */
export function applyComputedTotals(po: PurchaseOrderData): PurchaseOrderData {
  /* Keep item-level adjustments pointing only at lines that still
     exist; drop ones left with no lines. */
  if (po.adjustments) {
    const ids = new Set(po.lineItems.map((li) => li.id));
    po.adjustments = po.adjustments.flatMap((a) => {
      if (a.scope !== "item") return [a];
      const appliedTo = (a.appliedTo ?? []).filter((id) => ids.has(id));
      return appliedTo.length > 0 ? [{ ...a, appliedTo }] : [];
    });
  }
  for (const li of po.lineItems) {
    li.lineTotal = li.unitPrice * li.quantity * (1 - li.discount / 100);
  }
  const p = computePOPricing(po);
  po.subtotal = p.subtotal;
  po.discountTotal = p.lineDiscountTotal;
  po.total = p.total;
  return po;
}

export function buildVersionSnapshot(po: PurchaseOrderData): POVersionSnapshot {
  return {
    poNumber: po.poNumber,
    vendorName: po.vendor.name,
    status: po.status,
    deliveryDate: po.deliveryDate,
    notes: po.notes,
    lineItemCount: po.lineItems.length,
    adjustments: (po.adjustments ?? []).map((a) => ({ ...a, appliedTo: a.appliedTo ? [...a.appliedTo] : undefined })),
    subtotal: po.subtotal,
    discountTotal: po.discountTotal,
    shippingFee: po.shippingFee,
    total: po.total,
    payment: clonePayment(po.payment),
    lineItems: po.lineItems.map((li) => ({
      id: li.id,
      itemNumber: li.itemNumber,
      descriptiveName: li.descriptiveName,
      quantity: li.quantity,
      vendorQty: li.vendorQty,
      vendorUOM: li.vendorUOM,
      unitPrice: li.unitPrice,
      discount: li.discount,
      lineTotal: li.lineTotal,
      needByDate: li.needByDate,
      promisedShipDate: li.promisedShipDate,
      inboundLocation: li.inboundLocation,
      cancelled: li.cancelled,
    })),
    vendor: { ...po.vendor },
    recipient: { ...po.recipient },
    secondaryContactNames: [...po.secondaryContactNames],
    orderDate: po.orderDate,
    confirmationDate: po.confirmationDate,
    sentDate: po.sentDate,
  };
}

function initVersioning(po: PurchaseOrderData, reason = "Initial PO created"): PurchaseOrderData {
  const baseVersion: POVersionEntry = {
    version: 1,
    versionStatus: toVersionStatus(po.status),
    createdAt: new Date().toISOString(),
    createdBy: po.createdBy,
    avatar: "AT",
    reason,
    changes: [
      {
        id: `chg-${po.id}-v1`,
        type: "config-changed",
        action: "Added",
        subject: "Purchase Order Created",
        detail: `${po.lineItems.length} items · $${po.total.toFixed(2)}`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        user: po.createdBy,
      },
    ],
    snapshot: buildVersionSnapshot(po),
  };

  return {
    ...po,
    currentVersion: 1,
    versions: [baseVersion],
  };
}

/* ── Store ── */

let poCounter = 0;
const purchaseOrders: Map<string, PurchaseOrderData> = new Map();
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeToPOStore(fn: () => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getAllPOs(): PurchaseOrderData[] {
  return Array.from(purchaseOrders.values());
}

export function getPO(id: string): PurchaseOrderData | undefined {
  return purchaseOrders.get(id);
}

export function getShipmentMethodLabel(value: string): string {
  return SHIPMENT_METHOD_LABELS[value] || value;
}

export function getPOVersions(poId: string): POVersionEntry[] {
  const po = purchaseOrders.get(poId);
  if (!po) return [];
  return [...po.versions].sort((a, b) => b.version - a.version);
}

export function getPOVersionCount(poId: string): number {
  const po = purchaseOrders.get(poId);
  return po?.versions.length || 0;
}

export function recordPOVersion(
  poId: string,
  payload: {
    reason: string;
    createdBy?: string;
    changes: Array<Omit<POChangeRecord, "id" | "timestamp" | "user">>;
    isRevert?: boolean;
    revertedFrom?: number;
    changeTags?: string[];
    previousStatus?: string;
    newStatus?: string;
    resetToDraft?: boolean;
  }
): number | null {
  const po = purchaseOrders.get(poId);
  if (!po) return null;

  const newVersion = (po.currentVersion || 1) + 1;
  const user = payload.createdBy || po.createdBy;

  const versionEntry: POVersionEntry = {
    version: newVersion,
    versionStatus: payload.resetToDraft ? "draft" : toVersionStatus(po.status),
    createdAt: new Date().toISOString(),
    createdBy: user,
    avatar: user
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    reason: payload.reason,
    isRevert: payload.isRevert,
    revertedFrom: payload.revertedFrom,
    changeTags: payload.changeTags,
    previousStatus: payload.previousStatus,
    newStatus: payload.newStatus,
    changes: payload.changes.map((c, idx) => ({
      ...c,
      id: `chg-${po.id}-v${newVersion}-${idx + 1}`,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      user,
    })),
    snapshot: buildVersionSnapshot(po),
  };

  po.currentVersion = newVersion;
  po.versions = [versionEntry, ...(po.versions || [])];

  // Reset PO to Draft if requested
  if (payload.resetToDraft) {
    po.status = "Draft";
    po.sentDate = null;
    po.confirmationDate = null;
    po.receivingStartDate = null;
  }

  purchaseOrders.set(poId, { ...po });
  notify();
  return newVersion;
}

/** Restore ALL PO fields from a snapshot (used by discard-changes flow) */
export function restorePOFromSnapshot(poId: string, snapshot: POVersionSnapshot): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;

  // Restore vendor
  if (snapshot.vendor) {
    po.vendor = { ...snapshot.vendor };
  }
  // Restore recipient
  if (snapshot.recipient) {
    po.recipient = { ...snapshot.recipient };
  }
  // Restore secondary contacts
  if (snapshot.secondaryContactNames) {
    po.secondaryContactNames = [...snapshot.secondaryContactNames];
  }
  // Restore payment
  po.payment = clonePayment(snapshot.payment);
  // Restore dates
  po.deliveryDate = snapshot.deliveryDate;
  po.notes = snapshot.notes;
  if (snapshot.orderDate !== undefined) po.orderDate = snapshot.orderDate;
  if (snapshot.confirmationDate !== undefined) po.confirmationDate = snapshot.confirmationDate;
  if (snapshot.sentDate !== undefined) po.sentDate = snapshot.sentDate;

  // Restore line items — rebuild with images/categories from current PO.
  // Tolerate legacy `dueDeliveryDate` on the snapshot payload (older seeds).
  po.lineItems = snapshot.lineItems.map((li, idx) => {
    const existing = po.lineItems.find((x) => x.itemNumber === li.itemNumber);
    const shipmentMethod = existing?.shipmentMethod || "fedex-ground";
    const needByDate = li.needByDate || (li as any).dueDeliveryDate || "";
    const promisedShipDate = li.promisedShipDate || existing?.promisedShipDate;
    return {
      id: li.id || `${poId}-restore-${idx + 1}-${Date.now()}`,
      itemNumber: li.itemNumber,
      descriptiveName: li.descriptiveName,
      image: existing?.image || "",
      unitPrice: li.unitPrice,
      vendorQty: li.vendorQty,
      vendorUOM: li.vendorUOM,
      vendorUOMQty: existing?.vendorUOMQty || Math.max(1, Math.round(li.quantity / Math.max(1, li.vendorQty))),
      quantity: li.quantity,
      defaultUOM: existing?.defaultUOM || "Unit",
      discount: li.discount,
      lineTotal: li.lineTotal,
      shipmentMethod,
      needByDate,
      promisedShipDate,
      expectedDeliveryDate:
        computeExpectedDeliveryDate(promisedShipDate, shipmentMethod) || undefined,
      inboundLocation: li.inboundLocation,
      category: existing?.category || "",
      receivedQuantity: existing?.receivedQuantity || 0,
      shipByDate: existing?.shipByDate,
      cancelled: li.cancelled,
      cancelledDate: existing?.cancelledDate,
    };
  });

  // Restore one-time adjustments (remap snapshot line ids → restored ids)
  const restoreIdMap = new Map(snapshot.lineItems.map((li, idx) => [li.id, po.lineItems[idx]?.id]));
  po.adjustments = (snapshot.adjustments ?? []).map((a) => ({
    ...a,
    appliedTo: a.appliedTo?.map((id) => restoreIdMap.get(id) ?? id),
  }));

  // Restore totals — recomputed so they include rules + adjustments
  po.shippingFee = snapshot.shippingFee;
  applyComputedTotals(po);

  purchaseOrders.set(poId, { ...po });
  notify();
}

/**
 * Revert the PO to a prior version. No new version entry is created —
 * `currentVersion` simply points back at the picked version, and PO
 * top-level fields are restored from that version's snapshot.
 * Buyer decision 2026-07-21: "reverting = same version becomes current
 * again", so intermediate versions stay in history but the reverted-to
 * version is Latest/Current.
 */
export function revertPOToVersion(poId: string, version: number, reason: string): number | null {
  const po = purchaseOrders.get(poId);
  if (!po) return null;
  // Receiving has started → PO is locked to its current version.
  if (isPOVersionLocked(po)) return null;
  const source = po.versions.find((v) => v.version === version);
  if (!source) return null;

  /* Stamp the revert reason onto the source version so the version
     card can render it. Overwrites any prior revert reason for the
     same version — we only surface the latest one. */
  if (reason && reason.trim()) {
    source.revertReason = reason.trim();
    source.revertReasonAt = new Date().toISOString();
    source.revertReasonBy = po.createdBy;
  }

  po.deliveryDate = source.snapshot.deliveryDate;
  po.notes = source.snapshot.notes;
  po.payment = clonePayment(source.snapshot.payment);
  po.lineItems = source.snapshot.lineItems.map((li, idx) => {
    const match = po.lineItems.find((x) => x.itemNumber === li.itemNumber);
    const shipmentMethod = match?.shipmentMethod || "fedex-ground";
    const needByDate = li.needByDate || (li as any).dueDeliveryDate || "";
    const promisedShipDate = li.promisedShipDate;
    return {
      id: `${po.id}-rv-${idx + 1}-${Date.now()}`,
      itemNumber: li.itemNumber,
      descriptiveName: li.descriptiveName,
      image: match?.image || "",
      unitPrice: li.unitPrice,
      vendorQty: li.vendorQty,
      vendorUOM: li.vendorUOM,
      vendorUOMQty: Math.max(1, Math.round(li.quantity / Math.max(1, li.vendorQty))),
      quantity: li.quantity,
      defaultUOM: match?.defaultUOM || "Unit",
      discount: li.discount,
      lineTotal: li.lineTotal,
      shipmentMethod,
      needByDate,
      promisedShipDate,
      expectedDeliveryDate:
        computeExpectedDeliveryDate(promisedShipDate, shipmentMethod) || undefined,
      inboundLocation: li.inboundLocation,
      category: match?.category || "",
      receivedQuantity: 0,
      cancelled: li.cancelled,
    };
  });
  const revertIdMap = new Map(source.snapshot.lineItems.map((li, idx) => [li.id, po.lineItems[idx]?.id]));
  po.adjustments = (source.snapshot.adjustments ?? []).map((a) => ({
    ...a,
    appliedTo: a.appliedTo?.map((id) => revertIdMap.get(id) ?? id),
  }));
  po.shippingFee = source.snapshot.shippingFee;
  applyComputedTotals(po);

  po.currentVersion = version;

  purchaseOrders.set(poId, { ...po });
  notify();

  return version;
}

/** Create a PO from a vendor checkout (multiple items for one vendor) */
export function createPOFromVendorCheckout(
  vendorName: string,
  items: Array<{
    id: string;
    itemNumber: string;
    descriptiveName: string;
    image: string;
    unitPrice: number;
    vendorQty: number;
    vendorUOM: string;
    vendorUOMQty: number;
    quantity: number;
    defaultUOM: string;
    discount: number;
    shipByDate?: string;
    shipmentMethod: string;
    needByDate: string;
    promisedShipDate?: string;
    /** Buyer-entered primary date from the Items Detail Modal — required
     *  for the Send-to-Vendor gate. Preferred over the
     *  promisedShipDate+shipmentMethod fallback which was returning null
     *  because both source fields are now optional. */
    expectedDeliveryDate?: string;
    inboundLocation: string;
    category: string;
    /** Item-level one-time discounts/premiums added in the Items Detail
     *  Modal / cart. Become PO adjustments scoped to this line. */
    oneTimeAdjustments?: LineOneTimeAdjustment[];
  }>,
  notes?: string,
  /** Audit linkage — when the caller is the Procurement Planner Sandbox,
      these are the PlannerDemandEvent IDs the proposed PO was designed to
      cover. Lands on `PurchaseOrderData.linkedDemandIds`. Buy-now / catalogue
      / cart paths omit this. */
  linkedDemandIds?: string[],
): PurchaseOrderData {
  poCounter++;
  const id = `po-new-${poCounter}`;
  const poNumber = `395-${9900 + poCounter}`;

  const vendorInfo = VENDOR_DETAILS[vendorName] || DEFAULT_VENDOR;
  const contact = getVendorContacts(vendorName)[poCounter % getVendorContacts(vendorName).length];
  const payment = { ...(PAYMENT_DEFAULTS[vendorName] || DEFAULT_PAYMENT) };

  // Derive shipping destination from first item's inbound location
  if (items.length > 0 && items[0].inboundLocation) {
    payment.shippedTo = items[0].inboundLocation;
  }

  const checkoutAdjustments: POAdjustment[] = items.flatMap((item) => lineAdjustmentsToPO(item.id, item.oneTimeAdjustments));
  const lineItems: POLineItem[] = items.map(({ oneTimeAdjustments: _adj, ...item }) => {
    const lineTotal = item.unitPrice * item.quantity * (1 - item.discount / 100);
    return {
      ...item,
      lineTotal,
      receivedQuantity: 0,
      /* Prefer the buyer-entered expectedDeliveryDate (primary field per
         the 2026-07-29 date model). Fall back to the derived value when
         the caller didn't provide one — legacy paths still work. */
      expectedDeliveryDate:
        item.expectedDeliveryDate ||
        computeExpectedDeliveryDate(item.promisedShipDate, item.shipmentMethod) ||
        undefined,
    };
  });

  const shippingFee = Math.round(lineItems.length * 12.5 * 100) / 100; // mock shipping (excluded from total)

  const now = new Date();
  const deliveryDate = items[0]?.needByDate || new Date(now.getTime() + 14 * 86400000).toISOString().split("T")[0];

  const po: PurchaseOrderData = {
    id,
    poNumber,
    status: "Draft",
    orderDate: now.toISOString().split("T")[0],
    deliveryDate,
    confirmationDate: null,
    sentDate: null,
    receivingStartDate: null,
    vendor: { name: vendorName, ...vendorInfo },
    recipient: contact,
    secondaryContactNames: [],
    lineItems,
    payment,
    subtotal: 0,
    shippingFee,
    discountTotal: 0,
    total: 0,
    adjustments: checkoutAdjustments,
    notes: notes || "",
    poNotes: [],
    createdBy: "Areeb Tanvir",
    receivingRecords: [],
    currentVersion: 1,
    versions: [],
    linkedDemandIds: linkedDemandIds && linkedDemandIds.length > 0 ? [...linkedDemandIds] : undefined,
  };
  applyComputedTotals(po);

  purchaseOrders.set(id, initVersioning(po));
  notify();
  return purchaseOrders.get(id)!;
}

/** Create a PO from BuyNow flow (single item) */
export function createPOFromBuyNow(
  item: {
    id: string;
    itemNumber: string;
    descriptiveName: string;
    image: string;
    unitPrice: number;
    vendorUOM: string;
    vendorUOMQty: number;
    defaultUOM: string;
    discount: number;
    partnerLocation: string;
    category: string;
  },
  orderDetails: {
    vendorQty: number;
    quantity: number;
    shipByDate?: string;
    shipmentMethod: string;
    needByDate: string;
    promisedShipDate?: string;
    /** Buyer-entered primary date. Preferred over the derived value so
     *  the resulting PO's send gate can pass. */
    expectedDeliveryDate?: string;
    inboundLocation: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    notes: string;
    totalPrice: number;
    /** Item-level one-time discounts/premiums from the Items Detail Modal. */
    oneTimeAdjustments?: LineOneTimeAdjustment[];
  }
): PurchaseOrderData {
  poCounter++;
  const id = `po-new-${poCounter}`;
  const poNumber = `395-${9900 + poCounter}`;

  const vendorName = item.partnerLocation;
  const vendorInfo = VENDOR_DETAILS[vendorName] || DEFAULT_VENDOR;
  const payment = { ...(PAYMENT_DEFAULTS[vendorName] || DEFAULT_PAYMENT) };
  if (orderDetails.inboundLocation) payment.shippedTo = orderDetails.inboundLocation;

  const lineTotal = item.unitPrice * orderDetails.quantity * (1 - item.discount / 100);

  const lineItem: POLineItem = {
    id: item.id,
    itemNumber: item.itemNumber,
    descriptiveName: item.descriptiveName,
    image: item.image,
    unitPrice: item.unitPrice,
    vendorQty: orderDetails.vendorQty,
    vendorUOM: item.vendorUOM,
    vendorUOMQty: item.vendorUOMQty,
    quantity: orderDetails.quantity,
    defaultUOM: item.defaultUOM,
    discount: item.discount,
    lineTotal,
    shipByDate: orderDetails.shipByDate,
    shipmentMethod: orderDetails.shipmentMethod,
    needByDate: orderDetails.needByDate,
    promisedShipDate: orderDetails.promisedShipDate,
    expectedDeliveryDate:
      orderDetails.expectedDeliveryDate ||
      computeExpectedDeliveryDate(orderDetails.promisedShipDate, orderDetails.shipmentMethod) ||
      undefined,
    inboundLocation: orderDetails.inboundLocation,
    category: item.category,
    receivedQuantity: 0,
  };

  const shippingFee = 12.5; // mock shipping (excluded from total)

  const now = new Date();

  const recipient: PORecipient = {
    name: orderDetails.contactName,
    role: getVendorContacts(vendorName).find((c) => c.name === orderDetails.contactName)?.role || "Vendor Contact",
    email: orderDetails.contactEmail,
    phone: orderDetails.contactPhone,
  };

  const po: PurchaseOrderData = {
    id,
    poNumber,
    status: "Draft",
    orderDate: now.toISOString().split("T")[0],
    deliveryDate: orderDetails.needByDate,
    confirmationDate: null,
    sentDate: null,
    receivingStartDate: null,
    vendor: { name: vendorName, ...vendorInfo },
    recipient,
    secondaryContactNames: [],
    lineItems: [lineItem],
    payment,
    subtotal: 0,
    shippingFee,
    discountTotal: 0,
    total: 0,
    adjustments: lineAdjustmentsToPO(lineItem.id, orderDetails.oneTimeAdjustments),
    notes: orderDetails.notes,
    poNotes: [],
    createdBy: "Areeb Tanvir",
    receivingRecords: [],
    currentVersion: 1,
    versions: [],
  };
  applyComputedTotals(po);

  purchaseOrders.set(id, initVersioning(po));
  notify();
  return purchaseOrders.get(id)!;
}

/** Update PO status (lifecycle transition touchpoint) */
export function updatePOStatus(id: string, newStatus: POStatus): void {
  const po = purchaseOrders.get(id);
  if (!po) return;

  po.status = newStatus;
  const today = new Date().toISOString().split("T")[0];

  if (newStatus === "Confirmed" && !po.confirmationDate) {
    po.confirmationDate = today;
  }
  if (newStatus === "Sent" && !po.sentDate) {
    po.sentDate = today;
  }

  purchaseOrders.set(id, { ...po });
  notify();
}

/** Send PO to vendor — transitions from Draft → Sent */
export function sendPO(id: string): void {
  const po = purchaseOrders.get(id);
  if (!po || po.status !== "Draft") return;
  updatePOStatus(id, "Sent");
}

/** Confirm PO — transitions from Sent → Confirmed */
export function confirmPO(id: string): void {
  const po = purchaseOrders.get(id);
  if (!po || po.status !== "Sent") return;
  updatePOStatus(id, "Confirmed");
}

/** Mark as Fully Received from Confirmed (ERP-4797) — everything
    arrived in one go, so every active line is recorded as received in
    full ("Fully Received has to mean everything arrived"). Not offered
    once receiving has started; Cancel remaining covers that. */
export function markPOFullyReceived(id: string): void {
  const po = purchaseOrders.get(id);
  if (!po || po.status !== "Confirmed") return;
  const today = new Date().toISOString().split("T")[0];
  po.lineItems = po.lineItems.map((li) => (li.cancelled ? li : { ...li, receivedQuantity: li.quantity }));
  if (!po.receivingStartDate) po.receivingStartDate = today;
  po.status = "Fully Received";
  purchaseOrders.set(id, { ...po });
  notify();
}

/** Revert PO status — backward state transitions, clears dates as needed */
export function revertPOStatus(id: string, targetStatus: POStatus): void {
  const po = purchaseOrders.get(id);
  if (!po) return;

  po.status = targetStatus;

  // Clear dates that are "ahead" of the target status
  const STATUS_ORDER: POStatus[] = ["Draft", "Sent", "Confirmed", "Partially Received", "Fully Received"];
  const targetIdx = STATUS_ORDER.indexOf(targetStatus);

  if (targetIdx < 1) {
    // Reverting to Draft — clear sent + confirmation + receiving
    po.sentDate = null;
    po.confirmationDate = null;
    po.receivingStartDate = null;
  } else if (targetIdx < 2) {
    // Reverting to Sent — clear confirmation + receiving
    po.confirmationDate = null;
    po.receivingStartDate = null;
  } else if (targetIdx < 3) {
    // Reverting to Confirmed — clear receiving
    po.receivingStartDate = null;
  }

  if (targetStatus === "Cancelled") {
    // Don't clear dates for cancelled — keep history
  }

  purchaseOrders.set(id, { ...po });
  notify();
}

/** Cancellation reasons (ERP-4799). Shared by Cancel PO, Cancel line,
    Cancel remaining and Archive (Sent / Confirmed). "Other" asks for a
    free-text reason. */
export const CANCEL_REASONS = [
  "Demand no longer needed",
  "Covered by another PO",
  "Budget on hold",
  "Postponed will revisit",
  "Vendor unable to fulfill",
  "Vendor lead time too long",
  "Internal cancellation",
  "Duplicate order",
  "Price discrepancy",
  "Other",
] as const;

/** Cancel a PO — stores pre-cancellation state and reason */
export function cancelPO(id: string, reason: string, notes?: string): void {
  const po = purchaseOrders.get(id);
  if (!po) return;
  const today = new Date().toISOString().split("T")[0];
  po.preCancellationStatus = po.status;
  po.cancellationReason = reason;
  po.cancellationNotes = notes || undefined;
  po.cancellationDate = today;
  po.status = "Cancelled";
  purchaseOrders.set(id, { ...po });
  notify();
}

/** Reactivate a cancelled PO — returns to pre-cancellation state */
export function reactivatePO(id: string, reason: string): void {
  const po = purchaseOrders.get(id);
  if (!po || po.status !== "Cancelled") return;
  po.status = po.preCancellationStatus || "Draft";
  po.reactivationReason = reason;
  po.preCancellationStatus = undefined;
  po.cancellationReason = undefined;
  po.cancellationNotes = undefined;
  po.cancellationDate = undefined;
  purchaseOrders.set(id, { ...po });
  notify();
}

/* ── Archive (ERP-4744 AC 10-11, ERP-4772 AC 5) ──
   Archive PO is offered only until something is received (or prepaid —
   the design doesn't track PO payments yet): Draft, Sent, Confirmed and
   Cancelled. There is no Delete Draft. Archiving a Sent / Confirmed PO
   also cancels it (with a reason) and notifies the vendor. Archived POs
   leave the active listing and show only under the Archived pill; they
   can be restored. The id set also covers listing rows that are mock-
   only (not in this store). */
export const ARCHIVABLE_STATUSES = new Set(["Draft", "Sent", "Confirmed", "Cancelled"]);
/** Statuses where archiving also cancels the PO + notifies the vendor. */
export const ARCHIVE_CANCELS_STATUSES = new Set(["Sent", "Confirmed"]);
const archivedPOIds = new Set<string>();

export function isPOArchived(id: string): boolean {
  return archivedPOIds.has(id);
}

export function canArchivePO(po: { id: string; status: string; receivingStartDate?: string; lineItems?: { receivedQuantity?: number }[] }): boolean {
  if (archivedPOIds.has(po.id) || !ARCHIVABLE_STATUSES.has(po.status)) return false;
  // A Cancelled PO that had receiving recorded stays un-archivable.
  return !po.receivingStartDate && !(po.lineItems ?? []).some((li) => (li.receivedQuantity ?? 0) > 0);
}

export function archivePO(id: string, reason?: string, notes?: string): void {
  const po = purchaseOrders.get(id);
  if (po && ARCHIVE_CANCELS_STATUSES.has(po.status)) cancelPO(id, reason ?? "", notes);
  archivedPOIds.add(id);
  const current = purchaseOrders.get(id);
  if (current) {
    current.archivedDate = new Date().toISOString().split("T")[0];
    current.archiveReason = reason;
    purchaseOrders.set(id, { ...current });
  }
  notify();
}

/** Restore an archived PO to the active list. A PO that archiving
    cancelled stays Cancelled — Reactivate PO brings it back. */
export function restorePO(id: string): void {
  archivedPOIds.delete(id);
  const po = purchaseOrders.get(id);
  if (po) {
    po.archivedDate = undefined;
    po.archiveReason = undefined;
    purchaseOrders.set(id, { ...po });
  }
  notify();
}

/** Version lock (buyer 2026-10-15): a PO can be revised — every change
    (price, qty, cancelling a line, …) cuts a new version — only until
    receiving starts. The moment any receiving is recorded the PO is
    locked to its current version: no more revisions, and line cancels
    become in-place state changes instead of new versions. */
export const RECEIVING_STATUSES = new Set([
  "Partially Received",
  "Fully Received",
  "Active with Cancellations",
  "Fully Received with Cancellations",
]);

export function isPOVersionLocked(po: Pick<PurchaseOrderData, "status" | "receivingStartDate" | "lineItems">): boolean {
  return (
    !!po.receivingStartDate ||
    RECEIVING_STATUSES.has(po.status) ||
    po.lineItems.some((li) => li.receivedQuantity > 0)
  );
}

/** Cancel an individual line item — behaviour depends on whether
    receiving has started (buyer 2026-10-15):

      · **Before any receiving (Sent / Confirmed)** — cancelling is a
        revision like any other: the line is removed from the PO and a
        new version is created (returned to Draft for re-send). The
        previous version's snapshot still holds the line, so the
        timeline reads v1 [A, B, C] → cancel B → v2 [A, C].
      · **After receiving starts** — the PO is locked to its current
        version. The line is *marked* cancelled (kept visible, struck
        through, keeps its line number), the PO moves to "Active with
        Cancellations", and no new version is created.
      · When the marked-cancelled path leaves every remaining active
        line fully received, the PO rolls up to **Fully Received with
        Cancellations**.
      · Draft lines are simply removed via the row's Remove action.

    Returns the new version number when a version was cut, else null. */
export function cancelLineItem(
  poId: string,
  lineItemId: string,
  reason?: string,
): number | null {
  const po = purchaseOrders.get(poId);
  if (!po) return null;
  const today = new Date().toISOString().split("T")[0];

  const idx = po.lineItems.findIndex((li) => li.id === lineItemId);
  if (idx === -1) return null;

  const preStatus = po.status;
  const cancelledLine = po.lineItems[idx];

  /* Pre-receiving branch (Sent / Confirmed) — remove the line, bump the
     version, and reset the PO back to Draft so the buyer can re-send the revised order to the
     vendor (buyer 2026-08-03: "it will create a new version in draft
     state with a new version number and that item will be removed from
     it"). The prior version's snapshot (already captured when that
     version was recorded) still holds the line, so version history
     stays lossless — v1's snapshot has the line, v2's snapshot doesn't. */
  if ((preStatus === "Sent" || preStatus === "Confirmed") && !isPOVersionLocked(po)) {
    po.lineItems = po.lineItems.filter((li) => li.id !== lineItemId);

    // Recalculate totals against the surviving lines.
    po.shippingFee = Math.round(po.lineItems.length * 12.5 * 100) / 100;
    applyComputedTotals(po);

    purchaseOrders.set(poId, { ...po });
    // recordPOVersion(resetToDraft) flips status → Draft, clears
    // sentDate/confirmationDate/receivingStartDate, snapshots the current
    // (post-removal) po, bumps currentVersion, and notifies.
    return recordPOVersion(poId, {
      reason: reason || `Cancelled line "${cancelledLine.itemNumber}"`,
      changes: [
        {
          type: "line-item-removed",
          action: "Removed",
          subject: cancelledLine.itemNumber,
          subjectDetail: `Removed from ${preStatus} PO — new revision returned to Draft`,
        },
      ],
      changeTags: ["line-cancelled"],
      previousStatus: preStatus,
      newStatus: "Draft",
      resetToDraft: true,
    });
  }

  /* Partially Received / Active with Cancellations / Fully Received —
     the version is locked, so mark the line cancelled (kept visible)
     rather than removing it. Totals recompute against non-cancelled
     lines. */
  po.lineItems[idx] = { ...cancelledLine, cancelled: true, cancelledDate: today };
  const activeItems = po.lineItems.filter((li) => !li.cancelled);
  po.shippingFee = Math.round(activeItems.length * 12.5 * 100) / 100;
  applyComputedTotals(po);

  const allFullyReceived =
    activeItems.length > 0 && activeItems.every((li) => li.receivedQuantity >= li.quantity);
  const hasCancellations = po.lineItems.some((li) => li.cancelled);

  if (allFullyReceived && hasCancellations) {
    po.status = "Fully Received with Cancellations";
  } else if (preStatus === "Partially Received") {
    po.status = "Active with Cancellations";
    /* Record the underlying receiving state so the header stepper +
       status ladder show "Partially Received" (not "Confirmed") while
       cancellations pile up (buyer 2026-08-03: "the PO will stay in
       partially received state with the active with cancellation, you
       don't need to transition this to confirmed"). Only set on the
       first transition into Active with Cancellations — subsequent
       line-cancels keep the same underlying state. */
    if (!po.preCancellationStatus) {
      po.preCancellationStatus = "Partially Received";
    }
  } else if (preStatus === "Active with Cancellations") {
    // Additional cancellations while already Active — status + underlying
    // stay the same, only the line data and totals recompute.
    po.status = "Active with Cancellations";
  }
  // Cancelled: keep existing status.

  purchaseOrders.set(poId, { ...po });
  notify();
  return null;
}

/** Cancel remaining (ERP-4799) — replaces Mark as Fully Received once
    receiving has started ("Fully Received has to mean everything
    arrived", 2026-10-26). Lines with nothing received are marked
    cancelled; partly received lines are trimmed to what arrived and keep
    the rest as `cancelledQuantity`. The PO closes as Fully Received with
    Cancellations. */
export function cancelRemaining(id: string, reason?: string, notes?: string): void {
  const po = purchaseOrders.get(id);
  if (!po) return;
  const today = new Date().toISOString().split("T")[0];
  po.lineItems = po.lineItems.map((li) => {
    if (li.cancelled || li.receivedQuantity >= li.quantity) return li;
    if (li.receivedQuantity <= 0) return { ...li, cancelled: true, cancelledDate: today };
    const ratio = li.receivedQuantity / li.quantity;
    return {
      ...li,
      cancelledQuantity: li.quantity - li.receivedQuantity,
      quantity: li.receivedQuantity,
      vendorQty: Math.round(li.vendorQty * ratio * 100) / 100,
      cancelledDate: today,
    };
  });
  const activeItems = po.lineItems.filter((li) => !li.cancelled);
  po.shippingFee = Math.round(activeItems.length * 12.5 * 100) / 100;
  applyComputedTotals(po);
  if (!po.preCancellationStatus) po.preCancellationStatus = "Partially Received";
  po.status = "Fully Received with Cancellations";
  po.cancellationReason = reason;
  po.cancellationNotes = notes || undefined;
  po.cancellationDate = today;
  purchaseOrders.set(id, { ...po });
  notify();
}

/** Record receiving for a line item. Auto-transitions PO status. */
export function recordReceiving(
  poId: string,
  records: Array<{
    lineItemId: string;
    quantityReceived: number;
    condition: "good" | "damaged" | "rejected";
    notes: string;
  }>
): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;

  const today = new Date().toISOString().split("T")[0];

  // Track if this is the first receiving event
  if (!po.receivingStartDate) {
    po.receivingStartDate = today;
  }

  let recCounter = po.receivingRecords.length;

  for (const rec of records) {
    if (rec.quantityReceived <= 0) continue;

    recCounter++;
    const receivingRecord: ReceivingRecord = {
      id: `rcv-${poId}-${recCounter}`,
      lineItemId: rec.lineItemId,
      quantityReceived: rec.quantityReceived,
      receivedDate: today,
      receivedBy: "Areeb Tanvir",
      condition: rec.condition,
      notes: rec.notes,
    };

    po.receivingRecords.push(receivingRecord);

    // Update line item receivedQuantity
    const liIdx = po.lineItems.findIndex((li) => li.id === rec.lineItemId);
    if (liIdx !== -1) {
      po.lineItems[liIdx] = {
        ...po.lineItems[liIdx],
        receivedQuantity: po.lineItems[liIdx].receivedQuantity + rec.quantityReceived,
      };
    }
  }

  // Auto-determine status based on receiving
  const hasCancellations = po.lineItems.some((li) => li.cancelled);
  const activeItems = po.lineItems.filter((li) => !li.cancelled);
  const allFullyReceived = activeItems.length > 0 && activeItems.every((li) => li.receivedQuantity >= li.quantity);
  const anyReceived = activeItems.some((li) => li.receivedQuantity > 0);

  // Don't change status if PO is cancelled — receiving on cancelled PO keeps it cancelled
  if (po.status !== "Cancelled") {
    if (allFullyReceived && hasCancellations) {
      po.status = "Fully Received with Cancellations";
    } else if (allFullyReceived) {
      po.status = "Fully Received";
    } else if (anyReceived && hasCancellations) {
      po.status = "Active with Cancellations";
    } else if (anyReceived) {
      po.status = "Partially Received";
    }
  }

  purchaseOrders.set(poId, { ...po });
  notify();
}

/** Update PO recipient / vendor contact (Draft only) */
export function updatePORecipient(poId: string, recipient: PORecipient): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;
  po.recipient = { ...recipient };
  purchaseOrders.set(poId, { ...po });
  notify();
}

/** Update PO contacts — primary recipient + secondary contact names (Draft only) */
export function updatePOContacts(poId: string, recipient: PORecipient, secondaryNames: string[]): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;
  po.recipient = { ...recipient };
  po.secondaryContactNames = [...secondaryNames];
  purchaseOrders.set(poId, { ...po });
  notify();
}

/** Update PO payment & delivery details (Draft only) */
export function updatePOPayment(poId: string, payment: POPaymentDelivery): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;
  po.payment = { ...payment };
  purchaseOrders.set(poId, { ...po });
  notify();
}

/** Update PO delivery date */
export function updatePODeliveryDate(poId: string, deliveryDate: string): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;
  po.deliveryDate = deliveryDate;
  purchaseOrders.set(poId, { ...po });
  notify();
}

/* ═══════════════════════════════════════════════════════════════
   PO NOTES CRUD
   ═══════════════════════════════════════════════════════════════ */

function makeNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function getInitialsFromName(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatTimestamp(): string {
  return new Date().toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Add a note to a PO (PO-level or line-item-level) */
export function addPONote(
  poId: string,
  type: PONoteType,
  text: string,
  author: string = "Areeb Tanvir",
  lineItemId?: string,
): PONote | null {
  const po = purchaseOrders.get(poId);
  if (!po) return null;
  const note: PONote = {
    id: makeNoteId(),
    type,
    text,
    author,
    authorInitials: getInitialsFromName(author),
    timestamp: formatTimestamp(),
    lineItemId,
  };
  po.poNotes = [note, ...po.poNotes];
  purchaseOrders.set(poId, { ...po });
  notify();
  return note;
}

/** Edit an existing note */
export function editPONote(poId: string, noteId: string, newText: string): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;
  const note = po.poNotes.find(n => n.id === noteId);
  if (!note) return;
  note.text = newText;
  purchaseOrders.set(poId, { ...po });
  notify();
}

/** Delete a note */
export function deletePONote(poId: string, noteId: string): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;
  po.poNotes = po.poNotes.filter(n => n.id !== noteId);
  purchaseOrders.set(poId, { ...po });
  notify();
}

/** Get notes for a PO, optionally filtered by lineItemId */
export function getPONotes(poId: string, lineItemId?: string): PONote[] {
  const po = purchaseOrders.get(poId);
  if (!po) return [];
  if (lineItemId) {
    return po.poNotes.filter(n => n.lineItemId === lineItemId);
  }
  return po.poNotes.filter(n => !n.lineItemId);
}

/** Get note counts for a line item */
export function getLineItemNoteCounts(poId: string, lineItemId: string): { vendor: number; internal: number } {
  const po = purchaseOrders.get(poId);
  if (!po) return { vendor: 0, internal: 0 };
  const notes = po.poNotes.filter(n => n.lineItemId === lineItemId);
  return {
    vendor: notes.filter(n => n.type === "vendor").length,
    internal: notes.filter(n => n.type === "internal").length,
  };
}

/** Get total received quantity across all line items */
export function getReceivingProgress(poId: string): { totalOrdered: number; totalReceived: number; percentage: number } {
  const po = purchaseOrders.get(poId);
  if (!po) return { totalOrdered: 0, totalReceived: 0, percentage: 0 };

  const totalOrdered = po.lineItems.reduce((s, li) => s + li.quantity, 0);
  const totalReceived = po.lineItems.reduce((s, li) => s + li.receivedQuantity, 0);
  const percentage = totalOrdered > 0 ? Math.min(100, (totalReceived / totalOrdered) * 100) : 0;

  return { totalOrdered, totalReceived, percentage };
}

/** Update a single line item within a PO and recalculate totals */
export function updateLineItem(
  poId: string,
  lineItemId: string,
  updates: Partial<Omit<POLineItem, "id" | "lineTotal">>
): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;

  const idx = po.lineItems.findIndex((li) => li.id === lineItemId);
  if (idx === -1) return;

  const li = { ...po.lineItems[idx], ...updates };
  li.lineTotal = li.unitPrice * li.quantity * (1 - li.discount / 100);
  /* Clear the price-drift flag when the buyer touches the price (they
     just made a call on it — the "moved since original" claim no longer
     applies). Same reasoning applies to qualifiedForVendor when the
     buyer picks a real vendor on the line via OrderFlow; that path
     already sets `vendorName` etc. through a full replace, so no
     explicit clear is needed here. */
  if (updates.unitPrice !== undefined) {
    delete li.priceChangedFromCatalog;
  }
  po.lineItems[idx] = li;

  // Recalculate totals
  po.shippingFee = Math.round(po.lineItems.length * 12.5 * 100) / 100;
  applyComputedTotals(po);

  purchaseOrders.set(poId, { ...po });
  notify();
}

/** Set the PO-wide deactivation state of a pricing rule. When `reason`
 *  is null the rule becomes active on the PO again (per-line
 *  activation state on each line takes over). Buyer feedback 2026-07-20;
 *  see `poPricingRulesData.ts` + PO_PRICING_RULES_PORT_AUDIT.md. */
export function updatePORulingDeactivation(
  poId: string,
  ruleId: string,
  reason: "USER_UNAPPLIED" | "EXCEEDS_100_PERCENT" | null,
): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;
  const current = po.deactivatedRuleIds ?? {};
  const next = { ...current };
  if (reason == null) {
    delete next[ruleId];
  } else {
    next[ruleId] = reason;
  }
  const updated = applyComputedTotals({ ...po, deactivatedRuleIds: next });
  purchaseOrders.set(poId, updated);
  notify();
}

/** Replace a PO's one-time discounts/premiums and recompute totals. */
export function setPOAdjustments(poId: string, adjustments: POAdjustment[]): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;
  const updated = applyComputedTotals({ ...po, lineItems: po.lineItems.map((li) => ({ ...li })), adjustments });
  purchaseOrders.set(poId, updated);
  notify();
}

/** Recompute one PO's stored totals (e.g. after its vendor's pricing
 *  rules were edited in the catalog). */
export function recalcPOTotals(poId: string): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;
  purchaseOrders.set(poId, applyComputedTotals({ ...po, lineItems: po.lineItems.map((li) => ({ ...li })) }));
  notify();
}

/** Add a new line item to an existing PO (Draft only) and recalculate totals */
export function addLineItemToPO(
  poId: string,
  item: Omit<POLineItem, "lineTotal" | "receivedQuantity">,
  /** Item-level one-time discounts/premiums from the Items Detail Modal. */
  oneTimeAdjustments?: LineOneTimeAdjustment[],
): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;

  // Prevent duplicates by itemNumber
  if (po.lineItems.some((li) => li.itemNumber === item.itemNumber)) return;

  const lineTotal = item.unitPrice * item.quantity * (1 - item.discount / 100);
  const newItem: POLineItem = { ...item, lineTotal, receivedQuantity: 0 };
  po.lineItems.push(newItem);
  if (oneTimeAdjustments && oneTimeAdjustments.length > 0) {
    po.adjustments = [...(po.adjustments ?? []), ...lineAdjustmentsToPO(newItem.id, oneTimeAdjustments)];
  }

  // Recalculate totals
  po.shippingFee = Math.round(po.lineItems.length * 12.5 * 100) / 100;
  applyComputedTotals(po);

  purchaseOrders.set(poId, { ...po });
  notify();
}

/** Remove a line item from an existing PO (Draft only) and recalculate totals */
export function removeLineItemFromPO(poId: string, lineItemId: string): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;

  po.lineItems = po.lineItems.filter((li) => li.id !== lineItemId);

  // Recalculate totals
  po.shippingFee = Math.round(po.lineItems.length * 12.5 * 100) / 100;
  applyComputedTotals(po);

  purchaseOrders.set(poId, { ...po });
  notify();
}

/* ── Duplicate a PO as a new Draft ──
   `sourceVersion` — when set to a version number other than `currentVersion`,
   the new PO's line items are seeded from that version's snapshot instead of
   the source's live line items. Fields not carried by
   `POLineItemSnapshot` (image, defaultUOM, category, shipmentMethod, etc.)
   fall back to the matching current line item (by id) so the new PO still
   renders correctly; if a snapshot item no longer exists in the current PO,
   safe defaults are used.
   `vendorOverride` — when set, replaces the new PO's `vendor` object (and
   the derived `payment.payTo` label). Recipient is left untouched so the
   buyer can pick a new contact after landing on the draft.
*/
export interface DuplicatePOOptions {
  sourceVersion?: number;
  vendorOverride?: POVendor;
  /** Optional label captured in the initial version-history reason line
   *  (e.g. "Vendor: Toyota Motor Credit"). */
  vendorLabel?: string;
  /** Default vendor ship-from location to seed on every new line item
   *  (2026-07-28). Buyer can override per line on the Draft — this is
   *  just the initial value. Ignored when `vendorOverride` is not set
   *  (same-vendor duplicates keep the source lines' locations intact). */
  vendorLocationSeed?: { id: string; name: string };
}

export function duplicatePO(
  sourceId: string,
  opts: DuplicatePOOptions = {},
): PurchaseOrderData | null {
  const source = purchaseOrders.get(sourceId);
  if (!source) return null;

  poCounter++;
  const id = `po-new-${poCounter}`;
  const poNumber = `395-${9900 + poCounter}`;
  const now = new Date();

  /* Resolve which line-item set to seed from. When the caller picks a past
     version (and it exists), we walk that snapshot; otherwise we keep the
     current behavior of cloning the live line items. */
  const chosenVersion = opts.sourceVersion != null
    ? source.versions.find((v) => v.version === opts.sourceVersion)
    : undefined;

  let newLineItems: POLineItem[];
  if (chosenVersion) {
    const currentById = new Map(source.lineItems.map((li) => [li.id, li]));
    newLineItems = chosenVersion.snapshot.lineItems.map((snap, idx) => {
      const current = currentById.get(snap.id);
      return {
        id: `${id}-li-${idx + 1}`,
        itemNumber: snap.itemNumber,
        descriptiveName: snap.descriptiveName,
        description: current?.description,
        image: current?.image ?? "",
        unitPrice: snap.unitPrice,
        vendorQty: snap.vendorQty,
        vendorUOM: snap.vendorUOM,
        vendorUOMQty: current?.vendorUOMQty ?? 1,
        quantity: snap.quantity,
        defaultUOM: current?.defaultUOM ?? "Unit",
        discount: snap.discount,
        lineTotal: snap.lineTotal,
        shipmentMethod: current?.shipmentMethod ?? "fedex-ground",
        needByDate: snap.needByDate,
        promisedShipDate: snap.promisedShipDate,
        inboundLocation: snap.inboundLocation,
        category: current?.category ?? "General",
        receivedQuantity: 0,
      };
    });
  } else {
    /* Duplicate copies everything (buyer 2026-10-15) — including lines
       that were cancelled on the source (and from a Cancelled PO). The
       new PO is a fresh Draft, so cancel/receiving state is reset. */
    newLineItems = source.lineItems.map((li, idx) => ({
      ...li,
      id: `${id}-li-${idx + 1}`,
      receivedQuantity: 0,
      cancelled: undefined,
      cancelledDate: undefined,
    }));
  }

  /* Vendor fulfillability pass (buyer 2026-07-27, Duplicate PO redesign):
     when a different vendor was chosen, stamp `needsQualificationForVendor`
     on every line the new vendor doesn't carry. The Draft renders these
     as an amber "Needs review" banner + per-row Remove/Qualify actions —
     the modal no longer forces the buyer through this decision inline.
     Also seed each line's `vendorLocationId` / `vendorLocationName` from
     the modal's picked location so the per-line ship-from picker has a
     starting value. Skipped entirely on Same-vendor duplicates. */
  if (opts.vendorOverride) {
    const vendorName = opts.vendorOverride.name;
    const locSeed = opts.vendorLocationSeed;
    newLineItems = newLineItems.map((li) => {
      const next: POLineItem = { ...li };
      if (locSeed) {
        next.vendorLocationId = locSeed.id;
        next.vendorLocationName = locSeed.name;
      }
      if (!isItemFulfillableByVendor(li.itemNumber, vendorName)) {
        next.needsQualificationForVendor = vendorName;
      }
      return next;
    });
  }

  /* Price-drift detection (buyer 2026-07-23, phase 3): compare each
     surviving line's unit price against the CURRENT catalog price.
     When they differ (item has moved since the source PO was placed)
     stamp `priceChangedFromCatalog` so the Draft can show a chip. Not
     stamped on lines pending qualification — for those the catalog
     doesn't have the item↔vendor pairing yet, so a "changed" claim
     would mislead. Small epsilon on the compare so floating-point
     wobble ($/unit multiplied through discount, etc.) doesn't cry wolf. */
  newLineItems = newLineItems.map((li) => {
    if (li.needsQualificationForVendor) return li;
    const catalogItem = CATALOG.find((c) => c.itemNumber === li.itemNumber);
    if (!catalogItem || catalogItem.unitPrice <= 0) return li;
    if (Math.abs(catalogItem.unitPrice - li.unitPrice) < 0.005) return li;
    return { ...li, priceChangedFromCatalog: catalogItem.unitPrice };
  });

  /* Totals are recomputed via applyComputedTotals below. One-time
     discounts/premiums are NEVER carried onto the duplicate (buyer
     2026-10-15): each one is tied to a deal the vendor offered on that
     specific order. Copying it forward would silently put a price on
     the new PO the vendor never agreed to, and the mismatch wouldn't
     surface until the vendor invoice. Everything else is copied. */
  const shippingFee = chosenVersion
    ? Math.round(newLineItems.length * 12.5 * 100) / 100
    : source.shippingFee;

  const vendor = opts.vendorOverride ?? { ...source.vendor };
  const payment = {
    ...source.payment,
    ...(opts.vendorOverride ? { payTo: opts.vendorOverride.name } : {}),
  };

  const reasonParts = [`Duplicated from ${source.poNumber}`];
  if (chosenVersion) reasonParts.push(`V${chosenVersion.version}`);
  if (opts.vendorLabel) reasonParts.push(`Vendor: ${opts.vendorLabel}`);

  const po: PurchaseOrderData = {
    id,
    poNumber,
    status: "Draft",
    orderDate: now.toISOString().split("T")[0],
    deliveryDate: source.deliveryDate,
    confirmationDate: null,
    sentDate: null,
    receivingStartDate: null,
    vendor,
    recipient: { ...source.recipient },
    secondaryContactNames: [...source.secondaryContactNames],
    lineItems: newLineItems,
    payment,
    subtotal: 0,
    shippingFee,
    discountTotal: 0,
    total: 0,
    adjustments: [],
    notes: source.notes,
    poNotes: source.poNotes.map(n => ({ ...n, id: `note-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    createdBy: source.createdBy,
    receivingRecords: [],
    currentVersion: 1,
    versions: [],
  };
  applyComputedTotals(po);

  purchaseOrders.set(id, initVersioning(po, reasonParts.join(" · ")));
  notify();
  return purchaseOrders.get(id)!;
}

/* ══════════════════════════════════════════════════════════════
   SEED DEMO PO — 6 line items, Draft status
   Automatically created on module load so the listing always
   has one clickable Draft PO row.
   ═══════════════════════════════════════════════════════════════ */

const DEMO_LINE_ITEMS: Omit<POLineItem, "lineTotal">[] = [
  {
    id: "demo-li-1",
    itemNumber: "HYD-4420-A1",
    descriptiveName: "Hydraulic Control Valve Assembly — 3/4\" NPT, 3000 PSI",
    description: "Directional control valve with manual override lever. Suitable for mobile hydraulic systems requiring precise flow regulation up to 30 GPM.",
    image: "https://images.unsplash.com/photo-1645754884761-6ada0d53807b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoeWRyYXVsaWMlMjB2YWx2ZSUyMGluZHVzdHJpYWwlMjBtYW51ZmFjdHVyaW5nfGVufDF8fHx8MTc3MTgwMzUwOHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    unitPrice: 284.50,
    vendorQty: 2,
    vendorUOM: "Case",
    vendorUOMQty: 6,
    quantity: 12,
    defaultUOM: "Unit",
    discount: 5,
    shipByDate: "2026-03-10",
    shipmentMethod: "fedex-freight",
    needByDate: "2026-03-18",
    promisedShipDate: "2026-03-11",
    inboundLocation: "Warehouse A - Pasadena, OK",
    category: "Hydraulics",
    receivedQuantity: 0,
  },
  {
    id: "demo-li-2",
    itemNumber: "BRG-7750-C3",
    descriptiveName: "Precision Tapered Roller Bearing — 62mm Bore, Chrome Steel",
    description: "High-load capacity bearing designed for automotive drivetrain and transmission applications. ABEC-5 tolerance class with integrated seals.",
    image: "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVjaXNpb24lMjBiZWFyaW5nJTIwc3RlZWwlMjBhdXRvbW90aXZlfGVufDF8fHx8MTc3MTgwMzUwOHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    unitPrice: 47.25,
    vendorQty: 5,
    vendorUOM: "Box",
    vendorUOMQty: 10,
    quantity: 50,
    defaultUOM: "Piece",
    discount: 0,
    shipByDate: "2026-03-08",
    shipmentMethod: "fedex-ground",
    needByDate: "2026-03-18",
    promisedShipDate: "2026-03-13",
    inboundLocation: "Warehouse A - Pasadena, OK",
    category: "Bearings",
    receivedQuantity: 0,
  },
  {
    id: "demo-li-3",
    itemNumber: "ELC-1190-H2",
    descriptiveName: "Automotive Wire Harness Connector — 24-pin, IP67 Rated",
    description: "Waterproof multi-pin connector assembly for engine bay and underbody wiring. Includes locking retention clip and silicone seals.",
    image: "https://images.unsplash.com/photo-1751846545116-838fe2e7e815?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJpY2FsJTIwY29ubmVjdG9yJTIwY2FibGUlMjBoYXJuZXNzfGVufDF8fHx8MTc3MTgwMzUwOXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    unitPrice: 18.90,
    vendorQty: 10,
    vendorUOM: "Bag",
    vendorUOMQty: 25,
    quantity: 250,
    defaultUOM: "Piece",
    discount: 8,
    shipByDate: "2026-03-05",
    shipmentMethod: "fedex-express",
    needByDate: "2026-03-12",
    promisedShipDate: "2026-03-10",
    inboundLocation: "Warehouse A - Pasadena, OK",
    category: "Electrical",
    receivedQuantity: 0,
  },
  {
    id: "demo-li-4",
    itemNumber: "GSK-3305-R1",
    descriptiveName: "Industrial Nitrile Gasket Seal — 4\" OD x 3\" ID, High-Temp",
    description: "High-temperature nitrile rubber gasket rated for continuous service up to 250°F. Chemical resistant with excellent compression set properties for hydraulic and pneumatic flange joints.",
    image: "https://images.unsplash.com/photo-1759148413364-c766dd9ff1af?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwcnViYmVyJTIwZ2Fza2V0JTIwc2VhbHxlbnwxfHx8fDE3NzE4MDM1MDl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    unitPrice: 6.40,
    vendorQty: 4,
    vendorUOM: "Pack",
    vendorUOMQty: 50,
    quantity: 200,
    defaultUOM: "Piece",
    discount: 0,
    shipByDate: "2026-03-07",
    shipmentMethod: "fedex-ground",
    needByDate: "2026-03-15",
    promisedShipDate: "2026-03-08",
    inboundLocation: "Warehouse A - Pasadena, OK",
    category: "Seals & Gaskets",
    receivedQuantity: 0,
  },
  {
    id: "demo-li-5",
    itemNumber: "ALU-5580-T6",
    descriptiveName: "Aluminum Extrusion Profile — T-Slot 40x40mm, 6061-T6",
    description: "Modular framing extrusion for jig and fixture construction. Compatible with standard T-slot fasteners and corner brackets.",
    image: "https://images.unsplash.com/photo-1554901356-50cb9d8ea757?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbHVtaW51bSUyMGV4dHJ1c2lvbiUyMHByb2ZpbGUlMjBtZXRhbHxlbnwxfHx8fDE3NzE4MDM1MDl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    unitPrice: 32.75,
    vendorQty: 8,
    vendorUOM: "Bundle",
    vendorUOMQty: 4,
    quantity: 32,
    defaultUOM: "Bar",
    discount: 3,
    shipByDate: "2026-03-12",
    shipmentMethod: "fedex-freight",
    needByDate: "2026-03-22",
    promisedShipDate: "2026-03-14",
    inboundLocation: "Warehouse A - Pasadena, OK",
    category: "Raw Materials",
    receivedQuantity: 0,
  },
  {
    id: "demo-li-6",
    itemNumber: "FST-8810-SS",
    descriptiveName: "Stainless Steel Hex Head Bolt — M12 x 60mm, Grade A4-80",
    description: "Marine-grade A4-80 stainless steel hex bolt for corrosion-critical assemblies. Fully threaded with DIN 933 compliance. Ideal for outdoor structural and under-chassis applications.",
    image: "https://images.unsplash.com/photo-1744974051873-affe1f5f393a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGFpbmxlc3MlMjBzdGVlbCUyMGZhc3RlbmVyJTIwYm9sdHxlbnwxfHx8fDE3NzE4MDM1MTB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    unitPrice: 1.85,
    vendorQty: 20,
    vendorUOM: "Box",
    vendorUOMQty: 100,
    quantity: 2000,
    defaultUOM: "Piece",
    discount: 12,
    shipByDate: "2026-03-04",
    shipmentMethod: "fedex-ground",
    needByDate: "2026-03-11",
    promisedShipDate: "2026-03-06",
    inboundLocation: "Warehouse A - Pasadena, OK",
    category: "Fasteners",
    receivedQuantity: 0,
  },
];

function seedDemoPO(): void {
  const id = "po-demo-draft";
  if (purchaseOrders.has(id)) return; // already seeded

  const vendorName = "General Motors (GM)";
  const vendorInfo = VENDOR_DETAILS[vendorName]!;
  const payment = { ...PAYMENT_DEFAULTS[vendorName]! };

  const lineItems: POLineItem[] = DEMO_LINE_ITEMS.map((li) => ({
    ...li,
    lineTotal: li.unitPrice * li.quantity * (1 - li.discount / 100),
  }));

  const subtotal = lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  const discountTotal = lineItems.reduce((s, li) => s + li.unitPrice * li.quantity * (li.discount / 100), 0);
  const shippingFee = Math.round(lineItems.length * 12.5 * 100) / 100;
  const total = subtotal - discountTotal + shippingFee;

  const po: PurchaseOrderData = {
    id,
    poNumber: "395-9900",
    status: "Confirmed",
    orderDate: "2026-02-20",
    deliveryDate: "2026-03-22",
    confirmationDate: "2026-03-03",
    sentDate: "2026-03-01",
    receivingStartDate: null,
    vendor: { name: vendorName, ...vendorInfo },
    recipient: {
      name: "Richard Kowalski",
      role: "Vendor Account Manager",
      email: "r.kowalski@gm.com",
      phone: "+1 (313) 556-5102",
    },
    secondaryContactNames: ["Linda Vasquez", "James Rodriguez"],
    lineItems,
    payment,
    subtotal,
    shippingFee,
    discountTotal,
    total,
    notes: "Priority order — line production scheduled for late March. Please expedite bearings and connectors.",
    createdBy: "Areeb Tanvir",
    poNotes: [],
    receivingRecords: [],
    currentVersion: 1,
    versions: [],
  };

  const seeded = initVersioning(po, "Initial PO created — 6 items, $15,580.36 total");

  // Build distinct snapshots per version so comparisons show actual diffs
  const v1LineItems: POLineItemSnapshot[] = [
    { id: "demo-li-1", itemNumber: "HYD-4420-A1", descriptiveName: "Hydraulic Cylinder Assembly — 3\" Bore x 18\" Stroke", quantity: 4, vendorQty: 2, vendorUOM: "Pair", unitPrice: 1245.00, discount: 5, lineTotal: 2366.50 * 2, needByDate: "2026-03-20", inboundLocation: "Warehouse A - Pasadena, OK" },
    { id: "demo-li-2", itemNumber: "BRG-7750-C3", descriptiveName: "Precision Ball Bearing — 6205-2RS, 25x52x15mm", quantity: 50, vendorQty: 5, vendorUOM: "Box", unitPrice: 47.25, discount: 0, lineTotal: 2362.50, needByDate: "2026-03-18", inboundLocation: "Warehouse A - Pasadena, OK" },
    { id: "demo-li-3", itemNumber: "ELC-1190-H2", descriptiveName: "Automotive Wire Harness Connector — 24-pin, IP67 Rated", quantity: 250, vendorQty: 10, vendorUOM: "Bag", unitPrice: 18.90, discount: 8, lineTotal: 4347.00, needByDate: "2026-03-12", inboundLocation: "Warehouse A - Pasadena, OK" },
    { id: "demo-li-4", itemNumber: "GSK-3305-R1", descriptiveName: "Industrial Nitrile Gasket Seal — 4\" OD x 3\" ID", quantity: 200, vendorQty: 4, vendorUOM: "Pack", unitPrice: 6.40, discount: 0, lineTotal: 1280.00, needByDate: "2026-03-15", inboundLocation: "Warehouse A - Pasadena, OK" },
  ];
  const v1Snapshot: POVersionSnapshot = {
    poNumber: "395-9900", vendorName: "General Motors (GM)", status: "Draft",
    deliveryDate: "2026-03-20", notes: "Initial order for Q1 production run.",
    lineItemCount: 4, subtotal: 10356.00, discountTotal: 607.50, shippingFee: 50.00, total: 9798.50,
    payment: clonePayment(po.payment),
    lineItems: v1LineItems,
  };

  const v2LineItems: POLineItemSnapshot[] = [
    { ...v1LineItems[0], vendorQty: 5, quantity: 10, lineTotal: 11827.50 },
    { ...v1LineItems[1], unitPrice: 45.00, lineTotal: 2250.00 },
    { ...v1LineItems[2] },
    { ...v1LineItems[3] },
    { id: "demo-li-5", itemNumber: "ALU-5580-T6", descriptiveName: "Aluminum Extrusion Profile — T-Slot 40x40mm, 6061-T6", quantity: 32, vendorQty: 8, vendorUOM: "Bundle", unitPrice: 32.75, discount: 3, lineTotal: 1016.08, needByDate: "2026-03-22", inboundLocation: "Warehouse A - Pasadena, OK" },
  ];
  const v2Snapshot: POVersionSnapshot = {
    poNumber: "395-9900", vendorName: "General Motors (GM)", status: "Sent",
    deliveryDate: "2026-03-22", notes: "Updated quantities and added aluminum extrusions per engineering request.",
    lineItemCount: 5, subtotal: 20721.08, discountTotal: 1498.25, shippingFee: 62.50, total: 19285.33,
    payment: { ...clonePayment(po.payment), paymentTerms: "Net 45" },
    lineItems: v2LineItems,
  };

  const v3LineItems: POLineItemSnapshot[] = [
    { ...v2LineItems[0] },
    { ...v2LineItems[1] },
    { ...v2LineItems[2] },
    { ...v2LineItems[4] },
    { id: "demo-li-6", itemNumber: "FST-8810-SS", descriptiveName: "Stainless Steel Hex Head Bolt — M12 x 60mm, Grade A4-80", quantity: 2000, vendorQty: 20, vendorUOM: "Box", unitPrice: 1.85, discount: 12, lineTotal: 3256.00, needByDate: "2026-03-11", inboundLocation: "Warehouse A - Pasadena, OK" },
    { id: "demo-li-7", itemNumber: "TSK-2200-M4", descriptiveName: "Transmission Seal Kit — Complete Rebuild Set", quantity: 6, vendorQty: 6, vendorUOM: "Kit", unitPrice: 89.50, discount: 0, lineTotal: 537.00, needByDate: "2026-03-18", inboundLocation: "Warehouse A - Pasadena, OK" },
  ];
  const v3Snapshot: POVersionSnapshot = {
    poNumber: "395-9900", vendorName: "General Motors (GM)", status: "Confirmed",
    deliveryDate: "2026-03-22", notes: "GSK-3305-R1 removed per vendor discontinuation. Added fasteners and transmission seal kit.",
    lineItemCount: 6, subtotal: 23234.08, discountTotal: 1890.25, shippingFee: 75.00, total: 21418.83,
    payment: { ...clonePayment(po.payment), paymentTerms: "Net 45" },
    lineItems: v3LineItems,
  };

  const v4Snapshot: POVersionSnapshot = {
    ...v3Snapshot,
    deliveryDate: "2026-04-05",
    notes: "Priority order — line production scheduled for late March. Please expedite bearings and connectors.",
    total: 21418.83,
    lineItems: v3LineItems.map(li => ({ ...li })),
  };

  seeded.currentVersion = 4;
  seeded.versions = [
    {
      version: 4,
      versionStatus: "confirmed",
      createdAt: "2026-03-10T11:10:00.000Z",
      createdBy: "Areeb Tanvir",
      avatar: "AT",
      reason: "Delivery date changed, shipping upgraded to DHL Express, PO document attached, freight surcharge rule applied",
      changes: [
        { id: "chg-po-demo-v4-1", type: "config-changed", action: "Changed", subject: "Delivery Date", subjectDetail: "Mar 22 → Apr 5", timestamp: "11:08 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v4-2", type: "config-changed", action: "Changed", subject: "Shipping Method", subjectDetail: "FedEx Freight → DHL Express", timestamp: "11:09 AM", user: "Areeb Tanvir" },
        /* Seeded to exercise the extended change taxonomy (2026-07-10) —
           attachment / rule / adjustment kinds map 1:1 to the new
           chip tints in `poVersionDisplay.changeTypeConfig`. */
        { id: "chg-po-demo-v4-3", type: "attachment-added", action: "Added", subject: "PO document uploaded", subjectDetail: "PO-2026-0142-v4.pdf · 128 KB", timestamp: "11:10 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v4-4", type: "rule-applied", action: "Added", subject: "Freight surcharge rule applied", subjectDetail: "+3% on shipments over $10k · applied automatically", timestamp: "11:12 AM", user: "Nophil Anwer" },
        { id: "chg-po-demo-v4-5", type: "adjustment-applied", action: "Added", subject: "Volume discount adjustment", subjectDetail: "−2.5% on hydraulic line items · vendor promo", detail: "Applied to HYD-4420-A1 and adjacent SKUs.", timestamp: "11:14 AM", user: "Nophil Anwer" },
        { id: "chg-po-demo-v4-6", type: "config-changed", action: "Changed", subject: "Payment Method", subjectDetail: "Wire Transfer → ACH Transfer", timestamp: "11:15 AM", user: "Nophil Anwer" },
      ],
      snapshot: v4Snapshot,
      changeTags: ["Date Change", "Shipping Change", "Attachment", "Rule Applied", "Adjustment", "Payment Method Change"],
    },
    {
      version: 3,
      versionStatus: "confirmed",
      createdAt: "2026-03-07T09:40:00.000Z",
      createdBy: "Areeb Tanvir",
      avatar: "AT",
      reason: "New items added (Fasteners, Transmission Seal Kit), GSK-3305-R1 removed per vendor discontinuation",
      changes: [
        { id: "chg-po-demo-v3-1", type: "line-item-added", action: "Added", subject: "FST-8810-SS", detail: "Stainless Steel Hex Head Bolt — 2000 pcs, $1.85/ea", timestamp: "09:30 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v3-2", type: "line-item-added", action: "Added", subject: "TSK-2200-M4", detail: "Transmission Seal Kit — 6 kits, $89.50/ea", timestamp: "09:32 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v3-3", type: "line-item-removed", action: "Removed", subject: "GSK-3305-R1", detail: "Industrial Nitrile Gasket Seal — vendor discontinued", timestamp: "09:35 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v3-4", type: "config-changed", action: "Changed", subject: "Notes", detail: "Updated order notes with discontinuation details", timestamp: "09:38 AM", user: "Nophil Anwer" },
        { id: "chg-po-demo-v3-5", type: "vendor-changed", action: "Changed", subject: "Primary Contact", detail: "Richard Kowalski → Sarah O'Brien", timestamp: "09:40 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v3-6", type: "config-changed", action: "Changed", subject: "Ship To", detail: "Omne Warehouse Network → Northeast Fulfillment", timestamp: "09:42 AM", user: "Nophil Anwer" },
      ],
      snapshot: v3Snapshot,
      changeTags: ["Item Added", "Item Removed", "Notes", "Contact Change", "Shipping Change"],
    },
    {
      version: 2,
      versionStatus: "sent",
      createdAt: "2026-03-03T15:05:00.000Z",
      createdBy: "Areeb Tanvir",
      avatar: "AT",
      reason: "Qty changed on HYD-4420-A1 from 4 to 10, price updated on BRG-7750-C3, added Aluminum Extrusion",
      changes: [
        { id: "chg-po-demo-v2-1", type: "line-item-modified", action: "Changed", subject: "HYD-4420-A1 Qty", detail: "4 → 10", timestamp: "03:00 PM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v2-2", type: "pricing-changed", action: "Changed", subject: "BRG-7750-C3 Unit Price", detail: "$47.25 → $45.00", timestamp: "03:02 PM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v2-3", type: "line-item-added", action: "Added", subject: "ALU-5580-T6", detail: "Aluminum Extrusion — 32 bars, $32.75/ea", timestamp: "03:04 PM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v2-4", type: "config-changed", action: "Changed", subject: "Payment Terms", detail: "Net 30 → Net 45 (per vendor request)", timestamp: "03:06 PM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v2-5", type: "config-changed", action: "Changed", subject: "Delivery Date", detail: "Mar 20 → Mar 22", timestamp: "03:07 PM", user: "Nophil Anwer" },
      ],
      snapshot: v2Snapshot,
      changeTags: ["Qty Change", "Price Change", "Item Added", "Payment Terms Change", "Date Change"],
    },
    {
      version: 1,
      versionStatus: "draft",
      createdAt: "2026-02-20T10:00:00.000Z",
      createdBy: "Areeb Tanvir",
      avatar: "AT",
      reason: "Original PO created — 4 items for Q1 production run",
      changes: [
        { id: "chg-po-demo-v1-1", type: "line-item-added", action: "Added", subject: "HYD-4420-A1", detail: "Hydraulic Cylinder — 4 pcs, $1,245.00/ea", timestamp: "10:00 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v1-2", type: "line-item-added", action: "Added", subject: "BRG-7750-C3", detail: "Precision Ball Bearing — 50 pcs, $47.25/ea", timestamp: "10:02 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v1-3", type: "line-item-added", action: "Added", subject: "ELC-1190-H2", detail: "Wire Harness Connector — 250 pcs, $18.90/ea", timestamp: "10:04 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v1-4", type: "line-item-added", action: "Added", subject: "GSK-3305-R1", detail: "Nitrile Gasket Seal — 200 pcs, $6.40/ea", timestamp: "10:06 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v1-5", type: "config-changed", action: "Changed", subject: "Payment Terms", detail: "Net 30", timestamp: "10:08 AM", user: "Areeb Tanvir" },
      ],
      snapshot: v1Snapshot,
    },
  ];
  /* Seed demo notes */
  seeded.poNotes = [
    { id: "note-seed-1", type: "vendor", text: "Please ship all items on a single pallet. Mark boxes with PO number on the outside.", author: "Areeb Tanvir", authorInitials: "AT", timestamp: "Mar 10, 2026, 11:15 AM" },
    { id: "note-seed-2", type: "vendor", text: "Include certificate of conformance for all hydraulic components per ISO 9001 requirements.", author: "Nophil Anwer", authorInitials: "NA", timestamp: "Mar 08, 2026, 02:30 PM" },
    { id: "note-seed-3", type: "internal", text: "Vendor offered 3% additional discount if we increase HYD-4420-A1 qty to 15+. Checking with engineering.", author: "Areeb Tanvir", authorInitials: "AT", timestamp: "Mar 09, 2026, 09:45 AM" },
    { id: "note-seed-4", type: "internal", text: "Backup vendor: Toyota TTC can supply equivalent bearings at $44.50/ea if GM delivery slips past April.", author: "Irtaza Abid", authorInitials: "IA", timestamp: "Mar 07, 2026, 04:20 PM" },
    /* Line-item level notes */
    { id: "note-seed-5", type: "vendor", text: "Require anti-corrosion coating on all hydraulic assemblies.", author: "Areeb Tanvir", authorInitials: "AT", timestamp: "Mar 06, 2026, 10:00 AM", lineItemId: "demo-li-1" },
    { id: "note-seed-6", type: "internal", text: "Engineering confirmed 2RS variant is acceptable. Do NOT substitute with ZZ type.", author: "Nophil Anwer", authorInitials: "NA", timestamp: "Mar 05, 2026, 03:15 PM", lineItemId: "demo-li-2" },
    { id: "note-seed-7", type: "vendor", text: "IP67 rating is mandatory — please include test report with shipment.", author: "Areeb Tanvir", authorInitials: "AT", timestamp: "Mar 04, 2026, 11:30 AM", lineItemId: "demo-li-3" },
    { id: "note-seed-8", type: "internal", text: "Bolt grade A4-80 confirmed by structural team. Previous orders used A2-70 which failed stress test.", author: "Irtaza Abid", authorInitials: "IA", timestamp: "Mar 03, 2026, 02:00 PM", lineItemId: "demo-li-6" },
  ];
  applyComputedTotals(seeded);
  purchaseOrders.set(id, seeded);
}

/* ══════════════════════════════════════════════════════════════
   SEED ALL LISTING POs — 20 POs covering every status type
   ═══════════════════════════════════════════════════════════════ */

function seedListingPOs(): void {
  const statuses: POStatus[] = [
    "Draft", "Sent", "Active with Cancellations", "Draft", "Sent",
    "Active with Cancellations", "Confirmed", "Partially Received",
    "Cancelled", "Fully Received", "Confirmed", "Partially Received",
    "Active with Cancellations", "Fully Received", "Draft", "Sent",
    "Fully Received with Cancellations", "Sent", "Draft", "Sent",
  ];
  /* Longer PO numbers sprinkled in for realistic wide-number rendering
     (buyer 2026-07-21: "increase the PO and SO number counts for some
     to 7 or 8 digits"). Mixed with the default 4-digit refs so the
     Type/Source column gets stressed by both. */
  const poNumbers = [
    "395-9825", "395-9823", "395-9824", "395-9826", "395-9827",
    "395-90128293", "395-9829", "395-9830", "395-8412831", "395-9832",
    "395-9823", "395-9834", "395-77192835", "395-9836", "395-9837",
    "395-9838", "395-6218839", "395-9840", "395-9841", "395-88329842",
  ];
  const partnerNames = [
    "General Motors (GM)", "Toyota Technical Center (TTC)", "Ford Motor Company",
    "Tesla, Inc.", "Chrysler (Stellantis N.V.)", "Rivian Automotive",
    "Lucid Motors", "Honda Motor Co., Ltd. (USA)", "Nissan North America",
    "BMW of North America",
  ];
  const contactNames = [
    "Sherry Brown", "Cameron Williamson", "Leslie Alexander",
    "Jerome Bell", "Marvin McKinney", "Brooklyn Simmons",
    "Savannah Nguyen", "Leslie Alexander", "Jerome Bell",
    "Cameron Williamson",
  ];
  const createdByList = [
    "Areeb Tanvir", "Shehryar Hasan",
    "Nophil Anwer", "Irtaza Abid", "Eli Rosenbloom",
  ];
  const shipLocations = [
    "Pasadena, Oklahoma", "Great Falls, Maryland", "Lansing, Illinois",
    "Pasadena, Oklahoma", "Portland, Illinois", "Lafayette, California",
    "Stockton, New Hampshire", "Great Falls, Maryland",
    "Lansing, Illinois", "Pasadena, Oklahoma",
  ];

  const imgs = DEMO_LINE_ITEMS.map((li) => li.image);

  type ItemDef = [string, string, number, number, string, number, string, number];
  const pool: ItemDef[] = [
    ["BPA-4210-R2", "Brake Pad Assembly — Ceramic, Front Axle", 84.50, 8, "Set", 2, "Brakes", 5],
    ["OFH-3180-AL", "Oil Filter Housing — Aluminum Die-Cast", 42.00, 20, "Unit", 1, "Filtration", 0],
    ["TGS-6600-S1", "Transmission Gear Set — 6-Speed Manual", 520.00, 4, "Kit", 1, "Drivetrain", 8],
    ["CLP-2290-M3", "Coolant Pump Assembly — Electric, 12V", 175.00, 10, "Unit", 1, "Cooling", 3],
    ["EXM-7710-CI", "Exhaust Manifold — Cast Iron, V6", 310.00, 6, "Unit", 1, "Exhaust", 0],
    ["SPW-1140-PT", "Spark Plug Wire Set — Platinum Core", 28.50, 24, "Set", 4, "Ignition", 10],
    ["AFE-5520-K1", "Air Filter Element — High-Flow, K&N Style", 15.75, 100, "Piece", 1, "Filtration", 0],
    ["TCU-8830-T4", "Turbo Charger Unit — Twin-Scroll, T4 Flange", 1450.00, 2, "Unit", 1, "Forced Induction", 5],
    ["FIJ-9940-D2", "Fuel Injector Nozzle — Direct Injection, 550cc", 89.00, 16, "Piece", 1, "Fuel System", 0],
    ["RDC-4450-CU", "Radiator Core Assembly — Copper/Brass, 2-Row", 245.00, 6, "Unit", 1, "Cooling", 4],
    ["WHA-3370-FR", "Wheel Hub Assembly — Front, ABS Sensor Incl.", 168.00, 8, "Unit", 1, "Chassis", 0],
    ["PSP-6680-HY", "Power Steering Pump — Hydraulic, Remanufactured", 395.00, 4, "Unit", 1, "Steering", 6],
    ["CVJ-5590-ST", "CV Joint Boot Kit — Split Type, Universal", 34.50, 20, "Kit", 2, "Drivetrain", 0],
    ["IGC-2280-V6", "Ignition Coil Pack — Direct Fit, V6 Engine", 67.00, 12, "Unit", 1, "Ignition", 3],
    ["THM-1170-DG", "Thermostat Housing — Die-Cast, Integrated Sensor", 55.00, 15, "Unit", 1, "Cooling", 0],
  ];

  const SO: POStatus[] = ["Draft", "Sent", "Confirmed", "Partially Received", "Fully Received"];

  for (let i = 0; i < 20; i++) {
    const id = `po-${i + 1}`;
    if (purchaseOrders.has(id)) continue;

    const status = statuses[i];
    const vendorName = partnerNames[i % 10];
    const contact = contactNames[i % 10];
    /* createdByList has 5 entries; `i % 6` used to land undefined
       for i = 5, 11, 17 → three POs shipped with createdBy=undefined,
       which crashed the listing's search filter the moment a buyer
       typed anything (Cannot read 'toLowerCase' of undefined). */
    const creator = createdByList[i % createdByList.length];
    const shipTo = shipLocations[i % 10];

    const itemCount = (i % 4) + 2;
    /* Deterministic per-line dates so the delivery-dates strip in the
       line-items table renders real values instead of dashes (buyer
       2026-07-22). needByDate stays at 2026-03-18 (already used
       elsewhere), but promisedShipDate is offset from needBy by a
       small line-varying delta so different POs read as having
       different vendor commits. */
    const needByBase = new Date("2026-03-18T00:00:00");
    const lineItems: POLineItem[] = [];
    for (let j = 0; j < itemCount; j++) {
      const p = pool[(i * 3 + j * 2) % pool.length];
      const qtyMult = (i % 3) + 1;
      const qty = p[3] * qtyMult;
      const uomQty = p[5];
      const vQty = Math.max(1, Math.ceil(qty / Math.max(1, uomQty)));
      const disc = p[7];
      /* Ship date = needBy − (3 + (i*2 + j) % 5) days, giving a spread
         of 3–7 days lead across the 20 listing POs. */
      const shipDelta = 3 + ((i * 2 + j) % 5);
      const shipDate = new Date(needByBase.getTime() - shipDelta * 86400000);
      const shipISO = shipDate.toISOString().split("T")[0];
      lineItems.push({
        id: `${id}-li-${j + 1}`,
        itemNumber: p[0],
        descriptiveName: p[1],
        image: imgs[(i + j) % imgs.length],
        unitPrice: p[2],
        vendorQty: vQty,
        vendorUOM: p[4],
        vendorUOMQty: uomQty,
        quantity: qty,
        defaultUOM: "Unit",
        discount: disc,
        lineTotal: p[2] * qty * (1 - disc / 100),
        shipmentMethod: "fedex-ground",
        needByDate: "2026-03-18",
        promisedShipDate: shipISO,
        inboundLocation: shipTo,
        category: p[6],
        receivedQuantity: 0,
      });
    }

    const baseDate = new Date(2024, 11, 23);
    const orderDate = new Date(baseDate.getTime() - (14 + i * 14) * 86400000);
    const deliveryDate = new Date(baseDate.getTime() - i * 14 * 86400000);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const effectiveStatus: POStatus =
      status === "Cancelled" ? "Sent"
      : status === "Active with Cancellations" ? "Confirmed"
      : status === "Fully Received with Cancellations" ? "Fully Received"
      : status;
    const sIdx = SO.indexOf(effectiveStatus);

    const sentDate: string | null = sIdx >= 1 ? fmt(new Date(orderDate.getTime() + 3 * 86400000)) : null;
    const confirmationDate: string | null = sIdx >= 2 ? fmt(new Date(orderDate.getTime() + 7 * 86400000)) : null;
    const receivingStartDate: string | null = sIdx >= 3 ? fmt(new Date(orderDate.getTime() + 14 * 86400000)) : null;

    let preCancellationStatus: POStatus | undefined;
    let cancellationReason: string | undefined;
    let cancellationDate: string | undefined;

    if (status === "Partially Received") {
      lineItems.forEach((li, j) => {
        if (j === 0) li.receivedQuantity = Math.floor(li.quantity * 0.6);
        if (j === 1) li.receivedQuantity = Math.floor(li.quantity * 0.3);
      });
    }
    if (status === "Fully Received" || status === "Fully Received with Cancellations") {
      lineItems.forEach((li) => { if (!li.cancelled) li.receivedQuantity = li.quantity; });
    }
    if (status === "Cancelled") {
      preCancellationStatus = "Sent";
      cancellationReason = "Vendor unable to fulfill order within required timeline";
      cancellationDate = fmt(new Date(orderDate.getTime() + 10 * 86400000));
    }
    if (status === "Active with Cancellations") {
      const last = lineItems[lineItems.length - 1];
      last.cancelled = true;
      last.cancelledDate = fmt(new Date(orderDate.getTime() + 12 * 86400000));
    }
    /* Demo: Draft 395-9826 (po-4) carries a line whose item master was
       marked inactive after the draft was created — exercises the
       non-blocking "proceeding with an inactive item" warning. */
    if (id === "po-4" && lineItems[1]) {
      lineItems[1].inactive = { by: "Sarah Mitchell", role: "Engineer", at: "2026-09-24" };
    }
    if (status === "Fully Received with Cancellations") {
      const last = lineItems[lineItems.length - 1];
      last.cancelled = true;
      last.cancelledDate = fmt(new Date(orderDate.getTime() + 10 * 86400000));
      last.receivedQuantity = 0;
    }

    const activeItems = lineItems.filter((li) => !li.cancelled);
    const subtotal = activeItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
    const discountTotal = activeItems.reduce((s, li) => s + li.unitPrice * li.quantity * (li.discount / 100), 0);
    const shippingFee = Math.round(activeItems.length * 12.5 * 100) / 100;
    const total = subtotal - discountTotal + shippingFee;

    const vendorInfo = VENDOR_DETAILS[vendorName] || DEFAULT_VENDOR;
    const payment: POPaymentDelivery = {
      ...(PAYMENT_DEFAULTS[vendorName] || DEFAULT_PAYMENT),
      shippedTo: shipTo,
    };

    const po: PurchaseOrderData = {
      id,
      poNumber: poNumbers[i],
      status,
      orderDate: fmt(orderDate),
      deliveryDate: fmt(deliveryDate),
      confirmationDate,
      sentDate,
      receivingStartDate,
      vendor: { name: vendorName, ...vendorInfo },
      recipient: {
        name: contact,
        role: "Vendor Account Manager",
        email: `${contact.toLowerCase().replace(/ /g, ".")}@vendor.com`,
        phone: `+1 (555) ${String(100 + i).padStart(3, "0")}-${String(1000 + i * 111).slice(0, 4)}`,
      },
      secondaryContactNames: [],
      lineItems,
      payment,
      subtotal,
      shippingFee,
      discountTotal,
      total,
      notes: "",
      poNotes: [],
      createdBy: creator,
      createdAt: orderDate.toISOString(),
      /* Seeded approval — every listing PO past Draft has an
         approver stamped (a hand-off from the creator). Draft rows
         intentionally have neither so the "Pending approval" UI
         state gets exercised. */
      approvedBy: status === "Draft" ? undefined : (i % 2 === 0 ? "Nophil Anwer" : "Ahtsham Ahmad"),
      approvedAt: status === "Draft"
        ? undefined
        : new Date(orderDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      receivingRecords: [],
      currentVersion: 1,
      versions: [],
      preCancellationStatus,
      cancellationReason,
      cancellationDate,
    };

    /* Demo: Draft 395-9825 (po-1) carries one-time discounts/premiums —
       one order-level, one item-level — so the Order Summary row, the
       manage modal and the line hover card have data out of the box. */
    if (id === "po-1" && lineItems.length >= 2) {
      po.adjustments = [
        { id: "A-seed-1", label: "Volume commitment credit", type: "discount", amountType: "%", amount: 3, scope: "quote", isApplied: true, internalNotes: "Annual volume agreement with vendor rep." },
        { id: "A-seed-2", label: "Expedited handling", type: "premium", amountType: "$", amount: 85, scope: "item", appliedTo: [lineItems[1].id], isApplied: true },
      ];
    }
    applyComputedTotals(po);
    purchaseOrders.set(id, initVersioning(po));
  }
}

/* ══════════════════════════════════════════════════════════════
   SEED OUTDATED-CONFIGS DEMO PO
   Stable id `po-outdated-demo`. The outdatedConfigs mock store
   populates its update pool against this same id, so exactly one
   Draft row in the listing surfaces the amber "Outdated
   Configurations" pill and the detail page shows the full pill
   in its header.
   ═══════════════════════════════════════════════════════════════ */

function seedOutdatedDemoPO(): void {
  const id = "po-outdated-demo";
  if (purchaseOrders.has(id)) return;

  const vendorName = "General Motors (GM)";
  const vendorInfo = VENDOR_DETAILS[vendorName]!;
  const payment: POPaymentDelivery = {
    ...(PAYMENT_DEFAULTS[vendorName] || DEFAULT_PAYMENT),
    shippedTo: "Pasadena, Oklahoma",
  };

  const lineItems: POLineItem[] = [
    {
      id: `${id}-li-1`,
      itemNumber: "HYD-4420-A1",
      descriptiveName: "Hydraulic Cylinder Assembly — 3\" Bore x 18\" Stroke",
      image: DEMO_LINE_ITEMS[0].image,
      unitPrice: 1245.0,
      vendorQty: 2,
      vendorUOM: "Pair",
      vendorUOMQty: 2,
      quantity: 4,
      defaultUOM: "Unit",
      discount: 5,
      lineTotal: 1245.0 * 4 * 0.95,
      shipmentMethod: "fedex-ground",
      needByDate: "2026-07-24",
      promisedShipDate: "2026-07-19",
      inboundLocation: "Pasadena, Oklahoma",
      category: "Hydraulics",
      receivedQuantity: 0,
    },
    {
      id: `${id}-li-2`,
      itemNumber: "BRG-7750-C3",
      descriptiveName: "Precision Ball Bearing — 6205-2RS, 25x52x15mm",
      image: DEMO_LINE_ITEMS[1].image,
      unitPrice: 47.25,
      vendorQty: 5,
      vendorUOM: "Box",
      vendorUOMQty: 10,
      quantity: 50,
      defaultUOM: "Unit",
      discount: 0,
      lineTotal: 47.25 * 50,
      shipmentMethod: "fedex-ground",
      needByDate: "2026-07-22",
      promisedShipDate: "2026-07-17",
      inboundLocation: "Pasadena, Oklahoma",
      category: "Bearings",
      receivedQuantity: 0,
    },
    {
      id: `${id}-li-3`,
      itemNumber: "ELC-1190-H2",
      descriptiveName: "Automotive Wire Harness Connector — 24-pin, IP67 Rated",
      image: DEMO_LINE_ITEMS[2].image,
      unitPrice: 18.9,
      vendorQty: 10,
      vendorUOM: "Bag",
      vendorUOMQty: 25,
      quantity: 250,
      defaultUOM: "Unit",
      discount: 8,
      lineTotal: 18.9 * 250 * 0.92,
      shipmentMethod: "fedex-ground",
      needByDate: "2026-07-18",
      promisedShipDate: "2026-07-13",
      inboundLocation: "Pasadena, Oklahoma",
      category: "Electrical",
      receivedQuantity: 0,
    },
  ];

  const subtotal = lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  const discountTotal = lineItems.reduce(
    (s, li) => s + li.unitPrice * li.quantity * (li.discount / 100),
    0,
  );
  const shippingFee = Math.round(lineItems.length * 12.5 * 100) / 100;
  const total = subtotal - discountTotal + shippingFee;

  const po: PurchaseOrderData = {
    id,
    poNumber: "395-9822",
    status: "Draft",
    orderDate: "2026-07-01",
    deliveryDate: "2026-07-24",
    confirmationDate: null,
    sentDate: null,
    receivingStartDate: null,
    vendor: { name: vendorName, ...vendorInfo },
    recipient: {
      name: "Richard Kowalski",
      role: "Vendor Account Manager",
      email: "r.kowalski@gm.com",
      phone: "+1 (313) 556-5102",
    },
    secondaryContactNames: [],
    lineItems,
    payment,
    subtotal,
    shippingFee,
    discountTotal,
    total,
    notes: "",
    poNotes: [],
    createdBy: "Areeb Tanvir",
    receivingRecords: [],
    currentVersion: 1,
    versions: [],
  };

  applyComputedTotals(po);
  purchaseOrders.set(id, initVersioning(po));
}

// Auto-seed on module load
seedDemoPO();
seedListingPOs();
seedOutdatedDemoPO();