import { addDaysIso, localTodayIso } from '@/app/lib/dueBucket';
import { isClosedPeriod } from '@/app/lib/runMath';
import {
  advanceCoverageRatio,
  advanceInvoicesFor,
  advanceInvoicesForQuote,
  availableQty,
  billingByShipmentLine,
  lineAvailableToAdvance,
  orderBilling,
  quoteAvailableToAdvance,
  stageEventDate,
  type OrderBilling,
} from '@/app/data/ar/arBilling';
import {
  DEFAULT_AR_TERM_ID,
  advanceStagesFor,
  arTermById,
  netDaysFor,
  stagesForTerm,
  termLockReason,
  triggerEventFor,
  type ArInvoiceKind,
  type ArTermStage,
} from '@/app/data/ar/arPaymentTerms';
import {
  CHARGE_DEFAULT_ACCOUNT,
  COGS_ACCOUNT,
  COMPANY_CURRENCY,
  CUSTOMER_DEPOSITS_ACCOUNT,
  DEFAULT_REVENUE_ACCOUNT,
  FREIGHT_INCOME_ACCOUNT,
  FX_RATES_TO_USD,
  INVENTORY_ACCOUNT,
  SALES_TAX_ACCOUNT,
  splitGlAccount,
  type CustomerChargeType,
} from '@/app/data/ar/arGlAccounts';
import {
  customerByName,
  itemBySku,
  lockedUnitsFor,
  revenueAccountFor,
  type Customer,
  type CustomerQuote,
  type CustomerShipment,
  type CustomerSO,
} from '@/app/data/ar/mockCustomers';
import type { CustomerInvoice, PreInvoiceTreatment, PricingAdjustment, UnitAllocation } from '@/app/data/ar/mockCustomerInvoices';
import { getArSettings, type ArSettings } from '@/app/hooks/useArSettings';
import type { CustomerDeposit } from '@/app/data/ar/mockCustomerDeposits';
import { depositRemaining } from '@/app/data/ar/customerInvoiceStatus';
import { nextCustomerInvoiceNumber } from '@/app/hooks/useCustomerInvoicing';
import type { ArCreateSeed } from '../arCreateContract';
import type { PaymentTermPreset, TriggerEvent } from '@/app/data/paymentTermPresets';
import { nextSalesInvoiceNumber } from '@/app/lib/invoiceIds';
import { arAccountForCategory } from '@/app/data/ar/arGlAccounts';

// Pure model for the customer invoice form (PRD §7.4, §8.4, §9.3).
// Everything the screen renders is derived from FormState + the live
// invoices, so availability, coverage and the GL preview never drift.

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const EPS = 0.004;

export function money(n: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function fmtQty(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Quantity text input → number (no type=number anywhere). */
export function parseQty(raw: string): number {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

// ── Form state ───────────────────────────────────────────────────────

export interface FormLine {
  key: string;
  sku: string;
  description: string;
  uom: string;
  orderedQty: number;
  shippedQty: number;
  /** Shipment lines: quantity. */
  invoiceQty: number;
  unitPrice: number;
  /** BR-014: the order price, kept so an edited price can be restored. */
  originalUnitPrice: number;
  /** '' = none (shipment: BR-010 block; standalone: must pick). */
  glAccount: string;
  soNumber?: string;
  soLineId?: string;
  shipmentNumber?: string;
  shipmentLineId?: string;
  /** Advance lines. */
  advancePercent?: number;
  advanceAmount?: number;
  /** Standalone lines. */
  chargeTemplateId?: string;
  /** FAD 11/2: a free-text line typed on a shipment invoice, no inventory link. */
  manual?: boolean;
  /** FAD 11/2: pricing rules already inside the SO price (shown, never re-applied). */
  pricingAdjustments?: PricingAdjustment[];
  /** Revenue on invoice advances: serials or lots the user picked. Unset =
   *  auto-filled from the oldest units on hand (lockedUnitsFor). */
  lockedUnits?: UnitAllocation[];
}

/** FAD 11/2: the two flags an invoice can carry from creation. */
export type FlagKind = 'Disputed' | 'Exception';
export const FLAG_REASONS: Record<FlagKind, string[]> = {
  Disputed: ['Pricing disagreement', 'Quantity disagreement', 'Damaged goods', 'Not received', 'Other'],
  Exception: ['Price variance', 'Quantity variance', 'Missing documents', 'Other'],
};

export interface FormCharge {
  key: string;
  type: CustomerChargeType | '';
  description: string;
  amount: number;
  account: string;
}

export interface FormAttachment {
  name: string;
  size?: number;
  fromShipment?: boolean;
}

export interface FormState {
  /** The invoice number printed for the customer (BA 10/29): SI- sequence,
   *  prefilled, editable, separate from the system Invoice ID. */
  invoiceNumber: string;
  /** Trigger event (BA 10/29): picked from Shipping, Invoice Date,
   *  Production Start or Production End; the trigger date follows it. */
  triggerEvent: TriggerEvent;
  invoiceDate: string;
  postingDate: string;
  triggerDate: string;
  /** Standalone and Invoice Date shipment terms: the trigger follows the invoice date until edited. */
  triggerTouched: boolean;
  customerPONumber: string;
  description: string;
  relatedInvoiceNumber: string;
  billToAddressId: string;
  currency: string;
  paymentTermId: string;
  /** BR-007: false while an advance still carries a net term. */
  termApplied: boolean;
  stageIndex?: number;
  arAccount: string;
  depositAccount: string;
  freightAmount: number;
  freightAccount: string;
  charges: FormCharge[];
  notesToCustomer: string;
  attachments: FormAttachment[];
  lines: FormLine[];
  depositAmounts: Record<string, number>;
  creditHold: boolean;
  /** Dispute flagged on the form (vendor Payment Hold slot, user 11/4). */
  disputeOn: boolean;
  disputeReason: string;
  disputeDescription: string;
  disputed: boolean;
  /** FAD 11/2: pre-invoice treatment picked on the form (advance only). */
  treatment: PreInvoiceTreatment;
  treatmentTouched: boolean;
  /** FAD 11/2: one customer PO per SO on a combined invoice. */
  poBySo: Record<string, string>;
  /** FAD 11/2: manual sales tax, saved as one 'Tax' charge (2300). */
  salesTax: number;
  /** FAD 11/2: invoice currency → company currency at invoice date. */
  fxRate: number;
  /** FAD 11/2: dispute or exception flagged at creation. */
  flagOn: boolean;
  flagKind: FlagKind;
  flagReason: string;
  flagDescription: string;
}

/** Everything resolved once from the seed (the "what is billed"). */
export interface FormContext {
  kind: ArInvoiceKind;
  customer?: Customer;
  customerName: string;
  editId?: string;
  invoiceNumber: string;
  shipments: CustomerShipment[];
  salesOrders: CustomerSO[];
  /** Advance: the source. */
  so?: CustomerSO;
  quote?: CustomerQuote;
}

export function resolveContext(seed: ArCreateSeed, customers: Customer[], invoices: CustomerInvoice[], editInvoice?: CustomerInvoice): FormContext {
  const customer = customerByName(seed.customerName, customers);
  const base: FormContext = {
    kind: seed.kind,
    customer,
    customerName: seed.customerName,
    editId: editInvoice?.id,
    invoiceNumber: editInvoice?.invoiceNumber ?? nextCustomerInvoiceNumber(invoices, 'invoice'),
    shipments: [],
    salesOrders: [],
  };
  if (seed.kind === 'Shipment Invoice') {
    const shipments = seed.shipments
      .map((s) => customer?.shipments.find((x) => x.shipmentNumber === s.shipmentNumber))
      .filter((x): x is CustomerShipment => !!x);
    const soNums = [...new Set(shipments.map((s) => s.soNumber))];
    const salesOrders = soNums.map((n) => customer?.salesOrders.find((o) => o.soNumber === n)).filter((x): x is CustomerSO => !!x);
    return { ...base, shipments, salesOrders };
  }
  if (seed.kind === 'Advance Invoice') {
    if (seed.source.type === 'so') {
      const soNumber = seed.source.soNumber;
      const so = customer?.salesOrders.find((o) => o.soNumber === soNumber);
      return { ...base, so, salesOrders: so ? [so] : [] };
    }
    const quoteNumber = seed.source.quoteNumber;
    const quote = customer?.quotes.find((q) => q.quoteNumber === quoteNumber);
    return { ...base, quote };
  }
  return base;
}

// ── Advance helpers ──────────────────────────────────────────────────

export function advanceSourceInvoices(ctx: FormContext, invoices: CustomerInvoice[]): CustomerInvoice[] {
  if (ctx.so) return advanceInvoicesFor(ctx.so, invoices, ctx.editId);
  if (ctx.quote) return advanceInvoicesForQuote(ctx.quote, invoices, ctx.editId);
  return [];
}

/** Stage index → the advance invoice that already bills it (locked). */
export function billedStages(ctx: FormContext, invoices: CustomerInvoice[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const inv of advanceSourceInvoices(ctx, invoices)) {
    if (inv.advanceStage?.index) m.set(inv.advanceStage.index, inv.invoiceNumber);
  }
  return m;
}

export function firstOpenStage(term: PaymentTermPreset | undefined, billed: Map<number, string>): number | undefined {
  const stages = advanceStagesFor(term);
  return (stages.find((s) => !billed.has(s.index)) ?? stages[0])?.index;
}

export function stageOf(term: PaymentTermPreset | undefined, index: number | undefined): ArTermStage | undefined {
  return stagesForTerm(term).find((s) => s.index === index);
}

/** Shipment trigger date follows the term's event (house trigger model,
 *  8/25/26): a Shipping term runs from the latest ship date, an Invoice
 *  Date term from the invoice date. */
/** The four trigger events a customer invoice offers (BA 10/29). */
export const AR_TRIGGER_EVENTS: TriggerEvent[] = ['Shipping', 'Invoice Date', 'Production Start', 'Production End'];

export function defaultTriggerEvent(kind: ArInvoiceKind, term: PaymentTermPreset | undefined, stageIndex?: number): TriggerEvent {
  const t = triggerEventFor(kind, term, stageIndex);
  return AR_TRIGGER_EVENTS.includes(t) ? t : 'Invoice Date';
}

/** The date an event happened on this invoice's source, '' if not yet. */
export function eventDateFor(ctx: FormContext, event: TriggerEvent, invoiceDate: string): string {
  const latest = (xs: (string | undefined)[]) => xs.filter((x): x is string => !!x).sort().at(-1) ?? '';
  const orders = ctx.so ? [ctx.so] : ctx.salesOrders;
  switch (event) {
    case 'Invoice Date': return invoiceDate;
    case 'Shipping': return latest(ctx.shipments.map((s) => s.shipDate));
    case 'Production Start': return latest(orders.map((o) => o.productionStartDate));
    case 'Production End': return latest(orders.map((o) => o.productionEndDate));
    default: return '';
  }
}

export function shipmentTriggerFor(ctx: FormContext, termId: string, invoiceDate: string): { date: string; fromInvoiceDate: boolean } {
  const latestShip = ctx.shipments.map((s) => s.shipDate).sort().at(-1) ?? invoiceDate;
  const fromInvoiceDate = triggerEventFor('Shipment Invoice', arTermById(termId)) !== 'Shipping';
  return { date: fromInvoiceDate ? invoiceDate : latestShip, fromInvoiceDate };
}

/** Trigger date for an advance stage: the event date if it has happened. */
export function advanceTriggerFor(ctx: FormContext, stage: ArTermStage | undefined): string {
  if (!stage) return '';
  if (ctx.so) {
    const on = stageEventDate(ctx.so, stage);
    return on && on <= localTodayIso() ? on : '';
  }
  // A quote has no order events yet; a customer-confirmed quote is the
  // closest thing to an order confirmation.
  if (ctx.quote && ctx.quote.status === 'Confirmed' && stage.trigger === 'Order Confirmation') return ctx.quote.quoteDate;
  return '';
}

export interface AdvanceAvail {
  /** Per SO / quote line id. */
  perLine: Map<string, number>;
  orderTotal: number;
  alreadyBilled: number;
  availableTotal: number;
}

export function advanceAvailability(ctx: FormContext, invoices: CustomerInvoice[]): AdvanceAvail {
  const perLine = new Map<string, number>();
  if (ctx.so && ctx.customer) {
    const ob = orderBilling(ctx.so, ctx.customer, invoices, ctx.editId);
    for (const l of ctx.so.lines) perLine.set(l.id, lineAvailableToAdvance(l, ctx.so, ctx.customer, ob));
    return { perLine, orderTotal: ob.orderTotal, alreadyBilled: ob.advanceBilled, availableTotal: ob.availableToAdvance };
  }
  if (ctx.quote) {
    const q = ctx.quote;
    const avail = quoteAvailableToAdvance(q, invoices, ctx.editId);
    for (const l of q.lines) {
      const value = l.orderedQty * l.unitPrice;
      perLine.set(l.id, q.totalValue > 0 ? round2(avail * (value / q.totalValue)) : 0);
    }
    return { perLine, orderTotal: q.totalValue, alreadyBilled: round2(q.totalValue - avail), availableTotal: avail };
  }
  return { perLine, orderTotal: 0, alreadyBilled: 0, availableTotal: 0 };
}

export function advanceLinesFor(ctx: FormContext, invoices: CustomerInvoice[], percent: number, edit?: CustomerInvoice): FormLine[] {
  const src = ctx.so ?? ctx.quote;
  if (!src) return [];
  const avail = advanceAvailability(ctx, invoices);
  const shippedBySoLine = new Map<string, number>();
  if (ctx.so && ctx.customer) {
    for (const s of ctx.customer.shipments) {
      if (s.soNumber !== ctx.so.soNumber || s.status !== 'Shipped') continue;
      for (const l of s.lines) shippedBySoLine.set(l.soLineId, (shippedBySoLine.get(l.soLineId) ?? 0) + l.shippedQty);
    }
  }
  return src.lines.map((l, i) => {
    const value = round2(l.orderedQty * l.unitPrice);
    const editLine = edit?.lines.find((x) => x.soLineId === l.id);
    let amount: number;
    let pct: number;
    if (editLine) {
      amount = editLine.total;
      pct = editLine.advancePercent ?? (value > 0 ? round2((amount / value) * 100) : 0);
    } else {
      // Default to the stage %, never above what is left on the line.
      amount = Math.min(round2((value * percent) / 100), avail.perLine.get(l.id) ?? 0);
      pct = value > 0 ? round2((amount / value) * 100) : 0;
    }
    return {
      key: `L${i + 1}`,
      sku: l.sku,
      description: l.description,
      uom: l.uom,
      orderedQty: l.orderedQty,
      shippedQty: shippedBySoLine.get(l.id) ?? 0,
      invoiceQty: l.orderedQty,
      unitPrice: l.unitPrice,
      originalUnitPrice: l.unitPrice,
      glAccount: '',
      soNumber: ctx.so?.soNumber,
      soLineId: l.id,
      advancePercent: pct,
      advanceAmount: amount,
    };
  });
}

// ── Shipment helpers ─────────────────────────────────────────────────

export function shipmentAvailability(ctx: FormContext, invoices: CustomerInvoice[]): Map<string, number> {
  const map = billingByShipmentLine(invoices, ctx.editId);
  const out = new Map<string, number>();
  for (const s of ctx.shipments) for (const l of s.lines) out.set(l.id, availableQty(l, map));
  return out;
}

export interface SoCoverage {
  so: CustomerSO;
  ob: OrderBilling;
  ratio: number;
  advances: CustomerInvoice[];
}

export function coverageBySo(ctx: FormContext, invoices: CustomerInvoice[]): Map<string, SoCoverage> {
  const m = new Map<string, SoCoverage>();
  if (!ctx.customer) return m;
  for (const so of ctx.salesOrders) {
    const ob = orderBilling(so, ctx.customer, invoices, ctx.editId);
    m.set(so.soNumber, { so, ob, ratio: advanceCoverageRatio(ob), advances: advanceInvoicesFor(so, invoices, ctx.editId) });
  }
  return m;
}

function shipmentLinesFor(ctx: FormContext, seed: Extract<ArCreateSeed, { kind: 'Shipment Invoice' }>, invoices: CustomerInvoice[], edit?: CustomerInvoice): FormLine[] {
  const avail = shipmentAvailability(ctx, invoices);
  const out: FormLine[] = [];
  for (const s of ctx.shipments) {
    const scope = seed.shipments.find((x) => x.shipmentNumber === s.shipmentNumber)?.lineIds;
    for (const l of s.lines) {
      const editLine = edit?.lines.find((x) => x.shipmentLineId === l.id);
      if (edit) {
        if (!editLine) continue;
      } else if (scope ? !scope.includes(l.id) : (avail.get(l.id) ?? 0) <= EPS) {
        continue;
      }
      out.push({
        key: `L${out.length + 1}`,
        sku: l.sku,
        description: l.description,
        uom: l.uom,
        orderedQty: l.orderedQty,
        shippedQty: l.shippedQty,
        invoiceQty: editLine ? editLine.invoiceQty : avail.get(l.id) ?? 0,
        unitPrice: editLine ? editLine.unitPrice : l.unitPrice,
        originalUnitPrice: editLine?.originalUnitPrice ?? l.unitPrice,
        glAccount: revenueAccountFor(l.sku, ctx.customer) ?? '',
        soNumber: s.soNumber,
        soLineId: l.soLineId,
        shipmentNumber: s.shipmentNumber,
        shipmentLineId: l.id,
        pricingAdjustments: soLineFor(ctx, s.soNumber, l.soLineId)?.pricingAdjustments,
      });
    }
  }
  // Manual lines saved on the invoice come back as manual lines (FAD 11/2).
  if (edit) {
    edit.lines.filter((x) => x.manual).forEach((x, i) => out.push(manualFromSaved(x, i)));
  }
  return out;
}

function soLineFor(ctx: FormContext, soNumber: string | undefined, soLineId: string | undefined) {
  return ctx.salesOrders.find((o) => o.soNumber === soNumber)?.lines.find((l) => l.id === soLineId);
}

function manualFromSaved(x: CustomerInvoice['lines'][number], i: number): FormLine {
  return {
    key: `M${i + 1}`,
    sku: '',
    description: x.description,
    uom: x.uom || 'EA',
    orderedQty: x.invoiceQty,
    shippedQty: 0,
    invoiceQty: x.invoiceQty,
    unitPrice: x.unitPrice,
    originalUnitPrice: x.unitPrice,
    glAccount: x.glAccount,
    manual: true,
  };
}

/** FAD 11/2: a free-text line on a shipment invoice (Add Line). */
export function blankManualLine(n: number): FormLine {
  return { ...blankStandaloneLine(n), key: `M${Date.now()}-${n}`, glAccount: DEFAULT_REVENUE_ACCOUNT, manual: true };
}

/** FAD 11/2: freight is billed on the first invoice for each order. */
export interface FreightSource {
  soNumber: string;
  amount: number;
  /** Set when an earlier live invoice already billed this order's freight. */
  billedOn?: string;
}

export function freightSourcesFor(ctx: FormContext, invoices: CustomerInvoice[]): FreightSource[] {
  return ctx.salesOrders.map((so) => {
    const prior = invoices.find(
      (i) => i.id !== ctx.editId && i.docKind === 'Shipment Invoice' && i.invoiceStatus !== 'Cancelled' && i.linkedSOs.includes(so.soNumber) && (i.freightAmount ?? 0) > 0,
    );
    return { soNumber: so.soNumber, amount: round2(so.freightAmount ?? 0), billedOn: prior?.invoiceNumber };
  });
}

/** Freight comes from the order once: skip it when another live shipment
 *  invoice on the order already billed freight. */
function defaultFreight(ctx: FormContext, invoices: CustomerInvoice[]): number {
  return round2(freightSourcesFor(ctx, invoices).reduce((a, f) => a + (f.billedOn ? 0 : f.amount), 0));
}

function newCharge(i: number): FormCharge {
  return { key: `C${Date.now()}-${i}`, type: '', description: '', amount: 0, account: '' };
}
export { newCharge };

export function blankStandaloneLine(n: number): FormLine {
  return {
    key: `S${Date.now()}-${n}`,
    sku: '',
    description: '',
    uom: 'EA',
    orderedQty: 1,
    shippedQty: 0,
    invoiceQty: 1,
    unitPrice: 0,
    originalUnitPrice: 0,
    glAccount: '',
  };
}

/** Standalone terms: net or split. A full-prepayment default falls back. */
function standaloneTerm(id: string | undefined): string {
  const t = arTermById(id);
  return t && !termLockReason('Standalone', t) ? t.id : DEFAULT_AR_TERM_ID;
}

export function initialState(
  ctx: FormContext,
  seed: ArCreateSeed,
  invoices: CustomerInvoice[],
  deposits: CustomerDeposit[],
  edit?: CustomerInvoice,
): FormState {
  const st = baseState(ctx, seed, invoices, deposits, edit);
  return {
    ...st,
    triggerEvent: defaultTriggerEvent(ctx.kind, arTermById(st.paymentTermId), st.stageIndex),
    fxRate: edit?.fxRate ?? fxRateFor(st.currency),
  };
}

function baseState(
  ctx: FormContext,
  seed: ArCreateSeed,
  invoices: CustomerInvoice[],
  deposits: CustomerDeposit[],
  edit?: CustomerInvoice,
): FormState {
  const today = localTodayIso();
  const c = ctx.customer;
  const common = {
    invoiceNumber: edit?.documentNumber ?? nextSalesInvoiceNumber(invoices.map((i) => i.documentNumber)),
    // Set from the resolved term once the state is built (initialState).
    triggerEvent: 'Invoice Date' as TriggerEvent,
    invoiceDate: edit?.invoiceDate ?? today,
    description: edit?.description ?? '',
    relatedInvoiceNumber: edit?.relatedInvoiceNumber ?? '',
    // Prefilled from the customer profile, else the category default (BA 10/29).
    arAccount: edit?.arAccount ?? (c?.arAccount || (c ? arAccountForCategory(c.category) : '')),
    depositAccount: edit?.depositAccount ?? c?.depositAccount ?? '',
    creditHold: !!edit?.creditHold,
    disputeOn: !!edit?.disputed,
    ...disputeFromSaved(edit),
    disputed: !!edit?.disputed,
    depositAmounts: {} as Record<string, number>,
    treatment: edit?.treatment ?? defaultTreatment(getArSettings()),
    treatmentTouched: !!edit?.treatment,
    poBySo: Object.fromEntries(
      (ctx.so ? [ctx.so] : ctx.salesOrders).map((o) => [o.soNumber, edit?.poBySo?.[o.soNumber] ?? (edit && !edit.poBySo ? edit.customerPONumber ?? '' : '')]),
    ) as Record<string, string>,
    // Sales tax is an Additional Charge row now (user 11/4), so the
    // separate footer field stays at zero.
    salesTax: 0,
    fxRate: edit?.fxRate ?? 1,
    // Exception only; a dispute has its own section (user 11/4).
    flagOn: !!edit?.exception,
    flagKind: 'Exception' as FlagKind,
    ...flagFromSaved(edit),
  };
  const chargesOf = (e?: CustomerInvoice) =>
    (e?.charges ?? []).map((ch) => ({ key: ch.id, type: ch.type, description: ch.description, amount: ch.amount, account: ch.account }));

  if (seed.kind === 'Shipment Invoice') {
    const lines = shipmentLinesFor(ctx, seed, invoices, edit);
    const so0 = ctx.salesOrders[0];
    const freight = edit ? edit.freightAmount ?? 0 : defaultFreight(ctx, invoices);
    const state: FormState = {
      ...common,
      // Posting date defaults to today (10/29), editable.
      postingDate: edit?.postingDate ?? today,
      triggerDate: edit?.triggerDate ?? shipmentTriggerFor(ctx, seed.paymentTermId, common.invoiceDate).date,
      // An Invoice Date term keeps following the invoice date until edited.
      triggerTouched: !!edit || !shipmentTriggerFor(ctx, seed.paymentTermId, common.invoiceDate).fromInvoiceDate,
      customerPONumber: edit?.customerPONumber ?? '',
      billToAddressId: edit?.billToAddressId ?? so0?.billToAddressId ?? c?.defaultBillToId ?? '',
      currency: edit?.currency ?? so0?.currency ?? c?.currency ?? 'USD',
      paymentTermId: edit?.paymentTermId ?? seed.paymentTermId,
      termApplied: true,
      freightAmount: freight,
      freightAccount: edit?.freightAccount ?? FREIGHT_INCOME_ACCOUNT,
      charges: chargesOf(edit),
      // Starts empty like Description (10/29); never prefilled.
      notesToCustomer: edit?.notesToCustomer ?? '',
      // Starts empty (10/30): shipment packing slips and BOLs are no longer
      // prefilled; the user attaches what this invoice needs.
      attachments: [],
      lines,
    };
    state.depositAmounts = edit
      ? Object.fromEntries(edit.depositApplications.map((d) => [d.depositId, d.amount]))
      : defaultDepositAmounts(applicableDeposits(ctx, deposits), shipmentTotalsFor(ctx, state, invoices).total);
    return state;
  }

  if (seed.kind === 'Advance Invoice') {
    const src = ctx.so ?? ctx.quote;
    const termId = seed.paymentTermId ?? edit?.paymentTermId ?? src?.paymentTermId ?? DEFAULT_AR_TERM_ID;
    const term = arTermById(termId);
    const applied = !!term && !termLockReason('Advance Invoice', term);
    const billed = billedStages(ctx, invoices);
    const stageIndex = applied ? seed.stageIndex ?? edit?.advanceStage?.index ?? firstOpenStage(term, billed) : undefined;
    const stage = stageOf(term, stageIndex);
    return {
      ...common,
      // Only a Revenue pre-invoice posts (FAD 11/2); a Deposit one drops
      // the date on save.
      postingDate: edit?.postingDate ?? today,
      triggerDate: edit ? edit.triggerDate ?? '' : advanceTriggerFor(ctx, stage),
      triggerTouched: true,
      customerPONumber: edit?.customerPONumber ?? '',
      billToAddressId: edit?.billToAddressId ?? src?.billToAddressId ?? c?.defaultBillToId ?? '',
      currency: edit?.currency ?? src?.currency ?? c?.currency ?? 'USD',
      paymentTermId: termId,
      termApplied: applied,
      stageIndex,
      freightAmount: 0,
      freightAccount: FREIGHT_INCOME_ACCOUNT,
      charges: [],
      notesToCustomer: edit?.notesToCustomer ?? '',
      attachments: [],
      lines: advanceLinesFor(ctx, invoices, stage?.percent ?? 0, edit),
    };
  }

  // Standalone
  return {
    ...common,
    postingDate: edit?.postingDate ?? today,
    triggerDate: edit?.triggerDate ?? edit?.invoiceDate ?? today,
    triggerTouched: !!edit,
    customerPONumber: edit?.customerPONumber ?? '',
    billToAddressId: edit?.billToAddressId ?? c?.defaultBillToId ?? '',
    currency: edit?.currency ?? c?.currency ?? 'USD',
    paymentTermId: standaloneTerm(edit?.paymentTermId ?? c?.paymentTermId),
    termApplied: true,
    freightAmount: edit?.freightAmount ?? 0,
    freightAccount: edit?.freightAccount ?? FREIGHT_INCOME_ACCOUNT,
    charges: chargesOf(edit),
    notesToCustomer: edit?.notesToCustomer ?? '',
    attachments: [],
    lines: edit?.lines.length
      ? edit.lines.map((l, i) => ({
          key: `S${i + 1}`,
          sku: l.sku,
          description: l.description,
          uom: l.uom,
          orderedQty: l.invoiceQty,
          shippedQty: 0,
          invoiceQty: l.invoiceQty,
          unitPrice: l.unitPrice,
          originalUnitPrice: l.unitPrice,
          glAccount: l.glAccount,
          chargeTemplateId: l.chargeTemplateId,
        }))
      : [blankStandaloneLine(0)],
  };
}

// ── Deposits (payment side, kept) ────────────────────────────────────

/** On-account deposits only: a deposit received against an advance
 *  invoice is already carried by the advance coverage (BR-009), so
 *  applying it here would count it twice. */
export function onAccountDeposits(customerName: string, deposits: CustomerDeposit[]): CustomerDeposit[] {
  return deposits.filter((d) => d.customer === customerName && !d.preInvoiceNumber && depositRemaining(d) > EPS);
}

/** FAD 11/2: deposits taken on this invoice's SO(s) apply first; pure
 *  on-account deposits (no SO, no pre-invoice) follow as a fallback.
 *  A deposit paid against a pre-invoice stays out: the advance coverage
 *  already carries it (BR-009), so applying it again would count it twice. */
export function applicableDeposits(ctx: FormContext, deposits: CustomerDeposit[]): CustomerDeposit[] {
  const sos = new Set((ctx.so ? [ctx.so] : ctx.salesOrders).map((o) => o.soNumber));
  const held = onAccountDeposits(ctx.customerName, deposits);
  return [...held.filter((d) => d.soNumber && sos.has(d.soNumber)), ...held.filter((d) => !d.soNumber)];
}

function defaultDepositAmounts(held: CustomerDeposit[], total: number): Record<string, number> {
  let remaining = total;
  const out: Record<string, number> = {};
  for (const d of held) {
    const amt = round2(Math.min(depositRemaining(d), Math.max(0, remaining)));
    out[d.id] = amt;
    remaining = round2(remaining - amt);
  }
  return out;
}

// ── Totals ───────────────────────────────────────────────────────────

export interface LineMoney {
  gross: number;
  covered: number;
  total: number;
}

export interface Totals {
  lineMoney: Map<string, LineMoney>;
  subtotal: number;
  grossSubtotal: number;
  covered: number;
  freight: number;
  charges: number;
  /** FAD 11/2: manual sales tax (Cr 2300 Sales Tax Payable). */
  tax: number;
  total: number;
  /** BR-009 reference rows: advance invoice → amount this invoice carries. */
  advanceRefs: Array<{ invoiceNumber: string; amount: number }>;
}

export function shipmentTotalsFor(ctx: FormContext, s: FormState, invoices: CustomerInvoice[]): Totals {
  const cov = coverageBySo(ctx, invoices);
  const lineMoney = new Map<string, LineMoney>();
  const coveredBySo = new Map<string, number>();
  for (const l of s.lines) {
    const gross = round2(l.invoiceQty * l.unitPrice);
    const ratio = cov.get(l.soNumber ?? '')?.ratio ?? 0;
    const covered = round2(gross * ratio);
    lineMoney.set(l.key, { gross, covered, total: round2(gross - covered) });
    if (covered > 0 && l.soNumber) coveredBySo.set(l.soNumber, round2((coveredBySo.get(l.soNumber) ?? 0) + covered));
  }
  const advanceRefs: Totals['advanceRefs'] = [];
  for (const [soNumber, amt] of coveredBySo) {
    const advances = cov.get(soNumber)?.advances ?? [];
    const sum = advances.reduce((a, i) => a + i.amount, 0);
    let left = amt;
    advances.forEach((inv, idx) => {
      const share = idx === advances.length - 1 ? left : round2(sum > 0 ? amt * (inv.amount / sum) : 0);
      left = round2(left - share);
      if (share > EPS) advanceRefs.push({ invoiceNumber: inv.invoiceNumber, amount: share });
    });
  }
  return finishTotals(lineMoney, s, advanceRefs);
}

function finishTotals(lineMoney: Map<string, LineMoney>, s: FormState, advanceRefs: Totals['advanceRefs']): Totals {
  const vals = [...lineMoney.values()];
  const subtotal = round2(vals.reduce((a, v) => a + v.total, 0));
  const grossSubtotal = round2(vals.reduce((a, v) => a + v.gross, 0));
  const covered = round2(vals.reduce((a, v) => a + v.covered, 0));
  const freight = round2(s.freightAmount || 0);
  const charges = round2(s.charges.reduce((a, c) => a + (c.amount || 0), 0));
  const tax = round2(s.salesTax || 0);
  return { lineMoney, subtotal, grossSubtotal, covered, freight, charges, tax, total: round2(subtotal + freight + charges + tax), advanceRefs };
}

export function totalsFor(ctx: FormContext, s: FormState, invoices: CustomerInvoice[]): Totals {
  if (ctx.kind === 'Shipment Invoice') return shipmentTotalsFor(ctx, s, invoices);
  const lineMoney = new Map<string, LineMoney>();
  for (const l of s.lines) {
    const t = ctx.kind === 'Advance Invoice' ? round2(l.advanceAmount ?? 0) : round2(l.invoiceQty * l.unitPrice);
    lineMoney.set(l.key, { gross: t, covered: 0, total: t });
  }
  if (ctx.kind === 'Advance Invoice') {
    const subtotal = round2([...lineMoney.values()].reduce((a, v) => a + v.total, 0));
    return { lineMoney, subtotal, grossSubtotal: subtotal, covered: 0, freight: 0, charges: 0, tax: 0, total: subtotal, advanceRefs: [] };
  }
  return finishTotals(lineMoney, s, []);
}

// ── Due date (BR-016) ────────────────────────────────────────────────

export function dueDateFor(kind: ArInvoiceKind, s: FormState): string {
  if (!s.triggerDate) return '';
  return addDaysIso(s.triggerDate, netDaysFor(kind, arTermById(s.paymentTermId), s.stageIndex));
}

// ── GL preview (PRD §11.3, BR-021) ───────────────────────────────────

export interface GlRow {
  account: string;
  code: string;
  name: string;
  debit?: number;
  credit?: number;
  note?: string;
}

export function glRowsFor(
  ctx: FormContext,
  s: FormState,
  t: Totals,
  depositsApplied: number,
  invoices: CustomerInvoice[],
  /** FAD 11/2: the effective pre-invoice treatment (advance only). */
  treatment: PreInvoiceTreatment = 'Deposit',
): GlRow[] {
  const rows: GlRow[] = [];
  const push = (account: string, side: 'debit' | 'credit', amount: number, note?: string) => {
    if (amount <= EPS && side === 'credit') return;
    const p = splitGlAccount(account || 'No account');
    rows.push({ account, code: p.code, name: p.name, [side]: round2(amount), note });
  };
  if (ctx.kind === 'Advance Invoice') {
    // Deposit: nothing posts at invoice. Revenue: posts at approval,
    // Dr A/R, Cr revenue per line (FAD 11/2).
    if (treatment !== 'Revenue') return [];
    push(s.arAccount, 'debit', t.total);
    const rev = new Map<string, number>();
    for (const l of s.lines) {
      const amt = t.lineMoney.get(l.key)?.total ?? 0;
      if (amt <= EPS) continue;
      const acct = revenueAccountFor(l.sku, ctx.customer) ?? DEFAULT_REVENUE_ACCOUNT;
      rev.set(acct, round2((rev.get(acct) ?? 0) + amt));
    }
    for (const [acct, amt] of rev) push(acct, 'credit', amt);
    // Mahreen 11/4: cost posts with the revenue, at standard cost for the
    // share billed; the units leave available stock as a hard allocation.
    const cost = advanceCostOf(s.lines, t);
    if (cost > EPS) {
      push(COGS_ACCOUNT, 'debit', cost, 'Cost at invoice');
      push(INVENTORY_ACCOUNT, 'credit', cost, 'Units locked to this customer');
    }
    return rows;
  }
  push(s.arAccount, 'debit', t.total);
  if (t.covered > EPS) {
    const depAcct = ctx.salesOrders
      .flatMap((so) => advanceInvoicesFor(so, invoices, ctx.editId))
      .find((i) => i.depositAccount)?.depositAccount ?? ctx.customer?.depositAccount ?? CUSTOMER_DEPOSITS_ACCOUNT;
    push(depAcct || CUSTOMER_DEPOSITS_ACCOUNT, 'debit', t.covered, 'Releases the advance');
  }
  // Revenue at the FULL gross, grouped per line account.
  const rev = new Map<string, number>();
  for (const l of s.lines) {
    const m = t.lineMoney.get(l.key);
    if (!m || m.gross <= EPS) continue;
    rev.set(l.glAccount, round2((rev.get(l.glAccount) ?? 0) + m.gross));
  }
  for (const [acct, amt] of rev) push(acct, 'credit', amt);
  if (t.freight > EPS) push(s.freightAccount, 'credit', t.freight);
  const ch = new Map<string, number>();
  for (const c of s.charges) {
    if ((c.amount || 0) <= EPS) continue;
    const acct = c.account || (c.type ? CHARGE_DEFAULT_ACCOUNT[c.type] : '');
    ch.set(acct, round2((ch.get(acct) ?? 0) + c.amount));
  }
  for (const [acct, amt] of ch) push(acct, 'credit', amt);
  if (t.tax > EPS) push(SALES_TAX_ACCOUNT, 'credit', t.tax);
  if (depositsApplied > EPS) {
    push(ctx.customer?.depositAccount || CUSTOMER_DEPOSITS_ACCOUNT, 'debit', depositsApplied, 'Deposit Applied');
    push(s.arAccount, 'credit', depositsApplied, 'Deposit Applied');
  }
  return rows;
}

/** Standard cost of what a Revenue on invoice advance bills: each line's
 *  billed total at the item's cost-to-price ratio. */
export function advanceCostOf(lines: FormLine[], t: Totals): number {
  let cost = 0;
  for (const l of lines) {
    const amt = t.lineMoney.get(l.key)?.total ?? 0;
    const item = itemBySku(l.sku);
    if (amt <= EPS || !item || l.unitPrice <= EPS) continue;
    cost += amt * (item.unitCost / l.unitPrice);
  }
  return round2(cost);
}

export function glTotals(rows: GlRow[]) {
  const dr = round2(rows.reduce((a, r) => a + (r.debit ?? 0), 0));
  const cr = round2(rows.reduce((a, r) => a + (r.credit ?? 0), 0));
  return { dr, cr, balanced: Math.abs(dr - cr) < 0.01 };
}

// ── Validation ───────────────────────────────────────────────────────

export interface Issue {
  /** DOM id of the field to ring + scroll to. */
  fieldId: string;
  message: string;
  /** Rail accordion that holds the field, opened before scrolling. */
  section?: string;
}

export function closedPeriod(date: string): boolean {
  return !!date && isClosedPeriod(date);
}

export const CLOSED_PERIOD_MSG = 'This period is closed. Pick a posting date in an open period.';

// ── FAD 11/2 helpers ─────────────────────────────────────────────────

export function defaultTreatment(st: ArSettings): PreInvoiceTreatment {
  if (st.preInvoiceTreatment === 'Never') return 'Deposit';
  if (st.preInvoiceTreatment === 'Always') return 'Revenue';
  return st.preInvoiceDefault;
}

export function fxRateFor(currency: string): number {
  return currency === COMPANY_CURRENCY ? 1 : FX_RATES_TO_USD[currency] ?? 1;
}

function flagFromSaved(edit?: CustomerInvoice): { flagReason: string; flagDescription: string } {
  const d = edit?.exception;
  if (!d) return { flagReason: '', flagDescription: '' };
  // Saved as "Reason: description" (see formBuild).
  const [reason, ...rest] = d.reason.split(': ');
  return { flagReason: reason, flagDescription: rest.join(': ') };
}

function disputeFromSaved(edit?: CustomerInvoice): { disputeReason: string; disputeDescription: string } {
  const d = edit?.disputed ? edit.disputeDetail : undefined;
  if (!d) return { disputeReason: '', disputeDescription: '' };
  const [reason, ...rest] = d.reason.split(': ');
  return { disputeReason: reason, disputeDescription: rest.join(': ') };
}

export interface TreatmentState {
  /** What the form shows as picked (company mode, the user's pick, or
   *  Revenue on shipment when Revenue on invoice is not allowed). */
  picked: PreInvoiceTreatment;
  /** What will post. Always equals picked (Mahreen 11/4: a blocked option
   *  is disabled, never silently switched). */
  effective: PreInvoiceTreatment;
  /** Why the choice cannot change: the company mode, a quote, or posted. */
  lock?: 'Never' | 'Always' | 'quote' | 'posted';
  /** Revenue gate: lines whose units are not all on hand. */
  shortItems: string[];
  /** (Proposed) why Revenue on invoice is disabled, e.g. "Only 40 of 100 units on hand." */
  revenueBlocked?: string;
  /** Saved as treatmentNote when the company or user wanted Revenue on
   *  invoice and the gate kept it on shipment. */
  note?: string;
}

/** Mahreen 11/4 Revenue Treatment: the company setting picks and may lock
 *  the choice; a quote is always Revenue on shipment (no SO, nothing to
 *  allocate); (proposed) Revenue on invoice is disabled when the units
 *  are not on hand. */
export function treatmentFor(ctx: FormContext, s: FormState, st: ArSettings, edit?: CustomerInvoice): TreatmentState {
  if (ctx.kind !== 'Advance Invoice') return { picked: 'Deposit', effective: 'Deposit', shortItems: [] };
  if (edit?.invoiceStatus === 'Approved' && edit.treatment) {
    return { picked: edit.treatment, effective: edit.treatment, lock: 'posted', shortItems: [], note: edit.treatmentNote };
  }
  if (ctx.quote && !ctx.so) {
    return { picked: 'Deposit', effective: 'Deposit', lock: 'quote', shortItems: [], revenueBlocked: 'A quote has no sales order, so there is nothing to allocate.' };
  }
  const lock = st.preInvoiceTreatment === 'Never' ? 'Never' : st.preInvoiceTreatment === 'Always' ? 'Always' : undefined;
  const wanted: PreInvoiceTreatment = lock === 'Never' ? 'Deposit' : lock === 'Always' ? 'Revenue' : s.treatment;
  if (!st.revenueGate || !ctx.so) return { picked: wanted, effective: wanted, lock, shortItems: [] };
  const short = s.lines
    .filter((l) => !l.manual && (l.advanceAmount ?? 0) > EPS)
    .map((l) => {
      const soLine = ctx.so!.lines.find((x) => x.id === l.soLineId);
      const needed = Math.max(0, l.orderedQty - l.shippedQty);
      return { sku: l.sku, needed, onHand: Math.max(0, Math.floor(soLine?.onHand ?? needed)) };
    })
    .filter((x) => x.onHand < x.needed - EPS);
  if (!short.length) return { picked: wanted, effective: wanted, lock, shortItems: [] };
  const first = short[0];
  const more = short.length > 1 ? ` (and ${short.length - 1} more item${short.length === 2 ? '' : 's'})` : '';
  const revenueBlocked = `Only ${fmtUnits(first.onHand)} of ${fmtUnits(first.needed)} units of ${first.sku} on hand${more}.`;
  return {
    picked: 'Deposit',
    effective: 'Deposit',
    lock,
    shortItems: short.map((x) => x.sku),
    revenueBlocked,
    note: wanted === 'Revenue' ? `${revenueBlocked} Revenue is booked on shipment.` : undefined,
  };
}

const fmtUnits = (n: number) => n.toLocaleString('en-US');

/** The units each Revenue on invoice line locks, keyed by line. */
export function lockedUnitsByLine(ctx: FormContext, s: FormState): Map<string, ReturnType<typeof lockedUnitsFor>> {
  const out = new Map<string, ReturnType<typeof lockedUnitsFor>>();
  for (const l of s.lines) {
    if (l.manual || !l.soLineId) continue;
    const soLine = ctx.so?.lines.find((x) => x.id === l.soLineId);
    out.set(l.key, lockedUnitsFor(l, soLine));
  }
  return out;
}

/** Units still open on each SO line for this invoice (FAD 11/2 item 8):
 *  ordered minus what other live invoices and this invoice's other lines bill. */
export function orderedLeftFor(ctx: FormContext, s: FormState, invoices: CustomerInvoice[]): Map<string, number> {
  const billedBySoLine = new Map<string, number>();
  for (const [lineId, b] of billingByShipmentLine(invoices, ctx.editId)) {
    for (const sh of ctx.customer?.shipments ?? []) {
      const l = sh.lines.find((x) => x.id === lineId);
      if (l) billedBySoLine.set(l.soLineId, (billedBySoLine.get(l.soLineId) ?? 0) + b.invoiced + b.inProgress);
    }
  }
  const out = new Map<string, number>();
  for (const l of s.lines) {
    if (l.manual || !l.soLineId) continue;
    const others = s.lines.filter((x) => x.key !== l.key && x.soLineId === l.soLineId && !x.manual).reduce((a, x) => a + x.invoiceQty, 0);
    out.set(l.key, Math.max(0, round2(l.orderedQty - (billedBySoLine.get(l.soLineId) ?? 0) - others)));
  }
  return out;
}

export interface DuplicateHit {
  invoiceNumber: string;
  message: string;
}

/** FAD 11/2 duplicate check on Post: a line already fully billed by another
 *  live invoice (its shipment line, or its whole SO line). */
export function duplicateLinesFor(ctx: FormContext, s: FormState, invoices: CustomerInvoice[], shipAvail: Map<string, number>): Map<string, DuplicateHit> {
  const out = new Map<string, DuplicateHit>();
  if (ctx.kind !== 'Shipment Invoice') return out;
  const live = invoices.filter((i) => i.id !== ctx.editId && i.docKind === 'Shipment Invoice' && ['Draft', 'Pending Approval', 'Rejected', 'Approved'].includes(i.invoiceStatus));
  const map = billingByShipmentLine(invoices, ctx.editId);
  for (const l of s.lines) {
    if (l.manual || l.invoiceQty <= EPS) continue;
    const shLine = ctx.shipments.find((x) => x.shipmentNumber === l.shipmentNumber)?.lines.find((x) => x.id === l.shipmentLineId);
    if (shLine && (shipAvail.get(shLine.id) ?? 0) <= EPS && availableQty(shLine, map) <= EPS) {
      const on = live.find((i) => i.lines.some((x) => x.shipmentLineId === shLine.id));
      if (on) {
        out.set(l.key, { invoiceNumber: on.invoiceNumber, message: `Shipment ${l.shipmentNumber} line ${l.sku} is already invoiced on ${on.invoiceNumber}.` });
        continue;
      }
    }
    // The whole SO line is billed elsewhere, even if this shipment line is not.
    const soBilled = live
      .flatMap((i) => i.lines.filter((x) => x.soLineId === l.soLineId && x.soNumber === l.soNumber).map((x) => ({ inv: i, qty: x.invoiceQty })))
      .reduce((a, x) => a + x.qty, 0);
    if (l.soLineId && soBilled >= l.orderedQty - EPS) {
      const on = live.find((i) => i.lines.some((x) => x.soLineId === l.soLineId && x.soNumber === l.soNumber));
      if (on) out.set(l.key, { invoiceNumber: on.invoiceNumber, message: `SO ${l.soNumber} line ${l.sku} is already invoiced on ${on.invoiceNumber}.` });
    }
  }
  return out;
}
