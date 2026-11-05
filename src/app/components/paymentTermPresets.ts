/**
 * Payment-term preset data — mirrors the canonical list in the Partners
 * app (`partnerConstants.tsx`). Kept here as a peer dataset so the PO
 * Detail page can render the same Browse Templates picker users see
 * during partner configuration.
 *
 * Keep in sync with the master list when presets change.
 */

export type PaymentTermCategory = "all" | "net" | "prepayment" | "split";

export interface PaymentTermPreset {
  id: string;
  name: string;
  category: PaymentTermCategory;
  typeBadge: string;
  badgeColor: string;
  trigger: string;
  description: string;
  vendorsApplied: number;
  duration?: string;
  applyDiscount?: boolean;
  discountPercent?: string;
  discountPeriod?: string;
}

export const PAYMENT_TERM_PRESETS: PaymentTermPreset[] = [
  { id: "pt-1", name: "Net 10", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Shipping", description: "Payment is due 10 days after shipment.", vendorsApplied: 4, duration: "10" },
  { id: "pt-2", name: "Net 15", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Shipping", description: "Payment is due 15 days after shipment.", vendorsApplied: 6, duration: "15" },
  { id: "pt-3", name: "Net 30", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Shipping", description: "Payment is due 30 days after shipment.", vendorsApplied: 3, duration: "30" },
  { id: "pt-4", name: "Net 30 Post Shipping", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Shipping", description: "Full payment is due 30 days after the goods are shipped.", vendorsApplied: 5, duration: "30" },
  { id: "pt-5", name: "Net 45 Post Delivery", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Delivery", description: "Payment is due 45 days after goods are delivered.", vendorsApplied: 2, duration: "45" },
  { id: "pt-6", name: "Net 60 Post Production End", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Production End", description: "Payment is due 60 days after production is completed.", vendorsApplied: 3, duration: "60" },
  { id: "pt-7", name: "Full Advance Payment: Order Confirmation", category: "prepayment", typeBadge: "Pre", badgeColor: "hsl(var(--violet))", trigger: "Order Confirmation", description: "100% of the total amount is paid when the order is confirmed.", vendorsApplied: 4 },
  { id: "pt-8", name: "Full Advance Payment: Production Start", category: "prepayment", typeBadge: "Pre", badgeColor: "hsl(var(--violet))", trigger: "Production Start", description: "A (X)% prepayment is required at production start.", vendorsApplied: 2 },
  { id: "pt-9", name: "30/70 Split: Production Start & Delivery", category: "split", typeBadge: "Split", badgeColor: "hsl(var(--warning))", trigger: "Production Start", description: "30% is due at production start, 70% at delivery.", vendorsApplied: 5 },
  { id: "pt-10", name: "50/50 Split: Order Confirmation & Delivery", category: "split", typeBadge: "Split", badgeColor: "hsl(var(--warning))", trigger: "Order Confirmation", description: "50% due at order confirmation, 50% at delivery.", vendorsApplied: 3 },
  { id: "pt-11", name: "40/60 Split: Production Start & Shipping", category: "split", typeBadge: "Split", badgeColor: "hsl(var(--warning))", trigger: "Production Start", description: "40% at production start, 60% at shipping.", vendorsApplied: 2 },
  { id: "pt-12", name: "2/10 Net 30 Post Shipping", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Shipping", description: "Payment is due 30 days after shipping, with a 2% discount if paid within 10 days.", vendorsApplied: 7, duration: "30", applyDiscount: true, discountPercent: "2", discountPeriod: "10" },
  // Custom payment terms (created by users)
  { id: "pt-custom-1", name: "Net 25 Post Production End", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Production End", description: "Payment is due 25 days after production end.", vendorsApplied: 3, duration: "25" },
  { id: "pt-custom-2", name: "Order Confirmation Advance", category: "prepayment", typeBadge: "Pre", badgeColor: "hsl(var(--violet))", trigger: "Order Confirmation", description: "Full prepayment due at order confirmation.", vendorsApplied: 1 },
  { id: "pt-custom-3", name: "40/60 Split: Production End & Delivery", category: "split", typeBadge: "Split", badgeColor: "hsl(var(--warning))", trigger: "Production End", description: "40% due at production end, 60% at delivery.", vendorsApplied: 2 },
  { id: "pt-custom-4", name: "Net 90 Post Shipping", category: "net", typeBadge: "NET", badgeColor: "hsl(var(--primary))", trigger: "Shipping", description: "Extended 90-day payment window after shipping for high-volume partners.", vendorsApplied: 4, duration: "90" },
  { id: "pt-custom-5", name: "20/30/50 Split: Order Confirmation, Production End & Delivery", category: "split", typeBadge: "Split", badgeColor: "hsl(var(--warning))", trigger: "Order Confirmation", description: "20% at order confirmation, 30% at production end, 50% at delivery.", vendorsApplied: 1 },
];

export const CREATE_PT_TYPES = [
  { id: "net", label: "NET Terms (After X Days of a Certain Event)" },
  { id: "prepayment", label: "Prepayment Terms (Before or After Confirm the Order)" },
  { id: "split", label: "Split Terms" },
] as const;

export const CREATE_PT_TRIGGERS = [
  { id: "order_confirmation", label: "Order Confirmation" },
  { id: "production_start", label: "Production Start" },
  { id: "production_end", label: "Production End" },
  { id: "shipping", label: "Shipping" },
  { id: "delivery", label: "Delivery" },
];

export const CREATE_PT_DURATIONS = [
  { id: "3", label: "3 days" },
  { id: "7", label: "7 days" },
  { id: "14", label: "14 days" },
  { id: "30", label: "30 days" },
  { id: "60", label: "60 days" },
  { id: "90", label: "90 days" },
  { id: "180", label: "180 days" },
  { id: "365", label: "365 days" },
  { id: "custom", label: "Custom" },
];

export const CREATE_PT_DISCOUNT_PERIODS = [
  { id: "3", label: "3 days" },
  { id: "7", label: "7 days" },
  { id: "10", label: "10 days" },
  { id: "14", label: "14 days" },
  { id: "30", label: "30 days" },
  { id: "60", label: "60 days" },
  { id: "custom", label: "Custom" },
];
