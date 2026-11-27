import type { Invoice } from '@/app/data/mockInvoices';
import type { PayFromAccount, Payment } from '@/app/data/mockPayments';
import { FX_GAIN_LOSS_ACCOUNT } from '@/app/data/glAccounts';
import { splitAccount, type GlEntryLine } from '@/app/lib/glPosting';
import { BASE_CURRENCY, isBaseCurrency } from './currencies';
import { gainLossOf } from './fxVariance';
import { formatMoney, formatRate, formatRateDate, rateSentence } from './money';
import { midRateOn, toBase } from './rates';

/* ── Paying an invoice in another currency (Currency & Exchange Rates) ──
 * The rules a payment of a foreign invoice keeps, wherever it is made
 * (Record Payment, a payment run) and wherever it is read (the payment page,
 * the remittance advice):
 *
 *  1. What you owe stays in the invoice's currency: a payment reduces the
 *     pound balance, never a rupee one.
 *  2. The vendor always receives the invoice's currency. "Vendor receives"
 *     is fixed.
 *  3. Any bank account can pay a foreign invoice: one in its currency
 *     (nothing converts), one in the base currency or one in a third
 *     currency (the bank converts; 27 Nov 2026, D7). A base-currency
 *     invoice is paid from a base-currency account. Accounts in the
 *     invoice's currency are listed first (currency/payFrom.ts).
 *  4. Only a base-currency invoice greys accounts out, with the reason. A
 *     payment run keeps the two-currency rule for now (invoice's or base:
 *     its bank figure is entered in base), so it still greys the rest.
 *  5. The PO's "You pay in" picks the default account; the user can switch
 *     to any account that may pay.
 *  6. From an account in the invoice's currency: one amount, the pounds
 *     paid. Nothing converts.
 *  7. From an account in another currency the bank converts: the one rate
 *     entered is the bank's ("1 AED = 76.2500 PKR"), pre-filled with the
 *     payment date's daily market rate, and what the bank took is the amount
 *     at it (27 Nov 2026, Mahreen 7a: the rate, not the rupees, is entered).
 *  8. A third currency (27 Nov 2026, D7): a CAD account paying a USD
 *     invoice. The vendor still receives USD. The bank's rate is the direct
 *     pair, CAD per USD ("1 USD = 1.3935 CAD"); no PKR rate is shown. The
 *     journal still posts in base (Eli's ruling, 26 Nov 2026: the payment
 *     takes the payment date's rate, the bank's spread goes to FX gain or
 *     loss):
 *       - A/P clears at the invoice's own base, the amount at its rate;
 *       - the CAD account is credited with the Canadian dollars the bank
 *         took, valued at the payment date's CAD rate (base per CAD);
 *       - the difference is the FX variance. It splits as for a base
 *         account: the rate change since the invoice (amount × (invoice
 *         rate − the payment date's USD rate)) and the bank's spread
 *         (amount × (the day's USD rate − the bank's cross rate × the day's
 *         CAD rate)).
 *     If the vendor wants to be paid in another currency, they send a new
 *     invoice in it (or a credit note and a new invoice).
 *  9. A payment run keeps these per invoice and totals per currency.
 * 10. The remittance advice is in the invoice's currency.
 *
 * A/P carried the paid part at the invoice's rate. What paying it cost in
 * base (the bank's figure from a base account, the day's rate from one in
 * the invoice's currency) differs by the rate, and that difference is the
 * realized FX Gain/Loss the payment posts. Prepayments applied at invoice
 * time were settled there at their locked rate. */

const round2 = (n: number) => Math.round(n * 100) / 100;
const up = (code: string | null | undefined) => (code || BASE_CURRENCY).toUpperCase();

/** Rule 8, where someone might look for a currency switch. */
export const OTHER_CURRENCY_NOTE =
  'To pay in another currency, ask the vendor for a new invoice in that currency, or a credit note and a new invoice.';

/** The currencies that pay this invoice with no third currency: its own
 *  first, then the base. Record Payment lists accounts in them first; a
 *  payment run pays only from them (rule 4). */
export function payFromCurrencies(invoiceCurrency: string): string[] {
  const cur = up(invoiceCurrency);
  return isBaseCurrency(cur) ? [BASE_CURRENCY] : [cur, BASE_CURRENCY];
}

/** Rule 3 (27 Nov 2026, D7): whether an account in this currency may pay
 *  the invoice. Any account pays a foreign invoice; a base-currency invoice
 *  takes a base-currency account. */
export const canPayFrom = (accountCurrency: string, invoiceCurrency: string) =>
  !isBaseCurrency(up(invoiceCurrency)) || isBaseCurrency(up(accountCurrency));

/** "a" or "an" before a currency code read as letters ("an AED account"). */
export const articleFor = (code: string) => (/^[AEIO]/.test(code) && code !== 'EUR' ? 'an' : 'a');

/** Rule 4: "This account is in USD. Pick a PKR account.", or null when the
 *  account may pay. */
export function payFromBlockReason(accountCurrency: string, invoiceCurrency: string): string | null {
  if (canPayFrom(accountCurrency, invoiceCurrency)) return null;
  return `This account is in ${up(accountCurrency)}. Pick ${articleFor(BASE_CURRENCY)} ${BASE_CURRENCY} account.`;
}

/** Rule 4 in a payment run, which keeps the two-currency rule: the
 *  invoice's currency or the base (a run's bank figure is entered in base). */
export const canPayFromInRun = (accountCurrency: string, invoiceCurrency: string) =>
  payFromCurrencies(invoiceCurrency).includes(up(accountCurrency));

/** Rule 4 in a payment run: "This account is in EUR. Pick a GBP or PKR
 *  account.", or null when the account may pay the run's payment. */
export function runPayFromBlockReason(accountCurrency: string, invoiceCurrency: string): string | null {
  if (canPayFromInRun(accountCurrency, invoiceCurrency)) return null;
  const [first, second] = payFromCurrencies(invoiceCurrency);
  const pick = second ? `${articleFor(first)} ${first} or ${second}` : `${articleFor(first)} ${first}`;
  return `This account is in ${up(accountCurrency)}. Pick ${pick} account.`;
}

/** Rule 4: every account a picker lists, with whether it may pay and why not.
 *  Order is kept; the caller greys the ones that can't. */
export function payFromOptions<T extends Pick<PayFromAccount, 'currency'>>(accounts: T[], invoiceCurrency: string) {
  return accounts.map((account) => {
    const reason = payFromBlockReason(account.currency, invoiceCurrency);
    return { account, allowed: reason == null, reason };
  });
}

/** Rule 5: the currency of the account a payment starts from: the PO's "You
 *  pay in" when it is the invoice's currency or the base, else the base. A
 *  third currency is picked by hand, never by default, so a payment run
 *  (which keeps the two-currency rule) always starts on an account it may use. */
export function defaultPayFromCurrency(invoiceCurrency: string, youPayIn?: string | null): string {
  const want = up(youPayIn ?? BASE_CURRENCY);
  return canPayFromInRun(want, invoiceCurrency) ? want : BASE_CURRENCY;
}

/** Rule 5 for an invoice: its PO's "You pay in" (base when it has none). */
export const youPayInOf = (inv: Pick<Invoice, 'currency'> & Partial<Pick<Invoice, 'youPayIn'>>) =>
  defaultPayFromCurrency(inv.currency, inv.youPayIn);

/** Rule 5 with a set of invoices paid together (one currency): the account
 *  currency all of them ask for, else the base. */
export function youPayInOfAll(invoices: (Pick<Invoice, 'currency'> & Partial<Pick<Invoice, 'youPayIn'>>)[]): string {
  const wants = new Set(invoices.map(youPayInOf));
  return wants.size === 1 ? [...wants][0] : BASE_CURRENCY;
}

/** Rules 7 and 8: the payment converts at the bank, an account in another
 *  currency (the base or a third one) paying a foreign invoice. */
export const convertsAtBank = (accountCurrency: string, invoiceCurrency: string) =>
  !isBaseCurrency(invoiceCurrency) && up(accountCurrency) !== up(invoiceCurrency);

/** Rule 8: an account in neither the invoice's currency nor the base. */
export const isThirdCurrency = (accountCurrency: string, invoiceCurrency: string) =>
  convertsAtBank(accountCurrency, invoiceCurrency) && !isBaseCurrency(accountCurrency);

/** "Our rate" (27 Nov 2026, Mahreen 7a): the payment date's daily market
 *  rate in the account's currency per one unit of the invoice's. Base per
 *  unit from a base account (1 AED = ₨76.1000); the direct pair from a
 *  third currency (1 USD = 1.3935 CAD, the two daily rates' cross). */
export function accountDayRateOn(invoiceCurrency: string, accountCurrency: string, date: string): number {
  const inv = dayRateOn(invoiceCurrency, date);
  if (isBaseCurrency(accountCurrency)) return inv;
  const acc = dayRateOn(accountCurrency, date);
  if (!(acc > 0)) return inv;
  // To the decimals a rate is shown and typed in (formatRate), so the bank's
  // rate field, pre-filled with it, reads back exactly our rate.
  const cross = inv / acc;
  return Math.abs(cross) >= 0.01 ? +cross.toFixed(4) : +cross.toFixed(6);
}

/** A rate between two currencies as the module writes it: "1 AED = ₨76.1000
 *  PKR" to the base, "1 USD = 1.3935 CAD" between two others (no symbol, as
 *  Mahreen's 7c mockup has it). */
export function pairRateText(from: string, to: string, rate: number): string {
  if (isBaseCurrency(to)) return rateSentence(from, rate);
  return `1 ${up(from)} = ${formatRate(rate)} ${up(to)}`;
}

/** Rule 7: the rate the bank's two figures make, base per one unit of the
 *  invoice's currency. Null until both are above zero. */
export function derivedRate(vendorReceives: number, bankTook: number): number | null {
  if (!(vendorReceives > 0) || !(bankTook > 0)) return null;
  return bankTook / vendorReceives;
}

/** Rules 7 and 8: "₨3,503,000.00 → £10,000.00 · 1 GBP = ₨350.3000 PKR", or
 *  from a third currency "C$13,935.00 → $10,000.00 · 1 USD = 1.3935 CAD"
 *  (`bankTook` in the account's currency). */
export function bankConversionText(bankTook: number, vendorReceives: number, currency: string, accountCurrency: string = BASE_CURRENCY): string {
  const rate = derivedRate(vendorReceives, bankTook);
  const head = `${formatMoney(bankTook, accountCurrency)} → ${formatMoney(vendorReceives, currency)}`;
  return rate == null ? head : `${head} · ${pairRateText(currency, accountCurrency, rate)}`;
}

/** How far a rate is from the day's, in percent (signed). */
export const rateGapPct = (rate: number, dayRate: number) => (dayRate > 0 ? ((rate - dayRate) / dayRate) * 100 : 0);

/** The daily market rate on the payment date, what the bank's rate is compared with. */
export const dayRateOn = (currency: string, date: string) => (isBaseCurrency(currency) ? 1 : midRateOn(currency, date) ?? 1);

/** Whether the bank's rate is further from the day's than the module's
 *  allowed difference (Settings, Module Defaults): it needs review, and a
 *  role without "Change the Exchange Rate on a Payment" can't record it. */
export function bankRateNeedsReview(rate: number | null, dayRate: number, allowedPct: number): boolean {
  if (rate == null || !(dayRate > 0)) return false;
  return Math.abs(rateGapPct(rate, dayRate)) > allowedPct + 1e-9;
}

/* ── What a payment cost, and the realized FX Gain/Loss ──────────────── */

/** Base per one unit of the invoice's currency that the cash went out at:
 *  the bank's (its two figures) from a base account, else the rate on the
 *  record (the day's, from an account in the invoice's currency). */
export function paymentRateOf(
  p: Pick<Payment, 'currency' | 'amount' | 'paymentDate'> & Partial<Pick<Payment, 'bankAmount' | 'exchangeRate'>>,
): number {
  if (isBaseCurrency(p.currency)) return 1;
  const fromBank = p.bankAmount != null ? derivedRate(p.amount, p.bankAmount) : null;
  if (fromBank != null) return fromBank;
  if (p.exchangeRate && p.exchangeRate > 0) return p.exchangeRate;
  return dayRateOn(p.currency, p.paymentDate);
}

/** What the cash cost in base: the bank's figure, else the amount at the payment's rate. */
export function costInBase(
  p: Pick<Payment, 'currency' | 'amount' | 'paymentDate'> & Partial<Pick<Payment, 'bankAmount' | 'exchangeRate'>>,
): number {
  if (isBaseCurrency(p.currency)) return round2(p.amount);
  if (p.bankAmount != null && p.bankAmount > 0) return round2(p.bankAmount);
  return toBase(p.amount, paymentRateOf(p));
}

/** One invoice a payment settles, in its currency, at the rate A/P carried it. */
export interface SettledLine {
  invoiceNumber: string;
  /** What the payment settles on it (cash and credit), in the invoice's currency. */
  amount: number;
  /** The invoice's rate, base per one unit. */
  rate: number;
  rateDate?: string;
  /** The payables account it posted to. */
  apAccount?: string;
}

/** Vendor credit used on the payment, at the rate it was paid. */
export interface CreditUsed {
  amount: number;
  rate: number;
  account: string;
}

export interface RealizedFx {
  /** The settled amounts at their invoice rates: what A/P carried. */
  carried: number;
  /** Credit drawn, at the rates it was paid. */
  credit: number;
  /** What the cash cost in base. */
  cost: number;
  /** carried − credit − cost: a gain above zero, a loss below. */
  amount: number;
}

export function realizedFxOf(lines: SettledLine[], credits: CreditUsed[], cost: number): RealizedFx {
  const carried = round2(lines.reduce((s, l) => s + toBase(l.amount, l.rate), 0));
  const credit = round2(credits.reduce((s, c) => s + toBase(c.amount, c.rate), 0));
  return { carried, credit, cost: round2(cost), amount: round2(carried - credit - cost) };
}

/** "Invoice rate 1 GBP = ₨340.6802 PKR (Oct 16, 2025) · paid at 1 GBP =
 *  ₨350.3000 PKR (Oct 24, 2025, bank conversion)": both rates and dates. */
export function realizedFxDescription(
  currency: string,
  lines: SettledLine[],
  paidRate: number,
  paidDate: string,
  converted: boolean,
): string {
  const distinct = Array.from(new Map(lines.map((l) => [`${l.rate}|${l.rateDate ?? ''}`, l])).values());
  const booked =
    distinct.length === 1
      ? `Invoice rate ${rateSentence(currency, distinct[0].rate)}${distinct[0].rateDate ? ` (${formatRateDate(distinct[0].rateDate)})` : ''}`
      : `Invoice rates ${distinct.map((l) => `${l.invoiceNumber} ${rateSentence(currency, l.rate)}${l.rateDate ? ` (${formatRateDate(l.rateDate)})` : ''}`).join('; ')}`;
  return `${booked} · paid at ${rateSentence(currency, paidRate)} (${formatRateDate(paidDate)}, ${converted ? 'bank conversion' : 'daily market rate'})`;
}

export interface PaymentGlFxInput {
  /** The invoices' currency, what the vendor receives. */
  currency: string;
  lines: SettledLine[];
  /** Payables account for lines that don't name one. */
  apAccount: string;
  credits?: CreditUsed[];
  /** Cash paid, in the invoice's currency. */
  cash: number;
  /** The pay-from account's GL ("1020 Corporate Checking") and its currency. */
  bankGl: string;
  accountCurrency: string;
  /** From an account in another currency: what the bank took, in base
   *  (from a third currency, the account's amount at the payment date's
   *  rate of the account's currency). */
  bankAmount?: number;
  /** From a third currency (rule 8): what the bank took, in the account's
   *  currency. The bank line carries it at the day's rate of that currency. */
  accountAmount?: number;
  /** The rate the cash went out at (derived from the bank, or the day's). */
  paymentRate: number;
  paymentDate: string;
  description?: string;
}

export interface PaymentGlFx {
  entries: GlEntryLine[];
  fx: RealizedFx;
}

/**
 * A payment's journal in base, the ledger's:
 *  - Dr Accounts Payable: the settled amounts at their invoice rates
 *  - Cr Vendor Prepayments: credit drawn, at the rates it was paid
 *  - Cr the bank: what the cash cost (the bank's figure, or the amount at
 *    the day's rate from an account in the invoice's currency)
 *  - Cr FX Gain/Loss for a gain, Dr for a loss: the rest, with both rates
 *    and dates in its description
 * Each line keeps its invoice-currency amount and rate. A base-currency
 * invoice converts nothing and posts no FX line.
 */
export function buildPaymentGlFx(input: PaymentGlFxInput): PaymentGlFx {
  const { currency, lines, apAccount, credits = [], cash, bankGl, accountCurrency, paymentDate, description } = input;
  const base = isBaseCurrency(currency);
  const converted = convertsAtBank(accountCurrency, currency);
  const third = isThirdCurrency(accountCurrency, currency);
  const paymentRate = base ? 1 : input.paymentRate;
  // Rule 8: a third currency's amount, valued at the payment date's rate of
  // the account's currency, unless the base figure came with it.
  const accountDayRate = third ? dayRateOn(accountCurrency, paymentDate) : 1;
  const thirdCost = third && input.accountAmount != null && input.accountAmount > 0 ? toBase(input.accountAmount, accountDayRate) : null;
  const cost = base
    ? round2(cash)
    : converted && input.bankAmount != null && input.bankAmount > 0
      ? round2(input.bankAmount)
      : thirdCost ?? toBase(cash, paymentRate);
  const fx = base
    ? { carried: round2(lines.reduce((s, l) => s + l.amount, 0)), credit: round2(credits.reduce((s, c) => s + c.amount, 0)), cost, amount: 0 }
    : realizedFxOf(lines, credits, cost);
  const foreign = (amount: number, rate: number) => (base ? {} : { currency, foreignAmount: round2(amount), rate });
  const entries: GlEntryLine[] = [];

  // Payables, per account, at the invoice rates.
  const byAp = new Map<string, SettledLine[]>();
  lines.forEach((l) => {
    const acc = l.apAccount || apAccount;
    byAp.set(acc, [...(byAp.get(acc) ?? []), l]);
  });
  byAp.forEach((ls, acc) => {
    const a = splitAccount(acc);
    const amount = round2(ls.reduce((s, l) => s + l.amount, 0));
    const debit = base ? amount : round2(ls.reduce((s, l) => s + toBase(l.amount, l.rate), 0));
    const rates = Array.from(new Set(ls.map((l) => l.rate)));
    entries.push({
      accountCode: a.code,
      accountName: a.name,
      description: description ?? `Settle ${ls.map((l) => l.invoiceNumber).join(', ')}`,
      debit,
      ...(base ? {} : { currency, foreignAmount: amount, ...(rates.length === 1 ? { rate: rates[0] } : {}) }),
    });
  });

  // Vendor credit, at the rates it was paid.
  const byCredit = new Map<string, CreditUsed[]>();
  credits.filter((c) => c.amount > 0.004).forEach((c) => byCredit.set(c.account, [...(byCredit.get(c.account) ?? []), c]));
  byCredit.forEach((cs, acc) => {
    const a = splitAccount(acc);
    const amount = round2(cs.reduce((s, c) => s + c.amount, 0));
    const rates = Array.from(new Set(cs.map((c) => c.rate)));
    entries.push({
      accountCode: a.code,
      accountName: a.name,
      description: 'Vendor credit applied',
      credit: base ? amount : round2(cs.reduce((s, c) => s + toBase(c.amount, c.rate), 0)),
      ...(base ? {} : { currency, foreignAmount: amount, ...(rates.length === 1 ? { rate: rates[0] } : {}) }),
    });
  });

  // The bank, at what the cash cost.
  if (cash > 0.004) {
    const b = splitAccount(bankGl);
    entries.push({
      accountCode: b.code,
      accountName: b.name,
      description: base
        ? 'Cash out'
        : third && input.accountAmount != null
          ? `Bank converts ${bankConversionText(input.accountAmount, cash, currency, accountCurrency)}`
          : converted
            ? `Bank converts ${bankConversionText(cost, cash, currency)}`
            : `Paid ${formatMoney(cash, currency)} from a ${up(accountCurrency)} account`,
      credit: cost,
      // A third currency's line is in the account's currency, at its day's rate.
      ...(third && input.accountAmount != null
        ? { currency: up(accountCurrency), foreignAmount: round2(input.accountAmount), rate: accountDayRate }
        : foreign(cash, paymentRate)),
    });
  }

  // The rest is the realized difference.
  const k = gainLossOf(fx.amount);
  if (!base && k !== 'none') {
    const g = splitAccount(FX_GAIN_LOSS_ACCOUNT);
    entries.push({
      accountCode: g.code,
      accountName: g.name,
      description: realizedFxDescription(currency, lines, paymentRate, paymentDate, converted),
      ...(k === 'gain' ? { credit: Math.abs(fx.amount) } : { debit: Math.abs(fx.amount) }),
    });
  }
  return { entries, fx };
}

/** The realized FX Gain/Loss a saved journal carries (its FX Gain/Loss line):
 *  above zero a gain, below a loss, null when the journal has none to read. */
export function realizedFxFromGl(entries: GlEntryLine[] | undefined): number | null {
  if (!entries?.length) return null;
  const code = splitAccount(FX_GAIN_LOSS_ACCOUNT).code;
  const line = entries.find((e) => e.accountCode === code);
  if (!line) return entries.some((e) => e.currency) ? 0 : null;
  return round2((line.credit ?? 0) - (line.debit ?? 0));
}

/** "Gain" / "Loss" text for a realized amount. */
export const realizedFxText = (amount: number) => {
  const k = gainLossOf(amount);
  return k === 'none' ? 'None' : `${k === 'gain' ? '+' : '−'}${formatMoney(Math.abs(amount), BASE_CURRENCY)}`;
};

/** A journal kept in the invoices' currency, posted in base at one rate:
 *  each line keeps its amount in that currency and the rate, and the cent
 *  rounding lands on the largest debit so the entry still balances (the
 *  invoice journal's rule, glFx). For a prepayment, whose asset is booked at
 *  what the advance cost, and a run's lines that carry no invoice rate. */
export function glAtRate(lines: GlEntryLine[], currency: string, rate: number): GlEntryLine[] {
  if (isBaseCurrency(currency)) return lines;
  const total = (side: 'debit' | 'credit', rows: GlEntryLine[]) => round2(rows.reduce((s, l) => s + (l[side] ?? 0), 0));
  const balanced = Math.abs(total('debit', lines) - total('credit', lines)) < 0.005;
  const out: GlEntryLine[] = lines.map((l) => ({
    ...l,
    ...(l.debit != null ? { debit: toBase(l.debit, rate) } : {}),
    ...(l.credit != null ? { credit: toBase(l.credit, rate) } : {}),
    currency,
    foreignAmount: l.debit ?? l.credit ?? 0,
    rate,
  }));
  const diff = round2(total('credit', out) - total('debit', out));
  if (balanced && Math.abs(diff) >= 0.005) {
    const largest = out.reduce((best, l, i) => ((l.debit ?? 0) > (out[best].debit ?? 0) ? i : best), 0);
    if (out[largest].debit != null) out[largest] = { ...out[largest], debit: round2((out[largest].debit ?? 0) + diff) };
  }
  return out;
}
