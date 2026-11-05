/**
 * Purchasing subsystem types — Slice 1A.
 * Mirrors the reference project (b57d8e19-bdc7-48b9-ad8e-29d7b4909996).
 * Field names & shapes copied verbatim from `vendor-priority-table.tsx`
 * (`VendorAssociation`) and `purchase-orders-panel.tsx` (`PurchaseOrderRow`,
 * `POStatus`).
 */

/* ================================================================
   Qualified Vendor (mirrors reference VendorAssociation)
   ================================================================ */
export interface QualifiedVendor {
  id: string;
  /** Priority RANK (1 = highest). Ties are allowed — several vendors may share
   *  a rank. Kept dense + tie-preserving by PurchasingContext.normalizeQVs. */
  priority: number;
  vendorName: string;
  vendorId: string;
  location: string;
  pricePerUnit: number;
  currency: string;
  acceptedDeviation: number;
  vendorUOM: string;
  /** The single default vendor for the item (auto-PO anchor). Exactly one QV
   *  per item is true, and it always sits in the top rank. */
  isPrimary: boolean;
  lastPOLeadTime: number;
  averageLeadTime: number;
  lastPOTotalAmount: number;
  lastPOPricePerUnit: number;
  averagePricePerUnit: number;
  priceFluctuation30d: number;
  shipOnTime: number;
  /* ship-on-time breakdown */
  totalShipments?: number;
  onTimeShipments?: number;
  /* legacy compat fields preserved from reference */
  lotPerLeadTime?: number;
  onTimeAccuracy?: number;
  deliveryReliability?: number;
  rating?: number;
  status?: "active" | "inactive" | "pending";
  /* partner detail fields */
  partnerGroup?: string;
  email?: string;
  website?: string;
  phone?: string;
  /* configurable fields (matching add-vendor dialog) */
  minOrderQty?: number;
  maxOrderQty?: number;
  multiples?: number;
  pricingRules?: PricingRuleType;
  /* extended detail fields (Slice 1D — Partner Detail modal) */
  tier?: string;
  creditLimit?: number;
  creditUsed?: number;
  contacts?: VendorContact[];
  paymentTerms?: string;
  paymentMethod?: string;
  shippingMethod?: string;
  shippingAddress?: string;
  incoterms?: string;
  /* Partner-listing parity columns (ported from VendorsListPage): multiple
     named sites, country + flag emoji, and the default vendor-side carrier.
     Single `location` above stays the source of truth for the row's
     primary city/country. */
  partnerLocations?: string[];
  country?: string;
  countryFlag?: string;
  carrierVendor?: string;
  /** Full qualify-flow configuration captured in the Add/Edit Configuration
   *  wizard (ported from the Partners "Add as qualified vendor" flow). */
  config?: QualifiedVendorConfig;
}

/* ================================================================
   Qualify-flow config (ported verbatim from Partner-Management---Vendor
   `PartnerItemsTab.tsx`). Direction-agnostic: on the item side it is the
   per-vendor qualification contract for THIS item.
   ================================================================ */

/** A single UoM-priced tier on a qualified-vendor row. The same vendor can
 *  sell the same item in different units at independent prices — the price
 *  does NOT convert, the quantity does. */
export interface AdditionalPriceTier {
  price: string;
  uom: string;
  /** Per-UoM ordering rules — meaningful per pack size, not item-wide. */
  minOrderQty?: string;
  maxOrderQty?: string;
  multiples?: string;
  acceptedDeviationPct?: string;
  leadTimeDays?: string;
}

export interface QualifiedVendorConfig {
  /** Vendor priority RANK for the item — "auto" appends a fresh lowest tier.
   *  Ties are allowed: several vendors may carry the same rank. */
  priority: string;
  /** When true, this vendor is committed as the item's default (auto-PO anchor).
   *  Only honored for a top-tier vendor; the context enforces exactly one. */
  isDefault?: boolean;
  pricePerUnit: string;
  uom: string;
  /** Extra (price, UoM) pairs for the same vendor + same item. */
  additionalPrices?: AdditionalPriceTier[];
  /** Which selling unit is the primary one for this vendor. `undefined` or
   *  `-1` = the base (pricePerUnit / uom) card is primary; `0..N-1` = the
   *  additional-price tier at that index is primary. Purely a UI pointer;
   *  actual reorder happens on save if needed. */
  primaryTierIndex?: number;
  minOrderQty: string;
  maxOrderQty: string;
  multiples: string;
  acceptedDeviationPct: string;
  leadTimeDays: string;
  /** Location scope for this qualification. `locationIds` holds the chosen
   *  partner-location strings when sourcing from one OR more specific sites;
   *  empty/undefined = applies across ALL of the vendor's locations (mirrors
   *  the reference app's "empty = all locations"). `locationId` is the legacy
   *  single-site field, retained for back-compat. */
  locationId?: string;
  locationIds?: string[];
  /** Carrier method ids enabled for this qualified-vendor row. */
  shippingMethodIds?: string[];
  defaultShippingMethodId?: string;
  /** Pricing-rule ids attached to this qualified-vendor row. */
  appliedPricingRuleIds?: string[];
}

/** Vendor point-of-contact, used in Partner Detail modal contacts tab. */
export interface VendorContact {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  /** Reference Partner Detail tab — extension shown after phone (e.g., "Ext. 1049"). */
  ext?: string;
  /** Reference Partner Detail tab — secondary mobile/fax line. */
  mobile?: string;
  /** Reference Partner Detail tab — grouping section header. */
  department?: "Sales" | "Procurement" | "Finance";
}

export type PricingRuleType =
  | "standard"
  | "contracted"
  | "volume"
  | "seasonal";

/* ================================================================
   Purchase Orders (mirrors reference POStatus + PurchaseOrderRow)
   ================================================================ */
export type POStatus =
  | "draft"
  | "sent"
  | "active_with_cancellation"
  | "confirmed"
  | "partially_received"
  | "cancelled"
  | "fully_received";

export interface POLineItem {
  itemId: string;
  itemCode: string;
  qty: number;
  unitPrice: number;
  uom: string;
  received: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId?: string;
  partnerName: string;
  partnerLogo?: string;
  status: POStatus;
  /** Primary ordered item code (matches reference `orderedItems` cell). */
  orderedItems: string;
  /** Count of additional ordered items shown as `+N more` chip. */
  orderedItemsMore?: number;
  /** Detailed line items — populated as wizards / detail views land. */
  lineItems?: POLineItem[];
  pointOfContact: string;
  location: string;
  createdByName: string;
  createdByAvatar?: string;
  dueDeliveryDate: string;
  orderDate: string;
}

/* ================================================================
   Vendor / Partner pool used by Add QV flow (verbatim names from ref)
   ================================================================ */
export interface AvailableVendor {
  id: string;
  name: string;
  location: string;
  partnerGroup?: string;
  /** Short vendor abbreviation/code shown inside the avatar (e.g. "GM", "Fd", "T"). */
  code?: string;
  /** Full street address for vendor cards (street + city + state + zip). */
  address?: string;
  /** Saturated avatar background color (hex) — overrides the auto palette. */
  avatarColor?: string;
  /** Business roles this partner plays. Drives the labels shown on the
      vendor picker card (e.g. "Vendor", "Vendor + Customer"). */
  partnerRoles?: Array<"Vendor" | "Customer">;
  /** Partner lifecycle status — surfaced as a pill in the Select-Vendor
      table (vendor-side analog of the item Status column). */
  status?: "Active" | "Inactive" | "Pending";
  /** How many catalog items this vendor currently supplies — the
      vendor-side analog of the item On-Hand Qty column. */
  itemsSupplied?: number;
  /* ── Partner-listing parity fields ──────────────────────────────
     Mirror the same identity columns shown in the Qualified Vendors
     listing (QVTable) so the Browse-vendor picker can render them via the
     shared partnerCells. Seeded deterministically in mockData. */
  partnerLocations?: string[];
  country?: string;
  countryFlag?: string;
  carrierVendor?: string;
  creditLimit?: number;
  contacts?: VendorContact[];
}

/* ================================================================
   Status display config (for re-skinned StatusPill — used in 2A)
   ================================================================ */
export interface POStatusConfig {
  label: string;
  /** Reference token reference — slice 2A maps this to Items V2 tones. */
  refToken: string;
  dot?: boolean;
}

export const PO_STATUS_CONFIG: Record<POStatus, POStatusConfig> = {
  draft: { label: "Draft", refToken: "var(--foreground)" },
  sent: { label: "Sent", refToken: "var(--primary)" },
  active_with_cancellation: {
    label: "Active with Cancellation",
    refToken: "var(--accent)",
    dot: true,
  },
  confirmed: { label: "Confirmed", refToken: "var(--primary)" },
  partially_received: {
    label: "Partially Received",
    refToken: "var(--chart-3)",
  },
  cancelled: { label: "Cancelled", refToken: "var(--destructive)" },
  fully_received: { label: "Fully Received", refToken: "var(--accent)" },
};