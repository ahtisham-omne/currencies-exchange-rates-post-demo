// ===== SO Types =====
export type SOStatus =
  | "Draft"
  | "Pending Review"
  | "Cleared"
  | "Partially Shipped"
  | "Shipped"
  | "Partially Cancelled"
  | "Cancelled"
  | "Archived";

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

export type ItemType = "Non-Serialized" | "Serialized" | "Lot Controlled";

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

export interface SOVersion {
  number: number;
  label: "Latest" | "Last Approved" | "Superseded";
  date: string;
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  customer: string;
  customerInitials: string;
  orderDate: string;
  warehouse: string;
  currency: string;
  paymentTerms: string;
  shippingAddress: string;
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
  salesReps: SalesRep[];
  /* ── Cancellation fields ── */
  cancellationReason?: CancellationReason;
  cancellationReasonText?: string;    // free-text for "Other"
  cancellationRequestedAt?: string;
  cancellationRequestedBy?: string;
  /* ── Sourcing & Production ── */
  procurementOrders: ProcurementOrder[];
  backorders: BackorderRecord[];
  sourcingStatus: SourcingStatus;
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
  createdBy: string;
  createdByInitials: string;
  /** e.g. "via SO-2026-0089" — back-reference displayed in some rows */
  reference?: string;
}

export type AttachmentCategory = "pre-sales" | "so-docs" | "fulfillment" | "invoices" | "item";
export type FileKind = "pdf" | "xlsx" | "doc" | "cfg" | "png" | "jpg" | "csv" | "sheet";

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
  /** Only for category === "fulfillment" — which shipment this belongs to */
  shipmentId?: string;
  /** Is this attachment marked as "In Order" (eye icon visible) */
  inOrder: boolean;
  /** A small label tag, e.g. "rfq/rfp" */
  tag?: string;
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
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  status: ShipmentStatus;
  shipmentType: ShipmentType;
  lines: ShipmentLine[];
  createdDate: string;
  warehouse: string;
  trackingCode?: string;
  trackingUrl?: string;
  carrier?: string;
  shippingMode?: string;
  estimatedDelivery?: string;
  shipDate?: string;
  shipFrom?: string;
  shipTo?: string;
  /** Handler / picker assigned */
  assignedTo?: string;
  assignedToInitials?: string;
  /** User who confirmed shipment at execution */
  confirmedBy?: string;
  confirmedByInitials?: string;
  /** Driver name captured at execution */
  driverName?: string;
  /** Cancellation reason if cancelled */
  cancellationReason?: string;
  /** Pickup location for pick-up methods */
  pickupLocation?: string;
}

// ===== Inventory =====
export interface WarehouseInventory {
  warehouse: string;
  itemCode: string;
  onHand: number;
  reserved: number;
  lots?: { lotNumber: string; qty: number; reserved: number }[];
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