import { localTodayIso } from '@/app/lib/dueBucket';
import { advanceStagesFor, arTermById, stageLabel, stagesForTerm, type ArTermStage } from './arPaymentTerms';
import type { Customer, CustomerQuote, CustomerShipment, CustomerShipmentLine, CustomerSO, CustomerSOLine } from './mockCustomers';
import type { CustomerInvoice } from './mockCustomerInvoices';

// Billing math for Customer Invoicing, all DERIVED from the invoices so
// Ready to Invoice, the pickers, the create form and the detail pages
// read one truth (PRD §5.3, §7.3, §8.4, BR-005, BR-006, BR-009).
//
// - An invoice holds shipped units from the moment it exists (Draft,
//   Pending Approval, Rejected) so two invoices can never bill the same
//   units; Cancelled releases them. Approved units are "invoiced".
// - Advances: each advance invoice bills a share of the order. The
//   balance invoices bill only what the advances did not cover, pro rata
//   over the value still to invoice, so the advance and the balance
//   invoices add up to the order total (BR-009). Nothing is deducted.

const round2 = (n: number) => Math.round(n * 100) / 100;
const EPS = 0.004;

export const HOLDING_STATUSES: CustomerInvoice['invoiceStatus'][] = ['Draft', 'Pending Approval', 'Rejected', 'Approved'];

// A revised (superseded) version releases its units to the new version (FAD 11/2).
const holds = (inv: CustomerInvoice) => HOLDING_STATUSES.includes(inv.invoiceStatus) && !inv.supersededById;

export interface LineBilling {
  invoiced: number;
  inProgress: number;
}

/** Shipped units billed per shipment line. `excludeInvoiceId` leaves the
 *  invoice being edited out so its own quantities are available to it. */
export function billingByShipmentLine(invoices: CustomerInvoice[], excludeInvoiceId?: string): Map<string, LineBilling> {
  const map = new Map<string, LineBilling>();
  for (const inv of invoices) {
    if (inv.docKind !== 'Shipment Invoice' || !holds(inv) || inv.id === excludeInvoiceId) continue;
    for (const l of inv.lines) {
      if (!l.shipmentLineId) continue;
      const cur = map.get(l.shipmentLineId) ?? { invoiced: 0, inProgress: 0 };
      if (inv.invoiceStatus === 'Approved') cur.invoiced += l.invoiceQty;
      else cur.inProgress += l.invoiceQty;
      map.set(l.shipmentLineId, cur);
    }
  }
  return map;
}

/** Approve-time duplicate check (FAD 11/2): shipment lines this invoice
 *  bills that other invoices already hold beyond the shipped quantity.
 *  Each conflict names the shipment and the other invoice. */
export function shipmentBillingConflicts(
  inv: CustomerInvoice,
  invoices: CustomerInvoice[],
  shippedQtyOf: (shipmentLineId: string) => number | undefined,
): Array<{ shipmentNumber: string; otherInvoiceNumber: string }> {
  if (inv.docKind !== 'Shipment Invoice') return [];
  const others = invoices.filter((o) => o.id !== inv.id && o.docKind === 'Shipment Invoice' && holds(o));
  const out: Array<{ shipmentNumber: string; otherInvoiceNumber: string }> = [];
  for (const l of inv.lines) {
    if (!l.shipmentLineId) continue;
    const shipped = shippedQtyOf(l.shipmentLineId) ?? l.shippedQty;
    if (shipped === undefined) continue;
    const holders = others.filter((o) => o.lines.some((x) => x.shipmentLineId === l.shipmentLineId));
    const held = holders.reduce((s, o) => s + o.lines.filter((x) => x.shipmentLineId === l.shipmentLineId).reduce((a, x) => a + x.invoiceQty, 0), 0);
    if (held + l.invoiceQty > shipped && holders.length > 0) {
      const key = `${l.shipmentNumber ?? ''}|${holders[0].invoiceNumber}`;
      if (!out.some((c) => `${c.shipmentNumber}|${c.otherInvoiceNumber}` === key)) {
        out.push({ shipmentNumber: l.shipmentNumber ?? 'The shipment', otherInvoiceNumber: holders[0].invoiceNumber });
      }
    }
  }
  return out;
}

export function availableQty(line: CustomerShipmentLine, map: Map<string, LineBilling>): number {
  const b = map.get(line.id);
  return Math.max(0, line.shippedQty - (b ? b.invoiced + b.inProgress : 0));
}

export function isInvoiceableShipment(s: CustomerShipment): boolean {
  return s.status === 'Shipped';
}

export type ShipmentBillingStatus = 'Not Invoiced' | 'Partially Invoiced' | 'Fully Invoiced';

export function shipmentBillingStatus(s: CustomerShipment, map: Map<string, LineBilling>): ShipmentBillingStatus {
  const shipped = s.lines.reduce((a, l) => a + l.shippedQty, 0);
  const billed = s.lines.reduce((a, l) => a + (shipped ? l.shippedQty - availableQty(l, map) : 0), 0);
  if (billed <= 0) return 'Not Invoiced';
  return billed >= shipped ? 'Fully Invoiced' : 'Partially Invoiced';
}

export function shipmentLinesToBill(s: CustomerShipment, map: Map<string, LineBilling>): CustomerShipmentLine[] {
  return s.lines.filter((l) => availableQty(l, map) > 0);
}

/** Shipped value not yet invoiced (PRD §5.3, §7.3), at the order price. */
export function shipmentValueNotBilled(s: CustomerShipment, map: Map<string, LineBilling>): number {
  return round2(s.lines.reduce((sum, l) => sum + availableQty(l, map) * l.unitPrice, 0));
}

// ── Advances ──────────────────────────────────────────────────────

/** Advance invoices that bill this order, including ones raised on the
 *  quote it came from (an advance moves to the order, PRD §8.3). */
export function advanceInvoicesFor(so: CustomerSO, invoices: CustomerInvoice[], excludeInvoiceId?: string): CustomerInvoice[] {
  return invoices.filter(
    (i) =>
      i.docKind === 'Advance Invoice' && holds(i) && i.id !== excludeInvoiceId &&
      (i.linkedSOs.includes(so.soNumber) || (!!so.quoteNumber && i.quoteNumber === so.quoteNumber)),
  );
}

export function advanceInvoicesForQuote(q: CustomerQuote, invoices: CustomerInvoice[], excludeInvoiceId?: string): CustomerInvoice[] {
  return invoices.filter((i) => i.docKind === 'Advance Invoice' && holds(i) && i.id !== excludeInvoiceId && i.quoteNumber === q.quoteNumber);
}

export interface OrderBilling {
  orderTotal: number;
  /** Advance invoices on the order (any holding status). */
  advanceBilled: number;
  /** Advance value already carried by balance invoices. */
  advanceConsumed: number;
  /** Advance still to be carried by future balance invoices. */
  advanceRemaining: number;
  /** Gross order value already on shipment invoices. */
  shipmentInvoicedGross: number;
  /** Order value not shipped yet. */
  unshippedValue: number;
  /** PRD §8.4: what can still be advance-billed. */
  availableToAdvance: number;
  /** BR-022: the order's invoiced amount (approved invoices). */
  invoicedApproved: number;
}

export function orderBilling(
  so: CustomerSO,
  customer: Customer,
  invoices: CustomerInvoice[],
  excludeInvoiceId?: string,
): OrderBilling {
  const advances = advanceInvoicesFor(so, invoices, excludeInvoiceId);
  const advanceBilled = round2(advances.reduce((s, i) => s + i.amount, 0));
  const shipInvoices = invoices.filter(
    (i) => i.docKind === 'Shipment Invoice' && holds(i) && i.id !== excludeInvoiceId && i.linkedSOs.includes(so.soNumber),
  );
  let consumed = 0;
  let gross = 0;
  for (const inv of shipInvoices) {
    for (const l of inv.lines) {
      if (l.soNumber !== so.soNumber) continue;
      consumed += l.advanceCovered ?? 0;
      gross += l.grossTotal ?? l.total;
    }
  }
  const shippedValue = customer.shipments
    .filter((s) => s.soNumber === so.soNumber && isInvoiceableShipment(s))
    .reduce((sum, s) => sum + s.lines.reduce((a, l) => a + l.shippedQty * l.unitPrice, 0), 0);
  const advanceRemaining = Math.max(0, round2(advanceBilled - consumed));
  const unshippedValue = Math.max(0, round2(so.totalValue - shippedValue));
  const invoicedApproved = round2(
    invoices
      .filter((i) => i.invoiceStatus === 'Approved' && (i.docKind === 'Shipment Invoice' || i.docKind === 'Advance Invoice') && i.linkedSOs.includes(so.soNumber))
      .reduce((s, i) => s + i.amount, 0),
  );
  return {
    orderTotal: so.totalValue,
    advanceBilled,
    advanceConsumed: round2(consumed),
    advanceRemaining,
    shipmentInvoicedGross: round2(gross),
    unshippedValue,
    availableToAdvance: Math.max(0, round2(unshippedValue - advanceRemaining)),
    invoicedApproved,
  };
}

/** BR-009: the share of a new shipment invoice's gross value already
 *  billed on advances, spread over the value still to invoice. */
export function advanceCoverageRatio(ob: OrderBilling): number {
  const toInvoice = ob.orderTotal - ob.shipmentInvoicedGross;
  if (ob.advanceRemaining <= EPS || toInvoice <= EPS) return 0;
  return Math.min(1, ob.advanceRemaining / toInvoice);
}

/** Per-line available-to-advance (PRD §8.4): the line's unshipped value
 *  less its share of the advance already billed. */
export function lineAvailableToAdvance(
  line: CustomerSOLine,
  so: CustomerSO,
  customer: Customer,
  ob: OrderBilling,
): number {
  const shipped = customer.shipments
    .filter((s) => s.soNumber === so.soNumber && isInvoiceableShipment(s))
    .reduce((sum, s) => sum + s.lines.filter((l) => l.soLineId === line.id).reduce((a, l) => a + l.shippedQty, 0), 0);
  const unshippedLine = Math.max(0, (line.orderedQty - shipped) * line.unitPrice);
  if (ob.unshippedValue <= EPS) return 0;
  return Math.max(0, round2(unshippedLine - ob.advanceRemaining * (unshippedLine / ob.unshippedValue)));
}

export function quoteAvailableToAdvance(q: CustomerQuote, invoices: CustomerInvoice[], excludeInvoiceId?: string): number {
  const billed = advanceInvoicesForQuote(q, invoices, excludeInvoiceId).reduce((s, i) => s + i.amount, 0);
  return Math.max(0, round2(q.totalValue - billed));
}

// ── Eligibility (PRD §8.3) ────────────────────────────────────────

export function soAdvanceLockReason(so: CustomerSO, customer: Customer, invoices: CustomerInvoice[]): string | null {
  if (so.status === 'Draft') return 'Draft orders cannot be advance-billed. Confirm the order first.';
  if (so.status === 'Cancelled') return 'This order is cancelled.';
  if (so.status === 'Shipped') return 'Everything on this order has shipped. Bill it on a shipment invoice.';
  if (orderBilling(so, customer, invoices).availableToAdvance <= EPS) return 'Nothing is left to advance-bill on this order.';
  // A prepayment or split term bills each advance stage once; when all
  // are billed the rest goes on shipment invoices. A net order stays
  // open: the form swaps it to a prepayment term (BR-007).
  const stages = advanceStagesFor(arTermById(so.paymentTermId));
  if (stages.length > 0) {
    const billed = billedStageIndexes(so, invoices);
    if (stages.every((st) => billed.has(st.index))) return 'Every advance stage on this order is billed. The balance is billed when the goods ship.';
  }
  return null;
}

export function quoteAdvanceLockReason(q: CustomerQuote, invoices: CustomerInvoice[]): string | null {
  if (q.status === 'Draft') return 'Draft quotes cannot be billed. Send the quote to the customer first.';
  if (q.status === 'Expired') return 'This quote has expired.';
  if (q.status === 'Cancelled') return 'This quote is cancelled.';
  if (q.convertedToSO) return `This quote became SO ${q.convertedToSO}. Bill the order instead.`;
  if (quoteAvailableToAdvance(q, invoices) <= EPS) return 'Nothing is left to advance-bill on this quote.';
  return null;
}

// ── Stages ────────────────────────────────────────────────────────

export function stageEventDate(so: CustomerSO, stage: ArTermStage): string | undefined {
  switch (stage.trigger) {
    case 'Order Confirmation': return so.confirmationDate;
    case 'Production Start': return so.productionStartDate;
    case 'Production End': return so.productionEndDate;
    default: return undefined;
  }
}

/** Advance stages already on an advance invoice for this order. */
export function billedStageIndexes(so: CustomerSO, invoices: CustomerInvoice[]): Set<number> {
  return new Set(advanceInvoicesFor(so, invoices).map((i) => i.advanceStage?.index).filter((x): x is number => !!x));
}

export interface DueStage {
  stage: ArTermStage;
  total: number;
  label: string;
  dueOn: string;
  amount: number;
}

/** Advance stages whose event has happened and that no advance invoice
 *  bills yet: these wait in Ready to Invoice (PRD §8.2). */
export function dueStagesFor(so: CustomerSO, invoices: CustomerInvoice[], todayIso = localTodayIso()): DueStage[] {
  if (so.status === 'Draft' || so.status === 'Cancelled' || so.status === 'Shipped') return [];
  const term = arTermById(so.paymentTermId);
  const all = stagesForTerm(term);
  const billed = billedStageIndexes(so, invoices);
  return advanceStagesFor(term)
    .filter((s) => !billed.has(s.index))
    .map((s) => ({ s, on: stageEventDate(so, s) }))
    .filter((x): x is { s: ArTermStage; on: string } => !!x.on && x.on <= todayIso)
    .map(({ s, on }) => ({ stage: s, total: all.length, label: stageLabel(s, all.length), dueOn: on, amount: round2(so.totalValue * s.percent / 100) }));
}

// ── Ready to Invoice (PRD §5.3) ───────────────────────────────────

export interface ReadyRow {
  id: string;
  kind: 'shipment' | 'stage';
  customer: string;
  currency: string;
  soNumber: string;
  shipmentNumber?: string;
  stage?: DueStage;
  /** Ship date, or the date the stage fell due. */
  date: string;
  valueNotBilled: number;
  waitingDays: number;
  lineCount: number;
  paymentTermId: string;
}

const dayDiff = (from: string, to: string) =>
  Math.max(0, Math.round((new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86_400_000));

export function readyToInvoiceRows(customers: Customer[], invoices: CustomerInvoice[], todayIso = localTodayIso()): ReadyRow[] {
  const map = billingByShipmentLine(invoices);
  const rows: ReadyRow[] = [];
  for (const c of customers) {
    for (const s of c.shipments) {
      if (!isInvoiceableShipment(s)) continue;
      const value = shipmentValueNotBilled(s, map);
      if (value <= EPS) continue;
      const so = c.salesOrders.find((o) => o.soNumber === s.soNumber);
      rows.push({
        id: `shp:${s.shipmentNumber}`,
        kind: 'shipment',
        customer: c.customerName,
        currency: so?.currency ?? c.currency,
        soNumber: s.soNumber,
        shipmentNumber: s.shipmentNumber,
        date: s.shipDate,
        valueNotBilled: value,
        waitingDays: dayDiff(s.shipDate, todayIso),
        lineCount: shipmentLinesToBill(s, map).length,
        paymentTermId: so?.paymentTermId ?? c.paymentTermId,
      });
    }
    for (const so of c.salesOrders) {
      for (const st of dueStagesFor(so, invoices, todayIso)) {
        rows.push({
          id: `stage:${so.soNumber}:${st.stage.index}`,
          kind: 'stage',
          customer: c.customerName,
          currency: so.currency,
          soNumber: so.soNumber,
          stage: st,
          date: st.dueOn,
          valueNotBilled: st.amount,
          waitingDays: dayDiff(st.dueOn, todayIso),
          lineCount: so.lines.length,
          paymentTermId: so.paymentTermId,
        });
      }
    }
  }
  // Oldest first, so nothing is forgotten.
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** Customers with shipped goods waiting, for the standalone reminder (PRD §9.2). */
export function shippedValueWaiting(customer: Customer, invoices: CustomerInvoice[]): { count: number; value: number } {
  const map = billingByShipmentLine(invoices);
  const waiting = customer.shipments.filter((s) => isInvoiceableShipment(s) && shipmentValueNotBilled(s, map) > EPS);
  return { count: waiting.length, value: round2(waiting.reduce((s, x) => s + shipmentValueNotBilled(x, map), 0)) };
}

/** Credit memos against an invoice, and how much is left to credit. */
export function creditMemosFor(invoiceNumber: string, invoices: CustomerInvoice[]): CustomerInvoice[] {
  return invoices.filter((i) => i.docKind === 'Credit Memo' && i.relatedInvoiceNumber === invoiceNumber && i.invoiceStatus !== 'Cancelled' && i.invoiceStatus !== 'Rejected');
}

export function creditableRemaining(inv: CustomerInvoice, invoices: CustomerInvoice[], excludeId?: string): number {
  const credited = creditMemosFor(inv.invoiceNumber, invoices)
    .filter((c) => c.id !== excludeId)
    .reduce((s, c) => s + Math.abs(c.amount), 0);
  return Math.max(0, round2(inv.amount - credited));
}

/** Per-line quantity already credited (lines basis). */
export function creditedQtyByLine(inv: CustomerInvoice, invoices: CustomerInvoice[], excludeId?: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const cm of creditMemosFor(inv.invoiceNumber, invoices)) {
    if (cm.id === excludeId) continue;
    for (const l of cm.lines) {
      if (!l.creditOfLineId) continue;
      map.set(l.creditOfLineId, (map.get(l.creditOfLineId) ?? 0) + l.invoiceQty);
    }
  }
  return map;
}
