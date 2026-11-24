import * as React from 'react';
import { Settings2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, moneyPrefix } from '@/app/currency/money';
import { RATE_TYPE_LABEL, type RateType } from '@/app/currency/rates';
import { gainLossOf } from '@/app/currency/fxVariance';
import { CurrencyFlag } from './CurrencyChip';

/* ── The currency block (Currency Touchpoints Map, 25 Nov 2026) ─────────
 * One block for every vendor invoice and payment surface: the create and
 * edit screen above Total Due, the invoice page's summary, Record Payment
 * above Total Payment and the payment page's summary. Built on Purchase
 * Orders' Currency information card (POCurrencySummary, CurrencyBlock):
 *
 *   CURRENCY INFORMATION
 *   Vendor invoiced                            🇺🇸 $10,136.20 USD
 *   You pay in                          🇵🇰 Pakistani Rupee (PKR)
 *   Base equivalent                              ₨2,833,270.62 PKR
 *   FX variance                                     −₨10,136.20   (+ gain green, − loss red)
 *   Exchange rate             1 USD = ₨279.5200 PKR [● Mid-market]
 *                                                    posting date
 *                    [ ⚙ View currency configuration ]
 *
 * "You pay in" names the pay-from account's currency (the account on
 * hover); "Base equivalent" is always shown, without a flag. No lock on the
 * rate (25 Nov 2026): the configuration becomes read-only once the document
 * posts, but the exchange rate shows no lock of its own. The rate type chip
 * sits after the rate and wraps under it in a narrow card.
 * A base-currency document keeps the short "no conversion" line instead of
 * rows. */

const RATE_HEX: Record<RateType, string> = { mid: '#7C3AED', corporate: '#B45309' };
const RATE_TINT: Record<RateType, string> = { mid: 'rgba(124,58,237,0.08)', corporate: 'rgba(180,83,9,0.10)' };

export const GAIN_HEX = '#047857';
export const LOSS_HEX = '#B91C1C';

/** "₨279.5200" */
export const baseRateText = (rate: number) => `${moneyPrefix(BASE_CURRENCY).trim()}${formatRate(rate)}`;

/** "1 USD = ₨279.5200 PKR" */
export const rateLine = (from: string, rate: number) => `1 ${from.toUpperCase()} = ${baseRateText(rate)} ${BASE_CURRENCY}`;

/** "$10,136.20 USD": an amount with its code, as the block writes it. */
export const amountWithCode = (n: number, code: string) => {
  const t = formatMoney(n, code);
  return t.includes(code) ? t : `${t} ${code}`;
};

/** "Pakistani Rupee (PKR)": a currency by name, as the block writes it. */
export const currencyNameWithCode = (code: string) => {
  const upper = code.toUpperCase();
  return `${getCurrency(upper)?.name ?? upper} (${upper})`;
};

/** "+₨4,054.48" / "−₨10,136.20" / "₨0.00": an FX variance, signed with a real minus. */
export const signedVariance = (amount: number) => {
  const k = gainLossOf(amount);
  return `${k === 'gain' ? '+' : k === 'loss' ? '−' : ''}${formatMoney(Math.abs(amount), BASE_CURRENCY)}`;
};

/** The colour an FX variance reads in: green for a gain, red for a loss. */
export const varianceHex = (amount: number) => {
  const k = gainLossOf(amount);
  return k === 'gain' ? GAIN_HEX : k === 'loss' ? LOSS_HEX : '#334155';
};

/** The mid-market / corporate chip. */
export function RateTypeChip({ type }: { type: RateType }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap"
      style={{ color: RATE_HEX[type], backgroundColor: RATE_TINT[type], fontWeight: 600 }}
    >
      <span className="inline-block w-1 h-1 rounded-full" style={{ backgroundColor: RATE_HEX[type] }} />
      {RATE_TYPE_LABEL[type]}
    </span>
  );
}

export interface CurrencyBlockRow {
  label: string;
  /** The currency the amount is in (its flag and code). */
  code: string;
  /** The amount in `code`. Leave out to show the currency itself:
   *  "Pakistani Rupee (PKR)" (the "You pay in" row). */
  amount?: number;
  /** "−" for a deduction (a prepayment). */
  sign?: '−';
  /** Shown on hover of the row, e.g. the pay-from account. */
  title?: string;
}

export interface CurrencyBlockProps {
  /** The document's currency. */
  currency: string;
  /** The rate type chip, after the rate; omitted while there's no rate. */
  rateType?: RateType | null;
  /** What the rate type chip's hover says. */
  rateTip?: React.ReactNode;
  /** Vendor invoiced / You pay in / Base equivalent…, in order. */
  rows: CurrencyBlockRow[];
  /** The FX variance row, where the document has one. */
  variance?: { amount: number; title: string; label?: string } | null;
  /** The Exchange rate row: "1 USD = ₨279.5200 PKR", the qualifier
   *  ("posting date") under it. Null rate shows `pendingText`. */
  rate?: { rate: number | null; qualifier?: string; pendingText?: string } | null;
  onViewConfig?: () => void;
  className?: string;
}

export function CurrencyBlock({ currency, rateType, rateTip, rows, variance, rate, onViewConfig, className = '' }: CurrencyBlockProps) {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  const isBase = isBaseCurrency(code);
  const chip =
    rateType &&
    (rateTip ? (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className="cursor-help shrink-0">
            <RateTypeChip type={rateType} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-[11px] z-[300]">
          {rateTip}
        </TooltipContent>
      </Tooltip>
    ) : (
      <span className="shrink-0">
        <RateTypeChip type={rateType} />
      </span>
    ));
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9.5px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: '0.06em' }}>
          Currency information
        </span>
        {/* No lock on the rate (25 Nov 2026): just the title. */}
      </div>

      {isBase ? (
        <p className="text-slate-400" style={{ fontSize: 10.5 }}>
          {BASE_CURRENCY} is the base currency, so there's no conversion.
        </p>
      ) : (
        <>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2" title={r.title}>
              <p className={`text-slate-400 shrink-0 ${r.title ? 'cursor-help' : ''}`} style={{ fontSize: 10, fontWeight: 500 }}>
                {r.label}
              </p>
              <p className="flex items-center gap-1.5 text-slate-700 tabular-nums text-right min-w-0" style={{ fontSize: 12, fontWeight: 500 }}>
                {/* A flag on the document's amount and the account's currency; the base equivalent reads plainly. */}
                {(r.amount === undefined || r.code.toUpperCase() !== BASE_CURRENCY) && <CurrencyFlag code={r.code} size={11} />}
                <span className="truncate">
                  {r.amount === undefined ? (
                    currencyNameWithCode(r.code)
                  ) : (
                    <>
                      {r.sign ?? ''}
                      {amountWithCode(r.amount, r.code)}
                    </>
                  )}
                </span>
              </p>
            </div>
          ))}
          {variance && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-slate-400 shrink-0 cursor-help" style={{ fontSize: 10, fontWeight: 500 }} title={variance.title}>
                {variance.label ?? 'FX variance'}
              </p>
              <p className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: varianceHex(variance.amount) }} title={variance.title}>
                {signedVariance(variance.amount)}
              </p>
            </div>
          )}
          {rate && (
            <div className="flex items-start justify-between gap-2">
              <p className="text-slate-400 shrink-0 pt-0.5" style={{ fontSize: 10, fontWeight: 500 }}>Exchange rate</p>
              <div className="flex flex-col items-end min-w-0">
                {rate.rate == null ? (
                  <p className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-right" style={{ fontSize: 12, fontWeight: 500 }}>
                    <span className="text-slate-400 italic" style={{ fontSize: 11, fontWeight: 400 }}>{rate.pendingText ?? 'No rate yet'}</span>
                    {chip}
                  </p>
                ) : (
                  <p className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-slate-700 tabular-nums text-right" style={{ fontSize: 12, fontWeight: 500 }}>
                    <span className="whitespace-nowrap">{rateLine(code, rate.rate)}</span>
                    {chip}
                  </p>
                )}
                {rate.rate != null && rate.qualifier && (
                  <p className="text-slate-400 text-right" style={{ fontSize: 10 }}>{rate.qualifier}</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {onViewConfig && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onViewConfig}
            className="mt-1 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border bg-white text-[12px] text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Settings2 className="w-3.5 h-3.5" />
            View currency configuration
          </button>
        </div>
      )}
    </div>
  );
}

/* ── What each block's FX variance says ───────────────────────────────── */

export const INVOICE_FX_VARIANCE_TITLE =
  'Receiving booked the goods at the receiving-date rate; this invoice converts them at the posting-date rate. Paying less in the base currency is a gain (+) and posts to FX Gain; paying more is a loss (−) and posts to FX Loss.';

export const PAYMENT_FX_VARIANCE_TITLE =
  "What A/P carried at the invoice's rate against what this payment cost in the base currency. Costing less is a gain (+) and posts to FX Gain; costing more is a loss (−) and posts to FX Loss.";

/** A small hover-free account line: flag, "1010 · JPMorgan Operating", code. */
export function AccountName({ label, currency, size = 12 }: { label: string; currency: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <CurrencyFlag code={currency} size={size} />
      <span className="truncate">{label}</span>
      <span className="text-slate-500 shrink-0" style={{ fontWeight: 600 }}>· {currency}</span>
    </span>
  );
}
