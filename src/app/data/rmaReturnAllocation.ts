/**
 * Splitting a return quantity across the invoice states of the goods.
 *
 * A receipt of 60 can be 36 not invoiced, 6 invoiced and unpaid, and 18 paid.
 * Sending all 60 back is three different settlements: an accrual reversal, a
 * credit note against an open invoice, and cash the vendor owes. The line
 * carries one Return Qty, so the split says how that quantity lands in each
 * bucket and each bucket carries its own return type.
 */

import type { ReturnReason, ReturnType } from './mockRMAs';
import type { LineInvoiceSplit } from './receiptInvoiceStatus';
import { defaultReturnType, returnTypeOptions, type ReturnTypeOption } from './rmaReturnTypeRules';

export type ReturnBucket = 'notInvoiced' | 'invoicedUnpaid' | 'paid';

export type ReturnAllocation = Record<ReturnBucket, number>;

export const RETURN_BUCKETS: ReturnBucket[] = ['notInvoiced', 'invoicedUnpaid', 'paid'];

export const BUCKET_LABELS: Record<ReturnBucket, string> = {
  notInvoiced: 'Not invoiced',
  invoicedUnpaid: 'Invoiced, unpaid',
  paid: 'Paid',
};

/** Same money-movement axis the line's invoice chip runs on: slate while
 *  nothing has been billed, amber once it has, emerald once it has been paid. */
export const BUCKET_CHIP: Record<ReturnBucket, string> = {
  notInvoiced: 'bg-slate-100 border-slate-200 text-slate-600',
  invoicedUnpaid: 'bg-orange-50 border-orange-200 text-orange-700',
  paid: 'bg-emerald-50 border-emerald-200 text-emerald-800',
};

/** What settling that bucket actually does, shown beside the quantity. */
export const BUCKET_HINTS: Record<ReturnBucket, string> = {
  notInvoiced: 'Reverses the goods-receipt accrual.',
  invoicedUnpaid: 'Credits the open invoice.',
  paid: 'The vendor owes the money back.',
};

export function emptyAllocation(): ReturnAllocation {
  return { notInvoiced: 0, invoicedUnpaid: 0, paid: 0 };
}

export function allocationTotal(a: ReturnAllocation): number {
  return a.notInvoiced + a.invoicedUnpaid + a.paid;
}

/** A line only needs the allocation editor when the goods sit in more than one
 *  invoice state; anything else has a single settlement and nothing to split. */
export function bucketCount(split: LineInvoiceSplit | undefined): number {
  if (!split) return 0;
  return RETURN_BUCKETS.filter((b) => split[b] > 0.004).length;
}

/**
 * Opening split for a return quantity. Cheapest to settle first: unbilled
 * goods just undo an accrual, an open invoice can still be credited, and only
 * what is left reaches into money already paid out.
 */
export function autoAllocate(qty: number, split: LineInvoiceSplit | undefined): ReturnAllocation {
  const out = emptyAllocation();
  if (!split) return out;
  let left = Math.max(0, qty);
  for (const bucket of RETURN_BUCKETS) {
    const take = Math.min(left, split[bucket]);
    out[bucket] = take;
    left -= take;
  }
  return out;
}

/** The bucket seen on its own, so the existing return-type rules can judge it
 *  without knowing anything about buckets. */
export function splitForBucket(bucket: ReturnBucket, qty: number): LineInvoiceSplit {
  const split: LineInvoiceSplit = { received: qty, notInvoiced: 0, invoicedUnpaid: 0, paid: 0 };
  split[bucket] = qty;
  return split;
}

export function bucketReturnTypeOptions(
  bucket: ReturnBucket,
  reason: ReturnReason,
  qty: number,
): ReturnTypeOption[] {
  return returnTypeOptions(reason, splitForBucket(bucket, qty));
}

export function bucketDefaultReturnType(
  bucket: ReturnBucket,
  reason: ReturnReason,
  qty: number,
): ReturnType | null {
  return defaultReturnType(reason, splitForBucket(bucket, qty));
}
