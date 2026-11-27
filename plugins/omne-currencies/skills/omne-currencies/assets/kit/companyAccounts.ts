import { getBaseCurrency, isBaseCurrency } from './currencies';
import { convertAt, crossRateOn, DEFAULT_RATE_TYPE, todayIso, usableRateOn, type RateType } from './rates';
import { formatMoney, formatMoneyWithCode, rateSentence } from './moneyFormat';

/* ── OMNE currency kit: the company's bank and cash accounts ──────────
 * "You pay" (purchases) and "You receive" (sales) are accounts, not bare
 * currencies. Any bank or cash account can be named, in any currency
 * (25 Nov 2026), listed base-currency ones first, then those in the
 * document's currency, then the rest. The account on a document is only a
 * default: the payment can change it. Every module names the same accounts
 * (Vendor Invoicing's PAY_FROM_ACCOUNTS: same ids, labels, currencies).
 *
 * How the money moves depends on the account's currency (Nophil, 25 Nov):
 *  - In the document's currency: nothing converts.
 *  - In base: the document's amount at the document's rate.
 *  - In a third currency: the DIRECT rate between the account's currency
 *    and the document's ("1 USD = C$1.3935 CAD"), never two rates through
 *    base. The amount is an estimate: "Estimated payment ≈ C$13,935.00 CAD
 *    from 1075 · CAD Settlement. Estimate at today's rate. Your bank uses
 *    its own rate when you pay." (Mahreen's copy, 25 Nov 2026.)
 *
 * Shared file. Do not edit it in a module. */

export type CompanyAccountType = 'bank' | 'cash';

export interface CompanyAccount {
  id: string;
  /** "1010 · JPMorgan Operating" */
  label: string;
  currency: string;
  type: CompanyAccountType;
  bankName?: string;
  accountMask?: string;
  /** Book balance in the account's currency. Whether a buyer sees it on a
   *  PO is still open (Nophil and Mahreen, 25 Nov 2026): pickers hide it
   *  unless asked to show it. */
  balance: number;
}

/** `null` currency = the company's base, resolved when read. */
const SEED: (Omit<CompanyAccount, 'currency'> & { currency: string | null })[] = [
  { id: '1010-Operating', label: '1010 · JPMorgan Operating', currency: null, type: 'bank', bankName: 'JPMorgan Chase', accountMask: '4321', balance: 347_200_000 },
  { id: '1020-Payroll', label: '1020 · Corporate Checking', currency: null, type: 'bank', bankName: 'Bank of America', accountMask: '8842', balance: 106_400_000 },
  { id: '1030-AP Disbursements', label: '1030 · AP Disbursements', currency: null, type: 'bank', bankName: 'U.S. Bank', accountMask: '2025', balance: 172_200_000 },
  { id: '1000-Petty Cash', label: '1000 · Petty Cash Drawer', currency: null, type: 'cash', balance: 980_000 },
  { id: '1040-FX Settlement', label: '1040 · Global FX Settlement', currency: 'USD', type: 'bank', bankName: 'Wells Fargo', accountMask: '7741', balance: 92_000 },
  { id: '1050-EUR Settlement', label: '1050 · EUR Settlement', currency: 'EUR', type: 'bank', bankName: 'Deutsche Bank', accountMask: '5512', balance: 210_000 },
  { id: '1060-GBP Settlement', label: '1060 · GBP Settlement', currency: 'GBP', type: 'bank', bankName: 'Barclays', accountMask: '9034', balance: 145_000 },
  { id: '1070-AED Settlement', label: '1070 · AED Settlement', currency: 'AED', type: 'bank', bankName: 'Emirates NBD', accountMask: '3307', balance: 680_000 },
  { id: '1075-CAD Settlement', label: '1075 · CAD Settlement', currency: 'CAD', type: 'bank', bankName: 'RBC Royal Bank', accountMask: '6120', balance: 125_000 },
  { id: '1080-JPY Settlement', label: '1080 · JPY Settlement', currency: 'JPY', type: 'bank', bankName: 'MUFG Bank', accountMask: '4418', balance: 18_500_000 },
  { id: '1085-CNY Settlement', label: '1085 · CNY Settlement', currency: 'CNY', type: 'bank', bankName: 'Bank of China', accountMask: '2963', balance: 640_000 },
];

/** The default: the base-currency operating account. */
export const DEFAULT_ACCOUNT_ID = '1010-Operating';

export function getCompanyAccounts(): CompanyAccount[] {
  return SEED.map((a) => ({ ...a, currency: a.currency ?? getBaseCurrency() }));
}

export function getCompanyAccount(id: string | null | undefined): CompanyAccount | undefined {
  return id ? getCompanyAccounts().find((a) => a.id === id) : undefined;
}

/** Every bank and cash account, base first, then the document's currency, then the rest. */
export function accountsFor(docCurrency: string): CompanyAccount[] {
  const code = (docCurrency || getBaseCurrency()).toUpperCase();
  const rank = (a: CompanyAccount) => (isBaseCurrency(a.currency) ? 0 : a.currency === code ? 1 : 2);
  return getCompanyAccounts().sort((a, b) => rank(a) - rank(b));
}

/** "1010 · JPMorgan Operating · PKR" */
export const accountLabel = (a: Pick<CompanyAccount, 'label' | 'currency'>) => `${a.label} · ${a.currency}`;

export type PayKind = 'same' | 'base' | 'cross';

/** How paying (or receiving) a document through an account works. */
export function payKindOf(account: Pick<CompanyAccount, 'currency'>, docCurrency: string): PayKind {
  const acc = account.currency.toUpperCase();
  if (acc === docCurrency.toUpperCase()) return 'same';
  if (isBaseCurrency(acc)) return 'base';
  return 'cross';
}

export interface PayEstimate {
  kind: PayKind;
  /** The amount in the account's currency. */
  amount: number;
  /** Units of the account's currency per one unit of the document's: the
   *  document's rate for a base account, the direct cross rate for a third
   *  currency, 1 when nothing converts. */
  rate: number;
  /** "1 USD = C$1.3935 CAD"; null when nothing converts. */
  rateText: string | null;
  /** True for a third-currency account: the bank's own rate decides. */
  estimate: boolean;
}

/**
 * What a document amount comes to in the account's currency. `docRate` is
 * the document's own rate to base (used for a base account); a third
 * currency uses the direct rate on `date` (today unless given).
 */
export function payEstimate(
  amount: number,
  docCurrency: string,
  account: Pick<CompanyAccount, 'currency'>,
  docRate: number,
  opts: { date?: string; rateType?: RateType } = {},
): PayEstimate {
  const kind = payKindOf(account, docCurrency);
  if (kind === 'same') return { kind, amount, rate: 1, rateText: null, estimate: false };
  if (kind === 'base') {
    return { kind, amount: convertAt(amount, docRate, account.currency), rate: docRate, rateText: rateSentence(docCurrency, docRate), estimate: false };
  }
  const date = opts.date ?? todayIso();
  const type = opts.rateType ?? DEFAULT_RATE_TYPE;
  const rate = crossRateOn(docCurrency, account.currency, date, type) ?? usableRateOn(docCurrency, date, type).rate ?? 1;
  return { kind, amount: convertAt(amount, rate, account.currency), rate, rateText: rateSentence(docCurrency, rate, account.currency), estimate: true };
}

/** The note under "You pay" for each kind of account. */
export function payNote(est: PayEstimate, account: Pick<CompanyAccount, 'label' | 'currency'>): string {
  if (est.kind === 'same') return `Paid in ${account.currency} from ${account.label}. Nothing converts.`;
  if (est.kind === 'base') return `Paid from ${account.label} at ${est.rateText}.`;
  return `Estimated payment ≈ ${formatMoneyWithCode(est.amount, account.currency)} from ${account.label}. Estimate at today's rate. Your bank uses its own rate when you pay.`;
}

/** "≈ $13,935.00": an estimate amount for a row, without the code. */
export const estimateText = (est: PayEstimate, currency: string) => (est.estimate ? `≈ ${formatMoney(est.amount, currency)}` : formatMoney(est.amount, currency));
