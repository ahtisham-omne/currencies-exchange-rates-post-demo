export type QuoteStatus =
  | 'Draft'
  | 'Sent to Customer'
  | 'Unconfirmed SO'
  | 'Confirmed SO'
  | 'Rejected'
  | 'Cancelled'
  | 'Archived'
  | 'Expired';

/** Reasons surfaced in the "Rejected by Customer" reason picker. Free-text
 *  detail lives in `rejectionReasonText`; mandatory only for "Other". */
export type QuoteRejectionReason =
  | 'Price too high'
  | 'Chose a competitor'
  | 'Budget not approved'
  | 'Requirements changed'
  | 'Lead time too long'
  | 'Payment terms not acceptable'
  | 'Product or specification mismatch'
  | 'Project cancelled or on hold'
  | 'Other';

export const QUOTE_REJECTION_REASONS: QuoteRejectionReason[] = [
  'Price too high',
  'Chose a competitor',
  'Budget not approved',
  'Requirements changed',
  'Lead time too long',
  'Payment terms not acceptable',
  'Product or specification mismatch',
  'Project cancelled or on hold',
  'Other',
];

export type Priority = 'High' | 'Standard' | 'Low';

/** The same three, as a runtime list, for pickers. Ordered low to high. */
export const PRIORITIES: Priority[] = ['Low', 'Standard', 'High'];

export interface SalesRep {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Customer {
  id: string;
  name: string;
  logoUrl?: string;
  location?: {
    name: string;
    isPrimary: boolean;
  };
}

export interface PointOfContact {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  isPrimary: boolean;
  role?: string;
}

export interface LineItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  image?: string;
  images?: string[];
  uom?: string;
}

export interface Adjustment {
  id: string;
  type: 'discount' | 'premium';
  amountType: '$' | '%';
  amount: number;
  label: string;
  internalNotes?: string;
}

/* Chronological status-transition log — powers the status-pill
 *  hover card on the detail page header. One entry per transition
 *  (Draft created, Sent to Customer, Rejected, Reactivated, etc.),
 *  ordered oldest → newest. Not tied to versions — a single version
 *  may accumulate several transitions (e.g. Sent → Rejected →
 *  Reactivated → Sent → Rejected). */
export interface QuoteStatusHistoryEntry {
  /** ISO timestamp — the hover card formats to MM/DD/YYYY HH:mm. */
  timestamp: string;
  /** Human-facing label (e.g. "Draft", "Sent to Customer",
   *  "Rejected by Customer", "Reactivated"). */
  label: string;
  /** Attribution — user + free-text note ("Sarah Chen · Priced
   *  against master agreement"). */
  detail?: string;
  /** Optional accent — drives the timeline dot colour. */
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'destructive';
}

/* Per-quote version row — used by VersionDropdown, VersionHistoryTab,
   and VersionHistoryModal so all three surfaces read from one list. */
export type QuoteVersionStatus = 'draft' | 'sent' | 'confirmed';
export interface QuoteVersion {
  version: number;
  versionStatus: QuoteVersionStatus;
  date: string;
  sentAt?: string;
  confirmedAt?: string;
  author: string;
  summary: string;
  isRevert?: boolean;
  revertedFrom?: number;
  /** When false, the version is excluded from the Duplicate Quote
   *  modal's dropdown — e.g. the version that triggered conversion to
   *  a Sales Order, or a version on a Cancelled/Archived/Expired
   *  record. Unset (or true) means the version is duplicable. */
  canDuplicate?: boolean;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  version: number;
  /** Full version history — list is ordered newest-first, with the
   *  latest entry's `version` matching the top-level `version` field.
   *  Listing badge, dropdown trigger, header note, history tab, and
   *  history modal all derive from this array. */
  versions?: QuoteVersion[];
  customer: {
    id: string;
    name: string;
    logoUrl?: string;
    location?: {
      name: string;
      isPrimary: boolean;
    };
  };
  /** Optional: Partners only requires a customer's name, so a quote can
   *  exist with no point of contact yet (see shared/fieldRequirements). */
  primaryPoC?: PointOfContact;
  additionalPoCs?: PointOfContact[];
  status: QuoteStatus;
  totalValue: number;
  createdDate: Date;
  expiryDate: Date;
  /** Optional for the same reason: an unassigned quote has none. */
  salesRep?: SalesRep;
  additionalSalesReps?: SalesRep[];
  /** Commercial terms captured at creation. Each one is optional and an
   *  empty string means "explicitly not set" (renders the field's empty
   *  state). `undefined` means the record predates these fields, and
   *  readers fall back to the legacy derived values. */
  billingAddress?: string;
  shippingAddress?: string;
  paymentTerms?: string;
  paymentMethod?: string;
  priority: Priority;
  tags?: string[];
  description?: string;
  hasUnreadMessages: boolean;
  unreadMessageCount: number;
  daysInCurrentStage: number;
  respondBy?: Date;
  requestedDate?: Date;
  confirmationDate?: Date;
  lastUpdated: Date;
  winProbability?: number;
  cancellationReason?: string;
  /** Set when the sales rep records the customer as having declined the
   *  quote. Persists across new-version reactivation so the banner keeps
   *  reminding the rep what to fix; cleared once the reactivated draft
   *  is re-sent to the customer. */
  rejectionReason?: QuoteRejectionReason;
  rejectionReasonText?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  /** Chronological status-transition log — feeds the header status
   *  pill hover card. Optional so records that don't carry a history
   *  fall back to a synthesized single entry (current status). */
  statusHistory?: QuoteStatusHistoryEntry[];
  items?: LineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  /** Set only on quotes brought in through the legacy importer. Drives
   *  the "Legacy Import" pill in the detail header, which is the one
   *  place a reader can tell this record was not created in Omne.
   *  Structural on purpose so `types/` stays free of a dependency on
   *  the importer; the shape matches `LegacyImportMeta` in
   *  `components/import/importMaterialize`. */
  legacyImport?: {
    importedAt: string;
    importName?: string;
    fileName?: string;
    sourceRows: number[];
    sourceKey: string;
  };
}

export interface ConfiguratorItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  [key: string]: any;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: 'Building' | 'CreditCard' | 'FileText' | 'Landmark';
}

export interface PaymentTerm {
  id: string;
  name: string;
  [key: string]: any;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

export interface ColumnConfig {
  key: string;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  alignment?: 'left' | 'center' | 'right';
}

export interface FilterConfig {
  statuses: QuoteStatus[];
  salesReps: string[];
  customers: string[];
  priorities: Priority[];
  dateRange?: { start: Date; end: Date };
  valueRange?: { min: number; max: number };
  tags: string[];
}

export interface SavedFilter {
  id: string;
  name: string;
  config: Partial<FilterConfig>;
}
