import * as React from 'react';
import { Check, Lock } from 'lucide-react';
import { getBaseCurrency } from './currencies';
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from './moneyFormat';
import { RATE_TYPE_LABEL } from './rates';
import { signedVariance, varianceHex, variancePostsTo } from './CurrencyBlock';

/* ── OMNE currency kit: the bank's rate on a foreign payment ──────────
 * Recording a foreign-currency payment, or marking a scheduled one as paid
 * (Nophil, 25 Nov 2026; Mahreen's design, 27 Nov 2026; Eli, 26 Nov 2026: a
 * payment takes the payment date's rate, and the bank's own spread goes to
 * currency gain or loss). "Our rate" fills in from the payment date; the
 * user enters the one rate the bank gave, and everything else works out
 * from it:
 *
 *   Our rate        1 AED = ₨76.1000 PKR
 *                   Daily market rate · Dec 05, 2026 · ₨754,912.00
 *   Bank's rate *   1 AED = [ 76.2500 ] PKR
 *                   Enter the exchange rate the bank gave you.
 *   Invoice booked at ₨75.8400        ₨752,332.80
 *   Bank took at ₨76.2500             ₨756,400.00
 *   Rate change since invoice          −₨2,579.20
 *   Bank's rate vs ours                −₨1,488.00
 *   FX variance                        −₨4,067.20
 *
 * From an account in a third currency (a CAD account paying a USD invoice)
 * the rates are the direct pair ("1 USD = 1.3935 CAD"), no rate through the
 * base is shown, and the breakdown is what the bank took in the account's
 * currency and the FX variance in base. From an account in the invoice's
 * currency nothing converts: only "Same currency. No exchange rate needed."
 *
 * Shared file. Do not edit it in a module. */

export function BankRateField({
  currency,
  to = getBaseCurrency(),
  amount,
  ourRate,
  invoiceRate,
  paymentDate,
  value,
  onChange,
  toBaseRate = 1,
}: {
  /** The invoice's currency. */
  currency: string;
  /** The pay-from account's currency (the base unless paying from a third currency). */
  to?: string;
  /** The amount paid, in the invoice's currency. */
  amount: number;
  /** The payment date's daily market rate: units of `to` per one `currency`. */
  ourRate: number;
  /** The invoice's booked rate, base per one `currency` (its posting date's). */
  invoiceRate: number;
  /** The payment date (ISO day). */
  paymentDate: string;
  /** The bank's rate typed; starts as our rate. */
  value: number;
  onChange: (rate: number) => void;
  /** Base per one unit of `to` on the payment date (1 for a base account). */
  toBaseRate?: number;
}) {
  const base = getBaseCurrency();
  const from = currency.toUpperCase();
  const target = to.toUpperCase();
  const [text, setText] = React.useState(() => formatRate(value).replace(/,/g, ''));
  React.useEffect(() => setText(formatRate(value).replace(/,/g, '')), [value]);

  if (from === target) {
    return (
      <p className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        Same currency. No exchange rate needed.
      </p>
    );
  }

  const isBaseAccount = target === base;
  const prefix = isBaseAccount ? moneyPrefix(base).trim() : '';
  const rateText = (r: number) => `1 ${from} = ${prefix}${formatRate(r)} ${target}`;
  const round = (n: number) => Math.round(n * 100) / 100;
  const typed = Number(text);
  const bank = Number.isFinite(typed) && typed > 0 ? typed : value;

  const booked = round(amount * invoiceRate);
  const bankTook = round(amount * bank); // in `to`
  const bankTookBase = round(bankTook * toBaseRate);
  const rateChange = round(amount * (invoiceRate - ourRate * toBaseRate));
  const spread = round(amount * (ourRate - bank) * toBaseRate);
  const variance = round(booked - bankTookBase);
  const row = (label: React.ReactNode, amountText: React.ReactNode, color?: string, strong?: boolean) => (
    <div className="flex items-baseline justify-between gap-4 text-[12px]">
      <span className={strong ? 'text-slate-700' : 'text-slate-500'} style={{ fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span className="tabular-nums" style={{ color: color ?? '#0F1729', fontWeight: strong ? 600 : 500 }}>{amountText}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-[12px] text-slate-600" style={{ fontWeight: 500 }}>Our rate</p>
        <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-[12.5px] text-slate-700 tabular-nums">
          {rateText(ourRate)}
          <Lock className="ml-auto h-3 w-3 text-slate-300" />
        </div>
        <p className="text-[11px] text-slate-500">
          {RATE_TYPE_LABEL.mid} · {formatRateDate(paymentDate)}
          {isBaseAccount ? ` · ${formatMoney(round(amount * ourRate), base)}` : ''}
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-[12px] text-slate-600" style={{ fontWeight: 500 }} htmlFor="bank-rate">
          Bank's rate <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-1.5 text-[12.5px] text-slate-700 tabular-nums">
          <span>1 {from} =</span>
          {prefix && <span>{prefix}</span>}
          <input
            id="bank-rate"
            inputMode="decimal"
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              const n = Number(text);
              if (Number.isFinite(n) && n > 0) onChange(n);
              else setText(formatRate(value).replace(/,/g, ''));
            }}
            className="h-8 w-[120px] rounded-md border border-border bg-white px-2 text-right tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          <span>{target}</span>
        </div>
        <p className="text-[11px] text-slate-500">Enter the exchange rate the bank gave you.</p>
      </div>

      <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2.5">
        {isBaseAccount ? (
          <>
            {row(`Invoice booked at ${prefix}${formatRate(invoiceRate)}`, formatMoney(booked, base))}
            {row(`Bank took at ${prefix}${formatRate(bank)}`, formatMoney(bankTook, base))}
            {row('Rate change since invoice', signedVariance(rateChange), varianceHex(rateChange))}
            {row("Bank's rate vs ours", signedVariance(spread), varianceHex(spread))}
          </>
        ) : (
          row('Bank took', formatMoney(bankTook, target))
        )}
        <div className="border-t border-slate-200 pt-1.5" title={variancePostsTo(variance) ?? undefined}>
          {row('FX variance', signedVariance(variance), varianceHex(variance), true)}
        </div>
      </div>
    </div>
  );
}
