import type { RateType } from "@/app/currency/rates";

// ===== SO Types =====
export type SOStatus =
  | "Draft"
  | "Pending Review"
  | "Cleared"
  | "Rejected"
  | "Partially Shipped"
  | "Shipped"
  | "Partially Cancelled"
  | "Cancelled"
  | "Archived";

/** Reasons surfaced in the "Reject Order" reason picker. This is the
 *  approver's work-instruction back to the sales rep, so comments are
 *  always mandatory (see the Reject Order modal for enforcement). */
export type SORejectionReason =
  | "Insufficient stock"
  | "Credit limit exceeded or customer on hold"
  | "Pricing or discount outside approved threshold"
  | "Requested delivery date not feasible"
  | "Incomplete or incorrect customer details"
  | "Invalid shipping or billing address"
  | "Line item error"
  | "Missing purchase order or supporting document"
  | "Payment terms not compliant"
  | "Duplicate order"
  | "Other";

export const SO_REJECTION_REASONS: SORejectionReason[] = [
  "Insufficient stock",
  "Credit limit exceeded or customer on hold",
  "Pricing or discount outside approved threshold",
  "Requested delivery date not feasible",
  "Incomplete or incorrect customer details",
  "Invalid shipping or billing address",
  "Line item error",
  "Missing purchase order or supporting document",
  "Payment terms not compliant",
  "Duplicate order",
  "Other",
];

export type CancellationReason =
  | "Customer Request"
  | "Out of Stock"
  | "Pricing Error"
  | "Duplicate Order"
  | "Delivery Date"
  | "Better Alternative"
  | "Credit Issue"
  | "Product Discontinued"
  | "Regulatory"
  | "Fraudulent Order"
  | "Other";

export type ItemType = "Non-Serialized" | "Serialized" | "Lot Serialized" | "Lot Non-Serialized";

/** Per-line cancellation stage, depending on its lifecycle position */
export type LineCancelAction =
  | "void"            // Draft — just delete
  | "release"         // Cleared — release allocated inventory
  | "halt-pick"       // Cleared — halt warehouse + release unpicked
  | "put-back"        // Picked — warehouse put-back request
  | "intercept"       // Shipped — carrier intercept (not guaranteed)
  | "rma"             // Shipped — redirect to Returns/RMA
  | "none";           // Cannot cancel (fully shipped)

export interface SOLine {
  id: string;
  itemCode: string;
  itemName: string;
  itemType: ItemType;
  warehouse: string;
  orderedQty: number;
  allocatedQty: number;
  pickedQty: number;
  shippedQty: number;
  deliveredQty: number;
  unitPrice: number;
  /** Unit of measure code — matches `UOM_OPTIONS.code` in `SOLineGrid`.
   *  Defaults to "EA". When the user changes the unit on a line, PPU
   *  rescales by the conversion factor (so EA→BOX with multiplier 12
   *  turns $10/EA into $120/BOX) and the per-line + order totals follow. */
  uom?: string;
  taxRate: number;
  allocations: Allocation[];
  cancelled: boolean;           // partial cancellation flag
  cancelledReason?: string;     // reason for line cancellation
  cancelledQty: number;         // how many units cancelled (supports partial qty cancel)
  /** Whether this line's allocated inventory is available for immediate picking */
  readyToPick: boolean;
  /** The lifecycle-aware cancel action determined for this line */
  /** The lifecycle-aware cancel action determined for this line */
  cancelAction?: LineCancelAction;
  /** Per-line freight override. When present this line is in per-line
   *  freight mode and the value adds onto the line total. When absent
   *  the line inherits the order-level freight default. Mirrors
   *  LineItem.shipmentConfig.shipmentCost on the Quote side. */
  shipmentCost?: number;
  /** Per-line shipment overrides — primarily `pickupLocation` so each
   *  line can ship out of one or more different warehouses than the
   *  order default. Loosely typed so the modal can stash other
   *  fields here later without churning this type. Same shape as
   *  the Quote module. */
  shipmentConfig?: {
    pickupLocation?: { warehouseIds: string[] };
    [k: string]: any;
  };
}

export interface Allocation {
  id: string;
  warehouse: string;
  qty: number;
  lotNumber?: string;
  serialNumbers?: string[];
  locked: boolean; // locked when in shipment
}

export interface SalesRep {
  name: string;
  primary: boolean;
}

// ===== Pick Record Types =====
export interface PickRecord {
  id: string;
  soLineId: string;
  itemCode: string;
  itemName: string;
  pickedQty: number;
  pickedBy: string;
  pickedByInitials: string;
  pickedAt: string;
  warehouse: string;
  location: string;
  /** Which allocation was picked from */
  allocationId: string;
}

export type SOPriority = "Low" | "Standard" | "High";

/** The same three, as a runtime list, for pickers. Ordered low to high. */
export const SO_PRIORITIES: SOPriority[] = ["Low", "Standard", "High"];

export interface SOVersion {
  number: number;
  label: "Latest" | "Last Approved" | "Superseded";
  date: string;
  /** When false, the version is excluded from the Duplicate Sales
   *  Order modal's dropdown — e.g. a version where units have
   *  shipped, or a version on a Cancelled/Archived order. Unset (or
   *  true) means the version is duplicable. */
  canDuplicate?: boolean;
}

/* Point of contact captured on creation + when changing customer.
   Mirrors the Quote module's PointOfContact so the right sidebar
   tile can read the same fields in both modules. */
export interface SOPointOfContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  initials: string;
  title: string;
  isPrimary: boolean;
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  customer: string;
  customerInitials: string;
  /** Partner record id — links the SO back to the customer in
   *  mockCustomers so the Change Customer flow can hydrate the
   *  new customer's defaults (PoC, payment terms, addresses). */
  customerId?: string;
  /** Captured at creation. The sidebar's "Point of contacts" tile
   *  used to hardcode six mock names; it now reads this list, with
   *  `primaryPocId` selecting the first card. */
  pocs?: SOPointOfContact[];
  primaryPocId?: string;
  orderDate: string;
  warehouse: string;
  /** The order's currency (spec 4.3): the quote's when converted from one,
   *  else the customer's default; changed from Order Summary. Every amount
   *  on the order is in it. See src/app/currency/soFx.ts. */
  currency: string;
  /** Base currency per one unit of `currency`, taken on the order date. */
  exchangeRate?: number;
  rateType?: RateType;
  /** The day the rate is for (ISO): the order date. */
  rateDate?: string;
  /** A corporate rate typed on this order instead of finance's. */
  rateEdited?: boolean;
  paymentTerms: string;
  shippingAddress: string;
  /** Bill-to address captured at creation. Optional because older
   *  mock records predate it; "" means the customer had none on file. */
  billingAddress?: string;
  /** Payment method captured at creation. Same optional semantics. */
  paymentMethod?: string;
  status: SOStatus;
  previousStatus?: SOStatus;
  description: string;
  lines: SOLine[];
  shipmentIds: string[];
  activityLog: ActivityEntry[];
  inventoryMovements: InventoryMovement[];
  linkedTransactions: LinkedTransaction[];
  attachments: Attachment[];
  pickRecords: PickRecord[];
  salesRep: string;
  createdDate: string;
  /** Timestamp of the last edit to this SO. Optional because legacy
   *  fixtures may not carry it; the mock generator populates it, and
   *  SOFilterUtils' `lastUpdated` date filter reads it directly. */
  lastUpdated?: string;
  total: number;
  /* ── Versioning & Priority ── */
  version: SOVersion;
  priority: SOPriority;
  versions: SOVersion[];
  /* ── Deal Information fields ── */
  sourceQuoteRef: string;
  rfqRef: string;
  tags: string[];
  internalNotes: string;
  warehouses: string[];
  requestedDeliveryDate: string;
  freightMethod: string;
  /** Order-level freight charge. When no SOLine has a per-line
   *  `shipmentCost` this is the single freight charge for the whole
   *  order; otherwise it serves as the inherited default that
   *  uncustomized lines fall back to. Used by FreightBreakdownModal
   *  + AdvancedConfiguratorModal split confirmation. */
  freightCost?: number;
  /** Order-level Freight & Logistics setup — carrier, carrier method,
   *  pickup warehouse (staging), customer-pickup fields, expected
   *  ship/delivery dates. Shape matches `ShipmentConfig` in
   *  `ShipmentMethodModal.tsx` but is stored loosely here to avoid
   *  a hard type dependency from `types.tsx` into a modal file.
   *  Serves as the source of truth the shipment tab reads carrier /
   *  mode / origin from, instead of the seeder inventing them. */
  shipmentConfig?: any;
  salesReps: SalesRep[];
  /* ── Cancellation fields ── */
  cancellationReason?: CancellationReason;
  cancellationReasonText?: string;    // free-text for "Other"
  cancellationRequestedAt?: string;
  cancellationRequestedBy?: string;
  /* ── Rejection fields ──
     Set when the approver rejects the SO. Comments are mandatory —
     they're the approver's work instruction to the sales rep. The
     record persists across new-version reactivation so the banner
     keeps reminding the rep what to fix; cleared once the reactivated
     draft is resubmitted for review. */
  rejectionReason?: SORejectionReason;
  rejectionReasonText?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  /* ── Sourcing & Production ── */
  procurementOrders: ProcurementOrder[];
  backorders: BackorderRecord[];
  sourcingStatus: SourcingStatus;
  /** Set only on orders brought in through the legacy importer. Drives
   *  the "Legacy Import" pill in the detail header, which is the one
   *  place a reader can tell this record was not created in Omne.
   *  Structural on purpose so `types` stays free of a dependency on the
   *  importer; the shape matches `LegacyImportMeta` in
   *  `components/import/importMaterialize`. */
  legacyImport?: {
    importedAt: string;
    importName?: string;
    fileName?: string;
    sourceRows: number[];
    sourceKey: string;
  };
  /** True for SOs that came through the in-app creation flow rather
   *  than the mock seed. Detail surfaces that seed demo content (one-
   *  time adjustments, pricing rules) skip that seed when this is
   *  set, so newly-created orders open clean. */
  createdViaUI?: boolean;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export type MovementType = "Reserve" | "Issue" | "Release" | "Transfer" | "Adjustment" | "Receipt";

export interface InventoryMovement {
  id: string;
  type: MovementType;
  qty: number;
  warehouse: string;
  reference: string;
  timestamp: string;
  itemCode: string;
  fromLocation?: string;       // for transfers
  toLocation?: string;         // for transfers
  netImpact?: string;          // human-readable impact description
  alertLevel?: "info" | "warning" | "error";  // for shortfall alerts
}

export interface LinkedTransaction {
  id: string;
  type: "Quote" | "Contract" | "Pick Ticket" | "Shipment" | "Delivery Confirmation" | "Invoice" | "Credit Memo" | "Payment Receipt" | "Return";
  number: string;
  description: string;
  date: string;
  status: string;
  amount: number;
  /** The document's currency when it is not the order's (a quote, or an
   *  invoice raised before the order's currency was changed). */
  currency?: string;
  createdBy: string;
  createdByInitials: string;
  /** e.g. "via SO-2026-0089" — back-reference displayed in some rows */
  reference?: string;
}

export type AttachmentCategory = "pre-sales" | "so-docs" | "fulfillment" | "invoices" | "item" | "rejection";
export type FileKind = "pdf" | "xlsx" | "doc" | "cfg" | "png" | "jpg" | "csv" | "sheet" | "mp3" | "mp4" | "dxf" | "stl" | "dwg";

export interface Attachment {
  id: string;
  name: string;
  /** Human-readable description shown on hover tooltip */
  description?: string;
  /** Human-readable size string, e.g. "2.4 MB" */
  size: string;
  uploadedBy: string;
  date: string;
  category: AttachmentCategory;
  /** The file extension / kind for icon colour coding */
  fileKind: FileKind;
  /** Only for category === "item" — which SO line this is attached to */
  lineItemId?: string;
  /** Only for category === "item": set when the file was copied from the
   *  item master gallery (not uploaded). Its menu is Preview, Download and
   *  Remove from Order, the same as in the line item configurator. */
  galleryId?: string;
  /** Only for category === "fulfillment" — which shipment this belongs to */
  shipmentId?: string;
  /** Is this attachment marked as "In Order" (eye icon visible) */
  inOrder: boolean;
  /** A small label tag, e.g. "rfq/rfp" */
  tag?: string;
  /** Optional thumbnail preview URL (for png/jpg) shown in the new attachment cards */
  previewUrl?: string | null;
}

// ===== Shipment Types =====
export type ShipmentStatus =
  | "Draft"
  | "Ready to Pick"
  | "In Progress"
  | "Ready"
  | "Shipped"
  | "Cancelled";

export type ShippingMode =
  | "LTL Freight"
  | "FTL Freight"
  | "Parcel"
  | "Flatbed"
  | "Refrigerated"
  | "Expedited"
  | "White Glove";

/** Handoff method — how goods are physically exchanged */
export type ShipmentMethod =
  | "Courier Pick Up"
  | "Courier Drop By"
  | "Customer Pick Up"
  | "Self-Managed Delivery";

export type ShipmentType =
  | "Standard"
  | "Consolidated"
  | "Split"
  | "Fast Execute"
  | "Over-Ship"
  | "Short Ship";

export interface ShipmentLine {
  id: string;
  soId: string;
  soLineId: string;
  allocationId: string;
  itemCode: string;
  itemName: string;
  selectedQty: number;
  pickedQty: number;
  shippedQty: number;
  /** Lot number if applicable */
  lotNumber?: string;
  /** Serial numbers if applicable */
  serialNumbers?: string[];
  /** Suggested pick location */
  pickLocation?: string;
  /** Staged location after pick */
  stagedLocation?: string;
  /** Picker assigned to this specific line (moved from
   *  shipment-level `assignedTo`). Renders as a per-item pill in
   *  the shipment card's people row. */
  pickedBy?: string;
  pickedByInitials?: string;
}

/** Whether the goods leave the warehouse via a carrier or the
 *  customer picks them up directly. Drives which detail fields
 *  the shipment card surfaces (carrier + mode + tracking vs
 *  authorized pickup person + phone). */
export type DepartureType = "carrier" | "customer-pickup";

/** Reroute — captures a mid-flight change to a shipment's staging
 *  location (during picking) or destination address (during
 *  shipping). Renders as a Partner-style change chip pair
 *  (previous → next) with a reason, so users understand why the
 *  shipment deviated from its original plan. Scope covers a single
 *  line item (`lineId`) or the whole shipment (`lineId` omitted). */
export type ShipmentChangeType = "staging-location" | "ship-address";
export interface ShipmentChange {
  id: string;
  type: ShipmentChangeType;
  /** If set, the change was scoped to one line item on the shipment.
   *  If omitted, the change applied to the whole shipment. */
  lineId?: string;
  /** Prior value that was overwritten (staging location or address). */
  previous: string;
  /** New value that took effect. */
  next: string;
  /** Free-text reason the user recorded when making the change
   *  (e.g. "Units at original location damaged"). */
  reason: string;
  /** Human-readable timestamp (e.g. "2026/07/22 · 10:15"). */
  at: string;
  /** Person who made the change. */
  by: string;
  byInitials?: string;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  shipmentType: ShipmentType;
  lines: ShipmentLine[];
  createdDate: string;
  warehouse: string;
  /** How the shipment departs the warehouse. Defaults to "carrier"
   *  when omitted so seed data without an explicit value keeps its
   *  historical carrier-based rendering. */
  departureType?: DepartureType;
  trackingCode?: string;
  trackingUrl?: string;
  carrier?: string;
  shippingMode?: string;
  estimatedDelivery?: string;
  shipDate?: string;
  shipFrom?: string;
  shipTo?: string;
  /** @deprecated Picker moved to `ShipmentLine.pickedBy` (per-line
   *  assignee list). Retained on the type so pre-migration
   *  serialized data still deserializes cleanly. */
  assignedTo?: string;
  assignedToInitials?: string;
  /** User who confirmed shipment at execution */
  confirmedBy?: string;
  confirmedByInitials?: string;
  /** Driver name captured at execution (carrier departure only). */
  driverName?: string;
  /** Driver phone (carrier departure only). */
  driverPhone?: string;
  /** Driver email captured at handoff (carrier departure only). */
  driverEmail?: string;
  /** Driver-supplied government / license ID string (e.g. CDL-84302).
   *  Populated when the warehouse verifies the driver's ID at pickup. */
  driverIdNumber?: string;
  /** Human-readable timestamp of the driver handoff (e.g. "2026/07/12 · 14:32"). */
  handoffAt?: string;
  /** Number of driver-signature files uploaded at handoff. Kept as a
   *  count on the SO side; full files live in the shipment module. */
  handoffSignatureCount?: number;
  /** Number of handoff photos captured (e.g. driver ID photo,
   *  loaded-trailer shot). Full files live in the shipment module. */
  handoffPhotoCount?: number;
  /** Person authorized to collect the goods (customer-pickup only). */
  authorizedPickupName?: string;
  authorizedPickupPhone?: string;
  /** Carrier-side point of contact — dispatcher / account manager
   *  the warehouse can call for exceptions. The driver is a separate
   *  handoff artifact (rendered as the Driver Handoff card at the
   *  top of the shipment), not a Partner-managed user, so the PoC
   *  represents the carrier's *actual* liaison. */
  carrierContactName?: string;
  carrierContactRole?: string;
  carrierContactPhone?: string;
  carrierContactEmail?: string;
  /** Sales rep who created the shipment. Rendered as the shipment
   *  creator chip in the per-shipment card. */
  createdBy?: string;
  createdByInitials?: string;
  /** Cancellation reason if cancelled */
  cancellationReason?: string;
  /** Pickup location for pick-up methods */
  pickupLocation?: string;
  /** Reroutes captured while the shipment was in flight — staging
   *  location swaps during picking, address changes during
   *  shipping, etc. Rendered in the expanded card as a Partner
   *  change-chip list with a reason per entry. */
  changes?: ShipmentChange[];
}

// ===== Inventory =====
export type LotStatus = "Active" | "Quarantine";

export interface WarehouseInventory {
  warehouse: string;
  itemCode: string;
  onHand: number;
  reserved: number;
  lots?: { lotNumber: string; qty: number; reserved: number; status?: LotStatus }[];
  serialNumbers?: { serial: string; available: boolean }[];
}

// ===== Catalog =====
export interface CatalogItem {
  code: string;
  name: string;
  description: string;
  type: ItemType;
  unitPrice: number;
  category: string;
  inStock: number;
  /** True for items the user has ordered recently (across SOs). Used
   *  by the no-search state of the line-item pickers to surface the
   *  customer's familiar SKUs without forcing them to search. The
   *  pickers cap the displayed list at 6 so the panel stays scannable. */
  isRecentlyOrdered?: boolean;
}

// ===== Helpers =====
export const TERMINAL_STATES: SOStatus[] = ["Cancelled", "Shipped", "Archived"];
export const ACTIVE_STATES: SOStatus[] = ["Draft", "Pending Review", "Cleared", "Partially Shipped", "Partially Cancelled"];
export const ARCHIVABLE_STATES: SOStatus[] = ["Cancelled", "Shipped"];

// ===== Sourcing & Production Types =====
export type ProcurementStatus =
  | "Draft"
  | "Submitted"
  | "Acknowledged"
  | "Partially Received"
  | "Received"
  | "Cancelled";

export type BackorderStatus =
  | "Pending"
  | "On Order"
  | "Partially Fulfilled"
  | "Fulfilled"
  | "Cancelled";

export type SourcingStatus =
  | "Not Started"
  | "Sourcing"
  | "Partially Sourced"
  | "Fully Sourced"
  | "N/A";

export interface ProcurementItem {
  soLineId: string;
  itemCode: string;
  itemName: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
}

export interface ProcurementOrder {
  id: string;
  poNumber: string;
  vendor: string;
  vendorInitials: string;
  status: ProcurementStatus;
  soLineIds: string[];
  items: ProcurementItem[];
  orderedDate: string;
  expectedDate: string;
  totalAmount: number;
  /** Receiving progress 0–100 */
  receivedPct: number;
}

export interface BackorderRecord {
  id: string;
  soLineId: string;
  itemCode: string;
  itemName: string;
  backorderedQty: number;
  allocatedQty: number;
  status: BackorderStatus;
  linkedPONumber: string | null;
  expectedDate: string | null;
  createdDate: string;
}