import * as React from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRateDate, rateSentence } from '@/app/currency/money';
import { RATE_TYPE_LABEL, toBase } from '@/app/currency/rates';
import type { InvoiceFx } from '@/app/currency/invoiceFx';
import { CurrencyFlag } from './CurrencyChip';
import { FX_ARROW_PADDING, FX_CARD_CLASS, FX_FLAG_PX, FxAlert, FxArrow, FxHead, FxInset, FxLine, FxLines, FxNote, FxRateType, withCode } from './FxCard';

/* ── Money with its rate ──────────────────────────────────────────────
 * An amount in a foreign currency wears a dotted underline, and hovering it
 * shows what it is in the base currency, at which rate, of which type, and for
 * which day. Base-currency amounts are plain text. The card is the shared
 * currency card (FxCard), so it reads the same as the Partners and Chart of
 * Accounts cards. */

export type MoneyFx = Pick<InvoiceFx, 'rate' | 'rateType' | 'rateDate' | 'source' | 'provisional'> &
  Partial<Pick<InvoiceFx, 'dateLabel'>>;

/** The hover body: the currency, the amount in it, then a grey block with the
 *  base-currency figure and the rate it was converted at. */
export function MoneyCard({
  value,
  currency,
  fx,
  dateLabel,
  role,
}: {
  value: number;
  currency: string;
  fx: MoneyFx;
  /** What the rate date is, e.g. "posting date". Defaults to the fx's own
   *  label (the invoice's rate basis), else the posting date. */
  dateLabel?: string;
  /** "invoice currency", "PO currency", … */
  role?: string;
}) {
  const cur = getCurrency(currency);
  const day = fx.provisional
    ? `Today, ${formatRateDate(fx.rateDate)}`
    : `${formatRateDate(fx.rateDate)} (${dateLabel ?? fx.dateLabel ?? 'posting date'})`;
  return (
    <>
      <FxHead flag={<CurrencyFlag code={currency} size={FX_FLAG_PX} />} name={cur?.name ?? currency} code={currency} role={role} />
      <FxLines>
        <FxLine label={`In ${currency}`} value={withCode(formatMoney(value, currency), currency)} />
      </FxLines>
      <FxInset>
        <FxLine strong label={`In ${BASE_CURRENCY} (base)`} value={withCode(formatMoney(toBase(value, fx.rate), BASE_CURRENCY), BASE_CURRENCY)} />
        <FxNote>At {rateSentence(currency, fx.rate)} · {day}</FxNote>
        <FxRateType type={fx.rateType} label={RATE_TYPE_LABEL[fx.rateType]} source={fx.source} />
        {fx.provisional && <FxAlert>Not posted yet; the rate is set when it posts.</FxAlert>}
      </FxInset>
    </>
  );
}

/**
 * An amount in its currency. With `fx` and a foreign currency, it gets the
 * dotted underline and the rate hover. `children` replaces the rendered text
 * (e.g. a search-highlighted copy of it); the hover stays the same.
 */
export function Money({
  value,
  currency,
  fx,
  className = '',
  dateLabel,
  role = 'invoice currency',
  children,
}: {
  value: number;
  currency: string | null | undefined;
  fx?: MoneyFx | null;
  className?: string;
  dateLabel?: string;
  role?: string;
  children?: React.ReactNode;
}) {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  const text = children ?? formatMoney(value, code);
  if (!fx || isBaseCurrency(code) || !value) {
    return <span className={`tabular-nums ${className}`}>{text}</span>;
  }
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          className={`tabular-nums cursor-help underline decoration-dotted decoration-slate-300 underline-offset-[3px] hover:decoration-slate-500 focus-visible:outline-none focus-visible:decoration-primary ${className}`}
        >
          {text}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className={FX_CARD_CLASS}
        arrowPadding={FX_ARROW_PADDING}
        onClick={(e) => e.stopPropagation()}
      >
        <MoneyCard value={value} currency={code} fx={fx} dateLabel={dateLabel} role={role} />
        <FxArrow />
      </HoverCardContent>
    </HoverCard>
  );
}
