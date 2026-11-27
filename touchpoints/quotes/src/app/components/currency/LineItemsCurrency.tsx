import * as React from 'react';
import { ArrowLeftRight, Globe } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, formatRateDate, moneyPrefix } from '@/app/currency/money';
import { RATE_TYPE_LABEL, toBase, type RateType } from '@/app/currency/rates';
import { currencyChipLabel } from './CurrencyChip';
import { FX_ARROW_PADDING, FX_CARD_CLASS, FxArrow, FxLine, FxLines } from './FxCard';
import { useDocCurrency } from './docCurrencyContext';

/* ── The line items card's currency (Mahreen, 27 Nov 2026, SO-2) ──────
 * Three pieces, from the document's currency and rate (docCurrencyContext),
 * none of them on a quote in the base currency:
 *  - "🌐 Prices in USD" after the Line Items title: the currency the
 *    quote's prices are kept in, whichever one the page shows them in.
 *    The brand-tint chip Purchase Orders uses (VendorCurrencyTag, variant 1).
 *  - "Exchange rate: daily market rate · 1 USD = ₨278.5200" on the right of
 *    the card's header: the rate type once for the quote, not on each line.
 *  - The convert icon next to the line items' Total, whose hover gives the
 *    total in base at the quote's rate, the rate type, rate and rate date,
 *    and that it is an estimate: nothing posts from a quote.
 * The Sales Orders app has the same look. */

const INK = '#0F1729';
const MUTED = '#48566A';
const RATE_DOT: Record<RateType, string> = { mid: '#7C3AED', corporate: '#B45309' };

const CHIP =
  'inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] leading-[16px] border shrink-0 cursor-default bg-[#EDF4FF] text-[#0A77FF] border-[#0A77FF]/20';

/** "1 USD = ₨278.5200" */
const rateText = (code: string, rate: number) => `1 ${code} = ${moneyPrefix(BASE_CURRENCY)}${formatRate(rate)}`;

/** "🌐 Prices in USD": nothing on a base-currency quote. */
export function PricesInChip() {
  const { currency, fx } = useDocCurrency();
  if (!fx || isBaseCurrency(currency)) return null;
  const code = currency.toUpperCase();
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <span className={CHIP} style={{ fontWeight: 500 }}>
          <Globe className="w-2.5 h-2.5 shrink-0" />
          Prices in {code}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[300]">{currencyChipLabel(code, 'Quote')}</TooltipContent>
    </Tooltip>
  );
}

/** "Exchange rate: daily market rate · 1 USD = ₨278.5200": the quote's rate
 *  type and rate, once. Nothing on a base-currency quote. */
export function ExchangeRateNote({ className = '' }: { className?: string }) {
  const { currency, fx } = useDocCurrency();
  if (!fx || isBaseCurrency(currency)) return null;
  return (
    <span className={`text-[11px] leading-[16px] text-slate-500 tabular-nums whitespace-nowrap ${className}`}>
      Exchange rate: {RATE_TYPE_LABEL[fx.rateType].toLowerCase()} · {rateText(currency.toUpperCase(), fx.rate)}
    </span>
  );
}

/** The convert icon after a total in the document's currency. Hover or
 *  focus: "$1,860.00 ≈ ₨518,047.20", the rate type, rate and rate date, and
 *  "Estimate. Nothing posts from a quote." Nothing on a base-currency quote. */
export function TotalConvertHover({
  total,
  contentClassName = 'z-[300]',
}: {
  /** The total, in the document's currency. */
  total: number;
  /** Raises the card over a full-screen modal (the create flow's). */
  contentClassName?: string;
}) {
  const { currency, fx } = useDocCurrency();
  if (!fx || isBaseCurrency(currency)) return null;
  const code = currency.toUpperCase();
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`Total in ${BASE_CURRENCY}`}
          onClick={stop}
          onPointerDown={stop}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 cursor-pointer transition-colors"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="end"
        sideOffset={6}
        arrowPadding={FX_ARROW_PADDING}
        className={`${FX_CARD_CLASS} ${contentClassName}`}
        onClick={stop}
      >
        <p className="text-[12px] leading-[16px] tabular-nums whitespace-nowrap" style={{ color: INK, fontWeight: 600 }}>
          {formatMoney(total, code)} ≈ {formatMoney(toBase(total, fx.rate), BASE_CURRENCY)}
        </p>
        <FxLines>
          <FxLine
            label="Rate type"
            value={
              <span className="inline-flex items-center gap-[6px]">
                <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: RATE_DOT[fx.rateType] }} />
                {RATE_TYPE_LABEL[fx.rateType]}
              </span>
            }
          />
          <FxLine label="Rate" value={`${rateText(code, fx.rate)} ${BASE_CURRENCY}`} />
          <FxLine label="Rate date" value={formatRateDate(fx.rateDate)} />
        </FxLines>
        <p className="mt-[8px] pt-[8px] border-t border-[#EEF2F6] text-[11px] leading-[15px]" style={{ color: MUTED }}>
          Estimate. Nothing posts from a quote.
        </p>
        <FxArrow />
      </HoverCardContent>
    </HoverCard>
  );
}
