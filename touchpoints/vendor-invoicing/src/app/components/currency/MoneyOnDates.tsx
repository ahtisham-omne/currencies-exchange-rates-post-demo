import * as React from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRateDate, rateSentence } from '@/app/currency/money';
import { RATE_PROVIDER, RATE_TYPE_LABEL, midRateOn, toBase } from '@/app/currency/rates';
import { localTodayIso } from '@/app/lib/dueBucket';
import { useApSettings, type RateDateBasis } from '@/app/hooks/useApSettings';
import { CurrencyFlag } from './CurrencyChip';
import { FX_ARROW_PADDING, FX_CARD_CLASS, FX_FLAG_PX, FxArrow, FxHead, FxInset, FxLine, FxLines, FxNote, FxRateType, withCode } from './FxCard';

/* ── An amount on several days' rates (receiving picker) ──────────────
 * Choosing what to invoice, the amount in the vendor's currency with what it
 * comes to in the base currency on the PO date, the receiving date and
 * today. The day the module default uses (Settings, Module defaults) is
 * marked, so the picker shows which rate an invoice will take. Same shared
 * card (FxCard) and trigger as Money. */

export type RateDayKind = 'poDate' | 'receivingDate' | 'today';

const DAY_LABEL: Record<RateDayKind, string> = {
  poDate: 'PO date',
  receivingDate: 'Receiving date',
  today: 'Today',
};

/** The module default's name in the footer line. */
const BASIS_FOOTER: Record<RateDateBasis, string> = {
  invoiceDate: 'Invoices take the vendor invoice date’s rate, the module default.',
  receivingDate: 'Invoices take the receiving date’s rate, the module default.',
  poDate: 'Invoices take the PO date’s rate, the module default.',
};

export function MoneyOnDatesCard({
  value,
  currency,
  days,
  role,
}: {
  value: number;
  currency: string;
  days: { kind: RateDayKind; date: string }[];
  role?: string;
}) {
  const { rateDateBasis } = useApSettings();
  const cur = getCurrency(currency);
  return (
    <>
      <FxHead flag={<CurrencyFlag code={currency} size={FX_FLAG_PX} />} name={cur?.name ?? currency} code={currency} role={role} />
      <FxLines>
        <FxLine label={`In ${currency}`} value={withCode(formatMoney(value, currency), currency)} />
      </FxLines>
      <FxInset>
        {days.map(({ kind, date }) => {
          const rate = midRateOn(currency, date);
          const used = kind === rateDateBasis;
          return (
            <div key={kind}>
              <FxLine
                strong={used}
                label={`${DAY_LABEL[kind]} · ${formatRateDate(date)}`}
                value={rate != null ? withCode(formatMoney(toBase(value, rate), BASE_CURRENCY), BASE_CURRENCY) : '—'}
              />
              <FxNote small>
                {rate != null ? `At ${rateSentence(currency, rate)}` : 'No rate on this date'}
                {used ? ' · invoices take this rate' : ''}
              </FxNote>
            </div>
          );
        })}
        <FxRateType type="mid" label={RATE_TYPE_LABEL.mid} source={RATE_PROVIDER} />
        <FxNote small>{BASIS_FOOTER[rateDateBasis]}</FxNote>
      </FxInset>
    </>
  );
}

/**
 * An amount in its currency whose hover shows it on the PO date, the
 * receiving date and today. Base-currency amounts are plain text, as Money
 * does. `children` replaces the rendered text; the hover stays the same.
 */
export function MoneyOnDates({
  value,
  currency,
  poDate,
  receivingDate,
  role = 'vendor currency',
  className = '',
  children,
}: {
  value: number;
  currency: string | null | undefined;
  poDate?: string;
  receivingDate?: string;
  role?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  const text = children ?? formatMoney(value, code);
  if (isBaseCurrency(code) || !value) return <span className={`tabular-nums ${className}`}>{text}</span>;
  const days: { kind: RateDayKind; date: string }[] = [
    ...(poDate ? [{ kind: 'poDate' as const, date: poDate }] : []),
    ...(receivingDate ? [{ kind: 'receivingDate' as const, date: receivingDate }] : []),
    { kind: 'today' as const, date: localTodayIso() },
  ];
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
        align="end"
        className={FX_CARD_CLASS}
        arrowPadding={FX_ARROW_PADDING}
        onClick={(e) => e.stopPropagation()}
      >
        <MoneyOnDatesCard value={value} currency={code} days={days} role={role} />
        <FxArrow />
      </HoverCardContent>
    </HoverCard>
  );
}
