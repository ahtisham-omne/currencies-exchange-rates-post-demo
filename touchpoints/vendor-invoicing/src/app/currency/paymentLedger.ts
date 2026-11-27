import type { Invoice } from '@/app/data/mockInvoices';
import { PAY_FROM_ACCOUNTS, type PayFromAccount, type Payment } from '@/app/data/mockPayments';
import { DEFAULT_PREPAYMENT_ASSET_ACCOUNT, FX_GAIN_LOSS_ACCOUNT } from '@/app/data/glAccounts';
import { buildPaymentGlEntries, splitAccount, type GlEntryLine } from '@/app/lib/glPosting';
import { gainLossOf } from './fxVariance';
import { BASE_CURRENCY, isBaseCurrency } from './currencies';
import { invoiceFx } from './invoiceFx';
import { bookedRateOf, settledCurrencyOf } from './paymentFx';
import {
  bankConversionText,
  buildPaymentGlFx,
  convertsAtBank,
  costInBase,
  dayRateOn,
  glAtRate,
  paymentRateOf,
  realizedFxDescription,
  realizedFxFromGl,
  youPayInOfAll,
  type CreditUsed,
  type SettledLine,
} from './paymentRules';
import { toBase } from './rates';

/* ── A saved payment in the base-currency ledger (Currency & Exchange Rates) ──
 * What a payment's page reads: its journal in base (the saved snapshot, or,
 * for a seed that has none, one built by the rule Record Payment posts with),
 * the account it came from, the bank's rate and the day's, what it cost, what
 * A/P carried and the realized FX Gain/Loss (read off the journal, so the
 * summary and the GL Impact tab always agree). */

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PaymentLedger {
  /** The journal, in base. */
  entries: GlEntryLine[];
  account?: PayFromAccount;
  /** The invoices' currency, what the vendor received. */
  currency: string;
  /** A base account paid foreign invoices: the bank converted. */
  converts: boolean;
  /** The payment's rate (the bank's, or the day's). */
  rate: number;
  /** Mid-market on the payment date. */
  dayRate: number;
  /** What the cash cost in base. */
  cost: number;
  /** Vendor credit drawn, in base. */
  credit: number;
  /** What A/P carried for the part settled, in base. */
  carried: number;
  /** Realized FX Gain/Loss (above zero a gain); null with nothing to compare. */
  realized: number | null;
  lines: SettledLine[];
  credits: CreditUsed[];
  /** The account currency the invoices' POs asked for. */
  youPayIn: string;
}

export function paymentLedger(p: Payment, invoices: Invoice[], payments: Payment[] = []): PaymentLedger {
  const currency = settledCurrencyOf(p);
  const base = isBaseCurrency(currency);
  const account = PAY_FROM_ACCOUNTS.find((a) => a.id === p.bankAccount);
  const accountCurrency = account?.currency ?? BASE_CURRENCY;
  const rate = paymentRateOf(p);
  const dayRate = dayRateOn(currency, p.paymentDate);
  const isPrepay = p.type === 'Prepayment';
  const byNumber = new Map(invoices.map((inv) => [inv.invoiceNumber, inv]));
  // Gross per invoice (cash and credit) when the split was kept, else the cash.
  const settled = p.perInvoiceSplit?.length
    ? p.perInvoiceSplit.map((s) => ({ invoiceNumber: s.invoiceNumber, amount: round2(s.cash + s.credit) }))
    : p.appliedInvoices.map((a) => ({ invoiceNumber: a.invoiceNumber, amount: a.amount }));
  const lines: SettledLine[] = isPrepay
    ? []
    : settled.map((s) => {
        const inv = byNumber.get(s.invoiceNumber);
        return {
          invoiceNumber: s.invoiceNumber,
          amount: s.amount,
          rate: base ? 1 : bookedRateOf(inv, currency, rate),
          rateDate: inv ? invoiceFx(inv).rateDate : undefined,
          apAccount: p.apAccount,
        };
      });
  const credits: CreditUsed[] = (p.appliedCredits ?? []).map((c) => ({
    amount: c.amount,
    rate: base ? 1 : payments.find((x) => x.id === c.sourcePaymentId)?.exchangeRate ?? rate,
    account: DEFAULT_PREPAYMENT_ASSET_ACCOUNT,
  }));
  const creditTotal = round2(credits.reduce((s, c) => s + (base ? c.amount : toBase(c.amount, c.rate)), 0));

  let entries: GlEntryLine[];
  if (p.glEntries?.length) {
    // A snapshot in base carries its currency; an older one kept in the
    // invoices' currency posts at the payment's rate.
    const inBase = base || p.glEntries.some((e) => e.currency);
    entries = inBase ? p.glEntries : glAtRate(p.glEntries, currency, rate);
  } else if (isPrepay || lines.length === 0) {
    entries = glAtRate(
      buildPaymentGlEntries({
        type: isPrepay ? 'Prepayment' : 'Payment',
        cashAmount: p.amount,
        bankAccount: account?.creditGl ?? p.bankAccount,
        apAccount: p.apAccount || DEFAULT_PREPAYMENT_ASSET_ACCOUNT,
        description: isPrepay ? `Advance to ${p.vendor}` : undefined,
      }),
      currency,
      rate,
    );
  } else {
    entries = buildPaymentGlFx({
      currency,
      lines,
      apAccount: p.apAccount,
      credits,
      cash: p.amount,
      bankGl: account?.creditGl ?? p.bankAccount,
      accountCurrency,
      bankAmount: p.bankAmount,
      paymentRate: rate,
      paymentDate: p.paymentDate,
      description: `Settle ${lines.map((l) => l.invoiceNumber).join(', ')}`,
    }).entries;
  }

  const cost = costInBase(p);
  const realized = base || isPrepay ? null : realizedFxFromGl(entries) ?? 0;
  const youPayIn = youPayInOfAll(
    settled.map((s) => byNumber.get(s.invoiceNumber)).filter((i): i is Invoice => !!i),
  );
  return {
    entries,
    account,
    currency,
    converts: convertsAtBank(accountCurrency, currency),
    rate,
    dayRate,
    cost,
    credit: creditTotal,
    carried: realized != null ? round2(realized + cost + creditTotal) : cost,
    realized,
    lines,
    credits,
    youPayIn: settled.length ? youPayIn : BASE_CURRENCY,
  };
}

/* ── Mark as paid: the rate the bank used (25 Nov 2026, Nophil item 9) ──
 * A scheduled payment from an account in another currency (a PKR account
 * paying a USD invoice) carries an estimated rate: the payment date's rate
 * of the company's rate type when it was scheduled. Marking it paid asks for
 * the rate the bank actually used, pre-filled with that estimate. That rate
 * is a settlement fact, not a rate override, so it is asked whichever rate
 * type the company uses. Saved on the payment, it becomes the payment's
 * rate: the bank's figure is the amount at it, and the realized FX Gain/Loss
 * moves by the difference from the estimate. */

/** The pay-from account's currency differs from what the vendor receives,
 *  so the bank converts and the rate is only an estimate until it's paid. */
export function needsBankRate(p: Payment): boolean {
  if (p.status !== 'Scheduled') return false;
  const currency = settledCurrencyOf(p);
  const accountCurrency = PAY_FROM_ACCOUNTS.find((a) => a.id === p.bankAccount)?.currency ?? BASE_CURRENCY;
  return accountCurrency.toUpperCase() !== currency && convertsAtBank(accountCurrency, currency);
}

/** The rate a scheduled payment was estimated at, base per one unit. */
export const estimatedRateOf = (p: Payment) => paymentRateOf(p);

/** What a scheduled payment was estimated to cost in the account's currency. */
export const estimatedCostOf = (p: Payment) => costInBase(p);

/** The payment, settled at the rate the bank used: the rate and the bank's
 *  figure saved on it, and a saved journal re-posted at them (the bank line
 *  at what it cost, the rest to Realized FX Gain/Loss). */
export function withBankRate(p: Payment, rate: number, invoices: Invoice[]): Payment {
  if (!needsBankRate(p) || !(rate > 0)) return p;
  const currency = settledCurrencyOf(p);
  const cost = toBase(p.amount, rate);
  const next: Payment = { ...p, exchangeRate: rate, bankAmount: cost, rateEdited: true, rateDate: p.paymentDate };
  // A seed without a journal is built from the rule when it's read
  // (paymentLedger), so the bank's figure is all it needs.
  if (!p.glEntries?.some((e) => e.currency)) return next;
  const account = PAY_FROM_ACCOUNTS.find((a) => a.id === p.bankAccount);
  const bankCode = account ? splitAccount(account.creditGl).code : null;
  const fxCode = splitAccount(FX_GAIN_LOSS_ACCOUNT).code;
  const entries: GlEntryLine[] = p.glEntries
    .filter((e) => e.accountCode !== fxCode)
    .map((e) =>
      e.accountCode === bankCode && e.credit != null
        ? { ...e, credit: cost, rate, description: `Bank converts ${bankConversionText(cost, p.amount, currency)}` }
        : e,
    );
  const total = (side: 'debit' | 'credit') => round2(entries.reduce((s, e) => s + (e[side] ?? 0), 0));
  const rest = round2(total('debit') - total('credit'));
  const kind = gainLossOf(rest);
  if (kind !== 'none') {
    const g = splitAccount(FX_GAIN_LOSS_ACCOUNT);
    entries.push({
      accountCode: g.code,
      accountName: g.name,
      description: realizedFxDescription(currency, paymentLedger(p, invoices).lines, rate, p.paymentDate, true),
      ...(kind === 'gain' ? { credit: Math.abs(rest) } : { debit: Math.abs(rest) }),
    });
  }
  return { ...next, glEntries: entries };
}
