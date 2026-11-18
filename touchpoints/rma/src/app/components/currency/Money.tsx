import * as React from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRateDate, rateSentence } from '@/app/currency/money';
import { RATE_TYPE_LABEL, toBase, type MoneyFx } from '@/app/currency/rates';
import { CurrencyFlag } from './CurrencyChip';
import { FX_ARROW_PADDING, FX_CARD_CLASS, FX_FLAG_PX, FxAlert, FxArrow, FxHead, FxInset, FxLine, FxLines, FxNote, FxRateType, withCode } from './FxCard';

/* ── Money with its rate (as in the Vendor Invoicing touchpoint) ──────
 * In RMA a return keeps the currency of its PO, and dollars are the base: an
 * amount reads "£30.23", and the hover shows "$38.25 USD" and the rate.
 *
 * An amount in a foreign currency wears a dotted underline, and hovering it
 * shows what it is in the base currency, at which rate, of which type, and for
 * which day. Base-currency amounts are plain text. The card is the shared
 * currency card (FxCard), so it reads the same as the Partners and Chart of
 * Accounts cards.
 *
 * Two faces of the same amount:
 *  - Money: the amount in the PO's currency, dollars on hover. Returns show
 *    their amounts this way, as the vendor sees them.
 *  - BaseMoney: the amount in dollars, the PO's currency on hover. */

export type { MoneyFx };

/** "Nov 04, 2026 (vendor invoice date)", or "Today, Nov 18, 2026" for a rate not fixed yet. */
function rateDayText(fx: MoneyFx, dateLabel?: string): string {
  return fx.provisional
    ? `Today, ${formatRateDate(fx.rateDate)}`
    : `${formatRateDate(fx.rateDate)} (${dateLabel ?? fx.dateLabel ?? 'posting date'})`;
}

/** The rate an amount converted at, and its day. For receipts from different
 *  days, each receipt's rate: each one's share converted at its own. */
function RateNote({ currency, fx, dateLabel }: { currency: string; fx: MoneyFx; dateLabel?: string | undefined }) {
  if (fx.breakdown && fx.breakdown.length > 1) {
    return (
      <FxNote>
        At each receipt's rate:
        {fx.breakdown.map((b) => (
          <span key={b.label} className="block tabular-nums">
            {b.label} · {formatRateDate(b.date)} · {rateSentence(currency, b.rate)}
          </span>
        ))}
      </FxNote>
    );
  }
  return (
    <FxNote>
      At {rateSentence(currency, fx.rate)} · {rateDayText(fx, dateLabel)}
    </FxNote>
  );
}

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
  dateLabel?: string | undefined;
  /** "invoice currency", "PO currency", … */
  role?: string | undefined;
}) {
  const cur = getCurrency(currency);
  return (
    <>
      <FxHead flag={<CurrencyFlag code={currency} size={FX_FLAG_PX} />} name={cur?.name ?? currency} code={currency} role={role} />
      <FxLines>
        <FxLine label={`In ${currency}`} value={withCode(formatMoney(value, currency), currency)} />
      </FxLines>
      <FxInset>
        <FxLine strong label={`In ${BASE_CURRENCY} (base)`} value={withCode(formatMoney(toBase(value, fx.rate), BASE_CURRENCY), BASE_CURRENCY)} />
        <RateNote currency={currency} fx={fx} dateLabel={dateLabel} />
        <FxRateType type={fx.rateType} label={RATE_TYPE_LABEL[fx.rateType]} source={fx.source} />
        {fx.provisional && <FxAlert>{fx.note ?? "Not settled yet: at today's rate until it is."}</FxAlert>}
      </FxInset>
    </>
  );
}

/** The hover for an amount shown in base: the base currency on top, the
 *  amount in the vendor's (the document's) currency, then the rate. */
export function BaseMoneyCard({
  value,
  currency,
  fx,
  dateLabel,
  role = 'PO currency',
}: {
  /** The amount in `currency`. */
  value: number;
  currency: string;
  fx: MoneyFx;
  dateLabel?: string | undefined;
  /** What `currency` is to the record: "Vendor currency", "Invoice currency". */
  role?: string | undefined;
}) {
  const base = getCurrency(BASE_CURRENCY);
  return (
    <>
      <FxHead flag={<CurrencyFlag code={BASE_CURRENCY} size={FX_FLAG_PX} />} name={base?.name ?? BASE_CURRENCY} code={BASE_CURRENCY} role="base currency" />
      <FxLines>
        <FxLine strong label={`In ${BASE_CURRENCY}`} value={withCode(formatMoney(toBase(value, fx.rate), BASE_CURRENCY), BASE_CURRENCY)} />
        <FxLine label={role} value={withCode(formatMoney(value, currency), currency)} />
      </FxLines>
      <FxInset>
        <RateNote currency={currency} fx={fx} dateLabel={dateLabel} />
        <FxRateType type={fx.rateType} label={RATE_TYPE_LABEL[fx.rateType]} source={fx.source} />
        {fx.provisional && <FxAlert>{fx.note ?? "Not settled yet: at today's rate until it is."}</FxAlert>}
      </FxInset>
    </>
  );
}

const TRIGGER_CLASS =
  'tabular-nums cursor-help underline decoration-dotted decoration-slate-300 underline-offset-[3px] hover:decoration-slate-500 focus-visible:outline-none focus-visible:decoration-primary';

/** The dotted trigger and the shared card around a hover body. */
function FxHover({ text, className, children }: { text: React.ReactNode; className: string; children: React.ReactNode }) {
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span tabIndex={0} onClick={(e) => e.stopPropagation()} className={`${TRIGGER_CLASS} ${className}`}>
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
        {children}
        <FxArrow />
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * An amount kept in `currency`, shown in the base currency. A foreign one
 * gets the dotted underline and a hover with the vendor's amount and the
 * rate; a base one is plain text. `children` replaces the rendered text
 * (e.g. a search-highlighted or compact copy of it); the hover stays the same.
 */
export function BaseMoney({
  value,
  currency,
  fx,
  className = '',
  dateLabel,
  role,
  children,
}: {
  /** The amount in `currency`. */
  value: number;
  currency: string | null | undefined;
  fx?: MoneyFx | null;
  className?: string | undefined;
  dateLabel?: string | undefined;
  role?: string | undefined;
  children?: React.ReactNode | undefined;
}) {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  if (!fx || isBaseCurrency(code)) {
    return <span className={`tabular-nums ${className}`}>{children ?? formatMoney(value, code)}</span>;
  }
  const text = children ?? formatMoney(toBase(value, fx.rate), BASE_CURRENCY);
  if (!value) return <span className={`tabular-nums ${className}`}>{text}</span>;
  return (
    <FxHover text={text} className={className}>
      <BaseMoneyCard value={value} currency={code} fx={fx} dateLabel={dateLabel} role={role} />
    </FxHover>
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
  role = 'PO currency',
  children,
}: {
  value: number;
  currency: string | null | undefined;
  fx?: MoneyFx | null;
  className?: string | undefined;
  dateLabel?: string | undefined;
  role?: string | undefined;
  children?: React.ReactNode | undefined;
}) {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  const text = children ?? formatMoney(value, code);
  if (!fx || isBaseCurrency(code) || !value) {
    return <span className={`tabular-nums ${className}`}>{text}</span>;
  }
  return (
    <FxHover text={text} className={className}>
      <MoneyCard value={value} currency={code} fx={fx} dateLabel={dateLabel} role={role} />
    </FxHover>
  );
}
