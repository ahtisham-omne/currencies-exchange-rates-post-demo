/* ═══════════════════════════════════════════════════════════════
   PO Store — Simple module-level store for created Purchase Orders
   No external dependencies. Works as an in-memory singleton.
   ═══════════════════════════════════════════════════════════════ */

import { getVendorContacts } from "./catalogData";

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
  dueDeliveryDate: string;
  inboundLocation: string;
  category: string;
  receivedQuantity: number;
  shipByDate?: string;
  cancelled?: boolean;
  cancelledDate?: string;
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

export type POChangeType =
  | "line-item-added"
  | "line-item-removed"
  | "line-item-modified"
  | "pricing-changed"
  | "vendor-changed"
  | "config-changed";

export interface POChangeRecord {
  id: string;
  type: POChangeType;
  action: "Added" | "Removed" | "Changed";
  subject: string;
  detail?: string;
  timestamp: string;
  user: string;
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
  dueDeliveryDate: string;
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
  createdBy: string;
  receivingRecords: ReceivingRecord[];
  currentVersion: number;
  versions: POVersionEntry[];
  /* Cancellation fields */
  preCancellationStatus?: POStatus;
  cancellationReason?: string;
  cancellationDate?: string;
  reactivationReason?: string;
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

export function buildVersionSnapshot(po: PurchaseOrderData): POVersionSnapshot {
  return {
    poNumber: po.poNumber,
    vendorName: po.vendor.name,
    status: po.status,
    deliveryDate: po.deliveryDate,
    notes: po.notes,
    lineItemCount: po.lineItems.length,
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
      dueDeliveryDate: li.dueDeliveryDate,
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

  // Restore line items — rebuild with images/categories from current PO
  po.lineItems = snapshot.lineItems.map((li, idx) => {
    const existing = po.lineItems.find((x) => x.itemNumber === li.itemNumber);
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
      shipmentMethod: existing?.shipmentMethod || "fedex-ground",
      dueDeliveryDate: li.dueDeliveryDate,
      inboundLocation: li.inboundLocation,
      category: existing?.category || "",
      receivedQuantity: existing?.receivedQuantity || 0,
      shipByDate: existing?.shipByDate,
      cancelled: li.cancelled,
      cancelledDate: existing?.cancelledDate,
    };
  });

  // Restore totals
  po.subtotal = snapshot.subtotal;
  po.discountTotal = snapshot.discountTotal;
  po.shippingFee = snapshot.shippingFee;
  po.total = snapshot.total;

  purchaseOrders.set(poId, { ...po });
  notify();
}

export function revertPOToVersion(poId: string, version: number, reason: string): number | null {
  const po = purchaseOrders.get(poId);
  if (!po) return null;
  const source = po.versions.find((v) => v.version === version);
  if (!source) return null;

  po.deliveryDate = source.snapshot.deliveryDate;
  po.notes = source.snapshot.notes;
  po.payment = clonePayment(source.snapshot.payment);
  po.lineItems = source.snapshot.lineItems.map((li, idx) => ({
    id: `${po.id}-rv-${idx + 1}-${Date.now()}`,
    itemNumber: li.itemNumber,
    descriptiveName: li.descriptiveName,
    image: po.lineItems.find((x) => x.itemNumber === li.itemNumber)?.image || "",
    unitPrice: li.unitPrice,
    vendorQty: li.vendorQty,
    vendorUOM: li.vendorUOM,
    vendorUOMQty: Math.max(1, Math.round(li.quantity / Math.max(1, li.vendorQty))),
    quantity: li.quantity,
    defaultUOM: po.lineItems.find((x) => x.itemNumber === li.itemNumber)?.defaultUOM || "Unit",
    discount: li.discount,
    lineTotal: li.lineTotal,
    shipmentMethod: po.lineItems.find((x) => x.itemNumber === li.itemNumber)?.shipmentMethod || "fedex-ground",
    dueDeliveryDate: li.dueDeliveryDate,
    inboundLocation: li.inboundLocation,
    category: po.lineItems.find((x) => x.itemNumber === li.itemNumber)?.category || "",
    receivedQuantity: 0,
    cancelled: li.cancelled,
  }));
  po.subtotal = source.snapshot.subtotal;
  po.discountTotal = source.snapshot.discountTotal;
  po.shippingFee = source.snapshot.shippingFee;
  po.total = source.snapshot.total;

  const newVersion = recordPOVersion(poId, {
    reason: reason || `Reverted to Version ${version}`,
    isRevert: true,
    revertedFrom: version,
    changes: [
      {
        type: "config-changed",
        action: "Changed",
        subject: `Reverted to Version ${version}`,
        detail: reason || "Version revert",
      },
    ],
  });

  return newVersion;
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
    dueDeliveryDate: string;
    inboundLocation: string;
    category: string;
  }>,
  notes?: string
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

  const lineItems: POLineItem[] = items.map((item) => {
    const lineTotal = item.unitPrice * item.quantity * (1 - item.discount / 100);
    return { ...item, lineTotal, receivedQuantity: 0 };
  });

  const subtotal = lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  const discountTotal = lineItems.reduce((s, li) => s + li.unitPrice * li.quantity * (li.discount / 100), 0);
  const shippingFee = Math.round(lineItems.length * 12.5 * 100) / 100; // mock shipping
  const total = subtotal - discountTotal + shippingFee;

  const now = new Date();
  const deliveryDate = items[0]?.dueDeliveryDate || new Date(now.getTime() + 14 * 86400000).toISOString().split("T")[0];

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
    subtotal,
    shippingFee,
    discountTotal,
    total,
    notes: notes || "",
    poNotes: [],
    createdBy: "Areeb Tanvir",
    receivingRecords: [],
    currentVersion: 1,
    versions: [],
  };

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
    dueDeliveryDate: string;
    inboundLocation: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    notes: string;
    totalPrice: number;
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
    dueDeliveryDate: orderDetails.dueDeliveryDate,
    inboundLocation: orderDetails.inboundLocation,
    category: item.category,
    receivedQuantity: 0,
  };

  const subtotal = item.unitPrice * orderDetails.quantity;
  const discountTotal = subtotal * (item.discount / 100);
  const shippingFee = 12.5;
  const total = subtotal - discountTotal + shippingFee;

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
    deliveryDate: orderDetails.dueDeliveryDate,
    confirmationDate: null,
    sentDate: null,
    receivingStartDate: null,
    vendor: { name: vendorName, ...vendorInfo },
    recipient,
    secondaryContactNames: [],
    lineItems: [lineItem],
    payment,
    subtotal,
    shippingFee,
    discountTotal,
    total,
    notes: orderDetails.notes,
    poNotes: [],
    createdBy: "Areeb Tanvir",
    receivingRecords: [],
    currentVersion: 1,
    versions: [],
  };

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

/** Cancel a PO — stores pre-cancellation state and reason */
export function cancelPO(id: string, reason: string): void {
  const po = purchaseOrders.get(id);
  if (!po) return;
  const today = new Date().toISOString().split("T")[0];
  po.preCancellationStatus = po.status;
  po.cancellationReason = reason;
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
  po.cancellationDate = undefined;
  purchaseOrders.set(id, { ...po });
  notify();
}

/** Cancel an individual line item — deducts from totals, may change PO status */
export function cancelLineItem(poId: string, lineItemId: string): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;
  const today = new Date().toISOString().split("T")[0];

  const idx = po.lineItems.findIndex((li) => li.id === lineItemId);
  if (idx === -1) return;

  po.lineItems[idx] = { ...po.lineItems[idx], cancelled: true, cancelledDate: today };

  // Recalculate totals excluding cancelled items
  const activeItems = po.lineItems.filter((li) => !li.cancelled);
  po.subtotal = activeItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  po.discountTotal = activeItems.reduce((s, li) => s + li.unitPrice * li.quantity * (li.discount / 100), 0);
  po.shippingFee = Math.round(activeItems.length * 12.5 * 100) / 100;
  po.total = po.subtotal - po.discountTotal + po.shippingFee;

  // Check if all non-cancelled items are fully received
  const allFullyReceived = activeItems.length > 0 && activeItems.every((li) => li.receivedQuantity >= li.quantity);
  const hasCancellations = po.lineItems.some((li) => li.cancelled);

  if (allFullyReceived && hasCancellations) {
    po.status = "Fully Received with Cancellations";
  } else if (hasCancellations && po.status !== "Cancelled") {
    po.status = "Active with Cancellations";
  }

  purchaseOrders.set(poId, { ...po });
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
  po.lineItems[idx] = li;

  // Recalculate totals
  po.subtotal = po.lineItems.reduce((s, item) => s + item.unitPrice * item.quantity, 0);
  po.discountTotal = po.lineItems.reduce((s, item) => s + item.unitPrice * item.quantity * (item.discount / 100), 0);
  po.shippingFee = Math.round(po.lineItems.length * 12.5 * 100) / 100;
  po.total = po.subtotal - po.discountTotal + po.shippingFee;

  purchaseOrders.set(poId, { ...po });
  notify();
}

/** Add a new line item to an existing PO (Draft only) and recalculate totals */
export function addLineItemToPO(
  poId: string,
  item: Omit<POLineItem, "lineTotal" | "receivedQuantity">
): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;

  // Prevent duplicates by itemNumber
  if (po.lineItems.some((li) => li.itemNumber === item.itemNumber)) return;

  const lineTotal = item.unitPrice * item.quantity * (1 - item.discount / 100);
  const newItem: POLineItem = { ...item, lineTotal, receivedQuantity: 0 };
  po.lineItems.push(newItem);

  // Recalculate totals
  po.subtotal = po.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  po.discountTotal = po.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity * (li.discount / 100), 0);
  po.shippingFee = Math.round(po.lineItems.length * 12.5 * 100) / 100;
  po.total = po.subtotal - po.discountTotal + po.shippingFee;

  purchaseOrders.set(poId, { ...po });
  notify();
}

/** Remove a line item from an existing PO (Draft only) and recalculate totals */
export function removeLineItemFromPO(poId: string, lineItemId: string): void {
  const po = purchaseOrders.get(poId);
  if (!po) return;

  po.lineItems = po.lineItems.filter((li) => li.id !== lineItemId);

  // Recalculate totals
  po.subtotal = po.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  po.discountTotal = po.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity * (li.discount / 100), 0);
  po.shippingFee = Math.round(po.lineItems.length * 12.5 * 100) / 100;
  po.total = po.subtotal - po.discountTotal + po.shippingFee;

  purchaseOrders.set(poId, { ...po });
  notify();
}

/* ── Duplicate a PO as a new Draft ── */
export function duplicatePO(sourceId: string): PurchaseOrderData | null {
  const source = purchaseOrders.get(sourceId);
  if (!source) return null;

  poCounter++;
  const id = `po-new-${poCounter}`;
  const poNumber = `395-${9900 + poCounter}`;
  const now = new Date();

  const newLineItems: POLineItem[] = source.lineItems.map((li, idx) => ({
    ...li,
    id: `${id}-li-${idx + 1}`,
    receivedQuantity: 0,
  }));

  const po: PurchaseOrderData = {
    id,
    poNumber,
    status: "Draft",
    orderDate: now.toISOString().split("T")[0],
    deliveryDate: source.deliveryDate,
    confirmationDate: null,
    sentDate: null,
    receivingStartDate: null,
    vendor: { ...source.vendor },
    recipient: { ...source.recipient },
    secondaryContactNames: [...source.secondaryContactNames],
    lineItems: newLineItems,
    payment: { ...source.payment },
    subtotal: source.subtotal,
    shippingFee: source.shippingFee,
    discountTotal: source.discountTotal,
    total: source.total,
    notes: source.notes,
    poNotes: source.poNotes.map(n => ({ ...n, id: `note-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    createdBy: source.createdBy,
    receivingRecords: [],
    currentVersion: 1,
    versions: [],
  };

  purchaseOrders.set(id, initVersioning(po, `Duplicated from ${source.poNumber}`));
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
    dueDeliveryDate: "2026-03-18",
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
    dueDeliveryDate: "2026-03-18",
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
    dueDeliveryDate: "2026-03-12",
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
    dueDeliveryDate: "2026-03-15",
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
    dueDeliveryDate: "2026-03-22",
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
    dueDeliveryDate: "2026-03-11",
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
    { id: "demo-li-1", itemNumber: "HYD-4420-A1", descriptiveName: "Hydraulic Cylinder Assembly — 3\" Bore x 18\" Stroke", quantity: 4, vendorQty: 2, vendorUOM: "Pair", unitPrice: 1245.00, discount: 5, lineTotal: 2366.50 * 2, dueDeliveryDate: "2026-03-20", inboundLocation: "Warehouse A - Pasadena, OK" },
    { id: "demo-li-2", itemNumber: "BRG-7750-C3", descriptiveName: "Precision Ball Bearing — 6205-2RS, 25x52x15mm", quantity: 50, vendorQty: 5, vendorUOM: "Box", unitPrice: 47.25, discount: 0, lineTotal: 2362.50, dueDeliveryDate: "2026-03-18", inboundLocation: "Warehouse A - Pasadena, OK" },
    { id: "demo-li-3", itemNumber: "ELC-1190-H2", descriptiveName: "Automotive Wire Harness Connector — 24-pin, IP67 Rated", quantity: 250, vendorQty: 10, vendorUOM: "Bag", unitPrice: 18.90, discount: 8, lineTotal: 4347.00, dueDeliveryDate: "2026-03-12", inboundLocation: "Warehouse A - Pasadena, OK" },
    { id: "demo-li-4", itemNumber: "GSK-3305-R1", descriptiveName: "Industrial Nitrile Gasket Seal — 4\" OD x 3\" ID", quantity: 200, vendorQty: 4, vendorUOM: "Pack", unitPrice: 6.40, discount: 0, lineTotal: 1280.00, dueDeliveryDate: "2026-03-15", inboundLocation: "Warehouse A - Pasadena, OK" },
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
    { id: "demo-li-5", itemNumber: "ALU-5580-T6", descriptiveName: "Aluminum Extrusion Profile — T-Slot 40x40mm, 6061-T6", quantity: 32, vendorQty: 8, vendorUOM: "Bundle", unitPrice: 32.75, discount: 3, lineTotal: 1016.08, dueDeliveryDate: "2026-03-22", inboundLocation: "Warehouse A - Pasadena, OK" },
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
    { id: "demo-li-6", itemNumber: "FST-8810-SS", descriptiveName: "Stainless Steel Hex Head Bolt — M12 x 60mm, Grade A4-80", quantity: 2000, vendorQty: 20, vendorUOM: "Box", unitPrice: 1.85, discount: 12, lineTotal: 3256.00, dueDeliveryDate: "2026-03-11", inboundLocation: "Warehouse A - Pasadena, OK" },
    { id: "demo-li-7", itemNumber: "TSK-2200-M4", descriptiveName: "Transmission Seal Kit — Complete Rebuild Set", quantity: 6, vendorQty: 6, vendorUOM: "Kit", unitPrice: 89.50, discount: 0, lineTotal: 537.00, dueDeliveryDate: "2026-03-18", inboundLocation: "Warehouse A - Pasadena, OK" },
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
      reason: "Delivery date changed from Mar 22 to Apr 5, shipping method changed to DHL Express",
      changes: [
        { id: "chg-po-demo-v4-1", type: "config-changed", action: "Changed", subject: "Delivery Date", detail: "Mar 22 → Apr 5", timestamp: "11:08 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v4-2", type: "config-changed", action: "Changed", subject: "Shipping Method", detail: "FedEx Freight → DHL Express", timestamp: "11:09 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v4-3", type: "config-changed", action: "Changed", subject: "Pay To", detail: "General Motors Financial → Toyota Motor Credit", timestamp: "11:10 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v4-4", type: "config-changed", action: "Changed", subject: "Funded By", detail: "Omne Manufacturing Corp. → Omne Precision Engineering", timestamp: "11:12 AM", user: "Areeb Tanvir" },
        { id: "chg-po-demo-v4-5", type: "config-changed", action: "Changed", subject: "Payment Method", detail: "Wire Transfer → ACH Transfer", timestamp: "11:14 AM", user: "Nophil Anwer" },
      ],
      snapshot: v4Snapshot,
      changeTags: ["Date Change", "Shipping Change", "Billing Change", "Funding Change", "Payment Method Change"],
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
  const poNumbers = [
    "395-9825", "395-9823", "395-9824", "395-9826", "395-9827",
    "395-9828", "395-9829", "395-9830", "395-9831", "395-9832",
    "395-9823", "395-9834", "395-9835", "395-9836", "395-9837",
    "395-9838", "395-9839", "395-9840", "395-9841", "395-9842",
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
    const creator = createdByList[i % 6];
    const shipTo = shipLocations[i % 10];

    const itemCount = (i % 4) + 2;
    const lineItems: POLineItem[] = [];
    for (let j = 0; j < itemCount; j++) {
      const p = pool[(i * 3 + j * 2) % pool.length];
      const qtyMult = (i % 3) + 1;
      const qty = p[3] * qtyMult;
      const uomQty = p[5];
      const vQty = Math.max(1, Math.ceil(qty / Math.max(1, uomQty)));
      const disc = p[7];
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
        dueDeliveryDate: "2026-03-18",
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
      receivingRecords: [],
      currentVersion: 1,
      versions: [],
      preCancellationStatus,
      cancellationReason,
      cancellationDate,
    };

    purchaseOrders.set(id, initVersioning(po));
  }
}

// Auto-seed on module load
seedDemoPO();
seedListingPOs();