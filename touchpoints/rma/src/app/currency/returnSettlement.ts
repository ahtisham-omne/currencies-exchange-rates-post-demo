import type { RMA } from '@/app/data/mockRMAs';
import type { LinkedFinancialRecord } from '@/app/data/invoiceLinkedRecords';
import { PAY_TO_ACCOUNTS, type PayFromAccount } from '@/app/data/mockPayments';
import {
  rmaFxVariance,
  rmaSettlementBase,
  rmaSettlementParts,
  type RMAGLRates,
  type RMASettlementBase,
  type RMASettlementParts,
} from '@/app/data/rmaGLEntries';
import { BASE_CURRENCY, isBaseCurrency } from './currencies';
import { RATE_PROVIDER, rateOn, todayIso, toBase, type MoneyFx, type RateType } from './rates';
import { returnFx, rmaCurrency, rmaCurrencyPO, rmaPORateType } from './returnCurrency';

/* ── What a return settles at (Currency Touchpoints Map, 2026-11-24) ────
 * A return's goods reverse at the receiving rate, the rate their receipt was
 * booked at. What the vendor settles (the credit note and the refund) is worth
 * today's rate instead: the rate type follows the PO (mid-market or
 * corporate, changeable in the return's currency configuration), it is taken
 * on the day the vendor settles, and until then it floats with today's. The
 * gap is the FX variance: settled amount × (settle rate − receiving rate),
 * + to FX Gain, − to FX Loss.
 *
 * Open return: unlocked. Settled (or refused): locked, at the settlement
 * day's rate.
 *
 * "Deposited to" is an account, not a bare currency: one in the base currency
 * or the return's (as QuickBooks deposits only into a home-currency account
 * or one in the transaction's currency). The money comes back in that
 * account's currency; an account not in PKR adds a Base equivalent. */

/** Accounts a return's money can come back to: the base currency's, or the
 *  return's own. */
export function depositAccountsFor(currency: string): PayFromAccount[] {
  const code = currency.toUpperCase();
  return PAY_TO_ACCOUNTS.filter((a) => {
    const c = (a.currency ?? BASE_CURRENCY).toUpperCase();
    return c === code || isBaseCurrency(c);
  });
}

export const accountCurrency = (a: PayFromAccount | null | undefined) => (a?.currency ?? BASE_CURRENCY).toUpperCase();

/** The account the configuration starts on: the return's own where it can
 *  take the money, else the first base-currency account (1010). */
export function defaultDepositAccount(rma: RMA): PayFromAccount | null {
  const eligible = depositAccountsFor(rmaCurrency(rma));
  return eligible.find((a) => a.id === rma.payToAccountId) ?? eligible.find((a) => isBaseCurrency(accountCurrency(a))) ?? eligible[0] ?? null;
}

export interface ReturnSettlementFx extends RMAGLRates {
  foreign: boolean;
  /** "PO-11233", where the return's currency comes from. */
  po: string;
  /** The receiving-day rate, for the hovers (null on a PKR return). */
  receiving: MoneyFx | null;
  /** The PO's rate type: the default. */
  poRateType: RateType;
  /** The type picked (the PO's unless changed). */
  chosenType: RateType;
  /** The type the settle rate actually is: corporate falls back to mid-market
   *  where finance has set none. */
  rateType: RateType;
  rateDate: string;
  rateSource: string;
  rateFellBack: boolean;
  /** The vendor has settled (or refused): the rate is fixed. */
  locked: boolean;
  /** The settlement (or refusal) day. */
  settledOn: string | null;
  account: PayFromAccount | null;
  accountCurrency: string;
  parts: RMASettlementParts;
  /** The parts in PKR at the receiving rate. */
  base: RMASettlementBase;
  /** What the vendor settles, in PKR at the settle rate: "Comes back today". */
  settlesNow: number;
  /** What comes back, in the deposit account's currency. */
  comesBack: { amount: number; currency: string };
  /** PKR, where the deposit account isn't in it. */
  baseEquivalent: number | null;
  /** + gain, − loss, in PKR. */
  fxVariance: number;
}

export interface SettlementDraft {
  rateType?: RateType | undefined;
  accountId?: string | null | undefined;
}

/** The rate the vendor settled at once settled: the rates the settlement
 *  entries recorded, weighted by amount, else the settlement day's rate of
 *  the configured type (a seeded return logged none). */
function settledRate(rma: RMA, code: string, type: RateType, day: string) {
  const withRate = (rma.settlementEntries ?? []).filter((e) => e.amount > 0 && e.rate);
  if (withRate.length > 0) {
    const weight = withRate.reduce((s, e) => s + e.amount, 0);
    const rate = Math.round((withRate.reduce((s, e) => s + e.amount * e.rate!, 0) / weight) * 10_000) / 10_000;
    const last = withRate[withRate.length - 1]!;
    const recordedType = last.rateType ?? type;
    return {
      rate,
      type: recordedType,
      date: last.date.slice(0, 10),
      source: recordedType === 'corporate' ? rateOn(code, last.date, 'corporate').source : RATE_PROVIDER,
      fellBack: false,
    };
  }
  const q = rateOn(code, day, type);
  return { rate: q.rate, type: q.type, date: q.date, source: q.source, fellBack: !!q.fellBack };
}

export function returnSettlementFx(rma: RMA, draft?: SettlementDraft): ReturnSettlementFx {
  const currency = rmaCurrency(rma).toUpperCase();
  const foreign = !isBaseCurrency(currency);
  const receiving = foreign ? returnFx(rma) : null;
  const receivingRate = receiving?.rate ?? 1;
  const poRateType = rmaPORateType(rma);
  const chosenType = draft?.rateType ?? rma.settlementRateType ?? poRateType;
  const settledOn = (rma.refusedDate ?? rma.settledDate ?? null)?.slice(0, 10) ?? null;
  const locked = !!settledOn;

  const quote = !foreign
    ? { rate: 1, type: chosenType, date: settledOn ?? todayIso(), source: 'Base currency', fellBack: false }
    : locked
      ? settledRate(rma, currency, chosenType, settledOn!)
      : (() => {
          const q = rateOn(currency, todayIso(), chosenType);
          return { rate: q.rate, type: q.type, date: q.date, source: q.source, fellBack: !!q.fellBack };
        })();

  // Where it lands: the account the settlement was logged into, else the one
  // picked here, else the return's own, else 1010.
  const eligible = depositAccountsFor(currency);
  const logged = [...(rma.settlementEntries ?? [])].reverse().find((e) => e.depositedToAccountId)?.depositedToAccountId;
  const wanted = draft?.accountId !== undefined ? draft.accountId : (logged ?? rma.payToAccountId);
  const account = eligible.find((a) => a.id === wanted) ?? defaultDepositAccount(rma);
  const acctCode = accountCurrency(account);

  const parts = rmaSettlementParts(rma);
  const base = rmaSettlementBase(parts, receivingRate);
  const settlesNow = toBase(parts.settles, quote.rate);
  const inBase = isBaseCurrency(acctCode);
  return {
    currency,
    foreign,
    po: `PO-${rmaCurrencyPO(rma)}`,
    receiving,
    receivingRate,
    settleRate: quote.rate,
    poRateType,
    chosenType,
    rateType: quote.type,
    rateDate: quote.date,
    rateSource: quote.source,
    rateFellBack: quote.fellBack,
    locked,
    settledOn,
    account,
    accountCurrency: acctCode,
    parts,
    base,
    settlesNow,
    comesBack: inBase ? { amount: settlesNow, currency: BASE_CURRENCY } : { amount: parts.settles, currency: acctCode },
    baseEquivalent: inBase ? null : settlesNow,
    fxVariance: foreign ? rmaFxVariance(parts, base, quote.rate) : 0,
  };
}

/** The settle rate as the hover reads it. */
export function settlementMoneyFx(s: ReturnSettlementFx): MoneyFx {
  return {
    rate: s.settleRate,
    rateType: s.rateType,
    rateDate: s.rateDate,
    source: s.rateSource,
    dateLabel: s.locked ? 'settlement date' : 'today',
    ...(s.locked ? {} : { provisional: true, note: 'Not settled yet: at today’s rate until the vendor settles.' }),
  };
}

/* ── Linked Records ────────────────────────────────────────────────────
 * Every record's amount in PKR, each at its own rate (Currency Touchpoints
 * Map, 2026-11-24): the PO at the PO date's rate of its type, a receipt at
 * its receiving date's, an invoice at its date's and a payment at its own;
 * what the vendor settled (the credit memo, the refund) at the settlement
 * rate; the clearing journal and stock with nothing behind it at the
 * receiving rate. */

const RECORD_DATE_LABEL: Partial<Record<LinkedFinancialRecord['type'], string>> = {
  'Purchase Order': 'PO date',
  'Receiving Document': 'receiving date',
  'Vendor Invoice': 'invoice date',
  Payment: 'payment date',
};

export function linkedRecordFx(rma: RMA, record: LinkedFinancialRecord, settle: ReturnSettlementFx = returnSettlementFx(rma)): MoneyFx | null {
  if (!settle.foreign) return null;
  const code = settle.currency;
  const settledBack = record.type === 'Credit Memo' || (record.type === 'Payment' && record.id === 'rma-refund');
  if (settledBack) return settlementMoneyFx(settle);
  if (record.type === 'Reversal' || record.type === 'Unlinked') return settle.receiving;
  const type: RateType = record.type === 'Purchase Order' ? settle.poRateType : 'mid';
  const q = rateOn(code, record.date, type);
  return {
    rate: q.rate,
    rateType: q.type,
    rateDate: q.date,
    source: q.source,
    dateLabel: `${RECORD_DATE_LABEL[record.type] ?? 'record date'}, ${record.reference}`,
  };
}
