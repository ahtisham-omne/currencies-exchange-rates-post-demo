// Ported verbatim from
// partner-management-module/src/app/components/vendors/partnerConstants.tsx
// Keep this list in sync with the partner module's PAYMENT_TERM_PRESETS so the
// vendor-invoicing picker offers the same templates the partner profile uses.

export type PaymentTermCategory = "net" | "prepayment" | "split";

/** Trigger events a payment term's clock can run from (8/25/26 meeting):
 *  "Receiving" replaced "Delivery" (Omne house term), "Invoice Date" is new.
 *  Receiving and Invoice Date resolve automatically on the invoice; every
 *  other event needs a manually keyed Trigger Date. */
export type TriggerEvent =
  | "Invoice Date"
  | "Receiving"
  | "Shipping"
  | "Production Start"
  | "Production End"
  | "Order Confirmation";

export interface PaymentTermPreset {
  id: string;
  name: string;
  category: PaymentTermCategory;
  typeBadge: string;
  badgeColor: string;
  trigger: TriggerEvent;
  description: string;
  vendorsApplied: number;
  duration?: string;
  applyDiscount?: boolean;
  discountPercent?: string;
  discountPeriod?: string;
}

export const PAYMENT_TERM_PRESETS: PaymentTermPreset[] = [
  { id: "pt-1", name: "Net 10", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Invoice Date", description: "Payment is due 10 days after the invoice date.", vendorsApplied: 4, duration: "10" },
  { id: "pt-2", name: "Net 15", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Invoice Date", description: "Payment is due 15 days after the invoice date.", vendorsApplied: 6, duration: "15" },
  { id: "pt-3", name: "Net 30", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Invoice Date", description: "Payment is due 30 days after the invoice date.", vendorsApplied: 3, duration: "30" },
  { id: "pt-4", name: "Net 30 Post Shipping", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Shipping", description: "Full payment is due 30 days after the goods are shipped.", vendorsApplied: 5, duration: "30" },
  { id: "pt-5", name: "Net 45 Post Receiving", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Receiving", description: "Payment is due 45 days after goods are received.", vendorsApplied: 2, duration: "45" },
  { id: "pt-6", name: "Net 60 Post Production End", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Production End", description: "Payment is due 60 days after production is completed.", vendorsApplied: 3, duration: "60" },
  { id: "pt-7", name: "Full Advance Payment: Order Confirmation", category: "prepayment", typeBadge: "Pre", badgeColor: "hsl(var(--violet))", trigger: "Order Confirmation", description: "100% of the total amount is due when the order is confirmed.", vendorsApplied: 4 },
  // Title follows the configuration (Eli 9/24 R08): a 30% term is not a
  // "Full Advance" — the name, percentage and trigger say one thing.
  { id: "pt-8", name: "30% Prepayment: Production Start", category: "prepayment", typeBadge: "Pre", badgeColor: "hsl(var(--violet))", trigger: "Production Start", description: "A 30% prepayment is required at production start.", vendorsApplied: 2 },
  // Split template names carry BOTH the trigger and the days from that
  // trigger (Eli, 8/31/26 review): pre-transfer slices are due at the
  // event; the receiving/shipping slice states its net window.
  { id: "pt-9", name: "30/70 Split: Production Start, Receiving Net 30", category: "split", typeBadge: "Split", badgeColor: "hsl(var(--warning))", trigger: "Production Start", description: "30% due at production start, 70% due 30 days after receiving.", vendorsApplied: 5, duration: "30" },
  { id: "pt-10", name: "50/50 Split: Order Confirmation, Receiving Net 15", category: "split", typeBadge: "Split", badgeColor: "hsl(var(--warning))", trigger: "Order Confirmation", description: "50% due at order confirmation, 50% due 15 days after receiving.", vendorsApplied: 3, duration: "15" },
  { id: "pt-11", name: "40/60 Split: Production Start, Shipping Net 30", category: "split", typeBadge: "Split", badgeColor: "hsl(var(--warning))", trigger: "Production Start", description: "40% due at production start, 60% due 30 days after shipping.", vendorsApplied: 2, duration: "30" },
  { id: "pt-12", name: "2/10 Net 30 Post Shipping", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Shipping", description: "Payment is due 30 days after shipping, with a 2% discount if paid within 10 days.", vendorsApplied: 7, duration: "30", applyDiscount: true, discountPercent: "2", discountPeriod: "10" },
  // Custom payment terms (created by users)
  { id: "pt-custom-1", name: "Net 25 Post Production End", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Production End", description: "Payment is due 25 days after production end.", vendorsApplied: 3, duration: "25" },
  { id: "pt-custom-2", name: "Order Confirmation Advance", category: "prepayment", typeBadge: "Pre", badgeColor: "hsl(var(--violet))", trigger: "Order Confirmation", description: "Full prepayment due at order confirmation.", vendorsApplied: 1 },
  { id: "pt-custom-3", name: "40/60 Split: Production End, Receiving Net 45", category: "split", typeBadge: "Split", badgeColor: "hsl(var(--warning))", trigger: "Production End", description: "40% due at production end, 60% due 45 days after receiving.", vendorsApplied: 2, duration: "45" },
  { id: "pt-custom-4", name: "Net 90 Post Shipping", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Shipping", description: "Extended 90-day payment window after shipping for high-volume partners.", vendorsApplied: 4, duration: "90" },
  { id: "pt-custom-5", name: "20/30/50 Split: Order Confirmation, Production End, Receiving Net 30", category: "split", typeBadge: "Split", badgeColor: "hsl(var(--warning))", trigger: "Order Confirmation", description: "20% due at order confirmation, 30% due at production end, 50% due 30 days after receiving.", vendorsApplied: 1, duration: "30" },
];

/* ── Split slices (Eli, 8/31/26 review) ───────────────────────────────
 * A split is NOT one invoice divvied out: the vendor sends a separate
 * invoice per slice, so the create screen asks WHICH slice this invoice
 * covers. Each slice names its portion, trigger event, and the net days
 * from that trigger (0 = due at the event). */
export interface SplitSlice {
  percent: number;
  triggerEvent: TriggerEvent;
  netDays: number;
}
export const SPLIT_TERM_SLICES: Record<string, SplitSlice[]> = {
  'pt-9': [
    { percent: 30, triggerEvent: 'Production Start', netDays: 0 },
    { percent: 70, triggerEvent: 'Receiving', netDays: 30 },
  ],
  'pt-10': [
    { percent: 50, triggerEvent: 'Order Confirmation', netDays: 0 },
    { percent: 50, triggerEvent: 'Receiving', netDays: 15 },
  ],
  'pt-11': [
    { percent: 40, triggerEvent: 'Production Start', netDays: 0 },
    { percent: 60, triggerEvent: 'Shipping', netDays: 30 },
  ],
  'pt-custom-3': [
    { percent: 40, triggerEvent: 'Production End', netDays: 0 },
    { percent: 60, triggerEvent: 'Receiving', netDays: 45 },
  ],
  'pt-custom-5': [
    { percent: 20, triggerEvent: 'Order Confirmation', netDays: 0 },
    { percent: 30, triggerEvent: 'Production End', netDays: 0 },
    { percent: 50, triggerEvent: 'Receiving', netDays: 30 },
  ],
};

// Helpers ---------------------------------------------------------------------

/** The presets EXAMPLE data may use (8/28/26 evening review): NET and
 *  Prepayment only. Split templates stay in the catalog — browse/Change
 *  still offers them — but no table, invoice, or panel seeds them. */
export const EXAMPLE_TERM_PRESETS = PAYMENT_TERM_PRESETS.filter((p) => p.category !== 'split');

/** Stable vendor → preset assignment (8/12/26): a vendor's payment terms
 *  come from the partner templates, hashed off the vendor name so every
 *  surface (run authoring, pickers, vendor profiles) agrees. Split
 *  templates are excluded from the roster (8/28/26). */
export function presetForVendor(vendorName: string): PaymentTermPreset {
  let h = 0;
  for (let i = 0; i < vendorName.length; i++) h = (h * 31 + vendorName.charCodeAt(i)) >>> 0;
  return EXAMPLE_TERM_PRESETS[h % EXAMPLE_TERM_PRESETS.length];
}

export function findPresetById(id: string): PaymentTermPreset | undefined {
  return PAYMENT_TERM_PRESETS.find((p) => p.id === id);
}

export function findPresetByLabel(label: string): PaymentTermPreset | undefined {
  return PAYMENT_TERM_PRESETS.find((p) => p.name === label);
}

/** Resolve a vendor's free-text terms label (e.g. "Net 30", "Net 45",
 *  "2/10 Net 30") to a full preset so the partner PaymentTermCard can render.
 *  Tries exact name, then a name that starts with the label, then a NET term
 *  with the same day count, and finally synthesizes a NET preset so the card
 *  always has something to show. */
export function resolvePaymentTerm(label: string): PaymentTermPreset {
  const trimmed = (label || '').trim();
  const exact = PAYMENT_TERM_PRESETS.find((p) => p.name === trimmed);
  if (exact) return exact;
  const starts = PAYMENT_TERM_PRESETS.find((p) =>
    p.name.toLowerCase().startsWith(trimmed.toLowerCase()),
  );
  if (starts) return starts;
  const num = trimmed.match(/\d+/)?.[0];
  if (num) {
    const byDuration = PAYMENT_TERM_PRESETS.find((p) => p.category === 'net' && p.duration === num);
    if (byDuration) return byDuration;
  }
  return {
    id: `pt-resolved-${trimmed.replace(/\s+/g, '-').toLowerCase() || 'net'}`,
    name: trimmed || 'Net 30',
    category: 'net',
    typeBadge: 'NET',
    badgeColor: 'hsl(var(--primary))',
    trigger: 'Invoice Date',
    description: `Payment is due ${num || '30'} days after the invoice date.`,
    vendorsApplied: 0,
    duration: num || '30',
  };
}

/** One-line, user-facing explanation of each trigger event. The Trigger
 *  Date field keeps a STATIC label (8/28/26 review: dynamic labels break
 *  the user's learning) and reinforces the event through this dynamic
 *  helper + tooltip copy instead. */
export const TRIGGER_EVENT_COPY: Record<TriggerEvent, string> = {
  'Invoice Date': 'The vendor invoice date starts the payment clock automatically.',
  'Receiving': 'The date the goods were received.',
  'Shipping': 'The date the vendor shipped the goods.',
  'Production Start': 'The date the vendor started production.',
  'Production End': 'The date the vendor finished production.',
  'Order Confirmation': 'The date the vendor confirmed the order.',
};

export type TriggerKind = 'receiving' | 'invoiceDate' | 'other';

/** Classify a term's trigger for the due-date engine (8/25/26 meeting):
 *  Receiving resolves from the linked receiving document(s), Invoice Date
 *  from the vendor invoice date, and everything else runs from a manually
 *  keyed Trigger Date that defaults to the vendor invoice date. */
export function triggerKindFor(trigger: string): TriggerKind {
  if (trigger === 'Receiving') return 'receiving';
  if (trigger === 'Invoice Date') return 'invoiceDate';
  return 'other';
}

/** Resolve a NET-style term to its day count. Returns 0 for non-NET terms
 *  (prepayment / split) where there isn't a single fixed offset. */
export function daysForPreset(p: PaymentTermPreset | undefined): number {
  if (!p) return 0;
  if (p.category !== "net" || !p.duration) return 0;
  return parseInt(p.duration, 10) || 0;
}
