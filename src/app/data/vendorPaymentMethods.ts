import { paymentMethodsForVendor } from './mockVendors';
import { PAYMENT_METHODS } from './mockPayments';
import { paymentMethodInfo } from './paymentMethodCatalog';

/* ─── Vendor saved payment methods ──────────────────────────────────────────
 *
 * Mirrors the Partners → Payment Methods tab: a vendor keeps one or more SAVED
 * methods on file, each a concrete instance (this Chase ACH, that Amex card),
 * and a single one is flagged primary. A vendor can hold several of the same
 * type (e.g. two ACH accounts), so the Record-payment picker shows each as its
 * own card with its own bank / account / routing detail — not just the type.
 *
 * Instances are synthesized deterministically per vendor (stable across
 * reloads) on top of `paymentMethodsForVendor` (which decides the accepted
 * types + the primary type), so the type set stays consistent with the rest of
 * the app while gaining real per-account detail. */

export interface VendorPaymentMethod {
  id: string;
  /** Method type — matches PAYMENT_METHODS values (ACH / Wire / Card / …). */
  type: string;
  /** Saved-method nickname shown as the card title. */
  nickname: string;
  isPrimary: boolean;
  // Bank (ACH / Wire / Bank Transfer)
  bankName?: string;
  accountTitle?: string;
  accountMask?: string; // last 4
  routingMask?: string; // last 3
  swiftMask?: string;
  accountType?: string; // Checking / Savings
  // Card
  cardNetwork?: string;
  cardholderName?: string;
  cardMask?: string; // last 4
  expiry?: string; // MM/YY
  // Check
  payeeName?: string;
  mailingCity?: string;
  // Cash
  recipientName?: string;
  collectionPoint?: string;
}

const BANKS = ['Chase Bank', 'Bank of America', 'Wells Fargo', 'Citibank', 'PNC Bank', 'U.S. Bank'];
const CARD_NETWORKS = ['Visa', 'Mastercard', 'Amex'];
const CITIES = ['New York, NY', 'Chicago, IL', 'Dallas, TX', 'Atlanta, GA', 'Seattle, WA', 'Denver, CO'];
const ACCT_TYPES = ['Checking', 'Savings'];
const COLLECTION = ['Front office', 'Finance desk', 'Reception', 'Mailroom'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
  return Math.abs(h);
}
const last4 = (n: number) => String(1000 + (n % 9000));
const last3 = (n: number) => String(100 + (n % 900));

function build(type: string, vendor: string, seed: number): VendorPaymentMethod {
  const bank = BANKS[seed % BANKS.length];
  const acct = last4(seed);
  const base: VendorPaymentMethod = { id: `${type}-${seed}`.toLowerCase().replace(/\s+/g, '-'), type, nickname: type, isPrimary: false };
  switch (type) {
    case 'ACH':
      return { ...base, nickname: `${bank} ACH`, bankName: bank, accountTitle: vendor, accountMask: acct, routingMask: last3(seed * 7), accountType: ACCT_TYPES[seed % 2] };
    case 'Wire':
      return { ...base, nickname: `${bank} Wire`, bankName: bank, accountTitle: vendor, accountMask: acct, routingMask: last3(seed * 7), swiftMask: `${bank.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()}US33` };
    case 'Bank Transfer':
      return { ...base, nickname: `${bank} Transfer`, bankName: bank, accountMask: acct, accountType: ACCT_TYPES[seed % 2] };
    case 'Card': {
      const net = CARD_NETWORKS[seed % CARD_NETWORKS.length];
      return { ...base, nickname: `${net} Card`, cardNetwork: net, cardholderName: vendor, cardMask: acct, expiry: `${String(1 + (seed % 12)).padStart(2, '0')}/${27 + (seed % 3)}` };
    }
    case 'Check':
      return { ...base, nickname: 'Mailed Check', payeeName: vendor, mailingCity: CITIES[seed % CITIES.length] };
    case 'Cash':
      return { ...base, nickname: 'Cash Payout', recipientName: vendor, collectionPoint: COLLECTION[seed % COLLECTION.length] };
    default:
      return base;
  }
}

export function vendorPaymentMethods(vendorName: string): VendorPaymentMethod[] {
  const { methods, primary } = paymentMethodsForVendor(vendorName);
  const seed = hash(vendorName);
  const list: VendorPaymentMethod[] = [];
  methods.forEach((type, ti) => {
    // The primary type (and one secondary type) carry a second account on file,
    // so the picker exercises the "multiple of the same type" case.
    const count = type === primary || ti === 1 ? 2 : 1;
    for (let k = 0; k < count; k++) list.push(build(type, vendorName, seed + ti * 97 + k * 131));
  });
  const pIdx = list.findIndex((m) => m.type === primary);
  if (pIdx >= 0) list[pIdx].isPrimary = true;
  else if (list.length) list[0].isPrimary = true;
  return list;
}

/** Fallback for multi-vendor batches (no single vendor's saved methods): one
 *  generic instance per supported type, type-only (no account detail). */
export function genericPaymentMethods(): VendorPaymentMethod[] {
  return PAYMENT_METHODS.filter((m) => m.value !== 'Other').map((m, i) => ({
    id: `generic-${m.value}`.toLowerCase().replace(/\s+/g, '-'),
    type: m.value,
    nickname: paymentMethodInfo(m.value).label,
    isPrimary: i === 0,
  }));
}

/** One-line identity for the field trigger, e.g. "Chase Bank ••••4501". */
export function methodSummary(m: VendorPaymentMethod): string {
  if (m.bankName) return `${m.bankName}${m.accountMask ? ` ••••${m.accountMask}` : ''}`;
  if (m.cardNetwork) return `${m.cardNetwork}${m.cardMask ? ` ••••${m.cardMask}` : ''}`;
  if (m.payeeName) return m.payeeName;
  if (m.recipientName) return m.recipientName;
  return m.nickname;
}

/** Masked label/value rows for the method card body (partner data-row design). */
export function methodDataRows(m: VendorPaymentMethod): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (m.type === 'ACH' || m.type === 'Wire') {
    if (m.bankName) rows.push({ label: 'Bank', value: m.bankName });
    if (m.accountMask) rows.push({ label: 'Account Number', value: `••••${m.accountMask}` });
    if (m.routingMask) rows.push({ label: 'Routing', value: `••••${m.routingMask}` });
    if (m.type === 'ACH' && m.accountType) rows.push({ label: 'Type', value: m.accountType });
    if (m.type === 'Wire' && m.swiftMask) rows.push({ label: 'SWIFT', value: m.swiftMask });
  } else if (m.type === 'Bank Transfer') {
    if (m.bankName) rows.push({ label: 'Bank', value: m.bankName });
    if (m.accountMask) rows.push({ label: 'Account Number', value: `••••${m.accountMask}` });
    if (m.accountType) rows.push({ label: 'Type', value: m.accountType });
  } else if (m.type === 'Card') {
    if (m.cardholderName) rows.push({ label: 'Holder', value: m.cardholderName });
    if (m.cardMask) rows.push({ label: 'Card Number', value: `••••${m.cardMask}` });
    if (m.expiry) rows.push({ label: 'Expiry', value: m.expiry });
  } else if (m.type === 'Check') {
    if (m.payeeName) rows.push({ label: 'Payee', value: m.payeeName });
    if (m.mailingCity) rows.push({ label: 'Mail To', value: m.mailingCity });
  } else if (m.type === 'Cash') {
    if (m.recipientName) rows.push({ label: 'Recipient', value: m.recipientName });
    if (m.collectionPoint) rows.push({ label: 'Collect At', value: m.collectionPoint });
  }
  return rows;
}
