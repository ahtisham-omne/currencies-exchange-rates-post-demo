import { BASE_CURRENCY, isBaseCurrency } from './currencies';

/* ── The company's bank and cash accounts ─────────────────────────────
 * "You receive" on a sales order is an account, not a bare currency
 * (Currency Touchpoints Map, 24 Nov 2026): the bank or cash account the
 * customer's payment goes to. Only accounts in the base currency or in the
 * order's own currency can take it. The entries copy Vendor Invoicing's
 * PAY_FROM_ACCOUNTS (data/mockPayments.ts), same ids, labels and
 * currencies, so every module names the same accounts. */

export type CompanyAccountType = 'bank' | 'cash';

export interface CompanyAccount {
  /** Vendor Invoicing's PAY_FROM_ACCOUNTS id. */
  id: string;
  /** "1010 · JPMorgan Operating" */
  label: string;
  currency: string;
  type: CompanyAccountType;
  bankName?: string;
}

export const COMPANY_ACCOUNTS: CompanyAccount[] = [
  { id: '1010-Operating', label: '1010 · JPMorgan Operating', currency: BASE_CURRENCY, type: 'bank', bankName: 'JPMorgan Chase' },
  { id: '1020-Payroll', label: '1020 · Corporate Checking', currency: BASE_CURRENCY, type: 'bank', bankName: 'Bank of America' },
  { id: '1030-AP Disbursements', label: '1030 · AP Disbursements', currency: BASE_CURRENCY, type: 'bank', bankName: 'U.S. Bank' },
  { id: '1000-Petty Cash', label: '1000 · Petty Cash Drawer', currency: BASE_CURRENCY, type: 'cash' },
  { id: '1040-FX Settlement', label: '1040 · Global FX Settlement', currency: 'USD', type: 'bank', bankName: 'Wells Fargo' },
  { id: '1050-EUR Settlement', label: '1050 · EUR Settlement', currency: 'EUR', type: 'bank', bankName: 'Deutsche Bank' },
  { id: '1060-GBP Settlement', label: '1060 · GBP Settlement', currency: 'GBP', type: 'bank', bankName: 'Barclays' },
  { id: '1070-AED Settlement', label: '1070 · AED Settlement', currency: 'AED', type: 'bank', bankName: 'Emirates NBD' },
];

/** The default: the base-currency operating account. */
export const DEFAULT_ACCOUNT_ID = '1010-Operating';

export function getCompanyAccount(id: string | null | undefined): CompanyAccount | undefined {
  return id ? COMPANY_ACCOUNTS.find((a) => a.id === id) : undefined;
}

/** Can an order in `docCurrency` be received into this account? Base, or the order's own currency. */
export function isEligibleAccount(account: CompanyAccount, docCurrency: string): boolean {
  return isBaseCurrency(account.currency) || account.currency === docCurrency.toUpperCase();
}

/** The accounts an order in `docCurrency` can be received into: base first, then its own currency. */
export function eligibleAccounts(docCurrency: string): CompanyAccount[] {
  const code = docCurrency.toUpperCase();
  return [
    ...COMPANY_ACCOUNTS.filter((a) => isBaseCurrency(a.currency)),
    ...(isBaseCurrency(code) ? [] : COMPANY_ACCOUNTS.filter((a) => a.currency === code)),
  ];
}

/** The first account in `currency`, else the default (base) one. */
export function defaultAccountIn(currency: string | null | undefined): CompanyAccount {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  return (
    (isBaseCurrency(code) ? getCompanyAccount(DEFAULT_ACCOUNT_ID) : COMPANY_ACCOUNTS.find((a) => a.currency === code)) ??
    getCompanyAccount(DEFAULT_ACCOUNT_ID)!
  );
}

/**
 * The account an order is received into: the one stored on it when it can
 * take the order's currency; else, for an order saved before accounts (a bare
 * "You receive" currency), the first account in that currency when it can;
 * else the default base-currency account.
 */
export function resolveReceiveAccount(
  docCurrency: string,
  accountId: string | null | undefined,
  settlementCurrency?: string | null,
): CompanyAccount {
  const stored = getCompanyAccount(accountId);
  if (stored && isEligibleAccount(stored, docCurrency)) return stored;
  if (settlementCurrency) {
    const byCurrency = defaultAccountIn(settlementCurrency);
    if (byCurrency.currency === settlementCurrency.toUpperCase() && isEligibleAccount(byCurrency, docCurrency)) return byCurrency;
  }
  return getCompanyAccount(DEFAULT_ACCOUNT_ID)!;
}
