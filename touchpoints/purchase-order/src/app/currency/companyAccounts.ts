import { BASE_CURRENCY, isBaseCurrency } from './currencies';

/* ── The company's bank and cash accounts ("You pay") ─────────────────
 * What a PO is paid from. Copied from Vendor Invoicing's PAY_FROM_ACCOUNTS
 * (src/app/data/mockPayments.ts there): the same ids, labels and currencies,
 * so a PO's pay-from account reads the same when it is invoiced and paid.
 * A PO is paid from an account in any currency (25 Nov 2026): the one chosen
 * on the PO, else the vendor's default (VENDOR_PAY_FROM, 27 Nov 2026), else
 * 1010. */

export interface CompanyAccount {
  id: string;
  /** "1010 · JPMorgan Operating" */
  label: string;
  type: 'bank' | 'cash';
  currency: string;
  bankName?: string;
  accountMask?: string;
}

export const COMPANY_ACCOUNTS: CompanyAccount[] = [
  { id: '1010-Operating', label: '1010 · JPMorgan Operating', type: 'bank', currency: BASE_CURRENCY, bankName: 'JPMorgan Chase', accountMask: '4321' },
  { id: '1020-Payroll', label: '1020 · Corporate Checking', type: 'bank', currency: BASE_CURRENCY, bankName: 'Bank of America', accountMask: '8842' },
  { id: '1030-AP Disbursements', label: '1030 · AP Disbursements', type: 'bank', currency: BASE_CURRENCY, bankName: 'U.S. Bank', accountMask: '2025' },
  { id: '1000-Petty Cash', label: '1000 · Petty Cash Drawer', type: 'cash', currency: BASE_CURRENCY },
  { id: '1040-FX Settlement', label: '1040 · Global FX Settlement', type: 'bank', currency: 'USD', bankName: 'Wells Fargo', accountMask: '7741' },
  { id: '1050-EUR Settlement', label: '1050 · EUR Settlement', type: 'bank', currency: 'EUR', bankName: 'Deutsche Bank', accountMask: '5512' },
  { id: '1060-GBP Settlement', label: '1060 · GBP Settlement', type: 'bank', currency: 'GBP', bankName: 'Barclays', accountMask: '9034' },
  { id: '1070-AED Settlement', label: '1070 · AED Settlement', type: 'bank', currency: 'AED', bankName: 'Emirates NBD', accountMask: '3307' },
  { id: '1075-CAD Settlement', label: '1075 · CAD Settlement', type: 'bank', currency: 'CAD', bankName: 'RBC Royal Bank', accountMask: '6120' },
  { id: '1080-JPY Settlement', label: '1080 · JPY Settlement', type: 'bank', currency: 'JPY', bankName: 'MUFG Bank', accountMask: '4418' },
  { id: '1085-CNY Settlement', label: '1085 · CNY Settlement', type: 'bank', currency: 'CNY', bankName: 'Bank of China', accountMask: '2963' },
];

/** 1010 · JPMorgan Operating, in the base currency. */
export const DEFAULT_PAY_FROM = '1010-Operating';

/* ── The vendor's default pay-from account (Mahreen, 27 Nov 2026, PO-2) ──
 * "You pay in" lists the vendor's default account first, tagged "From
 * vendor", and a PO with no account of its own is paid from it. As on the
 * partner record, one per vendor; a vendor not listed is paid from 1010.
 * The seeded vendors (poStore's listing POs):
 *  - Most are paid from 1010 · JPMorgan Operating (PKR), as in the mockup.
 *  - Tesla, Inc. bills in USD, so its record pays from 1040 · Global FX
 *    Settlement (USD). PO 395-9826 (po-4) is paid from 1075 · CAD Settlement
 *    instead: a choice on that PO only, which the dialog shows against the
 *    vendor's 1040. */
export const VENDOR_PAY_FROM: Record<string, string> = {
  'General Motors (GM)': DEFAULT_PAY_FROM,
  'Toyota Technical Center (TTC)': DEFAULT_PAY_FROM,
  'Ford Motor Company': DEFAULT_PAY_FROM,
  'Tesla, Inc.': '1040-FX Settlement',
  'Chrysler (Stellantis N.V.)': DEFAULT_PAY_FROM,
  'Rivian Automotive': DEFAULT_PAY_FROM,
  'Lucid Motors': DEFAULT_PAY_FROM,
  'Honda Motor Co., Ltd. (USA)': DEFAULT_PAY_FROM,
  'Nissan North America': DEFAULT_PAY_FROM,
  'BMW of North America': DEFAULT_PAY_FROM,
};

export const getCompanyAccount = (id: string | null | undefined): CompanyAccount | undefined =>
  id ? COMPANY_ACCOUNTS.find((a) => a.id === id) : undefined;

/** The vendor's default pay-from account, else 1010 · JPMorgan Operating. */
export function vendorPayFrom(vendorName?: string | null): CompanyAccount {
  const id = (vendorName && VENDOR_PAY_FROM[vendorName.trim()]) || DEFAULT_PAY_FROM;
  return getCompanyAccount(id) ?? getCompanyAccount(DEFAULT_PAY_FROM) ?? COMPANY_ACCOUNTS[0];
}

/** The accounts a document in `docCurrency` can be paid from: every bank and
 *  cash account, in any currency (25 Nov 2026). The vendor's default comes
 *  first when the vendor is given (27 Nov 2026), then the base-currency ones,
 *  then those in the document's currency, then the rest. */
export function payFromAccountsFor(docCurrency: string, vendorName?: string | null): CompanyAccount[] {
  const code = (docCurrency || BASE_CURRENCY).toUpperCase();
  const vendorDefault = vendorName ? vendorPayFrom(vendorName).id : null;
  const rank = (a: CompanyAccount) =>
    a.id === vendorDefault ? 0 : isBaseCurrency(a.currency) ? 1 : a.currency === code ? 2 : 3;
  return [...COMPANY_ACCOUNTS].sort((a, b) => rank(a) - rank(b));
}

/** The account a document is paid from: the one chosen when it is still
 *  allowed for the document's currency; else, for a document saved with only
 *  a settlement currency, the first account in it; else the vendor's default
 *  (27 Nov 2026); else 1010. */
export function resolvePayFrom(
  docCurrency: string,
  accountId?: string | null,
  settlementCurrency?: string | null,
  vendorName?: string | null,
): CompanyAccount {
  const eligible = payFromAccountsFor(docCurrency);
  const chosen = accountId ? eligible.find((a) => a.id === accountId) : undefined;
  if (chosen) return chosen;
  const settle = settlementCurrency?.toUpperCase();
  const bySettlement = settle && !isBaseCurrency(settle) ? eligible.find((a) => a.currency === settle) : undefined;
  return bySettlement ?? vendorPayFrom(vendorName);
}

/** "1010 · JPMorgan Operating · PKR" */
export const accountLine = (a: CompanyAccount) => `${a.label} · ${a.currency}`;
