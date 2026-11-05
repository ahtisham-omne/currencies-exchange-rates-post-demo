import * as React from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRateDate, rateSentence } from '@/app/currency/money';
import { RATE_TYPE_LABEL, toBase } from '@/app/currency/rates';
import type { SoFx } from '@/app/currency/soFx';
import { CurrencyFlag } from './CurrencyChip';

/* ── Money with its rate ──────────────────────────────────────────────
 * Shared with Vendor Invoicing and Purchase Orders: an amount in a foreign currency wears a dotted underline, and hovering it
 * shows what it is in the base currency, at which rate, of which type, and
 * for which day. Base-currency amounts are plain text. */

export type MoneyFx = Pick<SoFx, 'rate' | 'rateType' | 'rateDate' | 'source'> & {
  /** Not on an SO yet (creating one): today's rate stands in. */
  provisional?: boolean;
};

/** Rate · type · rate date rows, shared by every rate hover. */
export function RateDetails({
  currency,
  fx,
  dateLabel = 'order date',
}: {
  currency: string;
  fx: MoneyFx;
  /** What the rate date is, e.g. "order date". */
  dateLabel?: string;
}) {
  const rows: [string, React.ReactNode][] = [
    ['Rate', <span className="tabular-nums">{rateSentence(currency, fx.rate)}</span>],
    [
      'Type',
      <span>
        <span style={{ fontWeight: 600, color: fx.rateType === 'mid' ? '#6D28D9' : '#B45309' }}>
          {RATE_TYPE_LABEL[fx.rateType]}
        </span>
        <span className="text-slate-400"> · </span>
        {fx.source}
      </span>,
    ],
    [
      'Rate date',
      fx.provisional ? (
        <span>
          Today, {formatRateDate(fx.rateDate)}
          <span className="block text-[10px] text-amber-700">Not on an order yet; an order takes the rate on its order date.</span>
        </span>
      ) : (
        <span>
          {formatRateDate(fx.rateDate)} <span className="text-slate-400">({dateLabel})</span>
        </span>
      ),
    ],
  ];
  return (
    <dl className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-1.5 text-[11px] leading-snug">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-slate-400" style={{ fontWeight: 500 }}>{k}</dt>
          <dd className="text-slate-700 min-w-0">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/** The hover body: the amount, its base equivalent, then the rate rows. */
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
  dateLabel?: string;
  /** "order currency", "customer currency", … */
  role?: string;
}) {
  const cur = getCurrency(currency);
  return (
    <div className="w-[300px]">
      <div className="px-3.5 pt-3 pb-2.5">
        <div className="flex items-center gap-2 text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
          <CurrencyFlag code={currency} />
          <span className="truncate">
            {cur?.name ?? currency} ({currency})
          </span>
          {role && <span className="text-slate-400 shrink-0">· {role}</span>}
        </div>
        <div className="mt-1.5 text-[16px] text-slate-900 tabular-nums" style={{ fontWeight: 600 }}>
          {formatMoney(value, currency)}
        </div>
        <div className="mt-0.5 text-[12px] text-slate-600 tabular-nums">
          ≈ {formatMoney(toBase(value, fx.rate), BASE_CURRENCY)}{' '}
          <span className="text-slate-400">{BASE_CURRENCY} · base currency</span>
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50/60 px-3.5 py-2.5 rounded-b-xl">
        <RateDetails currency={currency} fx={fx} dateLabel={dateLabel} />
      </div>
    </div>
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
  style,
  dateLabel,
  role = 'order currency',
  children,
}: {
  value: number;
  currency: string | null | undefined;
  fx?: MoneyFx | null;
  className?: string;
  style?: React.CSSProperties;
  dateLabel?: string;
  role?: string;
  children?: React.ReactNode;
}) {
  const code = (currency || BASE_CURRENCY).toUpperCase();
  const text = children ?? formatMoney(value, code);
  if (!fx || isBaseCurrency(code) || !value) {
    return <span className={`tabular-nums ${className}`} style={style}>{text}</span>;
  }
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span
          tabIndex={0}
          style={style}
          className={`tabular-nums cursor-help underline decoration-dotted decoration-slate-300 underline-offset-[3px] hover:decoration-slate-500 focus-visible:outline-none focus-visible:decoration-primary ${className}`}
        >
          {text}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-auto p-0 rounded-xl border border-border/80 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <MoneyCard value={value} currency={code} fx={fx} dateLabel={dateLabel} role={role} />
      </HoverCardContent>
    </HoverCard>
  );
}
