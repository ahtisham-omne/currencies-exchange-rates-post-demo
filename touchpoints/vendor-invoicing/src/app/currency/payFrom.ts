import type { Invoice } from '@/app/data/mockInvoices';
import { PAY_FROM_ACCOUNTS, type PayFromAccount } from '@/app/data/mockPayments';
import { BASE_CURRENCY, isBaseCurrency } from './currencies';
import { youPayInOf } from './paymentRules';

/* ── "You pay" is an account (Currency Touchpoints Map, 24 Nov 2026) ───
 * An invoice says which account it will be paid from: any bank or cash
 * account, in any currency (25 Nov 2026, as on a PO), listed those in the
 * invoice's own currency first, then base-currency ones, then the rest
 * (27 Nov 2026, Mahreen 7d; base-currency ones led before). The
 * choice is stored on the invoice (`payFromAccount`); its "You pay in"
 * (`youPayIn`) is the invoice's currency when the account is in it, else
 * the base, so a payment of it starts from an account that may pay
 * (paymentRules rule 3). Default: 1010, the base operating account, unless
 * the PO asked to pay in the invoice's currency, then the first account in
 * that currency. */

/** The base operating account a new document pays from by default. */
export const DEFAULT_PAY_FROM_ID = '1010-Operating';

/** Where an account lists for a document in this currency (27 Nov 2026,
 *  Mahreen 7d): in that currency first, then the base currency, then the
 *  rest. */
export function payFromRank(account: Pick<PayFromAccount, 'currency'>, currency: string): number {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  const cur = account.currency.toUpperCase();
  return cur === code ? 0 : isBaseCurrency(cur) ? 1 : 2;
}

/** Accounts in listing order for a document in this currency (each group
 *  keeps the ledger's order). */
export function sortPayFromAccounts<T extends Pick<PayFromAccount, 'currency'>>(accounts: T[], currency: string): T[] {
  return accounts
    .map((a, i) => ({ a, i }))
    .sort((x, y) => payFromRank(x.a, currency) - payFromRank(y.a, currency) || x.i - y.i)
    .map((x) => x.a);
}

/** Bank and cash accounts a document in this currency can name: every one,
 *  in any currency, those in that currency first, then base-currency ones,
 *  then the rest (each group in the ledger's order). */
export function payFromAccountsFor(currency: string): PayFromAccount[] {
  return sortPayFromAccounts(PAY_FROM_ACCOUNTS.filter((a) => a.type === 'bank' || a.type === 'cash'), currency);
}

/** The default account for a document in this currency, given the currency
 *  its PO asked to pay in. */
export function defaultPayFromId(currency: string, youPayIn?: string | null): string {
  const cur = (currency || BASE_CURRENCY).toUpperCase();
  const want = (youPayIn ?? BASE_CURRENCY).toUpperCase();
  if (!isBaseCurrency(cur) && want === cur) {
    const inCurrency = payFromAccountsFor(cur).find((a) => a.currency === cur && a.type === 'bank');
    if (inCurrency) return inCurrency.id;
  }
  return DEFAULT_PAY_FROM_ID;
}

/** An account id that may pay a document in this currency, else the default. */
export function eligiblePayFromId(id: string | null | undefined, currency: string, youPayIn?: string | null): string {
  const ok = id ? payFromAccountsFor(currency).some((a) => a.id === id) : false;
  return ok && id ? id : defaultPayFromId(currency, youPayIn);
}

export const payFromAccountById = (id: string | null | undefined): PayFromAccount | undefined =>
  id ? PAY_FROM_ACCOUNTS.find((a) => a.id === id) : undefined;

/** The account an invoice is to be paid from: its own choice, else the
 *  default its PO's "You pay in" gives. */
export function invoicePayFrom(inv: Pick<Invoice, 'currency'> & Partial<Pick<Invoice, 'youPayIn' | 'payFromAccount'>>): PayFromAccount {
  const id = eligiblePayFromId(inv.payFromAccount, inv.currency, youPayInOf(inv));
  return payFromAccountById(id) ?? PAY_FROM_ACCOUNTS[0];
}

/** "1010 · JPMorgan Operating · PKR" */
export const payFromLabel = (a: Pick<PayFromAccount, 'label' | 'currency'>) => `${a.label} · ${a.currency}`;
