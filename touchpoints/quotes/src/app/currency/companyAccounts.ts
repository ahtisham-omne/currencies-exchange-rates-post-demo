import { BASE_CURRENCY, isBaseCurrency } from './currencies';

/* ── The company's bank and cash accounts ─────────────────────────────
 * "You receive" on a quote is an account, not a bare currency (Currency
 * Touchpoints Map, Quotes 4): the bank or cash account the customer pays
 * into. Copied from Vendor Invoicing's PAY_FROM_ACCOUNTS
 * (touchpoints/vendor-invoicing/src/app/data/mockPayments.ts), same ids,
 * labels and currencies, so Quotes, Purchase Orders and Sales Orders name
 * the same accounts. Only accounts in the base currency or in the quote's
 * currency can be picked. A quote without one is paid into 1010, the
 * default operating account in the base currency. */

export interface CompanyAccount {
  /** The id Vendor Invoicing uses ("1010-Operating"). */
  id: string;
  /** "1010 · JPMorgan Operating" */
  label: string;
  currency: string;
  type: 'bank' | 'cash';
}

export const COMPANY_ACCOUNTS: CompanyAccount[] = [
  { id: '1010-Operating', label: '1010 · JPMorgan Operating', currency: BASE_CURRENCY, type: 'bank' },
  { id: '1020-Payroll', label: '1020 · Corporate Checking', currency: BASE_CURRENCY, type: 'bank' },
  { id: '1030-AP Disbursements', label: '1030 · AP Disbursements', currency: BASE_CURRENCY, type: 'bank' },
  { id: '1000-Petty Cash', label: '1000 · Petty Cash Drawer', currency: BASE_CURRENCY, type: 'cash' },
  { id: '1040-FX Settlement', label: '1040 · Global FX Settlement', currency: 'USD', type: 'bank' },
  { id: '1050-EUR Settlement', label: '1050 · EUR Settlement', currency: 'EUR', type: 'bank' },
  { id: '1060-GBP Settlement', label: '1060 · GBP Settlement', currency: 'GBP', type: 'bank' },
  { id: '1070-AED Settlement', label: '1070 · AED Settlement', currency: 'AED', type: 'bank' },
];

export const DEFAULT_ACCOUNT_ID = '1010-Operating';

const BY_ID = new Map(COMPANY_ACCOUNTS.map((a) => [a.id, a]));

export const getCompanyAccount = (id: string | null | undefined): CompanyAccount | undefined =>
  id ? BY_ID.get(id) : undefined;

export const defaultAccount = (): CompanyAccount => BY_ID.get(DEFAULT_ACCOUNT_ID)!;

/** Accounts a document in `docCurrency` can be paid into: base-currency
 *  accounts first, then those in the document's currency. */
export function eligibleAccounts(docCurrency: string): CompanyAccount[] {
  const doc = docCurrency.toUpperCase();
  return [
    ...COMPANY_ACCOUNTS.filter((a) => isBaseCurrency(a.currency)),
    ...(isBaseCurrency(doc) ? [] : COMPANY_ACCOUNTS.filter((a) => a.currency === doc)),
  ];
}

export const isEligibleAccount = (account: CompanyAccount, docCurrency: string) =>
  isBaseCurrency(account.currency) || account.currency === docCurrency.toUpperCase();

/**
 * The account a document is paid into: the one on it when it can still take
 * the document's currency; else, for a record that only kept a settlement
 * currency, the first account in that currency; else 1010.
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
