/**
 * Who a return goes back to.
 *
 * The old flow asked for a vendor up front and then worked out what could be
 * sent. For anything named that is backwards: a serialized unit arrived on a
 * receiver, the receiver belongs to a delivery, and the delivery names the
 * vendor and the order. Picking the unit has already answered the question, so
 * the answer is stated and locked rather than asked.
 *
 * Plain stock has no such thread. One washer is any washer, so the only honest
 * thing to do is ask -- but bounded: the choice is limited to vendors that
 * actually shipped the part, and each of them can only take back as much as
 * they sent. A return of 245 against a vendor that shipped 200 is not a
 * validation error to raise at save time, it is a fact the screen has to say
 * out loud while the number is being typed.
 */

import { availableSerials } from './mockRMAs';
import { mockVendors } from './mockVendors';

/** The delivery a receiver belongs to, and so the vendor behind it. */
export interface GRNOrigin {
  vendorCode: string;
  vendorName: string;
  poNumber: string;
  grnDate: string;
}

let grnIndex: Map<string, GRNOrigin> | null = null;

/** Every receiver in the system, keyed by its number. Built once: the lookup
 *  runs per serial, and rebuilding it each time turns a unit picker into a
 *  full scan of forty vendors. */
function grnOrigins(): Map<string, GRNOrigin> {
  if (grnIndex) return grnIndex;
  const map = new Map<string, GRNOrigin>();
  mockVendors.forEach((vendor) => {
    vendor.receivingDocuments.forEach((grn) => {
      map.set(grn.grnNumber, {
        vendorCode: vendor.vendorCode,
        vendorName: vendor.vendorName,
        poNumber: grn.poNumber,
        grnDate: grn.grnDate,
      });
    });
  });
  grnIndex = map;
  return map;
}

export function vendorForGRN(grnNumber: string): GRNOrigin | null {
  return grnOrigins().get(grnNumber) ?? null;
}

/** One vendor's share of a line, and the paperwork behind it. */
export interface VendorSlice {
  vendorCode: string;
  vendorName: string;
  qty: number;
  grnNumbers: string[];
  poNumbers: string[];
}

/** A receiver's contribution to a line, in the order the line was built. */
export interface LineReceipt {
  grnNumber: string;
  receivedQty: number;
}

/**
 * The vendors behind a set of named units.
 *
 * A line's serial pool is one flat list, generated from the line and its
 * received quantity. The receivers that make up the line are laid against that
 * list in order, so the first receiver owns the first however-many units, the
 * next owns the ones after that, and every serial therefore sits inside
 * exactly one delivery. That is what makes a picked unit resolve to a vendor
 * without anyone being asked.
 */
/**
 * The units on this line that came back through one vendor.
 *
 * The inverse of `resolveFromSerials`: the pool is laid out receipt by receipt,
 * so a vendor owns a contiguous run of it for every receipt of theirs the line
 * carries. Naming which of *their* units are going back is a different question
 * from how many, and a picker scoped to one vendor is the only way to ask it
 * without offering somebody else's units as an answer.
 */
export function serialPoolForVendor(
  pool: string[],
  receipts: LineReceipt[],
  vendorCode: string,
): string[] {
  const out: string[] = [];
  let cursor = 0;
  receipts.forEach((r) => {
    const size = Math.max(0, Math.round(r.receivedQty));
    const origin = vendorForGRN(r.grnNumber);
    if (origin?.vendorCode === vendorCode) out.push(...pool.slice(cursor, cursor + size));
    cursor += size;
  });
  return out;
}

export function resolveFromSerials(
  sku: string,
  lineId: string,
  receivedQty: number,
  receipts: LineReceipt[],
  serials: string[],
): VendorSlice[] {
  if (serials.length === 0) return [];
  const pool = availableSerials(sku, lineId, receivedQty);
  const positionOf = new Map(pool.map((serial, i) => [serial, i]));

  // Where each receiver starts and stops in the pool.
  const spans: { grnNumber: string; from: number; to: number }[] = [];
  let cursor = 0;
  receipts.forEach((r) => {
    const size = Math.max(0, Math.round(r.receivedQty));
    spans.push({ grnNumber: r.grnNumber, from: cursor, to: cursor + size });
    cursor += size;
  });

  const byVendor = new Map<string, VendorSlice>();
  serials.forEach((serial) => {
    const at = positionOf.get(serial);
    if (at === undefined) return;
    const span = spans.find((s) => at >= s.from && at < s.to);
    if (!span) return;
    const origin = vendorForGRN(span.grnNumber);
    if (!origin) return;
    const entry = byVendor.get(origin.vendorCode) ?? {
      vendorCode: origin.vendorCode,
      vendorName: origin.vendorName,
      qty: 0,
      grnNumbers: [],
      poNumbers: [],
    };
    entry.qty += 1;
    if (!entry.grnNumbers.includes(span.grnNumber)) entry.grnNumbers.push(span.grnNumber);
    if (!entry.poNumbers.includes(origin.poNumber)) entry.poNumbers.push(origin.poNumber);
    byVendor.set(origin.vendorCode, entry);
  });

  return [...byVendor.values()].sort((a, b) => b.qty - a.qty);
}

/** Where each named unit actually came from.
 *
 *  `resolveFromSerials` folds this down to one row per vendor, which is what
 *  the vendor question needs. The second step asks a different one: a
 *  serialized return is not choosing a vendor at all, it is choosing units,
 *  and the vendor and the receiving document are what the choice reports back.
 *  So the same walk is exposed unfolded, one row per serial. */
export interface SerialOrigin {
  serial: string;
  grnNumber: string;
  poNumber: string;
  vendorCode: string;
  vendorName: string;
  /** When that delivery landed. Joined on by the caller, which is the only
   *  place the receiver's own record is to hand. */
  date?: string;
}

export function serialOrigins(
  sku: string,
  lineId: string,
  receivedQty: number,
  receipts: LineReceipt[],
  serials: string[],
): SerialOrigin[] {
  if (serials.length === 0) return [];
  const pool = availableSerials(sku, lineId, receivedQty);
  const positionOf = new Map(pool.map((serial, i) => [serial, i]));

  const spans: { grnNumber: string; from: number; to: number }[] = [];
  let cursor = 0;
  receipts.forEach((r) => {
    const size = Math.max(0, Math.round(r.receivedQty));
    spans.push({ grnNumber: r.grnNumber, from: cursor, to: cursor + size });
    cursor += size;
  });

  return serials.flatMap((serial) => {
    const at = positionOf.get(serial);
    if (at === undefined) return [];
    const span = spans.find((sp) => at >= sp.from && at < sp.to);
    if (!span) return [];
    const origin = vendorForGRN(span.grnNumber);
    if (!origin) return [];
    return [{
      serial,
      grnNumber: span.grnNumber,
      poNumber: origin.poNumber,
      vendorCode: origin.vendorCode,
      vendorName: origin.vendorName,
    }];
  });
}

/** The same reading for a line whose units are not named: the receivers it was
 *  built from, grouped by whoever shipped them. Used to state the vendor on a
 *  line that came in through a single vendor's paperwork, where there is
 *  nothing to ask either. */
export function resolveFromReceipts(receipts: LineReceipt[]): VendorSlice[] {
  const byVendor = new Map<string, VendorSlice>();
  receipts.forEach((r) => {
    const origin = vendorForGRN(r.grnNumber);
    if (!origin) return;
    const entry = byVendor.get(origin.vendorCode) ?? {
      vendorCode: origin.vendorCode,
      vendorName: origin.vendorName,
      qty: 0,
      grnNumbers: [],
      poNumbers: [],
    };
    entry.qty += r.receivedQty;
    if (!entry.grnNumbers.includes(r.grnNumber)) entry.grnNumbers.push(r.grnNumber);
    if (!entry.poNumbers.includes(origin.poNumber)) entry.poNumbers.push(origin.poNumber);
    byVendor.set(origin.vendorCode, entry);
  });
  return [...byVendor.values()].sort((a, b) => b.qty - a.qty);
}
