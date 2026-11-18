/**
 * How much of a received line has been invoiced, and how much of that has been
 * paid. A receipt of 9 can be invoiced 4 and left 5 open, so the answer is a
 * quantity split rather than a single state.
 *
 * `invoicedQty` is carried on the receipt line itself. The paid share is not
 * modelled anywhere — invoice headers link receipts by a number series that
 * doesn't match the vendor GRNs — so it is derived from the receipt and SKU,
 * which keeps a line reading the same on every reload.
 */

import { mockVendors } from './mockVendors';
import { hasSerials, trackingModeFor } from './itemTracking';

export interface LineInvoiceSplit {
  received: number;
  notInvoiced: number;
  invoicedUnpaid: number;
  paid: number;
}

export type LineInvoiceState =
  | 'none'
  | 'not-invoiced'
  | 'invoiced'
  | 'paid'
  | 'partly-invoiced'
  | 'partly-paid';

function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** Paid slice of one receipt line's invoiced quantity. Every fourth line is
 *  left wholly unpaid so the "invoiced but not settled" state is reachable. */
export function paidQtyForReceiptLine(
  grnNumber: string,
  sku: string,
  invoicedQty: number,
  /** What the line carries. Numbered stock is billed and settled for all of
   *  it, whatever invoice state the receipt was generated in, so the figure
   *  is read from the line rather than from a status. */
  receivedQty?: number,
): number {
  // Numbered stock is settled in full, so a return of it always has money
  // behind it and always reaches the credit-or-refund step. The quarter of
  // lines left unpaid below is the counted book's business.
  if (hasSerials(trackingModeFor(sku))) return Math.max(invoicedQty, receivedQty ?? 0);
  if (invoicedQty <= 0) return 0;
  // Counted stock, in five bands: one unpaid, one settled in full, and three
  // part paid at a quarter, a half and three quarters. Part paid is the
  // ordinary case on this kind of stock, and it is the one the settlement step
  // has the most to say about -- the paid share comes back as money, the rest
  // unwinds against the invoice that is still open.
  const h = hash(`${grnNumber}:${sku}`);
  const band = h % 5;
  if (band === 0) return 0;
  if (band === 1) return invoicedQty;
  return Math.max(1, Math.round((invoicedQty * (band - 1)) / 4));
  // Note: a vendor whose every delivery of a part lands in band 0 holds a
  // part with nothing paid on it, which the settlement step has nothing to
  // ask about. `paidFromReceipts` reads their whole history rather than the
  // newest documents, so that takes all five bands into account.
}

export function emptySplit(): LineInvoiceSplit {
  return { received: 0, notInvoiced: 0, invoicedUnpaid: 0, paid: 0 };
}

export function addReceiptLineToSplit(
  split: LineInvoiceSplit,
  grnNumber: string,
  sku: string,
  receivedQty: number,
  invoicedQty: number,
): void {
  const paid = paidQtyForReceiptLine(grnNumber, sku, Math.min(invoicedQty, receivedQty), receivedQty);
  // Paid cannot exceed invoiced, so numbered stock counts as invoiced for
  // everything it was paid for rather than leaving the rest reading as never
  // billed.
  const invoiced = Math.max(Math.min(invoicedQty, receivedQty), paid);
  split.received += receivedQty;
  split.notInvoiced += receivedQty - invoiced;
  split.invoicedUnpaid += invoiced - paid;
  split.paid += paid;
}

export function lineInvoiceState(split: LineInvoiceSplit): LineInvoiceState {
  if (split.received <= 0) return 'none';
  if (split.notInvoiced === split.received) return 'not-invoiced';
  if (split.paid === split.received) return 'paid';
  if (split.invoicedUnpaid === split.received) return 'invoiced';
  return split.paid > 0 ? 'partly-paid' : 'partly-invoiced';
}

/** Split for one RMA line, read back off the receipts it was raised against.
 *  The return quotes its own received quantity, so the receipt totals are
 *  scaled to it and the row and the tooltip cannot disagree. */
export function invoiceSplitForRMALine(
  vendorName: string,
  receivingNumbers: string[] | undefined,
  originId: string,
  sku: string,
  receivedQty: number,
): LineInvoiceSplit | undefined {
  if (receivedQty <= 0) return undefined;
  const vendor = mockVendors.find((v) => v.vendorName === vendorName);
  if (!vendor) return undefined;

  const carriesSku = (g: { items: { sku: string }[] }) => g.items.some((i) => i.sku === sku);
  const named = new Set(receivingNumbers ?? []);
  // Narrowest set of receipts that actually carries the item: the ones this
  // return names, else the origin's, else any of the vendor's.
  let docs = vendor.receivingDocuments.filter((g) => named.has(g.grnNumber) && carriesSku(g));
  if (docs.length === 0) docs = vendor.receivingDocuments.filter((g) => g.originId === originId && carriesSku(g));
  if (docs.length === 0) docs = vendor.receivingDocuments.filter(carriesSku);

  const split = emptySplit();
  for (const grn of docs) {
    for (const item of grn.items) {
      if (item.sku !== sku) continue;
      addReceiptLineToSplit(split, grn.grnNumber, sku, item.quantity, item.invoicedQty ?? 0);
    }
  }
  if (split.received <= 0) return undefined;
  if (split.received === receivedQty) return split;

  const factor = receivedQty / split.received;
  const notInvoiced = Math.min(receivedQty, Math.round(split.notInvoiced * factor));
  const paid = Math.min(receivedQty - notInvoiced, Math.round(split.paid * factor));
  return {
    received: receivedQty,
    notInvoiced,
    paid,
    invoicedUnpaid: receivedQty - notInvoiced - paid,
  };
}

/** Payment-axis vocabulary, matching the Payment Status column in vendor
 *  invoicing. A part-billed line and a fully billed line both read Unpaid,
 *  since neither has money against it; the chip's tooltip carries the
 *  quantity split for anyone who needs the difference. */
export const LINE_INVOICE_LABELS: Record<Exclude<LineInvoiceState, 'none'>, string> = {
  'not-invoiced': 'Not invoiced',
  invoiced: 'Unpaid',
  paid: 'Paid in full',
  'partly-invoiced': 'Unpaid',
  'partly-paid': 'Partially paid',
};
