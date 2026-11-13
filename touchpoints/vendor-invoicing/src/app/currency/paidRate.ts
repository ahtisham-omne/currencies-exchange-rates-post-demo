import { isBaseCurrency } from './currencies';
import { formatRateDate, rateSentence } from './money';

/* ── A prepayment's paid rate (Currency & Exchange Rates) ─────────────
 * A pre-invoice posts when it is paid, so its prepayment carries the rate of
 * that day. Wherever the prepayment is applied to an invoice, the rate it
 * was paid at is shown beside it. Whether that rate stays locked for the
 * amount it covers is still to be decided, so this only shows it. */

export interface PaidRate {
  /** Base currency per one unit, the pre-invoice's rate when it was paid. */
  rate?: number;
  /** The day it was paid (the rate's day). */
  rateDate?: string;
}

/** "Paid at 1 AED = 75.8400 PKR · Nov 08, 2026", or null with nothing to say. */
export function paidRateText(currency: string | undefined, p: PaidRate | undefined): string | null {
  if (!currency || isBaseCurrency(currency) || !p?.rate) return null;
  return `Paid at ${rateSentence(currency, p.rate)}${p.rateDate ? ` · ${formatRateDate(p.rateDate)}` : ''}`;
}
