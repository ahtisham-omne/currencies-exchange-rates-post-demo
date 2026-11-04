import type { PaymentTermPreset, TriggerEvent } from '../paymentTermPresets';

// Customer payment terms (PRD §7.4, §8.2, BR-003, BR-007). Same preset
// shape as the vendor catalog so the shared PaymentTermCard renders them
// unchanged, but the AR side owns its own list: customer terms run from
// Shipping, never Receiving. Every term resolves to STAGES: a net term is
// one balance stage; a prepayment or split term has one or more advance
// stages (billed on Advance Invoices) and a balance stage (billed on
// Shipment Invoices). Kind rules mirror vendor invoicing: Advance takes
// prepayment or split only, Shipment and Standalone take net or split.

export type ArInvoiceKind = 'Shipment Invoice' | 'Advance Invoice' | 'Standalone';

export interface ArTermStage {
  /** 1-based position in the term. */
  index: number;
  percent: number;
  trigger: TriggerEvent;
  /** Days after the trigger the stage is due (0 = due at the event). */
  netDays: number;
  /** Advance stages bill before shipping; the balance bills on shipment. */
  kind: 'advance' | 'balance';
}

const NET = { category: 'net' as const, typeBadge: 'NET', badgeColor: 'hsl(var(--primary))' };
const PRE = { category: 'prepayment' as const, typeBadge: 'Pre', badgeColor: 'hsl(var(--violet))' };
const SPLIT = { category: 'split' as const, typeBadge: 'Split', badgeColor: 'hsl(var(--warning))' };

export const AR_PAYMENT_TERMS: PaymentTermPreset[] = [
  { id: 'ar-net-15', name: 'Net 15', ...NET, trigger: 'Invoice Date', description: 'Payment is due 15 days after the invoice date.', vendorsApplied: 3, duration: '15' },
  { id: 'ar-net-30', name: 'Net 30', ...NET, trigger: 'Invoice Date', description: 'Payment is due 30 days after the invoice date.', vendorsApplied: 6, duration: '30' },
  // Early-payment discount (10/29): the create form surfaces it from the term.
  { id: 'ar-2-10-net-30', name: '2/10 Net 30', ...NET, trigger: 'Invoice Date', description: 'Payment is due 30 days after the invoice date, with a 2% discount if paid within 10 days.', vendorsApplied: 3, duration: '30', applyDiscount: true, discountPercent: '2', discountPeriod: '10' },
  { id: 'ar-1-10-net-30-ship', name: '1/10 Net 30 Post Shipping', ...NET, trigger: 'Shipping', description: 'Payment is due 30 days after the goods ship, with a 1% discount if paid within 10 days.', vendorsApplied: 2, duration: '30', applyDiscount: true, discountPercent: '1', discountPeriod: '10' },
  { id: 'ar-net-45', name: 'Net 45', ...NET, trigger: 'Invoice Date', description: 'Payment is due 45 days after the invoice date.', vendorsApplied: 2, duration: '45' },
  { id: 'ar-net-60', name: 'Net 60', ...NET, trigger: 'Invoice Date', description: 'Payment is due 60 days after the invoice date.', vendorsApplied: 2, duration: '60' },
  { id: 'ar-net-30-ship', name: 'Net 30 Post Shipping', ...NET, trigger: 'Shipping', description: 'Payment is due 30 days after the goods ship.', vendorsApplied: 4, duration: '30' },
  { id: 'ar-pre-100', name: 'Full Advance Payment: Order Confirmation', ...PRE, trigger: 'Order Confirmation', description: '100% of the order is due when the order is confirmed.', vendorsApplied: 1 },
  { id: 'ar-pre-30', name: '30% Deposit: Order Confirmation, Shipping Net 30', ...PRE, trigger: 'Order Confirmation', description: '30% is due at order confirmation, the rest 30 days after shipping.', vendorsApplied: 3, duration: '30' },
  { id: 'ar-split-30-70', name: '30/70 Split: Production Start, Shipping Net 30', ...SPLIT, trigger: 'Production Start', description: '30% due at production start, 70% due 30 days after shipping.', vendorsApplied: 2, duration: '30' },
  { id: 'ar-split-50-50', name: '50/50 Split: Order Confirmation, Shipping Net 15', ...SPLIT, trigger: 'Order Confirmation', description: '50% due at order confirmation, 50% due 15 days after shipping.', vendorsApplied: 2, duration: '15' },
  { id: 'ar-split-20-30-50', name: '20/30/50 Split: Order Confirmation, Production End, Shipping Net 30', ...SPLIT, trigger: 'Order Confirmation', description: '20% at order confirmation, 30% at production end, 50% due 30 days after shipping.', vendorsApplied: 1, duration: '30' },
];

const STAGES: Record<string, Array<Omit<ArTermStage, 'index'>>> = {
  'ar-pre-100': [{ percent: 100, trigger: 'Order Confirmation', netDays: 0, kind: 'advance' }],
  'ar-pre-30': [
    { percent: 30, trigger: 'Order Confirmation', netDays: 0, kind: 'advance' },
    { percent: 70, trigger: 'Shipping', netDays: 30, kind: 'balance' },
  ],
  'ar-split-30-70': [
    { percent: 30, trigger: 'Production Start', netDays: 0, kind: 'advance' },
    { percent: 70, trigger: 'Shipping', netDays: 30, kind: 'balance' },
  ],
  'ar-split-50-50': [
    { percent: 50, trigger: 'Order Confirmation', netDays: 0, kind: 'advance' },
    { percent: 50, trigger: 'Shipping', netDays: 15, kind: 'balance' },
  ],
  'ar-split-20-30-50': [
    { percent: 20, trigger: 'Order Confirmation', netDays: 0, kind: 'advance' },
    { percent: 30, trigger: 'Production End', netDays: 0, kind: 'advance' },
    { percent: 50, trigger: 'Shipping', netDays: 30, kind: 'balance' },
  ],
};

export const DEFAULT_AR_TERM_ID = 'ar-net-30';

export function arTermById(id: string | undefined): PaymentTermPreset | undefined {
  return AR_PAYMENT_TERMS.find((t) => t.id === id);
}

export function arTermByName(name: string | undefined): PaymentTermPreset | undefined {
  return AR_PAYMENT_TERMS.find((t) => t.name === name);
}

/** Every term as stages. A net term is one 100% balance stage. */
export function stagesForTerm(term: PaymentTermPreset | undefined): ArTermStage[] {
  if (!term) return [];
  const raw = STAGES[term.id] ?? [
    { percent: 100, trigger: term.trigger, netDays: parseInt(term.duration ?? '0', 10) || 0, kind: 'balance' as const },
  ];
  return raw.map((s, i) => ({ ...s, index: i + 1 }));
}

export function advanceStagesFor(term: PaymentTermPreset | undefined): ArTermStage[] {
  return stagesForTerm(term).filter((s) => s.kind === 'advance');
}

export function balanceStageFor(term: PaymentTermPreset | undefined): ArTermStage | undefined {
  return stagesForTerm(term).find((s) => s.kind === 'balance');
}

/** "Stage 1 of 2: 30% at Order Confirmation" (PRD §8.4). */
export function stageLabel(stage: ArTermStage, total: number): string {
  return `Stage ${stage.index} of ${total}: ${stage.percent}% at ${stage.trigger}`;
}

/** Kind rules (BR-007, PRD §7.4 / §9.3): returns the reason a term is
 *  not allowed on an invoice kind, or null when it fits. */
export function termLockReason(kind: ArInvoiceKind, term: PaymentTermPreset): string | null {
  if (kind === 'Advance Invoice') {
    return term.category === 'net' ? 'Net terms bill after shipping. Pick a prepayment or split term.' : null;
  }
  return term.category === 'prepayment' && !balanceStageFor(term)
    ? 'Full prepayment terms are billed on an Advance Invoice.'
    : null;
}

export function termsForKind(kind: ArInvoiceKind): PaymentTermPreset[] {
  return AR_PAYMENT_TERMS.filter((t) => termLockReason(kind, t) === null);
}

/** Days from the trigger to due for the part of the term this invoice
 *  bills: the balance stage on shipment and standalone invoices (on a
 *  split only the net part is used, PRD §9.3), the chosen stage on an
 *  advance. */
export function netDaysFor(kind: ArInvoiceKind, term: PaymentTermPreset | undefined, stageIndex?: number): number {
  if (!term) return 0;
  if (kind === 'Advance Invoice') {
    const stage = stagesForTerm(term).find((s) => s.index === stageIndex) ?? advanceStagesFor(term)[0];
    return stage?.netDays ?? 0;
  }
  return balanceStageFor(term)?.netDays ?? 0;
}

/** The event that starts the payment clock for this invoice. */
export function triggerEventFor(kind: ArInvoiceKind, term: PaymentTermPreset | undefined, stageIndex?: number): TriggerEvent {
  if (!term) return 'Invoice Date';
  if (kind === 'Advance Invoice') {
    const stage = stagesForTerm(term).find((s) => s.index === stageIndex) ?? advanceStagesFor(term)[0];
    return stage?.trigger ?? term.trigger;
  }
  return balanceStageFor(term)?.trigger ?? term.trigger;
}

export const AR_TRIGGER_COPY: Record<TriggerEvent, string> = {
  'Invoice Date': 'The invoice date starts the payment clock.',
  Receiving: 'The date the customer received the goods.',
  Shipping: 'The date the goods shipped to the customer.',
  'Production Start': 'The date production started on the order.',
  'Production End': 'The date production finished on the order.',
  'Order Confirmation': 'The date the sales order was confirmed.',
};
