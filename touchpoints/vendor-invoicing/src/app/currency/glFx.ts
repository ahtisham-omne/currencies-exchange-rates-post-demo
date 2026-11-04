import type { GlEntryLine, GlRow, InvoiceGlResult } from '@/app/lib/glPosting';
import { isBaseCurrency } from './currencies';
import { toBase } from './rates';

/* ── The invoice journal in the base currency (spec 4.4) ──────────────
 * buildInvoiceGl works in the invoice's currency. The ledger is kept in the
 * base currency, so every line posts at the invoice's rate: A/P is credited
 * with the base amount a later payment is compared against. Lines convert
 * one by one; the cent rounding can leave goes to the largest debit, so the
 * entry still balances. Each line keeps its invoice-currency amount. */

export interface BaseGlRow extends GlRow {
  /** The line in the invoice's currency. */
  foreignAmount: number;
}

export interface BaseGl {
  debits: BaseGlRow[];
  credits: BaseGlRow[];
  balanced: boolean;
  /** The invoice's currency and the rate the lines were posted at. */
  currency: string;
  rate: number;
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

/** The persisted snapshot: base amounts, each line keeping its invoice-currency amount and the rate. */
export function baseGlEntries(gl: BaseGl, description?: string): GlEntryLine[] {
  const foreign = isBaseCurrency(gl.currency) ? {} : { currency: gl.currency, rate: gl.rate };
  return [
    ...gl.debits.map((r) => ({
      accountCode: r.code,
      accountName: r.name,
      description,
      debit: r.amount,
      ...(isBaseCurrency(gl.currency) ? {} : { foreignAmount: r.foreignAmount }),
      ...foreign,
    })),
    ...gl.credits.map((r) => ({
      accountCode: r.code,
      accountName: r.name,
      description,
      credit: r.amount,
      ...(isBaseCurrency(gl.currency) ? {} : { foreignAmount: r.foreignAmount }),
      ...foreign,
    })),
  ];
}
