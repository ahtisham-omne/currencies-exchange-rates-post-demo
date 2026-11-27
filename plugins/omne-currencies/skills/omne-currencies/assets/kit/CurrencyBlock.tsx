import * as React from 'react';
import { Info, Settings2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { currencyLabel, getBaseCurrency, isBaseCurrency } from './currencies';
import { formatMoney, formatMoneyWithCode, rateSentence } from './moneyFormat';
import type { RateType } from './rates';
import { CurrencyFlag } from './CurrencyChip';
import { RateTypeChip } from './RateType';

/* ── OMNE currency kit: the Currency information block ────────────────
 * One block for a document's currency summary, at the end of its Order
 * Summary (or above Total Due / Total Payment on a create screen):
 *
 *   CURRENCY INFORMATION
 *   Vendor receives                            🇺🇸 $10,136.20 USD
 *   You pay in                          🇵🇰 Pakistani Rupee (PKR)
 *   Base equivalent                              ₨2,833,270.62 PKR
 *   FX variance                                     −₨10,136.20
 *   Exchange rate             1 USD = ₨279.5200 PKR [● Mid-market]
 *                                                       PO date
 *                    [ ⚙ View currency configuration ]
 *
 * Rows are the document's own (the BA's document names them). The base
 * equivalent reads plainly, without a flag. FX variance is green with + for
 * a gain, red with − for a loss. No lock on the block: the configuration
 * dialog shows it (LockLine). A base-currency document gets the one-line
 * "PKR is the base currency, so there's no conversion." instead of rows.
 *
 * Shared file. Do not edit it in a module. */

export const GAIN_HEX = '#047857';
export const LOSS_HEX = '#B91C1C';

export type GainLoss = 'gain' | 'loss' | 'none';

/** + is a gain (it cost less in base), − a loss. Under half a minor unit is none. */
export const gainLossOf = (amount: number): GainLoss => (Math.abs(amount) < 0.005 ? 'none' : amount > 0 ? 'gain' : 'loss');

/** "+₨4,054.48" / "−₨10,136.20" / "₨0.00": an FX variance in base, signed with a real minus. */
export function signedVariance(amount: number): string {
  const k = gainLossOf(amount);
  return `${k === 'gain' ? '+' : k === 'loss' ? '−' : ''}${formatMoney(Math.abs(amount), getBaseCurrency())}`;
}

/** The colour an FX variance reads in. */
export const varianceHex = (amount: number) => {
  const k = gainLossOf(amount);
  return k === 'gain' ? GAIN_HEX : k === 'loss' ? LOSS_HEX : '#334155';
};

/** "posts to FX Gain" / "posts to FX Loss" / null. */
export function variancePostsTo(amount: number): string | null {
  const k = gainLossOf(amount);
  return k === 'gain' ? 'posts to FX Gain' : k === 'loss' ? 'posts to FX Loss' : null;
}

export interface CurrencyBlockRow {
  /** "Vendor receives", "You pay in", "Base equivalent", "Customer pays". */
  label: string;
  /** The currency the amount is in (its flag and code). */
  code: string;
  /** The amount in `code`. Leave out to name the currency itself:
   *  "Pakistani Rupee (PKR)" (the "You pay in" row). */
  amount?: number;
  /** "≈" for an estimate, "−" for a deduction (a prepayment). */
  prefix?: '≈' | '−';
  /** Shown on hover of the row, e.g. the pay-from account. */
  title?: string;
}

export interface CurrencyBlockProps {
  /** The document's currency. */
  currency: string;
  rateType?: RateType | null;
  /** What the rate type chip's hover says. */
  rateTip?: React.ReactNode;
  rows: CurrencyBlockRow[];
  /** The FX variance row, where the document has one. */
  variance?: { amount: number; label?: string; tip?: React.ReactNode } | null;
  /** The Exchange rate row and what its day is ("PO date", "posting date").
   *  A null rate shows `pendingText`. `to` writes a direct cross rate
   *  (paying from a third-currency account): "1 USD = C$1.3935 CAD". */
  rate?: { rate: number | null; qualifier?: string; pendingText?: string; to?: string } | null;
  onViewConfig?: () => void;
  className?: string;
}

export function CurrencyBlock({ currency, rateType, rateTip, rows, variance, rate, onViewConfig, className = '' }: CurrencyBlockProps) {
  const base = getBaseCurrency();
  const code = (currency || base).toUpperCase();
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
      <span className="block text-[9.5px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: '0.06em' }}>
        Currency information
      </span>

      {isBaseCurrency(code) ? (
        <p className="text-slate-400" style={{ fontSize: 10.5 }}>
          {base} is the base currency, so there's no conversion.
        </p>
      ) : (
        <>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2" title={r.title}>
              <p className={`text-slate-400 shrink-0 ${r.title ? 'cursor-help' : ''}`} style={{ fontSize: 10, fontWeight: 500 }}>
                {r.label}
              </p>
              <p className="flex items-center gap-1.5 text-slate-700 tabular-nums text-right min-w-0" style={{ fontSize: 12, fontWeight: 500 }}>
                {(r.amount === undefined || !isBaseCurrency(r.code)) && <CurrencyFlag code={r.code} size={11} />}
                <span className="truncate">
                  {r.amount === undefined ? (
                    currencyLabel(r.code)
                  ) : (
                    <>
                      {r.prefix ? `${r.prefix} ` : ''}
                      {formatMoneyWithCode(r.amount, r.code)}
                    </>
                  )}
                </span>
              </p>
            </div>
          ))}
          {variance && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-slate-400 shrink-0 inline-flex items-center gap-1" style={{ fontSize: 10, fontWeight: 500 }}>
                {variance.label ?? 'FX variance'}
                {variance.tip && (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="inline-flex cursor-help text-slate-400 hover:text-slate-600" aria-label="What is FX variance?">
                        <Info className="w-3 h-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px] text-[11px] z-[300]">
                      {variance.tip}
                    </TooltipContent>
                  </Tooltip>
                )}
              </p>
              <p className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: varianceHex(variance.amount) }} title={variancePostsTo(variance.amount) ?? undefined}>
                {signedVariance(variance.amount)}
              </p>
            </div>
          )}
          {rate && (
            <div className="flex items-start justify-between gap-2">
              <p className="text-slate-400 shrink-0 pt-0.5" style={{ fontSize: 10, fontWeight: 500 }}>Exchange rate</p>
              <div className="flex flex-col items-end min-w-0">
                <p className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-slate-700 tabular-nums text-right" style={{ fontSize: 12, fontWeight: 500 }}>
                  {rate.rate == null ? (
                    <span className="text-slate-400 italic" style={{ fontSize: 11, fontWeight: 400 }}>{rate.pendingText ?? 'No rate yet'}</span>
                  ) : (
                    <span className="whitespace-nowrap">{rateSentence(code, rate.rate, rate.to ?? base)}</span>
                  )}
                  {chip}
                </p>
                {rate.rate != null && rate.qualifier && <p className="text-slate-400 text-right" style={{ fontSize: 10 }}>{rate.qualifier}</p>}
              </div>
            </div>
          )}
        </>
      )}

      {onViewConfig && (
        <button
          type="button"
          onClick={onViewConfig}
          className="mt-1 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border bg-white text-[12px] text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <Settings2 className="w-3.5 h-3.5" />
          View currency configuration
        </button>
      )}
    </div>
  );
}
