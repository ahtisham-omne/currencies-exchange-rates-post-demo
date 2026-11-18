/**
 * Every transaction that touches a return, for its Linked Records tab.
 *
 * Eli's rule: Linked Records is the one place to find everything related to
 * this RMA, not a GL summary. So it is not just the order and the receipt it
 * came in on. A line that says partially paid has a vendor invoice and a
 * payment behind it, and both have to be findable here; a return that has
 * shipped has a picking list and a shipping document; a return that has
 * settled has the reversal, the vendor credit, and the refund if one came
 * back.
 *
 * The list grows with the lifecycle. A draft shows what the goods came in on
 * and what was billed against it; everything else joins as it happens, which
 * is why each record carries the date of the event that created it.
 *
 * And where there is nothing to link, that is itself a state. Stock counted
 * in at a stocktake or carried over from a migration has no order and no
 * receipt behind it, so no invoice and no payment can exist either. The tab
 * says so rather than showing an empty list that reads as a loading bug.
 */

import { PINNED_CREATORS, TEAM_ROSTER } from './mockInvoices';
import type { RMA, RMALineItem } from './mockRMAs';
import { authorizedQty } from './mockRMAs';
import { receiptInvoiceSlices, type ReceiptLine } from './receiptInvoices';
import { mockVendors } from './mockVendors';
import { receiversFor } from './itemProvenance';
import type { LinkedFinancialRecord } from './invoiceLinkedRecords';

const round2 = (n: number) => Math.round(n * 100) / 100;

function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** Shift an ISO date by whole days, keeping the ISO shape. */
function shift(iso: string | undefined, days: number): string {
  const base = iso ? new Date(iso) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString().split('T')[0]!;
}

/** The receipts behind one return line, with what each of them was billed.
 *
 *  An RMA line records which documents its credit unwinds; how much of each
 *  was invoiced lives on the receipt itself, so the two are read together.
 *  Without the invoiced figure there is no way to know which invoice covers
 *  the units, and the whole chain below the receipt goes missing. */
function receiptsForLine(rma: RMA, li: RMALineItem): ReceiptLine[] {
  const tied = (li.ties ?? []).length > 0
    ? (li.ties ?? []).map((t) => ({ grnNumber: t.grnNumber, qty: t.qty }))
    : (rma.receivingNumbers ?? []).map((grnNumber) => ({ grnNumber, qty: authorizedQty(li) }));
  const out: ReceiptLine[] = [];
  tied.forEach(({ grnNumber, qty }) => {
    for (const v of mockVendors) {
      const grn = v.receivingDocuments.find((g) => g.grnNumber === grnNumber);
      if (!grn) continue;
      const item = grn.items.find((i) => i.sku === li.sku);
      if (!item) return;
      const received = Math.min(qty || item.quantity, item.quantity);
      const invoiced = Math.min(item.invoicedQty ?? 0, item.quantity);
      out.push({
        grnNumber,
        receivedQty: received,
        // The receipt's own billed share, scaled to what this return takes
        // off it: half a receipt coming back cannot carry the whole bill.
        invoicedQty: Math.round(invoiced * (received / Math.max(1, item.quantity)) * 100) / 100,
      });
      return;
    }
  });
  return out;
}

/** What the return is worth at the price the goods were bought at. */
function returnValue(rma: RMA): number {
  return round2(
    rma.items.reduce((s, li) => s + authorizedQty(li) * (li.originalUnitPrice ?? li.unitPrice), 0),
  );
}

/**
 * Every record this return can point at, newest kind last.
 *
 * The order is the order things happen in: the order and the receipt, what
 * was billed and paid for them, then what this return has raised since.
 */
export function getRMALinkedRecords(rma: RMA): LinkedFinancialRecord[] {
  const out: LinkedFinancialRecord[] = [];
  /** The return's own owner, for the documents the return itself raises. */
  const by = rma.owner ?? rma.createdBy;
  /** Who raised one of the documents upstream of it.
   *
   *  A buyer places the order, a clerk books the receipt, AP pays the bill:
   *  putting the return's owner on all of them said one person did the lot.
   *  Hashed off the reference so the same document always names the same
   *  person, and drawn from the team first. */
  const raisedBy = (reference: string): string => {
    const roster = [...PINNED_CREATORS, ...TEAM_ROSTER];
    return roster[hash(reference) % roster.length]!;
  };
  const value = returnValue(rma);
  /** The parts on this return, as the rows name them. */
  const allItems = rma.items.map((li) => ({
    sku: li.sku,
    description: li.description,
    unitPrice: li.unitPrice,
    uom: li.uom,
  }));
  /** The parts that came in on one receiving document, which is what makes a
   *  receipt row answerable on a return with seventeen lines. */
  const itemsOnReceipt = (grn: string) =>
    rma.items
      .filter((li) => receiptsForLine(rma, li).some((r) => r.grnNumber === grn))
      .map((li) => ({
        sku: li.sku,
        description: li.description,
        unitPrice: li.unitPrice,
        uom: li.uom,
      }));

  // ── What the goods came in on ──────────────────────────────────────
  //
  // The orders the return names, plus the orders its own receipts turn out to
  // belong to. Listing only the first left the two sections of this tab
  // contradicting each other: Purchase Orders said PO-11413 while every
  // receipt under it said "Goods received against PO-11409".
  const declaredPOs = [...new Set(rma.sourcePOs ?? [rma.sourcePO])].filter(Boolean);
  const receiptNumbers = [...new Set(rma.receivingNumbers ?? [])];
  const vendorRecord = mockVendors.find((v) => v.vendorName === rma.vendor);
  const poOnReceipt = (grn: string): string | undefined => {
    const doc = vendorRecord?.receivingDocuments.find((g) => g.grnNumber === grn);
    if (doc?.poNumber) return doc.poNumber;
    const tail = grn.split('-')[2];
    if (tail && declaredPOs.includes(tail)) return tail;
    return declaredPOs.length === 1 ? declaredPOs[0] : undefined;
  };
  const pos = [
    ...new Set([
      ...declaredPOs,
      ...receiptNumbers.map(poOnReceipt).filter((po): po is string => !!po),
    ]),
  ];
  pos.forEach((po, i) => {
    out.push({
      id: `rma-po-${i}`,
      type: 'Purchase Order',
      reference: po.startsWith('PO-') ? po : `PO-${po}`,
      description: 'The order these goods were bought on',
      status: 'Billed',
      date: shift(rma.createdDate, -45 - i * 7),
      amount: round2(value * (1.4 + (i % 3) * 0.2)),
      items: allItems,
      createdBy: raisedBy(po),
      updatedBy: raisedBy(`${po}:updated`),
    });
  });

  const receipts = receiptNumbers;
  /** The receiving document itself, where the vendor holds one. A receipt has
   *  its own order, its own date and its own value, and reading them off the
   *  return instead put every receipt against the first PO on the record and
   *  dated them all backwards from the day the return was raised. A receipt
   *  the user tied to a June delivery on order 11409 then printed as a
   *  September one on 11403. */
  const receiptRecord = (grn: string) =>
    vendorRecord?.receivingDocuments.find((g) => g.grnNumber === grn);
  /** Which order a receipt belongs to. The document says so where one
   *  exists; a receipt the seed stamped against a PO with none of its own
   *  carries that order in its number, as `Rec-1403-11215`. Falling straight
   *  through to the first PO on the return is what put five receipts from
   *  three different orders all under the same one. */
  const poForReceipt = poOnReceipt;
  receipts.forEach((grn, i) => {
    const doc = receiptRecord(grn);
    const onIt = itemsOnReceipt(grn);
    const po = poForReceipt(grn);
    // What the delivery was worth. The document's own lines where there is a
    // document; otherwise the value this return is unwinding off it, which is
    // the only figure there is. An empty cell read as a stray comma.
    const worth = doc
      ? round2(doc.items.reduce((sum, it) => sum + it.quantity * (it.unitPrice ?? 0), 0))
      : round2(
          rma.items
            .filter((li) => receiptsForLine(rma, li).some((r) => r.grnNumber === grn))
            .reduce((sum, li) => sum + authorizedQty(li) * li.unitPrice, 0),
        );
    out.push({
      id: `rma-grn-${i}`,
      type: 'Receiving Document',
      reference: grn,
      description: po ? `Goods received against PO-${po}` : 'Goods received',
      status: 'Received',
      date: doc?.grnDate ?? shift(rma.createdDate, -20 - i * 5),
      amount: worth,
      items: onIt,
      createdBy: raisedBy(grn),
      updatedBy: raisedBy(`${grn}:updated`),
    });
  });

  // ── What was billed and paid for them ──────────────────────────────
  //
  // Read off the same slices the line's own invoice chip reads, so a line
  // that says "partially paid" has exactly these documents behind it.
  const invoices = new Map<
    string,
    {
      qty: number;
      paid: boolean;
      items: { sku: string; description: string; unitPrice?: number; uom?: string }[];
    }
  >();
  rma.items.forEach((li) => {
    const lineReceipts = receiptsForLine(rma, li);
    if (lineReceipts.length === 0) return;
    receiptInvoiceSlices(rma.sourcePO, li.sku, lineReceipts).forEach((slice) => {
      if (!slice.invoiceNumber) return;
      const at = invoices.get(slice.invoiceNumber) ?? { qty: 0, paid: false, items: [] };
      at.qty = round2(at.qty + slice.qty);
      at.paid = at.paid || slice.state === 'paid';
      if (!at.items.some((i) => i.sku === li.sku)) {
        at.items.push({
          sku: li.sku,
          description: li.description,
          unitPrice: li.unitPrice,
          uom: li.uom,
        });
      }
      invoices.set(slice.invoiceNumber, at);
    });
  });

  [...invoices.entries()].forEach(([number, held], i) => {
    const amount = round2(held.qty * (value / Math.max(1, rma.items.length) / 10 + 40));
    out.push({
      id: `rma-inv-${i}`,
      type: 'Vendor Invoice',
      reference: number,
      description: held.paid
        ? 'Vendor invoice covering these goods, paid'
        : 'Vendor invoice covering these goods, still open',
      status: held.paid ? 'Paid' : 'Open',
      date: shift(rma.createdDate, -14 - i * 3),
      amount,
      items: held.items,
      createdBy: raisedBy(number),
      updatedBy: raisedBy(`${number}:updated`),
    });
    if (!held.paid) return;
    // The payment that settled it. This is the record that makes a return of
    // paid goods answerable: without it, "partially paid" is a chip with
    // nothing behind it.
    out.push({
      id: `rma-pay-${i}`,
      type: 'Payment',
      reference: `PAY-${10000 + (hash(number) % 9000)}`,
      description: `Payment against ${number}`,
      status: 'Applied',
      date: shift(rma.createdDate, -7 - i * 2),
      amount,
      items: held.items,
      createdBy: raisedBy(`${number}:paid`),
      updatedBy: raisedBy(`${number}:paid`),
    });
  });

  // ── What this return has raised since ──────────────────────────────
  if (rma.shippedDate) {
    out.push({
      id: 'rma-pick',
      type: 'Picking Document',
      reference: `PICK-${rma.rmaNumber.replace('RMA-', '')}`,
      description: 'Units pulled from stock for this return',
      status: 'Picked',
      date: shift(rma.shippedDate, -1),
      amount: 0,
      items: allItems,
      createdBy: by,
      updatedBy: by,
    });
    (rma.returnLegs ?? []).forEach((leg, i) => {
      out.push({
        id: `rma-ship-${i}`,
        type: 'Shipping Document',
        reference: `SHP-${rma.rmaNumber.replace('RMA-', '')}${
          (rma.returnLegs ?? []).length > 1 ? `-${i + 1}` : ''
        }`,
        description: `${leg.carrier || rma.carrier || 'Carrier'} to ${leg.shipTo || rma.returnShipTo || 'the vendor'}`,
        status: 'Shipped',
        date: rma.shippedDate!,
        amount: 0,
      items: allItems,
        createdBy: by,
        updatedBy: by,
      });
    });
  }

  if (rma.settledDate || rma.refusedDate) {
    out.push({
      id: 'rma-reversal',
      type: 'Reversal',
      reference: `JE-${rma.rmaNumber.replace('RMA-', '')}`,
      description: rma.refusedDate
        ? 'Journal clearing Other Receivables – Vendor Returns to the write-off'
        : 'Journal clearing Other Receivables – Vendor Returns',
      status: 'Posted',
      date: (rma.refusedDate ?? rma.settledDate)!,
      amount: value,
      items: allItems,
      createdBy: by,
      updatedBy: by,
    });
  }

  if (rma.creditNoteRef || rma.creditAmountReceived !== undefined) {
    out.push({
      id: 'rma-credit',
      type: 'Credit Memo',
      reference: rma.creditNoteRef ?? `CN-${rma.rmaNumber.replace('RMA-', '')}`,
      description: 'Vendor credit raised against this return',
      status: 'Applied',
      date: rma.settledDate ?? rma.receivedDate ?? rma.createdDate,
      amount: round2(rma.creditAmountReceived ?? value),
      items: allItems,
      createdBy: by,
      updatedBy: by,
    });
  }

  // The credit a credit return raised when it closed (DQ-01). Accounting
  // confirms it in partner credits against the vendor's memo; until then it
  // is linked here as pending, so the return points at where it went.
  if (rma.pendingCredit && !rma.creditNoteRef) {
    out.push({
      id: 'rma-pending-credit',
      type: 'Credit Memo',
      reference: rma.pendingCredit.ref,
      description: 'Vendor credit raised on shipment, waiting for accounting to confirm it against the vendor\'s memo',
      status: 'Pending confirmation',
      date: rma.pendingCredit.raisedDate,
      amount: rma.pendingCredit.amount,
      items: allItems,
      createdBy: by,
      updatedBy: by,
    });
  }

  if (rma.cashRefundedDate && rma.creditTerms?.refundOrCredit === 'Refund') {
    out.push({
      id: 'rma-refund',
      type: 'Payment',
      reference: `RFD-${10000 + (hash(rma.rmaNumber) % 9000)}`,
      description: 'Refund received from the vendor',
      status: 'Applied',
      date: rma.cashRefundedDate,
      amount: round2(rma.creditAmountReceived ?? value),
      items: allItems,
      createdBy: by,
      updatedBy: by,
    });
  }

  // ── Stock with nothing behind it ───────────────────────────────────
  //
  // One row per part that arrived without an order or a receipt. It is not an
  // absence to be hidden: it is the reason no invoice and no payment will
  // ever appear for those units, and somebody reconciling this return needs
  // to be told that rather than left to wonder.
  rma.items
    .filter(
      (li) =>
        (li.ties ?? []).length === 0 &&
        receiversFor(li.sku, rma.vendorCode ?? '').length === 0,
    )
    .forEach((li, i) => {
      out.push({
        id: `rma-unlinked-${i}`,
        type: 'Unlinked',
        reference: li.sku,
        description: 'No order or receipt behind these units',
        status: 'Not linked',
        date: rma.createdDate,
        amount: round2(authorizedQty(li) * (li.originalUnitPrice ?? li.unitPrice)),
        items: [
          {
            sku: li.sku,
            description: li.description,
            unitPrice: li.unitPrice,
            uom: li.uom,
          },
        ],
        createdBy: by,
        updatedBy: by,
      });
    });

  return out;
}
