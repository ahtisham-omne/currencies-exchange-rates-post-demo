// AR chart of accounts, the customer-side mirror of glAccounts.ts
// (PRD §11). Receivables sit in the 1100 range, revenue in the 4000
// range, customer deposits are a LIABILITY (2400). PRD §11.4 adds
// Freight Income and Fee and Other Income so freight and fees stop
// posting as product sales.

export const AR_ACCOUNTS = [
  '1100 Accounts Receivable',
  '1110 A/R · Trade',
  '1120 A/R · Intercompany',
  '1130 A/R · Retainage',
] as const;

export const DEFAULT_AR_ACCOUNT = '1100 Accounts Receivable';

/** Active revenue accounts (BR-012: only active revenue accounts are
 *  listed on standalone lines). */
export const REVENUE_ACCOUNTS = [
  '4000 Sales of Product Income',
  '4010 Sales of Product Income · Equipment',
  '4100 Service Fee Income',
  '4150 Tooling Income',
  '4200 Freight Income',
  '4300 Fee and Other Income',
  '4310 Handling Income',
  '4320 Insurance Income',
] as const;

export const DEFAULT_REVENUE_ACCOUNT = '4000 Sales of Product Income';

/** Freight billed to customers (PRD §11.1, module default, editable). */
export const FREIGHT_INCOME_ACCOUNT = '4200 Freight Income';

/** Contra revenue for return credits (customer credit memos). */
export const SALES_RETURNS_ACCOUNT = '4900 Sales Returns and Allowances';

/** Advance billed to a customer, held as a liability (PRD §8.4). */
export const CUSTOMER_DEPOSITS_ACCOUNT = '2400 Customer Deposits';

export const CUSTOMER_DEPOSIT_ACCOUNTS = [
  '2400 Customer Deposits',
  '2410 Customer Deposits · Intercompany',
] as const;

/** Revenue on invoice (Mahreen 11/4): cost posts with the revenue. */
export const COGS_ACCOUNT = '5000 Cost of Goods Sold';
export const INVENTORY_ACCOUNT = '1300 Inventory';

/** Unpaid balances written off (FAD 11/2). */
export const BAD_DEBT_ACCOUNT = '6150 Bad Debt Expense';

/** Pre-invoice booked as Revenue: units locked to the customer (FAD 11/2). */
export const UNBILLED_INVENTORY_HOLD_NOTE = 'Units locked to this invoice until shipped or released.';

/** Company currency; invoices in another currency carry a rate. */
export const COMPANY_CURRENCY = 'USD';

/** Mock rates to USD at invoice date (prototype). */
export const FX_RATES_TO_USD: Record<string, number> = { USD: 1, CAD: 0.7312, EUR: 1.0841, GBP: 1.2675 };

/** Tax rides as a charge type while tax is out of Billy Bob (D7). */
export const SALES_TAX_ACCOUNT = '2300 Sales Tax Payable';

export const CHARGE_ACCOUNTS = [...REVENUE_ACCOUNTS, SALES_TAX_ACCOUNT] as const;

// Charge types and their Chart of Accounts defaults (PRD §7.4, §11.1).
export type CustomerChargeType = 'Handling' | 'Service fee' | 'Insurance' | 'Tax' | 'Other';

export const CHARGE_TYPES: CustomerChargeType[] = ['Handling', 'Service fee', 'Insurance', 'Tax', 'Other'];

export const CHARGE_DEFAULT_ACCOUNT: Record<CustomerChargeType, string> = {
  Handling: '4310 Handling Income',
  'Service fee': '4100 Service Fee Income',
  Insurance: '4320 Insurance Income',
  Tax: SALES_TAX_ACCOUNT,
  Other: '4300 Fee and Other Income',
};

// Customer category → A/R account, mirroring VENDOR_AP_MAPPING so the
// locked A/R field on the create form derives from the profile.
export const CUSTOMER_AR_MAPPING: Record<string, string> = {
  'Buyer (Items)': '1110 A/R · Trade',
  'Buyer (Services)': '1100 Accounts Receivable',
  Distributor: '1110 A/R · Trade',
  Intercompany: '1120 A/R · Intercompany',
};

export function arAccountForCategory(category: string): string {
  return CUSTOMER_AR_MAPPING[category] ?? DEFAULT_AR_ACCOUNT;
}

/** "1100 Accounts Receivable" → { code: "1100", name: "Accounts Receivable" } */
export function splitGlAccount(account: string): { code: string; name: string } {
  const m = /^(\d{3,4})\s+(.+)$/.exec(account);
  return m ? { code: m[1], name: m[2] } : { code: '', name: account };
}
