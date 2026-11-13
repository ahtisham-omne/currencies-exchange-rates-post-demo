import * as React from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { highlightText } from '@/app/components/InvoiceDataTable';
import { CurrencyFlag } from '@/app/components/currency/CurrencyChip';
import {
  FX_ARROW_PADDING,
  FX_CARD_CLASS,
  FX_FLAG_PX,
  FxArrow,
  FxHead,
  FxInset,
  FxLine,
  FxLines,
  FxNote,
  withCode,
} from '@/app/components/currency/FxCard';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, moneyPrefix } from '@/app/currency/money';
import { addByCurrency, baseSum, type CurrencyAmount } from '@/app/lib/runMath';

/* ── Run money across currencies (Currency & Exchange Rates) ──────────
 * A run pays in several currencies, so a run-level figure is never one
 * raw sum: it reads as each currency's total, then "≈" the base total,
 * which converts every amount at its own rate before adding up. Past a
 * few currencies only the base total shows, with each currency's total on
 * hover. The hover is the shared currency card (FxCard), so it reads like
 * Money's rate card. */

export type { CurrencyAmount };

/** What the base total was converted at, for the hover's footnote. */
export type TotalsBasis = 'invoice' | 'payment';

const BASIS_NOTE: Record<TotalsBasis, string> = {
  invoice: 'Each invoice at its own rate',
  payment: "At each currency's rate on the payment date",
};

/** Per currency, zero currencies dropped (unless that's all there is). */
function tidy(items: CurrencyAmount[]): CurrencyAmount[] {
  const all = addByCurrency(items);
  const nonZero = all.filter((i) => Math.abs(i.amount) >= 0.005);
  return nonZero.length > 0 ? nonZero : all.slice(0, 1);
}

/** "≈ ₨5,712,300.00 PKR" */
export const approxBase = (base: number) => `≈ ${withCode(formatMoney(base, BASE_CURRENCY), BASE_CURRENCY)}`;

/** Text for running copy (toasts, subtitles, quick-card lines): each
 *  currency's total, then the base total. A base-currency total stays
 *  plain; past `max` currencies only the base total. */
export function totalsText(items: CurrencyAmount[], max = 3): string {
  const list = tidy(items);
  if (list.length === 0) return formatMoney(0, BASE_CURRENCY);
  if (list.length === 1 && isBaseCurrency(list[0].currency)) return formatMoney(list[0].amount, BASE_CURRENCY);
  if (list.length > max) return approxBase(baseSum(list));
  return [...list.map((i) => formatMoney(i.amount, i.currency)), approxBase(baseSum(list))].join(' · ');
}

/** One figure for a sentence: the amount when it's all one currency, else
 *  the base total. */
export function totalText(items: CurrencyAmount[]): string {
  const list = tidy(items);
  if (list.length === 0) return formatMoney(0, BASE_CURRENCY);
  if (list.length === 1) return formatMoney(list[0].amount, list[0].currency);
  return approxBase(baseSum(list));
}

/** Only the currencies' own totals, no base ("€12,400.00 · $8,100.00"). */
export function amountsText(items: CurrencyAmount[]): string {
  return tidy(items)
    .map((i) => formatMoney(i.amount, i.currency))
    .join(' · ');
}

/** The hover behind a base total: each currency's total, then the base in
 *  the grey block with what it was converted at. */
export function TotalsCard({ items, basis }: { items: CurrencyAmount[]; basis: TotalsBasis }) {
  const list = tidy(items);
  return (
    <>
      <FxHead
        flag={<CurrencyFlag code={BASE_CURRENCY} size={FX_FLAG_PX} />}
        name={getCurrency(BASE_CURRENCY)?.name ?? BASE_CURRENCY}
        code={BASE_CURRENCY}
        role="base currency"
      />
      <FxLines>
        {list.map((i) => (
          <FxLine
            key={i.currency}
            label={
              <span className="inline-flex items-center gap-[6px]">
                <CurrencyFlag code={i.currency} size={12} />
                In {i.currency}
              </span>
            }
            value={withCode(formatMoney(i.amount, i.currency), i.currency)}
          />
        ))}
      </FxLines>
      <FxInset>
        <FxLine strong label={`In ${BASE_CURRENCY} (base)`} value={withCode(formatMoney(baseSum(list), BASE_CURRENCY), BASE_CURRENCY)} />
        <FxNote>{BASIS_NOTE[basis]}</FxNote>
      </FxInset>
    </>
  );
}

/** The "≈ base" figure with its hover, Money's dotted-underline affordance.
 *  `children` replaces the text (e.g. a search-highlighted copy of it). */
export function BaseTotal({
  items,
  basis,
  className = '',
  style,
  align = 'end',
  children,
}: {
  items: CurrencyAmount[];
  basis: TotalsBasis;
  className?: string;
  style?: React.CSSProperties;
  align?: 'start' | 'center' | 'end';
  children?: React.ReactNode;
}) {
  const list = tidy(items);
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          className={`tabular-nums whitespace-nowrap cursor-help underline decoration-dotted decoration-slate-300 underline-offset-[3px] hover:decoration-slate-500 focus-visible:outline-none focus-visible:decoration-primary ${className}`}
          style={style}
        >
          {children ?? approxBase(baseSum(list))}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align={align}
        className={FX_CARD_CLASS}
        arrowPadding={FX_ARROW_PADDING}
        onClick={(e) => e.stopPropagation()}
      >
        <TotalsCard items={list} basis={basis} />
        <FxArrow />
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * A run-level total: each currency's amount in the caller's amount style,
 * then "≈" the base total in a quieter style (hover for the breakdown).
 * One base-currency amount stays plain; past `max` currencies the base
 * total stands alone in the amount style. `stack` puts each figure on its
 * own right-aligned line (narrow rails).
 */
export function CurrencyTotals({
  items,
  basis,
  max = 3,
  layout = 'inline',
  amountClassName = '',
  amountStyle,
  baseClassName = 'text-[11px] text-slate-500',
  baseStyle = { fontWeight: 500 },
  separatorClassName = 'text-slate-400',
  align = 'end',
}: {
  items: CurrencyAmount[];
  basis: TotalsBasis;
  max?: number;
  layout?: 'inline' | 'stack';
  amountClassName?: string;
  amountStyle?: React.CSSProperties;
  baseClassName?: string;
  baseStyle?: React.CSSProperties;
  separatorClassName?: string;
  /** Where the hover card lines up with the figure; a stack's lines
   *  line up the same way (start = left edge). */
  align?: 'start' | 'center' | 'end';
}) {
  const list = tidy(items);
  const amount = (i: CurrencyAmount) => (
    <span key={i.currency} className={`tabular-nums whitespace-nowrap ${amountClassName}`} style={amountStyle}>
      {formatMoney(i.amount, i.currency)}
    </span>
  );
  if (list.length === 0) return amount({ currency: BASE_CURRENCY, amount: 0, base: 0 });
  if (list.length === 1 && isBaseCurrency(list[0].currency)) return amount(list[0]);
  if (list.length > max) {
    return <BaseTotal items={list} basis={basis} className={amountClassName} style={amountStyle} align={align} />;
  }
  const base = <BaseTotal items={list} basis={basis} className={baseClassName} style={baseStyle} align={align} />;
  if (layout === 'stack') {
    return (
      <span className={`inline-flex flex-col gap-0.5 leading-tight ${align === 'start' ? 'items-start' : 'items-end'}`}>
        {list.map(amount)}
        {base}
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5 min-w-0">
      {list.map((i) => (
        <React.Fragment key={i.currency}>
          {amount(i)}
          <span className={separatorClassName}>·</span>
        </React.Fragment>
      ))}
      {base}
    </span>
  );
}

/** Flag + code, the invoice listing's Currency cell. */
export function CurrencyCell({ code, searchQuery }: { code: string; searchQuery?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground whitespace-nowrap">
      <CurrencyFlag code={code} size={16} />
      <span>{highlightText(code, searchQuery)}</span>
    </span>
  );
}

/** The quiet pill that says a vendor is paid once per currency on this
 *  run (one payment can't mix currencies). */
export function CurrencySplitNote() {
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <span
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center px-1.5 py-px rounded bg-slate-100 text-slate-600 text-[10px] shrink-0 cursor-help whitespace-nowrap"
          style={{ fontWeight: 600 }}
        >
          Split by Currency
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[300] max-w-[240px]">
        This vendor has invoices in more than one currency, so each currency is paid separately.
      </TooltipContent>
    </Tooltip>
  );
}

/** Left padding class for an amount input whose currency prefix sits
 *  inside it: the first class for a one-glyph symbol ($, €), the second
 *  for two (C$, A$), the third for codes and longer symbols (SAR, د.إ).
 *  Callers pass literal classes so the stylesheet carries them. */
export function prefixPadClass(code: string, classes: [string, string, string]): string {
  const glyphs = inputPrefix(code).length;
  return glyphs <= 1 ? classes[0] : glyphs === 2 ? classes[1] : classes[2];
}

/** The symbol (or code) an amount input in this currency starts with. */
export const inputPrefix = (code: string) => moneyPrefix(code).replace('\u200E', '').trim();
