import * as React from 'react';
import { getBaseCurrency } from './currencies';
import { formatRate, moneyPrefix } from './moneyFormat';
import { signedVariance, varianceHex, variancePostsTo } from './CurrencyBlock';

/* ── OMNE currency kit: the rate the bank used ────────────────────────
 * Nophil, 25 Nov 2026: a scheduled foreign-currency payment is estimated
 * at the rate set up (mid-market or corporate). When it is marked as paid,
 * ask for the bank's actual rate in one field, pre-filled with the
 * estimate; the difference posts to FX Gain or FX Loss. Not asked when the
 * account and the invoice are in the same currency (render nothing then).
 * Open: spec Part 3.5 (Eli, 8 Apr 2026) allows changing a rate on a
 * transaction only when the company uses corporate rates. The BA's document
 * says whether this field shows for a mid-market company.
 *
 *   Rate the bank used
 *   1 USD = ₨ [ 279.1000 ] PKR
 *   Estimate was ₨278.5200. FX Loss −₨5,800.00 posts to FX Loss.
 *
 * Shared file. Do not edit it in a module. */

export function BankRateField({
  currency,
  to = getBaseCurrency(),
  amount,
  estimateRate,
  value,
  onChange,
  toBaseRate = 1,
  hidden = false,
}: {
  /** The invoice's currency. */
  currency: string;
  /** The account's currency (base unless paying from a third currency). */
  to?: string;
  /** The amount paid, in the invoice's currency. */
  amount: number;
  /** The scheduled payment's estimated rate (units of `to` per 1 `currency`). */
  estimateRate: number;
  /** The rate typed; starts as the estimate. */
  value: number;
  onChange: (rate: number) => void;
  /** Base per one unit of `to`, to state the gain or loss in base (1 for a base account). */
  toBaseRate?: number;
  /** True when the account and the invoice share a currency. */
  hidden?: boolean;
}) {
  const [text, setText] = React.useState(() => formatRate(value).replace(/,/g, ''));
  React.useEffect(() => setText(formatRate(value).replace(/,/g, '')), [value]);
  if (hidden || currency.toUpperCase() === to.toUpperCase()) return null;
  // Paying fewer units than estimated is a gain.
  const fx = Math.round(amount * (estimateRate - value) * toBaseRate * 100) / 100;
  const posts = variancePostsTo(fx);
  const target = to.toUpperCase();
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] text-slate-600" style={{ fontWeight: 500 }} htmlFor="bank-rate">
        Rate the bank used
      </label>
      <div className="flex items-center gap-1.5 text-[12.5px] text-slate-700 tabular-nums">
        <span>1 {currency.toUpperCase()} =</span>
        <span>{moneyPrefix(target).trim()}</span>
        <input
          id="bank-rate"
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = Number(text);
            if (Number.isFinite(n) && n > 0) onChange(n);
            else setText(formatRate(value).replace(/,/g, ''));
          }}
          className="h-8 w-[110px] rounded-md border border-border bg-white px-2 text-right tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
        />
        <span>{target}</span>
      </div>
      <p className="text-[11px] text-slate-500">Pre-filled with the estimate. Enter the rate on your bank statement.</p>
      <p className="text-[11px] text-slate-500">
        Estimate was {moneyPrefix(target).trim()}
        {formatRate(estimateRate)}.{' '}
        {posts ? (
          <>
            <span className="tabular-nums" style={{ color: varianceHex(fx), fontWeight: 600 }}>{signedVariance(fx)}</span> {posts}.
          </>
        ) : (
          'No FX gain or loss.'
        )}
      </p>
    </div>
  );
}
