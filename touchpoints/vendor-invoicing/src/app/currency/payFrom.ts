import type { Invoice } from '@/app/data/mockInvoices';
import { PAY_FROM_ACCOUNTS, type PayFromAccount } from '@/app/data/mockPayments';
import { BASE_CURRENCY, isBaseCurrency } from './currencies';
import { canPayFrom, youPayInOf } from './paymentRules';

/* ── "You pay" is an account (Currency Touchpoints Map, 24 Nov 2026) ───
 * An invoice says which account it will be paid from: a bank or cash
 * account in the base currency or in the invoice's own currency, nothing
 * else (paymentRules rule 3). The choice is stored on the invoice
 * (`payFromAccount`), and its currency is the invoice's "You pay in"
 * (`youPayIn`), so a payment of it starts from that account. Default: 1010,
 * the base operating account, unless the PO asked to pay in the invoice's
 * currency, then the first account in that currency. */

/** The base operating account a new document pays from by default. */
export const DEFAULT_PAY_FROM_ID = '1010-Operating';

/** Bank and cash accounts that can pay a document in this currency: in the
 *  base currency or in that currency, in the ledger's order. */
export function payFromAccountsFor(currency: string): PayFromAccount[] {
  return PAY_FROM_ACCOUNTS.filter((a) => (a.type === 'bank' || a.type === 'cash') && canPayFrom(a.currency, currency));
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
