import { BASE_CURRENCY, isBaseCurrency } from './currencies';

/* ── The company's bank and cash accounts ─────────────────────────────
 * "You receive" on a quote is an account, not a bare currency (Currency
 * Touchpoints Map, Quotes 4): the bank or cash account the customer pays
 * into. Copied from Vendor Invoicing's PAY_FROM_ACCOUNTS
 * (touchpoints/vendor-invoicing/src/app/data/mockPayments.ts), same ids,
 * labels and currencies, so Quotes, Purchase Orders and Sales Orders name
 * the same accounts. Any account can be picked, in any currency (25 Nov
 * 2026). A quote without one is paid into 1010, the default operating
 * account in the base currency. */

export interface CompanyAccount {
  /** The id Vendor Invoicing uses ("1010-Operating"). */
  id: string;
  /** "1010 · JPMorgan Operating" */
  label: string;
  currency: string;
  type: 'bank' | 'cash';
  bankName?: string;
  accountMask?: string;
}

export const COMPANY_ACCOUNTS: CompanyAccount[] = [
  { id: '1010-Operating', label: '1010 · JPMorgan Operating', currency: BASE_CURRENCY, type: 'bank', bankName: 'JPMorgan Chase', accountMask: '4321' },
  { id: '1020-Payroll', label: '1020 · Corporate Checking', currency: BASE_CURRENCY, type: 'bank', bankName: 'Bank of America', accountMask: '8842' },
  { id: '1030-AP Disbursements', label: '1030 · AP Disbursements', currency: BASE_CURRENCY, type: 'bank', bankName: 'U.S. Bank', accountMask: '2025' },
  { id: '1000-Petty Cash', label: '1000 · Petty Cash Drawer', currency: BASE_CURRENCY, type: 'cash' },
  { id: '1040-FX Settlement', label: '1040 · Global FX Settlement', currency: 'USD', type: 'bank', bankName: 'Wells Fargo', accountMask: '7741' },
  { id: '1050-EUR Settlement', label: '1050 · EUR Settlement', currency: 'EUR', type: 'bank', bankName: 'Deutsche Bank', accountMask: '5512' },
  { id: '1060-GBP Settlement', label: '1060 · GBP Settlement', currency: 'GBP', type: 'bank', bankName: 'Barclays', accountMask: '9034' },
  { id: '1070-AED Settlement', label: '1070 · AED Settlement', currency: 'AED', type: 'bank', bankName: 'Emirates NBD', accountMask: '3307' },
  { id: '1075-CAD Settlement', label: '1075 · CAD Settlement', currency: 'CAD', type: 'bank', bankName: 'RBC Royal Bank', accountMask: '6120' },
  { id: '1080-JPY Settlement', label: '1080 · JPY Settlement', currency: 'JPY', type: 'bank', bankName: 'MUFG Bank', accountMask: '4418' },
  { id: '1085-CNY Settlement', label: '1085 · CNY Settlement', currency: 'CNY', type: 'bank', bankName: 'Bank of China', accountMask: '2963' },
];

export const DEFAULT_ACCOUNT_ID = '1010-Operating';

const BY_ID = new Map(COMPANY_ACCOUNTS.map((a) => [a.id, a]));

export const getCompanyAccount = (id: string | null | undefined): CompanyAccount | undefined =>
  id ? BY_ID.get(id) : undefined;

export const defaultAccount = (): CompanyAccount => BY_ID.get(DEFAULT_ACCOUNT_ID)!;

/** Accounts a document in `docCurrency` can be paid into: every bank and
 *  cash account, in any currency (25 Nov 2026), listed base-currency ones
 *  first, then those in the document's currency, then the rest. */
export function eligibleAccounts(docCurrency: string): CompanyAccount[] {
  const doc = (docCurrency || BASE_CURRENCY).toUpperCase();
  const rank = (a: CompanyAccount) => (isBaseCurrency(a.currency) ? 0 : a.currency === doc ? 1 : 2);
  return [...COMPANY_ACCOUNTS].sort((a, b) => rank(a) - rank(b));
}

/** Every company account can take a document in any currency (25 Nov 2026). */
export const isEligibleAccount = (account: CompanyAccount, _docCurrency?: string) => BY_ID.has(account.id);

/**
 * The account a document is paid into: the one on it, in any currency;
 * else, for a record that only kept a settlement currency, the first
 * account in that currency; else 1010.
 */
export function resolveAccount(
  docCurrency: string,
  accountId?: string | null,
  settlementCurrency?: string | null,
): CompanyAccount {
  const onRecord = getCompanyAccount(accountId);
  if (onRecord && isEligibleAccount(onRecord, docCurrency)) return onRecord;
  const code = (settlementCurrency || '').toUpperCase();
  if (code && !isBaseCurrency(code)) {
    const inCurrency = eligibleAccounts(docCurrency).find((a) => a.currency === code);
    if (inCurrency) return inCurrency;
  }
  return defaultAccount();
}
