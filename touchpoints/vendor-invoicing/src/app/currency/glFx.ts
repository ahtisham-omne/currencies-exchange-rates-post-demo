import type { GlEntryLine, GlRow, InvoiceGlResult } from '@/app/lib/glPosting';
import { FX_VARIANCE_ACCOUNT } from '@/app/data/glAccounts';
import { splitAccount } from '@/app/lib/glPosting';
import { isBaseCurrency } from './currencies';
import { accrualDescription, fxVarianceDescription, gainLossOf, type FxVariance, type LockedPrepayment } from './fxVariance';
import { formatRateDate, rateSentence } from './money';
import { toBase } from './rates';

/* ── The invoice journal in the base currency (spec 4.4) ──────────────
 * buildInvoiceGl works in the invoice's currency. The ledger is kept in the
 * base currency, so every line posts at the invoice's rate: A/P is credited
 * with the base amount a later payment is compared against. Lines convert
 * one by one; the cent rounding can leave goes to the largest debit, so the
 * entry still balances. Each line keeps its invoice-currency amount.
 *
 * postInvoiceGl adds the receiving side (currency/fxVariance.ts): the AP
 * Accrual clears at what receiving booked, an applied prepayment clears
 * Advance Payments at its locked rate, A/P takes the unpaid rest at the
 * invoice rate, and the rate difference on the goods posts to FX Variance. */

export interface BaseGlRow extends GlRow {
  /** The line in the invoice's currency (none on FX Variance, which only
   *  exists in base). */
  foreignAmount?: number;
}

export interface BaseGl {
  debits: BaseGlRow[];
  credits: BaseGlRow[];
  balanced: boolean;
  /** The invoice's currency and the rate the lines were posted at. */
  currency: string;
  rate: number;
  /** The rate difference on received goods, when there is one to show. */
  variance?: FxVariance | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const total = (rows: GlRow[]) => round2(rows.reduce((s, r) => s + r.amount, 0));

export function glInBase(gl: InvoiceGlResult, rate: number, currency: string): BaseGl {
  const convert = (r: GlRow): BaseGlRow => ({ ...r, amount: toBase(r.amount, rate), foreignAmount: r.amount });
  const debits = gl.debits.map(convert);
  const credits = gl.credits.map(convert);
  const diff = round2(total(credits) - total(debits));
  if (gl.balanced && debits.length > 0 && Math.abs(diff) >= 0.005) {
    const largest = debits.reduce((best, r, i) => (r.amount > debits[best].amount ? i : best), 0);
    debits[largest] = { ...debits[largest], amount: round2(debits[largest].amount + diff) };
  }
  return { debits, credits, balanced: gl.balanced, currency, rate };
}

/** The roles a prepayment past the goods value can cover: valued at its
 *  locked rate rather than the invoice's, so it never makes a variance. */
const COVERABLE = new Set(['charge', 'priceVariance', 'qtyVariance', 'inventory', 'expense', undefined]);

/**
 * The invoice journal in base, with receiving's values and the FX Variance:
 *  - Dr AP Accrual (received, not invoiced) at what receiving booked: the
 *    prepaid part at each prepayment's locked rate, the rest at each
 *    receiving date's rate (`variance.receivedBase`).
 *  - Cr Advance Payments for the applied prepayments, each at its locked rate.
 *  - Cr Accounts Payable for the unpaid rest at the invoice rate.
 *  - Cr FX Variance (gain) or Dr FX Variance (loss) for the rate difference
 *    on the unpaid rest, described with both rates and both dates.
 *  - Price and quantity variances, freight and charges at the invoice rate.
 * Without receivings (or in the base currency) it is glInBase plus the
 * prepayment's locked rate.
 */
export function postInvoiceGl(
  gl: InvoiceGlResult,
  fx: { currency: string; rate: number; variance?: FxVariance | null; prepayments?: LockedPrepayment[] },
): BaseGl {
  const { currency, rate } = fx;
  const foreign = !isBaseCurrency(currency);
  const variance = foreign ? fx.variance ?? null : null;
  const plain = (r: GlRow): BaseGlRow => ({ ...r, amount: toBase(r.amount, rate), foreignAmount: r.amount });

  // The applied prepayments, in order, up to what the advance row carries.
  const advanceRow = gl.credits.find((r) => r.role === 'advance');
  let advanceLeft = advanceRow?.amount ?? 0;
  const applied = (fx.prepayments ?? [])
    .map((p) => {
      const amount = round2(Math.min(p.amount, advanceLeft));
      advanceLeft = round2(advanceLeft - amount);
      return { ...p, amount, base: toBase(amount, foreign ? p.rate : 1) };
    })
    .filter((p) => p.amount > 0.004);
  // Any of the advance not matched to a prepayment (none in practice) stays at the invoice rate.
  const advanceBase = round2(applied.reduce((s, p) => s + p.base, 0) + toBase(Math.max(0, advanceLeft), rate));

  const describe = (r: GlRow): string | undefined => {
    if (r.description) return r.description;
    if (r.role === 'advance' && applied.length > 0) {
      return applied
        .map((p) =>
          foreign
            ? `${p.invoiceNumber} applied at ${rateSentence(currency, p.rate)}, its rate when paid${p.rateDate ? ` (${formatRateDate(p.rateDate)})` : ''}`
            : `${p.invoiceNumber} applied`,
        )
        .join(' · ');
    }
    if (r.role === 'accrual' && variance) return accrualDescription(variance);
    if (r.role === 'payable' && foreign) {
      return `${advanceRow ? 'The unpaid rest at' : 'At'} the invoice rate, ${rateSentence(currency, rate)}`;
    }
    if (r.role === 'priceVariance') return 'Invoice price differs from the PO price receiving booked';
    return undefined;
  };

  const convert = (r: GlRow): BaseGlRow => {
    const row = plain(r);
    if (r.role === 'accrual' && variance) row.amount = variance.receivedBase;
    if (r.role === 'advance') row.amount = advanceBase;
    const description = describe(r);
    return description ? { ...row, description } : row;
  };
  const debits = gl.debits.map(convert);
  const credits = gl.credits.map(convert);

  // A prepayment past the goods value covers charges or a price difference:
  // those debits take its locked rate for the part it covers.
  if (variance && variance.prepaidBeyond.length > 0) {
    const beyondForeign = round2(variance.prepaidBeyond.reduce((s, p) => s + p.amount, 0));
    const shift = round2(variance.prepaidBeyond.reduce((s, p) => s + p.base, 0) - toBase(beyondForeign, rate));
    const targets = debits.map((r, i) => ({ r, i })).filter(({ r }) => COVERABLE.has(r.role) && (r.foreignAmount ?? 0) > 0);
    const weight = targets.reduce((s, t) => s + (t.r.foreignAmount ?? 0), 0);
    let used = 0;
    targets.forEach(({ r, i }, k) => {
      const share = k === targets.length - 1 ? round2(shift - used) : round2((shift * (r.foreignAmount ?? 0)) / weight);
      used = round2(used + share);
      debits[i] = { ...r, amount: round2(r.amount + share) };
    });
  }

  // The rate difference on the goods: a gain credits FX Variance, a loss debits it.
  const kind = variance ? gainLossOf(variance.amount) : 'none';
  if (variance && kind !== 'none') {
    const row: BaseGlRow = {
      ...splitAccount(FX_VARIANCE_ACCOUNT),
      amount: Math.abs(variance.amount),
      role: 'fxVariance',
      description: fxVarianceDescription(variance),
    };
    (kind === 'gain' ? credits : debits).push(row);
  }

  // Cent rounding: onto the FX Variance line when there is one, else the
  // largest debit that isn't a fixed value (the accrual is what receiving
  // booked, the advance what was paid).
  const diff = round2(total(credits) - total(debits));
  if (gl.balanced && Math.abs(diff) >= 0.005) {
    const fxCredit = credits.findIndex((r) => r.role === 'fxVariance');
    const fxDebit = debits.findIndex((r) => r.role === 'fxVariance');
    if (fxCredit >= 0) credits[fxCredit] = { ...credits[fxCredit], amount: round2(credits[fxCredit].amount - diff) };
    else if (fxDebit >= 0) debits[fxDebit] = { ...debits[fxDebit], amount: round2(debits[fxDebit].amount + diff) };
    else if (debits.length > 0) {
      const pool = debits.map((r, i) => ({ r, i })).filter(({ r }) => r.role !== 'accrual');
      const from = pool.length > 0 ? pool : debits.map((r, i) => ({ r, i }));
      const largest = from.reduce((best, t) => (t.r.amount > best.r.amount ? t : best), from[0]).i;
      debits[largest] = { ...debits[largest], amount: round2(debits[largest].amount + diff) };
    }
  }
  return { debits, credits, balanced: gl.balanced, currency, rate, variance };
}

/** The persisted snapshot: base amounts, each line keeping its invoice-currency amount and the rate. */
export function baseGlEntries(gl: BaseGl, description?: string): GlEntryLine[] {
  const foreign = isBaseCurrency(gl.currency) ? {} : { currency: gl.currency, rate: gl.rate };
  const line = (r: BaseGlRow) => ({
    accountCode: r.code,
    accountName: r.name,
    description: r.description ?? description,
    ...(isBaseCurrency(gl.currency) || r.foreignAmount == null ? {} : { foreignAmount: r.foreignAmount }),
    ...foreign,
  });
  return [...gl.debits.map((r) => ({ ...line(r), debit: r.amount })), ...gl.credits.map((r) => ({ ...line(r), credit: r.amount }))];
}

