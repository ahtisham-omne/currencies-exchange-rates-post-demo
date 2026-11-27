import * as React from 'react';
import { Info } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import { FX_ARROW_PADDING, FX_CARD_CLASS, FxArrow, FxLine, FxLines } from './FxCard';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from '@/app/currency/money';
import { RATES_READ_ON, RATE_TYPE_LABEL, corporateRateOn, midRateOn, type RateType } from '@/app/currency/rates';

/* ── The rate info hover (Mahreen, 27 Nov 2026, PA-1) ─────────────────
 * An info icon next to wherever the rate type is picked: a partner's or a
 * group's "Default exchange rate", and the Currency configuration dialog of
 * an order or invoice. Hover or focus shows both rates for the currency to
 * the base on a day, the gap between them, and where each comes from:
 *
 *   USD to PKR today
 *   ● Daily market rate      1 USD = ₨278.5200 PKR
 *   ● Corporate rate         1 USD = ₨281.5000 PKR
 *   Gap                      ₨2.98 (1.07%)
 *   Daily market rate read on Nov 27, 2026. Corporate rate set by your
 *   company on May 01, 2026.
 *
 * Read-only. Nothing for the base currency. It replaces the 25 Nov "Compare
 * rates" hover (ArrowLeftRight). Built from FxCard, so it looks like every
 * other currency card. Each module carries a copy of this file; keep them
 * identical. */

const MUTED = '#48566A';
const RATE_DOT: Record<RateType, string> = { mid: '#7C3AED', corporate: '#B45309' };

/** "1 USD = ₨278.5200 PKR" */
const rateText = (code: string, rate: number) => `1 ${code} = ${moneyPrefix(BASE_CURRENCY)}${formatRate(rate)} ${BASE_CURRENCY}`;

function RateLabel({ type }: { type: RateType }) {
  return (
    <span className="inline-flex items-center gap-[6px]">
      <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: RATE_DOT[type] }} />
      {RATE_TYPE_LABEL[type]}
    </span>
  );
}

export function RateTypeInfo({
  currency,
  date = RATES_READ_ON,
  side = 'bottom',
  align = 'start',
  className = '',
}: {
  /** The partner's or the document's currency. */
  currency: string | null | undefined;
  /** The day the rates are for (a document's rate date); today by default. */
  date?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  const code = (currency ?? '').toUpperCase();
  if (!code || isBaseCurrency(code)) return null;
  const day = (date || RATES_READ_ON).slice(0, 10);
  const mid = midRateOn(code, day);
  const corp = corporateRateOn(code, day);
  const when = day === RATES_READ_ON ? 'today' : `on ${formatRateDate(day)}`;
  // A day still to come (a scheduled payment) has today's read until its own.
  const readOn = day > RATES_READ_ON ? RATES_READ_ON : day;
  const gap = mid != null && corp ? corp.rate - mid : null;
  const gapPct = gap != null && mid ? (Math.abs(gap) / mid) * 100 : 0;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`${code} to ${BASE_CURRENCY} rates`}
          onClick={stop}
          onPointerDown={stop}
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 cursor-pointer transition-colors ${className}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={6}
        arrowPadding={FX_ARROW_PADDING}
        className={`${FX_CARD_CLASS} z-[300]`}
        onClick={stop}
        /* Sales Orders' HoverCardContent draws its own pointer unless it is
           given one, so FxArrow goes in `arrow` here (the one change from
           Purchase Orders' copy). */
        arrow={<FxArrow />}
      >
        <p className="text-[12px] leading-[16px]" style={{ color: '#0F1729', fontWeight: 600 }}>
          {code} to {BASE_CURRENCY} {when}
        </p>
        <FxLines>
          <FxLine label={<RateLabel type="mid" />} value={mid != null ? rateText(code, mid) : 'No rate'} />
          <FxLine label={<RateLabel type="corporate" />} value={corp ? rateText(code, corp.rate) : 'Not set'} />
          {gap != null && (
            <FxLine
              label="Gap"
              value={`${gap < 0 ? '−' : ''}${formatMoney(Math.abs(gap), BASE_CURRENCY)} (${gapPct.toFixed(2)}%)`}
            />
          )}
        </FxLines>
        <p className="mt-[8px] pt-[8px] border-t border-[#EEF2F6] max-w-[300px] text-[11px] leading-[15px]" style={{ color: MUTED }}>
          {RATE_TYPE_LABEL.mid} read on {formatRateDate(readOn)}.{' '}
          {corp
            ? `${RATE_TYPE_LABEL.corporate} set by your company on ${formatRateDate(corp.effectiveDate)}.`
            : `No ${RATE_TYPE_LABEL.corporate.toLowerCase()} is set for ${code}.`}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
