// Single source of truth for GL accounts used across the Create Invoice flow.
// Both the inline GLAccountPicker (popover/command in line-item rows) and the
// new GLAccountConfigModal (A/P-style picker for Additional Charges + Freight)
// read from this list so the catalogue stays consistent.

export const GL_ACCOUNTS = [
  "1200 Inventory",
  "1205 Advance Payments",
  "1210 Inventory-WIP",
  "1220 Inventory-Finished Goods",
  "1230 Inventory-Raw Materials",
  "1240 Inventory-Consumables",
  "1250 Inventory-Packaging",
  "1300 Vendor Prepayments",
  "2000 Accounts Payable",
  "2100 Accrued Liabilities",
  // Offset for migrated open balances (Eli 10/9): imported invoices debit
  // this clearing account so open A/P adds up without touching an expense.
  "2105 Migration Clearing",
  "5000 Cost of Goods Sold",
  "5010 Raw Material Purchases",
  "5020 Freight Inbound",
  "5030 Duty & Customs",
  "5100 Direct Labor",
  "5200 Factory Overhead",
  "5205 Purchase Qty Variance",
  "6000 General & Admin",
  "6100 Office Supplies",
  "6150 Printing & Postage",
  "6200 Utilities Expense",
  "6210 Electricity",
  "6220 Water & Sewage",
  "6230 Internet & Telecom",
  "6300 Rent Expense",
  "6400 Repair & Maintenance",
  "6500 Travel & Entertainment",
  "6600 Marketing & Advertising",
  "6700 Professional Fees",
  "6710 Legal Fees",
  "6720 Accounting Fees",
  "6730 Consulting Fees",
  "6800 Insurance Expense",
  "6900 Bank Charges",
  "7000 Interest Expense",
  "7100 Taxes & Licenses",
  "7200 Depreciation Expense",
  "7300 Amortization Expense",
  "8000 Other Income",
  "8100 Interest Income",
  "9000 Income Tax Expense",
  "9100 State Tax Expense",
  "9200 Local Tax Expense",
];

export function getGLAccountCategory(account: string): string {
  const code = parseInt(account.split(' ')[0], 10);
  if (code >= 1200 && code < 1300) return 'Inventory Assets';
  if (code >= 2000 && code < 2100) return 'Accounts Payable';
  if (code >= 2100 && code < 2200) return 'Accrued Liabilities';
  if (code >= 2200 && code < 2500) return 'Other Current Liabilities';
  if (code >= 2500 && code < 2700) return 'Tax Liabilities';
  if (code >= 5000 && code < 5300) return 'Cost of Goods Sold';
  if (code >= 6000 && code < 7000) return 'Operating Expenses';
  if (code >= 7000 && code < 9000) return 'Non-Operating Expenses';
  if (code >= 9000) return 'Tax Expenses';
  return 'Other';
}

// Ordered map of category → accounts, used by the modal + picker to render
// stable grouped lists.
export function groupGLAccounts(accounts: string[] = GL_ACCOUNTS): Record<string, string[]> {
  const g: Record<string, string[]> = {};
  accounts.forEach((account) => {
    const category = getGLAccountCategory(account);
    if (!g[category]) g[category] = [];
    g[category].push(account);
  });
  return g;
}

/** Where an over-billed quantity posts (BA 9/28 decision): the accrual is
 *  relieved only for what was received; the excess debits this variance
 *  line so the ledger shows the over-billing instead of silently
 *  over-relieving 2100. */
export const QTY_VARIANCE_ACCOUNT = '5205 Purchase Qty Variance';

// Sensible defaults for the auxiliary GL fields. Used when freight / a new
// additional-charge row is first added.
export const DEFAULT_FREIGHT_GL_ACCOUNT = '5020 Freight Inbound';
export const DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT = '6000 General & Admin';

// Prepaid-asset accounts a vendor prepayment can post to (Dr side). A prepayment
// debits one of these instead of A/P — that's what makes it a prepayment. The
// default is config-level (per-entity override allowed).
export const PREPAYMENT_ASSET_ACCOUNTS = [
  '1300 Vendor Prepayments',
  '1205 Advance Payments',
];
export const DEFAULT_PREPAYMENT_ASSET_ACCOUNT = '1300 Vendor Prepayments';

/** The account a pre-invoice DISPLAYS in place of A/P (9/4/26 Eli, BB-09):
 *  at pre-invoice stage there is no accounts payable — the one account
 *  that matters is where the deposit lands when paid, Advances to
 *  Vendors. The vendor's A/P account still rides the document data and
 *  surfaces when the goods are received and invoiced. */
export const ADVANCES_ACCOUNT = '1205 Advance Payments';

// "1300 Vendor Prepayments" → "1300 · Vendor Prepayments" for display.
export function formatGLAccount(account: string): string {
  const sp = account.indexOf(' ');
  return sp === -1 ? account : `${account.slice(0, sp)} · ${account.slice(sp + 1)}`;
}

// ── Accounts Payable catalogue ────────────────────────────────────────────
// The liability accounts an invoice's / payment's A/P line can post to. Shared
// by the Create Invoice A/P picker and the Record Payment A/P GL configuration
// so both flows offer the same set and the same vendor-category default.
export const AP_ACCOUNTS = [
  "2000 Accounts Payable",
  "2010 A/P – Trade Payables",
  "2020 A/P – Intercompany",
  "2030 A/P – Related Parties",
  "2050 A/P – Foreign Currency",
  "2100 Accrued Liabilities",
  "2110 Accrued Expenses",
  "2120 Accrued Wages & Salaries",
  "2130 Accrued Interest Payable",
  "2140 Accrued Taxes Payable",
  "2200 Notes Payable – Short Term",
  "2300 Unearned Revenue",
  "2400 Retention Payable",
  "2500 GST/VAT Payable",
  "2600 Withholding Tax Payable",
];

// Vendor-category → default A/P account. Payments and invoices both auto-derive
// the A/P line from the vendor's category (falling back to plain Accounts Payable).
export const VENDOR_AP_MAPPING: Record<string, string> = {
  'Raw Materials': '2010 A/P – Trade Payables',
  'Packaging': '2010 A/P – Trade Payables',
  'Logistics': '2000 Accounts Payable',
  'Equipment': '2000 Accounts Payable',
  'Services': '2110 Accrued Expenses',
  'IT Services': '2110 Accrued Expenses',
  'Consulting': '2030 A/P – Related Parties',
  'default': '2000 Accounts Payable',
};

export function defaultApAccountForCategory(category: string | undefined | null): string {
  return VENDOR_AP_MAPPING[category ?? ''] ?? VENDOR_AP_MAPPING.default;
}
