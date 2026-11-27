import * as React from 'react';
import { Info } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { getBaseCurrency, getCurrency } from './currencies';
import { FX_ARROW_PADDING, FX_CARD_CLASS, FxArrow, FxLine, FxLines } from './FxCard';
import { formatMoney, formatRateDate, rateSentence } from './moneyFormat';
import { compareRatesOn, RATE_HEX, RATE_TYPE_LABEL, RATES_READ_ON, type RateType } from './rates';

/* ── OMNE currency kit: the rate info hover ───────────────────────────
 * Mahreen, 27 Nov 2026 (PA-1), replacing the 25 Nov "Compare rates" hover:
 * an info icon right after wherever the rate type is chosen. A partner's or a
 * partner group's "Default exchange rate", and the Currency configuration
 * dialog of an order, a quote or an invoice (and the create screen where the
 * rate type is chosen there). Hover or focus shows both rates for the
 * currency to the base on a day, the gap between them, and where each comes
 * from:
 *
 *   USD to PKR today
 *   ● Daily market rate      1 USD = ₨278.5200 PKR
 *   ● Corporate rate         1 USD = ₨281.5000 PKR
 *   Gap                      ₨2.98 (1.07%)
 *   Daily market rate read on Nov 27, 2026. Corporate rate set by your
 *   company on May 01, 2026.
 *
 * Read-only, nothing for the base currency, and works inside a dialog (the
 * card sits above it). The same card the prototype modules carry as
 * components/currency/RateTypeInfo.tsx.
 *
 * Shared file. Do not edit it in a module. */

export function RateTypeInfo({
  currency,
  date,
  side = 'bottom',
  align = 'start',
}: {
  /** The partner's or the document's currency. */
  currency: string | null | undefined;
  /** The day the rates are for (a document's rate date); today when left out. */
  date?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}) {
  const base = getBaseCurrency();
  const code = (currency ?? '').toUpperCase();
  if (!code || code === base || !getCurrency(code)) return null;
  const day = (date ?? RATES_READ_ON).slice(0, 10);
  const cmp = compareRatesOn(code, day);
  const when = day === RATES_READ_ON ? 'today' : `on ${formatRateDate(day)}`;
  // A day still to come (a scheduled payment) has today's read until its own.
  const readOn = day > RATES_READ_ON ? RATES_READ_ON : day;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const label = (type: RateType) => (
    <span className="inline-flex items-center gap-[6px]">
      <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: RATE_HEX[type] }} />
      {RATE_TYPE_LABEL[type]}
    </span>
  );

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`${code} to ${base} rates`}
          onClick={stop}
          onPointerDown={stop}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 cursor-pointer transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent side={side} align={align} sideOffset={6} arrowPadding={FX_ARROW_PADDING} className={`${FX_CARD_CLASS} z-[300]`} onClick={stop}>
        <p className="text-[12px] leading-[16px]" style={{ color: '#0F1729', fontWeight: 600 }}>
          {code} to {base} {when}
        </p>
        <FxLines>
          <FxLine label={label('mid')} value={cmp.mid.rate != null ? rateSentence(code, cmp.mid.rate) : 'No rate'} />
          <FxLine label={label('corporate')} value={cmp.corporate.rate != null ? rateSentence(code, cmp.corporate.rate) : 'Not set'} />
          {cmp.difference != null && cmp.percent != null && (
            <FxLine
              label="Gap"
              value={`${cmp.difference < 0 ? '−' : ''}${formatMoney(Math.abs(cmp.difference), base)} (${Math.abs(cmp.percent).toFixed(2)}%)`}
            />
          )}
        </FxLines>
        <p className="mt-[8px] pt-[8px] border-t border-[#EEF2F6] max-w-[300px] text-[11px] leading-[15px]" style={{ color: '#48566A' }}>
          {RATE_TYPE_LABEL.mid} read on {formatRateDate(readOn)}.{' '}
          {cmp.corporate.rate != null && cmp.corporate.effectiveDate
            ? `${RATE_TYPE_LABEL.corporate} set by your company on ${formatRateDate(cmp.corporate.effectiveDate)}.`
            : `No ${RATE_TYPE_LABEL.corporate.toLowerCase()} is set for ${code}.`}
        </p>
        <FxArrow />
      </HoverCardContent>
    </HoverCard>
  );
}
