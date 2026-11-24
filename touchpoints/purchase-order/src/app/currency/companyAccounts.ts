import { BASE_CURRENCY, isBaseCurrency } from './currencies';

/* ── The company's bank and cash accounts ("You pay") ─────────────────
 * What a PO is paid from. Copied from Vendor Invoicing's PAY_FROM_ACCOUNTS
 * (src/app/data/mockPayments.ts there): the same ids, labels and currencies,
 * so a PO's pay-from account reads the same when it is invoiced and paid.
 * A PO is paid from an account in the base currency or in the PO's own
 * currency (Currency Touchpoints Map, Purchase Orders 4), 1010 by default. */

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

export const getCompanyAccount = (id: string | null | undefined): CompanyAccount | undefined =>
  id ? COMPANY_ACCOUNTS.find((a) => a.id === id) : undefined;

/** The accounts a document in `docCurrency` can be paid from: every bank and
 *  cash account, in any currency (25 Nov 2026), listed base-currency ones
 *  first, then those in the document's currency, then the rest. */
export function payFromAccountsFor(docCurrency: string): CompanyAccount[] {
  const code = (docCurrency || BASE_CURRENCY).toUpperCase();
  const rank = (a: CompanyAccount) => (isBaseCurrency(a.currency) ? 0 : a.currency === code ? 1 : 2);
  return [...COMPANY_ACCOUNTS].sort((a, b) => rank(a) - rank(b));
}

/** The account a document is paid from: the one chosen when it is still
 *  allowed for the document's currency; else, for a document saved with only
 *  a settlement currency, the first account in it; else 1010. */
export function resolvePayFrom(
  docCurrency: string,
  accountId?: string | null,
  settlementCurrency?: string | null,
): CompanyAccount {
  const eligible = payFromAccountsFor(docCurrency);
  const chosen = accountId ? eligible.find((a) => a.id === accountId) : undefined;
  if (chosen) return chosen;
  const settle = settlementCurrency?.toUpperCase();
  const bySettlement = settle && !isBaseCurrency(settle) ? eligible.find((a) => a.currency === settle) : undefined;
  return bySettlement ?? eligible.find((a) => a.id === DEFAULT_PAY_FROM) ?? eligible[0] ?? COMPANY_ACCOUNTS[0];
}

/** "1010 · JPMorgan Operating · PKR" */
export const accountLine = (a: CompanyAccount) => `${a.label} · ${a.currency}`;
