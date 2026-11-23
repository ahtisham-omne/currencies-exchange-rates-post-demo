import * as React from 'react';
import { Lock, LockOpen, Settings2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, moneyPrefix } from '@/app/currency/money';
import { RATE_TYPE_LABEL, type RateType } from '@/app/currency/rates';
import { gainLossOf } from '@/app/currency/fxVariance';
import { CurrencyFlag } from './CurrencyChip';

/* ── The currency block (Currency Touchpoints Map, 24 Nov 2026) ─────────
 * One block for every vendor invoice and payment surface: the create and
 * edit screen above Total Due, the invoice page's summary, Record Payment
 * above Total Payment and the payment page's summary. Built on Purchase
 * Orders' summary card (POCurrencySummary):
 *
 *   CURRENCY                          [● Mid-market] [Unlocked]
 *   Vendor invoiced                   $10,136.20 USD
 *   You pay                           ₨2,833,270.62 PKR
 *   Base equivalent                   ₨2,833,270.62 PKR   (paying from a non-base account)
 *   FX variance                       −₨10,136.20          (+ gain green, − loss red)
 *   ───────────────────────────────────────────
 *   Rate                1 USD = ₨279.5200 PKR · posting date
 *                                           ⚙ View configuration
 *
 * The lock chip is always shown on a foreign-currency document: Locked
 * (green) once it posts, Unlocked (amber) until then, its title saying
 * when it locks. A base-currency document keeps the short "no conversion"
 * line instead of rows. */

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

/** [🔒 Locked] green, or [🔓 Unlocked] amber; `title` says when it locks. */
export function LockChip({ locked, title }: { locked: boolean; title?: string }) {
  const Icon = locked ? Lock : LockOpen;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap cursor-default"
      style={locked ? { color: '#047857', backgroundColor: '#ECFDF5', fontWeight: 600 } : { color: '#92400E', backgroundColor: '#FFFBEB', fontWeight: 600 }}
      title={title}
    >
      <Icon className="w-2.5 h-2.5" />
      {locked ? 'Locked' : 'Unlocked'}
    </span>
  );
}

export interface CurrencyBlockRow {
  label: string;
  /** The currency the amount is in (its flag and code). */
  code: string;
  amount: number;
  /** "−" for a deduction (a prepayment). */
  sign?: '−';
  /** A hover note on the label. */
  title?: string;
}

export interface CurrencyBlockProps {
  /** The document's currency. */
  currency: string;
  /** The rate type chip; omitted while there's no rate. */
  rateType?: RateType | null;
  /** What the rate type chip's hover says. */
  rateTip?: React.ReactNode;
  /** The lock chip. Shown on a foreign-currency document only. */
  lock?: { locked: boolean; title: string } | null;
  /** Vendor invoiced / You pay / Base equivalent…, in order. */
  rows: CurrencyBlockRow[];
  /** The FX variance row, where the document has one. */
  variance?: { amount: number; title: string; label?: string } | null;
  /** The Rate row: "1 USD = ₨279.5200 PKR · posting date". Null rate shows `pendingText`. */
  rate?: { rate: number | null; qualifier?: string; pendingText?: string } | null;
  onViewConfig?: () => void;
  className?: string;
}

export function CurrencyBlock({ currency, rateType, rateTip, lock, rows, variance, rate, onViewConfig, className = '' }: CurrencyBlockProps) {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  const isBase = isBaseCurrency(code);
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9.5px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: '0.06em' }}>
          Currency
        </span>
        {!isBase && (
          <div className="flex items-center gap-1.5">
            {rateType &&
              (rateTip ? (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <RateTypeChip type={rateType} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-[11px] z-[300]">
                    {rateTip}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <RateTypeChip type={rateType} />
              ))}
            {lock && <LockChip locked={lock.locked} title={lock.title} />}
          </div>
        )}
      </div>

      {isBase ? (
        <p className="text-slate-400" style={{ fontSize: 10.5 }}>
          {BASE_CURRENCY} is the base currency, so there's no conversion.
        </p>
      ) : (
        <>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2">
              <p className={`text-slate-400 shrink-0 ${r.title ? 'cursor-help' : ''}`} style={{ fontSize: 10, fontWeight: 500 }} title={r.title}>
                {r.label}
              </p>
              <p className="flex items-center gap-1.5 text-slate-700 tabular-nums min-w-0" style={{ fontSize: 12, fontWeight: 500 }}>
                <CurrencyFlag code={r.code} size={11} />
                <span className="truncate">
                  {r.sign ?? ''}
                  {amountWithCode(r.amount, r.code)}
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
            <div className="border-t border-slate-100 pt-2 flex items-start justify-between gap-2">
              <p className="text-slate-400 shrink-0" style={{ fontSize: 10, fontWeight: 500 }}>Rate</p>
              {rate.rate == null ? (
                <p className="text-slate-400 italic text-right" style={{ fontSize: 11 }}>{rate.pendingText ?? 'No rate yet'}</p>
              ) : (
                <p className="text-slate-500 tabular-nums text-right" style={{ fontSize: 11 }}>
                  {rateLine(code, rate.rate)}
                  {rate.qualifier ? <span className="text-slate-400"> · {rate.qualifier}</span> : null}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {onViewConfig && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onViewConfig}
            className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 hover:text-primary cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Settings2 className="w-3 h-3" />
            View configuration
          </button>
        </div>
      )}
    </div>
  );
}

/* ── What each block's lock chip and FX variance say ─────────────────── */

export const INVOICE_LOCK_TITLE = {
  locked: 'Locked when the invoice posted, at the posting-date rate.',
  unlocked: 'Locks when the invoice posts.',
};

export const PAYMENT_LOCK_TITLE = {
  locked: 'Locked when the payment posted.',
  unlocked: 'Locks when the payment posts.',
};

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
