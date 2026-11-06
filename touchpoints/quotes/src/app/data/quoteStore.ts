import { Quote, QuoteStatus, QuoteRejectionReason } from '../types/quote';

// Module-level store for dynamically created quotes
// This persists across React navigations within the same session
const createdQuotes: Map<string, Quote> = new Map();

// Store line items from creation flow (keyed by quote id)
export interface CreatedLineItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  image?: string;
}

const createdQuoteLineItems: Map<string, CreatedLineItem[]> = new Map();

export function addCreatedQuote(quote: Quote, lineItems?: CreatedLineItem[]): void {
  createdQuotes.set(quote.id, quote);
  if (lineItems && lineItems.length > 0) {
    createdQuoteLineItems.set(quote.id, lineItems);
  }
}

export function getCreatedQuote(id: string): Quote | undefined {
  return createdQuotes.get(id);
}

export function getCreatedQuoteLineItems(id: string): CreatedLineItem[] | undefined {
  return createdQuoteLineItems.get(id);
}

/** A created quote's lines after its currency changed in Quote Summary, so
 *  reopening it shows them in the new currency. */
export function setCreatedQuoteLineItems(id: string, lineItems: CreatedLineItem[]): void {
  if (createdQuoteLineItems.has(id)) createdQuoteLineItems.set(id, lineItems);
}

/* ── The factor a quote's design figures are restated by ──
   The quote page shows the design's USD line set and seeds restated in the
   quote's currency. A currency change multiplies that factor by the cross
   rate between the quote's two rates (which may be corporate), so it is
   kept here: reopening the quote restates them the same way. */
const quoteLineFactors: Map<string, number> = new Map();

export function getQuoteLineFactor(quoteId: string): number | undefined {
  return quoteLineFactors.get(quoteId);
}

export function setQuoteLineFactor(quoteId: string, factor: number): void {
  quoteLineFactors.set(quoteId, factor);
}

export function getAllCreatedQuotes(): Quote[] {
  return Array.from(createdQuotes.values());
}

/* ── One-time adjustments on imported quotes ──
   A quote brought in from a legacy file can arrive with discounts and
   premiums already on it, at quote level and at line level. They are not
   part of the `Quote` record (the module keeps adjustments in its own
   `useAdjustments` layer), so they wait here until the detail page opens
   and seeds that layer from them. */
const createdQuoteAdjustments: Map<string, unknown[]> = new Map();

export function setCreatedQuoteAdjustments(quoteId: string, adjustments: unknown[]): void {
  if (adjustments.length > 0) createdQuoteAdjustments.set(quoteId, adjustments);
}

export function getCreatedQuoteAdjustments(quoteId: string): unknown[] | undefined {
  return createdQuoteAdjustments.get(quoteId);
}

// ── Quote description persistence (survives navigation, keyed by quoteId or quoteNumber) ──
const quoteDescriptions: Map<string, string> = new Map();
/* When each of those descriptions was last edited, so the header's
   description reader can show a real "last modified" rather than the
   parent quote's updated-at (which moves for every other kind of edit
   too). Only keyed once a description has actually been changed. */
const quoteDescriptionUpdatedAt: Map<string, Date> = new Map();

/**
 * Default long-form description used for any quote that hasn't been
 * touched yet. Kept long (~1.5k chars) on purpose so the
 * `InlineDescriptionEditor` one-line clamp + its scrolling overlay card
 * have something realistic to work against during testing.
 */
const DEFAULT_QUOTE_DESCRIPTION =
  "Quote prepared against the customer's standing RFQ for ambulance chassis, lighting, and audio packages. " +
  "Pricing reflects the customer's tiered volume agreement (rev 2024-Q4) with early-pay 2% within 10 days, otherwise net 30 from issue. " +
  "Lead times respect the published 21-day floor on chassis and 5-day floor on accessories — any line that slips beyond the floor opens a procurement flag in the Sourcing tab automatically. " +
  "Bundled fitment notes: the ambulance prep package on the E-450 / Cutaway lines includes 240A alternator, auxiliary idle control, and the reinforced rear frame section needed for modular body mounting on this customer's spec. Lighting and audio components carry SAE J1849 / KKK-A-1822F compliance documentation by default; if the customer's grant program requires alternate certification, flag it in the deal information tab so we can re-route the line through Engineering review before sending. " +
  "Approval routing: pricing edits beyond ±5% of the master schedule auto-route to the regional Sales Manager. Discounts greater than $10k or rebates beyond the standard 2/10 line need VP-Sales sign-off and will hold the quote at the Pending Review status until the approval comes back. " +
  "History: this customer has averaged a 4.6-day delta between requested and confirmed delivery on prior orders, with zero open RMAs in the last twelve months. Treat as a long-tail relationship — escalations go to the account-team Slack first, ticket second.";

export function getQuoteDescription(key: string): string {
  return quoteDescriptions.get(key) ?? DEFAULT_QUOTE_DESCRIPTION;
}

export function setQuoteDescription(key: string, description: string): void {
  quoteDescriptions.set(key, description);
  quoteDescriptionUpdatedAt.set(key, new Date());
}

/** When this quote's description was last edited, or undefined if it has
 *  not been touched in this session. Callers fall back to the quote's own
 *  `lastUpdated`. */
export function getQuoteDescriptionUpdatedAt(key: string): Date | undefined {
  return quoteDescriptionUpdatedAt.get(key);
}

/* ── Runtime status overrides ──────────────────────────────────────
   The listing seeds quotes from `mockQuotes` (a frozen constant) plus
   any records created through the create flow. When the detail page
   mutates status (Reject, Cancel, etc.) we need those mutations to
   survive navigation so the listing reflects them. This module-level
   registry layers on top of both sources: the listing merges each
   quote with its override (if any) before rendering. */

interface QuoteStatusOverride {
  status?: QuoteStatus;
  rejectionReason?: QuoteRejectionReason;
  rejectionReasonText?: string;
  rejectedAt?: Date;
  cancellationReason?: string;
  version?: number;
}

const statusOverrides: Map<string, QuoteStatusOverride> = new Map();
const statusListeners: Set<() => void> = new Set();

export function getQuoteStatusOverride(id: string): QuoteStatusOverride | undefined {
  return statusOverrides.get(id);
}

export function setQuoteStatusOverride(id: string, patch: QuoteStatusOverride): void {
  const current = statusOverrides.get(id) ?? {};
  statusOverrides.set(id, { ...current, ...patch });
  statusListeners.forEach(fn => fn());
}

export function clearQuoteStatusOverride(id: string): void {
  statusOverrides.delete(id);
  statusListeners.forEach(fn => fn());
}

export function subscribeQuoteStatusOverrides(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => { statusListeners.delete(listener); };
}

/** Merge a quote record with any live status override so callers
 *  always see the current state without threading the registry
 *  through every consumer. */
export function applyQuoteOverride(quote: Quote): Quote {
  const override = statusOverrides.get(quote.id);
  if (!override) return quote;
  return {
    ...quote,
    ...(override.status !== undefined ? { status: override.status } : {}),
    ...(override.version !== undefined ? { version: override.version } : {}),
    ...(override.rejectionReason !== undefined ? { rejectionReason: override.rejectionReason } : {}),
    ...(override.rejectionReasonText !== undefined ? { rejectionReasonText: override.rejectionReasonText } : {}),
    ...(override.rejectedAt !== undefined ? { rejectedAt: override.rejectedAt } : {}),
    ...(override.cancellationReason !== undefined ? { cancellationReason: override.cancellationReason } : {}),
  };
}

// ── Pre-quote (RFQ/RFP) document store ──────────────────────────────────────
// Shared between OverviewTab (upload/remove) and LinkedTransactionsTab (display)
export interface PreQuoteDocument {
  id: string;
  name: string;
  size: string;
  type: string;           // file extension: 'pdf', 'xlsx', 'docx', etc.
  uploadedBy: string;
  uploadedAt: string;     // ISO date string e.g. '2026-02-19'
}

const preQuoteDocs: Map<string, PreQuoteDocument[]> = new Map();
let preQuoteListeners: Map<string, Set<() => void>> = new Map();

export function getPreQuoteDocs(quoteKey: string): PreQuoteDocument[] {
  return preQuoteDocs.get(quoteKey) || [];
}

export function addPreQuoteDoc(quoteKey: string, doc: PreQuoteDocument): void {
  const current = preQuoteDocs.get(quoteKey) || [];
  preQuoteDocs.set(quoteKey, [...current, doc]);
  notifyPreQuoteListeners(quoteKey);
}

export function removePreQuoteDoc(quoteKey: string, docId: string): void {
  const current = preQuoteDocs.get(quoteKey) || [];
  preQuoteDocs.set(quoteKey, current.filter(d => d.id !== docId));
  notifyPreQuoteListeners(quoteKey);
}

/** Subscribe to changes — returns unsubscribe function */
export function subscribePreQuoteDocs(quoteKey: string, listener: () => void): () => void {
  if (!preQuoteListeners.has(quoteKey)) {
    preQuoteListeners.set(quoteKey, new Set());
  }
  preQuoteListeners.get(quoteKey)!.add(listener);
  return () => {
    preQuoteListeners.get(quoteKey)?.delete(listener);
  };
}

function notifyPreQuoteListeners(quoteKey: string) {
  preQuoteListeners.get(quoteKey)?.forEach(fn => fn());
}

// ── Rejection attachment store ──────────────────────────────────────────────
// Files uploaded through the Mark Rejection modal land here so the
// Attachments tab can surface them under a "Rejection Attachments" source.
// Mirrors the pre-quote store's pub/sub shape.
export interface RejectionDocument {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
  /** Populated for image files via `URL.createObjectURL` so the
   *  Attachments tab can render an inline thumbnail without waiting on
   *  the backend. */
  previewUrl?: string;
}

const rejectionDocs: Map<string, RejectionDocument[]> = new Map();
const rejectionListeners: Map<string, Set<() => void>> = new Map();

export function getRejectionDocs(quoteKey: string): RejectionDocument[] {
  return rejectionDocs.get(quoteKey) || [];
}

export function addRejectionDoc(quoteKey: string, doc: RejectionDocument): void {
  const current = rejectionDocs.get(quoteKey) || [];
  rejectionDocs.set(quoteKey, [...current, doc]);
  notifyRejectionListeners(quoteKey);
}

export function removeRejectionDoc(quoteKey: string, docId: string): void {
  const current = rejectionDocs.get(quoteKey) || [];
  rejectionDocs.set(quoteKey, current.filter(d => d.id !== docId));
  notifyRejectionListeners(quoteKey);
}

export function subscribeRejectionDocs(quoteKey: string, listener: () => void): () => void {
  if (!rejectionListeners.has(quoteKey)) {
    rejectionListeners.set(quoteKey, new Set());
  }
  rejectionListeners.get(quoteKey)!.add(listener);
  return () => {
    rejectionListeners.get(quoteKey)?.delete(listener);
  };
}

function notifyRejectionListeners(quoteKey: string) {
  rejectionListeners.get(quoteKey)?.forEach(fn => fn());
}
/* ═══════════════════════════════════════════════════════════════════
 * LINE-ITEM ATTACHMENTS
 *
 * The single source of truth for line-item attachments on a quote. Two
 * surfaces read and write it, so a file added or deleted on one shows up
 * on the other immediately:
 *   · The line-item configurator's Attachments tab (per item).
 *   · The Quote Detail Attachments tab's "Item Attachments" folder (all
 *     items, merged into the folder tree).
 *
 * Before this store the two surfaces each held their own local mock
 * list, so a deletion in one was invisible to the other.
 *
 * Keyed by `quoteKey` (the quote NUMBER, matching `preQuoteDocs` and
 * `rejectionDocs` above) then by item number. Both surfaces must agree
 * on the key: the quote page's `propQuoteId` and its `quoteNumber` are
 * different values, and keying writes and reads differently is exactly
 * what made the rejection-docs registry look empty once before.
 *
 * Item-gallery files: adding one from the item master's gallery creates
 * an ordinary, independent attachment record here. We cannot track a
 * live link back to the item master, so we do not pretend to:
 * `galleryId` records only which gallery entry it was copied FROM, which
 * lets the gallery view show what has already been added. Later changes
 * to the item master's gallery never touch the copy on this quote.
 * ═══════════════════════════════════════════════════════════════════ */

export interface LineItemAttachment {
  id: string;
  name: string;
  /** File extension, matching `LinkedDocument['type']` (pdf, jpg, mp4...). */
  type: string;
  /** Human-readable size string, e.g. "2.4 MB". */
  size: string;
  uploadedBy: string;
  /** ISO date, matching `LinkedDocument.uploadedAt`. */
  uploadedAt: string;
  previewUrl?: string | null;
  /** Item number this file is attached to. */
  itemId: string;
  /** Item name, kept for the detail card's item-reference pill. */
  itemLabel: string;
  /** Set only when the file came from the item master's gallery.
   *  Provenance for the gallery view's "Added" state, NOT a live link:
   *  the copy is independent of the item master. */
  galleryId?: string;
}

/** quoteKey -> itemId -> attachments */
const lineItemAtts: Map<string, Map<string, LineItemAttachment[]>> = new Map();
const lineItemAttListeners: Map<string, Set<() => void>> = new Map();
const EMPTY_LINE_ATTS: LineItemAttachment[] = [];

/** Seed template, applied lazily the first time a quote is read.
 *  These are the mock item attachments that used to be inlined in the
 *  Attachments tab's `MOCK_DOCUMENTS`; they live here now so both
 *  surfaces see the same records. */
const LINE_ITEM_ATT_SEED: LineItemAttachment[] = [
  { id: "D004",  name: "Type_III_Module_Specifications.pdf", type: "pdf",  size: "4.7 MB", uploadedBy: "Sarah Chen",        uploadedAt: "2026-01-25", itemId: "000-100-019", itemLabel: "Type III Ambulance Module" },
  { id: "D004b", name: "Module_Interior_Render.jpg",         type: "jpg",  size: "5.2 MB", uploadedBy: "Maria Garcia",      uploadedAt: "2026-02-08", itemId: "000-100-019", itemLabel: "Type III Ambulance Module", previewUrl: "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400", galleryId: "gal-2" },
  { id: "D004c", name: "Module_Wiring_Diagram.png",          type: "png",  size: "2.8 MB", uploadedBy: "Daniel Adams",      uploadedAt: "2026-02-15", itemId: "000-100-019", itemLabel: "Type III Ambulance Module", previewUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400" },
  { id: "D005",  name: "KKK_Compliance_Checklist.pdf",       type: "pdf",  size: "3.2 MB", uploadedBy: "Sarah Chen",        uploadedAt: "2026-01-25", itemId: "000-100-019", itemLabel: "Type III Ambulance Module" },
  { id: "D005b", name: "Chassis_Spec_Sheet.pdf",             type: "pdf",  size: "1.9 MB", uploadedBy: "Lisa Park",         uploadedAt: "2026-02-12", itemId: "000-100-002", itemLabel: "Ford E-450 Chassis" },
  { id: "D005c", name: "Chassis_Inspection_Photo.jpg",       type: "jpg",  size: "4.1 MB", uploadedBy: "James Wilson",      uploadedAt: "2026-04-02", itemId: "000-100-002", itemLabel: "Ford E-450 Chassis", previewUrl: "https://images.unsplash.com/photo-1597692493715-cdec61b7dcb4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400" },
  { id: "D006",  name: "APX_8500_Programming_Template.pdf",  type: "pdf",  size: "1.8 MB", uploadedBy: "Michael Rodriguez", uploadedAt: "2026-01-22", itemId: "000-100-049", itemLabel: "Motorola APX 8500 Radio" },
  { id: "D006b", name: "Radio_Mount_Photo.jpg",              type: "jpg",  size: "2.4 MB", uploadedBy: "Maria Garcia",      uploadedAt: "2026-04-18", itemId: "000-100-049", itemLabel: "Motorola APX 8500 Radio", previewUrl: "https://images.unsplash.com/photo-1580130732478-4e339fb33746?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400", galleryId: "gal-4" },
  { id: "D006c", name: "APX_Channel_Plan.csv",               type: "csv",  size: "9 KB",   uploadedBy: "Daniel Adams",      uploadedAt: "2026-04-25", itemId: "000-100-049", itemLabel: "Motorola APX 8500 Radio" },
  { id: "D007",  name: "Stryker_Warranty_Certificate.pdf",   type: "pdf",  size: "520 KB", uploadedBy: "Sarah Chen",        uploadedAt: "2026-01-22", itemId: "000-100-059", itemLabel: "Stryker Power-PRO XT" },
  { id: "D007b", name: "Stretcher_Loading_Demo.jpg",         type: "jpg",  size: "3.8 MB", uploadedBy: "Lisa Park",         uploadedAt: "2026-03-14", itemId: "000-100-059", itemLabel: "Stryker Power-PRO XT", previewUrl: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400" },
  { id: "D007c", name: "Inverter_Wiring_Schematic.png",      type: "png",  size: "1.6 MB", uploadedBy: "Robert Kim",        uploadedAt: "2026-03-20", itemId: "000-100-081", itemLabel: "AIMS 3000W Inverter", previewUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400" },
  { id: "D007d", name: "Power_Calculation_Worksheet.xlsx",   type: "xlsx", size: "210 KB", uploadedBy: "Daniel Adams",      uploadedAt: "2026-04-30", itemId: "000-100-081", itemLabel: "AIMS 3000W Inverter" },
  { id: "D007f", name: "Vehicle_Build_Walkthrough.mp4",      type: "mp4",  size: "8.4 MB", uploadedBy: "James Wilson",      uploadedAt: "2026-04-22", itemId: "000-100-019", itemLabel: "Type III Ambulance Module", previewUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", galleryId: "gal-5" },
  { id: "D007g", name: "Floor_Plan_Bay_Layout.dxf",          type: "dxf",  size: "85 KB",  uploadedBy: "James Wilson",      uploadedAt: "2026-04-25", itemId: "000-100-019", itemLabel: "Type III Ambulance Module", previewUrl: "https://raw.githubusercontent.com/gdsestimating/three-dxf/master/sample/floor_plan.dxf" },
  { id: "D007h", name: "Bracket_Mount.stl",                  type: "stl",  size: "62 KB",  uploadedBy: "Daniel Adams",      uploadedAt: "2026-04-28", itemId: "000-100-081", itemLabel: "AIMS 3000W Inverter", previewUrl: "https://raw.githubusercontent.com/IsaacGuan/PointNet-Plane-Detection/master/test_data/Bunny.stl" },
];

function notifyLineItemAtts(quoteKey: string) {
  lineItemAttListeners.get(quoteKey)?.forEach((fn) => fn());
}

/** Lazily apply the seed the first time a quote is touched. Newly
 *  created quotes pass `seeded: false` so they start empty. */
function ensureQuote(quoteKey: string, seed = true): Map<string, LineItemAttachment[]> {
  let q = lineItemAtts.get(quoteKey);
  if (!q) {
    q = new Map();
    if (seed) {
      LINE_ITEM_ATT_SEED.forEach((att) => {
        const list = q!.get(att.itemId) ?? [];
        q!.set(att.itemId, [...list, att]);
      });
    }
    lineItemAtts.set(quoteKey, q);
  }
  return q;
}

/** Mark a quote as starting with no line-item attachments (newly created). */
export function initEmptyLineItemAttachments(quoteKey: string): void {
  if (!lineItemAtts.has(quoteKey)) ensureQuote(quoteKey, false);
}

/** Attachments on one item. */
export function getLineItemAttachments(quoteKey: string, itemId: string): LineItemAttachment[] {
  return ensureQuote(quoteKey).get(itemId) ?? EMPTY_LINE_ATTS;
}

/** Every line-item attachment on the quote, flattened. */
export function getAllLineItemAttachments(quoteKey: string): LineItemAttachment[] {
  const q = ensureQuote(quoteKey);
  const out: LineItemAttachment[] = [];
  q.forEach((list) => out.push(...list));
  return out;
}

/** Attach a file to an item. */
export function addLineItemAttachment(quoteKey: string, att: LineItemAttachment): void {
  const q = ensureQuote(quoteKey);
  q.set(att.itemId, [att, ...(q.get(att.itemId) ?? [])]);
  notifyLineItemAtts(quoteKey);
}

/** Detach a file. Called from both surfaces, so it searches every item
 *  rather than requiring the caller to know which item owns the id. */
export function removeLineItemAttachment(quoteKey: string, attId: string): void {
  const q = lineItemAtts.get(quoteKey);
  if (!q) return;
  let changed = false;
  q.forEach((list, itemId) => {
    if (list.some((a) => a.id === attId)) {
      q.set(itemId, list.filter((a) => a.id !== attId));
      changed = true;
    }
  });
  if (changed) notifyLineItemAtts(quoteKey);
}

/** Rename a file in place. */
export function renameLineItemAttachment(quoteKey: string, attId: string, name: string): void {
  const q = lineItemAtts.get(quoteKey);
  if (!q) return;
  let changed = false;
  q.forEach((list, itemId) => {
    if (list.some((a) => a.id === attId)) {
      q.set(itemId, list.map((a) => a.id === attId ? { ...a, name } : a));
      changed = true;
    }
  });
  if (changed) notifyLineItemAtts(quoteKey);
}

/** Subscribe to one quote's line-item attachments. */
export function subscribeLineItemAttachments(quoteKey: string, listener: () => void): () => void {
  let set = lineItemAttListeners.get(quoteKey);
  if (!set) {
    set = new Set();
    lineItemAttListeners.set(quoteKey, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) lineItemAttListeners.delete(quoteKey);
  };
}
