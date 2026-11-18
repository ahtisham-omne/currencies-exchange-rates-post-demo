/**
 * Which invoice billed which receipt line.
 *
 * The app has invoices and it has vendor receipts, but nothing joins them:
 * `mockInvoices` never imports `mockVendors`, its vendors are free text, and
 * its `linkedGRNs` use a number series the vendor GRNs don't share — the same
 * gap `receiptInvoiceStatus` notes when it derives the paid share by hash.
 * A receipt line therefore knows how many of its units were billed, but not
 * by whom.
 *
 * A return has to know. Return type and reason are answered per invoice — a
 * refund settles against the document that took the money — so this module
 * gives every receipt line a stable invoice identity derived from the same
 * primitives the split already uses. The numbers are synthesised, so they
 * won't open in the Invoices module, but they hold still across reloads and
 * they reconcile exactly with `LineInvoiceSplit`: the slices of a line sum
 * back to its notInvoiced / invoicedUnpaid / paid figures.
 *
 * An invoice is billed or paid as a whole, never half of each, so the paid
 * boundary is also an invoice boundary. That is both true to life and what
 * lets one invoice carry one remedy.
 */

import { paidQtyForReceiptLine } from './receiptInvoiceStatus';

export type SliceState = 'not-invoiced' | 'unpaid' | 'paid';

/** One receipt's units in one invoice state, under one invoice. */
export interface ReceiptInvoiceSlice {
  /** Stable across renders: a receipt is only ever in one slice per invoice. */
  key: string;
  grnNumber: string;
  /** null for units received but not yet billed. */
  invoiceNumber: string | null;
  state: SliceState;
  qty: number;
}

export interface ReceiptLine {
  grnNumber: string;
  receivedQty: number;
  invoicedQty: number;
}

function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** A long-running order is billed on more than one invoice, so a line's paid
 *  or unpaid units can carry two numbers; `seq` picks which. Keyed on the PO
 *  rather than the receipt, so one invoice spans the receipts it billed. */
function invoiceNumberFor(poNumber: string, sku: string, state: SliceState, seq: number): string {
  const h = hash(`${poNumber}:${sku}:${state}:${seq}`);
  return `INV-2024-${4000 + (h % 900)}`;
}

export const SLICE_STATE_LABELS: Record<SliceState, string> = {
  'not-invoiced': 'Not invoiced',
  unpaid: 'Invoiced, unpaid',
  paid: 'Paid',
};

/** Same money-movement axis the invoice chip runs on: slate before billing,
 *  amber once billed, emerald once paid. */
export const SLICE_STATE_CHIP: Record<SliceState, string> = {
  'not-invoiced': 'bg-slate-100 border-slate-200 text-slate-600',
  unpaid: 'bg-orange-50 border-orange-200 text-orange-700',
  paid: 'bg-emerald-50 border-emerald-200 text-emerald-800',
};

/** The same axis carried through a whole card rather than just its chip, so
 *  an accrual, an open bill and a settled one are told apart at a glance
 *  before any of them is read. Slate before billing, amber once billed,
 *  emerald once paid. */
export const SLICE_STATE_ACCENT: Record<
  SliceState,
  { border: string; head: string; input: string; num: string; chip: string }
> = {
  'not-invoiced': {
    border: 'border-slate-300',
    head: 'bg-slate-50 border-slate-200',
    input: 'border-slate-300 focus-within:ring-slate-200',
    num: 'text-slate-700',
    chip: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  unpaid: {
    border: 'border-orange-200',
    head: 'bg-orange-50/60 border-orange-100',
    input: 'border-orange-300 focus-within:ring-orange-100',
    num: 'text-orange-700',
    chip: 'border-orange-200 bg-orange-50 text-orange-800',
  },
  paid: {
    border: 'border-emerald-200',
    head: 'bg-emerald-50/60 border-emerald-100',
    input: 'border-emerald-300 focus-within:ring-emerald-100',
    num: 'text-emerald-700',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
};

/** What settling under this state actually does. */
export const SLICE_STATE_HINTS: Record<SliceState, string> = {
  'not-invoiced': 'Reverses the goods-receipt accrual.',
  unpaid: 'Credits the open invoice.',
  paid: 'The vendor owes the money back.',
};

/** Break a line's receipts into (receipt x invoice) slices. Totals per state
 *  match `addReceiptLineToSplit` exactly, so this view and the aggregated
 *  split can never disagree. */
export function receiptInvoiceSlices(
  poNumber: string,
  sku: string,
  receipts: ReceiptLine[],
): ReceiptInvoiceSlice[] {
  const streams: Record<'paid' | 'unpaid', { grnNumber: string; qty: number }[]> = {
    paid: [],
    unpaid: [],
  };
  const uninvoiced: { grnNumber: string; qty: number }[] = [];

  for (const r of receipts) {
    const paid = paidQtyForReceiptLine(
      r.grnNumber,
      sku,
      Math.min(r.invoicedQty, r.receivedQty),
      r.receivedQty,
    );
    // Numbered stock is billed for everything it carries, so what was paid is
    // invoiced by definition and nothing of it reads as never billed.
    const invoiced = Math.max(Math.min(r.invoicedQty, r.receivedQty), paid);
    const unpaid = invoiced - paid;
    const none = r.receivedQty - invoiced;
    if (none > 0.004) uninvoiced.push({ grnNumber: r.grnNumber, qty: none });
    if (paid > 0.004) streams.paid.push({ grnNumber: r.grnNumber, qty: paid });
    if (unpaid > 0.004) streams.unpaid.push({ grnNumber: r.grnNumber, qty: unpaid });
  }

  const out: ReceiptInvoiceSlice[] = [];
  // Not invoiced leads, the order the buckets have always run in.
  for (const row of uninvoiced) {
    out.push({
      key: `${row.grnNumber}:none`,
      grnNumber: row.grnNumber,
      invoiceNumber: null,
      state: 'not-invoiced',
      qty: row.qty,
    });
  }

  const used = new Set<string>();
  for (const state of ['unpaid', 'paid'] as const) {
    const rows = streams[state];
    if (rows.length === 0) continue;
    // Three or more receipts read as an order billed twice; fewer as one bill.
    const invoiceCount = rows.length > 2 ? 2 : 1;
    rows.forEach((row, i) => {
      const seq = invoiceCount === 1 ? 0 : Math.floor((i * invoiceCount) / rows.length);
      let invoiceNumber = invoiceNumberFor(poNumber, sku, state, seq);
      // Two states hashing to one number would put a paid and an unpaid slice
      // under a single invoice, which cannot happen in life.
      let bump = 0;
      while (used.has(`${invoiceNumber}:${state === 'paid' ? 'unpaid' : 'paid'}`)) {
        bump += 1;
        invoiceNumber = invoiceNumberFor(poNumber, sku, state, seq + bump * 7);
      }
      used.add(`${invoiceNumber}:${state}`);
      out.push({
        key: `${row.grnNumber}:${invoiceNumber}`,
        grnNumber: row.grnNumber,
        invoiceNumber,
        state,
        qty: row.qty,
      });
    });
  }
  return out;
}
