/**
 * A vendor's saved payment methods, as the payment run reads them.
 *
 * Rebuilt: this module was an untracked file in the working tree and I
 * overwrote it. Its contract is recovered from its callers -- `paymentRuns`
 * takes a method's `id`, `type` and `bankName`, and picks the one flagged
 * `isPrimary` -- and its data now comes from the partner record rather than a
 * second list of its own, so a vendor's accepted methods read the same here
 * as they do on the vendor card.
 *
 * `bankName` matters: the pay-from account snaps to the account whose bank
 * matches, which is why the bank list is the one `PAY_FROM_ACCOUNTS` names.
 */

import { mockVendors } from './mockVendors';

export interface VendorPaymentMethod {
  /** Stable per vendor and method. */
  id: string;
  /** The method as `PAYMENT_METHODS` names it: ACH, Wire, Check, Card, Cash. */
  type: string;
  /** The bank behind it, where the method has one. Matches a Cash Management
   *  account's `bankName` so the pay-from default can snap to it. */
  bankName?: string;
  /** Last four of the account or card, for display. */
  mask?: string;
  /** The vendor's default. Exactly one per vendor. */
  isPrimary: boolean;
}

/** Banks a method can sit behind. Same names `PAY_FROM_ACCOUNTS` carries, so
 *  a method's bank always has an account to draw from. */
const BANKS = [
  'JPMorgan Chase',
  'Wells Fargo',
  'PNC Bank',
  'Citibank',
  'Chase Bank',
  'U.S. Bank',
  'Bank of America',
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const BANK_METHODS = new Set(['ACH', 'Wire', 'Bank Transfer']);

/** What this vendor accepts, primary first. */
export function vendorPaymentMethods(vendor: string): VendorPaymentMethod[] {
  const record = mockVendors.find((v) => v.vendorName === vendor);
  const names = record?.paymentMethods ?? ['ACH', 'Check'];
  const primary = record?.primaryPaymentMethod ?? names[0];
  return names.map((name) => {
    const seed = hash(`${vendor}|${name}`);
    const bank = BANKS[seed % BANKS.length]!;
    return {
      id: `vpm-${hash(vendor) % 100000}-${name.toLowerCase().replace(/\s+/g, '-')}`,
      type: name,
      ...(BANK_METHODS.has(name) || name === 'Card' ? { bankName: bank } : {}),
      mask: String(1000 + (seed % 9000)),
      isPrimary: name === primary,
    };
  });
}
